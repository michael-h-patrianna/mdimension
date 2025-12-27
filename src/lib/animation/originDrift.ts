/**
 * Origin Drift Animation
 *
 * Provides multi-frequency oscillation for slice origin in extra dimensions.
 * Combined with rotation, this creates "feature birth/death" effects where
 * fractal structures emerge and recede over time.
 *
 * Each dimension beyond XYZ oscillates with a different frequency and phase,
 * using golden-ratio spacing for non-repeating patterns.
 *
 * @see docs/prd/fractal-morphing-animation.md
 */

import { fsin } from '@/lib/math/trig'
import { GOLDEN_RATIO } from './biasCalculation'

/**
 * Configuration for origin drift animation
 */
export interface OriginDriftConfig {
  /** Enable/disable origin drift */
  enabled: boolean
  /** Maximum displacement in extra dimensions (0.01 to 0.5) */
  amplitude: number
  /** Base oscillation frequency in Hz (0.05 to 0.5) */
  baseFrequency: number
  /** Per-dimension frequency variation factor (0.0 to 1.0) */
  frequencySpread: number
}

/**
 * Default origin drift configuration
 * NOTE: Conservative defaults for smooth, slow morphing to avoid visual jitter
 */
export const DEFAULT_ORIGIN_DRIFT_CONFIG: OriginDriftConfig = {
  enabled: false,
  amplitude: 0.03, // Very subtle displacement to avoid jitter
  baseFrequency: 0.04, // Slow oscillation (~25 second cycle at 1x speed)
  frequencySpread: 0.2, // Moderate phase spread
}

/**
 * Phase offset to ensure dimension 0 doesn't start at sin(0) = 0
 */
const PHASE_OFFSET = Math.PI / 4

/**
 * Calculates drifted origin values for extra dimensions.
 *
 * For each dimension d >= 3:
 * - freq_d = baseFrequency * (1 + (d-3) * frequencySpread * 0.5)
 * - phase_d = d * goldenRatio * 2pi * bias
 * - offset_d = amplitude * sin(time * freq_d + phase_d)
 * - origin[d] = baseValue[d] + offset_d
 *
 * @param baseValues - Static parameter values for extra dimensions
 * @param time - Animation time in seconds
 * @param config - Drift configuration
 * @param animationSpeed - Global animation speed multiplier
 * @param animationBias - Controls phase spread between dimensions (0-1)
 * @returns Array of drifted origin values
 */
export function computeDriftedOrigin(
  baseValues: number[],
  time: number,
  config: OriginDriftConfig,
  animationSpeed: number = 1.0,
  animationBias: number = 0.5
): number[] {
  if (!config.enabled || baseValues.length === 0) {
    return [...baseValues]
  }

  const result: number[] = new Array(baseValues.length)
  const effectiveFrequency = config.baseFrequency * animationSpeed

  for (let i = 0; i < baseValues.length; i++) {
    // Dimension index in full space (i=0 corresponds to dimension 3, i.e., 4th dimension)
    const dimIndex = i + 3

    // Per-dimension frequency variation
    // Higher dimensions oscillate slightly faster/slower based on frequencySpread
    const freqMultiplier = 1 + i * config.frequencySpread * 0.5
    const freq = effectiveFrequency * freqMultiplier

    // Golden-ratio phase offset for non-repeating patterns
    // Bias controls how spread out the phases are
    const phase = PHASE_OFFSET + dimIndex * GOLDEN_RATIO * 2 * Math.PI * animationBias

    // Calculate displacement using fast trig for animation performance
    const offset = config.amplitude * fsin(time * freq * 2 * Math.PI + phase)

    const baseValue = baseValues[i]
    result[i] = (baseValue !== undefined ? baseValue : 0) + offset
  }

  return result
}

// Note: Pre-allocated arrays are created inside functions to avoid unused variable warnings
// while still providing the optimization pattern for mesh components

/**
 * Computes drifted origin values into a pre-allocated Float32Array.
 * Use this in animation loops to avoid per-frame allocations.
 *
 * @param output - Pre-allocated Float32Array to write results
 * @param baseValues - Static parameter values for extra dimensions
 * @param time - Animation time in seconds
 * @param config - Drift configuration
 * @param animationSpeed - Global animation speed multiplier
 * @param animationBias - Controls phase spread between dimensions (0-1)
 * @param dimension - Total dimension count (3-11)
 */
export function computeDriftedOriginInPlace(
  output: Float32Array,
  baseValues: number[],
  time: number,
  config: OriginDriftConfig,
  animationSpeed: number = 1.0,
  animationBias: number = 0.5,
  dimension: number = 3
): void {
  // First 3 components are always 0 (XYZ slice origin)
  output[0] = 0
  output[1] = 0
  output[2] = 0

  if (!config.enabled || dimension <= 3) {
    // Copy base values without drift
    for (let i = 0; i < baseValues.length && i + 3 < 11; i++) {
      const value = baseValues[i]
      output[i + 3] = value !== undefined ? value : 0
    }
    // Zero out remaining
    for (let i = baseValues.length + 3; i < 11; i++) {
      output[i] = 0
    }
    return
  }

  const effectiveFrequency = config.baseFrequency * animationSpeed

  for (let i = 0; i < dimension - 3 && i < baseValues.length; i++) {
    const dimIndex = i + 3
    const freqMultiplier = 1 + i * config.frequencySpread * 0.5
    const freq = effectiveFrequency * freqMultiplier
    const phase = PHASE_OFFSET + dimIndex * GOLDEN_RATIO * 2 * Math.PI * animationBias
    const offset = config.amplitude * fsin(time * freq * 2 * Math.PI + phase)

    const baseValue = baseValues[i]
    output[i + 3] = (baseValue !== undefined ? baseValue : 0) + offset
  }

  // Zero out remaining dimensions
  for (let i = dimension; i < 11; i++) {
    output[i] = 0
  }
}

/**
 * Gets frequency for a specific extra dimension.
 * Useful for visualization or debugging.
 *
 * @param dimIndex - Dimension index (3, 4, 5, etc.)
 * @param baseFrequency - Base oscillation frequency
 * @param frequencySpread - Per-dimension frequency variation
 * @returns Effective frequency for that dimension
 */
export function getDimensionFrequency(
  dimIndex: number,
  baseFrequency: number,
  frequencySpread: number
): number {
  if (dimIndex < 3) return 0
  const i = dimIndex - 3
  const freqMultiplier = 1 + i * frequencySpread * 0.5
  return baseFrequency * freqMultiplier
}

/**
 * Gets phase offset for a specific extra dimension.
 *
 * @param dimIndex - Dimension index (3, 4, 5, etc.)
 * @param animationBias - Controls phase spread (0-1)
 * @returns Phase offset in radians
 */
export function getDimensionPhase(dimIndex: number, animationBias: number): number {
  return PHASE_OFFSET + dimIndex * GOLDEN_RATIO * 2 * Math.PI * animationBias
}
