/**
 * Multi-Light Shader Uniforms
 *
 * Utilities for creating and updating shader uniforms for the multi-light system.
 * Handles conversion between TypeScript light configurations and GLSL uniform arrays.
 *
 * @see docs/prd/advanced-lighting-system.md
 */

import { Color, Vector3 } from 'three'
import type { LightSource } from './types'
import { LIGHT_TYPE_TO_INT, MAX_LIGHTS, rotationToDirection } from './types'

/**
 * Light uniform structure for Three.js ShaderMaterial.
 * Each property is an array of MAX_LIGHTS elements.
 */
export interface LightUniforms {
  /** Number of active lights (0 to MAX_LIGHTS) */
  uNumLights: { value: number }
  /** Whether each light is enabled */
  uLightsEnabled: { value: boolean[] }
  /** Light type integers (0=point, 1=directional, 2=spot) */
  uLightTypes: { value: number[] }
  /** World-space positions */
  uLightPositions: { value: Vector3[] }
  /** Normalized direction vectors */
  uLightDirections: { value: Vector3[] }
  /** RGB colors */
  uLightColors: { value: Color[] }
  /** Intensity multipliers */
  uLightIntensities: { value: number[] }
  /** Spot light cone angles in radians */
  uSpotAngles: { value: number[] }
  /** Spot light penumbra values */
  uSpotPenumbras: { value: number[] }
  /** Precomputed cos(innerAngle) for spotlight cone - avoids per-fragment trig */
  uSpotCosInner: { value: number[] }
  /** Precomputed cos(outerAngle) for spotlight cone - avoids per-fragment trig */
  uSpotCosOuter: { value: number[] }
  /** Light range/distance for attenuation (0 = infinite) */
  uLightRanges: { value: number[] }
  /** Light decay rate (0 = no decay, 2 = physically correct inverse square) */
  uLightDecays: { value: number[] }
}

/**
 * Create initial light uniforms for shader material.
 * All arrays are initialized to MAX_LIGHTS size with default values.
 *
 * @returns Light uniform object ready for ShaderMaterial
 */
export function createLightUniforms(): LightUniforms {
  const enabled: boolean[] = []
  const types: number[] = []
  const positions: Vector3[] = []
  const directions: Vector3[] = []
  const colors: Color[] = []
  const intensities: number[] = []
  const spotAngles: number[] = []
  const spotPenumbras: number[] = []
  const spotCosInner: number[] = []
  const spotCosOuter: number[] = []
  const ranges: number[] = []
  const decays: number[] = []

  for (let i = 0; i < MAX_LIGHTS; i++) {
    enabled.push(false)
    types.push(0)
    positions.push(new Vector3(0, 5, 0))
    directions.push(new Vector3(0, -1, 0))
    colors.push(new Color('#FFFFFF'))
    intensities.push(1.0)
    spotAngles.push(Math.PI / 6) // 30 degrees
    spotPenumbras.push(0.5)
    // Precompute cosines for default 30° cone with 0.5 penumbra
    // Inner angle = 30° * (1 - 0.5) = 15°, Outer angle = 30°
    spotCosInner.push(Math.cos((Math.PI / 6) * 0.5)) // cos(15°) ≈ 0.966
    spotCosOuter.push(Math.cos(Math.PI / 6)) // cos(30°) ≈ 0.866
    ranges.push(0) // 0 = infinite range
    decays.push(2) // 2 = physically correct inverse square
  }

  return {
    uNumLights: { value: 0 },
    uLightsEnabled: { value: enabled },
    uLightTypes: { value: types },
    uLightPositions: { value: positions },
    uLightDirections: { value: directions },
    uLightColors: { value: colors },
    uLightIntensities: { value: intensities },
    uSpotAngles: { value: spotAngles },
    uSpotPenumbras: { value: spotPenumbras },
    uSpotCosInner: { value: spotCosInner },
    uSpotCosOuter: { value: spotCosOuter },
    uLightRanges: { value: ranges },
    uLightDecays: { value: decays },
  }
}

/**
 * Update light uniforms from LightSource array.
 * Modifies uniforms in-place for performance (no new object allocation).
 *
 * @param uniforms - Existing uniforms object to update
 * @param lights - Array of light source configurations
 */
export function updateLightUniforms(uniforms: LightUniforms, lights: LightSource[]): void {
  const numLights = Math.min(lights.length, MAX_LIGHTS)
  uniforms.uNumLights.value = numLights

  const enabled = uniforms.uLightsEnabled.value
  const types = uniforms.uLightTypes.value
  const positions = uniforms.uLightPositions.value
  const directions = uniforms.uLightDirections.value
  const colors = uniforms.uLightColors.value
  const intensities = uniforms.uLightIntensities.value
  const spotAngles = uniforms.uSpotAngles.value
  const spotPenumbras = uniforms.uSpotPenumbras.value
  const spotCosInner = uniforms.uSpotCosInner.value
  const spotCosOuter = uniforms.uSpotCosOuter.value
  const ranges = uniforms.uLightRanges.value
  const decays = uniforms.uLightDecays.value

  for (let i = 0; i < MAX_LIGHTS; i++) {
    const light = lights[i]

    if (light) {
      enabled[i] = light.enabled
      types[i] = LIGHT_TYPE_TO_INT[light.type]
      // Arrays are pre-populated with MAX_LIGHTS elements, safe to use non-null assertion
      positions[i]!.set(light.position[0], light.position[1], light.position[2])

      // Calculate direction from rotation for directional/spot lights
      const dir = rotationToDirection(light.rotation)
      directions[i]!.set(dir[0], dir[1], dir[2])

      colors[i]!.set(light.color)
      intensities[i] = light.intensity

      // Convert cone angle from degrees to radians
      const outerAngleRad = (light.coneAngle * Math.PI) / 180
      const innerAngleRad = outerAngleRad * (1.0 - light.penumbra)
      spotAngles[i] = outerAngleRad
      spotPenumbras[i] = light.penumbra
      // Precompute cosines on CPU to avoid per-fragment trig in shader
      spotCosOuter[i] = Math.cos(outerAngleRad)
      spotCosInner[i] = Math.cos(innerAngleRad)

      // Range and decay for distance attenuation
      ranges[i] = light.range
      decays[i] = light.decay
    } else {
      // Disable unused light slots
      enabled[i] = false
    }
  }
}

