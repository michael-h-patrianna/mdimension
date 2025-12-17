import {
  DEFAULT_SCHROEDINGER_CONFIG,
  SCHROEDINGER_QUALITY_PRESETS,
  SchroedingerColorMode,
  SchroedingerPresetName,
} from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, SchroedingerSlice } from './types'

export const createSchroedingerSlice: StateCreator<ExtendedObjectSlice, [], [], SchroedingerSlice> = (set, get) => ({
  schroedinger: { ...DEFAULT_SCHROEDINGER_CONFIG },

  // === Quality Settings ===
  setSchroedingerQualityPreset: (preset) => {
    const settings = SCHROEDINGER_QUALITY_PRESETS[preset]
    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        qualityPreset: preset,
        resolution: settings.resolution,
      },
    }))
  },

  setSchroedingerResolution: (value) => {
    const validResolutions = [16, 24, 32, 48, 64, 96, 128]
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    set((state) => ({
      schroedinger: { ...state.schroedinger, resolution: closest },
    }))
  },

  // === Visualization Axes ===
  setSchroedingerVisualizationAxes: (axes) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, visualizationAxes: axes },
    }))
  },

  setSchroedingerVisualizationAxis: (index, dimIndex) => {
    const clampedDimIndex = Math.max(0, Math.min(10, Math.floor(dimIndex)))
    const current = [...get().schroedinger.visualizationAxes] as [number, number, number]
    current[index] = clampedDimIndex
    set((state) => ({
      schroedinger: { ...state.schroedinger, visualizationAxes: current },
    }))
  },

  // === Slice Parameters ===
  setSchroedingerParameterValue: (dimIndex, value) => {
    const values = [...get().schroedinger.parameterValues]
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setSchroedingerParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
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

  // === Navigation ===
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

  // === Color Settings ===
  setSchroedingerColorMode: (mode: SchroedingerColorMode) => {
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

  // === Rendering Style ===
  setSchroedingerRenderStyle: (style) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, renderStyle: style },
    }))
  },

  // === Quantum State Configuration ===
  setSchroedingerPresetName: (name: SchroedingerPresetName) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, presetName: name },
    }))
  },

  setSchroedingerSeed: (seed) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, seed: Math.floor(seed) },
    }))
  },

  randomizeSchroedingerSeed: () => {
    const newSeed = Math.floor(Math.random() * 1000000)
    set((state) => ({
      schroedinger: { ...state.schroedinger, seed: newSeed, presetName: 'custom' },
    }))
  },

  setSchroedingerTermCount: (count) => {
    const clampedCount = Math.max(1, Math.min(8, Math.floor(count)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, termCount: clampedCount, presetName: 'custom' },
    }))
  },

  setSchroedingerMaxQuantumNumber: (maxN) => {
    const clampedMaxN = Math.max(2, Math.min(6, Math.floor(maxN)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, maxQuantumNumber: clampedMaxN, presetName: 'custom' },
    }))
  },

  setSchroedingerFrequencySpread: (spread) => {
    const clampedSpread = Math.max(0, Math.min(0.1, spread))
    set((state) => ({
      schroedinger: { ...state.schroedinger, frequencySpread: clampedSpread, presetName: 'custom' },
    }))
  },

  // === Volume Rendering Parameters ===
  setSchroedingerTimeScale: (scale) => {
    const clampedScale = Math.max(0.1, Math.min(2.0, scale))
    set((state) => ({
      schroedinger: { ...state.schroedinger, timeScale: clampedScale },
    }))
  },

  setSchroedingerFieldScale: (scale) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale))
    set((state) => ({
      schroedinger: { ...state.schroedinger, fieldScale: clampedScale },
    }))
  },

  setSchroedingerDensityGain: (gain) => {
    const clampedGain = Math.max(0.1, Math.min(5.0, gain))
    set((state) => ({
      schroedinger: { ...state.schroedinger, densityGain: clampedGain },
    }))
  },

  setSchroedingerSampleCount: (count) => {
    const clampedCount = Math.max(32, Math.min(128, Math.floor(count)))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sampleCount: clampedCount },
    }))
  },

  // === Isosurface Mode ===
  setSchroedingerIsoEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, isoEnabled: enabled },
    }))
  },

  setSchroedingerIsoThreshold: (threshold) => {
    const clampedThreshold = Math.max(-6, Math.min(0, threshold))
    set((state) => ({
      schroedinger: { ...state.schroedinger, isoThreshold: clampedThreshold },
    }))
  },

  // === Origin Drift Animation ===
  setSchroedingerOriginDriftEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, originDriftEnabled: enabled },
    }))
  },

  setSchroedingerDriftAmplitude: (amplitude) => {
    const clampedAmplitude = Math.max(0.01, Math.min(0.5, amplitude))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftAmplitude: clampedAmplitude },
    }))
  },

  setSchroedingerDriftBaseFrequency: (frequency) => {
    const clampedFrequency = Math.max(0.05, Math.min(0.5, frequency))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftBaseFrequency: clampedFrequency },
    }))
  },

  setSchroedingerDriftFrequencySpread: (spread) => {
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      schroedinger: { ...state.schroedinger, driftFrequencySpread: clampedSpread },
    }))
  },

  // === Slice Animation (4D+ only) ===
  setSchroedingerSliceAnimationEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceAnimationEnabled: enabled },
    }))
  },

  setSchroedingerSliceSpeed: (speed) => {
    const clampedSpeed = Math.max(0.01, Math.min(0.1, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceSpeed: clampedSpeed },
    }))
  },

  setSchroedingerSliceAmplitude: (amplitude) => {
    const clampedAmplitude = Math.max(0.1, Math.min(1.0, amplitude))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sliceAmplitude: clampedAmplitude },
    }))
  },

  // === Config Operations ===
  setSchroedingerConfig: (config) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, ...config },
    }))
  },

  initializeSchroedingerForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Default color mode for quantum visualization
    const colorMode: SchroedingerColorMode = 'mixed'

    // Extent: standard volume size
    const extent = 2.0

    // Center at origin for all dimensions
    const center = new Array(dimension).fill(0)

    // Scale densityGain with dimension to compensate for
    // product of Hermite polynomials at slice positions.
    // Higher dimensions need more gain to remain visible.
    // Base gain of 2.0 works well for 3D-4D, scale up for higher.
    const baseDensityGain = 2.0
    const dimensionBoost = dimension > 4 ? 1.0 + (dimension - 4) * 0.4 : 1.0
    const densityGain = Math.min(baseDensityGain * dimensionBoost, 5.0) // Clamp to max

    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        parameterValues: new Array(paramCount).fill(0),
        center,
        visualizationAxes: [0, 1, 2],
        colorMode,
        extent,
        densityGain,
      },
    }))
  },

  getSchroedingerConfig: () => {
    return { ...get().schroedinger }
  },
})
