import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import { useProjectionStore } from '@/stores/projectionStore';
import type { VectorND } from '@/lib/math/types';

describe('useProjectedVertices', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useProjectionStore.getState().resetToDefaults();
  });

  describe('empty input handling', () => {
    it('should return empty array for empty input', () => {
      const { result } = renderHook(() => useProjectedVertices([]));
      expect(result.current).toEqual([]);
    });
  });

  describe('3D vertices (no projection needed)', () => {
    it('should pass through 3D vertices unchanged', () => {
      const vertices: VectorND[] = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const { result } = renderHook(() => useProjectedVertices(vertices));

      expect(result.current).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });
  });

  describe('perspective projection', () => {
    it('should make vertices with higher W appear smaller (4D hypercube)', () => {
      // Create a 4D hypercube: inner cube at w=-1, outer cube at w=1
      const innerVertex: VectorND = [1, 1, 1, -1]; // w = -1 (closer)
      const outerVertex: VectorND = [1, 1, 1, 1];  // w = 1 (farther)

      const { result } = renderHook(() =>
        useProjectedVertices([innerVertex, outerVertex])
      );

      const [innerProjected, outerProjected] = result.current;

      // With distance = 4.0 (default):
      // Inner: scale = 1/(4 - (-1)) = 1/5 = 0.2, so (1,1,1) -> (0.2, 0.2, 0.2)
      // Outer: scale = 1/(4 - 1) = 1/3 = 0.333..., so (1,1,1) -> (0.333, 0.333, 0.333)

      expect(innerProjected![0]).toBeCloseTo(0.2, 5);
      expect(innerProjected![1]).toBeCloseTo(0.2, 5);
      expect(innerProjected![2]).toBeCloseTo(0.2, 5);

      expect(outerProjected![0]).toBeCloseTo(0.333, 2);
      expect(outerProjected![1]).toBeCloseTo(0.333, 2);
      expect(outerProjected![2]).toBeCloseTo(0.333, 2);

      // Inner cube should appear smaller (closer to 0) than outer cube
      expect(Math.abs(innerProjected![0]!)).toBeLessThan(Math.abs(outerProjected![0]!));
    });

    it('should respond to distance changes', () => {
      const vertex: VectorND = [2, 2, 2, 1]; // w = 1

      // Distance = 4.0 (default)
      const { result, rerender } = renderHook(() => useProjectedVertices([vertex]));

      // Clone to avoid mutation affecting comparison
      const projected1 = [...result.current[0]!];
      // scale = 1/(4 - 1) = 1/3
      expect(projected1[0]).toBeCloseTo(2 / 3, 5);

      // Change distance to 6.0
      act(() => {
        useProjectionStore.getState().setDistance(6.0);
      });
      rerender();

      const projected2 = result.current[0]!;
      // scale = 1/(6 - 1) = 1/5
      expect(projected2[0]).toBeCloseTo(2 / 5, 5);

      // Larger distance should produce smaller values
      expect(Math.abs(projected2[0]!)).toBeLessThan(Math.abs(projected1[0]!));
    });

    it('should handle 5D vertices with recursive projection', () => {
      const vertex5D: VectorND = [1, 1, 1, 0.5, 0.5]; // w = 0.5, v = 0.5

      const { result } = renderHook(() => useProjectedVertices([vertex5D]));
      const projected = result.current[0]!;

      // Should project without errors or NaN
      expect(projected).toHaveLength(3);
      expect(Number.isNaN(projected[0])).toBe(false);
      expect(Number.isNaN(projected[1])).toBe(false);
      expect(Number.isNaN(projected[2])).toBe(false);
    });

    it('should handle 6D vertices', () => {
      const vertex6D: VectorND = [1, 1, 1, 0.5, 0.5, 0.5];

      const { result } = renderHook(() => useProjectedVertices([vertex6D]));
      const projected = result.current[0]!;

      // Should project without errors or NaN
      expect(projected).toHaveLength(3);
      expect(Number.isNaN(projected[0])).toBe(false);
      expect(Number.isNaN(projected[1])).toBe(false);
      expect(Number.isNaN(projected[2])).toBe(false);
    });
  });

  describe('orthographic projection', () => {
    beforeEach(() => {
      act(() => {
        useProjectionStore.getState().setType('orthographic');
      });
    });

    it('should ignore W coordinate completely', () => {
      const innerVertex: VectorND = [1, 1, 1, -1]; // w = -1
      const outerVertex: VectorND = [1, 1, 1, 1];  // w = 1

      const { result } = renderHook(() =>
        useProjectedVertices([innerVertex, outerVertex])
      );

      const [innerProjected, outerProjected] = result.current;

      // Orthographic just takes first 3 coordinates
      expect(innerProjected).toEqual([1, 1, 1]);
      expect(outerProjected).toEqual([1, 1, 1]);

      // Both should be identical
      expect(innerProjected).toEqual(outerProjected);
    });

    it('should make inner and outer structures same size', () => {
      const vertex1: VectorND = [2, 3, 4, -2];
      const vertex2: VectorND = [2, 3, 4, 2];

      const { result } = renderHook(() =>
        useProjectedVertices([vertex1, vertex2])
      );

      const [proj1, proj2] = result.current;

      // Both should have identical projections
      expect(proj1).toEqual([2, 3, 4]);
      expect(proj2).toEqual([2, 3, 4]);
    });

    it('should work for 5D and 6D vertices', () => {
      const vertex5D: VectorND = [1, 2, 3, 4, 5];
      const vertex6D: VectorND = [1, 2, 3, 4, 5, 6];

      const { result } = renderHook(() =>
        useProjectedVertices([vertex5D, vertex6D])
      );

      const [proj5D, proj6D] = result.current;

      expect(proj5D).toEqual([1, 2, 3]);
      expect(proj6D).toEqual([1, 2, 3]);
    });
  });

  describe('edge cases', () => {
    it('should not produce NaN values', () => {
      // Test various edge case vertices
      const vertices: VectorND[] = [
        [0, 0, 0, 0],
        [1, 1, 1, 3.99], // Very close to projection distance
        [-1, -1, -1, -5], // Negative W
      ];

      const { result } = renderHook(() => useProjectedVertices(vertices));

      result.current.forEach((projected) => {
        expect(Number.isNaN(projected[0])).toBe(false);
        expect(Number.isNaN(projected[1])).toBe(false);
        expect(Number.isNaN(projected[2])).toBe(false);
      });
    });

    it('should not produce Infinity values', () => {
      const vertices: VectorND[] = [
        [10, 10, 10, 3.99], // Close to singularity
      ];

      const { result } = renderHook(() => useProjectedVertices(vertices));

      result.current.forEach((projected) => {
        expect(Number.isFinite(projected[0])).toBe(true);
        expect(Number.isFinite(projected[1])).toBe(true);
        expect(Number.isFinite(projected[2])).toBe(true);
      });
    });

    it('should handle 2D vertices by projecting to X-Z plane', () => {
      // 2D vertices are now valid and project to [x, 0, z]
      const vertices2D: VectorND[] = [
        [1, 2], // 2D: [x, z]
      ];

      const { result } = renderHook(() => useProjectedVertices(vertices2D));

      // Should project to [x, 0, z]
      expect(result.current).toEqual([[1, 0, 2]]);
    });

    it('should handle invalid vertices gracefully', () => {
      // Invalid: less than 2 dimensions
      const invalidVertices: VectorND[] = [
        [1], // Only 1D
      ];

      const { result } = renderHook(() => useProjectedVertices(invalidVertices));

      // Should return empty array and log warning
      expect(result.current).toEqual([]);
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const vertices: VectorND[] = [[1, 2, 3, 4]];

      const { result, rerender } = renderHook(() => useProjectedVertices(vertices));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should recompute when projection type changes', () => {
      const vertices: VectorND[] = [[1, 1, 1, 1]];

      const { result, rerender } = renderHook(() => useProjectedVertices(vertices));

      // Clone to avoid mutation
      const perspectiveResult = [...result.current[0]!];

      act(() => {
        useProjectionStore.getState().setType('orthographic');
      });
      rerender();

      const orthographicResult = result.current[0];

      expect(perspectiveResult).not.toEqual(orthographicResult);
    });

    it('should recompute when distance changes (perspective only)', () => {
      const vertices: VectorND[] = [[2, 2, 2, 1]];

      const { result, rerender } = renderHook(() => useProjectedVertices(vertices));

      // Clone to avoid mutation
      const result1 = [...result.current[0]!];

      act(() => {
        useProjectionStore.getState().setDistance(8.0);
      });
      rerender();

      const result2 = result.current[0];

      expect(result1).not.toEqual(result2);
    });
  });
});
