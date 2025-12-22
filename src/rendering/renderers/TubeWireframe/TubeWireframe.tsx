/**
 * TubeWireframe Component
 *
 * GPU-accelerated tube wireframe renderer with N-D transformation support
 * and PBR material properties. Uses InstancedMesh with CylinderGeometry
 * for true 3D edges that respond to lighting.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import { createColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useTrackedShaderMaterial } from '@/rendering/materials/useTrackedShaderMaterial'
import { useNDTransformUpdates } from '@/rendering/renderers/base'
import { UniformManager } from '@/rendering/uniforms/UniformManager'
import { useFrame } from '@react-three/fiber'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
    Color,
    CylinderGeometry,
    DoubleSide,
    GLSL3,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    ShaderMaterial,
} from 'three'

import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection'
import type { VectorND } from '@/lib/math/types'
// Note: We use patched MeshDepthMaterial and MeshDistanceMaterial instead of raw ShaderMaterial
// to avoid the double shadow bug. The custom vertex shaders are no longer needed.
import { composeTubeWireframeFragmentShader, composeTubeWireframeVertexShader } from '@/rendering/shaders/tubewireframe/compose'
import {
    blurToPCFSamples,
    collectShadowDataFromScene,
    createShadowMapUniforms,
    SHADOW_MAP_SIZES,
    updateShadowMapUniforms,
} from '@/rendering/shadows'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useTransformStore } from '@/stores/transformStore'
import { Vector4 } from 'three'

// Maximum extra dimensions (beyond XYZ + W)
const MAX_EXTRA_DIMS = 7

// Cylinder segments for tube rendering (balance quality/performance)
const CYLINDER_SEGMENTS = 8

/**
 * GLSL code block containing the nD transformation for tube wireframe shadow materials.
 * This is injected into MeshDepthMaterial and MeshDistanceMaterial via onBeforeCompile.
 * Unlike the polytope version, this handles instanced tube geometry with start/end positions.
 */
const TUBE_ND_TRANSFORM_GLSL = `
#define MAX_EXTRA_DIMS 7

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];
uniform float uRadius;

// Instance attributes for tube start/end points
attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute vec4 instanceStartExtraA;
attribute vec4 instanceStartExtraB;
attribute vec4 instanceEndExtraA;
attribute vec4 instanceEndExtraB;

// Transform a single nD point to 3D
vec3 ndTransformPoint(vec3 pos, vec4 extraA, vec4 extraB) {
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = extraA.x * uScale4D.w; // W
  scaledInputs[4] = extraA.y * uExtraScales[0];
  scaledInputs[5] = extraA.z * uExtraScales[1];
  scaledInputs[6] = extraA.w * uExtraScales[2];
  scaledInputs[7] = extraB.x * uExtraScales[3];
  scaledInputs[8] = extraB.y * uExtraScales[4];
  scaledInputs[9] = extraB.z * uExtraScales[5];
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
  // Normalize depth by sqrt(dimension - 3) for consistent visual scale.
  // See transforms/ndTransform.ts for mathematical justification.
  float normFactor = uDimension > 4 ? sqrt(max(1.0, float(uDimension - 3))) : 1.0;
  effectiveDepth /= normFactor;
  float denom = uProjectionDistance - effectiveDepth;
  if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
  float factor = 1.0 / denom;
  return rotated.xyz * factor;
}

// Transform tube vertex position (cylinder mesh positioned between start and end)
vec3 tubeTransformVertex(vec3 localPos) {
  // Transform start and end points through nD pipeline
  vec3 start3D = ndTransformPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
  vec3 end3D = ndTransformPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);

  // Build tube orientation from start to end
  vec3 dir = end3D - start3D;
  float tubeLength = length(dir);
  if (tubeLength < 0.0001) {
    return start3D; // Degenerate tube
  }
  vec3 axis = dir / tubeLength;

  // Build orthonormal basis for tube cross-section
  vec3 up = abs(axis.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, axis));
  vec3 bitangent = cross(axis, tangent);

  // Transform local cylinder vertex:
  // - localPos.xz is the radial position (scaled by radius)
  // - localPos.y is the height along the tube (scaled by length)
  vec3 radial = (tangent * localPos.x + bitangent * localPos.z) * uRadius;
  vec3 axial = axis * (localPos.y + 0.5) * tubeLength; // +0.5 to shift from centered to start

  return start3D + radial + axial;
}
`;

