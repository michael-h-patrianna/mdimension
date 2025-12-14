/**
 * Tests for Clifford Torus Visualization Modes
 *
 * Tests the two visualization modes:
 * - Flat (2D-11D): Existing classic/generalized implementation
 * - Nested/Hopf (4D, 8D): Hopf fibration tori
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
  getVisualizationModeUnavailableReason,
  isVisualizationModeAvailable,
} from '@/lib/geometry/extended/clifford-torus'
import { DEFAULT_CLIFFORD_TORUS_CONFIG } from '@/lib/geometry/extended/types'
import { describe, expect, it } from 'vitest'

// ============================================================================
// Visualization Mode Dispatcher Tests
// ============================================================================

describe('generateCliffordTorus with visualization modes', () => {
  describe('flat mode (default)', () => {
    it('should generate flat torus by default', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'flat',
      })

      expect(geometry.dimension).toBe(4)
      expect(geometry.type).toBe('clifford-torus')
      expect(geometry.vertices.length).toBeGreaterThan(0)
    })

    it('should fall back to flat mode for invalid visualization mode', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'invalid' as 'flat', // Force invalid value
      })

      // Should not throw, falls back to flat
      expect(geometry.vertices.length).toBeGreaterThan(0)
    })
  })

  describe('nested mode', () => {
    it('should generate nested torus for 4D', () => {
      const geometry = generateCliffordTorus(4, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'nested',
      })

      expect(geometry.dimension).toBe(4)
      expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
      expect(geometry.metadata?.properties?.fibration).toBe('S³ → S²')
    })

    it('should generate nested torus for 8D', () => {
      const geometry = generateCliffordTorus(8, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'nested',
      })

      expect(geometry.dimension).toBe(8)
      expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
      expect(geometry.metadata?.properties?.fibration).toBe('S⁷ → S⁴')
    })

    it('should generate nested torus for 6D', () => {
      const geometry = generateCliffordTorus(6, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'nested',
      })

      expect(geometry.dimension).toBe(6)
      expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
      expect(geometry.metadata?.properties?.fibration).toBe('T³ (3-torus)')
    })

    it('should generate nested torus for 9D', () => {
      const geometry = generateCliffordTorus(9, {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        visualizationMode: 'nested',
      })

      expect(geometry.dimension).toBe(9)
      expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
      expect(geometry.metadata?.properties?.fibration).toBe('T⁴ + helix')
    })

    it('should throw for nested mode in unsupported dimensions', () => {
      expect(() =>
        generateCliffordTorus(3, {
          ...DEFAULT_CLIFFORD_TORUS_CONFIG,
          visualizationMode: 'nested',
        })
      ).toThrow()

      expect(() =>
        generateCliffordTorus(5, {
          ...DEFAULT_CLIFFORD_TORUS_CONFIG,
          visualizationMode: 'nested',
        })
      ).toThrow()

      expect(() =>
        generateCliffordTorus(7, {
          ...DEFAULT_CLIFFORD_TORUS_CONFIG,
          visualizationMode: 'nested',
        })
      ).toThrow()

      expect(() =>
        generateCliffordTorus(10, {
          ...DEFAULT_CLIFFORD_TORUS_CONFIG,
          visualizationMode: 'nested',
        })
      ).toThrow()
    })
  })
})

// ============================================================================
// Mode Availability Tests
// ============================================================================

describe('isVisualizationModeAvailable', () => {
  describe('flat mode', () => {
    it('should be available for dimensions 2-11', () => {
      for (let d = 2; d <= 11; d++) {
        expect(isVisualizationModeAvailable('flat', d)).toBe(true)
      }
    })

    it('should not be available outside 2-11', () => {
      expect(isVisualizationModeAvailable('flat', 1)).toBe(false)
      expect(isVisualizationModeAvailable('flat', 12)).toBe(false)
    })
  })

  describe('nested mode', () => {
    it('should be available for 4D, 6D, 8D, and 9D', () => {
      expect(isVisualizationModeAvailable('nested', 4)).toBe(true)
      expect(isVisualizationModeAvailable('nested', 6)).toBe(true)
      expect(isVisualizationModeAvailable('nested', 8)).toBe(true)
      expect(isVisualizationModeAvailable('nested', 9)).toBe(true)
    })

    it('should not be available for other dimensions', () => {
      for (const d of [2, 3, 5, 7, 10, 11]) {
        expect(isVisualizationModeAvailable('nested', d)).toBe(false)
      }
    })
  })
})

describe('getVisualizationModeUnavailableReason', () => {
  it('should return null for available modes', () => {
    expect(getVisualizationModeUnavailableReason('flat', 4)).toBeNull()
    expect(getVisualizationModeUnavailableReason('nested', 4)).toBeNull()
  })

  it('should return reason for unavailable nested mode', () => {
    const reason = getVisualizationModeUnavailableReason('nested', 5)
    expect(reason).toContain('4D, 6D, 8D, or 9D')
  })
})

// ============================================================================
// Nested (Hopf) 4D Mode Tests
// ============================================================================

describe('generateHopfTorus4DPoints', () => {
  it('should generate resolutionXi1 × resolutionXi2 points', () => {
    const points = generateHopfTorus4DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: 16,
      resolutionXi2: 12,
    })

    expect(points).toHaveLength(16 * 12)
  })

  it('should generate 4D points', () => {
    const points = generateHopfTorus4DPoints(DEFAULT_CLIFFORD_TORUS_CONFIG)

    points.forEach((p) => {
      expect(p).toHaveLength(4)
    })
  })

  it('should have all points on S³ with correct radius', () => {
    const radius = 2.0
    const points = generateHopfTorus4DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: 24,
      resolutionXi2: 24,
    })

    expect(geometry.dimension).toBe(4)
    expect(geometry.type).toBe('clifford-torus')
    expect(geometry.vertices).toHaveLength(576) // 24 * 24
    expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
    expect(geometry.metadata?.properties?.fibration).toBe('S³ → S²')
  })

  it('should generate edges in grid mode', () => {
    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedHopfTorus4D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    // Points = resolutionXi1 * resolutionXi2 (2D surface, same as 4D)
    expect(points).toHaveLength(resXi1 * resXi2)
  })

  it('should generate 6D points', () => {
    const points = generateTorus6DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedTorus6D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
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
    // 8D now uses the same 2D surface structure as 4D
    const resXi1 = 16
    const resXi2 = 12
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    // Points = resolutionXi1 * resolutionXi2 (2D surface, same as 4D)
    const expectedPoints = resXi1 * resXi2
    expect(points).toHaveLength(expectedPoints)
  })

  it('should generate 8D points', () => {
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    points.forEach((p) => {
      expect(p).toHaveLength(8)
    })
  })

  it('should have all points on S⁷ with correct radius', () => {
    const radius = 1.5
    const points = generateHopfTorus8DPoints({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      radius,
      resolutionXi1: 8,
      resolutionXi2: 8,
    })

    points.forEach((p) => {
      let sumSq = 0
      for (let i = 0; i < 8; i++) {
        sumSq += p[i]! ** 2
      }
      expect(sumSq).toBeCloseTo(radius * radius, 4)
    })
  })
})

describe('buildHopfTorus8DEdges', () => {
  it('should create grid connectivity (same as 4D)', () => {
    // 8D now uses the same 2D grid structure as 4D
    const resXi1 = 8
    const resXi2 = 8
    const edges = buildHopfTorus8DEdges(resXi1, resXi2)

    expect(edges.length).toBeGreaterThan(0)
    // Should have 2 edges per grid cell (ξ₁ and ξ₂ directions)
    expect(edges.length).toBe(resXi1 * resXi2 * 2)
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
    const resXi1 = 24
    const resXi2 = 24
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      resolutionXi1: resXi1,
      resolutionXi2: resXi2,
    })

    expect(geometry.dimension).toBe(8)
    expect(geometry.type).toBe('clifford-torus')
    expect(geometry.vertices).toHaveLength(resXi1 * resXi2) // 576 points (same as 4D)
    expect(geometry.metadata?.properties?.visualizationMode).toBe('nested')
    expect(geometry.metadata?.properties?.fibration).toBe('S⁷ → S⁴')
    expect(geometry.metadata?.properties?.fiberType).toBe('S³ (3-spheres)')
  })

  it('should generate edges in grid mode', () => {
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      edgeMode: 'grid',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges.length).toBeGreaterThan(0)
  })

  it('should not generate edges in none mode', () => {
    const geometry = generateNestedHopfTorus8D({
      ...DEFAULT_CLIFFORD_TORUS_CONFIG,
      edgeMode: 'none',
      resolutionXi1: 16,
      resolutionXi2: 16,
    })

    expect(geometry.edges).toHaveLength(0)
  })
})

// ============================================================================
// Mathematical Property Verification
// ============================================================================

describe('Mathematical properties', () => {
  describe('Hopf torus coupled angles', () => {
    it('should have coupled angle structure', () => {
      const config = {
        ...DEFAULT_CLIFFORD_TORUS_CONFIG,
        radius: 1.0,
        eta: Math.PI / 4,
        resolutionXi1: 8,
        resolutionXi2: 8,
      }

      const points = generateHopfTorus4DPoints(config)

      // The Hopf parametrization couples angles:
      // Moving along ξ₁ while keeping ξ₂ fixed should trace a helix
      // on the torus, not a simple circle

      // Check that adjacent points in ξ₁ have both coordinates changing
      for (let i = 0; i < config.resolutionXi1 - 1; i++) {
        const p1 = points[i * config.resolutionXi2]!
        const p2 = points[(i + 1) * config.resolutionXi2]!

        // Both (x₀, x₁) and (x₂, x₃) should change
        const delta01 = Math.abs(p2[0]! - p1[0]!) + Math.abs(p2[1]! - p1[1]!)
        const delta23 = Math.abs(p2[2]! - p1[2]!) + Math.abs(p2[3]! - p1[3]!)

        // In Hopf, both should change (unlike flat where only one circle changes)
        expect(delta01).toBeGreaterThan(0)
        expect(delta23).toBeGreaterThan(0)
      }
    })
  })
})
