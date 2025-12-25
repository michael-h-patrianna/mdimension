/**
 * Tests for root system generation
 */

import { generateE8Roots, verifyE8Roots } from '@/lib/geometry/extended/e8-roots'
import {
  generateARoots,
  generateDRoots,
  generateRootSystem,
  generateRootSystemFaces,
  getRootCount,
  validateRootSystemType,
} from '@/lib/geometry/extended/root-system'
import { DEFAULT_ROOT_SYSTEM_CONFIG } from '@/lib/geometry/extended/types'
import { buildShortEdges } from '@/lib/geometry/extended/utils/short-edges'
import { describe, expect, it } from 'vitest'

describe('generateARoots', () => {
  describe('root count formula', () => {
    it('should generate n(n-1) roots for A_{n-1}', () => {
      for (let n = 3; n <= 6; n++) {
        const roots = generateARoots(n, 1.0)
        expect(roots).toHaveLength(n * (n - 1))
      }
    })
  })

  describe('root properties', () => {
    it('should have all roots with correct dimensionality', () => {
      const roots = generateARoots(5, 1.0)
      roots.forEach((r) => {
        expect(r).toHaveLength(5)
      })
    })

    it('should have normalized root length', () => {
      const roots = generateARoots(4, 1.0)
      roots.forEach((r) => {
        const norm = Math.sqrt(r.reduce((sum, x) => sum + x * x, 0))
        expect(norm).toBeCloseTo(1.0, 5)
      })
    })

    it('should respect scale factor', () => {
      const scale = 2.0
      const roots = generateARoots(4, scale)
      roots.forEach((r) => {
        const norm = Math.sqrt(r.reduce((sum, x) => sum + x * x, 0))
        expect(norm).toBeCloseTo(scale, 5)
      })
    })
  })

  describe('specific cases', () => {
    it('should generate 12 roots for A_3 (n=4)', () => {
      const roots = generateARoots(4, 1.0)
      expect(roots).toHaveLength(12)
    })

    it('should generate 6 roots for A_2 (n=3)', () => {
      const roots = generateARoots(3, 1.0)
      expect(roots).toHaveLength(6)
    })
  })
})

describe('generateDRoots', () => {
  describe('dimension validation', () => {
    it('should throw error for dimension < 4', () => {
      expect(() => generateDRoots(3, 1.0)).toThrow('D_n root system requires dimension >= 4')
    })

    it('should accept dimension >= 4', () => {
      expect(() => generateDRoots(4, 1.0)).not.toThrow()
      expect(() => generateDRoots(6, 1.0)).not.toThrow()
    })
  })

  describe('root count formula', () => {
    it('should generate 2n(n-1) roots for D_n', () => {
      for (let n = 4; n <= 6; n++) {
        const roots = generateDRoots(n, 1.0)
        expect(roots).toHaveLength(2 * n * (n - 1))
      }
    })
  })

  describe('root properties', () => {
    it('should have all roots with correct dimensionality', () => {
      const roots = generateDRoots(5, 1.0)
      roots.forEach((r) => {
        expect(r).toHaveLength(5)
      })
    })

    it('should have normalized root length', () => {
      const roots = generateDRoots(4, 1.0)
      roots.forEach((r) => {
        const norm = Math.sqrt(r.reduce((sum, x) => sum + x * x, 0))
        expect(norm).toBeCloseTo(1.0, 5)
      })
    })
  })

  describe('specific cases', () => {
    it('should generate 24 roots for D_4', () => {
      const roots = generateDRoots(4, 1.0)
      expect(roots).toHaveLength(24)
    })

    it('should generate 40 roots for D_5', () => {
      const roots = generateDRoots(5, 1.0)
      expect(roots).toHaveLength(40)
    })
  })
})

describe('generateE8Roots', () => {
  describe('root count', () => {
    it('should generate exactly 240 roots', () => {
      const roots = generateE8Roots(1.0)
      expect(roots).toHaveLength(240)
    })
  })

  describe('root properties', () => {
    it('should have all roots in 8D', () => {
      const roots = generateE8Roots(1.0)
      roots.forEach((r) => {
        expect(r).toHaveLength(8)
      })
    })

    it('should have all roots with same length', () => {
      const roots = generateE8Roots(1.0)
      const firstNorm = Math.sqrt(roots[0]!.reduce((sum, x) => sum + x * x, 0))

      roots.forEach((r) => {
        const norm = Math.sqrt(r.reduce((sum, x) => sum + x * x, 0))
        expect(norm).toBeCloseTo(firstNorm, 5)
      })
    })

    it('should respect scale factor', () => {
      const scale = 2.0
      const roots = generateE8Roots(scale)
      const expectedNorm = scale

      roots.forEach((r) => {
        const norm = Math.sqrt(r.reduce((sum, x) => sum + x * x, 0))
        expect(norm).toBeCloseTo(expectedNorm, 5)
      })
    })
  })

  describe('verification', () => {
    it('should pass verification', () => {
      const roots = generateE8Roots(1.0)
      const result = verifyE8Roots(roots)
      expect(result.valid).toBe(true)
      expect(result.rootCount).toBe(240)
    })
  })
})

