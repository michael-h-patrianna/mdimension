/**
 * Temporal Depth Manager
 *
 * Singleton class that manages temporal depth buffers for raymarching acceleration.
 * Uses a ping-pong buffer system to store the previous frame's ray distance information.
 *
 * Key design decisions:
 * - Stores RAY DISTANCE, not view-space Z (viewZ ≠ rayDistance for off-center pixels)
 * - Stores UNNORMALIZED values (FloatType allows real distances, better precision)
 * - Zero distance indicates invalid/no temporal data
 *
 * Flow:
 * 1. Before fractal render: getUniforms() returns previous frame's ray distances
 * 2. After fractal render: captureDepth() converts depth to ray distance and stores it
 * 3. End of frame: swap() switches read/write buffers
 *
 * This manager is updated by PostProcessing and read by mesh components.
 */

import { DepthCaptureShader } from '@/rendering/shaders/postprocessing/DepthCaptureShader'
import { usePerformanceStore } from '@/stores'
import { useWebGLContextStore } from '@/stores/webglContextStore'
import * as THREE from 'three'
import { RECOVERY_PRIORITY, resourceRecovery } from './ResourceRecovery'

/** Depth buffer format - single channel float for depth storage */
const DEPTH_FORMAT = THREE.RedFormat
const DEPTH_TYPE = THREE.FloatType

/** Resolution scale for temporal depth buffers (relative to screen) */
const RESOLUTION_SCALE = 0.5

export interface TemporalDepthUniforms {
  /** Previous frame's ray distance texture (unnormalized world-space ray distances) */
  uPrevDepthTexture: THREE.Texture | null
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: THREE.Matrix4
  /** Previous frame's inverse view-projection matrix */
  uPrevInverseViewProjectionMatrix: THREE.Matrix4
  /** Whether temporal reprojection is enabled and valid */
  uTemporalEnabled: boolean
  /** Depth buffer resolution for UV calculation */
  uDepthBufferResolution: THREE.Vector2
}

/**
 * Temporal depth manager singleton.
 * Manages ping-pong depth buffers for temporal reprojection.
 */
class TemporalDepthManagerImpl {
  private renderTargets: [THREE.WebGLRenderTarget | null, THREE.WebGLRenderTarget | null] = [
    null,
    null,
  ]
  private bufferIndex = 0
  private isValid = false
  private width = 1
  private height = 1
  private _resolution = new THREE.Vector2(1, 1)

  // Camera matrices from previous frame
  private prevViewProjectionMatrix = new THREE.Matrix4()
  private prevInverseViewProjectionMatrix = new THREE.Matrix4()

  // Current frame camera matrices (will become prev after swap)
  private currentViewProjectionMatrix = new THREE.Matrix4()
  private currentInverseProjectionMatrix = new THREE.Matrix4()

  // Camera clip planes
  private nearClip = 0.1
  private farClip = 1000

  // Depth capture material (for copying depth to temporal buffer)
  private captureMaterial: THREE.ShaderMaterial | null = null
  private captureScene: THREE.Scene | null = null
  private captureCamera: THREE.OrthographicCamera | null = null

  // Reusable vectors for state save/restore (avoid allocations per frame)
  private savedViewport = new THREE.Vector4()
  private savedScissor = new THREE.Vector4()

