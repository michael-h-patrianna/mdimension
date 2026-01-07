/**
 * TSL Polytope Scene Component - WebGPU Compatible
 *
 * GPU-accelerated renderer using TSL (Three Shading Language) for WebGPU.
 * 100% feature parity with WebGL PolytopeScene.tsx.
 *
 * Architecture:
 * - Uses MeshBasicNodeMaterial with full custom shading (avoids double-lighting)
 * - Screen-space normals computed via dFdx/dFdy in fragment shader
 * - Face depth (t value) computed from extra dimension sum for color algorithms
 * - All 11 color algorithms supported
 * - Multi-light system with shadows, IBL, SSS, Fresnel
 * - MRT output for post-processing (SSR, SSAO, DOF)
 *
 * Shader Composition:
 * - Features are conditionally compiled based on enabled state
 * - Disabled features are completely absent from shader graph (not just branched)
 * - Material recreates when feature flags change (mirrors WebGL pattern)
 * - Compilation overlay shown during shader rebuild
 *
 * @module rendering/renderers/Polytope/PolytopeSceneTSL
 */

import type { Face } from '@/lib/geometry/faces'
import type { VectorND } from '@/lib/math/types'
import { RENDER_LAYERS } from '@/rendering/core/layers'
import { useTrackedTSLMaterial } from '@/rendering/materials/useTrackedTSLMaterial'
import { useNDTransformUpdates, useProjectionDistanceCache } from '@/rendering/renderers/base'
import { COLOR_ALGORITHM_TO_INT } from '@/rendering/shaders/palette'
import { blurToPCFSamples, collectShadowDataCached, SHADOW_MAP_SIZES } from '@/rendering/shadows/uniforms'
import { createColorTSLUniforms, updateColorTSLUniforms, type ColorTSLUniforms } from '@/rendering/tsl/color/color-uniforms'
import {
    composePolytopeTSLShading,
    getPolytopeTSLShaderName,
    type PolytopeTSLConfig,
    type PolytopeShadingUniforms,
} from '@/rendering/tsl/compose/polytope/polytope-compose'
import { createMeshSSSUniforms, type MeshSSSUniforms } from '@/rendering/tsl/features/mesh-sss'
import { createIBLTSLUniforms, type IBLTSLUniforms } from '@/rendering/tsl/lighting/ibl'
import { createFresnelTSLUniforms, createLightTSLUniforms, createPBRTSLUniforms, updateLightTSLUniforms, type FresnelTSLUniforms, type LightTSLUniforms, type PBRTSLUniforms } from '@/rendering/tsl/lighting/light-uniforms'
import { TubeWireframeTSL } from '@/rendering/tsl/materials/tubewireframe/TubeWireframeTSL'
import { createShadowTSLUniforms, releasePlaceholder2D, releasePlaceholderRGBA, updateShadowTSLUniforms, type ShadowTSLUniforms } from '@/rendering/tsl/shadows'
import {
    createNDTransformNode,
    createNDTransformUniforms,
    updateNDTransformUniforms,
    type NDTransformUniforms,
} from '@/rendering/tsl/transforms/ndTransformTSL'
import { useAppearanceStore } from '@/stores/appearanceStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePBRStore } from '@/stores/pbrStore'
import { useFrame } from '@react-three/fiber'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { attribute, float, uniform, vec3 } from 'three/tsl'
import { LineBasicNodeMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { useShallow } from 'zustand/react/shallow'

/**
 * Props for PolytopeSceneTSL component
 */
export interface PolytopeSceneTSLProps {
  /** Base (untransformed) vertices in N dimensions */
  baseVertices: VectorND[]
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][]
  /** Detected faces for surface rendering */
  faces?: Face[]
  /** Current dimension of the polytope */
  dimension: number
  /** Per-face depth values for palette coloring */
  faceDepths?: number[]
  /** Overall opacity (default: 1.0) */
  opacity?: number
}

/**
 * Build BufferGeometry with N-D attributes and face depth from face vertices.
 * Uses packed attributes (vec4 + vec3) for extra dimensions.
 * Computes aFaceDepth from extra dimension sum for color algorithms.
 * Does NOT compute vertex normals - uses screen-space normals in fragment shader.
 */