describe('generateRootSystem', () => {
  describe('type A', () => {
    it('should generate A root system', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'A',
        scale: 1.0,
      })

      expect(geometry.type).toBe('root-system')
      expect(geometry.dimension).toBe(4)
      expect(geometry.vertices).toHaveLength(12) // A_3: 4*3 = 12
    })
  })

  describe('type D', () => {
    it('should generate D root system', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'D',
        scale: 1.0,
      })

      expect(geometry.type).toBe('root-system')
      expect(geometry.vertices).toHaveLength(24) // D_4: 2*4*3 = 24
    })

    it('should throw for dimension < 4', () => {
      expect(() =>
        generateRootSystem(3, {
          rootType: 'D',
          scale: 1.0,
        })
      ).toThrow()
    })
  })

  describe('type E8', () => {
    it('should generate E8 root system in dimension 8', () => {
      const geometry = generateRootSystem(8, {
        rootType: 'E8',
        scale: 1.0,
      })

      expect(geometry.type).toBe('root-system')
      expect(geometry.dimension).toBe(8)
      expect(geometry.vertices).toHaveLength(240)
    })

    it('should throw for dimension != 8', () => {
      expect(() =>
        generateRootSystem(4, {
          rootType: 'E8',
          scale: 1.0,
        })
      ).toThrow('E8 root system requires dimension = 8')
    })
  })

  describe('edges', () => {
    it('should always generate edges (like polytopes)', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'A',
        scale: 1.0,
      })

      expect(geometry.edges.length).toBeGreaterThan(0)
    })
  })

  describe('analyticalFaces', () => {
    it('should include analyticalFaces in metadata for A type', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'A',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      expect(faces).toBeDefined()
      expect(Array.isArray(faces)).toBe(true)
      expect(faces!.length).toBeGreaterThan(0)
    })

    it('should include analyticalFaces in metadata for D type', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'D',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      expect(faces).toBeDefined()
      expect(Array.isArray(faces)).toBe(true)
      expect(faces!.length).toBeGreaterThan(0)
    })

    it('should include analyticalFaces in metadata for E8 type', () => {
      const geometry = generateRootSystem(8, {
        rootType: 'E8',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      expect(faces).toBeDefined()
      expect(Array.isArray(faces)).toBe(true)
      expect(faces!.length).toBeGreaterThan(0)
    })

    it('should have all triangular faces', () => {
      const geometry = generateRootSystem(5, {
        rootType: 'A',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      expect(faces).toBeDefined()

      for (const face of faces!) {
        expect(face).toHaveLength(3)
      }
    })

    it('should have valid vertex indices in faces', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'D',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      const vertexCount = geometry.vertices.length

      expect(faces).toBeDefined()

      for (const face of faces!) {
        for (const idx of face) {
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(vertexCount)
        }
      }
    })

    it('should include faceCount in metadata properties', () => {
      const geometry = generateRootSystem(4, {
        rootType: 'A',
        scale: 1.0,
      })

      const faceCount = geometry.metadata?.properties?.faceCount as number | undefined
      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined

      expect(faceCount).toBeDefined()
      expect(faceCount).toBe(faces!.length)
    })

    it('should cover all vertices with faces for A type', () => {
      const geometry = generateRootSystem(5, {
        rootType: 'A',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      const vertexCount = geometry.vertices.length

      // Collect all vertices that appear in at least one face
      const coveredVertices = new Set<number>()
      for (const face of faces!) {
        for (const idx of face) {
          coveredVertices.add(idx)
        }
      }

      // All vertices should be covered by faces
      expect(coveredVertices.size).toBe(vertexCount)
    })

    it('should cover all vertices with faces for D type', () => {
      const geometry = generateRootSystem(5, {
        rootType: 'D',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      const vertexCount = geometry.vertices.length

      const coveredVertices = new Set<number>()
      for (const face of faces!) {
        for (const idx of face) {
          coveredVertices.add(idx)
        }
      }

      expect(coveredVertices.size).toBe(vertexCount)
    })

    it('should cover all vertices with faces for high-dimensional A type', () => {
      // Test A_7 (8D) - the case mentioned in the bug report
      const geometry = generateRootSystem(8, {
        rootType: 'A',
        scale: 1.0,
      })

      const faces = geometry.metadata?.properties?.analyticalFaces as number[][] | undefined
      const vertexCount = geometry.vertices.length

      const coveredVertices = new Set<number>()
      for (const face of faces!) {
        for (const idx of face) {
          coveredVertices.add(idx)
        }
      }

      // All 56 vertices of A_7 should be covered
      expect(vertexCount).toBe(56) // 8 * 7 = 56
      expect(coveredVertices.size).toBe(vertexCount)
    })
  })

  describe('dimension validation', () => {
    it('should throw for dimension < 3', () => {
      expect(() => generateRootSystem(2, DEFAULT_ROOT_SYSTEM_CONFIG)).toThrow()
    })
  })
})

describe('getRootCount', () => {
  it('should return correct count for type A', () => {
    expect(getRootCount('A', 4)).toBe(12)
    expect(getRootCount('A', 5)).toBe(20)
    expect(getRootCount('A', 6)).toBe(30)
  })

  it('should return correct count for type D', () => {
    expect(getRootCount('D', 4)).toBe(24)
    expect(getRootCount('D', 5)).toBe(40)
    expect(getRootCount('D', 6)).toBe(60)
  })

  it('should return 240 for E8', () => {
    expect(getRootCount('E8', 8)).toBe(240)
  })
})

describe('validateRootSystemType', () => {
  it('should validate A type for any dimension >= 3', () => {
    expect(validateRootSystemType('A', 3).valid).toBe(true)
    expect(validateRootSystemType('A', 4).valid).toBe(true)
  })

  it('should invalidate D type for dimension < 4', () => {
    expect(validateRootSystemType('D', 3).valid).toBe(false)
    expect(validateRootSystemType('D', 4).valid).toBe(true)
  })

  it('should invalidate E8 for dimension != 8', () => {
    expect(validateRootSystemType('E8', 4).valid).toBe(false)
    expect(validateRootSystemType('E8', 7).valid).toBe(false)
    expect(validateRootSystemType('E8', 8).valid).toBe(true)
    expect(validateRootSystemType('E8', 9).valid).toBe(false)
  })
})

describe('generateRootSystemFaces', () => {
  it('should generate triangular faces from edges', () => {
    const vertices = generateARoots(4, 1.0)
    const edges = buildShortEdges(vertices)
    const faces = generateRootSystemFaces(edges, vertices)

    expect(faces.length).toBeGreaterThan(0)

    for (const face of faces) {
      expect(face).toHaveLength(3)
    }
  })

  it('should return unique faces (no duplicates)', () => {
    const vertices = generateDRoots(4, 1.0)
    const edges = buildShortEdges(vertices)
    const faces = generateRootSystemFaces(edges, vertices)

    // Create canonical keys for each face (sorted indices)
    const faceKeys = new Set<string>()
    for (const face of faces) {
      const sortedFace = [...face].sort((a, b) => a - b)
      const key = sortedFace.join(',')
      expect(faceKeys.has(key)).toBe(false)
      faceKeys.add(key)
    }
  })

  it('should find all triangles in the edge graph', () => {
    // For a simple 3D simplex (tetrahedron), we know exactly how many triangles
    // Build a tetrahedron-like structure manually
    const vertices = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, -1, -1],
    ]
    // All pairs connected (complete graph K4)
    const edges: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]

    const faces = generateRootSystemFaces(edges, vertices)

    // K4 has C(4,3) = 4 triangles
    expect(faces).toHaveLength(4)
  })

  it('should return empty array for empty edges', () => {
    const vertices = [[0, 0, 0]]
    const edges: [number, number][] = []
    const faces = generateRootSystemFaces(edges, vertices)

    expect(faces).toHaveLength(0)
  })

  it('should return empty array when no triangles exist', () => {
    // A simple path: 0 - 1 - 2 (no triangles)
    const vertices = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
    ]

    const faces = generateRootSystemFaces(edges, vertices)

    expect(faces).toHaveLength(0)
  })

  it('should have valid vertex indices in returned faces', () => {
    const vertices = generateARoots(5, 1.0)
    const edges = buildShortEdges(vertices)
    const faces = generateRootSystemFaces(edges, vertices)

    for (const face of faces) {
      for (const idx of face) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(vertices.length)
      }
    }
  })

  it('should generate faces where all edges exist in input edge set', () => {
    const vertices = generateDRoots(4, 1.0)
    const edges = buildShortEdges(vertices)
    const faces = generateRootSystemFaces(edges, vertices)

    // Build edge set for lookup
    const edgeSet = new Set<string>()
    for (const [a, b] of edges) {
      const key = a < b ? `${a},${b}` : `${b},${a}`
      edgeSet.add(key)
    }

    // Every face should have all 3 edges present in the edge set
    for (const face of faces) {
      const [v0, v1, v2] = face
      const edge1 = v0! < v1! ? `${v0},${v1}` : `${v1},${v0}`
      const edge2 = v1! < v2! ? `${v1},${v2}` : `${v2},${v1}`
      const edge3 = v0! < v2! ? `${v0},${v2}` : `${v2},${v0}`

      expect(edgeSet.has(edge1)).toBe(true)
      expect(edgeSet.has(edge2)).toBe(true)
      expect(edgeSet.has(edge3)).toBe(true)
    }
  })
})
