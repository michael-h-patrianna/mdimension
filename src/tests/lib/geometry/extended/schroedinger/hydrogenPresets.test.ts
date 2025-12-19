/**
 * Tests for hydrogen orbital presets and utility functions
 */

import {
  HYDROGEN_ORBITAL_PRESETS,
  getHydrogenPreset,
  maxAzimuthalForPrincipal,
  orbitalShapeLetter,
  quantumNumbersToLabel,
  validateQuantumNumbers,
} from '@/lib/geometry/extended/schroedinger/hydrogenPresets'
import { describe, expect, it } from 'vitest'

describe('Hydrogen Orbital Presets', () => {
  describe('HYDROGEN_ORBITAL_PRESETS', () => {
    it('should have all expected orbital presets', () => {
      // s orbitals
      expect(HYDROGEN_ORBITAL_PRESETS['1s']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['2s']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['3s']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['4s']).toBeDefined()

      // p orbitals
      expect(HYDROGEN_ORBITAL_PRESETS['2px']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['2py']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['2pz']).toBeDefined()

      // d orbitals
      expect(HYDROGEN_ORBITAL_PRESETS['3dxy']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['3dxz']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['3dyz']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['3dz2']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['3dx2y2']).toBeDefined()

      // f orbitals
      expect(HYDROGEN_ORBITAL_PRESETS['4fz3']).toBeDefined()
      expect(HYDROGEN_ORBITAL_PRESETS['4fxyz']).toBeDefined()

      // custom
      expect(HYDROGEN_ORBITAL_PRESETS['custom']).toBeDefined()
    })

    it('should have valid quantum numbers for all presets', () => {
      for (const [_name, preset] of Object.entries(HYDROGEN_ORBITAL_PRESETS)) {
        expect(validateQuantumNumbers(preset.n, preset.l, preset.m)).toBe(true)
        expect(preset.n).toBeGreaterThanOrEqual(1)
        expect(preset.l).toBeGreaterThanOrEqual(0)
        expect(preset.l).toBeLessThan(preset.n)
        expect(Math.abs(preset.m)).toBeLessThanOrEqual(preset.l)
        expect(preset.bohrRadiusScale).toBeGreaterThan(0)
      }
    })

    it('should have correct l values for orbital types', () => {
      // s orbitals should have l=0
      expect(HYDROGEN_ORBITAL_PRESETS['1s'].l).toBe(0)
      expect(HYDROGEN_ORBITAL_PRESETS['2s'].l).toBe(0)

      // p orbitals should have l=1
      expect(HYDROGEN_ORBITAL_PRESETS['2px'].l).toBe(1)
      expect(HYDROGEN_ORBITAL_PRESETS['2py'].l).toBe(1)
      expect(HYDROGEN_ORBITAL_PRESETS['2pz'].l).toBe(1)

      // d orbitals should have l=2
      expect(HYDROGEN_ORBITAL_PRESETS['3dxy'].l).toBe(2)
      expect(HYDROGEN_ORBITAL_PRESETS['3dz2'].l).toBe(2)

      // f orbitals should have l=3
      expect(HYDROGEN_ORBITAL_PRESETS['4fz3'].l).toBe(3)
    })
  })

  describe('getHydrogenPreset', () => {
    it('should return the correct preset for known names', () => {
      const preset2pz = getHydrogenPreset('2pz')
      expect(preset2pz.n).toBe(2)
      expect(preset2pz.l).toBe(1)
      expect(preset2pz.m).toBe(0)

      const preset3dxy = getHydrogenPreset('3dxy')
      expect(preset3dxy.n).toBe(3)
      expect(preset3dxy.l).toBe(2)
    })

    it('should return 2pz as fallback for unknown names', () => {
      // Cast to unknown to test fallback behavior
      const preset = getHydrogenPreset(
        'unknown' as unknown as Parameters<typeof getHydrogenPreset>[0]
      )
      expect(preset.n).toBe(2)
      expect(preset.l).toBe(1)
      expect(preset.m).toBe(0)
    })
  })

  describe('validateQuantumNumbers', () => {
    it('should return true for valid quantum numbers', () => {
      expect(validateQuantumNumbers(1, 0, 0)).toBe(true) // 1s
      expect(validateQuantumNumbers(2, 0, 0)).toBe(true) // 2s
      expect(validateQuantumNumbers(2, 1, 0)).toBe(true) // 2p
      expect(validateQuantumNumbers(2, 1, 1)).toBe(true) // 2p
      expect(validateQuantumNumbers(2, 1, -1)).toBe(true) // 2p
      expect(validateQuantumNumbers(3, 2, 2)).toBe(true) // 3d
      expect(validateQuantumNumbers(3, 2, -2)).toBe(true) // 3d
      expect(validateQuantumNumbers(4, 3, 0)).toBe(true) // 4f
    })

    it('should return false for invalid n', () => {
      expect(validateQuantumNumbers(0, 0, 0)).toBe(false) // n must be >= 1
      expect(validateQuantumNumbers(-1, 0, 0)).toBe(false)
    })

    it('should return false for invalid l', () => {
      expect(validateQuantumNumbers(1, 1, 0)).toBe(false) // l must be < n
      expect(validateQuantumNumbers(2, 2, 0)).toBe(false)
      expect(validateQuantumNumbers(1, -1, 0)).toBe(false) // l must be >= 0
    })

    it('should return false for invalid m', () => {
      expect(validateQuantumNumbers(2, 1, 2)).toBe(false) // |m| must be <= l
      expect(validateQuantumNumbers(2, 1, -2)).toBe(false)
      expect(validateQuantumNumbers(3, 0, 1)).toBe(false) // for l=0, m must be 0
    })
  })

  describe('orbitalShapeLetter', () => {
    it('should return correct letters for l values', () => {
      expect(orbitalShapeLetter(0)).toBe('s')
      expect(orbitalShapeLetter(1)).toBe('p')
      expect(orbitalShapeLetter(2)).toBe('d')
      expect(orbitalShapeLetter(3)).toBe('f')
      expect(orbitalShapeLetter(4)).toBe('g')
      expect(orbitalShapeLetter(5)).toBe('h')
      expect(orbitalShapeLetter(6)).toBe('i')
    })

    it('should return l=X for unknown l values', () => {
      expect(orbitalShapeLetter(7)).toBe('l=7')
      expect(orbitalShapeLetter(10)).toBe('l=10')
    })
  })

  describe('maxAzimuthalForPrincipal', () => {
    it('should return n-1 for n >= 1', () => {
      expect(maxAzimuthalForPrincipal(1)).toBe(0)
      expect(maxAzimuthalForPrincipal(2)).toBe(1)
      expect(maxAzimuthalForPrincipal(3)).toBe(2)
      expect(maxAzimuthalForPrincipal(4)).toBe(3)
      expect(maxAzimuthalForPrincipal(7)).toBe(6)
    })

    it('should return 0 for n <= 1', () => {
      expect(maxAzimuthalForPrincipal(1)).toBe(0)
      expect(maxAzimuthalForPrincipal(0)).toBe(0)
    })
  })

  describe('quantumNumbersToLabel', () => {
    it('should generate correct labels for s orbitals', () => {
      expect(quantumNumbersToLabel(1, 0, 0)).toBe('1s')
      expect(quantumNumbersToLabel(2, 0, 0)).toBe('2s')
      expect(quantumNumbersToLabel(3, 0, 0)).toBe('3s')
    })

    it('should generate correct labels for p orbitals', () => {
      expect(quantumNumbersToLabel(2, 1, 0)).toBe('2pz')
      expect(quantumNumbersToLabel(2, 1, 1)).toBe('2px')
      expect(quantumNumbersToLabel(2, 1, -1)).toBe('2py')
      expect(quantumNumbersToLabel(3, 1, 0)).toBe('3pz')
    })

    it('should generate correct labels for d orbitals', () => {
      expect(quantumNumbersToLabel(3, 2, 0)).toBe('3dz²')
      expect(quantumNumbersToLabel(3, 2, 1)).toBe('3dxz')
      expect(quantumNumbersToLabel(3, 2, -1)).toBe('3dyz')
      expect(quantumNumbersToLabel(3, 2, 2)).toBe('3dxy')
      expect(quantumNumbersToLabel(3, 2, -2)).toBe('3dx²-y²')
    })

    it('should fallback to generic label for f orbitals', () => {
      // f orbitals don't have specific labels in the function
      expect(quantumNumbersToLabel(4, 3, 0)).toContain('4f')
    })
  })
})
