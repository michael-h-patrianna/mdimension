/**
 * Fast Vertex Hashing for N-dimensional Deduplication
 *
 * Uses FNV-1a hash for O(1) average-case deduplication, replacing
 * the O(d) string-based approach (toFixed().join()).
 *
 * FNV-1a is a non-cryptographic hash optimized for:
 * - Speed: Simple bitwise operations
 * - Distribution: Good avalanche properties
 * - Streaming: Can hash incrementally
 *
 * @see https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */

import type { VectorND } from '@/lib/math'
import { FNV_CONSTANTS, WYTHOFF_CONFIG } from '../config'

/**
 * FNV-1a 32-bit hash constants (from centralized config)
 */
const FNV_OFFSET_BASIS = FNV_CONSTANTS.OFFSET_BASIS
const FNV_PRIME = FNV_CONSTANTS.PRIME

/**
 * Tolerance for vertex coordinate comparison (from centralized config).
 * Coordinates within this tolerance are considered equal.
 */
const COORD_TOLERANCE = WYTHOFF_CONFIG.VERTEX_TOLERANCE

/**
 * Quantize a floating-point coordinate to an integer for hashing.
 * This ensures vertices that are "equal" (within tolerance) hash to the same value.
 *
 * We multiply by 1e6 (inverse of tolerance) and round to get consistent integers.
 */
function quantizeCoord(value: number): number {
  // Round to 6 decimal places (matches tolerance)
  return Math.round(value * 1e6)
}

/**
 * Compute FNV-1a hash of a vertex.
 *
 * The vertex coordinates are quantized to integers before hashing,
 * ensuring that vertices within tolerance hash to the same value.
 *
 * @param vertex - N-dimensional vertex
 * @returns 32-bit hash value
 */
export function hashVertex(vertex: VectorND): number {
  let hash = FNV_OFFSET_BASIS

  for (let i = 0; i < vertex.length; i++) {
    const quantized = quantizeCoord(vertex[i] ?? 0)

    // Hash each byte of the 32-bit integer
    // JavaScript numbers are 64-bit floats, but our quantized values fit in 32 bits
    hash ^= quantized & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
    hash ^= (quantized >>> 8) & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
    hash ^= (quantized >>> 16) & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
    hash ^= (quantized >>> 24) & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }

  return hash >>> 0 // Ensure unsigned 32-bit
}

/**
 * Check if two vertices are equal within tolerance.
 *
 * @param a - First vertex
 * @param b - Second vertex
 * @returns True if vertices are equal within tolerance
 */
export function verticesEqual(a: VectorND, b: VectorND): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > COORD_TOLERANCE) {
      return false
    }
  }

  return true
}

/**
 * Create a string key for a vertex (for fallback collision resolution).
 * This is the original approach, used only when hash collision occurs.
 */
export function vertexToKey(vertex: VectorND): string {
  return vertex.map(v => (v ?? 0).toFixed(6)).join(',')
}

/**
 * Hash-based vertex set for fast deduplication.
 *
 * Uses hash buckets with linear probing for collision resolution.
 * Falls back to exact comparison when hashes collide.
 */
export class VertexHashSet {
  /** Map from hash to array of vertices with that hash */
  private buckets: Map<number, VectorND[]> = new Map()
  /** Total number of unique vertices */
  private count = 0

  /**
   * Check if a vertex exists in the set.
   *
   * @param vertex - Vertex to check
   * @returns True if vertex exists (within tolerance)
   */
  has(vertex: VectorND): boolean {
    const hash = hashVertex(vertex)
    const bucket = this.buckets.get(hash)

    if (!bucket) return false

    // Check exact equality with tolerance
    for (const existing of bucket) {
      if (verticesEqual(vertex, existing)) {
        return true
      }
    }

    return false
  }

  /**
   * Add a vertex to the set if not already present.
   *
   * @param vertex - Vertex to add
   * @returns True if vertex was added (was not present)
   */
  add(vertex: VectorND): boolean {
    const hash = hashVertex(vertex)
    let bucket = this.buckets.get(hash)

    if (!bucket) {
      bucket = []
      this.buckets.set(hash, bucket)
    } else {
      // Check for existing vertex
      for (const existing of bucket) {
        if (verticesEqual(vertex, existing)) {
          return false // Already exists
        }
      }
    }

    bucket.push(vertex)
    this.count++
    return true
  }

  /**
   * Get the number of unique vertices.
   */
  get size(): number {
    return this.count
  }

  /**
   * Clear the set.
   */
  clear(): void {
    this.buckets.clear()
    this.count = 0
  }
}

/**
 * Deduplicate vertices using hash-based approach.
 *
 * This is faster than the string-based approach for large vertex sets:
 * - String approach: O(n * d) for n vertices of dimension d (string creation + comparison)
 * - Hash approach: O(n) average case (hash computation + bucket lookup)
 *
 * @param vertices - Array of vertices (may contain duplicates)
 * @returns Object containing unique vertices and index mapping
 */
export function deduplicateVertices(vertices: VectorND[]): {
  unique: VectorND[]
  indexMap: number[] // Maps original index to deduplicated index
} {
  const unique: VectorND[] = []
  const indexMap: number[] = []
  // Map from hash -> array of {vertex, index} pairs for collision resolution
  const hashBuckets = new Map<number, Array<{ vertex: VectorND; index: number }>>()

  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i]!
    const hash = hashVertex(vertex)

    let bucket = hashBuckets.get(hash)
    if (!bucket) {
      // First vertex with this hash
      bucket = []
      hashBuckets.set(hash, bucket)
    } else {
      // Check for existing equal vertex (collision resolution)
      let foundIndex = -1
      for (const existing of bucket) {
        if (verticesEqual(vertex, existing.vertex)) {
          foundIndex = existing.index
          break
        }
      }
      if (foundIndex !== -1) {
        // Duplicate found - map to existing index
        indexMap.push(foundIndex)
        continue
      }
    }

    // New unique vertex
    const newIndex = unique.length
    unique.push(vertex)
    bucket.push({ vertex, index: newIndex })
    indexMap.push(newIndex)
  }

  return { unique, indexMap }
}
