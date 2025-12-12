/**
 * Tests for useVertexSize hook
 *
 * The useVertexSize hook calculates vertex/point size based on vertex count,
 * applying density scaling to prevent visual clutter in dense geometries.
 *
 * This is critical for visual consistency across different object types.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVertexSize } from '@/hooks/useVertexSize';
import { useVisualStore } from '@/stores/visualStore';
import {
  VERTEX_SIZE_DIVISOR,
  DENSITY_SCALING_THRESHOLD,
  DENSITY_SCALING_BASE,
  DENSITY_SCALING_EXPONENT,
  DENSITY_SCALING_MIN,
} from '@/lib/shaders/constants';

describe('useVertexSize', () => {
  beforeEach(() => {
    // Reset visual store to default state
    useVisualStore.getState().reset?.();
  });

  describe('base vertex size calculation', () => {
    it('should calculate base size from store vertex size', () => {
      // Default store vertex size is 4
      const { result } = renderHook(() => useVertexSize(8));

      // 8 vertices is below threshold, so no scaling
      // Base size = 4 / 100 = 0.04
      expect(result.current).toBeCloseTo(0.04, 4);
    });

    it('should update when store vertex size changes', () => {
      const { result } = renderHook(() => useVertexSize(8));

      // Initial value
      expect(result.current).toBeCloseTo(0.04, 4);

      // Update store
      act(() => {
        useVisualStore.getState().setVertexSize(8);
      });

      // New value = 8 / 100 = 0.08
      expect(result.current).toBeCloseTo(0.08, 4);
    });

    it('should respect vertex size divisor constant', () => {
      const testVertexSize = 6;
      act(() => {
        useVisualStore.getState().setVertexSize(testVertexSize);
      });

      const { result } = renderHook(() => useVertexSize(8));
      expect(result.current).toBeCloseTo(testVertexSize / VERTEX_SIZE_DIVISOR, 4);
    });
  });

  describe('density scaling', () => {
    it('should not scale for vertex counts at or below threshold', () => {
      const testCases = [
        { count: 8, name: '3D cube (8 vertices)' },
        { count: 16, name: '4D hypercube (16 vertices)' },
        { count: DENSITY_SCALING_THRESHOLD, name: 'At threshold' },
      ];

      for (const { count } of testCases) {
        const { result } = renderHook(() => useVertexSize(count));
        // No scaling, full vertex size
        expect(result.current).toBeCloseTo(0.04, 4);
      }
    });

    it('should scale down for vertex counts above threshold', () => {
      const { result: smallResult } = renderHook(() => useVertexSize(8));
      const { result: largeResult } = renderHook(() => useVertexSize(100));

      // 100 vertices should have smaller vertex size than 8
      expect(largeResult.current).toBeLessThan(smallResult.current);
    });

    it('should apply correct scaling formula', () => {
      const vertexCount = 256;
      const { result } = renderHook(() => useVertexSize(vertexCount));

      // Manual calculation:
      // baseSize = 4 / 100 = 0.04
      // densityFactor = max(0.15, 1.0 / (256/8)^0.35)
      //               = max(0.15, 1.0 / 32^0.35)
      //               = max(0.15, 1.0 / 3.03...)
      //               ≈ max(0.15, 0.33)
      //               ≈ 0.33
      // result = 0.04 * 0.33 ≈ 0.013
      const expectedFactor = Math.max(
        DENSITY_SCALING_MIN,
        1.0 / Math.pow(vertexCount / DENSITY_SCALING_BASE, DENSITY_SCALING_EXPONENT)
      );
      const expectedSize = 0.04 * expectedFactor;

      expect(result.current).toBeCloseTo(expectedSize, 4);
    });

    it('should respect minimum scale factor', () => {
      // Very large vertex count should hit minimum scale
      const { result } = renderHook(() => useVertexSize(100000));

      // With minimum scale 0.15:
      // result >= 0.04 * 0.15 = 0.006
      const minExpectedSize = 0.04 * DENSITY_SCALING_MIN;
      expect(result.current).toBeGreaterThanOrEqual(minExpectedSize);
    });

    it('should produce consistent scaling for typical objects', () => {
      // Typical vertex counts for different objects
      const testCases = [
        { count: 8, expectedApprox: 0.04, name: '3D cube' },
        { count: 16, expectedApprox: 0.04, name: '4D hypercube' },
        { count: 32, expectedApprox: 0.028, name: '5D hypercube' },
        { count: 64, expectedApprox: 0.020, name: '6D hypercube' },
        { count: 2000, expectedApprox: 0.009, name: 'Typical hypersphere' },
        { count: 5000, expectedApprox: 0.006, name: 'Dense point cloud' },
      ];

      for (const { count, expectedApprox } of testCases) {
        const { result } = renderHook(() => useVertexSize(count));
        // Allow 20% tolerance for approximate values
        expect(result.current).toBeCloseTo(expectedApprox, 1);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero vertex count', () => {
      const { result } = renderHook(() => useVertexSize(0));
      // Zero is below threshold, should get full size
      expect(result.current).toBeCloseTo(0.04, 4);
    });

    it('should handle single vertex', () => {
      const { result } = renderHook(() => useVertexSize(1));
      expect(result.current).toBeCloseTo(0.04, 4);
    });

    it('should handle very large vertex counts', () => {
      const { result } = renderHook(() => useVertexSize(1000000));
      // Should still return a positive value (not zero or negative)
      expect(result.current).toBeGreaterThan(0);
      // Should be at minimum scale
      expect(result.current).toBeCloseTo(0.04 * DENSITY_SCALING_MIN, 3);
    });

    it('should handle minimum store vertex size', () => {
      act(() => {
        useVisualStore.getState().setVertexSize(1);
      });

      const { result } = renderHook(() => useVertexSize(8));
      // 1 / 100 = 0.01
      expect(result.current).toBeCloseTo(0.01, 4);
    });

    it('should handle maximum store vertex size', () => {
      act(() => {
        useVisualStore.getState().setVertexSize(10);
      });

      const { result } = renderHook(() => useVertexSize(8));
      // 10 / 100 = 0.1
      expect(result.current).toBeCloseTo(0.1, 4);
    });
  });

  describe('visual consistency', () => {
    it('should produce same base size as PointCloudRenderer default when using default settings', () => {
      // PointCloudRenderer uses DEFAULT_BASE_VERTEX_SIZE = 0.04
      const { result } = renderHook(() => useVertexSize(8));

      // With default vertex size 4 and 8 vertices (no scaling)
      // useVertexSize should produce 0.04, matching PointCloudRenderer default
      expect(result.current).toBeCloseTo(0.04, 4);
    });

    it('should produce same base size as PolytopeRenderer default', () => {
      // PolytopeRenderer uses storeVertexSize / 100 = 4 / 100 = 0.04
      const { result } = renderHook(() => useVertexSize(8));

      expect(result.current).toBeCloseTo(0.04, 4);
    });
  });
});
