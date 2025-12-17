/**
 * ZoomAutopilot - Automatic void avoidance for fractal zoom
 *
 * Implements three strategies for keeping interesting features in view
 * during zoom animation:
 *
 * 1. Center-Ray Lock (default): Simple probe-based steering
 * 2. Interest Score: Hill-climb optimization for visual interest
 * 3. Boundary Target: Classic Mandelbrot boundary tracking
 */
import * as THREE from 'three'
import { ZoomProbePass, ProbeSize, ProbeResult } from './ZoomProbePass'

/** Autopilot strategy type */
export type AutopilotStrategy = 'centerRayLock' | 'interestScore' | 'boundaryTarget'

/** Interest score metric type */
export type InterestMetric = 'hitRatio' | 'variance' | 'edgeStrength'

/** Configuration for Center-Ray Lock strategy */
export interface CenterRayLockConfig {
  probeSize: ProbeSize
  probeFrequency: number
  missThreshold: number
  nudgeStrength: number
}

/** Configuration for Interest Score strategy */
export interface InterestScoreConfig {
  resolution: 32 | 64 | 128
  interval: number
  candidates: number
  nudgeRadius: number
  metric: InterestMetric
}

/** Configuration for Boundary Target strategy */
export interface BoundaryTargetConfig {
  escapeRatio: number
  band: number
  correctionStrength: number
}

/** Full autopilot configuration */
export interface AutopilotConfig {
  strategy: AutopilotStrategy
  centerRayLock: CenterRayLockConfig
  interestScore: InterestScoreConfig
  boundaryTarget: BoundaryTargetConfig
}

/** Result from autopilot update */
export interface AutopilotResult {
  /** Suggested origin nudge in D-space (length = dimension) - adjusts uOrigin */
  originNudge: number[]
  /** Zoom speed multiplier (0-1, lower = slower zoom) */
  zoomSpeedMultiplier: number
  /** Whether autopilot suggests pausing zoom */
  shouldPauseZoom: boolean
  /** Debug info */
  debug: {
    strategy: AutopilotStrategy
    hitRatio: number
    interestScore?: number
    nudgeDirection?: string
  }
}

/** Default autopilot configuration */
export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = {
  strategy: 'centerRayLock',
  centerRayLock: {
    probeSize: 1,
    probeFrequency: 15,
    missThreshold: 0.5,
    nudgeStrength: 0.02,
  },
  interestScore: {
    resolution: 64,
    interval: 30,
    candidates: 4,
    nudgeRadius: 0.05,
    metric: 'variance',
  },
  boundaryTarget: {
    escapeRatio: 0.7,
    band: 0.2,
    correctionStrength: 0.03,
  },
}

/**
 * Autopilot controller for zoom void avoidance.
 */
export class ZoomAutopilot {
  private probePass: ZoomProbePass
  private frameCount = 0
  private lastNudgeDirection: number[] = []
  private consecutiveMisses = 0

  // For interest score: track best candidate
  private candidateScores: number[] = []
  private candidateNudges: number[][] = []

  constructor(private config: AutopilotConfig = DEFAULT_AUTOPILOT_CONFIG) {
    // Initialize probe pass with appropriate size based on strategy
    const probeSize = this.getProbeSize()
    this.probePass = new ZoomProbePass(probeSize)
  }

  /**
   * Get the probe size based on current strategy.
   */
  private getProbeSize(): ProbeSize {
    switch (this.config.strategy) {
      case 'centerRayLock':
        return this.config.centerRayLock.probeSize
      case 'interestScore':
        // Interest score needs larger probe for variance calculation
        return Math.min(64, this.config.interestScore.resolution) as ProbeSize
      case 'boundaryTarget':
        return 4 // 2x2 is enough for boundary detection
      default:
        return 1
    }
  }

  /**
   * Update the autopilot configuration.
   */
  updateConfig(config: Partial<AutopilotConfig>): void {
    this.config = { ...this.config, ...config }

    // Resize probe if needed
    const newSize = this.getProbeSize()
    this.probePass.resize(newSize)
  }

  /**
   * Update the autopilot and get steering suggestions.
   *
   * @param renderer WebGL renderer
   * @param scene Scene to render
   * @param camera Camera to use
   * @param currentOrigin Current origin in D-space
   * @param dimension Current dimension
   * @returns Autopilot result with nudge and speed suggestions
   */
  update(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    currentOrigin: Float32Array,
    dimension: number
  ): AutopilotResult {
    this.frameCount++

    // Check if we should probe based on strategy timing
    if (!this.shouldProbe()) {
      return this.noOpResult()
    }

    // Execute probe
    const probeResult = this.probePass.probe(renderer, scene, camera)

    // Apply strategy-specific logic
    switch (this.config.strategy) {
      case 'centerRayLock':
        return this.applyCenterRayLock(probeResult, currentOrigin, dimension)
      case 'interestScore':
        return this.applyInterestScore(probeResult, currentOrigin, dimension)
      case 'boundaryTarget':
        return this.applyBoundaryTarget(probeResult, currentOrigin, dimension)
      default:
        return this.noOpResult()
    }
  }

