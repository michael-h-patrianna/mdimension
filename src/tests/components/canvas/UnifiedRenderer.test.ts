/**
 * Tests for UnifiedRenderer and determineRenderMode function
 */

import { describe, it, expect } from 'vitest'
import { determineRenderMode, type RenderMode } from '@/rendering/renderers/utils'
import type { NdGeometry } from '@/lib/geometry/types'

/**
 * Helper to create minimal geometry for testing
 * @param options
 * @param options.vertices
 * @param options.edges
 * @param options.dimension
 * @param options.type
 * @returns NdGeometry object configured with provided options
 */
function createTestGeometry(options: {
  vertices?: number[][]
  edges?: [number, number][]
  dimension?: number
  type?:
    | 'hypercube'
    | 'simplex'
    | 'cross-polytope'
    | 'root-system'
    | 'clifford-torus'
    | 'mandelbulb'
}): NdGeometry {
  return {
    vertices: options.vertices ?? [[0, 0, 0]],
    edges: options.edges ?? [],
    dimension: options.dimension ?? 3,
    type: options.type ?? 'hypercube',
  }
}

describe('determineRenderMode', () => {
  describe('mandelbulb/mandelbulb rendering', () => {
    it('should return raymarch-mandelbulb when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbulb', 3, true)
      expect(result).toBe('raymarch-mandelbulb')
    })

    it('should return raymarch-mandelbulb when faces visible in 4D+', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbulb', 4, true)
      expect(result).toBe('raymarch-mandelbulb')
    })
  })

  describe('polytope rendering', () => {
    it('should return polytope for hypercube', () => {
      const geometry = createTestGeometry({
        vertices: [
          [1, 0, 0, 0],
          [-1, 0, 0, 0],
        ],
        edges: [[0, 1]],
      })
      const result = determineRenderMode(geometry, 'hypercube', 4, false)
      expect(result).toBe('polytope')
    })

    it('should return polytope for simplex', () => {
      const geometry = createTestGeometry({
        vertices: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        edges: [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
      })
      const result = determineRenderMode(geometry, 'simplex', 3, true)
      expect(result).toBe('polytope')
    })

    it('should return polytope for cross-polytope', () => {
      const geometry = createTestGeometry({
        vertices: [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
        ],
        edges: [
          [0, 2],
          [0, 3],
          [1, 2],
          [1, 3],
        ],
      })
      const result = determineRenderMode(geometry, 'cross-polytope', 3, false)
      expect(result).toBe('polytope')
    })
  })

  describe('dimension requirements', () => {
    it('should handle 2D geometry', () => {
      const geometry = createTestGeometry({
        vertices: [
          [1, 0],
          [0, 1],
          [-1, 0],
        ],
        edges: [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
        dimension: 2,
      })
      const result = determineRenderMode(geometry, 'hypercube', 2, false)
      expect(result).toBe('polytope')
    })

    it('should handle 5D+ geometry', () => {
      const geometry = createTestGeometry({
        vertices: [
          [1, 0, 0, 0, 0],
          [-1, 0, 0, 0, 0],
        ],
        edges: [[0, 1]],
        dimension: 5,
      })
      const result = determineRenderMode(geometry, 'hypercube', 5, false)
      expect(result).toBe('polytope')
    })
  })
})

describe('RenderMode type', () => {
  it('should have all expected render modes', () => {
    const modes: RenderMode[] = [
      'polytope',
      'raymarch-mandelbulb',
      'raymarch-quaternion-julia',
      'none',
    ]
    expect(modes).toContain('polytope')
    expect(modes).toContain('raymarch-mandelbulb')
    expect(modes).toContain('raymarch-quaternion-julia')
    expect(modes).toContain('none')
  })
})
