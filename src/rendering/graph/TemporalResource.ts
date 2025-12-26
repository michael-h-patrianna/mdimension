/**
 * Temporal Resource
 *
 * Manages N-frame history for temporal effects like reprojection, accumulation,
 * and multi-frame resource availability (e.g., cubemaps that need 2 frames).
 *
 * ## Industry Pattern
 * Based on Unreal's FTemporalAAHistory and Unity's RTHandle ping-pong patterns.
 * Resources maintain a circular buffer of N frames, with explicit APIs for
 * reading previous frames and validating history availability.
 *
 * ## Use Cases
 * - CubemapCapturePass: Needs 2 frames before skybox is valid for black hole
 * - Temporal Accumulation: Reads from previous frame while writing to current
 * - Motion Vectors: Compares current and previous frame positions
 *
 * @module rendering/graph/TemporalResource
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for a temporal resource.
 */
export interface TemporalResourceConfig<T> {
  /**
   * Number of frames to keep in history.
   * - 2 = ping-pong buffer (current + previous)
   * - 3+ = multi-frame history for complex temporal effects
   */
  historyLength: number

  /**
   * Factory function to create each buffer.
   * Called once per history slot during initialization.
   */
  factory: () => T

  /**
   * Optional dispose function for cleanup.
   * Called when resource is disposed or history is invalidated.
   */
  dispose?: (value: T) => void

  /**
   * Optional debug name for logging.
   */
  debugName?: string
}

// =============================================================================
// Temporal Resource Class
// =============================================================================

/**
 * Manages N-frame history for a resource.
 *
 * @example
 * ```typescript
 * // Create a 2-frame cubemap history
 * const cubemapHistory = new TemporalResource({
 *   historyLength: 2,
 *   factory: () => new THREE.WebGLCubeRenderTarget(512),
 *   dispose: (target) => target.dispose(),
 *   debugName: 'skyboxCubemap'
 * });
 *
 * // In pass execute:
 * const writeTarget = cubemapHistory.getWrite();
 * cubeCamera.update(renderer, scene);
 *
 * // Check if previous frame is available
 * if (cubemapHistory.hasValidHistory(1)) {
 *   const readTarget = cubemapHistory.getRead(1);
 *   scene.background = readTarget.texture;
 * }
 *
 * // At frame end:
 * cubemapHistory.advanceFrame();
 * ```
 */
export class TemporalResource<T> {
  /** Circular buffer of resource instances */
  private history: T[]

  /** Current write index in circular buffer */
  private writeIndex = 0

  /** Number of valid frames accumulated since last reset */
  private framesSinceReset = 0

  /** Configuration */
  private config: TemporalResourceConfig<T>

  /** Whether the resource has been disposed */
  private disposed = false

  /**
   * Create a temporal resource with N-frame history.
   *
   * @param config - Configuration including history length and factory
   */
  constructor(config: TemporalResourceConfig<T>) {
    if (config.historyLength < 1) {
      throw new Error('TemporalResource: historyLength must be at least 1')
    }

    this.config = config
    this.history = []

    // Pre-allocate all history slots
    for (let i = 0; i < config.historyLength; i++) {
      this.history.push(config.factory())
    }
  }

  // ===========================================================================
  // Read/Write Access
  // ===========================================================================

  /**
   * Get the current frame's write target.
   *
   * This is the buffer that should be rendered to in the current frame.
   *
   * @returns The write target for the current frame
   * @throws Error if resource has been disposed
   */
  getWrite(): T {
    this.checkDisposed()
    return this.history[this.writeIndex]!
  }

  /**
   * Get a previous frame's read target.
   *
   * @param frameOffset - How many frames back to read (1 = previous frame)
   * @returns The read target from N frames ago
   * @throws Error if offset exceeds history length or resource is disposed
   */
  getRead(frameOffset: number = 1): T {
    this.checkDisposed()

    if (frameOffset < 0) {
      throw new Error(`TemporalResource: frameOffset must be non-negative, got ${frameOffset}`)
    }

    if (frameOffset >= this.config.historyLength) {
      throw new Error(
        `TemporalResource: frameOffset ${frameOffset} exceeds history length ${this.config.historyLength}`
      )
    }

    // Calculate read index (go backwards in circular buffer)
    const readIndex =
      (this.writeIndex - frameOffset + this.config.historyLength) % this.config.historyLength
    return this.history[readIndex]!
  }