  /**
   * Check if we should perform a probe based on strategy timing.
   */
  private shouldProbe(): boolean {
    switch (this.config.strategy) {
      case 'centerRayLock':
        return this.probePass.shouldProbe(this.config.centerRayLock.probeFrequency)
      case 'interestScore':
        return this.frameCount % this.config.interestScore.interval === 0
      case 'boundaryTarget':
        return this.probePass.shouldProbe(15) // Fixed 15 Hz for boundary
      default:
        return false
    }
  }

  /**
   * Strategy A: Center-Ray Lock
   * Simple and fast - nudge D-dimensional origin when missing.
   * The zoom happens around uOrigin, so nudging it tracks interesting regions.
   */
  private applyCenterRayLock(
    probe: ProbeResult,
    _currentOrigin: Float32Array,  // Reserved for future origin-based decisions
    dimension: number
  ): AutopilotResult {
    const { missThreshold, nudgeStrength } = this.config.centerRayLock

    // Track consecutive misses
    if (probe.hitRatio < missThreshold) {
      this.consecutiveMisses++
    } else {
      this.consecutiveMisses = 0
    }

    // If hit ratio is good, continue normally
    if (probe.hitRatio >= missThreshold) {
      return {
        originNudge: [],
        zoomSpeedMultiplier: 1.0,
        shouldPauseZoom: false,
        debug: {
          strategy: 'centerRayLock',
          hitRatio: probe.hitRatio,
        },
      }
    }

    // Hit ratio is low - nudge D-dimensional origin to find surface
    // This moves where we zoom around in fractal space
    const nudge = this.computeNudgeVector(dimension, nudgeStrength)

    // Slow down zoom based on how many consecutive misses
    const speedMult = Math.max(0.1, 1.0 - this.consecutiveMisses * 0.2)

    return {
      originNudge: nudge,
      zoomSpeedMultiplier: speedMult,
      shouldPauseZoom: this.consecutiveMisses > 10,
      debug: {
        strategy: 'centerRayLock',
        hitRatio: probe.hitRatio,
        nudgeDirection: this.lastNudgeDirection.slice(0, 3).join(','),
      },
    }
  }

