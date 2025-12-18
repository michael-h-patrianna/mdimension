import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { sssBlock } from '../shared/lighting/sss.glsl';

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
    'Rim SSS',
    'MRT Output'
  ];

  const glsl = [
    precisionBlock,
    `
    // Inputs from vertex shader
    in vec3 vNormal;
    in vec3 vWorldPosition;
    in vec3 vViewDirection;

    // Rim SSS uniforms
    uniform bool uSssEnabled;
    uniform float uSssIntensity;
    uniform vec3 uSssColor;
    uniform float uSssThickness;
    `,
    constantsBlock,
    uniformsBlock,
    tubeUniformsBlock,
    pbrBlock,
    multiLightBlock,
    sssBlock,
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

