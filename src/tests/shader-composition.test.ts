
import { describe, it, expect } from 'vitest';
import { composeMandelbulbShader } from '../rendering/shaders/mandelbulb/compose';
import { ShaderConfig } from '../rendering/shaders/shared/types';

describe('Shader Composition - Toggle Functionality', () => {
  const baseConfig: ShaderConfig = {
    dimension: 3,
    shadows: true,
    temporal: true,
    ambientOcclusion: true,
    opacityMode: 'linear',
    overrides: []
  };

  it('should include Temporal Reprojection when enabled and not overridden', () => {
    const result = composeMandelbulbShader(baseConfig);
    
    // Check modules list (used for UI)
    expect(result.modules).toContain('Temporal Reprojection');
    
    // Check features list (used for debugging/info)
    expect(result.features).toContain('Temporal Reprojection');
    
    // Check GLSL content
    expect(result.glsl).toContain('#define USE_TEMPORAL');
  });

  it('should exclude Temporal Reprojection content when overridden', () => {
    const configWithOverride = {
      ...baseConfig,
      overrides: ['Temporal Reprojection']
    };

    const result = composeMandelbulbShader(configWithOverride);
    
    // Module should still be listed (so UI knows it exists)
    expect(result.modules).toContain('Temporal Reprojection');
    
    // Feature should NOT be listed (because it's disabled)
    expect(result.features).not.toContain('Temporal Reprojection');
    
    // GLSL should NOT have the define
    expect(result.glsl).not.toContain('#define USE_TEMPORAL');
  });

  it('should handle Shadows toggle correctly (regression check)', () => {
    const configWithOverride = {
      ...baseConfig,
      overrides: ['Shadows']
    };

    const result = composeMandelbulbShader(configWithOverride);
    expect(result.modules).toContain('Shadows');
    expect(result.features).not.toContain('Shadows');
    expect(result.glsl).not.toContain('#define USE_SHADOWS');
  });
});
