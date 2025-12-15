/**
 * Tests for Clifford Torus and Nested Torus Generators
 *
 * Tests the two torus object types:
 * - Clifford Torus: Flat visualization (2D-11D)
 * - Nested Torus: Hopf fibration tori (4D-11D)
 *
 * @see docs/prd/clifford-torus-modes.md
 */

import {
  buildHopfTorus4DEdges,
  buildHopfTorus8DEdges,
  buildTorus6DEdges,
  generateCliffordTorus,
  generateHopfTorus4DPoints,
  generateHopfTorus8DPoints,
  generateNestedHopfTorus4D,
  generateNestedHopfTorus8D,
  generateNestedTorus6D,
  generateTorus6DPoints,
} from '@/lib/geometry/extended/clifford-torus'
import { generateNestedTorus } from '@/lib/geometry/extended/nested-torus'
import {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_NESTED_TORUS_CONFIG,
} from '@/lib/geometry/extended/types'
import { describe, expect, it } from 'vitest'

// ============================================================================
// Clifford Torus Tests (Flat Mode Only)
// ============================================================================

describe('generateCliffordTorus (flat mode)', () => {
  describe('4D classic mode', () => {
    it('should generate flat torus with default config', () => {
      const geometry = generateCliffordTorus(4, DEFAULT_CLIFFORD_TORUS_CONFIG)

      expect(geometry.dimension).toBe(4)
      expect(geometry.type).toBe('clifford-torus')
      expect(geometry.vertices.length).toBeGreaterThan(0)
    })

    it('should generate correct number of vertices for 4D', () => {
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        resolutionU: 16,
        resolutionV: 12,
      }
      const geometry = generateCliffordTorus(4, config)

      expect(geometry.vertices).toHaveLength(16 * 12)
    })

    it('should generate 4D points on a torus', () => {
      const geometry = generateCliffordTorus(4, DEFAULT_CLIFFORD_TORUS_CONFIG)

      geometry.vertices.forEach((v) => {
        expect(v).toHaveLength(4)
      })
    })
  })

  describe('generalized mode (non-4D)', () => {
    it('should generate flat torus for dimensions 2-11', () => {
      for (let d = 2; d <= 11; d++) {
        const geometry = generateCliffordTorus(d, DEFAULT_CLIFFORD_TORUS_CONFIG)

        expect(geometry.dimension).toBe(d)
        expect(geometry.type).toBe('clifford-torus')
        expect(geometry.vertices.length).toBeGreaterThan(0)
      }
    })

    it('should respect stepsPerCircle parameter', () => {
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        stepsPerCircle: 8,
      }
      const geometry = generateCliffordTorus(6, config)

      // For 6D with stepsPerCircle=8 and k=min(k, maxK=3): points depend on k
      // The actual point count is stepsPerCircle^k where k is clamped
      expect(geometry.vertices.length).toBeGreaterThan(0)
      // Verify all points are 6D
      geometry.vertices.forEach((v) => {
        expect(v).toHaveLength(6)
      })
    })
  })

  describe('edge generation', () => {
    it('should generate edges when edgeMode is grid', () => {
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        edgeMode: 'grid' as const,
      }
      const geometry = generateCliffordTorus(4, config)

      expect(geometry.edges.length).toBeGreaterThan(0)
    })

    it('should not generate edges when edgeMode is none', () => {
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        edgeMode: 'none' as const,
      }
      const geometry = generateCliffordTorus(4, config)

      expect(geometry.edges).toHaveLength(0)
    })
  })

  describe('radius parameter', () => {
    it('should respect radius parameter', () => {
      const radius = 2.5
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius,
      }
      const geometry = generateCliffordTorus(4, config)

      // Check that points are at approximately the expected radius
      const avgRadius =
        geometry.vertices.reduce((sum, v) => {
          const r = Math.sqrt(v.reduce((s, c) => s + c * c, 0))
          return sum + r
        }, 0) / geometry.vertices.length

      expect(avgRadius).toBeCloseTo(radius, 1)
    })
  })
})

