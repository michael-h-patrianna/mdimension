/**
 * Cubemap Capture Pass (TSL)
 *
 * Handles cubemap environment maps for both procedural and classic skyboxes:
 *
 * 1. PROCEDURAL MODE: Captures the SKYBOX layer to a CubeRenderTarget
 * 2. CLASSIC MODE: Captures the SKYBOX layer (displaying KTX2 texture) to a CubeRenderTarget
 *    to ensure mipmaps are generated for proper roughness-based IBL.
 *
 * For both modes, generates PMREM for PBR reflections and exports via ctx.queueExport:
 * - scene.background (captured CubeTexture) - for black hole gravitational lensing
 * - scene.environment (PMREM texture) - for wall PBR reflections
 *
 * TSL port of the WebGL CubemapCapturePass with identical behavior.
 *
 * NOTE: This pass currently uses WebGL-specific features (WebGLCubeRenderTarget, PMREMGenerator)
 * and will skip execution when using WebGPU. Future versions may add native WebGPU cubemap support.
 *
 * @module rendering/graph-tsl/passes/CubemapCapturePassTSL
 */

import * as THREE from 'three'

import { RENDER_LAYERS } from '@/rendering/core/layers'
import { BasePassTSL } from '../BasePassTSL'
import { getGlobalMRTManager } from '@/rendering/graph/MRTStateManager'
import { TemporalResource } from '@/rendering/graph/TemporalResource'
import type { RenderContextTSL } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for CubemapCapturePassTSL.
 */
export interface CubemapCapturePassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Resolution per cube face for scene.background (default 256) */
  backgroundResolution?: number
  /** Resolution for PMREM environment map (default 256) - reserved for future use */
  environmentResolution?: number
  /** Whether to generate PMREM for scene.environment (for wall reflections) */
  generatePMREM?: () => boolean
  /** Callback to get external CubeTexture for classic skybox mode */
  getExternalCubeTexture?: () => THREE.CubeTexture | null
}

/**
 * Pass that handles cubemap environment maps for:
 * - Black hole gravitational lensing (scene.background)
 * - Wall PBR reflections (scene.environment via PMREM)
 *
 * Works in two modes (unified pipeline):
 * - PROCEDURAL: Captures SKYBOX layer (procedural shader) to CubeRenderTarget
 * - CLASSIC: Captures SKYBOX layer (KTX2 texture on mesh) to CubeRenderTarget
 *
 * Unification ensures that we always have a mipmapped CubeTexture for scene.background,
 * solving issues where KTX2 textures lack mipmaps and cause black rendering in shaders
 * using textureLod().
 */
export class CubemapCapturePassTSL extends BasePassTSL {
  // Background capture
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget | null = null
  private cubeCamera: THREE.CubeCamera | null = null
  private backgroundResolution: number

  // PMREM for environment (for walls)
  private pmremGenerator: THREE.PMREMGenerator | null = null
  private pmremRenderTarget: THREE.WebGLRenderTarget | null = null
  private generatePMREM: () => boolean

  // External texture tracking
  private getExternalCubeTexture: () => THREE.CubeTexture | null
  private lastExternalTextureUuid: string | null = null
  // Track skybox mode to detect procedural/classic changes
  private lastSkyboxMode: string | null = null

  // Temporal cubemap history (2-frame buffer for proper initialization)
  private cubemapHistory: TemporalResource<THREE.WebGLCubeRenderTarget> | null = null

  // Capture control
  private needsCapture = true
  private didCaptureThisFrame = false
  private pendingPMREMDispose: THREE.WebGLRenderTarget | null = null

  // Capture throttling - update every N frames for performance
  private captureFrameCounter = 0
  private pmremFrameCounter = 0
  private static readonly CAPTURE_UPDATE_INTERVAL = 3
  private static readonly PMREM_UPDATE_INTERVAL = 2

  constructor(config: CubemapCapturePassTSLConfig) {
    super({
      ...config,
      inputs: [],
      outputs: [],
    })

    this.backgroundResolution = config.backgroundResolution ?? 256
    this.generatePMREM = config.generatePMREM ?? (() => false)
    this.getExternalCubeTexture = config.getExternalCubeTexture ?? (() => null)
  }

  /**
   * Initialize the cube camera and render target for background capture.
   */
  private ensureCubeCamera(): void {
    if (this.cubeRenderTarget && this.cubeCamera) return

    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(this.backgroundResolution, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    })

    // Set mapping for black hole shader compatibility (samplerCube)
    this.cubeRenderTarget.texture.mapping = THREE.CubeReflectionMapping

