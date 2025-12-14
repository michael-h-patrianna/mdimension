/**
 * Tests for useSyncedDimension hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncedDimension } from '@/hooks/useSyncedDimension';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';

describe('useSyncedDimension', () => {
  beforeEach(() => {
    // Reset all stores
    useGeometryStore.getState().reset();
    useRotationStore.getState().resetAllRotations();
    useTransformStore.getState().resetAll();
    useAnimationStore.getState().reset();
  });

  describe('dimension synchronization', () => {
    it('should sync dimension to rotation store', () => {
      // Set dimension in geometry store
      act(() => {
        useGeometryStore.getState().setDimension(5);
      });

      // Render hook
      renderHook(() => useSyncedDimension());

      // Check that rotation store dimension was updated
      expect(useRotationStore.getState().dimension).toBe(5);
    });

    it('should sync dimension to transform store', () => {
      act(() => {
        useGeometryStore.getState().setDimension(6);
      });

      renderHook(() => useSyncedDimension());

      expect(useTransformStore.getState().dimension).toBe(6);
    });

    it('should call setDimension on animation store', () => {
      // The hook calls setDimension which filters animating planes
      act(() => {
        useGeometryStore.getState().setDimension(4);
        // Add a 4D plane that would be filtered out in 3D
        useAnimationStore.getState().setPlaneAnimating('XW', true);
      });

      renderHook(() => useSyncedDimension());

      // Animation store should have planes for current dimension
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.has('XW')).toBe(true); // Valid in 4D
    });

    it('should update rotation and transform stores when dimension changes', () => {
      const { rerender } = renderHook(() => useSyncedDimension());

      // Change dimension
      act(() => {
        useGeometryStore.getState().setDimension(7);
      });
      rerender();

      expect(useRotationStore.getState().dimension).toBe(7);
      expect(useTransformStore.getState().dimension).toBe(7);
    });
  });

  describe('object type change handling', () => {
    it('should reset rotations when object type changes', () => {
      // Set up initial state with some rotations
      act(() => {
        useGeometryStore.getState().setDimension(4);
        useGeometryStore.getState().setObjectType('hypercube');
      });

      const { rerender } = renderHook(() => useSyncedDimension());

      // Add some rotations
      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 4);
        useRotationStore.getState().setRotation('XW', Math.PI / 3);
      });

      expect(useRotationStore.getState().rotations.get('XY')).not.toBe(0);
      expect(useRotationStore.getState().rotations.get('XW')).not.toBe(0);

      // Change object type
      act(() => {
        useGeometryStore.getState().setObjectType('simplex');
      });
      rerender();

      // Rotations should be reset to 0
      const rotations = useRotationStore.getState().rotations;
      for (const [, angle] of rotations) {
        expect(angle).toBe(0);
      }
    });

    it('should not reset rotations if object type remains the same', () => {
      act(() => {
        useGeometryStore.getState().setDimension(4);
        useGeometryStore.getState().setObjectType('hypercube');
      });

      renderHook(() => useSyncedDimension());

      // Add some rotations
      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 4);
      });

      // Force re-render without changing object type
      const { rerender } = renderHook(() => useSyncedDimension());
      rerender();

      // Rotations should still be present
      expect(useRotationStore.getState().rotations.get('XY')).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('initial state', () => {
    it('should handle default dimension', () => {
      renderHook(() => useSyncedDimension());

      const defaultDimension = useGeometryStore.getState().dimension;
      expect(useRotationStore.getState().dimension).toBe(defaultDimension);
      expect(useTransformStore.getState().dimension).toBe(defaultDimension);
      // Animation store doesn't track dimension directly, it filters planes
    });
  });
});
