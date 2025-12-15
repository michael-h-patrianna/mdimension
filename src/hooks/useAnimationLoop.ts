/**
 * Animation Loop Hook
 * Uses requestAnimationFrame to animate rotations
 */

import { getPlaneMultiplier } from '@/lib/animation/biasCalculation'
import { useAnimationStore } from '@/stores/animationStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook that runs the animation loop when animation is playing
 * Updates rotation angles for all animating planes
 * Pauses during skybox loading to avoid visual distraction
 */
export function useAnimationLoop(): void {
  const isPlaying = useAnimationStore((state) => state.isPlaying)
  const animatingPlanes = useAnimationStore((state) => state.animatingPlanes)
  const getRotationDelta = useAnimationStore((state) => state.getRotationDelta)
  const skyboxLoading = useEnvironmentStore((state) => state.skyboxLoading)

  const updateRotations = useRotationStore((state) => state.updateRotations)
  const getRotationRadians = useCallback((plane: string) => {
    return useRotationStore.getState().rotations.get(plane) ?? 0
  }, [])

  const lastTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  // Reusable Map for rotation updates (avoids allocation every frame)
  const updatesRef = useRef(new Map<string, number>())

  const animate = useCallback(
    (currentTime: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = currentTime - lastTimeRef.current

      // Skip if delta is too large (e.g., tab was inactive)
      if (deltaTime > 100) {
        lastTimeRef.current = currentTime
        frameRef.current = requestAnimationFrame(animate)
        return
      }

      // Throttle based on maxFps setting
      const maxFps = useUIStore.getState().maxFps
      const frameInterval = 1000 / maxFps

      if (deltaTime < frameInterval) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }

      // Snap to frame boundary to prevent drift
      lastTimeRef.current = currentTime - (deltaTime % frameInterval)

      const rotationDelta = getRotationDelta(deltaTime)
      // Get animation bias from visual store (0 = uniform, 1 = wildly different)
      const animationBias = useUIStore.getState().animationBias
      // Get fresh animating planes from store to avoid stale closure
      const currentAnimatingPlanes = useAnimationStore.getState().animatingPlanes
      // Reuse Map instance to avoid allocation every frame (60 FPS = 60 allocations/sec)
      const updates = updatesRef.current
      updates.clear()

      // Update each animating plane with per-plane bias multiplier
      const totalPlanes = currentAnimatingPlanes.size
      let planeIndex = 0
      currentAnimatingPlanes.forEach((plane) => {
        const currentAngle = getRotationRadians(plane)
        // Apply per-plane bias multiplier using golden ratio spread
        const multiplier = getPlaneMultiplier(planeIndex, totalPlanes, animationBias)
        const biasedDelta = rotationDelta * multiplier
        let newAngle = currentAngle + biasedDelta

        // Normalize to [0, 2π)
        while (newAngle < 0) newAngle += 2 * Math.PI
        while (newAngle >= 2 * Math.PI) newAngle -= 2 * Math.PI

        updates.set(plane, newAngle)
        planeIndex++
      })

      if (updates.size > 0) {
        updateRotations(updates)
      }

      frameRef.current = requestAnimationFrame(animate)
    },
    [animatingPlanes, getRotationDelta, getRotationRadians, updateRotations]
  )

  useEffect(() => {
    // Don't animate while skybox is loading to avoid distraction
    if (isPlaying && animatingPlanes.size > 0 && !skyboxLoading) {
      lastTimeRef.current = null
      frameRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [isPlaying, animatingPlanes, animate, skyboxLoading])
}
