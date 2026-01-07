/**
 * TubeWireframeTSL - TSL Node Material for N-dimensional tube wireframe rendering
 *
 * WebGPU-compatible material using Three.js TSL (Three Shading Language).
 * Uses MeshStandardNodeMaterial for PBR lighting with custom position nodes
 * for N-dimensional tube vertex transformation.
 *
 * Architecture:
 * - InstancedMesh with CylinderGeometry for tube segments
 * - Instance attributes: instanceStart, instanceEnd, and extra dimension packs
 * - Custom positionNode transforms tube vertices through N-D pipeline
 * - PBR properties from usePBRStore.edge
 *
 * @module rendering/tsl/materials/tubewireframe/TubeWireframeTSL
 */

import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection'
import type { VectorND } from '@/lib/math/types'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useNDTransformUpdates, useProjectionDistanceCache } from '@/rendering/renderers/base'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { usePBRStore } from '@/stores/pbrStore'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import {
  abs,
  attribute,
  cameraPosition,
  cross,
  dot,
  float,
  Fn,
  int,
  length,
  max,
  normalize,
  normalWorld,
  positionWorld,
  screenCoordinate,
  select,
  sqrt,
  uniform,
  vec3,
  vec4,
  type UniformNode,
} from 'three/tsl'
import { createPolytopeSSSNode, createMeshSSSUniforms, type MeshSSSUniforms } from '../../features/mesh-sss'
import { createFresnelTSLUniforms, type FresnelTSLUniforms } from '../../lighting/light-uniforms'
import { createMeshMRTNode } from '../../mrt/mesh'
import { safeNormalizeUp } from '../../utils/safe-math'

// Cylinder segments for tube rendering (balance quality/performance)
const CYLINDER_SEGMENTS = 8

// =============================================================================
// Tube N-D Transform Uniforms
// =============================================================================

/**
 * Uniforms for tube N-D transformation in TSL.
 * Uses vec4 uniforms for extra rotation data.
 */
export interface TubeNDTransformUniforms {
  /** 4x4 rotation matrix for first 4 dimensions */
  uRotationMatrix4D: UniformNode<THREE.Matrix4>
  /** Current dimension (3-11) */
  uDimension: UniformNode<number>
  /** Uniform scale applied after projection (camera zoom) */
  uUniformScale: UniformNode<number>
  /** Projection distance for perspective */
  uProjectionDistance: UniformNode<number>
  /** Tube radius */
  uRadius: UniformNode<number>
  /** Extra rotation columns for dimensions 5-11 */
  uExtraRotCol0: UniformNode<THREE.Vector4>
  uExtraRotCol1: UniformNode<THREE.Vector4>
  uExtraRotCol2: UniformNode<THREE.Vector4>
  uExtraRotCol3: UniformNode<THREE.Vector4>
  uExtraRotCol4: UniformNode<THREE.Vector4>
  uExtraRotCol5: UniformNode<THREE.Vector4>
  uExtraRotCol6: UniformNode<THREE.Vector4>
  /** Depth row sums for perspective projection */
  uDepthSums0: UniformNode<THREE.Vector4>
  uDepthSums1: UniformNode<THREE.Vector4>
  uDepthSums2: UniformNode<THREE.Vector4>
}

/**
 * Create tube N-D transformation uniforms for TSL.
 */
export function createTubeNDTransformUniforms(): TubeNDTransformUniforms {
  return {
    uRotationMatrix4D: uniform(new THREE.Matrix4()),
    uDimension: uniform(4),
    uUniformScale: uniform(1.0),
    uProjectionDistance: uniform(DEFAULT_PROJECTION_DISTANCE),
    uRadius: uniform(0.02),
    uExtraRotCol0: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol1: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol2: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol3: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol4: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol5: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uExtraRotCol6: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uDepthSums0: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uDepthSums1: uniform(new THREE.Vector4(0, 0, 0, 0)),
    uDepthSums2: uniform(new THREE.Vector4(0, 0, 0, 0)),
  }
}

// =============================================================================
// TSL N-D Point Transform Function
// =============================================================================

/**
 * TSL function to transform a single N-D point to 3D.
 * Used for both start and end points of tubes.
 */