// ============================================================================
// Nested Torus Tests (New Object Type)
// ============================================================================

describe('generateNestedTorus', () => {
  describe('dimension validation', () => {
    it('should throw for dimensions below 4', () => {
      expect(() => generateNestedTorus(3, DEFAULT_NESTED_TORUS_CONFIG)).toThrow()
    })

    it('should throw for dimensions above 11', () => {
      expect(() => generateNestedTorus(12, DEFAULT_NESTED_TORUS_CONFIG)).toThrow()
    })

    it('should work for dimensions 4-11', () => {
      for (let d = 4; d <= 11; d++) {
        const geometry = generateNestedTorus(d, DEFAULT_NESTED_TORUS_CONFIG)
        expect(geometry.dimension).toBe(d)
        expect(geometry.type).toBe('nested-torus')
      }
    })
  })

  describe('4D Hopf fibration', () => {
    it('should generate nested torus with correct metadata', () => {
      const geometry = generateNestedTorus(4, DEFAULT_NESTED_TORUS_CONFIG)

      expect(geometry.dimension).toBe(4)
      expect(geometry.type).toBe('nested-torus')
      expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
      expect(geometry.metadata?.properties?.fibration).toBe('S³ → S²')
    })

    it('should generate correct number of vertices', () => {
      const config = {
        ...DEFAULT_NESTED_TORUS_CONFIG,
        resolutionXi1: 24,
        resolutionXi2: 24,
      }
      const geometry = generateNestedTorus(4, config)

      expect(geometry.vertices).toHaveLength(24 * 24)
    })
  })

  describe('6D 3-torus', () => {
    it('should generate 6D nested torus with correct metadata', () => {
      const geometry = generateNestedTorus(6, DEFAULT_NESTED_TORUS_CONFIG)

      expect(geometry.dimension).toBe(6)
      expect(geometry.type).toBe('nested-torus')
      expect(geometry.metadata?.properties?.fibration).toBe('T³ (3-torus)')
    })
  })

  describe('8D quaternionic Hopf', () => {
    it('should generate 8D nested torus with correct metadata', () => {
      const geometry = generateNestedTorus(8, DEFAULT_NESTED_TORUS_CONFIG)

      expect(geometry.dimension).toBe(8)
      expect(geometry.type).toBe('nested-torus')
      expect(geometry.metadata?.properties?.fibration).toBe('S⁷ → S⁴')
    })
  })

  describe('edge generation', () => {
    it('should generate edges in grid mode', () => {
      const config = {
        ...DEFAULT_NESTED_TORUS_CONFIG,
        edgeMode: 'grid' as const,
      }
      const geometry = generateNestedTorus(4, config)

      expect(geometry.edges.length).toBeGreaterThan(0)
    })

    it('should not generate edges in none mode', () => {
      const config = {
        ...DEFAULT_NESTED_TORUS_CONFIG,
        edgeMode: 'none' as const,
      }
      const geometry = generateNestedTorus(4, config)

      expect(geometry.edges).toHaveLength(0)
    })
  })

  describe('nested tori display (4D only)', () => {
    it('should generate multiple tori when showNestedTori is enabled', () => {
      const config = {
        ...DEFAULT_NESTED_TORUS_CONFIG,
        resolutionXi1: 16,
        resolutionXi2: 16,
        showNestedTori: true,
        numberOfTori: 3,
      }
      const geometry = generateNestedTorus(4, config)

      expect(geometry.vertices).toHaveLength(16 * 16 * 3)
      expect(geometry.metadata?.properties?.torusCount).toBe(3)
    })
  })
})

// ============================================================================
// Nested (Hopf) 4D Point Generator Tests
// ============================================================================

