/**
 * Shader composition for Black Hole N-dimensional visualization
 *
 * Assembles shader blocks in dependency order:
 * 1. Core: precision, constants, uniforms
 * 2. Gravity: lensing, horizon, shell, manifold, doppler
 * 3. Effects: jets (optional)
 * 4. Main raymarching loop
 */

import { constantsBlock } from '../shared/core/constants.glsl'
import { precisionBlock } from '../shared/core/precision.glsl'
import { uniformsBlock } from '../shared/core/uniforms.glsl'
import { temporalBlock } from '../shared/features/temporal.glsl'
import { ShaderConfig } from '../shared/types'

import { dopplerBlock } from './gravity/doppler.glsl'
import { horizonBlock } from './gravity/horizon.glsl'
import { lensingBlock } from './gravity/lensing.glsl'
import { manifoldBlock } from './gravity/manifold.glsl'
import { shellBlock } from './gravity/shell.glsl'
import { jetsBlock } from './effects/jets.glsl'
import { motionBlurBlock } from './effects/motion-blur.glsl'
import { embeddingBlock } from './nd/embedding.glsl'
import { diskSdfBlock } from './gravity/disk-sdf.glsl'
import { mainBlock } from './main.glsl'
import { blackHoleUniformsBlock } from './uniforms.glsl'

import type { BlackHoleRaymarchMode } from '@/lib/geometry/extended/types'

export interface BlackHoleShaderConfig extends ShaderConfig {
  /** Enable temporal accumulation (Horizon-style 1/4 res reconstruction) */
  temporalAccumulation?: boolean
  /** Enable polar jets */
  jets?: boolean
  /** Enable Doppler effect */
  doppler?: boolean
  /** Enable environment map sampling */
  envMap?: boolean
  /** Enable motion blur effect */
  motionBlur?: boolean
  /** Raymarch mode: 'slice3D' (fast) or 'trueND' (accurate) */
  raymarchMode?: BlackHoleRaymarchMode
  /** Enable slice animation for higher dimensions */
  sliceAnimation?: boolean
}

/**
 * Compose Black Hole fragment shader with specified features.
 * @param config - Black hole shader configuration options
 * @returns Composed shader source code
 */
