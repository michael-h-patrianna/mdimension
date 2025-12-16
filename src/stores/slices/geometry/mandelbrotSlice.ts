import {
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
} from '@/lib/geometry/extended/types'
import { MandelbrotColorMode } from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, MandelbrotSlice } from './types'

export const createMandelbrotSlice: StateCreator<ExtendedObjectSlice, [], [], MandelbrotSlice> = (set, get) => ({
  mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },

  setMandelbrotMaxIterations: (value) => {
    const clampedValue = Math.max(10, Math.min(500, Math.floor(value)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, maxIterations: clampedValue },
    }))
  },

  setMandelbrotEscapeRadius: (value) => {
    // Extended range to 16 for higher-dimensional Hyperbulb stability
    const clampedValue = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, escapeRadius: clampedValue },
    }))
  },

  setMandelbrotQualityPreset: (preset) => {
    const settings = MANDELBROT_QUALITY_PRESETS[preset]
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        qualityPreset: preset,
        maxIterations: settings.maxIterations,
        resolution: settings.resolution,
      },
    }))
  },

  setMandelbrotResolution: (value) => {
    // Valid resolutions: 16, 24, 32, 48, 64, 96, 128
    const validResolutions = [16, 24, 32, 48, 64, 96, 128]
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, resolution: closest },
    }))
  },

  setMandelbrotVisualizationAxes: (axes) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: axes },
    }))
  },

  setMandelbrotVisualizationAxis: (index, dimIndex) => {
    // Validate dimIndex to valid range [0, MAX_DIMENSION-1]
    // MAX_DIMENSION is 11, so valid indices are 0-10 (representing X through 11th axis)
    const clampedDimIndex = Math.max(0, Math.min(10, Math.floor(dimIndex)))
    const current = [...get().mandelbrot.visualizationAxes] as [number, number, number]
    current[index] = clampedDimIndex
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: current },
    }))
  },

  setMandelbrotParameterValue: (dimIndex, value) => {
    const values = [...get().mandelbrot.parameterValues]
    // Validate dimIndex to prevent sparse arrays or out-of-bounds access
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setMandelbrotParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
    // Clamp to reasonable range for Mandelbrot exploration
    const clampedValue = Math.max(-2.0, Math.min(2.0, value))
    values[dimIndex] = clampedValue
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: values },
    }))
  },

  setMandelbrotParameterValues: (values) => {
    const clampedValues = values.map((v) => Math.max(-2.0, Math.min(2.0, v)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: clampedValues },
    }))
  },

  resetMandelbrotParameters: () => {
    const len = get().mandelbrot.parameterValues.length
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, parameterValues: new Array(len).fill(0) },
    }))
  },

  setMandelbrotCenter: (center) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, center },
    }))
  },

  setMandelbrotExtent: (extent) => {
    const clampedExtent = Math.max(0.001, Math.min(10.0, extent))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, extent: clampedExtent },
    }))
  },

  fitMandelbrotToView: () => {
    const centerLen = get().mandelbrot.center.length
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        center: new Array(centerLen).fill(0),
        extent: 2.5,
      },
    }))
  },

  setMandelbrotColorMode: (mode) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, colorMode: mode },
    }))
  },

  setMandelbrotPalette: (palette) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, palette },
    }))
  },

  setMandelbrotCustomPalette: (palette) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, customPalette: palette },
    }))
  },

  setMandelbrotInvertColors: (invert) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, invertColors: invert },
    }))
  },

  setMandelbrotInteriorColor: (color) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, interiorColor: color },
    }))
  },

  setMandelbrotPaletteCycles: (cycles) => {
    const clampedCycles = Math.max(1, Math.min(20, Math.floor(cycles)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, paletteCycles: clampedCycles },
    }))
  },

  setMandelbrotRenderStyle: (style) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, renderStyle: style },
    }))
  },

  setMandelbrotPointSize: (size) => {
    const clampedSize = Math.max(1, Math.min(20, size))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, pointSize: clampedSize },
    }))
  },

  setMandelbrotBoundaryThreshold: (threshold) => {
    // Clamp values to [0, 1] and ensure min <= max
    const [min, max] = threshold
    const clampedMin = Math.max(0, Math.min(1, min))
    const clampedMax = Math.max(clampedMin, Math.min(1, max))
    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        boundaryThreshold: [clampedMin, clampedMax],
      },
    }))
  },

  setMandelbrotMandelbulbPower: (power) => {
    // Clamp power to reasonable range (2-16)
    const clampedPower = Math.max(2, Math.min(16, Math.floor(power)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, mandelbulbPower: clampedPower },
    }))
  },

  setMandelbrotConfig: (config) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, ...config },
    }))
  },

  initializeMandelbrotForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Use boundaryOnly mode to show the fractal surface
    const colorMode: MandelbrotColorMode = 'boundaryOnly'

    // Dimension-specific defaults from hyperbulb guide:
    // - 3D: Mandelbulb with spherical coordinates
    // - 4D+: Hyperbulb with hyperspherical coordinates

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
    // Higher dimensions need more conservative values due to computational cost
    let maxIterations: number
    if (dimension >= 9) {
      maxIterations = 35 // 9D-11D: very conservative
    } else if (dimension >= 7) {
      maxIterations = 40 // 7D-8D: conservative
    } else if (dimension >= 4) {
      maxIterations = 50 // 4D-6D: moderate
    } else {
      maxIterations = 80 // 3D Mandelbulb: good quality
    }

    // Power: 8 for Mandelbulb/Hyperbulb
    const power = 8

    // Extent: Guide suggests [-2,2] for 4D+, smaller for 3D Mandelbulb
    // 3D Mandelbulb: lives roughly within |x|,|y|,|z| < 1.2, so extent 1.5 is good
    // 4D+ Hyperbulb: extent 2.0 for exploration
    const extent = dimension === 3 ? 1.5 : 2.0

    // Center at origin for all dimensions
    const center = new Array(dimension).fill(0)

    set((state) => ({
      mandelbrot: {
        ...state.mandelbrot,
        parameterValues: new Array(paramCount).fill(0),
        center,
        visualizationAxes: [0, 1, 2],
        colorMode,
        extent,
        escapeRadius,
        mandelbulbPower: power,
        maxIterations,
      },
    }))
  },

  getMandelbrotConfig: () => {
    return { ...get().mandelbrot }
  },

  // --- Power Animation Actions (Hyperbulb-specific) ---
  setMandelbrotPowerAnimationEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, powerAnimationEnabled: enabled },
    }))
  },

  setMandelbrotPowerMin: (min) => {
    // Range 2.0 to 16.0 (expanded for more variety)
    const clampedMin = Math.max(2.0, Math.min(16.0, min))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, powerMin: clampedMin },
    }))
  },

  setMandelbrotPowerMax: (max) => {
    // Range 3.0 to 24.0 (expanded for more variety)
    const clampedMax = Math.max(3.0, Math.min(24.0, max))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, powerMax: clampedMax },
    }))
  },

  setMandelbrotPowerSpeed: (speed) => {
    // Range 0.01 to 0.2 (very slow for organic wandering)
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, powerSpeed: clampedSpeed },
    }))
  },

  // --- Alternate Power Actions (Technique B variant) ---
  setMandelbrotAlternatePowerEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, alternatePowerEnabled: enabled },
    }))
  },

  setMandelbrotAlternatePowerValue: (power) => {
    // Range 2.0 to 16.0
    const clampedPower = Math.max(2.0, Math.min(16.0, power))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, alternatePowerValue: clampedPower },
    }))
  },

  setMandelbrotAlternatePowerBlend: (blend) => {
    // Range 0.0 to 1.0
    const clampedBlend = Math.max(0.0, Math.min(1.0, blend))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, alternatePowerBlend: clampedBlend },
    }))
  },

  // --- Dimension Mixing Actions (Technique A) ---
  setMandelbrotDimensionMixEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, dimensionMixEnabled: enabled },
    }))
  },

  setMandelbrotMixIntensity: (intensity) => {
    // Range 0.0 to 0.3
    const clampedIntensity = Math.max(0.0, Math.min(0.3, intensity))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, mixIntensity: clampedIntensity },
    }))
  },

  setMandelbrotMixFrequency: (frequency) => {
    // Range 0.1 to 2.0
    const clampedFrequency = Math.max(0.1, Math.min(2.0, frequency))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, mixFrequency: clampedFrequency },
    }))
  },

  // --- Origin Drift Actions (Technique C) ---
  setMandelbrotOriginDriftEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, originDriftEnabled: enabled },
    }))
  },

  setMandelbrotDriftAmplitude: (amplitude) => {
    // Range 0.01 to 0.5
    const clampedAmplitude = Math.max(0.01, Math.min(0.5, amplitude))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, driftAmplitude: clampedAmplitude },
    }))
  },

  setMandelbrotDriftBaseFrequency: (frequency) => {
    // Range 0.01 to 0.5 (allow very slow animations to avoid jitter)
    const clampedFrequency = Math.max(0.01, Math.min(0.5, frequency))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, driftBaseFrequency: clampedFrequency },
    }))
  },

  setMandelbrotDriftFrequencySpread: (spread) => {
    // Range 0.0 to 1.0
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, driftFrequencySpread: clampedSpread },
    }))
  },

  // --- Slice Animation Actions (4D+ only) ---
  setMandelbrotSliceAnimationEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, sliceAnimationEnabled: enabled },
    }))
  },

  setMandelbrotSliceSpeed: (speed) => {
    // Range 0.01 to 0.1
    const clampedSpeed = Math.max(0.01, Math.min(0.1, speed))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, sliceSpeed: clampedSpeed },
    }))
  },

  setMandelbrotSliceAmplitude: (amplitude) => {
    // Range 0.1 to 1.0
    const clampedAmplitude = Math.max(0.1, Math.min(1.0, amplitude))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, sliceAmplitude: clampedAmplitude },
    }))
  },

  // --- Julia Morphing Actions ---
  setMandelbrotJuliaModeEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, juliaModeEnabled: enabled },
    }))
  },

  setMandelbrotJuliaOrbitSpeed: (speed) => {
    // Range 0.01 to 0.1
    const clampedSpeed = Math.max(0.01, Math.min(0.1, speed))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, juliaOrbitSpeed: clampedSpeed },
    }))
  },

  setMandelbrotJuliaOrbitRadius: (radius) => {
    // Range 0.1 to 1.5
    const clampedRadius = Math.max(0.1, Math.min(1.5, radius))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, juliaOrbitRadius: clampedRadius },
    }))
  },

  // --- Angular Phase Shifts Actions ---
  setMandelbrotPhaseShiftEnabled: (enabled) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, phaseShiftEnabled: enabled },
    }))
  },

  setMandelbrotPhaseSpeed: (speed) => {
    // Range 0.01 to 0.2
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, phaseSpeed: clampedSpeed },
    }))
  },

  setMandelbrotPhaseAmplitude: (amplitude) => {
    // Range 0.0 to PI/4 (~0.785)
    const clampedAmplitude = Math.max(0.0, Math.min(Math.PI / 4, amplitude))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, phaseAmplitude: clampedAmplitude },
    }))
  },
})
