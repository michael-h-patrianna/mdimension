/**
 * N-D Embedding Math Tests
 *
 * Tests for the N-dimensional embedding functions used in black hole raymarching.
 * These tests verify the TypeScript equivalents of the GLSL functions in embedding.glsl.ts.
 *
 * The GLSL functions use float[11] arrays; here we use number[] for testing.
 */

import { describe, it, expect } from 'vitest'

// TypeScript implementations of GLSL functions for testing

const ND_EPSILON = 0.0001

/**
 * Initialize an N-D vector to zero.
 * @returns An 11-dimensional zero vector
 */
function zeroND(): number[] {
  return new Array(11).fill(0)
}

/**
 * Copy an N-D vector.
 * @param src - The source vector to copy
 * @returns A new copy of the source vector
 */
function copyND(src: number[]): number[] {
  return [...src]
}

/**
 * Compute squared length of an N-D vector.
 * @param v - The vector to compute squared length for
 * @param dimension - The number of dimensions to consider
 * @returns The squared Euclidean length
 */
function lengthSqND(v: number[], dimension: number): number {
  let sum = 0
  for (let i = 0; i < dimension; i++) {
    sum += (v[i] ?? 0) * (v[i] ?? 0)
  }
  return sum
}

/**
 * Compute length of an N-D vector.
 * @param v - The vector to compute length for
 * @param dimension - The number of dimensions to consider
 * @returns The Euclidean length
 */
function lengthND(v: number[], dimension: number): number {
  return Math.sqrt(lengthSqND(v, dimension))
}

/**
 * Normalize an N-D vector in place.
 * @param v - The vector to normalize
 * @param dimension - The number of dimensions to consider
 * @returns The normalized vector
 */
function normalizeND(v: number[], dimension: number): number[] {
  const result = [...v]
  const len = lengthND(v, dimension)
  if (len > ND_EPSILON) {
    const invLen = 1 / len
    for (let i = 0; i < dimension; i++) {
      result[i] = (result[i] ?? 0) * invLen
    }
  }
  return result
}

/**
 * Dot product of two N-D vectors.
 * @param a - First vector
 * @param b - Second vector
 * @param dimension - The number of dimensions to consider
 * @returns The dot product
 */
function dotND(a: number[], b: number[], dimension: number): number {
  let sum = 0
  for (let i = 0; i < dimension; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0)
  }
  return sum
}

/**
 * Project an N-D position back to 3D.
 * @param posN - The N-D position vector
 * @returns The 3D projected position [x, y, z]
 */
function projectNDto3D(posN: number[]): [number, number, number] {
  return [posN[0] ?? 0, posN[1] ?? 0, posN[2] ?? 0]
}

/**
 * Embed a 3D direction into N-D space.
 * @param dir3d - The 3D direction vector
 * @returns An 11-dimensional embedded vector
 */
function embedDir3DtoND(dir3d: [number, number, number]): number[] {
  const dirN = zeroND()
  dirN[0] = dir3d[0]
  dirN[1] = dir3d[1]
  dirN[2] = dir3d[2]
  return dirN
}

/**
 * Add two N-D vectors.
 * @param a - First vector
 * @param b - Second vector
 * @param dimension - The number of dimensions to consider
 * @returns The sum vector
 */
function addND(a: number[], b: number[], dimension: number): number[] {
  const result = zeroND()
  for (let i = 0; i < dimension; i++) {
    result[i] = (a[i] ?? 0) + (b[i] ?? 0)
  }
  return result
}

/**
 * Scale an N-D vector.
 * @param v - The vector to scale
 * @param scalar - The scalar multiplier
 * @param dimension - The number of dimensions to consider
 * @returns The scaled vector
 */
function scaleND(v: number[], scalar: number, dimension: number): number[] {
  const result = zeroND()
  for (let i = 0; i < dimension; i++) {
    result[i] = (v[i] ?? 0) * scalar
  }
  return result
}

