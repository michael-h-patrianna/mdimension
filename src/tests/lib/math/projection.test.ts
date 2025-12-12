/**
 * Tests for n-dimensional projection operations
 */

import { describe, it, expect } from 'vitest';
import {
  projectPerspective,
  projectOrthographic,
  projectVertices,
  calculateDepth,
  sortByDepth,
  calculateProjectionDistance,
  DEFAULT_PROJECTION_DISTANCE,
} from '@/lib/math';

describe('Projection Operations', () => {
  describe('projectOrthographic', () => {
    it('extracts first 3 coordinates from 3D vector', () => {
      const v = [1, 2, 3];
      const projected = projectOrthographic(v);
      expect(projected).toEqual([1, 2, 3]);
    });

    it('extracts first 3 coordinates from 4D vector', () => {
      const v = [1, 2, 3, 4];
      const projected = projectOrthographic(v);
      expect(projected).toEqual([1, 2, 3]);
    });

    it('extracts first 3 coordinates from 5D vector', () => {
      const v = [1, 2, 3, 4, 5];
      const projected = projectOrthographic(v);
      expect(projected).toEqual([1, 2, 3]);
    });

    it('projects 2D vector to XZ plane at Y=0', () => {
      const v = [1, 2];
      const projected = projectOrthographic(v);
      expect(projected).toEqual([1, 0, 2]);
    });

    it('throws error for vectors with less than 2 dimensions', () => {
      expect(() => projectOrthographic([1])).toThrow();
    });
  });

  describe('projectPerspective', () => {
    it('applies consistent perspective scaling to 3D vector', () => {
      const v = [1, 2, 3];
      const d = 4;
      // For 3D: effectiveDepth = 0, denominator = 4, scale = 1/4
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(0.25, 10);
      expect(projected[1]).toBeCloseTo(0.5, 10);
      expect(projected[2]).toBeCloseTo(0.75, 10);
    });

    it('projects 4D point with w=0 correctly', () => {
      const v = [1, 2, 3, 0];
      const d = 4;
      // denominator = 4 - 0 = 4, scale = 1/4
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(0.25, 10);
      expect(projected[1]).toBeCloseTo(0.5, 10);
      expect(projected[2]).toBeCloseTo(0.75, 10);
    });

    it('projects 4D point with positive w correctly', () => {
      const v = [2, 4, 6, 1];
      const d = 4;
      // denominator = 4 - 1 = 3, scale = 1/3
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(2 / 3, 10);
      expect(projected[1]).toBeCloseTo(4 / 3, 10);
      expect(projected[2]).toBeCloseTo(2, 10);
    });

    it('projects 4D point with negative w correctly', () => {
      const v = [1, 2, 3, -1];
      const d = 4;
      // denominator = 4 - (-1) = 5, scale = 1/5
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(0.2, 10);
      expect(projected[1]).toBeCloseTo(0.4, 10);
      expect(projected[2]).toBeCloseTo(0.6, 10);
    });

    it('handles point near projection plane without NaN/Infinity', () => {
      const v = [1, 2, 3, 3.999]; // w very close to d=4
      const projected = projectPerspective(v, 4);

      // Should not produce NaN or Infinity
      expect(isFinite(projected[0])).toBe(true);
      expect(isFinite(projected[1])).toBe(true);
      expect(isFinite(projected[2])).toBe(true);

      // Should be large but clamped
      expect(Math.abs(projected[0])).toBeGreaterThan(1);
      expect(Math.abs(projected[1])).toBeGreaterThan(1);
      expect(Math.abs(projected[2])).toBeGreaterThan(1);
    });

    it('projects 5D point correctly (single-step projection)', () => {
      const v = [1, 1, 1, 0, 0];
      const d = 4;
      // Single-step projection:
      // effectiveDepth = (0 + 0) / sqrt(2) = 0
      // denominator = 4 - 0 = 4
      // scale = 1/4
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(1 / 4, 10);
      expect(projected[1]).toBeCloseTo(1 / 4, 10);
      expect(projected[2]).toBeCloseTo(1 / 4, 10);
    });

    it('handles 4D cube vertices (8 points in 4D)', () => {
      // 4D cube vertices: all combinations of ±1 in each dimension
      const vertices = [
        [-1, -1, -1, -1],
        [1, -1, -1, -1],
        [-1, 1, -1, -1],
        [1, 1, -1, -1],
        [-1, -1, 1, -1],
        [1, -1, 1, -1],
        [-1, 1, 1, -1],
        [1, 1, 1, -1],
      ];

      const d = 4;
      for (const v of vertices) {
        const projected = projectPerspective(v, d);

        // All projections should be finite
        expect(isFinite(projected[0])).toBe(true);
        expect(isFinite(projected[1])).toBe(true);
        expect(isFinite(projected[2])).toBe(true);

        // w = -1, so denominator = 5, scale = 1/5 = 0.2
        expect(Math.abs(projected[0])).toBeCloseTo(0.2, 10);
        expect(Math.abs(projected[1])).toBeCloseTo(0.2, 10);
        expect(Math.abs(projected[2])).toBeCloseTo(0.2, 10);
      }
    });

    it('projects 2D vector to XZ plane at Y=0 with perspective scaling', () => {
      const v = [1, 2];
      const d = 4;
      // For 2D: scale = 1/d = 1/4 = 0.25
      const projected = projectPerspective(v, d);
      expect(projected[0]).toBeCloseTo(0.25, 10);
      expect(projected[1]).toBe(0);
      expect(projected[2]).toBeCloseTo(0.5, 10);
    });

    it('throws error for vectors with less than 2 dimensions', () => {
      expect(() => projectPerspective([1], 4)).toThrow();
    });

    it('throws error for non-positive projection distance', () => {
      expect(() => projectPerspective([1, 2, 3, 4], 0)).toThrow();
      expect(() => projectPerspective([1, 2, 3, 4], -1)).toThrow();
    });
  });

  describe('projectVertices', () => {
    it('projects multiple vertices with perspective', () => {
      const vertices = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
      ];

      const projected = projectVertices(vertices, 4, true);
      expect(projected).toHaveLength(3);

      for (const p of projected) {
        expect(p).toHaveLength(3);
        expect(isFinite(p[0])).toBe(true);
        expect(isFinite(p[1])).toBe(true);
        expect(isFinite(p[2])).toBe(true);
      }
    });

    it('projects multiple vertices with orthographic', () => {
      const vertices = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ];

      const projected = projectVertices(vertices, 4, false);
      expect(projected).toEqual([
        [1, 2, 3],
        [5, 6, 7],
      ]);
    });

    it('handles empty array', () => {
      const projected = projectVertices([], 4, true);
      expect(projected).toEqual([]);
    });

    it('throws error if vertices have different dimensions', () => {
      const vertices = [
        [1, 2, 3],
        [1, 2, 3, 4],
      ];
      expect(() => projectVertices(vertices, 4, true)).toThrow();
    });
  });

  describe('calculateDepth', () => {
    it('returns 0 for 3D vectors', () => {
      const v = [1, 2, 3];
      expect(calculateDepth(v)).toBe(0);
    });

    it('calculates depth for 4D vector', () => {
      const v = [1, 2, 3, 4];
      // depth = |w| = 4
      expect(calculateDepth(v)).toBe(4);
    });

    it('calculates depth for 5D vector', () => {
      const v = [1, 2, 3, 4, 3];
      // depth = sqrt(4^2 + 3^2) = sqrt(25) = 5
      expect(calculateDepth(v)).toBe(5);
    });

    it('handles negative higher dimension coordinates', () => {
      const v = [1, 2, 3, -4, 0];
      // depth = sqrt(16) = 4
      expect(calculateDepth(v)).toBe(4);
    });
  });

  describe('sortByDepth', () => {
    it('sorts vertices by depth (furthest first)', () => {
      const vertices = [
        [0, 0, 0, 1], // depth = 1
        [0, 0, 0, 3], // depth = 3
        [0, 0, 0, 2], // depth = 2
      ];

      const indices = sortByDepth(vertices);
      expect(indices).toEqual([1, 2, 0]); // Furthest (3) to nearest (1)
    });

    it('handles 3D vectors (all depth = 0)', () => {
      const vertices = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      const indices = sortByDepth(vertices);
      // Order doesn't matter since all depths are 0
      expect(indices).toHaveLength(2);
    });

    it('sorts 5D vertices correctly', () => {
      const vertices = [
        [0, 0, 0, 3, 4], // depth = 5
        [0, 0, 0, 0, 0], // depth = 0
        [0, 0, 0, 1, 0], // depth = 1
      ];

      const indices = sortByDepth(vertices);
      expect(indices).toEqual([0, 2, 1]);
    });
  });

  describe('calculateProjectionDistance', () => {
    it('returns default distance for 3D vertices', () => {
      const vertices = [[1, 2, 3]];
      const distance = calculateProjectionDistance(vertices);
      expect(distance).toBe(DEFAULT_PROJECTION_DISTANCE);
    });

    it('calculates distance based on max higher dimension coordinate', () => {
      const vertices = [
        [0, 0, 0, 2],
        [0, 0, 0, -3],
        [0, 0, 0, 1],
      ];

      // max = 3, default margin = 2.0
      // distance = 3 * 2.0 + 1.0 = 7.0
      const distance = calculateProjectionDistance(vertices);
      expect(distance).toBe(7.0);
    });

    it('uses custom margin', () => {
      const vertices = [[0, 0, 0, 2]];

      // max = 2, margin = 3.0
      // distance = 2 * 3.0 + 1.0 = 7.0
      const distance = calculateProjectionDistance(vertices, 3.0);
      expect(distance).toBe(7.0);
    });

    it('handles empty array', () => {
      const distance = calculateProjectionDistance([]);
      expect(distance).toBe(DEFAULT_PROJECTION_DISTANCE);
    });
  });

  describe('Quality Gate Requirements', () => {
    it('perspective projection handles w ≈ d case without NaN/Infinity', () => {
      const testCases = [
        [1, 1, 1, 3.99],
        [1, 1, 1, 3.999],
        [1, 1, 1, 3.9999],
        [1, 1, 1, 4.001], // Slightly beyond
      ];

      for (const v of testCases) {
        const projected = projectPerspective(v, 4);

        expect(isNaN(projected[0])).toBe(false);
        expect(isNaN(projected[1])).toBe(false);
        expect(isNaN(projected[2])).toBe(false);

        expect(isFinite(projected[0])).toBe(true);
        expect(isFinite(projected[1])).toBe(true);
        expect(isFinite(projected[2])).toBe(true);
      }
    });

    it('4D cube projects to valid 3D coordinates', () => {
      // All 16 vertices of a 4D hypercube
      const vertices: number[][] = [];
      for (let i = 0; i < 16; i++) {
        const v = [
          (i & 1) ? 1 : -1,
          (i & 2) ? 1 : -1,
          (i & 4) ? 1 : -1,
          (i & 8) ? 1 : -1,
        ];
        vertices.push(v);
      }

      const projectionDistance = 4;

      for (const v of vertices) {
        const projected = projectPerspective(v, projectionDistance);

        // All coordinates should be finite
        expect(isFinite(projected[0])).toBe(true);
        expect(isFinite(projected[1])).toBe(true);
        expect(isFinite(projected[2])).toBe(true);

        // All coordinates should be reasonable (not extreme values)
        expect(Math.abs(projected[0])).toBeLessThan(100);
        expect(Math.abs(projected[1])).toBeLessThan(100);
        expect(Math.abs(projected[2])).toBeLessThan(100);

        // Should maintain sign relationships
        expect(Math.sign(projected[0])).toBe(Math.sign(v[0]!));
        expect(Math.sign(projected[1])).toBe(Math.sign(v[1]!));
        expect(Math.sign(projected[2])).toBe(Math.sign(v[2]!));
      }
    });
  });
});
