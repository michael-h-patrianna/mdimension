import {
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
  MandelbulbAutopilotStrategy,
  MandelbulbColorMode,
} from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, MandelbulbSlice } from './types'

export const createMandelbulbSlice: StateCreator<ExtendedObjectSlice, [], [], MandelbulbSlice> = (set, get) => ({
  mandelbulb: { ...DEFAULT_MANDELBROT_CONFIG },

  setMandelbulbMaxIterations: (value) => {
    const clampedValue = Math.max(10, Math.min(500, Math.floor(value)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, maxIterations: clampedValue },
    }))
  },

  setMandelbulbEscapeRadius: (value) => {
    // Extended range to 16 for higher-dimensional Mandelbulb stability
    const clampedValue = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, escapeRadius: clampedValue },
    }))
  },

  setMandelbulbQualityPreset: (preset) => {
    const settings = MANDELBROT_QUALITY_PRESETS[preset]
    set((state) => ({
      mandelbulb: {
        ...state.mandelbulb,
        qualityPreset: preset,
        maxIterations: settings.maxIterations,
        resolution: settings.resolution,
      },
    }))
  },

  setMandelbulbResolution: (value) => {
    // Valid resolutions: 16, 24, 32, 48, 64, 96, 128
    const validResolutions = [16, 24, 32, 48, 64, 96, 128]
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, resolution: closest },
    }))
  },

  setMandelbulbVisualizationAxes: (axes) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, visualizationAxes: axes },
    }))
  },

  setMandelbulbVisualizationAxis: (index, dimIndex) => {
    // Validate dimIndex to valid range [0, MAX_DIMENSION-1]
    // MAX_DIMENSION is 11, so valid indices are 0-10 (representing X through 11th axis)
    const clampedDimIndex = Math.max(0, Math.min(10, Math.floor(dimIndex)))
    const current = [...get().mandelbulb.visualizationAxes] as [number, number, number]
    current[index] = clampedDimIndex
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, visualizationAxes: current },
    }))
  },

  setMandelbulbParameterValue: (dimIndex, value) => {
    const values = [...get().mandelbulb.parameterValues]
    // Validate dimIndex to prevent sparse arrays or out-of-bounds access
    if (dimIndex < 0 || dimIndex >= values.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `setMandelbulbParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
        )
      }
      return
    }
    // Clamp to reasonable range for Mandelbulb exploration
    const clampedValue = Math.max(-2.0, Math.min(2.0, value))
    values[dimIndex] = clampedValue
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, parameterValues: values },
    }))
  },

  setMandelbulbParameterValues: (values) => {
    const clampedValues = values.map((v) => Math.max(-2.0, Math.min(2.0, v)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, parameterValues: clampedValues },
    }))
  },

  resetMandelbulbParameters: () => {
    const len = get().mandelbulb.parameterValues.length
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, parameterValues: new Array(len).fill(0) },
    }))
  },

  setMandelbulbCenter: (center) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, center },
    }))
  },

  setMandelbulbExtent: (extent) => {
    const clampedExtent = Math.max(0.001, Math.min(10.0, extent))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, extent: clampedExtent },
    }))
  },

  fitMandelbulbToView: () => {
    const centerLen = get().mandelbulb.center.length
    set((state) => ({
      mandelbulb: {
        ...state.mandelbulb,
        center: new Array(centerLen).fill(0),
        extent: 2.5,
      },
    }))
  },

  setMandelbulbColorMode: (mode) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, colorMode: mode },
    }))
  },

  setMandelbulbPalette: (palette) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, palette },
    }))
  },

  setMandelbulbCustomPalette: (palette) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, customPalette: palette },
    }))
  },

  setMandelbulbInvertColors: (invert) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, invertColors: invert },
    }))
  },

  setMandelbulbInteriorColor: (color) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interiorColor: color },
    }))
  },

  setMandelbulbPaletteCycles: (cycles) => {
    const clampedCycles = Math.max(1, Math.min(20, Math.floor(cycles)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, paletteCycles: clampedCycles },
    }))
  },

  setMandelbulbRenderStyle: (style) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, renderStyle: style },
    }))
  },

  setMandelbulbPointSize: (size) => {
    const clampedSize = Math.max(1, Math.min(20, size))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, pointSize: clampedSize },
    }))
  },

  setMandelbulbBoundaryThreshold: (threshold) => {
    // Clamp values to [0, 1] and ensure min <= max
    const [min, max] = threshold
    const clampedMin = Math.max(0, Math.min(1, min))
    const clampedMax = Math.max(clampedMin, Math.min(1, max))
    set((state) => ({
      mandelbulb: {
        ...state.mandelbulb,
        boundaryThreshold: [clampedMin, clampedMax],
      },
    }))
  },

  setMandelbulbMandelbulbPower: (power) => {
    // Clamp power to reasonable range (2-16)
    const clampedPower = Math.max(2, Math.min(16, Math.floor(power)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, mandelbulbPower: clampedPower },
    }))
  },

  setMandelbulbConfig: (config) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, ...config },
    }))
  },

  initializeMandelbulbForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)

    // Use boundaryOnly mode to show the fractal surface
    const colorMode: MandelbulbColorMode = 'boundaryOnly'

    // Dimension-specific defaults from mandelbulb guide:
    // - 3D: Mandelbulb with spherical coordinates
    // - 4D+: Mandelbulb with hyperspherical coordinates

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

    // Power: 8 for Mandelbulb/Mandelbulb
    const power = 8

    // Extent: Guide suggests [-2,2] for 4D+, smaller for 3D Mandelbulb
    // 3D Mandelbulb: lives roughly within |x|,|y|,|z| < 1.2, so extent 1.5 is good
    // 4D+ Mandelbulb: extent 2.0 for exploration
    const extent = dimension === 3 ? 1.5 : 2.0

    // Center at origin for all dimensions
    const center = new Array(dimension).fill(0)

    set((state) => ({
      mandelbulb: {
        ...state.mandelbulb,
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

  getMandelbulbConfig: () => {
    return { ...get().mandelbulb }
  },

  // --- Power Animation Actions (Mandelbulb-specific) ---
  setMandelbulbPowerAnimationEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, powerAnimationEnabled: enabled },
    }))
  },

  setMandelbulbPowerMin: (min) => {
    // Range 2.0 to 16.0 (expanded for more variety)
    const clampedMin = Math.max(2.0, Math.min(16.0, min))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, powerMin: clampedMin },
    }))
  },

  setMandelbulbPowerMax: (max) => {
    // Range 3.0 to 24.0 (expanded for more variety)
    const clampedMax = Math.max(3.0, Math.min(24.0, max))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, powerMax: clampedMax },
    }))
  },

  setMandelbulbPowerSpeed: (speed) => {
    // Range 0.01 to 0.2 (very slow for organic wandering)
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, powerSpeed: clampedSpeed },
    }))
  },

  // --- Alternate Power Actions (Technique B variant) ---
  setMandelbulbAlternatePowerEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, alternatePowerEnabled: enabled },
    }))
  },

  setMandelbulbAlternatePowerValue: (power) => {
    // Range 2.0 to 16.0
    const clampedPower = Math.max(2.0, Math.min(16.0, power))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, alternatePowerValue: clampedPower },
    }))
  },

  setMandelbulbAlternatePowerBlend: (blend) => {
    // Range 0.0 to 1.0
    const clampedBlend = Math.max(0.0, Math.min(1.0, blend))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, alternatePowerBlend: clampedBlend },
    }))
  },

  // --- Dimension Mixing Actions (Technique A) ---
  setMandelbulbDimensionMixEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, dimensionMixEnabled: enabled },
    }))
  },

  setMandelbulbMixIntensity: (intensity) => {
    // Range 0.0 to 0.3
    const clampedIntensity = Math.max(0.0, Math.min(0.3, intensity))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, mixIntensity: clampedIntensity },
    }))
  },

  setMandelbulbMixFrequency: (frequency) => {
    // Range 0.1 to 2.0
    const clampedFrequency = Math.max(0.1, Math.min(2.0, frequency))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, mixFrequency: clampedFrequency },
    }))
  },

  // --- Origin Drift Actions (Technique C) ---
  setMandelbulbOriginDriftEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, originDriftEnabled: enabled },
    }))
  },

  setMandelbulbDriftAmplitude: (amplitude) => {
    // Range 0.01 to 0.5
    const clampedAmplitude = Math.max(0.01, Math.min(0.5, amplitude))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, driftAmplitude: clampedAmplitude },
    }))
  },

  setMandelbulbDriftBaseFrequency: (frequency) => {
    // Range 0.01 to 0.5 (allow very slow animations to avoid jitter)
    const clampedFrequency = Math.max(0.01, Math.min(0.5, frequency))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, driftBaseFrequency: clampedFrequency },
    }))
  },

  setMandelbulbDriftFrequencySpread: (spread) => {
    // Range 0.0 to 1.0
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, driftFrequencySpread: clampedSpread },
    }))
  },

  // --- Slice Animation Actions (4D+ only) ---
  setMandelbulbSliceAnimationEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sliceAnimationEnabled: enabled },
    }))
  },

  setMandelbulbSliceSpeed: (speed) => {
    // Range 0.01 to 0.1
    const clampedSpeed = Math.max(0.01, Math.min(0.1, speed))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sliceSpeed: clampedSpeed },
    }))
  },

  setMandelbulbSliceAmplitude: (amplitude) => {
    // Range 0.1 to 1.0
    const clampedAmplitude = Math.max(0.1, Math.min(1.0, amplitude))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sliceAmplitude: clampedAmplitude },
    }))
  },

  // --- Angular Phase Shifts Actions ---
  setMandelbulbPhaseShiftEnabled: (enabled) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, phaseShiftEnabled: enabled },
    }))
  },

  setMandelbulbPhaseSpeed: (speed) => {
    // Range 0.01 to 0.2
    const clampedSpeed = Math.max(0.01, Math.min(0.2, speed))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, phaseSpeed: clampedSpeed },
    }))
  },

  setMandelbulbPhaseAmplitude: (amplitude) => {
    // Range 0.0 to PI/4 (~0.785)
    const clampedAmplitude = Math.max(0.0, Math.min(Math.PI / 4, amplitude))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, phaseAmplitude: clampedAmplitude },
    }))
  },

  // --- Zoom Settings Actions ---
  setMandelbulbZoomEnabled: (enabled: boolean) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoomEnabled: enabled },
    }))
  },

  setMandelbulbZoom: (zoom: number) => {
    // Range 0.001 to 1000000
    const clampedZoom = Math.max(0.001, Math.min(1000000, zoom))
    const logZoom = Math.log(clampedZoom)
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoom: clampedZoom, logZoom },
    }))
  },

  setMandelbulbLogZoom: (logZoom: number) => {
    // Range -6.9 (0.001) to 13.8 (1000000)
    const clampedLogZoom = Math.max(-6.9, Math.min(13.8, logZoom))
    const zoom = Math.exp(clampedLogZoom)
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, logZoom: clampedLogZoom, zoom },
    }))
  },

  setMandelbulbZoomSpeed: (speed: number) => {
    // Range 0.1 to 2.0
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoomSpeed: clampedSpeed },
    }))
  },

  // --- Zoom Animation Actions ---
  setMandelbulbZoomAnimationEnabled: (enabled: boolean) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoomAnimationEnabled: enabled },
    }))
  },

  setMandelbulbZoomAnimationMode: (mode: 'continuous' | 'target') => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoomAnimationMode: mode },
    }))
  },

  setMandelbulbZoomTargetLevel: (level: number) => {
    // Range 1 to 1000000
    const clampedLevel = Math.max(1, Math.min(1000000, level))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, zoomTargetLevel: clampedLevel },
    }))
  },

  // --- Autopilot Actions ---
  setMandelbulbAutopilotEnabled: (enabled: boolean) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, autopilotEnabled: enabled },
    }))
  },

  setMandelbulbAutopilotStrategy: (strategy: MandelbulbAutopilotStrategy) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, autopilotStrategy: strategy },
    }))
  },

  // --- Strategy A: Center-Ray Lock Actions ---
  setMandelbulbCenterRayProbeSize: (size: number) => {
    // Only allow 1, 4, or 16
    const validSizes: (1 | 4 | 16)[] = [1, 4, 16]
    const closestSize = validSizes.reduce((prev, curr) =>
      Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
    )
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, centerRayProbeSize: closestSize },
    }))
  },

  setMandelbulbCenterRayProbeFrequency: (frequency: number) => {
    // Range 10 to 30 Hz
    const clampedFrequency = Math.max(10, Math.min(30, frequency))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, centerRayProbeFrequency: clampedFrequency },
    }))
  },

  setMandelbulbCenterRayMissThreshold: (threshold: number) => {
    // Range 0 to 1
    const clampedThreshold = Math.max(0, Math.min(1, threshold))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, centerRayMissThreshold: clampedThreshold },
    }))
  },

  setMandelbulbCenterRayNudgeStrength: (strength: number) => {
    // Range 0 to 0.1
    const clampedStrength = Math.max(0, Math.min(0.1, strength))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, centerRayNudgeStrength: clampedStrength },
    }))
  },

  // --- Strategy B: Interest Score Actions ---
  setMandelbulbInterestScoreResolution: (resolution: number) => {
    // Only allow 32, 64, or 128
    const validResolutions: (32 | 64 | 128)[] = [32, 64, 128]
    const closestResolution = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - resolution) < Math.abs(prev - resolution) ? curr : prev
    )
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interestScoreResolution: closestResolution },
    }))
  },

  setMandelbulbInterestScoreInterval: (interval: number) => {
    // Range 1 to 120 frames
    const clampedInterval = Math.max(1, Math.min(120, Math.floor(interval)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interestScoreInterval: clampedInterval },
    }))
  },

  setMandelbulbInterestScoreCandidates: (candidates: number) => {
    // Range 2 to 8
    const clampedCandidates = Math.max(2, Math.min(8, Math.floor(candidates)))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interestScoreCandidates: clampedCandidates },
    }))
  },

  setMandelbulbInterestScoreNudgeRadius: (radius: number) => {
    // Range 0.01 to 0.2
    const clampedRadius = Math.max(0.01, Math.min(0.2, radius))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interestScoreNudgeRadius: clampedRadius },
    }))
  },

  setMandelbulbInterestScoreMetric: (metric: 'hitRatio' | 'variance' | 'edgeStrength') => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, interestScoreMetric: metric },
    }))
  },

  // --- Strategy C: Boundary Target Actions ---
  setMandelbulbBoundaryTargetEscapeRatio: (ratio: number) => {
    // Range 0 to 1
    const clampedRatio = Math.max(0, Math.min(1, ratio))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, boundaryTargetEscapeRatio: clampedRatio },
    }))
  },

  setMandelbulbBoundaryTargetBand: (band: number) => {
    // Range 0.1 to 0.3
    const clampedBand = Math.max(0.1, Math.min(0.3, band))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, boundaryTargetBand: clampedBand },
    }))
  },

  setMandelbulbBoundaryTargetCorrectionStrength: (strength: number) => {
    // Range 0.01 to 0.1
    const clampedStrength = Math.max(0.01, Math.min(0.1, strength))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, boundaryTargetCorrectionStrength: clampedStrength },
    }))
  },

  // --- Zoom Reset Action ---
  resetMandelbulbZoom: () => {
    set((state) => ({
      mandelbulb: {
        ...state.mandelbulb,
        zoomEnabled: false,
        zoom: 1.0,
        logZoom: 0,
        zoomSpeed: 0.5,
        zoomAnimationEnabled: false,
        zoomAnimationMode: 'continuous',
        zoomTargetLevel: 10.0,
        autopilotEnabled: false,
        autopilotStrategy: 'centerRayLock',
      },
    }))
  },

  // --- Advanced Rendering Actions ---
  setMandelbulbRoughness: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, roughness: clamped },
    }))
  },

  setMandelbulbSssEnabled: (value) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sssEnabled: value },
    }))
  },

  setMandelbulbSssIntensity: (value) => {
    const clamped = Math.max(0.0, Math.min(2.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sssIntensity: clamped },
    }))
  },

  setMandelbulbSssColor: (value) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sssColor: value },
    }))
  },

  setMandelbulbSssThickness: (value) => {
    const clamped = Math.max(0.1, Math.min(5.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, sssThickness: clamped },
    }))
  },

  // --- Atmosphere Actions ---
  setMandelbulbFogEnabled: (value) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, fogEnabled: value },
    }))
  },

  setMandelbulbFogContribution: (value) => {
    const clamped = Math.max(0.0, Math.min(2.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, fogContribution: clamped },
    }))
  },

  setMandelbulbInternalFogDensity: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, internalFogDensity: clamped },
    }))
  },

  // --- LOD Actions ---
  setMandelbulbLodEnabled: (value) => {
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, lodEnabled: value },
    }))
  },

  setMandelbulbLodDetail: (value) => {
    const clamped = Math.max(0.1, Math.min(2.0, value))
    set((state) => ({
      mandelbulb: { ...state.mandelbulb, lodDetail: clamped },
    }))
  },
})
