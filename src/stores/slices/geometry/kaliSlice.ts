/**
 * Kali Store Slice
 *
 * State management for Kali fractal parameters.
 * Follows the pattern established by quaternionJuliaSlice.
 *
 * Mathematical basis: z = abs(z) / dot(z,z) + c
 * The reciprocal step creates intense nonlinear folding that produces
 * fluid, cellular, and "alive" structures.
 *
 * @see docs/prd/kali-reciprocal-fractal.md
 */

import {
  DEFAULT_KALI_CONFIG,
  KALI_QUALITY_PRESETS,
  type KaliConfig,
} from '@/lib/geometry/extended/types'
import type { StateCreator } from 'zustand'
import type { ExtendedObjectSlice } from './types'

// ============================================================================
// Slice State & Actions Types
// ============================================================================

export interface KaliSliceState {
  kali: KaliConfig
}

export interface KaliSliceActions {
  // Core parameters
  setKaliConstant: (value: number[]) => void
  setKaliConstantComponent: (index: number, value: number) => void
  setKaliReciprocalGain: (value: number) => void
  setKaliAxisWeights: (value: number[]) => void
  setKaliAxisWeight: (index: number, value: number) => void

  // Iteration parameters
  setKaliMaxIterations: (value: number) => void
  setKaliBailoutRadius: (value: number) => void
  setKaliEpsilon: (value: number) => void

  // Quality parameters
  setKaliScale: (value: number) => void
  setKaliSurfaceThreshold: (value: number) => void
  setKaliMaxRaymarchSteps: (value: number) => void
  setKaliQualityMultiplier: (value: number) => void
  setKaliQualityPreset: (preset: 'draft' | 'standard' | 'high' | 'ultra') => void

  // D-dimensional parameters
  setKaliParameterValue: (index: number, value: number) => void
  setKaliParameterValues: (values: number[]) => void
  resetKaliParameters: () => void
  initializeKaliForDimension: (dimension: number) => void

  // Constant animation parameters
  setKaliConstantAnimationEnabled: (value: boolean) => void
  setKaliConstantAnimationAmplitude: (value: number) => void
  setKaliConstantAnimationFrequency: (value: number) => void
  setKaliConstantAnimationPhaseOffset: (value: number) => void

  // Gain animation parameters
  setKaliGainAnimationEnabled: (value: boolean) => void
  setKaliGainAnimationMinGain: (value: number) => void
  setKaliGainAnimationMaxGain: (value: number) => void
  setKaliGainAnimationSpeed: (value: number) => void

  // Weights animation parameters
  setKaliWeightsAnimationEnabled: (value: boolean) => void
  setKaliWeightsAnimationAmplitude: (value: number) => void

  // Origin drift parameters
  setKaliOriginDriftEnabled: (value: boolean) => void
  setKaliOriginDriftAmplitude: (value: number) => void
  setKaliOriginDriftBaseFrequency: (value: number) => void
  setKaliOriginDriftFrequencySpread: (value: number) => void

  // Dimension mixing parameters
  setKaliDimensionMixEnabled: (value: boolean) => void
  setKaliMixIntensity: (value: number) => void
  setKaliMixFrequency: (value: number) => void

  // Utility
  getKaliConfig: () => KaliConfig
  randomizeKaliConstant: () => void
}

export type KaliSlice = KaliSliceState & KaliSliceActions

// ============================================================================
// Slice Implementation
// ============================================================================

export const createKaliSlice: StateCreator<
  ExtendedObjectSlice,
  [],
  [],
  KaliSlice
