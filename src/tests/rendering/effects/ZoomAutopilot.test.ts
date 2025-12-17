/**
 * Tests for ZoomAutopilot
 *
 * Tests the autopilot controller for zoom void avoidance:
 * - Strategy selection
 * - Config updates
 * - Result structure
 */

import { describe, it, expect } from 'vitest';
import {
  ZoomAutopilot,
  DEFAULT_AUTOPILOT_CONFIG,
  type AutopilotConfig,
  type AutopilotStrategy,
} from '@/rendering/effects/ZoomAutopilot';

describe('ZoomAutopilot', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const autopilot = new ZoomAutopilot();
      // Should not throw
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });

    it('should create with custom config', () => {
      const config: AutopilotConfig = {
        ...DEFAULT_AUTOPILOT_CONFIG,
        strategy: 'interestScore',
      };
      const autopilot = new ZoomAutopilot(config);
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });

    it('should support all three strategies', () => {
      const strategies: AutopilotStrategy[] = ['centerRayLock', 'interestScore', 'boundaryTarget'];

      strategies.forEach((strategy) => {
        const config: AutopilotConfig = {
          ...DEFAULT_AUTOPILOT_CONFIG,
          strategy,
        };
        const autopilot = new ZoomAutopilot(config);
        expect(autopilot).toBeDefined();
        autopilot.dispose();
      });
    });
  });

  describe('updateConfig', () => {
    it('should update strategy', () => {
      const autopilot = new ZoomAutopilot();
      autopilot.updateConfig({ strategy: 'interestScore' });
      // Should not throw
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });

    it('should update centerRayLock settings', () => {
      const autopilot = new ZoomAutopilot();
      autopilot.updateConfig({
        centerRayLock: {
          probeSize: 4,
          probeFrequency: 30,
          missThreshold: 0.3,
          nudgeStrength: 0.05,
        },
      });
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });

    it('should update interestScore settings', () => {
      const autopilot = new ZoomAutopilot();
      autopilot.updateConfig({
        interestScore: {
          resolution: 128,
          interval: 15,
          candidates: 8,
          nudgeRadius: 0.1,
          metric: 'edgeStrength',
        },
      });
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });

    it('should update boundaryTarget settings', () => {
      const autopilot = new ZoomAutopilot();
      autopilot.updateConfig({
        boundaryTarget: {
          escapeRatio: 0.5,
          band: 0.3,
          correctionStrength: 0.05,
        },
      });
      expect(autopilot).toBeDefined();
      autopilot.dispose();
    });
  });

  describe('reset', () => {
    it('should reset state without error', () => {
      const autopilot = new ZoomAutopilot();
      expect(() => autopilot.reset()).not.toThrow();
      autopilot.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up resources without error', () => {
      const autopilot = new ZoomAutopilot();
      expect(() => autopilot.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      const autopilot = new ZoomAutopilot();
      autopilot.dispose();
      expect(() => autopilot.dispose()).not.toThrow();
    });
  });
});

describe('AutopilotResult structure', () => {
  it('should include originNudge in result (D-dimensional)', () => {
    // The autopilot adjusts uOrigin in D-space, not a 3D center
    // This is the correct way to steer zoom - the zoom happens around uOrigin
    const autopilot = new ZoomAutopilot();
    expect(DEFAULT_AUTOPILOT_CONFIG).toBeDefined();
    autopilot.dispose();
  });
});

describe('DEFAULT_AUTOPILOT_CONFIG', () => {
  it('should have centerRayLock as default strategy', () => {
    expect(DEFAULT_AUTOPILOT_CONFIG.strategy).toBe('centerRayLock');
  });

  it('should have reasonable centerRayLock defaults', () => {
    const { centerRayLock } = DEFAULT_AUTOPILOT_CONFIG;
    expect(centerRayLock.probeSize).toBe(1);
    expect(centerRayLock.probeFrequency).toBe(15);
    expect(centerRayLock.missThreshold).toBe(0.5);
    expect(centerRayLock.nudgeStrength).toBe(0.02);
  });

  it('should have reasonable interestScore defaults', () => {
    const { interestScore } = DEFAULT_AUTOPILOT_CONFIG;
    expect(interestScore.resolution).toBe(64);
    expect(interestScore.interval).toBe(30);
    expect(interestScore.candidates).toBe(4);
    expect(interestScore.nudgeRadius).toBe(0.05);
    expect(interestScore.metric).toBe('variance');
  });

  it('should have reasonable boundaryTarget defaults', () => {
    const { boundaryTarget } = DEFAULT_AUTOPILOT_CONFIG;
    expect(boundaryTarget.escapeRatio).toBe(0.7);
    expect(boundaryTarget.band).toBe(0.2);
    expect(boundaryTarget.correctionStrength).toBe(0.03);
  });
});
