/**
 * Frame Context
 *
 * Captures and freezes store state at frame start for consistent rendering.
 * Passes read from this frozen context rather than live stores, preventing
 * race conditions between React updates and rendering.
 *
 * ## Industry Pattern
 * Based on Frostbite's "Frame Parameters" and Unreal's "FSceneView" -
 * all rendering state is frozen at frame start and remains immutable
 * throughout the frame.
 *
 * ## Critical Stores
 * Only 6 stores are captured for performance:
 * - animation: Time and playback state
 * - geometry: Object type and dimension
 * - environment: Fog, skybox, ground settings
 * - postProcessing: Effect parameters
 * - performance: Quality settings
 * - blackHole: Black hole visualization state
 *
 * @module rendering/graph/FrameContext
 */

import * as THREE from 'three'

import type { BlackHoleConfig } from '@/lib/geometry/extended/types'
import type { ObjectType } from '@/lib/geometry/types'
import type { WallPosition } from '@/stores/defaults/visualDefaults'
import type { FogSliceState } from '@/stores/slices/fogSlice'
import type { GroundSliceState } from '@/stores/slices/groundSlice'
import type { PostProcessingSliceState } from '@/stores/slices/postProcessingSlice'
import type { SkyboxSliceState } from '@/stores/slices/skyboxSlice'

// =============================================================================
// Frozen Store State Types
// =============================================================================

/**
 * Frozen animation store state.
 */
export interface FrozenAnimationState {
  readonly accumulatedTime: number
  readonly speed: number
  readonly isPlaying: boolean
  readonly direction: 1 | -1
  readonly animatingPlanes: ReadonlySet<string>
}

/**
 * Frozen geometry store state.
 */
export interface FrozenGeometryState {
  readonly objectType: ObjectType
  readonly dimension: number
}

/**
 * Frozen environment store state.
 * Combines fog, skybox, and ground settings.
 */
export interface FrozenEnvironmentState {
  // Fog
  readonly fogEnabled: boolean
  readonly fogDensity: number
  readonly fogColor: string
  readonly fogHeight: number
  readonly fogFalloff: number
  readonly fogNoiseScale: number
  readonly fogNoiseSpeed: readonly [number, number, number]
  readonly fogScattering: number
  readonly volumetricShadows: boolean

  // Skybox
  readonly skyboxEnabled: boolean
  readonly skyboxMode: SkyboxSliceState['skyboxMode']
  readonly skyboxTexture: SkyboxSliceState['skyboxTexture']
  readonly skyboxBlur: number
  readonly skyboxIntensity: number
  readonly skyboxRotation: number
  readonly skyboxAnimationMode: SkyboxSliceState['skyboxAnimationMode']
  readonly skyboxAnimationSpeed: number
  readonly skyboxHighQuality: boolean
  readonly skyboxLoading: boolean
  readonly classicCubeTexture: THREE.CubeTexture | null

  // Ground (for environment capture decisions)
  readonly activeWalls: readonly WallPosition[]
}

/**
 * Frozen post-processing store state.
 */
export interface FrozenPostProcessingState {
  // Bloom
  readonly bloomEnabled: boolean
  readonly bloomIntensity: number
  readonly bloomThreshold: number
  readonly bloomRadius: number

  // Bokeh (Depth of Field)
  readonly bokehEnabled: boolean
  readonly bokehFocusMode: PostProcessingSliceState['bokehFocusMode']
  readonly bokehBlurMethod: PostProcessingSliceState['bokehBlurMethod']
  readonly bokehWorldFocusDistance: number
  readonly bokehWorldFocusRange: number
  readonly bokehScale: number
  readonly bokehFocalLength: number
  readonly bokehSmoothTime: number
  readonly bokehShowDebug: boolean

  // SSR (Screen-Space Reflections)
  readonly ssrEnabled: boolean
  readonly ssrIntensity: number
  readonly ssrMaxDistance: number
  readonly ssrThickness: number
  readonly ssrFadeStart: number
  readonly ssrFadeEnd: number
  readonly ssrQuality: PostProcessingSliceState['ssrQuality']

  // Screen-Space Refraction
  readonly refractionEnabled: boolean
  readonly refractionIOR: number
  readonly refractionStrength: number
  readonly refractionChromaticAberration: number

  // Anti-aliasing
  readonly antiAliasingMethod: PostProcessingSliceState['antiAliasingMethod']
  readonly smaaThreshold: number

  // Cinematic
  readonly cinematicEnabled: boolean
  readonly cinematicAberration: number
  readonly cinematicVignette: number
  readonly cinematicGrain: number

