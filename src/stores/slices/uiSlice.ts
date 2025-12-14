/**
 * UI slice for visual store
 *
 * Manages UI-related and miscellaneous visual settings:
 * - Axis helper visibility
 * - Performance monitor visibility
 * - Animation bias
 * - Opacity settings (for raymarching fractals)
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
  DEFAULT_MAX_FPS,
  DEFAULT_OPACITY_SETTINGS,
  DEFAULT_SHOW_AXIS_HELPER,
  DEFAULT_SHOW_PERF_MONITOR,
  MAX_MAX_FPS,
  MIN_MAX_FPS,
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

  // --- FPS Limiting ---
  maxFps: number

  // --- Opacity (raymarching fractals) ---
  opacitySettings: HyperbulbOpacitySettings
  hasSeenVolumetricWarning: boolean
}

export interface UISliceActions {
  // --- UI Helper Actions ---
  setShowAxisHelper: (show: boolean) => void
  setShowPerfMonitor: (show: boolean) => void

  // --- Animation Actions ---
  setAnimationBias: (bias: number) => void

  // --- FPS Limiting Actions ---
  setMaxFps: (fps: number) => void

  // --- Opacity Actions ---
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

  // FPS limiting
  maxFps: DEFAULT_MAX_FPS,

  // Opacity (raymarching fractals)
  opacitySettings: { ...DEFAULT_OPACITY_SETTINGS },
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

  // --- FPS Limiting Actions ---
  setMaxFps: (fps: number) => {
    set({ maxFps: Math.max(MIN_MAX_FPS, Math.min(MAX_MAX_FPS, fps)) })
  },

  // --- Opacity Actions ---
  setOpacityMode: (mode: OpacityMode) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        mode,
      },
    }))
  },

  setSimpleAlphaOpacity: (opacity: number) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        simpleAlphaOpacity: Math.max(
          SIMPLE_ALPHA_RANGE.min,
          Math.min(SIMPLE_ALPHA_RANGE.max, opacity)
        ),
      },
    }))
  },

  setLayerCount: (count: 2 | 3 | 4) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        layerCount: count,
      },
    }))
  },

  setLayerOpacity: (opacity: number) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        layerOpacity: Math.max(
          LAYER_OPACITY_RANGE.min,
          Math.min(LAYER_OPACITY_RANGE.max, opacity)
        ),
      },
    }))
  },

  setVolumetricDensity: (density: number) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        volumetricDensity: Math.max(
          VOLUMETRIC_DENSITY_RANGE.min,
          Math.min(VOLUMETRIC_DENSITY_RANGE.max, density)
        ),
      },
    }))
  },

  setSampleQuality: (quality: SampleQuality) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        sampleQuality: quality,
      },
    }))
  },

  setVolumetricAnimationQuality: (quality: VolumetricAnimationQuality) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        volumetricAnimationQuality: quality,
      },
    }))
  },

  setHasSeenVolumetricWarning: (seen: boolean) => {
    set({ hasSeenVolumetricWarning: seen })
  },

  setOpacitySettings: (settings: Partial<HyperbulbOpacitySettings>) => {
    set((state) => ({
      opacitySettings: {
        ...state.opacitySettings,
        ...settings,
        simpleAlphaOpacity:
          settings.simpleAlphaOpacity !== undefined
            ? Math.max(
                SIMPLE_ALPHA_RANGE.min,
                Math.min(SIMPLE_ALPHA_RANGE.max, settings.simpleAlphaOpacity)
              )
            : state.opacitySettings.simpleAlphaOpacity,
        layerOpacity:
          settings.layerOpacity !== undefined
            ? Math.max(
                LAYER_OPACITY_RANGE.min,
                Math.min(LAYER_OPACITY_RANGE.max, settings.layerOpacity)
              )
            : state.opacitySettings.layerOpacity,
        volumetricDensity:
          settings.volumetricDensity !== undefined
            ? Math.max(
                VOLUMETRIC_DENSITY_RANGE.min,
                Math.min(VOLUMETRIC_DENSITY_RANGE.max, settings.volumetricDensity)
              )
            : state.opacitySettings.volumetricDensity,
      },
    }))
  },
})