const ndTransformPoint = (uniforms: TubeNDTransformUniforms) =>
  Fn(
    ([
      posXYZ,
      extraA,
      extraB,
    ]: [ReturnType<typeof vec3>, ReturnType<typeof vec4>, ReturnType<typeof vec4>]) => {
      const dimension = uniforms.uDimension

      // Apply rotation to first 4 dimensions
      // pos4 = vec4(pos.x, pos.y, pos.z, extraA.x)
      const pos4 = vec4(posXYZ.x, posXYZ.y, posXYZ.z, extraA.x)
      const rotated = uniforms.uRotationMatrix4D.mul(pos4)

      // Extract rotated components
      let rotX = rotated.x
      let rotY = rotated.y
      let rotZ = rotated.z
      let rotW = rotated.w

      // Get extra dimension values from instance attributes
      const dim5Value = extraA.y
      const dim6Value = extraA.z
      const dim7Value = extraA.w
      const dim8Value = extraB.x
      const dim9Value = extraB.y
      const dim10Value = extraB.z

      // Add contribution from dimension 5
      const d5Active = dimension.greaterThanEqual(int(5))
      const col0 = uniforms.uExtraRotCol0
      rotX = rotX.add(d5Active.select(col0.x.mul(dim5Value), float(0)))
      rotY = rotY.add(d5Active.select(col0.y.mul(dim5Value), float(0)))
      rotZ = rotZ.add(d5Active.select(col0.z.mul(dim5Value), float(0)))
      rotW = rotW.add(d5Active.select(col0.w.mul(dim5Value), float(0)))

      // Add contribution from dimension 6
      const d6Active = dimension.greaterThanEqual(int(6))
      const col1 = uniforms.uExtraRotCol1
      rotX = rotX.add(d6Active.select(col1.x.mul(dim6Value), float(0)))
      rotY = rotY.add(d6Active.select(col1.y.mul(dim6Value), float(0)))
      rotZ = rotZ.add(d6Active.select(col1.z.mul(dim6Value), float(0)))
      rotW = rotW.add(d6Active.select(col1.w.mul(dim6Value), float(0)))

      // Add contribution from dimension 7
      const d7Active = dimension.greaterThanEqual(int(7))
      const col2 = uniforms.uExtraRotCol2
      rotX = rotX.add(d7Active.select(col2.x.mul(dim7Value), float(0)))
      rotY = rotY.add(d7Active.select(col2.y.mul(dim7Value), float(0)))
      rotZ = rotZ.add(d7Active.select(col2.z.mul(dim7Value), float(0)))
      rotW = rotW.add(d7Active.select(col2.w.mul(dim7Value), float(0)))

      // Add contribution from dimension 8
      const d8Active = dimension.greaterThanEqual(int(8))
      const col3 = uniforms.uExtraRotCol3
      rotX = rotX.add(d8Active.select(col3.x.mul(dim8Value), float(0)))
      rotY = rotY.add(d8Active.select(col3.y.mul(dim8Value), float(0)))
      rotZ = rotZ.add(d8Active.select(col3.z.mul(dim8Value), float(0)))
      rotW = rotW.add(d8Active.select(col3.w.mul(dim8Value), float(0)))

      // Add contribution from dimension 9
      const d9Active = dimension.greaterThanEqual(int(9))
      const col4 = uniforms.uExtraRotCol4
      rotX = rotX.add(d9Active.select(col4.x.mul(dim9Value), float(0)))
      rotY = rotY.add(d9Active.select(col4.y.mul(dim9Value), float(0)))
      rotZ = rotZ.add(d9Active.select(col4.z.mul(dim9Value), float(0)))
      rotW = rotW.add(d9Active.select(col4.w.mul(dim9Value), float(0)))

      // Add contribution from dimension 10
      const d10Active = dimension.greaterThanEqual(int(10))
      const col5 = uniforms.uExtraRotCol5
      rotX = rotX.add(d10Active.select(col5.x.mul(dim10Value), float(0)))
      rotY = rotY.add(d10Active.select(col5.y.mul(dim10Value), float(0)))
      rotZ = rotZ.add(d10Active.select(col5.z.mul(dim10Value), float(0)))
      rotW = rotW.add(d10Active.select(col5.w.mul(dim10Value), float(0)))

      // Perspective Projection
      const depthSums0 = uniforms.uDepthSums0
      const depthSums1 = uniforms.uDepthSums1
      const depthSums2 = uniforms.uDepthSums2

      // Start with rotated.w
      let effectiveDepth = rotW

      // Add depth contributions from base position (dims 0-2)
      effectiveDepth = effectiveDepth.add(depthSums0.x.mul(posXYZ.x))
      effectiveDepth = effectiveDepth.add(depthSums0.y.mul(posXYZ.y))
      effectiveDepth = effectiveDepth.add(depthSums0.z.mul(posXYZ.z))

      // Add depth contribution from dim 4
      const d4Active = dimension.greaterThanEqual(int(4))
      effectiveDepth = effectiveDepth.add(
        d4Active.select(depthSums0.w.mul(extraA.x), float(0))
      )

      // Add depth contributions from dims 5-8
      effectiveDepth = effectiveDepth.add(
        d5Active.select(depthSums1.x.mul(dim5Value), float(0))
      )
      effectiveDepth = effectiveDepth.add(
        d6Active.select(depthSums1.y.mul(dim6Value), float(0))
      )
      effectiveDepth = effectiveDepth.add(
        d7Active.select(depthSums1.z.mul(dim7Value), float(0))
      )
      effectiveDepth = effectiveDepth.add(
        d8Active.select(depthSums1.w.mul(dim8Value), float(0))
      )

      // Add depth contributions from dims 9-10
      effectiveDepth = effectiveDepth.add(
        d9Active.select(depthSums2.x.mul(dim9Value), float(0))
      )
      effectiveDepth = effectiveDepth.add(
        d10Active.select(depthSums2.y.mul(dim10Value), float(0))
      )

      // Normalize depth by sqrt(dimension - 3)
      const dimFloat = float(dimension)
      const normFactor = dimension.greaterThan(int(4)).select(
        sqrt(max(float(1), dimFloat.sub(float(3)))),
        float(1)
      )
      effectiveDepth = effectiveDepth.div(normFactor)

      // Compute perspective projection factor
      const projDist = uniforms.uProjectionDistance
      let denom = projDist.sub(effectiveDepth)

      // Guard against division by zero
      const denomAbs = abs(denom)
      const isNearZero = denomAbs.lessThan(float(0.0001))
      const signedMinDenom = denom.greaterThanEqual(float(0)).select(
        float(0.0001),
        float(-0.0001)
      )
      denom = isNearZero.select(signedMinDenom, denom)

      const factor = float(1).div(denom)
      const scale = uniforms.uUniformScale

      // Return projected position
      return vec3(
        rotX.mul(factor).mul(scale),
        rotY.mul(factor).mul(scale),
        rotZ.mul(factor).mul(scale)
      )
    }
  )

