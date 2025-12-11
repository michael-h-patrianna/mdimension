/**
 * Tests for education content
 */

import { describe, it, expect } from 'vitest';
import {
  getDimensionInfo,
  getPolytopeInfo,
  getRotationPlaneCount,
  getHypercubeVertexCount,
  getSimplexVertexCount,
  getCrossPolytopeVertexCount,
  DIMENSION_INFO,
  POLYTOPE_INFO,
  PROJECTION_INFO,
  ROTATION_INFO,
} from '@/lib/education/content';

describe('education content', () => {
  describe('getDimensionInfo', () => {
    it('should return info for dimension 3', () => {
      const info = getDimensionInfo(3);
      expect(info).toBeDefined();
      expect(info?.name).toBe('3D Space');
      expect(info?.dimension).toBe(3);
    });

    it('should return info for dimension 4', () => {
      const info = getDimensionInfo(4);
      expect(info).toBeDefined();
      expect(info?.name).toBe('4D Space');
    });

    it('should return info for dimension 5', () => {
      const info = getDimensionInfo(5);
      expect(info).toBeDefined();
      expect(info?.name).toBe('5D Space');
    });

    it('should return info for dimension 6', () => {
      const info = getDimensionInfo(6);
      expect(info).toBeDefined();
      expect(info?.name).toBe('6D Space');
    });

    it('should return undefined for unsupported dimensions', () => {
      expect(getDimensionInfo(2)).toBeUndefined();
      expect(getDimensionInfo(7)).toBeUndefined();
    });
  });

  describe('getPolytopeInfo', () => {
    it('should return info for hypercube', () => {
      const info = getPolytopeInfo('hypercube');
      expect(info).toBeDefined();
      expect(info?.title).toBe('Hypercube');
    });

    it('should return info for simplex', () => {
      const info = getPolytopeInfo('simplex');
      expect(info).toBeDefined();
      expect(info?.title).toBe('Simplex');
    });

    it('should return info for cross-polytope', () => {
      const info = getPolytopeInfo('cross-polytope');
      expect(info).toBeDefined();
      expect(info?.title).toBe('Cross-Polytope');
    });

    it('should return undefined for unknown type', () => {
      expect(getPolytopeInfo('unknown')).toBeUndefined();
    });
  });

  describe('getRotationPlaneCount', () => {
    it('should return 3 for 3D', () => {
      expect(getRotationPlaneCount(3)).toBe(3);
    });

    it('should return 6 for 4D', () => {
      expect(getRotationPlaneCount(4)).toBe(6);
    });

    it('should return 10 for 5D', () => {
      expect(getRotationPlaneCount(5)).toBe(10);
    });

    it('should return 15 for 6D', () => {
      expect(getRotationPlaneCount(6)).toBe(15);
    });
  });

  describe('getHypercubeVertexCount', () => {
    it('should return 8 for 3D', () => {
      expect(getHypercubeVertexCount(3)).toBe(8);
    });

    it('should return 16 for 4D', () => {
      expect(getHypercubeVertexCount(4)).toBe(16);
    });

    it('should return 32 for 5D', () => {
      expect(getHypercubeVertexCount(5)).toBe(32);
    });

    it('should return 64 for 6D', () => {
      expect(getHypercubeVertexCount(6)).toBe(64);
    });
  });

  describe('getSimplexVertexCount', () => {
    it('should return 4 for 3D', () => {
      expect(getSimplexVertexCount(3)).toBe(4);
    });

    it('should return 5 for 4D', () => {
      expect(getSimplexVertexCount(4)).toBe(5);
    });

    it('should return 6 for 5D', () => {
      expect(getSimplexVertexCount(5)).toBe(6);
    });

    it('should return 7 for 6D', () => {
      expect(getSimplexVertexCount(6)).toBe(7);
    });
  });

  describe('getCrossPolytopeVertexCount', () => {
    it('should return 6 for 3D', () => {
      expect(getCrossPolytopeVertexCount(3)).toBe(6);
    });

    it('should return 8 for 4D', () => {
      expect(getCrossPolytopeVertexCount(4)).toBe(8);
    });

    it('should return 10 for 5D', () => {
      expect(getCrossPolytopeVertexCount(5)).toBe(10);
    });

    it('should return 12 for 6D', () => {
      expect(getCrossPolytopeVertexCount(6)).toBe(12);
    });
  });

  describe('static content', () => {
    it('should have DIMENSION_INFO for all supported dimensions', () => {
      expect(DIMENSION_INFO[3]).toBeDefined();
      expect(DIMENSION_INFO[4]).toBeDefined();
      expect(DIMENSION_INFO[5]).toBeDefined();
      expect(DIMENSION_INFO[6]).toBeDefined();
    });

    it('should have POLYTOPE_INFO for all types', () => {
      expect(POLYTOPE_INFO.hypercube).toBeDefined();
      expect(POLYTOPE_INFO.simplex).toBeDefined();
      expect(POLYTOPE_INFO['cross-polytope']).toBeDefined();
    });

    it('should have PROJECTION_INFO', () => {
      expect(PROJECTION_INFO).toBeDefined();
      expect(PROJECTION_INFO.title).toBe('Projection');
    });

    it('should have ROTATION_INFO', () => {
      expect(ROTATION_INFO).toBeDefined();
      expect(ROTATION_INFO.title).toBe('Rotation');
    });

    it('dimension info should have required fields', () => {
      Object.values(DIMENSION_INFO).forEach((info) => {
        expect(info.dimension).toBeGreaterThanOrEqual(3);
        expect(info.name).toBeTruthy();
        expect(info.description).toBeTruthy();
        expect(info.examples.length).toBeGreaterThan(0);
        expect(info.properties.length).toBeGreaterThan(0);
      });
    });

    it('polytope info should have required fields', () => {
      Object.values(POLYTOPE_INFO).forEach((info) => {
        expect(info.id).toBeTruthy();
        expect(info.title).toBeTruthy();
        expect(info.description).toBeTruthy();
        expect(info.details.length).toBeGreaterThan(0);
      });
    });
  });
});
