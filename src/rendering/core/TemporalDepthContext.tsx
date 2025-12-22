/**
 * Temporal Depth Provider
 *
 * React Context Provider for temporal depth state.
 * Provides per-scene scoped temporal depth state for raymarching acceleration.
 *
 * @module rendering/core/TemporalDepthContext
 */

import { useEffect, useMemo, type ReactNode } from 'react';

import { TemporalDepthContext } from './temporalDepthContextDef';
import { TemporalDepthState } from './TemporalDepthState';

// =============================================================================
// Provider Component
// =============================================================================

export interface TemporalDepthProviderProps {
  children: ReactNode;
}

/**
 * Provider component that creates and manages a TemporalDepthState instance.
 *
 * Wrap your scene/viewport with this provider to scope temporal depth state
 * to that subtree. All child components using useTemporalDepth() will share
 * the same instance.
 *
 * @param props - Component props
 * @param props.children - Child components to wrap
 * @returns React element with context provider
 *
 * @example
 * ```tsx
 * <TemporalDepthProvider>
 *   <PostProcessingV2 />
 *   <UnifiedRenderer />
 * </TemporalDepthProvider>
 * ```
 */
export function TemporalDepthProvider({ children }: TemporalDepthProviderProps) {
  const state = useMemo(() => new TemporalDepthState(), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      state.dispose();
    };
  }, [state]);

  return (
    <TemporalDepthContext.Provider value={state}>
      {children}
    </TemporalDepthContext.Provider>
  );
}
