/**
 * Unified Material Fragment Shader Generator
 *
 * Generates fragment shader code for N-dimensional rendering.
 * Supports multiple color modes, lighting, and fresnel effects.
 *
 * @module
 */

import type { UnifiedMaterialOptions } from './types'

/**
 * Generates the fragment shader for unified materials.
 *
 * @param options - Material options including lighting and fresnel settings
 * @returns GLSL fragment shader code (WebGL2/GLSL ES 3.00)
 */
export function generateUnifiedFragmentShader(options: Required<UnifiedMaterialOptions>): string {
  return /* glsl */ `
// Unified Material Fragment Shader
// WebGL2 / GLSL ES 3.00

// Visual uniforms
uniform vec3 uColor;
uniform float uOpacity;
uniform int uColorMode; // 0 = solid, 1 = palette, 2 = depth
uniform vec3 uPaletteStart;
uniform vec3 uPaletteEnd;
uniform float uFresnelPower;
uniform float uFresnelIntensity;
uniform bool uFresnelEnabled;

// Lighting uniforms
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uDirectionalColor;
uniform float uDirectionalIntensity;
uniform vec3 uDirectionalDirection;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;
varying float vDepth;
varying float vFaceDepth;

void main() {
  // Determine base color based on color mode
  vec3 baseColor;
  if (uColorMode == 0) {
    // Solid color
    baseColor = uColor;
  } else if (uColorMode == 1) {
    // Palette gradient based on face depth
    baseColor = mix(uPaletteStart, uPaletteEnd, vFaceDepth);
  } else {
    // Depth-based color variation
    baseColor = uColor * (0.6 + 0.4 * vDepth);
  }

  ${options.lighting ? `
  // Lighting calculations
  vec3 ambient = uAmbientColor * uAmbientIntensity;

  // Directional light
  float NdotL = max(dot(vNormal, -uDirectionalDirection), 0.0);
  vec3 diffuse = uDirectionalColor * uDirectionalIntensity * NdotL;

  vec3 litColor = baseColor * (ambient + diffuse);
  ` : `
  vec3 litColor = baseColor;
  `}

  ${options.fresnelEnabled ? `
  // Fresnel rim lighting
  if (uFresnelEnabled) {
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), uFresnelPower);
    litColor += vec3(fresnel * uFresnelIntensity);
  }
  ` : ''}

  gl_FragColor = vec4(litColor, uOpacity);
}
`
}



