/**
 * Tests for N-dimensional Spatial Hash Grid
 *
 * @see src/lib/geometry/utils/spatial-hash.ts
 */

import { describe, it, expect } from 'vitest'
import {
  SpatialHash,
  euclideanDistance,
  estimateMinDistance,
  generateEdgesWithSpatialHash,
} from '@/lib/geometry/utils/spatial-hash'
import type { VectorND } from '@/lib/math'

describe('SpatialHash', () => {
  describe('constructor and basic operations', () => {
    it('should create empty hash with correct config', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      expect(hash.cellCount).toBe(0)
      expect(hash.averageVerticesPerCell).toBe(0)
    })

    it('should insert vertices and track cell count', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      hash.insert(0, [0, 0, 0])
      hash.insert(1, [0.5, 0.5, 0.5]) // Same cell
      hash.insert(2, [2, 2, 2]) // Different cell

      expect(hash.cellCount).toBe(2)
      expect(hash.averageVerticesPerCell).toBe(1.5) // 3 vertices / 2 cells
    })
  })

  describe('getNeighborIndices', () => {
    it('should find vertices in same cell', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      hash.insert(0, [0, 0, 0])
      hash.insert(1, [0.1, 0.1, 0.1])

      const neighbors = hash.getNeighborIndices([0, 0, 0])
      expect(neighbors).toContain(0)
      expect(neighbors).toContain(1)
    })

    it('should find vertices in adjacent cells', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      hash.insert(0, [0.9, 0.9, 0.9]) // Cell (0,0,0)
      hash.insert(1, [1.1, 1.1, 1.1]) // Cell (1,1,1) - adjacent

      const neighbors = hash.getNeighborIndices([0.9, 0.9, 0.9])
      expect(neighbors).toContain(0)
      expect(neighbors).toContain(1)
    })

    it('should not find vertices in non-adjacent cells', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      hash.insert(0, [0, 0, 0]) // Cell (0,0,0)
      hash.insert(1, [5, 5, 5]) // Cell (5,5,5) - far away

      const neighbors = hash.getNeighborIndices([0, 0, 0])
      expect(neighbors).toContain(0)
      expect(neighbors).not.toContain(1)
    })

    it('should handle negative coordinates', () => {
      const hash = new SpatialHash({ cellSize: 1.0, dimension: 3 })
      hash.insert(0, [-0.5, -0.5, -0.5])
      hash.insert(1, [0.5, 0.5, 0.5])

      // These should be in adjacent cells
      const neighbors = hash.getNeighborIndices([-0.5, -0.5, -0.5])
      expect(neighbors).toContain(0)
      expect(neighbors).toContain(1)
    })
  })

  describe('fromVertices', () => {
    it('should build hash from vertex array', () => {
      const vertices: VectorND[] = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]

      const hash = SpatialHash.fromVertices(vertices, 0.5)
      expect(hash.cellCount).toBeGreaterThan(0)
    })

    it('should handle empty vertex array', () => {
      const hash = SpatialHash.fromVertices([], 1.0)
      expect(hash.cellCount).toBe(0)
    })

    it('should handle higher dimensions', () => {
      const vertices: VectorND[] = [
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
      ]

      const hash = SpatialHash.fromVertices(vertices, 1.0)
      // Only first 3 dimensions used for hashing
      expect(hash.cellCount).toBe(2)
    })
  })
})

describe('euclideanDistance', () => {
  it('should calculate distance in 3D', () => {
    const a: VectorND = [0, 0, 0]
    const b: VectorND = [3, 4, 0]
    expect(euclideanDistance(a, b)).toBe(5)
  })

  it('should calculate distance in higher dimensions', () => {
    const a: VectorND = [0, 0, 0, 0]
    const b: VectorND = [1, 1, 1, 1]
    expect(euclideanDistance(a, b)).toBe(2) // sqrt(4) = 2
  })

  it('should return 0 for identical vertices', () => {
    const a: VectorND = [1, 2, 3]
    const b: VectorND = [1, 2, 3]
    expect(euclideanDistance(a, b)).toBe(0)
  })

  it('should handle dimension mismatch using min dimension', () => {
    // Uses min(length a, length b) - see implementation
    const a: VectorND = [1, 2]
    const b: VectorND = [1, 2, 3]
    // Only first 2 coords compared: distance = 0
    expect(euclideanDistance(a, b)).toBe(0)
  })
})