  // Depth Buffer
  readonly objectOnlyDepth: boolean

  // SSAO
  readonly ssaoEnabled: boolean
  readonly ssaoIntensity: number

  // Screen-Space Lensing
  readonly lensingEnabled: boolean
  readonly lensingIntensity: number
  readonly lensingMass: number
  readonly lensingDistortionScale: number
  readonly lensingChromaticAberration: number
  readonly lensingCenterX: number
  readonly lensingCenterY: number
}

/**
 * Frozen performance store state.
 */
export interface FrozenPerformanceState {
  readonly isInteracting: boolean
  readonly sceneTransitioning: boolean
  readonly progressiveRefinementEnabled: boolean
  readonly qualityMultiplier: number
  readonly refinementStage: 'low' | 'medium' | 'high' | 'final'
  readonly temporalReprojectionEnabled: boolean
  readonly cameraTeleported: boolean
  readonly fractalAnimationLowQuality: boolean
  readonly isShaderCompiling: boolean
}

/**
 * Frozen black hole store state.
 * Only captures render-critical fields.
 */
export interface FrozenBlackHoleState {
  readonly scale: number
  readonly horizonRadius: number
  readonly spin: number
  readonly gravityStrength: number
  readonly manifoldIntensity: number
  readonly manifoldThickness: number
  readonly timeScale: number
  readonly baseColor: string
  readonly paletteMode: BlackHoleConfig['paletteMode']
  readonly bendScale: number
  readonly rayBendingMode: BlackHoleConfig['rayBendingMode']
  readonly maxSteps: number
  readonly stepBase: number
  readonly deferredLensingEnabled: boolean
  readonly deferredLensingStrength: number
  readonly screenSpaceLensingEnabled: boolean
  readonly skyCubemapResolution: BlackHoleConfig['skyCubemapResolution']
  readonly temporalAccumulationEnabled: boolean
}

/**
 * Frozen UI store state (debug toggles only).
 * Only captures fields needed by pass enabled() callbacks.
 */
export interface FrozenUIState {
  readonly showDepthBuffer: boolean
  readonly showNormalBuffer: boolean
  readonly showTemporalDepthBuffer: boolean
}

/**
 * All frozen store state.
 */
export interface FrozenStoreState {
  readonly animation: FrozenAnimationState
  readonly geometry: FrozenGeometryState
  readonly environment: FrozenEnvironmentState
  readonly postProcessing: FrozenPostProcessingState
  readonly performance: FrozenPerformanceState
  readonly blackHole: FrozenBlackHoleState
  readonly ui: FrozenUIState
}

// =============================================================================
// Frozen External State
// =============================================================================

/**
 * Frozen external state captured from Three.js scene.
 */
export interface FrozenExternalState {
  readonly sceneBackground: THREE.Texture | THREE.Color | null
  readonly sceneEnvironment: THREE.Texture | null
}

// =============================================================================
// Frozen Camera State
// =============================================================================

/**
 * Frozen camera state.
 */
export interface FrozenCameraState {
  readonly position: THREE.Vector3
  readonly matrixWorld: THREE.Matrix4
  readonly matrixWorldInverse: THREE.Matrix4
  readonly projectionMatrix: THREE.Matrix4
  readonly projectionMatrixInverse: THREE.Matrix4
}

// =============================================================================
// Frozen Frame Context
// =============================================================================

/**
 * Complete frozen frame context.
 *
 * Captures all rendering-relevant state at frame start.
 * Immutable throughout frame execution.
 */
export interface FrozenFrameContext {
  /** Frame number (monotonically increasing) */
  readonly frameNumber: number

  /** Frozen store state */
  readonly stores: FrozenStoreState

  /** Frozen external state (scene.background, etc.) */
  readonly external: FrozenExternalState

  /** Frozen camera state */
  readonly camera: FrozenCameraState
}

// =============================================================================
// Store Getters Type
// =============================================================================

/**
 * Store getter functions for capturing state.
 * These are provided by the caller to avoid direct store imports.
 */
