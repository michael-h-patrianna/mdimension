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
import type { SurfaceSettings } from '../types'

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
  const { color, faceOpacity, specularIntensity, shininess } = config

  return new MeshPhongMaterial({
    color: new Color(color),
    transparent: true,
    opacity: faceOpacity,
    side: DoubleSide, // Render both sides for n-dimensional objects
    shininess: shininess,
    specular: new Color(0xffffff).multiplyScalar(specularIntensity),
    flatShading: false,
  })
}

/**
 * GLSL vertex shader for fresnel surface material.
 * Uses world-space lighting (same approach as palette shader).
 */
const fresnelVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // Transform position to world space
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vec3 worldPosition = worldPos4.xyz;

  // Transform normal to world space
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  // World-space view direction: from vertex to camera
  vViewDir = normalize(cameraPosition - worldPosition);

  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`

/**
 * GLSL fragment shader for fresnel surface material.
 * All lighting calculations in WORLD SPACE.
 * Simple Three.js MeshPhongMaterial approach (NOT PBR).
 */
const fresnelFragmentShader = `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float opacity;
uniform float fresnelIntensity;
uniform float specularIntensity;
uniform float shininess;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform float ambientIntensity;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // All vectors in WORLD SPACE
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 light = normalize(lightDir);

  // Start with ambient
  vec3 col = baseColor * ambientIntensity;

  // Diffuse (Lambert): NdotL * lightColor * diffuseColor
  float NdotL = max(dot(normal, light), 0.0);
  col += NdotL * lightColor * baseColor;

  // Specular (Blinn-Phong): pow(NdotH, shininess) * lightColor * specularIntensity
  // Simple Three.js Phong - NO Fresnel on specular, NO microfacet terms
  vec3 halfDir = normalize(light + viewDir);
  float NdotH = max(dot(normal, halfDir), 0.0);
  float specularTerm = pow(NdotH, shininess) * specularIntensity;
  col += lightColor * specularTerm;

  // Rim lighting (additive, modulated by light direction)
  // This is the only place fresnel effect is applied - for silhouette glow
  if (fresnelIntensity > 0.0) {
    float NdotV = max(dot(normal, viewDir), 0.0);
    float rim = pow(1.0 - NdotV, 3.0) * fresnelIntensity;
    rim *= (0.3 + 0.7 * NdotL);
    col += rimColor * rim;
  }

  gl_FragColor = vec4(col, opacity);
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
  const { color, edgeColor = '#FFFFFF', faceOpacity, specularIntensity, shininess } = config

  return new ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      baseColor: { value: new Color(color) },
      rimColor: { value: new Color(edgeColor) },
      opacity: { value: faceOpacity },
      fresnelIntensity: { value: 0.5 }, // Default fresnel strength
      specularIntensity: { value: specularIntensity },
      shininess: { value: shininess },
      lightDir: { value: new Vector3(0.5, 0.5, 0.5).normalize() },
      lightColor: { value: new Color('#FFFFFF') },
      ambientIntensity: { value: 0.5 },
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
    shininess: number
    lightDirection: [number, number, number]
    lightColor: string
    ambientIntensity: number
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
  if (updates.shininess !== undefined) {
    material.uniforms.shininess!.value = updates.shininess
  }
  if (updates.lightDirection !== undefined) {
    const [x, y, z] = updates.lightDirection
    material.uniforms.lightDir!.value = new Vector3(x, y, z).normalize()
  }
  if (updates.lightColor !== undefined) {
    material.uniforms.lightColor!.value = new Color(updates.lightColor)
  }
  if (updates.ambientIntensity !== undefined) {
    material.uniforms.ambientIntensity!.value = updates.ambientIntensity
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
 *
 * IMPORTANT: Normals are passed through WITHOUT normalMatrix transformation.
 * This is because vertices are pre-rotated on CPU (for n-dimensional rotation),
 * so the normals calculated from those vertices are already in world space.
 * The mesh has identity modelMatrix, so world space = object space.
 *
 * For world-space lighting:
 * - Normals stay in world space (no normalMatrix transform)
 * - Light direction stays in world space (no viewMatrix transform in fragment)
 * - Lighting calculation happens entirely in world space
 */
const paletteVertexShader = `
attribute float faceDepth;

varying float vDepth;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPosition;

void main() {
  // Transform position to world space (handles any mesh transform)
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos4.xyz;

  // Transform normal to world space
  // Use inverse transpose of modelMatrix for proper normal transformation
  // For uniform scale or no scale, we can use the upper 3x3 of modelMatrix
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  // World-space view direction: from vertex position to camera
  vViewDir = normalize(cameraPosition - vWorldPosition);

  vDepth = faceDepth;
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`

// Concatenate palette functions with core shader
/**
 * Fragment shader for palette surface material with world-space lighting.
 *
 * All lighting calculations happen in WORLD SPACE:
 * - vNormal: world-space normal (from vertex shader, no normalMatrix transform)
 * - vViewDir: world-space view direction (from vertex to camera)
 * - uLightDir: world-space light direction (from CPU uniform, no viewMatrix transform)
 *
 * This ensures consistent lighting behavior:
 * - When object rotates (via CPU vertex rotation), normals change → lighting changes
 * - When camera orbits, vViewDir changes (affects fresnel/specular) but diffuse stays consistent
 * - Light direction is fixed in world space regardless of camera position
 */
const paletteFragmentShader =
  GLSL_PALETTE_FUNCTIONS +
  `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float opacity;
uniform float fresnelIntensity;
uniform int paletteMode;
uniform float uAmbientIntensity;
uniform float uSpecularIntensity;
uniform float uShininess;
uniform vec3 uLightDir;
uniform bool uLightEnabled;
uniform vec3 uLightColor;
// Enhanced lighting uniforms
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;

varying float vDepth;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // All vectors are in WORLD SPACE
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 lightDir = normalize(uLightDir);

  // Convert base color to HSL and generate palette color per-fragment
  vec3 baseHSL = rgb2hsl(baseColor);
  vec3 surfaceColor = getPaletteColor(baseHSL, vDepth, paletteMode);

  // Start with ambient light
  vec3 col = surfaceColor * uAmbientIntensity;

  // Diffuse and specular need NdotL for both lighting and rim modulation
  float NdotL = 0.0;

  // Add directional light contribution if enabled
  // Using simple Three.js MeshPhongMaterial approach (NOT PBR)
  if (uLightEnabled) {
    // Diffuse (Lambert): NdotL * lightColor * diffuseColor
    NdotL = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = NdotL * uLightColor * surfaceColor * uDiffuseIntensity;
    col += diffuse;

    // Specular (Blinn-Phong): pow(NdotH, shininess) * lightColor * specularColor
    // Simple Three.js Phong - NO Fresnel, NO microfacet terms
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specularTerm = pow(NdotH, uShininess) * uSpecularIntensity;
    vec3 specular = specularTerm * uLightColor * uSpecularColor;
    col += specular;

    // Rim/edge lighting for silhouette definition (optional extra, not in Three.js Phong)
    if (fresnelIntensity > 0.0) {
      float NdotV = max(dot(normal, viewDir), 0.0);
      float rim = pow(1.0 - NdotV, 3.0) * fresnelIntensity;
      rim *= (0.3 + 0.7 * NdotL);
      col += rimColor * rim;
    }
  }

  gl_FragColor = vec4(col, opacity);
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
    shininess,
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
      uShininess: { value: shininess },
      uLightDir: { value: new Vector3(0.5, 0.5, 0.5).normalize() },
      uLightEnabled: { value: true },
      uLightColor: { value: new Color('#FFFFFF') },
      // Enhanced lighting uniforms
      uSpecularColor: { value: new Color('#FFFFFF') },
      uDiffuseIntensity: { value: 1.0 },
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
    shininess: number
    ambientIntensity: number
    lightDirection: [number, number, number]
    lightEnabled: boolean
    lightColor: string
    colorMode: ColorMode
    // Enhanced lighting parameters
    specularColor: string
    diffuseIntensity: number
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
  if (updates.shininess !== undefined) {
    material.uniforms.uShininess!.value = updates.shininess
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
  if (updates.lightColor !== undefined) {
    material.uniforms.uLightColor!.value = new Color(updates.lightColor)
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

  material.needsUpdate = true
}

// ============================================================================
// MeshPhongMaterial with onBeforeCompile (Three.js native Phong + custom features)
// ============================================================================

/**
 * GLSL custom uniform declarations for injection into MeshPhongMaterial.
 * These are added after #include <common> in the fragment shader.
 */
const PHONG_CUSTOM_UNIFORMS_GLSL = `
// Custom uniforms for palette and fresnel
uniform vec3 uRimColor;
uniform float uFresnelIntensity;
uniform int uPaletteMode;

// Custom varyings (vNormal is already provided by Three.js Phong shader)
varying float vDepth;
varying vec3 vWorldPosition;
`

/**
 * GLSL opaque fragment replacement with fresnel rim lighting.
 * Replaces #include <opaque_fragment> to add fresnel effect before output.
 * At this point, outgoingLight is fully computed and in scope.
 */
const PHONG_OPAQUE_WITH_FRESNEL_GLSL = `
// Fresnel rim lighting for silhouette glow
#ifndef FLAT_SHADED
  vec3 fresnelNormal = normalize(vNormal);
#else
  vec3 fresnelNormal = normal;
#endif

if (uFresnelIntensity > 0.0) {
  vec3 fresnelViewDir = normalize(cameraPosition - vWorldPosition);
  float fresnelNdotV = max(dot(fresnelNormal, fresnelViewDir), 0.0);
  // Fresnel rim: stronger at grazing angles (where NdotV approaches 0)
  float fresnelRim = pow(1.0 - fresnelNdotV, 3.0) * uFresnelIntensity * 2.0;
  // Add rim color glow to edges
  outgoingLight += uRimColor * fresnelRim;
}

// Standard opaque fragment output
#ifdef OPAQUE
gl_FragColor = vec4( outgoingLight, 1.0 );
#else
gl_FragColor = vec4( outgoingLight, diffuseColor.a );
#endif
`

/**
 * Helper to convert ColorMode string to int for shader uniform.
 */
function colorModeToInt(mode: ColorMode): number {
  const modeMap: Record<ColorMode, number> = {
    monochromatic: 0,
    analogous: 1,
    complementary: 2,
    triadic: 3,
    splitComplementary: 4,
  }
  return modeMap[mode]
}

/**
 * Updates interface for MeshPhongMaterial with custom uniforms.
 */
export interface PhongPaletteMaterialUpdates {
  color: string
  rimColor: string
  opacity: number
  fresnelIntensity: number
  specularIntensity: number
  specularColor: string
  shininess: number
  colorMode: ColorMode
}

/**
 * Create a MeshPhongMaterial with custom shader injection for palette colors
 * and fresnel rim lighting.
 *
 * Uses Three.js built-in Phong lighting with `onBeforeCompile` to inject:
 * - faceDepth attribute for per-face palette color variation
 * - Fresnel rim lighting effect
 *
 * This approach leverages Three.js native lighting while adding custom features,
 * reducing maintenance burden and ensuring compatibility with future Three.js updates.
 *
 * @param config - Material configuration including colorMode
 * @returns MeshPhongMaterial with custom shader modifications
 *
 * @example
 * ```ts
 * const material = createPhongPaletteMaterial({
 *   color: '#8800FF',
 *   edgeColor: '#00FFFF',
 *   faceOpacity: 0.8,
 *   specularIntensity: 0.5,
 *   shininess: 30,
 *   fresnelEnabled: true,
 *   colorMode: 'analogous',
 * });
 * ```
 */
export function createPhongPaletteMaterial(config: PaletteSurfaceMaterialConfig): MeshPhongMaterial {
  const {
    color,
    edgeColor = '#FFFFFF',
    faceOpacity,
    specularIntensity,
    shininess,
    fresnelEnabled,
    colorMode,
  } = config

  // Create base MeshPhongMaterial with standard Phong properties
  const material = new MeshPhongMaterial({
    color: new Color(color),
    transparent: true,
    opacity: faceOpacity,
    side: DoubleSide,
    shininess: shininess,
    specular: new Color(0xffffff).multiplyScalar(specularIntensity),
    flatShading: false,
  })

  // Define custom uniforms that will be injected into the shader
  const customUniforms = {
    uRimColor: { value: new Color(edgeColor) },
    uFresnelIntensity: { value: fresnelEnabled ? 0.5 : 0.0 },
    uPaletteMode: { value: colorModeToInt(colorMode) },
  }

  // Store custom uniforms for later access via update function
  material.userData.customUniforms = customUniforms

  // Modify the shader at compile time
  material.onBeforeCompile = (shader) => {
    // Merge custom uniforms into shader uniforms
    Object.assign(shader.uniforms, customUniforms)

    // ========== VERTEX SHADER MODIFICATIONS ==========

    // 1. Add faceDepth attribute and custom varyings before #define PHONG
    // Note: vNormal is already provided by Three.js Phong shader
    shader.vertexShader = shader.vertexShader.replace(
      '#define PHONG',
      `attribute float faceDepth;
varying float vDepth;
varying vec3 vWorldPosition;
#define PHONG`
    )

    // 2. Pass faceDepth and world position to fragment shader after begin_vertex
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vDepth = faceDepth;
vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
    )

    // ========== FRAGMENT SHADER MODIFICATIONS ==========

    // 1. Add custom uniforms and palette functions after <common>
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
${PHONG_CUSTOM_UNIFORMS_GLSL}
${GLSL_PALETTE_FUNCTIONS}`
    )

    // 2. Apply palette color to diffuseColor after <color_fragment>
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
// Apply palette-based color variation using faceDepth
{
  vec3 baseHSL = rgb2hsl(diffuseColor.rgb);
  diffuseColor.rgb = getPaletteColor(baseHSL, vDepth, uPaletteMode);
}`
    )

    // 3. Replace opaque_fragment with fresnel + output (outgoingLight is in scope here)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      PHONG_OPAQUE_WITH_FRESNEL_GLSL
    )

    // Store shader reference for uniform updates
    material.userData.shader = shader
  }

  // Unique cache key to prevent shader reuse issues
  // Version number can be bumped if shader code changes
  material.customProgramCacheKey = () => `phong-palette-v1`

  return material
}

