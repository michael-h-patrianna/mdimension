/**
 * Cubemap Capture Pass
 *
 * Handles cubemap environment maps for both procedural and classic skyboxes:
 *
 * 1. PROCEDURAL MODE: Captures the SKYBOX layer to a CubeRenderTarget
 * 2. CLASSIC MODE: Uses externally loaded CubeTexture directly
 *
 * For both modes, generates PMREM for PBR reflections and exports via ExternalBridge:
 * - scene.background (raw CubeTexture) - for black hole gravitational lensing
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
  /** Callback to get external CubeTexture for classic skybox mode (bypasses capture) */
  getExternalCubeTexture?: () => THREE.CubeTexture | null;
}

/**
 * Pass that handles cubemap environment maps for:
 * - Black hole gravitational lensing (scene.background)
 * - Wall PBR reflections (scene.environment via PMREM)
 *
 * Works in two modes:
 * - PROCEDURAL: Captures SKYBOX layer to CubeRenderTarget
 * - CLASSIC: Uses externally provided CubeTexture directly
 */
export class CubemapCapturePass extends BasePass {
  // Background capture (for procedural skybox)
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget | null = null;
  private cubeCamera: THREE.CubeCamera | null = null;
  private backgroundResolution: number;

  // PMREM for environment (for walls)
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private pmremRenderTarget: THREE.WebGLRenderTarget | null = null;
  private generatePMREM: () => boolean;

  // External texture support (classic skybox)
  private getExternalCubeTexture: () => THREE.CubeTexture | null;
  private lastExternalTextureUuid: string | null = null;
  private externalPmremRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Temporal cubemap history (2-frame buffer for proper initialization)
  // Frame N writes to history slot, frame N+1 reads from previous slot
  // This ensures the black hole shader never reads from an uninitialized cubemap
  private cubemapHistory: TemporalResource<THREE.WebGLCubeRenderTarget> | null = null;

  // Capture control
  private needsCapture = true;

