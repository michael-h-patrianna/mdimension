/**
 * Base Pass Implementation for TSL
 *
 * Abstract base class for TSL render passes that provides common functionality.
 * Extend this class to create custom TSL passes.
 *
 * @module rendering/graph-tsl/BasePassTSL
 */

import type { RenderPassConfig } from '../graph/types'
import type { RenderContextTSL, RenderPassTSL } from './types'

/**
 * Abstract base class for TSL render passes.
 *
 * Provides:
 * - Configuration storage
 * - ID/config accessors
 * - Optional dispose method
 *
 * @example
 * ```typescript
 * class MyCustomPass extends BasePassTSL {
 *   constructor() {
 *     super({
 *       id: 'my-custom',
 *       inputs: [{ resourceId: 'sceneColor', access: 'read' }],
 *       outputs: [{ resourceId: 'output', access: 'write' }],
 *     });
 *   }
 *
 *   execute(ctx: RenderContextTSL): void {
 *     const input = ctx.getReadTexture('sceneColor');
 *     const output = ctx.getWriteTarget('output');
 *
 *     // ... render logic
 *   }
 * }
 * ```
 */
export abstract class BasePassTSL implements RenderPassTSL {
  readonly config: RenderPassConfig

  constructor(config: RenderPassConfig) {
    this.config = config
  }

  get id(): string {
    return this.config.id
  }

  /**
   * Execute the pass.
   *
   * Subclasses must implement this method.
   *
   * @param ctx - TSL render context with access to resources and renderer
   */
  abstract execute(ctx: RenderContextTSL): void

  /**
   * Optional cleanup when pass is removed.
   *
   * Override this to dispose of any GPU resources the pass owns.
   */
  dispose(): void {
    // Default: no cleanup needed
  }

  /**
   * Optional: Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    // Default: no cleanup needed
  }
}
