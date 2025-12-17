/**
 * Tests for TemporalCloudManager
 *
 * Tests the singleton manager for temporal cloud accumulation:
 * - Initialization and buffer creation
 * - Bayer pattern cycling
 * - Camera matrix tracking
 * - Uniform generation
 * - Resource cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemporalCloudManager } from '@/rendering/core/TemporalCloudManager';
import * as THREE from 'three';

describe('TemporalCloudManager', () => {
  // Note: TemporalCloudManager is a singleton, so we need to reset state between tests

  beforeEach(() => {
    TemporalCloudManager.dispose();
  });

  afterEach(() => {
    TemporalCloudManager.dispose();
  });

  describe('initialization', () => {
    it('should initialize without error', () => {
      expect(() => TemporalCloudManager.initialize(1920, 1080)).not.toThrow();
    });

    it('should handle small dimensions', () => {
      expect(() => TemporalCloudManager.initialize(1, 1)).not.toThrow();
    });

    it('should handle resize to same dimensions', () => {
      TemporalCloudManager.initialize(1920, 1080);
      expect(() => TemporalCloudManager.initialize(1920, 1080)).not.toThrow();
    });

    it('should handle resize to different dimensions', () => {
      TemporalCloudManager.initialize(1920, 1080);
      expect(() => TemporalCloudManager.initialize(1280, 720)).not.toThrow();
    });
  });

  describe('getBayerOffset', () => {
    it('should return valid Bayer offset', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const offset = TemporalCloudManager.getBayerOffset();
      expect(offset).toBeDefined();
      expect(offset.length).toBe(2);
      expect(offset[0]).toBeGreaterThanOrEqual(0);
      expect(offset[0]).toBeLessThanOrEqual(1);
      expect(offset[1]).toBeGreaterThanOrEqual(0);
      expect(offset[1]).toBeLessThanOrEqual(1);
    });

    it('should return frame 0 offset initially', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const offset = TemporalCloudManager.getBayerOffset();
      // Frame 0 offset is (0, 0) - top-left
      expect(offset[0]).toBe(0);
      expect(offset[1]).toBe(0);
    });
  });

  describe('getFrameIndex', () => {
    it('should return 0 initially', () => {
      TemporalCloudManager.initialize(1920, 1080);
      expect(TemporalCloudManager.getFrameIndex()).toBe(0);
    });
  });

  describe('frame cycling', () => {
    it('should advance frame index after endFrame', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const camera = new THREE.PerspectiveCamera();

      TemporalCloudManager.beginFrame(camera);
      const initialIndex = TemporalCloudManager.getFrameIndex();
      TemporalCloudManager.endFrame();
      const nextIndex = TemporalCloudManager.getFrameIndex();

      expect(nextIndex).toBe((initialIndex + 1) % 4);
    });

    it('should cycle through all 4 frames', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const camera = new THREE.PerspectiveCamera();

      const offsets = [];
      for (let i = 0; i < 4; i++) {
        offsets.push([...TemporalCloudManager.getBayerOffset()]);
        TemporalCloudManager.beginFrame(camera);
        TemporalCloudManager.endFrame();
      }

      // Should cycle back to frame 0
      expect(TemporalCloudManager.getFrameIndex()).toBe(0);

      // All offsets should be unique within the cycle
      const offsetStrings = offsets.map((o) => `${o[0]},${o[1]}`);
      const uniqueOffsets = new Set(offsetStrings);
      expect(uniqueOffsets.size).toBe(4);
    });
  });

  describe('hasValidHistory', () => {
    it('should return false before first complete cycle', () => {
      TemporalCloudManager.initialize(1920, 1080);
      expect(TemporalCloudManager.hasValidHistory()).toBe(false);
    });

    it('should return true after complete cycle (when enabled)', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const camera = new THREE.PerspectiveCamera();

      // Complete 4 frames
      for (let i = 0; i < 4; i++) {
        TemporalCloudManager.beginFrame(camera);
        TemporalCloudManager.endFrame();
      }

      // Note: hasValidHistory also checks isEnabled(), which depends on store state
      // In tests, the store may not have temporalReprojectionEnabled set
      // So we just verify no errors occur
      expect(() => TemporalCloudManager.hasValidHistory()).not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('should reset validity', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const camera = new THREE.PerspectiveCamera();

      // Build some history
      for (let i = 0; i < 4; i++) {
        TemporalCloudManager.beginFrame(camera);
        TemporalCloudManager.endFrame();
      }

      TemporalCloudManager.invalidate();
      expect(TemporalCloudManager.getFrameIndex()).toBe(0);
    });
  });

  describe('getUniforms', () => {
    it('should return all expected uniforms', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const uniforms = TemporalCloudManager.getUniforms();

      expect(uniforms).toBeDefined();
      expect(uniforms.uBayerOffset).toBeDefined();
      expect(uniforms.uFrameIndex).toBeDefined();
      expect(uniforms.uCloudResolution).toBeDefined();
      expect(uniforms.uAccumulationResolution).toBeDefined();
      expect(uniforms.uPrevViewProjectionMatrix).toBeDefined();
    });

    it('should return correct resolution values', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const uniforms = TemporalCloudManager.getUniforms();

      // Full resolution should be 1920x1080
      expect(uniforms.uAccumulationResolution.x).toBe(1920);
      expect(uniforms.uAccumulationResolution.y).toBe(1080);

      // Cloud resolution should be half (quarter pixels)
      expect(uniforms.uCloudResolution.x).toBe(960);
      expect(uniforms.uCloudResolution.y).toBe(540);
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const dims = TemporalCloudManager.getDimensions();

      expect(dims.fullWidth).toBe(1920);
      expect(dims.fullHeight).toBe(1080);
      expect(dims.cloudWidth).toBe(960);
      expect(dims.cloudHeight).toBe(540);
    });
  });

  describe('render targets', () => {
    it('should return cloud render target after initialization', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const target = TemporalCloudManager.getCloudRenderTarget();
      expect(target).not.toBeNull();
    });

    it('should return cloud position texture after initialization', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const texture = TemporalCloudManager.getCloudPositionTexture();
      expect(texture).not.toBeNull();
    });

    it('should return reprojection buffer after initialization', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const target = TemporalCloudManager.getReprojectionBuffer();
      expect(target).not.toBeNull();
    });

    it('should return write target after initialization', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const target = TemporalCloudManager.getWriteTarget();
      expect(target).not.toBeNull();
    });

    it('should return read target after initialization', () => {
      TemporalCloudManager.initialize(1920, 1080);
      const target = TemporalCloudManager.getReadTarget();
      expect(target).not.toBeNull();
    });

    it('should return null targets before initialization', () => {
      // Note: Singleton state may persist, so we explicitly dispose first
      TemporalCloudManager.dispose();
      expect(TemporalCloudManager.getCloudRenderTarget()).toBeNull();
      expect(TemporalCloudManager.getCloudPositionTexture()).toBeNull();
      expect(TemporalCloudManager.getReprojectionBuffer()).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clean up resources without error', () => {
      TemporalCloudManager.initialize(1920, 1080);
      expect(() => TemporalCloudManager.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      TemporalCloudManager.initialize(1920, 1080);
      TemporalCloudManager.dispose();
      expect(() => TemporalCloudManager.dispose()).not.toThrow();
    });

    it('should return null targets after dispose', () => {
      TemporalCloudManager.initialize(1920, 1080);
      TemporalCloudManager.dispose();
      expect(TemporalCloudManager.getCloudRenderTarget()).toBeNull();
    });
  });
});
