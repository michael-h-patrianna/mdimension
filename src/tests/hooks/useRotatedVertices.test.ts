import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import { useRotationStore } from '@/stores/rotationStore';
import type { VectorND } from '@/lib/math/types';

describe('useRotatedVertices', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useRotationStore.getState().resetAllRotations();
    useRotationStore.getState().setDimension(3);
  });

  describe('empty input handling', () => {
    it('should return empty array for empty input', () => {
      const { result } = renderHook(() => useRotatedVertices([]));
      expect(result.current).toEqual([]);
    });
  });

  describe('no rotation (identity matrix)', () => {
    it('should return unchanged vertices when no rotation', () => {
      const vertices: VectorND[] = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const { result } = renderHook(() => useRotatedVertices(vertices));

      expect(result.current).toHaveLength(2);
      expect(result.current[0]).toEqual([1, 2, 3]);
      expect(result.current[1]).toEqual([4, 5, 6]);
    });

    it('should handle 4D vertices with no rotation', () => {
      useRotationStore.getState().setDimension(4);

      const vertices: VectorND[] = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];

      const { result } = renderHook(() => useRotatedVertices(vertices));

      expect(result.current).toHaveLength(2);
      expect(result.current[0]).toEqual([1, 2, 3, 4]);
      expect(result.current[1]).toEqual([5, 6, 7, 8]);
    });
  });

  describe('3D rotations', () => {
    it('should rotate 90 degrees in XY plane', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Rotate 90 degrees in XY plane
      useRotationStore.getState().setRotation('XY', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in XY: (1, 0, 0) -> (0, 1, 0)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(1, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
    });

    it('should rotate 90 degrees in XZ plane', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Rotate 90 degrees in XZ plane
      useRotationStore.getState().setRotation('XZ', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in XZ: (1, 0, 0) -> (0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(1, 5);
    });

    it('should rotate 90 degrees in YZ plane', () => {
      const vertices: VectorND[] = [[0, 1, 0]];

      // Rotate 90 degrees in YZ plane
      useRotationStore.getState().setRotation('YZ', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in YZ: (0, 1, 0) -> (0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(1, 5);
    });

    it('should handle 45-degree rotation', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Rotate 45 degrees in XY plane
      useRotationStore.getState().setRotation('XY', Math.PI / 4);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 45-degree rotation in XY: (1, 0, 0) -> (cos(45), sin(45), 0)
      const sqrt2_2 = Math.sqrt(2) / 2;
      expect(rotated[0]).toBeCloseTo(sqrt2_2, 5);
      expect(rotated[1]).toBeCloseTo(sqrt2_2, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
    });

    it('should rotate multiple vertices consistently', () => {
      const vertices: VectorND[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      useRotationStore.getState().setRotation('XY', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      expect(result.current).toHaveLength(3);

      // (1, 0, 0) -> (0, 1, 0)
      expect(result.current[0]![0]).toBeCloseTo(0, 5);
      expect(result.current[0]![1]).toBeCloseTo(1, 5);
      expect(result.current[0]![2]).toBeCloseTo(0, 5);

      // (0, 1, 0) -> (-1, 0, 0)
      expect(result.current[1]![0]).toBeCloseTo(-1, 5);
      expect(result.current[1]![1]).toBeCloseTo(0, 5);
      expect(result.current[1]![2]).toBeCloseTo(0, 5);

      // (0, 0, 1) -> (0, 0, 1) (unchanged)
      expect(result.current[2]![0]).toBeCloseTo(0, 5);
      expect(result.current[2]![1]).toBeCloseTo(0, 5);
      expect(result.current[2]![2]).toBeCloseTo(1, 5);
    });
  });

  describe('4D rotations', () => {
    beforeEach(() => {
      useRotationStore.getState().setDimension(4);
    });

    it('should rotate in XW plane', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0]];

      // Rotate 90 degrees in XW plane
      useRotationStore.getState().setRotation('XW', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in XW: (1, 0, 0, 0) -> (0, 0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
      expect(rotated[3]).toBeCloseTo(1, 5);
    });

    it('should rotate in YW plane', () => {
      const vertices: VectorND[] = [[0, 1, 0, 0]];

      // Rotate 90 degrees in YW plane
      useRotationStore.getState().setRotation('YW', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in YW: (0, 1, 0, 0) -> (0, 0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
      expect(rotated[3]).toBeCloseTo(1, 5);
    });

    it('should rotate in ZW plane', () => {
      const vertices: VectorND[] = [[0, 0, 1, 0]];

      // Rotate 90 degrees in ZW plane
      useRotationStore.getState().setRotation('ZW', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in ZW: (0, 0, 1, 0) -> (0, 0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
      expect(rotated[3]).toBeCloseTo(1, 5);
    });

    it('should compose 3D and 4D rotations', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0]];

      // Rotate in both XY and XW planes
      useRotationStore.getState().setRotation('XY', Math.PI / 4);
      useRotationStore.getState().setRotation('XW', Math.PI / 4);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // Should have non-zero components after composed rotation
      expect(rotated).toHaveLength(4);
      expect(Number.isNaN(rotated[0])).toBe(false);
      expect(Number.isNaN(rotated[1])).toBe(false);
      expect(Number.isNaN(rotated[2])).toBe(false);
      expect(Number.isNaN(rotated[3])).toBe(false);

      // After composition, point should be moved
      const length = Math.sqrt(
        rotated[0]! ** 2 + rotated[1]! ** 2 + rotated[2]! ** 2 + rotated[3]! ** 2
      );
      // Rotation preserves length
      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('5D rotations', () => {
    beforeEach(() => {
      useRotationStore.getState().setDimension(5);
    });

    it('should rotate in 5th dimension planes', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0, 0]];

      // Rotate 90 degrees in XV plane
      useRotationStore.getState().setRotation('XV', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      // After 90-degree rotation in XV: (1, 0, 0, 0, 0) -> (0, 0, 0, 0, 1)
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(0, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
      expect(rotated[3]).toBeCloseTo(0, 5);
      expect(rotated[4]).toBeCloseTo(1, 5);
    });

    it('should handle all 10 rotation planes', () => {
      const vertices: VectorND[] = [[1, 0, 0, 0, 0]];

      // Set small rotations in all 10 planes
      const angle = Math.PI / 10;
      useRotationStore.getState().setRotation('XY', angle);
      useRotationStore.getState().setRotation('XZ', angle);
      useRotationStore.getState().setRotation('YZ', angle);
      useRotationStore.getState().setRotation('XW', angle);
      useRotationStore.getState().setRotation('YW', angle);
      useRotationStore.getState().setRotation('ZW', angle);
      useRotationStore.getState().setRotation('XV', angle);
      useRotationStore.getState().setRotation('YV', angle);
      useRotationStore.getState().setRotation('ZV', angle);
      useRotationStore.getState().setRotation('WV', angle);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;

      expect(rotated).toHaveLength(5);
      expect(Number.isNaN(rotated[0])).toBe(false);
      expect(Number.isNaN(rotated[1])).toBe(false);
      expect(Number.isNaN(rotated[2])).toBe(false);
      expect(Number.isNaN(rotated[3])).toBe(false);
      expect(Number.isNaN(rotated[4])).toBe(false);

      // Rotation should preserve length
      const length = Math.sqrt(
        rotated[0]! ** 2 +
          rotated[1]! ** 2 +
          rotated[2]! ** 2 +
          rotated[3]! ** 2 +
          rotated[4]! ** 2
      );
      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('rotation updates', () => {
    it('should update when rotation changes', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices));

      // Initially no rotation
      expect(result.current[0]).toEqual([1, 0, 0]);

      // Add rotation
      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 2);
      });
      rerender();

      // Should now be rotated
      const rotated = result.current[0]!;
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(1, 5);
      expect(rotated[2]).toBeCloseTo(0, 5);
    });

    it('should update when rotation is reset', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      // Set rotation
      useRotationStore.getState().setRotation('XY', Math.PI / 2);

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices));

      // Should be rotated
      const rotated = result.current[0]!;
      expect(rotated[0]).toBeCloseTo(0, 5);
      expect(rotated[1]).toBeCloseTo(1, 5);

      // Reset rotation
      act(() => {
        useRotationStore.getState().resetRotation('XY');
      });
      rerender();

      // Should be back to original
      expect(result.current[0]).toEqual([1, 0, 0]);
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const vertices: VectorND[] = [[1, 2, 3]];

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should recompute when rotation changes', () => {
      const vertices: VectorND[] = [[1, 0, 0]];

      const { result, rerender } = renderHook(() => useRotatedVertices(vertices));

      // Clone for comparison
      const firstResult = result.current.map(v => [...v]);

      act(() => {
        useRotationStore.getState().setRotation('XY', Math.PI / 4);
      });
      rerender();

      const secondResult = result.current;

      // Should be different references
      expect(firstResult).not.toBe(secondResult);
      // And different values
      expect(firstResult[0]).not.toEqual(secondResult[0]);
    });

    it('should recompute when vertices change', () => {
      const vertices1: VectorND[] = [[1, 0, 0]];
      const vertices2: VectorND[] = [[0, 1, 0]];

      let currentVertices = vertices1;
      const { result, rerender } = renderHook(() => useRotatedVertices(currentVertices));

      // Clone for comparison
      const firstResult = result.current.map(v => [...v]);

      currentVertices = vertices2;
      rerender();

      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
      expect(firstResult[0]).not.toEqual(secondResult[0]);
    });
  });

  describe('edge cases', () => {
    it('should handle zero vector', () => {
      const vertices: VectorND[] = [[0, 0, 0]];

      useRotationStore.getState().setRotation('XY', Math.PI / 2);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      // Zero vector should remain zero after rotation
      expect(result.current[0]).toEqual([0, 0, 0]);
    });

    it('should not produce NaN values', () => {
      const vertices: VectorND[] = [
        [1, 2, 3],
        [0, 0, 0],
        [-1, -2, -3],
      ];

      useRotationStore.getState().setRotation('XY', Math.PI / 4);
      useRotationStore.getState().setRotation('XZ', Math.PI / 3);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      result.current.forEach((rotated) => {
        expect(Number.isNaN(rotated[0])).toBe(false);
        expect(Number.isNaN(rotated[1])).toBe(false);
        expect(Number.isNaN(rotated[2])).toBe(false);
      });
    });

    it('should preserve vector length (rotation is orthogonal)', () => {
      const vertices: VectorND[] = [[3, 4, 5]];

      const originalLength = Math.sqrt(3 ** 2 + 4 ** 2 + 5 ** 2);

      useRotationStore.getState().setRotation('XY', Math.PI / 3);
      useRotationStore.getState().setRotation('YZ', Math.PI / 5);

      const { result } = renderHook(() => useRotatedVertices(vertices));

      const rotated = result.current[0]!;
      const rotatedLength = Math.sqrt(
        rotated[0]! ** 2 + rotated[1]! ** 2 + rotated[2]! ** 2
      );

      expect(rotatedLength).toBeCloseTo(originalLength, 5);
    });
  });
});
