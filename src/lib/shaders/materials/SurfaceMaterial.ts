/**
 * Surface Material for Polytope Face Rendering
 *
 * Creates Three.js materials for rendering filled polytope faces
 * with Phong lighting model and optional fresnel rim lighting.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import {
  MeshPhongMaterial,
  ShaderMaterial,
  Color,
  DoubleSide,
  AdditiveBlending,
} from 'three';
import type { SurfaceSettings } from '../types';
import { GLSL_PALETTE_FUNCTIONS } from '../palette';
import type { ColorMode } from '../palette';

/**
 * Configuration for surface material creation
 */
export interface SurfaceMaterialConfig extends SurfaceSettings {
  /** Face color (hex string) */
  color: string;
  /** Edge color for rim/fresnel effect (hex string) */
  edgeColor?: string;
}

/**
 * Create a basic Phong surface material without fresnel.
 *
 * Uses Three.js MeshPhongMaterial for standard Phong lighting:
 * ambient + diffuse + specular components.
 *
 * @param config - Material configuration
 * @returns MeshPhongMaterial instance
 *
 * @example
 * ```ts
 * const material = createBasicSurfaceMaterial({
 *   color: '#8800FF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 1.0,
 *   specularPower: 32,
 *   fresnelEnabled: false,
 * });
 * ```
 */
export function createBasicSurfaceMaterial(config: SurfaceMaterialConfig): MeshPhongMaterial {
  const { color, faceOpacity, specularIntensity, specularPower } = config;

  return new MeshPhongMaterial({
    color: new Color(color),
    transparent: true,
    opacity: faceOpacity,
    side: DoubleSide, // Render both sides for n-dimensional objects
    shininess: specularPower,
    specular: new Color(0xffffff).multiplyScalar(specularIntensity),
    flatShading: false,
  });
}

/**
 * GLSL vertex shader for fresnel surface material.
 */
const fresnelVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * GLSL fragment shader for fresnel surface material.
 */
const fresnelFragmentShader = `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float opacity;
uniform float fresnelIntensity;
uniform float specularIntensity;
uniform float specularPower;
uniform vec3 lightDir;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);

  // Fresnel effect (rim lighting)
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

  // Basic Phong-like diffuse
  float diffuse = max(dot(normal, lightDir), 0.0) * 0.5 + 0.5;

  // Specular highlight
  vec3 reflectDir = reflect(-lightDir, normal);
  float specular = pow(max(dot(viewDir, reflectDir), 0.0), specularPower) * specularIntensity;

  // Combine colors
  vec3 color = baseColor * diffuse;
  color += vec3(1.0) * specular;
  color = mix(color, rimColor, fresnel * fresnelIntensity);

  gl_FragColor = vec4(color, opacity);
}
`;

/**
 * Create an advanced surface material with fresnel rim lighting.
 *
 * Uses custom ShaderMaterial for:
 * - Phong-like diffuse lighting
 * - Specular highlights
 * - Fresnel rim lighting effect
 *
 * @param config - Material configuration
 * @returns ShaderMaterial instance
 *
 * @example
 * ```ts
 * const material = createFresnelSurfaceMaterial({
 *   color: '#8800FF',
 *   edgeColor: '#00FFFF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 1.0,
 *   specularPower: 32,
 *   fresnelEnabled: true,
 * });
 * ```
 */
export function createFresnelSurfaceMaterial(config: SurfaceMaterialConfig): ShaderMaterial {
  const {
    color,
    edgeColor = '#FFFFFF',
    faceOpacity,
    specularIntensity,
    specularPower,
  } = config;

  return new ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      baseColor: { value: new Color(color) },
      rimColor: { value: new Color(edgeColor) },
      opacity: { value: faceOpacity },
      fresnelIntensity: { value: 0.5 }, // Default fresnel strength
      specularIntensity: { value: specularIntensity },
      specularPower: { value: specularPower },
      lightDir: { value: new Color(0.5, 0.5, 0.5) }, // Normalized light direction
    },
    transparent: true,
    side: DoubleSide,
  });
}

/**
 * Create the appropriate surface material based on settings.
 *
 * Automatically selects between basic Phong and fresnel-enhanced
 * materials based on the fresnelEnabled setting.
 *
 * @param config - Material configuration
 * @returns Material instance (MeshPhongMaterial or ShaderMaterial)
 *
 * @example
 * ```ts
 * const material = createSurfaceMaterial({
 *   color: '#8800FF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 1.0,
 *   specularPower: 32,
 *   fresnelEnabled: true, // Will use fresnel shader
 * });
 * ```
 */
