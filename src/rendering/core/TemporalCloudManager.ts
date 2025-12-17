/**
 * Temporal Cloud Accumulation Manager
 *
 * Implements Horizon Zero Dawn-style temporal accumulation for volumetric rendering.
 * Instead of trying to skip ray segments (problematic for soft volumes), this renders
 * 1/4 of pixels each frame and reconstructs the full image using temporal reprojection.
 *
 * Key concepts:
 * - Render to quarter-resolution target with Bayer pattern offset
 * - Reproject previous frame's accumulated color to current view
 * - Blend new pixels with reprojected history
 * - Full coverage every 4 frames
 *
 * This approach is industry-proven for volumetric clouds and avoids the artifacts
 * that occur when trying to skip ray start positions in soft density fields.
 */

import * as THREE from 'three';
import { usePerformanceStore } from '@/stores';

/** Resolution scale for cloud render target (1/2 = quarter pixels) */
const CLOUD_RESOLUTION_SCALE = 0.5;

/** Number of frames in the Bayer cycle */
const CYCLE_LENGTH = 4;

/**
 * MRT attachment indices for the reprojection buffer.
 * These must match the shader outputs in reprojection.glsl.ts.
 */
export const MRT_ATTACHMENTS = {
  /** Reprojected color from previous frame (RGBA16F) */
  REPROJECTED_COLOR: 0,
  /** Reprojection validity mask (R channel = validity 0-1) */
  VALIDITY_MASK: 1,
} as const;

/**
 * Bayer pattern offsets for 4-frame cycle.
 * Each offset determines which pixel in a 2x2 block to render.
 *
 * Frame 0: (0,0) - Top-left
 * Frame 1: (1,1) - Bottom-right (diagonal for better coverage)
 * Frame 2: (1,0) - Top-right
 * Frame 3: (0,1) - Bottom-left
 */
const BAYER_OFFSETS: [number, number][] = [
  [0.0, 0.0],
  [1.0, 1.0],
  [1.0, 0.0],
  [0.0, 1.0],
];

export interface TemporalCloudUniforms {
  /** Previous frame's accumulated cloud color */
  uPrevAccumulation: THREE.Texture | null;
  /** Previous frame's accumulated world positions (for accurate reprojection during camera rotation) */
  uPrevPositionBuffer: THREE.Texture | null;
  /** Current frame's cloud position texture (quarter-res MRT attachment) */
  uCloudPositionTexture: THREE.Texture | null;
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: THREE.Matrix4;
  /** Current Bayer offset for this frame */
  uBayerOffset: THREE.Vector2;
  /** Current frame index (0-3) */
  uFrameIndex: number;
  /** Whether temporal accumulation is enabled and valid */
  uTemporalCloudEnabled: boolean;
  /** Resolution of the cloud render target */
  uCloudResolution: THREE.Vector2;
  /** Resolution of the full accumulation buffer */
  uAccumulationResolution: THREE.Vector2;
}

/**
 * Temporal cloud accumulation manager singleton.
 * Manages ping-pong buffers and Bayer pattern cycling for volumetric rendering.
 */
class TemporalCloudManagerImpl {
  // Ping-pong accumulation buffers (full resolution)
  // Each buffer is MRT with 2 attachments:
  //   [0] = Accumulated color (RGBA)
  //   [1] = Accumulated world positions (xyz = world pos, w = alpha weight)
  // This allows reconstruction to output both color and position in a single pass,
  // and enables accurate temporal reprojection when camera rotates (not just translates)
  private accumulationBuffers: [THREE.WebGLRenderTarget | null, THREE.WebGLRenderTarget | null] = [
    null,
    null,
  ];

  // Quarter-resolution cloud render target (MRT: color + position)
  private cloudRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Legacy position buffer - now integrated into cloudRenderTarget MRT
  private positionBuffer: THREE.WebGLRenderTarget | null = null;

  // Reprojection intermediate buffer (full resolution)
  private reprojectionBuffer: THREE.WebGLRenderTarget | null = null;

  // Buffer index for ping-pong (0 or 1)
  private bufferIndex = 0;

  // Frame counter within cycle (0 to CYCLE_LENGTH-1)
  private frameIndex = 0;

  // Whether we have valid history data
  private isValid = false;

