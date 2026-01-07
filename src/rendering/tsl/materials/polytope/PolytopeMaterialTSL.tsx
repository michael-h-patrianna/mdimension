/**
 * PolytopeMaterialTSL - TSL Node Material for N-dimensional polytope rendering
 *
 * WebGPU-compatible material using Three.js TSL (Three Shading Language).
 * Uses MeshStandardNodeMaterial for PBR lighting with custom position nodes
 * for N-dimensional vertex transformation.
 *
 * Core features:
 * - Full N-D vertex transformation via TSL positionNode
 * - 4D rotation matrix + extra dimension contributions (5D-11D)
 * - Perspective projection for N-D depth
 * - PBR lighting via MeshStandardNodeMaterial
 * - Dynamic color/opacity updates from appearance store
 * - Roughness/metalness control
 *
 * Architecture:
 * - Custom vertex transformation via positionNode
 * - Reads packed extra dimension attributes (aExtraDims0_3, aExtraDims4_6)
 * - Runtime uniform updates for rotation/projection animation
 *
 * @module rendering/tsl/materials/polytope/PolytopeMaterialTSL
 */

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useNDTransformUpdates } from '@/rendering/renderers/base/useNDTransformUpdates'
import {
  createNDTransformNode,
  createNDTransformUniforms,
  updateNDTransformUniforms,
  type NDTransformUniforms,
} from '@/rendering/tsl/transforms/ndTransformTSL'
import { createMeshMRTNode } from '@/rendering/tsl/mrt/mesh'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { uniform } from 'three/tsl'

/**
 * Props for the Polytope TSL material hook.
 */
export interface PolytopeMaterialTSLProps {
  /** Current dimension of the polytope */
  dimension: number
  /** Opacity (0-1) */
  opacity?: number
  /** Projection distance for N-D perspective */
  projectionDistance?: number
}

/**
 * TSL-based Polytope Face Material for WebGPU.
 * Uses MeshStandardNodeMaterial with custom position node for N-D transformation.
 *
 * The positionNode applies the full N-D transformation pipeline:
 * 1. Read base position (x, y, z) and packed extra dims (4D-11D)
 * 2. Apply 4D rotation matrix to first 4 dimensions
 * 3. Add contributions from dimensions 5-11
 * 4. Compute N-D perspective projection
 * 5. Apply uniform scale (like camera zoom)
 */
