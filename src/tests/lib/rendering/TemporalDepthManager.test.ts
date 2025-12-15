/**
 * Tests for TemporalDepthManager
 *
 * Tests the temporal depth buffer management system used for
 * raymarching acceleration via depth reprojection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';

// Mock the performance store
vi.mock('@/stores', () => ({
  usePerformanceStore: {
    getState: vi.fn(() => ({
      temporalReprojectionEnabled: true,
    })),
  },
}));

// Mock the DepthCaptureShader
vi.mock('@/rendering/shaders/postprocessing/DepthCaptureShader', () => ({
  DepthCaptureShader: {
    name: 'DepthCaptureShader',
    vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    uniforms: {
      tDepth: { value: null },
      nearClip: { value: 0.1 },
      farClip: { value: 1000.0 },
    },
  },
}));

// Import after mocks are set up
import { TemporalDepthManager } from '@/rendering/core/TemporalDepthManager';
import { usePerformanceStore } from '@/stores';

describe('TemporalDepthManager', () => {
  let mockRenderer: THREE.WebGLRenderer;
  let mockCamera: THREE.PerspectiveCamera;

  beforeEach(() => {
    // Reset the manager state
    TemporalDepthManager.dispose();

    // Create mock renderer with minimal necessary methods
    mockRenderer = {
      getRenderTarget: vi.fn(() => null),
      setRenderTarget: vi.fn(),
      render: vi.fn(),
      autoClear: true,
    } as unknown as THREE.WebGLRenderer;

    // Create mock camera
    mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    mockCamera.updateMatrixWorld(true);
    mockCamera.updateProjectionMatrix();
  });

  afterEach(() => {
    TemporalDepthManager.dispose();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create render targets on initialize', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();
      // Initially should not be valid (no depth captured yet)
      expect(uniforms.uTemporalEnabled).toBe(false);
      expect(uniforms.uDepthBufferResolution.x).toBe(400); // 0.5 scale
      expect(uniforms.uDepthBufferResolution.y).toBe(300);
    });

    it('should apply resolution scale factor', () => {
      TemporalDepthManager.initialize(1920, 1080, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uDepthBufferResolution.x).toBe(960); // 1920 * 0.5
      expect(uniforms.uDepthBufferResolution.y).toBe(540); // 1080 * 0.5
    });

    it('should not reinitialize with same dimensions', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      // Should not throw and should maintain state
      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uDepthBufferResolution.x).toBe(400);
    });

    it('should resize render targets when dimensions change', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.initialize(1024, 768, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uDepthBufferResolution.x).toBe(512); // 1024 * 0.5
      expect(uniforms.uDepthBufferResolution.y).toBe(384); // 768 * 0.5
    });

    it('should ensure minimum dimension of 1', () => {
      TemporalDepthManager.initialize(0, 0, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uDepthBufferResolution.x).toBeGreaterThanOrEqual(1);
      expect(uniforms.uDepthBufferResolution.y).toBeGreaterThanOrEqual(1);
    });
  });

  describe('camera matrix updates', () => {
    it('should update camera matrices', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uNearClip).toBe(0.1);
      expect(uniforms.uFarClip).toBe(1000);
    });

    it('should store view-projection matrix', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);
      TemporalDepthManager.swap();

      const uniforms = TemporalDepthManager.getUniforms();
      // After swap, prevViewProjectionMatrix should be populated
      expect(uniforms.uPrevViewProjectionMatrix).toBeInstanceOf(THREE.Matrix4);
    });
  });

  describe('ping-pong buffer system', () => {
    it('should swap buffers correctly', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);
      TemporalDepthManager.swap();

      // After first swap, should be valid
      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uTemporalEnabled).toBe(true);
    });

    it('should provide depth texture after swap', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);
      TemporalDepthManager.swap();

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uPrevDepthTexture).not.toBeNull();
    });
  });

  describe('invalidation', () => {
    it('should invalidate temporal data', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);
      TemporalDepthManager.swap();

      // Should be valid now
      expect(TemporalDepthManager.getUniforms().uTemporalEnabled).toBe(true);

      // Invalidate
      TemporalDepthManager.invalidate();

      // Should be invalid
      expect(TemporalDepthManager.getUniforms().uTemporalEnabled).toBe(false);
    });
  });

  describe('enabled state', () => {
    it('should check store for enabled state', () => {
      const enabled = TemporalDepthManager.isEnabled();
      expect(enabled).toBe(true);
      expect(usePerformanceStore.getState).toHaveBeenCalled();
    });

    it('should return false when disabled in store', () => {
      vi.mocked(usePerformanceStore.getState).mockReturnValue({
        temporalReprojectionEnabled: false,
      } as ReturnType<typeof usePerformanceStore.getState>);

      const enabled = TemporalDepthManager.isEnabled();
      expect(enabled).toBe(false);
    });

    it('should not provide texture when disabled', () => {
      vi.mocked(usePerformanceStore.getState).mockReturnValue({
        temporalReprojectionEnabled: false,
      } as ReturnType<typeof usePerformanceStore.getState>);

      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.updateCameraMatrices(mockCamera);
      TemporalDepthManager.swap();

      const uniforms = TemporalDepthManager.getUniforms();
      // Should be disabled because store says so
      expect(uniforms.uTemporalEnabled).toBe(false);
    });
  });

  describe('uniforms interface', () => {
    it('should return all required uniforms', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();

      expect(uniforms).toHaveProperty('uPrevDepthTexture');
      expect(uniforms).toHaveProperty('uPrevViewProjectionMatrix');
      expect(uniforms).toHaveProperty('uPrevInverseViewProjectionMatrix');
      expect(uniforms).toHaveProperty('uTemporalEnabled');
      expect(uniforms).toHaveProperty('uDepthBufferResolution');
      expect(uniforms).toHaveProperty('uNearClip');
      expect(uniforms).toHaveProperty('uFarClip');
    });

    it('should return proper types for uniforms', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();

      expect(uniforms.uPrevViewProjectionMatrix).toBeInstanceOf(THREE.Matrix4);
      expect(uniforms.uPrevInverseViewProjectionMatrix).toBeInstanceOf(THREE.Matrix4);
      expect(uniforms.uDepthBufferResolution).toBeInstanceOf(THREE.Vector2);
      expect(typeof uniforms.uTemporalEnabled).toBe('boolean');
      expect(typeof uniforms.uNearClip).toBe('number');
      expect(typeof uniforms.uFarClip).toBe('number');
    });
  });

  describe('depth capture', () => {
    it('should not capture when disabled', () => {
      vi.mocked(usePerformanceStore.getState).mockReturnValue({
        temporalReprojectionEnabled: false,
      } as ReturnType<typeof usePerformanceStore.getState>);

      const mockDepthTexture = {} as THREE.DepthTexture;

      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.captureDepth(mockRenderer, mockDepthTexture);

      // Should not render when disabled
      expect(mockRenderer.render).not.toHaveBeenCalled();
    });

    it('should capture depth when enabled', () => {
      vi.mocked(usePerformanceStore.getState).mockReturnValue({
        temporalReprojectionEnabled: true,
      } as ReturnType<typeof usePerformanceStore.getState>);

      const mockDepthTexture = {} as THREE.DepthTexture;

      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.captureDepth(mockRenderer, mockDepthTexture);

      expect(mockRenderer.setRenderTarget).toHaveBeenCalled();
      expect(mockRenderer.render).toHaveBeenCalled();
    });

    it('should restore render target after capture', () => {
      vi.mocked(usePerformanceStore.getState).mockReturnValue({
        temporalReprojectionEnabled: true,
      } as ReturnType<typeof usePerformanceStore.getState>);

      const mockDepthTexture = {} as THREE.DepthTexture;
      const originalTarget = {} as THREE.WebGLRenderTarget;
      (mockRenderer.getRenderTarget as ReturnType<typeof vi.fn>).mockReturnValue(originalTarget);

      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.captureDepth(mockRenderer, mockDepthTexture);

      // Should restore the original render target
      const setRenderTargetCalls = (mockRenderer.setRenderTarget as ReturnType<typeof vi.fn>).mock
        .calls;
      const lastCall = setRenderTargetCalls[setRenderTargetCalls.length - 1];
      expect(lastCall?.[0]).toBe(originalTarget);
    });
  });

  describe('dispose', () => {
    it('should clean up resources on dispose', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.dispose();

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uPrevDepthTexture).toBeNull();
      expect(uniforms.uTemporalEnabled).toBe(false);
    });

    it('should be safe to dispose multiple times', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.dispose();
      TemporalDepthManager.dispose();
      // Should not throw
    });

    it('should allow re-initialization after dispose', () => {
      TemporalDepthManager.initialize(800, 600, mockRenderer);
      TemporalDepthManager.dispose();
      TemporalDepthManager.initialize(1024, 768, mockRenderer);

      const uniforms = TemporalDepthManager.getUniforms();
      expect(uniforms.uDepthBufferResolution.x).toBe(512);
    });
  });
});
