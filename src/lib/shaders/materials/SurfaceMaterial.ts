/**
 * Surface Material for Polytope Face Rendering
 *
 * Creates Three.js materials for rendering filled polytope faces
 * with Phong lighting model and optional fresnel rim lighting.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshPhongMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { ColorMode } from '../palette'
import { GLSL_PALETTE_FUNCTIONS } from '../palette'
import type { SurfaceSettings, ToneMappingAlgorithm } from '../types'
import { TONE_MAPPING_TO_INT } from '../types'

/**
 * Configuration for surface material creation
 */
export interface SurfaceMaterialConfig extends SurfaceSettings {
  /** Face color (hex string) */
  color: string
  /** Edge color for rim/fresnel effect (hex string) */
  edgeColor?: string
}

/**
 * Create a basic Phong surface material without fresnel.
 *
 * Uses Three.js MeshPhongMaterial for standard Phong lighting:
 * ambient + diffuse + specular components.
 *
        diffuse: { value: new Color(1, 1, 1) },
        specular: { value: new Color(1, 1, 1) },
        shininess: { value: specularPower },
        specularStrength: { value: specularIntensity },
 *   color: '#8800FF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 1.0,
 *   specularPower: 32,
 *   fresnelEnabled: false,
 * });
 * ```
 */
export function createBasicSurfaceMaterial(config: SurfaceMaterialConfig): MeshPhongMaterial {
  const { color, faceOpacity, specularIntensity, specularPower } = config

  return new MeshPhongMaterial({
    color: new Color(color),
    transparent: true,
    opacity: faceOpacity,
    side: DoubleSide, // Render both sides for n-dimensional objects
    shininess: specularPower,
    specular: new Color(0xffffff).multiplyScalar(specularIntensity),
    flatShading: false,
  })
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
`

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
`

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
  const { color, edgeColor = '#FFFFFF', faceOpacity, specularIntensity, specularPower } = config

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
  })
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
    return createFresnelSurfaceMaterial(config)
  }
  return createBasicSurfaceMaterial(config)
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
    color: string
    rimColor: string
    opacity: number
    fresnelIntensity: number
    specularIntensity: number
    specularPower: number
    lightDirection: [number, number, number]
  }>
): void {
  if (updates.color !== undefined) {
    material.uniforms.baseColor!.value = new Color(updates.color)
  }
  if (updates.rimColor !== undefined) {
    material.uniforms.rimColor!.value = new Color(updates.rimColor)
  }
  if (updates.opacity !== undefined) {
    material.uniforms.opacity!.value = updates.opacity
  }
  if (updates.fresnelIntensity !== undefined) {
    material.uniforms.fresnelIntensity!.value = updates.fresnelIntensity
  }
  if (updates.specularIntensity !== undefined) {
    material.uniforms.specularIntensity!.value = updates.specularIntensity
  }
  if (updates.specularPower !== undefined) {
    material.uniforms.specularPower!.value = updates.specularPower
  }
  if (updates.lightDirection !== undefined) {
    const [x, y, z] = updates.lightDirection
    // Normalize and store in lightDir uniform
    const len = Math.sqrt(x * x + y * y + z * z)
    material.uniforms.lightDir!.value.setRGB(x / len, y / len, z / len)
  }

  material.needsUpdate = true
}

// ============================================================================
// Palette Surface Material (for depth-based color variation)
// ============================================================================

/**
 * Configuration for palette surface material
 */
export interface PaletteSurfaceMaterialConfig extends SurfaceMaterialConfig {
  /** Color mode for palette generation */
  colorMode: ColorMode
}

/**
 * GLSL vertex shader for palette surface material.
 * Passes faceDepth attribute to fragment shader for palette variation.
 */
const paletteVertexShader = `
attribute float faceDepth;

varying float vDepth;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vDepth = faceDepth;
  gl_Position = projectionMatrix * mvPosition;
}
`

// ============================================================================
// GLSL Tone Mapping Functions
// ============================================================================