function buildFaceGeometry(
  faces: Face[],
  baseVertices: VectorND[]
): THREE.BufferGeometry | null {
  if (faces.length === 0 || baseVertices.length === 0) return null

  // Count triangles for buffer sizing
  let triangleCount = 0
  for (const face of faces) {
    if (face.vertices.length === 3) triangleCount += 1
    else if (face.vertices.length === 4) triangleCount += 2
  }
  if (triangleCount === 0) return null

  const geo = new THREE.BufferGeometry()
  const vertexCount = triangleCount * 3

  const positions = new Float32Array(vertexCount * 3)
  const extraDims0_3 = new Float32Array(vertexCount * 4)
  const extraDims4_6 = new Float32Array(vertexCount * 3)
  const faceDepths = new Float32Array(vertexCount) // t value for color algorithms

  const writeVertex = (outIdx: number, vertIdx: number) => {
    const v = baseVertices[vertIdx]
    if (!v) return

    const i3 = outIdx * 3
    const i4 = outIdx * 4

    // Position (vec3)
    positions[i3] = v[0] ?? 0
    positions[i3 + 1] = v[1] ?? 0
    positions[i3 + 2] = v[2] ?? 0

    // Extra dims packed: vec4(dims 4-7) + vec3(dims 8-10)
    const d4 = v[3] ?? 0
    const d5 = v[4] ?? 0
    const d6 = v[5] ?? 0
    const d7 = v[6] ?? 0
    const d8 = v[7] ?? 0
    const d9 = v[8] ?? 0
    const d10 = v[9] ?? 0

    extraDims0_3[i4] = d4
    extraDims0_3[i4 + 1] = d5
    extraDims0_3[i4 + 2] = d6
    extraDims0_3[i4 + 3] = d7
    extraDims4_6[i3] = d8
    extraDims4_6[i3 + 1] = d9
    extraDims4_6[i3 + 2] = d10

    // Compute face depth (t value) from extra dimension sum
    // Matches WebGL: vFaceDepth = clamp(extraSum * 0.15 + 0.5, 0.0, 1.0)
    const extraSum = d4 + d5 + d6 + d7 + d8 + d9 + d10
    faceDepths[outIdx] = Math.max(0, Math.min(1, extraSum * 0.15 + 0.5))
  }

  let outIdx = 0
  for (const face of faces) {
    const vis = face.vertices
    if (vis.every((idx) => idx >= 0 && idx < baseVertices.length)) {
      if (vis.length === 3) {
        writeVertex(outIdx++, vis[0]!)
        writeVertex(outIdx++, vis[1]!)
        writeVertex(outIdx++, vis[2]!)
      } else if (vis.length === 4) {
        // Quad: split into 2 triangles
        writeVertex(outIdx++, vis[0]!)
        writeVertex(outIdx++, vis[1]!)
        writeVertex(outIdx++, vis[2]!)
        writeVertex(outIdx++, vis[0]!)
        writeVertex(outIdx++, vis[2]!)
        writeVertex(outIdx++, vis[3]!)
      }
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('aExtraDims0_3', new THREE.Float32BufferAttribute(extraDims0_3, 4))
  geo.setAttribute('aExtraDims4_6', new THREE.Float32BufferAttribute(extraDims4_6, 3))
  geo.setAttribute('aFaceDepth', new THREE.Float32BufferAttribute(faceDepths, 1))

  // Compute vertex normals for MRT output (required for normalView built-in)
  // NOTE: For N-D polytopes, these are approximations since faces may be non-planar after projection.
  // Screen-space normals would be more accurate but cause shader compilation issues with MRT.
  geo.computeVertexNormals()

  return geo
}

/**
 * Build BufferGeometry for edges with N-D attributes.
 */
function buildEdgeGeometry(
  edges: [number, number][],
  baseVertices: VectorND[]
): THREE.BufferGeometry | null {
  if (edges.length === 0 || baseVertices.length === 0) return null

  const geo = new THREE.BufferGeometry()
  const vertexCount = edges.length * 2

  const positions = new Float32Array(vertexCount * 3)
  const extraDims0_3 = new Float32Array(vertexCount * 4)
  const extraDims4_6 = new Float32Array(vertexCount * 3)

  let outIdx = 0
  for (const [a, b] of edges) {
    const vA = baseVertices[a]
    const vB = baseVertices[b]
    if (!vA || !vB) continue

    for (const v of [vA, vB]) {
      const i3 = outIdx * 3
      const i4 = outIdx * 4

      positions[i3] = v[0] ?? 0
      positions[i3 + 1] = v[1] ?? 0
      positions[i3 + 2] = v[2] ?? 0

      extraDims0_3[i4] = v[3] ?? 0
      extraDims0_3[i4 + 1] = v[4] ?? 0
      extraDims0_3[i4 + 2] = v[5] ?? 0
      extraDims0_3[i4 + 3] = v[6] ?? 0
      extraDims4_6[i3] = v[7] ?? 0
      extraDims4_6[i3 + 1] = v[8] ?? 0
      extraDims4_6[i3 + 2] = v[9] ?? 0

      outIdx++
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('aExtraDims0_3', new THREE.Float32BufferAttribute(extraDims0_3, 4))
  geo.setAttribute('aExtraDims4_6', new THREE.Float32BufferAttribute(extraDims4_6, 3))

  return geo
}

// ============================================================================
// All Uniforms Interface
// ============================================================================

/**
 * All uniforms for polytope rendering.
 *
 * CRITICAL: This component uses key-based remounting when features change.
 * When shadowEnabled/iblEnabled toggle, the entire Inner component remounts,
 * creating fresh uniforms including fresh TSL texture nodes.
 * This avoids "Invalid PipelineLayout" WebGPU errors.
 */
interface PolytopeTSLUniforms {
  // N-D Transform
  ndTransform: NDTransformUniforms

  // Core appearance
  uColor: ReturnType<typeof uniform>
  uOpacity: ReturnType<typeof uniform>

  // PBR
  uRoughness: ReturnType<typeof uniform>
  uMetallic: ReturnType<typeof uniform>
  uSpecularIntensity: ReturnType<typeof uniform>
  uSpecularColor: ReturnType<typeof uniform>

  // Color system
  color: ColorTSLUniforms

  // Lighting
  lighting: LightTSLUniforms
  pbr: PBRTSLUniforms

  // Fresnel
  fresnel: FresnelTSLUniforms

  // SSS
  sss: MeshSSSUniforms

  // IBL (has texture nodes - fresh per remount)
  ibl: IBLTSLUniforms

  // Shadows (has texture nodes - fresh per remount)
  shadows: ShadowTSLUniforms
}

/**
 * Inner props including shader config
 */
interface PolytopeSceneTSLInnerProps extends PolytopeSceneTSLProps {
  shaderConfig: PolytopeTSLConfig
  shadowEnabled: boolean
  sssEnabled: boolean
  fresnelEnabled: boolean
  iblEnabled: boolean
}

/**
 * Inner component that does the actual rendering.
 * Receives shaderConfig as a prop - when features change, this component
 * is completely remounted via key prop, ensuring fresh uniforms.
 *
 * CRITICAL: TSL texture nodes cannot be reused across WebGPU pipeline compilations.
 * By using key-based remounting, all uniforms (including texture nodes) are created fresh.
 */
const PolytopeSceneTSLInner = React.memo(function PolytopeSceneTSLInner({
  baseVertices,
  edges,
  faces = [],
  dimension,
  faceDepths: _faceDepths = [],
  opacity = 1.0,
  shaderConfig,
  shadowEnabled,
  sssEnabled,
  fresnelEnabled,
  iblEnabled,
}: PolytopeSceneTSLInnerProps) {
  void _faceDepths // Reserved for future per-face coloring
  // Feature flags are now passed as props (used by shaderConfig)
  void sssEnabled
  void fresnelEnabled
  void iblEnabled

  // ============ STORE SUBSCRIPTIONS ============
  // Visual settings - only subscribe to what's needed for render logic
  const {
    edgesVisible,
    facesVisible,
    edgeColor,
    edgeThickness,
    tubeCaps,
  } = useAppearanceStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      edgeColor: state.edgeColor,
      edgeThickness: state.edgeThickness,
      tubeCaps: state.tubeCaps,
    }))
  )

  // shaderConfig is now a prop - no need to create it here

  // Use TubeWireframe for thick lines (>1), native lineSegments for thin lines (1)
  const useFatWireframe = edgeThickness > 1

  // ============ REFS ============
  const faceMeshRef = useRef<THREE.Mesh>(null)
  const edgeMeshRef = useRef<THREE.LineSegments>(null)

  // N-D transform hook
  const ndTransform = useNDTransformUpdates()
  const projDistCache = useProjectionDistanceCache()

  // Store refs for efficient updates
  const appearanceStoreRef = useRef(useAppearanceStore)
  const lightingStoreRef = useRef(useLightingStore)
  const environmentStoreRef = useRef(useEnvironmentStore)
  const pbrStoreRef = useRef(usePBRStore)
  const extendedObjectStoreRef = useRef(useExtendedObjectStore)

  // Version tracking for dirty-flag optimization
  const lastVersionRef = useRef({
    polytope: -1,
    appearance: -1,
    ibl: -1,
    lighting: -1,
    pbr: -1,
  })

  // ============ CREATE ALL UNIFORMS ============
  const uniforms = useMemo<PolytopeTSLUniforms>(() => {
    const facePBR = usePBRStore.getState().face
    const initSpecColor = new THREE.Color(facePBR.specularColor).convertSRGBToLinear()

    return {
      ndTransform: createNDTransformUniforms(),
      uColor: uniform(new THREE.Vector3(1, 1, 1)),
      uOpacity: uniform(opacity),
      uRoughness: uniform(facePBR.roughness),
      uMetallic: uniform(facePBR.metallic),
      uSpecularIntensity: uniform(facePBR.specularIntensity),
      uSpecularColor: uniform(new THREE.Vector3(initSpecColor.r, initSpecColor.g, initSpecColor.b)),
      color: createColorTSLUniforms(),
      lighting: createLightTSLUniforms(),
      pbr: createPBRTSLUniforms(),
      fresnel: createFresnelTSLUniforms(),
      sss: createMeshSSSUniforms(),
      // CRITICAL: shadows and ibl are created fresh here because this Inner component
      // remounts when features change (via key prop in wrapper). This ensures fresh
      // TSL texture nodes for each pipeline compilation.
      ibl: createIBLTSLUniforms(),
      shadows: (() => {
        console.log('[POLYTOPE-SCENE-DEBUG] Creating shadow uniforms...')
        const shadowUniforms = createShadowTSLUniforms()
        console.log('[POLYTOPE-SCENE-DEBUG] Shadow uniforms created:', {
          uShadowMap0: {
            constructor: shadowUniforms.uShadowMap0?.constructor?.name,
            nodeType: (shadowUniforms.uShadowMap0 as unknown as { nodeType?: string })?.nodeType,
          },
          uShadowMatrix0: {
            constructor: shadowUniforms.uShadowMatrix0?.constructor?.name,
            nodeType: (shadowUniforms.uShadowMatrix0 as unknown as { nodeType?: string })?.nodeType,
          },
          uLightCastsShadow: {
            constructor: shadowUniforms.uLightCastsShadow?.constructor?.name,
            nodeType: (shadowUniforms.uLightCastsShadow as unknown as { nodeType?: string })?.nodeType,
          },
        })
        return shadowUniforms
      })(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: uniforms created once, updated via .value
  }, [])

  // Edge uniforms (simpler)
  const edgeUniforms = useMemo(() => {
    const c = new THREE.Color(edgeColor).convertSRGBToLinear()
    return {
      ndTransform: createNDTransformUniforms(),
      uColor: uniform(new THREE.Vector3(c.r, c.g, c.b)),
      uOpacity: uniform(opacity),
    }
  }, [])

  // ============ CREATE SHADING NODE ============
  /**
   * Face depth varying for color algorithms.
   * MUST be created OUTSIDE Fn() per Three.js TSL pattern (see webgpu_centroid_sampling example).
   * setInterpolation() is called INSIDE the compose function.
   */
  const faceDepthVarying = useMemo(
    // Use .toVarying() method (r173+) instead of deprecated varying() function
    () => attribute('aFaceDepth', 'float').toVarying('vFaceDepth'),
    []
  )

  // ============ CREATE FACE MATERIAL WITH SHADER COMPOSITION ============
  /**
   * Face material with tracked compilation and conditional shader composition.
   *
   * Key pattern (mirrors WebGL):
   * - Material recreates when shaderConfig changes (feature flags)
   * - Only enabled features are included in shader graph
   * - Compilation overlay shown during shader build
   * - Disabled features are completely absent (not just branched)
   */
  const shaderName = getPolytopeTSLShaderName(shaderConfig)

  // TSL material with tracked compilation and conditional shader composition
  const { material: faceMaterial, isCompiling } = useTrackedTSLMaterial<InstanceType<typeof MeshBasicNodeMaterial>>(
    shaderName,
    () => {
      // CRITICAL WebGPU FIX: Use MeshBasicNodeMaterial for direct color output
      // MeshStandardNodeMaterial requires PBR lighting setup which may not be available
      // in all render passes. MeshBasicNodeMaterial outputs color directly without lighting.
      //
      // IMPORTANT: In WebGPU, transparent materials may not render correctly in all passes.
      // Setting transparent: false ensures the mesh renders in both scene and MRT passes.
      // Opacity control via opacityNode still works for actual transparency effects.
      const mat = new MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
        transparent: false, // Must be false for reliable WebGPU rendering
        depthWrite: true,
      })

      // DEBUG: Log material creation with features
      if (import.meta.env.DEV) {
        console.log('[PolytopeSceneTSL] Creating material with features:', shaderConfig)
        console.time('[PolytopeSceneTSL] Material creation time')
      }

      // CRITICAL: Set positionNode for N-D to 3D vertex transformation
      // Without this, vertices stay at untransformed positions and nothing renders
      mat.positionNode = createNDTransformNode(uniforms.ndTransform)

      // Compose full polytope shading with all enabled features
      // This includes color algorithms, multi-light shading, ambient, and optional features
      try {
        console.log('[POLYTOPE-SCENE-DEBUG] ========== MATERIAL CREATION START ==========')
        console.log('[POLYTOPE-SCENE-DEBUG] shaderConfig:', JSON.stringify(shaderConfig))
        console.log('[POLYTOPE-SCENE-DEBUG] Building shading uniforms...')
        const shadingUniforms: PolytopeShadingUniforms = {
          uColor: uniforms.uColor,
          uOpacity: uniforms.uOpacity,
          uRoughness: uniforms.uRoughness,
          uMetallic: uniforms.uMetallic,
          uSpecularIntensity: uniforms.uSpecularIntensity,
          uSpecularColor: uniforms.uSpecularColor,
          color: uniforms.color,
          lighting: uniforms.lighting,
          fresnel: shaderConfig.fresnel ? uniforms.fresnel : undefined,
          sss: shaderConfig.sss ? uniforms.sss : undefined,
          ibl: shaderConfig.ibl ? uniforms.ibl : undefined,
          shadows: shaderConfig.shadows ? uniforms.shadows : undefined,
        }
        console.log('[POLYTOPE-SCENE-DEBUG] shadingUniforms.shadows:', {
          hasShadows: !!shadingUniforms.shadows,
          uShadowMap0Type: shadingUniforms.shadows?.uShadowMap0?.constructor?.name,
        })
        console.log('[POLYTOPE-SCENE-DEBUG] Calling composePolytopeTSLShading...')
        const shadingNode = composePolytopeTSLShading(shaderConfig, shadingUniforms, faceDepthVarying)
        console.log('[POLYTOPE-SCENE-DEBUG] shadingNode returned:', { type: shadingNode?.constructor?.name })
        console.log('[POLYTOPE-SCENE-DEBUG] Calling shadingNode()...')
        const colorNodeResult = shadingNode()
        console.log('[POLYTOPE-SCENE-DEBUG] colorNodeResult:', { type: colorNodeResult?.constructor?.name })
        mat.colorNode = colorNodeResult
        console.log('[POLYTOPE-SCENE-DEBUG] colorNode assigned to material')
      } catch (error) {
        console.error('[PolytopeSceneTSL] ERROR during shading composition:', error)
        throw error // Re-throw so the hook's error handler also catches it
      }

      // Set opacity from uniform
      mat.opacityNode = uniforms.uOpacity

      // NOTE: Do NOT set mrtNode here! Materials with mrtNode fail to render in non-MRT passes.
      // The MainObjectMRTPassTSL sets a default MRT on the renderer for all materials.

      if (import.meta.env.DEV) {
        console.timeEnd('[PolytopeSceneTSL] Material creation time')
        console.log('[PolytopeSceneTSL] Material created successfully')
      }

      return mat
    },
    // Dependencies: material recreates when these change
    // CRITICAL: Only include JSON-serializable values in deps array!
    // uniforms and faceDepthVarying are TSL nodes with circular references that cause
    // JSON.stringify to fail, triggering `unstringifiable-${Date.now()}` fallback
    // which creates a unique key every render, causing infinite material recreation!
    // These objects are stable (memoized with []) and captured in the factory closure.
    [shaderConfig, opacity]
  )

  // ============ CREATE EDGE MATERIAL ============
  // NOTE: LineBasicNodeMaterial does NOT support mrtNode - line materials can't output
  // to multiple render targets. The edge LineSegments are placed on ENVIRONMENT layer
  // (see setEdgeMeshRef) to avoid being rendered by MainObjectMRTPassTSL.
  const edgeMaterial = useMemo(() => {
    const mat = new LineBasicNodeMaterial({
      transparent: opacity < 1,
      depthWrite: opacity >= 1,
    })

    mat.positionNode = createNDTransformNode(edgeUniforms.ndTransform)
    mat.colorNode = edgeUniforms.uColor
    mat.opacityNode = edgeUniforms.uOpacity

    return mat
  }, [edgeUniforms, opacity])

  // ============ BUILD GEOMETRIES ============
  const faceGeometry = useMemo(() => {
    const geo = buildFaceGeometry(faces, baseVertices)
    if (import.meta.env.DEV && geo) {
      console.log('[PolytopeSceneTSL] Built face geometry:', {
        faceCount: faces.length,
        vertexCount: geo.getAttribute('position')?.count ?? 0,
        hasFaceDepth: !!geo.getAttribute('aFaceDepth'),
      })
    }
    return geo
  }, [faces, baseVertices])

  const edgeGeometry = useMemo(() => {
    return buildEdgeGeometry(edges, baseVertices)
  }, [edges, baseVertices])

  // ============ CALLBACK REFS ============
  const setFaceMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    faceMeshRef.current = mesh
    if (mesh) {
      mesh.layers.set(RENDER_LAYERS.MAIN_OBJECT)
    }
  }, [])

  const setEdgeMeshRef = useCallback((lineSegments: THREE.LineSegments | null) => {
    edgeMeshRef.current = lineSegments
    if (lineSegments) {
      // CRITICAL: Use ENVIRONMENT layer, NOT MAIN_OBJECT.
      // LineBasicNodeMaterial does NOT support MRT (can't output to multiple render targets).
      // MAIN_OBJECT layer is rendered by MainObjectMRTPassTSL to a 3-attachment MRT target,
      // which would cause "Invalid ShaderModule" errors for line materials.
      // ENVIRONMENT layer is rendered by ScenePassTSL to a single target - works fine.
      lineSegments.layers.set(RENDER_LAYERS.ENVIRONMENT)
    }
  }, [])

  // ============ CLEANUP ============
  useEffect(() => {
    return () => {
      try {
        // Note: faceMaterial is managed by useTrackedTSLMaterial (handles its own disposal)
        edgeMaterial.dispose()
        faceGeometry?.dispose()
        edgeGeometry?.dispose()
        // Release shadow placeholder texture references
        // These are reference-counted, so only disposed when no materials use them
        releasePlaceholder2D()
        releasePlaceholderRGBA()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[PolytopeSceneTSL] Dispose warning:', e)
        }
      }
    }
  }, [edgeMaterial, faceGeometry, edgeGeometry])

  // ============ USEFRAME: UPDATE UNIFORMS ============
  useFrame(({ scene }) => {
    const extendedObjectState = extendedObjectStoreRef.current.getState()
    const appearanceState = appearanceStoreRef.current.getState()
    const lightingState = lightingStoreRef.current.getState()
    const environmentState = environmentStoreRef.current.getState()
    const pbrState = pbrStoreRef.current.getState()

    // Version tracking
    const polytopeVersion = extendedObjectState.polytopeVersion
    const appearanceVersion = appearanceState.appearanceVersion
    const iblVersion = environmentState.iblVersion
    const lightingVersion = lightingState.version
    const pbrVersion = pbrState.pbrVersion

    const polytopeChanged = polytopeVersion !== lastVersionRef.current.polytope
    const appearanceChanged = appearanceVersion !== lastVersionRef.current.appearance
    const iblChanged = iblVersion !== lastVersionRef.current.ibl
    const lightingChanged = lightingVersion !== lastVersionRef.current.lighting
    const pbrChanged = pbrVersion !== lastVersionRef.current.pbr

    // Get projection distance
    const projectionDistance = projDistCache.getProjectionDistance(baseVertices, dimension, [])

    // Always update N-D transformation (rotation animates every frame)
    ndTransform.update({ projectionDistance })
    const gpuData = ndTransform.source.getGPUData()
    const polytopeConfig = extendedObjectState.polytope
    const visualScale = polytopeConfig.scale

    // Update face material uniforms
    // CRITICAL: Always update uniforms regardless of mesh ref state
    // In WebGPU, uniform buffers must be updated every frame for animation to work
    // The mesh ref check was causing faces to not animate while edges did
    updateNDTransformUniforms(
      uniforms.ndTransform,
      gpuData,
      dimension,
      visualScale,
      projectionDistance
    )

    // Update edge material uniforms (for thin line mode)
    updateNDTransformUniforms(
      edgeUniforms.ndTransform,
      gpuData,
      dimension,
      visualScale,
      projectionDistance
    )

    // Update appearance uniforms
    if (appearanceChanged) {
      // Face color
      const faceColorObj = new THREE.Color(appearanceState.faceColor).convertSRGBToLinear()
      ;(uniforms.uColor as { value: THREE.Vector3 }).value.set(faceColorObj.r, faceColorObj.g, faceColorObj.b)

      // Opacity
      const faceOpacity = appearanceState.shaderSettings.surface.faceOpacity
      ;(uniforms.uOpacity as { value: number }).value = faceOpacity

      // Update material depthWrite based on opacity
      // NOTE: We do NOT change faceMaterial.transparent or call needsUpdate here.
      // In WebGPU, changing transparent or calling needsUpdate triggers pipeline recreation
      // which causes "Invalid PipelineLayout" errors. Material is always transparent=true,
      // and we only control depthWrite for correct z-ordering.
      const isOpaque = faceOpacity >= 1
      if (faceMaterial && faceMaterial.depthWrite !== isOpaque) {
        faceMaterial.depthWrite = isOpaque
        // Do NOT call needsUpdate - WebGPU pipelines are fixed at creation time
      }

      // Color algorithm uniforms
      updateColorTSLUniforms(uniforms.color, {
        colorAlgorithm: COLOR_ALGORITHM_TO_INT[appearanceState.colorAlgorithm],
        cosineA: appearanceState.cosineCoefficients.a,
        cosineB: appearanceState.cosineCoefficients.b,
        cosineC: appearanceState.cosineCoefficients.c,
        cosineD: appearanceState.cosineCoefficients.d,
        distPower: appearanceState.distribution.power,
        distCycles: appearanceState.distribution.cycles,
        distOffset: appearanceState.distribution.offset,
        lchLightness: appearanceState.lchLightness,
        lchChroma: appearanceState.lchChroma,
        multiSourceWeights: [
          appearanceState.multiSourceWeights.depth,
          appearanceState.multiSourceWeights.orbitTrap,
          appearanceState.multiSourceWeights.normal,
        ],
      })

      // Fresnel uniforms
      // Use intensity to control enabled state (0 = disabled)
      const fresnelOn = appearanceState.shaderSettings.surface.fresnelEnabled
      ;(uniforms.fresnel.uFresnelIntensity as { value: number }).value = fresnelOn ? appearanceState.fresnelIntensity : 0
      const rimColorObj = new THREE.Color(appearanceState.edgeColor).convertSRGBToLinear()
      ;(uniforms.fresnel.uRimColor.value as THREE.Color).copy(rimColorObj)

      // SSS uniforms
      // Use intensity to control enabled state (0 = disabled)
      ;(uniforms.sss.uSssIntensity as { value: number }).value = appearanceState.sssEnabled ? appearanceState.sssIntensity : 0
      const sssColorObj = new THREE.Color(appearanceState.sssColor).convertSRGBToLinear()
      ;(uniforms.sss.uSssColor.value as THREE.Color).copy(sssColorObj)
      ;(uniforms.sss.uSssThickness as { value: number }).value = appearanceState.sssThickness

      lastVersionRef.current.appearance = appearanceVersion
    }

    // Update PBR uniforms
    if (pbrChanged) {
      const facePBR = pbrState.face
      ;(uniforms.uRoughness as { value: number }).value = facePBR.roughness
      ;(uniforms.uMetallic as { value: number }).value = facePBR.metallic
      ;(uniforms.uSpecularIntensity as { value: number }).value = facePBR.specularIntensity

      const specColor = new THREE.Color(facePBR.specularColor).convertSRGBToLinear()
      ;(uniforms.uSpecularColor as { value: THREE.Vector3 }).value.set(specColor.r, specColor.g, specColor.b)

      lastVersionRef.current.pbr = pbrVersion
    }

    // Update IBL uniforms
    if (iblChanged) {
      const env = scene.environment
      const isPMREM = env && env.mapping === THREE.CubeUVReflectionMapping
      const qualityMap = { off: 0, low: 1, high: 2 } as const
      ;(uniforms.ibl.uIBLQuality as { value: number }).value = isPMREM ? qualityMap[environmentState.iblQuality] : 0
      ;(uniforms.ibl.uIBLIntensity as { value: number }).value = environmentState.iblIntensity
      // Use placeholder texture when no valid PMREM environment map
      // TSL texture nodes cannot accept null values
      ;(uniforms.ibl.uEnvMap as { value: THREE.Texture }).value = isPMREM && env ? env : uniforms.ibl.placeholderTexture

      lastVersionRef.current.ibl = iblVersion
    }

    // Update lighting uniforms
    if (lightingChanged) {
      // Update ambient (WebGL: uAmbientEnabled, uAmbientColor, uAmbientIntensity)
      ;(uniforms.lighting.uAmbientEnabled as { value: number }).value = lightingState.ambientEnabled ? 1.0 : 0.0
      const ambientColor = new THREE.Color(lightingState.ambientColor).convertSRGBToLinear()
      ;(uniforms.lighting.uAmbientColor.value as THREE.Color).copy(ambientColor)
      ;(uniforms.lighting.uAmbientIntensity as { value: number }).value = lightingState.ambientIntensity

      // Update individual lights using the helper function
      updateLightTSLUniforms(uniforms.lighting, lightingState.lights)

      // Update shadow uniforms from scene lights
      const pcfSamples = blurToPCFSamples(lightingState.shadowMapBlur)
      const mapSize = SHADOW_MAP_SIZES[lightingState.shadowQuality]
      const shadowData = lightingState.shadowEnabled
        ? collectShadowDataCached(scene, lightingState.lights)
        : []

      // WebGL parity: always keep valid textures bound (placeholders when disabled)
      updateShadowTSLUniforms(uniforms.shadows, shadowData, 0.001, mapSize, pcfSamples)

      lastVersionRef.current.lighting = lightingVersion
    }

    // Update polytope version
    if (polytopeChanged) {
      lastVersionRef.current.polytope = polytopeVersion
    }
  })

  // ============ RENDER ============
  return (
    <group>
      {/* Polytope faces - show invisible placeholder while shader compiles */}
      {facesVisible && faceGeometry && !isCompiling && faceMaterial && (
        <mesh
          ref={setFaceMeshRef}
          geometry={faceGeometry}
          material={faceMaterial as unknown as THREE.Material}
          // NOTE: castShadow/receiveShadow are for Three.js's built-in shadow system
          // We use custom TSL shadow sampling in the material, so we need castShadow
          // for the shadow map generation, but NOT receiveShadow (which would inject
          // Three.js's shadow receiver code and conflict with our custom sampling)
          castShadow={shadowEnabled}
          receiveShadow={false}
        />
      )}

      {/* Invisible placeholder while compiling (keeps geometry in scene) */}
      {facesVisible && faceGeometry && (isCompiling || !faceMaterial) && (
        <mesh geometry={faceGeometry} visible={false} />
      )}

      {/* Polytope edges - use TubeWireframeTSL for thick lines, native lineSegments for thin */}
      {edgesVisible && useFatWireframe && (
        <TubeWireframeTSL
          vertices={baseVertices}
          edges={edges}
          dimension={dimension}
          color={edgeColor}
          opacity={opacity}
          radius={edgeThickness * 0.015}
          shadowEnabled={shadowEnabled}
          caps={tubeCaps}
        />
      )}

      {/* Native line rendering for thin edges (edgeThickness === 1) */}
      {edgesVisible && !useFatWireframe && edgeGeometry && (
        <lineSegments
          ref={setEdgeMeshRef}
          geometry={edgeGeometry}
          material={edgeMaterial as unknown as THREE.Material}
        />
      )}
    </group>
  )
})

