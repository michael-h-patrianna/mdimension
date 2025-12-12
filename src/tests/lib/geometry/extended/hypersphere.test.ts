/**
 * Tests for hypersphere generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateHypersphere,
  sampleHypersphereSurface,
  sampleHypersphereSolid,
} from '@/lib/geometry/extended/hypersphere';
import { DEFAULT_HYPERSPHERE_CONFIG } from '@/lib/geometry/extended/types';

describe('sampleHypersphereSurface', () => {
  describe('basic generation', () => {
    it('should generate the requested number of points', () => {
      const points = sampleHypersphereSurface(4, 100, 1.0);
      expect(points).toHaveLength(100);
    });

    it('should generate points with correct dimensionality', () => {
      const points = sampleHypersphereSurface(5, 50, 1.0);
      points.forEach(p => {
        expect(p).toHaveLength(5);
      });
    });

    it('should generate points approximately on the sphere surface', () => {
      const radius = 1.5;
      const points = sampleHypersphereSurface(4, 100, radius);

      points.forEach(p => {
        const norm = Math.sqrt(p.reduce((sum, x) => sum + x * x, 0));
        expect(norm).toBeCloseTo(radius, 5);
      });
    });
  });

  describe('dimension validation', () => {
    it('should work for dimension 3', () => {
      const points = sampleHypersphereSurface(3, 20, 1.0);
      expect(points).toHaveLength(20);
      points.forEach(p => expect(p).toHaveLength(3));
    });

    it('should work for higher dimensions', () => {
      const points = sampleHypersphereSurface(8, 20, 1.0);
      expect(points).toHaveLength(20);
      points.forEach(p => expect(p).toHaveLength(8));
    });
  });
});

describe('sampleHypersphereSolid', () => {
  describe('basic generation', () => {
    it('should generate the requested number of points', () => {
      const points = sampleHypersphereSolid(4, 100, 1.0);
      expect(points).toHaveLength(100);
    });

    it('should generate points inside or on the ball', () => {
      const radius = 1.0;
      const points = sampleHypersphereSolid(4, 200, radius);

      points.forEach(p => {
        const norm = Math.sqrt(p.reduce((sum, x) => sum + x * x, 0));
        expect(norm).toBeLessThanOrEqual(radius + 1e-6);
      });
    });

    it('should have points distributed throughout the interior', () => {
      const radius = 1.0;
      const points = sampleHypersphereSolid(4, 500, radius);

      // Count points in inner and outer regions
      let innerCount = 0;
      let outerCount = 0;
      const innerRadius = radius * 0.5;

      points.forEach(p => {
        const norm = Math.sqrt(p.reduce((sum, x) => sum + x * x, 0));
        if (norm < innerRadius) {
          innerCount++;
        } else {
          outerCount++;
        }
      });

      // Should have some points in both regions
      // Outer region has more volume in high dimensions
      expect(innerCount).toBeGreaterThan(0);
      expect(outerCount).toBeGreaterThan(innerCount); // Outer region is larger
    });
  });
});

describe('generateHypersphere', () => {
  describe('surface mode', () => {
    it('should generate NdGeometry with correct properties', () => {
      const geometry = generateHypersphere(4, {
        ...DEFAULT_HYPERSPHERE_CONFIG,
        mode: 'surface',
        sampleCount: 100,
      });

      expect(geometry.dimension).toBe(4);
      expect(geometry.type).toBe('hypersphere');
      expect(geometry.vertices).toHaveLength(100);
      expect(geometry.isPointCloud).toBe(true);
      expect(geometry.metadata?.name).toContain('Hypersphere');
    });

    it('should not generate edges when wireframe is disabled', () => {
      const geometry = generateHypersphere(4, {
        ...DEFAULT_HYPERSPHERE_CONFIG,
        wireframeEnabled: false,
      });

      expect(geometry.edges).toHaveLength(0);
    });

    it('should generate edges when wireframe is enabled', () => {
      const geometry = generateHypersphere(4, {
        mode: 'surface',
        sampleCount: 50,
        radius: 1.0,
        wireframeEnabled: true,
        neighborCount: 4,
      });

      expect(geometry.edges.length).toBeGreaterThan(0);
    });
  });

  describe('solid mode', () => {
    it('should generate interior points', () => {
      const geometry = generateHypersphere(4, {
        ...DEFAULT_HYPERSPHERE_CONFIG,
        mode: 'solid',
        sampleCount: 100,
      });

      expect(geometry.vertices).toHaveLength(100);
      expect(geometry.metadata?.name).toContain('Hypersphere');
    });
  });

  describe('dimension validation', () => {
    it('should throw error for dimension < 2', () => {
      expect(() => generateHypersphere(1, DEFAULT_HYPERSPHERE_CONFIG)).toThrow();
    });

    it('should generate circle for dimension 2', () => {
      const geometry = generateHypersphere(2, DEFAULT_HYPERSPHERE_CONFIG);
      expect(geometry.dimension).toBe(2);
      // S^1 is the circle (1-sphere in 2D)
      expect(geometry.metadata?.name).toContain('S^1');
    });

    it('should accept dimension >= 3', () => {
      expect(() => generateHypersphere(3, DEFAULT_HYPERSPHERE_CONFIG)).not.toThrow();
      expect(() => generateHypersphere(6, DEFAULT_HYPERSPHERE_CONFIG)).not.toThrow();
    });
  });

  describe('radius configuration', () => {
    it('should respect the radius parameter', () => {
      const radius = 2.0;
      const geometry = generateHypersphere(4, {
        ...DEFAULT_HYPERSPHERE_CONFIG,
        mode: 'surface',
        radius,
        sampleCount: 50,
      });

      geometry.vertices.forEach(v => {
        const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
        expect(norm).toBeCloseTo(radius, 4);
      });
    });
  });
});
