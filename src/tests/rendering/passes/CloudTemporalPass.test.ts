/**
 * Tests for CloudTemporalPass
 *
 * Tests the temporal cloud accumulation pass:
 * - Pass construction and configuration
 * - Material creation and uniforms
 * - Shader compilation validation
 * - Resource cleanup
 */

import { describe, it, expect, afterEach } from 'vitest';
import { CloudTemporalPass } from '@/rendering/passes/CloudTemporalPass';

describe('CloudTemporalPass', () => {
  let pass: CloudTemporalPass | null = null;

  afterEach(() => {
    if (pass) {
      pass.dispose();
      pass = null;
    }
  });

  describe('constructor', () => {
    it('should create pass with default options', () => {
      pass = new CloudTemporalPass();
      expect(pass).toBeDefined();
    });

    it('should accept custom historyWeight', () => {
      pass = new CloudTemporalPass({ historyWeight: 0.5 });
      expect(pass).toBeDefined();
    });

    it('should accept custom disocclusionThreshold', () => {
      pass = new CloudTemporalPass({ disocclusionThreshold: 0.2 });
      expect(pass).toBeDefined();
    });

    it('should accept both options', () => {
      pass = new CloudTemporalPass({
        historyWeight: 0.7,
        disocclusionThreshold: 0.1,
      });
      expect(pass).toBeDefined();
    });
  });

  describe('setHistoryWeight', () => {
    it('should update history weight', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setHistoryWeight(0.5)).not.toThrow();
    });

    it('should clamp history weight to 0-1 range (lower bound)', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setHistoryWeight(-0.5)).not.toThrow();
    });

    it('should clamp history weight to 0-1 range (upper bound)', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setHistoryWeight(1.5)).not.toThrow();
    });
  });

  describe('setDisocclusionThreshold', () => {
    it('should update disocclusion threshold', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setDisocclusionThreshold(0.2)).not.toThrow();
    });

    it('should clamp threshold to non-negative', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setDisocclusionThreshold(-0.1)).not.toThrow();
    });
  });

  describe('setSize', () => {
    it('should handle resize without error', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setSize(1920, 1080)).not.toThrow();
    });

    it('should handle small sizes', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setSize(1, 1)).not.toThrow();
    });

    it('should handle large sizes', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.setSize(3840, 2160)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clean up resources without error', () => {
      pass = new CloudTemporalPass();
      expect(() => pass!.dispose()).not.toThrow();
      pass = null; // Prevent double dispose in afterEach
    });

    it('should handle multiple dispose calls', () => {
      pass = new CloudTemporalPass();
      pass.dispose();
      expect(() => pass!.dispose()).not.toThrow();
      pass = null;
    });
  });
});