  /**
   * Check if history at the given offset is valid.
   *
   * History is invalid immediately after creation or invalidation.
   * It becomes valid after enough frames have been accumulated.
   *
   * @param frameOffset - How many frames back to check (1 = previous frame)
   * @returns True if the history at this offset is valid
   */
  hasValidHistory(frameOffset: number = 1): boolean {
    if (this.disposed) return false
    if (frameOffset < 0) return false
    if (frameOffset >= this.config.historyLength) return false

    // We need at least (frameOffset + 1) frames to have valid history
    // e.g., to read 1 frame back, we need at least 2 frames worth of data
    return this.framesSinceReset > frameOffset
  }

  /**
   * Get the number of valid history frames available.
   *
   * @returns Number of frames that can be safely read
   */
  getValidHistoryCount(): number {
    if (this.disposed) return 0
    return Math.min(this.framesSinceReset, this.config.historyLength - 1)
  }

  // ===========================================================================
  // Frame Management
  // ===========================================================================

  /**
   * Advance to the next frame.
   *
   * Call this at the end of each frame AFTER all passes have executed.
   * This moves the write pointer and updates history validity.
   */
  advanceFrame(): void {
    this.checkDisposed()

    // Move write index forward in circular buffer
    this.writeIndex = (this.writeIndex + 1) % this.config.historyLength

    // Track frames for validity
    this.framesSinceReset++
  }

  /**
   * Invalidate all history.
   *
   * Call this when a discontinuity occurs (e.g., camera teleport,
   * object type change, context loss). After invalidation,
   * hasValidHistory() will return false until enough new frames
   * are accumulated.
   *
   * Note: This does NOT dispose the underlying resources - they
   * are simply marked as invalid.
   */
  invalidateHistory(): void {
    if (this.disposed) return

    this.framesSinceReset = 0

    if (this.config.debugName && import.meta.env.DEV) {
      console.log(`[TemporalResource:${this.config.debugName}] History invalidated`)
    }
  }

  /**
   * Get frames since last reset/invalidation.
   *
   * Useful for debugging and determining warmup state.
   * @returns Number of frames since last reset
   */
  getFramesSinceReset(): number {
    return this.framesSinceReset
  }

  /**
   * Check if the resource has accumulated enough frames to be "warm".
   *
   * A resource is warm when it has valid history at all offsets.
   * @returns True if the resource is warm
   */
  isWarm(): boolean {
    return this.framesSinceReset >= this.config.historyLength
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Dispose all underlying resources.
   *
   * After disposal, all methods will throw or return safely.
   */
  dispose(): void {
    if (this.disposed) return

    // Dispose all history entries
    if (this.config.dispose) {
      for (const entry of this.history) {
        this.config.dispose(entry)
      }
    }

    this.history = []
    this.disposed = true

    if (this.config.debugName && import.meta.env.DEV) {
      console.log(`[TemporalResource:${this.config.debugName}] Disposed`)
    }
  }

  /**
   * Check if the resource has been disposed.
   * @returns True if disposed
   */
  isDisposed(): boolean {
    return this.disposed
  }

  // ===========================================================================
  // Configuration Access
  // ===========================================================================

  /**
   * Get the history length configuration.
   * @returns The history length
   */
  getHistoryLength(): number {
    return this.config.historyLength
  }

  /**
   * Get the debug name (if configured).
   * @returns Debug name or undefined
   */
  getDebugName(): string | undefined {
    return this.config.debugName
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Throw if resource has been disposed.
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error(
        `TemporalResource${this.config.debugName ? `:${this.config.debugName}` : ''}: Resource has been disposed`
      )
    }
  }
}
