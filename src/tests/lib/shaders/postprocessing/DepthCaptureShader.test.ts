/**
 * Tests for DepthCaptureShader
 *
 * Tests the shader definition used to capture depth from scene
 * into a ray distance buffer for temporal reprojection.
 *
 * Key design decisions:
 * - Stores RAY DISTANCE, not view-space Z (viewZ ≠ rayDistance for off-center pixels)
 * - Stores UNNORMALIZED values (FloatType allows real distances, better precision)
 * - Uses CONSERVATIVE MIN sampling when downsampling to prevent overshooting
 */

import { describe, it, expect } from 'vitest';
import {
  DepthCaptureShader,
  DepthCaptureUniforms,
} from '@/rendering/shaders/postprocessing/DepthCaptureShader';

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

    it('should have sourceResolution uniform for conservative sampling', () => {
      const uniforms = DepthCaptureShader.uniforms as DepthCaptureUniforms;
      expect(uniforms.sourceResolution).toBeDefined();
      expect(uniforms.sourceResolution.value).toBeDefined();
    });

    it('should have inverseProjectionMatrix uniform for viewZ to rayDistance conversion', () => {
      const uniforms = DepthCaptureShader.uniforms as DepthCaptureUniforms;
      expect(uniforms.inverseProjectionMatrix).toBeDefined();
      expect(uniforms.inverseProjectionMatrix.value).toBeDefined();
    });
  });

  describe('vertex shader', () => {
    it('should use WebGL2/GLSL3 via glslVersion property', () => {
      // With Three.js integration, #version directive is handled by glslVersion property
      expect(DepthCaptureShader.glslVersion).toBeDefined();
      expect(DepthCaptureShader.vertexShader).toContain('out vec2 vUv');
    });

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
    it('should use WebGL2/GLSL3 syntax', () => {
      // #version directive is handled by glslVersion property, not embedded in shader
      // Three.js auto-injects pc_fragColor output for GLSL3 shaders
      expect(DepthCaptureShader.glslVersion).toBeDefined();
      expect(DepthCaptureShader.fragmentShader).toContain('precision highp float');
      expect(DepthCaptureShader.fragmentShader).toContain('in vec2 vUv');
    });

    it('should include packing for depth conversion', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('#include <packing>');
    });

    it('should sample depth texture using WebGL2 texture function', () => {
      // Should use texture() not texture2D() for WebGL2
      expect(DepthCaptureShader.fragmentShader).toContain('texture(tDepth');
      expect(DepthCaptureShader.fragmentShader).not.toContain('texture2D');
    });

    it('should use perspectiveDepthToViewZ for depth conversion', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('perspectiveDepthToViewZ');
    });

    it('should declare all uniform types', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('uniform sampler2D tDepth');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform float nearClip');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform float farClip');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform vec2 sourceResolution');
      expect(DepthCaptureShader.fragmentShader).toContain('uniform mat4 inverseProjectionMatrix');
    });

    it('should output unnormalized ray distance using layout output', () => {
      // Should use pc_fragColor (Three.js auto-injected output for GLSL3) not gl_FragColor
      // Should output rayDistance (unnormalized), not normalizedDepth
      expect(DepthCaptureShader.fragmentShader).toContain('pc_fragColor = vec4(rayDistance');
      expect(DepthCaptureShader.fragmentShader).not.toContain('gl_FragColor');
    });
  });

  describe('viewZ to rayDistance conversion', () => {
    it('should calculate ray direction cosine from inverse projection matrix', () => {
      const frag = DepthCaptureShader.fragmentShader;
      expect(frag).toContain('getRayCosAngle');
      expect(frag).toContain('inverseProjectionMatrix');
    });

    it('should convert view-space Z to ray distance', () => {
      const frag = DepthCaptureShader.fragmentShader;
      // rayDistance = viewZ / cos(angle)
      expect(frag).toContain('viewZ / max(cosAngle');
    });

    it('should handle division by near-zero cosine safely', () => {
      const frag = DepthCaptureShader.fragmentShader;
      // Should clamp cosAngle to avoid division by zero
      expect(frag).toContain('max(cosAngle, 0.001)');
    });
  });

  describe('conservative MIN sampling', () => {
    it('should sample 2x2 grid for conservative downsampling', () => {
      const frag = DepthCaptureShader.fragmentShader;
      // Should have 4 depth samples (d00, d01, d10, d11)
      expect(frag).toContain('float d00 =');
      expect(frag).toContain('float d01 =');
      expect(frag).toContain('float d10 =');
      expect(frag).toContain('float d11 =');
    });

    it('should calculate texel size from source resolution', () => {
      expect(DepthCaptureShader.fragmentShader).toContain('texelSize = 1.0 / sourceResolution');
    });

    it('should use offset sampling around center point', () => {
      const frag = DepthCaptureShader.fragmentShader;
      // Should sample at +/- half texel offsets
      expect(frag).toContain('halfTexel');
      expect(frag).toContain('-halfTexel.x');
      expect(frag).toContain('halfTexel.y');
    });

    it('should take MINIMUM of all samples for conservative result', () => {
      const frag = DepthCaptureShader.fragmentShader;
      // Should use nested min() calls
      expect(frag).toContain('min(min(d00, d01), min(d10, d11))');
    });
  });
});
