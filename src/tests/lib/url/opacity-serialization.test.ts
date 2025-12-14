/**
 * Tests for Opacity URL Serialization
 */

import { describe, expect, it } from 'vitest';
import {
  URL_KEY_LAYER_COUNT,
  URL_KEY_LAYER_OPACITY,
  URL_KEY_OPACITY_MODE,
  URL_KEY_SAMPLE_QUALITY,
  URL_KEY_SIMPLE_ALPHA,
  URL_KEY_VOLUMETRIC_ANIM_QUALITY,
  URL_KEY_VOLUMETRIC_DENSITY,
} from '@/lib/opacity/constants';
import { deserializeState, serializeState, type ShareableState } from '@/lib/url/state-serializer';

describe('Opacity URL Serialization', () => {
  describe('serializeState', () => {
    it('should not serialize solid mode (default)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'solid',
      };

      const result = serializeState(state);
      expect(result).not.toContain(URL_KEY_OPACITY_MODE);
    });

    it('should serialize simpleAlpha mode with custom opacity', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'simpleAlpha',
        simpleAlphaOpacity: 0.5,
      };

      const result = serializeState(state);
      expect(result).toContain(`${URL_KEY_OPACITY_MODE}=1`);
      expect(result).toContain(`${URL_KEY_SIMPLE_ALPHA}=0.50`);
    });

    it('should serialize layeredSurfaces mode with layer settings', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'layeredSurfaces',
        layerCount: 4,
        layerOpacity: 0.7,
      };

      const result = serializeState(state);
      expect(result).toContain(`${URL_KEY_OPACITY_MODE}=2`);
      expect(result).toContain(`${URL_KEY_LAYER_COUNT}=4`);
      expect(result).toContain(`${URL_KEY_LAYER_OPACITY}=0.70`);
    });

    it('should serialize volumetricDensity mode with all settings', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'volumetricDensity',
        volumetricDensity: 1.5,
        sampleQuality: 'high',
        volumetricAnimationQuality: 'full',
      };

      const result = serializeState(state);
      expect(result).toContain(`${URL_KEY_OPACITY_MODE}=3`);
      expect(result).toContain(`${URL_KEY_VOLUMETRIC_DENSITY}=1.50`);
      expect(result).toContain(`${URL_KEY_SAMPLE_QUALITY}=2`);
      expect(result).toContain(`${URL_KEY_VOLUMETRIC_ANIM_QUALITY}=1`);
    });

    it('should not serialize default mode-specific values', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'simpleAlpha',
        simpleAlphaOpacity: 0.7, // default value
      };

      const result = serializeState(state);
      expect(result).toContain(`${URL_KEY_OPACITY_MODE}=1`);
      expect(result).not.toContain(URL_KEY_SIMPLE_ALPHA); // default, not serialized
    });
  });

  describe('deserializeState', () => {
    it('should deserialize simpleAlpha mode', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=1&${URL_KEY_SIMPLE_ALPHA}=0.50`;
      const result = deserializeState(params);

      expect(result.opacityMode).toBe('simpleAlpha');
      expect(result.simpleAlphaOpacity).toBe(0.5);
    });

    it('should deserialize layeredSurfaces mode', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=2&${URL_KEY_LAYER_COUNT}=3&${URL_KEY_LAYER_OPACITY}=0.60`;
      const result = deserializeState(params);

      expect(result.opacityMode).toBe('layeredSurfaces');
      expect(result.layerCount).toBe(3);
      expect(result.layerOpacity).toBe(0.6);
    });

    it('should deserialize volumetricDensity mode', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=3&${URL_KEY_VOLUMETRIC_DENSITY}=1.50&${URL_KEY_SAMPLE_QUALITY}=2&${URL_KEY_VOLUMETRIC_ANIM_QUALITY}=1`;
      const result = deserializeState(params);

      expect(result.opacityMode).toBe('volumetricDensity');
      expect(result.volumetricDensity).toBe(1.5);
      expect(result.sampleQuality).toBe('high');
      expect(result.volumetricAnimationQuality).toBe('full');
    });

    it('should handle invalid opacity mode gracefully', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=99`;
      const result = deserializeState(params);

      // Invalid mode should not be set
      expect(result.opacityMode).toBeUndefined();
    });

    it('should validate simpleAlphaOpacity range', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=1&${URL_KEY_SIMPLE_ALPHA}=1.50`;
      const result = deserializeState(params);

      // Out of range value should not be set
      expect(result.simpleAlphaOpacity).toBeUndefined();
    });

    it('should validate layerCount values', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=2&${URL_KEY_LAYER_COUNT}=5`;
      const result = deserializeState(params);

      // Invalid layer count should not be set
      expect(result.layerCount).toBeUndefined();
    });

    it('should validate layerOpacity range', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=2&${URL_KEY_LAYER_OPACITY}=0.95`;
      const result = deserializeState(params);

      // Out of range value should not be set
      expect(result.layerOpacity).toBeUndefined();
    });

    it('should validate volumetricDensity range', () => {
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=3&${URL_KEY_VOLUMETRIC_DENSITY}=2.50`;
      const result = deserializeState(params);

      // Out of range value should not be set
      expect(result.volumetricDensity).toBeUndefined();
    });

    it('should handle missing mode-specific values', () => {
      // Mode set but no specific values
      const params = `d=4&t=mandelbrot&${URL_KEY_OPACITY_MODE}=1`;
      const result = deserializeState(params);

      expect(result.opacityMode).toBe('simpleAlpha');
      expect(result.simpleAlphaOpacity).toBeUndefined();
    });
  });

  describe('Round-trip serialization', () => {
    it('should preserve simpleAlpha settings through round-trip', () => {
      const original: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'simpleAlpha',
        simpleAlphaOpacity: 0.65,
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.opacityMode).toBe('simpleAlpha');
      expect(deserialized.simpleAlphaOpacity).toBe(0.65);
    });

    it('should preserve layeredSurfaces settings through round-trip', () => {
      const original: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'layeredSurfaces',
        layerCount: 3,
        layerOpacity: 0.45,
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.opacityMode).toBe('layeredSurfaces');
      expect(deserialized.layerCount).toBe(3);
      expect(deserialized.layerOpacity).toBe(0.45);
    });

    it('should preserve volumetricDensity settings through round-trip', () => {
      const original: ShareableState = {
        dimension: 4,
        objectType: 'mandelbrot',
        opacityMode: 'volumetricDensity',
        volumetricDensity: 1.3,
        sampleQuality: 'low',
        volumetricAnimationQuality: 'full',
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.opacityMode).toBe('volumetricDensity');
      expect(deserialized.volumetricDensity).toBe(1.3);
      expect(deserialized.sampleQuality).toBe('low');
      expect(deserialized.volumetricAnimationQuality).toBe('full');
    });
  });
});
