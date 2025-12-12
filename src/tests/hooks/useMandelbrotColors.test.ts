/**
 * Tests for useMandelbrotColors hook
 *
 * Tests cover:
 * - Hook returns undefined for non-Mandelbrot geometry
 * - Hook returns colors for Mandelbrot geometry
 * - Hook updates when config changes
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMandelbrotColors } from '@/hooks/useMandelbrotColors';
import type { NdGeometry } from '@/lib/geometry/types';
import { DEFAULT_MANDELBROT_CONFIG } from '@/lib/geometry/extended/types';

describe('useMandelbrotColors', () => {
  const baseColor = '#ff0000';

  describe('non-Mandelbrot geometry', () => {
    it('should return undefined for null geometry', () => {
      const { result } = renderHook(() =>
        useMandelbrotColors(null, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toBeUndefined();
    });

    it('should return undefined for hypercube geometry', () => {
      const geometry: NdGeometry = {
        dimension: 4,
        type: 'hypercube',
        vertices: [[1, 0, 0, 0]],
        edges: [],
        isPointCloud: false,
      };
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toBeUndefined();
    });

    it('should return undefined for hypersphere geometry', () => {
      const geometry: NdGeometry = {
        dimension: 4,
        type: 'hypersphere',
        vertices: [[1, 0, 0, 0]],
        edges: [],
        isPointCloud: true,
      };
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toBeUndefined();
    });
  });

  describe('Mandelbrot geometry without escape values', () => {
    it('should return undefined if no metadata', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbrot',
        vertices: [[0, 0, 0]],
        edges: [],
        isPointCloud: true,
      };
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toBeUndefined();
    });

    it('should return undefined if metadata has no normalizedEscapeValues', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbrot',
        vertices: [[0, 0, 0]],
        edges: [],
        isPointCloud: true,
        metadata: {
          name: 'Mandelbrot',
          properties: {},
        },
      };
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toBeUndefined();
    });
  });

  describe('Mandelbrot geometry with escape values', () => {
    const createMandelbrotGeometry = (escapeValues: number[]): NdGeometry => ({
      dimension: 3,
      type: 'mandelbrot',
      vertices: escapeValues.map((_, i) => [i, 0, 0]),
      edges: [],
      isPointCloud: true,
      metadata: {
        name: 'Mandelbrot',
        properties: {
          normalizedEscapeValues: escapeValues,
        },
      },
    });

    it('should return color array matching escape values length', () => {
      const geometry = createMandelbrotGeometry([0.1, 0.5, 0.9, 1.0]);
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      expect(result.current).toHaveLength(4);
    });

    it('should return valid hex colors', () => {
      const geometry = createMandelbrotGeometry([0.1, 0.5, 0.9]);
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      result.current?.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      });
    });

    it('should use interior color for bounded points (value = 1)', () => {
      const geometry = createMandelbrotGeometry([1.0, 1.0]);
      const config = { ...DEFAULT_MANDELBROT_CONFIG, interiorColor: '#123456' };
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, config, baseColor)
      );
      // All bounded points should get interior color
      result.current?.forEach((color) => {
        expect(color).toBe('#123456');
      });
    });

    it('should return different colors for different escape values', () => {
      const geometry = createMandelbrotGeometry([0.1, 0.5, 0.9]);
      const { result } = renderHook(() =>
        useMandelbrotColors(geometry, DEFAULT_MANDELBROT_CONFIG, baseColor)
      );
      // Colors should not all be the same
      const uniqueColors = new Set(result.current);
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbrot',
        vertices: [[0, 0, 0], [1, 0, 0]],
        edges: [],
        isPointCloud: true,
        metadata: {
          name: 'Mandelbrot',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      };

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbrotColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: baseColor,
          },
        }
      );

      const firstResult = result.current;
      rerender({ geo: geometry, cfg: DEFAULT_MANDELBROT_CONFIG, color: baseColor });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should update when config changes', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbrot',
        vertices: [[0, 0, 0], [1, 0, 0]],
        edges: [],
        isPointCloud: true,
        metadata: {
          name: 'Mandelbrot',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      };

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbrotColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: baseColor,
          },
        }
      );

      const firstResult = result.current;
      rerender({
        geo: geometry,
        cfg: { ...DEFAULT_MANDELBROT_CONFIG, palette: 'triadic' },
        color: baseColor,
      });
      const secondResult = result.current;

      // Result should be different reference since config changed
      expect(firstResult).not.toBe(secondResult);
    });

    it('should update when baseColor changes', () => {
      const geometry: NdGeometry = {
        dimension: 3,
        type: 'mandelbrot',
        vertices: [[0, 0, 0], [1, 0, 0]],
        edges: [],
        isPointCloud: true,
        metadata: {
          name: 'Mandelbrot',
          properties: {
            normalizedEscapeValues: [0.1, 0.5],
          },
        },
      };

      const { result, rerender } = renderHook(
        ({ geo, cfg, color }) => useMandelbrotColors(geo, cfg, color),
        {
          initialProps: {
            geo: geometry,
            cfg: DEFAULT_MANDELBROT_CONFIG,
            color: '#ff0000',
          },
        }
      );

      const firstResult = result.current;
      rerender({
        geo: geometry,
        cfg: DEFAULT_MANDELBROT_CONFIG,
        color: '#00ff00', // Different color
      });
      const secondResult = result.current;

      // Result should be different reference since baseColor changed
      expect(firstResult).not.toBe(secondResult);
    });
  });
});
