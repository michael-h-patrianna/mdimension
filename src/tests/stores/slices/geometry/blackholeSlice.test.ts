/**
 * Tests for blackholeSlice
 *
 * Tests the black hole state management functionality including:
 * - Basic parameter updates
 * - Visual preset application
 * - Quality preset application
 * - Animation controls
 * - Dimension-aware initialization
 */

import { BLACK_HOLE_VISUAL_PRESETS, DEFAULT_BLACK_HOLE_CONFIG } from '@/lib/geometry/extended/types'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { beforeEach, describe, expect, it } from 'vitest'

describe('blackholeSlice', () => {
  beforeEach(() => {
    useExtendedObjectStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have default black hole config', () => {
      const { blackhole } = useExtendedObjectStore.getState()
      expect(blackhole.horizonRadius).toBe(DEFAULT_BLACK_HOLE_CONFIG.horizonRadius)
      expect(blackhole.gravityStrength).toBe(DEFAULT_BLACK_HOLE_CONFIG.gravityStrength)
      expect(blackhole.manifoldIntensity).toBe(DEFAULT_BLACK_HOLE_CONFIG.manifoldIntensity)
      expect(blackhole.visualPreset).toBe(DEFAULT_BLACK_HOLE_CONFIG.visualPreset)
    })
  })

  describe('basic parameter actions', () => {
    it('should set horizon radius with clamping', () => {
      const { setBlackHoleHorizonRadius } = useExtendedObjectStore.getState()

      setBlackHoleHorizonRadius(2.0)
      expect(useExtendedObjectStore.getState().blackhole.horizonRadius).toBe(2.0)

      // Test clamping - too low (min is 0.05)
      setBlackHoleHorizonRadius(0.01)
      expect(useExtendedObjectStore.getState().blackhole.horizonRadius).toBe(0.05)

      // Test clamping - too high (max is 20)
      setBlackHoleHorizonRadius(30)
      expect(useExtendedObjectStore.getState().blackhole.horizonRadius).toBe(20)
    })

    it('should set gravity strength with clamping', () => {
      const { setBlackHoleGravityStrength } = useExtendedObjectStore.getState()

      setBlackHoleGravityStrength(1.5)
      expect(useExtendedObjectStore.getState().blackhole.gravityStrength).toBe(1.5)

      // Test clamping - too low (min is 0)
      setBlackHoleGravityStrength(-0.5)
      expect(useExtendedObjectStore.getState().blackhole.gravityStrength).toBe(0)

      // Test clamping - too high (max is 10)
      setBlackHoleGravityStrength(15)
      expect(useExtendedObjectStore.getState().blackhole.gravityStrength).toBe(10)
    })

    it('should set manifold intensity with clamping', () => {
      const { setBlackHoleManifoldIntensity } = useExtendedObjectStore.getState()

      setBlackHoleManifoldIntensity(2.0)
      expect(useExtendedObjectStore.getState().blackhole.manifoldIntensity).toBe(2.0)

      // Test clamping - too low (min is 0)
      setBlackHoleManifoldIntensity(-1)
      expect(useExtendedObjectStore.getState().blackhole.manifoldIntensity).toBe(0)

      // Test clamping - too high (max is 20)
      setBlackHoleManifoldIntensity(25)
      expect(useExtendedObjectStore.getState().blackhole.manifoldIntensity).toBe(20)
    })

    it('should set base color', () => {
      const { setBlackHoleBaseColor } = useExtendedObjectStore.getState()

      setBlackHoleBaseColor('#ff0000')
      expect(useExtendedObjectStore.getState().blackhole.baseColor).toBe('#ff0000')
    })

    it('should set palette mode', () => {
      const { setBlackHolePaletteMode } = useExtendedObjectStore.getState()

      setBlackHolePaletteMode('heatmap')
      expect(useExtendedObjectStore.getState().blackhole.paletteMode).toBe('heatmap')

      setBlackHolePaletteMode('shellOnly')
      expect(useExtendedObjectStore.getState().blackhole.paletteMode).toBe('shellOnly')
    })

    it('should set bloom boost with clamping', () => {
      const { setBlackHoleBloomBoost } = useExtendedObjectStore.getState()

      setBlackHoleBloomBoost(2.0)
      expect(useExtendedObjectStore.getState().blackhole.bloomBoost).toBe(2.0)

      // Test clamping
      setBlackHoleBloomBoost(-1)
      expect(useExtendedObjectStore.getState().blackhole.bloomBoost).toBe(0)

      setBlackHoleBloomBoost(10)
      expect(useExtendedObjectStore.getState().blackhole.bloomBoost).toBe(5.0)
    })
  })

  describe('visual preset actions', () => {
    it('should apply interstellar preset', () => {
      const { applyBlackHoleVisualPreset } = useExtendedObjectStore.getState()

      applyBlackHoleVisualPreset('interstellar')
      const { blackhole } = useExtendedObjectStore.getState()

      expect(blackhole.visualPreset).toBe('interstellar')
      expect(blackhole.manifoldThickness).toBe(
        BLACK_HOLE_VISUAL_PRESETS.interstellar.manifoldThickness
      )
      expect(blackhole.gravityStrength).toBe(BLACK_HOLE_VISUAL_PRESETS.interstellar.gravityStrength)
    })

    it('should apply cosmic preset', () => {
      const { applyBlackHoleVisualPreset } = useExtendedObjectStore.getState()

      applyBlackHoleVisualPreset('cosmic')
      const { blackhole } = useExtendedObjectStore.getState()

      expect(blackhole.visualPreset).toBe('cosmic')
      expect(blackhole.manifoldThickness).toBe(BLACK_HOLE_VISUAL_PRESETS.cosmic.manifoldThickness)
    })

    it('should apply ethereal preset', () => {
      const { applyBlackHoleVisualPreset } = useExtendedObjectStore.getState()

      applyBlackHoleVisualPreset('ethereal')
      const { blackhole } = useExtendedObjectStore.getState()

      expect(blackhole.visualPreset).toBe('ethereal')
      expect(blackhole.manifoldThickness).toBe(BLACK_HOLE_VISUAL_PRESETS.ethereal.manifoldThickness)
    })
  })

  describe('photon shell actions', () => {
    it('should set photon shell width with clamping', () => {
      const { setBlackHolePhotonShellWidth } = useExtendedObjectStore.getState()

      setBlackHolePhotonShellWidth(0.1)
      expect(useExtendedObjectStore.getState().blackhole.photonShellWidth).toBe(0.1)

      // Test clamping
      setBlackHolePhotonShellWidth(-0.1)
      expect(useExtendedObjectStore.getState().blackhole.photonShellWidth).toBe(0)

      setBlackHolePhotonShellWidth(1)
      expect(useExtendedObjectStore.getState().blackhole.photonShellWidth).toBe(0.3)
    })

    it('should set shell glow strength', () => {
      const { setBlackHoleShellGlowStrength } = useExtendedObjectStore.getState()

      setBlackHoleShellGlowStrength(5.0)
      expect(useExtendedObjectStore.getState().blackhole.shellGlowStrength).toBe(5.0)
    })

    it('should set shell glow color', () => {
      const { setBlackHoleShellGlowColor } = useExtendedObjectStore.getState()

      setBlackHoleShellGlowColor('#00ff00')
      expect(useExtendedObjectStore.getState().blackhole.shellGlowColor).toBe('#00ff00')
    })
  })

  describe('edge glow actions', () => {
    it('should toggle edge glow', () => {
      const { setBlackHoleEdgeGlowEnabled } = useExtendedObjectStore.getState()

      setBlackHoleEdgeGlowEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.edgeGlowEnabled).toBe(false)

      setBlackHoleEdgeGlowEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.edgeGlowEnabled).toBe(true)
    })

    it('should set edge glow intensity', () => {
      const { setBlackHoleEdgeGlowIntensity } = useExtendedObjectStore.getState()

      setBlackHoleEdgeGlowIntensity(2.5)
      expect(useExtendedObjectStore.getState().blackhole.edgeGlowIntensity).toBe(2.5)
    })

    it('should set edge glow color', () => {
      const { setBlackHoleEdgeGlowColor } = useExtendedObjectStore.getState()

      setBlackHoleEdgeGlowColor('#0000ff')
      expect(useExtendedObjectStore.getState().blackhole.edgeGlowColor).toBe('#0000ff')
    })
  })

  describe('doppler actions', () => {
    it('should toggle doppler effect', () => {
      const { setBlackHoleDopplerEnabled } = useExtendedObjectStore.getState()

      setBlackHoleDopplerEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.dopplerEnabled).toBe(true)

      setBlackHoleDopplerEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.dopplerEnabled).toBe(false)
    })

    it('should set doppler strength', () => {
      const { setBlackHoleDopplerStrength } = useExtendedObjectStore.getState()

      setBlackHoleDopplerStrength(1.5)
      expect(useExtendedObjectStore.getState().blackhole.dopplerStrength).toBe(1.5)
    })
  })

  describe('jets actions', () => {
    it('should toggle jets', () => {
      const { setBlackHoleJetsEnabled } = useExtendedObjectStore.getState()

      setBlackHoleJetsEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.jetsEnabled).toBe(true)

      setBlackHoleJetsEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.jetsEnabled).toBe(false)
    })

    it('should set jets height', () => {
      const { setBlackHoleJetsHeight } = useExtendedObjectStore.getState()

      setBlackHoleJetsHeight(15)
      expect(useExtendedObjectStore.getState().blackhole.jetsHeight).toBe(15)
    })

    it('should set jets intensity', () => {
      const { setBlackHoleJetsIntensity } = useExtendedObjectStore.getState()

      setBlackHoleJetsIntensity(3.0)
      expect(useExtendedObjectStore.getState().blackhole.jetsIntensity).toBe(3.0)
    })

    it('should set jets color', () => {
      const { setBlackHoleJetsColor } = useExtendedObjectStore.getState()

      setBlackHoleJetsColor('#ff00ff')
      expect(useExtendedObjectStore.getState().blackhole.jetsColor).toBe('#ff00ff')
    })
  })

  describe('animation actions', () => {
    it('should toggle swirl animation', () => {
      const { setBlackHoleSwirlAnimationEnabled } = useExtendedObjectStore.getState()

      setBlackHoleSwirlAnimationEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.swirlAnimationEnabled).toBe(true)

      setBlackHoleSwirlAnimationEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.swirlAnimationEnabled).toBe(false)
    })

    it('should set swirl animation speed', () => {
      const { setBlackHoleSwirlAnimationSpeed } = useExtendedObjectStore.getState()

      setBlackHoleSwirlAnimationSpeed(1.0)
      expect(useExtendedObjectStore.getState().blackhole.swirlAnimationSpeed).toBe(1.0)
    })

    it('should toggle pulse animation', () => {
      const { setBlackHolePulseEnabled } = useExtendedObjectStore.getState()

      setBlackHolePulseEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.pulseEnabled).toBe(true)

      setBlackHolePulseEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.pulseEnabled).toBe(false)
    })

    it('should set pulse speed and amount', () => {
      const { setBlackHolePulseSpeed, setBlackHolePulseAmount } = useExtendedObjectStore.getState()

      setBlackHolePulseSpeed(0.5)
      expect(useExtendedObjectStore.getState().blackhole.pulseSpeed).toBe(0.5)

      setBlackHolePulseAmount(0.3)
      expect(useExtendedObjectStore.getState().blackhole.pulseAmount).toBe(0.3)
    })
  })

  describe('lensing actions', () => {
    it('should set lensing parameters', () => {
      const { setBlackHoleDimensionEmphasis, setBlackHoleDistanceFalloff, setBlackHoleBendScale } =
        useExtendedObjectStore.getState()

      setBlackHoleDimensionEmphasis(0.5)
      expect(useExtendedObjectStore.getState().blackhole.dimensionEmphasis).toBe(0.5)

      setBlackHoleDistanceFalloff(2.0)
      expect(useExtendedObjectStore.getState().blackhole.distanceFalloff).toBe(2.0)

      setBlackHoleBendScale(1.5)
      expect(useExtendedObjectStore.getState().blackhole.bendScale).toBe(1.5)
    })

    it('should set ray bending mode', () => {
      const { setBlackHoleRayBendingMode } = useExtendedObjectStore.getState()

      setBlackHoleRayBendingMode('orbital')
      expect(useExtendedObjectStore.getState().blackhole.rayBendingMode).toBe('orbital')

      setBlackHoleRayBendingMode('spiral')
      expect(useExtendedObjectStore.getState().blackhole.rayBendingMode).toBe('spiral')
    })
  })

  describe('deferred lensing actions', () => {
    it('should toggle deferred lensing', () => {
      const { setBlackHoleDeferredLensingEnabled } = useExtendedObjectStore.getState()

      setBlackHoleDeferredLensingEnabled(true)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingEnabled).toBe(true)

      setBlackHoleDeferredLensingEnabled(false)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingEnabled).toBe(false)
    })

    it('should set deferred lensing strength with clamping', () => {
      const { setBlackHoleDeferredLensingStrength } = useExtendedObjectStore.getState()

      setBlackHoleDeferredLensingStrength(1.5)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingStrength).toBe(1.5)

      // Test clamping - too low (min is 0)
      setBlackHoleDeferredLensingStrength(-0.5)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingStrength).toBe(0)

      // Test clamping - too high (max is 2)
      setBlackHoleDeferredLensingStrength(5)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingStrength).toBe(2)
    })

    it('should set deferred lensing chromatic aberration with clamping', () => {
      const { setBlackHoleDeferredLensingChromaticAberration } = useExtendedObjectStore.getState()

      setBlackHoleDeferredLensingChromaticAberration(0.5)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingChromaticAberration).toBe(
        0.5
      )

      // Test clamping - too low (min is 0)
      setBlackHoleDeferredLensingChromaticAberration(-0.2)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingChromaticAberration).toBe(0)

      // Test clamping - too high (max is 1)
      setBlackHoleDeferredLensingChromaticAberration(1.5)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingChromaticAberration).toBe(1)
    })

    it('should set deferred lensing radius with clamping', () => {
      const { setBlackHoleDeferredLensingRadius } = useExtendedObjectStore.getState()

      setBlackHoleDeferredLensingRadius(5.0)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingRadius).toBe(5.0)

      // Test clamping - too low (min is 0)
      setBlackHoleDeferredLensingRadius(-1)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingRadius).toBe(0)

      // Test clamping - too high (max is 10)
      setBlackHoleDeferredLensingRadius(15)
      expect(useExtendedObjectStore.getState().blackhole.deferredLensingRadius).toBe(10)
    })
  })

  describe('manifold actions', () => {
    it('should set manifold type', () => {
      const { setBlackHoleManifoldType } = useExtendedObjectStore.getState()

      setBlackHoleManifoldType('disk')
      expect(useExtendedObjectStore.getState().blackhole.manifoldType).toBe('disk')

      setBlackHoleManifoldType('sheet')
      expect(useExtendedObjectStore.getState().blackhole.manifoldType).toBe('sheet')

      setBlackHoleManifoldType('autoByN')
      expect(useExtendedObjectStore.getState().blackhole.manifoldType).toBe('autoByN')
    })

    it('should set swirl amount', () => {
      const { setBlackHoleSwirlAmount } = useExtendedObjectStore.getState()

      setBlackHoleSwirlAmount(1.0)
      expect(useExtendedObjectStore.getState().blackhole.swirlAmount).toBe(1.0)
    })
  })

  describe('cross-section parameters', () => {
    it('should set parameter values', () => {
      const { setBlackHoleParameterValue } = useExtendedObjectStore.getState()

      setBlackHoleParameterValue(0, 1.5)
      expect(useExtendedObjectStore.getState().blackhole.parameterValues[0]).toBe(1.5)

      setBlackHoleParameterValue(1, -0.5)
      expect(useExtendedObjectStore.getState().blackhole.parameterValues[1]).toBe(-0.5)
    })

    it('should reset parameters', () => {
      const { setBlackHoleParameterValue, resetBlackHoleParameters } =
        useExtendedObjectStore.getState()

      // Set some values
      setBlackHoleParameterValue(0, 1.5)
      setBlackHoleParameterValue(1, -0.5)

      // Reset
      resetBlackHoleParameters()

      // All should be 0
      const { parameterValues } = useExtendedObjectStore.getState().blackhole
      expect(parameterValues[0]).toBe(0)
      expect(parameterValues[1]).toBe(0)
    })
  })

  describe('config operations', () => {
    it('should get black hole config', () => {
      const { getBlackHoleConfig } = useExtendedObjectStore.getState()

      const config = getBlackHoleConfig()
      expect(config).toBeDefined()
      expect(config.horizonRadius).toBe(DEFAULT_BLACK_HOLE_CONFIG.horizonRadius)
    })

    it('should set partial config', () => {
      const { setBlackHoleConfig } = useExtendedObjectStore.getState()

      setBlackHoleConfig({
        horizonRadius: 2.0,
        gravityStrength: 1.5,
      })

      const { blackhole } = useExtendedObjectStore.getState()
      expect(blackhole.horizonRadius).toBe(2.0)
      expect(blackhole.gravityStrength).toBe(1.5)
      // Other values should remain unchanged
      expect(blackhole.manifoldIntensity).toBe(DEFAULT_BLACK_HOLE_CONFIG.manifoldIntensity)
    })

    it('should initialize for dimension', () => {
      const { initializeBlackHoleForDimension } = useExtendedObjectStore.getState()

      // Initialize for 5D
      initializeBlackHoleForDimension(5)

      // Should have 2 parameter values for 5D (5 - 3 = 2)
      const { parameterValues } = useExtendedObjectStore.getState().blackhole
      expect(parameterValues.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('lighting actions', () => {
    it('should set lighting mode', () => {
      const { setBlackHoleLightingMode } = useExtendedObjectStore.getState()

      setBlackHoleLightingMode('fakeLit')
      expect(useExtendedObjectStore.getState().blackhole.lightingMode).toBe('fakeLit')

      setBlackHoleLightingMode('emissiveOnly')
      expect(useExtendedObjectStore.getState().blackhole.lightingMode).toBe('emissiveOnly')
    })

    it('should set roughness and specular', () => {
      const { setBlackHoleRoughness, setBlackHoleSpecular } = useExtendedObjectStore.getState()

      setBlackHoleRoughness(0.8)
      expect(useExtendedObjectStore.getState().blackhole.roughness).toBe(0.8)

      setBlackHoleSpecular(0.3)
      expect(useExtendedObjectStore.getState().blackhole.specular).toBe(0.3)
    })
  })
})
