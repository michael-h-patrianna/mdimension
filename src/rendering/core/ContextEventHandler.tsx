/**
 * ContextEventHandler - WebGL context loss/restoration event handler.
 *
 * This component lives INSIDE the R3F Canvas and listens for WebGL context
 * events on the canvas element. It coordinates with the WebGLContextStore
 * and ResourceRecovery system to handle context loss gracefully.
 *
 * IMPORTANT: Must be placed as a child of <Canvas>, not outside it.
 *
 * @module rendering/core/ContextEventHandler
 */

import { useThree } from '@react-three/fiber'
import { useEffect, useRef, useCallback } from 'react'
import { useWebGLContextStore } from '@/stores/webglContextStore'
import { resourceRecovery } from './ResourceRecovery'

/** WEBGL_lose_context extension interface */
interface WEBGL_lose_context {
  loseContext(): void
  restoreContext(): void
}

/**
 * Handles WebGL context loss and restoration events.
 * Returns null as it's a logic-only component with no visual output.
 */
export function ContextEventHandler(): null {
  const { gl } = useThree()
  const recoveryTimeoutRef = useRef<number | null>(null)
  const loseContextExtRef = useRef<WEBGL_lose_context | null>(null)

  // Subscribe to debug context loss trigger
  const debugContextLossCounter = useWebGLContextStore((s) => s.debugContextLossCounter)

  // Debug: Force context loss for testing (only in development)
  const forceContextLoss = useCallback(() => {
    if (!loseContextExtRef.current) {
      loseContextExtRef.current = gl.getContext().getExtension(
        'WEBGL_lose_context'
      ) as WEBGL_lose_context | null
    }

    if (loseContextExtRef.current) {
      console.warn('[ContextEventHandler] Forcing context loss for debugging')
      loseContextExtRef.current.loseContext()

      // Simulated context loss requires manual restore - browser only auto-restores real GPU crashes
      window.setTimeout(() => {
        if (loseContextExtRef.current) {
          console.warn('[ContextEventHandler] Restoring context after simulated loss')
          loseContextExtRef.current.restoreContext()
        }
      }, 3000)
    } else {
      console.warn('[ContextEventHandler] WEBGL_lose_context extension not available')
    }
  }, [gl])

  // Trigger context loss when debugContextLossCounter changes
  useEffect(() => {
    if (debugContextLossCounter > 0) {
      forceContextLoss()
    }
  }, [debugContextLossCounter, forceContextLoss])

  useEffect(() => {
    const canvas = gl.domElement
    const store = useWebGLContextStore.getState

    /**
     * Handle context lost event.
     * CRITICAL: event.preventDefault() allows the browser to attempt restoration.
     */
    const handleContextLost = (event: Event): void => {
      // Cast to WebGLContextEvent for type safety
      const contextEvent = event as WebGLContextEvent
      contextEvent.preventDefault() // CRITICAL: allows browser to restore context

      // Clear any pending recovery timeout
      if (recoveryTimeoutRef.current !== null) {
        window.clearTimeout(recoveryTimeoutRef.current)
        recoveryTimeoutRef.current = null
      }

      store().onContextLost()

      // Set up recovery timeout with exponential backoff
      const timeout = store().getCurrentTimeout()
      recoveryTimeoutRef.current = window.setTimeout(() => {
        const state = store()
        if (state.status === 'lost' || state.status === 'restoring') {
          // Check if we've exceeded max attempts
          if (state.recoveryAttempts >= state.recoveryConfig.maxAttempts) {
            store().onContextFailed('Maximum recovery attempts exceeded')
          }
        }
      }, timeout)
    }

    /**
     * Handle context restored event.
     * Triggers resource reinitialization in priority order.
     */
    const handleContextRestored = async (): Promise<void> => {
      // Clear recovery timeout
      if (recoveryTimeoutRef.current !== null) {
        window.clearTimeout(recoveryTimeoutRef.current)
        recoveryTimeoutRef.current = null
      }

      const store = useWebGLContextStore.getState()
      store.onContextRestoring()

      try {
        // Trigger resource recovery in priority order
        await resourceRecovery.recover(gl)
        useWebGLContextStore.getState().onContextRestored()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown recovery error'
        useWebGLContextStore.getState().onContextFailed(message)
      }
    }

    /**
     * iOS Safari specific: Handle page show event for bfcache.
     * When page is restored from bfcache, context may be lost.
     */
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        // Page was restored from bfcache
        const context = gl.getContext()
        if (context && context.isContextLost()) {
          store().onContextLost()
        }
      }
    }

    // Add event listeners
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    window.addEventListener('pageshow', handlePageShow)

    // Cleanup
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      window.removeEventListener('pageshow', handlePageShow)

      if (recoveryTimeoutRef.current !== null) {
        window.clearTimeout(recoveryTimeoutRef.current)
      }
    }
  }, [gl])

  return null
}
