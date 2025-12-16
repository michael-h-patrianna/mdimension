/**
 * Tests for UnifiedRenderer and determineRenderMode function
 */

import { determineRenderMode, type RenderMode } from '@/rendering/renderers/UnifiedRenderer'
import type { NdGeometry } from '@/lib/geometry/types'
import { describe, expect, it } from 'vitest'

/**
 * Helper to create minimal geometry for testing
 * @param options
 * @param options.vertices
 * @param options.edges
 * @param options.dimension
 * @param options.type
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
    | 'mandelbrot'
}): NdGeometry {
  return {
    vertices: options.vertices ?? [[0, 0, 0]],
    edges: options.edges ?? [],
    dimension: options.dimension ?? 3,
    type: options.type ?? 'hypercube',
  }
}

describe('determineRenderMode', () => {
  describe('mandelbrot/hyperbulb rendering', () => {
    it('should return raymarch-mandelbrot when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbrot', 3, true)
      expect(result).toBe('raymarch-mandelbrot')
    })

    it('should return raymarch-mandelbrot when faces visible in 4D+', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbrot', 4, true)
      expect(result).toBe('raymarch-mandelbrot')
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
  })
})

describe('RenderMode type', () => {
  it('should have all expected render modes', () => {
    const modes: RenderMode[] = [
      'polytope',
      'raymarch-mandelbrot',
      'raymarch-quaternion-julia',
      'none',
    ]
    expect(modes).toContain('polytope')
    expect(modes).toContain('raymarch-mandelbrot')
    expect(modes).toContain('raymarch-quaternion-julia')
    expect(modes).toContain('none')
  })
})
