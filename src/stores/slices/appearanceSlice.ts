/**
 * Appearance slice for visual store
 *
 * Manages visual appearance of the polytope:
 * - Basic colors (edge, face, background)
 * - Advanced color system (algorithms, cosine coefficients, LCH)
 * - Shader system (wireframe, surface settings)
 * - Render mode toggles (edges/faces visible)
 * - Depth effects (attenuation, fresnel)
 * - Visual presets
 */

import type { StateCreator } from 'zustand'
import type {
  ColorAlgorithm,
  CosineCoefficients,
  DistributionSettings,
  MultiSourceWeights,
} from '@/lib/shaders/palette'
import type { AllShaderSettings, ShaderType, SurfaceSettings, WireframeSettings } from '@/lib/shaders/types'
import {
  type VisualPreset,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_COSINE_COEFFICIENTS,
  DEFAULT_DEPTH_ATTENUATION_ENABLED,
  DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  DEFAULT_DISTRIBUTION,
  DEFAULT_EDGE_COLOR,
  DEFAULT_EDGE_METALLIC,
  DEFAULT_EDGE_ROUGHNESS,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_EDGES_VISIBLE,
  DEFAULT_FACE_COLOR,
  DEFAULT_FACE_OPACITY,
  DEFAULT_FACES_VISIBLE,
  DEFAULT_FRESNEL_ENABLED,
  DEFAULT_FRESNEL_INTENSITY,
  DEFAULT_LCH_CHROMA,
  DEFAULT_LCH_LIGHTNESS,
  DEFAULT_MULTI_SOURCE_WEIGHTS,
  DEFAULT_PER_DIMENSION_COLOR_ENABLED,
  DEFAULT_SHADER_SETTINGS,
  DEFAULT_SHADER_TYPE,
  VISUAL_PRESETS,
} from '../defaults/visualDefaults'

// ============================================================================
// State Interface
// ============================================================================

export interface AppearanceSliceState {
  // --- Basic Visuals ---
  edgeColor: string
  edgeThickness: number
  edgeMetallic: number
  edgeRoughness: number
  faceOpacity: number
  faceColor: string
  backgroundColor: string

  // --- Advanced Color System ---
  colorAlgorithm: ColorAlgorithm
  cosineCoefficients: CosineCoefficients
  distribution: DistributionSettings
  multiSourceWeights: MultiSourceWeights
  lchLightness: number
  lchChroma: number

  // --- Render Mode Toggles ---
  edgesVisible: boolean
  facesVisible: boolean

  // --- Shader System ---
  shaderType: ShaderType
  shaderSettings: AllShaderSettings

  // --- Depth Effects ---
  depthAttenuationEnabled: boolean
  depthAttenuationStrength: number
  fresnelEnabled: boolean
  fresnelIntensity: number
  perDimensionColorEnabled: boolean
}

export interface AppearanceSliceActions {
  // --- Basic Visual Actions ---
  setEdgeColor: (color: string) => void
  setEdgeThickness: (thickness: number) => void
  setEdgeMetallic: (metallic: number) => void
  setEdgeRoughness: (roughness: number) => void
  setFaceOpacity: (opacity: number) => void
  setFaceColor: (color: string) => void
  setBackgroundColor: (color: string) => void

  // --- Advanced Color System Actions ---
  setColorAlgorithm: (algorithm: ColorAlgorithm) => void
  setCosineCoefficients: (coefficients: CosineCoefficients) => void
  setCosineCoefficient: (key: 'a' | 'b' | 'c' | 'd', index: number, value: number) => void
  setDistribution: (settings: Partial<DistributionSettings>) => void
  setMultiSourceWeights: (weights: Partial<MultiSourceWeights>) => void
  setLchLightness: (lightness: number) => void
  setLchChroma: (chroma: number) => void

  // --- Render Mode Toggle Actions ---
  setEdgesVisible: (visible: boolean) => void
  setFacesVisible: (visible: boolean) => void

  // --- Shader System Actions ---
  setShaderType: (shaderType: ShaderType) => void
  setWireframeSettings: (settings: Partial<WireframeSettings>) => void
  setSurfaceSettings: (settings: Partial<SurfaceSettings>) => void

