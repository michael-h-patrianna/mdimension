/**
 * Quaternion Julia Store Slice
 *
 * State management for Quaternion Julia fractal parameters.
 * Follows the pattern established by mandelbulbSlice.
 *
 * Mathematical basis: z = z^n + c where z and c are quaternions
 * The Julia constant c is fixed (unlike Mandelbulb where c = initial position)
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */

import {
  DEFAULT_QUATERNION_JULIA_CONFIG,
  QUATERNION_JULIA_QUALITY_PRESETS,
  type QuaternionJuliaConfig,
} from '@/lib/geometry/extended/types'
import type { StateCreator } from 'zustand'
import type { ExtendedObjectSlice } from './types'

// ============================================================================
// Slice State & Actions Types
// ============================================================================

export interface QuaternionJuliaSliceState {
  quaternionJulia: QuaternionJuliaConfig
}

export interface QuaternionJuliaSliceActions {
  // Core parameters
  setQuaternionJuliaConstant: (value: [number, number, number, number]) => void
  setQuaternionJuliaPower: (value: number) => void
  setQuaternionJuliaMaxIterations: (value: number) => void
  setQuaternionJuliaBailoutRadius: (value: number) => void
  setQuaternionJuliaScale: (value: number) => void

  // Quality parameters
  setQuaternionJuliaSurfaceThreshold: (value: number) => void
  setQuaternionJuliaMaxRaymarchSteps: (value: number) => void
  setQuaternionJuliaQualityMultiplier: (value: number) => void
  setQuaternionJuliaQualityPreset: (preset: 'draft' | 'standard' | 'high' | 'ultra') => void

  // D-dimensional parameters
  setQuaternionJuliaParameterValue: (index: number, value: number) => void
  setQuaternionJuliaParameterValues: (values: number[]) => void
  resetQuaternionJuliaParameters: () => void
  initializeQuaternionJuliaForDimension: (dimension: number) => void

  // Color parameters
  setQuaternionJuliaColorMode: (value: number) => void
  setQuaternionJuliaBaseColor: (value: string) => void
  setQuaternionJuliaCosineCoefficients: (
    coefficients: QuaternionJuliaConfig['cosineCoefficients']
  ) => void
  setQuaternionJuliaColorPower: (value: number) => void
  setQuaternionJuliaColorCycles: (value: number) => void
  setQuaternionJuliaColorOffset: (value: number) => void
  setQuaternionJuliaLchLightness: (value: number) => void
  setQuaternionJuliaLchChroma: (value: number) => void

  // Opacity parameters
  setQuaternionJuliaOpacityMode: (value: number) => void
  setQuaternionJuliaOpacity: (value: number) => void
  setQuaternionJuliaLayerCount: (value: number) => void
  setQuaternionJuliaLayerOpacity: (value: number) => void
  setQuaternionJuliaVolumetricDensity: (value: number) => void

  // Shadow parameters
  setQuaternionJuliaShadowEnabled: (value: boolean) => void
  setQuaternionJuliaShadowQuality: (value: number) => void
  setQuaternionJuliaShadowSoftness: (value: number) => void
  setQuaternionJuliaShadowAnimationMode: (value: number) => void

  // Julia constant animation parameters
  setQuaternionJuliaConstantAnimationEnabled: (value: boolean) => void
  setQuaternionJuliaConstantAnimationAmplitude: (
    value: [number, number, number, number]
  ) => void
  setQuaternionJuliaConstantAnimationFrequency: (
    value: [number, number, number, number]
  ) => void
  setQuaternionJuliaConstantAnimationPhase: (
    value: [number, number, number, number]
  ) => void

  // Power animation parameters
  setQuaternionJuliaPowerAnimationEnabled: (value: boolean) => void
  setQuaternionJuliaPowerAnimationMinPower: (value: number) => void
  setQuaternionJuliaPowerAnimationMaxPower: (value: number) => void
  setQuaternionJuliaPowerAnimationSpeed: (value: number) => void

  // Origin drift parameters
  setQuaternionJuliaOriginDriftEnabled: (value: boolean) => void
  setQuaternionJuliaOriginDriftAmplitude: (value: number) => void
  setQuaternionJuliaOriginDriftBaseFrequency: (value: number) => void
  setQuaternionJuliaOriginDriftFrequencySpread: (value: number) => void

  // Dimension mixing parameters
  setQuaternionJuliaDimensionMixEnabled: (value: boolean) => void
  setQuaternionJuliaMixIntensity: (value: number) => void
  setQuaternionJuliaMixFrequency: (value: number) => void

  // Utility
  getQuaternionJuliaConfig: () => QuaternionJuliaConfig
  randomizeJuliaConstant: () => void
}

export type QuaternionJuliaSlice = QuaternionJuliaSliceState & QuaternionJuliaSliceActions

// ============================================================================
// Slice Implementation
// ============================================================================

