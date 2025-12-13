import { describe, it, expect } from 'vitest'
import {
  GOLDEN_RATIO,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
  MAX_DEVIATION,
  getPlaneMultiplier,
  getAllPlaneMultipliers,
  getAverageMultiplier,
} from '@/lib/animation/biasCalculation'

describe('biasCalculation', () => {
  describe('constants', () => {
    it('should have correct GOLDEN_RATIO value', () => {
      const expectedPhi = (1 + Math.sqrt(5)) / 2
      expect(GOLDEN_RATIO).toBeCloseTo(expectedPhi, 10)
      expect(GOLDEN_RATIO).toBeCloseTo(1.618034, 5)
    })

    it('should have safe MIN_MULTIPLIER', () => {
      expect(MIN_MULTIPLIER).toBe(0.1)
      expect(MIN_MULTIPLIER).toBeGreaterThan(0)
    })

    it('should have reasonable MAX_MULTIPLIER', () => {
      expect(MAX_MULTIPLIER).toBe(3.0)
    })

    it('should have MAX_DEVIATION that creates meaningful spread', () => {
      expect(MAX_DEVIATION).toBe(0.8)
      // At max bias: range is (1 - 0.8) to (1 + 0.8) = 0.2 to 1.8
      expect(1 - MAX_DEVIATION).toBeCloseTo(0.2)
      expect(1 + MAX_DEVIATION).toBeCloseTo(1.8)
    })
  })

  describe('getPlaneMultiplier', () => {
    it('should return 1.0 when bias is 0', () => {
      expect(getPlaneMultiplier(0, 10, 0)).toBe(1.0)
      expect(getPlaneMultiplier(5, 10, 0)).toBe(1.0)
      expect(getPlaneMultiplier(54, 55, 0)).toBe(1.0) // Max plane in 11D
    })

    it('should return varied value for plane 0 at non-zero bias', () => {
      // With phase offset, plane 0 no longer returns 1.0
      const mult = getPlaneMultiplier(0, 10, 1.0)
      expect(mult).not.toBe(1.0)
      expect(mult).toBeGreaterThan(1.0) // sin(π/4) > 0
    })

    it('should return values within [MIN_MULTIPLIER, MAX_MULTIPLIER] at any bias', () => {
      // Test all planes for 11D (55 planes max)
      for (let planeIndex = 0; planeIndex < 55; planeIndex++) {
        const mult = getPlaneMultiplier(planeIndex, 55, 1.0)
        expect(mult).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
        expect(mult).toBeLessThanOrEqual(MAX_MULTIPLIER)
      }
    })

    it('should create varied multipliers at max bias', () => {
      const multipliers = [
        getPlaneMultiplier(0, 10, 1.0),
        getPlaneMultiplier(1, 10, 1.0),
        getPlaneMultiplier(2, 10, 1.0),
        getPlaneMultiplier(3, 10, 1.0),
      ]

      // All planes should have non-1.0 values at max bias (due to phase offset)
      multipliers.forEach((mult) => {
        expect(mult).not.toBe(1.0)
      })

      // All should be different from each other
      const unique = new Set(multipliers.map((m) => m.toFixed(6)))
      expect(unique.size).toBe(4)
    })

    it('should scale variation with bias value', () => {
      const index = 1 // Use plane 1 which has significant variation
      const bias0 = getPlaneMultiplier(index, 10, 0)
      const bias25 = getPlaneMultiplier(index, 10, 0.25)
      const bias50 = getPlaneMultiplier(index, 10, 0.5)
      const bias100 = getPlaneMultiplier(index, 10, 1.0)

      expect(bias0).toBe(1.0)

      // Deviation should increase with bias
      const dev25 = Math.abs(bias25 - 1)
      const dev50 = Math.abs(bias50 - 1)
      const dev100 = Math.abs(bias100 - 1)

      expect(dev50).toBeGreaterThan(dev25)
      expect(dev100).toBeGreaterThan(dev50)
    })

    it('should handle 3D (3 planes)', () => {
      const multipliers = getAllPlaneMultipliers(3, 1.0)
      expect(multipliers).toHaveLength(3)
      multipliers.forEach((m) => {
        expect(m).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
        expect(m).toBeLessThanOrEqual(MAX_MULTIPLIER)
      })
    })

    it('should handle 4D (6 planes)', () => {
      const multipliers = getAllPlaneMultipliers(6, 1.0)
      expect(multipliers).toHaveLength(6)
      multipliers.forEach((m) => {
        expect(m).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
        expect(m).toBeLessThanOrEqual(MAX_MULTIPLIER)
      })
    })

    it('should handle 11D (55 planes)', () => {
      const multipliers = getAllPlaneMultipliers(55, 1.0)
      expect(multipliers).toHaveLength(55)
      multipliers.forEach((m) => {
        expect(m).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
        expect(m).toBeLessThanOrEqual(MAX_MULTIPLIER)
      })
    })
  })

  describe('getAllPlaneMultipliers', () => {
    it('should return array of correct length', () => {
      expect(getAllPlaneMultipliers(3, 0.5)).toHaveLength(3)
      expect(getAllPlaneMultipliers(10, 0.5)).toHaveLength(10)
      expect(getAllPlaneMultipliers(55, 0.5)).toHaveLength(55)
    })

    it('should return all 1.0s when bias is 0', () => {
      const multipliers = getAllPlaneMultipliers(10, 0)
      multipliers.forEach((m) => {
        expect(m).toBe(1.0)
      })
    })

    it('should create unique multipliers for different planes at max bias', () => {
      const multipliers = getAllPlaneMultipliers(10, 1.0)
      // Round to avoid floating point comparison issues
      const unique = new Set(multipliers.map((m) => m.toFixed(4)))
      // All 10 should be unique (golden ratio guarantees this)
      expect(unique.size).toBe(10)
    })

    it('should create unique multipliers even for 55 planes (11D)', () => {
      const multipliers = getAllPlaneMultipliers(55, 1.0)
      const unique = new Set(multipliers.map((m) => m.toFixed(4)))
      // All should be unique
      expect(unique.size).toBe(55)
    })
  })

  describe('getAverageMultiplier', () => {
    it('should return 1.0 when bias is 0', () => {
      expect(getAverageMultiplier(10, 0)).toBe(1.0)
      expect(getAverageMultiplier(55, 0)).toBe(1.0)
    })

    it('should be close to 1.0 at any bias (preserves overall rotation rate)', () => {
      // The golden ratio distribution should average close to 1.0
      // because sin() averages to 0 over many samples
      const avg10 = getAverageMultiplier(10, 1.0)
      const avg55 = getAverageMultiplier(55, 1.0)

      // Allow some deviation but should be reasonably close to 1.0
      expect(avg10).toBeGreaterThan(0.7)
      expect(avg10).toBeLessThan(1.3)

      // More planes = closer to 1.0 average
      expect(avg55).toBeGreaterThan(0.85)
      expect(avg55).toBeLessThan(1.15)
    })

    it('should return average for small plane counts', () => {
      const multipliers = getAllPlaneMultipliers(3, 0.5)
      const expected = multipliers.reduce((a, b) => a + b, 0) / 3
      expect(getAverageMultiplier(3, 0.5)).toBeCloseTo(expected)
    })
  })

  describe('golden ratio properties', () => {
    it('should create non-repeating sequence', () => {
      // Golden ratio ensures consecutive planes are maximally distant
      const multipliers = getAllPlaneMultipliers(20, 1.0)

      // Check that consecutive planes don't have similar values
      for (let i = 1; i < multipliers.length; i++) {
        const diff = Math.abs(multipliers[i]! - multipliers[i - 1]!)
        // Consecutive planes should typically differ by at least 0.1
        // (not a strict test, but golden ratio should provide good spread)
        expect(diff).toBeGreaterThan(0.01)
      }
    })

    it('should distribute multipliers across full range at max bias', () => {
      const multipliers = getAllPlaneMultipliers(55, 1.0)
      const min = Math.min(...multipliers)
      const max = Math.max(...multipliers)

      // Should use most of the available range
      // Min should be close to 0.2 (1 - 0.8)
      expect(min).toBeLessThan(0.4)
      // Max should be close to 1.8 (1 + 0.8)
      expect(max).toBeGreaterThan(1.6)
    })
  })

  describe('edge cases', () => {
    it('should handle single plane', () => {
      const multiplier = getPlaneMultiplier(0, 1, 1.0)
      // With phase offset, even single plane gets varied speed
      expect(multiplier).toBeGreaterThan(1.0)
      expect(multiplier).toBeLessThanOrEqual(MAX_MULTIPLIER)
    })

    it('should handle zero planes array', () => {
      const multipliers = getAllPlaneMultipliers(0, 1.0)
      expect(multipliers).toHaveLength(0)
    })

    it('should handle very small bias', () => {
      const multiplier = getPlaneMultiplier(1, 10, 0.001)
      // Should be very close to 1.0
      expect(multiplier).toBeCloseTo(1.0, 2)
    })

    it('should handle bias exactly at boundaries', () => {
      const atZero = getPlaneMultiplier(1, 10, 0)
      const atOne = getPlaneMultiplier(1, 10, 1)

      expect(atZero).toBe(1.0)
      expect(atOne).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
      expect(atOne).toBeLessThanOrEqual(MAX_MULTIPLIER)
    })
  })
})
