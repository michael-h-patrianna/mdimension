/**
 * Post-processing slice for visual store
 *
 * Manages post-processing effects:
 * - Bloom (glow effect)
 * - Bokeh (depth of field)
 */

import type { StateCreator } from 'zustand'
import {
  type BokehBlurMethod,
  type BokehFocusMode,
  type SSRQuality,
  DEFAULT_BLOOM_ENABLED,
  DEFAULT_BLOOM_INTENSITY,
  DEFAULT_BLOOM_RADIUS,
  DEFAULT_BLOOM_THRESHOLD,
  DEFAULT_BOKEH_BLUR_METHOD,
  DEFAULT_BOKEH_ENABLED,
  DEFAULT_BOKEH_FOCAL_LENGTH,
  DEFAULT_BOKEH_FOCUS_MODE,
  DEFAULT_BOKEH_SCALE,
  DEFAULT_BOKEH_SHOW_DEBUG,
  DEFAULT_BOKEH_SMOOTH_TIME,
  DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE,
  DEFAULT_BOKEH_WORLD_FOCUS_RANGE,
  DEFAULT_SSR_ENABLED,
  DEFAULT_SSR_INTENSITY,
  DEFAULT_SSR_MAX_DISTANCE,
  DEFAULT_SSR_THICKNESS,
  DEFAULT_SSR_FADE_START,
  DEFAULT_SSR_FADE_END,
  DEFAULT_SSR_QUALITY,
  DEFAULT_REFRACTION_ENABLED,
  DEFAULT_REFRACTION_IOR,
  DEFAULT_REFRACTION_STRENGTH,
  DEFAULT_REFRACTION_CHROMATIC_ABERRATION,
} from '../defaults/visualDefaults'

// ============================================================================
// State Interface
// ============================================================================

export interface PostProcessingSliceState {
  // --- Bloom ---
  bloomEnabled: boolean
  bloomIntensity: number
  bloomThreshold: number
  bloomRadius: number

  // --- Bokeh (Depth of Field) ---
  bokehEnabled: boolean
  bokehFocusMode: BokehFocusMode
  bokehBlurMethod: BokehBlurMethod
  bokehWorldFocusDistance: number
  bokehWorldFocusRange: number
  bokehScale: number
  bokehFocalLength: number
  bokehSmoothTime: number
  bokehShowDebug: boolean

  // --- SSR (Screen-Space Reflections) ---
  ssrEnabled: boolean
  ssrIntensity: number
  ssrMaxDistance: number
  ssrThickness: number
  ssrFadeStart: number
  ssrFadeEnd: number
  ssrQuality: SSRQuality

  // --- Screen-Space Refraction ---
  refractionEnabled: boolean
  refractionIOR: number
  refractionStrength: number
  refractionChromaticAberration: number
}

export interface PostProcessingSliceActions {
  // --- Bloom Actions ---
  setBloomEnabled: (enabled: boolean) => void
  setBloomIntensity: (intensity: number) => void
  setBloomThreshold: (threshold: number) => void
  setBloomRadius: (radius: number) => void

  // --- Bokeh Actions ---
  setBokehEnabled: (enabled: boolean) => void
  setBokehFocusMode: (mode: BokehFocusMode) => void
  setBokehBlurMethod: (method: BokehBlurMethod) => void
  setBokehWorldFocusDistance: (distance: number) => void
  setBokehWorldFocusRange: (range: number) => void
  setBokehScale: (scale: number) => void
  setBokehFocalLength: (length: number) => void
  setBokehSmoothTime: (time: number) => void
  setBokehShowDebug: (show: boolean) => void

  // --- SSR Actions ---
  setSSREnabled: (enabled: boolean) => void
  setSSRIntensity: (intensity: number) => void
  setSSRMaxDistance: (distance: number) => void
  setSSRThickness: (thickness: number) => void
  setSSRFadeStart: (start: number) => void
  setSSRFadeEnd: (end: number) => void
  setSSRQuality: (quality: SSRQuality) => void

  // --- Refraction Actions ---
  setRefractionEnabled: (enabled: boolean) => void
  setRefractionIOR: (ior: number) => void
  setRefractionStrength: (strength: number) => void
  setRefractionChromaticAberration: (ca: number) => void
}

export type PostProcessingSlice = PostProcessingSliceState & PostProcessingSliceActions

// ============================================================================
// Initial State
// ============================================================================

