/**
 * Unified Polytope Scene Component - GPU Accelerated
 *
 * High-performance renderer using GPU shaders for N-dimensional transformations.
 * All geometry (faces, edges) uses the same GPU pipeline:
 * 1. Store base N-D vertices as shader attributes
 * 2. Perform rotation/scale/projection in vertex shader
 * 3. Only update uniform values in useFrame (no CPU transformation)
 */

import { useTrackedShaderMaterial } from '@/rendering/materials/useTrackedShaderMaterial';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
    BufferGeometry,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    Matrix4,
    MeshBasicMaterial,
    ShaderMaterial,
    Vector3,
    Vector4,
} from 'three';
import { useShallow } from 'zustand/react/shallow';

import type { Face } from '@/lib/geometry/faces';
import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import { composeRotations } from '@/lib/math/rotation';
import type { VectorND } from '@/lib/math/types';
import { createColorCache, createLightColorCache, updateLightColorUniform, updateLinearColorUniform } from '@/rendering/colors/linearCache';
import { RENDER_LAYERS } from '@/rendering/core/layers';
import type { LightSource } from '@/rendering/lights/types';
import { LIGHT_TYPE_TO_INT, MAX_LIGHTS, rotationToDirection } from '@/rendering/lights/types';
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette';
// Note: We no longer use custom shadow shaders - we patch MeshDepthMaterial and
// MeshDistanceMaterial via onBeforeCompile to inject our nD vertex transformation.
// This avoids the double shadow bug caused by raw ShaderMaterial shadow materials.
import { matrixToGPUUniforms, MAX_GPU_DIMENSION } from '@/rendering/shaders/transforms/ndTransform';
import {
    blurToPCFSamples,
    collectShadowDataFromScene,
    createShadowMapUniforms,
    SHADOW_MAP_SIZES,
    updateShadowMapUniforms,
} from '@/rendering/shadows';
import { useAnimationStore } from '@/stores/animationStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useLightingStore } from '@/stores/lightingStore';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { TubeWireframe } from '../TubeWireframe';
import {
    buildEdgeFragmentShader,
    buildEdgeVertexShader,
    buildFaceFragmentShader,
    buildFaceVertexShader,
    MAX_EXTRA_DIMS,
} from './index';

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

/**
 * Create base uniforms for N-D transformation (shared by all materials)
 */
function createNDUniforms(): Record<string, { value: unknown }> {
  return {
    uRotationMatrix4D: { value: new Matrix4() },
    uDimension: { value: 4 },
    uScale4D: { value: new Vector4(1, 1, 1, 1) },
    uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
    uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
    uDepthRowSums: { value: new Float32Array(11) },
    uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
    // Vertex modulation uniforms - radial breathing with bias
    uAnimTime: { value: 0.0 },       // Time in seconds
    uModAmplitude: { value: 0.0 },   // Displacement amplitude (0-1)
    uModFrequency: { value: 0.05 },  // Oscillation frequency (0.01-0.20)
    uModWave: { value: 0.0 },        // Distance-based phase offset (wave effect)
    uModBias: { value: 0.0 },        // Per-vertex/dimension phase variation
  };
}

/**
 * Update N-D uniforms on a material.
 * Works with both ShaderMaterial (uniforms on material) and
 * MeshPhongMaterial with onBeforeCompile (uniforms in userData).
 * @param material
 * @param gpuData
 * @param dimension
 * @param scales
 * @param projectionDistance
 */
function updateNDUniforms(
  material: THREE.Material,
  gpuData: ReturnType<typeof matrixToGPUUniforms>,
  dimension: number,
  scales: number[],
  projectionDistance: number
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
  if (u.uScale4D) {
    const s0 = scales[0] ?? 1;
    const s1 = scales[1] ?? 1;
    const s2 = scales[2] ?? 1;
    const s3 = scales[3] ?? 1;
    if (u.uScale4D.value instanceof Vector4) {
      u.uScale4D.value.set(s0, s1, s2, s3);
    } else {
      u.uScale4D.value = [s0, s1, s2, s3];
    }
  }
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
}

/**
 * Convert horizontal/vertical angles to a normalized direction vector.
 * MUST match the light position calculation in SceneLighting.tsx exactly.
 * This is the direction FROM origin TO light (same as light position normalized).
 * @param horizontalDeg
 * @param verticalDeg
 * @param target - Optional target vector to write to
 */
function anglesToDirection(horizontalDeg: number, verticalDeg: number, target?: THREE.Vector3): THREE.Vector3 {
  const hRad = (horizontalDeg * Math.PI) / 180;
  const vRad = (verticalDeg * Math.PI) / 180;
  const t = target || new THREE.Vector3();
  // Match SceneLighting: x = cos(v)*cos(h), y = sin(v), z = cos(v)*sin(h)
  return t.set(
    Math.cos(vRad) * Math.cos(hRad),
    Math.sin(vRad),
    Math.cos(vRad) * Math.sin(hRad)
  ).normalize();
}

/**
 * Create edge material with N-D transformation (no lighting)
 *
 * @param edgeColor - CSS color string for the edge
 * @param opacity - Edge opacity (0-1)
 * @returns Configured ShaderMaterial for edge rendering
 */
function createEdgeMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(edgeColor).convertSRGBToLinear() },
      uOpacity: { value: opacity },
    },
    vertexShader: buildEdgeVertexShader(),
    fragmentShader: buildEdgeFragmentShader(),
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    glslVersion: THREE.GLSL3,
  });
}

/**
 * GLSL code block containing the nD transformation functions for shadow materials.
 * This is injected into MeshDepthMaterial and MeshDistanceMaterial via onBeforeCompile.
 */
