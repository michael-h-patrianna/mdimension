/**
 * Tests for DepthCaptureShader
 *
 * Tests the shader definition used to capture depth from scene
 * into a linear depth buffer for temporal reprojection.
 */

import { describe, it, expect } from 'vitest';
import { DepthCaptureShader, DepthCaptureUniforms } from '@/lib/shaders/postprocessing/DepthCaptureShader';

describe('DepthCaptureShader', () => {
  describe('structure', () => {
    it('should have a name property', () => {
      expect(DepthCaptureShader.name).toBe('DepthCaptureShader');
    });

    it('should have vertex shader', () => {
      expect(DepthCaptureShader.vertexShader).toBeDefined();
      expect(typeof DepthCaptureShader.vertexShader).toBe('string');
    });

    it('should have fragment shader', () => {
      expect(DepthCaptureShader.fragmentShader).toBeDefined();
      expect(typeof DepthCaptureShader.fragmentShader).toBe('string');
    });

    it('should have uniforms object', () => {
      expect(DepthCaptureShader.uniforms).toBeDefined();
      expect(typeof DepthCaptureShader.uniforms).toBe('object');
    });
  });

  describe('uniforms', () => {
    it('should have tDepth uniform', () => {
      const uniforms = DepthCaptureShader.uniforms as DepthCaptureUniforms;
      expect(uniforms.tDepth).toBeDefined();
      expect(uniforms.tDepth.value).toBeNull();
    });

    it('should have nearClip uniform with default value', () => {
      const uniforms = DepthCaptureShader.uniforms as DepthCaptureUniforms;
      expect(uniforms.nearClip).toBeDefined();
      expect(uniforms.nearClip.value).toBe(0.1);
    });

    it('should have farClip uniform with default value', () => {
      const uniforms = DepthCaptureShader.uniforms as DepthCaptureUniforms;
      expect(uniforms.farClip).toBeDefined();
      expect(uniforms.farClip.value).toBe(1000.0);
    });
  });

  describe('vertex shader', () => {
    it('should include UV passing', () => {
      expect(DepthCaptureShader.vertexShader).toContain('vUv = uv');
    });

    it('should include gl_Position calculation', () => {
      expect(DepthCaptureShader.vertexShader).toContain('gl_Position');
      expect(DepthCaptureShader.vertexShader).toContain('projectionMatrix');
      expect(DepthCaptureShader.vertexShader).toContain('modelViewMatrix');
    });
  });

  describe('fragment shader', () => {
    it('should include packing for depth conversion', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('#include <packing>');
    });

    it('should sample depth texture', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('texture2D(tDepth');
    });

    it('should use perspectiveDepthToViewZ for depth conversion', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('perspectiveDepthToViewZ');
    });

    it('should declare all uniform types', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('uniform sampler2D tDepth');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform float nearClip');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform float farClip');
    });

    it('should normalize depth output to [0,1] range', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('clamp');
      expect(DepthCaptureShader.fragmentShader).toContain('normalizedDepth');
    });

    it('should output to single channel', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('gl_FragColor');
      expect(DepthCaptureShader.fragmentShader).toContain('vec4(normalizedDepth');
    });
  });
});
