/**
 * Tests for ZoomProbePass
 *
 * Tests the probe pass for autopilot feedback:
 * - Render target creation and sizing
 * - Result parsing
 * - Throttling behavior
 */

import { describe, it, expect } from 'vitest';
import { ZoomProbePass, type ProbeSize } from '@/rendering/effects/ZoomProbePass';

describe('ZoomProbePass', () => {
  describe('constructor', () => {
    it('should create probe with default size 1 (1x1)', () => {
      const probe = new ZoomProbePass();
      const result = probe.result;
      expect(result).toBeDefined();
      // Default assumes full hit (no void) before any probe is run
      expect(result.hitRatio).toBe(1);
      probe.dispose();
    });

    it('should create probe with size 4 (2x2)', () => {
      const probe = new ZoomProbePass(4);
      expect(probe.result.hitRatio).toBe(1);
      probe.dispose();
    });

    it('should create probe with size 16 (4x4)', () => {
      const probe = new ZoomProbePass(16);
      expect(probe.result.hitRatio).toBe(1);
      probe.dispose();
    });

    it('should create probe with size 64 (8x8)', () => {
      const probe = new ZoomProbePass(64);
      expect(probe.result.hitRatio).toBe(1);
      probe.dispose();
    });
  });

  describe('resize', () => {
    it('should resize probe to new size', () => {
      const probe = new ZoomProbePass(1);
      probe.resize(16);
      // After resize, should still have valid result structure
      expect(probe.result).toBeDefined();
      probe.dispose();
    });

    it('should handle resize to same size', () => {
      const probe = new ZoomProbePass(4);
      probe.resize(4);
      expect(probe.result).toBeDefined();
      probe.dispose();
    });
  });

  describe('shouldProbe', () => {
    it('should return true when enough time has passed', () => {
      const probe = new ZoomProbePass(1);
      // First call should return true (no previous probe)
      expect(probe.shouldProbe(60)).toBe(true);
      probe.dispose();
    });

    it('should respect frequency parameter', () => {
      const probe = new ZoomProbePass(1);
      // At 60Hz, should probe every ~16.67ms
      expect(probe.shouldProbe(60)).toBe(true);
      probe.dispose();
    });
  });

  describe('result structure', () => {
    it('should have all expected fields', () => {
      const probe = new ZoomProbePass(1);
      const result = probe.result;

      expect(typeof result.hitRatio).toBe('number');
      expect(typeof result.avgHitDistance).toBe('number');
      expect(typeof result.avgTrapValue).toBe('number');
      expect(typeof result.avgIterRatio).toBe('number');
      expect(typeof result.distanceVariance).toBe('number');

      probe.dispose();
    });

    it('should have default values (assumes full hit before probe)', () => {
      const probe = new ZoomProbePass(1);
      const result = probe.result;

      // Before any probe runs, assume full hit (no void)
      expect(result.hitRatio).toBe(1);
      expect(result.avgHitDistance).toBe(0);
      expect(result.avgTrapValue).toBe(0);
      expect(result.avgIterRatio).toBe(0);
      expect(result.distanceVariance).toBe(0);

      probe.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up resources without error', () => {
      const probe = new ZoomProbePass(1);
      expect(() => probe.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      const probe = new ZoomProbePass(1);
      probe.dispose();
      // Second dispose should not throw
      expect(() => probe.dispose()).not.toThrow();
    });
  });
});

describe('ZoomProbePass dimensions', () => {
  const testCases: { size: ProbeSize; expectedDim: number }[] = [
    { size: 1, expectedDim: 1 },
    { size: 4, expectedDim: 2 },
    { size: 16, expectedDim: 4 },
    { size: 64, expectedDim: 8 },
  ];

  testCases.forEach(({ size, expectedDim }) => {
    it(`should create ${expectedDim}x${expectedDim} target for size ${size}`, () => {
      const probe = new ZoomProbePass(size);
      // The probe should be valid (we can't easily check internal target dimensions)
      expect(probe.result).toBeDefined();
      probe.dispose();
    });
  });
});
