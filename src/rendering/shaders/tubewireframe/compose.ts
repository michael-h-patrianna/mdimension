import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';

import { tubeUniformsBlock } from './uniforms.glsl';
import { pbrBlock } from './pbr.glsl';
import { mainBlock } from './main.glsl';
import { vertexBlock } from './vertex.glsl';

/**
 *
 */
export function composeTubeWireframeFragmentShader() {
  const modules = [
    'Precision',
    'Vertex Inputs',
    'Constants',
    'Shared Uniforms',
    'Tube Uniforms',
    'PBR Functions',
    'Multi-Light System',
    'Main'
  ];

  const features = [
    'PBR Lighting',
    'Multi-Light Support',
    'Fresnel Rim',
    'MRT Output'
  ];

  const glsl = [
    precisionBlock,
    `
    // Inputs from vertex shader
    in vec3 vNormal;
    in vec3 vWorldPosition;
    in vec3 vViewDirection;
    `,
    constantsBlock,
    uniformsBlock,
    tubeUniformsBlock,
    pbrBlock,
    multiLightBlock,
    mainBlock
  ].join('\n');

  return { glsl, modules, features };
}

/**
 *
 */
export function composeTubeWireframeVertexShader() {
  return vertexBlock;
}

