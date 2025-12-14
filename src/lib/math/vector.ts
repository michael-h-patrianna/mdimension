/**
 * N-dimensional vector operations
 * All operations are pure functions with no side effects
 */

import type { VectorND } from './types'
import { EPSILON } from './types'

/**
 * Creates an n-dimensional vector initialized with a fill value
 * @param dimension - The dimensionality of the vector
 * @param fill - Optional fill value (defaults to 0)
 * @returns A new vector filled with the specified value
 * @throws {Error} If dimension is not a positive integer
 */
export function createVector(dimension: number, fill = 0): VectorND {
  if (dimension <= 0 || !Number.isInteger(dimension)) {
    throw new Error('Dimension must be a positive integer')
  }
  return new Array(dimension).fill(fill)
}

/**
 * Adds two vectors element-wise
 * Formula: c[i] = a[i] + b[i]
 * @param a - First vector
 * @param b - Second vector
 * @param out
 * @returns New vector containing the sum
 * @throws {Error} If vectors have different dimensions (DEV only)
 * @note Validation is DEV-only for performance in production hot paths
 */
export function addVectors(a: VectorND, b: VectorND, out?: VectorND): VectorND {
  if (import.meta.env.DEV && a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`)
  }

  const result = out ?? new Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! + b[i]!
  }
  return result
}

/**
 * Subtracts vector b from vector a element-wise
 * Formula: c[i] = a[i] - b[i]
 * @param a - First vector
 * @param b - Second vector (subtracted from first)
 * @param out - Optional output vector to avoid allocation
 * @returns Vector containing the difference
 * @throws {Error} If vectors have different dimensions (DEV only)
 * @note Validation is DEV-only for performance in production hot paths
 */
export function subtractVectors(a: VectorND, b: VectorND, out?: VectorND): VectorND {
  if (import.meta.env.DEV && a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`)
  }
  const result = out ?? new Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! - b[i]!
  }
  return result
}

/**
 * Multiplies a vector by a scalar value
 * Formula: b[i] = a[i] * scalar
 * @param v - Input vector
 * @param scalar - Scalar multiplier
 * @param out - Optional output vector to avoid allocation
 * @returns Vector scaled by the scalar
 */
export function scaleVector(v: VectorND, scalar: number, out?: VectorND): VectorND {
  const result = out ?? new Array(v.length)
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i]! * scalar
  }
  return result
}

/**
 * Computes the dot product of two vectors
 * Formula: a · b = Σ(a[i] * b[i])
 * @param a - First vector
 * @param b - Second vector
 * @returns The scalar dot product
 * @throws {Error} If vectors have different dimensions (DEV only)
 * @note Validation is DEV-only for performance in production hot paths
 */
export function dotProduct(a: VectorND, b: VectorND): number {
  if (import.meta.env.DEV && a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`)
  }
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!
  }
  return sum
}

/**
 * Computes the magnitude (length) of a vector
 * Formula: ||v|| = √(Σ(v[i]²))
 * @param v - Input vector
 * @returns The magnitude of the vector
 */
export function magnitude(v: VectorND): number {
  let sumSquares = 0
  for (let i = 0; i < v.length; i++) {
    sumSquares += v[i]! * v[i]!
  }
  return Math.sqrt(sumSquares)
}

/**
 * Normalizes a vector to unit length
 * Formula: v̂ = v / ||v||
 * @param v - Input vector
 * @param out - Optional output vector to avoid allocation
 * @returns Unit vector in the same direction
 * @throws {Error} If the vector has zero magnitude
 */
export function normalize(v: VectorND, out?: VectorND): VectorND {
  const mag = magnitude(v)

  if (mag < EPSILON) {
    throw new Error('Cannot normalize zero vector')
  }

  return scaleVector(v, 1 / mag, out)
}

/**
 * Checks if two vectors are approximately equal within epsilon
 * @param a - First vector
 * @param b - Second vector
 * @param epsilon - Tolerance for floating point comparison
 * @returns True if vectors are approximately equal
 */
export function vectorsEqual(a: VectorND, b: VectorND, epsilon = EPSILON): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) >= epsilon) {
      return false
    }
  }
  return true
}

/**
 * Creates a copy of a vector
 * @param v - Input vector
 * @param out - Optional output vector to avoid allocation
 * @returns Vector with the same values
 */
export function copyVector(v: VectorND, out?: VectorND): VectorND {
  const result = out ?? new Array(v.length)
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i]!
  }
  return result
}
