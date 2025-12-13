/**
 * Unified Polytope Scene Component - GPU Accelerated
 *
 * High-performance renderer using GPU shaders for N-dimensional transformations.
 * This eliminates CPU transformation overhead by:
 * 1. Storing base N-D vertices as shader attributes
 * 2. Performing rotation/scale/projection in vertex shader
 * 3. Only updating uniform values in useFrame (no buffer copies)
 *
 * @example
 * ```tsx
 * <PolytopeScene
 *   baseVertices={geometry.vertices}
 *   edges={geometry.edges}
 *   faces={detectedFaces}
 *   dimension={4}
 * />
 * ```
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Object3D,
  SphereGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  Color,
  InstancedMesh as ThreeInstancedMesh,
  DoubleSide,
  Matrix4,
} from 'three';

import type { VectorND, Vector3D } from '@/lib/math/types';
import type { Face } from '@/lib/geometry/faces';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { multiplyMatrixVector, createScaleMatrix } from '@/lib/math';
import { projectPerspective, projectOrthographic, DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import {
  DEFAULT_EMISSIVE_INTENSITY,
  DEFAULT_MATERIAL_ROUGHNESS,
  DEFAULT_MATERIAL_METALNESS,
  VERTEX_SIZE_DIVISOR,
} from '@/lib/shaders/constants';
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform';

/**
 * Props for PolytopeScene component
 */
export interface PolytopeSceneProps {
  /** Base (untransformed) vertices in N dimensions */
  baseVertices: VectorND[];
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][];
  /** Detected faces for surface rendering */
  faces?: Face[];
  /** Current dimension of the polytope */
  dimension: number;
  /** Per-face depth values for palette coloring */
  faceDepths?: number[];
  /** Overall opacity (default: 1.0) */
  opacity?: number;
}

// Shared geometry for vertex spheres
const SHARED_SPHERE_GEOMETRY = new SphereGeometry(1, 16, 16);

// Maximum extra dimensions (beyond XYZ + W)
const MAX_EXTRA_DIMS = 7;

/**
 * Generate GPU face shader with full N-D transforms
 *
 * The shader properly handles rotations in planes involving dimensions 5+
 * by using extraRotationCols (how dims 5+ affect x,y,z,w) and depthRowSums
 * (how all inputs contribute to rotated depth).
 */
function createFaceShaderMaterial(
  faceColor: string,
  edgeColor: string,
  opacity: number,
  fresnelEnabled: boolean,
  colorMode: string
): ShaderMaterial {
  const vertexShader = `
    // Transformation uniforms
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;

    // Full N-D rotation support:
    // extraRotationCols[i*4 + j] = how extra dim i affects output j (x,y,z,w)
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    // depthRowSums[j] = sum of how input j contributes to rotated dims 4+
    uniform float uDepthRowSums[11];

    // Extra dimension attributes
    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;
    attribute float aFaceDepth;

    // Varyings
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vFaceDepth;

    void main() {
      // Collect scaled input dimensions
      float scaledInputs[11];
      scaledInputs[0] = position.x * uScale4D.x;
      scaledInputs[1] = position.y * uScale4D.y;
      scaledInputs[2] = position.z * uScale4D.z;
      scaledInputs[3] = aExtraDim0 * uScale4D.w;
      scaledInputs[4] = aExtraDim1 * uExtraScales[0];
      scaledInputs[5] = aExtraDim2 * uExtraScales[1];
      scaledInputs[6] = aExtraDim3 * uExtraScales[2];
      scaledInputs[7] = aExtraDim4 * uExtraScales[3];
      scaledInputs[8] = aExtraDim5 * uExtraScales[4];
      scaledInputs[9] = aExtraDim6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      // Apply 4x4 rotation to first 4 dimensions
      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      // Add contributions from extra dimensions (5+) to x,y,z,w
      // This handles rotations in planes like XW, XV, YV, etc.
      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      // Project to 3D
      vec3 projected;
      if (uProjectionType == 0) {
        // Orthographic
        projected = rotated.xyz;
      } else {
        // Perspective projection
        // Compute rotated depth: sum of contributions to dimensions 4+
        // Using depthRowSums for proper rotated depth calculation
        float effectiveDepth = rotated.w;

        // Add rotated higher dimensions to depth
        // Each input dimension j contributes depthRowSums[j] * scaledInputs[j] to depth
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }

        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;

        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      // Standard transforms
      vec4 mvPosition = modelViewMatrix * vec4(projected, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Compute normal using screen-space derivatives (flat shading)
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = -mvPosition.xyz;
      vFaceDepth = aFaceDepth;
    }
  `;

  const fragmentShader = `
    uniform vec3 uFaceColor;
    uniform vec3 uEdgeColor;
    uniform float uOpacity;
    uniform int uColorMode;
    uniform bool uFresnelEnabled;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vFaceDepth;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Base color based on mode
      vec3 baseColor;
      if (uColorMode == 0) {
        baseColor = uFaceColor;
      } else {
        // Palette mode - interpolate based on face depth
        baseColor = mix(uFaceColor, uEdgeColor, vFaceDepth);
      }

      // Simple lighting
      float ambient = 0.4;
      float diffuse = max(dot(normal, vec3(0.5, 1.0, 0.5)), 0.0) * 0.6;
      vec3 litColor = baseColor * (ambient + diffuse);

      // Fresnel rim lighting
      if (uFresnelEnabled) {
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        litColor += vec3(fresnel * 0.3);
      }

      gl_FragColor = vec4(litColor, uOpacity);
    }
  `;

  return new ShaderMaterial({
    uniforms: {
      uRotationMatrix4D: { value: new Matrix4() },
      uDimension: { value: 4 },
      uScale4D: { value: [1, 1, 1, 1] },
      uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
      uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
      uDepthRowSums: { value: new Float32Array(11) },
      uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
      uProjectionType: { value: 1 },
      uFaceColor: { value: new Color(faceColor) },
      uEdgeColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
      uColorMode: { value: colorMode === 'palette' ? 1 : 0 },
      uFresnelEnabled: { value: fresnelEnabled },
    },
    vertexShader,
    fragmentShader,
    transparent: opacity < 1,
    side: DoubleSide,
    depthWrite: opacity >= 1,
  });
}

