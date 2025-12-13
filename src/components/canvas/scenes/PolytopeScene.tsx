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
 * Update N-D uniforms on a material.
 * Works with both ShaderMaterial (uniforms on material) and
 * MeshPhongMaterial with onBeforeCompile (uniforms in userData).
 */
function updateNDUniforms(
  material: THREE.Material,
  gpuData: ReturnType<typeof matrixToGPUUniforms>,
  dimension: number,
  scales: number[],
  projectionDistance: number,
  projectionType: string
): void {
  // Get uniforms - either from ShaderMaterial directly or from userData for Phong
  let u: Record<string, { value: unknown }> | undefined;

  if ('uniforms' in material && material.uniforms) {
    // ShaderMaterial
    u = (material as ShaderMaterial).uniforms;
  } else if (material.userData?.ndUniforms) {
    // MeshPhongMaterial with onBeforeCompile
    u = material.userData.ndUniforms;
  }

  if (!u) return;

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
 * Convert horizontal/vertical angles to a normalized direction vector.
 * MUST match the light position calculation in SceneLighting.tsx exactly.
 * This is the direction FROM origin TO light (same as light position normalized).
 */
function anglesToDirection(horizontalDeg: number, verticalDeg: number): THREE.Vector3 {
  const hRad = (horizontalDeg * Math.PI) / 180;
  const vRad = (verticalDeg * Math.PI) / 180;
  // Match SceneLighting: x = cos(v)*cos(h), y = sin(v), z = cos(v)*sin(h)
  return new THREE.Vector3(
    Math.cos(vRad) * Math.cos(hRad),
    Math.sin(vRad),
    Math.cos(vRad) * Math.sin(hRad)
  ).normalize();
}

/**
 * Build vertex shader for N-D transformation with lighting varyings
 */
function buildFaceVertexShader(): string {
  return `
    // N-D Transformation uniforms
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

    // Varyings for fragment shader
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    vec3 transformND() {
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

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

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

    void main() {
      vec3 transformed = transformND();
      vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;

      // Pass world position for normal calculation in fragment shader
      vWorldPosition = worldPos.xyz;
      vViewDir = normalize(cameraPosition - worldPos.xyz);
    }
  `;
}

/**
 * Build fragment shader with full lighting (matches Mandelbulb approach)
 */
function buildFaceFragmentShader(): string {
  return `
    // Color uniforms
    uniform vec3 uColor;
    uniform float uOpacity;

    // Lighting uniforms
    uniform bool uLightEnabled;
    uniform vec3 uLightColor;
    uniform vec3 uLightDirection;
    uniform float uLightStrength;
    uniform float uAmbientIntensity;
    uniform float uDiffuseIntensity;
    uniform float uSpecularIntensity;
    uniform float uSpecularPower;
    uniform vec3 uSpecularColor;

    // Fresnel uniforms
    uniform bool uFresnelEnabled;
    uniform float uFresnelIntensity;
    uniform vec3 uRimColor;

    // Varyings
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;

    void main() {
      // Compute face normal from screen-space derivatives of world position
      vec3 dPdx = dFdx(vWorldPosition);
      vec3 dPdy = dFdy(vWorldPosition);
      vec3 normal = normalize(cross(dPdx, dPdy));
      vec3 viewDir = normalize(vViewDir);

      // Start with ambient
      vec3 col = uColor * uAmbientIntensity;

      if (uLightEnabled) {
        vec3 lightDir = normalize(uLightDirection);

        // Diffuse (Lambert) - multiplied by light strength
        float NdotL = max(dot(normal, lightDir), 0.0);
        col += uColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        // Specular (Blinn-Phong) - multiplied by light strength
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        // Fresnel rim lighting
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * NdotL);
          col += uRimColor * rim;
        }
      }

      gl_FragColor = vec4(col, uOpacity);
    }
  `;
}

/**
 * Create face ShaderMaterial with custom lighting (same approach as Mandelbulb)
 */
function createFaceShaderMaterial(
  faceColor: string,
  opacity: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      // N-D transformation uniforms
      ...createNDUniforms(),
      // Color
      uColor: { value: new Color(faceColor) },
      uOpacity: { value: opacity },
      // Lighting (updated every frame from store)
      uLightEnabled: { value: true },
      uLightColor: { value: new Color('#ffffff') },
      uLightDirection: { value: new Vector3(0.5, 1, 0.5).normalize() },
      uLightStrength: { value: 1.0 },
      uAmbientIntensity: { value: 0.3 },
      uDiffuseIntensity: { value: 1.0 },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new Color('#ffffff') },
      // Fresnel
      uFresnelEnabled: { value: false },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new Color('#ffffff') },
    },
    vertexShader: buildFaceVertexShader(),
    fragmentShader: buildFaceFragmentShader(),
    transparent: opacity < 1,
    side: DoubleSide,
    depthWrite: opacity >= 1,
  });
}

/**
 * Build edge vertex shader (N-D transformation only, no lighting)
 */
function buildEdgeVertexShader(): string {
  return `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;

    vec3 transformND() {
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

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

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

    void main() {
      vec3 projected = transformND();
      gl_Position = projectionMatrix * modelViewMatrix * vec4(projected, 1.0);
    }
  `;
}

