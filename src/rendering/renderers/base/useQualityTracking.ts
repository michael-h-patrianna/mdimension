/**
 * Hook for adaptive quality tracking during user interactions.
 *
 * Reduces rendering quality during rotation/animation to maintain smooth
 * frame rates, then restores quality after a delay when interaction stops.
 *
 * @module rendering/renderers/base/useQualityTracking
 */

import { usePerformanceStore } from '@/stores/performanceStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { QUALITY_RESTORE_DELAY_MS } from './types'

/**
 * Options for the useQualityTracking hook.
 */
export interface UseQualityTrackingOptions {
  /**
   * Whether quality tracking is enabled.
   * When false, quality tracking is skipped and fastMode is always false.
   * @default true
   */
  enabled?: boolean
}

/**
 * Return value from useQualityTracking hook.
 */
export interface UseQualityTrackingResult {
  /**
   * Whether fast (low quality) mode is currently active.
   * True during rotation and for QUALITY_RESTORE_DELAY_MS after rotation stops.
   */
  fastMode: boolean

  /**
   * Quality multiplier from performance store.
   * Used for progressive refinement and adaptive quality.
   */
  qualityMultiplier: number

  /**
   * Whether rotations changed since the last frame.
   * Useful for triggering recomputation of rotation-dependent values.
   */
  rotationsChanged: boolean

  /**
   * Current rotation version from the rotation store.
   * Can be used for fine-grained change detection.
   */
  rotationVersion: number

  /**
   * Whether fractal animation low quality is enabled in performance settings.
   * When false, fastMode should not affect rendering quality.
   */
  fractalAnimLowQuality: boolean

  /**
   * Computed effective fast mode value.
   * This is fastMode AND fractalAnimLowQuality.
   * Use this for uniform updates.
   */
  effectiveFastMode: boolean
}

/**
 * Hook for tracking and managing adaptive quality during user interactions.
 *
 * This hook monitors the rotation store for changes and manages a "fast mode"
 * that reduces rendering quality during active rotation. After rotation stops,
 * quality is restored after a configurable delay.
 *
 * Uses proper React state management to ensure re-renders when fastMode changes,
 * avoiding render-time side effects that violate React's render model.
 *
 * @param options - Hook configuration options
 * @returns Quality tracking state and utilities
 *
 * @example
 * ```tsx
 * const { effectiveFastMode, qualityMultiplier, rotationsChanged } = useQualityTracking();
 *
 * useFrame(() => {
 *   if (material.uniforms.uFastMode) {
 *     material.uniforms.uFastMode.value = effectiveFastMode;
 *   }
 *   if (material.uniforms.uQualityMultiplier) {
 *     material.uniforms.uQualityMultiplier.value = qualityMultiplier;
 *   }
 *
 *   if (rotationsChanged) {
 *     // Recompute rotation-dependent values
 *   }
 * }, FRAME_PRIORITY.RENDERER_UNIFORMS);
 * ```
 */
export function useQualityTracking(
  options: UseQualityTrackingOptions = {}
): UseQualityTrackingResult {
  const { enabled = true } = options

  // Use state for fastMode so changes trigger re-renders
  const [fastMode, setFastMode] = useState(false)

  // Track rotation version for change detection
  const prevVersionRef = useRef<number>(-1)
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get current state from stores - using proper selectors for reactivity
  const rotationVersion = useRotationStore((s) => s.version)

  const perfSelector = useShallow((s: ReturnType<typeof usePerformanceStore.getState>) => ({
    qualityMultiplier: s.qualityMultiplier,
    fractalAnimLowQuality: s.fractalAnimationLowQuality,
  }))

  const { qualityMultiplier, fractalAnimLowQuality } = usePerformanceStore(perfSelector)

  // Detect rotation changes (computed during render, but no side effects)
  const rotationsChanged = enabled && rotationVersion !== prevVersionRef.current

  // Clear timeout helper
  const clearRestoreTimeout = useCallback(() => {
    if (restoreQualityTimeoutRef.current) {
      clearTimeout(restoreQualityTimeoutRef.current)
      restoreQualityTimeoutRef.current = null
    }
  }, [])

  // Handle rotation changes in useEffect to avoid render-time side effects
  useEffect(() => {
    if (!enabled) {
      // When disabled, ensure fastMode is off and clean up
      setFastMode(false)
      clearRestoreTimeout()
      return
    }

    // Check if rotation version changed
    if (rotationVersion !== prevVersionRef.current) {
      // Rotation is happening - switch to fast mode
      prevVersionRef.current = rotationVersion
      setFastMode(true)

      // Clear any pending quality restore timeout
      clearRestoreTimeout()
    } else if (fastMode) {
      // Rotation stopped but still in fast mode - schedule quality restore
      if (!restoreQualityTimeoutRef.current) {
        restoreQualityTimeoutRef.current = setTimeout(() => {
          setFastMode(false)
          restoreQualityTimeoutRef.current = null
        }, QUALITY_RESTORE_DELAY_MS)
      }
    }

    // Cleanup on unmount or when deps change
    return () => {
      clearRestoreTimeout()
    }
  }, [enabled, rotationVersion, fastMode, clearRestoreTimeout])

  // Update prevVersionRef when rotationVersion changes
  // This is safe because it's just a ref update for tracking
  if (rotationsChanged) {
    prevVersionRef.current = rotationVersion
  }

  return {
    fastMode,
    qualityMultiplier,
    rotationsChanged,
    rotationVersion,
    fractalAnimLowQuality,
    effectiveFastMode: fractalAnimLowQuality && fastMode,
  }
}
