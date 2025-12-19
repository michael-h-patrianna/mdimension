import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { sssBlock } from '../shared/lighting/sss.glsl';
import { shadowMapsUniformsBlock, shadowMapsFunctionsBlock } from '../shared/features/shadowMaps.glsl';
import { fogUniformsBlock, fogFunctionsBlock } from '../shared/features/fog.glsl';

import { tubeUniformsBlock } from './uniforms.glsl';
import { pbrBlock } from './pbr.glsl';
import { mainBlock } from './main.glsl';
import { vertexBlock } from './vertex.glsl';

/**
 * Configuration for TubeWireframe shader compilation.
 * Each feature flag controls whether that feature's code is compiled into the shader.
 * Disabled features are completely absent from the compiled shader, not just branched.
 */
export interface TubeWireframeShaderConfig {
  /** Enable fog integration (default: true) */
  fog?: boolean;
  /** Enable subsurface scattering (default: true) */
  sss?: boolean;
  /** Enable fresnel rim lighting (default: true) */
  fresnel?: boolean;
  /** Module names to exclude even if feature is enabled */
  overrides?: string[];
}

/**
 * Compose TubeWireframe fragment shader with conditional features.
 *
 * Features are conditionally compiled - disabled features are completely
 * absent from the compiled shader, not just branched at runtime.
 *
 * @param config - Configuration for conditional compilation
 * @returns Object with glsl string, module names, and feature names
 */
export function composeTubeWireframeFragmentShader(config: TubeWireframeShaderConfig = {}): {
  glsl: string;
  modules: string[];
  features: string[];
} {
  const {
    fog: enableFog = true,
    sss: enableSss = true,
    fresnel: enableFresnel = true,
    overrides = [],
  } = config;

  // Build defines and features arrays
  const defines: string[] = [];
  const features: string[] = ['PBR Lighting', 'Multi-Light Support', 'Shadow Maps', 'MRT Output'];

  const useFog = enableFog && !overrides.includes('Fog');
  const useSss = enableSss && !overrides.includes('SSS');
  const useFresnel = enableFresnel && !overrides.includes('Fresnel');

  if (useFog) {
    defines.push('#define USE_FOG');
    features.push('Fog');
  }
  if (useSss) {
    defines.push('#define USE_SSS');
    features.push('Rim SSS');
  }
  if (useFresnel) {
    defines.push('#define USE_FRESNEL');
    features.push('Fresnel Rim');
  }

  // Build blocks array with conditional inclusion
  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Defines', content: defines.join('\n') },
    {
      name: 'Vertex Inputs',
      content: `
    // Inputs from vertex shader
    in vec3 vNormal;
    in vec3 vWorldPosition;
    in vec3 vViewDirection;

    // Rim SSS uniforms (always declared, code conditionally compiled)
    uniform bool uSssEnabled;
    uniform float uSssIntensity;
    uniform vec3 uSssColor;
    uniform float uSssThickness;
    uniform float uSssJitter;
    `,
    },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Tube Uniforms', content: tubeUniformsBlock },
    { name: 'PBR Functions', content: pbrBlock },
    { name: 'Lighting (Fresnel)', content: fresnelBlock, condition: useFresnel },
    { name: 'Multi-Light System', content: multiLightBlock },
    { name: 'Lighting (SSS)', content: sssBlock, condition: useSss },
    { name: 'Shadow Maps Uniforms', content: shadowMapsUniformsBlock },
    { name: 'Shadow Maps Functions', content: shadowMapsFunctionsBlock },
    { name: 'Fog Uniforms', content: fogUniformsBlock, condition: useFog },
    { name: 'Fog Functions', content: fogFunctionsBlock, condition: useFog },
    { name: 'Main', content: mainBlock },
  ];

  // Assemble shader from blocks
  const modules: string[] = [];
  const glslParts: string[] = [];

  blocks.forEach((b) => {
    if (b.condition === false) return; // Disabled in config

    modules.push(b.name);

    if (overrides.includes(b.name)) {
      // Overridden: Don't add content
    } else {
      glslParts.push(b.content);
    }
  });

  return { glsl: glslParts.join('\n'), modules, features };
}

/**
 *
 */
export function composeTubeWireframeVertexShader() {
  return vertexBlock;
}