  constructor(config: CubemapCapturePassConfig) {
    super({
      ...config,
      // No resource inputs/outputs - this pass manages its own render targets
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
    // Pre-compile shaders to avoid stutter on first conversion
    this.pmremGenerator.compileEquirectangularShader();
  }

  /**
   * Request a new capture on next frame.
   * Call this when skybox settings change.
   */
  requestCapture(): void {
    this.needsCapture = true;
    // Invalidate history so hasValidCubemap() returns false until warmup completes
    this.cubemapHistory?.invalidateHistory();
  }

  /**
   * Set the background capture resolution (recreates render target).
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
   * Returns the previous frame's texture if history is valid.
   */
  getCubemapTexture(): THREE.CubeTexture | null {
    // External texture takes priority
    const externalTexture = this.getExternalCubeTexture();
    if (externalTexture) return externalTexture;

    // Return from temporal history if valid
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

    // Check for external texture (classic skybox mode)
    const externalTexture = this.getExternalCubeTexture();

    if (externalTexture) {
      // CLASSIC MODE: Use externally provided CubeTexture
      this.executeClassicMode(ctx, renderer, externalTexture);
    } else {
      // PROCEDURAL MODE: Capture SKYBOX layer to CubeRenderTarget
      this.executeProceduralMode(ctx, renderer, scene);
    }
  }

  /**
   * Execute in classic mode - use externally loaded CubeTexture.
   * Skips CubeCamera capture, generates PMREM if needed.
   * Uses ctx.queueExport() for frame-consistent state updates.
   */
  private executeClassicMode(
    ctx: RenderContext,
    renderer: THREE.WebGLRenderer,
    cubeTexture: THREE.CubeTexture
  ): void {
    // Check if texture changed (need to regenerate PMREM)
    const textureChanged = cubeTexture.uuid !== this.lastExternalTextureUuid;
    this.lastExternalTextureUuid = cubeTexture.uuid;

    // Queue export for scene.background (applied at frame end via executeExports)
    ctx.queueExport({
      id: 'scene.background',
      value: cubeTexture,
    });

    // Generate PMREM for wall reflections if needed
    if (this.generatePMREM()) {
      // Only regenerate if texture changed
      if (textureChanged || !this.externalPmremRenderTarget) {
        this.ensurePMREMGenerator(renderer);

        if (this.pmremGenerator) {
          // Dispose previous PMREM render target
          this.externalPmremRenderTarget?.dispose();

          // Convert cubemap to PMREM format
          // This goes through setRenderTarget internally, ensuring proper MRT state
          this.externalPmremRenderTarget = this.pmremGenerator.fromCubemap(cubeTexture);

          // Force sync after PMREM generation as it may have altered GL state (e.g. viewport, scissor)
          // that MRTStateManager missed if PMREMGenerator restored to null (screen)
          getGlobalMRTManager().forceSync();

          // Queue export for scene.environment (applied at frame end)
          ctx.queueExport({
            id: 'scene.environment',
            value: this.externalPmremRenderTarget.texture,
          });
        }
      } else if (this.externalPmremRenderTarget) {
        // Reuse existing PMREM - still need to queue export
        ctx.queueExport({
          id: 'scene.environment',
          value: this.externalPmremRenderTarget.texture,
        });
      }
    }
  }

  /**
   * Execute in procedural mode - capture SKYBOX layer to CubeRenderTarget.
   * Uses TemporalResource for proper 2-frame initialization.
   * Uses ctx.queueExport() for frame-consistent state updates.
   */
  private executeProceduralMode(
    ctx: RenderContext,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    // Only capture when requested (e.g., settings changed, initial load)
    if (!this.needsCapture) return;

    // Initialize temporal history if needed
    this.ensureTemporalHistory();
    if (!this.cubemapHistory) return;

    this.ensureCubeCamera();
    if (!this.cubeCamera) return;

    // Get the current write target from temporal buffer
    const writeTarget = this.cubemapHistory.getWrite();

    // Position camera at origin (center of skybox sphere)
    this.cubeCamera.position.set(0, 0, 0);

    // CRITICAL: Clear BOTH scene.background AND scene.environment before capture
    // to avoid feedback loop. The floor (on SKYBOX layer) samples from scene.background
    // via its uEnvMap uniform. If we're writing to cubeRenderTarget while the floor
    // reads from the same texture, WebGL throws:
    // "GL_INVALID_OPERATION: Feedback loop formed between Framebuffer and active Texture"
    const previousBackground = scene.background;
    const previousEnvironment = scene.environment;
    scene.background = null;
    scene.environment = null;

    // Update the cube camera to render to our temporal write target
    // This is a bit hacky but CubeCamera.update() renders to its internal target
    // We need to swap targets temporarily
    const originalTarget = this.cubeCamera.renderTarget;
    this.cubeCamera.renderTarget = writeTarget;
    this.cubeCamera.update(renderer, scene);
    this.cubeCamera.renderTarget = originalTarget;

    // Restore scene state after capture (StateBarrier will also restore, but be explicit)
    scene.background = previousBackground;
    scene.environment = previousEnvironment;

    // ONLY queue exports if we have valid history
    // This prevents black hole from reading uninitialized data
    if (this.cubemapHistory.hasValidHistory(1)) {
      const readTarget = this.cubemapHistory.getRead(1);

      // Queue export for scene.background (applied at frame end via executeExports)
      ctx.queueExport({
        id: 'scene.background',
        value: readTarget.texture,
      });

      // Generate PMREM for wall reflections if needed
      if (this.generatePMREM()) {
        this.ensurePMREMGenerator(renderer);

        if (this.pmremGenerator) {
          // Dispose previous PMREM render target
          this.pmremRenderTarget?.dispose();

          // Convert cubemap to PMREM format
          this.pmremRenderTarget = this.pmremGenerator.fromCubemap(readTarget.texture);

          // Queue export for scene.environment (applied at frame end)
          ctx.queueExport({
            id: 'scene.environment',
            value: this.pmremRenderTarget.texture,
          });
        }
      }

      // Stop capturing once we have valid history
      this.needsCapture = false;
    }
    // If history not yet valid, no exports are queued - scene.background stays as-is
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
        // Set mapping for black hole shader compatibility (samplerCube)
        target.texture.mapping = THREE.CubeReflectionMapping;
        return target;
      },
      dispose: (target) => target.dispose(),
      debugName: 'skyboxCubemap',
    });
  }

  /**
   * Advance the temporal resource to the next frame.
   * Call this at the END of each frame after all passes have executed.
   */
  postFrame(): void {
    this.cubemapHistory?.advanceFrame();
  }

  /**
   * Check if the cubemap has valid history (ready for use by black hole shader).
   * Returns false during warmup period (first 2 frames after capture request).
   */
  hasValidCubemap(): boolean {
    // Classic mode always has valid texture (from external source)
    const externalTexture = this.getExternalCubeTexture();
    if (externalTexture) return true;

    // Procedural mode needs valid temporal history
    return this.cubemapHistory?.hasValidHistory(1) ?? false;
  }

  /**
   * Get frames since last history reset (for debugging).
   */
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
    this.disposeExternalPMREM();
  }

  private disposeExternalPMREM(): void {
    this.externalPmremRenderTarget?.dispose();
    this.externalPmremRenderTarget = null;
    this.lastExternalTextureUuid = null;
  }
}