  // Cached temporal enabled state (avoid getState() per call)
  private temporalEnabled = usePerformanceStore.getState().temporalReprojectionEnabled;
  private unsubscribeStore: (() => void) | null = null;

  // Dimensions
  private fullWidth = 1;
  private fullHeight = 1;
  private cloudWidth = 1;
  private cloudHeight = 1;

  // Camera matrices for reprojection
  private prevViewProjectionMatrix = new THREE.Matrix4();
  private currentViewProjectionMatrix = new THREE.Matrix4();

  // Reusable objects to avoid allocations
  private bayerOffset = new THREE.Vector2();
  private cloudResolution = new THREE.Vector2();
  private accumulationResolution = new THREE.Vector2();

  /**
   * Initialize or resize all render targets.
   * Should be called when screen size changes.
   */
  initialize(screenWidth: number, screenHeight: number, gl?: THREE.WebGLRenderer): void {
    // Set up store subscription once (avoid getState() in isEnabled())
    if (!this.unsubscribeStore) {
      this.unsubscribeStore = usePerformanceStore.subscribe((s) => {
        this.temporalEnabled = s.temporalReprojectionEnabled;
      });
    }

    const newFullWidth = Math.max(1, Math.floor(screenWidth));
    const newFullHeight = Math.max(1, Math.floor(screenHeight));
    const newCloudWidth = Math.max(1, Math.floor(screenWidth * CLOUD_RESOLUTION_SCALE));
    const newCloudHeight = Math.max(1, Math.floor(screenHeight * CLOUD_RESOLUTION_SCALE));

    // Check if resize needed
    if (
      this.accumulationBuffers[0] &&
      this.fullWidth === newFullWidth &&
      this.fullHeight === newFullHeight
    ) {
      return;
    }

    this.fullWidth = newFullWidth;
    this.fullHeight = newFullHeight;
    this.cloudWidth = newCloudWidth;
    this.cloudHeight = newCloudHeight;

    // Dispose old targets
    this.dispose();

    // Create accumulation buffers (full resolution) with MRT
    // Attachment [0]: Accumulated color (RGBA, FloatType for HDR)
    // Attachment [1]: Accumulated world positions (xyz = world pos, w = alpha weight)
    //
    // Having positions in the accumulation buffer enables accurate temporal reprojection
    // when camera rotates (not just translates). Without positions, reprojection assumes
    // a fixed distance from camera, causing billboard-like artifacts.
    //
    // IMPORTANT: Uses FloatType for CPU readback via readPixels (debugging/quality gates)
    const createAccumulationTarget = () =>
      new THREE.WebGLRenderTarget(newFullWidth, newFullHeight, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        generateMipmaps: false,
        depthBuffer: false,
        stencilBuffer: false,
        count: 2, // MRT: [0] = Color, [1] = Position
      });

    this.accumulationBuffers = [createAccumulationTarget(), createAccumulationTarget()];
    this.accumulationBuffers[0]!.textures[0]!.name = 'AccumColor0';
    this.accumulationBuffers[0]!.textures[1]!.name = 'AccumPosition0';
    this.accumulationBuffers[1]!.textures[0]!.name = 'AccumColor1';
    this.accumulationBuffers[1]!.textures[1]!.name = 'AccumPosition1';

    // Explicitly clear accumulation buffers if renderer is provided
    // Only clear color buffer - depth/stencil are disabled on these targets
    if (gl) {
      const currentTarget = gl.getRenderTarget();

      this.accumulationBuffers.forEach(target => {
        if (target) {
          gl.setRenderTarget(target);
          gl.setClearColor(0x000000, 0);
          gl.clear(true, false, false);
        }
      });

      // Restore state
      gl.setRenderTarget(currentTarget);
    }

