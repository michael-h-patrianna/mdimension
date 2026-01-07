/**
 * TSL Render Graph Type Definitions
 *
 * Renderer-agnostic types for WebGPU/TSL render graph system.
 * Extends the WebGL types to support both WebGLRenderer and WebGPURenderer.
 *
 * Design principle: Use base THREE types (RenderTarget, Renderer) where possible
 * to ensure compatibility across renderer backends.
 *
 * @module rendering/graph-tsl/types
 */

import type * as THREE from 'three'
import type { WebGPURenderer } from 'three/webgpu'

import type { ExternalResourceId, PendingExport } from '../graph/ExternalBridge'
import type { FrozenFrameContext } from '../graph/FrameContext'

// =============================================================================
// Re-export shared types from WebGL graph
// =============================================================================

// These types are renderer-agnostic and can be shared directly
export type {
  ResourceSizeMode,
  ResourceSize,
  ResourceType,
  RenderResourceConfig,
  AccessMode,
  ResourceAccess,
  RenderPassConfig,
  RenderPass,
  CompiledGraph,
  CompileOptions,
  PassTiming,
  FrameStats,
} from '../graph/types'

// =============================================================================
// Renderer Types
// =============================================================================

/**
 * Union type for supported renderers.
 * Allows passes to work with both WebGL and WebGPU backends.
 */
export type SupportedRenderer = THREE.WebGLRenderer | WebGPURenderer

/**
 * Union type for render targets.
 * THREE.RenderTarget is the base class for all render targets.
 */
export type SupportedRenderTarget = THREE.RenderTarget | THREE.WebGLRenderTarget

// =============================================================================
// TSL Render Context
// =============================================================================

/**
 * Renderer-agnostic execution context for TSL render graph.
 *
 * Provides access to:
 * - Resolved GPU resources (render targets, textures)
 * - Three.js renderer (WebGL or WebGPU)
 * - Scene and camera
 * - Frame timing information
 */
export interface RenderContextTSL {
  /** Three.js renderer (WebGL or WebGPU) */
  renderer: SupportedRenderer

  /** Current scene */
  scene: THREE.Scene

  /** Current camera */
  camera: THREE.Camera

  /** Frame delta time in seconds */
  delta: number

  /** Total elapsed time in seconds */
  time: number

  /** Current viewport size */
  size: { width: number; height: number }

  /**
   * Whether this context is using WebGPU backend.
   * Passes can use this to select appropriate shader paths.
   */
  isWebGPU: boolean

  /**
   * Get a resource's GPU object.
   *
   * For render targets, returns RenderTarget (WebGL or WebGPU).
   * For textures, returns Texture.
   *
   * @param resourceId - Resource identifier
   * @returns The GPU resource or null if not found
   */
  getResource<T = SupportedRenderTarget | THREE.Texture>(resourceId: string): T | null

  /**
   * Get the write target for a resource (handles ping-pong).
   *
   * For resources with read-while-write access, this returns
   * the ping-pong swap buffer.
   *
   * @param resourceId - Resource identifier
   * @returns The write target or null
   */
  getWriteTarget(resourceId: string): SupportedRenderTarget | null

  /**
   * Get the read target for a ping-pong resource.
   *
   * For non-ping-pong resources, returns the primary target.
   *
   * @param resourceId - Resource identifier
   * @returns The read target or null
   */
  getReadTarget(resourceId: string): SupportedRenderTarget | null

  /**
   * Get the read texture for a resource.
   *
   * @param resourceId - Resource identifier
   * @param attachment - Optional attachment index for MRT, or 'depth' for depth texture
   * @returns The read texture or null
   */
  getReadTexture(resourceId: string, attachment?: number | 'depth'): THREE.Texture | null

  /**
   * Get a frozen external resource captured at frame start.
   *
   * External resources are values from outside the render graph (scene.background,
   * store values, etc.) that are captured once at frame start and remain frozen
   * throughout frame execution.
   *
   * @param id - External resource identifier
   * @returns The captured value or null if not found/invalid
   */
  getExternal<T>(id: string): T | null

  /**
   * Get the frozen frame context.
   *
   * Contains all store state and external values captured at frame start.
   * This is the preferred way to access store state from passes, as it
   * guarantees consistent values throughout the frame.
   *
   * @returns Frozen frame context or null if not captured
   */
  readonly frame: FrozenFrameContext | null

  /**
   * Queue an export to be applied at frame end.
   *
   * Passes use this to export internal resources to external systems
   * (like scene.background, scene.environment). Exports are batched and
   * applied AFTER all passes complete to maintain consistent state.
   *
   * @param pending - The export to queue
   */
  queueExport<T>(pending: PendingExport<T>): void

  /**
   * Check if an export is registered with the bridge.
   *
   * @param id - External resource ID
   * @returns True if the export is registered
   */
  hasExportRegistered(id: ExternalResourceId): boolean
}

// =============================================================================
// TSL Pass Interface
// =============================================================================

/**
 * TSL-specific render pass interface.
 *
 * Extends the base RenderPass with TSL-specific context.
 */
export interface RenderPassTSL {
  /** Unique identifier */
  readonly id: string

  /** Pass configuration */
  readonly config: import('../graph/types').RenderPassConfig

  /**
   * Execute this pass with TSL context.
   *
   * @param ctx - TSL render context with access to resources and renderer
   */
  execute(ctx: RenderContextTSL): void

  /**
   * Optional post-frame hook for temporal resource advancement.
   */
  postFrame?(): void

  /**
   * Optional cleanup when pass is removed from graph.
   */
  dispose?(): void

  /**
   * Optional: Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources?(): void
}
