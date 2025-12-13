import { describe, it, expect } from 'vitest';
import {
  generateVertexCubes,
  getVertexCubeVertexCount,
  getVertexCubeEdgeCount,
  getVertexCubeFaceCount,
} from '@/lib/geometry/vertexCubes';
import type { VectorND } from '@/lib/math/types';

describe('vertexCubes', () => {
  describe('generateVertexCubes', () => {
    it('generates correct number of vertices for single base vertex', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 0]];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      expect(result.vertices).toHaveLength(8); // 8 corners per cube
    });

    it('generates correct number of edges for single base vertex', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 0]];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      expect(result.edges).toHaveLength(12); // 12 edges per cube
    });

    it('generates correct number of faces for single base vertex', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 0]];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      // 6 quads = 12 triangles
      expect(result.faces).toHaveLength(12);
    });

    it('scales correctly with multiple base vertices', () => {
      const baseVertices: VectorND[] = [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      expect(result.vertices).toHaveLength(24); // 8 * 3
      expect(result.edges).toHaveLength(36); // 12 * 3
      expect(result.faces).toHaveLength(36); // 12 * 3
    });

    it('generates cube corners at correct positions', () => {
      const baseVertices: VectorND[] = [[1, 2, 3, 4]];
      const halfSize = 0.5;
      const result = generateVertexCubes(baseVertices, halfSize, 4);

      // Check all 8 corners are at ±halfSize from base position in XYZ
      const corners = result.vertices;

      // All corners should have W dimension = 4 (unchanged from base)
      for (const corner of corners) {
        expect(corner[3]).toBe(4);
      }

      // Check X range
      const xValues = corners.map((v) => v[0] ?? 0);
      expect(Math.min(...xValues)).toBeCloseTo(1 - halfSize);
      expect(Math.max(...xValues)).toBeCloseTo(1 + halfSize);

      // Check Y range
      const yValues = corners.map((v) => v[1] ?? 0);
      expect(Math.min(...yValues)).toBeCloseTo(2 - halfSize);
      expect(Math.max(...yValues)).toBeCloseTo(2 + halfSize);

      // Check Z range
      const zValues = corners.map((v) => v[2] ?? 0);
      expect(Math.min(...zValues)).toBeCloseTo(3 - halfSize);
      expect(Math.max(...zValues)).toBeCloseTo(3 + halfSize);
    });

    it('preserves higher dimensions from base vertex', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 1, 2, 3, 4, 5]];
      const result = generateVertexCubes(baseVertices, 0.1, 8);

      // All cube corners should have same values in dimensions 4+
      for (const corner of result.vertices) {
        expect(corner[3]).toBe(1); // W
        expect(corner[4]).toBe(2); // 5th dim
        expect(corner[5]).toBe(3); // 6th dim
        expect(corner[6]).toBe(4); // 7th dim
        expect(corner[7]).toBe(5); // 8th dim
      }
    });

    it('generates valid edge indices', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 0]];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      // All edge indices should be within vertex range
      for (const [a, b] of result.edges) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(result.vertices.length);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(result.vertices.length);
        expect(a).not.toBe(b); // No self-loops
      }
    });

    it('generates valid face vertex indices', () => {
      const baseVertices: VectorND[] = [[0, 0, 0, 0]];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      // All face vertex indices should be within vertex range
      for (const face of result.faces) {
        expect(face.vertices).toHaveLength(3); // Triangles
        for (const idx of face.vertices) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(result.vertices.length);
        }
      }
    });

    it('handles empty base vertices', () => {
      const baseVertices: VectorND[] = [];
      const result = generateVertexCubes(baseVertices, 0.1, 4);

      expect(result.vertices).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.faces).toHaveLength(0);
    });

    it('handles 3D dimension correctly', () => {
      const baseVertices: VectorND[] = [[1, 2, 3]];
      const result = generateVertexCubes(baseVertices, 0.1, 3);

      expect(result.vertices).toHaveLength(8);
      // Corners should only have 3 dimensions
      for (const corner of result.vertices) {
        expect(corner).toHaveLength(3);
      }
    });
  });

  describe('getVertexCubeVertexCount', () => {
    it('returns 8 vertices per base vertex', () => {
      expect(getVertexCubeVertexCount(1)).toBe(8);
      expect(getVertexCubeVertexCount(5)).toBe(40);
      expect(getVertexCubeVertexCount(16)).toBe(128);
    });

    it('returns 0 for 0 base vertices', () => {
      expect(getVertexCubeVertexCount(0)).toBe(0);
    });
  });

  describe('getVertexCubeEdgeCount', () => {
    it('returns 12 edges per base vertex', () => {
      expect(getVertexCubeEdgeCount(1)).toBe(12);
      expect(getVertexCubeEdgeCount(5)).toBe(60);
      expect(getVertexCubeEdgeCount(16)).toBe(192);
    });

    it('returns 0 for 0 base vertices', () => {
      expect(getVertexCubeEdgeCount(0)).toBe(0);
    });
  });

  describe('getVertexCubeFaceCount', () => {
    it('returns 12 triangles (6 quads) per base vertex', () => {
      expect(getVertexCubeFaceCount(1)).toBe(12);
      expect(getVertexCubeFaceCount(5)).toBe(60);
      expect(getVertexCubeFaceCount(16)).toBe(192);
    });

    it('returns 0 for 0 base vertices', () => {
      expect(getVertexCubeFaceCount(0)).toBe(0);
    });
  });
});