const GLSL_TONE_MAPPING = `
// Tone mapping functions
vec3 reinhardToneMap(vec3 c) {
  return c / (c + vec3(1.0));
}

vec3 acesToneMap(vec3 c) {
  // ACES filmic tone mapping approximation
  const float a = 2.51;
  const float b = 0.03;
  const float c2 = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((c * (a * c + b)) / (c * (c2 * c + d) + e), 0.0, 1.0);
}

vec3 uncharted2ToneMap(vec3 c) {
  // Uncharted 2 filmic tone mapping
  const float A = 0.15;
  const float B = 0.50;
  const float C = 0.10;
  const float D = 0.20;
  const float E = 0.02;
  const float F = 0.30;
  const float W = 11.2;

  vec3 curr = ((c * (A * c + C * B) + D * E) / (c * (A * c + B) + D * F)) - E / F;
  vec3 white = ((vec3(W) * (A * W + C * B) + D * E) / (vec3(W) * (A * W + B) + D * F)) - E / F;
  return curr / white;
}

vec3 applyToneMapping(vec3 c, int algo, float exposure) {
  vec3 exposed = c * exposure;
  if (algo == 0) return reinhardToneMap(exposed);
  if (algo == 1) return acesToneMap(exposed);
  if (algo == 2) return uncharted2ToneMap(exposed);
  return clamp(exposed, 0.0, 1.0); // fallback: simple clamp
}

// Fresnel (Schlick approximation)
float fresnelSchlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
`

// Concatenate palette functions with tone mapping and core shader
const paletteFragmentShader =
  GLSL_PALETTE_FUNCTIONS +
  GLSL_TONE_MAPPING +
  `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float opacity;
uniform float fresnelIntensity;
uniform int paletteMode;
uniform float uAmbientIntensity;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform vec3 uLightDir;
uniform bool uLightEnabled;
// Enhanced lighting uniforms
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;
uniform bool uToneMappingEnabled;
uniform int uToneMappingAlgorithm;
uniform float uExposure;

varying float vDepth;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // Convert base color to HSL and generate palette color per-fragment
  vec3 baseHSL = rgb2hsl(baseColor);
  vec3 surfaceColor = getPaletteColor(baseHSL, vDepth, paletteMode);

  // Fresnel rim effect (for rim lighting)
  float rimFresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

  // Start with ambient light
  vec3 lighting = surfaceColor * uAmbientIntensity;

  // Add directional light contribution if enabled
  if (uLightEnabled) {
    // Energy conservation: diffuse weight = 1.0 - ambient
    float diffuseWeight = 1.0 - uAmbientIntensity;

    // Diffuse (Lambert) with energy conservation and intensity control
    float NdotL = max(dot(normal, uLightDir), 0.0);
    float diffuse = NdotL * uDiffuseIntensity * diffuseWeight;
    lighting += surfaceColor * diffuse;

    // Specular (Blinn-Phong) with Fresnel attenuation
    vec3 halfDir = normalize(uLightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float VdotH = max(dot(viewDir, halfDir), 0.0);

    // Fresnel: F0 = 0.04 for non-metallic surfaces
    float F = fresnelSchlick(VdotH, 0.04);
    float specular = pow(NdotH, uSpecularPower) * uSpecularIntensity * F;
    lighting += uSpecularColor * specular;
  }

  // Apply fresnel rim
  vec3 outgoingLight = mix(lighting, rimColor, rimFresnel * fresnelIntensity);

  // Apply tone mapping as final step
  if (uToneMappingEnabled) {
    outgoingLight = applyToneMapping(outgoingLight, uToneMappingAlgorithm, uExposure);
  }

  gl_FragColor = vec4(outgoingLight, opacity);
}
`

