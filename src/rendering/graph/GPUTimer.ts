/**
 * GPU Timer
 *
 * Implements WebGL2 timer queries using EXT_disjoint_timer_query_webgl2 extension.
 * Provides per-pass GPU timing instrumentation for the render graph.
 *
 * Key behaviors:
 * - Graceful degradation when extension unavailable
 * - Async result retrieval (GPU queries are async by nature)
 * - Query pool reuse to avoid allocation pressure
 * - Disjoint detection for reliable measurements
 *
 * @module rendering/graph/GPUTimer
 */

import type * as THREE from 'three'

// =============================================================================
// WebGL Extension Type Declaration
// =============================================================================

/**
 * Type definition for EXT_disjoint_timer_query_webgl2 extension.
 * This extension is not in the standard WebGL2 type definitions.
 */
interface EXTDisjointTimerQueryWebGL2 {
  readonly TIME_ELAPSED_EXT: GLenum
  readonly TIMESTAMP_EXT: GLenum
  readonly GPU_DISJOINT_EXT: GLenum
  readonly QUERY_COUNTER_BITS_EXT: GLenum
}

/**
 * Result from a completed GPU timing query.
 */
export interface GPUTimingResult {
  /** Pass identifier */
  passId: string

  /** GPU time in milliseconds (0 if unavailable) */
  gpuTimeMs: number

  /** Whether the measurement is valid (not disjoint) */
  valid: boolean
}

/**
 * State for a pending query.
 */
interface PendingQuery {
  /** Pass identifier this query is for */
  passId: string

  /** The WebGL query object */
  query: WebGLQuery

  /** Frame number when the query was started */
  frameNumber: number
}

/**
 * GPU Timer using EXT_disjoint_timer_query_webgl2.
 *
 * Timer queries are inherently asynchronous - results from frame N
 * are typically available on frame N+1 or N+2. This class handles
 * the async nature by maintaining pending queries and polling for
 * results each frame.
 *
 * @example
 * ```typescript
 * const timer = new GPUTimer();
 * timer.initialize(renderer);
 *
 * // In render loop:
 * timer.beginFrame();
 *
 * timer.beginQuery('bloomPass');
 * // ... execute bloom pass ...
 * timer.endQuery();
 *
 * timer.endFrame();
 *
 * // Results from previous frames:
 * const timings = timer.getResults();
 * ```
 */
export class GPUTimer {
  private gl: WebGL2RenderingContext | null = null
  private ext: EXTDisjointTimerQueryWebGL2 | null = null
  private enabled = false
  private available = false

  // Query pool for reuse (avoids allocation pressure)
  private queryPool: WebGLQuery[] = []
  private poolMaxSize = 32

  // Currently active query
  private activeQuery: { passId: string; query: WebGLQuery } | null = null

  // Pending queries waiting for results
  private pendingQueries: PendingQuery[] = []

  // Completed results from previous frames
  private completedResults: Map<string, GPUTimingResult> = new Map()

  // Frame tracking
  private currentFrame = 0
  private maxPendingFrames = 4 // Don't hold queries for too long

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the GPU timer with a Three.js renderer.
   *
   * @param renderer - Three.js WebGL renderer
   * @returns Whether GPU timing is available
   */
  initialize(renderer: THREE.WebGLRenderer): boolean {
    const context = renderer.getContext()

    // Must be WebGL2 - check if WebGL2RenderingContext exists (not available in Node.js/test env)
    // and if context is an instance of it
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext

    if (!isWebGL2) {
      // Also check if context looks like WebGL2 by duck-typing
      // This handles mock contexts in tests
      if (!context || typeof context.getExtension !== 'function') {
        console.warn('GPUTimer: WebGL2 context required')
        this.available = false
        return false
      }
    }

    this.gl = context as WebGL2RenderingContext

    // Try to get the timer query extension
    this.ext = this.gl.getExtension(
      'EXT_disjoint_timer_query_webgl2'
    ) as EXTDisjointTimerQueryWebGL2 | null

    if (!this.ext) {
      // Extension not available (common on mobile, some browsers)
      console.info('GPUTimer: EXT_disjoint_timer_query_webgl2 not available')
      this.available = false
      return false
    }

    this.available = true
    console.info('GPUTimer: GPU timing available')
    return true
  }

  /**
   * Check if GPU timing is available.
   *
   * @returns True if extension is supported
   */
  isAvailable(): boolean {
    return this.available
  }

  /**
   * Enable or disable timing collection.
   *
   * @param enabled - Whether to collect timing data
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled && this.available
  }

  /**
   * Check if timing is currently enabled.
   *
   * @returns True if timing collection is active
   */
  isEnabled(): boolean {
    return this.enabled
  }

  // ==========================================================================
  // Frame Lifecycle
  // ==========================================================================

  /**
   * Begin a new frame. Call at the start of each render frame.
   */
  beginFrame(): void {
    if (!this.enabled || !this.gl || !this.ext) return

    this.currentFrame++
    this.pollPendingQueries()
  }