/**
 * Generate GPU edge shader with full N-D transforms
 */
function createEdgeShaderMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  const vertexShader = `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];
    uniform float uProjectionDistance;
    uniform int uProjectionType;

    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;

    void main() {
      // Collect scaled input dimensions
      float scaledInputs[11];
      scaledInputs[0] = position.x * uScale4D.x;
      scaledInputs[1] = position.y * uScale4D.y;
      scaledInputs[2] = position.z * uScale4D.z;
      scaledInputs[3] = aExtraDim0 * uScale4D.w;
      scaledInputs[4] = aExtraDim1 * uExtraScales[0];
      scaledInputs[5] = aExtraDim2 * uExtraScales[1];
      scaledInputs[6] = aExtraDim3 * uExtraScales[2];
      scaledInputs[7] = aExtraDim4 * uExtraScales[3];
      scaledInputs[8] = aExtraDim5 * uExtraScales[4];
      scaledInputs[9] = aExtraDim6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      // Apply 4x4 rotation to first 4 dimensions
      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      // Add contributions from extra dimensions (5+) to x,y,z,w
      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
        // Compute rotated depth properly
        float effectiveDepth = rotated.w;
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }
        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;
        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(projected, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uEdgeColor;
    uniform float uOpacity;

    void main() {
      gl_FragColor = vec4(uEdgeColor, uOpacity);
    }
  `;

  return new ShaderMaterial({
    uniforms: {
      uRotationMatrix4D: { value: new Matrix4() },
      uDimension: { value: 4 },
      uScale4D: { value: [1, 1, 1, 1] },
      uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
      uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
      uDepthRowSums: { value: new Float32Array(11) },
      uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
      uProjectionType: { value: 1 },
      uEdgeColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/**
 * Calculate safe projection distance
 */
function calculateSafeProjectionDistance(
  vertices: VectorND[],
  normalizationFactor: number
): number {
  if (vertices.length === 0 || vertices[0]!.length <= 3) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  let maxEffectiveDepth = 0;
  for (const vertex of vertices) {
    let sum = 0;
    for (let d = 3; d < vertex.length; d++) {
      sum += vertex[d]!;
    }
    const effectiveDepth = sum / normalizationFactor;
    maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth);
  }

  return Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0);
}

/**
 * GPU-accelerated polytope renderer.
 * Transformations happen in vertex shaders - only uniforms updated per frame.
 */
export const PolytopeScene = React.memo(function PolytopeScene({
  baseVertices,
  edges,
  faces = [],
  dimension,
  faceDepths = [],
  opacity = 1.0,
}: PolytopeSceneProps) {
  const numVertices = baseVertices.length;
  const numEdges = edges.length;
  const numFaces = faces.length;

  // ============ REFS ============
  const vertexMeshRef = useRef<ThreeInstancedMesh>(null);
  const faceMaterialRef = useRef<ShaderMaterial | null>(null);
  const edgeMaterialRef = useRef<ShaderMaterial | null>(null);

  // Working buffers for vertex sphere positions (still CPU for instancing)
  const workingBuffers = useRef<{
    projectedVertices: Vector3D[];
    tempObject: Object3D;
  } | null>(null);

  useMemo(() => {
    workingBuffers.current = {
      projectedVertices: baseVertices.map(() => [0, 0, 0] as Vector3D),
      tempObject: new Object3D(),
    };
  }, [numVertices]);

  // ============ VISUAL SETTINGS ============
  const {
    vertexVisible,
    edgesVisible,
    facesVisible,
    vertexColor,
    vertexSize: storeVertexSize,
    edgeColor,
    faceColor,
    shaderSettings,
    colorMode,
  } = useVisualStore(
    useShallow((state) => ({
      vertexVisible: state.vertexVisible,
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      vertexColor: state.vertexColor,
      vertexSize: state.vertexSize,
      edgeColor: state.edgeColor,
      faceColor: state.faceColor,
      shaderSettings: state.shaderSettings,
      colorMode: state.colorMode,
    }))
  );

  const vertexSize = storeVertexSize / VERTEX_SIZE_DIVISOR;
  const surfaceSettings = shaderSettings.surface;

  // ============ MATERIALS ============
  const vertexMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(vertexColor),
      emissive: new Color(vertexColor),
      emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
      transparent: opacity < 1,
      opacity,
      roughness: DEFAULT_MATERIAL_ROUGHNESS,
      metalness: DEFAULT_MATERIAL_METALNESS,
    });
  }, [vertexColor, opacity]);

  const faceMaterial = useMemo(() => {
    const mat = createFaceShaderMaterial(
      faceColor,
      edgeColor,
      surfaceSettings.faceOpacity,
      surfaceSettings.fresnelEnabled,
      colorMode
    );
    faceMaterialRef.current = mat;
    return mat;
  }, [faceColor, edgeColor, surfaceSettings.faceOpacity, surfaceSettings.fresnelEnabled, colorMode]);

  const edgeMaterial = useMemo(() => {
    const mat = createEdgeShaderMaterial(edgeColor, opacity);
    edgeMaterialRef.current = mat;
    return mat;
  }, [edgeColor, opacity]);

  // ============ FACE GEOMETRY WITH N-D ATTRIBUTES ============
  const faceGeometry = useMemo(() => {
    if (numFaces === 0) return null;

    let vertexCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) vertexCount += 3;
      else if (face.vertices.length === 4) vertexCount += 6;
    }
    if (vertexCount === 0) return null;

    const geo = new BufferGeometry();

    // Position (XYZ)
    const positions = new Float32Array(vertexCount * 3);
    // Normals
    const normals = new Float32Array(vertexCount * 3);
    // Extra dimensions
    const extraDim0 = new Float32Array(vertexCount); // W
    const extraDim1 = new Float32Array(vertexCount);
    const extraDim2 = new Float32Array(vertexCount);
    const extraDim3 = new Float32Array(vertexCount);
    const extraDim4 = new Float32Array(vertexCount);
    const extraDim5 = new Float32Array(vertexCount);
    const extraDim6 = new Float32Array(vertexCount);
    const faceDepthAttr = new Float32Array(vertexCount);

    let idx = 0;
    let faceIdx = 0;

    const tempVA = new Vector3();
    const tempVB = new Vector3();
    const tempVC = new Vector3();
    const tempCB = new Vector3();
    const tempAB = new Vector3();

    const setVertex = (vIdx: number, depth: number, nx: number, ny: number, nz: number) => {
      const v = baseVertices[vIdx];
      if (!v) return;

      const i3 = idx * 3;
      positions[i3] = v[0] ?? 0;
      positions[i3 + 1] = v[1] ?? 0;
      positions[i3 + 2] = v[2] ?? 0;

      normals[i3] = nx;
      normals[i3 + 1] = ny;
      normals[i3 + 2] = nz;

      extraDim0[idx] = v[3] ?? 0;
      extraDim1[idx] = v[4] ?? 0;
      extraDim2[idx] = v[5] ?? 0;
      extraDim3[idx] = v[6] ?? 0;
      extraDim4[idx] = v[7] ?? 0;
      extraDim5[idx] = v[8] ?? 0;
      extraDim6[idx] = v[9] ?? 0;
      faceDepthAttr[idx] = depth;

      idx++;
    };

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length < 3) {
        faceIdx++;
        continue;
      }

      const depth = faceDepths[faceIdx] ?? 0.5;

      // Calculate initial normal (will be recalculated in shader after transform)
      const v0 = baseVertices[vis[0]!];
      const v1 = baseVertices[vis[1]!];
      const v2 = baseVertices[vis[2]!];

      if (!v0 || !v1 || !v2) {
        faceIdx++;
        continue;
      }

      tempVA.set(v0[0] ?? 0, v0[1] ?? 0, v0[2] ?? 0);
      tempVB.set(v1[0] ?? 0, v1[1] ?? 0, v1[2] ?? 0);
      tempVC.set(v2[0] ?? 0, v2[1] ?? 0, v2[2] ?? 0);
      tempCB.subVectors(tempVC, tempVB);
      tempAB.subVectors(tempVA, tempVB);
      tempCB.cross(tempAB).normalize();

      const nx = tempCB.x;
      const ny = tempCB.y;
      const nz = tempCB.z;

      if (vis.length === 3) {
        setVertex(vis[0]!, depth, nx, ny, nz);
        setVertex(vis[1]!, depth, nx, ny, nz);
        setVertex(vis[2]!, depth, nx, ny, nz);
      } else if (vis.length === 4) {
        setVertex(vis[0]!, depth, nx, ny, nz);
        setVertex(vis[1]!, depth, nx, ny, nz);
        setVertex(vis[2]!, depth, nx, ny, nz);
        setVertex(vis[0]!, depth, nx, ny, nz);
        setVertex(vis[2]!, depth, nx, ny, nz);
        setVertex(vis[3]!, depth, nx, ny, nz);
      }

      faceIdx++;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));
    geo.setAttribute('aFaceDepth', new Float32BufferAttribute(faceDepthAttr, 1));

    return geo;
  }, [numFaces, faces, baseVertices, faceDepths]);

  // ============ EDGE GEOMETRY WITH N-D ATTRIBUTES ============
  const edgeGeometry = useMemo(() => {
    if (numEdges === 0) return null;

    const geo = new BufferGeometry();
    const positions = new Float32Array(numEdges * 2 * 3);
    const extraDim0 = new Float32Array(numEdges * 2);
    const extraDim1 = new Float32Array(numEdges * 2);
    const extraDim2 = new Float32Array(numEdges * 2);
    const extraDim3 = new Float32Array(numEdges * 2);
    const extraDim4 = new Float32Array(numEdges * 2);
    const extraDim5 = new Float32Array(numEdges * 2);
    const extraDim6 = new Float32Array(numEdges * 2);

    let idx = 0;
    for (const [a, b] of edges) {
      const vA = baseVertices[a];
      const vB = baseVertices[b];
      if (!vA || !vB) continue;

      // Vertex A
      positions[idx * 3] = vA[0] ?? 0;
      positions[idx * 3 + 1] = vA[1] ?? 0;
      positions[idx * 3 + 2] = vA[2] ?? 0;
      extraDim0[idx] = vA[3] ?? 0;
      extraDim1[idx] = vA[4] ?? 0;
      extraDim2[idx] = vA[5] ?? 0;
      extraDim3[idx] = vA[6] ?? 0;
      extraDim4[idx] = vA[7] ?? 0;
      extraDim5[idx] = vA[8] ?? 0;
      extraDim6[idx] = vA[9] ?? 0;
      idx++;

      // Vertex B
      positions[idx * 3] = vB[0] ?? 0;
      positions[idx * 3 + 1] = vB[1] ?? 0;
      positions[idx * 3 + 2] = vB[2] ?? 0;
      extraDim0[idx] = vB[3] ?? 0;
      extraDim1[idx] = vB[4] ?? 0;
      extraDim2[idx] = vB[5] ?? 0;
      extraDim3[idx] = vB[6] ?? 0;
      extraDim4[idx] = vB[7] ?? 0;
      extraDim5[idx] = vB[8] ?? 0;
      extraDim6[idx] = vB[9] ?? 0;
      idx++;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));

    return geo;
  }, [numEdges, edges, baseVertices]);

  // ============ CLEANUP ============
  useEffect(() => {
    return () => {
      vertexMaterial.dispose();
      faceMaterial.dispose();
      edgeMaterial.dispose();
      faceGeometry?.dispose();
      edgeGeometry?.dispose();
    };
  }, [vertexMaterial, faceMaterial, edgeMaterial, faceGeometry, edgeGeometry]);

  // ============ USEFRAME: UPDATE UNIFORMS ONLY ============
  useFrame(() => {
    if (numVertices === 0) return;

    // Read current state
    const rotations = useRotationStore.getState().rotations;
    const { uniformScale, perAxisScale } = useTransformStore.getState();
    const projectionType = useProjectionStore.getState().type;

    // Build transformation data
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }

    const rotationMatrix = composeRotations(dimension, rotations);
    const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;
    const projectionDistance = calculateSafeProjectionDistance(baseVertices, normalizationFactor);

    // Update face material uniforms
    if (faceMaterialRef.current) {
      const u = faceMaterialRef.current.uniforms;
      u.uRotationMatrix4D!.value = gpuData.rotationMatrix4D;
      u.uDimension!.value = dimension;
      u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
      const extraScales = u.uExtraScales!.value as Float32Array;
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1;
      }
      // Copy extra rotation data for full N-D rotation
      const extraCols = u.uExtraRotationCols!.value as Float32Array;
      extraCols.set(gpuData.extraRotationCols);
      const depthSums = u.uDepthRowSums!.value as Float32Array;
      depthSums.set(gpuData.depthRowSums);
      u.uProjectionDistance!.value = projectionDistance;
      u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;
    }

    // Update edge material uniforms
    if (edgeMaterialRef.current) {
      const u = edgeMaterialRef.current.uniforms;
      u.uRotationMatrix4D!.value = gpuData.rotationMatrix4D;
      u.uDimension!.value = dimension;
      u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
      const extraScales = u.uExtraScales!.value as Float32Array;
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1;
      }
      // Copy extra rotation data for full N-D rotation
      const extraCols = u.uExtraRotationCols!.value as Float32Array;
      extraCols.set(gpuData.extraRotationCols);
      const depthSums = u.uDepthRowSums!.value as Float32Array;
      depthSums.set(gpuData.depthRowSums);
      u.uProjectionDistance!.value = projectionDistance;
      u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;
    }

    // Vertex spheres still use CPU (InstancedMesh is already efficient)
    if (vertexMeshRef.current && vertexVisible && workingBuffers.current) {
      const { projectedVertices, tempObject } = workingBuffers.current;
      const scaleMatrix = createScaleMatrix(dimension, scales);

      for (let i = 0; i < numVertices; i++) {
        const baseV = baseVertices[i]!;
        const transformed = new Array(dimension).fill(0) as VectorND;

        // Scale
        multiplyMatrixVector(scaleMatrix, baseV, transformed);

        // Rotate
        const temp = [...transformed];
        multiplyMatrixVector(rotationMatrix, temp, transformed);

        // Project
        if (projectionType === 'perspective') {
          projectPerspective(transformed, projectionDistance, projectedVertices[i]!, normalizationFactor);
        } else {
          projectOrthographic(transformed, projectedVertices[i]!);
        }

        const v = projectedVertices[i]!;
        tempObject.position.set(v[0], v[1], v[2]);
        tempObject.scale.set(vertexSize, vertexSize, vertexSize);
        tempObject.updateMatrix();
        vertexMeshRef.current!.setMatrixAt(i, tempObject.matrix);
      }
      vertexMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // ============ RENDER ============
  return (
    <group>
      {/* GPU-rendered faces */}
      {facesVisible && faceGeometry && (
        <mesh geometry={faceGeometry} material={faceMaterial} />
      )}

      {/* GPU-rendered edges */}
      {edgesVisible && edgeGeometry && (
        <lineSegments geometry={edgeGeometry} material={edgeMaterial} />
      )}

      {/* CPU-rendered vertex spheres (InstancedMesh) */}
      {vertexVisible && numVertices > 0 && (
        <instancedMesh
          ref={vertexMeshRef}
          args={[SHARED_SPHERE_GEOMETRY, vertexMaterial, numVertices]}
          frustumCulled={false}
        />
      )}
    </group>
  );
});
