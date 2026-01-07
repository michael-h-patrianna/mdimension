/**
 * PostProcessingV2TSL Component
 *
 * TSL/WebGPU-compatible render graph-based post-processing implementation.
 * Uses RenderGraphTSL with TSL node materials for WebGPU support.
 *
 * This is the complete TSL port of PostProcessingV2, implementing:
 * - Scene rendering (with/without gravity split)
 * - Gravitational lensing pipeline
 * - Environment compositing
 * - G-buffer passes (depth, normals, MRT)
 * - Temporal reprojection (depth capture, cloud accumulation)
 * - All post-processing effects (GTAO, Bloom, SSR, Bokeh, Refraction, etc.)
 * - Tone mapping + Cinematic effects
 * - Frame blending, Paper texture
 * - Anti-aliasing (FXAA, SMAA)
 * - Debug overlays and buffer preview
 *
 * @module rendering/environment/PostProcessingV2TSL
 */

import { useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import { texture } from 'three/tsl'
import { useShallow } from 'zustand/react/shallow'

import { isPolytopeType } from '@/lib/geometry/types'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { RENDER_LAYERS, needsVolumetricSeparation } from '@/rendering/core/layers'
import type { SupportedRenderer } from '@/rendering/core/rendererUtils'
import {
  createSceneBackgroundExport,
  createSceneEnvironmentExport,
} from '@/rendering/graph/ExternalBridge'
import {
  RenderGraphTSL,
  ScenePassTSL,
  GravitationalLensingPassTSL,
  EnvironmentCompositePassTSL,
  ToScreenPassTSL,
  NormalPassTSL,
  BufferPreviewPassTSL,
  MainObjectMRTPassTSL,
  CubemapCapturePassTSL,
  DepthPassTSL,
  TemporalDepthCapturePassTSL,
  TemporalCloudPassTSL,
  GTAOPassTSL,
  BloomPassTSL,
  SSRPassTSL,
  BokehPassTSL,
  RefractionPassTSL,
  ScreenSpaceLensingPassTSL,
  ToneMappingCinematicPassTSL,
  FrameBlendingPassTSL,
  PaperTexturePassTSL,
  FXAAPassTSL,
  SMAAPassTSL,
  DebugOverlayPassTSL,
  FullscreenPassTSL,
  CopyPassTSL,
} from '@/rendering/graph-tsl'
import { TONE_MAPPING_TO_THREE } from '@/rendering/shaders/types'
import { useAnimationStore } from '@/stores/animationStore'
import { SSR_QUALITY_STEPS } from '@/stores/defaults/visualDefaults'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useLightingStore } from '@/stores/lightingStore'
import { usePerformanceMetricsStore } from '@/stores/performanceMetricsStore'
import { getEffectiveSSRQuality, usePerformanceStore, type SSRQualityLevel } from '@/stores/performanceStore'
import { usePostProcessingStore } from '@/stores/postProcessingStore'
import { useRenderGraphStore } from '@/stores/renderGraphStore'
import { useUIStore } from '@/stores/uiStore'
import { useWebGLContextStore } from '@/stores/webglContextStore'

// =============================================================================
// Resource IDs
// =============================================================================

const RESOURCES = {
  // G-buffer resources
  SCENE_COLOR: 'sceneColor',
  OBJECT_DEPTH: 'objectDepth',
  NORMAL_ENV: 'normalEnv',
  MAIN_OBJECT_MRT: 'mainObjectMrt',
  NORMAL_BUFFER: 'normalBuffer',
  SCENE_COMPOSITE: 'sceneComposite',
  PREVIEW_OUTPUT: 'previewOutput',

  // Environment separation resources (for gravitational lensing)
  ENVIRONMENT_COLOR: 'environmentColor',
  MAIN_OBJECT_COLOR: 'mainObjectColor',
  LENSED_ENVIRONMENT: 'lensedEnvironment',

  // Temporal Cloud resources
  TEMPORAL_CLOUD_BUFFER: 'temporalCloudBuffer',
  TEMPORAL_ACCUMULATION: 'temporalAccumulation',
  TEMPORAL_REPROJECTION: 'temporalReprojection',
  TEMPORAL_DEPTH_OUTPUT: 'temporalDepthOutput',

  // Effect chain resources
  GTAO_OUTPUT: 'gtaoOutput',
  BLOOM_OUTPUT: 'bloomOutput',
  SSR_OUTPUT: 'ssrOutput',
  BOKEH_OUTPUT: 'bokehOutput',
  REFRACTION_OUTPUT: 'refractionOutput',
  LENSING_OUTPUT: 'lensingOutput',
  TONEMAPPED_OUTPUT: 'tonemappedOutput',
  FRAME_BLENDING_OUTPUT: 'frameBlendingOutput',
  PAPER_OUTPUT: 'paperOutput',
  AA_OUTPUT: 'aaOutput',
} as const

// =============================================================================
// Performance: Throttled Scene GPU Stats Update
// =============================================================================

let lastSceneGpuUpdateTime = 0
const SCENE_GPU_UPDATE_INTERVAL = 500 // ms
const AUTOFOCUS_RAYCAST_INTERVAL = 100 // ms

function throttledUpdateSceneGpu(stats: { calls: number; triangles: number; points: number; lines: number }) {
  const { showPerfMonitor, perfMonitorExpanded, perfMonitorTab } = useUIStore.getState()
  if (!showPerfMonitor || !perfMonitorExpanded || perfMonitorTab !== 'perf') return

  const now = performance.now()
  if (now - lastSceneGpuUpdateTime >= SCENE_GPU_UPDATE_INTERVAL) {
    usePerformanceMetricsStore.getState().updateSceneGpu(stats)
    lastSceneGpuUpdateTime = now
  }
}

// =============================================================================
// Helper: Object Type Temporal Support
// =============================================================================

function usesTemporalDepth(objectType: string): boolean {
  return objectType === 'mandelbulb' || objectType === 'quaternion-julia'
}

function usesTemporalCloud(objectType: string): boolean {
  return objectType === 'schroedinger'
}

// =============================================================================
// PostProcessingV2TSL Component
// =============================================================================

/**
 * PostProcessingV2TSL - TSL render graph-based post-processing.
 *
 * Complete port of PostProcessingV2 with all effects implemented in TSL.
 */
