/**
 * Tests for Visual Store Opacity Actions
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '@/stores/uiStore';
import { DEFAULT_OPACITY_SETTINGS } from '@/stores/defaults/visualDefaults';
import { UI_INITIAL_STATE } from '@/stores/slices/uiSlice';

describe('uiStore.opacity', () => {
  beforeEach(() => {
    useUIStore.setState(UI_INITIAL_STATE);
  });

  afterEach(() => {
    useUIStore.setState(UI_INITIAL_STATE);
  });

  describe('Initial State', () => {
    it('should have default opacity settings', () => {
      const state = useUIStore.getState();
      expect(state.opacitySettings).toEqual(DEFAULT_OPACITY_SETTINGS);
    });

    it('should have hasSeenVolumetricWarning set to false initially', () => {
      const state = useUIStore.getState();
      expect(state.hasSeenVolumetricWarning).toBe(false);
    });
  });

  describe('setOpacityMode', () => {
    it('should set opacity mode to simpleAlpha', () => {
      useUIStore.getState().setOpacityMode('simpleAlpha');
      expect(useUIStore.getState().opacitySettings.mode).toBe('simpleAlpha');
    });

    it('should set opacity mode to layeredSurfaces', () => {
      useUIStore.getState().setOpacityMode('layeredSurfaces');
      expect(useUIStore.getState().opacitySettings.mode).toBe('layeredSurfaces');
    });

    it('should set opacity mode to volumetricDensity', () => {
      useUIStore.getState().setOpacityMode('volumetricDensity');
      expect(useUIStore.getState().opacitySettings.mode).toBe('volumetricDensity');
    });

    it('should preserve other settings when changing mode', () => {
      // Set custom values
      useUIStore.getState().setSimpleAlphaOpacity(0.5);
      useUIStore.getState().setLayerCount(3);

      // Change mode
      useUIStore.getState().setOpacityMode('layeredSurfaces');

      // Verify other settings are preserved
      const settings = useUIStore.getState().opacitySettings;
      expect(settings.mode).toBe('layeredSurfaces');
      expect(settings.simpleAlphaOpacity).toBe(0.5);
      expect(settings.layerCount).toBe(3);
    });
  });

  describe('setSimpleAlphaOpacity', () => {
    it('should set simple alpha opacity value', () => {
      useUIStore.getState().setSimpleAlphaOpacity(0.5);
      expect(useUIStore.getState().opacitySettings.simpleAlphaOpacity).toBe(0.5);
    });

    it('should clamp value to minimum (0)', () => {
      useUIStore.getState().setSimpleAlphaOpacity(-0.5);
      expect(useUIStore.getState().opacitySettings.simpleAlphaOpacity).toBe(0);
    });

    it('should clamp value to maximum (1)', () => {
      useUIStore.getState().setSimpleAlphaOpacity(1.5);
      expect(useUIStore.getState().opacitySettings.simpleAlphaOpacity).toBe(1);
    });
  });

  describe('setLayerCount', () => {
    it('should set layer count to 2', () => {
      useUIStore.getState().setLayerCount(2);
      expect(useUIStore.getState().opacitySettings.layerCount).toBe(2);
    });

    it('should set layer count to 3', () => {
      useUIStore.getState().setLayerCount(3);
      expect(useUIStore.getState().opacitySettings.layerCount).toBe(3);
    });

    it('should set layer count to 4', () => {
      useUIStore.getState().setLayerCount(4);
      expect(useUIStore.getState().opacitySettings.layerCount).toBe(4);
    });
  });

  describe('setLayerOpacity', () => {
    it('should set layer opacity value', () => {
      useUIStore.getState().setLayerOpacity(0.6);
      expect(useUIStore.getState().opacitySettings.layerOpacity).toBe(0.6);
    });

    it('should clamp value to minimum (0.1)', () => {
      useUIStore.getState().setLayerOpacity(0.05);
      expect(useUIStore.getState().opacitySettings.layerOpacity).toBe(0.1);
    });

    it('should clamp value to maximum (0.9)', () => {
      useUIStore.getState().setLayerOpacity(0.95);
      expect(useUIStore.getState().opacitySettings.layerOpacity).toBe(0.9);
    });
  });

  describe('setVolumetricDensity', () => {
    it('should set volumetric density value', () => {
      useUIStore.getState().setVolumetricDensity(1.5);
      expect(useUIStore.getState().opacitySettings.volumetricDensity).toBe(1.5);
    });

    it('should clamp value to minimum (0.1)', () => {
      useUIStore.getState().setVolumetricDensity(0.05);
      expect(useUIStore.getState().opacitySettings.volumetricDensity).toBe(0.1);
    });

    it('should clamp value to maximum (2.0)', () => {
      useUIStore.getState().setVolumetricDensity(2.5);
      expect(useUIStore.getState().opacitySettings.volumetricDensity).toBe(2.0);
    });
  });

  describe('setSampleQuality', () => {
    it('should set sample quality to low', () => {
      useUIStore.getState().setSampleQuality('low');
      expect(useUIStore.getState().opacitySettings.sampleQuality).toBe('low');
    });

    it('should set sample quality to medium', () => {
      useUIStore.getState().setSampleQuality('medium');
      expect(useUIStore.getState().opacitySettings.sampleQuality).toBe('medium');
    });

    it('should set sample quality to high', () => {
      useUIStore.getState().setSampleQuality('high');
      expect(useUIStore.getState().opacitySettings.sampleQuality).toBe('high');
    });
  });

  describe('setVolumetricAnimationQuality', () => {
    it('should set animation quality to reduce', () => {
      useUIStore.getState().setVolumetricAnimationQuality('reduce');
      expect(useUIStore.getState().opacitySettings.volumetricAnimationQuality).toBe('reduce');
    });

    it('should set animation quality to full', () => {
      useUIStore.getState().setVolumetricAnimationQuality('full');
      expect(useUIStore.getState().opacitySettings.volumetricAnimationQuality).toBe('full');
    });
  });

  describe('setHasSeenVolumetricWarning', () => {
    it('should set warning seen flag to true', () => {
      useUIStore.getState().setHasSeenVolumetricWarning(true);
      expect(useUIStore.getState().hasSeenVolumetricWarning).toBe(true);
    });

    it('should set warning seen flag to false', () => {
      useUIStore.getState().setHasSeenVolumetricWarning(true);
      useUIStore.getState().setHasSeenVolumetricWarning(false);
      expect(useUIStore.getState().hasSeenVolumetricWarning).toBe(false);
    });
  });

  describe('setOpacitySettings', () => {
    it('should update multiple settings at once', () => {
      useUIStore.getState().setOpacitySettings({
        mode: 'layeredSurfaces',
        layerCount: 4,
        layerOpacity: 0.7,
      });

      const settings = useUIStore.getState().opacitySettings;
      expect(settings.mode).toBe('layeredSurfaces');
      expect(settings.layerCount).toBe(4);
      expect(settings.layerOpacity).toBe(0.7);
    });

    it('should clamp numeric values when updating multiple settings', () => {
      useUIStore.getState().setOpacitySettings({
        simpleAlphaOpacity: 1.5,
        layerOpacity: 0.95,
        volumetricDensity: 2.5,
      });

      const settings = useUIStore.getState().opacitySettings;
      expect(settings.simpleAlphaOpacity).toBe(1);
      expect(settings.layerOpacity).toBe(0.9);
      expect(settings.volumetricDensity).toBe(2.0);
    });

    it('should preserve unspecified settings', () => {
      // Set initial values
      useUIStore.getState().setOpacitySettings({
        mode: 'volumetricDensity',
        volumetricDensity: 1.5,
      });

      // Update only mode
      useUIStore.getState().setOpacitySettings({
        mode: 'simpleAlpha',
      });

      // Verify volumetricDensity is preserved
      const settings = useUIStore.getState().opacitySettings;
      expect(settings.mode).toBe('simpleAlpha');
      expect(settings.volumetricDensity).toBe(1.5);
    });
  });

  describe('reset', () => {
    it('should reset opacity settings to defaults', () => {
      // Set custom values
      useUIStore.getState().setOpacityMode('volumetricDensity');
      useUIStore.getState().setVolumetricDensity(1.8);
      useUIStore.getState().setSampleQuality('high');
      useUIStore.getState().setHasSeenVolumetricWarning(true);

      // Reset
      useUIStore.setState(UI_INITIAL_STATE);

      // Verify defaults
      const state = useUIStore.getState();
      expect(state.opacitySettings).toEqual(DEFAULT_OPACITY_SETTINGS);
      expect(state.hasSeenVolumetricWarning).toBe(false);
    });
  });
});
