/**
 * Temporal Depth Hooks
 *
 * React hooks for accessing temporal depth state from context.
 *
 * @module rendering/core/useTemporalDepth
 */

import { useContext } from 'react'

import { TemporalDepthContext } from './temporalDepthContextDef'
import type { TemporalDepthState } from './TemporalDepthState'

/**
 * Hook to access the temporal depth state from the current context.
 *
 * Must be used within a TemporalDepthProvider.
 *
 * @returns The TemporalDepthState instance for the current viewport/scene
 * @throws Error if used outside of TemporalDepthProvider
 *
 * @example
 * ```tsx
 * function MyMesh() {
 *   const temporalDepth = useTemporalDepth();
 *
 *   useFrame(() => {
 *     const uniforms = temporalDepth.getUniforms();
 *     material.uniforms.uTemporalEnabled.value = uniforms.uTemporalEnabled;
 *   });
 * }
 * ```
 */
export function useTemporalDepth(): TemporalDepthState {
  const state = useContext(TemporalDepthContext)
  if (!state) {
    throw new Error(
      'useTemporalDepth must be used within a TemporalDepthProvider. ' +
        'Wrap your Scene component with <TemporalDepthProvider>.'
    )
  }
  return state
}

/**
 * Hook to optionally access temporal depth state (returns null if not in provider).
 * Useful for components that may or may not be within a TemporalDepthProvider.
 *
 * @returns The TemporalDepthState instance or null if not in provider
 */
export function useTemporalDepthOptional(): TemporalDepthState | null {
  return useContext(TemporalDepthContext)
}
