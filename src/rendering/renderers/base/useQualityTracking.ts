/**
 * Hook for adaptive quality tracking during animation playback.
 *
 * Reduces rendering quality during animation to maintain smooth
 * frame rates, restores quality when animation is paused.
 *
 * @module rendering/renderers/base/useQualityTracking
 */

import { useAnimationStore } from '@/stores/animationStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useRotationStore } from '@/stores/rotationStore'
import { useShallow } from 'zustand/react/shallow'

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
   * True when animation is playing.
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

  // Get current state from stores - using proper selectors for reactivity
  const isPlaying = useAnimationStore((s) => s.isPlaying)
  const rotationVersion = useRotationStore((s) => s.version)

  const perfSelector = useShallow((s: ReturnType<typeof usePerformanceStore.getState>) => ({
    qualityMultiplier: s.qualityMultiplier,
    fractalAnimLowQuality: s.fractalAnimationLowQuality,
  }))

  const { qualityMultiplier, fractalAnimLowQuality } = usePerformanceStore(perfSelector)

  // Fast mode is simply: animation is playing (regardless of which planes are selected)
  // This applies to all object types uniformly
  const fastMode = enabled && isPlaying

  // Rotation changes detection for callers that need it
  // Note: This is a simple version check, callers should track their own prevVersion if needed
  const rotationsChanged = false // Deprecated - callers should use rotationVersion directly

  return {
    fastMode,
    qualityMultiplier,
    rotationsChanged,
    rotationVersion,
    fractalAnimLowQuality,
    effectiveFastMode: fractalAnimLowQuality && fastMode,
  }
}
