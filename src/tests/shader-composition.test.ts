
import { describe, it, expect } from 'vitest';
import { composeMandelbulbShader } from '../rendering/shaders/mandelbulb/compose';
import { composeSchroedingerShader } from '../rendering/shaders/schroedinger/compose';
import { ShaderConfig } from '../rendering/shaders/shared/types';

describe('Shader Composition - Toggle Functionality', () => {
  const baseConfig: ShaderConfig = {
    dimension: 3,
    shadows: true,
    temporal: true,
    ambientOcclusion: true,
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

describe('Schrödinger Shader Composition - Dimension-Specific Optimization', () => {
  it('should only include the needed dimension block for hydrogenND mode', () => {
    const result = composeSchroedingerShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      quantumMode: 'hydrogenND',
      overrides: [],
    });

    // Should include the 4D block
    expect(result.modules).toContain('Hydrogen ND 4D');

    // Should NOT include other dimension blocks
    expect(result.modules).not.toContain('Hydrogen ND 3D');
    expect(result.modules).not.toContain('Hydrogen ND 5D');
    expect(result.modules).not.toContain('Hydrogen ND 6D');
    expect(result.modules).not.toContain('Hydrogen ND 7D');
    expect(result.modules).not.toContain('Hydrogen ND 8D');
    expect(result.modules).not.toContain('Hydrogen ND 9D');
    expect(result.modules).not.toContain('Hydrogen ND 10D');
    expect(result.modules).not.toContain('Hydrogen ND 11D');

    // Should include the dimension define
    expect(result.glsl).toContain('#define HYDROGEN_ND_DIMENSION 4');
  });

  it('should include the correct dimension block for dimension 7', () => {
    const result = composeSchroedingerShader({
      dimension: 7,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      quantumMode: 'hydrogenND',
      overrides: [],
    });

    expect(result.modules).toContain('Hydrogen ND 7D');
    expect(result.modules).not.toContain('Hydrogen ND 4D');
    expect(result.glsl).toContain('#define HYDROGEN_ND_DIMENSION 7');
  });

  it('should not include hydrogenND blocks for harmonic oscillator mode', () => {
    const result = composeSchroedingerShader({
      dimension: 4,
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      quantumMode: 'harmonicOscillator',
      overrides: [],
    });

    // Should NOT include any hydrogen ND blocks
    expect(result.modules).not.toContain('Hydrogen ND Common');
    expect(result.modules).not.toContain('Hydrogen ND 4D');
    expect(result.glsl).not.toContain('#define HYDROGEN_ND_MODE_ENABLED');
    expect(result.glsl).not.toContain('#define HYDROGEN_ND_DIMENSION');
  });

  it('should clamp dimension to valid range (3-11)', () => {
    const result = composeSchroedingerShader({
      dimension: 15, // Above max
      shadows: false,
      temporal: false,
      ambientOcclusion: false,
      quantumMode: 'hydrogenND',
      overrides: [],
    });

    // Should clamp to 11
    expect(result.modules).toContain('Hydrogen ND 11D');
    expect(result.glsl).toContain('#define HYDROGEN_ND_DIMENSION 11');
  });
});

describe('Schrödinger Shader Composition - Quantum Volume Effects', () => {
  const baseConfig = {
    dimension: 4,
    shadows: false,
    temporal: false,
    ambientOcclusion: false,
    overrides: [] as string[],
  };

  it('should include USE_CURL define when curl is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      curl: true,
    });

    expect(result.glsl).toContain('#define USE_CURL');
    expect(result.features).toContain('Curl Flow');
  });

  it('should NOT include USE_CURL define when curl is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      curl: false,
    });

    expect(result.glsl).not.toContain('#define USE_CURL');
    expect(result.features).not.toContain('Curl Flow');
  });

  it('should include USE_DISPERSION define when dispersion is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      dispersion: true,
    });

    expect(result.glsl).toContain('#define USE_DISPERSION');
    expect(result.features).toContain('Chromatic Dispersion');
  });

  it('should include dispersion code in both fast and HQ raymarch paths when enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      dispersion: true,
    });

    // Verify dispersion code is in fast path (volumeRaymarch)
    // The fast path should have per-channel transmittance for proper dispersion
    expect(result.glsl).toContain('vec3 transmittance3 = vec3(1.0)');

    // Verify dispersion code is in HQ path (volumeRaymarchHQ)
    // The HQ path should have chromatic dispersion logic with full sampling option
    expect(result.glsl).toContain('bool useFullSampling');
  });

  it('should NOT include USE_DISPERSION define when dispersion is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      dispersion: false,
    });

    expect(result.glsl).not.toContain('#define USE_DISPERSION');
    expect(result.features).not.toContain('Chromatic Dispersion');
  });

  it('should include USE_NODAL define when nodal is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      nodal: true,
    });

    expect(result.glsl).toContain('#define USE_NODAL');
    expect(result.features).toContain('Nodal Surfaces');
  });

  it('should NOT include USE_NODAL define when nodal is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      nodal: false,
    });

    expect(result.glsl).not.toContain('#define USE_NODAL');
    expect(result.features).not.toContain('Nodal Surfaces');
  });

  it('should include USE_ENERGY_COLOR define when energyColor is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      energyColor: true,
    });

    expect(result.glsl).toContain('#define USE_ENERGY_COLOR');
    expect(result.features).toContain('Energy Coloring');
  });

  it('should NOT include USE_ENERGY_COLOR define when energyColor is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      energyColor: false,
    });

    expect(result.glsl).not.toContain('#define USE_ENERGY_COLOR');
    expect(result.features).not.toContain('Energy Coloring');
  });

  it('should include USE_SHIMMER define when shimmer is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      shimmer: true,
    });

    expect(result.glsl).toContain('#define USE_SHIMMER');
    expect(result.features).toContain('Uncertainty Shimmer');
  });

  it('should NOT include USE_SHIMMER define when shimmer is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      shimmer: false,
    });

    expect(result.glsl).not.toContain('#define USE_SHIMMER');
    expect(result.features).not.toContain('Uncertainty Shimmer');
  });

  it('should include USE_EROSION define when erosion is enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      erosion: true,
    });

    expect(result.glsl).toContain('#define USE_EROSION');
    expect(result.features).toContain('Edge Erosion');
  });

  it('should NOT include USE_EROSION define when erosion is disabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      erosion: false,
    });

    expect(result.glsl).not.toContain('#define USE_EROSION');
    expect(result.features).not.toContain('Edge Erosion');
  });

  it('should respect overrides for quantum volume effects', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      curl: true,
      dispersion: true,
      overrides: ['Curl', 'Dispersion'],
    });

    // Features should be disabled when overridden
    expect(result.glsl).not.toContain('#define USE_CURL');
    expect(result.glsl).not.toContain('#define USE_DISPERSION');
    expect(result.features).not.toContain('Curl Flow');
    expect(result.features).not.toContain('Chromatic Dispersion');
  });

  it('should include all effects when all are enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      curl: true,
      dispersion: true,
      nodal: true,
      energyColor: true,
      shimmer: true,
      erosion: true,
    });

    expect(result.glsl).toContain('#define USE_CURL');
    expect(result.glsl).toContain('#define USE_DISPERSION');
    expect(result.glsl).toContain('#define USE_NODAL');
    expect(result.glsl).toContain('#define USE_ENERGY_COLOR');
    expect(result.glsl).toContain('#define USE_SHIMMER');
    expect(result.glsl).toContain('#define USE_EROSION');
  });

  it('should exclude all effects when none are enabled', () => {
    const result = composeSchroedingerShader({
      ...baseConfig,
      curl: false,
      dispersion: false,
      nodal: false,
      energyColor: false,
      shimmer: false,
      erosion: false,
    });

    expect(result.glsl).not.toContain('#define USE_CURL');
    expect(result.glsl).not.toContain('#define USE_DISPERSION');
    expect(result.glsl).not.toContain('#define USE_NODAL');
    expect(result.glsl).not.toContain('#define USE_ENERGY_COLOR');
    expect(result.glsl).not.toContain('#define USE_SHIMMER');
    expect(result.glsl).not.toContain('#define USE_EROSION');
  });
});
