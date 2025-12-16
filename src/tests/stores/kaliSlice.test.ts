/**
 * Tests for kaliSlice
 *
 * Verifies state management for Kali fractal parameters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { DEFAULT_KALI_CONFIG, KALI_QUALITY_PRESETS } from '@/lib/geometry/extended/types';

describe('kaliSlice', () => {
  beforeEach(() => {
    useExtendedObjectStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have default kali config', () => {
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant).toEqual(DEFAULT_KALI_CONFIG.kaliConstant);
      expect(kali.reciprocalGain).toBe(DEFAULT_KALI_CONFIG.reciprocalGain);
      expect(kali.axisWeights).toEqual(DEFAULT_KALI_CONFIG.axisWeights);
      expect(kali.maxIterations).toBe(DEFAULT_KALI_CONFIG.maxIterations);
      expect(kali.bailoutRadius).toBe(DEFAULT_KALI_CONFIG.bailoutRadius);
      expect(kali.epsilon).toBe(DEFAULT_KALI_CONFIG.epsilon);
    });

    it('should have animation disabled by default', () => {
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.constantAnimation.enabled).toBe(false);
      expect(kali.gainAnimation.enabled).toBe(false);
      expect(kali.weightsAnimation.enabled).toBe(false);
      expect(kali.originDriftEnabled).toBe(false);
      expect(kali.dimensionMixEnabled).toBe(false);
    });
  });

  describe('setKaliConstant', () => {
    it('should update the kali constant', () => {
      useExtendedObjectStore.getState().setKaliConstant([0.5, 0.3, 0.2, 0.1]);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant).toEqual([0.5, 0.3, 0.2, 0.1]);
    });

    it('should clamp values to [-1, 1]', () => {
      useExtendedObjectStore.getState().setKaliConstant([2.0, -3.0, 0.5, 0.0]);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant[0]).toBe(1.0);
      expect(kali.kaliConstant[1]).toBe(-1.0);
      expect(kali.kaliConstant[2]).toBe(0.5);
      expect(kali.kaliConstant[3]).toBe(0.0);
    });
  });

  describe('setKaliConstantComponent', () => {
    it('should update a single component', () => {
      useExtendedObjectStore.getState().setKaliConstantComponent(0, 0.75);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant[0]).toBe(0.75);
    });

    it('should clamp component to [-1, 1]', () => {
      useExtendedObjectStore.getState().setKaliConstantComponent(1, 5.0);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant[1]).toBe(1.0);
    });

    it('should ignore invalid indices', () => {
      const originalConstant = [...useExtendedObjectStore.getState().kali.kaliConstant];
      useExtendedObjectStore.getState().setKaliConstantComponent(100, 0.5);
      expect(useExtendedObjectStore.getState().kali.kaliConstant).toEqual(originalConstant);
    });
  });

  describe('setKaliReciprocalGain', () => {
    it('should update reciprocal gain', () => {
      useExtendedObjectStore.getState().setKaliReciprocalGain(1.5);
      expect(useExtendedObjectStore.getState().kali.reciprocalGain).toBe(1.5);
    });

    it('should clamp to [0.5, 2.0]', () => {
      useExtendedObjectStore.getState().setKaliReciprocalGain(0.0);
      expect(useExtendedObjectStore.getState().kali.reciprocalGain).toBe(0.5);

      useExtendedObjectStore.getState().setKaliReciprocalGain(5.0);
      expect(useExtendedObjectStore.getState().kali.reciprocalGain).toBe(2.0);
    });
  });

  describe('setKaliAxisWeights', () => {
    it('should update axis weights', () => {
      useExtendedObjectStore.getState().setKaliAxisWeights([0.8, 1.2, 1.5]);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.axisWeights).toEqual([0.8, 1.2, 1.5]);
    });

    it('should clamp weights to [0.5, 2.0]', () => {
      useExtendedObjectStore.getState().setKaliAxisWeights([0.0, 3.0, 1.0]);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.axisWeights[0]).toBe(0.5);
      expect(kali.axisWeights[1]).toBe(2.0);
      expect(kali.axisWeights[2]).toBe(1.0);
    });
  });

  describe('setKaliAxisWeight', () => {
    it('should update a single axis weight', () => {
      useExtendedObjectStore.getState().setKaliAxisWeight(0, 1.5);
      expect(useExtendedObjectStore.getState().kali.axisWeights[0]).toBe(1.5);
    });

    it('should clamp weight to [0.5, 2.0]', () => {
      useExtendedObjectStore.getState().setKaliAxisWeight(1, 10.0);
      expect(useExtendedObjectStore.getState().kali.axisWeights[1]).toBe(2.0);
    });
  });

  describe('setKaliMaxIterations', () => {
    it('should update max iterations', () => {
      useExtendedObjectStore.getState().setKaliMaxIterations(48);
      expect(useExtendedObjectStore.getState().kali.maxIterations).toBe(48);
    });

    it('should clamp to [8, 64]', () => {
      useExtendedObjectStore.getState().setKaliMaxIterations(1);
      expect(useExtendedObjectStore.getState().kali.maxIterations).toBe(8);

      useExtendedObjectStore.getState().setKaliMaxIterations(200);
      expect(useExtendedObjectStore.getState().kali.maxIterations).toBe(64);
    });

    it('should round to integer', () => {
      useExtendedObjectStore.getState().setKaliMaxIterations(32.7);
      expect(useExtendedObjectStore.getState().kali.maxIterations).toBe(33);
    });
  });

  describe('setKaliBailoutRadius', () => {
    it('should update bailout radius', () => {
      useExtendedObjectStore.getState().setKaliBailoutRadius(6.0);
      expect(useExtendedObjectStore.getState().kali.bailoutRadius).toBe(6.0);
    });

    it('should clamp to [2.0, 8.0]', () => {
      useExtendedObjectStore.getState().setKaliBailoutRadius(0.5);
      expect(useExtendedObjectStore.getState().kali.bailoutRadius).toBe(2.0);

      useExtendedObjectStore.getState().setKaliBailoutRadius(20.0);
      expect(useExtendedObjectStore.getState().kali.bailoutRadius).toBe(8.0);
    });
  });

  describe('setKaliEpsilon', () => {
    it('should update epsilon', () => {
      useExtendedObjectStore.getState().setKaliEpsilon(0.005);
      expect(useExtendedObjectStore.getState().kali.epsilon).toBe(0.005);
    });

    it('should clamp to [0.0001, 0.01]', () => {
      useExtendedObjectStore.getState().setKaliEpsilon(0.00001);
      expect(useExtendedObjectStore.getState().kali.epsilon).toBe(0.0001);

      useExtendedObjectStore.getState().setKaliEpsilon(0.1);
      expect(useExtendedObjectStore.getState().kali.epsilon).toBe(0.01);
    });
  });

  describe('setKaliScale', () => {
    it('should update scale', () => {
      useExtendedObjectStore.getState().setKaliScale(3.0);
      expect(useExtendedObjectStore.getState().kali.scale).toBe(3.0);
    });

    it('should clamp to [0.5, 5.0]', () => {
      useExtendedObjectStore.getState().setKaliScale(0.1);
      expect(useExtendedObjectStore.getState().kali.scale).toBe(0.5);

      useExtendedObjectStore.getState().setKaliScale(10.0);
      expect(useExtendedObjectStore.getState().kali.scale).toBe(5.0);
    });
  });

  describe('setKaliQualityPreset', () => {
    it('should apply draft preset', () => {
      useExtendedObjectStore.getState().setKaliQualityPreset('draft');
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.maxIterations).toBe(KALI_QUALITY_PRESETS.draft.maxIterations);
      expect(kali.maxRaymarchSteps).toBe(KALI_QUALITY_PRESETS.draft.maxRaymarchSteps);
    });

    it('should apply ultra preset', () => {
      useExtendedObjectStore.getState().setKaliQualityPreset('ultra');
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.maxIterations).toBe(KALI_QUALITY_PRESETS.ultra.maxIterations);
      expect(kali.maxRaymarchSteps).toBe(KALI_QUALITY_PRESETS.ultra.maxRaymarchSteps);
    });
  });

  describe('setKaliParameterValue', () => {
    it('should update a parameter value', () => {
      // First initialize for 5D to have parameter values
      useExtendedObjectStore.getState().initializeKaliForDimension(5);
      useExtendedObjectStore.getState().setKaliParameterValue(0, 1.5);
      expect(useExtendedObjectStore.getState().kali.parameterValues[0]).toBe(1.5);
    });

    it('should clamp to [-PI, PI]', () => {
      useExtendedObjectStore.getState().initializeKaliForDimension(5);
      useExtendedObjectStore.getState().setKaliParameterValue(0, 10.0);
      expect(useExtendedObjectStore.getState().kali.parameterValues[0]).toBe(Math.PI);
    });
  });

  describe('resetKaliParameters', () => {
    it('should reset all parameter values to 0', () => {
      useExtendedObjectStore.getState().initializeKaliForDimension(6);
      useExtendedObjectStore.getState().setKaliParameterValue(0, 1.0);
      useExtendedObjectStore.getState().setKaliParameterValue(1, 2.0);
      useExtendedObjectStore.getState().resetKaliParameters();

      const { kali } = useExtendedObjectStore.getState();
      expect(kali.parameterValues.every((v) => v === 0)).toBe(true);
    });
  });

  describe('initializeKaliForDimension', () => {
    it('should initialize parameter values for dimension', () => {
      useExtendedObjectStore.getState().initializeKaliForDimension(5);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.parameterValues.length).toBe(2); // 5 - 3 = 2
    });

    it('should pad kali constant for higher dimensions', () => {
      useExtendedObjectStore.getState().initializeKaliForDimension(7);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.kaliConstant.length).toBe(7);
    });

    it('should set appropriate scale for dimension', () => {
      useExtendedObjectStore.getState().initializeKaliForDimension(4);
      expect(useExtendedObjectStore.getState().kali.scale).toBe(2.0);

      useExtendedObjectStore.getState().initializeKaliForDimension(6);
      expect(useExtendedObjectStore.getState().kali.scale).toBe(2.5);
    });
  });

  describe('constant animation', () => {
    it('should toggle constant animation enabled', () => {
      useExtendedObjectStore.getState().setKaliConstantAnimationEnabled(true);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.enabled).toBe(true);
    });

    it('should set constant animation amplitude', () => {
      useExtendedObjectStore.getState().setKaliConstantAnimationAmplitude(0.15);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.amplitude).toBe(0.15);
    });

    it('should clamp amplitude to [0.01, 0.3]', () => {
      useExtendedObjectStore.getState().setKaliConstantAnimationAmplitude(0.0);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.amplitude).toBe(0.01);

      useExtendedObjectStore.getState().setKaliConstantAnimationAmplitude(1.0);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.amplitude).toBe(0.3);
    });

    it('should set constant animation frequency', () => {
      useExtendedObjectStore.getState().setKaliConstantAnimationFrequency(0.1);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.frequency).toBe(0.1);
    });

    it('should set constant animation phase offset', () => {
      useExtendedObjectStore.getState().setKaliConstantAnimationPhaseOffset(1.57);
      expect(useExtendedObjectStore.getState().kali.constantAnimation.phaseOffset).toBe(1.57);
    });
  });

  describe('gain animation', () => {
    it('should toggle gain animation enabled', () => {
      useExtendedObjectStore.getState().setKaliGainAnimationEnabled(true);
      expect(useExtendedObjectStore.getState().kali.gainAnimation.enabled).toBe(true);
    });

    it('should set gain animation min/max', () => {
      useExtendedObjectStore.getState().setKaliGainAnimationMinGain(0.8);
      useExtendedObjectStore.getState().setKaliGainAnimationMaxGain(1.5);
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.gainAnimation.minGain).toBe(0.8);
      expect(kali.gainAnimation.maxGain).toBe(1.5);
    });

    it('should clamp minGain to [0.5, 1.5]', () => {
      useExtendedObjectStore.getState().setKaliGainAnimationMinGain(0.0);
      expect(useExtendedObjectStore.getState().kali.gainAnimation.minGain).toBe(0.5);
    });

    it('should clamp maxGain to [0.8, 2.0]', () => {
      useExtendedObjectStore.getState().setKaliGainAnimationMaxGain(5.0);
      expect(useExtendedObjectStore.getState().kali.gainAnimation.maxGain).toBe(2.0);
    });

    it('should set gain animation speed', () => {
      useExtendedObjectStore.getState().setKaliGainAnimationSpeed(0.05);
      expect(useExtendedObjectStore.getState().kali.gainAnimation.speed).toBe(0.05);
    });
  });

  describe('weights animation', () => {
    it('should toggle weights animation enabled', () => {
      useExtendedObjectStore.getState().setKaliWeightsAnimationEnabled(true);
      expect(useExtendedObjectStore.getState().kali.weightsAnimation.enabled).toBe(true);
    });

    it('should set weights animation amplitude', () => {
      useExtendedObjectStore.getState().setKaliWeightsAnimationAmplitude(0.2);
      expect(useExtendedObjectStore.getState().kali.weightsAnimation.amplitude).toBe(0.2);
    });

    it('should clamp amplitude to [0.0, 0.5]', () => {
      useExtendedObjectStore.getState().setKaliWeightsAnimationAmplitude(-0.1);
      expect(useExtendedObjectStore.getState().kali.weightsAnimation.amplitude).toBe(0.0);

      useExtendedObjectStore.getState().setKaliWeightsAnimationAmplitude(1.0);
      expect(useExtendedObjectStore.getState().kali.weightsAnimation.amplitude).toBe(0.5);
    });
  });

  describe('origin drift', () => {
    it('should toggle origin drift enabled', () => {
      useExtendedObjectStore.getState().setKaliOriginDriftEnabled(true);
      expect(useExtendedObjectStore.getState().kali.originDriftEnabled).toBe(true);
    });

    it('should set origin drift amplitude', () => {
      useExtendedObjectStore.getState().setKaliOriginDriftAmplitude(0.1);
      expect(useExtendedObjectStore.getState().kali.originDriftAmplitude).toBe(0.1);
    });

    it('should set origin drift base frequency', () => {
      useExtendedObjectStore.getState().setKaliOriginDriftBaseFrequency(0.08);
      expect(useExtendedObjectStore.getState().kali.originDriftBaseFrequency).toBe(0.08);
    });

    it('should set origin drift frequency spread', () => {
      useExtendedObjectStore.getState().setKaliOriginDriftFrequencySpread(0.3);
      expect(useExtendedObjectStore.getState().kali.originDriftFrequencySpread).toBe(0.3);
    });

    it('should clamp amplitude to [0.01, 0.5]', () => {
      useExtendedObjectStore.getState().setKaliOriginDriftAmplitude(0.0);
      expect(useExtendedObjectStore.getState().kali.originDriftAmplitude).toBe(0.01);

      useExtendedObjectStore.getState().setKaliOriginDriftAmplitude(2.0);
      expect(useExtendedObjectStore.getState().kali.originDriftAmplitude).toBe(0.5);
    });
  });

  describe('dimension mixing', () => {
    it('should toggle dimension mix enabled', () => {
      useExtendedObjectStore.getState().setKaliDimensionMixEnabled(true);
      expect(useExtendedObjectStore.getState().kali.dimensionMixEnabled).toBe(true);
    });

    it('should set mix intensity', () => {
      useExtendedObjectStore.getState().setKaliMixIntensity(0.15);
      expect(useExtendedObjectStore.getState().kali.mixIntensity).toBe(0.15);
    });

    it('should clamp mix intensity to [0.0, 0.3]', () => {
      useExtendedObjectStore.getState().setKaliMixIntensity(-0.1);
      expect(useExtendedObjectStore.getState().kali.mixIntensity).toBe(0.0);

      useExtendedObjectStore.getState().setKaliMixIntensity(1.0);
      expect(useExtendedObjectStore.getState().kali.mixIntensity).toBe(0.3);
    });

    it('should set mix frequency', () => {
      useExtendedObjectStore.getState().setKaliMixFrequency(1.0);
      expect(useExtendedObjectStore.getState().kali.mixFrequency).toBe(1.0);
    });

    it('should clamp mix frequency to [0.1, 2.0]', () => {
      useExtendedObjectStore.getState().setKaliMixFrequency(0.01);
      expect(useExtendedObjectStore.getState().kali.mixFrequency).toBe(0.1);

      useExtendedObjectStore.getState().setKaliMixFrequency(10.0);
      expect(useExtendedObjectStore.getState().kali.mixFrequency).toBe(2.0);
    });
  });

  describe('utility functions', () => {
    it('getKaliConfig should return current config', () => {
      useExtendedObjectStore.getState().setKaliReciprocalGain(1.5);
      const config = useExtendedObjectStore.getState().getKaliConfig();
      expect(config.reciprocalGain).toBe(1.5);
    });

    it('randomizeKaliConstant should generate new random constant', () => {
      const originalConstant = [...useExtendedObjectStore.getState().kali.kaliConstant];
      useExtendedObjectStore.getState().randomizeKaliConstant();
      const newConstant = useExtendedObjectStore.getState().kali.kaliConstant;

      // New constant should be different (statistically very unlikely to be the same)
      const isDifferent = newConstant.some((v, i) => v !== originalConstant[i]);
      expect(isDifferent).toBe(true);

      // All values should be in range [-0.7, 0.7]
      expect(newConstant.every((v) => v >= -0.7 && v <= 0.7)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all kali settings to defaults', () => {
      // Modify various settings
      useExtendedObjectStore.getState().setKaliReciprocalGain(1.8);
      useExtendedObjectStore.getState().setKaliMaxIterations(48);
      useExtendedObjectStore.getState().setKaliConstantAnimationEnabled(true);
      useExtendedObjectStore.getState().setKaliOriginDriftEnabled(true);

      // Reset
      useExtendedObjectStore.getState().reset();

      // Verify defaults
      const { kali } = useExtendedObjectStore.getState();
      expect(kali.reciprocalGain).toBe(DEFAULT_KALI_CONFIG.reciprocalGain);
      expect(kali.maxIterations).toBe(DEFAULT_KALI_CONFIG.maxIterations);
      expect(kali.constantAnimation.enabled).toBe(false);
      expect(kali.originDriftEnabled).toBe(false);
    });
  });
});
