/**
 * Extended Object State Management using Zustand
 *
 * Manages parameters for all object types including:
 * - Polytopes (hypercube, simplex, cross-polytope) - scale configuration
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbrot Set (n-dimensional fractal)
 * - Mandelbox (n-dimensional box fractal)
 *
 * The unified configuration ensures visual consistency across all object types.
 *
 * @see docs/prd/extended-objects.md
 * @see docs/research/nd-extended-objects-guide.md
 */

import type {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  CliffordTorusVisualizationMode,
  MandelboxConfig,
  MandelbrotColorMode,
  MandelbrotConfig,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
  MengerConfig,
  PolytopeConfig,
  RootSystemConfig,
  RootSystemType,
} from '@/lib/geometry/extended/types'
import {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_MANDELBOX_CONFIG,
  DEFAULT_MANDELBROT_CONFIG,
  DEFAULT_MENGER_CONFIG,
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_POLYTOPE_SCALES,
  DEFAULT_ROOT_SYSTEM_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
} from '@/lib/geometry/extended/types'
import { create } from 'zustand'

// ============================================================================
// State Interface
// ============================================================================

interface ExtendedObjectState {
  // --- Polytope State (for unified scale control) ---
  polytope: PolytopeConfig

  // --- Root System State ---
  rootSystem: RootSystemConfig

  // --- Clifford Torus State ---
  cliffordTorus: CliffordTorusConfig

  // --- Mandelbrot State ---
  mandelbrot: MandelbrotConfig

  // --- Mandelbox State ---
  mandelbox: MandelboxConfig

  // --- Menger State ---
  menger: MengerConfig

  // --- Polytope Actions ---
  setPolytopeScale: (scale: number) => void
  initializePolytopeForType: (polytopeType: string) => void

  // --- Root System Actions ---
  setRootSystemType: (type: RootSystemType) => void
  setRootSystemScale: (scale: number) => void

  // --- Clifford Torus Actions ---
  // Visualization mode
  setCliffordTorusVisualizationMode: (mode: CliffordTorusVisualizationMode) => void
  initializeCliffordTorusForDimension: (dimension: number) => void

  // Shared
  setCliffordTorusRadius: (radius: number) => void
  setCliffordTorusEdgeMode: (mode: CliffordTorusEdgeMode) => void

  // Flat mode (existing)
  setCliffordTorusMode: (mode: CliffordTorusMode) => void
  setCliffordTorusResolutionU: (resolution: number) => void
  setCliffordTorusResolutionV: (resolution: number) => void
  setCliffordTorusK: (k: number) => void
  setCliffordTorusStepsPerCircle: (steps: number) => void

  // Nested (Hopf) 4D mode
  setCliffordTorusEta: (eta: number) => void
  setCliffordTorusResolutionXi1: (resolution: number) => void
  setCliffordTorusResolutionXi2: (resolution: number) => void
  setCliffordTorusShowNestedTori: (show: boolean) => void
  setCliffordTorusNumberOfTori: (count: number) => void

  // Nested (Hopf) 8D mode
  setCliffordTorusFiberResolution: (resolution: number) => void
  setCliffordTorusBaseResolution: (resolution: number) => void
  setCliffordTorusShowFiberStructure: (show: boolean) => void

