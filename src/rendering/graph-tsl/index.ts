/**
 * TSL Render Graph Module
 *
 * WebGPU/TSL-compatible render graph system.
 * Provides the same architecture as the WebGL render graph with TSL-specific adaptations.
 *
 * ## Usage
 * ```typescript
 * import { RenderGraphTSL, ScenePassTSL } from '@/rendering/graph-tsl';
 *
 * const graph = new RenderGraphTSL();
 * graph.initialize(renderer);
 * graph.declareResource({ id: 'scene', type: 'renderTarget', ... });
 * graph.registerPass(new ScenePassTSL('scene', { ... }));
 * graph.compile();
 *
 * // In render loop:
 * graph.execute(renderer, scene, camera, delta);
 * ```
 *
 * @module rendering/graph-tsl
 */

// Core graph
export { RenderGraphTSL } from './RenderGraphTSL'

// Base pass class
export { BasePassTSL } from './BasePassTSL'

// Timer
export { GPUTimerTSL } from './GPUTimerTSL'

// State barrier
export { StateBarrierTSL } from './StateBarrierTSL'

// Types
export type {
  RenderContextTSL,
  RenderPassTSL,
  SupportedRenderer,
  SupportedRenderTarget,
} from './types'

// Re-export shared types from WebGL graph for convenience
export type {
  RenderResourceConfig,
  RenderPassConfig,
  ResourceAccess,
  ResourceSize,
  ResourceSizeMode,
  ResourceType,
  AccessMode,
  CompiledGraph,
  CompileOptions,
  FrameStats,
  PassTiming,
} from '@/rendering/graph/types'

// Re-export shared classes that work with both backends
export { ResourcePool } from '@/rendering/graph/ResourcePool'
export { GraphCompiler } from '@/rendering/graph/GraphCompiler'
export { captureFrameContext, createEmptyFrameContext } from '@/rendering/graph/FrameContext'
export type {
  FrozenFrameContext,
  FrozenStoreState,
  StoreGetters,
} from '@/rendering/graph/FrameContext'
export { ExternalBridge } from '@/rendering/graph/ExternalBridge'
export { BasePass } from '@/rendering/graph/BasePass'

// Passes
export * from './passes'