export function usePolytopeFaceMaterialTSL({
  dimension,
  opacity = 1.0,
  projectionDistance = 2.0,
}: PolytopeMaterialTSLProps) {
  const materialRef = useRef<InstanceType<typeof MeshStandardNodeMaterial> | null>(null)

  // N-D transform hook - handles rotation matrix computation with version tracking
  const ndTransform = useNDTransformUpdates({ projectionDistance })

  // Version tracking for dirty-flag optimization
  const lastVersionRef = useRef({ polytope: -1, appearance: -1 })

  // Create N-D transformation uniforms for TSL
  const ndUniforms = useMemo<NDTransformUniforms>(
    () => createNDTransformUniforms(),
    []
  )

  // Create color/appearance uniforms using THREE.js objects for value storage
  const colorRef = useRef(new THREE.Vector3(1, 1, 1))
  const opacityRef = useRef(opacity)

  // Create TSL uniform nodes that reference our mutable values
  const appearanceUniforms = useMemo(
    () => ({
      uColor: uniform(colorRef.current),
      uOpacity: uniform(opacityRef.current),
    }),
    []
  )

  // Create the material with N-D transformation positionNode
  // CRITICAL WebGPU FIX: Always create with transparent: true
  // In WebGPU, changing material.transparent triggers pipeline recreation which causes
  // "Invalid PipelineLayout" errors.
  const material = useMemo(() => {
    const mat = new MeshStandardNodeMaterial({
      side: THREE.DoubleSide,
      transparent: true, // Always true for WebGPU pipeline stability
      depthWrite: opacity >= 1,
    })

    // Set initial PBR properties
    mat.roughness = 0.3
    mat.metalness = 0

    // Apply N-D transformation as custom position node
    // This transforms vertices from N-D space to 3D in the vertex shader
    mat.positionNode = createNDTransformNode(ndUniforms)

    // Color node
    mat.colorNode = appearanceUniforms.uColor

    // Opacity node
    mat.opacityNode = appearanceUniforms.uOpacity

    // CRITICAL: Set mrtNode for WebGPU MRT rendering
    // Materials rendered to MRT targets MUST output to all 3 color attachments
    // (output, normal, position) or WebGPU will throw pipeline layout errors.
    mat.mrtNode = createMeshMRTNode()

    return mat
  }, [ndUniforms, appearanceUniforms, opacity])

  // Store material ref
  useEffect(() => {
    materialRef.current = material
  }, [material])

  // Update uniforms every frame
  useFrame(() => {
    if (!material) return

    // Get state from stores
    const extendedObjectState = useExtendedObjectStore.getState()
    const appearanceState = useAppearanceStore.getState()
    const polytopeVersion = extendedObjectState.polytopeVersion
    const appearanceVersion = appearanceState.appearanceVersion

    const versionsChanged =
      polytopeVersion !== lastVersionRef.current.polytope ||
      appearanceVersion !== lastVersionRef.current.appearance

    // Always update N-D transformation (rotation animates every frame)
    ndTransform.update({ projectionDistance })
    const gpuData = ndTransform.source.getGPUData()
    const polytopeConfig = extendedObjectState.polytope
    const visualScale = polytopeConfig.scale

    updateNDTransformUniforms(
      ndUniforms,
      gpuData,
      dimension,
      visualScale,
      projectionDistance
    )

    if (versionsChanged) {
      // Update appearance uniforms
      const faceOpacity = appearanceState.shaderSettings.surface.faceOpacity
      opacityRef.current = faceOpacity
      ;(appearanceUniforms.uOpacity as { value: number }).value = faceOpacity

      // Update material depthWrite based on opacity
      // NOTE: We do NOT change material.transparent or call needsUpdate here.
      // In WebGPU, changing transparent or calling needsUpdate triggers pipeline recreation
      // which causes "Invalid PipelineLayout" errors. Material is always transparent=true.
      const isOpaque = faceOpacity >= 1
      if (material.depthWrite !== isOpaque) {
        material.depthWrite = isOpaque
        // Do NOT call needsUpdate - WebGPU pipelines are fixed at creation time
      }

      // Update color
      const faceColorObj = new THREE.Color(
        appearanceState.faceColor
      ).convertSRGBToLinear()
      colorRef.current.set(faceColorObj.r, faceColorObj.g, faceColorObj.b)

      // Update PBR properties
      const surfaceSettings = appearanceState.shaderSettings.surface
      material.roughness = surfaceSettings.fresnelEnabled ? 0.2 : 0.3
      material.metalness = 0

      lastVersionRef.current = {
        polytope: polytopeVersion,
        appearance: appearanceVersion,
      }
    }
  })

  return { material, ndUniforms }
}

/**
 * TSL-based Polytope Edge Material for WebGPU.
 * Uses MeshStandardNodeMaterial with custom position node for N-D transformation.
 * Less reflective than face material for visual distinction.
 */
