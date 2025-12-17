/**
 * Shader composition for Schrödinger N-dimensional quantum volume visualizer
 *
 * Assembles shader blocks in dependency order:
 * 1. Core: precision, constants, uniforms
 * 2. Quantum math: complex, hermite, ho1d, psi, density
 * 3. Volume rendering: absorption, emission, integration
 * 4. Color and effects
 * 5. Main shader
 */

import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { opacityBlock } from '../shared/features/opacity.glsl';
import { sphereIntersectBlock } from '../shared/raymarch/sphere-intersect.glsl';

import { schroedingerUniformsBlock } from './uniforms.glsl';
import { complexMathBlock } from './quantum/complex.glsl';
import { hermiteBlock } from './quantum/hermite.glsl';
import { ho1dBlock } from './quantum/ho1d.glsl';
import { psiBlock } from './quantum/psi.glsl';
import { densityBlock } from './quantum/density.glsl';
import { absorptionBlock } from './volume/absorption.glsl';
import { emissionBlock } from './volume/emission.glsl';
import { volumeIntegrationBlock } from './volume/integration.glsl';
import { mainBlock, mainBlockIsosurface } from './main.glsl';
import { ShaderConfig } from '../shared/types';

export interface SchroedingerShaderConfig extends ShaderConfig {
  /** Use isosurface mode instead of volumetric */
  isosurface?: boolean;
}

export function composeSchroedingerShader(config: SchroedingerShaderConfig) {
  const {
    shadows: enableShadows,
    temporal: enableTemporal,
    ambientOcclusion: enableAO,
    opacityMode,
    overrides = [],
    isosurface = false,
  } = config;

  const defines: string[] = [];
  const features: string[] = [];

  features.push('Quantum Volume');
  features.push('Beer-Lambert');
  features.push(`Opacity: ${opacityMode}`);

  // Note: Shadows and AO are less relevant for pure volumetric mode
  // but kept for isosurface mode compatibility
  const useShadows = enableShadows && isosurface && !overrides.includes('Shadows');
  const useTemporal = enableTemporal && !overrides.includes('Temporal Reprojection');
  const useAO = enableAO && isosurface && !overrides.includes('Ambient Occlusion');

  if (useShadows) {
    defines.push('#define USE_SHADOWS');
    features.push('Shadows');
  }
  if (useTemporal) {
    defines.push('#define USE_TEMPORAL');
    features.push('Temporal Reprojection');
  }
  if (useAO) {
    defines.push('#define USE_AO');
    features.push('Ambient Occlusion');
  }

  if (isosurface) {
    features.push('Isosurface Mode');
  } else {
    features.push('Volumetric Mode');
  }

  // Select main block based on mode
  const selectedMainBlock = isosurface ? mainBlockIsosurface : mainBlock;

  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Vertex Inputs', content: `\n// Inputs from vertex shader\nin vec3 vPosition;\nin vec2 vUv;\n` },
    { name: 'Defines', content: defines.join('\n') },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Schrödinger Uniforms', content: schroedingerUniformsBlock },

    // Quantum math modules (order matters!)
    { name: 'Complex Math', content: complexMathBlock },
    { name: 'Hermite Polynomials', content: hermiteBlock },
    { name: 'HO 1D Eigenfunction', content: ho1dBlock },
    { name: 'Wavefunction (Psi)', content: psiBlock },
    { name: 'Density Field', content: densityBlock },

    // Color system
    { name: 'Color (HSL)', content: hslBlock },
    { name: 'Color (Cosine)', content: cosinePaletteBlock },
    { name: 'Color (Oklab)', content: oklabBlock },
    { name: 'Color Selector', content: selectorBlock },

    // Lighting (must come before emission which uses light functions)
    { name: 'Lighting (Fresnel)', content: fresnelBlock },
    { name: 'Multi-Light System', content: multiLightBlock },

    // Volumetric rendering
    { name: 'Beer-Lambert Absorption', content: absorptionBlock },
    { name: 'Volume Emission', content: emissionBlock },
    { name: 'Volume Integration', content: volumeIntegrationBlock },

    // Geometry
    { name: 'Sphere Intersection', content: sphereIntersectBlock },

    // Opacity and main
    { name: 'Opacity System', content: opacityBlock },
    { name: 'Main', content: selectedMainBlock },
  ];

  const modules: string[] = [];
  const glslParts: string[] = [];

  blocks.forEach(b => {
    modules.push(b.name);

    if (overrides.includes(b.name)) {
      // Overridden: Don't add content
    } else {
      glslParts.push(b.content);
    }
  });

  return { glsl: glslParts.join('\n'), modules, features };
}