export interface StoreGetters {
  getAnimationState: () => {
    accumulatedTime: number
    speed: number
    isPlaying: boolean
    direction: 1 | -1
    animatingPlanes: Set<string>
  }
  getGeometryState: () => {
    objectType: ObjectType
    dimension: number
  }
  getEnvironmentState: () => {
    fog: FogSliceState
    skybox: SkyboxSliceState
    ground: GroundSliceState
  }
  getPostProcessingState: () => PostProcessingSliceState
  getPerformanceState: () => {
    isInteracting: boolean
    sceneTransitioning: boolean
    progressiveRefinementEnabled: boolean
    qualityMultiplier: number
    refinementStage: 'low' | 'medium' | 'high' | 'final'
    temporalReprojectionEnabled: boolean
    cameraTeleported: boolean
    fractalAnimationLowQuality: boolean
    isShaderCompiling: boolean
  }
  getBlackHoleState: () => BlackHoleConfig
  getUIState: () => {
    showDepthBuffer: boolean
    showNormalBuffer: boolean
    showTemporalDepthBuffer: boolean
  }
}

// =============================================================================
// Capture Functions
// =============================================================================

/**
 * Capture frozen animation state.
 */
function captureAnimationState(
  getter: StoreGetters['getAnimationState']
): FrozenAnimationState {
  const state = getter()
  return {
    accumulatedTime: state.accumulatedTime,
    speed: state.speed,
    isPlaying: state.isPlaying,
    direction: state.direction,
    // Create a frozen copy of the Set
    animatingPlanes: new Set(state.animatingPlanes),
  }
}

/**
 * Capture frozen geometry state.
 */
function captureGeometryState(
  getter: StoreGetters['getGeometryState']
): FrozenGeometryState {
  const state = getter()
  return {
    objectType: state.objectType,
    dimension: state.dimension,
  }
}

/**
 * Capture frozen environment state.
 */
function captureEnvironmentState(
  getter: StoreGetters['getEnvironmentState']
): FrozenEnvironmentState {
  const { fog, skybox, ground } = getter()
  return {
    // Fog
    fogEnabled: fog.fogEnabled,
    fogDensity: fog.fogDensity,
    fogColor: fog.fogColor,
    fogHeight: fog.fogHeight,
    fogFalloff: fog.fogFalloff,
    fogNoiseScale: fog.fogNoiseScale,
    fogNoiseSpeed: [...fog.fogNoiseSpeed] as [number, number, number],
    fogScattering: fog.fogScattering,
    volumetricShadows: fog.volumetricShadows,

    // Skybox
    skyboxEnabled: skybox.skyboxEnabled,
    skyboxMode: skybox.skyboxMode,
    skyboxTexture: skybox.skyboxTexture,
    skyboxBlur: skybox.skyboxBlur,
    skyboxIntensity: skybox.skyboxIntensity,
    skyboxRotation: skybox.skyboxRotation,
    skyboxAnimationMode: skybox.skyboxAnimationMode,
    skyboxAnimationSpeed: skybox.skyboxAnimationSpeed,
    skyboxHighQuality: skybox.skyboxHighQuality,
    skyboxLoading: skybox.skyboxLoading,
    classicCubeTexture: skybox.classicCubeTexture,

    // Ground
    activeWalls: [...ground.activeWalls],
  }
}

/**
 * Capture frozen post-processing state.
 */
function capturePostProcessingState(
  getter: StoreGetters['getPostProcessingState']
): FrozenPostProcessingState {
  const state = getter()
  return {
    // Bloom
    bloomEnabled: state.bloomEnabled,
    bloomIntensity: state.bloomIntensity,
    bloomThreshold: state.bloomThreshold,
    bloomRadius: state.bloomRadius,

    // Bokeh
    bokehEnabled: state.bokehEnabled,
    bokehFocusMode: state.bokehFocusMode,
    bokehBlurMethod: state.bokehBlurMethod,
    bokehWorldFocusDistance: state.bokehWorldFocusDistance,
    bokehWorldFocusRange: state.bokehWorldFocusRange,
    bokehScale: state.bokehScale,
    bokehFocalLength: state.bokehFocalLength,
    bokehSmoothTime: state.bokehSmoothTime,
    bokehShowDebug: state.bokehShowDebug,

    // SSR
    ssrEnabled: state.ssrEnabled,
    ssrIntensity: state.ssrIntensity,
    ssrMaxDistance: state.ssrMaxDistance,
    ssrThickness: state.ssrThickness,
    ssrFadeStart: state.ssrFadeStart,
    ssrFadeEnd: state.ssrFadeEnd,
    ssrQuality: state.ssrQuality,

    // Refraction
    refractionEnabled: state.refractionEnabled,
    refractionIOR: state.refractionIOR,
    refractionStrength: state.refractionStrength,
    refractionChromaticAberration: state.refractionChromaticAberration,

    // Anti-aliasing
    antiAliasingMethod: state.antiAliasingMethod,
    smaaThreshold: state.smaaThreshold,

    // Cinematic
    cinematicEnabled: state.cinematicEnabled,
    cinematicAberration: state.cinematicAberration,
    cinematicVignette: state.cinematicVignette,
    cinematicGrain: state.cinematicGrain,

    // Depth Buffer
    objectOnlyDepth: state.objectOnlyDepth,

    // SSAO
    ssaoEnabled: state.ssaoEnabled,
    ssaoIntensity: state.ssaoIntensity,

    // Lensing
    lensingEnabled: state.lensingEnabled,
    lensingIntensity: state.lensingIntensity,
    lensingMass: state.lensingMass,
    lensingDistortionScale: state.lensingDistortionScale,
    lensingChromaticAberration: state.lensingChromaticAberration,
    lensingCenterX: state.lensingCenterX,
    lensingCenterY: state.lensingCenterY,
  }
}