describe('generateHopfTorus4DPoints', () => {
  it('should generate resolutionXi1 × resolutionXi2 points', () => {
    const points = generateHopfTorus4DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: 16,
      resolutionXi2: 12,
    })

    expect(points).toHaveLength(16 * 12)
  })

  it('should generate 4D points', () => {
    const points = generateHopfTorus4DPoints(DEFAULT_NESTED_TORUS_CONFIG)

    points.forEach((p) => {
      expect(p).toHaveLength(4)
    })
  })

  it('should have all points on S³ with correct radius', () => {
    const radius = 2.0
    const points = generateHopfTorus4DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      radius,
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    points.forEach((p) => {
      const sumSq = p[0]! ** 2 + p[1]! ** 2 + p[2]! ** 2 + p[3]! ** 2
      expect(sumSq).toBeCloseTo(radius * radius, 5)
    })
  })

  it('should respect eta parameter', () => {
    const radius = 1.0
    const eta = Math.PI / 4

    const points = generateHopfTorus4DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      radius,
      eta,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    // At η = π/4, both circle radii should be equal: R·sin(η) = R·cos(η)
    const expectedRadiusSq = (radius * Math.sin(eta)) ** 2

    points.forEach((p) => {
      const r1Sq = p[0]! ** 2 + p[1]! ** 2
      const r2Sq = p[2]! ** 2 + p[3]! ** 2

      // Both should be approximately equal at η = π/4
      expect(r1Sq).toBeCloseTo(expectedRadiusSq, 4)
      expect(r2Sq).toBeCloseTo(expectedRadiusSq, 4)
    })
  })
})

describe('buildHopfTorus4DEdges', () => {
  it('should create grid connectivity', () => {
    const edges = buildHopfTorus4DEdges(16, 16)

    expect(edges.length).toBeGreaterThan(0)
  })

  it('should have valid vertex indices', () => {
    const resXi1 = 12
    const resXi2 = 10
    const maxIndex = resXi1 * resXi2 - 1
    const edges = buildHopfTorus4DEdges(resXi1, resXi2)

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(maxIndex)
      expect(j).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThanOrEqual(maxIndex)
      expect(i).toBeLessThan(j) // Canonical ordering
    })
  })

  it('should respect offset for multiple tori', () => {
    const offset = 100
    const resXi1 = 8
    const resXi2 = 8
    const edges = buildHopfTorus4DEdges(resXi1, resXi2, offset)

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(offset)
      expect(j).toBeGreaterThanOrEqual(offset)
    })
  })
})

describe('generateNestedHopfTorus4D', () => {
  it('should generate NdGeometry with correct properties', () => {
    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: 24,
      resolutionXi2: 24,
    })

    expect(geometry.dimension).toBe(4)
    expect(geometry.type).toBe('clifford-torus') // Internal type, wrapped by generateNestedTorus
    expect(geometry.vertices).toHaveLength(576) // 24 * 24
    expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
    expect(geometry.metadata?.properties?.fibration).toBe('S³ → S²')
  })

  it('should generate edges in grid mode', () => {
    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'none',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges).toHaveLength(0)
  })

  it('should generate multiple nested tori when enabled', () => {
    const resXi1 = 16
    const resXi2 = 16
    const numberOfTori = 3

    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
      showNestedTori: true,
      numberOfTori,
    })

    expect(geometry.vertices).toHaveLength(resXi1 * resXi2 * numberOfTori)
    expect(geometry.metadata?.properties?.torusCount).toBe(numberOfTori)
  })
})

// ============================================================================
// Nested 6D Mode Tests (3-Torus)
// ============================================================================

