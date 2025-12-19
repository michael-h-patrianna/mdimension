/**
 * Tests for transformStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTransformStore,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_SCALE,
} from '@/stores/transformStore';

describe('transformStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTransformStore.getState().resetAll();
    useTransformStore.getState().setDimension(4);
  });



  describe('setUniformScale', () => {
    it('should update uniform scale', () => {
      useTransformStore.getState().setUniformScale(1.5);
      expect(useTransformStore.getState().uniformScale).toBe(1.5);
    });

    it('should clamp scale to MIN_SCALE', () => {
      useTransformStore.getState().setUniformScale(0);
      expect(useTransformStore.getState().uniformScale).toBe(MIN_SCALE);
    });

    it('should clamp scale to MAX_SCALE', () => {
      useTransformStore.getState().setUniformScale(10);
      expect(useTransformStore.getState().uniformScale).toBe(MAX_SCALE);
    });

    it('should update all per-axis scales when locked', () => {
      useTransformStore.getState().setUniformScale(2.0);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === 2.0)).toBe(true);
    });

    it('should not update per-axis scales when unlocked', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setUniformScale(2.0);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });

  describe('setAxisScale', () => {
    beforeEach(() => {
      useTransformStore.getState().setScaleLocked(false);
    });

    it('should update specific axis scale when unlocked', () => {
      useTransformStore.getState().setAxisScale(0, 1.5);
      expect(useTransformStore.getState().perAxisScale[0]).toBe(1.5);
      expect(useTransformStore.getState().perAxisScale[1]).toBe(DEFAULT_SCALE);
    });

    it('should clamp axis scale to valid range', () => {
      useTransformStore.getState().setAxisScale(0, 0);
      expect(useTransformStore.getState().perAxisScale[0]).toBe(MIN_SCALE);

      useTransformStore.getState().setAxisScale(1, 10);
      expect(useTransformStore.getState().perAxisScale[1]).toBe(MAX_SCALE);
    });

    it('should ignore invalid axis index (negative)', () => {
      const originalScales = [...useTransformStore.getState().perAxisScale];
      useTransformStore.getState().setAxisScale(-1, 2.0);
      expect(useTransformStore.getState().perAxisScale).toEqual(originalScales);
    });

    it('should ignore invalid axis index (too large)', () => {
      const originalScales = [...useTransformStore.getState().perAxisScale];
      useTransformStore.getState().setAxisScale(10, 2.0);
      expect(useTransformStore.getState().perAxisScale).toEqual(originalScales);
    });

    it('should update all axes when locked', () => {
      useTransformStore.getState().setScaleLocked(true);
      useTransformStore.getState().setAxisScale(0, 2.0);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === 2.0)).toBe(true);
      expect(useTransformStore.getState().uniformScale).toBe(2.0);
    });
  });

  describe('setScaleLocked', () => {
    it('should lock scales', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setScaleLocked(true);
      expect(useTransformStore.getState().scaleLocked).toBe(true);
    });

    it('should unlock scales', () => {
      useTransformStore.getState().setScaleLocked(false);
      expect(useTransformStore.getState().scaleLocked).toBe(false);
    });

    it('should sync all axes to uniform scale when locking', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 1.5);
      useTransformStore.getState().setAxisScale(1, 2.0);
      useTransformStore.getState().setUniformScale(1.8);
      useTransformStore.getState().setScaleLocked(true);

      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === 1.8)).toBe(true);
    });
  });

  describe('resetScale', () => {
    it('should reset uniform scale to default', () => {
      useTransformStore.getState().setUniformScale(2.5);
      useTransformStore.getState().resetScale();
      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
    });

    it('should reset all per-axis scales to default', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 2.0);
      useTransformStore.getState().setAxisScale(1, 0.5);
      useTransformStore.getState().resetScale();
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });

  describe('getScaleMatrix', () => {
    it('should return a matrix with correct dimensions', () => {
      const matrix = useTransformStore.getState().getScaleMatrix();
      // 4x4 matrix stored as flat array = 16 elements
      expect(matrix).toHaveLength(16);
    });

    it('should return identity-like matrix for default scales', () => {
      const matrix = useTransformStore.getState().getScaleMatrix();
      const dim = 4;
      // Diagonal elements should be 1.0 (default scale)
      for (let i = 0; i < 4; i++) {
        expect(matrix[i * dim + i]).toBe(DEFAULT_SCALE);
      }
    });

    it('should reflect scale changes in matrix', () => {
      useTransformStore.getState().setUniformScale(2.0);
      const matrix = useTransformStore.getState().getScaleMatrix();
      const dim = 4;
      for (let i = 0; i < 4; i++) {
        expect(matrix[i * dim + i]).toBe(2.0);
      }
    });
  });

  describe('isScaleExtreme', () => {
    it('should return false for default scale', () => {
      expect(useTransformStore.getState().isScaleExtreme()).toBe(false);
    });

    it('should return true for scale below warning threshold', () => {
      useTransformStore.getState().setUniformScale(0.1);
      expect(useTransformStore.getState().isScaleExtreme()).toBe(true);
    });

    it('should return true for scale above warning threshold', () => {
      useTransformStore.getState().setUniformScale(2.8);
      expect(useTransformStore.getState().isScaleExtreme()).toBe(true);
    });

    it('should return true if any axis scale is extreme', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(2, 0.15);
      expect(useTransformStore.getState().isScaleExtreme()).toBe(true);
    });
  });

  describe('setDimension', () => {
    it('should update dimension', () => {
      useTransformStore.getState().setDimension(6);
      expect(useTransformStore.getState().dimension).toBe(6);
    });

    it('should resize per-axis scales array', () => {
      useTransformStore.getState().setDimension(6);
      expect(useTransformStore.getState().perAxisScale).toHaveLength(6);
    });

    it('should reset scales when dimension changes', () => {
      useTransformStore.getState().setUniformScale(2.0);
      useTransformStore.getState().setDimension(5);
      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
      expect(useTransformStore.getState().perAxisScale.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });

    it('should ignore dimension below minimum', () => {
      useTransformStore.getState().setDimension(1);
      expect(useTransformStore.getState().dimension).toBe(4); // Unchanged
    });

    it('should ignore dimension above maximum', () => {
      useTransformStore.getState().setDimension(100);
      expect(useTransformStore.getState().dimension).toBe(4); // Unchanged
    });

    it('should not reset if dimension is unchanged', () => {
      useTransformStore.getState().setUniformScale(2.0);
      useTransformStore.getState().setDimension(4);
      expect(useTransformStore.getState().uniformScale).toBe(2.0);
    });
  });

  describe('resetAll', () => {
    it('should reset all state', () => {
      useTransformStore.getState().setUniformScale(2.5);
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 0.5);
      useTransformStore.getState().resetAll();

      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
      expect(useTransformStore.getState().scaleLocked).toBe(true);
      expect(useTransformStore.getState().perAxisScale.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });
});