> = (set, get) => ({
  kali: { ...DEFAULT_KALI_CONFIG },

  // === Core Parameters ===

  setKaliConstant: (value) => {
    // Clamp each component to [-1, 1]
    const clamped = value.map((v) => Math.max(-1, Math.min(1, v)))
    set((state) => ({
      kali: { ...state.kali, kaliConstant: clamped },
    }))
  },

  setKaliConstantComponent: (index, value) => {
    set((state) => {
      const newConstant = [...state.kali.kaliConstant]
      if (index >= 0 && index < newConstant.length) {
        newConstant[index] = Math.max(-1, Math.min(1, value))
      }
      return {
        kali: { ...state.kali, kaliConstant: newConstant },
      }
    })
  },

  setKaliReciprocalGain: (value) => {
    const clamped = Math.max(0.5, Math.min(2.0, value))
    set((state) => ({
      kali: { ...state.kali, reciprocalGain: clamped },
    }))
  },

  setKaliAxisWeights: (value) => {
    // Clamp each weight to [0.5, 2.0]
    const clamped = value.map((v) => Math.max(0.5, Math.min(2.0, v)))
    set((state) => ({
      kali: { ...state.kali, axisWeights: clamped },
    }))
  },

  setKaliAxisWeight: (index, value) => {
    set((state) => {
      const newWeights = [...state.kali.axisWeights]
      if (index >= 0 && index < newWeights.length) {
        newWeights[index] = Math.max(0.5, Math.min(2.0, value))
      }
      return {
        kali: { ...state.kali, axisWeights: newWeights },
      }
    })
  },

  // === Iteration Parameters ===

  setKaliMaxIterations: (value) => {
    const clamped = Math.max(8, Math.min(64, Math.round(value)))
    set((state) => ({
      kali: { ...state.kali, maxIterations: clamped },
    }))
  },

  setKaliBailoutRadius: (value) => {
    const clamped = Math.max(2.0, Math.min(8.0, value))
    set((state) => ({
      kali: { ...state.kali, bailoutRadius: clamped },
    }))
  },

  setKaliEpsilon: (value) => {
    const clamped = Math.max(0.0001, Math.min(0.01, value))
    set((state) => ({
      kali: { ...state.kali, epsilon: clamped },
    }))
  },

  // === Quality Parameters ===

  setKaliScale: (value) => {
    const clamped = Math.max(0.5, Math.min(5.0, value))
    set((state) => ({
      kali: { ...state.kali, scale: clamped },
    }))
  },

  setKaliSurfaceThreshold: (value) => {
    const clamped = Math.max(0.0001, Math.min(0.01, value))
    set((state) => ({
      kali: { ...state.kali, surfaceThreshold: clamped },
    }))
  },

  setKaliMaxRaymarchSteps: (value) => {
    const clamped = Math.max(32, Math.min(1024, Math.round(value)))
    set((state) => ({
      kali: { ...state.kali, maxRaymarchSteps: clamped },
    }))
  },

  setKaliQualityMultiplier: (value) => {
    const clamped = Math.max(0.25, Math.min(1.0, value))
    set((state) => ({
      kali: { ...state.kali, qualityMultiplier: clamped },
    }))
  },

  setKaliQualityPreset: (preset) => {
    const settings = KALI_QUALITY_PRESETS[preset]
    set((state) => ({
      kali: { ...state.kali, ...settings },
    }))
  },

  // === D-dimensional Parameters ===

  setKaliParameterValue: (index, value) => {
    set((state) => {
      const newValues = [...state.kali.parameterValues]
      if (index >= 0 && index < newValues.length) {
        newValues[index] = Math.max(-Math.PI, Math.min(Math.PI, value))
      }
      return {
        kali: { ...state.kali, parameterValues: newValues },
      }
    })
  },

  setKaliParameterValues: (values) => {
    set((state) => ({
      kali: { ...state.kali, parameterValues: values },
    }))
  },

  resetKaliParameters: () => {
    set((state) => ({
      kali: {
        ...state.kali,
        parameterValues: state.kali.parameterValues.map(() => 0),
      },
    }))
  },

  initializeKaliForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)
    // Kali constant and axis weights should match dimension
    const constantLength = Math.max(4, dimension)
    const currentConstant = get().kali.kaliConstant
    const currentWeights = get().kali.axisWeights

    // Pad or truncate constant to match dimension
    const newConstant = Array.from({ length: constantLength }, (_, i) =>
      i < currentConstant.length ? (currentConstant[i] ?? 0.5) : 0.5
    )

    // Pad or truncate weights to match dimension
    const newWeights = Array.from({ length: constantLength }, (_, i) =>
      i < currentWeights.length ? (currentWeights[i] ?? 1.0) : 1.0
    )

    set((state) => ({
      kali: {
        ...state.kali,
        parameterValues: new Array(paramCount).fill(0),
        kaliConstant: newConstant,
        axisWeights: newWeights,
        // Scale 2.0 maps raymarching BOUND_R directly to fractal space
        // Slightly larger for higher dimensions to capture more structure
        scale: dimension <= 4 ? 2.0 : 2.5,
      },
    }))
  },

  // === Constant Animation ===

  setKaliConstantAnimationEnabled: (value) => {
    set((state) => ({
      kali: {
        ...state.kali,
        constantAnimation: {
          ...state.kali.constantAnimation,
          enabled: value,
        },
      },
    }))
  },

  setKaliConstantAnimationAmplitude: (value) => {
    const clamped = Math.max(0.01, Math.min(0.3, value))
    set((state) => ({
      kali: {
        ...state.kali,
        constantAnimation: {
          ...state.kali.constantAnimation,
          amplitude: clamped,
        },
      },
    }))
  },

  setKaliConstantAnimationFrequency: (value) => {
    const clamped = Math.max(0.01, Math.min(0.2, value))
    set((state) => ({
      kali: {
        ...state.kali,
        constantAnimation: {
          ...state.kali.constantAnimation,
          frequency: clamped,
        },
      },
    }))
  },

  setKaliConstantAnimationPhaseOffset: (value) => {
    set((state) => ({
      kali: {
        ...state.kali,
        constantAnimation: {
          ...state.kali.constantAnimation,
          phaseOffset: value,
        },
      },
    }))
  },

  // === Gain Animation ===

  setKaliGainAnimationEnabled: (value) => {
    set((state) => ({
      kali: {
        ...state.kali,
        gainAnimation: {
          ...state.kali.gainAnimation,
          enabled: value,
        },
      },
    }))
  },

  setKaliGainAnimationMinGain: (value) => {
    const clamped = Math.max(0.5, Math.min(1.5, value))
    set((state) => ({
      kali: {
        ...state.kali,
        gainAnimation: {
          ...state.kali.gainAnimation,
          minGain: clamped,
        },
      },
    }))
  },

  setKaliGainAnimationMaxGain: (value) => {
    const clamped = Math.max(0.8, Math.min(2.0, value))
    set((state) => ({
      kali: {
        ...state.kali,
        gainAnimation: {
          ...state.kali.gainAnimation,
          maxGain: clamped,
        },
      },
    }))
  },

  setKaliGainAnimationSpeed: (value) => {
    const clamped = Math.max(0.01, Math.min(0.1, value))
    set((state) => ({
      kali: {
        ...state.kali,
        gainAnimation: {
          ...state.kali.gainAnimation,
          speed: clamped,
        },
      },
    }))
  },

  // === Weights Animation ===

  setKaliWeightsAnimationEnabled: (value) => {
    set((state) => ({
      kali: {
        ...state.kali,
        weightsAnimation: {
          ...state.kali.weightsAnimation,
          enabled: value,
        },
      },
    }))
  },

  setKaliWeightsAnimationAmplitude: (value) => {
    const clamped = Math.max(0.0, Math.min(0.5, value))
    set((state) => ({
      kali: {
        ...state.kali,
        weightsAnimation: {
          ...state.kali.weightsAnimation,
          amplitude: clamped,
        },
      },
    }))
  },

  // === Origin Drift ===

  setKaliOriginDriftEnabled: (value) => {
    set((state) => ({
      kali: { ...state.kali, originDriftEnabled: value },
    }))
  },

  setKaliOriginDriftAmplitude: (value) => {
    const clamped = Math.max(0.01, Math.min(0.5, value))
    set((state) => ({
      kali: { ...state.kali, originDriftAmplitude: clamped },
    }))
  },

  setKaliOriginDriftBaseFrequency: (value) => {
    const clamped = Math.max(0.01, Math.min(0.5, value))
    set((state) => ({
      kali: { ...state.kali, originDriftBaseFrequency: clamped },
    }))
  },

  setKaliOriginDriftFrequencySpread: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      kali: { ...state.kali, originDriftFrequencySpread: clamped },
    }))
  },

  // === Dimension Mixing ===

  setKaliDimensionMixEnabled: (value) => {
    set((state) => ({
      kali: { ...state.kali, dimensionMixEnabled: value },
    }))
  },

  setKaliMixIntensity: (value) => {
    const clamped = Math.max(0.0, Math.min(0.3, value))
    set((state) => ({
      kali: { ...state.kali, mixIntensity: clamped },
    }))
  },

  setKaliMixFrequency: (value) => {
    const clamped = Math.max(0.1, Math.min(2.0, value))
    set((state) => ({
      kali: { ...state.kali, mixFrequency: clamped },
    }))
  },

  // === Utility ===

  getKaliConfig: () => get().kali,

  randomizeKaliConstant: () => {
    const dimension = get().kali.kaliConstant.length
    const newConstant = Array.from({ length: dimension }, () =>
      (Math.random() * 2 - 1) * 0.7
    ) // Range: -0.7 to 0.7
    set((state) => ({
      kali: { ...state.kali, kaliConstant: newConstant },
    }))
  },
})
