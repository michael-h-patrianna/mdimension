/**
 * Temporal Depth Manager
 *
 * Singleton class that manages temporal depth buffers for raymarching acceleration.
 * Uses a ping-pong buffer system to store the previous frame's depth information.
 *
 * Flow:
 * 1. Before fractal render: getUniforms() returns previous frame's depth
 * 2. After fractal render: captureDepth() copies current depth to write buffer
 * 3. End of frame: swap() switches read/write buffers
 *
 * This manager is updated by PostProcessing and read by mesh components.
 */

import * as THREE from 'three';
import { usePerformanceStore } from '@/stores';
import { DepthCaptureShader } from '@/rendering/shaders/postprocessing/DepthCaptureShader';

/** Depth buffer format - single channel float for depth storage */
const DEPTH_FORMAT = THREE.RedFormat;
const DEPTH_TYPE = THREE.FloatType;

/** Resolution scale for temporal depth buffers (relative to screen) */
const RESOLUTION_SCALE = 0.5;

export interface TemporalDepthUniforms {
  /** Previous frame's depth texture (linear depth, normalized to [0,1]) */
  uPrevDepthTexture: THREE.Texture | null;
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: THREE.Matrix4;
  /** Previous frame's inverse view-projection matrix */
  uPrevInverseViewProjectionMatrix: THREE.Matrix4;
  /** Whether temporal reprojection is enabled and valid */
  uTemporalEnabled: boolean;
  /** Depth buffer resolution for UV calculation */
  uDepthBufferResolution: THREE.Vector2;
  /** Camera near clip */
  uNearClip: number;
  /** Camera far clip */
  uFarClip: number;
}

/**
 * Temporal depth manager singleton.
 * Manages ping-pong depth buffers for temporal reprojection.
 */
class TemporalDepthManagerImpl {
  private renderTargets: [THREE.WebGLRenderTarget | null, THREE.WebGLRenderTarget | null] = [
    null,
    null,
  ];
  private bufferIndex = 0;
  private isValid = false;
  private width = 1;
  private height = 1;

  // Camera matrices from previous frame
  private prevViewProjectionMatrix = new THREE.Matrix4();
  private prevInverseViewProjectionMatrix = new THREE.Matrix4();

  // Current frame camera matrices (will become prev after swap)
  private currentViewProjectionMatrix = new THREE.Matrix4();

  // Camera clip planes
  private nearClip = 0.1;
  private farClip = 1000;

  // Depth capture material (for copying depth to temporal buffer)
  private captureMaterial: THREE.ShaderMaterial | null = null;
  private captureScene: THREE.Scene | null = null;
  private captureCamera: THREE.OrthographicCamera | null = null;

  /**
   * Initialize or resize the temporal depth buffers.
   * Should be called when screen size changes.
   */
  initialize(screenWidth: number, screenHeight: number, _gl: THREE.WebGLRenderer): void {
    const newWidth = Math.max(1, Math.floor(screenWidth * RESOLUTION_SCALE));
    const newHeight = Math.max(1, Math.floor(screenHeight * RESOLUTION_SCALE));

    // Check if resize needed
    if (this.renderTargets[0] && this.width === newWidth && this.height === newHeight) {
      return;
    }

    this.width = newWidth;
    this.height = newHeight;

    // Dispose old targets
    this.renderTargets.forEach((target) => target?.dispose());

    // Create new ping-pong targets
    const createTarget = () =>
      new THREE.WebGLRenderTarget(newWidth, newHeight, {
        format: DEPTH_FORMAT,
        type: DEPTH_TYPE,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        generateMipmaps: false,
        depthBuffer: false,
        stencilBuffer: false,
      });

    this.renderTargets = [createTarget(), createTarget()];

    // Reset validity since we have new buffers
    this.isValid = false;

    // Initialize depth capture infrastructure if not done
    if (!this.captureMaterial) {
      this.initializeCaptureInfrastructure();
    }
  }

  /**
   * Initialize the fullscreen quad for depth capture.
   */
  private initializeCaptureInfrastructure(): void {
    this.captureMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null },
        nearClip: { value: 0.1 },
        farClip: { value: 1000.0 },
        sourceResolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: DepthCaptureShader.vertexShader,
      fragmentShader: DepthCaptureShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    // Fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, this.captureMaterial);

    this.captureScene = new THREE.Scene();
    this.captureScene.add(mesh);

