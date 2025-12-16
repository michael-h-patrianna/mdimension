/**
 * Visual store slices barrel export
 */

export {
  createAppearanceSlice,
  APPEARANCE_INITIAL_STATE,
  type AppearanceSlice,
} from './appearanceSlice'
// Re-export sub-slice types from visual/types
export type {
  ColorSlice,
  ColorSliceState,
  ColorSliceActions,
  MaterialSlice,
  MaterialSliceState,
  MaterialSliceActions,
  RenderSlice,
  RenderSliceState,
  RenderSliceActions,
} from './visual/types'

export {
  createGroundSlice,
  GROUND_INITIAL_STATE,
  type GroundSlice,
  type GroundSliceState,
  type GroundSliceActions,
} from './groundSlice'

export {
  createLightingSlice,
  LIGHTING_INITIAL_STATE,
  type LightingSlice,
  type LightingSliceState,
  type LightingSliceActions,
} from './lightingSlice'

export {
  createPostProcessingSlice,
  POST_PROCESSING_INITIAL_STATE,
  type PostProcessingSlice,
  type PostProcessingSliceState,
  type PostProcessingSliceActions,
} from './postProcessingSlice'

export {
  createUISlice,
  UI_INITIAL_STATE,
  type UISlice,
  type UISliceState,
  type UISliceActions,
} from './uiSlice'

export {
  createFogSlice,
  DEFAULT_FOG_STATE,
  type FogSlice,
  type FogSliceState,
  type FogSliceActions,
  type FogType,
} from './fogSlice'

export {
  createSkyboxSlice,
  SKYBOX_INITIAL_STATE,
  type SkyboxSlice,
  type SkyboxSliceState,
  type SkyboxSliceActions,
} from './skyboxSlice'