export function createSurfaceMaterial(
  config: SurfaceMaterialConfig
): MeshPhongMaterial | ShaderMaterial {
  if (config.fresnelEnabled) {
    return createFresnelSurfaceMaterial(config);
  }
  return createBasicSurfaceMaterial(config);
}

/**
 * Update fresnel material uniforms.
 *
 * Call this to update material properties without recreating the material.
 *
 * @param material - ShaderMaterial created by createFresnelSurfaceMaterial
 * @param updates - Properties to update
 */
export function updateFresnelMaterial(
  material: ShaderMaterial,
  updates: Partial<{
    color: string;
    rimColor: string;
    opacity: number;
    fresnelIntensity: number;
    specularIntensity: number;
    specularPower: number;
    lightDirection: [number, number, number];
  }>
): void {
  if (updates.color !== undefined) {
    material.uniforms.baseColor!.value = new Color(updates.color);
  }
  if (updates.rimColor !== undefined) {
    material.uniforms.rimColor!.value = new Color(updates.rimColor);
  }
  if (updates.opacity !== undefined) {
    material.uniforms.opacity!.value = updates.opacity;
  }
  if (updates.fresnelIntensity !== undefined) {
    material.uniforms.fresnelIntensity!.value = updates.fresnelIntensity;
  }
  if (updates.specularIntensity !== undefined) {
    material.uniforms.specularIntensity!.value = updates.specularIntensity;
  }
  if (updates.specularPower !== undefined) {
    material.uniforms.specularPower!.value = updates.specularPower;
  }
  if (updates.lightDirection !== undefined) {
    const [x, y, z] = updates.lightDirection;
    // Normalize and store in lightDir uniform
    const len = Math.sqrt(x * x + y * y + z * z);
    material.uniforms.lightDir!.value.setRGB(x / len, y / len, z / len);
  }

  material.needsUpdate = true;
}

// ============================================================================
// Palette Surface Material (for depth-based color variation)
// ============================================================================

/**
 * Configuration for palette surface material
 */
export interface PaletteSurfaceMaterialConfig extends SurfaceMaterialConfig {
  /** Color mode for palette generation */
  colorMode: ColorMode;
}

/**
 * GLSL vertex shader for palette surface material.
 * Passes faceDepth attribute to fragment shader for palette variation.
 */
