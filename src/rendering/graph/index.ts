/**
 * Render Graph Module
 *
 * Declarative render graph system for managing complex rendering pipelines.
 *
 * Key exports:
 * - RenderGraph: Main orchestrator
 * - GPUTimer: WebGL2 timer queries for GPU timing
 * - BasePass: Abstract base class for custom passes
 * - GraphCompiler: Dependency resolution and ordering
 * - ResourcePool: GPU resource management
 * - Built-in passes: ScenePass, FullscreenPass, ToScreenPass
 *
 * @module rendering/graph
 */

// Core classes
export { BasePass } from './BasePass'
export { GPUTimer, type GPUTimingResult } from './GPUTimer'
export { GraphCompiler } from './GraphCompiler'
export { RenderGraph } from './RenderGraph'
export { ResourcePool } from './ResourcePool'

// Built-in passes
export {
  // Effect passes
  BloomPass,
  CompositePass,
  // G-buffer passes
  DepthPass,
  FullscreenPass,
  NormalPass,
  // Core passes
  ScenePass,
  ScreenSpaceLensingPass,
  ToScreenPass,
  type BlendMode,
  type BloomPassConfig,
  type CompositeInput,
  type CompositePassConfig,
  type DepthPassConfig,
  type FullscreenPassConfig,
  type NormalPassConfig,
  // Types
  type ScenePassConfig,
  type ScreenSpaceLensingPassConfig,
  type ToScreenPassConfig,
} from './passes'

// Types
export type {
  AccessMode,
  CompileOptions,
  CompiledGraph,
  // Statistics types
  FrameStats,
  PassTiming,
  // Execution types
  RenderContext,
  // Pass types
  RenderPass,
  RenderPassConfig,
  // Resource types
  RenderResourceConfig,
  ResourceAccess,
  ResourceSize,
  ResourceSizeMode,
  ResourceType,
} from './types'