    this.captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Update camera matrices for the current frame.
   * Call this at the START of each frame before rendering.
   */
  updateCameraMatrices(camera: THREE.Camera): void {
    // Store current as will become previous after swap
    this.currentViewProjectionMatrix
      .copy(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse);

    if (camera instanceof THREE.PerspectiveCamera) {
      this.nearClip = camera.near;
      this.farClip = camera.far;
    }
  }

  /**
   * Capture the current frame's depth to the temporal buffer.
   * Call this AFTER rendering the scene but BEFORE swap().
   */
  captureDepth(gl: THREE.WebGLRenderer, depthTexture: THREE.DepthTexture): void {
    if (!this.isEnabled()) return;

    const writeTarget = this.getWriteTarget();
    if (!writeTarget || !this.captureMaterial || !this.captureScene || !this.captureCamera) {
      return;
    }

    // Update capture shader uniforms
    const uniforms = this.captureMaterial.uniforms as {
      tDepth: { value: THREE.DepthTexture | null };
      nearClip: { value: number };
      farClip: { value: number };
      sourceResolution: { value: THREE.Vector2 };
    };
    uniforms.tDepth.value = depthTexture;
    uniforms.nearClip.value = this.nearClip;
    uniforms.farClip.value = this.farClip;
    // Pass full-resolution source texture size for conservative MIN sampling
    uniforms.sourceResolution.value.set(
      depthTexture.image?.width ?? this.width * 2,
      depthTexture.image?.height ?? this.height * 2
    );

    // Render depth capture pass
    const currentRenderTarget = gl.getRenderTarget();
    const currentAutoClear = gl.autoClear;

    gl.setRenderTarget(writeTarget);
    gl.autoClear = true;
    gl.render(this.captureScene, this.captureCamera);

    // Restore state
    gl.setRenderTarget(currentRenderTarget);
    gl.autoClear = currentAutoClear;
  }

  /**
   * Swap the ping-pong buffers.
   * Call this at the END of each frame after depth capture.
   */
  swap(): void {
    if (!this.isEnabled()) return;

    // Current matrices become previous
    this.prevViewProjectionMatrix.copy(this.currentViewProjectionMatrix);
    this.prevInverseViewProjectionMatrix.copy(this.currentViewProjectionMatrix).invert();

    // Swap buffer index
    this.bufferIndex = 1 - this.bufferIndex;

    // Mark as valid after first complete frame
    this.isValid = true;
  }

  /**
   * Invalidate temporal data (e.g., after camera teleport).
   */
  invalidate(): void {
    this.isValid = false;
  }

  /**
   * Check if temporal reprojection is enabled in settings.
   */
  isEnabled(): boolean {
    return usePerformanceStore.getState().temporalReprojectionEnabled;
  }

  /**
   * Get the read target (previous frame's depth).
   */
  private getReadTarget(): THREE.WebGLRenderTarget | null {
    const target = this.renderTargets[1 - this.bufferIndex];
    return target ?? null;
  }

  /**
   * Get the write target (current frame's depth).
   */
  private getWriteTarget(): THREE.WebGLRenderTarget | null {
    const target = this.renderTargets[this.bufferIndex];
    return target ?? null;
  }

  /**
   * Get the uniforms to pass to fractal shaders.
   * Call this when setting up material uniforms.
   */
  getUniforms(): TemporalDepthUniforms {
    const readTarget = this.getReadTarget();
    const enabled = this.isEnabled() && this.isValid && readTarget !== null;

    return {
      uPrevDepthTexture: enabled && readTarget ? readTarget.texture : null,
      uPrevViewProjectionMatrix: this.prevViewProjectionMatrix,
      uPrevInverseViewProjectionMatrix: this.prevInverseViewProjectionMatrix,
      uTemporalEnabled: enabled,
      uDepthBufferResolution: new THREE.Vector2(this.width, this.height),
      uNearClip: this.nearClip,
      uFarClip: this.farClip,
    };
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.renderTargets.forEach((target) => target?.dispose());
    this.renderTargets = [null, null];
    this.captureMaterial?.dispose();
    this.captureMaterial = null;
    this.captureScene = null;
    this.captureCamera = null;
    this.isValid = false;
  }
}

// Singleton instance
export const TemporalDepthManager = new TemporalDepthManagerImpl();
