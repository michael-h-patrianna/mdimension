import type {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  MandelboxConfig,
  MandelbrotColorMode,
  MandelbrotConfig,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
  MengerConfig,
  NestedTorusConfig,
  NestedTorusEdgeMode,
  PolytopeConfig,
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
}

export type MandelbrotSlice = MandelbrotSliceState & MandelbrotSliceActions

// ============================================================================
// Mandelbox Slice
// ============================================================================
export interface MandelboxSliceState {
  mandelbox: MandelboxConfig
}

export interface MandelboxSliceActions {
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
  // Scale Animation
  setMandelboxScaleAnimationEnabled: (enabled: boolean) => void
  setMandelboxScaleCenter: (center: number) => void
  setMandelboxScaleAmplitude: (amplitude: number) => void
  setMandelboxScaleSpeed: (speed: number) => void
  // Julia Mode
  setMandelboxJuliaMode: (enabled: boolean) => void
  setMandelboxJuliaSpeed: (speed: number) => void
  setMandelboxJuliaRadius: (radius: number) => void
  // Dimension Mixing (Technique A)
  setMandelboxDimensionMixEnabled: (enabled: boolean) => void
  setMandelboxMixIntensity: (intensity: number) => void
  setMandelboxMixFrequency: (frequency: number) => void
  // Transform Alternation (Technique B)
  setMandelboxAlternateTransformEnabled: (enabled: boolean) => void
  setMandelboxAlternatePeriod: (period: 2 | 3) => void
  setMandelboxAlternateType: (type: 'twist' | 'power' | 'shift') => void
  setMandelboxAlternateIntensity: (intensity: number) => void
  setMandelboxAlternateTwistAngle: (angle: number) => void
  setMandelboxAlternatePowerExponent: (exponent: number) => void
  setMandelboxAlternateAnimationEnabled: (enabled: boolean) => void
  setMandelboxAlternateAnimationSpeed: (speed: number) => void
  setMandelboxAlternateAnimationAmplitude: (amplitude: number) => void
  // Origin Drift (Technique C)
  setMandelboxOriginDriftEnabled: (enabled: boolean) => void
  setMandelboxDriftAmplitude: (amplitude: number) => void
  setMandelboxDriftBaseFrequency: (frequency: number) => void
  setMandelboxDriftFrequencySpread: (spread: number) => void
}

export type MandelboxSlice = MandelboxSliceState & MandelboxSliceActions

// ============================================================================
// Menger Slice
// ============================================================================
export interface MengerSliceState {
  menger: MengerConfig
}

export interface MengerSliceActions {
  setMengerIterations: (iterations: number) => void
  setMengerScale: (scale: number) => void
  setMengerParameterValue: (dimIndex: number, value: number) => void
  setMengerParameterValues: (values: number[]) => void
  resetMengerParameters: () => void
  initializeMengerForDimension: (dimension: number) => void
  getMengerConfig: () => MengerConfig
  // Existing Animations
  setMengerFoldTwistEnabled: (enabled: boolean) => void
  setMengerFoldTwistAngle: (angle: number) => void
  setMengerFoldTwistSpeed: (speed: number) => void
  setMengerScalePulseEnabled: (enabled: boolean) => void
  setMengerScalePulseAmplitude: (amplitude: number) => void
  setMengerScalePulseSpeed: (speed: number) => void
  setMengerSliceSweepEnabled: (enabled: boolean) => void
  setMengerSliceSweepAmplitude: (amplitude: number) => void
  setMengerSliceSweepSpeed: (speed: number) => void
  // Dimension Mixing (Technique A)
  setMengerDimensionMixEnabled: (enabled: boolean) => void
  setMengerMixIntensity: (intensity: number) => void
  setMengerMixFrequency: (frequency: number) => void
  // Origin Drift (Technique C)
  setMengerOriginDriftEnabled: (enabled: boolean) => void
  setMengerDriftAmplitude: (amplitude: number) => void
  setMengerDriftBaseFrequency: (frequency: number) => void
  setMengerDriftFrequencySpread: (spread: number) => void
}

export type MengerSlice = MengerSliceState & MengerSliceActions

// ============================================================================
// Combined Extended Object Slice
// ============================================================================
export type ExtendedObjectSlice = PolytopeSlice &
  RootSystemSlice &
  CliffordTorusSlice &
  NestedTorusSlice &
  MandelbrotSlice &
  MandelboxSlice &
  MengerSlice & {
    reset: () => void
  }