  /**
   * End the current frame. Call at the end of each render frame.
   */
  endFrame(): void {
    // Ensure no dangling active query
    if (this.activeQuery) {
      console.warn('GPUTimer: Active query was not ended before frame end')
      this.endQuery()
    }
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Begin timing a pass.
   *
   * @param passId - Pass identifier
   */
  beginQuery(passId: string): void {
    if (!this.enabled || !this.gl || !this.ext) return

    // End any dangling query
    if (this.activeQuery) {
      console.warn(`GPUTimer: Query '${this.activeQuery.passId}' was not ended`)
      this.endQuery()
    }

    // Get or create a query object
    const query = this.acquireQuery()
    if (!query) return

    // Begin the query
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query)
    this.activeQuery = { passId, query }
  }

  /**
   * End the current timing query.
   */
  endQuery(): void {
    if (!this.enabled || !this.gl || !this.ext || !this.activeQuery) return

    // End the query
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)

    // Move to pending
    this.pendingQueries.push({
      passId: this.activeQuery.passId,
      query: this.activeQuery.query,
      frameNumber: this.currentFrame,
    })

    this.activeQuery = null
  }

  // ==========================================================================
  // Result Retrieval
  // ==========================================================================

  /**
   * Get completed timing results.
   *
   * Returns results from queries that have completed (typically from
   * previous frames). Results are keyed by pass ID.
   *
   * @returns Map of pass ID to timing result
   */
  getResults(): Map<string, GPUTimingResult> {
    return this.completedResults
  }

  /**
   * Get GPU time for a specific pass (in milliseconds).
   *
   * @param passId - Pass identifier
   * @returns GPU time in ms, or 0 if not available
   */
  getPassTime(passId: string): number {
    return this.completedResults.get(passId)?.gpuTimeMs ?? 0
  }

  /**
   * Clear all completed results.
   */
  clearResults(): void {
    this.completedResults.clear()
  }

  // ==========================================================================
  // Query Pool Management
  // ==========================================================================

  /**
   * Acquire a query object from the pool or create a new one.
   *
   * @returns Query object or null if creation failed
   */
  private acquireQuery(): WebGLQuery | null {
    if (!this.gl) return null

    if (this.queryPool.length > 0) {
      return this.queryPool.pop()!
    }

    const query = this.gl.createQuery()
    if (!query) {
      console.warn('GPUTimer: Failed to create query object')
      return null
    }

    return query
  }

  /**
   * Return a query object to the pool for reuse.
   *
   * @param query - Query to return to pool
   */
  private releaseQuery(query: WebGLQuery): void {
    if (this.queryPool.length < this.poolMaxSize) {
      this.queryPool.push(query)
    } else {
      this.gl?.deleteQuery(query)
    }
  }

  /**
   * Poll pending queries for completed results.
   */
  private pollPendingQueries(): void {
    if (!this.gl || !this.ext) return

    // Check for disjoint (GPU clock was reset, all pending queries invalid)
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)
    if (disjoint) {
      // All pending queries are invalid - clear them
      for (const pending of this.pendingQueries) {
        this.releaseQuery(pending.query)
      }
      this.pendingQueries = []
      return
    }

    // Process pending queries
    const stillPending: PendingQuery[] = []

    for (const pending of this.pendingQueries) {
      // Check if query result is available
      const available = this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT_AVAILABLE)

      if (available) {
        // Get the result (in nanoseconds)
        const timeNs = this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT)
        const timeMs = Number(timeNs) / 1_000_000

        // Store result
        this.completedResults.set(pending.passId, {
          passId: pending.passId,
          gpuTimeMs: timeMs,
          valid: true,
        })

        // Return query to pool
        this.releaseQuery(pending.query)
      } else if (this.currentFrame - pending.frameNumber > this.maxPendingFrames) {
        // Query is too old, discard it
        this.completedResults.set(pending.passId, {
          passId: pending.passId,
          gpuTimeMs: 0,
          valid: false,
        })
        this.releaseQuery(pending.query)
      } else {
        // Keep waiting
        stillPending.push(pending)
      }
    }

    this.pendingQueries = stillPending
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose all resources.
   */
  dispose(): void {
    if (!this.gl) return

    // End any active query
    if (this.activeQuery && this.ext) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      this.gl.deleteQuery(this.activeQuery.query)
      this.activeQuery = null
    }

    // Delete pending queries
    for (const pending of this.pendingQueries) {
      this.gl.deleteQuery(pending.query)
    }
    this.pendingQueries = []

    // Delete pooled queries
    for (const query of this.queryPool) {
      this.gl.deleteQuery(query)
    }
    this.queryPool = []

    this.completedResults.clear()
    this.gl = null
    this.ext = null
    this.available = false
    this.enabled = false
  }

  /**
   * Handle WebGL context loss.
   */
  invalidateForContextLoss(): void {
    // All GL objects are invalid after context loss
    this.activeQuery = null
    this.pendingQueries = []
    this.queryPool = []
    this.completedResults.clear()
    this.gl = null
    this.ext = null
    this.available = false
  }

  /**
   * Reinitialize after context restoration.
   *
   * @param renderer - Three.js WebGL renderer
   */
  reinitialize(renderer: THREE.WebGLRenderer): void {
    const wasEnabled = this.enabled
    this.initialize(renderer)
    if (wasEnabled) {
      this.setEnabled(true)
    }
  }
}
