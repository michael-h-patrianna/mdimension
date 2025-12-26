/**
 * Last Frame Context Module
 *
 * Provides global access to the last captured frame context.
 * This allows components outside the render graph (like useBlackHoleUniformUpdates)
 * to read frozen state consistently.
 *
 * IMPORTANT: This is set at the START of each frame by RenderGraph.execute().
 * Components running before execute() will see the PREVIOUS frame's context,
 * which is the intended behavior for frame consistency.
 */

import type { FrozenFrameContext } from './FrameContext'

let lastFrameContext: FrozenFrameContext | null = null

/**
 * Set the last frame context (called by RenderGraph.execute())
 * @param ctx
 */
export function setLastFrameContext(ctx: FrozenFrameContext | null): void {
  lastFrameContext = ctx
}

/**
 * Get the last captured frame context.
 *
 * Returns the frozen context from the most recent frame where execute() ran.
 * For components running before execute() in the current frame, this returns
 * the PREVIOUS frame's context - ensuring frame-consistent reads.
 *
 * @returns The last frozen frame context, or null if not yet captured
 */
export function getLastFrameContext(): FrozenFrameContext | null {
  return lastFrameContext
}

/**
 * Get a specific external value from the last frame context.
 *
 * @param key - The external value key ('sceneBackground' or 'sceneEnvironment')
 * @returns The captured value, or null if not available
 */
export function getLastFrameExternal<K extends keyof FrozenFrameContext['external']>(
  key: K
): FrozenFrameContext['external'][K] | null {
  return lastFrameContext?.external[key] ?? null
}