// =============================================================================
// Tube Position Node
// =============================================================================

/**
 * Create the tube position node for TSL.
 * Transforms tube cylinder vertices based on instance start/end positions.
 */
export const createTubePositionNode = (uniforms: TubeNDTransformUniforms) => {
  // Create the point transformation function
  const transformPointFn = ndTransformPoint(uniforms)

  return Fn(() => {
    // Get base cylinder position (local space, Y-axis aligned, height 1)
    const localPos = attribute('position', 'vec3')

    // Get instance attributes
    const instanceStart = attribute('instanceStart', 'vec3')
    const instanceEnd = attribute('instanceEnd', 'vec3')
    const instanceStartExtraA = attribute('instanceStartExtraA', 'vec4')
    const instanceStartExtraB = attribute('instanceStartExtraB', 'vec4')
    const instanceEndExtraA = attribute('instanceEndExtraA', 'vec4')
    const instanceEndExtraB = attribute('instanceEndExtraB', 'vec4')

    // Transform start and end points through N-D pipeline
    const start3D = transformPointFn(instanceStart, instanceStartExtraA, instanceStartExtraB)
    const end3D = transformPointFn(instanceEnd, instanceEndExtraA, instanceEndExtraB)

    // Build tube orientation from start to end
    const dir = end3D.sub(start3D)
    const tubeLength = length(dir)

    // Handle degenerate tubes (same start/end)
    // CRITICAL: In TSL/GPU, normalize(dir) executes even when isDegenerate is true
    // so we must guard the length before normalizing to avoid NaN from zero-vector normalize
    const isDegenerate = tubeLength.lessThan(float(0.0001))
    const safeLength = max(tubeLength, float(0.0001))
    const axis = isDegenerate.select(vec3(0, 1, 0), dir.div(safeLength))

    // Build orthonormal basis for tube cross-section
    const absY = abs(axis.y)
    const up = absY.lessThan(float(0.999)).select(vec3(0, 1, 0), vec3(1, 0, 0))
    // CRITICAL: Guard cross product - when up and axis are nearly parallel,
    // cross product approaches zero and normalize produces NaN
    const crossResult = cross(up, axis)
    const crossLen = length(crossResult)
    const safeCrossLen = max(crossLen, float(0.0001))
    const tangent = crossResult.div(safeCrossLen)
    const bitangent = cross(axis, tangent)

    // Get tube radius from uniform
    const radius = uniforms.uRadius

    // Transform local cylinder vertex:
    // - localPos.xz is the radial position (scaled by radius)
    // - localPos.y is the height along the tube (scaled by length)
    const radialX = tangent.mul(localPos.x)
    const radialZ = bitangent.mul(localPos.z)
    const radial = radialX.add(radialZ).mul(radius)

    // +0.5 to shift from centered cylinder to start-aligned
    const axialOffset = localPos.y.add(float(0.5))
    const axial = axis.mul(axialOffset).mul(tubeLength)

    // Final position
    const result = isDegenerate.select(start3D, start3D.add(radial).add(axial))

    return result
  })()
}

