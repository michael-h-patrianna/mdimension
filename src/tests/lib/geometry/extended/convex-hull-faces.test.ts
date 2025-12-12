/**
 * Tests for convex hull face extraction
 */

import { describe, it, expect } from 'vitest';
import {
  computeConvexHullFaces,
  hasValidConvexHull,
  getConvexHullStats,
} from '@/lib/geometry/extended/utils/convex-hull-faces';
import { generateARoots, generateDRoots } from '@/lib/geometry/extended/root-system';
import { generateE8Roots } from '@/lib/geometry/extended/e8-roots';

describe('computeConvexHullFaces', () => {
  describe('basic validation', () => {
    it('should return empty array for less than 4 points', () => {
      expect(computeConvexHullFaces([])).toEqual([]);
      expect(computeConvexHullFaces([[0, 0, 0]])).toEqual([]);
      expect(computeConvexHullFaces([[0, 0, 0], [1, 0, 0]])).toEqual([]);
      expect(computeConvexHullFaces([[0, 0, 0], [1, 0, 0], [0, 1, 0]])).toEqual([]);
    });

    it('should return empty array for less than 3 dimensions', () => {
      expect(computeConvexHullFaces([[0, 0], [1, 0], [0, 1], [1, 1]])).toEqual([]);
    });
  });

  describe('3D tetrahedron', () => {
    it('should compute 4 triangular faces for a tetrahedron', () => {
      // Regular tetrahedron vertices
      const tetrahedron = [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ];

      const faces = computeConvexHullFaces(tetrahedron);

      // Tetrahedron has 4 triangular faces
      expect(faces).toHaveLength(4);

      // Each face should have exactly 3 vertices
      faces.forEach((face) => {
        expect(face).toHaveLength(3);
      });

      // All face indices should be valid (0-3)
      faces.forEach((face) => {
        face.forEach((idx) => {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(4);
        });
      });
    });
  });

  describe('3D cube', () => {
    it('should compute 12 triangular faces for a cube', () => {
      // Cube vertices
      const cube = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 1],
      ];

      const faces = computeConvexHullFaces(cube);

      // Cube has 6 square faces, each triangulated into 2 triangles = 12 triangles
      expect(faces).toHaveLength(12);
    });
  });

  describe('A_n root system faces', () => {
    it('should compute faces for A_3 (4D, 12 roots)', () => {
      const vertices = generateARoots(4, 1.0);
      expect(vertices).toHaveLength(12);

      const faces = computeConvexHullFaces(vertices);

      // A_3 root polytope (cuboctahedron in projected 3D) has many faces
      expect(faces.length).toBeGreaterThan(0);

      // All faces should be triangles
      faces.forEach((face) => {
        expect(face).toHaveLength(3);
      });

      // All indices should be valid
      faces.forEach((face) => {
        face.forEach((idx) => {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(vertices.length);
        });
      });
    });

    it('should compute faces for A_4 (5D, 20 roots)', () => {
      const vertices = generateARoots(5, 1.0);
      expect(vertices).toHaveLength(20);

      const faces = computeConvexHullFaces(vertices);
      expect(faces.length).toBeGreaterThan(0);
    });
  });

  describe('D_n root system faces', () => {
    it('should compute faces for D_4 (4D, 24 roots / 24-cell)', () => {
      const vertices = generateDRoots(4, 1.0);
      expect(vertices).toHaveLength(24);

      const faces = computeConvexHullFaces(vertices);

      // D_4 / 24-cell has 96 triangular faces
      expect(faces.length).toBeGreaterThan(0);

      // All faces should be triangles
      faces.forEach((face) => {
        expect(face).toHaveLength(3);
      });
    });

    it('should compute faces for D_5 (5D, 40 roots)', () => {
      const vertices = generateDRoots(5, 1.0);
      expect(vertices).toHaveLength(40);

      const faces = computeConvexHullFaces(vertices);
      expect(faces.length).toBeGreaterThan(0);
    });
  });

  describe('E_8 root system faces', () => {
    it('should compute faces for E_8 (8D, 240 roots)', () => {
      const vertices = generateE8Roots(1.0);
      expect(vertices).toHaveLength(240);

      const faces = computeConvexHullFaces(vertices);

      // E_8 polytope has many triangular faces
      expect(faces.length).toBeGreaterThan(0);

      // All faces should be triangles
      faces.forEach((face) => {
        expect(face).toHaveLength(3);
      });

      // All indices should be valid
      faces.forEach((face) => {
        face.forEach((idx) => {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(240);
        });
      });
    });
  });
});

describe('hasValidConvexHull', () => {
  it('should return false for degenerate cases', () => {
    expect(hasValidConvexHull([])).toBe(false);
    expect(hasValidConvexHull([[0, 0, 0]])).toBe(false);
    expect(hasValidConvexHull([[0, 0], [1, 0], [0, 1], [1, 1]])).toBe(false);
  });

  it('should return true for valid polytopes', () => {
    const tetrahedron = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];
    expect(hasValidConvexHull(tetrahedron)).toBe(true);
  });

  it('should return true for root systems', () => {
    const aRoots = generateARoots(4, 1.0);
    expect(hasValidConvexHull(aRoots)).toBe(true);

    const dRoots = generateDRoots(4, 1.0);
    expect(hasValidConvexHull(dRoots)).toBe(true);

    const e8Roots = generateE8Roots(1.0);
    expect(hasValidConvexHull(e8Roots)).toBe(true);
  });
});

describe('getConvexHullStats', () => {
  it('should return null for degenerate cases', () => {
    expect(getConvexHullStats([])).toBeNull();
    expect(getConvexHullStats([[0, 0, 0]])).toBeNull();
  });

  it('should return stats for valid polytopes', () => {
    const tetrahedron = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];

    const stats = getConvexHullStats(tetrahedron);
    expect(stats).not.toBeNull();
    expect(stats!.dimension).toBe(3);
    expect(stats!.actualDimension).toBe(3);
    expect(stats!.vertexCount).toBe(4);
    expect(stats!.facetCount).toBe(4);
    expect(stats!.triangleCount).toBe(4);
  });

  it('should return stats for D_4 root system', () => {
    const vertices = generateDRoots(4, 1.0);
    const stats = getConvexHullStats(vertices);

    expect(stats).not.toBeNull();
    expect(stats!.dimension).toBe(4);
    expect(stats!.actualDimension).toBe(4); // D_4 roots are full 4D
    expect(stats!.vertexCount).toBe(24);
    expect(stats!.facetCount).toBeGreaterThan(0);
    expect(stats!.triangleCount).toBeGreaterThan(0);
  });

  it('should detect reduced dimension for A_n root system', () => {
    const vertices = generateARoots(4, 1.0);
    const stats = getConvexHullStats(vertices);

    expect(stats).not.toBeNull();
    expect(stats!.dimension).toBe(4);
    expect(stats!.actualDimension).toBe(3); // A_3 roots lie in 3D hyperplane
    expect(stats!.triangleCount).toBeGreaterThan(0);
  });
});
