/**
 * Tests for useRotatedVertices hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import { useRotationStore } from '@/stores/rotationStore';
import type { VectorND } from '@/lib/math/types';

describe('useRotatedVertices', () => {
  beforeEach(() => {
    // Reset rotation store
    useRotationStore.getState().resetAllRotations();
    useRotationStore.getState().setDimension(3);
  });

  describe('basic rotation', () => {
    it('should return unchanged vertices when no rotation is applied', () => {
      const vertices: VectorND[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // With no rotation, vertices should be approximately the same
      expect(result.current[0]![0]).toBeCloseTo(1, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
    });

    it('should rotate vertices in XY plane', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Apply 90 degree rotation in XY plane
      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 2);
      });

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // After 90 degree XY rotation, (1,0,0) should become approximately (0,1,0)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(1, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
    });

    it('should rotate vertices in XZ plane', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      act(() => {
        useRotationStore.getState().setRotation('XZ', Math.PI / 2);
      });

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // After 90 degree XZ rotation, (1,0,0) should become approximately (0,0,1)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(1, 5);
    });

    it('should rotate vertices in YZ plane', () => {
      const vertices: VectorND[] = [[0, 1, 0]];

      act(() => {
        useRotationStore.getState().setRotation('YZ', Math.PI / 2);
      });

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // After 90 degree YZ rotation, (0,1,0) should become approximately (0,0,1)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(1, 5);
    });
  });

  describe('4D rotation', () => {
    beforeEach(() => {
      useRotationStore.getState().setDimension(4);
    });

    it('should handle 4D vertices', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0]];

      const { result } = renderHook(() => useRotatedVertices(vertices, 4));

      expect(result.current[0]).toHaveLength(4);
      expect(result.current[0]![0]).toBeCloseTo(1, 5);
    });

    it('should rotate in XW plane', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0]];

      act(() => {
        useRotationStore.getState().setRotation('XW', Math.PI / 2);
      });

      const { result } = renderHook(() => useRotatedVertices(vertices, 4));

      // After 90 degree XW rotation, (1,0,0,0) should become approximately (0,0,0,1)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
      expect(result.current[0]![3]).toBeCloseTo(1, 5);
    });
  });

  describe('multiple rotations', () => {
    it('should compose multiple rotations', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Apply rotations in sequence
      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 2);
        useRotationStore.getState().setRotation('YZ', Math.PI / 2);
      });

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // Composed rotation should transform the vertex
      const vertex = result.current[0]!;
      const x = vertex[0]!;
      const y = vertex[1]!;
      const z = vertex[2]!;
      // The vertex should still be on the unit sphere
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty vertex array', () => {
      const vertices: VectorND[] = [];

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      expect(result.current).toHaveLength(0);
    });

    it('should preserve vertex count', () => {
      const vertices: VectorND[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ];

      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      expect(result.current).toHaveLength(4);
    });

    it('should filter out invalid rotation planes for dimension', () => {
      // Set up 3D with a rotation that would be valid in 4D but not 3D
      const vertices: VectorND[] = [[1, 0, 0]];

      // Set 4D rotation first
      act(() => {
        useRotationStore.getState().setDimension(4);
        useRotationStore.getState().setRotation('XW', Math.PI / 2);
      });

      // Now render with 3D dimension - should filter out XW
      const { result } = renderHook(() => useRotatedVertices(vertices, 3));

      // Vertex should be unchanged because XW is not valid in 3D
      expect(result.current[0]![0]).toBeCloseTo(1, 5);
      expect(result.current[0]![1]).toBeCloseTo(0, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);
    });
  });

  describe('memoization', () => {
    it('should return same reference when vertices and rotations unchanged', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices, 3));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should return new reference when rotation changes', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices, 3));

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