/**
 * Capture frozen performance state.
 */
function capturePerformanceState(
  getter: StoreGetters['getPerformanceState']
): FrozenPerformanceState {
  const state = getter()
  return {
    isInteracting: state.isInteracting,
    sceneTransitioning: state.sceneTransitioning,
    progressiveRefinementEnabled: state.progressiveRefinementEnabled,
    qualityMultiplier: state.qualityMultiplier,
    refinementStage: state.refinementStage,
    temporalReprojectionEnabled: state.temporalReprojectionEnabled,
    cameraTeleported: state.cameraTeleported,
    fractalAnimationLowQuality: state.fractalAnimationLowQuality,
    isShaderCompiling: state.isShaderCompiling,
  }
}

/**
 * Capture frozen black hole state.
 */
function captureBlackHoleState(
  getter: StoreGetters['getBlackHoleState']
): FrozenBlackHoleState {
  const state = getter()
  return {
    scale: state.scale,
    horizonRadius: state.horizonRadius,
    spin: state.spin,
    gravityStrength: state.gravityStrength,
    manifoldIntensity: state.manifoldIntensity,
    manifoldThickness: state.manifoldThickness,
    timeScale: state.timeScale,
    baseColor: state.baseColor,
    paletteMode: state.paletteMode,
    bendScale: state.bendScale,
    rayBendingMode: state.rayBendingMode,
    maxSteps: state.maxSteps,
    stepBase: state.stepBase,
    deferredLensingEnabled: state.deferredLensingEnabled,
    deferredLensingStrength: state.deferredLensingStrength,
    screenSpaceLensingEnabled: state.screenSpaceLensingEnabled,
    skyCubemapResolution: state.skyCubemapResolution,
    temporalAccumulationEnabled: state.temporalAccumulationEnabled,
  }
}

/**
 * Capture frozen UI state (debug toggles only).
 */
function captureUIState(
  getter: StoreGetters['getUIState']
): FrozenUIState {
  const state = getter()
  return {
    showDepthBuffer: state.showDepthBuffer,
    showNormalBuffer: state.showNormalBuffer,
    showTemporalDepthBuffer: state.showTemporalDepthBuffer,
  }
}

/**
 * Capture frozen camera state.
 */
function captureCameraState(camera: THREE.Camera): FrozenCameraState {
  return {
    position: camera.position.clone(),
    matrixWorld: camera.matrixWorld.clone(),
    matrixWorldInverse: camera.matrixWorldInverse.clone(),
    projectionMatrix: camera.projectionMatrix.clone(),
    projectionMatrixInverse: camera.projectionMatrixInverse.clone(),
  }
}

/**
 * Capture frozen external state from scene.
 */
function captureExternalState(scene: THREE.Scene): FrozenExternalState {
  return {
    sceneBackground: scene.background,
    sceneEnvironment: scene.environment,
  }
}

// =============================================================================
// Main Capture Function
// =============================================================================

/**
 * Capture complete frozen frame context.
 *
 * Call this ONCE at frame start, before any pass execution.
 * The returned context is immutable and should be passed to all passes.
 *
 * @param frameNumber - Current frame number
 * @param scene - Three.js scene
 * @param camera - Three.js camera
 * @param storeGetters - Functions to get store state
 * @returns Frozen frame context
 */
export function captureFrameContext(
  frameNumber: number,
  scene: THREE.Scene,
  camera: THREE.Camera,
  storeGetters: StoreGetters
): FrozenFrameContext {
  return {
    frameNumber,
    stores: {
      animation: captureAnimationState(storeGetters.getAnimationState),
      geometry: captureGeometryState(storeGetters.getGeometryState),
      environment: captureEnvironmentState(storeGetters.getEnvironmentState),
      postProcessing: capturePostProcessingState(storeGetters.getPostProcessingState),
      performance: capturePerformanceState(storeGetters.getPerformanceState),
      blackHole: captureBlackHoleState(storeGetters.getBlackHoleState),
      ui: captureUIState(storeGetters.getUIState),
    },
    external: captureExternalState(scene),
    camera: captureCameraState(camera),
  }
}