const ND_TRANSFORM_GLSL = `
#define MAX_EXTRA_DIMS 7

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Vertex modulation uniforms
uniform float uAnimTime;
uniform float uModAmplitude;
uniform float uModFrequency;
uniform float uModWave;
uniform float uModBias;

// Packed extra dimension attributes
attribute vec4 aExtraDims0_3;
attribute vec3 aExtraDims4_6;

vec3 ndTransformVertex(vec3 pos) {
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = aExtraDims0_3.x * uScale4D.w;
  scaledInputs[4] = aExtraDims0_3.y * uExtraScales[0];
  scaledInputs[5] = aExtraDims0_3.z * uExtraScales[1];
  scaledInputs[6] = aExtraDims0_3.w * uExtraScales[2];
  scaledInputs[7] = aExtraDims4_6.x * uExtraScales[3];
  scaledInputs[8] = aExtraDims4_6.y * uExtraScales[4];
  scaledInputs[9] = aExtraDims4_6.z * uExtraScales[5];
  scaledInputs[10] = 0.0;

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
  effectiveDepth /= normFactor;
  float denom = uProjectionDistance - effectiveDepth;
  if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
  float factor = 1.0 / denom;
  vec3 projected = rotated.xyz * factor;

  // Apply vertex modulation
  if (uModAmplitude > 0.001) {
    float extraSum = aExtraDims0_3.x + aExtraDims0_3.y + aExtraDims0_3.z + aExtraDims0_3.w + aExtraDims4_6.x + aExtraDims4_6.y + aExtraDims4_6.z;
    float t = uAnimTime * uModFrequency * 0.1;
    float dist = length(projected);
    float wavePhase = dist * uModWave * 2.0;
    float vertexBias = (projected.x * 1.0 + projected.y * 1.618 + projected.z * 2.236) * uModBias;
    float dimensionBias = extraSum * uModBias * 0.5;
    float totalPhase = t + wavePhase + vertexBias + dimensionBias;
    float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;
    projected = projected * scale;
  }

  return projected;
}
`;

/**
 * Create patched shadow materials using Three.js's built-in MeshDepthMaterial
 * and MeshDistanceMaterial with our nD vertex transformation injected.
 *
 * This approach avoids the double shadow bug that occurs when using raw
 * ShaderMaterial for shadow materials. Three.js's internal shadow pipeline
 * has special handling for MeshDistanceMaterial (updating referencePosition,
 * nearDistance, farDistance automatically) that raw ShaderMaterial can't satisfy.
 *
 * @param uniforms - Shared uniform objects that are updated per-frame
 * @returns Object containing patched depthMaterial and distanceMaterial
 */
function createPatchedShadowMaterials(uniforms: Record<string, { value: unknown }>): {
  depthMaterial: THREE.MeshDepthMaterial;
  distanceMaterial: THREE.MeshDistanceMaterial;
} {
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });

  const distanceMaterial = new THREE.MeshDistanceMaterial();

  const patchMaterial = (mat: THREE.Material) => {
    mat.onBeforeCompile = (shader) => {
      // Merge our nD uniforms with Three.js's built-in uniforms
      Object.assign(shader.uniforms, uniforms);

      // Inject our GLSL helpers after #include <common>
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${ND_TRANSFORM_GLSL}`
      );

      // Apply our nD transformation after #include <begin_vertex>
      // Three.js sets `transformed` to the local-space vertex position there
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed = ndTransformVertex(transformed);`
      );
    };
    mat.needsUpdate = true;
  };

  patchMaterial(depthMaterial);
  patchMaterial(distanceMaterial);

  return { depthMaterial, distanceMaterial };
}

/**
 * Calculate safe projection distance
 * @param vertices
 * @param normalizationFactor
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
 * Build BufferGeometry with N-D attributes from vertices.
 * Uses packed attributes (vec4 + vec3) for extra dimensions to stay within WebGL 16 attribute limit.
 * @param vertices
 * @param setNormal
 */
