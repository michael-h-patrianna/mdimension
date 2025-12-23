/**
 * Tests for useQualityTracking hook.
 *
 * Tests adaptive quality management during user interactions.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useQualityTracking } from '@/rendering/renderers/base/useQualityTracking';
import { useRotationStore } from '@/stores/rotationStore';
import { usePerformanceStore } from '@/stores/performanceStore';

describe('useQualityTracking', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useRotationStore.getState().resetAllRotations();
    usePerformanceStore.setState({
      qualityMultiplier: 1.0,
      fractalAnimationLowQuality: true,
    });
  });

  describe('initial state', () => {
    it('should return fastMode as false initially', () => {
      const { result } = renderHook(() => useQualityTracking());
      expect(result.current.fastMode).toBe(false);
    });

    it('should return effectiveFastMode as false initially', () => {
      const { result } = renderHook(() => useQualityTracking());
      expect(result.current.effectiveFastMode).toBe(false);
    });

    it('should return qualityMultiplier from store', () => {
      usePerformanceStore.setState({ qualityMultiplier: 0.5 });
      const { result } = renderHook(() => useQualityTracking());
      expect(result.current.qualityMultiplier).toBe(0.5);
    });

    it('should return fractalAnimLowQuality from store', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: false });
      const { result } = renderHook(() => useQualityTracking());
      expect(result.current.fractalAnimLowQuality).toBe(false);
    });
  });

  describe('rotation version tracking', () => {
    it('should return current rotation version', () => {
      const { result } = renderHook(() => useQualityTracking());

      // Version should match the store version
      expect(result.current.rotationVersion).toBe(useRotationStore.getState().version);
    });

    it('should update version when rotation changes', () => {
      const { result, rerender } = renderHook(() => useQualityTracking());
      const initialVersion = result.current.rotationVersion;

      // Update rotation wrapped in act() to prevent React warning
      act(() => {
        useRotationStore.getState().setRotation('XY', 0.5);
      });
      rerender();

      expect(result.current.rotationVersion).toBe(initialVersion + 1);
    });
  });

  describe('hook options', () => {
    it('should respect enabled option', () => {
      // When disabled, rotationsChanged should always be false
      const { result, rerender } = renderHook(() =>
        useQualityTracking({ enabled: false })
      );

      // Change rotation wrapped in act() to prevent React warning
      act(() => {
        useRotationStore.getState().setRotation('XY', 0.5);
      });
      rerender();

      // Should not track rotations when disabled
      expect(result.current.rotationsChanged).toBe(false);
      expect(result.current.fastMode).toBe(false);
    });

    it('should enable tracking by default', () => {
      const { result } = renderHook(() => useQualityTracking());
      // enabled defaults to true
      expect(result.current.fastMode).toBe(false); // Initially false
    });
  });

  describe('effectiveFastMode computation', () => {
    it('should be false when fastMode is false', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: true });
      const { result } = renderHook(() => useQualityTracking());

      // fastMode is false initially, so effectiveFastMode should be false
      expect(result.current.effectiveFastMode).toBe(false);
    });

    it('should be false when fractalAnimLowQuality is false (regardless of fastMode)', () => {
      usePerformanceStore.setState({ fractalAnimationLowQuality: false });
      const { result } = renderHook(() => useQualityTracking());

      // Even if we could set fastMode to true, effectiveFastMode should be false
      expect(result.current.effectiveFastMode).toBe(false);
    });
  });

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useQualityTracking());

      expect(result.current).toHaveProperty('fastMode');
      expect(result.current).toHaveProperty('qualityMultiplier');
      expect(result.current).toHaveProperty('rotationsChanged');
      expect(result.current).toHaveProperty('rotationVersion');
      expect(result.current).toHaveProperty('fractalAnimLowQuality');
      expect(result.current).toHaveProperty('effectiveFastMode');
    });

    it('should return correct types', () => {
      const { result } = renderHook(() => useQualityTracking());

      expect(typeof result.current.fastMode).toBe('boolean');
      expect(typeof result.current.qualityMultiplier).toBe('number');
      expect(typeof result.current.rotationsChanged).toBe('boolean');
      expect(typeof result.current.rotationVersion).toBe('number');
      expect(typeof result.current.fractalAnimLowQuality).toBe('boolean');
      expect(typeof result.current.effectiveFastMode).toBe('boolean');
    });
  });
});
