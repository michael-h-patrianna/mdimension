/**
 * N-dimensional vector operations
 * All operations are pure functions with no side effects
 */

import type { VectorND } from './types';
import { EPSILON } from './types';

/**
 * Creates an n-dimensional vector initialized with a fill value
 * @param dimension - The dimensionality of the vector
 * @param fill - Optional fill value (defaults to 0)
 * @returns A new vector filled with the specified value
 * @throws {Error} If dimension is not a positive integer
 */
export function createVector(dimension: number, fill = 0): VectorND {
  if (dimension <= 0 || !Number.isInteger(dimension)) {
    throw new Error('Dimension must be a positive integer');
  }
  return new Array(dimension).fill(fill);
}

/**
 * Adds two vectors element-wise
 * Formula: c[i] = a[i] + b[i]
 * @param a - First vector
 * @param b - Second vector
 * @returns New vector containing the sum
 * @throws {Error} If vectors have different dimensions
 */
export function addVectors(a: VectorND, b: VectorND, out?: VectorND): VectorND {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  
  const result = out ?? new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i]! + b[i]!;
  }
  return result;
}

/**
 * Subtracts vector b from vector a element-wise
 * Formula: c[i] = a[i] - b[i]
 * @param a - First vector
 * @param b - Second vector (subtracted from first)
 * @returns New vector containing the difference
 * @throws {Error} If vectors have different dimensions
 */
export function subtractVectors(a: VectorND, b: VectorND): VectorND {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  return a.map((val, i) => val - b[i]!);
}

/**
 * Multiplies a vector by a scalar value
 * Formula: b[i] = a[i] * scalar
 * @param v - Input vector
 * @param scalar - Scalar multiplier
 * @returns New vector scaled by the scalar
 */
export function scaleVector(v: VectorND, scalar: number): VectorND {
  return v.map(val => val * scalar);
}

/**
 * Computes the dot product of two vectors
 * Formula: a · b = Σ(a[i] * b[i])
 * @param a - First vector
 * @param b - Second vector
 * @returns The scalar dot product
 * @throws {Error} If vectors have different dimensions
 */
export function dotProduct(a: VectorND, b: VectorND): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
  }
  return a.reduce((sum, val, i) => sum + val * b[i]!, 0);
}

/**
 * Computes the magnitude (length) of a vector
 * Formula: ||v|| = √(Σ(v[i]²))
 * @param v - Input vector
 * @returns The magnitude of the vector
 */
export function magnitude(v: VectorND): number {
  const sumSquares = v.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumSquares);
}

/**
 * Normalizes a vector to unit length
 * Formula: v̂ = v / ||v||
 * @param v - Input vector
 * @returns New unit vector in the same direction
 * @throws {Error} If the vector has zero magnitude
 */
export function normalize(v: VectorND): VectorND {
  const mag = magnitude(v);

  if (mag < EPSILON) {
    throw new Error('Cannot normalize zero vector');
  }

  return scaleVector(v, 1 / mag);
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
    return false;
  }
  return a.every((val, i) => Math.abs(val - b[i]!) < epsilon);
}

/**
 * Creates a copy of a vector
 * @param v - Input vector
 * @returns New vector with the same values
 */
export function copyVector(v: VectorND): VectorND {
  return [...v];
}
