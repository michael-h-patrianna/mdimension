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
    ShaderMaterial,
} from 'three'

import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection'
import { composeRotations } from '@/lib/math/rotation'
import type { VectorND } from '@/lib/math/types'
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/rendering/lights/uniforms'
import { matrixToGPUUniforms } from '@/rendering/shaders/transforms/ndTransform'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useLightingStore } from '@/stores/lightingStore'
import { useProjectionStore } from '@/stores/projectionStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useTransformStore } from '@/stores/transformStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { composeTubeWireframeFragmentShader, composeTubeWireframeVertexShader } from '@/rendering/shaders/tubewireframe/compose'

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
  const projectionStateRef = useRef(useProjectionStore.getState())
  const appearanceStateRef = useRef(useAppearanceStore.getState())
  const lightingStateRef = useRef(useLightingStore.getState())

  // Subscribe to store changes to update refs
  useEffect(() => {
    const unsubRot = useRotationStore.subscribe((s) => { rotationStateRef.current = s })
    const unsubTrans = useTransformStore.subscribe((s) => { transformStateRef.current = s })
    const unsubProj = useProjectionStore.subscribe((s) => { projectionStateRef.current = s })
    const unsubApp = useAppearanceStore.subscribe((s) => { appearanceStateRef.current = s })
    const unsubLight = useLightingStore.subscribe((s) => { lightingStateRef.current = s })
    return () => {
      unsubRot()
      unsubTrans()
      unsubProj()
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

  // Create shader material with all uniforms
  const material = useMemo(() => {
    // Convert colors from sRGB to linear for physically correct lighting
    const colorValue = new Color(color).convertSRGBToLinear()
    const lightUniforms = createLightUniforms()
    const { glsl: fragmentShaderString } = composeTubeWireframeFragmentShader()
    const vertexShaderString = composeTubeWireframeVertexShader()

    const mat = new ShaderMaterial({
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
        uProjectionType: { value: 1 },

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

        // Multi-light system
        ...lightUniforms,
      },
      transparent: opacity < 1,
      depthTest: true,
      depthWrite: opacity >= 1,
      side: DoubleSide,
    })

    return mat
  }, [color, opacity, metallic, roughness, radius, dimension])

  // Dispatch shader debug info
  useEffect(() => {
    const { modules, features } = composeTubeWireframeFragmentShader()
    setShaderDebugInfo('object', {
      name: 'TubeWireframe PBR',
      vertexShaderLength: material.vertexShader.length,
      fragmentShaderLength: material.fragmentShader.length,
      activeModules: modules,
      features: features,
    })
    return () => setShaderDebugInfo('object', null)
  }, [material, setShaderDebugInfo])

  // Cleanup geometry and material on unmount or when they change
  const prevGeometryRef = useRef<CylinderGeometry | null>(null)
  const prevMaterialRef = useRef<ShaderMaterial | null>(null)

  useEffect(() => {
    // Dispose old resources if they exist and differ from current
    if (prevGeometryRef.current && prevGeometryRef.current !== geometry) {
      prevGeometryRef.current.dispose()
    }
    if (prevMaterialRef.current && prevMaterialRef.current !== material) {
      prevMaterialRef.current.dispose()
    }

    // Update refs to current values
    prevGeometryRef.current = geometry
    prevMaterialRef.current = material

    // Cleanup on unmount
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

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
  useFrame(() => {
    if (!material.uniforms.uRotationMatrix4D) return

    // Read state from cached refs (updated via subscriptions, not getState() per frame)
    const rotationState = rotationStateRef.current
    const transformState = transformStateRef.current
    const { uniformScale, perAxisScale } = transformState
    const projectionType = projectionStateRef.current.type
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
    u.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0

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

    // Update multi-light system (with cached linear color conversion)
    updateLightUniforms(u as unknown as LightUniforms, lightingState.lights, lightColorCacheRef.current)
  })

  // Don't render if no valid data
  if (!vertices || vertices.length === 0 || !edges || edges.length === 0) {
    return null
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