function buildNDGeometry(
  vertices: VectorND[],
  setNormal?: (idx: number, normals: Float32Array) => void
): BufferGeometry {
  const count = vertices.length;
  const geo = new BufferGeometry();

  const positions = new Float32Array(count * 3);
  const normals = setNormal ? new Float32Array(count * 3) : null;
  // Packed extra dimensions: vec4 (dims 4-7) + vec3 (dims 8-10)
  const extraDims0_3 = new Float32Array(count * 4);
  const extraDims4_6 = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const v = vertices[i]!;
    const i3 = i * 3;
    const i4 = i * 4;

    // Position (vec3)
    positions[i3] = v[0] ?? 0;
    positions[i3 + 1] = v[1] ?? 0;
    positions[i3 + 2] = v[2] ?? 0;

    // Extra dims packed: vec4(dims 4-7) + vec3(dims 8-10)
    extraDims0_3[i4] = v[3] ?? 0;
    extraDims0_3[i4 + 1] = v[4] ?? 0;
    extraDims0_3[i4 + 2] = v[5] ?? 0;
    extraDims0_3[i4 + 3] = v[6] ?? 0;
    extraDims4_6[i3] = v[7] ?? 0;
    extraDims4_6[i3 + 1] = v[8] ?? 0;
    extraDims4_6[i3 + 2] = v[9] ?? 0;

    if (normals && setNormal) {
      setNormal(i, normals);
    }
  }

  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (normals) {
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  }
  // Packed extra dimension attributes
  geo.setAttribute('aExtraDims0_3', new Float32BufferAttribute(extraDims0_3, 4));
  geo.setAttribute('aExtraDims4_6', new Float32BufferAttribute(extraDims4_6, 3));

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
  faceDepths: _faceDepths = [],
  opacity = 1.0,
}: PolytopeSceneProps) {
  void _faceDepths; // Reserved for future per-face depth-based coloring
  const numVertices = baseVertices.length;
  const numEdges = edges.length;
  const numFaces = faces.length;

  // ============ REFS ============
  const faceMeshRef = useRef<THREE.Mesh>(null);
  const edgeMeshRef = useRef<THREE.LineSegments>(null);

  // Animation time accumulator for polytope animations
  const animTimeRef = useRef(0.0);

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  const colorCacheRef = useRef(createColorCache());
  const lightColorCacheRef = useRef(createLightColorCache());

  // Performance optimization: Cache store state in refs to avoid getState() calls every frame
  const animationStateRef = useRef(useAnimationStore.getState());
  const extendedObjectStateRef = useRef(useExtendedObjectStore.getState());
  const rotationStateRef = useRef(useRotationStore.getState());
  const transformStateRef = useRef(useTransformStore.getState());
  const appearanceStateRef = useRef(useAppearanceStore.getState());
  const lightingStateRef = useRef(useLightingStore.getState());

  // Subscribe to store changes to update refs
  useEffect(() => {
    const unsubAnim = useAnimationStore.subscribe((s) => { animationStateRef.current = s; });
    const unsubExt = useExtendedObjectStore.subscribe((s) => { extendedObjectStateRef.current = s; });
    const unsubRot = useRotationStore.subscribe((s) => { rotationStateRef.current = s; });
    const unsubTrans = useTransformStore.subscribe((s) => { transformStateRef.current = s; });
    const unsubApp = useAppearanceStore.subscribe((s) => { appearanceStateRef.current = s; });
    const unsubLight = useLightingStore.subscribe((s) => { lightingStateRef.current = s; });
    return () => {
      unsubAnim();
      unsubExt();
      unsubRot();
      unsubTrans();
      unsubApp();
      unsubLight();
    };
  }, []);

  // P3 Optimization: Cache matrix computations to avoid per-frame recomputation
  // Only recompute when rotations or dimension actually change
  // const cachedRotationsRef = useRef<Map<string, number>>(new Map()); // REMOVED
  const prevRotationVersionRef = useRef<number>(-1);
  const cachedGpuDataRef = useRef<ReturnType<typeof matrixToGPUUniforms> | null>(null);
  const cachedDimensionRef = useRef<number>(0);
  // Cache projection distance (only changes when baseVertices change, i.e., geometry change)
  const cachedProjectionDistanceRef = useRef<{ count: number; distance: number }>({ count: 0, distance: 10 });

  // Cache scales array to avoid per-frame allocation
  const cachedScalesRef = useRef<number[]>([]);
  // Cache light direction to avoid per-frame allocation
  const cachedLightDirectionRef = useRef(new Vector3());

  // Simple callback ref for edge mesh - just assigns layer
  const setEdgeMeshRef = useCallback((lineSegments: THREE.LineSegments | null) => {
    edgeMeshRef.current = lineSegments;
    if (lineSegments?.layers) {
      lineSegments.layers.set(RENDER_LAYERS.MAIN_OBJECT);
    }
  }, []);

  // ============ VISUAL SETTINGS ============
  const {
    edgesVisible,
    facesVisible,
    edgeColor,
    edgeThickness,
    edgeMetallic,
    edgeRoughness,
    faceColor,
    shaderSettings,
    sssEnabled,
  } = useAppearanceStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      edgeColor: state.edgeColor,
      edgeThickness: state.edgeThickness,
      edgeMetallic: state.edgeMetallic,
      edgeRoughness: state.edgeRoughness,
      faceColor: state.faceColor,
      shaderSettings: state.shaderSettings,
      sssEnabled: state.sssEnabled,
    }))
  );

  const shadowEnabled = useLightingStore((state) => state.shadowEnabled);

  const surfaceSettings = shaderSettings.surface;
  // Use TubeWireframe for thick lines (>1), native lineSegments for thin lines (1)
  const useFatWireframe = edgeThickness > 1;

  // ============ MATERIALS ============
  // Uses custom ShaderMaterial with lighting (same approach as Mandelbulb)
  // DoubleSide handles both front and back faces - two-pass rendering disabled
  // because nD transformations can flip winding order, causing culling issues.
  // Feature flags in deps trigger shader recompilation when features are toggled

  // Compute shader composition separately to get modules/features for debug info
  const { glsl: faceFragmentShader, modules: faceShaderModules, features: faceShaderFeatures } = useMemo(() => {
    return buildFaceFragmentShader({
      shadows: shadowEnabled,
      fog: false, // Physical fog handled by post-process
      sss: sssEnabled,
      fresnel: surfaceSettings.fresnelEnabled,
    });
  }, [shadowEnabled, sssEnabled, surfaceSettings.fresnelEnabled]);

  // Create face material with tracking - shows overlay during shader compilation
  const { material: faceMaterial, isCompiling: isFaceShaderCompiling } = useTrackedShaderMaterial(
    'Polytope Face Shader',
    () => {
      return new ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          // N-D transformation uniforms
          ...createNDUniforms(),
          // Shadow map uniforms
          ...createShadowMapUniforms(),
          // Color (converted to linear space for physically correct lighting)
          uColor: { value: new Color(faceColor).convertSRGBToLinear() },
          uOpacity: { value: surfaceSettings.faceOpacity },
          // Material properties for G-buffer
          uMetallic: { value: 0.0 },
          // GGX PBR roughness
          uRoughness: { value: 0.3 },
          // View matrix for normal transformation (updated every frame)
          uViewMatrix: { value: new Matrix4() },
          // Advanced Color System uniforms
          uColorAlgorithm: { value: 2 }, // Default to cosine
          uCosineA: { value: new Vector3(0.5, 0.5, 0.5) },
          uCosineB: { value: new Vector3(0.5, 0.5, 0.5) },
          uCosineC: { value: new Vector3(1.0, 1.0, 1.0) },
          uCosineD: { value: new Vector3(0.0, 0.33, 0.67) },
          uDistPower: { value: 1.0 },
          uDistCycles: { value: 1.0 },
          uDistOffset: { value: 0.0 },
          uLchLightness: { value: 0.7 },
          uLchChroma: { value: 0.15 },
          uMultiSourceWeights: { value: new Vector3(0.5, 0.3, 0.2) },
          // Lighting (updated every frame from store, colors converted to linear space)
          uLightEnabled: { value: true },
          uLightColor: { value: new Color('#ffffff').convertSRGBToLinear() },
          uLightDirection: { value: new Vector3(0.5, 1, 0.5).normalize() },
          uLightStrength: { value: 1.0 },
          uAmbientIntensity: { value: 0.3 },
          uAmbientColor: { value: new Color('#FFFFFF').convertSRGBToLinear() },
          uDiffuseIntensity: { value: 1.0 },
          uSpecularIntensity: { value: 1.0 },
          uSpecularPower: { value: 32.0 },
          uSpecularColor: { value: new Color('#ffffff').convertSRGBToLinear() },
          // Fresnel (colors converted to linear space)
          uFresnelEnabled: { value: false },
          uFresnelIntensity: { value: 0.5 },
          uRimColor: { value: new Color('#ffffff').convertSRGBToLinear() },
          // Rim SSS (subsurface scattering for backlight transmission)
          uSssEnabled: { value: false },
          uSssIntensity: { value: 1.0 },
          uSssColor: { value: new Color('#ff8844').convertSRGBToLinear() },
          uSssThickness: { value: 1.0 },
          uSssJitter: { value: 0.2 },
          // Multi-light system uniforms (colors converted to linear space)
          uNumLights: { value: 0 },
          uLightsEnabled: { value: [false, false, false, false] },
          uLightTypes: { value: [0, 0, 0, 0] },
          uLightPositions: { value: [new Vector3(0, 5, 0), new Vector3(0, 5, 0), new Vector3(0, 5, 0), new Vector3(0, 5, 0)] },
          uLightDirections: { value: [new Vector3(0, -1, 0), new Vector3(0, -1, 0), new Vector3(0, -1, 0), new Vector3(0, -1, 0)] },
          uLightColors: { value: [new Color('#FFFFFF').convertSRGBToLinear(), new Color('#FFFFFF').convertSRGBToLinear(), new Color('#FFFFFF').convertSRGBToLinear(), new Color('#FFFFFF').convertSRGBToLinear()] },
          uLightIntensities: { value: [1.0, 1.0, 1.0, 1.0] },
          uSpotAngles: { value: [Math.PI / 6, Math.PI / 6, Math.PI / 6, Math.PI / 6] },
          uSpotPenumbras: { value: [0.5, 0.5, 0.5, 0.5] },
          // Precomputed cosines: default 30° cone with 0.5 penumbra → inner=15°, outer=30°
          uSpotCosInner: { value: [Math.cos(Math.PI / 12), Math.cos(Math.PI / 12), Math.cos(Math.PI / 12), Math.cos(Math.PI / 12)] },
          uSpotCosOuter: { value: [Math.cos(Math.PI / 6), Math.cos(Math.PI / 6), Math.cos(Math.PI / 6), Math.cos(Math.PI / 6)] },
          // Range and decay for distance attenuation (0 = infinite range, 2 = inverse square decay)
          uLightRanges: { value: [0, 0, 0, 0] },
          uLightDecays: { value: [2, 2, 2, 2] },
        },
        vertexShader: buildFaceVertexShader(),
        fragmentShader: faceFragmentShader,
        // Initial transparency state - updated dynamically in useFrame based on current opacity
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      });
    },
    // Note: faceOpacity removed from deps - it's updated via uniforms in useFrame.
    // Changing opacity value should NOT trigger shader rebuild, only feature toggles should.
    [faceColor, surfaceSettings.fresnelEnabled, sssEnabled, faceFragmentShader]
  );


  const edgeMaterial = useMemo(() => {
    return createEdgeMaterial(edgeColor, opacity);
  }, [edgeColor, opacity]);

  // Create shared uniforms for shadow materials (patched MeshDepthMaterial and MeshDistanceMaterial)
  // These uniforms are shared with the main face material and updated per-frame
  const shadowUniforms = useMemo(() => createNDUniforms(), []);

  // Custom depth/distance materials for shadow map rendering with nD transformation.
  // Uses patched Three.js built-in materials (via onBeforeCompile) to avoid the double
  // shadow bug that occurs with raw ShaderMaterial. Three.js handles MeshDistanceMaterial
  // specially (auto-updating referencePosition, nearDistance, farDistance for point lights).
  const { depthMaterial: customDepthMaterial, distanceMaterial: customDistanceMaterial } = useMemo(
    () => createPatchedShadowMaterials(shadowUniforms),
    [shadowUniforms]
  );

  // Callback ref to assign main object layer for depth-based effects (SSR, refraction, bokeh)
  // Also assigns custom depth materials for animated shadows - this MUST happen in the callback
  // because if done in useEffect, the effect may run before the mesh exists
  const setFaceMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    faceMeshRef.current = mesh;
    if (mesh?.layers) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT);
    }
    // Assign patched shadow materials for nD transformation:
    // - customDepthMaterial (MeshDepthMaterial): for directional and spot lights
    // - customDistanceMaterial (MeshDistanceMaterial): for point lights
    //
    // Using patched built-in materials via onBeforeCompile avoids the double shadow bug
    // that occurred with raw ShaderMaterial. Three.js handles MeshDistanceMaterial specially,
    // auto-updating referencePosition/nearDistance/farDistance for point light shadow cameras.
    // No onBeforeShadow callback needed - Three.js manages everything automatically.
    if (mesh && shadowEnabled) {
      // Always assign both materials - works with any light type combination
      mesh.customDepthMaterial = customDepthMaterial;
      mesh.customDistanceMaterial = customDistanceMaterial;
    } else if (mesh) {
      mesh.customDistanceMaterial = undefined as unknown as THREE.Material;
      mesh.customDepthMaterial = undefined as unknown as THREE.Material;
    }
  }, [shadowEnabled, customDepthMaterial, customDistanceMaterial]);

  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo);

  useEffect(() => {
    // Report shader stats for debugging (only when materials are ready)
    const activeMaterial = facesVisible ? faceMaterial : edgeMaterial;
    if (!activeMaterial) return;

    const name = facesVisible ? 'Polytope Face Shader' : 'Polytope Edge Shader';

    // Use modules/features from shader compilation for face shader, compute for edge shader
    let modules: string[];
    let features: string[];
    if (facesVisible) {
        // Use the actual modules from shader composition
        modules = ['ND Transform', 'Modulation', ...faceShaderModules];
        // Start with shader-compiled features (Multi-Light, Shadow Maps, Fog/SSS/Fresnel if enabled)
        features = [...faceShaderFeatures];
        features.push(`Opacity: ${surfaceSettings.faceOpacity < 1 ? 'Transparent' : 'Solid'}`);
    } else {
        modules = ['ND Transform', 'Modulation'];
        features = ['Edges'];
    }

    setShaderDebugInfo('object', {
      name,
      vertexShaderLength: activeMaterial.vertexShader.length,
      fragmentShaderLength: activeMaterial.fragmentShader.length,
      activeModules: modules,
      features,
    });

    return () => setShaderDebugInfo('object', null);
  }, [faceMaterial, edgeMaterial, facesVisible, faceShaderModules, faceShaderFeatures, surfaceSettings.faceOpacity, setShaderDebugInfo]);

  // ============ FACE GEOMETRY (NON-INDEXED with neighbor data for GPU normal computation) ============
  // Each triangle has 3 unique vertices, each with full nD coords + neighbor vertex coords.
  // This enables computing face normals in the vertex shader after nD transformation.
  // IMPORTANT: WebGL has a 16 attribute limit. We pack extra dims into vec4/vec3:
  //   - position (vec3) + aExtraDims0_3 (vec4) + aExtraDims4_6 (vec3) = 3 slots for this vertex
  //   - Same pattern for neighbor1 and neighbor2 = 6 more slots
  //   Total: 9 attribute slots (under 16 limit)
  const faceGeometry = useMemo(() => {
    if (numFaces === 0 || baseVertices.length === 0) return null;

    // Count triangles for buffer sizing
    let triangleCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) triangleCount += 1;
      else if (face.vertices.length === 4) triangleCount += 2;
    }
    if (triangleCount === 0) return null;

    const geo = new BufferGeometry();
    const vertexCount = triangleCount * 3; // 3 vertices per triangle, non-indexed

    // Allocate attribute arrays - PACKED into vec4/vec3 to stay under WebGL 16 attribute limit
    // Primary vertex data
    const positions = new Float32Array(vertexCount * 3);
    const extraDims0_3 = new Float32Array(vertexCount * 4);  // vec4: dims 4-7
    const extraDims4_6 = new Float32Array(vertexCount * 3);  // vec3: dims 8-10

    // Neighbor 1 data (packed)
    const neighbor1Pos = new Float32Array(vertexCount * 3);
    const neighbor1Extra0_3 = new Float32Array(vertexCount * 4);
    const neighbor1Extra4_6 = new Float32Array(vertexCount * 3);

    // Neighbor 2 data (packed)
    const neighbor2Pos = new Float32Array(vertexCount * 3);
    const neighbor2Extra0_3 = new Float32Array(vertexCount * 4);
    const neighbor2Extra4_6 = new Float32Array(vertexCount * 3);

    /**
     * Helper to write vertex data at a given output index.
     * Each vertex gets its own position + the positions of its 2 neighbors.
     */
    const writeTriangleVertex = (
      outIdx: number,
      thisIdx: number,
      neighbor1Idx: number,
      neighbor2Idx: number
    ) => {
      const v = baseVertices[thisIdx]!;
      const n1 = baseVertices[neighbor1Idx]!;
      const n2 = baseVertices[neighbor2Idx]!;

      const i3 = outIdx * 3;
      const i4 = outIdx * 4;

      // This vertex position (vec3)
      positions[i3] = v[0] ?? 0;
      positions[i3 + 1] = v[1] ?? 0;
      positions[i3 + 2] = v[2] ?? 0;
      // This vertex extra dims packed: vec4(dims 4-7) + vec3(dims 8-10)
      extraDims0_3[i4] = v[3] ?? 0;
      extraDims0_3[i4 + 1] = v[4] ?? 0;
      extraDims0_3[i4 + 2] = v[5] ?? 0;
      extraDims0_3[i4 + 3] = v[6] ?? 0;
      extraDims4_6[i3] = v[7] ?? 0;
      extraDims4_6[i3 + 1] = v[8] ?? 0;
      extraDims4_6[i3 + 2] = v[9] ?? 0;

      // Neighbor 1 position (vec3)
      neighbor1Pos[i3] = n1[0] ?? 0;
      neighbor1Pos[i3 + 1] = n1[1] ?? 0;
      neighbor1Pos[i3 + 2] = n1[2] ?? 0;
      // Neighbor 1 extra dims packed
      neighbor1Extra0_3[i4] = n1[3] ?? 0;
      neighbor1Extra0_3[i4 + 1] = n1[4] ?? 0;
      neighbor1Extra0_3[i4 + 2] = n1[5] ?? 0;
      neighbor1Extra0_3[i4 + 3] = n1[6] ?? 0;
      neighbor1Extra4_6[i3] = n1[7] ?? 0;
      neighbor1Extra4_6[i3 + 1] = n1[8] ?? 0;
      neighbor1Extra4_6[i3 + 2] = n1[9] ?? 0;

      // Neighbor 2 position (vec3)
      neighbor2Pos[i3] = n2[0] ?? 0;
      neighbor2Pos[i3 + 1] = n2[1] ?? 0;
      neighbor2Pos[i3 + 2] = n2[2] ?? 0;
      // Neighbor 2 extra dims packed
      neighbor2Extra0_3[i4] = n2[3] ?? 0;
      neighbor2Extra0_3[i4 + 1] = n2[4] ?? 0;
      neighbor2Extra0_3[i4 + 2] = n2[5] ?? 0;
      neighbor2Extra0_3[i4 + 3] = n2[6] ?? 0;
      neighbor2Extra4_6[i3] = n2[7] ?? 0;
      neighbor2Extra4_6[i3 + 1] = n2[8] ?? 0;
      neighbor2Extra4_6[i3 + 2] = n2[9] ?? 0;
    };

    // Build non-indexed geometry with neighbor data
    let outIdx = 0;

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length === 3) {
        // Triangle: each vertex needs to know its 2 neighbors
        // Vertex 0: neighbors are 1, 2
        writeTriangleVertex(outIdx++, vis[0]!, vis[1]!, vis[2]!);
        // Vertex 1: neighbors are 2, 0 (maintain winding order for normal)
        writeTriangleVertex(outIdx++, vis[1]!, vis[2]!, vis[0]!);
        // Vertex 2: neighbors are 0, 1
        writeTriangleVertex(outIdx++, vis[2]!, vis[0]!, vis[1]!);
      } else if (vis.length === 4) {
        // Quad: split into 2 triangles (0,1,2) and (0,2,3)
        // Triangle 1: (0, 1, 2)
        writeTriangleVertex(outIdx++, vis[0]!, vis[1]!, vis[2]!);
        writeTriangleVertex(outIdx++, vis[1]!, vis[2]!, vis[0]!);
        writeTriangleVertex(outIdx++, vis[2]!, vis[0]!, vis[1]!);
        // Triangle 2: (0, 2, 3)
        writeTriangleVertex(outIdx++, vis[0]!, vis[2]!, vis[3]!);
        writeTriangleVertex(outIdx++, vis[2]!, vis[3]!, vis[0]!);
        writeTriangleVertex(outIdx++, vis[3]!, vis[0]!, vis[2]!);
      }
    }

    // Set packed attributes (no index buffer - non-indexed geometry)
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aExtraDims0_3', new Float32BufferAttribute(extraDims0_3, 4));
    geo.setAttribute('aExtraDims4_6', new Float32BufferAttribute(extraDims4_6, 3));

    // Neighbor 1 attributes (packed)
    geo.setAttribute('aNeighbor1Pos', new Float32BufferAttribute(neighbor1Pos, 3));
    geo.setAttribute('aNeighbor1Extra0_3', new Float32BufferAttribute(neighbor1Extra0_3, 4));
    geo.setAttribute('aNeighbor1Extra4_6', new Float32BufferAttribute(neighbor1Extra4_6, 3));

    // Neighbor 2 attributes (packed)
    geo.setAttribute('aNeighbor2Pos', new Float32BufferAttribute(neighbor2Pos, 3));
    geo.setAttribute('aNeighbor2Extra0_3', new Float32BufferAttribute(neighbor2Extra0_3, 4));
    geo.setAttribute('aNeighbor2Extra4_6', new Float32BufferAttribute(neighbor2Extra4_6, 3));

    return geo;
  }, [numFaces, faces, baseVertices]);

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

  // ============ CLEANUP ============
  // Track previous resources for proper disposal when dependencies change
  // Note: faceMaterial disposal is handled by useTrackedShaderMaterial hook
  const prevEdgeMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const prevFaceGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const prevEdgeGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Dispose previous resources when new ones are created
  useEffect(() => {
    // Dispose old resources if they exist and differ from current
    // (faceMaterial disposal handled by useTrackedShaderMaterial hook)
    if (prevEdgeMaterialRef.current && prevEdgeMaterialRef.current !== edgeMaterial) {
      prevEdgeMaterialRef.current.dispose();
    }
    if (prevFaceGeometryRef.current && prevFaceGeometryRef.current !== faceGeometry) {
      prevFaceGeometryRef.current.dispose();
    }
    if (prevEdgeGeometryRef.current && prevEdgeGeometryRef.current !== edgeGeometry) {
      prevEdgeGeometryRef.current.dispose();
    }

    // Update refs to current values
    prevEdgeMaterialRef.current = edgeMaterial;
    prevFaceGeometryRef.current = faceGeometry;
    prevEdgeGeometryRef.current = edgeGeometry;

    // Cleanup on unmount - dispose current resources
    // (faceMaterial disposed by useTrackedShaderMaterial hook)
    return () => {
      edgeMaterial.dispose();
      faceGeometry?.dispose();
      edgeGeometry?.dispose();
    };
  }, [edgeMaterial, faceGeometry, edgeGeometry]);

  // Cleanup custom depth materials on unmount
  useEffect(() => {
    return () => {
      customDepthMaterial.dispose();
      customDistanceMaterial.dispose();
    };
  }, [customDepthMaterial, customDistanceMaterial]);

  // Update shadow materials when shadowEnabled changes at runtime
  // The callback ref only runs on mount, so we need an effect for runtime changes
  useEffect(() => {
    const mesh = faceMeshRef.current;
    if (!mesh) return;

    if (shadowEnabled) {
      // Always assign both materials - works with any light type combination
      // Patched MeshDepthMaterial handles directional/spot, MeshDistanceMaterial handles point
      mesh.customDepthMaterial = customDepthMaterial;
      mesh.customDistanceMaterial = customDistanceMaterial;
    } else {
      mesh.customDistanceMaterial = undefined as unknown as THREE.Material;
      mesh.customDepthMaterial = undefined as unknown as THREE.Material;
    }
  }, [shadowEnabled, customDepthMaterial, customDistanceMaterial]);

  // ============ USEFRAME: UPDATE UNIFORMS ONLY ============
  useFrame(({ camera, scene }, delta) => {
    if (numVertices === 0) return;

    // Read state from cached refs (updated via subscriptions, not getState() per frame)
    const animationState = animationStateRef.current;
    const extendedObjectState = extendedObjectStateRef.current;
    const rotationState = rotationStateRef.current;
    const transformState = transformStateRef.current;
    const appearanceState = appearanceStateRef.current;
    const lightingState = lightingStateRef.current;

    const isPlaying = animationState.isPlaying;
    const polytopeConfig = extendedObjectState.polytope;

    // Update animation time only when playing
    if (isPlaying) {
      animTimeRef.current += delta;
    }
    const animTime = animTimeRef.current;

    // Radial breathing modulation - uses facetOffset properties
    // facetOffsetEnabled: on/off, facetOffsetAmplitude: amplitude
    // facetOffsetFrequency: frequency, facetOffsetPhaseSpread: wave, facetOffsetBias: bias
    const modEnabled = polytopeConfig.facetOffsetEnabled;
    const modAmplitude = modEnabled ? polytopeConfig.facetOffsetAmplitude : 0.0;
    const modFrequency = polytopeConfig.facetOffsetFrequency;
    const modWave = polytopeConfig.facetOffsetPhaseSpread;
    const modBias = polytopeConfig.facetOffsetBias;

    // Read current state from cached refs
    const rotations = rotationState.rotations;
    const { uniformScale, perAxisScale } = transformState;

    const lightEnabled = lightingState.lightEnabled;
    const lightColor = lightingState.lightColor;
    const lightHorizontalAngle = lightingState.lightHorizontalAngle;
    const lightVerticalAngle = lightingState.lightVerticalAngle;
    const lightStrength = lightingState.lightStrength ?? 1.0;
    const ambientIntensity = lightingState.ambientIntensity;
    const ambientColor = lightingState.ambientColor;
    const diffuseIntensity = lightingState.diffuseIntensity;
    const specularIntensity = lightingState.specularIntensity;
    const shininess = lightingState.shininess;
    const specularColor = lightingState.specularColor;
    const fresnelEnabled = appearanceState.shaderSettings.surface.fresnelEnabled;
    const fresnelIntensity = appearanceState.fresnelIntensity;
    const rimColor = appearanceState.edgeColor;
    const roughness = appearanceState.roughness;
    // Face opacity - read dynamically to update uniform without shader rebuild
    const faceOpacity = appearanceState.shaderSettings.surface.faceOpacity;

    // Read SSS state (shared with raymarched objects)
    const sssEnabled = appearanceState.sssEnabled;
    const sssIntensity = appearanceState.sssIntensity;
    const sssColor = appearanceState.sssColor;
    const sssThickness = appearanceState.sssThickness;
    const sssJitter = appearanceState.sssJitter;

    // Read advanced color system state
    const colorAlgorithm = appearanceState.colorAlgorithm;
    const cosineCoefficients = appearanceState.cosineCoefficients;
    const distribution = appearanceState.distribution;
    const lchLightness = appearanceState.lchLightness;
    const lchChroma = appearanceState.lchChroma;
    const multiSourceWeights = appearanceState.multiSourceWeights;

    // Calculate light direction from angles (use cached vector)
    const lightDirection = anglesToDirection(lightHorizontalAngle, lightVerticalAngle, cachedLightDirectionRef.current);

    // Build transformation data
    const scales = cachedScalesRef.current;
    // Resize array if needed (rare)
    if (scales.length !== dimension) {
      scales.length = dimension;
    }
    // Update values in place
    for (let i = 0; i < dimension; i++) {
      scales[i] = perAxisScale[i] ?? uniformScale;
    }

    // P3 Optimization: Cache matrix computations - only recompute when rotations change
    const rotationVersion = rotationState.version;
    const rotationsChanged = dimension !== cachedDimensionRef.current || rotationVersion !== prevRotationVersionRef.current;

    // Initialize cache if null (first run)
    if (!cachedGpuDataRef.current) {
      // Create initial structure
      cachedGpuDataRef.current = {
        rotationMatrix4D: new Matrix4(),
        extraRotationData: new Float32Array(Math.max((MAX_GPU_DIMENSION - 4) * MAX_GPU_DIMENSION * 2, 1)),
        extraRotationCols: new Float32Array(MAX_EXTRA_DIMS * 4),
        depthRowSums: new Float32Array(MAX_GPU_DIMENSION),
        dimension: dimension
      };
      // Force update
      const rotationMatrix = composeRotations(dimension, rotations);
      matrixToGPUUniforms(rotationMatrix, dimension, cachedGpuDataRef.current);
      cachedDimensionRef.current = dimension;
      prevRotationVersionRef.current = rotationVersion;
    } else if (rotationsChanged) {
       const rotationMatrix = composeRotations(dimension, rotations);
       matrixToGPUUniforms(rotationMatrix, dimension, cachedGpuDataRef.current);
       cachedDimensionRef.current = dimension;
       prevRotationVersionRef.current = rotationVersion;
    }

    const gpuData = cachedGpuDataRef.current;

    // P3 Optimization: Cache projection distance - only recalculate when vertex count changes
    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;
    let projectionDistance: number;
    if (numVertices !== cachedProjectionDistanceRef.current.count) {
      projectionDistance = calculateSafeProjectionDistance(baseVertices, normalizationFactor);
      cachedProjectionDistanceRef.current = { count: numVertices, distance: projectionDistance };
    } else {
      projectionDistance = cachedProjectionDistanceRef.current.distance;
    }

    // Cached linear colors - avoid per-frame sRGB->linear conversion
    const cache = colorCacheRef.current;

    // Update all materials through mesh refs
    const meshUpdates = [
      { ref: faceMeshRef, color: appearanceState.faceColor, cache: cache.faceColor },
      { ref: edgeMeshRef, color: appearanceState.edgeColor, cache: cache.edgeColor },
    ];

    for (const { ref, color, cache: colorCache } of meshUpdates) {
      if (ref.current) {
        const material = ref.current.material as ShaderMaterial;

        // Skip if material is not ready (still compiling) or not a ShaderMaterial
        if (!material || !('uniforms' in material)) continue;

        // Update N-D transformation uniforms
        updateNDUniforms(material, gpuData, dimension, scales, projectionDistance);

        // Update vertex modulation uniforms
        const u = material.uniforms;

        // Update view matrix for normal transformation (needed for SSR)
        if (u.uViewMatrix) (u.uViewMatrix.value as Matrix4).copy(camera.matrixWorldInverse);
        if (u.uAnimTime) u.uAnimTime.value = animTime;
        if (u.uModAmplitude) u.uModAmplitude.value = modAmplitude;
        if (u.uModFrequency) u.uModFrequency.value = modFrequency;
        if (u.uModWave) u.uModWave.value = modWave;
        if (u.uModBias) u.uModBias.value = modBias;

        // Update lighting uniforms (only for materials that have them)
        // Colors use cached linear conversion for performance

        // Update surface color
        if (u.uColor) updateLinearColorUniform(colorCache, u.uColor.value as Color, color);

        // Update opacity uniform (only for face material which has it)
        // Also update material transparency state dynamically to avoid shader rebuild
        if (u.uOpacity) {
          u.uOpacity.value = faceOpacity;
          // Update material transparency based on opacity (like Mandelbulb)
          const isTransparent = faceOpacity < 1;
          if (material.transparent !== isTransparent) {
            material.transparent = isTransparent;
            material.depthWrite = !isTransparent;
            material.needsUpdate = true;
          }
        }

        if (u.uLightEnabled) u.uLightEnabled.value = lightEnabled;
        if (u.uLightColor) updateLinearColorUniform(cache.lightColor, u.uLightColor.value as Color, lightColor);
        if (u.uLightDirection) (u.uLightDirection.value as Vector3).copy(lightDirection);
        if (u.uLightStrength) u.uLightStrength.value = lightStrength;
        if (u.uAmbientIntensity) u.uAmbientIntensity.value = ambientIntensity;
        if (u.uAmbientColor) updateLinearColorUniform(cache.ambientColor, u.uAmbientColor.value as Color, ambientColor);
        if (u.uDiffuseIntensity) u.uDiffuseIntensity.value = diffuseIntensity;
        if (u.uSpecularIntensity) u.uSpecularIntensity.value = specularIntensity;
        if (u.uSpecularPower) u.uSpecularPower.value = shininess;
        if (u.uSpecularColor) updateLinearColorUniform(cache.specularColor, u.uSpecularColor.value as Color, specularColor);
        // GGX PBR roughness
        if (u.uRoughness) u.uRoughness.value = roughness;
        if (u.uFresnelEnabled) u.uFresnelEnabled.value = fresnelEnabled;
        if (u.uFresnelIntensity) u.uFresnelIntensity.value = fresnelIntensity;
        if (u.uRimColor) updateLinearColorUniform(cache.rimColor, u.uRimColor.value as Color, rimColor);

        // Update rim SSS uniforms (shared with raymarched objects)
        if (u.uSssEnabled) u.uSssEnabled.value = sssEnabled;
        if (u.uSssIntensity) u.uSssIntensity.value = sssIntensity;
        if (u.uSssColor) updateLinearColorUniform(cache.sssColor, u.uSssColor.value as Color, sssColor);
        if (u.uSssThickness) u.uSssThickness.value = sssThickness;
        if (u.uSssJitter) u.uSssJitter.value = sssJitter;

        // Update advanced color system uniforms (only for face materials)
        if (u.uColorAlgorithm) u.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[colorAlgorithm];
        if (u.uCosineA) (u.uCosineA.value as Vector3).set(cosineCoefficients.a[0], cosineCoefficients.a[1], cosineCoefficients.a[2]);
        if (u.uCosineB) (u.uCosineB.value as Vector3).set(cosineCoefficients.b[0], cosineCoefficients.b[1], cosineCoefficients.b[2]);
        if (u.uCosineC) (u.uCosineC.value as Vector3).set(cosineCoefficients.c[0], cosineCoefficients.c[1], cosineCoefficients.c[2]);
        if (u.uCosineD) (u.uCosineD.value as Vector3).set(cosineCoefficients.d[0], cosineCoefficients.d[1], cosineCoefficients.d[2]);
        if (u.uDistPower) u.uDistPower.value = distribution.power;
        if (u.uDistCycles) u.uDistCycles.value = distribution.cycles;
        if (u.uDistOffset) u.uDistOffset.value = distribution.offset;
        if (u.uLchLightness) u.uLchLightness.value = lchLightness;
        if (u.uLchChroma) u.uLchChroma.value = lchChroma;
        if (u.uMultiSourceWeights) (u.uMultiSourceWeights.value as Vector3).set(multiSourceWeights.depth, multiSourceWeights.orbitTrap, multiSourceWeights.normal);

        // Update multi-light system uniforms
        if (u.uNumLights && u.uLightsEnabled && u.uLightTypes && u.uLightPositions &&
            u.uLightDirections && u.uLightColors && u.uLightIntensities &&
            u.uSpotAngles && u.uSpotPenumbras && u.uSpotCosInner && u.uSpotCosOuter &&
            u.uLightRanges && u.uLightDecays) {
          const lights = lightingState.lights;
          const numLights = Math.min(lights.length, MAX_LIGHTS);
          u.uNumLights.value = numLights;

          for (let i = 0; i < MAX_LIGHTS; i++) {
            const light: LightSource | undefined = lights[i];

            if (light) {
              (u.uLightsEnabled.value as boolean[])[i] = light.enabled;
              (u.uLightTypes.value as number[])[i] = LIGHT_TYPE_TO_INT[light.type];
              (u.uLightPositions.value as Vector3[])[i]!.set(light.position[0], light.position[1], light.position[2]);

              // Calculate direction from rotation
              const dir = rotationToDirection(light.rotation);
              (u.uLightDirections.value as Vector3[])[i]!.set(dir[0], dir[1], dir[2]);

              // Update light color with cached linear conversion
              updateLightColorUniform(lightColorCacheRef.current, i, (u.uLightColors.value as Color[])[i]!, light.color);
              (u.uLightIntensities.value as number[])[i] = light.intensity;
              // Precompute spotlight cone cosines on CPU to avoid per-fragment trig
              const outerAngleRad = (light.coneAngle * Math.PI) / 180;
              const innerAngleRad = outerAngleRad * (1.0 - light.penumbra);
              (u.uSpotAngles.value as number[])[i] = outerAngleRad;
              (u.uSpotPenumbras.value as number[])[i] = light.penumbra;
              (u.uSpotCosOuter.value as number[])[i] = Math.cos(outerAngleRad);
              (u.uSpotCosInner.value as number[])[i] = Math.cos(innerAngleRad);
              // Range and decay for distance attenuation
              (u.uLightRanges.value as number[])[i] = light.range;
              (u.uLightDecays.value as number[])[i] = light.decay;
            } else {
              (u.uLightsEnabled.value as boolean[])[i] = false;
            }
          }
        }

        // Update shadow map uniforms if shadows are enabled
        // Pass store lights to ensure shadow data ordering matches uniform indices
        if (shadowEnabled) {
          const shadowData = collectShadowDataFromScene(scene, lightingState.lights);
          const shadowQuality = lightingState.shadowQuality;
          const shadowMapSize = SHADOW_MAP_SIZES[shadowQuality];
          const pcfSamples = blurToPCFSamples(lightingState.shadowMapBlur);
          updateShadowMapUniforms(
            u as Record<string, { value: unknown }>,
            shadowData,
            lightingState.shadowMapBias,
            shadowMapSize,
            pcfSamples
          );
        }
      }
    }

    // Update shadow material uniforms for animated shadows
    // Patched MeshDepthMaterial and MeshDistanceMaterial share the same shadowUniforms object.
    // Updates to shadowUniforms are automatically reflected in the compiled shaders.
    if (shadowEnabled) {
      const u = shadowUniforms;

      // Update N-D transformation uniforms
      (u.uRotationMatrix4D!.value as Matrix4).copy(gpuData.rotationMatrix4D);
      u.uDimension!.value = dimension;
      const s = u.uScale4D!.value;
      if (s instanceof Vector4) {
        s.set(scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1);
      }
      const extraScales = u.uExtraScales!.value as Float32Array;
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1;
      }
      (u.uExtraRotationCols!.value as Float32Array).set(gpuData.extraRotationCols);
      (u.uDepthRowSums!.value as Float32Array).set(gpuData.depthRowSums);
      u.uProjectionDistance!.value = projectionDistance;

      // Update modulation uniforms
      u.uAnimTime!.value = animTime;
      u.uModAmplitude!.value = modAmplitude;
      u.uModFrequency!.value = modFrequency;
      u.uModWave!.value = modWave;
      u.uModBias!.value = modBias;
    }
  });

  // ============ RENDER ============
  // Placeholder material for when shader is compiling
  const placeholderMaterial = useMemo(() => new MeshBasicMaterial({ visible: false }), []);

  return (
    <group>
      {/* Polytope faces - DoubleSide handles both front and back faces */}
      {/* Render invisible placeholder while shader is compiling to allow overlay to appear */}
      {facesVisible && faceGeometry && (isFaceShaderCompiling || !faceMaterial) && (
        <mesh
          ref={setFaceMeshRef}
          geometry={faceGeometry}
          material={placeholderMaterial}
        />
      )}
      {facesVisible && faceGeometry && !isFaceShaderCompiling && faceMaterial && (
        <mesh
          ref={setFaceMeshRef}
          geometry={faceGeometry}
          material={faceMaterial}
          castShadow={shadowEnabled}
          receiveShadow={shadowEnabled}
        />
      )}

      {/* Polytope edges - use TubeWireframe for thick lines, native lineSegments for thin */}
      {edgesVisible && useFatWireframe && (
        <TubeWireframe
          vertices={baseVertices}
          edges={edges}
          dimension={dimension}
          color={edgeColor}
          opacity={opacity}
          radius={edgeThickness * 0.015}
          metallic={edgeMetallic}
          roughness={edgeRoughness}
          shadowEnabled={shadowEnabled}
        />
      )}
      {edgesVisible && !useFatWireframe && edgeGeometry && (
        <lineSegments ref={setEdgeMeshRef} geometry={edgeGeometry} material={edgeMaterial} />
      )}
    </group>
  );
});
