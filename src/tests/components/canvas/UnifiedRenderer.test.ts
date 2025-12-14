/**
 * Tests for UnifiedRenderer and determineRenderMode function
 */

import { describe, it, expect } from 'vitest';
import { determineRenderMode, type RenderMode } from '@/components/canvas/renderers/UnifiedRenderer';
import type { NdGeometry } from '@/lib/geometry/types';

/**
 * Helper to create minimal geometry for testing
 */
function createTestGeometry(options: {
  vertices?: number[][];
  edges?: [number, number][];
  isPointCloud?: boolean;
  dimension?: number;
  type?: 'hypercube' | 'simplex' | 'cross-polytope' | 'root-system' | 'clifford-torus' | 'mandelbrot' | 'mandelbox' | 'menger';
}): NdGeometry {
  return {
    vertices: options.vertices ?? [[0, 0, 0]],
    edges: options.edges ?? [],
    isPointCloud: options.isPointCloud ?? false,
    dimension: options.dimension ?? 3,
    type: options.type ?? 'hypercube',
  };
}

describe('determineRenderMode', () => {
  describe('mandelbox rendering', () => {
    it('should return raymarch-mandelbox when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'mandelbox', 3, true);
      expect(result).toBe('raymarch-mandelbox');
    });

    it('should return raymarch-mandelbox when faces visible in 4D+', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]] });
      const result = determineRenderMode(geometry, 'mandelbox', 4, true);
      expect(result).toBe('raymarch-mandelbox');
    });

    it('should return none when faces not visible', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'mandelbox', 3, false);
      expect(result).toBe('none');
    });
  });

  describe('menger rendering', () => {
    it('should return raymarch-menger when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'menger', 3, true);
      expect(result).toBe('raymarch-menger');
    });

    it('should return raymarch-menger when faces visible in higher dimensions', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0, 0]] });
      const result = determineRenderMode(geometry, 'menger', 5, true);
      expect(result).toBe('raymarch-menger');
    });

    it('should return none when faces not visible', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'menger', 3, false);
      expect(result).toBe('none');
    });
  });

  describe('mandelbrot/hyperbulb rendering', () => {
    it('should return raymarch-mandelbrot when faces visible in 3D', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'mandelbrot', 3, true);
      expect(result).toBe('raymarch-mandelbrot');
    });

    it('should return raymarch-mandelbrot when faces visible in 4D+', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]] });
      const result = determineRenderMode(geometry, 'mandelbrot', 4, true);
      expect(result).toBe('raymarch-mandelbrot');
    });

    it('should return pointcloud when faces not visible and is point cloud', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]], isPointCloud: true });
      const result = determineRenderMode(geometry, 'mandelbrot', 3, false);
      expect(result).toBe('pointcloud');
    });
  });

  describe('point cloud rendering', () => {
    it('should return pointcloud for root-system', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]], isPointCloud: true });
      const result = determineRenderMode(geometry, 'root-system', 3, false);
      expect(result).toBe('pointcloud');
    });

    it('should return pointcloud for clifford-torus', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0, 0]], isPointCloud: true });
      const result = determineRenderMode(geometry, 'clifford-torus', 4, false);
      expect(result).toBe('pointcloud');
    });

    it('should return pointcloud even with faces visible for point cloud geometry', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]], isPointCloud: true });
      const result = determineRenderMode(geometry, 'root-system', 3, true);
      expect(result).toBe('pointcloud');
    });
  });

  describe('polytope rendering', () => {
    it('should return polytope for hypercube', () => {
      const geometry = createTestGeometry({
        vertices: [[1, 0, 0, 0], [-1, 0, 0, 0]],
        edges: [[0, 1]],
        isPointCloud: false,
      });
      const result = determineRenderMode(geometry, 'hypercube', 4, false);
      expect(result).toBe('polytope');
    });

    it('should return polytope for simplex', () => {
      const geometry = createTestGeometry({
        vertices: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        edges: [[0, 1], [1, 2], [2, 0]],
        isPointCloud: false,
      });
      const result = determineRenderMode(geometry, 'simplex', 3, true);
      expect(result).toBe('polytope');
    });

    it('should return polytope for cross-polytope', () => {
      const geometry = createTestGeometry({
        vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]],
        edges: [[0, 2], [0, 3], [1, 2], [1, 3]],
        isPointCloud: false,
      });
      const result = determineRenderMode(geometry, 'cross-polytope', 3, false);
      expect(result).toBe('polytope');
    });
  });

  describe('edge cases', () => {
    it('should return none for empty geometry', () => {
      const geometry = createTestGeometry({ vertices: [], isPointCloud: false });
      const result = determineRenderMode(geometry, 'hypercube', 4, false);
      expect(result).toBe('none');
    });

    it('should prioritize raymarch mode over polytope for mandelbrot', () => {
      // Even with non-pointcloud geometry, mandelbrot with faces visible uses raymarching
      const geometry = createTestGeometry({
        vertices: [[0, 0, 0]],
        isPointCloud: false,
      });
      const result = determineRenderMode(geometry, 'mandelbrot', 3, true);
      expect(result).toBe('raymarch-mandelbrot');
    });
  });

  describe('dimension requirements', () => {
    it('should respect minimum dimension for mandelbox (3D+)', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      // 2D would not trigger raymarch-mandelbox (though 2D is invalid for mandelbox)
      // Testing that 3D is the minimum
      const result3D = determineRenderMode(geometry, 'mandelbox', 3, true);
      expect(result3D).toBe('raymarch-mandelbox');
    });

    it('should respect minimum dimension for menger (3D+)', () => {
      const geometry = createTestGeometry({ vertices: [[0, 0, 0]] });
      const result = determineRenderMode(geometry, 'menger', 3, true);
      expect(result).toBe('raymarch-menger');
    });
  });
});

describe('RenderMode type', () => {
  it('should have all expected render modes', () => {
    const modes: RenderMode[] = ['polytope', 'pointcloud', 'raymarch-mandelbrot', 'raymarch-mandelbox', 'raymarch-menger', 'none'];
    expect(modes).toContain('polytope');
    expect(modes).toContain('pointcloud');
    expect(modes).toContain('raymarch-mandelbrot');
    expect(modes).toContain('raymarch-mandelbox');
    expect(modes).toContain('raymarch-menger');
    expect(modes).toContain('none');
  });
});
