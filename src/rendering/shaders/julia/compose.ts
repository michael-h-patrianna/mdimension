import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
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

import { juliaUniformsBlock } from './uniforms.glsl';
import { quaternionBlock } from './quaternion.glsl';
import { sdf3dBlock } from './sdf/sdf3d.glsl';
import { dispatchBlock } from './dispatch.glsl';
import { mainBlock } from './main.glsl';
import { ShaderConfig } from '../shared/types';

/**
 *
 * @param config
 */
export function composeJuliaShader(config: ShaderConfig) {
  const {
    shadows: enableShadows,
    temporal: enableTemporal,
    ambientOcclusion: enableAO,
    opacityMode,
    overrides = [],
    sss: enableSss,
    fresnel: enableFresnel,
    fog: enableFog,
  } = config;

  const defines = [];
  const features = [];

  features.push('Multi-Light');
  features.push(`Opacity: ${opacityMode}`);

  const useShadows = enableShadows && !overrides.includes('Shadows');
  const useTemporal = enableTemporal && !overrides.includes('Temporal Reprojection');
  const useAO = enableAO && !overrides.includes('Ambient Occlusion');
  const useSss = enableSss && !overrides.includes('SSS');
  const useFresnel = enableFresnel && !overrides.includes('Fresnel');
  const useFog = enableFog && !overrides.includes('Fog');

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
  if (useSss) {
      defines.push('#define USE_SSS');
      features.push('SSS');
  }
  if (useFresnel) {
      defines.push('#define USE_FRESNEL');
      features.push('Fresnel');
  }
  if (useFog) {
      defines.push('#define USE_FOG');
      features.push('Fog');
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
    { name: 'Lighting (Fresnel)', content: fresnelBlock, condition: enableFresnel },
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
    { name: 'Fog Uniforms', content: fogUniformsBlock, condition: useFog },
    { name: 'Fog Functions', content: fogFunctionsBlock, condition: useFog },
    { name: 'Opacity System', content: opacityBlock },
    { name: 'Main', content: mainBlock }
  ];

  const modules: string[] = [];
  const glslParts: string[] = [];

  blocks.forEach(b => {
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