/**
 * Create empty/default frozen frame context.
 *
 * Useful for initialization before first real capture.
 */
export function createEmptyFrameContext(): FrozenFrameContext {
  return {
    frameNumber: -1,
    stores: {
      animation: {
        accumulatedTime: 0,
        speed: 1,
        isPlaying: false,
        direction: 1,
        animatingPlanes: new Set(),
      },
      geometry: {
        objectType: 'hypercube',
        dimension: 4,
      },
      environment: {
        fogEnabled: false,
        fogDensity: 0.05,
        fogColor: '#e5e2e2',
        fogHeight: 15.0,
        fogFalloff: 0.08,
        fogNoiseScale: 0.15,
        fogNoiseSpeed: [0.02, 0, 0.02],
        fogScattering: 0.3,
        volumetricShadows: true,
        skyboxEnabled: false,
        skyboxMode: 'classic',
        skyboxTexture: 'none',
        skyboxBlur: 0,
        skyboxIntensity: 1,
        skyboxRotation: 0,
        skyboxAnimationMode: 'none',
        skyboxAnimationSpeed: 0.5,
        skyboxHighQuality: true,
        skyboxLoading: false,
        classicCubeTexture: null,
        activeWalls: [],
      },
      postProcessing: {
        bloomEnabled: true,
        bloomIntensity: 0.5,
        bloomThreshold: 0.5,
        bloomRadius: 0.5,
        bokehEnabled: false,
        bokehFocusMode: 'auto-center',
        bokehBlurMethod: 'hexagonal',
        bokehWorldFocusDistance: 10,
        bokehWorldFocusRange: 10,
        bokehScale: 1,
        bokehFocalLength: 0.05,
        bokehSmoothTime: 0.3,
        bokehShowDebug: false,
        ssrEnabled: false,
        ssrIntensity: 0.5,
        ssrMaxDistance: 10,
        ssrThickness: 0.1,
        ssrFadeStart: 0.7,
        ssrFadeEnd: 0.9,
        ssrQuality: 'medium',
        refractionEnabled: false,
        refractionIOR: 1.5,
        refractionStrength: 0.5,
        refractionChromaticAberration: 0,
        antiAliasingMethod: 'smaa',
        smaaThreshold: 0.1,
        cinematicEnabled: false,
        cinematicAberration: 0.005,
        cinematicVignette: 1.2,
        cinematicGrain: 0,
        objectOnlyDepth: false,
        ssaoEnabled: false,
        ssaoIntensity: 1,
        lensingEnabled: false,
        lensingIntensity: 1,
        lensingMass: 1,
        lensingDistortionScale: 1,
        lensingChromaticAberration: 0,
        lensingCenterX: 0.5,
        lensingCenterY: 0.5,
      },
      performance: {
        isInteracting: false,
        sceneTransitioning: false,
        progressiveRefinementEnabled: true,
        qualityMultiplier: 1,
        refinementStage: 'final',
        temporalReprojectionEnabled: false,
        cameraTeleported: false,
        fractalAnimationLowQuality: true,
        isShaderCompiling: false,
      },
      blackHole: {
        scale: 0.5,
        horizonRadius: 1,
        spin: 0,
        gravityStrength: 1,
        manifoldIntensity: 1,
        manifoldThickness: 0.15,
        timeScale: 1,
        baseColor: '#ffffff',
        paletteMode: 'diskGradient',
        bendScale: 1,
        rayBendingMode: 'spiral',
        maxSteps: 128,
        stepBase: 0.1,
        deferredLensingEnabled: false,
        deferredLensingStrength: 1,
        screenSpaceLensingEnabled: false,
        skyCubemapResolution: 512,
        temporalAccumulationEnabled: false,
      },
      ui: {
        showDepthBuffer: false,
        showNormalBuffer: false,
        showTemporalDepthBuffer: false,
      },
    },
    external: {
      sceneBackground: null,
      sceneEnvironment: null,
    },
    camera: {
      position: new THREE.Vector3(0, 0, 5),
      matrixWorld: new THREE.Matrix4(),
      matrixWorldInverse: new THREE.Matrix4(),
      projectionMatrix: new THREE.Matrix4(),
      projectionMatrixInverse: new THREE.Matrix4(),
    },
  }
}