/**
 * PolytopeSceneTSL - Wrapper component for TSL Polytope rendering.
 *
 * CRITICAL: Uses key-based remounting to handle WebGPU pipeline limitations.
 * When feature flags change (shadows, IBL, SSS, fresnel), the Inner component
 * completely remounts, ensuring fresh TSL texture nodes for each pipeline.
 *
 * This pattern mirrors MandelbulbMeshTSL which uses the same approach.
 */
export const PolytopeSceneTSL = React.memo(function PolytopeSceneTSL(props: PolytopeSceneTSLProps) {
  // Subscribe to feature flags that affect shader composition
  const {
    sssEnabled,
    fresnelEnabled,
  } = useAppearanceStore(
    useShallow((state) => ({
      sssEnabled: state.sssEnabled,
      fresnelEnabled: state.shaderSettings.surface.fresnelEnabled,
    }))
  )

  const shadowEnabled = useLightingStore((state) => state.shadowEnabled)
  const iblQuality = useEnvironmentStore((state) => state.iblQuality)
  const iblEnabled = iblQuality !== 'off'

  // Build shader config
  const shaderConfig: PolytopeTSLConfig = useMemo(() => ({
    shadows: shadowEnabled,
    sss: sssEnabled,
    fresnel: fresnelEnabled,
    ibl: iblEnabled,
  }), [shadowEnabled, sssEnabled, fresnelEnabled, iblEnabled])

  // Generate key from feature flags - forces complete remount when features change
  // This ensures fresh TSL texture nodes for each pipeline compilation
  const featureKey = `polytope-shadow${shadowEnabled}-ibl${iblEnabled}-sss${sssEnabled}-fresnel${fresnelEnabled}`

  return (
    <PolytopeSceneTSLInner
      key={featureKey}
      {...props}
      shaderConfig={shaderConfig}
      shadowEnabled={shadowEnabled}
      sssEnabled={sssEnabled}
      fresnelEnabled={fresnelEnabled}
      iblEnabled={iblEnabled}
    />
  )
})
