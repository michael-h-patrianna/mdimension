import { constantsBlock } from '../shared/core/constants.glsl'
import { precisionBlock } from '../shared/core/precision.glsl'
import { uniformsBlock } from '../shared/core/uniforms.glsl'
import {
  shadowMapsFunctionsBlock,
  shadowMapsUniformsBlock,
} from '../shared/features/shadowMaps.glsl'
import {
  assembleShaderBlocks,
  processMeshFeatureFlags,
  type MeshShaderConfig,
} from '../shared/fractal/compose-helpers'
import { ggxBlock } from '../shared/lighting/ggx.glsl'
import { iblBlock, iblUniformsBlock, pmremSamplingBlock } from '../shared/lighting/ibl.glsl'
import { multiLightBlock } from '../shared/lighting/multi-light.glsl'
import { sssBlock } from '../shared/lighting/sss.glsl'

import { mainBlock } from './main.glsl'
import { tubeUniformsBlock } from './uniforms.glsl'
import { vertexBlock } from './vertex.glsl'

/**
 * Configuration for TubeWireframe shader compilation.
 * Extends MeshShaderConfig with tubewireframe-specific options.
 * Each feature flag controls whether that feature's code is compiled into the shader.
 * Disabled features are completely absent from the compiled shader, not just branched.
 */
export type TubeWireframeShaderConfig = MeshShaderConfig

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
  glsl: string
  modules: string[]
  features: string[]
} {
  const { shadows: enableShadows = true, overrides = [] } = config

  // Process feature flags using shared helper
  const flags = processMeshFeatureFlags(config)

  // Build tubewireframe-specific features list (different display names)
  const features: string[] = ['PBR Lighting', 'Multi-Light Support', 'MRT Output']
  if (flags.useShadows) features.push('Shadow Maps')
  if (flags.useSss) features.push('Rim SSS')
  if (flags.useFresnel) features.push('Fresnel Rim')

  // Build blocks array with conditional inclusion
  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Defines', content: flags.defines.join('\n') },
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
    { name: 'GGX PBR', content: ggxBlock },
    { name: 'Multi-Light System', content: multiLightBlock },
    { name: 'IBL Uniforms', content: iblUniformsBlock },
    { name: 'PMREM Sampling', content: pmremSamplingBlock },
    { name: 'IBL Functions', content: iblBlock },
    { name: 'Lighting (SSS)', content: sssBlock, condition: flags.useSss },
    { name: 'Shadow Maps Uniforms', content: shadowMapsUniformsBlock, condition: enableShadows },
    { name: 'Shadow Maps Functions', content: shadowMapsFunctionsBlock, condition: enableShadows },
    { name: 'Main', content: mainBlock },
  ]

  // Assemble shader from blocks using shared helper
  const { glsl, modules } = assembleShaderBlocks(blocks, overrides)

  return { glsl, modules, features }
}

/**
 * Compose TubeWireframe vertex shader.
 * Returns the complete vertex shader for tube geometry rendering.
 *
 * @returns Vertex shader GLSL string
 */
export function composeTubeWireframeVertexShader() {
  return vertexBlock
}