// =============================================================================
// Uniform Update Helper
// =============================================================================

/**
 * Update tube N-D transformation uniforms.
 */
export function updateTubeNDTransformUniforms(
  uniforms: TubeNDTransformUniforms,
  gpuData: {
    rotationMatrix4D: THREE.Matrix4
    extraRotationCols: Float32Array
    depthRowSums: Float32Array
  },
  dimension: number,
  uniformScale: number,
  projectionDistance: number,
  radius: number
): void {
  uniforms.uRotationMatrix4D.value.copy(gpuData.rotationMatrix4D)
  uniforms.uDimension.value = dimension
  uniforms.uUniformScale.value = uniformScale
  uniforms.uProjectionDistance.value = projectionDistance
  uniforms.uRadius.value = radius

  // Unpack extraRotationCols (28 floats) into 7 vec4 uniforms
  const cols = gpuData.extraRotationCols
  uniforms.uExtraRotCol0.value.set(cols[0] ?? 0, cols[1] ?? 0, cols[2] ?? 0, cols[3] ?? 0)
  uniforms.uExtraRotCol1.value.set(cols[4] ?? 0, cols[5] ?? 0, cols[6] ?? 0, cols[7] ?? 0)
  uniforms.uExtraRotCol2.value.set(cols[8] ?? 0, cols[9] ?? 0, cols[10] ?? 0, cols[11] ?? 0)
  uniforms.uExtraRotCol3.value.set(cols[12] ?? 0, cols[13] ?? 0, cols[14] ?? 0, cols[15] ?? 0)
  uniforms.uExtraRotCol4.value.set(cols[16] ?? 0, cols[17] ?? 0, cols[18] ?? 0, cols[19] ?? 0)
  uniforms.uExtraRotCol5.value.set(cols[20] ?? 0, cols[21] ?? 0, cols[22] ?? 0, cols[23] ?? 0)
  uniforms.uExtraRotCol6.value.set(cols[24] ?? 0, cols[25] ?? 0, cols[26] ?? 0, cols[27] ?? 0)

  // Unpack depthRowSums (11 floats) into 3 vec4 uniforms
  const depths = gpuData.depthRowSums
  uniforms.uDepthSums0.value.set(depths[0] ?? 0, depths[1] ?? 0, depths[2] ?? 0, depths[3] ?? 0)
  uniforms.uDepthSums1.value.set(depths[4] ?? 0, depths[5] ?? 0, depths[6] ?? 0, depths[7] ?? 0)
  uniforms.uDepthSums2.value.set(depths[8] ?? 0, depths[9] ?? 0, depths[10] ?? 0, 0)
}

// =============================================================================
// TubeWireframeTSL Component
// =============================================================================

export interface TubeWireframeTSLProps {
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
  /** Whether shadows are enabled */
  shadowEnabled?: boolean
  /** Whether to render end caps on tubes (default: false for performance) */
  caps?: boolean
}

/**
 * TSL-based TubeWireframe for WebGPU.
 * Uses InstancedMesh with MeshStandardNodeMaterial and custom positionNode.
 */
