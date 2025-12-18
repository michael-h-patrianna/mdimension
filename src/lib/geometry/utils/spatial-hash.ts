/**
 * N-dimensional Spatial Hash Grid for Fast Neighbor Queries
 *
 * Reduces O(V^2) pairwise distance comparisons to O(V * k) where k is
 * the average number of vertices per cell neighborhood.
 *
 * Used primarily for edge detection in polytope generation.
 *
 * @see https://en.wikipedia.org/wiki/Spatial_hashing
 */

import type { VectorND } from '@/lib/math'
import { WYTHOFF_CONFIG, SPATIAL_HASH_CONFIG } from '../config'

/**
 * Configuration for spatial hash grid
 */
interface SpatialHashConfig {
  /** Size of each cell in the grid */
  cellSize: number
  /** Number of dimensions (3-11) */
  dimension: number
}

/**
 * N-dimensional spatial hash grid for fast neighbor queries.
 *
 * The grid divides space into cells of uniform size. For each vertex,
 * we can quickly find all potential neighbors by only checking vertices
 * in adjacent cells.
 *
 * For N dimensions, each cell has up to 3^N neighbors (including itself).
 * To keep performance reasonable for high dimensions, we limit neighbor
 * checks to the first 3 dimensions for hashing, which still provides
 * good spatial locality.
 */
export class SpatialHash {
  private cells: Map<string, number[]> = new Map()
  private cellSize: number
  private dimension: number
  /** Max dimensions to use for hashing (higher dims ignored for cell key) */
  private static readonly MAX_HASH_DIMS = SPATIAL_HASH_CONFIG.MAX_HASH_DIMS

  constructor(config: SpatialHashConfig) {
    this.cellSize = config.cellSize
    this.dimension = config.dimension
  }

  /**
   * Get cell key for a vertex position.
   * Uses only first MAX_HASH_DIMS dimensions for the key to keep
   * neighbor count manageable (3^3 = 27 vs 3^11 = 177147).
   */
  private getCellKey(vertex: VectorND): string {
    const effectiveDims = Math.min(this.dimension, SpatialHash.MAX_HASH_DIMS)
    const coords: number[] = []

    for (let i = 0; i < effectiveDims; i++) {
      coords.push(Math.floor((vertex[i] ?? 0) / this.cellSize))
    }

    return coords.join(',')
  }

  /**
   * Insert a vertex index into the grid
   */
  insert(index: number, vertex: VectorND): void {
    const key = this.getCellKey(vertex)
    let cell = this.cells.get(key)

    if (!cell) {
      cell = []
      this.cells.set(key, cell)
    }

    cell.push(index)
  }

  /**
   * Get all vertex indices in neighboring cells (including self).
   * For the first MAX_HASH_DIMS dimensions, we check all cells within +-1.
   */
  getNeighborIndices(vertex: VectorND): number[] {
    const effectiveDims = Math.min(this.dimension, SpatialHash.MAX_HASH_DIMS)
    const centerCoords: number[] = []

    for (let i = 0; i < effectiveDims; i++) {
      centerCoords.push(Math.floor((vertex[i] ?? 0) / this.cellSize))
    }

    const neighbors: number[] = []

    // Generate all 3^effectiveDims neighbor offsets (including center)
    const total = Math.pow(3, effectiveDims)

    for (let i = 0; i < total; i++) {
      const neighborCoords: number[] = []
      let val = i

      for (let d = 0; d < effectiveDims; d++) {
        const offset = (val % 3) - 1 // -1, 0, or 1
        neighborCoords.push(centerCoords[d]! + offset)
        val = Math.floor(val / 3)
      }

      const key = neighborCoords.join(',')
      const cell = this.cells.get(key)

      if (cell) {
        neighbors.push(...cell)
      }
    }

    return neighbors
  }

  /**
   * Get the number of cells in the grid
   */
  get cellCount(): number {
    return this.cells.size
  }

  /**
   * Get average vertices per cell
   */
  get averageVerticesPerCell(): number {
    if (this.cells.size === 0) return 0

    let total = 0
    for (const cell of this.cells.values()) {
      total += cell.length
    }

    return total / this.cells.size
  }

  /**
   * Build spatial hash from vertex array
   */
  static fromVertices(vertices: VectorND[], cellSize: number): SpatialHash {
    if (vertices.length === 0) {
      // Return empty hash for degenerate case
      return new SpatialHash({ cellSize, dimension: 3 })
    }

    const dimension = vertices[0]!.length
    const hash = new SpatialHash({ cellSize, dimension })

    for (let i = 0; i < vertices.length; i++) {
      hash.insert(i, vertices[i]!)
    }

    return hash
  }
}

