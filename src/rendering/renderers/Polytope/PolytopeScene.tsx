/**
 * Unified Polytope Scene Component - GPU Accelerated
 *
 * High-performance renderer using GPU shaders for N-dimensional transformations.
 * All geometry (faces, edges) uses the same GPU pipeline:
 * 1. Store base N-D vertices as shader attributes
 * 2. Perform rotation/scale/projection in vertex shader
 * 3. Only update uniform values in useFrame (no CPU transformation)
 */

import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
    BufferGeometry,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    Matrix4,
    ShaderMaterial,
    Vector3,
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
import { matrixToGPUUniforms } from '@/rendering/shaders/transforms/ndTransform';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useProjectionStore } from '@/stores/projectionStore';
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
 * @param material
 * @param gpuData
 * @param dimension
 * @param scales
 * @param projectionDistance
 * @param projectionType
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
 * @param horizontalDeg
 * @param verticalDeg
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
 * Create face ShaderMaterial with custom lighting (same approach as Mandelbulb)
 * Includes advanced color system uniforms for cosine palettes, LCH, and multi-source algorithms
 * @param faceColor
 * @param opacity
 */
function createFaceShaderMaterial(
  faceColor: string,
  opacity: number
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      // N-D transformation uniforms
      ...createNDUniforms(),
      // Color (converted to linear space for physically correct lighting)
      uColor: { value: new Color(faceColor).convertSRGBToLinear() },
      uOpacity: { value: opacity },
      // Material properties for G-buffer
      uMetallic: { value: 0.0 },
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
    fragmentShader: buildFaceFragmentShader(),
    transparent: opacity < 1,
    side: DoubleSide,
    depthWrite: opacity >= 1,
  });
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
 * Build BufferGeometry with N-D attributes from vertices
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

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  const colorCacheRef = useRef(createColorCache());
  const lightColorCacheRef = useRef(createLightColorCache());

  // Assign main object layer for depth-based effects (SSR, refraction, bokeh)
  useEffect(() => {
    if (faceMeshRef.current?.layers) {
      faceMeshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT);
    }
    if (edgeMeshRef.current?.layers) {
      edgeMeshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT);
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
    }))
  );

  const shadowEnabled = useLightingStore((state) => state.shadowEnabled);

  const surfaceSettings = shaderSettings.surface;
  // Use TubeWireframe for thick lines (>1), native lineSegments for thin lines (1)
  const useFatWireframe = edgeThickness > 1;

  // ============ MATERIALS ============
  // Uses custom ShaderMaterial with lighting (same approach as Mandelbulb)
  const faceMaterial = useMemo(() => {
    return createFaceShaderMaterial(faceColor, surfaceSettings.faceOpacity);
  }, [faceColor, surfaceSettings.faceOpacity]);

  const edgeMaterial = useMemo(() => {
    return createEdgeMaterial(edgeColor, opacity);
  }, [edgeColor, opacity]);

  // ============ FACE GEOMETRY (INDEXED) ============
  // Uses indexed geometry for efficiency - vertices are shared, indices define triangles
  // Face depths are passed via uniform array indexed by gl_PrimitiveID
  const faceGeometry = useMemo(() => {
    if (numFaces === 0 || baseVertices.length === 0) return null;

    // Count triangles for index buffer sizing
    let triangleCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) triangleCount += 1;
      else if (face.vertices.length === 4) triangleCount += 2;
    }
    if (triangleCount === 0) return null;

    const geo = new BufferGeometry();
    const vertexCount = baseVertices.length;

    // Build vertex attributes from baseVertices (no duplication)
    const positions = new Float32Array(vertexCount * 3);
    const extraDim0 = new Float32Array(vertexCount);
    const extraDim1 = new Float32Array(vertexCount);
    const extraDim2 = new Float32Array(vertexCount);
    const extraDim3 = new Float32Array(vertexCount);
    const extraDim4 = new Float32Array(vertexCount);
    const extraDim5 = new Float32Array(vertexCount);
    const extraDim6 = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const v = baseVertices[i]!;
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
    }

    // Build index buffer (triangulate faces)
    const indices = new Uint16Array(triangleCount * 3);
    let indexIdx = 0;

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length === 3) {
        // Triangle: 3 indices
        indices[indexIdx++] = vis[0]!;
        indices[indexIdx++] = vis[1]!;
        indices[indexIdx++] = vis[2]!;
      } else if (vis.length === 4) {
        // Quad: split into 2 triangles (0,1,2) and (0,2,3)
        indices[indexIdx++] = vis[0]!;
        indices[indexIdx++] = vis[1]!;
        indices[indexIdx++] = vis[2]!;
        indices[indexIdx++] = vis[0]!;
        indices[indexIdx++] = vis[2]!;
        indices[indexIdx++] = vis[3]!;
      }
    }

    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));

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
  const prevFaceMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const prevEdgeMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const prevFaceGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const prevEdgeGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Dispose previous resources when new ones are created
  useEffect(() => {
    // Dispose old resources if they exist and differ from current
    if (prevFaceMaterialRef.current && prevFaceMaterialRef.current !== faceMaterial) {
      prevFaceMaterialRef.current.dispose();
    }
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
    prevFaceMaterialRef.current = faceMaterial;
    prevEdgeMaterialRef.current = edgeMaterial;
    prevFaceGeometryRef.current = faceGeometry;
    prevEdgeGeometryRef.current = edgeGeometry;

    // Cleanup on unmount - dispose current resources
    return () => {
      faceMaterial.dispose();
      edgeMaterial.dispose();
      faceGeometry?.dispose();
      edgeGeometry?.dispose();
    };
  }, [faceMaterial, edgeMaterial, faceGeometry, edgeGeometry]);

  // ============ USEFRAME: UPDATE UNIFORMS ONLY ============
  useFrame(() => {
    if (numVertices === 0) return;

    // Read current state
    const rotations = useRotationStore.getState().rotations;
    const { uniformScale, perAxisScale } = useTransformStore.getState();
    const projectionType = useProjectionStore.getState().type;

    // Read lighting and color settings from store
    const appearanceState = useAppearanceStore.getState();
    const lightingState = useLightingStore.getState();

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

    // Read advanced color system state
    const colorAlgorithm = appearanceState.colorAlgorithm;
    const cosineCoefficients = appearanceState.cosineCoefficients;
    const distribution = appearanceState.distribution;
    const lchLightness = appearanceState.lchLightness;
    const lchChroma = appearanceState.lchChroma;
    const multiSourceWeights = appearanceState.multiSourceWeights;

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

        // Update N-D transformation uniforms
        updateNDUniforms(material, gpuData, dimension, scales, projectionDistance, projectionType);

        // Update lighting uniforms (only for materials that have them)
        // Colors use cached linear conversion for performance
        const u = material.uniforms;

        // Update surface color
        if (u.uColor) updateLinearColorUniform(colorCache, u.uColor.value as Color, color);

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
        if (u.uFresnelEnabled) u.uFresnelEnabled.value = fresnelEnabled;
        if (u.uFresnelIntensity) u.uFresnelIntensity.value = fresnelIntensity;
        if (u.uRimColor) updateLinearColorUniform(cache.rimColor, u.uRimColor.value as Color, rimColor);

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
      }
    }
  });

  // ============ RENDER ============
  return (
    <group>
      {/* Polytope faces */}
      {facesVisible && faceGeometry && (
        <mesh
          ref={faceMeshRef}
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
        <lineSegments ref={edgeMeshRef} geometry={edgeGeometry} material={edgeMaterial} />
      )}
    </group>
  );
});
