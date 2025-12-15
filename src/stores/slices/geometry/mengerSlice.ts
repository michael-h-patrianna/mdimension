import { DEFAULT_MENGER_CONFIG } from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, MengerSlice } from './types'

export const createMengerSlice: StateCreator<ExtendedObjectSlice, [], [], MengerSlice> = (set, get) => ({
  menger: { ...DEFAULT_MENGER_CONFIG },

  setMengerIterations: (iterations) => {
    // Range 3 to 8 (higher values are very expensive)
    const clampedIterations = Math.max(3, Math.min(8, Math.floor(iterations)))
    set((state) => ({
      menger: { ...state.menger, iterations: clampedIterations },
    }))
  },

  setMengerScale: (scale) => {
    // Range 0.5 to 2.0
    const clampedScale = Math.max(0.5, Math.min(2.0, scale))
    set((state) => ({
      menger: { ...state.menger, scale: clampedScale },
    }))
  },

  setMengerParameterValue: (dimIndex, value) => {
    const values = [...get().menger.parameterValues]
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setMengerParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
    // Clamp to reasonable range (Menger is bounded in unit cube)
    const clampedValue = Math.max(-2.0, Math.min(2.0, value))
    values[dimIndex] = clampedValue
    set((state) => ({
      menger: { ...state.menger, parameterValues: values },
    }))
  },

  setMengerParameterValues: (values) => {
    const clampedValues = values.map((v) => Math.max(-2.0, Math.min(2.0, v)))
    set((state) => ({
      menger: { ...state.menger, parameterValues: clampedValues },
    }))
  },

  resetMengerParameters: () => {
    const len = get().menger.parameterValues.length
    set((state) => ({
      menger: { ...state.menger, parameterValues: new Array(len).fill(0) },
    }))
  },

  initializeMengerForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Dimension-specific iteration defaults:
    // Higher dimensions = sparser structure, can use fewer iterations
    // But also more computationally expensive per iteration
    let iterations: number
    if (dimension >= 9) {
      iterations = 4 // 9D-11D: conservative for performance
    } else if (dimension >= 7) {
      iterations = 4 // 7D-8D: moderate
    } else if (dimension >= 5) {
      iterations = 5 // 5D-6D: standard
    } else {
      iterations = 5 // 3D-4D: good detail
    }

    set((state) => ({
      menger: {
        ...state.menger,
        parameterValues: new Array(paramCount).fill(0),
        iterations,
      },
    }))
  },

  getMengerConfig: () => {
    return { ...get().menger }
  },

  // --- Fold Twist Animation Actions ---
  setMengerFoldTwistEnabled: (enabled) => {
    set((state) => ({
      menger: { ...state.menger, foldTwistEnabled: enabled },
    }))
  },

  setMengerFoldTwistAngle: (angle) => {
    // Range -π to π
    const clampedAngle = Math.max(-Math.PI, Math.min(Math.PI, angle))
    set((state) => ({
      menger: { ...state.menger, foldTwistAngle: clampedAngle },
    }))
  },

  setMengerFoldTwistSpeed: (speed) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, foldTwistSpeed: clampedSpeed },
    }))
  },

  // --- Scale Pulse Animation Actions ---
  setMengerScalePulseEnabled: (enabled) => {
    set((state) => ({
      menger: { ...state.menger, scalePulseEnabled: enabled },
    }))
  },

  setMengerScalePulseAmplitude: (amplitude) => {
    // Range 0 to 0.5
    const clampedAmplitude = Math.max(0, Math.min(0.5, amplitude))
    set((state) => ({
      menger: { ...state.menger, scalePulseAmplitude: clampedAmplitude },
    }))
  },

  setMengerScalePulseSpeed: (speed) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, scalePulseSpeed: clampedSpeed },
    }))
  },

  // --- Slice Sweep Animation Actions ---
  setMengerSliceSweepEnabled: (enabled) => {
    set((state) => ({
      menger: { ...state.menger, sliceSweepEnabled: enabled },
    }))
  },

  setMengerSliceSweepAmplitude: (amplitude) => {
    // Range 0 to 2
    const clampedAmplitude = Math.max(0, Math.min(2, amplitude))
    set((state) => ({
      menger: { ...state.menger, sliceSweepAmplitude: clampedAmplitude },
    }))
  },

  setMengerSliceSweepSpeed: (speed) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, sliceSweepSpeed: clampedSpeed },
    }))
  },

  // --- Dimension Mixing Actions (Technique A) ---
  setMengerDimensionMixEnabled: (enabled) => {
    set((state) => ({
      menger: { ...state.menger, dimensionMixEnabled: enabled },
    }))
  },

  setMengerMixIntensity: (intensity) => {
    // Range 0.0 to 0.3
    const clampedIntensity = Math.max(0.0, Math.min(0.3, intensity))
    set((state) => ({
      menger: { ...state.menger, mixIntensity: clampedIntensity },
    }))
  },

  setMengerMixFrequency: (frequency) => {
    // Range 0.1 to 2.0
    const clampedFrequency = Math.max(0.1, Math.min(2.0, frequency))
    set((state) => ({
      menger: { ...state.menger, mixFrequency: clampedFrequency },
    }))
  },

  // --- Origin Drift Actions (Technique C) ---
  setMengerOriginDriftEnabled: (enabled) => {
    set((state) => ({
      menger: { ...state.menger, originDriftEnabled: enabled },
    }))
  },

  setMengerDriftAmplitude: (amplitude) => {
    // Range 0.01 to 0.5
    const clampedAmplitude = Math.max(0.01, Math.min(0.5, amplitude))
    set((state) => ({
      menger: { ...state.menger, driftAmplitude: clampedAmplitude },
    }))
  },

  setMengerDriftBaseFrequency: (frequency) => {
    // Range 0.01 to 0.5 (allow very slow animations to avoid jitter)
    const clampedFrequency = Math.max(0.01, Math.min(0.5, frequency))
    set((state) => ({
      menger: { ...state.menger, driftBaseFrequency: clampedFrequency },
    }))
  },

  setMengerDriftFrequencySpread: (spread) => {
    // Range 0.0 to 1.0
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      menger: { ...state.menger, driftFrequencySpread: clampedSpread },
    }))
  },
})
