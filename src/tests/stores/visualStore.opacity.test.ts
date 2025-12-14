/**
 * Tests for Visual Store Opacity Actions
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_OPACITY_SETTINGS } from '@/lib/opacity/constants';
import { useVisualStore } from '@/stores/visualStore';

describe('Visual Store - Opacity Actions', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVisualStore.getState().reset();
  });

  afterEach(() => {
    // Clean up after each test
    useVisualStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have default opacity settings', () => {
      const state = useVisualStore.getState();
      expect(state.opacitySettings).toEqual(DEFAULT_OPACITY_SETTINGS);
    });

    it('should have hasSeenVolumetricWarning set to false initially', () => {
      const state = useVisualStore.getState();
      expect(state.hasSeenVolumetricWarning).toBe(false);
    });
  });

  describe('setOpacityMode', () => {
    it('should set opacity mode to simpleAlpha', () => {
      useVisualStore.getState().setOpacityMode('simpleAlpha');
      expect(useVisualStore.getState().opacitySettings.mode).toBe('simpleAlpha');
    });

    it('should set opacity mode to layeredSurfaces', () => {
      useVisualStore.getState().setOpacityMode('layeredSurfaces');
      expect(useVisualStore.getState().opacitySettings.mode).toBe('layeredSurfaces');
    });

    it('should set opacity mode to volumetricDensity', () => {
      useVisualStore.getState().setOpacityMode('volumetricDensity');
      expect(useVisualStore.getState().opacitySettings.mode).toBe('volumetricDensity');
    });

    it('should preserve other settings when changing mode', () => {
      // Set custom values
      useVisualStore.getState().setSimpleAlphaOpacity(0.5);
      useVisualStore.getState().setLayerCount(3);

      // Change mode
      useVisualStore.getState().setOpacityMode('layeredSurfaces');

      // Verify other settings are preserved
      const settings = useVisualStore.getState().opacitySettings;
      expect(settings.mode).toBe('layeredSurfaces');
      expect(settings.simpleAlphaOpacity).toBe(0.5);
      expect(settings.layerCount).toBe(3);
    });
  });

  describe('setSimpleAlphaOpacity', () => {
    it('should set simple alpha opacity value', () => {
      useVisualStore.getState().setSimpleAlphaOpacity(0.5);
      expect(useVisualStore.getState().opacitySettings.simpleAlphaOpacity).toBe(0.5);
    });

    it('should clamp value to minimum (0)', () => {
      useVisualStore.getState().setSimpleAlphaOpacity(-0.5);
      expect(useVisualStore.getState().opacitySettings.simpleAlphaOpacity).toBe(0);
    });

    it('should clamp value to maximum (1)', () => {
      useVisualStore.getState().setSimpleAlphaOpacity(1.5);
      expect(useVisualStore.getState().opacitySettings.simpleAlphaOpacity).toBe(1);
    });
  });

  describe('setLayerCount', () => {
    it('should set layer count to 2', () => {
      useVisualStore.getState().setLayerCount(2);
      expect(useVisualStore.getState().opacitySettings.layerCount).toBe(2);
    });

    it('should set layer count to 3', () => {
      useVisualStore.getState().setLayerCount(3);
      expect(useVisualStore.getState().opacitySettings.layerCount).toBe(3);
    });

    it('should set layer count to 4', () => {
      useVisualStore.getState().setLayerCount(4);
      expect(useVisualStore.getState().opacitySettings.layerCount).toBe(4);
    });
  });

  describe('setLayerOpacity', () => {
    it('should set layer opacity value', () => {
      useVisualStore.getState().setLayerOpacity(0.6);
      expect(useVisualStore.getState().opacitySettings.layerOpacity).toBe(0.6);
    });

    it('should clamp value to minimum (0.1)', () => {
      useVisualStore.getState().setLayerOpacity(0.05);
      expect(useVisualStore.getState().opacitySettings.layerOpacity).toBe(0.1);
    });

    it('should clamp value to maximum (0.9)', () => {
      useVisualStore.getState().setLayerOpacity(0.95);
      expect(useVisualStore.getState().opacitySettings.layerOpacity).toBe(0.9);
    });
  });

  describe('setVolumetricDensity', () => {
    it('should set volumetric density value', () => {
      useVisualStore.getState().setVolumetricDensity(1.5);
      expect(useVisualStore.getState().opacitySettings.volumetricDensity).toBe(1.5);
    });

    it('should clamp value to minimum (0.1)', () => {
      useVisualStore.getState().setVolumetricDensity(0.05);
      expect(useVisualStore.getState().opacitySettings.volumetricDensity).toBe(0.1);
    });

    it('should clamp value to maximum (2.0)', () => {
      useVisualStore.getState().setVolumetricDensity(2.5);
      expect(useVisualStore.getState().opacitySettings.volumetricDensity).toBe(2.0);
    });
  });

  describe('setSampleQuality', () => {
    it('should set sample quality to low', () => {
      useVisualStore.getState().setSampleQuality('low');
      expect(useVisualStore.getState().opacitySettings.sampleQuality).toBe('low');
    });

    it('should set sample quality to medium', () => {
      useVisualStore.getState().setSampleQuality('medium');
      expect(useVisualStore.getState().opacitySettings.sampleQuality).toBe('medium');
    });

    it('should set sample quality to high', () => {
      useVisualStore.getState().setSampleQuality('high');
      expect(useVisualStore.getState().opacitySettings.sampleQuality).toBe('high');
    });
  });

  describe('setVolumetricAnimationQuality', () => {
    it('should set animation quality to reduce', () => {
      useVisualStore.getState().setVolumetricAnimationQuality('reduce');
      expect(useVisualStore.getState().opacitySettings.volumetricAnimationQuality).toBe('reduce');
    });

    it('should set animation quality to full', () => {
      useVisualStore.getState().setVolumetricAnimationQuality('full');
      expect(useVisualStore.getState().opacitySettings.volumetricAnimationQuality).toBe('full');
    });
  });

  describe('setHasSeenVolumetricWarning', () => {
    it('should set warning seen flag to true', () => {
      useVisualStore.getState().setHasSeenVolumetricWarning(true);
      expect(useVisualStore.getState().hasSeenVolumetricWarning).toBe(true);
    });

    it('should set warning seen flag to false', () => {
      useVisualStore.getState().setHasSeenVolumetricWarning(true);
      useVisualStore.getState().setHasSeenVolumetricWarning(false);
      expect(useVisualStore.getState().hasSeenVolumetricWarning).toBe(false);
    });
  });

  describe('setOpacitySettings', () => {
    it('should update multiple settings at once', () => {
      useVisualStore.getState().setOpacitySettings({
        mode: 'layeredSurfaces',
        layerCount: 4,
        layerOpacity: 0.7,
      });

      const settings = useVisualStore.getState().opacitySettings;
      expect(settings.mode).toBe('layeredSurfaces');
      expect(settings.layerCount).toBe(4);
      expect(settings.layerOpacity).toBe(0.7);
    });

    it('should clamp numeric values when updating multiple settings', () => {
      useVisualStore.getState().setOpacitySettings({
        simpleAlphaOpacity: 1.5,
        layerOpacity: 0.95,
        volumetricDensity: 2.5,
      });

      const settings = useVisualStore.getState().opacitySettings;
      expect(settings.simpleAlphaOpacity).toBe(1);
      expect(settings.layerOpacity).toBe(0.9);
      expect(settings.volumetricDensity).toBe(2.0);
    });

    it('should preserve unspecified settings', () => {
      // Set initial values
      useVisualStore.getState().setOpacitySettings({
        mode: 'volumetricDensity',
        volumetricDensity: 1.5,
      });

      // Update only mode
      useVisualStore.getState().setOpacitySettings({
        mode: 'simpleAlpha',
      });

      // Verify volumetricDensity is preserved
      const settings = useVisualStore.getState().opacitySettings;
      expect(settings.mode).toBe('simpleAlpha');
      expect(settings.volumetricDensity).toBe(1.5);
    });
  });

  describe('reset', () => {
    it('should reset opacity settings to defaults', () => {
      // Set custom values
      useVisualStore.getState().setOpacityMode('volumetricDensity');
      useVisualStore.getState().setVolumetricDensity(1.8);
      useVisualStore.getState().setSampleQuality('high');
      useVisualStore.getState().setHasSeenVolumetricWarning(true);

      // Reset
      useVisualStore.getState().reset();

      // Verify defaults
      const state = useVisualStore.getState();
      expect(state.opacitySettings).toEqual(DEFAULT_OPACITY_SETTINGS);
      expect(state.hasSeenVolumetricWarning).toBe(false);
    });
  });
});
