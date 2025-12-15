import { DEFAULT_MANDELBOX_CONFIG } from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, MandelboxSlice } from './types'

export const createMandelboxSlice: StateCreator<ExtendedObjectSlice, [], [], MandelboxSlice> = (set, get) => ({
  mandelbox: { ...DEFAULT_MANDELBOX_CONFIG },

  setMandelboxScale: (scale) => {
    // Range -3.0 to 3.0 for various fractal characters
    const clampedScale = Math.max(-3.0, Math.min(3.0, scale))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scale: clampedScale },
    }))
  },

  setMandelboxFoldingLimit: (limit) => {
    // Range 0.5 to 2.0
    const clampedLimit = Math.max(0.5, Math.min(2.0, limit))
    set((state) => ({
      mandelbox: { ...state.mandelbox, foldingLimit: clampedLimit },
    }))
  },

  setMandelboxMinRadius: (radius) => {
    // Range 0.1 to 1.0
    const clampedRadius = Math.max(0.1, Math.min(1.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, minRadius: clampedRadius },
    }))
  },

  setMandelboxFixedRadius: (radius) => {
    // Range 0.5 to 2.0
    const clampedRadius = Math.max(0.5, Math.min(2.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, fixedRadius: clampedRadius },
    }))
  },

  setMandelboxMaxIterations: (iterations) => {
    // Range 10 to 100
    const clampedIterations = Math.max(10, Math.min(100, Math.floor(iterations)))
    set((state) => ({
      mandelbox: { ...state.mandelbox, maxIterations: clampedIterations },
    }))
  },

  setMandelboxEscapeRadius: (radius) => {
    // Range 4.0 to 100.0
    const clampedRadius = Math.max(4.0, Math.min(100.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, escapeRadius: clampedRadius },
    }))
  },

  setMandelboxIterationRotation: (rotation) => {
    // Range 0.0 to 0.5 radians (0 to ~28.6 degrees per iteration)
    const clampedRotation = Math.max(0.0, Math.min(0.5, rotation))
    set((state) => ({
      mandelbox: { ...state.mandelbox, iterationRotation: clampedRotation },
    }))
  },

  setMandelboxParameterValue: (dimIndex, value) => {
    const values = [...get().mandelbox.parameterValues]
    // Validate dimIndex to prevent sparse arrays or out-of-bounds access
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setMandelboxParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
    // Clamp to reasonable range for Mandelbox exploration
    const clampedValue = Math.max(-4.0, Math.min(4.0, value))
    values[dimIndex] = clampedValue
    set((state) => ({
      mandelbox: { ...state.mandelbox, parameterValues: values },
    }))
  },

  setMandelboxParameterValues: (values) => {
    const clampedValues = values.map((v) => Math.max(-4.0, Math.min(4.0, v)))
    set((state) => ({
      mandelbox: { ...state.mandelbox, parameterValues: clampedValues },
    }))
  },

  resetMandelboxParameters: () => {
    const len = get().mandelbox.parameterValues.length
    set((state) => ({
      mandelbox: { ...state.mandelbox, parameterValues: new Array(len).fill(0) },
    }))
  },

  initializeMandelboxForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Dimension-specific defaults for Mandelbox:
    // Higher dimensions may need larger escape radius for stability
    let escapeRadius: number
    if (dimension >= 9) {
      escapeRadius = 20.0 // 9D-11D: higher bailout for stability
    } else if (dimension >= 7) {
      escapeRadius = 15.0 // 7D-8D: high bailout
    } else {
      escapeRadius = 10.0 // 3D-6D: standard bailout
    }

    // Max iterations: Performance-aware defaults for raymarching
    let maxIterations: number
    if (dimension >= 9) {
      maxIterations = 35 // 9D-11D: very conservative
    } else if (dimension >= 7) {
      maxIterations = 40 // 7D-8D: conservative
    } else {
      maxIterations = 50 // 3D-6D: balanced
    }

    set((state) => ({
      mandelbox: {
        ...state.mandelbox,
        parameterValues: new Array(paramCount).fill(0),
        escapeRadius,
        maxIterations,
      },
    }))
  },

  getMandelboxConfig: () => {
    return { ...get().mandelbox }
  },

  // --- Scale Animation Actions ---
  setMandelboxScaleAnimationEnabled: (enabled) => {
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleAnimationEnabled: enabled },
    }))
  },

  setMandelboxScaleCenter: (center) => {
    // Range -3.0 to 3.0 (same as scale)
    const clampedCenter = Math.max(-3.0, Math.min(3.0, center))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleCenter: clampedCenter },
    }))
  },

  setMandelboxScaleAmplitude: (amplitude) => {
    // Range 0.0 to 1.5
    const clampedAmplitude = Math.max(0.0, Math.min(1.5, amplitude))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleAmplitude: clampedAmplitude },
    }))
  },

  setMandelboxScaleSpeed: (speed) => {
    // Range 0.1 to 2.0
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleSpeed: clampedSpeed },
    }))
  },

  // --- Julia Mode Actions ---
  setMandelboxJuliaMode: (enabled) => {
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaMode: enabled },
    }))
  },

  setMandelboxJuliaSpeed: (speed) => {
    // Range 0.1 to 2.0
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaSpeed: clampedSpeed },
    }))
  },

  setMandelboxJuliaRadius: (radius) => {
    // Range 0.5 to 2.0
    const clampedRadius = Math.max(0.5, Math.min(10.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaRadius: clampedRadius },
    }))
  },
})