describe('generateTorus6DPoints', () => {
  it('should generate correct number of points', () => {
    const resXi1 = 16
    const resXi2 = 12
    const points = generateTorus6DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    // Points = resolutionXi1 * resolutionXi2 (2D surface, same as 4D)
    expect(points).toHaveLength(resXi1 * resXi2)
  })

  it('should generate 6D points', () => {
    const points = generateTorus6DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    points.forEach((p) => {
      expect(p).toHaveLength(6)
    })
  })

  it('should respect eta parameter for circle balance', () => {
    const radius = 1.0
    const eta = Math.PI / 4

    const points = generateTorus6DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      radius,
      eta,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    // Each point should have defined coordinates in all three circle planes
    points.forEach((p) => {
      // Check (x₀, x₁) plane - first circle
      const r1Sq = p[0]! ** 2 + p[1]! ** 2
      // Check (x₂, x₃) plane - second circle
      const r2Sq = p[2]! ** 2 + p[3]! ** 2
      // Check (x₄, x₅) plane - third circle
      const r3Sq = p[4]! ** 2 + p[5]! ** 2

      // All should be non-zero (points spread across all three planes)
      expect(r1Sq).toBeGreaterThan(0)
      expect(r2Sq).toBeGreaterThan(0)
      expect(r3Sq).toBeGreaterThan(0)
    })
  })
})

describe('buildTorus6DEdges', () => {
  it('should create grid connectivity (same as 4D)', () => {
    const resXi1 = 8
    const resXi2 = 8
    const edges = buildTorus6DEdges(resXi1, resXi2)

    expect(edges.length).toBeGreaterThan(0)
    // Should have 2 edges per grid cell (ξ₁ and ξ₂ directions)
    expect(edges.length).toBe(resXi1 * resXi2 * 2)
  })

  it('should have valid vertex indices', () => {
    const resXi1 = 12
    const resXi2 = 10
    const maxIndex = resXi1 * resXi2 - 1
    const edges = buildTorus6DEdges(resXi1, resXi2)

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(maxIndex)
      expect(j).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThanOrEqual(maxIndex)
      expect(i).toBeLessThan(j) // Canonical ordering
    })
  })
})

describe('generateNestedTorus6D', () => {
  it('should generate NdGeometry with correct properties', () => {
    const resXi1 = 24
    const resXi2 = 24
    const geometry = generateNestedTorus6D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    expect(geometry.dimension).toBe(6)
    expect(geometry.type).toBe('clifford-torus')
    expect(geometry.vertices).toHaveLength(resXi1 * resXi2) // 576 points
    expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
    expect(geometry.metadata?.properties?.fibration).toBe('T³ (3-torus)')
    expect(geometry.metadata?.properties?.fiberType).toBe('Coupled circles')
  })

  it('should generate edges in grid mode', () => {
    const geometry = generateNestedTorus6D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedTorus6D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'none',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges).toHaveLength(0)
  })
})

// ============================================================================
// Nested (Hopf) 8D Mode Tests
// ============================================================================

describe('generateHopfTorus8DPoints', () => {
  it('should generate correct number of points', () => {
    const resXi1 = 16
    const resXi2 = 12
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    expect(points).toHaveLength(resXi1 * resXi2)
  })

  it('should generate 8D points', () => {
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    points.forEach((p) => {
      expect(p).toHaveLength(8)
    })
  })

  it('should have all points on S⁷ with correct radius', () => {
    const radius = 2.0
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      radius,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    points.forEach((p) => {
      const sumSq = p.reduce((acc, x) => acc + x! ** 2, 0)
      expect(sumSq).toBeCloseTo(radius * radius, 4)
    })
  })
})

describe('buildHopfTorus8DEdges', () => {
  it('should create grid connectivity', () => {
    const edges = buildHopfTorus8DEdges(16, 16)

    expect(edges.length).toBeGreaterThan(0)
  })

  it('should have valid vertex indices', () => {
    const resXi1 = 12
    const resXi2 = 10
    const maxIndex = resXi1 * resXi2 - 1
    const edges = buildHopfTorus8DEdges(resXi1, resXi2)

    edges.forEach(([i, j]) => {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(maxIndex)
      expect(j).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThanOrEqual(maxIndex)
      expect(i).toBeLessThan(j) // Canonical ordering
    })
  })
})

