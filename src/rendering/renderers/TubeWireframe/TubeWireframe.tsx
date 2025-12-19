/**
 * TubeWireframe Component
 *
 * GPU-accelerated tube wireframe renderer with N-D transformation support
 * and PBR material properties. Uses InstancedMesh with CylinderGeometry
 * for true 3D edges that respond to lighting.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import { createColorCache, createLightColorCache, updateLinearColorUniform } from '@/rendering/colors/linearCache'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useTrackedShaderMaterial } from '@/rendering/materials/useTrackedShaderMaterial'
import { useFrame } from '@react-three/fiber'
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
import { composeRotations } from '@/lib/math/rotation'
import type { VectorND } from '@/lib/math/types'
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/rendering/lights/uniforms'
import { matrixToGPUUniforms } from '@/rendering/shaders/transforms/ndTransform'
import {
  blurToPCFSamples,
  collectShadowDataFromScene,
  createShadowMapUniforms,
  SHADOW_MAP_SIZES,
  updateShadowMapUniforms,
} from '@/rendering/shadows'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useLightingStore } from '@/stores/lightingStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useTransformStore } from '@/stores/transformStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { composeTubeWireframeFragmentShader, composeTubeWireframeVertexShader } from '@/rendering/shaders/tubewireframe/compose'
import {
  tubeWireframeDepthVertexShader,
  tubeWireframeDistanceVertexShader,
  depthFragmentShader,
  distanceFragmentShader,
} from '@/rendering/shaders/shared/depth/customDepth.glsl'
import { Vector3 } from 'three'

// Maximum extra dimensions (beyond XYZ + W)
const MAX_EXTRA_DIMS = 7

// Cylinder segments for tube rendering (balance quality/performance)
const CYLINDER_SEGMENTS = 8

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

  // Cached linear colors - avoid per-frame sRGB->linear conversion
  const colorCacheRef = useRef(createColorCache())
  const lightColorCacheRef = useRef(createLightColorCache())

  // Performance optimization: Cache objects to avoid per-frame allocation/calculation
  const cachedScalesRef = useRef<number[]>([])
  const cachedGpuDataRef = useRef<ReturnType<typeof matrixToGPUUniforms> | null>(null)
  const prevRotationVersionRef = useRef<number>(-1)
  const cachedDimensionRef = useRef<number>(0)
  const cachedProjectionDistanceRef = useRef<{ count: number; distance: number }>({ count: 0, distance: DEFAULT_PROJECTION_DISTANCE })

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
  const rotationStateRef = useRef(useRotationStore.getState())
  const transformStateRef = useRef(useTransformStore.getState())
  const appearanceStateRef = useRef(useAppearanceStore.getState())
  const lightingStateRef = useRef(useLightingStore.getState())

  // Subscribe to store changes to update refs
  useEffect(() => {
    const unsubRot = useRotationStore.subscribe((s) => { rotationStateRef.current = s })
    const unsubTrans = useTransformStore.subscribe((s) => { transformStateRef.current = s })
    const unsubApp = useAppearanceStore.subscribe((s) => { appearanceStateRef.current = s })
    const unsubLight = useLightingStore.subscribe((s) => { lightingStateRef.current = s })
    return () => {
      unsubRot()
      unsubTrans()
      unsubApp()
      unsubLight()
    }
  }, [])

  // Assign main object layer for depth-based effects (SSR, refraction, bokeh)
  useEffect(() => {
    if (meshRef.current?.layers) {
      meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)
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
      const lightUniforms = createLightUniforms()
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

          // Global lighting (colors converted to linear space)
          uAmbientIntensity: { value: 0.01 },
          uAmbientColor: { value: new Color('#FFFFFF').convertSRGBToLinear() },
          uSpecularIntensity: { value: 0.5 },
          uSpecularPower: { value: 30 },
          uSpecularColor: { value: new Color('#FFFFFF').convertSRGBToLinear() },
          uDiffuseIntensity: { value: 1.0 },

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

          // Multi-light system
          ...lightUniforms,
          // Shadow map uniforms
          ...createShadowMapUniforms(),
        },
        transparent: opacity < 1,
        depthTest: true,
        depthWrite: opacity >= 1,
        side: DoubleSide,
      })
    },
    [color, opacity, metallic, roughness, radius, dimension, sssEnabled, fresnelEnabled, fragmentShaderString]
  )

  // Custom depth materials for shadow map rendering with nD transformation
  // These ensure shadows animate correctly when the object animates
  const customDepthMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uRotationMatrix4D: { value: new Matrix4() },
        uDimension: { value: dimension },
        uScale4D: { value: [1, 1, 1, 1] },
        uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
        uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
        uDepthRowSums: { value: new Float32Array(11) },
        uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
        uRadius: { value: radius },
      },
      vertexShader: tubeWireframeDepthVertexShader,
      fragmentShader: depthFragmentShader,
    })
  }, [radius, dimension])

  const customDistanceMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uRotationMatrix4D: { value: new Matrix4() },
        uDimension: { value: dimension },
        uScale4D: { value: [1, 1, 1, 1] },
        uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
        uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
        uDepthRowSums: { value: new Float32Array(11) },
        uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
        uRadius: { value: radius },
        // Point light shadow uniforms - set by Three.js during shadow pass
        referencePosition: { value: new Vector3() },
        nearDistance: { value: 1.0 },
        farDistance: { value: 1000.0 },
      },
      vertexShader: tubeWireframeDistanceVertexShader,
      fragmentShader: distanceFragmentShader,
    })
  }, [radius, dimension])

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

  // Assign custom depth materials to mesh for animated shadows
  useEffect(() => {
    const mesh = meshRef.current
    if (mesh && shadowEnabled) {
      mesh.customDepthMaterial = customDepthMaterial
      mesh.customDistanceMaterial = customDistanceMaterial
    } else if (mesh) {
      mesh.customDepthMaterial = undefined as unknown as ShaderMaterial
      mesh.customDistanceMaterial = undefined as unknown as ShaderMaterial
    }
  }, [shadowEnabled, customDepthMaterial, customDistanceMaterial])

  // Cleanup custom depth materials on unmount
  useEffect(() => {
    return () => {
      customDepthMaterial.dispose()
      customDistanceMaterial.dispose()
    }
  }, [customDepthMaterial, customDistanceMaterial])

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
    const rotationState = rotationStateRef.current
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

    // Compute rotation matrix and GPU data (only when changed)
    const rotationVersion = rotationState.version
    const rotationsChanged = dimension !== cachedDimensionRef.current || rotationVersion !== prevRotationVersionRef.current
    
    let gpuData: ReturnType<typeof matrixToGPUUniforms>
    if (rotationsChanged || !cachedGpuDataRef.current) {
      const rotationMatrix = composeRotations(dimension, rotationState.rotations)
      gpuData = matrixToGPUUniforms(rotationMatrix, dimension)
      // Update cache
      cachedGpuDataRef.current = gpuData
      cachedDimensionRef.current = dimension
      prevRotationVersionRef.current = rotationVersion
    } else {
      gpuData = cachedGpuDataRef.current
    }

    // Calculate safe projection distance (only when vertex count changes)
    // Avoids O(N) loop every frame
    let projectionDistance: number
    const numVertices = vertices.length
    if (numVertices !== cachedProjectionDistanceRef.current.count) {
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
      projectionDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0)
      cachedProjectionDistanceRef.current = { count: numVertices, distance: projectionDistance }
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

    // Update lighting uniforms from visual store (cached linear conversion)
    u.uAmbientIntensity!.value = lightingState.ambientIntensity
    updateLinearColorUniform(cache.ambientColor, u.uAmbientColor!.value as Color, lightingState.ambientColor)
    u.uSpecularIntensity!.value = lightingState.specularIntensity
    u.uSpecularPower!.value = lightingState.shininess
    updateLinearColorUniform(cache.specularColor, u.uSpecularColor!.value as Color, lightingState.specularColor)
    u.uDiffuseIntensity!.value = lightingState.diffuseIntensity

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

    // Update multi-light system (with cached linear color conversion)
    updateLightUniforms(u as unknown as LightUniforms, lightingState.lights, lightColorCacheRef.current)

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

    // Update custom depth materials for animated shadows
    // These need the same N-D transformation uniforms as the main shader
    if (shadowEnabled && meshRef.current) {
      const mesh = meshRef.current

      // Helper function to update N-D uniforms on a depth material
      const updateDepthNDUniforms = (depthMat: ShaderMaterial) => {
        const du = depthMat.uniforms
        ;(du.uRotationMatrix4D!.value as Matrix4).copy(gpuData.rotationMatrix4D)
        du.uDimension!.value = dimension
        du.uScale4D!.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1]
        const depthExtraScales = du.uExtraScales!.value as Float32Array
        for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
          depthExtraScales[i] = scales[i + 4] ?? 1
        }
        ;(du.uExtraRotationCols!.value as Float32Array).set(gpuData.extraRotationCols)
        ;(du.uDepthRowSums!.value as Float32Array).set(gpuData.depthRowSums)
        du.uProjectionDistance!.value = projectionDistance
        du.uRadius!.value = radius
      }

      // Update custom depth material (directional/spot shadows)
      if (mesh.customDepthMaterial && 'uniforms' in mesh.customDepthMaterial) {
        updateDepthNDUniforms(mesh.customDepthMaterial as ShaderMaterial)
      }

      // Update custom distance material (point light shadows)
      if (mesh.customDistanceMaterial && 'uniforms' in mesh.customDistanceMaterial) {
        updateDepthNDUniforms(mesh.customDistanceMaterial as ShaderMaterial)
      }
    }
  })

  // Don't render if no valid data
  if (!vertices || vertices.length === 0 || !edges || edges.length === 0) {
    return null
  }

  // Render invisible placeholder while shader is compiling
  // This allows the compilation overlay to appear before GPU blocks
  if (isCompiling || !material) {
    return (
      <instancedMesh
        ref={meshRef}
        args={[geometry, new MeshBasicMaterial({ visible: false }), edges.length]}
        frustumCulled={false}
      />
    )
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, edges.length]}
      frustumCulled={false}
      castShadow={shadowEnabled}
      receiveShadow={shadowEnabled}
    />
  )
}