export function composeBlackHoleShader(config: BlackHoleShaderConfig) {
  const {
    dimension,
    // Note: shadows not implemented for black holes - no shader code exists
    // shadows: enableShadows,
    temporal: enableTemporal,
    overrides = [],
    temporalAccumulation = false,
    jets: enableJets = false,
    doppler: enableDoppler = true,
    envMap: enableEnvMap = false,
    fog: enableFog,
    motionBlur: enableMotionBlur = false,
    raymarchMode = 'slice3D',
    sliceAnimation: enableSliceAnimation = false,
  } = config

  const defines: string[] = []
  const features: string[] = []

  // Add dimension define
  defines.push(`#define DIMENSION ${dimension}`)
  features.push(`${dimension}D Black Hole`)

  // Temporal accumulation
  const useTemporalAccumulation =
    temporalAccumulation && !overrides.includes('Temporal Accumulation')

  if (useTemporalAccumulation) {
    defines.push('#define USE_TEMPORAL_ACCUMULATION')
    features.push('Temporal Accumulation (1/4 res)')
  }

  // Jets
  if (enableJets && !overrides.includes('Jets')) {
    defines.push('#define USE_JETS')
    features.push('Polar Jets')
  }

  // Doppler
  if (enableDoppler && !overrides.includes('Doppler')) {
    defines.push('#define USE_DOPPLER')
    features.push('Doppler Effect')
  }

  // Environment map
  if (enableEnvMap && !overrides.includes('EnvMap')) {
    defines.push('#define USE_ENVMAP')
    features.push('Environment Map')
  }

  // Fog
  if (enableFog && !overrides.includes('Fog')) {
    defines.push('#define USE_FOG')
    features.push('Fog')
  }

  // Motion Blur
  if (enableMotionBlur && !overrides.includes('Motion Blur')) {
    defines.push('#define USE_MOTION_BLUR')
    features.push('Motion Blur')
  }

  // Raymarching mode selection (mutually exclusive)
  const useSdfDisk = raymarchMode === 'sdfDisk' && !overrides.includes('SDF Disk')
  const useTrueND = raymarchMode === 'trueND' && !overrides.includes('True ND')

  if (useSdfDisk) {
    defines.push('#define USE_SDF_DISK')
    features.push('SDF Disk Raymarching (Einstein Ring)')
  } else if (useTrueND) {
    defines.push('#define USE_TRUE_ND')
    features.push('True N-D Raymarching')
  } else {
    features.push('3D Slice Raymarching')
  }

  // Slice animation (for higher dimensions)
  const useSliceAnimation =
    enableSliceAnimation && dimension > 3 && !overrides.includes('Slice Animation')
  if (useSliceAnimation) {
    defines.push('#define USE_SLICE_ANIMATION')
    features.push('Slice Animation')
  }

  // Note: Shadows not implemented for black holes - shader code doesn't exist yet
  // Can be added later when proper volumetric shadow raymarching is implemented

  // Build parameter values uniform declaration for higher dimensions
  const paramValuesStr = `uniform float uParamValues[${Math.max(dimension - 3, 1)}];`

  // Build slice animation uniforms if enabled
  const sliceAnimationUniforms = useSliceAnimation
    ? `
// Slice animation uniforms
uniform float uSliceSpeed;
uniform float uSliceAmplitude;
`
    : ''

  const blocks = [
    // Defines first
    { name: 'Defines', content: defines.join('\n') },
    { name: 'Precision', content: precisionBlock },
    {
      name: 'Vertex Inputs',
      content: `\n// Inputs from vertex shader\nin vec3 vPosition;\nin vec2 vUv;\n`,
    },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Param Values', content: paramValuesStr },
    { name: 'Slice Animation Uniforms', content: sliceAnimationUniforms, condition: useSliceAnimation },
    { name: 'Black Hole Uniforms', content: blackHoleUniformsBlock },
    { name: 'Environment Map', content: 'uniform samplerCube envMap;', condition: enableEnvMap },

    // N-D embedding (required for trueND mode)
    { name: 'N-D Embedding', content: embeddingBlock, condition: useTrueND },

    // Gravity modules
    { name: 'Lensing', content: lensingBlock },
    { name: 'Horizon', content: horizonBlock },
    { name: 'Photon Shell', content: shellBlock },
    { name: 'Manifold', content: manifoldBlock },
    { name: 'Doppler', content: dopplerBlock },
    { name: 'Disk SDF', content: diskSdfBlock, condition: useSdfDisk },

    // Effects
    { name: 'Jets', content: jetsBlock, condition: enableJets },
    { name: 'Motion Blur', content: motionBlurBlock, condition: enableMotionBlur },

    // Temporal (if needed)
    {
      name: 'Temporal',
      content: temporalBlock,
      condition: useTemporalAccumulation || enableTemporal,
    },

    // Main shader
    { name: 'Main', content: mainBlock },
  ]

  // Filter and join blocks
  const shaderSource = blocks
    .filter((block) => block.condition === undefined || block.condition)
    .map((block) => `// === ${block.name} ===\n${block.content}`)
    .join('\n\n')

  return {
    fragmentShader: shaderSource,
    features,
  }
}

/**
 * Generate vertex shader for black hole raymarching.
 * Uses standard MVP transform with BackSide rendering on box geometry.
 * @returns Vertex shader GLSL source
 */
export function generateBlackHoleVertexShader(): string {
  return /* glsl */ `
    precision highp float;

    out vec3 vPosition;
    out vec2 vUv;

    void main() {
      vUv = uv;
      // Transform to world space - required for raymarching
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vPosition = worldPosition.xyz;
      // Standard MVP transform
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `
}