/**
 * Create shared uniforms for tube shadow materials.
 * @param dimension - Current dimension
 * @param radius - Tube radius
 * @returns Record of tube shadow uniforms
 */
function createTubeShadowUniforms(dimension: number, radius: number): Record<string, { value: unknown }> {
  return {
    uRotationMatrix4D: { value: new Matrix4() },
    uDimension: { value: dimension },
    uScale4D: { value: new Vector4(1, 1, 1, 1) },
    uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
    uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
    uDepthRowSums: { value: new Float32Array(11) },
    uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
    uRadius: { value: radius },
  };
}

/**
 * Create patched shadow materials for tube wireframe using Three.js's built-in
 * MeshDepthMaterial and MeshDistanceMaterial with tube vertex transformation injected.
 *
 * This approach avoids the double shadow bug that occurs when using raw ShaderMaterial.
 * Three.js's internal shadow pipeline has special handling for MeshDistanceMaterial
 * (updating referencePosition, nearDistance, farDistance automatically).
 *
 * @param uniforms - Shared uniform objects that are updated per-frame
 * @returns Object containing patched depthMaterial and distanceMaterial
 */
function createPatchedTubeShadowMaterials(uniforms: Record<string, { value: unknown }>): {
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
        `#include <common>\n${TUBE_ND_TRANSFORM_GLSL}`
      );

      // Apply our tube transformation after #include <begin_vertex>
      // Three.js sets `transformed` to the local-space vertex position there
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed = tubeTransformVertex(transformed);`
      );
    };
    mat.needsUpdate = true;
  };

  patchMaterial(depthMaterial);
  patchMaterial(distanceMaterial);

  return { depthMaterial, distanceMaterial };
}

export interface TubeWireframeProps {
  /** N-dimensional vertices */
  vertices: VectorND[]
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][]
  /** Current dimension of the object (default: 3) */
  dimension?: number
  /** Color of the tubes */
  color: string
  /** Opacity (0-1) */
  opacity?: number
  /** Tube radius */
  radius?: number
  /** Metallic value for PBR (0-1) */
  metallic?: number
  /** Roughness value for PBR (0-1) */
  roughness?: number
  /** Whether shadows are enabled */
  shadowEnabled?: boolean
}

/**
 * GPU-accelerated tube wireframe renderer with N-D transformation and PBR lighting.
 * @param root0
 * @param root0.vertices
 * @param root0.edges
 * @param root0.dimension
 * @param root0.color
 * @param root0.opacity
 * @param root0.radius
 * @param root0.metallic
 * @param root0.roughness
 * @param root0.shadowEnabled
 * @returns React element rendering instanced tube wireframe mesh or null
 */
export function TubeWireframe({
  vertices,
  edges,
  dimension = 3,
  color,
  opacity = 1.0,
  radius = 0.02,
  metallic = 0.0,
  roughness = 0.5,
  shadowEnabled = false,
}: TubeWireframeProps): React.JSX.Element | null {
  const meshRef = useRef<InstancedMesh>(null)

  // N-D transform hook - handles rotation matrix computation with version tracking
  const ndTransform = useNDTransformUpdates()

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  const colorCacheRef = useRef(createColorCache())

  // Performance optimization: Cache objects to avoid per-frame allocation/calculation
  const cachedScalesRef = useRef<number[]>([])
  const cachedProjectionDistanceRef = useRef<{ count: number; distance: number; scaleSum?: number }>({ count: 0, distance: DEFAULT_PROJECTION_DISTANCE, scaleSum: 0 })

  // P4 Optimization: Pre-allocated instance attribute arrays to avoid per-change allocations
  // These are resized only when edge count increases, otherwise reused
  const instanceArraysRef = useRef<{
    capacity: number;
    start: Float32Array;
    end: Float32Array;
    startExtraA: Float32Array;
    startExtraB: Float32Array;
    endExtraA: Float32Array;
    endExtraB: Float32Array;
  } | null>(null)

  // Performance optimization: Cache store state in refs to avoid getState() calls every frame
  // Note: rotation state is handled by ndTransform hook
  const transformStateRef = useRef(useTransformStore.getState())
  const appearanceStateRef = useRef(useAppearanceStore.getState())
  const lightingStateRef = useRef(useLightingStore.getState())

  // Subscribe to store changes to update refs
  useEffect(() => {
    const unsubTrans = useTransformStore.subscribe((s) => { transformStateRef.current = s })
    const unsubApp = useAppearanceStore.subscribe((s) => { appearanceStateRef.current = s })
    const unsubLight = useLightingStore.subscribe((s) => { lightingStateRef.current = s })
    return () => {
      unsubTrans()
      unsubApp()
      unsubLight()
    }
  }, [])

  // Base cylinder geometry (Y-axis aligned, height 1, centered at origin)
  const geometry = useMemo(() => {
    return new CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, false)
  }, [])

  const setShaderDebugInfo = usePerformanceStore((state) => state.setShaderDebugInfo)

  // Feature flags for conditional shader compilation
  const sssEnabled = useAppearanceStore((state) => state.sssEnabled)
  const fresnelEnabled = useAppearanceStore((state) => state.shaderSettings.surface.fresnelEnabled)

  // Compute shader configuration for tracking (used outside the hook)
  const { glsl: fragmentShaderString, modules: shaderModules, features: shaderFeatures } = useMemo(() => {
    return composeTubeWireframeFragmentShader({
      fog: false, // Physical fog handled by post-process
      sss: sssEnabled,
      fresnel: fresnelEnabled,
    })
  }, [sssEnabled, fresnelEnabled])

  // Create shader material with tracking - shows overlay during compilation
  // Feature flags in deps trigger shader recompilation when features are toggled
  const { material, isCompiling } = useTrackedShaderMaterial(
    'TubeWireframe PBR',
    () => {
      // Convert colors from sRGB to linear for physically correct lighting
      const colorValue = new Color(color).convertSRGBToLinear()
      const vertexShaderString = composeTubeWireframeVertexShader()

      return new ShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: vertexShaderString,
        fragmentShader: fragmentShaderString,
        uniforms: {
          // Material (colors converted to linear space)
          uColor: { value: colorValue },
          uOpacity: { value: opacity },
          uMetallic: { value: metallic },
          uRoughness: { value: roughness },
          uRadius: { value: radius },

          // N-D transformation
          uRotationMatrix4D: { value: new Matrix4() },
          uDimension: { value: dimension },
          uScale4D: { value: [1, 1, 1, 1] },
          uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
          uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
          uDepthRowSums: { value: new Float32Array(11) },
          uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },

          // Lighting uniforms (via UniformManager)
          ...UniformManager.getCombinedUniforms(['lighting']),

          // Fresnel (colors converted to linear space)
          uFresnelEnabled: { value: true },
          uFresnelIntensity: { value: 0.1 },
          uRimColor: { value: new Color(color).convertSRGBToLinear() },

          // Rim SSS (subsurface scattering for backlight transmission)
          uSssEnabled: { value: false },
          uSssIntensity: { value: 1.0 },
          uSssColor: { value: new Color('#ff8844').convertSRGBToLinear() },
          uSssThickness: { value: 1.0 },
          uSssJitter: { value: 0.2 },

          // Shadow map uniforms
          // Shadow map uniforms
          ...createShadowMapUniforms(),
        },
        // Initial transparency state - updated dynamically in useFrame based on current opacity
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: DoubleSide,
      })
    },
    // Note: opacity removed from deps - it's updated via uniforms in useFrame.
    // Changing opacity value should NOT trigger shader rebuild, only feature toggles should.
    // Color, metallic, roughness, radius, dimension are also updated via uniforms.
    [sssEnabled, fresnelEnabled, fragmentShaderString]
  )

  // Create shared uniforms for shadow materials (patched MeshDepthMaterial and MeshDistanceMaterial)
  // These uniforms are shared and updated per-frame
  const shadowUniforms = useMemo(() => createTubeShadowUniforms(dimension, radius), [dimension, radius])

  // Custom depth/distance materials for shadow map rendering with tube nD transformation.
  // Uses patched Three.js built-in materials (via onBeforeCompile) to avoid the double
  // shadow bug that occurs with raw ShaderMaterial. Three.js handles MeshDistanceMaterial
  // specially (auto-updating referencePosition, nearDistance, farDistance for point lights).
  const { depthMaterial: customDepthMaterial, distanceMaterial: customDistanceMaterial } = useMemo(
    () => createPatchedTubeShadowMaterials(shadowUniforms),
    [shadowUniforms]
  )

  // Callback ref to assign main object layer for depth-based effects (SSR, refraction, bokeh)
  // Also assigns custom depth materials for animated shadows - this MUST happen in the callback
  // because if done in useEffect, the effect may run before the mesh exists
  const setMeshRef = useCallback((mesh: InstancedMesh | null) => {
    meshRef.current = mesh
    if (mesh?.layers) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT)
    }
    // Assign patched shadow materials for tube nD transformation:
    // - customDepthMaterial (MeshDepthMaterial): for directional and spot lights
    // - customDistanceMaterial (MeshDistanceMaterial): for point lights
    //
    // Using patched built-in materials via onBeforeCompile avoids the double shadow bug
    // that occurred with raw ShaderMaterial. Three.js handles MeshDistanceMaterial specially,
    // auto-updating referencePosition/nearDistance/farDistance for point light shadow cameras.
    // No onBeforeShadow callback needed - Three.js manages everything automatically.
    if (mesh && shadowEnabled) {
      // Always assign both materials - works with any light type combination
      mesh.customDepthMaterial = customDepthMaterial
      mesh.customDistanceMaterial = customDistanceMaterial
    } else if (mesh) {
      mesh.customDepthMaterial = undefined as unknown as THREE.Material
      mesh.customDistanceMaterial = undefined as unknown as THREE.Material
    }
  }, [shadowEnabled, customDepthMaterial, customDistanceMaterial])

  // Dispatch shader debug info (only when material is ready)
  useEffect(() => {
    if (!material) return
    setShaderDebugInfo('object', {
      name: 'TubeWireframe PBR',
      vertexShaderLength: material.vertexShader.length,
      fragmentShaderLength: material.fragmentShader.length,
      activeModules: shaderModules,
      features: shaderFeatures,
    })
    return () => setShaderDebugInfo('object', null)
  }, [material, shaderModules, shaderFeatures, setShaderDebugInfo])

  // Cleanup geometry on unmount or when it changes
  // Note: Material disposal is handled by useTrackedShaderMaterial hook
  const prevGeometryRef = useRef<CylinderGeometry | null>(null)

  useEffect(() => {
    // Dispose old geometry if it exists and differs from current
    if (prevGeometryRef.current && prevGeometryRef.current !== geometry) {
      prevGeometryRef.current.dispose()
    }

    // Update ref to current value
    prevGeometryRef.current = geometry

    // Cleanup on unmount
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  // Cleanup custom depth materials on unmount
  useEffect(() => {
    return () => {
      customDepthMaterial.dispose()
      customDistanceMaterial.dispose()
    }
  }, [customDepthMaterial, customDistanceMaterial])

  // Update shadow materials when shadowEnabled changes at runtime
  // The callback ref only runs on mount, so we need an effect for runtime changes
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    if (shadowEnabled) {
      // Always assign both materials - works with any light type combination
      // Patched MeshDepthMaterial handles directional/spot, MeshDistanceMaterial handles point
      mesh.customDepthMaterial = customDepthMaterial
      mesh.customDistanceMaterial = customDistanceMaterial
    } else {
      mesh.customDistanceMaterial = undefined as unknown as THREE.Material
      mesh.customDepthMaterial = undefined as unknown as THREE.Material
    }
  }, [shadowEnabled, customDepthMaterial, customDistanceMaterial])

  // Update instance attributes when vertices/edges change
  // P4 Optimization: Reuse pre-allocated arrays when possible to reduce GC pressure
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !vertices || vertices.length === 0 || !edges || edges.length === 0) return

    const instanceCount = edges.length

    // P4 Optimization: Get or create pre-allocated arrays
    // Only allocate new arrays when capacity is insufficient
    let arrays = instanceArraysRef.current
    if (!arrays || arrays.capacity < instanceCount) {
      // Allocate with 20% extra capacity to reduce future reallocations
      const newCapacity = Math.ceil(instanceCount * 1.2)
      arrays = {
        capacity: newCapacity,
        start: new Float32Array(newCapacity * 3),
        end: new Float32Array(newCapacity * 3),
        startExtraA: new Float32Array(newCapacity * 4),
        startExtraB: new Float32Array(newCapacity * 4),
        endExtraA: new Float32Array(newCapacity * 4),
        endExtraB: new Float32Array(newCapacity * 4),
      }
      instanceArraysRef.current = arrays
    }

    // Use the pre-allocated arrays
    const { start: instanceStart, end: instanceEnd, startExtraA: instanceStartExtraA, startExtraB: instanceStartExtraB, endExtraA: instanceEndExtraA, endExtraB: instanceEndExtraB } = arrays

    // Fill instance arrays
    for (let i = 0; i < edges.length; i++) {
      const [startIdx, endIdx] = edges[i]!
      const v1 = vertices[startIdx]
      const v2 = vertices[endIdx]

      const baseIdx3 = i * 3
      const baseIdx4 = i * 4

      if (v1 && v2) {
        // XYZ positions
        instanceStart[baseIdx3 + 0] = v1[0] ?? 0
        instanceStart[baseIdx3 + 1] = v1[1] ?? 0
        instanceStart[baseIdx3 + 2] = v1[2] ?? 0
        instanceEnd[baseIdx3 + 0] = v2[0] ?? 0
        instanceEnd[baseIdx3 + 1] = v2[1] ?? 0
        instanceEnd[baseIdx3 + 2] = v2[2] ?? 0

        // Pack start extra dimensions
        // ExtraA: (W, Extra0, Extra1, Extra2)
        instanceStartExtraA[baseIdx4 + 0] = v1[3] ?? 0 // W
        instanceStartExtraA[baseIdx4 + 1] = v1[4] ?? 0 // Extra0
        instanceStartExtraA[baseIdx4 + 2] = v1[5] ?? 0 // Extra1
        instanceStartExtraA[baseIdx4 + 3] = v1[6] ?? 0 // Extra2
        // ExtraB: (Extra3, Extra4, Extra5, Extra6)
        instanceStartExtraB[baseIdx4 + 0] = v1[7] ?? 0 // Extra3
        instanceStartExtraB[baseIdx4 + 1] = v1[8] ?? 0 // Extra4
        instanceStartExtraB[baseIdx4 + 2] = v1[9] ?? 0 // Extra5
        instanceStartExtraB[baseIdx4 + 3] = v1[10] ?? 0 // Extra6

        // Pack end extra dimensions
        instanceEndExtraA[baseIdx4 + 0] = v2[3] ?? 0
        instanceEndExtraA[baseIdx4 + 1] = v2[4] ?? 0
        instanceEndExtraA[baseIdx4 + 2] = v2[5] ?? 0
        instanceEndExtraA[baseIdx4 + 3] = v2[6] ?? 0
        instanceEndExtraB[baseIdx4 + 0] = v2[7] ?? 0
        instanceEndExtraB[baseIdx4 + 1] = v2[8] ?? 0
        instanceEndExtraB[baseIdx4 + 2] = v2[9] ?? 0
        instanceEndExtraB[baseIdx4 + 3] = v2[10] ?? 0
      } else {
        // Invalid edge - use degenerate tube (same start/end)
        for (let j = 0; j < 3; j++) {
          instanceStart[baseIdx3 + j] = 0
          instanceEnd[baseIdx3 + j] = 0
        }
        for (let j = 0; j < 4; j++) {
          instanceStartExtraA[baseIdx4 + j] = 0
          instanceStartExtraB[baseIdx4 + j] = 0
          instanceEndExtraA[baseIdx4 + j] = 0
          instanceEndExtraB[baseIdx4 + j] = 0
        }
      }
    }

    // P4 Optimization: Check if attributes already exist and can be updated in-place
    // This avoids creating new InstancedBufferAttribute objects every time
    const existingStart = geometry.getAttribute('instanceStart') as InstancedBufferAttribute | undefined
    if (existingStart && existingStart.array.length >= instanceCount * 3) {
      // Reuse existing attribute - just update the data
      existingStart.array.set(instanceStart.subarray(0, instanceCount * 3))
      existingStart.needsUpdate = true
      ;(geometry.getAttribute('instanceEnd') as InstancedBufferAttribute).array.set(instanceEnd.subarray(0, instanceCount * 3))
      ;(geometry.getAttribute('instanceEnd') as InstancedBufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('instanceStartExtraA') as InstancedBufferAttribute).array.set(instanceStartExtraA.subarray(0, instanceCount * 4))
      ;(geometry.getAttribute('instanceStartExtraA') as InstancedBufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('instanceStartExtraB') as InstancedBufferAttribute).array.set(instanceStartExtraB.subarray(0, instanceCount * 4))
      ;(geometry.getAttribute('instanceStartExtraB') as InstancedBufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('instanceEndExtraA') as InstancedBufferAttribute).array.set(instanceEndExtraA.subarray(0, instanceCount * 4))
      ;(geometry.getAttribute('instanceEndExtraA') as InstancedBufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('instanceEndExtraB') as InstancedBufferAttribute).array.set(instanceEndExtraB.subarray(0, instanceCount * 4))
      ;(geometry.getAttribute('instanceEndExtraB') as InstancedBufferAttribute).needsUpdate = true
    } else {
      // Create new attributes (first time or capacity increased)
      geometry.setAttribute('instanceStart', new InstancedBufferAttribute(instanceStart.subarray(0, instanceCount * 3), 3))
      geometry.setAttribute('instanceEnd', new InstancedBufferAttribute(instanceEnd.subarray(0, instanceCount * 3), 3))
      geometry.setAttribute('instanceStartExtraA', new InstancedBufferAttribute(instanceStartExtraA.subarray(0, instanceCount * 4), 4))
      geometry.setAttribute('instanceStartExtraB', new InstancedBufferAttribute(instanceStartExtraB.subarray(0, instanceCount * 4), 4))
      geometry.setAttribute('instanceEndExtraA', new InstancedBufferAttribute(instanceEndExtraA.subarray(0, instanceCount * 4), 4))
      geometry.setAttribute('instanceEndExtraB', new InstancedBufferAttribute(instanceEndExtraB.subarray(0, instanceCount * 4), 4))
    }

    // Update instance count
    mesh.count = instanceCount
  }, [vertices, edges, geometry])

  // Update uniforms every frame
  useFrame(({ scene }) => {
    // Skip if material is not ready (still compiling)
    if (!material || !material.uniforms.uRotationMatrix4D) return

    // Read state from cached refs (updated via subscriptions, not getState() per frame)
    const transformState = transformStateRef.current
    const { uniformScale, perAxisScale } = transformState
    const appearanceState = appearanceStateRef.current
    const lightingState = lightingStateRef.current

    // Build scales array (reuse cached array)
    const scales = cachedScalesRef.current
    if (scales.length !== dimension) {
      scales.length = dimension
    }
    for (let i = 0; i < dimension; i++) {
      scales[i] = perAxisScale[i] ?? uniformScale
    }

    // Update rotation matrix via shared hook (handles version tracking)
    ndTransform.update({ scales })
    const gpuData = ndTransform.source.getGPUData()

    // Calculate safe projection distance (only when vertex count changes or scale changes)
    // Avoids O(N) loop every frame
    let projectionDistance: number
    const numVertices = vertices.length

    // Check if scale changed significantly
    const currentScaleSum = scales.reduce((a, b) => a + b, 0);
    const scaleChanged = Math.abs(currentScaleSum - (cachedProjectionDistanceRef.current.scaleSum ?? 0)) > 0.01;

    if (numVertices !== cachedProjectionDistanceRef.current.count || scaleChanged) {
      const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1
      let maxEffectiveDepth = 0
      if (numVertices > 0 && vertices[0]!.length > 3) {
        for (const vertex of vertices) {
          let sum = 0
          for (let d = 3; d < vertex.length; d++) {
            sum += vertex[d]!
          }
          const effectiveDepth = sum / normalizationFactor
          maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth)
        }
      }

      // Calculate max scale
      let maxScale = 1;
      for (const s of scales) maxScale = Math.max(maxScale, s);

      const rawDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0);
      const contentRadius = Math.max(0, rawDistance - 2.0);
      projectionDistance = contentRadius * maxScale + 2.0;

      cachedProjectionDistanceRef.current = {
        count: numVertices,
        distance: projectionDistance,
        scaleSum: currentScaleSum
      }
    } else {
      projectionDistance = cachedProjectionDistanceRef.current.distance
    }

    // Update N-D transformation uniforms
    const u = material.uniforms
    ;(u.uRotationMatrix4D!.value as Matrix4).copy(gpuData.rotationMatrix4D)
    u.uDimension!.value = dimension
    u.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1]

    const extraScales = u.uExtraScales!.value as Float32Array
    for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
      extraScales[i] = scales[i + 4] ?? 1
    }

    ;(u.uExtraRotationCols!.value as Float32Array).set(gpuData.extraRotationCols)
    ;(u.uDepthRowSums!.value as Float32Array).set(gpuData.depthRowSums)
    u.uProjectionDistance!.value = projectionDistance

    // Update material properties (cached linear conversion)
    const cache = colorCacheRef.current
    updateLinearColorUniform(cache.edgeColor, u.uColor!.value as Color, color)
    u.uOpacity!.value = opacity
    u.uMetallic!.value = metallic
    u.uRoughness!.value = roughness
    u.uRadius!.value = radius

    // Update material transparency based on opacity dynamically (like Mandelbulb)
    // This avoids shader rebuild when opacity value changes
    const isTransparent = opacity < 1
    if (material.transparent !== isTransparent) {
      material.transparent = isTransparent
      material.depthWrite = !isTransparent
      material.needsUpdate = true
    }

    // Update lighting uniforms from visual store (cached linear conversion)
    u.uAmbientIntensity!.value = lightingState.ambientIntensity
    updateLinearColorUniform(cache.ambientColor, u.uAmbientColor!.value as Color, lightingState.ambientColor)
    u.uSpecularIntensity!.value = lightingState.specularIntensity
    u.uSpecularPower!.value = lightingState.shininess
    updateLinearColorUniform(cache.specularColor, u.uSpecularColor!.value as Color, lightingState.specularColor)
    // Note: uDiffuseIntensity removed - energy conservation derives diffuse from (1-kS)*(1-metallic)

    // Fresnel (cached linear conversion)
    u.uFresnelEnabled!.value = appearanceState.shaderSettings.surface.fresnelEnabled
    u.uFresnelIntensity!.value = appearanceState.fresnelIntensity
    updateLinearColorUniform(cache.rimColor, u.uRimColor!.value as Color, appearanceState.edgeColor)

    // Rim SSS (shared with raymarched objects)
    u.uSssEnabled!.value = appearanceState.sssEnabled
    u.uSssIntensity!.value = appearanceState.sssIntensity
    updateLinearColorUniform(cache.sssColor, u.uSssColor!.value as Color, appearanceState.sssColor)
    u.uSssThickness!.value = appearanceState.sssThickness
    if (u.uSssJitter) u.uSssJitter.value = appearanceState.sssJitter

    // Update multi-light system (via UniformManager)
    UniformManager.applyToMaterial(material, ['lighting'])

    // Update shadow map uniforms if shadows are enabled
    // Pass store lights to ensure shadow data ordering matches uniform indices
    if (shadowEnabled && lightingState.shadowEnabled) {
      const shadowData = collectShadowDataFromScene(scene, lightingState.lights)
      const shadowQuality = lightingState.shadowQuality
      const shadowMapSize = SHADOW_MAP_SIZES[shadowQuality]
      const pcfSamples = blurToPCFSamples(lightingState.shadowMapBlur)
      updateShadowMapUniforms(
        u as Record<string, { value: unknown }>,
        shadowData,
        lightingState.shadowMapBias,
        shadowMapSize,
        pcfSamples
      )
    }

    // Update shadow material uniforms for animated shadows
    // Patched MeshDepthMaterial and MeshDistanceMaterial share the same shadowUniforms object.
    // Updates to shadowUniforms are automatically reflected in the compiled shaders.
    if (shadowEnabled) {
      const su = shadowUniforms

      // Update N-D transformation uniforms
      ;(su.uRotationMatrix4D!.value as Matrix4).copy(gpuData.rotationMatrix4D)
      su.uDimension!.value = dimension
      const s = su.uScale4D!.value
      if (s instanceof Vector4) {
        s.set(scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1)
      }
      const extraScales = su.uExtraScales!.value as Float32Array
      for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
        extraScales[i] = scales[i + 4] ?? 1
      }
      ;(su.uExtraRotationCols!.value as Float32Array).set(gpuData.extraRotationCols)
      ;(su.uDepthRowSums!.value as Float32Array).set(gpuData.depthRowSums)
      su.uProjectionDistance!.value = projectionDistance
      su.uRadius!.value = radius
    }
  }, FRAME_PRIORITY.RENDERER_UNIFORMS)

  // Don't render if no valid data
  if (!vertices || vertices.length === 0 || !edges || edges.length === 0) {
    return null
  }

  // Render invisible placeholder while shader is compiling
  // This allows the compilation overlay to appear before GPU blocks
  if (isCompiling || !material) {
    return (
      <instancedMesh
        ref={setMeshRef}
        args={[geometry, new MeshBasicMaterial({ visible: false }), edges.length]}
        frustumCulled={false}
      />
    )
  }

  return (
    <instancedMesh
      ref={setMeshRef}
      args={[geometry, material, edges.length]}
      frustumCulled={false}
      castShadow={shadowEnabled}
      receiveShadow={shadowEnabled}
    />
  )
}
