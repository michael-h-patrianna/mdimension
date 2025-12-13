/**
 * Unified Polytope Scene Component - GPU Accelerated
 *
 * High-performance renderer using GPU shaders for N-dimensional transformations.
 * All geometry (faces, edges, vertex cubes) uses the same GPU pipeline:
 * 1. Store base N-D vertices as shader attributes
 * 2. Perform rotation/scale/projection in vertex shader
 * 3. Only update uniform values in useFrame (no CPU transformation)
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  ShaderMaterial,
  Color,
  DoubleSide,
  Matrix4,
} from 'three';

import type { VectorND } from '@/lib/math/types';
import type { Face } from '@/lib/geometry/faces';
import { generateVertexCubes } from '@/lib/geometry/vertexCubes';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import { VERTEX_SIZE_DIVISOR } from '@/lib/shaders/constants';
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

// Maximum extra dimensions (beyond XYZ + W)
const MAX_EXTRA_DIMS = 7;

/**
 * Build N-D vertex shader code (shared between all materials)
 */
function buildNDVertexShaderCore(): string {
  return `
    // Transformation uniforms
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    // Extra dimension attributes
    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;

    vec3 transformND() {
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

      // Project to 3D
      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
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

      return projected;
    }
  `;
}

/**
 * Create base uniforms for N-D transformation (shared by all materials)
 */
function createNDUniforms(): Record<string, { value: unknown }> {
  return {
    uRotationMatrix4D: { value: new Matrix4() },
    uDimension: { value: 4 },
    uScale4D: { value: [1, 1, 1, 1] },
    uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
    uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
    uDepthRowSums: { value: new Float32Array(11) },
    uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
    uProjectionType: { value: 1 },
  };
}

/**
 * Update N-D uniforms on a shader material
 */
function updateNDUniforms(
  material: ShaderMaterial,
  gpuData: ReturnType<typeof matrixToGPUUniforms>,
  dimension: number,
  scales: number[],
  projectionDistance: number,
  projectionType: string
): void {
  const u = material.uniforms;
  if (u.uRotationMatrix4D) (u.uRotationMatrix4D.value as Matrix4).copy(gpuData.rotationMatrix4D);
  if (u.uDimension) u.uDimension.value = dimension;
  if (u.uScale4D) u.uScale4D.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
  if (u.uExtraScales) {
    const extraScales = u.uExtraScales.value as Float32Array;
    for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
      extraScales[i] = scales[i + 4] ?? 1;
    }
  }
  if (u.uExtraRotationCols) {
    (u.uExtraRotationCols.value as Float32Array).set(gpuData.extraRotationCols);
  }
  if (u.uDepthRowSums) {
    (u.uDepthRowSums.value as Float32Array).set(gpuData.depthRowSums);
  }
  if (u.uProjectionDistance) u.uProjectionDistance.value = projectionDistance;
  if (u.uProjectionType) u.uProjectionType.value = projectionType === 'perspective' ? 1 : 0;
}

/**
 * Generate GPU face shader material with N-D transforms
 */
