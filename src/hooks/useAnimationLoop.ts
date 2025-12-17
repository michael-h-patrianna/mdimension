/**
 * Animation Loop Hook
 * Uses requestAnimationFrame to animate rotations
 */

import { getPlaneMultiplier } from '@/lib/animation/biasCalculation'
import { useAnimationStore } from '@/stores/animationStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useUIStore } from '@/stores/uiStore'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook that runs the animation loop when animation is playing
 * Updates rotation angles for all animating planes
 * Pauses during skybox loading or scene transitions to avoid visual artifacts
 */
export function useAnimationLoop(): void {
  const isPlaying = useAnimationStore((state) => state.isPlaying)
  const animatingPlanes = useAnimationStore((state) => state.animatingPlanes)
  const getRotationDelta = useAnimationStore((state) => state.getRotationDelta)
  const skyboxLoading = useEnvironmentStore((state) => state.skyboxLoading)
  const sceneTransitioning = usePerformanceStore((state) => state.sceneTransitioning)

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

      // Use 1ms tolerance to handle floating point precision issues.
      // Without tolerance, RAF timing (~16.665999ms) can be slightly less than
      // frameInterval (16.666666ms), causing every other frame to be skipped.
      // 1ms provides reliable tolerance across different systems while maintaining FPS accuracy.
      if (deltaTime < frameInterval - 1) {
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

        // Normalize to [0, 2π) - using modulo for safety against NaN/Infinity
        if (!isFinite(newAngle)) {
          newAngle = 0
        } else {
          newAngle = ((newAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
        }

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
    // Don't animate while skybox is loading or scene is transitioning to avoid artifacts
    const shouldAnimate =
      isPlaying && animatingPlanes.size > 0 && !skyboxLoading && !sceneTransitioning
    if (shouldAnimate) {
      lastTimeRef.current = null
      frameRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [isPlaying, animatingPlanes, animate, skyboxLoading, sceneTransitioning])
}
