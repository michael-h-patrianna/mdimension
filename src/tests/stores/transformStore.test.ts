/**
 * Tests for transformStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTransformStore,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_SCALE,
  SCALE_WARNING_LOW,
  SCALE_WARNING_HIGH,
  MIN_SHEAR,
  MAX_SHEAR,
  MIN_TRANSLATION,
  MAX_TRANSLATION,
} from '@/stores/transformStore';

describe('transformStore', () => {
  beforeEach(() => {
    useTransformStore.getState().resetAll();
    useTransformStore.getState().setDimension(4);
  });

  describe('Scale - Initial State', () => {
    it('should have default uniform scale of 1.0', () => {
      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
    });

    it('should have scale locked by default', () => {
      expect(useTransformStore.getState().scaleLocked).toBe(true);
    });

    it('should have per-axis scales all at 1.0', () => {
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales).toHaveLength(4);
      expect(scales.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });

  describe('Scale - setUniformScale', () => {
    it('should update uniform scale', () => {
      useTransformStore.getState().setUniformScale(1.5);
      expect(useTransformStore.getState().uniformScale).toBe(1.5);
    });

    it('should clamp scale below minimum', () => {
      useTransformStore.getState().setUniformScale(0.05);
      expect(useTransformStore.getState().uniformScale).toBe(MIN_SCALE);
    });

    it('should clamp scale above maximum', () => {
      useTransformStore.getState().setUniformScale(5.0);
      expect(useTransformStore.getState().uniformScale).toBe(MAX_SCALE);
    });

    it('should sync per-axis scales when locked', () => {
      useTransformStore.getState().setUniformScale(2.0);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === 2.0)).toBe(true);
    });

    it('should not sync per-axis scales when unlocked', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setUniformScale(2.0);
      const scales = useTransformStore.getState().perAxisScale;
      // Per-axis scales should still be at default
      expect(scales.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });

  describe('Scale - setAxisScale', () => {
    it('should update individual axis scale when unlocked', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 1.5);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales[0]).toBe(1.5);
      expect(scales[1]).toBe(DEFAULT_SCALE);
    });

    it('should sync all axes when locked', () => {
      useTransformStore.getState().setAxisScale(0, 1.5);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === 1.5)).toBe(true);
    });

    it('should clamp axis scale values', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 0.01);
      expect(useTransformStore.getState().perAxisScale[0]).toBe(MIN_SCALE);

      useTransformStore.getState().setAxisScale(1, 10.0);
      expect(useTransformStore.getState().perAxisScale[1]).toBe(MAX_SCALE);
    });

    it('should ignore invalid axis indices', () => {
      const before = [...useTransformStore.getState().perAxisScale];
      useTransformStore.getState().setAxisScale(-1, 2.0);
      useTransformStore.getState().setAxisScale(10, 2.0);
      const after = useTransformStore.getState().perAxisScale;
      expect(after).toEqual(before);
    });
  });

  describe('Scale - setScaleLocked', () => {
    it('should sync all axes to uniform when locking', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 1.5);
      useTransformStore.getState().setAxisScale(1, 2.0);
      // Now lock - should sync all to current uniform
      useTransformStore.getState().setScaleLocked(true);
      const scales = useTransformStore.getState().perAxisScale;
      expect(scales.every((s) => s === useTransformStore.getState().uniformScale)).toBe(true);
    });
  });

  describe('Scale - resetScale', () => {
    it('should reset all scales to default', () => {
      useTransformStore.getState().setUniformScale(2.0);
      useTransformStore.getState().resetScale();
      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
      expect(useTransformStore.getState().perAxisScale.every((s) => s === DEFAULT_SCALE)).toBe(true);
    });
  });

  describe('Scale - getScaleMatrix', () => {
    it('should return identity-like matrix for default scale', () => {
      const matrix = useTransformStore.getState().getScaleMatrix();
      expect(matrix).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(matrix[i]![i]).toBe(1.0);
      }
    });

    it('should return scaled diagonal matrix', () => {
      useTransformStore.getState().setUniformScale(2.0);
      const matrix = useTransformStore.getState().getScaleMatrix();
      for (let i = 0; i < 4; i++) {
        expect(matrix[i]![i]).toBe(2.0);
      }
    });
  });

  describe('Scale - isScaleExtreme', () => {
    it('should return false for normal scale', () => {
      expect(useTransformStore.getState().isScaleExtreme()).toBe(false);
    });

    it('should return true for low scale', () => {
      useTransformStore.getState().setUniformScale(SCALE_WARNING_LOW - 0.01);
      expect(useTransformStore.getState().isScaleExtreme()).toBe(true);
    });

    it('should return true for high scale', () => {
      useTransformStore.getState().setUniformScale(SCALE_WARNING_HIGH + 0.01);
      expect(useTransformStore.getState().isScaleExtreme()).toBe(true);
    });
  });

  describe('Shear - Initial State', () => {
    it('should have empty shears by default', () => {
      expect(useTransformStore.getState().shears.size).toBe(0);
    });
  });

  describe('Shear - setShear', () => {
    it('should set shear for a plane', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      expect(useTransformStore.getState().shears.get('XY')).toBe(0.5);
    });

    it('should clamp shear values', () => {
      useTransformStore.getState().setShear('XY', -5.0);
      expect(useTransformStore.getState().shears.get('XY')).toBe(MIN_SHEAR);

      useTransformStore.getState().setShear('XZ', 5.0);
      expect(useTransformStore.getState().shears.get('XZ')).toBe(MAX_SHEAR);
    });

    it('should remove shear when set to zero', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      useTransformStore.getState().setShear('XY', 0);
      expect(useTransformStore.getState().shears.has('XY')).toBe(false);
    });
  });

  describe('Shear - resetShear', () => {
    it('should remove specific shear', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      useTransformStore.getState().setShear('XW', 1.0);
      useTransformStore.getState().resetShear('XY');
      expect(useTransformStore.getState().shears.has('XY')).toBe(false);
      expect(useTransformStore.getState().shears.get('XW')).toBe(1.0);
    });
  });

  describe('Shear - resetAllShears', () => {
    it('should clear all shears', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      useTransformStore.getState().setShear('XW', 1.0);
      useTransformStore.getState().resetAllShears();
      expect(useTransformStore.getState().shears.size).toBe(0);
    });
  });

  describe('Shear - getShearMatrix', () => {
    it('should return identity for no shears', () => {
      const matrix = useTransformStore.getState().getShearMatrix();
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          expect(matrix[i]![j]).toBe(i === j ? 1 : 0);
        }
      }
    });

    it('should return shear matrix for XY shear', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      const matrix = useTransformStore.getState().getShearMatrix();
      // XY shear: x' = x + 0.5*y, so matrix[0][1] = 0.5
      expect(matrix[0]![1]).toBe(0.5);
    });
  });

  describe('Translation - Initial State', () => {
    it('should have zero translation by default', () => {
      const translation = useTransformStore.getState().translation;
      expect(translation).toHaveLength(4);
      expect(translation.every((t) => t === 0)).toBe(true);
    });
  });

  describe('Translation - setTranslation', () => {
    it('should set translation for an axis', () => {
      useTransformStore.getState().setTranslation(0, 2.0);
      expect(useTransformStore.getState().translation[0]).toBe(2.0);
    });

    it('should clamp translation values', () => {
      useTransformStore.getState().setTranslation(0, -10.0);
      expect(useTransformStore.getState().translation[0]).toBe(MIN_TRANSLATION);

      useTransformStore.getState().setTranslation(1, 10.0);
      expect(useTransformStore.getState().translation[1]).toBe(MAX_TRANSLATION);
    });

    it('should ignore invalid axis indices', () => {
      const before = [...useTransformStore.getState().translation];
      useTransformStore.getState().setTranslation(-1, 2.0);
      useTransformStore.getState().setTranslation(10, 2.0);
      expect(useTransformStore.getState().translation).toEqual(before);
    });
  });

  describe('Translation - resetTranslation and center', () => {
    it('should reset translation to zero', () => {
      useTransformStore.getState().setTranslation(0, 2.0);
      useTransformStore.getState().setTranslation(1, -1.0);
      useTransformStore.getState().resetTranslation();
      expect(useTransformStore.getState().translation.every((t) => t === 0)).toBe(true);
    });

    it('center should reset translation to zero', () => {
      useTransformStore.getState().setTranslation(0, 2.0);
      useTransformStore.getState().center();
      expect(useTransformStore.getState().translation.every((t) => t === 0)).toBe(true);
    });
  });

  describe('Dimension Changes', () => {
    it('should update arrays when dimension changes', () => {
      useTransformStore.getState().setDimension(5);
      expect(useTransformStore.getState().perAxisScale).toHaveLength(5);
      expect(useTransformStore.getState().translation).toHaveLength(5);
    });

    it('should preserve existing values when increasing dimension', () => {
      useTransformStore.getState().setScaleLocked(false);
      useTransformStore.getState().setAxisScale(0, 1.5);
      useTransformStore.getState().setTranslation(1, 2.0);
      useTransformStore.getState().setDimension(5);
      expect(useTransformStore.getState().perAxisScale[0]).toBe(1.5);
      expect(useTransformStore.getState().translation[1]).toBe(2.0);
    });

    it('should filter invalid shears when decreasing dimension', () => {
      useTransformStore.getState().setShear('XY', 0.5);
      useTransformStore.getState().setShear('XW', 1.0);
      useTransformStore.getState().setDimension(3);
      expect(useTransformStore.getState().shears.has('XY')).toBe(true);
      expect(useTransformStore.getState().shears.has('XW')).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('should reset all transform state', () => {
      useTransformStore.getState().setUniformScale(2.0);
      useTransformStore.getState().setShear('XY', 0.5);
      useTransformStore.getState().setTranslation(0, 2.0);
      useTransformStore.getState().setScaleLocked(false);

      useTransformStore.getState().resetAll();

      expect(useTransformStore.getState().uniformScale).toBe(DEFAULT_SCALE);
      expect(useTransformStore.getState().scaleLocked).toBe(true);
      expect(useTransformStore.getState().shears.size).toBe(0);
      expect(useTransformStore.getState().translation.every((t) => t === 0)).toBe(true);
    });
  });
});
