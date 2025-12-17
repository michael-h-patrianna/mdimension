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

import { mandelbulbUniformsBlock } from './uniforms.glsl';
import { zoomUniformsBlock, zoomMappingBlock, zoomDeScalingBlock } from './zoom';
import { powerBlock } from './power.glsl';
import { sdf3dBlock } from './sdf/sdf3d.glsl';
import { sdf4dBlock } from './sdf/sdf4d.glsl';
import { sdf5dBlock } from './sdf/sdf5d.glsl';
import { sdf6dBlock } from './sdf/sdf6d.glsl';
import { sdf7dBlock } from './sdf/sdf7d.glsl';
import { sdf8dBlock } from './sdf/sdf8d.glsl';
import { sdf9dBlock } from './sdf/sdf9d.glsl';
import { sdf10dBlock } from './sdf/sdf10d.glsl';
import { sdf11dBlock } from './sdf/sdf11d.glsl';
import { sdfHighDBlock } from './sdf/sdf-high-d.glsl';
import { generateDispatch } from './dispatch.glsl';
import { mainBlock } from './main.glsl';
import { ShaderConfig } from '../shared/types';

/**
 *
 * @param config
 */
export function composeMandelbulbShader(config: ShaderConfig) {
  const { dimension, shadows: enableShadows, temporal: enableTemporal, ambientOcclusion: enableAO, opacityMode, overrides = [] } = config;

  const defines = [];
  const features = [];
  
  features.push('Multi-Light');
  features.push('Fresnel');
  features.push(`Opacity: ${opacityMode}`);

  const useShadows = enableShadows && !overrides.includes('Shadows');
  const useTemporal = enableTemporal && !overrides.includes('Temporal Reprojection');
  const useAO = enableAO && !overrides.includes('Ambient Occlusion');

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

  // Select SDF block based on dimension
  let sdfBlock = sdfHighDBlock;
  let sdfName = 'SDF High-D (Array)';
  
  if (dimension === 3) { sdfBlock = sdf3dBlock; sdfName = 'SDF 3D'; }
  else if (dimension === 4) { sdfBlock = sdf4dBlock; sdfName = 'SDF 4D'; }
  else if (dimension === 5) { sdfBlock = sdf5dBlock; sdfName = 'SDF 5D'; }
  else if (dimension === 6) { sdfBlock = sdf6dBlock; sdfName = 'SDF 6D'; }
  else if (dimension === 7) { sdfBlock = sdf7dBlock; sdfName = 'SDF 7D'; }
  else if (dimension === 8) { sdfBlock = sdf8dBlock; sdfName = 'SDF 8D'; }
  else if (dimension === 9) { sdfBlock = sdf9dBlock; sdfName = 'SDF 9D (Unrolled)'; }
  else if (dimension === 10) { sdfBlock = sdf10dBlock; sdfName = 'SDF 10D (Unrolled)'; }
  else if (dimension === 11) { sdfBlock = sdf11dBlock; sdfName = 'SDF 11D (Unrolled)'; }

  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Vertex Inputs', content: `\n// Inputs from vertex shader\nin vec3 vPosition;\nin vec2 vUv;\n` },
    { name: 'Defines', content: defines.join('\n') },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Mandelbulb Uniforms', content: mandelbulbUniformsBlock },
    { name: 'Zoom Uniforms', content: zoomUniformsBlock },
    { name: 'Power Functions', content: powerBlock },
    { name: 'Zoom Mapping', content: zoomMappingBlock },
    { name: 'Zoom DE Scaling', content: zoomDeScalingBlock },
    { name: 'Color (HSL)', content: hslBlock },
    { name: 'Color (Cosine)', content: cosinePaletteBlock },
    { name: 'Color (Oklab)', content: oklabBlock },
    { name: 'Color Selector', content: selectorBlock },
    { name: 'Lighting (Fresnel)', content: fresnelBlock },
    { name: sdfName, content: sdfBlock },
    { name: 'Dispatch', content: generateDispatch(dimension) },
    { name: 'Temporal Reprojection', content: temporalBlock, condition: enableTemporal },
    { name: 'Sphere Intersection', content: sphereIntersectBlock },
    { name: 'Raymarching Core', content: raymarchCoreBlock },
    { name: 'Normal Calculation', content: normalBlock },
    { name: 'Ambient Occlusion', content: aoBlock, condition: enableAO },
    { name: 'Shadows', content: shadowsBlock, condition: enableShadows },
    { name: 'Multi-Light System', content: multiLightBlock },
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