/**
 * Generate GLSL uniform declarations for multi-light system.
 * Used for inline shader strings in PolytopeScene.
 *
 * @returns GLSL uniform declaration string
 */
export function getLightUniformDeclarations(): string {
  return `
// Multi-Light System Constants
#define MAX_LIGHTS ${MAX_LIGHTS}
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_DIRECTIONAL 1
#define LIGHT_TYPE_SPOT 2

// Per-Light Uniforms (Array-Based)
uniform int uNumLights;
uniform bool uLightsEnabled[MAX_LIGHTS];
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uSpotAngles[MAX_LIGHTS];
uniform float uSpotPenumbras[MAX_LIGHTS];
uniform float uSpotCosInner[MAX_LIGHTS];
uniform float uSpotCosOuter[MAX_LIGHTS];
uniform float uLightRanges[MAX_LIGHTS];
uniform float uLightDecays[MAX_LIGHTS];
`
}

/**
 * Generate GLSL helper functions for multi-light calculations.
 *
 * @returns GLSL function definitions string
 */
export function getLightHelperFunctions(): string {
  return `
/**
 * Calculate light direction for a given light index.
 * Returns normalized direction FROM fragment TO light source.
 */
vec3 getLightDirection(int lightIndex, vec3 fragPos) {
  int lightType = uLightTypes[lightIndex];

  if (lightType == LIGHT_TYPE_POINT) {
    return normalize(uLightPositions[lightIndex] - fragPos);
  }
  else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
    return normalize(uLightDirections[lightIndex]);
  }
  else if (lightType == LIGHT_TYPE_SPOT) {
    return normalize(uLightPositions[lightIndex] - fragPos);
  }

  return vec3(0.0, 1.0, 0.0);
}

/**
 * Calculate spot light cone attenuation with penumbra falloff.
 * Uses precomputed cosines (uSpotCosInner/uSpotCosOuter) to avoid per-fragment trig.
 */
float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
  float cosAngle = dot(lightToFrag, normalize(uLightDirections[lightIndex]));
  return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
}

/**
 * Calculate distance attenuation for point and spot lights.
 * Implements Three.js-compatible attenuation:
 * - range = 0: no distance falloff (infinite range)
 * - range > 0: light reaches zero intensity at this distance
 * - decay = 0: no decay (constant intensity)
 * - decay = 1: linear falloff
 * - decay = 2: physically correct inverse square falloff
 *
 * Based on Three.js PointLight distance attenuation formula.
 */
float getDistanceAttenuation(int lightIndex, float distance) {
  float range = uLightRanges[lightIndex];
  float decay = uLightDecays[lightIndex];

  // No distance falloff when range is 0 (infinite range)
  if (range <= 0.0) {
    return 1.0;
  }

  // Clamp distance to prevent division by zero
  float d = max(distance, 0.0001);

  // Three.js attenuation formula:
  // pow(saturate(-distance / range + 1.0), decay)
  float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);

  // Apply decay exponent
  return pow(rangeAttenuation, decay);
}
`
}

/**
 * Generate GLSL multi-light calculation function.
 *
 * @returns GLSL lighting function string
 */
export function getMultiLightFunction(): string {
  return `
/**
 * Calculate total lighting from all active lights.
 * Uses Blinn-Phong model consistent with existing single-light implementation.
 */
vec3 calculateMultiLighting(
  vec3 fragPos,
  vec3 normal,
  vec3 viewDir,
  vec3 baseColor
) {
  vec3 col = baseColor * uAmbientIntensity;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uNumLights) break;
    if (!uLightsEnabled[i]) continue;

    vec3 lightDir = getLightDirection(i, fragPos);
    float attenuation = uLightIntensities[i];

    // Apply distance attenuation for point and spot lights
    int lightType = uLightTypes[i];
    if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
      float distance = length(uLightPositions[i] - fragPos);
      attenuation *= getDistanceAttenuation(i, distance);
    }

    // Apply spot light cone attenuation
    if (lightType == LIGHT_TYPE_SPOT) {
      vec3 lightToFrag = normalize(fragPos - uLightPositions[i]);
      attenuation *= getSpotAttenuation(i, lightToFrag);
    }

    // Skip negligible contributions
    if (attenuation < 0.001) continue;

    // Diffuse (Lambert)
    float NdotL = max(dot(normal, lightDir), 0.0);
    col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation;

    // Specular (Blinn-Phong)
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation;
    col += uSpecularColor * uLightColors[i] * spec;
  }

  return col;
}
`
}

/**
 * Add multi-light uniforms to an existing uniforms object.
 * Merges light uniforms with other shader uniforms.
 *
 * @param existingUniforms - Existing shader uniforms
 * @returns Combined uniforms object
 */
export function mergeLightUniforms<T extends Record<string, { value: unknown }>>(
  existingUniforms: T
): T & LightUniforms {
  const lightUniforms = createLightUniforms()
  return {
    ...existingUniforms,
    ...lightUniforms,
  }
}