function createFaceShaderMaterial(
  faceColor: string,
  edgeColor: string,
  opacity: number,
  fresnelEnabled: boolean,
  colorMode: string
): ShaderMaterial {
  const vertexShader = `
    ${buildNDVertexShaderCore()}

    attribute float aFaceDepth;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vFaceDepth;

    void main() {
      vec3 projected = transformND();
      vec4 mvPosition = modelViewMatrix * vec4(projected, 1.0);
      gl_Position = projectionMatrix * mvPosition;
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

      vec3 baseColor;
      if (uColorMode == 0) {
        baseColor = uFaceColor;
      } else {
        baseColor = mix(uFaceColor, uEdgeColor, vFaceDepth);
      }

      float ambient = 0.4;
      float diffuse = max(dot(normal, vec3(0.5, 1.0, 0.5)), 0.0) * 0.6;
      vec3 litColor = baseColor * (ambient + diffuse);

      if (uFresnelEnabled) {
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        litColor += vec3(fresnel * 0.3);
      }

      gl_FragColor = vec4(litColor, uOpacity);
    }
  `;

  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
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
 * Generate GPU edge shader material with N-D transforms
 */
function createEdgeShaderMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  const vertexShader = `
    ${buildNDVertexShaderCore()}

    void main() {
      vec3 projected = transformND();
      gl_Position = projectionMatrix * modelViewMatrix * vec4(projected, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      gl_FragColor = vec4(uColor, uOpacity);
    }
  `;

  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/**
 * Generate GPU vertex cube face shader material (solid color, simple lighting)
 */
function createVertexCubeFaceMaterial(vertexColor: string, opacity: number): ShaderMaterial {
  const vertexShader = `
    ${buildNDVertexShaderCore()}

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 projected = transformND();
      vec4 mvPosition = modelViewMatrix * vec4(projected, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = -mvPosition.xyz;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      float ambient = 0.5;
      float diffuse = max(dot(normal, vec3(0.5, 1.0, 0.5)), 0.0) * 0.5;
      vec3 litColor = uColor * (ambient + diffuse);
      gl_FragColor = vec4(litColor, uOpacity);
    }
  `;

  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(vertexColor) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: opacity < 1,
    side: DoubleSide,
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
 * Build BufferGeometry with N-D attributes from vertices
 */
function buildNDGeometry(
  vertices: VectorND[],
  setNormal?: (idx: number, normals: Float32Array) => void
): BufferGeometry {
  const count = vertices.length;
  const geo = new BufferGeometry();

  const positions = new Float32Array(count * 3);
  const normals = setNormal ? new Float32Array(count * 3) : null;
  const extraDim0 = new Float32Array(count);
  const extraDim1 = new Float32Array(count);
  const extraDim2 = new Float32Array(count);
  const extraDim3 = new Float32Array(count);
  const extraDim4 = new Float32Array(count);
  const extraDim5 = new Float32Array(count);
  const extraDim6 = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const v = vertices[i]!;
    const i3 = i * 3;
    positions[i3] = v[0] ?? 0;
    positions[i3 + 1] = v[1] ?? 0;
    positions[i3 + 2] = v[2] ?? 0;
    extraDim0[i] = v[3] ?? 0;
    extraDim1[i] = v[4] ?? 0;
    extraDim2[i] = v[5] ?? 0;
    extraDim3[i] = v[6] ?? 0;
    extraDim4[i] = v[7] ?? 0;
    extraDim5[i] = v[8] ?? 0;
    extraDim6[i] = v[9] ?? 0;

    if (normals && setNormal) {
      setNormal(i, normals);
    }
  }

  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (normals) {
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  }
  geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
  geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
  geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
  geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
  geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
  geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
  geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));

  return geo;
}

