import {
  DEFAULT_SCHROEDINGER_CONFIG,
  SCHROEDINGER_QUALITY_PRESETS,
} from '@/lib/geometry/extended/types'
import { SchroedingerColorMode } from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, SchroedingerSlice } from './types'

export const createSchroedingerSlice: StateCreator<ExtendedObjectSlice, [], [], SchroedingerSlice> = (set, get) => ({
  schroedinger: { ...DEFAULT_SCHROEDINGER_CONFIG },

  setSchroedingerMaxIterations: (value) => {
    const clampedValue = Math.max(10, Math.min(500, Math.floor(value)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, maxIterations: clampedValue },
    }))
  },

  setSchroedingerEscapeRadius: (value) => {
    // Extended range to 16 for higher-dimensional stability
    const clampedValue = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      schroedinger: { ...state.schroedinger, escapeRadius: clampedValue },
    }))
  },

  setSchroedingerQualityPreset: (preset) => {
    const settings = SCHROEDINGER_QUALITY_PRESETS[preset]
    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        qualityPreset: preset,
        maxIterations: settings.maxIterations,
        resolution: settings.resolution,
      },
    }))
  },

  setSchroedingerResolution: (value) => {
    // Valid resolutions: 16, 24, 32, 48, 64, 96, 128
    const validResolutions = [16, 24, 32, 48, 64, 96, 128]
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    set((state) => ({
      schroedinger: { ...state.schroedinger, resolution: closest },
    }))
  },

  setSchroedingerVisualizationAxes: (axes) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, visualizationAxes: axes },
    }))
  },

  setSchroedingerVisualizationAxis: (index, dimIndex) => {
    // Validate dimIndex to valid range [0, MAX_DIMENSION-1]
    const clampedDimIndex = Math.max(0, Math.min(10, Math.floor(dimIndex)))
    const current = [...get().schroedinger.visualizationAxes] as [number, number, number]
    current[index] = clampedDimIndex
    set((state) => ({
      schroedinger: { ...state.schroedinger, visualizationAxes: current },
    }))
  },

  setSchroedingerParameterValue: (dimIndex, value) => {
    const values = [...get().schroedinger.parameterValues]
    // Validate dimIndex to prevent sparse arrays or out-of-bounds access
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setSchroedingerParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
    // Clamp to reasonable range for Schroedinger exploration
    const clampedValue = Math.max(-2.0, Math.min(2.0, value))
    values[dimIndex] = clampedValue
    set((state) => ({
      schroedinger: { ...state.schroedinger, parameterValues: values },
    }))
  },

  setSchroedingerParameterValues: (values) => {
    const clampedValues = values.map((v) => Math.max(-2.0, Math.min(2.0, v)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, parameterValues: clampedValues },
    }))
  },

  resetSchroedingerParameters: () => {
    const len = get().schroedinger.parameterValues.length
    set((state) => ({
      schroedinger: { ...state.schroedinger, parameterValues: new Array(len).fill(0) },
    }))
  },

  setSchroedingerCenter: (center) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, center },
    }))
  },

  setSchroedingerExtent: (extent) => {
    const clampedExtent = Math.max(0.001, Math.min(10.0, extent))
    set((state) => ({
      schroedinger: { ...state.schroedinger, extent: clampedExtent },
    }))
  },

  fitSchroedingerToView: () => {
    const centerLen = get().schroedinger.center.length
    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        center: new Array(centerLen).fill(0),
        extent: 2.5,
      },
    }))
  },

  setSchroedingerColorMode: (mode) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, colorMode: mode },
    }))
  },

  setSchroedingerPalette: (palette) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, palette },
    }))
  },

  setSchroedingerCustomPalette: (palette) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, customPalette: palette },
    }))
  },

  setSchroedingerInvertColors: (invert) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, invertColors: invert },
    }))
  },

  setSchroedingerInteriorColor: (color) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, interiorColor: color },
    }))
  },

  setSchroedingerPaletteCycles: (cycles) => {
    const clampedCycles = Math.max(1, Math.min(20, Math.floor(cycles)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, paletteCycles: clampedCycles },
    }))
  },

  setSchroedingerRenderStyle: (style) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, renderStyle: style },
    }))
  },

  setSchroedingerPointSize: (size) => {
    const clampedSize = Math.max(1, Math.min(20, size))
    set((state) => ({
      schroedinger: { ...state.schroedinger, pointSize: clampedSize },
    }))
  },

  setSchroedingerBoundaryThreshold: (threshold) => {
    // Clamp values to [0, 1] and ensure min <= max
    const [min, max] = threshold
    const clampedMin = Math.max(0, Math.min(1, min))
    const clampedMax = Math.max(clampedMin, Math.min(1, max))
    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        boundaryThreshold: [clampedMin, clampedMax],
      },
    }))
  },

  setSchroedingerSchroedingerPower: (power) => {
    // Clamp power to reasonable range (2-16)
    const clampedPower = Math.max(2, Math.min(16, Math.floor(power)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, schroedingerPower: clampedPower },
    }))
  },

  setSchroedingerConfig: (config) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, ...config },
    }))
  },

  initializeSchroedingerForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Use boundaryOnly mode to show the fractal surface
    const colorMode: SchroedingerColorMode = 'boundaryOnly'

    // Dimension-specific defaults:
    // - 3D: Schroedinger with spherical coordinates
    // - 4D+: Schroedinger with hyperspherical coordinates

    // Escape radius (bailout): Higher dimensions need larger values for stability
    let escapeRadius: number
    if (dimension >= 9) {
      escapeRadius = 12.0 // 9D-11D: highest bailout for stability
    } else if (dimension >= 7) {
      escapeRadius = 10.0 // 7D-8D: high bailout
    } else if (dimension >= 4) {
      escapeRadius = 8.0 // 4D-6D: moderate bailout
    } else {
      escapeRadius = 4.0 // 3D: standard bailout
    }

    // Max iterations: Performance-aware defaults for raymarching
    let maxIterations: number
    if (dimension >= 9) {
      maxIterations = 35 // 9D-11D: very conservative
    } else if (dimension >= 7) {
      maxIterations = 40 // 7D-8D: conservative
    } else if (dimension >= 4) {
      maxIterations = 50 // 4D-6D: moderate
    } else {
      maxIterations = 80 // 3D Schroedinger: good quality
    }

    // Power: 8 for Schroedinger
    const power = 8

    // Extent: [-2,2] for 4D+, smaller for 3D
    const extent = dimension === 3 ? 1.5 : 2.0

    // Center at origin for all dimensions
    const center = new Array(dimension).fill(0)

    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        parameterValues: new Array(paramCount).fill(0),
        center,
        visualizationAxes: [0, 1, 2],
        colorMode,
        extent,
        escapeRadius,
        schroedingerPower: power,
        maxIterations,
      },
    }))
  },

  getSchroedingerConfig: () => {
    return { ...get().schroedinger }
  },

  // --- Power Animation Actions (Schroedinger-specific) ---
  setSchroedingerPowerAnimationEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, powerAnimationEnabled: enabled },
    }))
  },

  setSchroedingerPowerMin: (min) => {
    // Range 2.0 to 16.0 (expanded for more variety)
    const clampedMin = Math.max(2.0, Math.min(16.0, min))
    set((state) => ({
      schroedinger: { ...state.schroedinger, powerMin: clampedMin },
    }))
  },

  setSchroedingerPowerMax: (max) => {
    // Range 3.0 to 24.0 (expanded for more variety)
    const clampedMax = Math.max(3.0, Math.min(24.0, max))
    set((state) => ({
      schroedinger: { ...state.schroedinger, powerMax: clampedMax },
    }))
  },

  setSchroedingerPowerSpeed: (speed) => {
    // Range 0.01 to 0.2 (very slow for organic wandering)
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, powerSpeed: clampedSpeed },
    }))
  },

  // --- Alternate Power Actions (Technique B variant) ---
  setSchroedingerAlternatePowerEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, alternatePowerEnabled: enabled },
    }))
  },

  setSchroedingerAlternatePowerValue: (power) => {
    // Range 2.0 to 16.0
    const clampedPower = Math.max(2.0, Math.min(16.0, power))
    set((state) => ({
      schroedinger: { ...state.schroedinger, alternatePowerValue: clampedPower },
    }))
  },

  setSchroedingerAlternatePowerBlend: (blend) => {
    // Range 0.0 to 1.0
    const clampedBlend = Math.max(0.0, Math.min(1.0, blend))
    set((state) => ({
      schroedinger: { ...state.schroedinger, alternatePowerBlend: clampedBlend },
    }))
  },

  // --- Dimension Mixing Actions (Technique A) ---
  setSchroedingerDimensionMixEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, dimensionMixEnabled: enabled },
    }))
  },

  setSchroedingerMixIntensity: (intensity) => {
    // Range 0.0 to 0.3
    const clampedIntensity = Math.max(0.0, Math.min(0.3, intensity))
    set((state) => ({
      schroedinger: { ...state.schroedinger, mixIntensity: clampedIntensity },
    }))
  },

  setSchroedingerMixFrequency: (frequency) => {
    // Range 0.1 to 2.0
    const clampedFrequency = Math.max(0.1, Math.min(2.0, frequency))
    set((state) => ({
      schroedinger: { ...state.schroedinger, mixFrequency: clampedFrequency },
    }))
  },

  // --- Origin Drift Actions (Technique C) ---
  setSchroedingerOriginDriftEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, originDriftEnabled: enabled },
    }))
  },

  setSchroedingerDriftAmplitude: (amplitude) => {
    // Range 0.01 to 0.5
    const clampedAmplitude = Math.max(0.01, Math.min(0.5, amplitude))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftAmplitude: clampedAmplitude },
    }))
  },

  setSchroedingerDriftBaseFrequency: (frequency) => {
    // Range 0.01 to 0.5 (allow very slow animations to avoid jitter)
    const clampedFrequency = Math.max(0.01, Math.min(0.5, frequency))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftBaseFrequency: clampedFrequency },
    }))
  },

  setSchroedingerDriftFrequencySpread: (spread) => {
    // Range 0.0 to 1.0
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftFrequencySpread: clampedSpread },
    }))
  },

  // --- Slice Animation Actions (4D+ only) ---
  setSchroedingerSliceAnimationEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceAnimationEnabled: enabled },
    }))
  },

  setSchroedingerSliceSpeed: (speed) => {
    // Range 0.01 to 0.1
    const clampedSpeed = Math.max(0.01, Math.min(0.1, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceSpeed: clampedSpeed },
    }))
  },

  setSchroedingerSliceAmplitude: (amplitude) => {
    // Range 0.1 to 1.0
    const clampedAmplitude = Math.max(0.1, Math.min(1.0, amplitude))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceAmplitude: clampedAmplitude },
    }))
  },

  // --- Angular Phase Shifts Actions ---
  setSchroedingerPhaseShiftEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, phaseShiftEnabled: enabled },
    }))
  },

  setSchroedingerPhaseSpeed: (speed) => {
    // Range 0.01 to 0.2
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, phaseSpeed: clampedSpeed },
    }))
  },

  setSchroedingerPhaseAmplitude: (amplitude) => {
    // Range 0.0 to PI/4 (~0.785)
    const clampedAmplitude = Math.max(0.0, Math.min(Math.PI / 4, amplitude))
    set((state) => ({
      schroedinger: { ...state.schroedinger, phaseAmplitude: clampedAmplitude },
    }))
  },
})