    this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget)

    // Only capture SKYBOX layer - exclude MAIN_OBJECT (black hole itself)
    this.cubeCamera.layers.disableAll()
    this.cubeCamera.layers.enable(RENDER_LAYERS.SKYBOX)
  }

  /**
   * Initialize PMREMGenerator for environment map conversion.
   */
  private ensurePMREMGenerator(renderer: THREE.WebGLRenderer): void {
    if (this.pmremGenerator) return

    this.pmremGenerator = new THREE.PMREMGenerator(renderer)
    this.pmremGenerator.compileEquirectangularShader()
  }

  /**
   * Request a new capture on next frame.
   */
  requestCapture(): void {
    this.needsCapture = true
    this.cubemapHistory?.invalidateHistory()
  }

  /**
   * Set the background capture resolution.
   */
  setBackgroundResolution(resolution: number): void {
    if (resolution !== this.backgroundResolution) {
      this.backgroundResolution = resolution
      this.disposeTemporalHistory()
      this.requestCapture()
    }
  }

  /**
   * Get the captured cubemap texture.
   */
  getCubemapTexture(): THREE.CubeTexture | null {
    if (this.cubemapHistory?.hasValidHistory(1)) {
      return this.cubemapHistory.getRead(1).texture
    }
    return null
  }

  /**
   * Get the PMREM texture.
   */
  getPMREMTexture(): THREE.Texture | null {
    return this.pmremRenderTarget?.texture ?? null
  }

  execute(ctx: RenderContextTSL): void {
    // Reset frame state
    this.didCaptureThisFrame = false

    // WebGPU guard: This pass uses WebGL-specific features (WebGLCubeRenderTarget, PMREMGenerator)
    // Skip execution when using WebGPU - future versions may add native WebGPU cubemap support
    if (ctx.isWebGPU) {
      return
    }

    const { renderer, scene } = ctx

    // Get environment state for smart capture throttling
    const env = ctx.frame?.stores?.environment
    const currentSkyboxMode = env?.skyboxMode ?? null

    // Check for skybox mode changes (procedural <-> classic)
    if (currentSkyboxMode !== this.lastSkyboxMode) {
      this.lastSkyboxMode = currentSkyboxMode
      this.requestCapture()
    }

    // Check for external texture changes (classic mode)
    const externalTexture = this.getExternalCubeTexture()
    if (externalTexture) {
      if (externalTexture.uuid !== this.lastExternalTextureUuid) {
        this.lastExternalTextureUuid = externalTexture.uuid
        this.requestCapture()
      }
    } else {
      if (this.lastExternalTextureUuid !== null) {
        this.lastExternalTextureUuid = null
        this.requestCapture()
      }
    }

    // Always use capture path - unifies Procedural and Classic modes
    this.executeCapture(ctx, renderer as THREE.WebGLRenderer, scene)

    // SMART CAPTURE THROTTLING: Only request continuous capture if skybox is animating
    const isPlaying = ctx.frame?.stores?.animation?.isPlaying ?? false
    const isAnimating = this.isSkyboxAnimating(env, isPlaying)
    if (isAnimating) {
      this.needsCapture = true
    }
  }

  /**
   * Determine if the skybox is currently animating.
   */
  private isSkyboxAnimating(
    env:
      | {
          skyboxMode?: string
          skyboxAnimationMode?: string
          skyboxAnimationSpeed?: number
          skyboxTimeScale?: number
        }
      | undefined,
    isPlaying: boolean
  ): boolean {
    if (!env) return true

    if (!isPlaying) return false

    const isClassic = env.skyboxMode === 'classic'

    if (isClassic) {
      const hasAnimationMode = env.skyboxAnimationMode !== 'none'
      const hasAnimationSpeed = (env.skyboxAnimationSpeed ?? 0) > 0
      return hasAnimationMode && hasAnimationSpeed
    } else {
      const hasTimeScale = (env.skyboxTimeScale ?? 0) > 0
      const hasRotation = (env.skyboxAnimationSpeed ?? 0) > 0 && env.skyboxAnimationMode !== 'none'
      return hasTimeScale || hasRotation
    }
  }

  /**
   * Capture SKYBOX layer to CubeRenderTarget.
   */
  private executeCapture(
    ctx: RenderContextTSL,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    this.ensureTemporalHistory()
    if (!this.cubemapHistory) return

    this.ensureCubeCamera()
    if (!this.cubeCamera) return

    // 1. Capture Logic (Conditional, with throttling)
    this.captureFrameCounter++
    const shouldCapture =
      this.needsCapture &&
      (!this.cubemapHistory?.hasValidHistory(0) ||
        this.captureFrameCounter >= CubemapCapturePassTSL.CAPTURE_UPDATE_INTERVAL)

    if (shouldCapture) {
      this.captureFrameCounter = 0

      // Count objects on SKYBOX layer
      let skyboxObjectCount = 0
      scene.traverse((obj) => {
        if (obj.layers.test(this.cubeCamera!.layers)) skyboxObjectCount++
      })

      // Skip capture if no skybox objects yet
      if (skyboxObjectCount === 0) {
        return
      }

      // Get the current write target from temporal buffer
      const writeTarget = this.cubemapHistory.getWrite()

      this.cubeCamera.position.set(0, 0, 0)

      // CRITICAL: Clear background/environment before capture to avoid feedback loop
      const previousBackground = scene.background
      const previousEnvironment = scene.environment
      scene.background = null
      scene.environment = null

      // Render to cubemap
      const originalTarget = this.cubeCamera.renderTarget
      this.cubeCamera.renderTarget = writeTarget
      this.cubeCamera.update(renderer, scene)
      this.cubeCamera.renderTarget = originalTarget

      // Restore scene state
      scene.background = previousBackground
      scene.environment = previousEnvironment

      // Mark capture as occurred
      this.didCaptureThisFrame = true
      this.needsCapture = false

      // Generate PMREM if needed (throttled for performance)
      this.pmremFrameCounter++
      const shouldRegeneratePMREM =
        this.generatePMREM() &&
        (!this.pmremRenderTarget ||
          this.pmremFrameCounter >= CubemapCapturePassTSL.PMREM_UPDATE_INTERVAL)

      if (shouldRegeneratePMREM) {
        this.pmremFrameCounter = 0
        this.ensurePMREMGenerator(renderer)

        if (this.pmremGenerator) {
          if (this.pmremRenderTarget) {
            this.pendingPMREMDispose = this.pmremRenderTarget
          }

          this.pmremRenderTarget = this.pmremGenerator.fromCubemap(writeTarget.texture)

          // Force sync after PMREM generation
          getGlobalMRTManager().forceSync()
        }
      }
    }

    // 2. Export Logic (Always, if valid)
    const hasValidHistory = this.cubemapHistory.hasValidHistory(0)

    if (hasValidHistory) {
      const readTarget = this.cubemapHistory.getRead(1)

      // Export scene.background for black hole gravitational lensing
      ctx.queueExport({
        id: 'scene.background',
        value: readTarget.texture,
      })

      // Queue export for scene.environment (for IBL reflections)
      if (this.pmremRenderTarget) {
        ctx.queueExport({
          id: 'scene.environment',
          value: this.pmremRenderTarget.texture,
        })
      }
    }
  }

  /**
   * Initialize temporal cubemap history with 2-frame buffer.
   */
  private ensureTemporalHistory(): void {
    if (this.cubemapHistory) return

    const resolution = this.backgroundResolution
    this.cubemapHistory = new TemporalResource<THREE.WebGLCubeRenderTarget>({
      historyLength: 2,
      factory: () => {
        const target = new THREE.WebGLCubeRenderTarget(resolution, {
          format: THREE.RGBAFormat,
          generateMipmaps: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        })
        target.texture.mapping = THREE.CubeReflectionMapping
        return target
      },
      dispose: (target) => target.dispose(),
      debugName: 'skyboxCubemapTSL',
    })
  }

  /**
   * Advance the temporal resource to the next frame.
   */
  postFrame(): void {
    // 1. Dispose old PMREM target if one is pending
    if (this.pendingPMREMDispose) {
      this.pendingPMREMDispose.dispose()
      this.pendingPMREMDispose = null
    }

    // 2. Advance history ONLY if we captured a new frame
    if (this.didCaptureThisFrame) {
      this.cubemapHistory?.advanceFrame()
    }
  }

  /**
   * Check if the cubemap has valid history.
   */
  hasValidCubemap(): boolean {
    return this.cubemapHistory?.hasValidHistory(1) ?? false
  }

  getFramesSinceReset(): number {
    return this.cubemapHistory?.getFramesSinceReset() ?? 0
  }

  private disposeCubeCamera(): void {
    this.cubeRenderTarget?.dispose()
    this.cubeRenderTarget = null
    this.cubeCamera = null
  }

  private disposeTemporalHistory(): void {
    this.cubemapHistory?.dispose()
    this.cubemapHistory = null
  }

  private disposePMREM(): void {
    this.pmremRenderTarget?.dispose()
    this.pmremRenderTarget = null
    this.pmremGenerator?.dispose()
    this.pmremGenerator = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    if (this.pendingPMREMDispose) {
      this.pendingPMREMDispose.dispose()
      this.pendingPMREMDispose = null
    }

    this.disposeCubeCamera()
    this.disposeTemporalHistory()
    this.disposePMREM()

    this.needsCapture = true
    this.lastExternalTextureUuid = null
    this.lastSkyboxMode = null

    this.captureFrameCounter = 0
    this.pmremFrameCounter = 0
  }

  dispose(): void {
    this.disposeCubeCamera()
    this.disposeTemporalHistory()
    this.disposePMREM()
  }
}
