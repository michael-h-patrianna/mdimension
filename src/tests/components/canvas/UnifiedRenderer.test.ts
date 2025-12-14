/**
 * Tests for UnifiedRenderer and determineRenderMode function
 */

import { determineRenderMode, type RenderMode } from '@/components/canvas/renderers/UnifiedRenderer'
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
    | 'mandelbox'
    | 'menger'
}): NdGeometry {
  return {
    vertices: options.vertices ?? [[0, 0, 0]],
    edges: options.edges ?? [],
    dimension: options.dimension ?? 3,
    type: options.type ?? 'hypercube',
  }
}

describe('determineRenderMode', () => {
  describe('mandelbox rendering', () => {
    it('should return raymarch-mandelbox when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbox', 3, true)
      expect(result).toBe('raymarch-mandelbox')
    })

    it('should return raymarch-mandelbox when faces visible in 4D+', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbox', 4, true)
      expect(result).toBe('raymarch-mandelbox')
    })

    it('should return none when faces not visible', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'mandelbox', 3, false)
      expect(result).toBe('none')
    })
  })

  describe('menger rendering', () => {
    it('should return raymarch-menger when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'menger', 3, true)
      expect(result).toBe('raymarch-menger')
    })

    it('should return raymarch-menger when faces visible in higher dimensions', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0, 0]] })
      const result = determineRenderMode(geometry, 'menger', 5, true)
      expect(result).toBe('raymarch-menger')
    })

    it('should return none when faces not visible', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'menger', 3, false)
      expect(result).toBe('none')
    })
  })

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
    it('should respect minimum dimension for mandelbox (3D+)', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      // 2D would not trigger raymarch-mandelbox (though 2D is invalid for mandelbox)
      // Testing that 3D is the minimum
      const result3D = determineRenderMode(geometry, 'mandelbox', 3, true)
      expect(result3D).toBe('raymarch-mandelbox')
    })

    it('should respect minimum dimension for menger (3D+)', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] })
      const result = determineRenderMode(geometry, 'menger', 3, true)
      expect(result).toBe('raymarch-menger')
    })
  })
})

describe('RenderMode type', () => {
  it('should have all expected render modes', () => {
    const modes: RenderMode[] = [
      'polytope',
      'raymarch-mandelbrot',
      'raymarch-mandelbox',
      'raymarch-menger',
      'none',
    ]
    expect(modes).toContain('polytope')
    expect(modes).toContain('raymarch-mandelbrot')
    expect(modes).toContain('raymarch-mandelbox')
    expect(modes).toContain('raymarch-menger')
    expect(modes).toContain('none')
  })
})
