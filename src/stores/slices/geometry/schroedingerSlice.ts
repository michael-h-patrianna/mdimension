import {
  DEFAULT_SCHROEDINGER_CONFIG,
  RAYMARCH_QUALITY_TO_SAMPLES,
  type RaymarchQuality,
  SCHROEDINGER_QUALITY_PRESETS,
  SchroedingerColorMode,
  SchroedingerPresetName,
} from '@/lib/geometry/extended/types'
import { SCHROEDINGER_PALETTE_DEFINITIONS } from '@/lib/geometry/extended/schroedinger/palettes'
import { SCHROEDINGER_NAMED_PRESETS } from '@/lib/geometry/extended/schroedinger/presets'
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
    const definitions = SCHROEDINGER_PALETTE_DEFINITIONS[palette]
    set((state) => ({
      schroedinger: {
        ...state.schroedinger,
        palette,
        cosineParams: definitions ? definitions : state.schroedinger.cosineParams
      },
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
    // If selecting a named preset, apply its parameters to the state
    // This keeps the UI sliders in sync with the visual preset
    let updates = {};
    if (name !== 'custom') {
      const preset = SCHROEDINGER_NAMED_PRESETS[name];
      if (preset) {
        updates = {
          seed: preset.seed,
          termCount: preset.termCount,
          maxQuantumNumber: preset.maxN,
          frequencySpread: preset.frequencySpread
        };
      }
    }

    set((state) => ({
      schroedinger: { 
        ...state.schroedinger, 
        presetName: name,
        ...updates
      },
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

  setSchroedingerPowderScale: (scale) => {
    const clampedScale = Math.max(0.0, Math.min(2.0, scale))
    set((state) => ({
      schroedinger: { ...state.schroedinger, powderScale: clampedScale },
    }))
  },

  setSchroedingerSampleCount: (count) => {
    const clampedCount = Math.max(16, Math.min(128, count))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sampleCount: clampedCount },
    }))
  },

  setSchroedingerEmissionIntensity: (intensity) => {
    const clamped = Math.max(0.0, Math.min(5.0, intensity))
    set((state) => ({
      schroedinger: { ...state.schroedinger, emissionIntensity: clamped },
    }))
  },

  setSchroedingerEmissionThreshold: (threshold) => {
    const clamped = Math.max(0.0, Math.min(1.0, threshold))
    set((state) => ({
      schroedinger: { ...state.schroedinger, emissionThreshold: clamped },
    }))
  },

  setSchroedingerEmissionColorShift: (shift) => {
    const clamped = Math.max(-1.0, Math.min(1.0, shift))
    set((state) => ({
      schroedinger: { ...state.schroedinger, emissionColorShift: clamped },
    }))
  },

  setSchroedingerEmissionPulsing: (pulsing) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, emissionPulsing: pulsing },
    }))
  },

  setSchroedingerRimExponent: (exponent) => {
    const clamped = Math.max(1.0, Math.min(10.0, exponent))
    set((state) => ({
      schroedinger: { ...state.schroedinger, rimExponent: clamped },
    }))
  },

  setSchroedingerScatteringAnisotropy: (anisotropy) => {
    const clamped = Math.max(-0.9, Math.min(0.9, anisotropy))
    set((state) => ({
      schroedinger: { ...state.schroedinger, scatteringAnisotropy: clamped },
    }))
  },

  setSchroedingerRoughness: (roughness) => {
    const clamped = Math.max(0.0, Math.min(1.0, roughness))
    set((state) => ({
      schroedinger: { ...state.schroedinger, roughness: clamped },
    }))
  },

  setSchroedingerFogIntegrationEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, fogIntegrationEnabled: enabled },
    }))
  },

  setSchroedingerFogContribution: (contribution) => {
    const clamped = Math.max(0.0, Math.min(2.0, contribution))
    set((state) => ({
      schroedinger: { ...state.schroedinger, fogContribution: clamped },
    }))
  },

  setSchroedingerInternalFogDensity: (density) => {
    const clamped = Math.max(0.0, Math.min(1.0, density))
    set((state) => ({
      schroedinger: { ...state.schroedinger, internalFogDensity: clamped },
    }))
  },

  setSchroedingerRaymarchQuality: (quality: RaymarchQuality) => {
    // Update both raymarchQuality and sampleCount for consistency.
    // Note: The mesh reads raymarchQuality directly via RAYMARCH_QUALITY_TO_SAMPLES mapping.
    // sampleCount is kept in sync for backward compatibility with any code that reads it directly.
    const sampleCount = RAYMARCH_QUALITY_TO_SAMPLES[quality]
    set((state) => ({
      schroedinger: { ...state.schroedinger, raymarchQuality: quality, sampleCount },
    }))
  },

  setSchroedingerSssEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, sssEnabled: enabled },
    }))
  },

  setSchroedingerSssIntensity: (intensity) => {
    const clamped = Math.max(0.0, Math.min(2.0, intensity))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sssIntensity: clamped },
    }))
  },

  setSchroedingerSssColor: (color) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, sssColor: color },
    }))
  },

  setSchroedingerSssThickness: (thickness) => {
    const clamped = Math.max(0.1, Math.min(5.0, thickness))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sssThickness: clamped },
    }))
  },

  setSchroedingerSssJitter: (jitter) => {
    const clamped = Math.max(0.0, Math.min(1.0, jitter))
    set((state) => ({
      schroedinger: { ...state.schroedinger, sssJitter: clamped },
    }))
  },

  setSchroedingerErosionStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(1.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, erosionStrength: clamped },
    }))
  },

  setSchroedingerErosionScale: (scale) => {
    const clamped = Math.max(0.25, Math.min(4.0, scale))
    set((state) => ({
      schroedinger: { ...state.schroedinger, erosionScale: clamped },
    }))
  },

  setSchroedingerErosionTurbulence: (turbulence) => {
    const clamped = Math.max(0.0, Math.min(1.0, turbulence))
    set((state) => ({
      schroedinger: { ...state.schroedinger, erosionTurbulence: clamped },
    }))
  },

  setSchroedingerErosionNoiseType: (type) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, erosionNoiseType: type },
    }))
  },

  setSchroedingerCurlEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, curlEnabled: enabled },
    }))
  },

  setSchroedingerCurlStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(1.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, curlStrength: clamped },
    }))
  },

  setSchroedingerCurlScale: (scale) => {
    const clamped = Math.max(0.25, Math.min(4.0, scale))
    set((state) => ({
      schroedinger: { ...state.schroedinger, curlScale: clamped },
    }))
  },

  setSchroedingerCurlSpeed: (speed) => {
    const clamped = Math.max(0.1, Math.min(5.0, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, curlSpeed: clamped },
    }))
  },

  setSchroedingerCurlBias: (bias) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, curlBias: bias },
    }))
  },

  setSchroedingerDispersionEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, dispersionEnabled: enabled },
    }))
  },

  setSchroedingerDispersionStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(1.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, dispersionStrength: clamped },
    }))
  },

  setSchroedingerDispersionDirection: (direction) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, dispersionDirection: direction },
    }))
  },

  setSchroedingerDispersionQuality: (quality) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, dispersionQuality: quality },
    }))
  },

  setSchroedingerShadowsEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, shadowsEnabled: enabled },
    }))
  },

  setSchroedingerShadowStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(2.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, shadowStrength: clamped },
    }))
  },

  setSchroedingerShadowSteps: (steps) => {
    const clamped = Math.max(1, Math.min(8, steps))
    set((state) => ({
      schroedinger: { ...state.schroedinger, shadowSteps: clamped },
    }))
  },

  setSchroedingerAoEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, aoEnabled: enabled },
    }))
  },

  setSchroedingerAoStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(2.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, aoStrength: clamped },
    }))
  },

  setSchroedingerAoQuality: (quality) => {
    const clamped = Math.max(3, Math.min(8, quality))
    set((state) => ({
      schroedinger: { ...state.schroedinger, aoQuality: clamped },
    }))
  },

  setSchroedingerAoRadius: (radius) => {
    const clamped = Math.max(0.1, Math.min(2.0, radius))
    set((state) => ({
      schroedinger: { ...state.schroedinger, aoRadius: clamped },
    }))
  },

  setSchroedingerAoColor: (color) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, aoColor: color },
    }))
  },

  setSchroedingerNodalEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, nodalEnabled: enabled },
    }))
  },

  setSchroedingerNodalColor: (color) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, nodalColor: color },
    }))
  },

  setSchroedingerNodalStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(2.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, nodalStrength: clamped },
    }))
  },

  setSchroedingerEnergyColorEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, energyColorEnabled: enabled },
    }))
  },

  setSchroedingerShimmerEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, shimmerEnabled: enabled },
    }))
  },

  setSchroedingerShimmerStrength: (strength) => {
    const clamped = Math.max(0.0, Math.min(1.0, strength))
    set((state) => ({
      schroedinger: { ...state.schroedinger, shimmerStrength: clamped },
    }))
  },

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

  // === Spread Animation ===
  setSchroedingerSpreadAnimationEnabled: (enabled) => {
    set((state) => ({
      schroedinger: { ...state.schroedinger, spreadAnimationEnabled: enabled },
    }))
  },

  setSchroedingerSpreadAnimationSpeed: (speed) => {
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      schroedinger: { ...state.schroedinger, spreadAnimationSpeed: clampedSpeed },
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
