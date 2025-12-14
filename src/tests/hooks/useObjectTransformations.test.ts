/**
 * Tests for useObjectTransformations hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useObjectTransformations } from '@/hooks/useObjectTransformations';
import { useTransformStore } from '@/stores/transformStore';
import { useRotationStore } from '@/stores/rotationStore';
import type { VectorND } from '@/lib/math/types';

describe('useObjectTransformations', () => {
  beforeEach(() => {
    // Reset stores
    useTransformStore.getState().resetAll();
    useRotationStore.getState().resetAllRotations();
    useRotationStore.getState().setDimension(3);
    useTransformStore.getState().setDimension(3);
  });

  describe('identity transformation', () => {
    it('should return unchanged vertices when no transformations applied', () => {
      const vertices: VectorND[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      // With identity transform, vertices should be approximately the same
      expect(result.current[0]![0]).toBeCloseTo(1, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);

      expect(result.current[1]![0]).toBeCloseTo(0, 5);
      expect(result.current[1]![1]).toBeCloseTo(1, 5);
      expect(result.current[1]![2]).toBeCloseTo(0, 5);

      expect(result.current[2]![0]).toBeCloseTo(0, 5);
      expect(result.current[2]![1]).toBeCloseTo(0, 5);
      expect(result.current[2]![2]).toBeCloseTo(1, 5);
    });
  });

  describe('uniform scaling', () => {
    it('should apply uniform scale to all vertices', () => {
      const vertices: VectorND[] = [[1, 1, 1]];

      act(() => {
        useTransformStore.getState().setUniformScale(2.0);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      // Vertex should be scaled by 2x
      expect(result.current[0]![0]).toBeCloseTo(2, 5);
      expect(result.current[0]![1]).toBeCloseTo(2, 5);
      expect(result.current[0]![2]).toBeCloseTo(2, 5);
    });

    it('should handle scale of 0.5', () => {
      const vertices: VectorND[] = [[2, 4, 6]];

      act(() => {
        useTransformStore.getState().setUniformScale(0.5);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      expect(result.current[0]![0]).toBeCloseTo(1, 5);
      expect(result.current[0]![1]).toBeCloseTo(2, 5);
      expect(result.current[0]![2]).toBeCloseTo(3, 5);
    });
  });

  describe('per-axis scaling', () => {
    it('should apply per-axis scale when unlocked', () => {
      const vertices: VectorND[] = [[1, 1, 1]];

      act(() => {
        useTransformStore.getState().setScaleLocked(false);
        useTransformStore.getState().setAxisScale(0, 2.0); // X = 2x
        useTransformStore.getState().setAxisScale(1, 3.0); // Y = 3x
        useTransformStore.getState().setAxisScale(2, 0.5); // Z = 0.5x
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      expect(result.current[0]![0]).toBeCloseTo(2, 5);
      expect(result.current[0]![1]).toBeCloseTo(3, 5);
      expect(result.current[0]![2]).toBeCloseTo(0.5, 5);
    });
  });

  describe('combined scale and rotation', () => {
    it('should apply scale before rotation', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      act(() => {
        useTransformStore.getState().setUniformScale(2.0);
        useRotationStore.getState().setRotation('XY', Math.PI / 2);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      // First scale: (1,0,0) -> (2,0,0)
      // Then rotate XY 90 deg: (2,0,0) -> (0,2,0)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(2, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
    });
  });

  describe('4D transformations', () => {
    beforeEach(() => {
      useTransformStore.getState().setDimension(4);
      useRotationStore.getState().setDimension(4);
    });

    it('should handle 4D vertices', () => {
      const vertices: VectorND[] = [[1, 1, 1, 1]];

      const { result } = renderHook(() => useObjectTransformations(vertices, 4));

      expect(result.current[0]).toHaveLength(4);
    });

    it('should scale 4D vertices correctly', () => {
      const vertices: VectorND[] = [[1, 1, 1, 1]];

      act(() => {
        useTransformStore.getState().setUniformScale(2.0);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 4));

      expect(result.current[0]![0]).toBeCloseTo(2, 5);
      expect(result.current[0]![1]).toBeCloseTo(2, 5);
      expect(result.current[0]![2]).toBeCloseTo(2, 5);
      expect(result.current[0]![3]).toBeCloseTo(2, 5);
    });

    it('should apply 4D rotation', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0]];

      act(() => {
        useRotationStore.getState().setRotation('XW', Math.PI / 2);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 4));

      // After 90 degree XW rotation, (1,0,0,0) -> (0,0,0,1)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
      expect(result.current[0]![3]).toBeCloseTo(1, 5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty vertex array', () => {
      const vertices: VectorND[] = [];

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      expect(result.current).toHaveLength(0);
    });

    it('should preserve vertex count', () => {
      const vertices: VectorND[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [-1, 0, 0],
        [0, -1, 0],
      ];

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      expect(result.current).toHaveLength(5);
    });

    it('should handle very small scale values', () => {
      const vertices: VectorND[] = [[1000, 1000, 1000]];

      act(() => {
        useTransformStore.getState().setUniformScale(0.1);
      });

      const { result } = renderHook(() => useObjectTransformations(vertices, 3));

      expect(result.current[0]![0]).toBeCloseTo(100, 1);
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useObjectTransformations(vertices, 3));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should return new reference when scale changes', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useObjectTransformations(vertices, 3));

      const firstResult = result.current;

      act(() => {
        useTransformStore.getState().setUniformScale(1.5);
      });
      rerender();

      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });

    it('should return new reference when rotation changes', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useObjectTransformations(vertices, 3));

      const firstResult = result.current;

      act(() => {
        useRotationStore.getState().setRotation('XY', 0.1);
      });
      rerender();

      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});
