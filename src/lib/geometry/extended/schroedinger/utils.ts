/**
 * Utility Functions for Schroedinger
 *
 * Helper functions for statistics and other utilities.
 */

import type { SchroedingerSample } from './sampling'

/**
 * Compute statistics about a Schroedinger computation
 *
 * @param samples - Array of computed samples
 * @param maxIter - Maximum iterations (bounded points have escapeTime >= maxIter)
 * @returns Statistics object
 */
export function getSchroedingerStats(
  samples: SchroedingerSample[],
  maxIter: number
): {
  total: number
  bounded: number
  escaped: number
  boundedRatio: number
  minEscapeTime: number
  maxEscapeTime: number
  avgEscapeTime: number
} {
  // Bounded points have escapeTime >= maxIter (they didn't escape)
  const bounded = samples.filter((s) => s.escapeTime >= maxIter).length
  // Escaped points have escapeTime < maxIter
  const escaped = samples.filter((s) => s.escapeTime < maxIter)

  const escapeTimes = escaped.map((s) => s.escapeTime)
  const minEscapeTime = escapeTimes.length > 0 ? Math.min(...escapeTimes) : 0
  const maxEscapeTime = escapeTimes.length > 0 ? Math.max(...escapeTimes) : 0
  const avgEscapeTime =
    escapeTimes.length > 0 ? escapeTimes.reduce((a, b) => a + b, 0) / escapeTimes.length : 0

  return {
    total: samples.length,
    bounded,
    escaped: escaped.length,
    boundedRatio: samples.length > 0 ? bounded / samples.length : 0,
    minEscapeTime,
    maxEscapeTime,
    avgEscapeTime,
  }
}
