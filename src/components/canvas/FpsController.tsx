/**
 * FPS Controller Component
 *
 * Controls render rate using the R3F recommended pattern:
 * - Uses frameloop="never" to disable automatic rendering
 * - Uses requestAnimationFrame for timing (syncs with display refresh)
 * - Calls advance() to trigger frames at the target FPS
 *
 * @see https://github.com/pmndrs/react-three-fiber/discussions/667
 *
 * @remarks
 * - Must be placed inside a Canvas component with frameloop="never"
 * - Uses requestAnimationFrame instead of setInterval for accurate timing
 * - Subscribes to maxFps changes and adjusts timing accordingly
 */

import { useUIStore } from '@/stores/uiStore'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'

/**
 * FPS Controller that triggers renders at a controlled rate.
 *
 * Uses the R3F maintainer-recommended pattern with requestAnimationFrame
 * and advance() for proper frame limiting that syncs with display refresh.
 *
 * @returns null - This component renders nothing, only manages frame timing
 *
 * @example
 * ```tsx
 * <Canvas frameloop="never">
 *   <FpsController />
 *   <Scene />
 * </Canvas>
 * ```
 */
export function FpsController(): null {
  const { advance } = useThree()
  const rafRef = useRef<number | null>(null)
  const thenRef = useRef<number>(0)

  useLayoutEffect(() => {
    /**
     * Animation tick using requestAnimationFrame.
     * Only advances the frame when enough time has elapsed based on maxFps.
     * @param now
     */
    const tick = (now: number): void => {
      rafRef.current = requestAnimationFrame(tick)

      const maxFps = useUIStore.getState().maxFps
      const interval = 1000 / maxFps
      const elapsed = now - thenRef.current

      if (elapsed >= interval) {
        // Advance the frame - this triggers useFrame callbacks and renders
        // Pass timestamp for proper delta calculation in useFrame
        advance(now)
        // Account for elapsed time to prevent drift
        thenRef.current = now - (elapsed % interval)
      }
    }

    // Start the animation loop
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [advance])

  return null
}
