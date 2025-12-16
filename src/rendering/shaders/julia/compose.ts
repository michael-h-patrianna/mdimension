import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { shadowsBlock } from '../shared/features/shadows.glsl';
import { aoBlock } from '../shared/features/ao.glsl';
import { temporalBlock } from '../shared/features/temporal.glsl';
import { opacityBlock } from '../shared/features/opacity.glsl';
import { normalBlock } from '../shared/raymarch/normal.glsl';
import { sphereIntersectBlock } from '../shared/raymarch/sphere-intersect.glsl';
import { raymarchCoreBlock } from '../shared/raymarch/core.glsl';

import { juliaUniformsBlock } from './uniforms.glsl';
import { quaternionBlock } from './quaternion.glsl';
import { sdf3dBlock } from './sdf/sdf3d.glsl';
import { dispatchBlock } from './dispatch.glsl';
import { mainBlock } from './main.glsl';
import { ShaderConfig } from '../shared/types';

export function composeJuliaShader(config: ShaderConfig) {
  const { shadows: _shadows, temporal: _temporal, ambientOcclusion: _ao, opacityMode, overrides = [] } = config;

  // Apply overrides
  const shadows = _shadows && !overrides.includes('Shadows');
  const temporal = _temporal && !overrides.includes('Temporal Reprojection');
  const ambientOcclusion = _ao && !overrides.includes('Ambient Occlusion');

  const defines = [];
  const features = [];

  features.push('Multi-Light');
  features.push('Fresnel');
  features.push(`Opacity: ${opacityMode}`);

  if (shadows) {
      defines.push('#define USE_SHADOWS');
      features.push('Shadows');
  }
  if (temporal) {
      defines.push('#define USE_TEMPORAL');
      features.push('Temporal Reprojection');
  }
  if (ambientOcclusion) {
      defines.push('#define USE_AO');
      features.push('Ambient Occlusion');
  }

  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Vertex Inputs', content: `\n// Inputs from vertex shader\nin vec3 vPosition;\nin vec2 vUv;\n` },
    { name: 'Defines', content: defines.join('\n') },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Julia Uniforms', content: juliaUniformsBlock },
    { name: 'Quaternion Math', content: quaternionBlock },
    { name: 'Color (HSL)', content: hslBlock },
    { name: 'Color (Cosine)', content: cosinePaletteBlock },
    { name: 'Color (Oklab)', content: oklabBlock },
    { name: 'Color Selector', content: selectorBlock },
    { name: 'Lighting (Fresnel)', content: fresnelBlock },
    { name: 'SDF Julia 3D', content: sdf3dBlock },
    { name: 'Dispatch', content: dispatchBlock },
    { name: 'Temporal Features', content: temporalBlock, condition: temporal },
    { name: 'Sphere Intersection', content: sphereIntersectBlock },
    { name: 'Raymarching Core', content: raymarchCoreBlock },
    { name: 'Normal Calculation', content: normalBlock },
    { name: 'Ambient Occlusion', content: aoBlock, condition: ambientOcclusion },
    { name: 'Shadows', content: shadowsBlock, condition: shadows },
    { name: 'Multi-Light System', content: multiLightBlock },
    { name: 'Opacity System', content: opacityBlock },
    { name: 'Main', content: mainBlock }
  ];

  const activeBlocks = blocks.filter(b => b.condition !== false);
  
  const glsl = activeBlocks.map(b => b.content).join('\n');
  const modules = activeBlocks.map(b => b.name);

  return { glsl, modules, features };
}