/**
 * Cubemap Capture Pass
 *
 * Handles cubemap environment maps for both procedural and classic skyboxes:
 *
 * 1. PROCEDURAL MODE: Captures the SKYBOX layer to a CubeRenderTarget
 * 2. CLASSIC MODE: Uses externally loaded CubeTexture directly
 *
 * For both modes, generates PMREM for PBR reflections and sets:
 * - scene.background (raw CubeTexture) - for black hole gravitational lensing
 * - scene.environment (PMREM texture) - for wall PBR reflections
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
  // Reserved for future PMREM resolution customization
  private _environmentResolution: number;
  private generatePMREM: () => boolean;

  // External texture support (classic skybox)
  private getExternalCubeTexture: () => THREE.CubeTexture | null;
  private lastExternalTextureUuid: string | null = null;
  private externalPmremRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Capture control
  private needsCapture = true;
  private frameCount = 0;
  private static readonly CAPTURE_FRAMES = 2;

  constructor(config: CubemapCapturePassConfig) {
    super({
      ...config,
      // No resource inputs/outputs - this pass manages its own render targets
      inputs: [],
      outputs: [],
    });

    this.backgroundResolution = config.backgroundResolution ?? 256;
    this._environmentResolution = config.environmentResolution ?? 256;
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
    this.frameCount = 0;
  }

  /**
   * Set the background capture resolution (recreates render target).
   */
  setBackgroundResolution(resolution: number): void {
    if (resolution !== this.backgroundResolution) {
      this.backgroundResolution = resolution;
      this.disposeCubeCamera();
      this.requestCapture();
    }
  }

  /**
   * Get the captured cubemap texture (for external use if needed).
   */
  getCubemapTexture(): THREE.CubeTexture | null {
    return this.cubeRenderTarget?.texture ?? null;
  }

  /**
   * Get the PMREM texture (for external use if needed).
   */
  getPMREMTexture(): THREE.Texture | null {
    return this.pmremRenderTarget?.texture ?? null;
  }

  execute(context: RenderContext): void {
    const { renderer, scene } = context;

    // Check for external texture (classic skybox mode)
    const externalTexture = this.getExternalCubeTexture();

    if (externalTexture) {
      // CLASSIC MODE: Use externally provided CubeTexture
      this.executeClassicMode(renderer, scene, externalTexture);
    } else {
      // PROCEDURAL MODE: Capture SKYBOX layer to CubeRenderTarget
      this.executeProceduralMode(renderer, scene);
    }
  }

  /**
   * Execute in classic mode - use externally loaded CubeTexture.
   * Skips CubeCamera capture, generates PMREM if needed.
   */
  private executeClassicMode(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    cubeTexture: THREE.CubeTexture
  ): void {
    // Check if texture changed (need to regenerate PMREM)
    const textureChanged = cubeTexture.uuid !== this.lastExternalTextureUuid;
    this.lastExternalTextureUuid = cubeTexture.uuid;

    // Set the external cubemap as scene.background for black hole shader
    scene.background = cubeTexture;

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

          // Set as scene.environment for PBR materials on walls
          scene.environment = this.externalPmremRenderTarget.texture;
        }
      } else if (this.externalPmremRenderTarget) {
        // Reuse existing PMREM
        scene.environment = this.externalPmremRenderTarget.texture;
      }
    }
  }

  /**
   * Execute in procedural mode - capture SKYBOX layer to CubeRenderTarget.
   */
  private executeProceduralMode(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    // Only capture for first N frames after request
    const shouldCapture = this.needsCapture && this.frameCount < CubemapCapturePass.CAPTURE_FRAMES;

    if (!shouldCapture) return;

    this.ensureCubeCamera();
    if (!this.cubeCamera || !this.cubeRenderTarget) return;

    // Position camera at origin (center of skybox sphere)
    this.cubeCamera.position.set(0, 0, 0);

    // Store and clear scene.background to avoid feedback loop
    // (we're capturing the skybox to SET as background)
    const previousEnvironment = scene.environment;
    scene.background = null;

    // Update the cube camera (renders all 6 faces)
    // This goes through patched setRenderTarget, ensuring proper drawBuffers
    this.cubeCamera.update(renderer, scene);

    // Set the captured cubemap as scene.background for black hole shader
    scene.background = this.cubeRenderTarget.texture;

    // Generate PMREM for wall reflections if needed
    if (this.generatePMREM()) {
      this.ensurePMREMGenerator(renderer);

      if (this.pmremGenerator) {
        // Dispose previous PMREM render target
        this.pmremRenderTarget?.dispose();

        // Convert cubemap to PMREM format
        // This also goes through setRenderTarget internally
        this.pmremRenderTarget = this.pmremGenerator.fromCubemap(
          this.cubeRenderTarget.texture
        );

        // Set as scene.environment for PBR materials on walls
        scene.environment = this.pmremRenderTarget.texture;
      }
    } else {
      // Restore previous environment if we're not generating PMREM
      scene.environment = previousEnvironment;
    }

    this.frameCount++;
    if (this.frameCount >= CubemapCapturePass.CAPTURE_FRAMES) {
      this.needsCapture = false;
    }
  }

  private disposeCubeCamera(): void {
    this.cubeRenderTarget?.dispose();
    this.cubeRenderTarget = null;
    this.cubeCamera = null;
  }

  private disposePMREM(): void {
    this.pmremRenderTarget?.dispose();
    this.pmremRenderTarget = null;
    this.pmremGenerator?.dispose();
    this.pmremGenerator = null;
  }

  dispose(): void {
    this.disposeCubeCamera();
    this.disposePMREM();
    this.disposeExternalPMREM();
  }

  private disposeExternalPMREM(): void {
    this.externalPmremRenderTarget?.dispose();
    this.externalPmremRenderTarget = null;
    this.lastExternalTextureUuid = null;
  }
}