export function TubeWireframeTSL({
  vertices,
  edges,
  dimension = 3,
  color,
  opacity = 1.0,
  radius = 0.02,
  shadowEnabled = false,
  caps = false,
}: TubeWireframeTSLProps): React.JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // N-D transform hook
  const ndTransform = useNDTransformUpdates()

  // Projection distance cache
  const projDistCache = useProjectionDistanceCache()

  // Version tracking for dirty-flag optimization
  const lastVersionRef = useRef({ polytope: -1, pbr: -1 })

  // Pre-allocated instance attribute arrays
  const instanceArraysRef = useRef<{
    capacity: number
    start: Float32Array
    end: Float32Array
    startExtraA: Float32Array
    startExtraB: Float32Array
    endExtraA: Float32Array
    endExtraB: Float32Array
  } | null>(null)

  // Create N-D transformation uniforms
  const ndUniforms = useMemo<TubeNDTransformUniforms>(
    () => createTubeNDTransformUniforms(),
    []
  )

  // Create color/appearance uniforms
  const colorRef = useRef(new THREE.Vector3(1, 1, 1))
  const opacityRef = useRef(opacity)

  const appearanceUniforms = useMemo(
    () => ({
      uColor: uniform(colorRef.current),
      uOpacity: uniform(opacityRef.current),
    }),
    []
  )

  // Create PBR uniforms from edge store
  const edgePBR = usePBRStore.getState().edge
  // Use Vector3 for specular color (TSL specularColorNode expects vec3, not Color)
  const initSpecColor = new THREE.Color(edgePBR.specularColor).convertSRGBToLinear()
  const specularColorRef = useRef(new THREE.Vector3(initSpecColor.r, initSpecColor.g, initSpecColor.b))
  const pbrUniforms = useMemo(
    () => ({
      uRoughness: uniform(edgePBR.roughness),
      uMetalness: uniform(edgePBR.metallic),
      uSpecularIntensity: uniform(edgePBR.specularIntensity),
      uSpecularColor: uniform(specularColorRef.current),
    }),
    []
  )

  // Create SSS uniforms for WebGL parity
  // WebGL tubes have SSS via computeSSS() in main.glsl.ts
  const sssUniforms = useMemo<MeshSSSUniforms>(
    () => createMeshSSSUniforms(),
    []
  )

  // Create Fresnel rim uniforms for WebGL parity
  // WebGL tubes have Fresnel rim: (1-NdotV)^3 * intensity * 2 * (0.3 + 0.7 * totalNdotL)
  const fresnelUniforms = useMemo<FresnelTSLUniforms>(
    () => createFresnelTSLUniforms(),
    []
  )

  // Store ref for appearance updates
  const appearanceStoreRef = useRef(useAppearanceStore)
  const lastAppearanceVersionRef = useRef(-1)

  // Base cylinder geometry
  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, !caps)
  }, [caps])

  // Create SSS + Fresnel emissive node for WebGL parity
  // This adds SSS and Fresnel rim contributions on top of MeshPhysicalNodeMaterial's PBR lighting
  // WebGL pattern: SSS per-light + Fresnel rim post-lighting
  // NOTE: For full parity, tubes would need custom multi-light loop like polytopes.
  // This simplified version uses a single key light approximation.
  const createTubeEmissiveNode = useMemo(() => {
    // Use polytope-specific SSS (distortion=0.5, power=thickness*4, no exp)
    const polytopeSSSNode = createPolytopeSSSNode(sssUniforms)
    const sssIntensityU = float(sssUniforms.uSssIntensity)

    return Fn(() => {
      // Get geometry normal (from cylinder) and view direction
      const N = normalWorld
      // CRITICAL: Use safe normalize - camera could theoretically be at surface position
      const V = safeNormalizeUp(cameraPosition.sub(positionWorld))

      // Initialize emissive contribution
      const emissive = vec3(0, 0, 0).toVar('tubeEmissive')

      // SSS contribution (simplified - uses a single key light direction)
      // WebGL computes SSS per-light in the loop, but for tubes we use a simplified approach
      // since MeshPhysicalNodeMaterial handles main lighting
      // TODO: For 100% parity, would need custom multi-light loop
      const keyLightDir = normalize(vec3(0.5, 1.0, 0.5)) // Match WebGL default
      const sssContrib = polytopeSSSNode(keyLightDir, V, N, screenCoordinate.xy)
      emissive.addAssign(select(sssIntensityU.greaterThan(0), sssContrib, vec3(0, 0, 0)))

      // Fresnel rim lighting (WebGL pattern from main.glsl.ts)
      // float NdotV = max(dot(N, V), 0.0);
      // float t = 1.0 - NdotV;
      // float rim = t * t * t * uFresnelIntensity * 2.0;
      // rim *= (0.3 + 0.7 * totalNdotL);
      const fresnelIntensityU = float(fresnelUniforms.uFresnelIntensity)
      const rimColor = vec3(fresnelUniforms.uRimColor)

      const NdotV = max(dot(N, V), float(0))
      const t = float(1).sub(NdotV)
      const tCubed = t.mul(t).mul(t)
      // Apply 2x multiplier as per WebGL
      const rim = tCubed.mul(fresnelIntensityU).mul(2)
      // Lighting modulation (approximate - WebGL uses totalNdotL from light loop)
      // Use NdotV as proxy since we don't have access to the light loop here
      const lightingMod = float(0.3).add(float(0.7).mul(NdotV))
      const fresnelContrib = rimColor.mul(rim).mul(lightingMod)
      emissive.addAssign(select(fresnelIntensityU.greaterThan(0), fresnelContrib, vec3(0, 0, 0)))

      return emissive
    })
  }, [sssUniforms, fresnelUniforms])

  // Create material with TSL position node
  // Using MeshPhysicalNodeMaterial for specular intensity/color support
  const material = useMemo(() => {
    // Get initial specular values for material constructor
    const edgePBRInit = usePBRStore.getState().edge
    const initSpecColorMat = new THREE.Color(edgePBRInit.specularColor).convertSRGBToLinear()

    // CRITICAL WebGPU FIX: Always create with transparent: true
    // In WebGPU, changing material.transparent triggers pipeline recreation which causes
    // "Invalid PipelineLayout" errors. By always using transparent: true, the pipeline
    // is created to support transparency from the start.
    const mat = new MeshPhysicalNodeMaterial({
      side: THREE.DoubleSide,
      transparent: true, // Always true for WebGPU pipeline stability
      depthWrite: opacity >= 1,
      // Set initial specular values via constructor
      specularIntensity: edgePBRInit.specularIntensity,
      specularColor: initSpecColorMat,
    })

    // Apply tube transformation as custom position node
    mat.positionNode = createTubePositionNode(ndUniforms)

    // Color and opacity nodes
    mat.colorNode = appearanceUniforms.uColor
    mat.opacityNode = appearanceUniforms.uOpacity

    // PBR properties via uniform nodes
    mat.roughnessNode = pbrUniforms.uRoughness
    mat.metalnessNode = pbrUniforms.uMetalness
    // Specular control (only available on MeshPhysicalNodeMaterial)
    mat.specularIntensityNode = pbrUniforms.uSpecularIntensity
    mat.specularColorNode = pbrUniforms.uSpecularColor

    // Add SSS + Fresnel rim as emissive contribution (WebGL parity)
    // This adds these effects on top of the built-in PBR lighting
    mat.emissiveNode = createTubeEmissiveNode()

    // CRITICAL: Set mrtNode for WebGPU MRT rendering
    // Materials rendered to MRT targets MUST output to all 3 color attachments
    // (output, normal, position) or WebGPU will throw pipeline layout errors.
    mat.mrtNode = createMeshMRTNode()

    return mat
  }, [ndUniforms, appearanceUniforms, pbrUniforms, opacity, createTubeEmissiveNode])

  // Set up mesh layer on mount
  const setMeshRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT)
      mesh.renderOrder = 1
    }
    meshRef.current = mesh
  }, [])

  // Cleanup geometry and material on unmount
  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
      } catch (e) {
        // TSL materials may have internal resources that are already disposed
        if (import.meta.env.DEV) {
          console.warn('[TubeWireframeTSL] Dispose warning:', e)
        }
      }
    }
  }, [geometry, material])

  // Update instance attributes when vertices/edges change
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !vertices || vertices.length === 0 || !edges || edges.length === 0) return

    const instanceCount = edges.length

    // Get or create pre-allocated arrays
    let arrays = instanceArraysRef.current
    if (!arrays || arrays.capacity < instanceCount) {
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

    const {
      start: instanceStart,
      end: instanceEnd,
      startExtraA: instanceStartExtraA,
      startExtraB: instanceStartExtraB,
      endExtraA: instanceEndExtraA,
      endExtraB: instanceEndExtraB,
    } = arrays

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
        instanceStartExtraA[baseIdx4 + 0] = v1[3] ?? 0 // W
        instanceStartExtraA[baseIdx4 + 1] = v1[4] ?? 0
        instanceStartExtraA[baseIdx4 + 2] = v1[5] ?? 0
        instanceStartExtraA[baseIdx4 + 3] = v1[6] ?? 0
        instanceStartExtraB[baseIdx4 + 0] = v1[7] ?? 0
        instanceStartExtraB[baseIdx4 + 1] = v1[8] ?? 0
        instanceStartExtraB[baseIdx4 + 2] = v1[9] ?? 0
        instanceStartExtraB[baseIdx4 + 3] = v1[10] ?? 0

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
        // Invalid edge - use degenerate tube
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

    // Check if attributes already exist and can be updated in-place
    const existingStart = geometry.getAttribute('instanceStart') as
      | THREE.InstancedBufferAttribute
      | undefined
    if (existingStart && existingStart.array.length >= instanceCount * 3) {
      existingStart.array.set(instanceStart.subarray(0, instanceCount * 3))
      existingStart.needsUpdate = true
      ;(geometry.getAttribute('instanceEnd') as THREE.InstancedBufferAttribute).array.set(
        instanceEnd.subarray(0, instanceCount * 3)
      )
      ;(geometry.getAttribute('instanceEnd') as THREE.InstancedBufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('instanceStartExtraA') as THREE.InstancedBufferAttribute).array.set(
        instanceStartExtraA.subarray(0, instanceCount * 4)
      )
      ;(geometry.getAttribute('instanceStartExtraA') as THREE.InstancedBufferAttribute).needsUpdate =
        true
      ;(geometry.getAttribute('instanceStartExtraB') as THREE.InstancedBufferAttribute).array.set(
        instanceStartExtraB.subarray(0, instanceCount * 4)
      )
      ;(geometry.getAttribute('instanceStartExtraB') as THREE.InstancedBufferAttribute).needsUpdate =
        true
      ;(geometry.getAttribute('instanceEndExtraA') as THREE.InstancedBufferAttribute).array.set(
        instanceEndExtraA.subarray(0, instanceCount * 4)
      )
      ;(geometry.getAttribute('instanceEndExtraA') as THREE.InstancedBufferAttribute).needsUpdate =
        true
      ;(geometry.getAttribute('instanceEndExtraB') as THREE.InstancedBufferAttribute).array.set(
        instanceEndExtraB.subarray(0, instanceCount * 4)
      )
      ;(geometry.getAttribute('instanceEndExtraB') as THREE.InstancedBufferAttribute).needsUpdate =
        true
    } else {
      // Create new attributes
      geometry.setAttribute(
        'instanceStart',
        new THREE.InstancedBufferAttribute(instanceStart.subarray(0, instanceCount * 3), 3)
      )
      geometry.setAttribute(
        'instanceEnd',
        new THREE.InstancedBufferAttribute(instanceEnd.subarray(0, instanceCount * 3), 3)
      )
      geometry.setAttribute(
        'instanceStartExtraA',
        new THREE.InstancedBufferAttribute(instanceStartExtraA.subarray(0, instanceCount * 4), 4)
      )
      geometry.setAttribute(
        'instanceStartExtraB',
        new THREE.InstancedBufferAttribute(instanceStartExtraB.subarray(0, instanceCount * 4), 4)
      )
      geometry.setAttribute(
        'instanceEndExtraA',
        new THREE.InstancedBufferAttribute(instanceEndExtraA.subarray(0, instanceCount * 4), 4)
      )
      geometry.setAttribute(
        'instanceEndExtraB',
        new THREE.InstancedBufferAttribute(instanceEndExtraB.subarray(0, instanceCount * 4), 4)
      )
    }

    mesh.count = instanceCount
  }, [vertices, edges, geometry])

  // Update uniforms every frame
  useFrame(() => {
    if (!material) return

    // Get state from stores
    const extendedObjectState = useExtendedObjectStore.getState()
    const pbrState = usePBRStore.getState()
    const polytopeVersion = extendedObjectState.polytopeVersion
    const pbrVersion = pbrState.pbrVersion

    const versionsChanged =
      polytopeVersion !== lastVersionRef.current.polytope ||
      pbrVersion !== lastVersionRef.current.pbr

    // Always update N-D transformation (rotation animates every frame)
    const projectionDistance = projDistCache.getProjectionDistance(vertices, dimension, [])
    ndTransform.update({ projectionDistance })
    const gpuData = ndTransform.source.getGPUData()
    const polytopeConfig = extendedObjectState.polytope
    const visualScale = polytopeConfig.scale

    updateTubeNDTransformUniforms(
      ndUniforms,
      gpuData,
      dimension,
      visualScale,
      projectionDistance,
      radius
    )

    if (versionsChanged) {
      // Update color
      const colorObj = new THREE.Color(color).convertSRGBToLinear()
      colorRef.current.set(colorObj.r, colorObj.g, colorObj.b)

      // Update opacity
      opacityRef.current = opacity
      ;(appearanceUniforms.uOpacity as { value: number }).value = opacity

      // Update material depthWrite based on opacity
      // NOTE: We do NOT change material.transparent or call needsUpdate here.
      // In WebGPU, changing transparent or calling needsUpdate triggers pipeline recreation
      // which causes "Invalid PipelineLayout" errors. Material is always transparent=true.
      const isOpaque = opacity >= 1
      if (material.depthWrite !== isOpaque) {
        material.depthWrite = isOpaque
        // Do NOT call needsUpdate - WebGPU pipelines are fixed at creation time
      }

      // Update PBR from edge store
      const edgePBR = pbrState.edge

      // Update uniform node values - this is ALL that's needed for TSL
      // DO NOT set direct material properties or needsUpdate - that triggers shader recompilation!
      ;(pbrUniforms.uRoughness as { value: number }).value = edgePBR.roughness
      ;(pbrUniforms.uMetalness as { value: number }).value = edgePBR.metallic
      ;(pbrUniforms.uSpecularIntensity as { value: number }).value = edgePBR.specularIntensity

      // Update specular color uniform value directly (not the ref!)
      const specColor = new THREE.Color(edgePBR.specularColor).convertSRGBToLinear()
      const specColorValue = (pbrUniforms.uSpecularColor as unknown as { value: THREE.Vector3 }).value
      specColorValue.set(specColor.r, specColor.g, specColor.b)

      lastVersionRef.current = {
        polytope: polytopeVersion,
        pbr: pbrVersion,
      }
    }

    // Update SSS and Fresnel uniforms from appearance store (WebGL parity)
    const appearanceState = appearanceStoreRef.current.getState()
    const appearanceVersion = appearanceState.appearanceVersion
    if (appearanceVersion !== lastAppearanceVersionRef.current) {
      // SSS uniforms (WebGL: uSssEnabled, uSssIntensity, uSssColor, uSssThickness)
      // Use intensity to control enabled state (0 = disabled)
      ;(sssUniforms.uSssIntensity as { value: number }).value = appearanceState.sssEnabled
        ? appearanceState.sssIntensity
        : 0
      const sssColorObj = new THREE.Color(appearanceState.sssColor).convertSRGBToLinear()
      ;(sssUniforms.uSssColor.value as THREE.Color).copy(sssColorObj)
      ;(sssUniforms.uSssThickness as { value: number }).value = appearanceState.sssThickness

      // Fresnel uniforms (WebGL: uFresnelEnabled, uFresnelIntensity, uRimColor)
      // Use intensity to control enabled state (0 = disabled)
      const fresnelOn = appearanceState.shaderSettings.surface.fresnelEnabled
      ;(fresnelUniforms.uFresnelIntensity as { value: number }).value = fresnelOn
        ? appearanceState.fresnelIntensity
        : 0
      // Use edge color for rim (matches WebGL tubes)
      const rimColorObj = new THREE.Color(appearanceState.edgeColor).convertSRGBToLinear()
      ;(fresnelUniforms.uRimColor.value as THREE.Color).copy(rimColorObj)

      lastAppearanceVersionRef.current = appearanceVersion
    }
  })

  // Don't render if no valid data
  if (!vertices || vertices.length === 0 || !edges || edges.length === 0) {
    return null
  }

  return (
    <instancedMesh
      ref={setMeshRef}
      args={[geometry, material as unknown as THREE.Material, edges.length]}
      frustumCulled={false}
      castShadow={shadowEnabled}
      receiveShadow={shadowEnabled}
    />
  )
}