/**
 * GPU-accelerated polytope renderer.
 * All transformations happen in vertex shaders - only uniforms updated per frame.
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
  const faceMeshRef = useRef<THREE.Mesh>(null);
  const edgeMeshRef = useRef<THREE.LineSegments>(null);
  const vertexCubeFaceMeshRef = useRef<THREE.Mesh>(null);
  const vertexCubeEdgeMeshRef = useRef<THREE.LineSegments>(null);

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

  const vertexCubeHalfSize = storeVertexSize / VERTEX_SIZE_DIVISOR;
  const surfaceSettings = shaderSettings.surface;

  // ============ MATERIALS ============
  const faceMaterial = useMemo(() => {
    return createFaceShaderMaterial(
      faceColor,
      edgeColor,
      surfaceSettings.faceOpacity,
      surfaceSettings.fresnelEnabled,
      colorMode
    );
  }, [faceColor, edgeColor, surfaceSettings.faceOpacity, surfaceSettings.fresnelEnabled, colorMode]);

  const edgeMaterial = useMemo(() => {
    return createEdgeShaderMaterial(edgeColor, opacity);
  }, [edgeColor, opacity]);

  const vertexCubeFaceMaterial = useMemo(() => {
    return createVertexCubeFaceMaterial(vertexColor, opacity);
  }, [vertexColor, opacity]);

  const vertexCubeEdgeMaterial = useMemo(() => {
    return createEdgeShaderMaterial(vertexColor, opacity);
  }, [vertexColor, opacity]);

  // ============ FACE GEOMETRY ============
  const faceGeometry = useMemo(() => {
    if (numFaces === 0) return null;

    let vertexCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) vertexCount += 3;
      else if (face.vertices.length === 4) vertexCount += 6;
    }
    if (vertexCount === 0) return null;

    const geo = new BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const extraDim0 = new Float32Array(vertexCount);
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

  // ============ EDGE GEOMETRY ============
  const edgeGeometry = useMemo(() => {
    if (numEdges === 0) return null;

    const edgeVertices: VectorND[] = [];
    for (const [a, b] of edges) {
      const vA = baseVertices[a];
      const vB = baseVertices[b];
      if (vA && vB) {
        edgeVertices.push(vA, vB);
      }
    }

    return buildNDGeometry(edgeVertices);
  }, [numEdges, edges, baseVertices]);

  // ============ VERTEX CUBE GEOMETRY ============
  const { vertexCubeFaceGeometry, vertexCubeEdgeGeometry } = useMemo(() => {
    if (numVertices === 0) {
      return { vertexCubeFaceGeometry: null, vertexCubeEdgeGeometry: null };
    }

    const cubeData = generateVertexCubes(baseVertices, vertexCubeHalfSize, dimension);

    // Build face geometry with normals
    const faceVertices: VectorND[] = [];
    const faceNormals: [number, number, number][] = [];

    // Cube face normals (6 faces, 2 triangles each = 12 triangles, 3 vertices each = 36 vertices per cube)
    // But our generateVertexCubes returns Face objects with vertex indices
    // We need to expand them into actual vertex data

    const tempV0 = new Vector3();
    const tempV1 = new Vector3();
    const tempV2 = new Vector3();
    const tempCB = new Vector3();
    const tempAB = new Vector3();

    for (const face of cubeData.faces) {
      const vis = face.vertices;
      if (vis.length < 3) continue;

      const v0 = cubeData.vertices[vis[0]!];
      const v1 = cubeData.vertices[vis[1]!];
      const v2 = cubeData.vertices[vis[2]!];

      if (!v0 || !v1 || !v2) continue;

      // Calculate normal
      tempV0.set(v0[0] ?? 0, v0[1] ?? 0, v0[2] ?? 0);
      tempV1.set(v1[0] ?? 0, v1[1] ?? 0, v1[2] ?? 0);
      tempV2.set(v2[0] ?? 0, v2[1] ?? 0, v2[2] ?? 0);
      tempCB.subVectors(tempV2, tempV1);
      tempAB.subVectors(tempV0, tempV1);
      tempCB.cross(tempAB).normalize();

      const normal: [number, number, number] = [tempCB.x, tempCB.y, tempCB.z];

      faceVertices.push(v0, v1, v2);
      faceNormals.push(normal, normal, normal);
    }

    // Build face geometry
    const faceGeo = new BufferGeometry();
    const faceCount = faceVertices.length;
    const facePositions = new Float32Array(faceCount * 3);
    const faceNormalsArr = new Float32Array(faceCount * 3);
    const faceExtraDim0 = new Float32Array(faceCount);
    const faceExtraDim1 = new Float32Array(faceCount);
    const faceExtraDim2 = new Float32Array(faceCount);
    const faceExtraDim3 = new Float32Array(faceCount);
    const faceExtraDim4 = new Float32Array(faceCount);
    const faceExtraDim5 = new Float32Array(faceCount);
    const faceExtraDim6 = new Float32Array(faceCount);

    for (let i = 0; i < faceCount; i++) {
      const v = faceVertices[i]!;
      const n = faceNormals[i]!;
      const i3 = i * 3;
      facePositions[i3] = v[0] ?? 0;
      facePositions[i3 + 1] = v[1] ?? 0;
      facePositions[i3 + 2] = v[2] ?? 0;
      faceNormalsArr[i3] = n[0];
      faceNormalsArr[i3 + 1] = n[1];
      faceNormalsArr[i3 + 2] = n[2];
      faceExtraDim0[i] = v[3] ?? 0;
      faceExtraDim1[i] = v[4] ?? 0;
      faceExtraDim2[i] = v[5] ?? 0;
      faceExtraDim3[i] = v[6] ?? 0;
      faceExtraDim4[i] = v[7] ?? 0;
      faceExtraDim5[i] = v[8] ?? 0;
      faceExtraDim6[i] = v[9] ?? 0;
    }

    faceGeo.setAttribute('position', new Float32BufferAttribute(facePositions, 3));
    faceGeo.setAttribute('normal', new Float32BufferAttribute(faceNormalsArr, 3));
    faceGeo.setAttribute('aExtraDim0', new Float32BufferAttribute(faceExtraDim0, 1));
    faceGeo.setAttribute('aExtraDim1', new Float32BufferAttribute(faceExtraDim1, 1));
    faceGeo.setAttribute('aExtraDim2', new Float32BufferAttribute(faceExtraDim2, 1));
    faceGeo.setAttribute('aExtraDim3', new Float32BufferAttribute(faceExtraDim3, 1));
    faceGeo.setAttribute('aExtraDim4', new Float32BufferAttribute(faceExtraDim4, 1));
    faceGeo.setAttribute('aExtraDim5', new Float32BufferAttribute(faceExtraDim5, 1));
    faceGeo.setAttribute('aExtraDim6', new Float32BufferAttribute(faceExtraDim6, 1));

    // Build edge geometry
    const edgeVertices: VectorND[] = [];
    for (const [a, b] of cubeData.edges) {
      const vA = cubeData.vertices[a];
      const vB = cubeData.vertices[b];
      if (vA && vB) {
        edgeVertices.push(vA, vB);
      }
    }

    const edgeGeo = buildNDGeometry(edgeVertices);

    return {
      vertexCubeFaceGeometry: faceGeo,
      vertexCubeEdgeGeometry: edgeGeo,
    };
  }, [numVertices, baseVertices, vertexCubeHalfSize, dimension]);

  // ============ CLEANUP ============
  useEffect(() => {
    return () => {
      faceMaterial.dispose();
      edgeMaterial.dispose();
      vertexCubeFaceMaterial.dispose();
      vertexCubeEdgeMaterial.dispose();
      faceGeometry?.dispose();
      edgeGeometry?.dispose();
      vertexCubeFaceGeometry?.dispose();
      vertexCubeEdgeGeometry?.dispose();
    };
  }, [
    faceMaterial,
    edgeMaterial,
    vertexCubeFaceMaterial,
    vertexCubeEdgeMaterial,
    faceGeometry,
    edgeGeometry,
    vertexCubeFaceGeometry,
    vertexCubeEdgeGeometry,
  ]);

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

    // Update all materials through mesh refs
    const meshRefs = [
      faceMeshRef,
      edgeMeshRef,
      vertexCubeFaceMeshRef,
      vertexCubeEdgeMeshRef,
    ];

    for (const ref of meshRefs) {
      if (ref.current) {
        const material = ref.current.material as ShaderMaterial;
        if (material.uniforms) {
          updateNDUniforms(material, gpuData, dimension, scales, projectionDistance, projectionType);
        }
      }
    }
  });

  // ============ RENDER ============
  return (
    <group>
      {/* Polytope faces */}
      {facesVisible && faceGeometry && (
        <mesh ref={faceMeshRef} geometry={faceGeometry} material={faceMaterial} />
      )}

      {/* Polytope edges */}
      {edgesVisible && edgeGeometry && (
        <lineSegments ref={edgeMeshRef} geometry={edgeGeometry} material={edgeMaterial} />
      )}

      {/* Vertex cube faces */}
      {vertexVisible && vertexCubeFaceGeometry && (
        <mesh ref={vertexCubeFaceMeshRef} geometry={vertexCubeFaceGeometry} material={vertexCubeFaceMaterial} />
      )}

      {/* Vertex cube edges */}
      {vertexVisible && vertexCubeEdgeGeometry && (
        <lineSegments ref={vertexCubeEdgeMeshRef} geometry={vertexCubeEdgeGeometry} material={vertexCubeEdgeMaterial} />
      )}
    </group>
  );
});
