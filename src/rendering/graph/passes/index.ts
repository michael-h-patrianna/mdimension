/**
 * Render Graph Passes
 *
 * Built-in pass implementations for common rendering operations.
 *
 * @module rendering/graph/passes
 */

// Core passes
export { CopyPass, type CopyPassConfig } from './CopyPass'
export { FullscreenPass, type FullscreenPassConfig } from './FullscreenPass'
export { ScenePass, type ScenePassConfig } from './ScenePass'
export { ToScreenPass, type ToScreenPassConfig } from './ToScreenPass'

// G-buffer passes
export { DepthPass, type DepthPassConfig } from './DepthPass'
export { MainObjectMRTPass, type MainObjectMRTPassConfig } from './MainObjectMRTPass'
export { NormalPass, type NormalPassConfig } from './NormalPass'
export { TemporalCloudPass, type TemporalCloudPassConfig } from './TemporalCloudPass'
export {
  TemporalDepthCapturePass,
  type TemporalDepthCapturePassConfig,
} from './TemporalDepthCapturePass'

// Effect passes
export { BloomPass, type BloomPassConfig } from './BloomPass'
export { BokehPass, type BokehPassConfig } from './BokehPass'
export { CinematicPass, type CinematicPassConfig } from './CinematicPass'
export {
  CompositePass,
  type BlendMode,
  type CompositeInput,
  type CompositePassConfig,
} from './CompositePass'
export { EffectComposerPass, type EffectComposerPassConfig } from './EffectComposerPass'
export { FXAAPass, type FXAAPassConfig } from './FXAAPass'
export { RefractionPass, type RefractionPassConfig } from './RefractionPass'
export { ScreenSpaceLensingPass, type ScreenSpaceLensingPassConfig } from './ScreenSpaceLensingPass'
export { SMAAPass, type SMAAPassConfig } from './SMAAPass'
export { SSRPass, type SSRPassConfig } from './SSRPass'

// Atmospheric passes
export { VolumetricFogPass, type VolumetricFogPassConfig } from './VolumetricFogPass'

// Ambient occlusion
export { GTAOPass, type GTAOPassConfig } from './GTAOPass'

// Cinematic passes
export { FilmGrainPass, type FilmGrainPassConfig } from './FilmGrainPass'

// Debug passes
export {
  BufferPreviewPass,
  type BufferPreviewPassConfig,
  type BufferType,
  type DepthMode,
} from './BufferPreviewPass'
