/**
 * GLSL to TSL Transpiler Script
 *
 * Uses Three.js built-in transpiler to convert GLSL shaders to TSL.
 * Run with: node scripts/tools/transpile-glsl-to-tsl.mjs
 */

import Transpiler from 'three/examples/jsm/transpiler/Transpiler.js';
import GLSLDecoder from 'three/examples/jsm/transpiler/GLSLDecoder.js';
import TSLEncoder from 'three/examples/jsm/transpiler/TSLEncoder.js';

// Example GLSL fragment shader - BokehShader
const bokehFragmentGLSL = `
precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float focus;
uniform float focusRange;
uniform float aperture;
uniform float maxblur;
uniform float nearClip;
uniform float farClip;
uniform float aspect;
uniform float blurMethod;
uniform float time;

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float getDepth(vec2 coord) {
  return texture(tDepth, coord).x;
}

float perspectiveDepthToViewZ(float depth, float near, float far) {
  return near * far / (far - depth * (far - near));
}

float getViewZ(float depth) {
  return perspectiveDepthToViewZ(depth, nearClip, farClip);
}

vec4 discBlur(vec2 uv, vec2 blur) {
  vec4 col = vec4(0.0);
  col += texture(tDiffuse, uv);
  col += texture(tDiffuse, uv + blur * vec2(0.0, 0.4));
  col += texture(tDiffuse, uv + blur * vec2(0.15, 0.37));
  col += texture(tDiffuse, uv + blur * vec2(0.29, 0.29));
  col += texture(tDiffuse, uv + blur * vec2(-0.37, 0.15));
  col += texture(tDiffuse, uv + blur * vec2(0.4, 0.0));
  col += texture(tDiffuse, uv + blur * vec2(0.37, -0.15));
  col += texture(tDiffuse, uv + blur * vec2(0.29, -0.29));
  col += texture(tDiffuse, uv + blur * vec2(-0.15, -0.37));
  col += texture(tDiffuse, uv + blur * vec2(0.0, -0.4));
  col += texture(tDiffuse, uv + blur * vec2(-0.15, 0.37));
  col += texture(tDiffuse, uv + blur * vec2(-0.29, 0.29));
  col += texture(tDiffuse, uv + blur * vec2(0.37, 0.15));
  col += texture(tDiffuse, uv + blur * vec2(-0.4, 0.0));
  col += texture(tDiffuse, uv + blur * vec2(-0.37, -0.15));
  col += texture(tDiffuse, uv + blur * vec2(-0.29, -0.29));
  col += texture(tDiffuse, uv + blur * vec2(0.15, -0.37));
  return col / 17.0;
}

vec4 hexagonalBlur(vec2 uv, vec2 blur) {
  vec4 col = vec4(0.0);
  float total = 0.0;

  col += texture(tDiffuse, uv) * 1.0;
  total += 1.0;

  float r1 = 0.33;
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * 1.0472;
    vec2 offset = vec2(cos(angle), sin(angle)) * r1;
    col += texture(tDiffuse, uv + blur * offset) * 0.9;
    total += 0.9;
  }

  float r2 = 0.67;
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * 0.5236;
    vec2 offset = vec2(cos(angle), sin(angle)) * r2;
    col += texture(tDiffuse, uv + blur * offset) * 0.7;
    total += 0.7;
  }

  float r3 = 1.0;
  for (int i = 0; i < 18; i++) {
    float angle = float(i) * 0.349;
    vec2 offset = vec2(cos(angle), sin(angle)) * r3;
    col += texture(tDiffuse, uv + blur * offset) * 0.5;
    total += 0.5;
  }

  return col / max(total, 0.0001);
}

void main() {
  float depth = getDepth(vUv);
  float viewZ = -getViewZ(depth);

  float diff = viewZ - focus;
  float absDiff = abs(diff);

  float blurFactor = max(0.0, absDiff - focusRange) * aperture;
  blurFactor = min(blurFactor, maxblur);

  vec2 dofblur = vec2(blurFactor);
  dofblur *= vec2(1.0, aspect);

  vec4 col;
  if (blurMethod < 0.5) {
    col = discBlur(vUv, dofblur);
  } else {
    col = hexagonalBlur(vUv, dofblur);
  }

  fragColor = col;
  fragColor.a = 1.0;
}
`;

async function transpileShader(glslCode, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Transpiling: ${name}`);
  console.log('='.repeat(60));

  try {
    const decoder = new GLSLDecoder();
    const encoder = new TSLEncoder();
    const transpiler = new Transpiler(decoder, encoder);

    const tslCode = transpiler.parse(glslCode);

    console.log('\n--- TSL OUTPUT ---\n');
    console.log(tslCode);
    console.log('\n--- END TSL OUTPUT ---\n');

    return tslCode;
  } catch (error) {
    console.error(`Error transpiling ${name}:`, error.message);
    return null;
  }
}

// Run transpilation
async function main() {
  console.log('Three.js GLSL to TSL Transpiler');
  console.log('================================\n');

  await transpileShader(bokehFragmentGLSL, 'BokehShader Fragment');
}

main().catch(console.error);
