/**
 * GPU Timer for TSL/WebGPU Render Graph
 *
 * Provides GPU timing functionality for performance monitoring.
 * For WebGPU, this requires the 'timestamp-query' feature which may not be
 * available on all devices. When unavailable, gracefully falls back to CPU timing.
 *
 * ## WebGPU Timestamp Queries
 * WebGPU timestamp queries are more complex than WebGL:
 * - Requires 'timestamp-query' feature enabled on device
 * - Uses GPUQuerySet with type 'timestamp'
 * - Results are async (require buffer mapping)
 * - Not all devices support this feature
 *
 * ## Fallback Behavior
 * When WebGPU timestamps aren't available:
 * - Returns 0 for GPU times
 * - CPU times still work via performance.now()
 * - No performance impact from missing feature
 *
 * @module rendering/graph-tsl/GPUTimerTSL
 */

import type { WebGPURenderer } from 'three/webgpu'
import type * as THREE from 'three'

import { isWebGPUBackend, isWebGLRenderer, type SupportedRenderer } from '@/rendering/core/rendererUtils'
import { GPUTimer } from '@/rendering/graph/GPUTimer'

/**
 * GPU Timer for WebGPU/TSL render graph.
 *
 * Provides the same interface as the WebGL GPUTimer but handles both
 * WebGL and WebGPU backends.
 *
 * For WebGL: Delegates to the existing GPUTimer implementation.
 * For WebGPU: Currently returns CPU-only timing (GPU timestamps TODO).
 */
export class GPUTimerTSL {
  /** Whether timing is available */
  private available = false

  /** Whether timing is enabled */
  private enabled = false

  /** Whether we're using WebGPU backend */
  private isWebGPU = false

  /** Delegate to WebGL GPUTimer when using WebGL backend */
  private webglTimer: GPUTimer | null = null

  /** Current pass being timed */
  private currentPassId: string | null = null

  /** CPU start time for current pass */
  private cpuStartTime = 0

  /** Collected timing results (GPU time in ms) */
  private timingResults: Map<string, number> = new Map()

  /** Frame counter for periodic logging */
  private frameCount = 0

  /**
   * Initialize the timer with a renderer.
   *
   * For WebGL: Uses EXT_disjoint_timer_query_webgl2 extension.
   * For WebGPU: Currently provides CPU timing only (GPU timestamps TODO).
   *
   * @param renderer - The Three.js renderer (WebGL or WebGPU)
   * @returns True if timing is available
   */
  initialize(renderer: SupportedRenderer): boolean {
    this.isWebGPU = !isWebGLRenderer(renderer)

    if (this.isWebGPU) {
      // WebGPU backend
      // TODO: Implement WebGPU timestamp queries when widely supported
      // For now, we provide CPU timing only
      const gpuRenderer = renderer as WebGPURenderer

      // For now, always available for CPU timing
      this.available = true
      this.webglTimer = null

      if (import.meta.env.DEV) {
        console.info('[GPUTimerTSL] Initialized for WebGPU (CPU timing only)')

        // Log backend info
        const backend = gpuRenderer.backend as { isWebGPU?: boolean; device?: unknown }
        console.info('[GPUTimerTSL] Backend info:', {
          isWebGPU: isWebGPUBackend(renderer),
          hasDevice: !!backend?.device,
        })
      }

      return this.available
    } else {
      // WebGL backend - delegate to existing GPUTimer
      this.webglTimer = new GPUTimer()
      this.available = this.webglTimer.initialize(renderer as THREE.WebGLRenderer)

      if (import.meta.env.DEV) {
        console.info(`[GPUTimerTSL] Initialized for WebGL: ${this.available ? 'available' : 'unavailable'}`)
      }

      return this.available
    }
  }

  /**
   * Check if timing is available.
   * @returns True if timing can be used
   */
  isAvailable(): boolean {
    if (this.webglTimer) {
      return this.webglTimer.isAvailable()
    }
    return this.available
  }

