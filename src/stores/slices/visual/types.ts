import type {
  ColorAlgorithm,
  CosineCoefficients,
  DistributionSettings,
  MultiSourceWeights,
} from '@/rendering/shaders/palette'
import type {
  AllShaderSettings,
  ShaderType,
  SurfaceSettings,
  WireframeSettings,
} from '@/rendering/shaders/types'
import { VisualPreset } from '@/stores/defaults/visualDefaults'

// ============================================================================
// Color Slice
// ============================================================================

export interface ColorSliceState {
  // Basic
  edgeColor: string
  faceColor: string
  backgroundColor: string
  perDimensionColorEnabled: boolean

  // Advanced
  colorAlgorithm: ColorAlgorithm
  cosineCoefficients: CosineCoefficients
  distribution: DistributionSettings
  multiSourceWeights: MultiSourceWeights
  lchLightness: number
  lchChroma: number
}

export interface ColorSliceActions {
  setEdgeColor: (color: string) => void
  setFaceColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setPerDimensionColorEnabled: (enabled: boolean) => void

  setColorAlgorithm: (algorithm: ColorAlgorithm) => void
  setCosineCoefficients: (coefficients: CosineCoefficients) => void
  setCosineCoefficient: (key: 'a' | 'b' | 'c' | 'd', index: number, value: number) => void
  setDistribution: (settings: Partial<DistributionSettings>) => void
  setMultiSourceWeights: (weights: Partial<MultiSourceWeights>) => void
  setLchLightness: (lightness: number) => void
  setLchChroma: (chroma: number) => void

  applyPreset: (preset: VisualPreset) => void
}

export type ColorSlice = ColorSliceState & ColorSliceActions

// ============================================================================
// Material Slice
// ============================================================================

export interface MaterialSliceState {
  edgeThickness: number
  edgeMetallic: number
  edgeRoughness: number
  faceOpacity: number
  faceEmission: number
  faceEmissionThreshold: number
  faceEmissionColorShift: number
  faceEmissionPulsing: boolean
  faceRimFalloff: number
}

export interface MaterialSliceActions {
  setEdgeThickness: (thickness: number) => void
  setEdgeMetallic: (metallic: number) => void
  setEdgeRoughness: (roughness: number) => void
  setFaceOpacity: (opacity: number) => void
  setFaceEmission: (emission: number) => void
  setFaceEmissionThreshold: (threshold: number) => void
  setFaceEmissionColorShift: (shift: number) => void
  setFaceEmissionPulsing: (pulsing: boolean) => void
  setFaceRimFalloff: (falloff: number) => void
}

export type MaterialSlice = MaterialSliceState & MaterialSliceActions

// ============================================================================
// Render Slice
// ============================================================================

export interface RenderSliceState {
  // Mode Toggles
  edgesVisible: boolean
  facesVisible: boolean

  // Shader System
  shaderType: ShaderType
  shaderSettings: AllShaderSettings

  // Surface Effects
  fresnelEnabled: boolean
  fresnelIntensity: number
}

export interface RenderSliceActions {
  setEdgesVisible: (visible: boolean) => void
  setFacesVisible: (visible: boolean) => void
  setShaderType: (shaderType: ShaderType) => void
  setWireframeSettings: (settings: Partial<WireframeSettings>) => void
  setSurfaceSettings: (settings: Partial<SurfaceSettings>) => void
  setFresnelEnabled: (enabled: boolean) => void
  setFresnelIntensity: (intensity: number) => void
}

export type RenderSlice = RenderSliceState & RenderSliceActions

// ============================================================================
// Advanced Rendering Slice
// ============================================================================

export interface AdvancedRenderingState {
  // Roughness (Global override for fractals)
  roughness: number

  // Subsurface Scattering
  sssEnabled: boolean
  sssIntensity: number
  sssColor: string
  sssThickness: number
  sssJitter: number
}

export interface AdvancedRenderingActions {
  setRoughness: (roughness: number) => void
  setSssEnabled: (enabled: boolean) => void
  setSssIntensity: (intensity: number) => void
  setSssColor: (color: string) => void
  setSssThickness: (thickness: number) => void
  setSssJitter: (jitter: number) => void
}

export type AdvancedRenderingSlice = AdvancedRenderingState & AdvancedRenderingActions

// ============================================================================
// Combined Appearance Slice
// ============================================================================

export interface AppearanceResetAction {
  reset: () => void
}

export type AppearanceSlice = ColorSlice & MaterialSlice & RenderSlice & AdvancedRenderingSlice & AppearanceResetAction
