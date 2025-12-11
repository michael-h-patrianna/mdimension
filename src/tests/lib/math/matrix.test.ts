/**
 * Tests for n-dimensional matrix operations
 */

import { describe, it, expect } from 'vitest';
import {
  createIdentityMatrix,
  createZeroMatrix,
  multiplyMatrices,
  multiplyMatrixVector,
  transposeMatrix,
  determinant,
  matricesEqual,
  copyMatrix,
  getMatrixDimensions,
  EPSILON,
} from '@/lib/math';

describe('Matrix Operations', () => {
  describe('createIdentityMatrix', () => {
    it('creates 3x3 identity matrix', () => {
      const I = createIdentityMatrix(3);
      expect(I).toEqual([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]);
    });

    it('creates 4x4 identity matrix', () => {
      const I = createIdentityMatrix(4);
      expect(I).toEqual([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]);
    });

    it('throws error for invalid dimension', () => {
      expect(() => createIdentityMatrix(0)).toThrow();
      expect(() => createIdentityMatrix(-1)).toThrow();
    });
  });

  describe('createZeroMatrix', () => {
    it('creates a zero matrix of specified size', () => {
      const Z = createZeroMatrix(2, 3);
      expect(Z).toEqual([
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });

    it('creates square zero matrix', () => {
      const Z = createZeroMatrix(3, 3);
      expect(Z).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });
  });

  describe('multiplyMatrices', () => {
    it('multiplies identity by any matrix returns same matrix', () => {
      const I = createIdentityMatrix(3);
      const A = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const result = multiplyMatrices(I, A);
      expect(result).toEqual(A);
    });

    it('multiplies two 2x2 matrices', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];
      const B = [
        [5, 6],
        [7, 8],
      ];
      const result = multiplyMatrices(A, B);
      // [1*5+2*7, 1*6+2*8]   [19, 22]
      // [3*5+4*7, 3*6+4*8] = [43, 50]
      expect(result).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it('multiplies non-square matrices', () => {
      const A = [
        [1, 2, 3],
        [4, 5, 6],
      ]; // 2x3
      const B = [
        [7, 8],
        [9, 10],
        [11, 12],
      ]; // 3x2
      const result = multiplyMatrices(A, B); // 2x2
      // [1*7+2*9+3*11, 1*8+2*10+3*12]   [58, 64]
      // [4*7+5*9+6*11, 4*8+5*10+6*12] = [139, 154]
      expect(result).toEqual([
        [58, 64],
        [139, 154],
      ]);
    });

    it('throws error for incompatible dimensions', () => {
      const A = [[1, 2]]; // 1x2
      const B = [[1], [2], [3]]; // 3x1
      expect(() => multiplyMatrices(A, B)).toThrow();
    });
  });

  describe('multiplyMatrixVector', () => {
    it('multiplies identity matrix by vector returns same vector', () => {
      const I = createIdentityMatrix(3);
      const v = [1, 2, 3];
      const result = multiplyMatrixVector(I, v);
      expect(result).toEqual([1, 2, 3]);
    });

    it('multiplies matrix by vector', () => {
      const M = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const v = [7, 8, 9];
      const result = multiplyMatrixVector(M, v);
      // [1*7+2*8+3*9, 4*7+5*8+6*9] = [50, 122]
      expect(result).toEqual([50, 122]);
    });

    it('throws error for incompatible dimensions', () => {
      const M = [[1, 2, 3]];
      const v = [1, 2];
      expect(() => multiplyMatrixVector(M, v)).toThrow();
    });
  });

  describe('transposeMatrix', () => {
    it('transposes a square matrix', () => {
      const M = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const T = transposeMatrix(M);
      expect(T).toEqual([
        [1, 4, 7],
        [2, 5, 8],
        [3, 6, 9],
      ]);
    });

    it('transposes a non-square matrix', () => {
      const M = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const T = transposeMatrix(M);
      expect(T).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });

    it('transpose of transpose is original', () => {
      const M = [
        [1, 2],
        [3, 4],
      ];
      const T = transposeMatrix(transposeMatrix(M));
      expect(T).toEqual(M);
    });
  });

  describe('determinant', () => {
    it('computes determinant of 1x1 matrix', () => {
      const M = [[5]];
      expect(determinant(M)).toBe(5);
    });

    it('computes determinant of 2x2 matrix', () => {
      const M = [
        [1, 2],
        [3, 4],
      ];
      // det = 1*4 - 2*3 = 4 - 6 = -2
      expect(determinant(M)).toBe(-2);
    });

    it('computes determinant of 3x3 identity matrix', () => {
      const I = createIdentityMatrix(3);
      expect(determinant(I)).toBe(1);
    });

    it('computes determinant of 3x3 matrix', () => {
      const M = [
        [1, 2, 3],
        [0, 4, 5],
        [1, 0, 6],
      ];
      // det = 1*(4*6-5*0) - 2*(0*6-5*1) + 3*(0*0-4*1)
      //     = 1*24 - 2*(-5) + 3*(-4)
      //     = 24 + 10 - 12 = 22
      expect(determinant(M)).toBe(22);
    });

    it('determinant of singular matrix is zero', () => {
      const M = [
        [1, 2, 3],
        [2, 4, 6],
        [3, 6, 9],
      ];
      expect(Math.abs(determinant(M))).toBeLessThan(EPSILON);
    });

    it('throws error for non-square matrix', () => {
      const M = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      expect(() => determinant(M)).toThrow();
    });
  });

  describe('matricesEqual', () => {
    it('returns true for equal matrices', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];
      const B = [
        [1, 2],
        [3, 4],
      ];
      expect(matricesEqual(A, B)).toBe(true);
    });

    it('returns false for different matrices', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];
      const B = [
        [1, 2],
        [3, 5],
      ];
      expect(matricesEqual(A, B)).toBe(false);
    });

    it('handles floating point comparison with epsilon', () => {
      const A = [[1.0, 2.0]];
      const B = [[1.0 + EPSILON / 2, 2.0]];
      expect(matricesEqual(A, B)).toBe(true);
    });
  });

  describe('copyMatrix', () => {
    it('creates an independent copy', () => {
      const original = [
        [1, 2],
        [3, 4],
      ];
      const copy = copyMatrix(original);

      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy[0]).not.toBe(original[0]);

      copy[0]![0] = 999;
      expect(original[0]![0]).toBe(1);
    });
  });

  describe('getMatrixDimensions', () => {
    it('returns dimensions of a matrix', () => {
      const M = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      expect(getMatrixDimensions(M)).toEqual([2, 3]);
    });

    it('handles empty matrix', () => {
      expect(getMatrixDimensions([])).toEqual([0, 0]);
    });
  });
});
