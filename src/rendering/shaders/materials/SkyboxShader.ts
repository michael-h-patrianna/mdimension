/**
 * Skybox Shader Material
 *
 * Custom shader material for rendering environment skyboxes with
 * configurable visual effects and animations.
 *
 * Features:
 * - Cube texture sampling with rotation
 * - Hue and saturation adjustments
 * - Distortion (heatwave) effect
 * - Chromatic aberration
 * - Vignette darkening
 * - Film grain noise
 * - Atmospheric horizon tinting
 *
 * Animation modes supported via uniform updates:
 * - cinematic: Gentle rotation with subtle tilts
 * - heatwave: Distortion effect with slow rotation
 * - tumble: Multi-axis continuous rotation
 * - ethereal: Color shifting with intensity pulsing
 * - nebula: Continuous hue rotation
 */

import * as THREE from 'three';

/**
 * Uniforms for the skybox shader material
 */
export interface SkyboxShaderUniforms {
  uTex: THREE.CubeTexture | null;
  uRotation: THREE.Matrix3;
  uBlur: number;
  uIntensity: number;
  uHue: number;
  uSaturation: number;
  uDistortion: number;
  uTime: number;
  uAberration: number;
  uVignette: number;
  uGrain: number;
  uAtmosphere: number;
  [key: string]: THREE.CubeTexture | THREE.Matrix3 | number | null;
}

/**
 * Default uniform values for the skybox shader.
 * Returns a fresh object each time to avoid shared state.
 *
 * @returns Fresh SkyboxShaderUniforms object with default values
 */
export function createSkyboxShaderDefaults(): SkyboxShaderUniforms {
  return {
    uTex: null,
    uRotation: new THREE.Matrix3(),
    uBlur: 0,
    uIntensity: 1,
    uHue: 0,
    uSaturation: 1,
    uDistortion: 0,
    uTime: 0,
    uAberration: 0,
    uVignette: 0.15,
    uGrain: 0.02,
    uAtmosphere: 0.0,
  };
}

/**
 * Vertex shader for skybox rendering
 *
 * Transforms vertex positions and calculates world direction for
 * cube texture sampling in the fragment shader.
 */
export const skyboxVertexShader = /* glsl */ `
  varying vec3 vWorldDirection;
  varying vec2 vScreenUV;
  uniform mat3 uRotation;

  void main() {
    // Rotate the direction based on the matrix calculated in JS
    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldDirection = uRotation * normalize(worldPosition);

    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clipPos;

    // Screen UV for post effects
    vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;
  }
`;

/**
 * Fragment shader for skybox rendering
 *
 * Samples cube texture with optional effects:
 * - Chromatic aberration
 * - Distortion/heatwave
 * - Hue/saturation adjustment
 * - Atmospheric horizon tint
 * - Vignette
 * - Film grain
 */
export const skyboxFragmentShader = /* glsl */ `
  uniform samplerCube uTex;
  uniform float uBlur;
  uniform float uIntensity;
  uniform float uHue;
  uniform float uSaturation;
  uniform float uDistortion;
  uniform float uAberration;
  uniform float uTime;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uAtmosphere;

  varying vec3 vWorldDirection;
  varying vec2 vScreenUV;

  // HSV Helper
  vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Film grain noise
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
      vec3 dir = normalize(vWorldDirection);

      // Distortion (Heatwave effect)
      if (uDistortion > 0.0) {
          float noise = sin(dir.y * 20.0 + uTime * 2.0) * 0.01 * uDistortion;
          dir.x += noise;
          dir.z += noise;
          dir = normalize(dir);
      }

      vec4 color;

      // Chromatic Aberration
      if (uAberration > 0.0) {
          vec3 dirR = dir;
          vec3 dirG = dir;
          vec3 dirB = dir;

          float spread = uAberration * 0.02;
          dirR.x += spread;
          dirB.x -= spread;

          float r = textureCube(uTex, dirR).r;
          float g = textureCube(uTex, dirG).g;
          float b = textureCube(uTex, dirB).b;
          color = vec4(r, g, b, 1.0);
      } else {
          color = textureCube(uTex, dir);
      }

      // Apply Intensity
      color.rgb *= uIntensity;

      // Apply Hue/Saturation
      if (uHue != 0.0 || uSaturation != 1.0) {
          vec3 hsv = rgb2hsv(color.rgb);
          hsv.x += uHue;
          hsv.y *= uSaturation;
          color.rgb = hsv2rgb(hsv);
      }

      // Atmospheric depth - subtle blue tint towards horizon
      if (uAtmosphere > 0.0) {
          float horizonFactor = 1.0 - abs(dir.y);
          horizonFactor = pow(horizonFactor, 2.0);
          vec3 atmosphereColor = vec3(0.4, 0.6, 0.9);
          color.rgb = mix(color.rgb, atmosphereColor * uIntensity, horizonFactor * uAtmosphere * 0.3);
      }

      // Vignette - darkens edges for cinematic feel and hides seams
      if (uVignette > 0.0) {
          vec2 uv = vScreenUV;
          float dist = distance(uv, vec2(0.5));
          float vignetteFactor = smoothstep(0.4, 0.9, dist);
          color.rgb *= 1.0 - vignetteFactor * uVignette;
      }

      // Film grain - breaks up banding and adds texture
      if (uGrain > 0.0) {
          float grain = random(vScreenUV + fract(uTime * 0.1)) - 0.5;
          color.rgb += grain * uGrain;
      }

      gl_FragColor = color;
  }
`;