describe('generateNestedHopfTorus8D', () => {
  it('should generate NdGeometry with correct properties', () => {
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      resolutionXi1: 24,
      resolutionXi2: 24,
    })

    expect(geometry.dimension).toBe(8)
    expect(geometry.type).toBe('clifford-torus')
    expect(geometry.vertices).toHaveLength(576)
    expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
    expect(geometry.metadata?.properties?.fibration).toBe('S⁷ → S⁴')
  })

  it('should generate edges in grid mode', () => {
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_NESTED_TORUS_CONFIG,
      edgeMode: 'none',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges).toHaveLength(0)
  })
})

// ============================================================================
// Higher Dimension Nested Torus Tests
// ============================================================================

describe('Higher dimension nested tori', () => {
  it('5D should generate twisted 2-torus', () => {
    const geometry = generateNestedTorus(5, DEFAULT_NESTED_TORUS_CONFIG)

    expect(geometry.dimension).toBe(5)
    expect(geometry.type).toBe('nested-torus')
    expect(geometry.metadata?.properties?.fibration).toBe('T² + helix')
  })

  it('7D should generate twisted 3-torus', () => {
    const geometry = generateNestedTorus(7, DEFAULT_NESTED_TORUS_CONFIG)

    expect(geometry.dimension).toBe(7)
    expect(geometry.type).toBe('nested-torus')
    expect(geometry.metadata?.properties?.fibration).toBe('T³ + helix')
  })

  it('9D should generate twisted 4-torus', () => {
    const geometry = generateNestedTorus(9, DEFAULT_NESTED_TORUS_CONFIG)

    expect(geometry.dimension).toBe(9)
    expect(geometry.type).toBe('nested-torus')
    expect(geometry.metadata?.properties?.fibration).toBe('T⁴ + helix')
  })

  it('10D should generate 5-torus', () => {
    const geometry = generateNestedTorus(10, DEFAULT_NESTED_TORUS_CONFIG)

    expect(geometry.dimension).toBe(10)
    expect(geometry.type).toBe('nested-torus')
    expect(geometry.metadata?.properties?.fibration).toBe('T⁵ (5-torus)')
  })

  it('11D should generate twisted 5-torus', () => {
    const geometry = generateNestedTorus(11, DEFAULT_NESTED_TORUS_CONFIG)

    expect(geometry.dimension).toBe(11)
    expect(geometry.type).toBe('nested-torus')
    expect(geometry.metadata?.properties?.fibration).toBe('T⁵ + helix')
  })
})

// ============================================================================
// Default Config Tests
// ============================================================================

describe('Default configurations', () => {
  describe('DEFAULT_CLIFFORD_TORUS_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.radius).toBeGreaterThan(0)
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionU).toBeGreaterThan(0)
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.resolutionV).toBeGreaterThan(0)
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.stepsPerCircle).toBeGreaterThan(0)
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.k).toBeGreaterThanOrEqual(1)
      expect(DEFAULT_CLIFFORD_TORUS_CONFIG.edgeMode).toBe('grid')
    })
  })

  describe('DEFAULT_NESTED_TORUS_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_NESTED_TORUS_CONFIG.radius).toBeGreaterThan(0)
      expect(DEFAULT_NESTED_TORUS_CONFIG.eta).toBeGreaterThan(0)
      expect(DEFAULT_NESTED_TORUS_CONFIG.eta).toBeLessThan(Math.PI / 2)
      expect(DEFAULT_NESTED_TORUS_CONFIG.resolutionXi1).toBeGreaterThan(0)
      expect(DEFAULT_NESTED_TORUS_CONFIG.resolutionXi2).toBeGreaterThan(0)
      expect(DEFAULT_NESTED_TORUS_CONFIG.edgeMode).toBe('grid')
    })
  })
})
