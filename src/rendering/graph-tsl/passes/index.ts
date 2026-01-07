/**
 * TSL Render Graph Passes
 *
 * Post-processing and rendering passes for the TSL render graph.
 * Each pass implements the RenderPassTSL interface and works with
 * both WebGLRenderer and WebGPURenderer.
 *
 * @module rendering/graph-tsl/passes
 */

// =============================================================================
// Base Classes
// =============================================================================

export { FullscreenPassTSL, type FullscreenPassTSLConfig } from './FullscreenPassTSL'

// =============================================================================
// Scene Rendering
// =============================================================================

export { ScenePassTSL, type ScenePassTSLConfig, type SceneRenderStats } from './ScenePassTSL'

// =============================================================================
// Gravity Pipeline
// =============================================================================

export {
  GravitationalLensingPassTSL,
  type GravitationalLensingPassTSLConfig,
} from './GravitationalLensingPassTSL'

export {
  EnvironmentCompositePassTSL,
  type EnvironmentCompositePassTSLConfig,
  type ShellGlowConfig,
} from './EnvironmentCompositePassTSL'

// =============================================================================
// Output
// =============================================================================

export { ToScreenPassTSL, type ToScreenPassTSLConfig } from './ToScreenPassTSL'

// =============================================================================
// Utility Passes
// =============================================================================

export { CopyPassTSL, type CopyPassTSLConfig } from './CopyPassTSL'
export {
  CompositePassTSL,
  type CompositePassTSLConfig,
  type CompositeInput,
  type BlendMode,
} from './CompositePassTSL'

// =============================================================================
// G-Buffer Passes
// =============================================================================

export { DebugOverlayPassTSL, type DebugOverlayPassTSLConfig } from './DebugOverlayPassTSL'
export { DepthPassTSL, type DepthPassTSLConfig } from './DepthPassTSL'
export { MainObjectMRTPassTSL, type MainObjectMRTPassTSLConfig } from './MainObjectMRTPassTSL'
export { NormalPassTSL, type NormalPassTSLConfig } from './NormalPassTSL'

// =============================================================================
// Environment Passes
// =============================================================================

export { CubemapCapturePassTSL, type CubemapCapturePassTSLConfig } from './CubemapCapturePassTSL'

// =============================================================================
// Temporal Passes
// =============================================================================

export { TemporalCloudPassTSL, type TemporalCloudPassTSLConfig } from './TemporalCloudPassTSL'
export {
  TemporalDepthCapturePassTSL,
  type TemporalDepthCapturePassTSLConfig,
  type TemporalDepthUniformsTSL,
  invalidateAllTemporalDepthTSL,
} from './TemporalDepthCapturePassTSL'

// =============================================================================
// Effect Passes
// =============================================================================

export { BloomPassTSL, type BloomPassTSLConfig } from './BloomPassTSL'
export {
  BufferPreviewPassTSL,
  type BufferPreviewPassTSLConfig,
  type BufferType,
  type DepthMode,
} from './BufferPreviewPassTSL'
export { BokehPassTSL, type BokehPassTSLConfig } from './BokehPassTSL'
export { CinematicPassTSL, type CinematicPassTSLConfig } from './CinematicPassTSL'
export { FrameBlendingPassTSL, type FrameBlendingPassTSLConfig } from './FrameBlendingPassTSL'
export { FXAAPassTSL, type FXAAPassTSLConfig } from './FXAAPassTSL'
export { GTAOPassTSL, type GTAOPassTSLConfig } from './GTAOPassTSL'
export { PaperTexturePassTSL, type PaperTexturePassTSLConfig } from './PaperTexturePassTSL'
export { RefractionPassTSL, type RefractionPassTSLConfig } from './RefractionPassTSL'
export {
  ScreenSpaceLensingPassTSL,
  type ScreenSpaceLensingPassTSLConfig,
} from './ScreenSpaceLensingPassTSL'
export { SMAAPassTSL, type SMAAPassTSLConfig } from './SMAAPassTSL'
export { SSRPassTSL, type SSRPassTSLConfig } from './SSRPassTSL'
export { ToneMappingPassTSL, type ToneMappingPassTSLConfig } from './ToneMappingPassTSL'
export {
  ToneMappingCinematicPassTSL,
  type ToneMappingCinematicPassTSLConfig,
} from './ToneMappingCinematicPassTSL'