export const POST_PROCESSING_INITIAL_STATE: PostProcessingSliceState = {
  // Bloom
  bloomEnabled: DEFAULT_BLOOM_ENABLED,
  bloomIntensity: DEFAULT_BLOOM_INTENSITY,
  bloomThreshold: DEFAULT_BLOOM_THRESHOLD,
  bloomRadius: DEFAULT_BLOOM_RADIUS,

  // Bokeh
  bokehEnabled: DEFAULT_BOKEH_ENABLED,
  bokehFocusMode: DEFAULT_BOKEH_FOCUS_MODE,
  bokehBlurMethod: DEFAULT_BOKEH_BLUR_METHOD,
  bokehWorldFocusDistance: DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE,
  bokehWorldFocusRange: DEFAULT_BOKEH_WORLD_FOCUS_RANGE,
  bokehScale: DEFAULT_BOKEH_SCALE,
  bokehFocalLength: DEFAULT_BOKEH_FOCAL_LENGTH,
  bokehSmoothTime: DEFAULT_BOKEH_SMOOTH_TIME,
  bokehShowDebug: DEFAULT_BOKEH_SHOW_DEBUG,

  // SSR
  ssrEnabled: DEFAULT_SSR_ENABLED,
  ssrIntensity: DEFAULT_SSR_INTENSITY,
  ssrMaxDistance: DEFAULT_SSR_MAX_DISTANCE,
  ssrThickness: DEFAULT_SSR_THICKNESS,
  ssrFadeStart: DEFAULT_SSR_FADE_START,
  ssrFadeEnd: DEFAULT_SSR_FADE_END,
  ssrQuality: DEFAULT_SSR_QUALITY,

  // Refraction
  refractionEnabled: DEFAULT_REFRACTION_ENABLED,
  refractionIOR: DEFAULT_REFRACTION_IOR,
  refractionStrength: DEFAULT_REFRACTION_STRENGTH,
  refractionChromaticAberration: DEFAULT_REFRACTION_CHROMATIC_ABERRATION,
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createPostProcessingSlice: StateCreator<
  PostProcessingSlice,
  [],
  [],
  PostProcessingSlice
> = (set) => ({
  ...POST_PROCESSING_INITIAL_STATE,

  // --- Bloom Actions ---
  setBloomEnabled: (enabled: boolean) => {
    set({ bloomEnabled: enabled })
  },

  setBloomIntensity: (intensity: number) => {
    set({ bloomIntensity: Math.max(0, Math.min(2, intensity)) })
  },

  setBloomThreshold: (threshold: number) => {
    set({ bloomThreshold: Math.max(0, Math.min(1, threshold)) })
  },

  setBloomRadius: (radius: number) => {
    set({ bloomRadius: Math.max(0, Math.min(1, radius)) })
  },

  // --- Bokeh Actions ---
  setBokehEnabled: (enabled: boolean) => {
    set({ bokehEnabled: enabled })
  },

  setBokehFocusMode: (mode: BokehFocusMode) => {
    set({ bokehFocusMode: mode })
  },

  setBokehBlurMethod: (method: BokehBlurMethod) => {
    set({ bokehBlurMethod: method })
  },

  setBokehWorldFocusDistance: (distance: number) => {
    set({ bokehWorldFocusDistance: Math.max(1, Math.min(50, distance)) })
  },

  setBokehWorldFocusRange: (range: number) => {
    set({ bokehWorldFocusRange: Math.max(1, Math.min(100, range)) })
  },

  setBokehScale: (scale: number) => {
    set({ bokehScale: Math.max(0, Math.min(3, scale)) })
  },

  setBokehFocalLength: (length: number) => {
    set({ bokehFocalLength: Math.max(0.01, Math.min(1, length)) })
  },

  setBokehSmoothTime: (time: number) => {
    set({ bokehSmoothTime: Math.max(0, Math.min(2, time)) })
  },

  setBokehShowDebug: (show: boolean) => {
    set({ bokehShowDebug: show })
  },

  // --- SSR Actions ---
  setSSREnabled: (enabled: boolean) => {
    set({ ssrEnabled: enabled })
  },

  setSSRIntensity: (intensity: number) => {
    set({ ssrIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  setSSRMaxDistance: (distance: number) => {
    set({ ssrMaxDistance: Math.max(1, Math.min(50, distance)) })
  },

  setSSRThickness: (thickness: number) => {
    set({ ssrThickness: Math.max(0.01, Math.min(2, thickness)) })
  },

  setSSRFadeStart: (start: number) => {
    set({ ssrFadeStart: Math.max(0, Math.min(1, start)) })
  },

  setSSRFadeEnd: (end: number) => {
    set({ ssrFadeEnd: Math.max(0, Math.min(1, end)) })
  },

  setSSRQuality: (quality: SSRQuality) => {
    set({ ssrQuality: quality })
  },

  // --- Refraction Actions ---
  setRefractionEnabled: (enabled: boolean) => {
    set({ refractionEnabled: enabled })
  },

  setRefractionIOR: (ior: number) => {
    set({ refractionIOR: Math.max(1.0, Math.min(2.5, ior)) })
  },

  setRefractionStrength: (strength: number) => {
    set({ refractionStrength: Math.max(0, Math.min(1, strength)) })
  },

  setRefractionChromaticAberration: (ca: number) => {
    set({ refractionChromaticAberration: Math.max(0, Math.min(1, ca)) })
  },
})