    // Create cloud render target (quarter resolution) with MRT
    // Attachment 0: Color (RGBA) - shader location 0 (gColor)
    // Attachment 1: Normal (RGBA) - shader location 1 (gNormal) - always output for SSR/SSAO
    // Attachment 2: World Position (XYZ = world pos, W = alpha) - shader location 2 (gPosition)
    //
    // The position buffer enables accurate temporal reprojection when camera rotates.
    // Without per-pixel positions, reprojection assumes fixed distance which causes
    // billboard-like artifacts where the object looks the same from all angles.
    //
    // IMPORTANT: Uses FloatType instead of HalfFloatType for two reasons:
    // 1. WebGL readRenderTargetPixels with Float32Array cannot properly read HalfFloatType
    //    (returns zeros), which broke debug/validation workflows
    // 2. FloatType has negligible performance impact at quarter resolution (640x360)
    this.cloudRenderTarget = new THREE.WebGLRenderTarget(newCloudWidth, newCloudHeight, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter, // No filtering - we handle upsampling manually
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: true, // Need depth for proper rendering
      stencilBuffer: false,
      count: 3, // MRT: [0] = Color, [1] = Normal, [2] = World Position
    });
    this.cloudRenderTarget.textures[0]!.name = 'CloudColor';
    this.cloudRenderTarget.textures[1]!.name = 'CloudNormal';
    this.cloudRenderTarget.textures[2]!.name = 'CloudPosition';

    // NOTE: Position buffer is now integrated into cloudRenderTarget as MRT attachment [2]
    // (was [1] before adding normal output)
    // The Schrödinger shader outputs world position to gPosition (layout location 2)
    // when USE_TEMPORAL_ACCUMULATION is defined. This eliminates the need for a
    // separate position buffer and enables accurate reprojection during camera rotation.
    this.positionBuffer = null;

    // Create reprojection buffer (full resolution)
    // MRT: [0] = Reprojected Color, [1] = Validity Mask
    this.reprojectionBuffer = new THREE.WebGLRenderTarget(newFullWidth, newFullHeight, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
      count: 2,
    });

    // Explicitly clear reprojection buffer to prevent garbage data
    // This is critical because the reconstruction shader samples from this buffer
    // even before the first reprojection pass runs
    if (gl) {
      const currentTarget = gl.getRenderTarget();
      gl.setRenderTarget(this.reprojectionBuffer);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
      gl.setRenderTarget(currentTarget);
    }

    // Reset state
    this.isValid = false;
    this.frameIndex = 0;
    this.bufferIndex = 0;
  }

  /**
   * Begin a new frame. Call at start of frame before rendering.
   * Updates camera matrices for reprojection.
   */
  beginFrame(camera: THREE.Camera): void {
    if (!this.isEnabled()) return;

    // Store current view-projection (will become "previous" after swap)
    this.currentViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
  }

  /**
   * End the current frame. Call after reconstruction pass.
   * Advances frame counter and swaps buffers.
   */
  endFrame(): void {
    if (!this.isEnabled()) return;

    // Current becomes previous
    this.prevViewProjectionMatrix.copy(this.currentViewProjectionMatrix);

    // Swap accumulation buffer index
    this.bufferIndex = 1 - this.bufferIndex;

    // Advance frame counter
    this.frameIndex = (this.frameIndex + 1) % CYCLE_LENGTH;

    // Mark as valid after first complete cycle
    if (this.frameIndex === 0) {
      this.isValid = true;
    }
  }

  /**
   * Get the render target for volumetric cloud rendering.
   * This is quarter resolution with Bayer pattern offset.
   */
  getCloudRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.cloudRenderTarget;
  }

  /**
   * Get the cloud render target's position texture (MRT attachment 2).
   * This contains per-pixel world positions from the current frame's quarter-res render.
   */
  getCloudPositionTexture(): THREE.Texture | null {
    return this.cloudRenderTarget?.textures[2] ?? null;
  }

  /**
   * Get the cloud render target's normal texture (MRT attachment 1).
   * This contains per-pixel view-space normals for SSR/SSAO.
   */
  getCloudNormalTexture(): THREE.Texture | null {
    return this.cloudRenderTarget?.textures[1] ?? null;
  }

  /**
   * Get the reprojection intermediate buffer.
   */
  getReprojectionBuffer(): THREE.WebGLRenderTarget | null {
    return this.reprojectionBuffer;
  }

  /**
   * Get the write target for reconstruction output (MRT: color + position).
   */
  getWriteTarget(): THREE.WebGLRenderTarget | null {
    return this.accumulationBuffers[this.bufferIndex] ?? null;
  }

  /**
   * Get the read target (previous frame's accumulation - MRT: color + position).
   */
  getReadTarget(): THREE.WebGLRenderTarget | null {
    return this.accumulationBuffers[1 - this.bufferIndex] ?? null;
  }

  /**
   * Get the read target's color texture (MRT attachment 0).
   */
  getReadColorTexture(): THREE.Texture | null {
    const target = this.getReadTarget();
    return target?.textures[0] ?? null;
  }

  /**
   * Get the read target's position texture (MRT attachment 1).
   * Used by reprojection shader to determine where each pixel was in 3D space.
   */
  getReadPositionTexture(): THREE.Texture | null {
    const target = this.getReadTarget();
    return target?.textures[1] ?? null;
  }

  /**
   * Get the current Bayer offset for this frame.
   */
  getBayerOffset(): [number, number] {
    return BAYER_OFFSETS[this.frameIndex] ?? [0, 0];
  }

  /**
   * Get the current frame index (0 to CYCLE_LENGTH-1).
   */
  getFrameIndex(): number {
    return this.frameIndex;
  }

  /**
   * Check if temporal cloud accumulation is enabled in settings.
   */
  isEnabled(): boolean {
    // Use cached value (updated via subscription in initialize())
    return this.temporalEnabled;
  }

  /**
   * Check if we have valid history data for reprojection.
   */
  hasValidHistory(): boolean {
    return this.isValid && this.isEnabled();
  }

  /**
   * Invalidate history and force a fresh accumulation cycle.
   *
   * Call this when the view changes discontinuously and reprojection would
   * produce incorrect results. Common scenarios include:
   *
   * - **Camera teleport**: Instant position change (e.g., preset views, reset)
   * - **Scene reset**: When geometry changes significantly
   * - **FOV change**: Projection matrix discontinuity
   * - **Render target resize**: Already handled internally by initialize()
   *
   * After invalidation, the system renders 4 frames to rebuild full coverage
   * before temporal blending resumes. During this period, spatial interpolation
   * fills gaps between rendered pixels.
   *
   * @example
   * ```ts
   * // On camera preset button click
   * camera.position.set(0, 5, 10);
   * TemporalCloudManager.invalidate();
   * ```
   */
  invalidate(): void {
    this.isValid = false;
    this.frameIndex = 0;
  }

  /**
   * Get all uniforms needed for temporal cloud rendering.
   */
  getUniforms(): TemporalCloudUniforms {
    const [offsetX, offsetY] = this.getBayerOffset();
    this.bayerOffset.set(offsetX, offsetY);
    this.cloudResolution.set(this.cloudWidth, this.cloudHeight);
    this.accumulationResolution.set(this.fullWidth, this.fullHeight);

    const colorTexture = this.getReadColorTexture();
    const positionTexture = this.getReadPositionTexture();
    // Only enable if we have valid history AND valid textures to sample
    const hasHistory = this.hasValidHistory() && colorTexture !== null && positionTexture !== null;

    return {
      uPrevAccumulation: hasHistory ? colorTexture : null,
      uPrevPositionBuffer: hasHistory ? positionTexture : null,
      uCloudPositionTexture: this.getCloudPositionTexture(),
      uPrevViewProjectionMatrix: this.prevViewProjectionMatrix,
      uBayerOffset: this.bayerOffset,
      uFrameIndex: this.frameIndex,
      uTemporalCloudEnabled: hasHistory,
      uCloudResolution: this.cloudResolution,
      uAccumulationResolution: this.accumulationResolution,
    };
  }

  /**
   * Get dimensions for debugging.
   */
  getDimensions(): {
    fullWidth: number;
    fullHeight: number;
    cloudWidth: number;
    cloudHeight: number;
  } {
    return {
      fullWidth: this.fullWidth,
      fullHeight: this.fullHeight,
      cloudWidth: this.cloudWidth,
      cloudHeight: this.cloudHeight,
    };
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.accumulationBuffers.forEach((target) => target?.dispose());
    this.accumulationBuffers = [null, null];
    this.cloudRenderTarget?.dispose();
    this.cloudRenderTarget = null;
    this.positionBuffer?.dispose();
    this.positionBuffer = null;
    this.reprojectionBuffer?.dispose();
    this.reprojectionBuffer = null;
    this.isValid = false;
  }
}

// Singleton instance
export const TemporalCloudManager = new TemporalCloudManagerImpl();
