/**
 * Cubemap Capture Pass
 *
 * Handles cubemap environment maps for both procedural and classic skyboxes:
 *
 * 1. PROCEDURAL MODE: Captures the SKYBOX layer to a CubeRenderTarget
 * 2. CLASSIC MODE: Captures the SKYBOX layer (displaying KTX2 texture) to a CubeRenderTarget
 *    to ensure mipmaps are generated for proper roughness-based IBL.
 *
 * For both modes, generates PMREM for PBR reflections and exports via ExternalBridge:
 * - scene.background (captured CubeTexture) - for black hole gravitational lensing
 * - scene.environment (PMREM texture) - for wall PBR reflections
 *
 * CRITICAL: This pass uses ctx.queueExport() instead of directly modifying scene.background.
 * This ensures exports are batched and applied AFTER all passes complete via executeExports().
 * The black hole shader reads scene.background in the NEXT frame, ensuring frame consistency.
 *
 * By running inside the render graph, we ensure proper MRT state management
 * via the patched renderer.setRenderTarget. This prevents GL_INVALID_OPERATION
 * errors that occurred when PMREMGenerator ran outside the render graph.
 *
 * Implementation based on Three.js CubeCamera and PMREMGenerator.
 * @see https://github.com/mrdoob/three.js/blob/dev/src/cameras/CubeCamera.js
 * @see https://github.com/mrdoob/three.js/blob/dev/src/extras/PMREMGenerator.js
 */

import * as THREE from 'three';

import { RENDER_LAYERS } from '@/rendering/core/layers';

import { BasePass } from '../BasePass';
import { getGlobalMRTManager } from '../MRTStateManager';
import { TemporalResource } from '../TemporalResource';
import type { RenderContext, RenderPassConfig } from '../types';

export interface CubemapCapturePassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Resolution per cube face for scene.background (default 256) */
  backgroundResolution?: number;
  /** Resolution for PMREM environment map (default 256) - reserved for future use */
  environmentResolution?: number;
  /** Whether to generate PMREM for scene.environment (for wall reflections) */
  generatePMREM?: () => boolean;
  /** Callback to get external CubeTexture for classic skybox mode */
  getExternalCubeTexture?: () => THREE.CubeTexture | null;
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
export class CubemapCapturePass extends BasePass {
  // Background capture
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget | null = null;
  private cubeCamera: THREE.CubeCamera | null = null;
  private backgroundResolution: number;

  // PMREM for environment (for walls)
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private pmremRenderTarget: THREE.WebGLRenderTarget | null = null;
  private generatePMREM: () => boolean;

  // External texture tracking
  private getExternalCubeTexture: () => THREE.CubeTexture | null;
  private lastExternalTextureUuid: string | null = null;

  // Temporal cubemap history (2-frame buffer for proper initialization)
  private cubemapHistory: TemporalResource<THREE.WebGLCubeRenderTarget> | null = null;

  // Capture control
  private needsCapture = true;

  constructor(config: CubemapCapturePassConfig) {
    super({
      ...config,
      inputs: [],
      outputs: [],
    });

    this.backgroundResolution = config.backgroundResolution ?? 256;
    this.generatePMREM = config.generatePMREM ?? (() => false);
    this.getExternalCubeTexture = config.getExternalCubeTexture ?? (() => null);
  }

  /**
   * Initialize the cube camera and render target for background capture.
   */
  private ensureCubeCamera(): void {
    if (this.cubeRenderTarget && this.cubeCamera) return;

    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(this.backgroundResolution, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });

    // Set mapping for black hole shader compatibility (samplerCube)
    this.cubeRenderTarget.texture.mapping = THREE.CubeReflectionMapping;