  /**
   * Enable or disable timing collection.
   * @param enabled - Whether to collect timing data
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.webglTimer) {
      this.webglTimer.setEnabled(enabled)
    }
  }

  /**
   * Check if timing is enabled.
   * @returns True if timing is enabled
   */
  isEnabled(): boolean {
    if (this.webglTimer) {
      return this.webglTimer.isEnabled()
    }
    return this.enabled && this.available
  }

  /**
   * Begin timing a pass (alias for beginQuery to match GPUTimer API).
   *
   * For WebGPU: Records CPU start time.
   * For WebGL: Delegates to GPUTimer.
   *
   * @param passId - Unique identifier for the pass
   */
  beginQuery(passId: string): void {
    if (!this.isEnabled()) return

    if (this.webglTimer) {
      this.webglTimer.beginQuery(passId)
      return
    }

    // WebGPU: CPU timing
    this.currentPassId = passId
    this.cpuStartTime = performance.now()
  }

  /**
   * End timing the current pass (alias for endQuery to match GPUTimer API).
   *
   * For WebGPU: Records CPU end time.
   * For WebGL: Delegates to GPUTimer.
   */
  endQuery(): void {
    if (!this.isEnabled()) return

    if (this.webglTimer) {
      this.webglTimer.endQuery()
      return
    }

    // WebGPU: CPU timing - store as "GPU" time since we don't have real GPU timing
    if (this.currentPassId) {
      const timeMs = performance.now() - this.cpuStartTime
      this.timingResults.set(this.currentPassId, timeMs)
      this.currentPassId = null
    }
  }

  /**
   * Begin a new frame.
   * Call at the start of each render frame.
   */
  beginFrame(): void {
    if (this.webglTimer) {
      this.webglTimer.beginFrame()
      return
    }

    // WebGPU: Clear results for new frame
    this.timingResults.clear()
    this.frameCount++
  }

  /**
   * End the current frame.
   * Call at the end of each render frame.
   */
  endFrame(): void {
    if (this.webglTimer) {
      this.webglTimer.endFrame()
      return
    }

    // WebGPU: Nothing special needed
  }

  /**
   * Get timing for a specific pass.
   *
   * @param passId - Pass identifier
   * @returns Time in milliseconds or 0 if not available
   */
  getPassTime(passId: string): number {
    if (this.webglTimer) {
      return this.webglTimer.getPassTime(passId)
    }

    return this.timingResults.get(passId) ?? 0
  }

  /**
   * Get all timing results for the current frame.
   * @returns Map of pass ID to GPU time in ms
   */
  getResults(): Map<string, number> {
    if (this.webglTimer) {
      // Convert GPUTimingResult to just the gpuTimeMs
      const results = this.webglTimer.getResults()
      const simplified = new Map<string, number>()
      for (const [id, result] of results) {
        simplified.set(id, result.gpuTimeMs)
      }
      return simplified
    }

    return new Map(this.timingResults)
  }

  /**
   * Clear timing results.
   */
  clearResults(): void {
    if (this.webglTimer) {
      this.webglTimer.clearResults()
      return
    }
    this.timingResults.clear()
  }

  /**
   * Handle context loss (WebGL) or device loss (WebGPU).
   */
  invalidateForContextLoss(): void {
    if (this.webglTimer) {
      this.webglTimer.invalidateForContextLoss()
      return
    }

    // WebGPU: Reset state
    this.available = false
    this.timingResults.clear()
    this.currentPassId = null
  }

  /**
   * Reinitialize after context/device restoration.
   * @param renderer - The renderer
   */
  reinitialize(renderer: SupportedRenderer): void {
    if (this.webglTimer) {
      this.webglTimer.reinitialize(renderer as THREE.WebGLRenderer)
      return
    }

    // WebGPU: Reinitialize
    this.initialize(renderer)
    if (this.enabled) {
      this.setEnabled(true)
    }
  }

  /**
   * Dispose of timer resources.
   */
  dispose(): void {
    if (this.webglTimer) {
      this.webglTimer.dispose()
      this.webglTimer = null
    }

    this.timingResults.clear()
    this.available = false
    this.enabled = false
    this.currentPassId = null
  }
}