export const PostProcessingV2TSL = memo(function PostProcessingV2TSL() {
  const { gl, scene, camera, size, viewport } = useThree()

  // Context restore counter for recreation
  const restoreCount = useWebGLContextStore((s) => s.restoreCount)

  // Get object type
  const objectType = useGeometryStore((s) => s.objectType)
  const isPolytope = isPolytopeType(objectType)
  const isBlackHole = objectType === 'blackhole'
  const objectTypeRef = useRef(objectType)

  useEffect(() => {
    objectTypeRef.current = objectType
    passRefs.current.mainObjectMrt?.invalidateCache?.()
  }, [objectType])

  // Store subscriptions - Post Processing
  const postProcessingSelector = useShallow((s: ReturnType<typeof usePostProcessingStore.getState>) => ({
    // Bloom
    bloomEnabled: s.bloomEnabled,
    bloomIntensity: s.bloomIntensity,
    bloomRadius: s.bloomRadius,
    bloomThreshold: s.bloomThreshold,
    bloomSmoothing: s.bloomSmoothing,
    bloomLevels: s.bloomLevels,
    // Bokeh
    bokehEnabled: s.bokehEnabled,
    bokehFocusMode: s.bokehFocusMode,
    bokehBlurMethod: s.bokehBlurMethod,
    bokehWorldFocusDistance: s.bokehWorldFocusDistance,
    bokehWorldFocusRange: s.bokehWorldFocusRange,
    bokehScale: s.bokehScale,
    bokehSmoothTime: s.bokehSmoothTime,
    // SSR
    ssrEnabled: s.ssrEnabled,
    ssrIntensity: s.ssrIntensity,
    ssrMaxDistance: s.ssrMaxDistance,
    ssrThickness: s.ssrThickness,
    ssrFadeStart: s.ssrFadeStart,
    ssrFadeEnd: s.ssrFadeEnd,
    ssrQuality: s.ssrQuality,
    // Refraction
    refractionEnabled: s.refractionEnabled,
    refractionIOR: s.refractionIOR,
    refractionStrength: s.refractionStrength,
    refractionChromaticAberration: s.refractionChromaticAberration,
    // Anti-aliasing
    antiAliasingMethod: s.antiAliasingMethod,
    // Cinematic
    cinematicEnabled: s.cinematicEnabled,
    cinematicAberration: s.cinematicAberration,
    cinematicVignette: s.cinematicVignette,
    cinematicGrain: s.cinematicGrain,
    // SSAO (GTAO)
    ssaoEnabled: s.ssaoEnabled,
    ssaoIntensity: s.ssaoIntensity,
    // Paper texture
    paperEnabled: s.paperEnabled,
    paperContrast: s.paperContrast,
    paperRoughness: s.paperRoughness,
    paperFiber: s.paperFiber,
    paperFiberSize: s.paperFiberSize,
    paperCrumples: s.paperCrumples,
    paperCrumpleSize: s.paperCrumpleSize,
    paperFolds: s.paperFolds,
    paperFoldCount: s.paperFoldCount,
    paperDrops: s.paperDrops,
    paperFade: s.paperFade,
    paperSeed: s.paperSeed,
    paperColorFront: s.paperColorFront,
    paperColorBack: s.paperColorBack,
    paperQuality: s.paperQuality,
    paperIntensity: s.paperIntensity,
    // Frame Blending
    frameBlendingEnabled: s.frameBlendingEnabled,
    frameBlendingFactor: s.frameBlendingFactor,
    // Depth selection
    objectOnlyDepth: s.objectOnlyDepth,
    // Gravity
    gravityEnabled: s.gravityEnabled,
  }))
  const ppState = usePostProcessingStore(postProcessingSelector)

  // Store subscriptions - Environment
  const envSelector = useShallow((s: ReturnType<typeof useEnvironmentStore.getState>) => ({
    activeWalls: s.activeWalls,
    skyboxMode: s.skyboxMode,
    skyboxEnabled: s.skyboxEnabled,
    classicCubeTexture: s.classicCubeTexture,
    iblQuality: s.iblQuality,
    backgroundColor: s.backgroundColor,
  }))
  const envState = useEnvironmentStore(envSelector)

  // Store subscriptions - Lighting (tone mapping)
  const lightingSelector = useShallow((s: ReturnType<typeof useLightingStore.getState>) => ({
    toneMappingEnabled: s.toneMappingEnabled,
    toneMappingAlgorithm: s.toneMappingAlgorithm,
    exposure: s.exposure,
  }))
  const lightingState = useLightingStore(lightingSelector)

  // Store subscriptions - UI debug toggles
  const uiSelector = useShallow((s: ReturnType<typeof useUIStore.getState>) => ({
    showDepthBuffer: s.showDepthBuffer,
    showNormalBuffer: s.showNormalBuffer,
    showTemporalDepthBuffer: s.showTemporalDepthBuffer,
  }))
  const uiState = useUIStore(uiSelector)

  // Store subscriptions - Performance
  const perfSelector = useShallow((s: ReturnType<typeof usePerformanceStore.getState>) => ({
    temporalReprojectionEnabled: s.temporalReprojectionEnabled,
    qualityMultiplier: s.qualityMultiplier,
    renderResolutionScale: s.renderResolutionScale,
  }))
  const perfState = usePerformanceStore(perfSelector)

  // Store subscriptions - Black hole config
  const blackHoleSelector = useShallow((s: ReturnType<typeof useExtendedObjectStore.getState>) => ({
    horizonRadius: s.blackhole.horizonRadius,
    skyCubemapResolution: s.blackhole.skyCubemapResolution,
    schroedingerIsoEnabled: s.schroedinger.isoEnabled,
    gravityStrength: s.blackhole.gravityStrength,
    bendScale: s.blackhole.bendScale,
    lensingFalloff: s.blackhole.distanceFalloff,
    shellGlowStrength: s.blackhole.shellGlowStrength,
    shellGlowColor: s.blackhole.shellGlowColor,
    deferredLensingStrength: 0,
    deferredLensingChromaticAberration: 0,
    deferredLensingRadius: 1.0,
  }))
  const blackHoleState = useExtendedObjectStore(blackHoleSelector)

  // Keep latest store states in refs for render graph callbacks
  const ppStateRef = useRef(ppState)
  const envStateRef = useRef(envState)
  const uiStateRef = useRef(uiState)
  const perfStateRef = useRef(perfState)
  const blackHoleStateRef = useRef(blackHoleState)

  useEffect(() => { ppStateRef.current = ppState }, [ppState])
  useEffect(() => { envStateRef.current = envState }, [envState])
  useEffect(() => { uiStateRef.current = uiState }, [uiState])
  useEffect(() => { perfStateRef.current = perfState }, [perfState])
  useEffect(() => { blackHoleStateRef.current = blackHoleState }, [blackHoleState])

  // Camera-relative helpers
  const autoFocusRaycaster = useMemo(() => new THREE.Raycaster(), [])
  const screenCenter = useMemo(() => new THREE.Vector2(0, 0), [])
  const autoFocusDistanceRef = useRef(ppState.bokehWorldFocusDistance)
  const currentFocusRef = useRef(ppState.bokehWorldFocusDistance)
  const lastRaycastTimeRef = useRef(0)
  const blackHoleWorldPosition = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const bufferStatsTimeRef = useRef(0)
  const projectedBlackHole = useMemo(() => new THREE.Vector3(), [])
  const wasFrameBlendingEnabledRef = useRef(ppState.frameBlendingEnabled)

  // ==========================================================================
  // Create Render Graph
  // ==========================================================================

  const graphRef = useRef<RenderGraphTSL | null>(null)
  const passRefs = useRef<{
    cubemapCapture?: CubemapCapturePassTSL
    scenePass?: ScenePassTSL
    environmentScene?: ScenePassTSL
    objectDepth?: DepthPassTSL
    temporalDepthCapture?: TemporalDepthCapturePassTSL
    temporalCloud?: TemporalCloudPassTSL
    normalPass?: NormalPassTSL
    mainObjectMrt?: MainObjectMRTPassTSL & { invalidateCache?: () => void }
    normalComposite?: FullscreenPassTSL
    cloudComposite?: FullscreenPassTSL
    bufferPreview?: BufferPreviewPassTSL
    gravityComposite?: EnvironmentCompositePassTSL
    gtao?: GTAOPassTSL
    bloom?: BloomPassTSL
    ssr?: SSRPassTSL
    bokeh?: BokehPassTSL
    refraction?: RefractionPassTSL
    lensing?: ScreenSpaceLensingPassTSL
    toneMappingCinematic?: ToneMappingCinematicPassTSL
    frameBlending?: FrameBlendingPassTSL
    paper?: PaperTexturePassTSL
    fxaa?: FXAAPassTSL
    smaa?: SMAAPassTSL
    toScreen?: ToScreenPassTSL
  }>({})

  const graph = useMemo(() => {
    // Dispose previous graph
    graphRef.current?.dispose()

    const g = new RenderGraphTSL()

    // ========================================================================
    // Set Store Getters for Frozen Frame Context
    // ========================================================================
    g.setStoreGetters({
      getAnimationState: () => {
        const s = useAnimationStore.getState()
        return {
          accumulatedTime: s.accumulatedTime,
          speed: s.speed,
          isPlaying: s.isPlaying,
          direction: s.direction,
          animatingPlanes: s.animatingPlanes,
        }
      },
      getGeometryState: () => {
        const s = useGeometryStore.getState()
        return {
          objectType: s.objectType,
          dimension: s.dimension,
        }
      },
      getEnvironmentState: () => {
        const s = useEnvironmentStore.getState()
        return {
          skybox: s,
          ground: s,
        }
      },
      getPostProcessingState: () => usePostProcessingStore.getState(),
      getPerformanceState: () => {
        const s = usePerformanceStore.getState()
        return {
          isInteracting: s.isInteracting,
          sceneTransitioning: s.sceneTransitioning,
          progressiveRefinementEnabled: s.progressiveRefinementEnabled,
          qualityMultiplier: s.qualityMultiplier,
          refinementStage: s.refinementStage,
          temporalReprojectionEnabled: s.temporalReprojectionEnabled,
          cameraTeleported: s.cameraTeleported,
          fractalAnimationLowQuality: s.fractalAnimationLowQuality,
          isShaderCompiling: s.isShaderCompiling,
          renderResolutionScale: s.renderResolutionScale,
        }
      },
      getBlackHoleState: () => useExtendedObjectStore.getState().blackhole,
      getUIState: () => {
        const s = useUIStore.getState()
        return {
          showDepthBuffer: s.showDepthBuffer,
          showNormalBuffer: s.showNormalBuffer,
          showTemporalDepthBuffer: s.showTemporalDepthBuffer,
        }
      },
    })

    // ========================================================================
    // Register External Bridge Exports
    // ========================================================================
    g.registerExport(createSceneBackgroundExport(scene))
    g.registerExport(createSceneEnvironmentExport(scene))

    // ========================================================================
    // Register Resources
    // ========================================================================

    // Main scene HDR color buffer (with depth texture)
    g.addResource({
      id: RESOURCES.SCENE_COLOR,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
    })

    // Object-only depth
    g.addResource({
      id: RESOURCES.OBJECT_DEPTH,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
    })

    // Environment normals
    g.addResource({
      id: RESOURCES.NORMAL_ENV,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    })

    // Main object MRT (color + normal + position)
    g.addResource({
      id: RESOURCES.MAIN_OBJECT_MRT,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 3,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
      attachmentNames: ['output', 'normal', 'position'],
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
    })

    // Temporal Cloud Resources
    // CRITICAL: attachmentNames must match the mrt() output keys in Schroedinger/other volumetric materials
    // Without named attachments, WebGPU defaults to 'm0', 'm1', 'm2' causing WGSL parse errors
    g.addResource({
      id: RESOURCES.TEMPORAL_CLOUD_BUFFER,
      type: 'mrt',
      size: { mode: 'fraction', fraction: 0.5 },
      attachmentCount: 3,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
      attachmentNames: ['output', 'normal', 'position'],
      dataType: THREE.FloatType,
      depthBuffer: true,
    })

    // CRITICAL: attachmentNames must match the mrt() output keys in reprojection/reconstruction shaders
    // Without named attachments, WebGPU defaults to 'm0', 'm1' causing WGSL struct member errors
    g.addResource({
      id: RESOURCES.TEMPORAL_ACCUMULATION,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 2,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat],
      attachmentNames: ['output', 'position'],
      dataType: THREE.FloatType,
      depthBuffer: false,
    })

    // CRITICAL: attachmentNames must match the mrt() output keys in reprojection/reconstruction shaders
    // Without named attachments, WebGPU defaults to 'm0', 'm1' causing WGSL struct member errors
    g.addResource({
      id: RESOURCES.TEMPORAL_REPROJECTION,
      type: 'mrt',
      size: { mode: 'screen' },
      attachmentCount: 2,
      attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat],
      attachmentNames: ['output', 'position'],
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    })

    g.addResource({
      id: RESOURCES.TEMPORAL_DEPTH_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.FloatType,
      depthBuffer: false,
    })

    // Final normal buffer
    g.addResource({
      id: RESOURCES.NORMAL_BUFFER,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: false,
    })

    // Scene color after volumetric composite
    g.addResource({
      id: RESOURCES.SCENE_COMPOSITE,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    // Environment color (for gravitational lensing)
    g.addResource({
      id: RESOURCES.ENVIRONMENT_COLOR,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
    })

    // Main object color (for gravity composite)
    g.addResource({
      id: RESOURCES.MAIN_OBJECT_COLOR,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: true,
      depthTextureFormat: THREE.DepthFormat,
      depthTextureType: THREE.UnsignedShortType,
    })

    // Lensed environment
    g.addResource({
      id: RESOURCES.LENSED_ENVIRONMENT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    // Buffer preview output
    g.addResource({
      id: RESOURCES.PREVIEW_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType,
    })

    // Effect chain buffers
    g.addResource({
      id: RESOURCES.GTAO_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.BLOOM_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.SSR_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.BOKEH_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.REFRACTION_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.LENSING_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.TONEMAPPED_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.FRAME_BLENDING_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.PAPER_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.HalfFloatType,
    })

    g.addResource({
      id: RESOURCES.AA_OUTPUT,
      type: 'renderTarget',
      size: { mode: 'screen' },
      format: THREE.RGBAFormat,
      dataType: THREE.UnsignedByteType,
    })

    // ========================================================================
    // Helper functions for enabled callbacks
    // ========================================================================

    const shouldRenderNormals = (frame: import('@/rendering/graph/FrameContext').FrozenFrameContext | null) => {
      if (!frame) return false
      const pp = frame.stores.postProcessing
      const ui = frame.stores.ui
      return (
        pp.ssrEnabled ||
        pp.refractionEnabled ||
        (pp.ssaoEnabled && isPolytope) ||
        ui.showNormalBuffer
      )
    }

    const shouldRenderObjectDepth = (frame: import('@/rendering/graph/FrameContext').FrozenFrameContext | null) => {
      if (!frame) return false
      const pp = frame.stores.postProcessing
      const ui = frame.stores.ui
      const depthForEffects =
        pp.objectOnlyDepth && (pp.ssrEnabled || pp.refractionEnabled || pp.bokehEnabled)
      const depthPreview = ui.showDepthBuffer && pp.objectOnlyDepth
      return depthForEffects || depthPreview
    }

    const shouldRenderTemporalCloud = (frame: import('@/rendering/graph/FrameContext').FrozenFrameContext | null) => {
      if (!frame) return false
      const perf = frame.stores.performance
      const temporalCloudAccumulation = perf.temporalReprojectionEnabled && !blackHoleStateRef.current.schroedingerIsoEnabled
      return needsVolumetricSeparation({ temporalCloudAccumulation, objectType: objectTypeRef.current })
    }

    // ========================================================================
    // Add Passes
    // ========================================================================

    // Cubemap capture pass
    const cubemapCapturePass = new CubemapCapturePassTSL({
      id: 'cubemapCapture',
      backgroundResolution: blackHoleStateRef.current.skyCubemapResolution,
      environmentResolution: 256,
      enabled: (frame) => {
        if (!frame) return false
        const env = frame.stores.environment
        if (!env.skyboxEnabled) return false
        if (env.skyboxMode === 'classic' && !env.classicCubeTexture) return false
        const hasIBL = env.iblQuality !== 'off'
        const hasConsumer = isBlackHole || env.activeWalls.length > 0 || hasIBL
        return hasConsumer
      },
      generatePMREM: () => envStateRef.current.activeWalls.length > 0 || envStateRef.current.iblQuality !== 'off',
      getExternalCubeTexture: () => {
        const env = envStateRef.current
        if (env.skyboxMode === 'classic' && env.classicCubeTexture) {
          return env.classicCubeTexture
        }
        return null
      },
    })
    passRefs.current.cubemapCapture = cubemapCapturePass
    g.addPass(cubemapCapturePass)

    // Scene render pass - unified path (non-gravity)
    const sceneLayers = [RENDER_LAYERS.MAIN_OBJECT, RENDER_LAYERS.ENVIRONMENT, RENDER_LAYERS.SKYBOX]
    const scenePass = new ScenePassTSL({
      id: 'scene',
      outputs: [{ resourceId: RESOURCES.SCENE_COLOR, access: 'write' }],
      layers: sceneLayers,
      clearColor: 0x000000,
      autoClear: true,
      renderBackground: false,
      enabled: (frame) => !(frame?.stores.postProcessing.gravityEnabled ?? false),
      onRenderStats: throttledUpdateSceneGpu,
    })
    passRefs.current.scenePass = scenePass
    g.addPass(scenePass)

    // ========================================================================
    // Gravitational Lensing Pipeline
    // ========================================================================

    // Environment scene pass
    const environmentScenePass = new ScenePassTSL({
      id: 'environmentScene',
      outputs: [{ resourceId: RESOURCES.ENVIRONMENT_COLOR, access: 'write' }],
      layers: [RENDER_LAYERS.ENVIRONMENT, RENDER_LAYERS.SKYBOX],
      clearColor: 0x000000,
      autoClear: true,
      renderBackground: false,
      enabled: (frame) => frame?.stores.postProcessing.gravityEnabled ?? false,
    })
    passRefs.current.environmentScene = environmentScenePass
    g.addPass(environmentScenePass)

    // Main object scene pass (for gravity path)
    // NOTE: forceOpaque is NOT supported in TSL/WebGPU due to fixed pipeline layouts.
    // Instead, materials use premultiplied alpha and composite shaders handle blending.
    g.addPass(
      new ScenePassTSL({
        id: 'mainObjectScene',
        outputs: [{ resourceId: RESOURCES.MAIN_OBJECT_COLOR, access: 'write' }],
        layers: [RENDER_LAYERS.MAIN_OBJECT],
        clearColor: 0x000000,
        clearAlpha: 0,
        autoClear: true,
        renderBackground: false,
        enabled: (frame) => frame?.stores.postProcessing.gravityEnabled ?? false,
        onRenderStats: throttledUpdateSceneGpu,
      })
    )

    // Gravitational lensing pass
    const gravityLensingPass = new GravitationalLensingPassTSL({
      id: 'gravityLensing',
      environmentInput: RESOURCES.ENVIRONMENT_COLOR,
      outputResource: RESOURCES.LENSED_ENVIRONMENT,
      enabled: (frame) => frame?.stores.postProcessing.gravityEnabled ?? false,
    })
    g.addPass(gravityLensingPass)

    // Environment composite pass
    const gravityCompositePass = new EnvironmentCompositePassTSL({
      id: 'gravityComposite',
      lensedEnvironmentInput: RESOURCES.LENSED_ENVIRONMENT,
      mainObjectInput: RESOURCES.MAIN_OBJECT_COLOR,
      mainObjectDepthInput: RESOURCES.MAIN_OBJECT_COLOR,
      mainObjectDepthInputAttachment: 'depth',
      outputResource: RESOURCES.SCENE_COLOR,
      enabled: (frame) => frame?.stores.postProcessing.gravityEnabled ?? false,
    })
    passRefs.current.gravityComposite = gravityCompositePass
    g.addPass(gravityCompositePass)

    // ========================================================================
    // G-Buffer Passes
    // ========================================================================

    // Object depth pass
    const objectDepthPass = new DepthPassTSL({
      id: 'objectDepth',
      outputs: [{ resourceId: RESOURCES.OBJECT_DEPTH, access: 'write' }],
      layers: [RENDER_LAYERS.MAIN_OBJECT],
      mode: 'material',
      forceDepthWrite: 'all',
      disableColorWrites: true,
      clear: true,
      enabled: shouldRenderObjectDepth,
    })
    passRefs.current.objectDepth = objectDepthPass
    g.addPass(objectDepthPass)

    // Temporal position capture pass
    const temporalDepthCapture = new TemporalDepthCapturePassTSL({
      id: 'temporalDepthCapture',
      positionInput: RESOURCES.MAIN_OBJECT_MRT,
      positionAttachment: 2,
      outputResource: RESOURCES.TEMPORAL_DEPTH_OUTPUT,
      enabled: (frame) => {
        if (!frame) return false
        const perf = frame.stores.performance
        const ui = frame.stores.ui
        const objectType = frame.stores.geometry?.objectType ?? ''
        const usesDepth = usesTemporalDepth(objectType)
        return (perf.temporalReprojectionEnabled && usesDepth) || (ui.showTemporalDepthBuffer && usesDepth)
      },
      forceCapture: () => uiStateRef.current.showTemporalDepthBuffer,
      skipPassthrough: true,
    })
    passRefs.current.temporalDepthCapture = temporalDepthCapture
    g.addPass(temporalDepthCapture)

    // Temporal cloud pass
    const shouldRenderTemporalCloudRef = () => {
      const perf = perfStateRef.current
      const temporalCloudAccumulation = perf.temporalReprojectionEnabled && !blackHoleStateRef.current.schroedingerIsoEnabled
      return needsVolumetricSeparation({ temporalCloudAccumulation, objectType: objectTypeRef.current })
    }
    const temporalCloudPass = new TemporalCloudPassTSL({
      id: 'temporalCloud',
      volumetricLayer: RENDER_LAYERS.VOLUMETRIC,
      shouldRender: shouldRenderTemporalCloudRef,
      cloudBuffer: RESOURCES.TEMPORAL_CLOUD_BUFFER,
      accumulationBuffer: RESOURCES.TEMPORAL_ACCUMULATION,
      reprojectionBuffer: RESOURCES.TEMPORAL_REPROJECTION,
      enabled: shouldRenderTemporalCloud,
      priority: -10,
    })
    passRefs.current.temporalCloud = temporalCloudPass
    g.addPass(temporalCloudPass)

    // Environment normal pass
    const normalPass = new NormalPassTSL({
      id: 'normalEnv',
      outputs: [{ resourceId: RESOURCES.NORMAL_ENV, access: 'write' }],
      layers: [RENDER_LAYERS.ENVIRONMENT],
      renderBackground: false,
      enabled: shouldRenderNormals,
    })
    passRefs.current.normalPass = normalPass
    g.addPass(normalPass)

    // Main object MRT
    const mainObjectMrt = new MainObjectMRTPassTSL({
      id: 'mainObjectMrt',
      outputResource: RESOURCES.MAIN_OBJECT_MRT,
      layers: [RENDER_LAYERS.MAIN_OBJECT],
      renderBackground: false,
      // CRITICAL (WebGPU/TSL): Do NOT force opaque by toggling `material.transparent`.
      // WebGPU pipelines are fixed-layout; runtime transparent changes trigger pipeline recreation
      // and can freeze/crash. We rely on premultiplied alpha compositing instead.
      forceOpaque: false,
    })
    passRefs.current.mainObjectMrt = mainObjectMrt
    g.addPass(mainObjectMrt)

    // Normal composite - NOTE: This needs to be implemented as a TSL fullscreen pass
    // For now, we use a simple copy from NORMAL_ENV to NORMAL_BUFFER
    // TODO: Implement proper normal composite with cloud normals in TSL
    const normalCompositePass = new CopyPassTSL({
      id: 'normalComposite',
      colorInput: RESOURCES.NORMAL_ENV,
      outputResource: RESOURCES.NORMAL_BUFFER,
      enabled: shouldRenderNormals,
    })
    g.addPass(normalCompositePass)

    // Cloud composite - NOTE: Using simple copy for now
    // TODO: Implement proper cloud composite in TSL
    const cloudCompositePass = new CopyPassTSL({
      id: 'cloudComposite',
      colorInput: RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.SCENE_COMPOSITE,
      enabled: () => true, // Always copy, passthrough handled internally
    })
    g.addPass(cloudCompositePass)

    // ========================================================================
    // Post-Processing Effect Chain
    // ========================================================================

    // GTAO pass (only for polytopes)
    const gtaoPass = new GTAOPassTSL({
      id: 'gtao',
      colorInput: RESOURCES.SCENE_COMPOSITE,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.SCENE_COLOR,
      depthInputAttachment: 'depth',
      outputResource: RESOURCES.GTAO_OUTPUT,
      enabled: (frame) => (frame?.stores.postProcessing.ssaoEnabled ?? false) && isPolytope,
      skipPassthrough: true,
      halfResolution: true,
    })
    passRefs.current.gtao = gtaoPass
    g.addPass(gtaoPass)

    // Bloom pass
    const bloomPass = new BloomPassTSL({
      id: 'bloom',
      inputResource: RESOURCES.GTAO_OUTPUT,
      outputResource: RESOURCES.BLOOM_OUTPUT,
      strength: ppStateRef.current.bloomIntensity,
      radius: ppStateRef.current.bloomRadius,
      threshold: ppStateRef.current.bloomThreshold,
      smoothing: ppStateRef.current.bloomSmoothing,
      levels: ppStateRef.current.bloomLevels,
      enabled: (frame) => frame?.stores.postProcessing.bloomEnabled ?? false,
      skipPassthrough: true,
    })
    passRefs.current.bloom = bloomPass
    g.addPass(bloomPass)

    // Bokeh pass (DOF)
    const bokehPass = new BokehPassTSL({
      id: 'bokeh',
      colorInput: RESOURCES.BLOOM_OUTPUT,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.BOKEH_OUTPUT,
      focus: ppStateRef.current.bokehWorldFocusDistance,
      focusRange: ppStateRef.current.bokehWorldFocusRange,
      aperture: ppStateRef.current.bokehScale * 0.005,
      maxBlur: ppStateRef.current.bokehScale * 0.02,
      enabled: (frame) => {
        if (!frame) return false
        const pp = frame.stores.postProcessing
        const ui = frame.stores.ui
        return pp.bokehEnabled &&
          !(ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer)
      },
      skipPassthrough: true,
    })
    passRefs.current.bokeh = bokehPass
    g.addPass(bokehPass)

    // SSR pass
    const ssrPass = new SSRPassTSL({
      id: 'ssr',
      colorInput: RESOURCES.BOKEH_OUTPUT,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.SSR_OUTPUT,
      intensity: ppStateRef.current.ssrIntensity,
      maxDistance: ppStateRef.current.ssrMaxDistance,
      thickness: ppStateRef.current.ssrThickness,
      fadeStart: ppStateRef.current.ssrFadeStart,
      fadeEnd: ppStateRef.current.ssrFadeEnd,
      enabled: (frame) => frame?.stores.postProcessing.ssrEnabled ?? false,
      skipPassthrough: true,
    })
    passRefs.current.ssr = ssrPass
    g.addPass(ssrPass)

    // Refraction pass
    const refractionPass = new RefractionPassTSL({
      id: 'refraction',
      colorInput: RESOURCES.SSR_OUTPUT,
      normalInput: RESOURCES.NORMAL_BUFFER,
      depthInput: RESOURCES.OBJECT_DEPTH,
      alternateDepthInput: RESOURCES.SCENE_COLOR,
      alternateDepthInputAttachment: 'depth',
      depthInputSelector: () =>
        ppStateRef.current.objectOnlyDepth ? RESOURCES.OBJECT_DEPTH : RESOURCES.SCENE_COLOR,
      outputResource: RESOURCES.REFRACTION_OUTPUT,
      ior: ppStateRef.current.refractionIOR,
      strength: ppStateRef.current.refractionStrength,
      chromaticAberration: ppStateRef.current.refractionChromaticAberration,
      enabled: (frame) => frame?.stores.postProcessing.refractionEnabled ?? false,
      skipPassthrough: true,
    })
    passRefs.current.refraction = refractionPass
    g.addPass(refractionPass)

    // Screen-space lensing pass (DEPRECATED for black hole)
    const lensingPass = new ScreenSpaceLensingPassTSL({
      id: 'lensing',
      colorInput: RESOURCES.REFRACTION_OUTPUT,
      depthInput: RESOURCES.SCENE_COLOR,
      depthInputAttachment: 'depth',
      outputResource: RESOURCES.LENSING_OUTPUT,
      intensity: blackHoleStateRef.current.deferredLensingStrength,
      mass: blackHoleStateRef.current.gravityStrength,
      distortionScale: blackHoleStateRef.current.bendScale,
      chromaticAberration: blackHoleStateRef.current.deferredLensingChromaticAberration,
      falloff: blackHoleStateRef.current.lensingFalloff,
      enabled: () => false, // DEPRECATED
      skipPassthrough: true,
    })
    passRefs.current.lensing = lensingPass
    g.addPass(lensingPass)

    // Combined ToneMapping + Cinematic pass
    const toneMappingCinematicPass = new ToneMappingCinematicPassTSL({
      id: 'toneMappingCinematic',
      colorInput: RESOURCES.LENSING_OUTPUT,
      outputResource: RESOURCES.TONEMAPPED_OUTPUT,
      toneMapping: TONE_MAPPING_TO_THREE[lightingState.toneMappingAlgorithm],
      exposure: lightingState.exposure,
      aberration: ppStateRef.current.cinematicAberration,
      vignette: ppStateRef.current.cinematicVignette,
      grain: ppStateRef.current.cinematicGrain,
      enabled: (frame) => {
        if (!frame) return false
        const cinematicEnabled = frame.stores.postProcessing.cinematicEnabled
        const toneMappingEnabled = lightingState.toneMappingEnabled
        return cinematicEnabled || toneMappingEnabled
      },
      skipPassthrough: true,
    })
    passRefs.current.toneMappingCinematic = toneMappingCinematicPass
    g.addPass(toneMappingCinematicPass)

    // Frame blending pass
    const frameBlendingPass = new FrameBlendingPassTSL({
      id: 'frameBlending',
      colorInput: RESOURCES.TONEMAPPED_OUTPUT,
      outputResource: RESOURCES.FRAME_BLENDING_OUTPUT,
      blendFactor: ppStateRef.current.frameBlendingFactor,
      enabled: (frame) => frame?.stores.postProcessing.frameBlendingEnabled ?? false,
      skipPassthrough: true,
    })
    passRefs.current.frameBlending = frameBlendingPass
    g.addPass(frameBlendingPass)

    // Paper texture pass
    const paperPass = new PaperTexturePassTSL({
      id: 'paper',
      colorInput: RESOURCES.FRAME_BLENDING_OUTPUT,
      outputResource: RESOURCES.PAPER_OUTPUT,
      contrast: ppStateRef.current.paperContrast,
      roughness: ppStateRef.current.paperRoughness,
      fiber: ppStateRef.current.paperFiber,
      fiberSize: ppStateRef.current.paperFiberSize,
      crumples: ppStateRef.current.paperCrumples,
      crumpleSize: ppStateRef.current.paperCrumpleSize,
      folds: ppStateRef.current.paperFolds,
      foldCount: ppStateRef.current.paperFoldCount,
      drops: ppStateRef.current.paperDrops,
      fade: ppStateRef.current.paperFade,
      seed: ppStateRef.current.paperSeed,
      colorFront: ppStateRef.current.paperColorFront,
      colorBack: ppStateRef.current.paperColorBack,
      quality: ppStateRef.current.paperQuality,
      intensity: ppStateRef.current.paperIntensity,
      enabled: (frame) => frame?.stores.postProcessing.paperEnabled ?? false,
      skipPassthrough: true,
    })
    passRefs.current.paper = paperPass
    g.addPass(paperPass)

    // Anti-aliasing pass (only add the active one to avoid multiple writers)
    // Graph is recreated when antiAliasingMethod changes (see dependency array)
    if (ppStateRef.current.antiAliasingMethod === 'fxaa') {
      const fxaaPass = new FXAAPassTSL({
        id: 'fxaa',
        colorInput: RESOURCES.PAPER_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
      })
      passRefs.current.fxaa = fxaaPass
      passRefs.current.smaa = undefined
      g.addPass(fxaaPass)
    } else if (ppStateRef.current.antiAliasingMethod === 'smaa') {
      const smaaPass = new SMAAPassTSL({
        id: 'smaa',
        colorInput: RESOURCES.PAPER_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
      })
      passRefs.current.smaa = smaaPass
      passRefs.current.fxaa = undefined
      g.addPass(smaaPass)
    } else {
      // No AA - use zero-cost resource aliasing instead of CopyPass
      // When this pass is disabled with skipPassthrough: true, the render graph
      // aliases AA_OUTPUT → PAPER_OUTPUT directly (no GPU copy needed).
      const aliasPass = new FXAAPassTSL({
        id: 'aaPassthrough',
        colorInput: RESOURCES.PAPER_OUTPUT,
        outputResource: RESOURCES.AA_OUTPUT,
        enabled: () => false, // Always disabled - we just need the aliasing
        skipPassthrough: true, // Trigger aliasing instead of passthrough copy
      })
      passRefs.current.fxaa = undefined
      passRefs.current.smaa = undefined
      g.addPass(aliasPass)
    }

    // ========================================================================
    // Buffer Preview and Output
    // ========================================================================

    // Buffer preview pass
    const bufferPreview = new BufferPreviewPassTSL({
      id: 'bufferPreview',
      bufferInput: RESOURCES.NORMAL_BUFFER,
      additionalInputs: [RESOURCES.OBJECT_DEPTH, RESOURCES.SCENE_COLOR, RESOURCES.NORMAL_BUFFER],
      outputResource: RESOURCES.PREVIEW_OUTPUT,
      bufferType: 'copy',
      depthMode: 'linear',
      enabled: (frame) => {
        if (!frame) return false
        const ui = frame.stores.ui
        return ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer
      },
      skipPassthrough: true,
    })
    passRefs.current.bufferPreview = bufferPreview
    g.addPass(bufferPreview)

    // Preview to screen
    g.addPass(
      new ToScreenPassTSL({
        id: 'previewToScreen',
        inputs: [{ resourceId: RESOURCES.PREVIEW_OUTPUT, access: 'read' }],
        gammaCorrection: false,
        toneMapping: false,
        enabled: (frame) => {
          if (!frame) return false
          const ui = frame.stores.ui
          return ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer
        },
      })
    )

    // Final to screen
    const toScreenPass = new ToScreenPassTSL({
      id: 'finalToScreen',
      inputs: [{ resourceId: RESOURCES.AA_OUTPUT, access: 'read' }],
      gammaCorrection: false,
      toneMapping: false,
      enabled: (frame) => {
        if (!frame) return true
        const ui = frame.stores.ui
        return !(ui.showDepthBuffer || ui.showNormalBuffer || ui.showTemporalDepthBuffer)
      },
    })
    passRefs.current.toScreen = toScreenPass
    g.addPass(toScreenPass)

    // Debug overlay pass
    g.addPass(
      new DebugOverlayPassTSL({
        id: 'debugOverlay',
      })
    )

    // Compile the graph
    g.compile()

    graphRef.current = g
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreCount, isPolytope, isBlackHole, ppState.antiAliasingMethod, lightingState.toneMappingEnabled])

  // ==========================================================================
  // Publish graph to store for external access
  // ==========================================================================

  useLayoutEffect(() => {
    const currentGraph = graphRef.current
    if (!currentGraph) return

    const { setGraph, setTemporalDepthPass, clear } = useRenderGraphStore.getState()
    setGraph(currentGraph as unknown as import('@/rendering/graph/RenderGraph').RenderGraph)
    setTemporalDepthPass(passRefs.current.temporalDepthCapture as unknown as import('@/rendering/graph/passes/TemporalDepthCapturePass').TemporalDepthCapturePass | null)

    return () => {
      clear()
    }
  }, [graph])

  // ==========================================================================
  // Update pass parameters when store changes
  // ==========================================================================

  useEffect(() => {
    const { gtao, bloom, ssr, bokeh, refraction, lensing, toneMappingCinematic } = passRefs.current

    if (gtao) {
      gtao.setIntensity?.(ppState.ssaoIntensity)
    }

    if (bloom) {
      bloom.setStrength?.(ppState.bloomIntensity)
      bloom.setRadius?.(ppState.bloomRadius)
      bloom.setThreshold?.(ppState.bloomThreshold)
      bloom.setSmoothing?.(ppState.bloomSmoothing)
      bloom.setLevels?.(ppState.bloomLevels)
    }

    if (ssr) {
      ssr.setIntensity?.(ppState.ssrIntensity)
      ssr.setMaxDistance?.(ppState.ssrMaxDistance)
      ssr.setThickness?.(ppState.ssrThickness)
    }

    if (bokeh) {
      bokeh.setFocus?.(ppState.bokehWorldFocusDistance)
      bokeh.setFocusRange?.(ppState.bokehWorldFocusRange)
      bokeh.setAperture?.(ppState.bokehScale * 0.005)
      bokeh.setMaxBlur?.(ppState.bokehScale * 0.02)
    }

    autoFocusDistanceRef.current = ppState.bokehWorldFocusDistance
    currentFocusRef.current = ppState.bokehWorldFocusDistance

    if (refraction) {
      refraction.setIOR?.(ppState.refractionIOR)
      refraction.setStrength?.(ppState.refractionStrength)
      refraction.setChromaticAberration?.(ppState.refractionChromaticAberration)
    }

    if (lensing) {
      lensing.setIntensity?.(blackHoleState.deferredLensingStrength)
      lensing.setMass?.(blackHoleState.gravityStrength)
      lensing.setDistortionScale?.(blackHoleState.bendScale)
      lensing.setFalloff?.(blackHoleState.lensingFalloff)
      lensing.setChromaticAberration?.(blackHoleState.deferredLensingChromaticAberration)
    }

    if (toneMappingCinematic) {
      toneMappingCinematic.setAberration?.(ppState.cinematicAberration)
      toneMappingCinematic.setVignette?.(ppState.cinematicVignette)
      toneMappingCinematic.setGrain?.(ppState.cinematicGrain)
      toneMappingCinematic.setToneMapping?.(TONE_MAPPING_TO_THREE[lightingState.toneMappingAlgorithm])
      toneMappingCinematic.setExposure?.(lightingState.exposure)
    }

    const frameBlending = passRefs.current.frameBlending
    if (frameBlending) {
      if (ppState.frameBlendingEnabled && !wasFrameBlendingEnabledRef.current) {
        frameBlending.onEnabled?.()
      }
      wasFrameBlendingEnabledRef.current = ppState.frameBlendingEnabled
      frameBlending.setBlendFactor?.(ppState.frameBlendingFactor)
    }

    const paper = passRefs.current.paper
    if (paper) {
      paper.setContrast?.(ppState.paperContrast)
      paper.setRoughness?.(ppState.paperRoughness)
      paper.setFiber?.(ppState.paperFiber)
      paper.setFiberSize?.(ppState.paperFiberSize)
      paper.setCrumples?.(ppState.paperCrumples)
      paper.setCrumpleSize?.(ppState.paperCrumpleSize)
      paper.setFolds?.(ppState.paperFolds)
      paper.setFoldCount?.(ppState.paperFoldCount)
      paper.setDrops?.(ppState.paperDrops)
      paper.setFade?.(ppState.paperFade)
      paper.setSeed?.(ppState.paperSeed)
      paper.setColorFront?.(ppState.paperColorFront)
      paper.setColorBack?.(ppState.paperColorBack)
      paper.setQuality?.(ppState.paperQuality)
      paper.setIntensity?.(ppState.paperIntensity)
    }

    if (passRefs.current.gravityComposite) {
      passRefs.current.gravityComposite.setShellConfig({
        enabled: blackHoleState.shellGlowStrength > 0,
        color: new THREE.Color(blackHoleState.shellGlowColor),
        strength: blackHoleState.shellGlowStrength,
      })
    }
  }, [ppState, blackHoleState, lightingState])

  // ==========================================================================
  // Update size
  // ==========================================================================

  useLayoutEffect(() => {
    const graphInstance = graphRef.current
    if (!graphInstance) return

    const dpr = viewport.dpr
    const nativeWidth = Math.floor(size.width * dpr)
    const nativeHeight = Math.floor(size.height * dpr)

    // CRITICAL FOR WEBGPU: Explicitly set renderer size
    // R3F's automatic resize may not update WebGPURenderer's internal depth buffer
    // This causes "depth stencil attachment size does not match" validation errors
    const renderer = gl as unknown as { setSize?: (w: number, h: number, updateStyle?: boolean) => void }
    if (renderer.setSize && nativeWidth > 0 && nativeHeight > 0) {
      renderer.setSize(nativeWidth, nativeHeight, false)
    }

    graphInstance.setSize(nativeWidth, nativeHeight, perfState.renderResolutionScale)
  }, [gl, graph, size.width, size.height, viewport.dpr, perfState.renderResolutionScale])

  // ==========================================================================
  // Initialize renderer
  // ==========================================================================

  useLayoutEffect(() => {
    const graphInstance = graphRef.current
    if (!graphInstance) return

    graphInstance.initializeRenderer?.(gl as unknown as SupportedRenderer)
  }, [gl, graph])

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      graphRef.current?.dispose()
      graphRef.current = null
    }
  }, [])

  // ==========================================================================
  // Main Render Loop
  // ==========================================================================

  // DEBUG: Simple solid color render to test R3F + WebGPU basic rendering
  const debugSceneRef = useRef<THREE.Scene | null>(null)
  const debugCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const debugMeshRef = useRef<THREE.Mesh | null>(null)

  useFrame((_, delta) => {
    const graphInstance = graphRef.current
    if (!graphInstance) return

    // DEBUG: Test if basic WebGPU rendering to screen works in R3F
    // Mode 1: Render simple red quad (tests R3F + WebGPU)
    // Mode 2: Render actual scene directly (tests if scene objects render)
    const DEBUG_SIMPLE_RENDER = false // Red quad test
    const DEBUG_RENDER_SCENE_DIRECT = false // Render actual scene to screen (skip render graph)
    const DEBUG_MINIMAL_GRAPH = false // Only use ScenePass + ToScreenPass (skip all intermediate)

    if (DEBUG_SIMPLE_RENDER) {
      if (!debugSceneRef.current) {
        debugSceneRef.current = new THREE.Scene()
        debugCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        const geometry = new THREE.PlaneGeometry(2, 2)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        debugMeshRef.current = new THREE.Mesh(geometry, material)
        debugMeshRef.current.frustumCulled = false
        debugSceneRef.current.add(debugMeshRef.current)
        console.log('[DEBUG] Created simple red quad for testing')
      }
      gl.setRenderTarget(null)
      ;(gl as THREE.WebGLRenderer).render(debugSceneRef.current, debugCameraRef.current!)
      return
    }

    if (DEBUG_RENDER_SCENE_DIRECT) {
      // Render the ACTUAL scene directly to screen, bypassing all passes
      gl.setRenderTarget(null)
      gl.setClearColor(0x222222)
      gl.clear()
      ;(gl as THREE.WebGLRenderer).render(scene, camera)
      console.log('[DEBUG] Rendered actual scene directly - children:', scene.children.length)
      return
    }

    if (DEBUG_MINIMAL_GRAPH) {
      // Minimal test: Render scene to a temp target, then sample directly to screen
      // This bypasses ALL aliasing and complex resource management
      const tempTarget = new THREE.WebGLRenderTarget(960, 540, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType, // Use simple format for testing
      })

      // Step 1: Render scene to temp target
      gl.setRenderTarget(tempTarget as THREE.WebGLRenderTarget)
      gl.setClearColor(0x333333)
      gl.clear()
      ;(gl as THREE.WebGLRenderer).render(scene, camera)

      // Step 2: Sample temp target to screen using ToScreenPassTSL pattern
      // Create fresh material with the actual texture
      const texNode = texture(tempTarget.texture)
      const material = new NodeMaterial()
      ;(material as unknown as { fragmentNode: unknown }).fragmentNode = texNode
      ;(material as unknown as { depthWrite: boolean }).depthWrite = false
      ;(material as unknown as { depthTest: boolean }).depthTest = false

      const debugScene = new THREE.Scene()
      const debugCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const debugMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
      debugMesh.frustumCulled = false
      debugScene.add(debugMesh)

      // Render to screen
      gl.setRenderTarget(null)
      ;(gl as THREE.WebGLRenderer).render(debugScene, debugCamera)

      console.log('[DEBUG] Minimal test: scene → tempTarget → screen')
      return
    }

    const pp = ppStateRef.current
    const ui = uiStateRef.current
    const perf = perfStateRef.current
    const blackHole = blackHoleStateRef.current

    const showDepthBuffer = ui.showDepthBuffer
    const showNormalBuffer = ui.showNormalBuffer
    const showTemporalDepthBuffer = ui.showTemporalDepthBuffer

    // Determine temporal cloud usage
    const temporalCloudAccumulation = perf.temporalReprojectionEnabled && !blackHole.schroedingerIsoEnabled
    const useTemporalCloud = needsVolumetricSeparation({
      temporalCloudAccumulation,
      objectType: objectTypeRef.current,
    })

    // Update object-depth layers
    const objectDepthLayers: number[] = [RENDER_LAYERS.MAIN_OBJECT]
    if (!useTemporalCloud) {
      objectDepthLayers.push(RENDER_LAYERS.VOLUMETRIC)
    }
    passRefs.current.objectDepth?.setLayers?.(objectDepthLayers)

    // Update scene clear color
    const env = envStateRef.current
    const clearColor = env.skyboxEnabled ? 0x000000 : env.backgroundColor
    passRefs.current.scenePass?.setClearColor?.(clearColor)
    passRefs.current.environmentScene?.setClearColor?.(clearColor)

    // Update SSR quality
    if (passRefs.current.ssr) {
      const effectiveQuality = getEffectiveSSRQuality(pp.ssrQuality as SSRQualityLevel, perf.qualityMultiplier)
      passRefs.current.ssr.setMaxSteps?.(SSR_QUALITY_STEPS[effectiveQuality] ?? 32)
    }

    // Update bokeh focus
    if (passRefs.current.bokeh && camera instanceof THREE.PerspectiveCamera) {
      let targetFocus = pp.bokehWorldFocusDistance

      if (pp.bokehFocusMode === 'auto-center' || pp.bokehFocusMode === 'auto-mouse') {
        const now = performance.now()
        if (now - lastRaycastTimeRef.current > AUTOFOCUS_RAYCAST_INTERVAL) {
          lastRaycastTimeRef.current = now
          autoFocusRaycaster.setFromCamera(screenCenter, camera)
          const intersects = autoFocusRaycaster.intersectObjects(scene.children, true)
          if (intersects.length > 0 && intersects[0]) {
            autoFocusDistanceRef.current = intersects[0].distance
          }
        }
        targetFocus = autoFocusDistanceRef.current
      }

      const smoothFactor = pp.bokehSmoothTime > 0 ? 1 - Math.exp(-delta / pp.bokehSmoothTime) : 1
      currentFocusRef.current += (targetFocus - currentFocusRef.current) * smoothFactor
      passRefs.current.bokeh.setFocus?.(currentFocusRef.current)
    }

    // Update lensing center
    if (passRefs.current.lensing && camera instanceof THREE.PerspectiveCamera) {
      projectedBlackHole.copy(blackHoleWorldPosition).project(camera)
      const centerX = (projectedBlackHole.x + 1) * 0.5
      const centerY = (projectedBlackHole.y + 1) * 0.5
      passRefs.current.lensing.setCenter?.(centerX, centerY)

      const distance = camera.position.distanceTo(blackHoleWorldPosition)
      const fovY = (camera.fov * Math.PI) / 180
      const screenHeight = 2 * distance * Math.tan(fovY / 2)
      const horizonRadiusUV = screenHeight > 0 ? blackHole.horizonRadius / screenHeight : 0.05
      passRefs.current.lensing.setHorizonRadius?.(horizonRadiusUV * blackHole.deferredLensingRadius)
    }

    // Configure buffer preview
    if (passRefs.current.bufferPreview && camera instanceof THREE.PerspectiveCamera) {
      if (showDepthBuffer) {
        passRefs.current.bufferPreview.setBufferType('depth')
        passRefs.current.bufferPreview.setDepthMode('linear')
        const depthTexture = pp.objectOnlyDepth
          ? graphInstance.getTexture(RESOURCES.OBJECT_DEPTH)
          : graphInstance.getTexture(RESOURCES.SCENE_COLOR, 'depth')
        passRefs.current.bufferPreview.setExternalTexture(depthTexture)
      } else if (showNormalBuffer) {
        passRefs.current.bufferPreview.setBufferType('normal')
        passRefs.current.bufferPreview.setExternalTexture(null)
        passRefs.current.bufferPreview.setBufferInput(RESOURCES.NORMAL_BUFFER)
      } else if (showTemporalDepthBuffer) {
        const objectType = objectTypeRef.current
        if (usesTemporalDepth(objectType)) {
          passRefs.current.bufferPreview.setBufferType('temporalDepth')
          const temporalUniforms = passRefs.current.temporalDepthCapture?.getTemporalUniforms?.(graphInstance, true)
          passRefs.current.bufferPreview.setExternalTexture(temporalUniforms?.uPrevDepthTexture ?? null)
        } else if (usesTemporalCloud(objectType)) {
          passRefs.current.bufferPreview.setBufferType('temporalDepth')
          passRefs.current.bufferPreview.setExternalTexture(
            graphInstance.getTexture(RESOURCES.TEMPORAL_ACCUMULATION, 0)
          )
        } else {
          useUIStore.getState().setShowTemporalDepthBuffer(false)
        }
      } else {
        passRefs.current.bufferPreview.setExternalTexture(null)
      }
    }

    // Execute the graph
    graphInstance.execute(
      gl as unknown as SupportedRenderer,
      scene,
      camera,
      delta,
      0 // time parameter (not used - graph tracks time internally)
    )

    // Update buffer stats periodically
    bufferStatsTimeRef.current += delta
    if (bufferStatsTimeRef.current >= 1.0) {
      bufferStatsTimeRef.current = 0

      const dims = graphInstance.getResourceDimensions?.()
      if (dims) {
        usePerformanceMetricsStore.getState().updateBufferStats({
          screen: dims.get(RESOURCES.SCENE_COLOR) ?? { width: 0, height: 0 },
          depth: dims.get(RESOURCES.OBJECT_DEPTH) ?? { width: 0, height: 0 },
          normal: dims.get(RESOURCES.NORMAL_ENV) ?? { width: 0, height: 0 },
          temporal: dims.get(RESOURCES.TEMPORAL_DEPTH_OUTPUT) ?? { width: 0, height: 0 },
        })
      }
    }
  }, FRAME_PRIORITY.POST_EFFECTS)

  return null
})
