/**
 * TubeWireframe Component
 *
 * GPU-accelerated tube wireframe renderer with N-D transformation support
 * and PBR material properties. Uses InstancedMesh with CylinderGeometry
 * for true 3D edges that respond to lighting.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import React, { useRef, useLayoutEffect, useMemo } from 'react'
import {
  CylinderGeometry,
  InstancedBufferAttribute,
  Matrix4,
  Color,
  ShaderMaterial,
  DoubleSide,
  InstancedMesh,
  GLSL3,
} from 'three'
import { useFrame } from '@react-three/fiber'

import type { VectorND } from '@/lib/math/types'
import { useRotationStore } from '@/stores/rotationStore'
import { useTransformStore } from '@/stores/transformStore'
import { useProjectionStore } from '@/stores/projectionStore'
import { useVisualStore } from '@/stores/visualStore'
import { composeRotations } from '@/lib/math/rotation'
import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection'
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform'
import { createLightUniforms, updateLightUniforms, type LightUniforms } from '@/lib/lights/uniforms'

import vertexShader from './tubeWireframe.vert?raw'
import fragmentShader from './tubeWireframe.frag?raw'

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

  // Base cylinder geometry (Y-axis aligned, height 1, centered at origin)
  const geometry = useMemo(() => {
    return new CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, false)
  }, [])

  // Create shader material with all uniforms
  const material = useMemo(() => {
    const colorValue = new Color(color)
    const lightUniforms = createLightUniforms()

    const mat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        // Material
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

        // Global lighting
        uAmbientIntensity: { value: 0.01 },
        uAmbientColor: { value: new Color('#FFFFFF') },
        uSpecularIntensity: { value: 0.5 },
        uSpecularPower: { value: 30 },
        uSpecularColor: { value: new Color('#FFFFFF') },
        uDiffuseIntensity: { value: 1.0 },

        // Fresnel
        uFresnelEnabled: { value: true },
        uFresnelIntensity: { value: 0.1 },
        uRimColor: { value: new Color(color) },

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

  // Update instance attributes when vertices/edges change
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !vertices || vertices.length === 0 || !edges || edges.length === 0) return

    const instanceCount = edges.length

    // Prepare instance attribute arrays
    const instanceStart = new Float32Array(instanceCount * 3)
    const instanceEnd = new Float32Array(instanceCount * 3)
    const instanceStartExtraA = new Float32Array(instanceCount * 4)
    const instanceStartExtraB = new Float32Array(instanceCount * 4)
    const instanceEndExtraA = new Float32Array(instanceCount * 4)
    const instanceEndExtraB = new Float32Array(instanceCount * 4)

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

    // Set instance attributes on the geometry
    geometry.setAttribute('instanceStart', new InstancedBufferAttribute(instanceStart, 3))
    geometry.setAttribute('instanceEnd', new InstancedBufferAttribute(instanceEnd, 3))
    geometry.setAttribute(
      'instanceStartExtraA',
      new InstancedBufferAttribute(instanceStartExtraA, 4)
    )
    geometry.setAttribute(
      'instanceStartExtraB',
      new InstancedBufferAttribute(instanceStartExtraB, 4)
    )
    geometry.setAttribute('instanceEndExtraA', new InstancedBufferAttribute(instanceEndExtraA, 4))
    geometry.setAttribute('instanceEndExtraB', new InstancedBufferAttribute(instanceEndExtraB, 4))

    // Update instance count
    mesh.count = instanceCount
  }, [vertices, edges, geometry])

  // Update uniforms every frame
  useFrame(() => {
    if (!material.uniforms.uRotationMatrix4D) return

    // Get stores state
    const rotations = useRotationStore.getState().rotations
    const { uniformScale, perAxisScale } = useTransformStore.getState()
    const projectionType = useProjectionStore.getState().type
    const visualState = useVisualStore.getState()

    // Build scales array
    const scales: number[] = []
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale)
    }

    // Compute rotation matrix and GPU data
    const rotationMatrix = composeRotations(dimension, rotations)
    const gpuData = matrixToGPUUniforms(rotationMatrix, dimension)

    // Calculate safe projection distance
    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1
    let maxEffectiveDepth = 0
    if (vertices.length > 0 && vertices[0]!.length > 3) {
      for (const vertex of vertices) {
        let sum = 0
        for (let d = 3; d < vertex.length; d++) {
          sum += vertex[d]!
        }
        const effectiveDepth = sum / normalizationFactor
        maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth)
      }
    }
    const projectionDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0)

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

    // Update material properties
    ;(u.uColor!.value as Color).set(color)
    u.uOpacity!.value = opacity
    u.uMetallic!.value = metallic
    u.uRoughness!.value = roughness
    u.uRadius!.value = radius

    // Update lighting uniforms from visual store
    u.uAmbientIntensity!.value = visualState.ambientIntensity
    ;(u.uAmbientColor!.value as Color).set(visualState.ambientColor)
    u.uSpecularIntensity!.value = visualState.specularIntensity
    u.uSpecularPower!.value = visualState.shininess
    ;(u.uSpecularColor!.value as Color).set(visualState.specularColor)
    u.uDiffuseIntensity!.value = visualState.diffuseIntensity

    // Fresnel
    u.uFresnelEnabled!.value = visualState.fresnelEnabled
    u.uFresnelIntensity!.value = visualState.fresnelIntensity
    ;(u.uRimColor!.value as Color).set(visualState.edgeColor)

    // Update multi-light system
    updateLightUniforms(u as unknown as LightUniforms, visualState.lights)
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