    this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget);

    // Only capture SKYBOX layer - exclude MAIN_OBJECT (black hole itself)
    this.cubeCamera.layers.disableAll();
    this.cubeCamera.layers.enable(RENDER_LAYERS.SKYBOX);
  }

  /**
   * Initialize PMREMGenerator for environment map conversion.
   */
  private ensurePMREMGenerator(renderer: THREE.WebGLRenderer): void {
    if (this.pmremGenerator) return;

    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
  }

  /**
   * Request a new capture on next frame.
   * Call this when skybox settings change.
   */
  requestCapture(): void {
    this.needsCapture = true;
    this.cubemapHistory?.invalidateHistory();
  }

  /**
   * Set the background capture resolution.
   */
  setBackgroundResolution(resolution: number): void {
    if (resolution !== this.backgroundResolution) {
      this.backgroundResolution = resolution;
      this.disposeTemporalHistory();
      this.requestCapture();
    }
  }

  /**
   * Get the captured cubemap texture (for external use if needed).
   */
  getCubemapTexture(): THREE.CubeTexture | null {
    if (this.cubemapHistory?.hasValidHistory(1)) {
      return this.cubemapHistory.getRead(1).texture;
    }
    return null;
  }

  /**
   * Get the PMREM texture (for external use if needed).
   */
  getPMREMTexture(): THREE.Texture | null {
    return this.pmremRenderTarget?.texture ?? null;
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene } = ctx;

    // Check for external texture changes (classic mode)
    // If UUID changes, we need to recapture (re-render SkyboxMesh to cube target)
    const externalTexture = this.getExternalCubeTexture();
    if (externalTexture) {
      if (externalTexture.uuid !== this.lastExternalTextureUuid) {
        this.lastExternalTextureUuid = externalTexture.uuid;
        this.requestCapture();
      }
    } else {
      if (this.lastExternalTextureUuid !== null) {
        this.lastExternalTextureUuid = null;
        this.requestCapture();
      }
    }

    // Always use capture path - unifies Procedural and Classic modes
    // This ensures scene.background is always a mipmapped WebGLCubeRenderTarget
    this.executeCapture(ctx, renderer, scene);
  }

  /**
   * Capture SKYBOX layer to CubeRenderTarget.
   * Handles both Procedural (shader) and Classic (SkyboxMesh with texture) modes.
   */
  private executeCapture(
    ctx: RenderContext,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    // Only capture when requested
    if (!this.needsCapture) return;

    this.ensureTemporalHistory();
    if (!this.cubemapHistory) return;

    this.ensureCubeCamera();
    if (!this.cubeCamera) return;

    // Get the current write target from temporal buffer
    const writeTarget = this.cubemapHistory.getWrite();

    this.cubeCamera.position.set(0, 0, 0);

    // CRITICAL: Clear background/environment before capture to avoid feedback loop
    const previousBackground = scene.background;
    const previousEnvironment = scene.environment;
    scene.background = null;
    scene.environment = null;

    // Render to cubemap
    const originalTarget = this.cubeCamera.renderTarget;
    this.cubeCamera.renderTarget = writeTarget;
    this.cubeCamera.update(renderer, scene);
    this.cubeCamera.renderTarget = originalTarget;

    // Restore scene state
    scene.background = previousBackground;
    scene.environment = previousEnvironment;

    // ONLY queue exports if we have valid history
    if (this.cubemapHistory.hasValidHistory(1)) {
      const readTarget = this.cubemapHistory.getRead(1);

      // Queue export for scene.background
      ctx.queueExport({
        id: 'scene.background',
        value: readTarget.texture,
      });

      // Generate PMREM if needed
      if (this.generatePMREM()) {
        this.ensurePMREMGenerator(renderer);

        if (this.pmremGenerator) {
          this.pmremRenderTarget?.dispose();
          this.pmremRenderTarget = this.pmremGenerator.fromCubemap(readTarget.texture);

          // Force sync after PMREM generation
          getGlobalMRTManager().forceSync();

          // Queue export for scene.environment
          ctx.queueExport({
            id: 'scene.environment',
            value: this.pmremRenderTarget.texture,
          });
        }
      }

      this.needsCapture = false;
    }
  }

  /**
   * Initialize temporal cubemap history with 2-frame buffer.
   */
  private ensureTemporalHistory(): void {
    if (this.cubemapHistory) return;

    const resolution = this.backgroundResolution;
    this.cubemapHistory = new TemporalResource<THREE.WebGLCubeRenderTarget>({
      historyLength: 2,
      factory: () => {
        const target = new THREE.WebGLCubeRenderTarget(resolution, {
          format: THREE.RGBAFormat,
          generateMipmaps: true,
          minFilter: THREE.LinearMipmapLinearFilter,
          magFilter: THREE.LinearFilter,
        });
        target.texture.mapping = THREE.CubeReflectionMapping;
        return target;
      },
      dispose: (target) => target.dispose(),
      debugName: 'skyboxCubemap',
    });
  }

  /**
   * Advance the temporal resource to the next frame.
   */
  postFrame(): void {
    this.cubemapHistory?.advanceFrame();
  }

  /**
   * Check if the cubemap has valid history.
   */
  hasValidCubemap(): boolean {
    return this.cubemapHistory?.hasValidHistory(1) ?? false;
  }

  getFramesSinceReset(): number {
    return this.cubemapHistory?.getFramesSinceReset() ?? 0;
  }

  private disposeCubeCamera(): void {
    this.cubeRenderTarget?.dispose();
    this.cubeRenderTarget = null;
    this.cubeCamera = null;
  }

  private disposeTemporalHistory(): void {
    this.cubemapHistory?.dispose();
    this.cubemapHistory = null;
  }

  private disposePMREM(): void {
    this.pmremRenderTarget?.dispose();
    this.pmremRenderTarget = null;
    this.pmremGenerator?.dispose();
    this.pmremGenerator = null;
  }

  dispose(): void {
    this.disposeCubeCamera();
    this.disposeTemporalHistory();
    this.disposePMREM();
  }
}