describe('estimateMinDistance', () => {
  it('should find minimum distance in small arrays', () => {
    const vertices: VectorND[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]
    // Min distance is 1 (between consecutive vertices)
    expect(estimateMinDistance(vertices)).toBe(1)
  })

  it('should return 1.0 for single vertex', () => {
    expect(estimateMinDistance([[0, 0, 0]])).toBe(1.0)
  })

  it('should return 1.0 for empty array', () => {
    expect(estimateMinDistance([])).toBe(1.0)
  })

  it('should find non-trivial minimum', () => {
    const vertices: VectorND[] = [
      [0, 0, 0],
      [0.5, 0, 0],
      [10, 0, 0],
    ]
    expect(estimateMinDistance(vertices)).toBe(0.5)
  })

  it('should handle larger arrays with sampling', () => {
    // Create 500 vertices with known min distance
    const vertices: VectorND[] = []
    for (let i = 0; i < 500; i++) {
      vertices.push([i * 0.1, 0, 0])
    }
    // Min distance should be ~0.1
    const minDist = estimateMinDistance(vertices)
    expect(minDist).toBeCloseTo(0.1, 5)
  })
})

describe('generateEdgesWithSpatialHash', () => {
  it('should generate edges for simple polytope', () => {
    // Triangle vertices
    const vertices: VectorND[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0.5, Math.sqrt(3) / 2, 0],
    ]

    const edges = generateEdgesWithSpatialHash(vertices)
    // Should have 3 edges connecting all vertices (equilateral triangle)
    expect(edges.length).toBe(3)
  })

  it('should return empty for single vertex', () => {
    const edges = generateEdgesWithSpatialHash([[0, 0, 0]])
    expect(edges.length).toBe(0)
  })

  it('should return empty for empty array', () => {
    const edges = generateEdgesWithSpatialHash([])
    expect(edges.length).toBe(0)
  })

  it('should generate edges matching O(V^2) baseline', () => {
    // Tetrahedron vertices (all equal distances)
    const vertices: VectorND[] = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ]

    const edges = generateEdgesWithSpatialHash(vertices)
    // Tetrahedron has 6 edges
    expect(edges.length).toBe(6)
  })

  it('should handle hypercube vertices', () => {
    // 3D hypercube (cube) vertices
    const vertices: VectorND[] = []
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          vertices.push([x, y, z])
        }
      }
    }

    const edges = generateEdgesWithSpatialHash(vertices)
    // Cube has 12 edges
    expect(edges.length).toBe(12)
  })

  it('should not create duplicate edges', () => {
    const vertices: VectorND[] = [
      [0, 0, 0],
      [1, 0, 0],
    ]

    const edges = generateEdgesWithSpatialHash(vertices)
    // Should have exactly 1 edge, not duplicates
    expect(edges.length).toBe(1)

    // Edge should have [smaller index, larger index] ordering
    expect(edges[0]![0]).toBeLessThan(edges[0]![1])
  })

  it('should handle vertices at near-zero distance', () => {
    // Two vertices extremely close but not identical
    const vertices: VectorND[] = [
      [0, 0, 0],
      [1e-10, 0, 0],
      [1, 0, 0],
    ]

    const edges = generateEdgesWithSpatialHash(vertices)
    // Should create edge between 0-2 and 1-2, possibly 0-1 depending on MIN_CELL_SIZE
    expect(edges.length).toBeGreaterThan(0)
  })
})
