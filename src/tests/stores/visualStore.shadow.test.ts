/**
 * Tests for Visual Store Shadow Actions
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SHADOW_ENABLED,
  DEFAULT_SHADOW_QUALITY,
  DEFAULT_SHADOW_SOFTNESS,
  DEFAULT_SHADOW_ANIMATION_MODE,
  SHADOW_SOFTNESS_RANGE,
} from '@/lib/shadows/constants';
import { useVisualStore } from '@/stores/visualStore';

describe('Visual Store - Shadow Actions', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVisualStore.getState().reset();
  });

  afterEach(() => {
    // Clean up after each test
    useVisualStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have default shadow enabled state', () => {
      const state = useVisualStore.getState();
      expect(state.shadowEnabled).toBe(DEFAULT_SHADOW_ENABLED);
    });

    it('should have default shadow quality', () => {
      const state = useVisualStore.getState();
      expect(state.shadowQuality).toBe(DEFAULT_SHADOW_QUALITY);
    });

    it('should have default shadow softness', () => {
      const state = useVisualStore.getState();
      expect(state.shadowSoftness).toBe(DEFAULT_SHADOW_SOFTNESS);
    });

    it('should have default shadow animation mode', () => {
      const state = useVisualStore.getState();
      expect(state.shadowAnimationMode).toBe(DEFAULT_SHADOW_ANIMATION_MODE);
    });
  });

  describe('setShadowEnabled', () => {
    it('should enable shadows', () => {
      useVisualStore.getState().setShadowEnabled(true);
      expect(useVisualStore.getState().shadowEnabled).toBe(true);
    });

    it('should disable shadows', () => {
      useVisualStore.getState().setShadowEnabled(true);
      useVisualStore.getState().setShadowEnabled(false);
      expect(useVisualStore.getState().shadowEnabled).toBe(false);
    });
  });

  describe('setShadowQuality', () => {
    it('should set shadow quality to low', () => {
      useVisualStore.getState().setShadowQuality('low');
      expect(useVisualStore.getState().shadowQuality).toBe('low');
    });

    it('should set shadow quality to medium', () => {
      useVisualStore.getState().setShadowQuality('medium');
      expect(useVisualStore.getState().shadowQuality).toBe('medium');
    });

    it('should set shadow quality to high', () => {
      useVisualStore.getState().setShadowQuality('high');
      expect(useVisualStore.getState().shadowQuality).toBe('high');
    });

    it('should set shadow quality to ultra', () => {
      useVisualStore.getState().setShadowQuality('ultra');
      expect(useVisualStore.getState().shadowQuality).toBe('ultra');
    });
  });

  describe('setShadowSoftness', () => {
    it('should set shadow softness value', () => {
      useVisualStore.getState().setShadowSoftness(1.5);
      expect(useVisualStore.getState().shadowSoftness).toBe(1.5);
    });

    it('should clamp value to minimum', () => {
      useVisualStore.getState().setShadowSoftness(-0.5);
      expect(useVisualStore.getState().shadowSoftness).toBe(SHADOW_SOFTNESS_RANGE.min);
    });

    it('should clamp value to maximum', () => {
      useVisualStore.getState().setShadowSoftness(3.0);
      expect(useVisualStore.getState().shadowSoftness).toBe(SHADOW_SOFTNESS_RANGE.max);
    });

    it('should accept edge values', () => {
      useVisualStore.getState().setShadowSoftness(SHADOW_SOFTNESS_RANGE.min);
      expect(useVisualStore.getState().shadowSoftness).toBe(SHADOW_SOFTNESS_RANGE.min);

      useVisualStore.getState().setShadowSoftness(SHADOW_SOFTNESS_RANGE.max);
      expect(useVisualStore.getState().shadowSoftness).toBe(SHADOW_SOFTNESS_RANGE.max);
    });
  });

  describe('setShadowAnimationMode', () => {
    it('should set animation mode to pause', () => {
      useVisualStore.getState().setShadowAnimationMode('pause');
      expect(useVisualStore.getState().shadowAnimationMode).toBe('pause');
    });

    it('should set animation mode to low', () => {
      useVisualStore.getState().setShadowAnimationMode('low');
      expect(useVisualStore.getState().shadowAnimationMode).toBe('low');
    });

    it('should set animation mode to full', () => {
      useVisualStore.getState().setShadowAnimationMode('full');
      expect(useVisualStore.getState().shadowAnimationMode).toBe('full');
    });
  });

  describe('reset', () => {
    it('should reset shadow settings to defaults', () => {
      // Set custom values
      useVisualStore.getState().setShadowEnabled(true);
      useVisualStore.getState().setShadowQuality('ultra');
      useVisualStore.getState().setShadowSoftness(1.8);
      useVisualStore.getState().setShadowAnimationMode('full');

      // Reset
      useVisualStore.getState().reset();

      // Verify defaults
      const state = useVisualStore.getState();
      expect(state.shadowEnabled).toBe(DEFAULT_SHADOW_ENABLED);
      expect(state.shadowQuality).toBe(DEFAULT_SHADOW_QUALITY);
      expect(state.shadowSoftness).toBe(DEFAULT_SHADOW_SOFTNESS);
      expect(state.shadowAnimationMode).toBe(DEFAULT_SHADOW_ANIMATION_MODE);
    });
  });
});
