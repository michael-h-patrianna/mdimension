/**
 * BlackHole Types and Constants
 *
 * Shared types and constants used across the black hole rendering system.
 */

import type { MatrixND } from '@/lib/math/types'

/** Maximum supported dimension for N-D embedding */
export const MAX_DIMENSION = 11

/**
 * Pre-allocated working arrays for rotation calculations
 * These are reused each frame to avoid allocation overhead.
 */
export interface WorkingArrays {
  unitX: number[]
  unitY: number[]
  unitZ: number[]
  origin: number[]
  rotatedX: Float32Array
  rotatedY: Float32Array
  rotatedZ: Float32Array
  rotatedOrigin: Float32Array
}

/**
 * Create pre-allocated working arrays for rotation calculations
 * @returns Object containing pre-allocated basis and origin arrays
 */
export function createWorkingArrays(): WorkingArrays {
  return {
    unitX: new Array(MAX_DIMENSION).fill(0),
    unitY: new Array(MAX_DIMENSION).fill(0),
    unitZ: new Array(MAX_DIMENSION).fill(0),
    origin: new Array(MAX_DIMENSION).fill(0),
    rotatedX: new Float32Array(MAX_DIMENSION),
    rotatedY: new Float32Array(MAX_DIMENSION),
    rotatedZ: new Float32Array(MAX_DIMENSION),
    rotatedOrigin: new Float32Array(MAX_DIMENSION),
  }
}

/**
 * Apply D-dimensional rotation matrix to a vector
 *
 * @param matrix - D×D rotation matrix as flat array
 * @param vec - Input vector to rotate
 * @param out - Output Float32Array to store result (pre-allocated)
 * @param dimension - Number of dimensions to rotate
 */
export function applyRotationInPlace(
  matrix: MatrixND,
  vec: number[],
  out: Float32Array,
  dimension: number
): void {
  out.fill(0)
  for (let i = 0; i < dimension; i++) {
    let sum = 0
    const rowOffset = i * dimension
    for (let j = 0; j < dimension; j++) {
      sum += (matrix[rowOffset + j] ?? 0) * (vec[j] ?? 0)
    }
    out[i] = sum
  }
}

/** Mapping from palette mode string to shader integer */
export const PALETTE_MODE_MAP: Record<string, number> = {
  diskGradient: 0,
  normalBased: 1,
  shellOnly: 2,
  heatmap: 3,
}

/** Mapping from ray bending mode string to shader integer */
export const RAY_BENDING_MODE_MAP: Record<string, number> = {
  spiral: 0,
  orbital: 1,
}

/** Mapping from manifold type string to shader integer */
export const MANIFOLD_TYPE_MAP: Record<string, number> = {
  autoByN: 0,
  disk: 1,
  sheet: 2,
  slab: 3,
  field: 4,
}

/** Mapping from lighting mode string to shader integer */
export const LIGHTING_MODE_MAP: Record<string, number> = {
  emissiveOnly: 0,
  fakeLit: 1,
}
