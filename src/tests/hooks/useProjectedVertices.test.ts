import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectedVertices } from '@/hooks/useProjectedVertices';
import type { VectorND } from '@/lib/math/types';

describe('useProjectedVertices', () => {
  describe('empty input handling', () => {
    it('should return empty array for empty input', () => {
      const { result } = renderHook(() => useProjectedVertices([]));
      expect(result.current).toEqual([]);
    });
  });

  describe('3D vertices (consistent perspective scaling)', () => {
    it('should apply perspective scaling to 3D vertices for consistency', () => {
      const vertices: VectorND[] = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const { result } = renderHook(() => useProjectedVertices(vertices));

      // With fixed projection distance of 4.0 and effectiveDepth=0:
      // scale = 1/4 = 0.25
      expect(result.current[0]![0]).toBeCloseTo(0.25, 5);
      expect(result.current[0]![1]).toBeCloseTo(0.5, 5);
      expect(result.current[0]![2]).toBeCloseTo(0.75, 5);
      expect(result.current[1]![0]).toBeCloseTo(1, 5);
      expect(result.current[1]![1]).toBeCloseTo(1.25, 5);
      expect(result.current[1]![2]).toBeCloseTo(1.5, 5);
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

      // With distance = 4.0 (fixed):
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

    it('should handle 11D vertices (max dimension)', () => {
      const vertex11D: VectorND = [1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      const { result } = renderHook(() => useProjectedVertices([vertex11D]));
      const projected = result.current[0]!;

      // Should project without errors or NaN
      expect(projected).toHaveLength(3);
      expect(Number.isNaN(projected[0])).toBe(false);
      expect(Number.isNaN(projected[1])).toBe(false);
      expect(Number.isNaN(projected[2])).toBe(false);
      expect(Number.isFinite(projected[0])).toBe(true);
      expect(Number.isFinite(projected[1])).toBe(true);
      expect(Number.isFinite(projected[2])).toBe(true);
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

    it('should handle invalid vertices gracefully', () => {
      // Invalid: less than 3 dimensions
      const invalidVertices1D: VectorND[] = [
        [1], // Only 1D
      ];
      const invalidVertices2D: VectorND[] = [
        [1, 2], // Only 2D
      ];

      const { result: result1D } = renderHook(() => useProjectedVertices(invalidVertices1D));
      const { result: result2D } = renderHook(() => useProjectedVertices(invalidVertices2D));

      // Should return empty array and log warning
      expect(result1D.current).toEqual([]);
      expect(result2D.current).toEqual([]);
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
  });

  describe('dimension consistency', () => {
    it('should produce similar sized results for 3D, 4D, 5D objects at origin', () => {
      // Test that objects at the origin project to similar sizes across dimensions
      const vertex3D: VectorND = [1, 1, 1];
      const vertex4D: VectorND = [1, 1, 1, 0]; // w=0, should be same scale as 3D
      const vertex5D: VectorND = [1, 1, 1, 0, 0]; // w=v=0, should be same scale as 3D

      const { result: result3D } = renderHook(() => useProjectedVertices([vertex3D]));
      const { result: result4D } = renderHook(() => useProjectedVertices([vertex4D]));
      const { result: result5D } = renderHook(() => useProjectedVertices([vertex5D]));

      // All should have the same projected x coordinate (scale = 1/4)
      expect(result3D.current[0]![0]).toBeCloseTo(result4D.current[0]![0], 5);
      expect(result3D.current[0]![0]).toBeCloseTo(result5D.current[0]![0], 5);
    });
  });
});