export function usePolytopeEdgeMaterialTSL({
  dimension,
  opacity = 1.0,
  projectionDistance = 2.0,
  color,
}: PolytopeMaterialTSLProps & { color: string }) {
  const materialRef = useRef<InstanceType<typeof MeshStandardNodeMaterial> | null>(null)

  // N-D transform hook - handles rotation matrix computation with version tracking
  const ndTransform = useNDTransformUpdates({ projectionDistance })

  // Create N-D transformation uniforms for TSL
  const ndUniforms = useMemo<NDTransformUniforms>(
    () => createNDTransformUniforms(),
    []
  )

  // Create TSL uniform nodes
  const appearanceUniforms = useMemo(() => {
    const colorObj = new THREE.Color(color).convertSRGBToLinear()
    const colorVec = new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b)
    return {
      uColor: uniform(colorVec),
      uOpacity: uniform(opacity),
    }
  }, [color, opacity])

  // Create the material
  // CRITICAL WebGPU FIX: Always create with transparent: true
  // In WebGPU, changing material.transparent triggers pipeline recreation which causes
  // "Invalid PipelineLayout" errors. By always using transparent: true, the pipeline
  // is created to support transparency from the start. Opacity is controlled via uniform.
  const material = useMemo(() => {
    const mat = new MeshStandardNodeMaterial({
      side: THREE.DoubleSide,
      transparent: true, // Always true for WebGPU pipeline stability
      depthWrite: opacity >= 1,
    })

    // Edge material is less reflective
    mat.roughness = 0.8
    mat.metalness = 0

    // Apply N-D transformation as custom position node
    mat.positionNode = createNDTransformNode(ndUniforms)

    mat.colorNode = appearanceUniforms.uColor
    mat.opacityNode = appearanceUniforms.uOpacity

    // CRITICAL: Set mrtNode for WebGPU MRT rendering
    // Materials rendered to MRT targets MUST output to all 3 color attachments
    mat.mrtNode = createMeshMRTNode()

    return mat
  }, [ndUniforms, appearanceUniforms, opacity])

  // Store material ref
  useEffect(() => {
    materialRef.current = material
  }, [material])

  // Update N-D transformation uniforms every frame
  useFrame(() => {
    if (!material) return

    const extendedObjectState = useExtendedObjectStore.getState()

    // Update N-D transformation
    ndTransform.update({ projectionDistance })
    const gpuData = ndTransform.source.getGPUData()
    const polytopeConfig = extendedObjectState.polytope
    const visualScale = polytopeConfig.scale

    updateNDTransformUniforms(
      ndUniforms,
      gpuData,
      dimension,
      visualScale,
      projectionDistance
    )
  })

  return { material, ndUniforms }
}

/**
 * Wrapper component that creates a mesh with TSL face material.
 * Handles geometry assignment and layer configuration.
 */
export function PolytopeFaceMeshTSL({
  dimension,
  geometry,
  opacity = 1.0,
  projectionDistance,
  castShadow = false,
  receiveShadow = false,
}: PolytopeMaterialTSLProps & {
  geometry: THREE.BufferGeometry
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { material } = usePolytopeFaceMaterialTSL({
    dimension,
    opacity,
    projectionDistance,
  })

  const setMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT)
      mesh.renderOrder = 0
    }
    meshRef.current = mesh
  }, [])

  if (!geometry || !material) return null

  return (
    <mesh
      ref={setMeshRef}
      geometry={geometry}
      material={material as unknown as THREE.Material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

/**
 * Wrapper component that creates edge mesh with TSL material.
 */
export function PolytopeEdgeMeshTSL({
  dimension,
  geometry,
  color,
  opacity = 1.0,
  projectionDistance,
}: PolytopeMaterialTSLProps & {
  geometry: THREE.BufferGeometry
  color: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { material } = usePolytopeEdgeMaterialTSL({
    dimension,
    opacity,
    projectionDistance,
    color,
  })

  const setMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT)
      mesh.renderOrder = 1
    }
    meshRef.current = mesh
  }, [])

  if (!geometry || !material) return null

  return (
    <mesh
      ref={setMeshRef}
      geometry={geometry}
      material={material as unknown as THREE.Material}
    />
  )
}

// =============================================================================
// Legacy exports for backwards compatibility
// =============================================================================

export { usePolytopeFaceMaterialTSL as usePolytopeMaterialTSL }
export { PolytopeFaceMeshTSL as PolytopeMeshTSL }