export const createQuaternionJuliaSlice: StateCreator<
  ExtendedObjectSlice,
  [],
  [],
  QuaternionJuliaSlice
> = (set, get) => ({
  quaternionJulia: { ...DEFAULT_QUATERNION_JULIA_CONFIG },

  // === Core Parameters ===

  setQuaternionJuliaConstant: (value) => {
    // Clamp each component to [-2, 2]
    const clamped: [number, number, number, number] = [
      Math.max(-2, Math.min(2, value[0])),
      Math.max(-2, Math.min(2, value[1])),
      Math.max(-2, Math.min(2, value[2])),
      Math.max(-2, Math.min(2, value[3])),
    ]
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, juliaConstant: clamped },
    }))
  },

  setQuaternionJuliaPower: (value) => {
    const clamped = Math.max(2, Math.min(8, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, power: clamped },
    }))
  },

  setQuaternionJuliaMaxIterations: (value) => {
    const clamped = Math.max(8, Math.min(512, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, maxIterations: clamped },
    }))
  },

  setQuaternionJuliaBailoutRadius: (value) => {
    const clamped = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, bailoutRadius: clamped },
    }))
  },

  setQuaternionJuliaScale: (value) => {
    const clamped = Math.max(0.5, Math.min(5.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, scale: clamped },
    }))
  },

  // === Quality Parameters ===

  setQuaternionJuliaSurfaceThreshold: (value) => {
    const clamped = Math.max(0.0001, Math.min(0.01, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, surfaceThreshold: clamped },
    }))
  },

  setQuaternionJuliaMaxRaymarchSteps: (value) => {
    const clamped = Math.max(32, Math.min(1024, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, maxRaymarchSteps: clamped },
    }))
  },

  setQuaternionJuliaQualityMultiplier: (value) => {
    const clamped = Math.max(0.25, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, qualityMultiplier: clamped },
    }))
  },

  setQuaternionJuliaQualityPreset: (preset) => {
    const settings = QUATERNION_JULIA_QUALITY_PRESETS[preset]
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, ...settings },
    }))
  },

  // === D-dimensional Parameters ===

  setQuaternionJuliaParameterValue: (index, value) => {
    set((state) => {
      const newValues = [...state.quaternionJulia.parameterValues]
      if (index >= 0 && index < newValues.length) {
        newValues[index] = Math.max(-Math.PI, Math.min(Math.PI, value))
      }
      return {
        quaternionJulia: { ...state.quaternionJulia, parameterValues: newValues },
      }
    })
  },

  setQuaternionJuliaParameterValues: (values) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, parameterValues: values },
    }))
  },

  resetQuaternionJuliaParameters: () => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        parameterValues: state.quaternionJulia.parameterValues.map(() => 0),
      },
    }))
  },

  initializeQuaternionJuliaForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        parameterValues: new Array(paramCount).fill(0),
        // Scale 1.0 maps raymarching BOUND_R directly to fractal space
        // Slightly larger for higher dimensions to capture more structure
        scale: dimension <= 4 ? 1.0 : 1.25,
      },
    }))
  },

  // === Color Parameters ===

  setQuaternionJuliaColorMode: (value) => {
    const clamped = Math.max(0, Math.min(7, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorMode: clamped },
    }))
  },

  setQuaternionJuliaBaseColor: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, baseColor: value },
    }))
  },

  setQuaternionJuliaCosineCoefficients: (coefficients) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, cosineCoefficients: coefficients },
    }))
  },

  setQuaternionJuliaColorPower: (value) => {
    const clamped = Math.max(0.25, Math.min(4.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorPower: clamped },
    }))
  },

  setQuaternionJuliaColorCycles: (value) => {
    const clamped = Math.max(0.5, Math.min(5.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorCycles: clamped },
    }))
  },

  setQuaternionJuliaColorOffset: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorOffset: clamped },
    }))
  },

  setQuaternionJuliaLchLightness: (value) => {
    const clamped = Math.max(0.1, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, lchLightness: clamped },
    }))
  },

  setQuaternionJuliaLchChroma: (value) => {
    const clamped = Math.max(0.0, Math.min(0.4, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, lchChroma: clamped },
    }))
  },

  // === Opacity Parameters ===

  setQuaternionJuliaOpacityMode: (value) => {
    const clamped = Math.max(0, Math.min(3, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, opacityMode: clamped },
    }))
  },

  setQuaternionJuliaOpacity: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, opacity: clamped },
    }))
  },

  setQuaternionJuliaLayerCount: (value) => {
    const clamped = Math.max(2, Math.min(4, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, layerCount: clamped },
    }))
  },

  setQuaternionJuliaLayerOpacity: (value) => {
    const clamped = Math.max(0.1, Math.min(0.9, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, layerOpacity: clamped },
    }))
  },

  setQuaternionJuliaVolumetricDensity: (value) => {
    const clamped = Math.max(0.1, Math.min(2.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, volumetricDensity: clamped },
    }))
  },

  // === Shadow Parameters ===

  setQuaternionJuliaShadowEnabled: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowEnabled: value },
    }))
  },

  setQuaternionJuliaShadowQuality: (value) => {
    const clamped = Math.max(0, Math.min(3, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowQuality: clamped },
    }))
  },

  setQuaternionJuliaShadowSoftness: (value) => {
    const clamped = Math.max(0.0, Math.min(2.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowSoftness: clamped },
    }))
  },

  setQuaternionJuliaShadowAnimationMode: (value) => {
    const clamped = Math.max(0, Math.min(2, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowAnimationMode: clamped },
    }))
  },

  // === Julia Constant Animation ===

  setQuaternionJuliaConstantAnimationEnabled: (value) => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        juliaConstantAnimation: {
          ...state.quaternionJulia.juliaConstantAnimation,
          enabled: value,
        },
      },
    }))
  },

  setQuaternionJuliaConstantAnimationAmplitude: (value) => {
    const clamped: [number, number, number, number] = [
      Math.max(0, Math.min(1, value[0])),
      Math.max(0, Math.min(1, value[1])),
      Math.max(0, Math.min(1, value[2])),
      Math.max(0, Math.min(1, value[3])),
    ]
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        juliaConstantAnimation: {
          ...state.quaternionJulia.juliaConstantAnimation,
          amplitude: clamped,
        },
      },
    }))
  },

  setQuaternionJuliaConstantAnimationFrequency: (value) => {
    const clamped: [number, number, number, number] = [
      Math.max(0.01, Math.min(0.5, value[0])),
      Math.max(0.01, Math.min(0.5, value[1])),
      Math.max(0.01, Math.min(0.5, value[2])),
      Math.max(0.01, Math.min(0.5, value[3])),
    ]
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        juliaConstantAnimation: {
          ...state.quaternionJulia.juliaConstantAnimation,
          frequency: clamped,
        },
      },
    }))
  },

  setQuaternionJuliaConstantAnimationPhase: (value) => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        juliaConstantAnimation: {
          ...state.quaternionJulia.juliaConstantAnimation,
          phase: value,
        },
      },
    }))
  },

  // === Power Animation ===

  setQuaternionJuliaPowerAnimationEnabled: (value) => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        powerAnimation: {
          ...state.quaternionJulia.powerAnimation,
          enabled: value,
        },
      },
    }))
  },

  setQuaternionJuliaPowerAnimationMinPower: (value) => {
    const clamped = Math.max(2.0, Math.min(10.0, value))
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        powerAnimation: {
          ...state.quaternionJulia.powerAnimation,
          minPower: clamped,
        },
      },
    }))
  },

  setQuaternionJuliaPowerAnimationMaxPower: (value) => {
    const clamped = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        powerAnimation: {
          ...state.quaternionJulia.powerAnimation,
          maxPower: clamped,
        },
      },
    }))
  },

  setQuaternionJuliaPowerAnimationSpeed: (value) => {
    const clamped = Math.max(0.01, Math.min(0.2, value))
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        powerAnimation: {
          ...state.quaternionJulia.powerAnimation,
          speed: clamped,
        },
      },
    }))
  },

  // === Origin Drift ===

  setQuaternionJuliaOriginDriftEnabled: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, originDriftEnabled: value },
    }))
  },

  setQuaternionJuliaOriginDriftAmplitude: (value) => {
    const clamped = Math.max(0.01, Math.min(0.5, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, originDriftAmplitude: clamped },
    }))
  },

  setQuaternionJuliaOriginDriftBaseFrequency: (value) => {
    const clamped = Math.max(0.01, Math.min(0.5, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, originDriftBaseFrequency: clamped },
    }))
  },

  setQuaternionJuliaOriginDriftFrequencySpread: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, originDriftFrequencySpread: clamped },
    }))
  },

  // === Dimension Mixing ===

  setQuaternionJuliaDimensionMixEnabled: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, dimensionMixEnabled: value },
    }))
  },

  setQuaternionJuliaMixIntensity: (value) => {
    const clamped = Math.max(0.0, Math.min(0.3, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, mixIntensity: clamped },
    }))
  },

  setQuaternionJuliaMixFrequency: (value) => {
    const clamped = Math.max(0.1, Math.min(2.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, mixFrequency: clamped },
    }))
  },

  // === Utility ===

  getQuaternionJuliaConfig: () => get().quaternionJulia,

  randomizeJuliaConstant: () => {
    const randomComponent = () => (Math.random() * 2 - 1) * 0.8 // Range: -0.8 to 0.8
    const newConstant: [number, number, number, number] = [
      randomComponent(),
      randomComponent(),
      randomComponent(),
      randomComponent(),
    ]
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, juliaConstant: newConstant },
    }))
  },
})
