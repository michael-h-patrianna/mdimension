/**
 * State Barrier for TSL/WebGPU Render Graph
 *
 * Renderer-agnostic state barrier that works with both WebGLRenderer and WebGPURenderer.
 * Mirrors the WebGL StateBarrier exactly but accepts the SupportedRenderer union type.
 *
 * ## Design
 * This is a thin wrapper that provides type compatibility for both renderer backends.
 * The actual state capture/restore logic is identical to the WebGL version since
 * both renderers expose the same methods for these operations.
 *
 * @module rendering/graph-tsl/StateBarrierTSL
 */

import * as THREE from 'three'

import type { SupportedRenderer } from '@/rendering/core/rendererUtils'

/**
 * Captured renderer state.
 */
interface RendererState {
  renderTarget: THREE.RenderTarget | null
  clearColor: THREE.Color
  clearAlpha: number
  autoClear: boolean
  autoClearColor: boolean
  autoClearDepth: boolean
  autoClearStencil: boolean
}

/**
 * Captured scene state.
 */
interface SceneState {
  background: THREE.Color | THREE.Texture | THREE.CubeTexture | null
  environment: THREE.Texture | null
  overrideMaterial: THREE.Material | null
}

/**
 * Captured camera state.
 */
interface CameraState {
  layersMask: number
}

/**
 * Renderer-agnostic interface for state capture/restore.
 * Both WebGLRenderer and WebGPURenderer implement these methods.
 */
interface RendererWithState {
  getRenderTarget(): THREE.RenderTarget | null
  getClearColor(target: THREE.Color): THREE.Color
  getClearAlpha(): number
  setRenderTarget(target: THREE.RenderTarget | null): void
  setClearColor(color: THREE.Color | string | number, alpha?: number): void
  autoClear: boolean
  autoClearColor: boolean
  autoClearDepth: boolean
  autoClearStencil: boolean
}

/**
 * State barrier for saving/restoring Three.js state around pass execution.
 *
 * Works with both WebGLRenderer and WebGPURenderer.
 *
 * ## Usage
 * ```typescript
 * const barrier = new StateBarrierTSL();
 *
 * for (const pass of passes) {
 *   barrier.capture(renderer, scene, camera);
 *   try {
 *     pass.execute(context);
 *   } finally {
 *     barrier.restore(renderer, scene, camera);
 *   }
 * }
 * ```
 *
 * ## State Captured
 * - **Renderer**: render target, clear color/alpha, autoClear flags
 * - **Scene**: background, environment, override material
 * - **Camera**: layer mask
 */
export class StateBarrierTSL {
  // Captured state (null if not captured)
  private rendererState: RendererState | null = null
  private sceneState: SceneState | null = null
  private cameraState: CameraState | null = null

  // Reusable objects to avoid per-frame allocation
  private tempColor = new THREE.Color()

  // ==========================================================================
  // Capture
  // ==========================================================================

  /**
   * Capture current state before pass execution.
   *
   * @param renderer - Three.js renderer (WebGL or WebGPU)
   * @param scene - Current scene
   * @param camera - Current camera
   */
  capture(renderer: SupportedRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    // Cast to common interface - both renderers implement these methods
    const r = renderer as unknown as RendererWithState

    // Capture renderer state
    this.rendererState = {
      renderTarget: r.getRenderTarget(),
      clearColor: r.getClearColor(this.tempColor).clone(),
      clearAlpha: r.getClearAlpha(),
      autoClear: r.autoClear,
      autoClearColor: r.autoClearColor,
      autoClearDepth: r.autoClearDepth,
      autoClearStencil: r.autoClearStencil,
    }

    // Capture scene state
    this.sceneState = {
      background: scene.background,
      environment: scene.environment,
      overrideMaterial: scene.overrideMaterial,
    }

    // Capture camera state
    this.cameraState = {
      layersMask: camera.layers.mask,
    }
  }

  /**
   * Restore state after pass execution.
   *
   * @param renderer - Three.js renderer (WebGL or WebGPU)
   * @param scene - Current scene
   * @param camera - Current camera
   */
  restore(renderer: SupportedRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    // Cast to common interface
    const r = renderer as unknown as RendererWithState

    // Restore renderer state
    if (this.rendererState) {
      r.setRenderTarget(this.rendererState.renderTarget)
      r.setClearColor(this.rendererState.clearColor, this.rendererState.clearAlpha)
      r.autoClear = this.rendererState.autoClear
      r.autoClearColor = this.rendererState.autoClearColor
      r.autoClearDepth = this.rendererState.autoClearDepth
      r.autoClearStencil = this.rendererState.autoClearStencil
    }

    // Restore scene state
    if (this.sceneState) {
      scene.background = this.sceneState.background
      scene.environment = this.sceneState.environment
      scene.overrideMaterial = this.sceneState.overrideMaterial
    }

    // Restore camera state
    if (this.cameraState) {
      camera.layers.mask = this.cameraState.layersMask
    }
  }

  // ==========================================================================
  // State Access (for debugging)
  // ==========================================================================

  /**
   * Check if state has been captured.
   * @returns True if state has been captured
   */
  hasCapturedState(): boolean {
    return this.rendererState !== null
  }

  /**
   * Get captured renderer state (for debugging).
   * @returns Captured renderer state or null
   */
  getRendererState(): RendererState | null {
    return this.rendererState ? { ...this.rendererState } : null
  }

  /**
   * Get captured scene state (for debugging).
   * @returns Captured scene state or null
   */
  getSceneState(): SceneState | null {
    return this.sceneState ? { ...this.sceneState } : null
  }

  /**
   * Get captured camera state (for debugging).
   * @returns Captured camera state or null
   */
  getCameraState(): CameraState | null {
    return this.cameraState ? { ...this.cameraState } : null
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Clear captured state.
   */
  clear(): void {
    this.rendererState = null
    this.sceneState = null
    this.cameraState = null
  }
}