  // --- Mandelbrot Actions ---
  setMandelbrotMaxIterations: (value: number) => void
  setMandelbrotEscapeRadius: (value: number) => void
  setMandelbrotQualityPreset: (preset: MandelbrotQualityPreset) => void
  setMandelbrotResolution: (value: number) => void
  setMandelbrotVisualizationAxes: (axes: [number, number, number]) => void
  setMandelbrotVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => void
  setMandelbrotParameterValue: (dimIndex: number, value: number) => void
  setMandelbrotParameterValues: (values: number[]) => void
  resetMandelbrotParameters: () => void
  setMandelbrotCenter: (center: number[]) => void
  setMandelbrotExtent: (extent: number) => void
  fitMandelbrotToView: () => void
  setMandelbrotColorMode: (mode: MandelbrotColorMode) => void
  setMandelbrotPalette: (palette: MandelbrotPalette) => void
  setMandelbrotCustomPalette: (palette: { start: string; mid: string; end: string }) => void
  setMandelbrotInvertColors: (invert: boolean) => void
  setMandelbrotInteriorColor: (color: string) => void
  setMandelbrotPaletteCycles: (cycles: number) => void
  setMandelbrotRenderStyle: (style: MandelbrotRenderStyle) => void
  setMandelbrotPointSize: (size: number) => void
  setMandelbrotBoundaryThreshold: (threshold: [number, number]) => void
  setMandelbrotMandelbulbPower: (power: number) => void
  initializeMandelbrotForDimension: (dimension: number) => void
  getMandelbrotConfig: () => MandelbrotConfig

  // --- Mandelbox Actions ---
  setMandelboxScale: (scale: number) => void
  setMandelboxFoldingLimit: (limit: number) => void
  setMandelboxMinRadius: (radius: number) => void
  setMandelboxFixedRadius: (radius: number) => void
  setMandelboxMaxIterations: (iterations: number) => void
  setMandelboxEscapeRadius: (radius: number) => void
  setMandelboxIterationRotation: (rotation: number) => void
  setMandelboxParameterValue: (dimIndex: number, value: number) => void
  setMandelboxParameterValues: (values: number[]) => void
  resetMandelboxParameters: () => void
  initializeMandelboxForDimension: (dimension: number) => void
  getMandelboxConfig: () => MandelboxConfig
  // Scale Animation Actions
  setMandelboxScaleAnimationEnabled: (enabled: boolean) => void
  setMandelboxScaleCenter: (center: number) => void
  setMandelboxScaleAmplitude: (amplitude: number) => void
  setMandelboxScaleSpeed: (speed: number) => void
  // Julia Mode Actions
  setMandelboxJuliaMode: (enabled: boolean) => void
  setMandelboxJuliaSpeed: (speed: number) => void
  setMandelboxJuliaRadius: (radius: number) => void

  // --- Menger Actions ---
  setMengerIterations: (iterations: number) => void
  setMengerScale: (scale: number) => void
  setMengerParameterValue: (dimIndex: number, value: number) => void
  setMengerParameterValues: (values: number[]) => void
  resetMengerParameters: () => void
  initializeMengerForDimension: (dimension: number) => void
  getMengerConfig: () => MengerConfig
  // Fold Twist Animation Actions
  setMengerFoldTwistEnabled: (enabled: boolean) => void
  setMengerFoldTwistAngle: (angle: number) => void
  setMengerFoldTwistSpeed: (speed: number) => void
  // Scale Pulse Animation Actions
  setMengerScalePulseEnabled: (enabled: boolean) => void
  setMengerScalePulseAmplitude: (amplitude: number) => void
  setMengerScalePulseSpeed: (speed: number) => void
  // Slice Sweep Animation Actions
  setMengerSliceSweepEnabled: (enabled: boolean) => void
  setMengerSliceSweepAmplitude: (amplitude: number) => void
  setMengerSliceSweepSpeed: (speed: number) => void

