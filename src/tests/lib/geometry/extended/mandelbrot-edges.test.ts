/**
 * Tests for Mandelbrot edge generation
 *
 * Tests the grid-based edge connectivity feature that enables
 * wireframe and dual outline shader support for Mandelbrot visualization.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMandelbrotEdges,
  calculateGridEdgeCount,
  generateMandelbrot,
} from '@/lib/geometry/extended/mandelbrot';
import { DEFAULT_MANDELBROT_CONFIG } from '@/lib/geometry/extended/types';

describe('generateMandelbrotEdges', () => {
  describe('edge mode: none', () => {
    it('should return empty array when edge mode is none', () => {
      const edges = generateMandelbrotEdges(16, 'none');
      expect(edges).toEqual([]);
    });
  });

  describe('edge mode: grid', () => {
    it('should generate edges for a small grid', () => {
      const edges = generateMandelbrotEdges(4, 'grid');
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should handle resolution 1 (single point grid)', () => {
      // Resolution 1 means a single point grid (1x1x1) with no neighbors
      const edges = generateMandelbrotEdges(1, 'grid');
      expect(edges).toEqual([]);
    });

    it('should generate correct number of edges', () => {
      const resolution = 8;
      const edges = generateMandelbrotEdges(resolution, 'grid');
      const expectedCount = calculateGridEdgeCount(resolution);
      expect(edges.length).toBe(expectedCount);
    });

    it('should have valid edge indices (within bounds)', () => {
      const resolution = 4;
      const maxIndex = resolution ** 3 - 1;
      const edges = generateMandelbrotEdges(resolution, 'grid');

      edges.forEach(([a, b]) => {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(maxIndex);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(maxIndex);
      });
    });

    it('should connect adjacent points only', () => {
      const resolution = 4;
      const edges = generateMandelbrotEdges(resolution, 'grid');

      // Helper to convert index to grid coordinates
      const toCoords = (idx: number) => {
        const iz = idx % resolution;
        const iy = Math.floor(idx / resolution) % resolution;
        const ix = Math.floor(idx / (resolution * resolution));
        return { ix, iy, iz };
      };

      // Check that all edges connect adjacent points (Manhattan distance = 1)
      edges.forEach(([a, b]) => {
        const coordsA = toCoords(a);
        const coordsB = toCoords(b);
        const dx = Math.abs(coordsA.ix - coordsB.ix);
        const dy = Math.abs(coordsA.iy - coordsB.iy);
        const dz = Math.abs(coordsA.iz - coordsB.iz);
        const manhattanDist = dx + dy + dz;
        expect(manhattanDist).toBe(1);
      });
    });

    it('should not have duplicate edges', () => {
      const resolution = 4;
      const edges = generateMandelbrotEdges(resolution, 'grid');

      // Create set of edge strings (sorted to handle [a,b] vs [b,a])
      const edgeSet = new Set<string>();
      edges.forEach(([a, b]) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        expect(edgeSet.has(key)).toBe(false);
        edgeSet.add(key);
      });
    });
  });
});

describe('calculateGridEdgeCount', () => {
  it('should calculate correct count for small grids', () => {
    // For a 2x2x2 grid:
    // X edges: (2-1)*2*2 = 4
    // Y edges: 2*(2-1)*2 = 4
    // Z edges: 2*2*(2-1) = 4
    // Total: 12
    expect(calculateGridEdgeCount(2)).toBe(12);
  });

  it('should calculate correct count for medium grids', () => {
    // For a 4x4x4 grid:
    // Each direction: (4-1)*4*4 = 48
    // Total: 48 * 3 = 144
    expect(calculateGridEdgeCount(4)).toBe(144);
  });

  it('should scale cubically with resolution', () => {
    // Edge count is 3 * res^2 * (res-1)
    // For large res, this is approximately 3 * res^3
    const count8 = calculateGridEdgeCount(8);
    const count16 = calculateGridEdgeCount(16);

    // Ratio should be close to (16/8)^3 = 8 for large values
    // But exact formula: 3*16^2*15 / 3*8^2*7 = 3*256*15 / 3*64*7 = 11520 / 1344 ≈ 8.57
    const ratio = count16 / count8;
    expect(ratio).toBeGreaterThan(7);
    expect(ratio).toBeLessThan(10);
  });

  it('should return 0 for resolution 1', () => {
    expect(calculateGridEdgeCount(1)).toBe(0);
  });

  it('should match generated edge count', () => {
    const resolutions = [2, 4, 8, 16];
    resolutions.forEach((res) => {
      const calculated = calculateGridEdgeCount(res);
      const generated = generateMandelbrotEdges(res, 'grid').length;
      expect(generated).toBe(calculated);
    });
  });
});

describe('generateMandelbrot with edges', () => {
  it('should generate empty edges with edgeMode none', () => {
    const geometry = generateMandelbrot(3, {
      ...DEFAULT_MANDELBROT_CONFIG,
      resolution: 4,
      edgeMode: 'none',
    });
    expect(geometry.edges).toEqual([]);
  });

  it('should generate edges with edgeMode grid', () => {
    const geometry = generateMandelbrot(3, {
      ...DEFAULT_MANDELBROT_CONFIG,
      resolution: 4,
      edgeMode: 'grid',
    });
    expect(geometry.edges.length).toBeGreaterThan(0);
  });

  it('should include edge count in metadata', () => {
    const geometry = generateMandelbrot(3, {
      ...DEFAULT_MANDELBROT_CONFIG,
      resolution: 4,
      edgeMode: 'grid',
    });
    const props = geometry.metadata?.properties as Record<string, unknown>;
    expect(props?.edgeMode).toBe('grid');
    expect(props?.edgeCount).toBe(geometry.edges.length);
  });

  it('should not generate edges for interiorOnly color mode', () => {
    // Even with edgeMode: 'grid', interiorOnly filtering breaks grid connectivity
    // so we don't generate edges
    const geometry = generateMandelbrot(3, {
      ...DEFAULT_MANDELBROT_CONFIG,
      resolution: 4,
      edgeMode: 'grid',
      colorMode: 'interiorOnly',
    });
    expect(geometry.edges).toEqual([]);
  });
});