/**
 * Update MeshPhongMaterial with custom uniforms.
 *
 * Updates both native MeshPhongMaterial properties and custom shader uniforms.
 * Handles the case where shader hasn't been compiled yet by storing updates
 * in userData for later application.
 *
 * @param material - MeshPhongMaterial created by createPhongPaletteMaterial
 * @param updates - Properties to update
 *
 * @example
 * ```ts
 * updatePhongPaletteMaterial(material, {
 *   color: '#FF0000',
 *   fresnelIntensity: 0.8,
 *   colorMode: 'complementary',
 * });
 * ```
 */
export function updatePhongPaletteMaterial(
  material: MeshPhongMaterial,
  updates: Partial<PhongPaletteMaterialUpdates>
): void {
  // Update native MeshPhongMaterial properties directly
  if (updates.color !== undefined) {
    material.color.set(updates.color)
  }
  if (updates.opacity !== undefined) {
    material.opacity = updates.opacity
  }
  if (updates.specularIntensity !== undefined) {
    material.specular.setScalar(updates.specularIntensity)
  }
  if (updates.specularColor !== undefined) {
    material.specular.set(updates.specularColor)
  }
  if (updates.shininess !== undefined) {
    material.shininess = updates.shininess
  }

  // Update custom uniforms via shader reference (if compiled)
  const shader = material.userData.shader
  if (shader) {
    if (updates.rimColor !== undefined) {
      shader.uniforms.uRimColor.value.set(updates.rimColor)
    }
    if (updates.fresnelIntensity !== undefined) {
      shader.uniforms.uFresnelIntensity.value = updates.fresnelIntensity
    }
    if (updates.colorMode !== undefined) {
      shader.uniforms.uPaletteMode.value = colorModeToInt(updates.colorMode)
    }
  }

  // Also update userData.customUniforms for pre-compilation state
  const customUniforms = material.userData.customUniforms
  if (customUniforms) {
    if (updates.rimColor !== undefined) {
      customUniforms.uRimColor.value.set(updates.rimColor)
    }
    if (updates.fresnelIntensity !== undefined) {
      customUniforms.uFresnelIntensity.value = updates.fresnelIntensity
    }
    if (updates.colorMode !== undefined) {
      customUniforms.uPaletteMode.value = colorModeToInt(updates.colorMode)
    }
  }

  // Mark material as needing update for any changes that affect rendering
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