/**
 * Calculate Euclidean distance between two vertices.
 *
 * Both vertices must have the same dimension. If dimensions differ,
 * the function uses the minimum dimension and logs a warning (debug mode only).
 * This is intentional for robustness in edge cases, but callers should
 * ensure consistent dimensions.
 *
 * @param a - First vertex
 * @param b - Second vertex
 * @returns Euclidean distance
 */
export function euclideanDistance(a: VectorND, b: VectorND): number {
  let sum = 0
  const len = Math.min(a.length, b.length)

  // In debug builds, warn about dimension mismatch
  if (import.meta.env.MODE === 'development' && a.length !== b.length) {
    console.warn(
      `[euclideanDistance] Dimension mismatch: ${a.length}D vs ${b.length}D. Using min(${len}).`
    )
  }

  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    sum += d * d
  }

  return Math.sqrt(sum)
}

/**
 * Estimate minimum distance from a random sample of vertices.
 * Used to determine appropriate cell size for spatial hashing.
 *
 * @param vertices - Array of vertex positions
 * @param sampleSize - Number of random samples to check
 * @returns Estimated minimum pairwise distance
 */
export function estimateMinDistance(
  vertices: VectorND[],
  sampleSize = WYTHOFF_CONFIG.MIN_DISTANCE_SAMPLE_SIZE
): number {
  if (vertices.length < 2) return 1.0

  let minDist = Infinity
  const n = vertices.length

  // For small arrays, check all pairs
  if (n <= sampleSize) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = euclideanDistance(vertices[i]!, vertices[j]!)
        if (dist > 1e-9 && dist < minDist) {
          minDist = dist
        }
      }
    }
    return minDist === Infinity ? 1.0 : minDist
  }

  // For larger arrays, use random sampling
  // Sample pairs that are likely to be close by checking sequential neighbors
  // plus random pairs
  for (let i = 0; i < Math.min(n - 1, sampleSize / 2); i++) {
    const dist = euclideanDistance(vertices[i]!, vertices[i + 1]!)
    if (dist > 1e-9 && dist < minDist) {
      minDist = dist
    }
  }

  // Random pairs for broader coverage
  for (let i = 0; i < sampleSize / 2; i++) {
    const idx1 = Math.floor(Math.random() * n)
    const idx2 = Math.floor(Math.random() * n)
    if (idx1 === idx2) continue

    const dist = euclideanDistance(vertices[idx1]!, vertices[idx2]!)
    if (dist > 1e-9 && dist < minDist) {
      minDist = dist
    }
  }

  return minDist === Infinity ? 1.0 : minDist
}

/**
 * Generate edges using spatial hashing for O(V * k) complexity.
 *
 * This replaces the O(V^2) naive algorithm for large vertex sets.
 *
 * @param vertices - Array of vertex positions
 * @returns Array of edge pairs (vertex indices)
 */
/** Minimum cell size to prevent division by zero or degenerate cells */
const MIN_CELL_SIZE = WYTHOFF_CONFIG.MIN_CELL_SIZE

export function generateEdgesWithSpatialHash(vertices: VectorND[]): [number, number][] {
  if (vertices.length < 2) return []

  // Estimate min distance to set appropriate cell size
  const estMinDist = estimateMinDistance(vertices)

  // Cell size should be slightly larger than min distance to ensure
  // all minimum-distance pairs are in adjacent cells.
  // Use MIN_CELL_SIZE as floor to prevent division by zero.
  const cellSize = Math.max(estMinDist * WYTHOFF_CONFIG.CELL_SIZE_MULTIPLIER, MIN_CELL_SIZE)

  // Build spatial hash
  const spatialHash = SpatialHash.fromVertices(vertices, cellSize)

  // First pass: find exact minimum distance using spatial locality
  let minDist = Infinity

  for (let i = 0; i < vertices.length; i++) {
    const neighbors = spatialHash.getNeighborIndices(vertices[i]!)

    for (const j of neighbors) {
      if (j <= i) continue // Only check each pair once

      const dist = euclideanDistance(vertices[i]!, vertices[j]!)
      if (dist > 1e-9 && dist < minDist) {
        minDist = dist
      }
    }
  }

  if (minDist === Infinity) return []

  // Second pass: collect all edges at minimum distance
  const maxDist = minDist * (1 + WYTHOFF_CONFIG.EDGE_TOLERANCE)
  const edges: [number, number][] = []
  const edgeSet = new Set<string>()

  for (let i = 0; i < vertices.length; i++) {
    const neighbors = spatialHash.getNeighborIndices(vertices[i]!)

    for (const j of neighbors) {
      if (j <= i) continue

      const dist = euclideanDistance(vertices[i]!, vertices[j]!)

      if (dist <= maxDist) {
        const key = `${i}-${j}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push([i, j])
        }
      }
    }
  }

  return edges
}
