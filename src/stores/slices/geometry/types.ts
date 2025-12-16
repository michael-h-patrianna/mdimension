import {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  MandelbrotColorMode,
  MandelbrotConfig,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
  NestedTorusConfig,
  NestedTorusEdgeMode,
  PolytopeConfig,
  QuaternionJuliaConfig,
  RootSystemConfig,
  RootSystemType,
} from '@/lib/geometry/extended/types'

// ============================================================================
// Polytope Slice
// ============================================================================
export interface PolytopeSliceState {
  polytope: PolytopeConfig
}

export interface PolytopeSliceActions {
  setPolytopeScale: (scale: number) => void
  initializePolytopeForType: (polytopeType: string) => void
}

export type PolytopeSlice = PolytopeSliceState & PolytopeSliceActions

// ============================================================================
// Root System Slice
// ============================================================================
export interface RootSystemSliceState {
  rootSystem: RootSystemConfig
}

export interface RootSystemSliceActions {
  setRootSystemType: (type: RootSystemType) => void
  setRootSystemScale: (scale: number) => void
}

export type RootSystemSlice = RootSystemSliceState & RootSystemSliceActions

// ============================================================================
// Clifford Torus Slice
// ============================================================================
export interface CliffordTorusSliceState {
  cliffordTorus: CliffordTorusConfig
}

export interface CliffordTorusSliceActions {
  setCliffordTorusRadius: (radius: number) => void
  setCliffordTorusEdgeMode: (mode: CliffordTorusEdgeMode) => void
  setCliffordTorusMode: (mode: CliffordTorusMode) => void
  setCliffordTorusResolutionU: (resolution: number) => void
  setCliffordTorusResolutionV: (resolution: number) => void
  setCliffordTorusStepsPerCircle: (steps: number) => void
  initializeCliffordTorusForDimension: (dimension: number) => void
}

export type CliffordTorusSlice = CliffordTorusSliceState & CliffordTorusSliceActions

// ============================================================================
// Nested Torus Slice
// ============================================================================
export interface NestedTorusSliceState {
  nestedTorus: NestedTorusConfig
}

export interface NestedTorusSliceActions {
  setNestedTorusRadius: (radius: number) => void
  setNestedTorusEdgeMode: (mode: NestedTorusEdgeMode) => void
  setNestedTorusEta: (eta: number) => void
  setNestedTorusResolutionXi1: (resolution: number) => void
  setNestedTorusResolutionXi2: (resolution: number) => void
  setNestedTorusShowNestedTori: (show: boolean) => void
  setNestedTorusNumberOfTori: (count: number) => void
  setNestedTorusFiberResolution: (resolution: number) => void
  setNestedTorusBaseResolution: (resolution: number) => void
  setNestedTorusShowFiberStructure: (show: boolean) => void
}

export type NestedTorusSlice = NestedTorusSliceState & NestedTorusSliceActions

// ============================================================================
// Mandelbrot Slice
// ============================================================================
export interface MandelbrotSliceState {
  mandelbrot: MandelbrotConfig
}

export interface MandelbrotSliceActions {
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
  setMandelbrotConfig: (config: Partial<MandelbrotConfig>) => void
  initializeMandelbrotForDimension: (dimension: number) => void
  getMandelbrotConfig: () => MandelbrotConfig
  // Power Animation (Hyperbulb-specific)
  setMandelbrotPowerAnimationEnabled: (enabled: boolean) => void
  setMandelbrotPowerMin: (min: number) => void
  setMandelbrotPowerMax: (max: number) => void
  setMandelbrotPowerSpeed: (speed: number) => void
  // Alternate Power (Technique B variant)
  setMandelbrotAlternatePowerEnabled: (enabled: boolean) => void
  setMandelbrotAlternatePowerValue: (power: number) => void
  setMandelbrotAlternatePowerBlend: (blend: number) => void
  // Dimension Mixing (Technique A)
  setMandelbrotDimensionMixEnabled: (enabled: boolean) => void
  setMandelbrotMixIntensity: (intensity: number) => void
  setMandelbrotMixFrequency: (frequency: number) => void
  // Origin Drift (Technique C)
  setMandelbrotOriginDriftEnabled: (enabled: boolean) => void
  setMandelbrotDriftAmplitude: (amplitude: number) => void
  setMandelbrotDriftBaseFrequency: (frequency: number) => void
  setMandelbrotDriftFrequencySpread: (spread: number) => void
  // Slice Animation (4D+ only)
  setMandelbrotSliceAnimationEnabled: (enabled: boolean) => void
  setMandelbrotSliceSpeed: (speed: number) => void
  setMandelbrotSliceAmplitude: (amplitude: number) => void
  // Julia Morphing
  setMandelbrotJuliaModeEnabled: (enabled: boolean) => void
  setMandelbrotJuliaOrbitSpeed: (speed: number) => void
  setMandelbrotJuliaOrbitRadius: (radius: number) => void
  // Angular Phase Shifts
  setMandelbrotPhaseShiftEnabled: (enabled: boolean) => void
  setMandelbrotPhaseSpeed: (speed: number) => void
  setMandelbrotPhaseAmplitude: (amplitude: number) => void
}

export type MandelbrotSlice = MandelbrotSliceState & MandelbrotSliceActions

// ============================================================================
// Quaternion Julia Slice
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
  // Julia constant animation
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
  // Power animation
  setQuaternionJuliaPowerAnimationEnabled: (value: boolean) => void
  setQuaternionJuliaPowerAnimationMinPower: (value: number) => void
  setQuaternionJuliaPowerAnimationMaxPower: (value: number) => void
  setQuaternionJuliaPowerAnimationSpeed: (value: number) => void
  // Origin drift
  setQuaternionJuliaOriginDriftEnabled: (value: boolean) => void
  setQuaternionJuliaOriginDriftAmplitude: (value: number) => void
  setQuaternionJuliaOriginDriftBaseFrequency: (value: number) => void
  setQuaternionJuliaOriginDriftFrequencySpread: (value: number) => void
  // Dimension mixing
  setQuaternionJuliaDimensionMixEnabled: (value: boolean) => void
  setQuaternionJuliaMixIntensity: (value: number) => void
  setQuaternionJuliaMixFrequency: (value: number) => void
  // Utility
  getQuaternionJuliaConfig: () => QuaternionJuliaConfig
  randomizeJuliaConstant: () => void
}

export type QuaternionJuliaSlice = QuaternionJuliaSliceState & QuaternionJuliaSliceActions

// ============================================================================
// Combined Extended Object Slice
// ============================================================================
export type ExtendedObjectSlice = PolytopeSlice &
  RootSystemSlice &
  CliffordTorusSlice &
  NestedTorusSlice &
  MandelbrotSlice &
  QuaternionJuliaSlice & {
    reset: () => void
  }
