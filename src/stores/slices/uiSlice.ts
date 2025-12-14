/**
 * UI slice for visual store
 *
 * Manages UI-related and miscellaneous visual settings:
 * - Axis helper visibility
 * - Performance monitor visibility
 * - Animation bias
 * - Hyperbulb opacity settings (fractal-specific)
 */

import type { StateCreator } from 'zustand'
import {
  LAYER_OPACITY_RANGE,
  SIMPLE_ALPHA_RANGE,
  VOLUMETRIC_DENSITY_RANGE,
} from '@/lib/opacity/constants'
import type {
  HyperbulbOpacitySettings,
  OpacityMode,
  SampleQuality,
  VolumetricAnimationQuality,
} from '@/lib/opacity/types'
import {
  DEFAULT_ANIMATION_BIAS,
  DEFAULT_OPACITY_SETTINGS,
  DEFAULT_SHOW_AXIS_HELPER,
  DEFAULT_SHOW_PERF_MONITOR,
} from '../defaults/visualDefaults'

// ============================================================================
// State Interface
// ============================================================================

export interface UISliceState {
  // --- UI Helpers ---
  showAxisHelper: boolean
  showPerfMonitor: boolean

  // --- Animation ---
  animationBias: number

  // --- Hyperbulb Opacity ---
  hyperbulbOpacitySettings: HyperbulbOpacitySettings
  hasSeenVolumetricWarning: boolean
}

export interface UISliceActions {
  // --- UI Helper Actions ---
  setShowAxisHelper: (show: boolean) => void
  setShowPerfMonitor: (show: boolean) => void

  // --- Animation Actions ---
  setAnimationBias: (bias: number) => void

  // --- Hyperbulb Opacity Actions ---
  setOpacityMode: (mode: OpacityMode) => void
  setSimpleAlphaOpacity: (opacity: number) => void
  setLayerCount: (count: 2 | 3 | 4) => void
  setLayerOpacity: (opacity: number) => void
  setVolumetricDensity: (density: number) => void
  setSampleQuality: (quality: SampleQuality) => void
  setVolumetricAnimationQuality: (quality: VolumetricAnimationQuality) => void
  setHasSeenVolumetricWarning: (seen: boolean) => void
  setOpacitySettings: (settings: Partial<HyperbulbOpacitySettings>) => void
}

export type UISlice = UISliceState & UISliceActions

// ============================================================================
// Initial State
// ============================================================================

export const UI_INITIAL_STATE: UISliceState = {
  // UI helpers
  showAxisHelper: DEFAULT_SHOW_AXIS_HELPER,
  showPerfMonitor: DEFAULT_SHOW_PERF_MONITOR,

  // Animation
  animationBias: DEFAULT_ANIMATION_BIAS,

  // Hyperbulb opacity
  hyperbulbOpacitySettings: { ...DEFAULT_OPACITY_SETTINGS },
  hasSeenVolumetricWarning: false,
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  ...UI_INITIAL_STATE,

  // --- UI Helper Actions ---
  setShowAxisHelper: (show: boolean) => {
    set({ showAxisHelper: show })
  },

  setShowPerfMonitor: (show: boolean) => {
    set({ showPerfMonitor: show })
  },

  // --- Animation Actions ---
  setAnimationBias: (bias: number) => {
    set({ animationBias: Math.max(0, Math.min(1, bias)) })
  },

  // --- Hyperbulb Opacity Actions ---
  setOpacityMode: (mode: OpacityMode) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        mode,
      },
    }))
  },

  setSimpleAlphaOpacity: (opacity: number) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        simpleAlphaOpacity: Math.max(
          SIMPLE_ALPHA_RANGE.min,
          Math.min(SIMPLE_ALPHA_RANGE.max, opacity)
        ),
      },
    }))
  },

  setLayerCount: (count: 2 | 3 | 4) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        layerCount: count,
      },
    }))
  },

  setLayerOpacity: (opacity: number) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        layerOpacity: Math.max(
          LAYER_OPACITY_RANGE.min,
          Math.min(LAYER_OPACITY_RANGE.max, opacity)
        ),
      },
    }))
  },

  setVolumetricDensity: (density: number) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        volumetricDensity: Math.max(
          VOLUMETRIC_DENSITY_RANGE.min,
          Math.min(VOLUMETRIC_DENSITY_RANGE.max, density)
        ),
      },
    }))
  },

  setSampleQuality: (quality: SampleQuality) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        sampleQuality: quality,
      },
    }))
  },

  setVolumetricAnimationQuality: (quality: VolumetricAnimationQuality) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        volumetricAnimationQuality: quality,
      },
    }))
  },

  setHasSeenVolumetricWarning: (seen: boolean) => {
    set({ hasSeenVolumetricWarning: seen })
  },

  setOpacitySettings: (settings: Partial<HyperbulbOpacitySettings>) => {
    set((state) => ({
      hyperbulbOpacitySettings: {
        ...state.hyperbulbOpacitySettings,
        ...settings,
        simpleAlphaOpacity:
          settings.simpleAlphaOpacity !== undefined
            ? Math.max(
                SIMPLE_ALPHA_RANGE.min,
                Math.min(SIMPLE_ALPHA_RANGE.max, settings.simpleAlphaOpacity)
              )
            : state.hyperbulbOpacitySettings.simpleAlphaOpacity,
        layerOpacity:
          settings.layerOpacity !== undefined
            ? Math.max(
                LAYER_OPACITY_RANGE.min,
                Math.min(LAYER_OPACITY_RANGE.max, settings.layerOpacity)
              )
            : state.hyperbulbOpacitySettings.layerOpacity,
        volumetricDensity:
          settings.volumetricDensity !== undefined
            ? Math.max(
                VOLUMETRIC_DENSITY_RANGE.min,
                Math.min(VOLUMETRIC_DENSITY_RANGE.max, settings.volumetricDensity)
              )
            : state.hyperbulbOpacitySettings.volumetricDensity,
      },
    }))
  },
})
