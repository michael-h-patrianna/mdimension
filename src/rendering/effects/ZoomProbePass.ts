/**
 * ZoomProbePass - Lightweight probe pass for zoom autopilot feedback
 *
 * Renders a tiny texture (1x1, 2x2, or 4x4 pixels) to sample the center
 * of the view and determine hit/miss statistics for autopilot steering.
 *
 * CRITICAL: Uses target.viewport.set() instead of gl.setViewport() to
 * avoid DPR multiplication issues on high-DPI displays.
 */
import * as THREE from 'three'

export interface ProbeResult {
  /** Ratio of pixels that hit a surface (0-1) */
  hitRatio: number
  /** Average distance to hit surface (normalized 0-1) */
  avgHitDistance: number
  /** Average trap value at hit points (0-1) */
  avgTrapValue: number
  /** Average iteration ratio at hit points (0-1) */
  avgIterRatio: number
  /** Variance of hit distances (for interest score) */
  distanceVariance: number
  /** Whether any surface was hit */
  hasHit: boolean
}

export type ProbeSize = 1 | 4 | 16 | 64

/**
 * Probe pass for sampling center-screen fractal information.
 * Used by zoom autopilot strategies to avoid zooming into void.
 */
export class ZoomProbePass {
  private probeTarget: THREE.WebGLRenderTarget
  private readBuffer: Float32Array
  private pixelCount: number
  private lastProbeTime = 0
  private _result: ProbeResult = {
    hitRatio: 1,
    avgHitDistance: 0,
    avgTrapValue: 0,
    avgIterRatio: 0,
    distanceVariance: 0,
    hasHit: true,
  }

  /**
   * Create a new probe pass.
   * @param size Number of pixels to sample (1, 4, 16, or 64)
   */
  constructor(private size: ProbeSize = 1) {
    const dim = Math.sqrt(size)
    this.pixelCount = size

    // Create tiny render target for probe
    // CRITICAL: Use FloatType for accurate readback
    this.probeTarget = new THREE.WebGLRenderTarget(dim, dim, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })

    // Pre-allocate read buffer (4 floats per pixel: RGBA)
    this.readBuffer = new Float32Array(size * 4)
  }

  /**
   * Get the current probe result
   * @returns The current probe result
   */
  get result(): ProbeResult {
    return this._result
  }

  /**
   * Get time since last probe in milliseconds
   * @returns Time since last probe in milliseconds
   */
  get timeSinceLastProbe(): number {
    return performance.now() - this.lastProbeTime
  }

  /**
   * Execute the probe pass.
   * Renders the scene to the tiny probe target and reads back pixel data.
   *
   * @param renderer The WebGL renderer
   * @param scene The scene to render
   * @param camera The camera to use
   * @param _material The mandelbulb shader material (to temporarily modify)
   * @returns The probe result
   */
  probe(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    _material?: THREE.ShaderMaterial
  ): ProbeResult {
    // Set viewport directly on target (avoid DPR multiplication)
    // See CLAUDE.md: CRITICAL DPR/VIEWPORT GOTCHA
    this.probeTarget.viewport.set(0, 0, this.probeTarget.width, this.probeTarget.height)

    // Render to probe target
    const previousTarget = renderer.getRenderTarget()
    renderer.setRenderTarget(this.probeTarget)
    renderer.render(scene, camera)
    renderer.setRenderTarget(previousTarget)

    // Read back pixel data
    renderer.readRenderTargetPixels(
      this.probeTarget,
      0,
      0,
      this.probeTarget.width,
      this.probeTarget.height,
      this.readBuffer
    )

    // Parse results
    this._result = this.parseResults()
    this.lastProbeTime = performance.now()

    return this._result
  }

  /**
   * Parse the read buffer to extract probe statistics.
   * Expected pixel format:
   * - R: hit flag (>0.5 = hit)
   * - G: normalized hit distance (0-1)
   * - B: trap value (0-1)
   * - A: iteration ratio (0-1)
   *
   * Note: The main shader outputs standard color, so we interpret
   * non-black pixels as "hit" and use luminance as a proxy for trap/distance.
   * @returns Parsed probe result with hit ratio and statistics
   */
  private parseResults(): ProbeResult {
    let hits = 0
    let totalDist = 0
    let totalTrap = 0
    let totalIterRatio = 0
    const distances: number[] = []

    for (let i = 0; i < this.pixelCount; i++) {
      const r = this.readBuffer[i * 4] ?? 0
      const g = this.readBuffer[i * 4 + 1] ?? 0
      const b = this.readBuffer[i * 4 + 2] ?? 0
      const a = this.readBuffer[i * 4 + 3] ?? 0

      // Interpret as hit if alpha > 0.01 (not fully transparent)
      // This works with the standard mandelbulb output
      const isHit = a > 0.01

      if (isHit) {
        hits++
        // Use luminance as proxy for distance/trap
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        const dist = 1.0 - luminance // Closer = darker = lower distance
        totalDist += dist
        totalTrap += luminance
        totalIterRatio += a
        distances.push(dist)
      }
    }

    const hitRatio = hits / this.pixelCount
    const avgHitDistance = hits > 0 ? totalDist / hits : 1.0
    const avgTrapValue = hits > 0 ? totalTrap / hits : 0
    const avgIterRatio = hits > 0 ? totalIterRatio / hits : 0

    // Compute variance for interest score
    let distanceVariance = 0
    if (distances.length > 1) {
      const mean = avgHitDistance
      for (const d of distances) {
        distanceVariance += (d - mean) * (d - mean)
      }
      distanceVariance /= distances.length
    }

    return {
      hitRatio,
      avgHitDistance,
      avgTrapValue,
      avgIterRatio,
      distanceVariance,
      hasHit: hits > 0,
    }
  }

  /**
   * Check if enough time has passed since the last probe.
   * @param frequencyHz Desired probe frequency in Hz
   * @returns True if a new probe should be performed
   */
  shouldProbe(frequencyHz: number): boolean {
    const intervalMs = 1000 / frequencyHz
    return this.timeSinceLastProbe >= intervalMs
  }

  /**
   * Resize the probe target.
   * @param newSize New probe size (1, 4, 16, or 64)
   */
  resize(newSize: ProbeSize): void {
    if (newSize === this.size) return

    this.size = newSize
    this.pixelCount = newSize
    const dim = Math.sqrt(newSize)

    // Dispose old target
    this.probeTarget.dispose()

    // Create new target
    this.probeTarget = new THREE.WebGLRenderTarget(dim, dim, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })

    // Reallocate buffer
    this.readBuffer = new Float32Array(newSize * 4)
  }

  /**
   * Dispose of GPU resources.
   */
  dispose(): void {
    this.probeTarget.dispose()
  }
}
