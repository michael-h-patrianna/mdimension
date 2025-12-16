import {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  DualNormalizeMode,
  MandelbulbColorMode,
  MandelbulbConfig,
  MandelbulbPalette,
  MandelbulbQualityPreset,
  MandelbulbRenderStyle,
  NestedTorusConfig,
  NestedTorusEdgeMode,
  PolytopeConfig,
  QuaternionJuliaConfig,
  RootSystemConfig,
  RootSystemType,
  TruncationMode,
  WythoffPolytopeConfig,
  WythoffPreset,
  WythoffSymmetryGroup,
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

  // Truncation Animation
  setPolytopeTruncationEnabled: (enabled: boolean) => void
  setPolytopeTruncationMode: (mode: TruncationMode) => void
  setPolytopeTruncationT: (t: number) => void
  setPolytopeTruncationMin: (min: number) => void
  setPolytopeTruncationMax: (max: number) => void
  setPolytopeTruncationSpeed: (speed: number) => void

  // Facet Offset / Breathing Animation
  setPolytopeFacetOffsetEnabled: (enabled: boolean) => void
  setPolytopeFacetOffsetAmplitude: (amplitude: number) => void
  setPolytopeFacetOffsetFrequency: (frequency: number) => void
  setPolytopeFacetOffsetPhaseSpread: (spread: number) => void
  setPolytopeFacetOffsetBias: (bias: number) => void

  // Dual Morph Animation
  setPolytopeDualMorphEnabled: (enabled: boolean) => void
  setPolytopeDualMorphT: (t: number) => void
  setPolytopeDualNormalize: (mode: DualNormalizeMode) => void
  setPolytopeDualMorphSpeed: (speed: number) => void

  // Explode Animation
  setPolytopeExplodeEnabled: (enabled: boolean) => void
  setPolytopeExplodeFactor: (factor: number) => void
  setPolytopeExplodeSpeed: (speed: number) => void
  setPolytopeExplodeMax: (max: number) => void
}

export type PolytopeSlice = PolytopeSliceState & PolytopeSliceActions

// ============================================================================
// Wythoff Polytope Slice
// ============================================================================
export interface WythoffPolytopeSliceState {
  wythoffPolytope: WythoffPolytopeConfig
}

export interface WythoffPolytopeSliceActions {
  setWythoffSymmetryGroup: (symmetryGroup: WythoffSymmetryGroup) => void
  setWythoffPreset: (preset: WythoffPreset) => void
  setWythoffCustomSymbol: (customSymbol: boolean[]) => void
  setWythoffScale: (scale: number) => void
  setWythoffSnub: (snub: boolean) => void
  setWythoffConfig: (config: Partial<WythoffPolytopeConfig>) => void
  initializeWythoffForDimension: (dimension: number) => void
}

export type WythoffPolytopeSlice = WythoffPolytopeSliceState & WythoffPolytopeSliceActions

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
// Mandelbulb Slice
// ============================================================================
export interface MandelbulbSliceState {
  mandelbulb: MandelbulbConfig
}

export interface MandelbulbSliceActions {
  setMandelbulbMaxIterations: (value: number) => void
  setMandelbulbEscapeRadius: (value: number) => void
  setMandelbulbQualityPreset: (preset: MandelbulbQualityPreset) => void
  setMandelbulbResolution: (value: number) => void
  setMandelbulbVisualizationAxes: (axes: [number, number, number]) => void
  setMandelbulbVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => void
  setMandelbulbParameterValue: (dimIndex: number, value: number) => void
  setMandelbulbParameterValues: (values: number[]) => void
  resetMandelbulbParameters: () => void
  setMandelbulbCenter: (center: number[]) => void
  setMandelbulbExtent: (extent: number) => void
  fitMandelbulbToView: () => void
  setMandelbulbColorMode: (mode: MandelbulbColorMode) => void
  setMandelbulbPalette: (palette: MandelbulbPalette) => void
  setMandelbulbCustomPalette: (palette: { start: string; mid: string; end: string }) => void
  setMandelbulbInvertColors: (invert: boolean) => void
  setMandelbulbInteriorColor: (color: string) => void
  setMandelbulbPaletteCycles: (cycles: number) => void
  setMandelbulbRenderStyle: (style: MandelbulbRenderStyle) => void
  setMandelbulbPointSize: (size: number) => void
  setMandelbulbBoundaryThreshold: (threshold: [number, number]) => void
  setMandelbulbMandelbulbPower: (power: number) => void
  setMandelbulbConfig: (config: Partial<MandelbulbConfig>) => void
  initializeMandelbulbForDimension: (dimension: number) => void
  getMandelbulbConfig: () => MandelbulbConfig
  // Power Animation (Mandelbulb-specific)
  setMandelbulbPowerAnimationEnabled: (enabled: boolean) => void
  setMandelbulbPowerMin: (min: number) => void
  setMandelbulbPowerMax: (max: number) => void
  setMandelbulbPowerSpeed: (speed: number) => void
  // Alternate Power (Technique B variant)
  setMandelbulbAlternatePowerEnabled: (enabled: boolean) => void
  setMandelbulbAlternatePowerValue: (power: number) => void
  setMandelbulbAlternatePowerBlend: (blend: number) => void
  // Dimension Mixing (Technique A)
  setMandelbulbDimensionMixEnabled: (enabled: boolean) => void
  setMandelbulbMixIntensity: (intensity: number) => void
  setMandelbulbMixFrequency: (frequency: number) => void
  // Origin Drift (Technique C)
  setMandelbulbOriginDriftEnabled: (enabled: boolean) => void
  setMandelbulbDriftAmplitude: (amplitude: number) => void
  setMandelbulbDriftBaseFrequency: (frequency: number) => void
  setMandelbulbDriftFrequencySpread: (spread: number) => void
  // Slice Animation (4D+ only)
  setMandelbulbSliceAnimationEnabled: (enabled: boolean) => void
  setMandelbulbSliceSpeed: (speed: number) => void
  setMandelbulbSliceAmplitude: (amplitude: number) => void
  // Angular Phase Shifts
  setMandelbulbPhaseShiftEnabled: (enabled: boolean) => void
  setMandelbulbPhaseSpeed: (speed: number) => void
  setMandelbulbPhaseAmplitude: (amplitude: number) => void
}

export type MandelbulbSlice = MandelbulbSliceState & MandelbulbSliceActions

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
  WythoffPolytopeSlice &
  RootSystemSlice &
  CliffordTorusSlice &
  NestedTorusSlice &
  MandelbulbSlice &
  QuaternionJuliaSlice & {
    reset: () => void
  }