  // --- Depth Effect Actions ---
  setDepthAttenuationEnabled: (enabled: boolean) => void
  setDepthAttenuationStrength: (strength: number) => void
  setFresnelEnabled: (enabled: boolean) => void
  setFresnelIntensity: (intensity: number) => void
  setPerDimensionColorEnabled: (enabled: boolean) => void

  // --- Preset Actions ---
  applyPreset: (preset: VisualPreset) => void
}

export type AppearanceSlice = AppearanceSliceState & AppearanceSliceActions

// ============================================================================
// Initial State
// ============================================================================

export const APPEARANCE_INITIAL_STATE: AppearanceSliceState = {
  // Basic visuals
  edgeColor: DEFAULT_EDGE_COLOR,
  edgeThickness: DEFAULT_EDGE_THICKNESS,
  edgeMetallic: DEFAULT_EDGE_METALLIC,
  edgeRoughness: DEFAULT_EDGE_ROUGHNESS,
  faceOpacity: DEFAULT_FACE_OPACITY,
  faceColor: DEFAULT_FACE_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,

  // Advanced color system
  colorAlgorithm: DEFAULT_COLOR_ALGORITHM,
  cosineCoefficients: { ...DEFAULT_COSINE_COEFFICIENTS },
  distribution: { ...DEFAULT_DISTRIBUTION },
  multiSourceWeights: { ...DEFAULT_MULTI_SOURCE_WEIGHTS },
  lchLightness: DEFAULT_LCH_LIGHTNESS,
  lchChroma: DEFAULT_LCH_CHROMA,

  // Render mode toggles
  edgesVisible: DEFAULT_EDGES_VISIBLE,
  facesVisible: DEFAULT_FACES_VISIBLE,

  // Shader system
  shaderType: DEFAULT_SHADER_TYPE,
  shaderSettings: { ...DEFAULT_SHADER_SETTINGS },

  // Depth effects
  depthAttenuationEnabled: DEFAULT_DEPTH_ATTENUATION_ENABLED,
  depthAttenuationStrength: DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
  fresnelIntensity: DEFAULT_FRESNEL_INTENSITY,
  perDimensionColorEnabled: DEFAULT_PER_DIMENSION_COLOR_ENABLED,
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createAppearanceSlice: StateCreator<AppearanceSlice, [], [], AppearanceSlice> = (
  set
) => ({
  ...APPEARANCE_INITIAL_STATE,

  // --- Basic Visual Actions ---
  setEdgeColor: (color: string) => {
    set({ edgeColor: color })
  },

  setEdgeThickness: (thickness: number) => {
    set({ edgeThickness: Math.max(1, Math.min(5, thickness)) })
  },

  setEdgeMetallic: (metallic: number) => {
    set({ edgeMetallic: Math.max(0, Math.min(1, metallic)) })
  },

  setEdgeRoughness: (roughness: number) => {
    set({ edgeRoughness: Math.max(0, Math.min(1, roughness)) })
  },

  setFaceOpacity: (opacity: number) => {
    set({ faceOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setFaceColor: (color: string) => {
    set({ faceColor: color })
  },

  setBackgroundColor: (color: string) => {
    set({ backgroundColor: color })
  },

  // --- Advanced Color System Actions ---
  setColorAlgorithm: (algorithm: ColorAlgorithm) => {
    set({ colorAlgorithm: algorithm })
  },

  setCosineCoefficients: (coefficients: CosineCoefficients) => {
    set({ cosineCoefficients: { ...coefficients } })
  },

  setCosineCoefficient: (key: 'a' | 'b' | 'c' | 'd', index: number, value: number) => {
    set((state) => {
      const newCoefficients = { ...state.cosineCoefficients }
      const arr = [...newCoefficients[key]] as [number, number, number]
      arr[index] = Math.max(0, Math.min(2, value))
      newCoefficients[key] = arr
      return { cosineCoefficients: newCoefficients }
    })
  },

  setDistribution: (settings: Partial<DistributionSettings>) => {
    set((state) => ({
      distribution: {
        ...state.distribution,
        power:
          settings.power !== undefined
            ? Math.max(0.25, Math.min(4, settings.power))
            : state.distribution.power,
        cycles:
          settings.cycles !== undefined
            ? Math.max(0.5, Math.min(5, settings.cycles))
            : state.distribution.cycles,
        offset:
          settings.offset !== undefined
            ? Math.max(0, Math.min(1, settings.offset))
            : state.distribution.offset,
      },
    }))
  },

  setMultiSourceWeights: (weights: Partial<MultiSourceWeights>) => {
    set((state) => ({
      multiSourceWeights: {
        ...state.multiSourceWeights,
        depth:
          weights.depth !== undefined
            ? Math.max(0, Math.min(1, weights.depth))
            : state.multiSourceWeights.depth,
        orbitTrap:
          weights.orbitTrap !== undefined
            ? Math.max(0, Math.min(1, weights.orbitTrap))
            : state.multiSourceWeights.orbitTrap,
        normal:
          weights.normal !== undefined
            ? Math.max(0, Math.min(1, weights.normal))
            : state.multiSourceWeights.normal,
      },
    }))
  },

  setLchLightness: (lightness: number) => {
    set({ lchLightness: Math.max(0.1, Math.min(1, lightness)) })
  },

  setLchChroma: (chroma: number) => {
    set({ lchChroma: Math.max(0, Math.min(0.4, chroma)) })
  },

  // --- Render Mode Toggle Actions ---
  setEdgesVisible: (visible: boolean) => {
    set({ edgesVisible: visible })
  },

  setFacesVisible: (visible: boolean) => {
    // Auto-set shader type based on faces visibility (PRD: Faces Toggle Behavior)
    set({
      facesVisible: visible,
      shaderType: visible ? 'surface' : 'wireframe',
    })
  },

  // --- Shader System Actions ---
  setShaderType: (shaderType: ShaderType) => {
    set({ shaderType })
  },

  setWireframeSettings: (settings: Partial<WireframeSettings>) => {
    set((state) => ({
      shaderSettings: {
        ...state.shaderSettings,
        wireframe: {
          ...state.shaderSettings.wireframe,
          ...settings,
          lineThickness:
            settings.lineThickness !== undefined
              ? Math.max(1, Math.min(5, settings.lineThickness))
              : state.shaderSettings.wireframe.lineThickness,
        },
      },
    }))
  },

  setSurfaceSettings: (settings: Partial<SurfaceSettings>) => {
    set((state) => ({
      shaderSettings: {
        ...state.shaderSettings,
        surface: {
          ...state.shaderSettings.surface,
          ...settings,
          faceOpacity:
            settings.faceOpacity !== undefined
              ? Math.max(0, Math.min(1, settings.faceOpacity))
              : state.shaderSettings.surface.faceOpacity,
          specularIntensity:
            settings.specularIntensity !== undefined
              ? Math.max(0, Math.min(2, settings.specularIntensity))
              : state.shaderSettings.surface.specularIntensity,
          shininess:
            settings.shininess !== undefined
              ? Math.max(1, Math.min(128, settings.shininess))
              : state.shaderSettings.surface.shininess,
        },
      },
    }))
  },

  // --- Depth Effect Actions ---
  setDepthAttenuationEnabled: (enabled: boolean) => {
    set({ depthAttenuationEnabled: enabled })
  },

  setDepthAttenuationStrength: (strength: number) => {
    set({ depthAttenuationStrength: Math.max(0, Math.min(0.5, strength)) })
  },

  setFresnelEnabled: (enabled: boolean) => {
    set({ fresnelEnabled: enabled })
  },

  setFresnelIntensity: (intensity: number) => {
    set({ fresnelIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  setPerDimensionColorEnabled: (enabled: boolean) => {
    set({ perDimensionColorEnabled: enabled })
  },

  // --- Preset Actions ---
  applyPreset: (preset: VisualPreset) => {
    const settings = VISUAL_PRESETS[preset]
    if (!settings) return

    const updates: Partial<AppearanceSliceState> = {
      edgeColor: settings.edgeColor,
      edgeThickness: settings.edgeThickness,
      backgroundColor: settings.backgroundColor,
    }

    if ('faceColor' in settings && settings.faceColor) {
      updates.faceColor = settings.faceColor
    }

    set(updates)
  },
})
