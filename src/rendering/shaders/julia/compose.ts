import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { ggxBlock } from '../shared/lighting/ggx.glsl';
import { sssBlock } from '../shared/lighting/sss.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { shadowsBlock } from '../shared/features/shadows.glsl';
import { aoBlock } from '../shared/features/ao.glsl';
import { temporalBlock } from '../shared/features/temporal.glsl';
import { opacityBlock } from '../shared/features/opacity.glsl';
import { fogUniformsBlock, fogFunctionsBlock } from '../shared/features/fog.glsl';
import { normalBlock } from '../shared/raymarch/normal.glsl';
import { sphereIntersectBlock } from '../shared/raymarch/sphere-intersect.glsl';
import { raymarchCoreBlock } from '../shared/raymarch/core.glsl';
import {
  processFeatureFlags,
  assembleShaderBlocks,
  fractalVertexInputsBlock,
} from '../shared/fractal/compose-helpers';

import { juliaUniformsBlock } from './uniforms.glsl';
import { quaternionBlock } from './quaternion.glsl';
import { sdf3dBlock } from './sdf/sdf3d.glsl';
import { dispatchBlock } from './dispatch.glsl';
import { mainBlock } from './main.glsl';
import { ShaderConfig } from '../shared/types';

/**
 * Compose Julia fragment shader with all features.
 * @param config
 */
export function composeJuliaShader(config: ShaderConfig) {
  const {
    shadows: enableShadows,
    temporal: enableTemporal,
    ambientOcclusion: enableAO,
    sss: enableSss,
    fog: enableFog,
    overrides = [],
  } = config;

  // Process feature flags using shared helper
  const flags = processFeatureFlags(config);

  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Vertex Inputs', content: fractalVertexInputsBlock },
    { name: 'Defines', content: flags.defines.join('\n') },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Julia Uniforms', content: juliaUniformsBlock },
    { name: 'Quaternion Math', content: quaternionBlock },
    { name: 'Color (HSL)', content: hslBlock },
    { name: 'Color (Cosine)', content: cosinePaletteBlock },
    { name: 'Color (Oklab)', content: oklabBlock },
    { name: 'Color Selector', content: selectorBlock },
    { name: 'Lighting (GGX)', content: ggxBlock },
    { name: 'Lighting (SSS)', content: sssBlock, condition: enableSss },
    { name: 'SDF Julia 3D', content: sdf3dBlock },
    { name: 'Dispatch', content: dispatchBlock },
    { name: 'Temporal Features', content: temporalBlock, condition: enableTemporal },
    { name: 'Sphere Intersection', content: sphereIntersectBlock },
    { name: 'Raymarching Core', content: raymarchCoreBlock },
    { name: 'Normal Calculation', content: normalBlock },
    { name: 'Ambient Occlusion', content: aoBlock, condition: enableAO },
    { name: 'Shadows', content: shadowsBlock, condition: enableShadows },
    { name: 'Multi-Light System', content: multiLightBlock },
    { name: 'Fog Uniforms', content: fogUniformsBlock, condition: enableFog },
    { name: 'Fog Functions', content: fogFunctionsBlock, condition: enableFog },
    { name: 'Opacity System', content: opacityBlock },
    { name: 'Main', content: mainBlock },
  ];

  const { glsl, modules } = assembleShaderBlocks(blocks, overrides);

  return { glsl, modules, features: flags.features };
}
