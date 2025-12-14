/**
 * Tests for Hyperbulb Opacity Types
 */

import { describe, expect, it } from 'vitest';
import {
  OPACITY_MODE_LABELS,
  OPACITY_MODE_TO_INT,
  OPACITY_MODE_TOOLTIPS,
  SAMPLE_QUALITY_LABELS,
  SAMPLE_QUALITY_TO_INT,
  type HyperbulbOpacitySettings,
  type OpacityMode,
  type SampleQuality,
  type VolumetricAnimationQuality,
} from '@/lib/opacity/types';

describe('Opacity Types', () => {
  describe('OpacityMode type', () => {
    it('should have all four opacity modes', () => {
      const modes: OpacityMode[] = ['solid', 'simpleAlpha', 'layeredSurfaces', 'volumetricDensity'];
      expect(modes).toHaveLength(4);
    });

    it('should map modes to integers correctly', () => {
      expect(OPACITY_MODE_TO_INT.solid).toBe(0);
      expect(OPACITY_MODE_TO_INT.simpleAlpha).toBe(1);
      expect(OPACITY_MODE_TO_INT.layeredSurfaces).toBe(2);
      expect(OPACITY_MODE_TO_INT.volumetricDensity).toBe(3);
    });
  });

  describe('SampleQuality type', () => {
    it('should have all three quality levels', () => {
      const qualities: SampleQuality[] = ['low', 'medium', 'high'];
      expect(qualities).toHaveLength(3);
    });

    it('should map quality to integers correctly', () => {
      expect(SAMPLE_QUALITY_TO_INT.low).toBe(0);
      expect(SAMPLE_QUALITY_TO_INT.medium).toBe(1);
      expect(SAMPLE_QUALITY_TO_INT.high).toBe(2);
    });
  });

  describe('VolumetricAnimationQuality type', () => {
    it('should have reduce and full options', () => {
      const qualities: VolumetricAnimationQuality[] = ['reduce', 'full'];
      expect(qualities).toHaveLength(2);
    });
  });

  describe('HyperbulbOpacitySettings interface', () => {
    it('should have all required properties', () => {
      const settings: HyperbulbOpacitySettings = {
        mode: 'solid',
        simpleAlphaOpacity: 0.7,
        layerCount: 2,
        layerOpacity: 0.5,
        volumetricDensity: 1.0,
        sampleQuality: 'medium',
        volumetricAnimationQuality: 'reduce',
      };

      expect(settings.mode).toBe('solid');
      expect(settings.simpleAlphaOpacity).toBe(0.7);
      expect(settings.layerCount).toBe(2);
      expect(settings.layerOpacity).toBe(0.5);
      expect(settings.volumetricDensity).toBe(1.0);
      expect(settings.sampleQuality).toBe('medium');
      expect(settings.volumetricAnimationQuality).toBe('reduce');
    });

    it('should accept valid layer counts (2, 3, 4)', () => {
      const counts: (2 | 3 | 4)[] = [2, 3, 4];
      counts.forEach((count) => {
        const settings: HyperbulbOpacitySettings = {
          mode: 'layeredSurfaces',
          simpleAlphaOpacity: 0.7,
          layerCount: count,
          layerOpacity: 0.5,
          volumetricDensity: 1.0,
          sampleQuality: 'medium',
          volumetricAnimationQuality: 'reduce',
        };
        expect(settings.layerCount).toBe(count);
      });
    });
  });

  describe('OPACITY_MODE_LABELS', () => {
    it('should have labels for all modes', () => {
      expect(OPACITY_MODE_LABELS.solid).toBe('Solid');
      expect(OPACITY_MODE_LABELS.simpleAlpha).toBe('Simple Alpha');
      expect(OPACITY_MODE_LABELS.layeredSurfaces).toBe('Layered Surfaces');
      expect(OPACITY_MODE_LABELS.volumetricDensity).toBe('Volumetric Density');
    });
  });

  describe('OPACITY_MODE_TOOLTIPS', () => {
    it('should have tooltips for all modes', () => {
      expect(OPACITY_MODE_TOOLTIPS.solid).toContain('opaque');
      expect(OPACITY_MODE_TOOLTIPS.simpleAlpha).toContain('transparency');
      expect(OPACITY_MODE_TOOLTIPS.layeredSurfaces).toContain('layers');
      expect(OPACITY_MODE_TOOLTIPS.volumetricDensity).toContain('volumetric');
    });
  });

  describe('SAMPLE_QUALITY_LABELS', () => {
    it('should have labels for all quality levels', () => {
      expect(SAMPLE_QUALITY_LABELS.low).toBe('Low');
      expect(SAMPLE_QUALITY_LABELS.medium).toBe('Medium');
      expect(SAMPLE_QUALITY_LABELS.high).toBe('High');
    });
  });
});