  /**
   * Strategy B: Interest Score
   * Hill-climb to maximize visual interest (variance, edges, etc.)
   * Nudges D-dimensional origin to find more interesting regions.
   */
  private applyInterestScore(
    probe: ProbeResult,
    _currentOrigin: Float32Array,  // Reserved for future origin-based decisions
    dimension: number
  ): AutopilotResult {
    const { candidates, nudgeRadius, metric } = this.config.interestScore

    // Compute score for current position
    const currentScore = this.computeInterestScore(probe, metric)

    // Generate candidate nudges if we haven't yet
    if (this.candidateNudges.length === 0) {
      this.generateCandidates(dimension, candidates, nudgeRadius)
      this.candidateScores = new Array(candidates).fill(-Infinity)
    }

    // Store current score as baseline
    const baselineScore = this.candidateScores[0] ?? -Infinity
    this.candidateScores[0] = Math.max(baselineScore, currentScore)

    // Find best candidate from previous probes
    let bestIdx = 0
    let bestScore = this.candidateScores[0] ?? -Infinity
    for (let i = 1; i < this.candidateScores.length; i++) {
      const score = this.candidateScores[i] ?? -Infinity
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    // If best is not current position, apply that nudge to D-dimensional origin
    const nudge = bestIdx > 0 ? (this.candidateNudges[bestIdx] ?? []) : []

    // Reset candidates periodically
    if (this.frameCount % (this.config.interestScore.interval * candidates * 2) === 0) {
      this.candidateNudges = []
      this.candidateScores = []
    }

    // Slow down if interest is low
    const speedMult = currentScore < 0.1 ? 0.5 : 1.0

    return {
      originNudge: nudge,
      zoomSpeedMultiplier: speedMult,
      shouldPauseZoom: currentScore < 0.01,
      debug: {
        strategy: 'interestScore',
        hitRatio: probe.hitRatio,
        interestScore: currentScore,
      },
    }
  }

  /**
   * Strategy C: Boundary Target
   * Aim for pixels near the escape boundary (classic Mandelbrot style).
   * Nudges D-dimensional origin to stay near interesting boundary regions.
   */
  private applyBoundaryTarget(
    probe: ProbeResult,
    _currentOrigin: Float32Array,  // Reserved for future origin-based decisions
    dimension: number
  ): AutopilotResult {
    const { escapeRatio, band, correctionStrength } = this.config.boundaryTarget

    // Use iteration ratio as proxy for how close to boundary
    const iterRatio = probe.avgIterRatio

    // Target is escapeRatio (e.g., 0.7)
    // We want to nudge toward the boundary band
    const lowerBound = escapeRatio - band / 2
    const upperBound = escapeRatio + band / 2

    let nudge: number[] = []
    let speedMult = 1.0

    if (iterRatio < lowerBound) {
      // Too far inside - nudge D-dimensional origin outward
      nudge = this.computeNudgeVector(dimension, correctionStrength)
      speedMult = 0.7
    } else if (iterRatio > upperBound) {
      // Too far outside - nudge D-dimensional origin inward
      nudge = this.computeNudgeVector(dimension, -correctionStrength)
      speedMult = 0.7
    }

    // If hit ratio is very low, slow down significantly
    if (probe.hitRatio < 0.1) {
      speedMult = 0.3
      nudge = this.computeNudgeVector(dimension, correctionStrength * 2)
    }

    return {
      originNudge: nudge,
      zoomSpeedMultiplier: speedMult,
      shouldPauseZoom: probe.hitRatio < 0.05,
      debug: {
        strategy: 'boundaryTarget',
        hitRatio: probe.hitRatio,
        interestScore: iterRatio,
      },
    }
  }

  /**
   * Compute a quasi-random nudge vector in D-space.
   * Uses golden ratio phases for good space coverage.
   * Nudges ALL dimensions including 0,1,2 to steer the zoom center.
   */
  private computeNudgeVector(dimension: number, strength: number): number[] {
    const PHI = 1.618033988749895
    const nudge: number[] = new Array(dimension).fill(0)

    // Nudge ALL dimensions - the first 3 (x,y,z in fractal space) control
    // where the zoom converges to, which is critical for boundary targeting
    for (let i = 0; i < dimension; i++) {
      const phase = i * PHI + this.frameCount * 0.01
      nudge[i] = Math.sin(phase) * strength
    }

    this.lastNudgeDirection = nudge
    return nudge
  }

  /**
   * Generate candidate nudge vectors for interest score strategy.
   * Generates nudges in ALL dimensions to explore fractal space.
   */
  private generateCandidates(
    dimension: number,
    count: number,
    radius: number
  ): void {
    this.candidateNudges = []

    // First candidate is always "no nudge"
    this.candidateNudges.push([])

    // Generate other candidates using golden ratio spacing
    // Nudge ALL dimensions including 0,1,2 to explore different zoom targets
    const PHI = 1.618033988749895
    for (let c = 1; c < count; c++) {
      const nudge: number[] = new Array(dimension).fill(0)
      for (let i = 0; i < dimension; i++) {
        const phase = c * PHI + i * PHI * 2
        nudge[i] = Math.cos(phase) * radius * (c / count)
      }
      this.candidateNudges.push(nudge)
    }
  }

  /**
   * Compute interest score from probe result based on selected metric.
   */
  private computeInterestScore(probe: ProbeResult, metric: InterestMetric): number {
    switch (metric) {
      case 'hitRatio':
        // Balance: too few or too many hits are boring
        return 4 * probe.hitRatio * (1 - probe.hitRatio)
      case 'variance':
        // Higher variance = more interesting depth variation
        return Math.sqrt(probe.distanceVariance)
      case 'edgeStrength':
        // Use trap value variation as edge proxy
        return probe.avgTrapValue * probe.hitRatio
      default:
        return probe.hitRatio
    }
  }

  /**
   * Return a no-op result (no changes).
   */
  private noOpResult(): AutopilotResult {
    return {
      originNudge: [],
      zoomSpeedMultiplier: 1.0,
      shouldPauseZoom: false,
      debug: {
        strategy: this.config.strategy,
        hitRatio: this.probePass.result.hitRatio,
      },
    }
  }

  /**
   * Reset autopilot state (e.g., when zoom is reset).
   */
  reset(): void {
    this.consecutiveMisses = 0
    this.candidateScores = []
    this.candidateNudges = []
    this.lastNudgeDirection = []
    this.frameCount = 0
  }

  /**
   * Dispose of GPU resources.
   */
  dispose(): void {
    this.probePass.dispose()
  }
}
