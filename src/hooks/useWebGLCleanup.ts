/**
 * useWebGLCleanup Hook
 *
 * Automatically cleans up WebGL state when scene transitions occur.
 * Should be used in a component inside the Canvas.
 */

import { cleanupWebGLState } from '@/rendering/core/webglCleanup'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * Hook that cleans up WebGL render lists when scene transitions occur.
 *
 * This prevents memory accumulation from orphaned render list entries
 * when switching between different object types or loading presets.
 *
 * Must be used inside a React Three Fiber Canvas component.
 */
export function useWebGLCleanup(): void {
  const gl = useThree((state) => state.gl)
  const prevTransitioningRef = useRef(false)

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = usePerformanceStore.subscribe((state) => {
      const sceneTransitioning = state.sceneTransitioning

      // Clean up when transition starts (entering transitioning state)
      if (sceneTransitioning && !prevTransitioningRef.current) {
        cleanupWebGLState(gl, { resetRenderLists: true })
      }
      prevTransitioningRef.current = sceneTransitioning
    })

    return unsubscribe
  }, [gl])
}
