/**
 * Tests for Mandelbulb Opacity Constants
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYER_COUNT,
  DEFAULT_LAYER_OPACITY,
  DEFAULT_OPACITY_MODE,
  DEFAULT_OPACITY_SETTINGS,
  DEFAULT_SAMPLE_QUALITY,
  DEFAULT_SIMPLE_ALPHA_OPACITY,
  DEFAULT_VOLUMETRIC_ANIMATION_QUALITY,
  DEFAULT_VOLUMETRIC_DENSITY,
  LAYER_COUNT_OPTIONS,
  LAYER_OPACITY_RANGE,
  OPACITY_MODE_OPTIONS,
  SAMPLE_QUALITY_OPTIONS,
  SIMPLE_ALPHA_RANGE,
  URL_KEY_LAYER_COUNT,
  URL_KEY_LAYER_OPACITY,
  URL_KEY_OPACITY_MODE,
  URL_KEY_SAMPLE_QUALITY,
  URL_KEY_SIMPLE_ALPHA,
  URL_KEY_VOLUMETRIC_ANIM_QUALITY,
  URL_KEY_VOLUMETRIC_DENSITY,
  VOLUMETRIC_DENSITY_RANGE,
} from '@/rendering/opacity/constants';

describe('Opacity Constants', () => {
  describe('Default Values', () => {
    it('should have solid as default opacity mode', () => {
      expect(DEFAULT_OPACITY_MODE).toBe('solid');
    });

    it('should have correct default simple alpha opacity (PRD: 0.7)', () => {
      expect(DEFAULT_SIMPLE_ALPHA_OPACITY).toBe(0.7);
    });

    it('should have correct default layer count (PRD: 2)', () => {
      expect(DEFAULT_LAYER_COUNT).toBe(2);
    });

    it('should have correct default layer opacity (PRD: 0.5)', () => {
      expect(DEFAULT_LAYER_OPACITY).toBe(0.5);
    });

    it('should have correct default volumetric density (PRD: 1.0)', () => {
      expect(DEFAULT_VOLUMETRIC_DENSITY).toBe(1.0);
    });

    it('should have medium as default sample quality', () => {
      expect(DEFAULT_SAMPLE_QUALITY).toBe('medium');
    });

    it('should have reduce as default animation quality', () => {
      expect(DEFAULT_VOLUMETRIC_ANIMATION_QUALITY).toBe('reduce');
    });
  });

  describe('DEFAULT_OPACITY_SETTINGS', () => {
    it('should contain all required settings with correct defaults', () => {
      expect(DEFAULT_OPACITY_SETTINGS.mode).toBe('solid');
      expect(DEFAULT_OPACITY_SETTINGS.simpleAlphaOpacity).toBe(0.7);
      expect(DEFAULT_OPACITY_SETTINGS.layerCount).toBe(2);
      expect(DEFAULT_OPACITY_SETTINGS.layerOpacity).toBe(0.5);
      expect(DEFAULT_OPACITY_SETTINGS.volumetricDensity).toBe(1.0);
      expect(DEFAULT_OPACITY_SETTINGS.sampleQuality).toBe('medium');
      expect(DEFAULT_OPACITY_SETTINGS.volumetricAnimationQuality).toBe('reduce');
    });
  });

  describe('Slider Ranges', () => {
    it('should have correct simple alpha range (0-1, step 0.05)', () => {
      expect(SIMPLE_ALPHA_RANGE.min).toBe(0);
      expect(SIMPLE_ALPHA_RANGE.max).toBe(1);
      expect(SIMPLE_ALPHA_RANGE.step).toBe(0.05);
      expect(SIMPLE_ALPHA_RANGE.default).toBe(0.7);
    });

    it('should have correct layer opacity range (0.1-0.9, step 0.05)', () => {
      expect(LAYER_OPACITY_RANGE.min).toBe(0.1);
      expect(LAYER_OPACITY_RANGE.max).toBe(0.9);
      expect(LAYER_OPACITY_RANGE.step).toBe(0.05);
      expect(LAYER_OPACITY_RANGE.default).toBe(0.5);
    });

    it('should have correct volumetric density range (0.1-2.0, step 0.1)', () => {
      expect(VOLUMETRIC_DENSITY_RANGE.min).toBe(0.1);
      expect(VOLUMETRIC_DENSITY_RANGE.max).toBe(2.0);
      expect(VOLUMETRIC_DENSITY_RANGE.step).toBe(0.1);
      expect(VOLUMETRIC_DENSITY_RANGE.default).toBe(1.0);
    });
  });

  describe('Options Arrays', () => {
    it('should have valid layer count options (2, 3, 4)', () => {
      expect(LAYER_COUNT_OPTIONS).toEqual([2, 3, 4]);
    });

    it('should have valid sample quality options', () => {
      expect(SAMPLE_QUALITY_OPTIONS).toEqual(['low', 'medium', 'high']);
    });

    it('should have all opacity modes in order', () => {
      expect(OPACITY_MODE_OPTIONS).toEqual([
        'solid',
        'simpleAlpha',
        'layeredSurfaces',
        'volumetricDensity',
      ]);
    });
  });

  describe('URL Serialization Keys', () => {
    it('should have compact URL keys', () => {
      expect(URL_KEY_OPACITY_MODE).toBe('om');
      expect(URL_KEY_SIMPLE_ALPHA).toBe('sao');
      expect(URL_KEY_LAYER_COUNT).toBe('lc');
      expect(URL_KEY_LAYER_OPACITY).toBe('lo');
      expect(URL_KEY_VOLUMETRIC_DENSITY).toBe('vd');
      expect(URL_KEY_SAMPLE_QUALITY).toBe('sq');
      expect(URL_KEY_VOLUMETRIC_ANIM_QUALITY).toBe('vaq');
    });

    it('should have unique URL keys', () => {
      const keys = [
        URL_KEY_OPACITY_MODE,
        URL_KEY_SIMPLE_ALPHA,
        URL_KEY_LAYER_COUNT,
        URL_KEY_LAYER_OPACITY,
        URL_KEY_VOLUMETRIC_DENSITY,
        URL_KEY_SAMPLE_QUALITY,
        URL_KEY_VOLUMETRIC_ANIM_QUALITY,
      ];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});
