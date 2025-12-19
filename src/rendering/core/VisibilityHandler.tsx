/**
 * VisibilityHandler - Page visibility change handler.
 *
 * Tracks page visibility state and checks for context loss when
 * the page becomes visible again. This is particularly important
 * for mobile devices where the OS may reclaim WebGL contexts
 * when the app is backgrounded.
 *
 * This component lives INSIDE the R3F Canvas to access the gl context.
 *
 * @module rendering/core/VisibilityHandler
 */

import { useWebGLContextStore } from '@/stores/webglContextStore'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/**
 * Handles page visibility changes and checks context state.
 * Returns null as it's a logic-only component with no visual output.
 * @returns null - no visual output
 */
export function VisibilityHandler(): null {
  const { gl } = useThree()

  useEffect(() => {
    const store = useWebGLContextStore.getState

    /**
     * Handle visibility change event.
     * When page becomes visible, check if context was lost while hidden.
     */
    const handleVisibilityChange = (): void => {
      const isVisible = document.visibilityState === 'visible'
      store().onVisibilityChange(isVisible)

      if (isVisible) {
        // Check if context was lost while page was hidden
        // This commonly happens on mobile when app is backgrounded
        const context = gl.getContext()
        if (context && context.isContextLost()) {
          const currentStatus = store().status
          // Only trigger if not already in lost/restoring/failed state
          if (currentStatus === 'active') {
            store().onContextLost()
          }
        }
      }
    }

    /**
     * Handle page hide event (mobile-specific).
     * Used in conjunction with pageshow for bfcache handling.
     */
    const handlePageHide = (): void => {
      store().onVisibilityChange(false)
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('pagehide', handlePageHide)

    // Check initial visibility state
    if (document.visibilityState !== 'visible') {
      store().onVisibilityChange(false)
    }

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('pagehide', handlePageHide)
    }
  }, [gl])

  return null
}