  /**
   * Initialize or resize the temporal depth buffers.
   * Should be called when screen size changes.
   * @param screenWidth
   * @param screenHeight
   * @param _gl
   */
  initialize(screenWidth: number, screenHeight: number, _gl: THREE.WebGLRenderer): void {
    const newWidth = Math.max(1, Math.floor(screenWidth * RESOLUTION_SCALE))
    const newHeight = Math.max(1, Math.floor(screenHeight * RESOLUTION_SCALE))

    // Check if resize needed
    if (this.renderTargets[0] && this.width === newWidth && this.height === newHeight) {
      return
    }

    this.width = newWidth
    this.height = newHeight
    this._resolution.set(newWidth, newHeight)

    // Dispose old targets
    this.renderTargets.forEach((target) => target?.dispose())

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
      })

    this.renderTargets = [createTarget(), createTarget()]

    // Reset validity since we have new buffers
    this.isValid = false

    // Initialize depth capture infrastructure if not done
    if (!this.captureMaterial) {
      this.initializeCaptureInfrastructure()
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
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
      },
      vertexShader: DepthCaptureShader.vertexShader,
      fragmentShader: DepthCaptureShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    // Fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, this.captureMaterial)

    this.captureScene = new THREE.Scene()
    this.captureScene.add(mesh)

    this.captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Update camera matrices for the current frame.
   * Call this at the START of each frame before rendering.
   * @param camera
   */
  updateCameraMatrices(camera: THREE.Camera): void {
    // Store current as will become previous after swap
    this.currentViewProjectionMatrix
      .copy(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse)

    // Store inverse projection matrix for viewZ → ray distance conversion
    this.currentInverseProjectionMatrix.copy(camera.projectionMatrix).invert()

    if (camera instanceof THREE.PerspectiveCamera) {
      this.nearClip = camera.near
      this.farClip = camera.far
    }
  }

  /**
   * Capture the current frame's depth to the temporal buffer.
   * Call this AFTER rendering the scene but BEFORE swap().
   *
   * This method is robust against viewport/scissor state mismatches that can occur
   * in complex post-processing pipelines. It explicitly saves/restores all relevant
   * state and clears the target to ensure no stale data persists.
   *
   * @param gl
   * @param depthTexture
   * @param force - Force capture even if temporal reprojection is disabled (for preview)
   */
  captureDepth(gl: THREE.WebGLRenderer, depthTexture: THREE.DepthTexture, force = false): void {
    if (!force && !this.isEnabled()) return

    const writeTarget = this.getWriteTarget()
    if (!writeTarget || !this.captureMaterial || !this.captureScene || !this.captureCamera) {
      return
    }

    // Update capture shader uniforms
    const uniforms = this.captureMaterial.uniforms as {
      tDepth: { value: THREE.DepthTexture | null }
      nearClip: { value: number }
      farClip: { value: number }
      sourceResolution: { value: THREE.Vector2 }
      inverseProjectionMatrix: { value: THREE.Matrix4 }
    }
    uniforms.tDepth.value = depthTexture
    uniforms.nearClip.value = this.nearClip
    uniforms.farClip.value = this.farClip
    // Pass full-resolution source texture size for conservative MIN sampling
    uniforms.sourceResolution.value.set(
      depthTexture.image?.width ?? this.width * 2,
      depthTexture.image?.height ?? this.height * 2
    )
    // Pass inverse projection matrix for viewZ → ray distance conversion
    uniforms.inverseProjectionMatrix.value.copy(this.currentInverseProjectionMatrix)

    // Save all relevant renderer state
    // This is critical for robustness in complex post-processing pipelines
    const savedRenderTarget = gl.getRenderTarget()
    const savedAutoClear = gl.autoClear
    gl.getViewport(this.savedViewport)
    gl.getScissor(this.savedScissor)
    const savedScissorTest = gl.getScissorTest()

    // CRITICAL: Use render target's viewport property instead of gl.setViewport()
    // gl.setViewport() internally multiplies by pixel ratio (DPR), which causes
    // incorrect rendering when DPR != 1. The render target's viewport property
    // specifies exact pixel values without DPR multiplication.
    // See: https://github.com/mrdoob/three.js/issues/27655
    writeTarget.viewport.set(0, 0, this.width, this.height)
    writeTarget.scissor.set(0, 0, this.width, this.height)
    writeTarget.scissorTest = false

    // Set up render target
    gl.setRenderTarget(writeTarget)
    gl.setScissorTest(false)

    // Explicit clear to 0 (rather than relying on autoClear which uses
    // renderer's current clear settings and respects scissor)
    // Zero depth = "no temporal info" which the shader treats as invalid,
    // preventing stale data from persisting
    gl.clear(true, false, false)

    // Render the depth capture pass (autoClear disabled since we cleared manually)
    gl.autoClear = false
    gl.render(this.captureScene, this.captureCamera)

    // Restore all state
    gl.setRenderTarget(savedRenderTarget)
    gl.setViewport(this.savedViewport)
    gl.setScissor(this.savedScissor)
    gl.setScissorTest(savedScissorTest)
    gl.autoClear = savedAutoClear
  }

  /**
   * Swap the ping-pong buffers.
   * Call this at the END of each frame after depth capture.
   *
   * @param force - Force swap even if temporal reprojection is disabled (for preview)
   */
  swap(force = false): void {
    if (!force && !this.isEnabled()) return

    // Current matrices become previous
    this.prevViewProjectionMatrix.copy(this.currentViewProjectionMatrix)
    this.prevInverseViewProjectionMatrix.copy(this.currentViewProjectionMatrix).invert()

    // Swap buffer index
    this.bufferIndex = 1 - this.bufferIndex

    // Mark as valid after first complete frame
    this.isValid = true
  }

  /**
   * Invalidate temporal data and force fresh depth capture.
   *
   * Call this when the view changes discontinuously and reprojection would
   * produce incorrect results. Common scenarios include:
   *
   * - **Camera teleport**: Instant position change (e.g., preset views, reset)
   * - **Scene reset**: When geometry changes significantly
   * - **Object type switch**: Different objects have different depth profiles
   * - **FOV change**: Projection matrix discontinuity
   *
   * NOTE: This method only resets temporal state. Render targets are preserved.
   * For full resource cleanup (context loss, unmount), use dispose() instead.
   */
  invalidate(): void {
    // Reset temporal state only - preserve render targets
    // Render targets are managed by:
    // - initialize() on resize
    // - dispose() on unmount/context loss
    this.isValid = false
    this.bufferIndex = 0

    // Reset matrices to identity to avoid stale reprojection
    this.prevViewProjectionMatrix.identity()
    this.prevInverseViewProjectionMatrix.identity()
    this.currentViewProjectionMatrix.identity()
    this.currentInverseProjectionMatrix.identity()
  }

  /**
   * Invalidate GPU resources after WebGL context loss.
   *
   * IMPORTANT: This method nulls out render targets WITHOUT disposing them.
   * After context loss, GPU resources are already gone - calling dispose()
   * would cause "object does not belong to this context" errors.
   */
  invalidateForContextLoss(): void {
    // Null out render targets WITHOUT disposing - they belong to the dead context
    this.renderTargets = [null, null]

    // Reset capture infrastructure - materials/scenes need recreation
    this.captureMaterial = null
    this.captureScene = null
    this.captureCamera = null

    // Reset temporal state
    this.isValid = false
    this.bufferIndex = 0
    this.prevViewProjectionMatrix.identity()
    this.prevInverseViewProjectionMatrix.identity()
    this.currentViewProjectionMatrix.identity()
    this.currentInverseProjectionMatrix.identity()
  }

  /**
   * Reinitialize after context restoration.
   * @param gl - The WebGL renderer with restored context
   * @returns Promise that resolves when reinitialization is complete
   */
  reinitialize(gl: THREE.WebGLRenderer): Promise<void> {
    // Re-run initialize with stored dimensions
    // This recreates render targets with fresh GPU resources
    this.initialize(this.width * (1 / RESOLUTION_SCALE), this.height * (1 / RESOLUTION_SCALE), gl)
    return Promise.resolve()
  }

  /**
   * Check if temporal reprojection is enabled in settings.
   * @returns True if temporal reprojection is enabled
   */
  isEnabled(): boolean {
    return usePerformanceStore.getState().temporalReprojectionEnabled
  }

  /**
   * Get the read target (previous frame's depth).
   * @returns The read render target or null
   */
  private getReadTarget(): THREE.WebGLRenderTarget | null {
    const target = this.renderTargets[1 - this.bufferIndex]
    return target ?? null
  }

  /**
   * Get the write target (current frame's depth).
   * @returns The write render target or null
   */
  private getWriteTarget(): THREE.WebGLRenderTarget | null {
    const target = this.renderTargets[this.bufferIndex]
    return target ?? null
  }

  /**
   * Get the uniforms to pass to fractal shaders.
   * Call this when setting up material uniforms.
   *
   * The depth texture now contains unnormalized ray distances (world-space units).
   * Fractal shaders can use these directly as start distances for ray marching.
   *
   * @param forceTexture - Return texture even if temporal reprojection is disabled (for preview)
   * @returns Uniforms object containing temporal depth textures and matrices
   */
  getUniforms(forceTexture = false): TemporalDepthUniforms {
    const readTarget = this.getReadTarget()

    // Warn if temporal is enabled but render targets are missing - indicates a bug
    // Skip warning during context recovery - targets are intentionally null
    const contextStatus = useWebGLContextStore.getState().status
    if (this.isEnabled() && readTarget === null && contextStatus === 'active') {
      console.warn(
        '[TemporalDepthManager] Temporal reprojection enabled but render targets are null. ' +
          'This indicates initialize() was not called or dispose() was called unexpectedly.'
      )
    }

    const enabled = this.isEnabled() && this.isValid && readTarget !== null
    // For preview mode, return texture if we have a valid buffer (even if feature disabled)
    const hasTexture = (enabled || forceTexture) && readTarget !== null

    return {
      uPrevDepthTexture: hasTexture && readTarget ? readTarget.texture : null,
      uPrevViewProjectionMatrix: this.prevViewProjectionMatrix,
      uPrevInverseViewProjectionMatrix: this.prevInverseViewProjectionMatrix,
      uTemporalEnabled: enabled,
      uDepthBufferResolution: this._resolution,
    }
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.renderTargets.forEach((target) => target?.dispose())
    this.renderTargets = [null, null]
    this.captureMaterial?.dispose()
    this.captureMaterial = null
    this.captureScene = null
    this.captureCamera = null
    this.isValid = false
  }

  /**
   * Get the current buffer dimensions for debugging.
   * @returns Object with width and height dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }
}

// Singleton instance
export const TemporalDepthManager = new TemporalDepthManagerImpl()

// Register with resource recovery coordinator
resourceRecovery.register({
  name: 'TemporalDepthManager',
  priority: RECOVERY_PRIORITY.TEMPORAL_DEPTH,
  invalidate: () => TemporalDepthManager.invalidateForContextLoss(),
  reinitialize: (gl) => TemporalDepthManager.reinitialize(gl),
})