/**
 * Create edge material with N-D transformation (no lighting)
 */
function createEdgeMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
    },
    vertexShader: buildEdgeVertexShader(),
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/**
 * Create vertex cube ShaderMaterial with custom lighting (same as face material)
 */
function createVertexCubeShaderMaterial(vertexColor: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(vertexColor) },
      uOpacity: { value: opacity },
      // Lighting
      uLightEnabled: { value: true },
      uLightColor: { value: new Color('#ffffff') },
      uLightDirection: { value: new Vector3(0.5, 1, 0.5).normalize() },
      uLightStrength: { value: 1.0 },
      uAmbientIntensity: { value: 0.3 },
      uDiffuseIntensity: { value: 1.0 },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new Color('#ffffff') },
      uFresnelEnabled: { value: false },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new Color('#ffffff') },
    },
    vertexShader: buildFaceVertexShader(),
    fragmentShader: buildFaceFragmentShader(),
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
    }))
  );

  const vertexCubeHalfSize = storeVertexSize / VERTEX_SIZE_DIVISOR;
  const surfaceSettings = shaderSettings.surface;

  // ============ MATERIALS ============
  // Uses custom ShaderMaterial with lighting (same approach as Mandelbulb)
  const faceMaterial = useMemo(() => {
    return createFaceShaderMaterial(faceColor, surfaceSettings.faceOpacity);
  }, [faceColor, surfaceSettings.faceOpacity]);

  const edgeMaterial = useMemo(() => {
    return createEdgeMaterial(edgeColor, opacity);
  }, [edgeColor, opacity]);

  const vertexCubeFaceMaterial = useMemo(() => {
    return createVertexCubeShaderMaterial(vertexColor, opacity);
  }, [vertexColor, opacity]);

  const vertexCubeEdgeMaterial = useMemo(() => {
    return createEdgeMaterial(vertexColor, opacity);
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

    const setVertex = (vIdx: number, depth: number) => {
      const v = baseVertices[vIdx];
      if (!v) return;

      const i3 = idx * 3;
      positions[i3] = v[0] ?? 0;
      positions[i3 + 1] = v[1] ?? 0;
      positions[i3 + 2] = v[2] ?? 0;

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

      // Normals computed in fragment shader via dFdx/dFdy - no need to calculate here
      if (vis.length === 3) {
        setVertex(vis[0]!, depth);
        setVertex(vis[1]!, depth);
        setVertex(vis[2]!, depth);
      } else if (vis.length === 4) {
        setVertex(vis[0]!, depth);
        setVertex(vis[1]!, depth);
        setVertex(vis[2]!, depth);
        setVertex(vis[0]!, depth);
        setVertex(vis[2]!, depth);
        setVertex(vis[3]!, depth);
      }

      faceIdx++;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    // Note: normals are computed in fragment shader via dFdx/dFdy derivatives
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

    // Read lighting settings from store
    const visualState = useVisualStore.getState();
    const lightEnabled = visualState.lightEnabled;
    const lightColor = visualState.lightColor;
    const lightHorizontalAngle = visualState.lightHorizontalAngle;
    const lightVerticalAngle = visualState.lightVerticalAngle;
    const lightStrength = visualState.lightStrength ?? 1.0;
    const ambientIntensity = visualState.ambientIntensity;
    const diffuseIntensity = visualState.diffuseIntensity;
    const specularIntensity = visualState.specularIntensity;
    const shininess = visualState.shininess;
    const specularColor = visualState.specularColor;
    const fresnelEnabled = visualState.shaderSettings.surface.fresnelEnabled;
    const fresnelIntensity = visualState.fresnelIntensity;
    const rimColor = visualState.edgeColor;

    // Calculate light direction from angles
    const lightDirection = anglesToDirection(lightHorizontalAngle, lightVerticalAngle);

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

        // Update N-D transformation uniforms
        updateNDUniforms(material, gpuData, dimension, scales, projectionDistance, projectionType);

        // Update lighting uniforms (only for materials that have them)
        const u = material.uniforms;
        if (u.uLightEnabled) u.uLightEnabled.value = lightEnabled;
        if (u.uLightColor) (u.uLightColor.value as Color).set(lightColor);
        if (u.uLightDirection) (u.uLightDirection.value as Vector3).copy(lightDirection);
        if (u.uLightStrength) u.uLightStrength.value = lightStrength;
        if (u.uAmbientIntensity) u.uAmbientIntensity.value = ambientIntensity;
        if (u.uDiffuseIntensity) u.uDiffuseIntensity.value = diffuseIntensity;
        if (u.uSpecularIntensity) u.uSpecularIntensity.value = specularIntensity;
        if (u.uSpecularPower) u.uSpecularPower.value = shininess;
        if (u.uSpecularColor) (u.uSpecularColor.value as Color).set(specularColor);
        if (u.uFresnelEnabled) u.uFresnelEnabled.value = fresnelEnabled;
        if (u.uFresnelIntensity) u.uFresnelIntensity.value = fresnelIntensity;
        if (u.uRimColor) (u.uRimColor.value as Color).set(rimColor);
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
