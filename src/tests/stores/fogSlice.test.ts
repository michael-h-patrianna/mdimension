/**
 * Tests for fogSlice
 *
 * Verifies state management for scene fog effect.
 * Note: Only physical fog is supported (linear/volumetric types removed).
 */

import { useEnvironmentStore } from '@/stores/environmentStore'
import { DEFAULT_FOG_STATE } from '@/stores/slices/fogSlice'
import { beforeEach, describe, expect, it } from 'vitest'

describe('fogSlice', () => {
  beforeEach(() => {
    useEnvironmentStore.getState().resetFog()
  })

  describe('initial state', () => {
    it('should have fog enabled by default', () => {
      expect(useEnvironmentStore.getState().fogEnabled).toBe(true)
    })

    it('should have default fog density', () => {
      expect(useEnvironmentStore.getState().fogDensity).toBe(DEFAULT_FOG_STATE.fogDensity)
    })

    it('should have default fog color', () => {
      expect(useEnvironmentStore.getState().fogColor).toBe(DEFAULT_FOG_STATE.fogColor)
    })

    it('should have default physical fog parameters', () => {
      expect(useEnvironmentStore.getState().fogHeight).toBe(DEFAULT_FOG_STATE.fogHeight)
      expect(useEnvironmentStore.getState().fogFalloff).toBe(DEFAULT_FOG_STATE.fogFalloff)
      expect(useEnvironmentStore.getState().fogNoiseScale).toBe(DEFAULT_FOG_STATE.fogNoiseScale)
      expect(useEnvironmentStore.getState().fogNoiseSpeed).toEqual(DEFAULT_FOG_STATE.fogNoiseSpeed)
      expect(useEnvironmentStore.getState().fogScattering).toBe(DEFAULT_FOG_STATE.fogScattering)
      expect(useEnvironmentStore.getState().volumetricShadows).toBe(
        DEFAULT_FOG_STATE.volumetricShadows
      )
    })
  })

  describe('setFogEnabled', () => {
    it('should toggle fog enabled', () => {
      useEnvironmentStore.getState().setFogEnabled(true)
      expect(useEnvironmentStore.getState().fogEnabled).toBe(true)

      useEnvironmentStore.getState().setFogEnabled(false)
      expect(useEnvironmentStore.getState().fogEnabled).toBe(false)
    })
  })

  describe('setFogDensity', () => {
    it('should update fog density', () => {
      useEnvironmentStore.getState().setFogDensity(0.05)
      expect(useEnvironmentStore.getState().fogDensity).toBe(0.05)
    })

    it('should clamp density to valid range', () => {
      useEnvironmentStore.getState().setFogDensity(1)
      expect(useEnvironmentStore.getState().fogDensity).toBe(0.15)

      useEnvironmentStore.getState().setFogDensity(-1)
      expect(useEnvironmentStore.getState().fogDensity).toBe(0)
    })
  })

  describe('setFogColor', () => {
    it('should update fog color', () => {
      useEnvironmentStore.getState().setFogColor('#123456')
      expect(useEnvironmentStore.getState().fogColor).toBe('#123456')
    })

    it('should accept short hex format (#RGB)', () => {
      useEnvironmentStore.getState().setFogColor('#abc')
      expect(useEnvironmentStore.getState().fogColor).toBe('#abc')
    })

    it('should accept long hex format (#RRGGBB)', () => {
      useEnvironmentStore.getState().setFogColor('#aabbcc')
      expect(useEnvironmentStore.getState().fogColor).toBe('#aabbcc')
    })

    it('should accept hex with alpha (#RRGGBBAA)', () => {
      useEnvironmentStore.getState().setFogColor('#aabbccdd')
      expect(useEnvironmentStore.getState().fogColor).toBe('#aabbccdd')
    })

    it('should reject invalid color formats', () => {
      const originalColor = useEnvironmentStore.getState().fogColor

      // Invalid format: no hash
      useEnvironmentStore.getState().setFogColor('123456')
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor)

      // Invalid format: wrong length
      useEnvironmentStore.getState().setFogColor('#12345')
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor)

      // Invalid format: non-hex characters
      useEnvironmentStore.getState().setFogColor('#gggggg')
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor)
    })
  })

  describe('physical fog parameters', () => {
    it('should update fog height', () => {
      useEnvironmentStore.getState().setFogHeight(20)
      expect(useEnvironmentStore.getState().fogHeight).toBe(20)

      useEnvironmentStore.getState().setFogHeight(-5)
      expect(useEnvironmentStore.getState().fogHeight).toBe(0)
    })

    it('should update fog falloff', () => {
      useEnvironmentStore.getState().setFogFalloff(0.5)
      expect(useEnvironmentStore.getState().fogFalloff).toBe(0.5)

      useEnvironmentStore.getState().setFogFalloff(0)
      expect(useEnvironmentStore.getState().fogFalloff).toBe(0.001) // Min value check
    })

    it('should update fog noise scale', () => {
      useEnvironmentStore.getState().setFogNoiseScale(0.2)
      expect(useEnvironmentStore.getState().fogNoiseScale).toBe(0.2)

      useEnvironmentStore.getState().setFogNoiseScale(0)
      expect(useEnvironmentStore.getState().fogNoiseScale).toBe(0.001) // Min value check
    })

    it('should update fog noise speed', () => {
      const speed: [number, number, number] = [0.2, 0.1, 0.2]
      useEnvironmentStore.getState().setFogNoiseSpeed(speed)
      expect(useEnvironmentStore.getState().fogNoiseSpeed).toEqual(speed)
    })

    it('should update fog scattering', () => {
      useEnvironmentStore.getState().setFogScattering(0.5)
      expect(useEnvironmentStore.getState().fogScattering).toBe(0.5)

      useEnvironmentStore.getState().setFogScattering(1.5)
      expect(useEnvironmentStore.getState().fogScattering).toBe(0.99) // Clamp max

      useEnvironmentStore.getState().setFogScattering(-1.5)
      expect(useEnvironmentStore.getState().fogScattering).toBe(-0.99) // Clamp min
    })

    it('should toggle volumetric shadows', () => {
      useEnvironmentStore.getState().setVolumetricShadows(false)
      expect(useEnvironmentStore.getState().volumetricShadows).toBe(false)

      useEnvironmentStore.getState().setVolumetricShadows(true)
      expect(useEnvironmentStore.getState().volumetricShadows).toBe(true)
    })
  })

  describe('resetFog', () => {
    it('should reset all fog settings to defaults', () => {
      useEnvironmentStore.getState().setFogEnabled(true)
      useEnvironmentStore.getState().setFogDensity(0.1)
      useEnvironmentStore.getState().setFogColor('#ffffff')

      // Physical params
      useEnvironmentStore.getState().setFogHeight(100)
      useEnvironmentStore.getState().setFogFalloff(1.0)
      useEnvironmentStore.getState().setFogNoiseScale(1.0)
      useEnvironmentStore.getState().setFogScattering(0.5)
      useEnvironmentStore.getState().setVolumetricShadows(false)

      useEnvironmentStore.getState().resetFog()

      expect(useEnvironmentStore.getState().fogEnabled).toBe(DEFAULT_FOG_STATE.fogEnabled)
      expect(useEnvironmentStore.getState().fogDensity).toBe(DEFAULT_FOG_STATE.fogDensity)
      expect(useEnvironmentStore.getState().fogColor).toBe(DEFAULT_FOG_STATE.fogColor)

      expect(useEnvironmentStore.getState().fogHeight).toBe(DEFAULT_FOG_STATE.fogHeight)
      expect(useEnvironmentStore.getState().fogFalloff).toBe(DEFAULT_FOG_STATE.fogFalloff)
      expect(useEnvironmentStore.getState().fogNoiseScale).toBe(DEFAULT_FOG_STATE.fogNoiseScale)
      expect(useEnvironmentStore.getState().fogScattering).toBe(DEFAULT_FOG_STATE.fogScattering)
      expect(useEnvironmentStore.getState().volumetricShadows).toBe(
        DEFAULT_FOG_STATE.volumetricShadows
      )
    })
  })
})
