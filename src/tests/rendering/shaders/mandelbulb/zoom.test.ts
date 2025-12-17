/**
 * Tests for Mandelbulb Zoom Shader Modules
 *
 * Tests zoom shader blocks:
 * - Uniform declarations
 * - Zoom position mapping
 * - Distance estimate scaling
 */

import { describe, it, expect } from 'vitest';
import { zoomUniformsBlock } from '@/rendering/shaders/mandelbulb/zoom/uniforms.glsl';
import { zoomMappingBlock } from '@/rendering/shaders/mandelbulb/zoom/mapping.glsl';
import { zoomDeScalingBlock } from '@/rendering/shaders/mandelbulb/zoom/de-scaling.glsl';

describe('Zoom Uniforms Block', () => {
  it('should declare uZoomEnabled uniform', () => {
    expect(zoomUniformsBlock).toContain('uniform bool uZoomEnabled');
  });

  it('should declare uZoom uniform', () => {
    expect(zoomUniformsBlock).toContain('uniform float uZoom');
  });

  it('should be valid GLSL', () => {
    // Basic syntax check: should have valid uniform declarations
    expect(zoomUniformsBlock).toMatch(/uniform\s+(bool|float)\s+\w+/);
  });
});

describe('Zoom Mapping Block', () => {
  it('should define applyZoomToPosition function', () => {
    expect(zoomMappingBlock).toContain('vec3 applyZoomToPosition');
  });

  it('should check uZoomEnabled', () => {
    expect(zoomMappingBlock).toContain('uZoomEnabled');
  });

  it('should divide position by uZoom', () => {
    // Correct formula: pos / uZoom (zooms around uOrigin in D-space)
    expect(zoomMappingBlock).toContain('pos / uZoom');
  });

  it('should handle zoom <= 0 edge case', () => {
    expect(zoomMappingBlock).toContain('uZoom <= 0.0');
  });

  it('should return vec3 type', () => {
    expect(zoomMappingBlock).toMatch(/vec3\s+applyZoomToPosition/);
  });
});

describe('Zoom DE Scaling Block', () => {
  it('should define scaleDistanceForZoom function', () => {
    expect(zoomDeScalingBlock).toContain('float scaleDistanceForZoom');
  });

  it('should check uZoomEnabled', () => {
    expect(zoomDeScalingBlock).toContain('uZoomEnabled');
  });

  it('should multiply distance by uZoom', () => {
    expect(zoomDeScalingBlock).toContain('d * uZoom');
  });

  it('should handle zoom <= 0 edge case', () => {
    expect(zoomDeScalingBlock).toContain('uZoom <= 0.0');
  });

  it('should return float type', () => {
    expect(zoomDeScalingBlock).toMatch(/float\s+scaleDistanceForZoom/);
  });
});

describe('Zoom Module Integration', () => {
  it('should all be non-empty strings', () => {
    expect(zoomUniformsBlock.length).toBeGreaterThan(0);
    expect(zoomMappingBlock.length).toBeGreaterThan(0);
    expect(zoomDeScalingBlock.length).toBeGreaterThan(0);
  });

  it('should not contain syntax errors', () => {
    // Check for balanced braces in function blocks
    const countChar = (str: string, char: string) => (str.match(new RegExp(`\\${char}`, 'g')) || []).length;

    // Mapping block
    expect(countChar(zoomMappingBlock, '{')).toBe(countChar(zoomMappingBlock, '}'));

    // DE Scaling block
    expect(countChar(zoomDeScalingBlock, '{')).toBe(countChar(zoomDeScalingBlock, '}'));
  });

  it('should use consistent naming convention', () => {
    // All zoom-related uniforms should start with uZoom
    expect(zoomUniformsBlock).not.toContain('uniform bool zoom');
    expect(zoomUniformsBlock).not.toContain('uniform float zoom');
  });
});

describe('Zoom Math Correctness', () => {
  it('mapping should return unchanged position when zoom disabled', () => {
    // The GLSL checks: if (!uZoomEnabled || uZoom <= 0.0) return pos;
    expect(zoomMappingBlock).toContain('return pos');
  });

  it('scaling should return unchanged distance when zoom disabled', () => {
    // The GLSL checks: if (!uZoomEnabled || uZoom <= 0.0) return d;
    expect(zoomDeScalingBlock).toContain('return d');
  });

  it('mapping divides by zoom (zooming in = smaller basis)', () => {
    // pos / uZoom means: c = uOrigin + (pos * basis) / zoom
    // - higher zoom = smaller positions = smaller region of fractal space
    // - zooms around uOrigin in D-dimensional fractal space
    expect(zoomMappingBlock).toContain('pos / uZoom');
  });

  it('scaling multiplies by zoom (preserves raymarching)', () => {
    // d * uZoom compensates for the smaller position space
    expect(zoomDeScalingBlock).toContain('d * uZoom');
  });
});
