/**
 * Tests for fogSlice
 *
 * Verifies state management for scene fog effect.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { DEFAULT_FOG_STATE } from '@/stores/slices/fogSlice';

describe('fogSlice', () => {
  beforeEach(() => {
    useEnvironmentStore.getState().resetFog();
  });

  describe('initial state', () => {
    it('should have fog disabled by default', () => {
      expect(useEnvironmentStore.getState().fogEnabled).toBe(false);
    });

    it('should have linear fog type by default', () => {
      expect(useEnvironmentStore.getState().fogType).toBe('linear');
    });

    it('should have default fog density', () => {
      expect(useEnvironmentStore.getState().fogDensity).toBe(DEFAULT_FOG_STATE.fogDensity);
    });

    it('should have default fog near/far distances', () => {
      expect(useEnvironmentStore.getState().fogNear).toBe(DEFAULT_FOG_STATE.fogNear);
      expect(useEnvironmentStore.getState().fogFar).toBe(DEFAULT_FOG_STATE.fogFar);
    });

    it('should have default fog color', () => {
      expect(useEnvironmentStore.getState().fogColor).toBe(DEFAULT_FOG_STATE.fogColor);
    });
  });

  describe('setFogEnabled', () => {
    it('should toggle fog enabled', () => {
      useEnvironmentStore.getState().setFogEnabled(true);
      expect(useEnvironmentStore.getState().fogEnabled).toBe(true);

      useEnvironmentStore.getState().setFogEnabled(false);
      expect(useEnvironmentStore.getState().fogEnabled).toBe(false);
    });
  });

  describe('setFogType', () => {
    it('should switch to volumetric fog', () => {
      useEnvironmentStore.getState().setFogType('volumetric');
      expect(useEnvironmentStore.getState().fogType).toBe('volumetric');
    });

    it('should switch back to linear fog', () => {
      useEnvironmentStore.getState().setFogType('volumetric');
      useEnvironmentStore.getState().setFogType('linear');
      expect(useEnvironmentStore.getState().fogType).toBe('linear');
    });
  });

  describe('setFogDensity', () => {
    it('should update fog density', () => {
      useEnvironmentStore.getState().setFogDensity(0.05);
      expect(useEnvironmentStore.getState().fogDensity).toBe(0.05);
    });

    it('should clamp density to valid range', () => {
      useEnvironmentStore.getState().setFogDensity(1);
      expect(useEnvironmentStore.getState().fogDensity).toBe(0.15);

      useEnvironmentStore.getState().setFogDensity(-1);
      expect(useEnvironmentStore.getState().fogDensity).toBe(0);
    });
  });

  describe('setFogNear/setFogFar', () => {
    it('should update fog near distance', () => {
      useEnvironmentStore.getState().setFogNear(5);
      expect(useEnvironmentStore.getState().fogNear).toBe(5);
    });

    it('should update fog far distance', () => {
      useEnvironmentStore.getState().setFogFar(100);
      expect(useEnvironmentStore.getState().fogFar).toBe(100);
    });

    it('should clamp fogNear to be less than fogFar', () => {
      // Default fogFar is 50, so fogNear should be clamped to 49
      useEnvironmentStore.getState().setFogNear(100);
      expect(useEnvironmentStore.getState().fogNear).toBe(49);
    });

    it('should clamp fogFar to be greater than fogNear', () => {
      // Set fogNear to 30, then try to set fogFar below it
      useEnvironmentStore.getState().setFogNear(30);
      useEnvironmentStore.getState().setFogFar(20);
      expect(useEnvironmentStore.getState().fogFar).toBe(31);
    });

    it('should maintain fogNear < fogFar relationship', () => {
      useEnvironmentStore.getState().setFogNear(40);
      useEnvironmentStore.getState().setFogFar(60);
      expect(useEnvironmentStore.getState().fogNear).toBeLessThan(
        useEnvironmentStore.getState().fogFar
      );
    });
  });

  describe('setFogColor', () => {
    it('should update fog color', () => {
      useEnvironmentStore.getState().setFogColor('#123456');
      expect(useEnvironmentStore.getState().fogColor).toBe('#123456');
    });

    it('should accept short hex format (#RGB)', () => {
      useEnvironmentStore.getState().setFogColor('#abc');
      expect(useEnvironmentStore.getState().fogColor).toBe('#abc');
    });

    it('should accept long hex format (#RRGGBB)', () => {
      useEnvironmentStore.getState().setFogColor('#aabbcc');
      expect(useEnvironmentStore.getState().fogColor).toBe('#aabbcc');
    });

    it('should accept hex with alpha (#RRGGBBAA)', () => {
      useEnvironmentStore.getState().setFogColor('#aabbccdd');
      expect(useEnvironmentStore.getState().fogColor).toBe('#aabbccdd');
    });

    it('should reject invalid color formats', () => {
      const originalColor = useEnvironmentStore.getState().fogColor;

      // Invalid format: no hash
      useEnvironmentStore.getState().setFogColor('123456');
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor);

      // Invalid format: wrong length
      useEnvironmentStore.getState().setFogColor('#12345');
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor);

      // Invalid format: non-hex characters
      useEnvironmentStore.getState().setFogColor('#gggggg');
      expect(useEnvironmentStore.getState().fogColor).toBe(originalColor);
    });
  });

  describe('resetFog', () => {
    it('should reset all fog settings to defaults', () => {
      useEnvironmentStore.getState().setFogEnabled(true);
      useEnvironmentStore.getState().setFogType('volumetric');
      useEnvironmentStore.getState().setFogDensity(0.1);
      useEnvironmentStore.getState().setFogNear(0);
      useEnvironmentStore.getState().setFogFar(200);
      useEnvironmentStore.getState().setFogColor('#ffffff');

      useEnvironmentStore.getState().resetFog();

      expect(useEnvironmentStore.getState().fogEnabled).toBe(DEFAULT_FOG_STATE.fogEnabled);
      expect(useEnvironmentStore.getState().fogType).toBe(DEFAULT_FOG_STATE.fogType);
      expect(useEnvironmentStore.getState().fogDensity).toBe(DEFAULT_FOG_STATE.fogDensity);
      expect(useEnvironmentStore.getState().fogNear).toBe(DEFAULT_FOG_STATE.fogNear);
      expect(useEnvironmentStore.getState().fogFar).toBe(DEFAULT_FOG_STATE.fogFar);
      expect(useEnvironmentStore.getState().fogColor).toBe(DEFAULT_FOG_STATE.fogColor);
    });
  });
});