/**
 * Create a palette-aware surface material with depth-based color variation.
 *
 * Uses custom ShaderMaterial with:
 * - Per-face depth attribute for palette variation
 * - Color theory-based palette modes (monochromatic, analogous, etc.)
 * - Phong-like diffuse lighting (using Three.js lights)
 * - Specular highlights
 * - Optional fresnel rim lighting
 *
 * @param config - Material configuration including colorMode
 * @returns ShaderMaterial instance
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
  } = config

  // Map colorMode string to int for shader
  const modeMap: Record<ColorMode, number> = {
    monochromatic: 0,
    analogous: 1,
    complementary: 2,
    triadic: 3,
    splitComplementary: 4,
  }

  return new ShaderMaterial({
    vertexShader: paletteVertexShader,
    fragmentShader: paletteFragmentShader,
    uniforms: {
      baseColor: { value: new Color(color) },
      rimColor: { value: new Color(edgeColor) },
      opacity: { value: faceOpacity },
      fresnelIntensity: { value: fresnelEnabled ? 0.5 : 0.0 },
      paletteMode: { value: modeMap[colorMode] },
      uAmbientIntensity: { value: 0.5 },
      uSpecularIntensity: { value: specularIntensity },
      uSpecularPower: { value: specularPower },
      uLightDir: { value: new Vector3(0.5, 0.5, 0.5).normalize() },
      uLightEnabled: { value: true },
      // Enhanced lighting uniforms
      uSpecularColor: { value: new Color('#FFFFFF') },
      uDiffuseIntensity: { value: 1.0 },
      uToneMappingEnabled: { value: true },
      uToneMappingAlgorithm: { value: 0 }, // 0 = reinhard
      uExposure: { value: 1.0 },
    },
    transparent: true,
    side: DoubleSide,
  })
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
    color: string
    rimColor: string
    opacity: number
    fresnelIntensity: number
    specularIntensity: number
    specularPower: number
    ambientIntensity: number
    lightDirection: [number, number, number]
    lightEnabled: boolean
    colorMode: ColorMode
    // Enhanced lighting parameters
    specularColor: string
    diffuseIntensity: number
    toneMappingEnabled: boolean
    toneMappingAlgorithm: ToneMappingAlgorithm
    exposure: number
  }>
): void {
  if (updates.color !== undefined) {
    material.uniforms.baseColor!.value = new Color(updates.color)
  }
  if (updates.rimColor !== undefined) {
    material.uniforms.rimColor!.value = new Color(updates.rimColor)
  }
  if (updates.opacity !== undefined) {
    material.uniforms.opacity!.value = updates.opacity
  }
  if (updates.fresnelIntensity !== undefined) {
    material.uniforms.fresnelIntensity!.value = updates.fresnelIntensity
  }
  if (updates.specularIntensity !== undefined) {
    material.uniforms.uSpecularIntensity!.value = updates.specularIntensity
  }
  if (updates.specularPower !== undefined) {
    material.uniforms.uSpecularPower!.value = updates.specularPower
  }
  if (updates.ambientIntensity !== undefined) {
    material.uniforms.uAmbientIntensity!.value = updates.ambientIntensity
  }
  if (updates.lightDirection !== undefined) {
    const [x, y, z] = updates.lightDirection
    material.uniforms.uLightDir!.value = new Vector3(x, y, z).normalize()
  }
  if (updates.lightEnabled !== undefined) {
    material.uniforms.uLightEnabled!.value = updates.lightEnabled
  }
  if (updates.colorMode !== undefined) {
    const modeMap: Record<ColorMode, number> = {
      monochromatic: 0,
      analogous: 1,
      complementary: 2,
      triadic: 3,
      splitComplementary: 4,
    }
    material.uniforms.paletteMode!.value = modeMap[updates.colorMode]
  }
  // Enhanced lighting parameters
  if (updates.specularColor !== undefined) {
    material.uniforms.uSpecularColor!.value = new Color(updates.specularColor)
  }
  if (updates.diffuseIntensity !== undefined) {
    material.uniforms.uDiffuseIntensity!.value = updates.diffuseIntensity
  }
  if (updates.toneMappingEnabled !== undefined) {
    material.uniforms.uToneMappingEnabled!.value = updates.toneMappingEnabled
  }
  if (updates.toneMappingAlgorithm !== undefined) {
    material.uniforms.uToneMappingAlgorithm!.value =
      TONE_MAPPING_TO_INT[updates.toneMappingAlgorithm]
  }
  if (updates.exposure !== undefined) {
    material.uniforms.uExposure!.value = updates.exposure
  }

  material.needsUpdate = true
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
  `

  const glowFragmentShader = `
    uniform vec3 glowColor;
    uniform float glowIntensity;

    varying float vIntensity;

    void main() {
      float alpha = vIntensity * glowIntensity;
      gl_FragColor = vec4(glowColor, alpha);
    }
  `

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
  })
}