const paletteVertexShader = `
attribute float faceDepth;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDepth;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  vDepth = faceDepth;
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * GLSL fragment shader for palette surface material.
 * Uses shared palette functions for color generation based on depth.
 * Note: This must be concatenated with GLSL_PALETTE_FUNCTIONS.
 */
const paletteFragmentShaderCore = `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float opacity;
uniform float fresnelIntensity;
uniform float specularIntensity;
uniform float specularPower;
uniform vec3 lightDir;
uniform int paletteMode;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDepth;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);

  // Convert base color to HSL and generate palette color
  vec3 baseHSL = rgb2hsl(baseColor);
  vec3 surfaceColor = getPaletteColor(baseHSL, vDepth, paletteMode);

  // Fresnel effect (rim lighting)
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

  // Basic Phong-like diffuse
  float diffuse = max(dot(normal, lightDir), 0.0) * 0.5 + 0.5;

  // Specular highlight
  vec3 reflectDir = reflect(-lightDir, normal);
  float specular = pow(max(dot(viewDir, reflectDir), 0.0), specularPower) * specularIntensity;

  // Combine colors
  vec3 color = surfaceColor * diffuse;
  color += vec3(1.0) * specular;
  color = mix(color, rimColor, fresnel * fresnelIntensity);

  gl_FragColor = vec4(color, opacity);
}
`;

// Concatenate palette functions with core shader
const paletteFragmentShader = GLSL_PALETTE_FUNCTIONS + paletteFragmentShaderCore;

/**
 * Create a palette-aware surface material with depth-based color variation.
 *
 * Uses custom ShaderMaterial with:
 * - Per-face depth attribute for palette variation
 * - Color theory-based palette modes (monochromatic, analogous, etc.)
 * - Phong-like diffuse lighting
 * - Specular highlights
 * - Optional fresnel rim lighting
 *
 * @param config - Material configuration including colorMode
 * @returns ShaderMaterial instance
 *
 * @example
 * ```ts
 * const material = createPaletteSurfaceMaterial({
 *   color: '#8800FF',
 *   edgeColor: '#00FFFF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 1.0,
 *   specularPower: 32,
 *   fresnelEnabled: true,
 *   colorMode: 'complementary',
 * });
 * ```
 */
export function createPaletteSurfaceMaterial(config: PaletteSurfaceMaterialConfig): ShaderMaterial {
  const {
    color,
    edgeColor = '#FFFFFF',
    faceOpacity,
    specularIntensity,
    specularPower,
    fresnelEnabled,
    colorMode,
  } = config;

  // Map colorMode string to int for shader
  const modeMap: Record<ColorMode, number> = {
    monochromatic: 0,
    analogous: 1,
    complementary: 2,
    triadic: 3,
    splitComplementary: 4,
  };

  return new ShaderMaterial({
    vertexShader: paletteVertexShader,
    fragmentShader: paletteFragmentShader,
    uniforms: {
      baseColor: { value: new Color(color) },
      rimColor: { value: new Color(edgeColor) },
      opacity: { value: faceOpacity },
      fresnelIntensity: { value: fresnelEnabled ? 0.5 : 0.0 },
      specularIntensity: { value: specularIntensity },
      specularPower: { value: specularPower },
      lightDir: { value: new Color(0.5, 0.5, 0.5) }, // Normalized light direction
      paletteMode: { value: modeMap[colorMode] },
    },
    transparent: true,
    side: DoubleSide,
  });
}

/**
 * Update palette material uniforms.
 *
 * Call this to update material properties without recreating the material.
 *
 * @param material - ShaderMaterial created by createPaletteSurfaceMaterial
 * @param updates - Properties to update
 */
export function updatePaletteMaterial(
  material: ShaderMaterial,
  updates: Partial<{
    color: string;
    rimColor: string;
    opacity: number;
    fresnelIntensity: number;
    specularIntensity: number;
    specularPower: number;
    lightDirection: [number, number, number];
    colorMode: ColorMode;
  }>
): void {
  if (updates.color !== undefined) {
    material.uniforms.baseColor!.value = new Color(updates.color);
  }
  if (updates.rimColor !== undefined) {
    material.uniforms.rimColor!.value = new Color(updates.rimColor);
  }
  if (updates.opacity !== undefined) {
    material.uniforms.opacity!.value = updates.opacity;
  }
  if (updates.fresnelIntensity !== undefined) {
    material.uniforms.fresnelIntensity!.value = updates.fresnelIntensity;
  }
  if (updates.specularIntensity !== undefined) {
    material.uniforms.specularIntensity!.value = updates.specularIntensity;
  }
  if (updates.specularPower !== undefined) {
    material.uniforms.specularPower!.value = updates.specularPower;
  }
  if (updates.lightDirection !== undefined) {
    const [x, y, z] = updates.lightDirection;
    const len = Math.sqrt(x * x + y * y + z * z);
    material.uniforms.lightDir!.value.setRGB(x / len, y / len, z / len);
  }
  if (updates.colorMode !== undefined) {
    const modeMap: Record<ColorMode, number> = {
      monochromatic: 0,
      analogous: 1,
      complementary: 2,
      triadic: 3,
      splitComplementary: 4,
    };
    material.uniforms.paletteMode!.value = modeMap[updates.colorMode];
  }

  material.needsUpdate = true;
}

/**
 * Create a glow/halo material for edge glow effect.
 *
 * Uses additive blending for soft glow around edges.
 *
 * @param color - Glow color (hex string)
 * @param intensity - Glow intensity (0-2)
 * @returns ShaderMaterial for glow effect
 */
export function createGlowMaterial(color: string, intensity: number): ShaderMaterial {
  const glowVertexShader = `
    varying float vIntensity;

    void main() {
      vec3 vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec3 viewDir = normalize(-mvPosition.xyz);

      // Fresnel-based glow intensity
      vIntensity = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const glowFragmentShader = `
    uniform vec3 glowColor;
    uniform float glowIntensity;

    varying float vIntensity;

    void main() {
      float alpha = vIntensity * glowIntensity;
      gl_FragColor = vec4(glowColor, alpha);
    }
  `;

  return new ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
      glowColor: { value: new Color(color) },
      glowIntensity: { value: intensity },
    },
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
  });
}
