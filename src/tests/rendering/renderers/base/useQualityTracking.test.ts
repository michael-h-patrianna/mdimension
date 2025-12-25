/**
 * Tests for useQualityTracking hook.
 *
 * Tests adaptive quality management during animation playback.
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useQualityTracking } from '@/rendering/renderers/base/useQualityTracking'
import { useAnimationStore } from '@/stores/animationStore'
import { usePerformanceStore } from '@/stores/performanceStore'
import { useRotationStore } from '@/stores/rotationStore'

describe('useQualityTracking', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useRotationStore.getState().resetAllRotations()
    usePerformanceStore.setState({
      qualityMultiplier: 1.0,
      fractalAnimationLowQuality: true,
    })
    // Animation is playing by default in the store, pause it for most tests
    useAnimationStore.getState().pause()
  })

  describe('initial state', () => {
    it('should return fastMode as false when animation is paused', () => {
      const { result } = renderHook(() => useQualityTracking())
      expect(result.current.fastMode).toBe(false)
    })

    it('should return fastMode as true when animation is playing', () => {
      act(() => {
        useAnimationStore.getState().play()
      })
      const { result } = renderHook(() => useQualityTracking())
      expect(result.current.fastMode).toBe(true)
    })

    it('should return effectiveFastMode as false when animation is paused', () => {
      const { result } = renderHook(() => useQualityTracking())
      expect(result.current.effectiveFastMode).toBe(false)
    })

    it('should return qualityMultiplier from store', () => {
      usePerformanceStore.setState({ qualityMultiplier: 0.5 })
      const { result } = renderHook(() => useQualityTracking())
      expect(result.current.qualityMultiplier).toBe(0.5)
    })

    it('should return fractalAnimLowQuality from store', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: false })
      const { result } = renderHook(() => useQualityTracking())
      expect(result.current.fractalAnimLowQuality).toBe(false)
    })
  })

  describe('rotation version tracking', () => {
    it('should return current rotation version', () => {
      const { result } = renderHook(() => useQualityTracking())

      // Version should match the store version
      expect(result.current.rotationVersion).toBe(useRotationStore.getState().version)
    })

    it('should update version when rotation changes', () => {
      const { result, rerender } = renderHook(() => useQualityTracking())
      const initialVersion = result.current.rotationVersion

      // Update rotation wrapped in act() to prevent React warning
      act(() => {
        useRotationStore.getState().setRotation('XY', 0.5)
      })
      rerender()

      expect(result.current.rotationVersion).toBe(initialVersion + 1)
    })
  })

  describe('hook options', () => {
    it('should respect enabled option', () => {
      // Start with animation playing
      act(() => {
        useAnimationStore.getState().play()
      })

      // When disabled, fastMode should be false regardless of isPlaying
      const { result } = renderHook(() => useQualityTracking({ enabled: false }))

      // Should not enable fast mode when disabled
      expect(result.current.fastMode).toBe(false)
    })

    it('should enable tracking by default', () => {
      // With animation playing, fastMode should be true
      act(() => {
        useAnimationStore.getState().play()
      })
      const { result } = renderHook(() => useQualityTracking())
      // enabled defaults to true, and isPlaying is true
      expect(result.current.fastMode).toBe(true)
    })
  })

  describe('effectiveFastMode computation', () => {
    it('should be false when animation is paused', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: true })
      const { result } = renderHook(() => useQualityTracking())

      // animation is paused, so effectiveFastMode should be false
      expect(result.current.effectiveFastMode).toBe(false)
    })

    it('should be true when animation is playing and fractalAnimLowQuality is true', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: true })
      act(() => {
        useAnimationStore.getState().play()
      })
      const { result } = renderHook(() => useQualityTracking())

      expect(result.current.effectiveFastMode).toBe(true)
    })

    it('should be false when fractalAnimLowQuality is false (regardless of animation state)', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: false })
      act(() => {
        useAnimationStore.getState().play()
      })
      const { result } = renderHook(() => useQualityTracking())

      // Even with animation playing, effectiveFastMode should be false
      expect(result.current.effectiveFastMode).toBe(false)
    })
  })

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useQualityTracking())

      expect(result.current).toHaveProperty('fastMode')
      expect(result.current).toHaveProperty('qualityMultiplier')
      expect(result.current).toHaveProperty('rotationsChanged')
      expect(result.current).toHaveProperty('rotationVersion')
      expect(result.current).toHaveProperty('fractalAnimLowQuality')
      expect(result.current).toHaveProperty('effectiveFastMode')
    })

    it('should return correct types', () => {
      const { result } = renderHook(() => useQualityTracking())

      expect(typeof result.current.fastMode).toBe('boolean')
      expect(typeof result.current.qualityMultiplier).toBe('number')
      expect(typeof result.current.rotationsChanged).toBe('boolean')
      expect(typeof result.current.rotationVersion).toBe('number')
      expect(typeof result.current.fractalAnimLowQuality).toBe('boolean')
      expect(typeof result.current.effectiveFastMode).toBe('boolean')
    })
  })
})