  // --- Reset Action ---
  reset: () => void
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useExtendedObjectStore = create<ExtendedObjectState>((set, get) => ({
  // --- Initial State ---
  polytope: { ...DEFAULT_POLYTOPE_CONFIG },
  rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG },
  cliffordTorus: { ...DEFAULT_CLIFFORD_TORUS_CONFIG },
  mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },
  mandelbox: { ...DEFAULT_MANDELBOX_CONFIG },
  menger: { ...DEFAULT_MENGER_CONFIG },

  // --- Polytope Actions ---
  setPolytopeScale: (scale: number) => {
    // Range 0.5-8.0 to accommodate different polytope types (simplex needs up to 8)
    const clampedScale = Math.max(0.5, Math.min(8.0, scale))
    set((state) => ({
      polytope: { ...state.polytope, scale: clampedScale },
    }))
  },

  initializePolytopeForType: (polytopeType: string) => {
    const defaultScale = DEFAULT_POLYTOPE_SCALES[polytopeType] ?? DEFAULT_POLYTOPE_CONFIG.scale
    set((state) => ({
      polytope: { ...state.polytope, scale: defaultScale },
    }))
  },

  // --- Root System Actions ---
  setRootSystemType: (type: RootSystemType) => {
    set((state) => ({
      rootSystem: { ...state.rootSystem, rootType: type },
    }))
  },

  setRootSystemScale: (scale: number) => {
    const clampedScale = Math.max(0.5, Math.min(4.0, scale))
    set((state) => ({
      rootSystem: { ...state.rootSystem, scale: clampedScale },
    }))
  },

  // --- Clifford Torus Actions ---
  setCliffordTorusMode: (mode: CliffordTorusMode) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, mode },
    }))
  },

  setCliffordTorusRadius: (radius: number) => {
    const clampedRadius = Math.max(0.5, Math.min(6.0, radius))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, radius: clampedRadius },
    }))
  },

  setCliffordTorusResolutionU: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionU: clampedResolution },
    }))
  },

  setCliffordTorusResolutionV: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionV: clampedResolution },
    }))
  },

  setCliffordTorusEdgeMode: (mode: CliffordTorusEdgeMode) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, edgeMode: mode },
    }))
  },

  setCliffordTorusK: (k: number) => {
    // k must be at least 1 (for a circle), no upper limit here - validated at generation time
    const clampedK = Math.max(1, Math.floor(k))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, k: clampedK },
    }))
  },

  setCliffordTorusStepsPerCircle: (steps: number) => {
    // Reasonable range: 4-64 steps per circle (total points = steps^k)
    const clampedSteps = Math.max(4, Math.min(64, Math.floor(steps)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, stepsPerCircle: clampedSteps },
    }))
  },

  // --- Clifford Torus Visualization Mode Actions ---
  setCliffordTorusVisualizationMode: (mode: CliffordTorusVisualizationMode) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, visualizationMode: mode },
    }))
  },

  initializeCliffordTorusForDimension: (dimension: number) => {
    const current = get().cliffordTorus
    const currentMode = current.visualizationMode

    // Auto-switch logic: if current mode is not available for this dimension, switch to 'flat'
    let newMode = currentMode

    // Nested mode only available in 4D and 8D
    if (currentMode === 'nested' && dimension !== 4 && dimension !== 8) {
      newMode = 'flat'
    }

    // Update flat mode internal settings based on dimension
    const flatMode = dimension === 4 ? 'classic' : 'generalized'

    // Check if any values actually changed to avoid unnecessary state updates
    const modeChanged = newMode !== currentMode
    const flatModeChanged = flatMode !== current.mode

    // Only update if something actually changed
    if (modeChanged || flatModeChanged) {
      set((state) => ({
        cliffordTorus: {
          ...state.cliffordTorus,
          visualizationMode: newMode,
          mode: flatMode,
        },
      }))
    }

    // Return whether mode was auto-switched (for notification purposes)
    return modeChanged
  },

  // --- Nested (Hopf) 4D Mode Actions ---
  setCliffordTorusEta: (eta: number) => {
    // Range: π/64 to π/2 - π/64 (approximately 0.05 to 1.52)
    const minEta = Math.PI / 64
    const maxEta = Math.PI / 2 - Math.PI / 64
    const clampedEta = Math.max(minEta, Math.min(maxEta, eta))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, eta: clampedEta },
    }))
  },

  setCliffordTorusResolutionXi1: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionXi1: clampedResolution },
    }))
  },

  setCliffordTorusResolutionXi2: (resolution: number) => {
    const clampedResolution = Math.max(8, Math.min(128, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, resolutionXi2: clampedResolution },
    }))
  },

  setCliffordTorusShowNestedTori: (show: boolean) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, showNestedTori: show },
    }))
  },

  setCliffordTorusNumberOfTori: (count: number) => {
    const clampedCount = Math.max(2, Math.min(5, Math.floor(count)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, numberOfTori: clampedCount },
    }))
  },

  // --- Nested (Hopf) 8D Mode Actions ---
  // NOTE: Face count = fiberRes³ × baseRes² - limits kept low to avoid memory issues
  // Max safe: 8³ × 12² = 512 × 144 = 73,728 faces
  setCliffordTorusFiberResolution: (resolution: number) => {
    const clampedResolution = Math.max(4, Math.min(8, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, fiberResolution: clampedResolution },
    }))
  },

  setCliffordTorusBaseResolution: (resolution: number) => {
    const clampedResolution = Math.max(4, Math.min(12, Math.floor(resolution)))
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, baseResolution: clampedResolution },
    }))
  },

  setCliffordTorusShowFiberStructure: (show: boolean) => {
    set((state) => ({
      cliffordTorus: { ...state.cliffordTorus, showFiberStructure: show },
    }))
  },

  // --- Mandelbrot Actions ---
  setMandelbrotMaxIterations: (value: number) => {
    const clampedValue = Math.max(10, Math.min(500, Math.floor(value)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, maxIterations: clampedValue },
    }))
  },

  setMandelbrotEscapeRadius: (value: number) => {
    // Extended range to 16 for higher-dimensional Hyperbulb stability
    const clampedValue = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, escapeRadius: clampedValue },
    }))
  },

  setMandelbrotQualityPreset: (preset: MandelbrotQualityPreset) => {
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

  setMandelbrotResolution: (value: number) => {
    // Valid resolutions: 16, 24, 32, 48, 64, 96, 128
    const validResolutions = [16, 24, 32, 48, 64, 96, 128]
    const closest = validResolutions.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, resolution: closest },
    }))
  },

  setMandelbrotVisualizationAxes: (axes: [number, number, number]) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: axes },
    }))
  },

  setMandelbrotVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => {
    // Validate dimIndex to valid range [0, MAX_DIMENSION-1]
    // MAX_DIMENSION is 11, so valid indices are 0-10 (representing X through 11th axis)
    const clampedDimIndex = Math.max(0, Math.min(10, Math.floor(dimIndex)))
    const current = [...get().mandelbrot.visualizationAxes] as [number, number, number]
    current[index] = clampedDimIndex
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, visualizationAxes: current },
    }))
  },

  setMandelbrotParameterValue: (dimIndex: number, value: number) => {
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

  setMandelbrotParameterValues: (values: number[]) => {
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

  setMandelbrotCenter: (center: number[]) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, center },
    }))
  },

  setMandelbrotExtent: (extent: number) => {
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

  setMandelbrotColorMode: (mode: MandelbrotColorMode) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, colorMode: mode },
    }))
  },

  setMandelbrotPalette: (palette: MandelbrotPalette) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, palette },
    }))
  },

  setMandelbrotCustomPalette: (palette: { start: string; mid: string; end: string }) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, customPalette: palette },
    }))
  },

  setMandelbrotInvertColors: (invert: boolean) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, invertColors: invert },
    }))
  },

  setMandelbrotInteriorColor: (color: string) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, interiorColor: color },
    }))
  },

  setMandelbrotPaletteCycles: (cycles: number) => {
    const clampedCycles = Math.max(1, Math.min(20, Math.floor(cycles)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, paletteCycles: clampedCycles },
    }))
  },

  setMandelbrotRenderStyle: (style: MandelbrotRenderStyle) => {
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, renderStyle: style },
    }))
  },

  setMandelbrotPointSize: (size: number) => {
    const clampedSize = Math.max(1, Math.min(20, size))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, pointSize: clampedSize },
    }))
  },

  setMandelbrotBoundaryThreshold: (threshold: [number, number]) => {
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

  setMandelbrotMandelbulbPower: (power: number) => {
    // Clamp power to reasonable range (2-16)
    const clampedPower = Math.max(2, Math.min(16, Math.floor(power)))
    set((state) => ({
      mandelbrot: { ...state.mandelbrot, mandelbulbPower: clampedPower },
    }))
  },

  initializeMandelbrotForDimension: (dimension: number) => {
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

  getMandelbrotConfig: (): MandelbrotConfig => {
    return { ...get().mandelbrot }
  },

  // --- Mandelbox Actions ---
  setMandelboxScale: (scale: number) => {
    // Range -3.0 to 3.0 for various fractal characters
    const clampedScale = Math.max(-3.0, Math.min(3.0, scale))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scale: clampedScale },
    }))
  },

  setMandelboxFoldingLimit: (limit: number) => {
    // Range 0.5 to 2.0
    const clampedLimit = Math.max(0.5, Math.min(2.0, limit))
    set((state) => ({
      mandelbox: { ...state.mandelbox, foldingLimit: clampedLimit },
    }))
  },

  setMandelboxMinRadius: (radius: number) => {
    // Range 0.1 to 1.0
    const clampedRadius = Math.max(0.1, Math.min(1.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, minRadius: clampedRadius },
    }))
  },

  setMandelboxFixedRadius: (radius: number) => {
    // Range 0.5 to 2.0
    const clampedRadius = Math.max(0.5, Math.min(2.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, fixedRadius: clampedRadius },
    }))
  },

  setMandelboxMaxIterations: (iterations: number) => {
    // Range 10 to 100
    const clampedIterations = Math.max(10, Math.min(100, Math.floor(iterations)))
    set((state) => ({
      mandelbox: { ...state.mandelbox, maxIterations: clampedIterations },
    }))
  },

  setMandelboxEscapeRadius: (radius: number) => {
    // Range 4.0 to 100.0
    const clampedRadius = Math.max(4.0, Math.min(100.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, escapeRadius: clampedRadius },
    }))
  },

  setMandelboxIterationRotation: (rotation: number) => {
    // Range 0.0 to 0.5 radians (0 to ~28.6 degrees per iteration)
    const clampedRotation = Math.max(0.0, Math.min(0.5, rotation))
    set((state) => ({
      mandelbox: { ...state.mandelbox, iterationRotation: clampedRotation },
    }))
  },

  setMandelboxParameterValue: (dimIndex: number, value: number) => {
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

  setMandelboxParameterValues: (values: number[]) => {
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

  initializeMandelboxForDimension: (dimension: number) => {
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

  getMandelboxConfig: (): MandelboxConfig => {
    return { ...get().mandelbox }
  },

  // --- Scale Animation Actions ---
  setMandelboxScaleAnimationEnabled: (enabled: boolean) => {
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleAnimationEnabled: enabled },
    }))
  },

  setMandelboxScaleCenter: (center: number) => {
    // Range -3.0 to 3.0 (same as scale)
    const clampedCenter = Math.max(-3.0, Math.min(3.0, center))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleCenter: clampedCenter },
    }))
  },

  setMandelboxScaleAmplitude: (amplitude: number) => {
    // Range 0.0 to 1.5
    const clampedAmplitude = Math.max(0.0, Math.min(1.5, amplitude))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleAmplitude: clampedAmplitude },
    }))
  },

  setMandelboxScaleSpeed: (speed: number) => {
    // Range 0.1 to 2.0
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      mandelbox: { ...state.mandelbox, scaleSpeed: clampedSpeed },
    }))
  },

  // --- Julia Mode Actions ---
  setMandelboxJuliaMode: (enabled: boolean) => {
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaMode: enabled },
    }))
  },

  setMandelboxJuliaSpeed: (speed: number) => {
    // Range 0.1 to 2.0
    const clampedSpeed = Math.max(0.1, Math.min(2.0, speed))
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaSpeed: clampedSpeed },
    }))
  },

  setMandelboxJuliaRadius: (radius: number) => {
    // Range 0.5 to 2.0
    const clampedRadius = Math.max(0.5, Math.min(10.0, radius))
    set((state) => ({
      mandelbox: { ...state.mandelbox, juliaRadius: clampedRadius },
    }))
  },

  // --- Menger Actions ---
  setMengerIterations: (iterations: number) => {
    // Range 3 to 8 (higher values are very expensive)
    const clampedIterations = Math.max(3, Math.min(8, Math.floor(iterations)))
    set((state) => ({
      menger: { ...state.menger, iterations: clampedIterations },
    }))
  },

  setMengerScale: (scale: number) => {
    // Range 0.5 to 2.0
    const clampedScale = Math.max(0.5, Math.min(2.0, scale))
    set((state) => ({
      menger: { ...state.menger, scale: clampedScale },
    }))
  },

  setMengerParameterValue: (dimIndex: number, value: number) => {
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

  setMengerParameterValues: (values: number[]) => {
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

  initializeMengerForDimension: (dimension: number) => {
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

  getMengerConfig: (): MengerConfig => {
    return { ...get().menger }
  },

  // --- Fold Twist Animation Actions ---
  setMengerFoldTwistEnabled: (enabled: boolean) => {
    set((state) => ({
      menger: { ...state.menger, foldTwistEnabled: enabled },
    }))
  },

  setMengerFoldTwistAngle: (angle: number) => {
    // Range -π to π
    const clampedAngle = Math.max(-Math.PI, Math.min(Math.PI, angle))
    set((state) => ({
      menger: { ...state.menger, foldTwistAngle: clampedAngle },
    }))
  },

  setMengerFoldTwistSpeed: (speed: number) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, foldTwistSpeed: clampedSpeed },
    }))
  },

  // --- Scale Pulse Animation Actions ---
  setMengerScalePulseEnabled: (enabled: boolean) => {
    set((state) => ({
      menger: { ...state.menger, scalePulseEnabled: enabled },
    }))
  },

  setMengerScalePulseAmplitude: (amplitude: number) => {
    // Range 0 to 0.5
    const clampedAmplitude = Math.max(0, Math.min(0.5, amplitude))
    set((state) => ({
      menger: { ...state.menger, scalePulseAmplitude: clampedAmplitude },
    }))
  },

  setMengerScalePulseSpeed: (speed: number) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, scalePulseSpeed: clampedSpeed },
    }))
  },

  // --- Slice Sweep Animation Actions ---
  setMengerSliceSweepEnabled: (enabled: boolean) => {
    set((state) => ({
      menger: { ...state.menger, sliceSweepEnabled: enabled },
    }))
  },

  setMengerSliceSweepAmplitude: (amplitude: number) => {
    // Range 0 to 2
    const clampedAmplitude = Math.max(0, Math.min(2, amplitude))
    set((state) => ({
      menger: { ...state.menger, sliceSweepAmplitude: clampedAmplitude },
    }))
  },

  setMengerSliceSweepSpeed: (speed: number) => {
    // Range 0 to 2
    const clampedSpeed = Math.max(0, Math.min(2, speed))
    set((state) => ({
      menger: { ...state.menger, sliceSweepSpeed: clampedSpeed },
    }))
  },

  // --- Reset Action ---
  reset: () => {
    set({
      polytope: { ...DEFAULT_POLYTOPE_CONFIG },
      rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG },
      cliffordTorus: { ...DEFAULT_CLIFFORD_TORUS_CONFIG },
      mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },
      mandelbox: { ...DEFAULT_MANDELBOX_CONFIG },
      menger: { ...DEFAULT_MENGER_CONFIG },
    })
  },
}))
