/**
 * Visual state management using Zustand
 *
 * Manages visual styling for the polytope rendering including:
 * - Shader selection and per-shader settings
 * - Bloom post-processing
 * - Lighting configuration
 * - Depth-based visual effects
 * - Color presets
 *
 * This store is composed from multiple slices for better organization:
 * - appearanceSlice: Colors, shaders, depth effects, presets
 * - groundSlice: Ground plane and environment surfaces
 * - lightingSlice: Basic and enhanced lighting, multi-light system
 * - postProcessingSlice: Bloom and bokeh effects
 * - uiSlice: UI helpers, animation, hyperbulb opacity
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import { create } from 'zustand'
import {
  createAppearanceSlice,
  createGroundSlice,
  createLightingSlice,
  createPostProcessingSlice,
  createUISlice,
  APPEARANCE_INITIAL_STATE,
  GROUND_INITIAL_STATE,
  LIGHTING_INITIAL_STATE,
  POST_PROCESSING_INITIAL_STATE,
  UI_INITIAL_STATE,
  type AppearanceSlice,
  type GroundSlice,
  type LightingSlice,
  type PostProcessingSlice,
  type UISlice,
} from './slices'

// Re-export types and defaults for backwards compatibility
export * from './defaults/visualDefaults'
export type {
  AppearanceSlice,
  AppearanceSliceState,
  AppearanceSliceActions,
  GroundSlice,
  GroundSliceState,
  GroundSliceActions,
  LightingSlice,
  LightingSliceState,
  LightingSliceActions,
  PostProcessingSlice,
  PostProcessingSliceState,
  PostProcessingSliceActions,
  UISlice,
  UISliceState,
  UISliceActions,
} from './slices'

// ============================================================================
// Combined Store Type
// ============================================================================

export type VisualState = AppearanceSlice &
  GroundSlice &
  LightingSlice &
  PostProcessingSlice &
  UISlice & {
    reset: () => void
  }

// ============================================================================
// Initial State (combined from all slices)
// ============================================================================

const INITIAL_STATE = {
  ...APPEARANCE_INITIAL_STATE,
  ...GROUND_INITIAL_STATE,
  ...LIGHTING_INITIAL_STATE,
  ...POST_PROCESSING_INITIAL_STATE,
  ...UI_INITIAL_STATE,
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useVisualStore = create<VisualState>()((...args) => {
  const [set] = args

  return {
    // Compose all slices
    ...createAppearanceSlice(...args),
    ...createGroundSlice(...args),
    ...createLightingSlice(...args),
    ...createPostProcessingSlice(...args),
    ...createUISlice(...args),

    // Global reset action
    reset: () => {
      set({ ...INITIAL_STATE })
    },
  }
})