describe('N-D Embedding Math', () => {
  describe('zeroND', () => {
    it('initializes all 11 components to zero', () => {
      const v = zeroND()
      expect(v).toHaveLength(11)
      expect(v.every((x) => x === 0)).toBe(true)
    })
  })

  describe('copyND', () => {
    it('creates an independent copy', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      const copy = copyND(original)
      expect(copy).toEqual(original)
      copy[0] = 999
      expect(original[0]).toBe(1) // Original unchanged
    })
  })

  describe('lengthND', () => {
    it('returns correct Euclidean distance for unit vector', () => {
      const v = zeroND()
      v[0] = 1
      expect(lengthND(v, 4)).toBeCloseTo(1, 6)
    })

    it('returns correct length for 3D vector', () => {
      const v = zeroND()
      v[0] = 3
      v[1] = 4
      expect(lengthND(v, 3)).toBeCloseTo(5, 6)
    })

    it('returns correct length for 4D vector', () => {
      const v = zeroND()
      v[0] = 1
      v[1] = 2
      v[2] = 3
      v[3] = 4
      // sqrt(1 + 4 + 9 + 16) = sqrt(30)
      expect(lengthND(v, 4)).toBeCloseTo(Math.sqrt(30), 6)
    })

    it('only considers dimensions up to specified count', () => {
      const v = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
      expect(lengthND(v, 3)).toBeCloseTo(Math.sqrt(3), 6)
      expect(lengthND(v, 4)).toBeCloseTo(2, 6) // sqrt(4)
      expect(lengthND(v, 11)).toBeCloseTo(Math.sqrt(11), 6)
    })
  })

  describe('normalizeND', () => {
    it('produces unit vector', () => {
      const v = zeroND()
      v[0] = 3
      v[1] = 4
      const normalized = normalizeND(v, 3)
      expect(lengthND(normalized, 3)).toBeCloseTo(1, 6)
    })

    it('preserves direction', () => {
      const v = zeroND()
      v[0] = 6
      v[1] = 8
      const normalized = normalizeND(v, 3)
      // Direction should be (0.6, 0.8, 0)
      expect(normalized[0]).toBeCloseTo(0.6, 6)
      expect(normalized[1]).toBeCloseTo(0.8, 6)
      expect(normalized[2]).toBeCloseTo(0, 6)
    })

    it('handles near-zero vectors gracefully', () => {
      const v = zeroND()
      v[0] = 0.00001
      const normalized = normalizeND(v, 3)
      // Should not normalize extremely small vectors
      expect(normalized[0]).toBeCloseTo(0.00001, 6)
    })

    it('works in 4D', () => {
      const v = zeroND()
      v[0] = 1
      v[1] = 1
      v[2] = 1
      v[3] = 1
      const normalized = normalizeND(v, 4)
      expect(lengthND(normalized, 4)).toBeCloseTo(1, 6)
    })
  })

  describe('dotND', () => {
    it('returns correct dot product for orthogonal vectors', () => {
      const a = zeroND()
      const b = zeroND()
      a[0] = 1
      b[1] = 1
      expect(dotND(a, b, 4)).toBeCloseTo(0, 6)
    })

    it('returns correct dot product for parallel vectors', () => {
      const a = zeroND()
      const b = zeroND()
      a[0] = 2
      b[0] = 3
      expect(dotND(a, b, 4)).toBeCloseTo(6, 6)
    })

    it('returns length squared for same vector', () => {
      const v = zeroND()
      v[0] = 3
      v[1] = 4
      expect(dotND(v, v, 3)).toBeCloseTo(25, 6)
    })
  })

  describe('embedDir3DtoND', () => {
    it('preserves 3D direction in first 3 components', () => {
      const dir3d: [number, number, number] = [0.577, 0.577, 0.577]
      const dirN = embedDir3DtoND(dir3d)
      expect(dirN[0]).toBeCloseTo(0.577, 6)
      expect(dirN[1]).toBeCloseTo(0.577, 6)
      expect(dirN[2]).toBeCloseTo(0.577, 6)
    })

    it('sets higher dimensions to zero', () => {
      const dir3d: [number, number, number] = [1, 0, 0]
      const dirN = embedDir3DtoND(dir3d)
      for (let i = 3; i < 11; i++) {
        expect(dirN[i]).toBe(0)
      }
    })
  })

  describe('projectNDto3D', () => {
    it('extracts first 3 components', () => {
      const posN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      const pos3d = projectNDto3D(posN)
      expect(pos3d).toEqual([1, 2, 3])
    })

    it('round-trips 3D direction correctly', () => {
      const original: [number, number, number] = [0.5, 0.7, -0.5]
      const embedded = embedDir3DtoND(original)
      const projected = projectNDto3D(embedded)
      expect(projected[0]).toBeCloseTo(original[0], 6)
      expect(projected[1]).toBeCloseTo(original[1], 6)
      expect(projected[2]).toBeCloseTo(original[2], 6)
    })
  })

  describe('addND', () => {
    it('adds vectors component-wise', () => {
      const a = zeroND()
      const b = zeroND()
      a[0] = 1
      a[1] = 2
      b[0] = 3
      b[1] = 4
      const result = addND(a, b, 4)
      expect(result[0]).toBe(4)
      expect(result[1]).toBe(6)
    })

    it('zeros components beyond dimension', () => {
      const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      const b = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
      const result = addND(a, b, 4)
      expect(result[4]).toBe(0) // Beyond dimension
    })
  })

  describe('scaleND', () => {
    it('scales all components by scalar', () => {
      const v = zeroND()
      v[0] = 2
      v[1] = 3
      const result = scaleND(v, 2, 4)
      expect(result[0]).toBe(4)
      expect(result[1]).toBe(6)
    })

    it('zeros components beyond dimension', () => {
      const v = [1, 2, 3, 4, 5, 0, 0, 0, 0, 0, 0]
      const result = scaleND(v, 10, 3)
      expect(result[3]).toBe(0) // Beyond dimension 3
    })
  })
})
