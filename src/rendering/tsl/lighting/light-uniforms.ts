/**
 * TSL Light Uniforms for Multi-Light System
 *
 * Creates TSL uniform nodes matching the WebGL LightUniforms structure.
 * Uses uniformArray for array-based access with .element() method.
 *
 * @module rendering/tsl/lighting/light-uniforms
 */

import { Color, Vector3 } from 'three'
import { uniform, uniformArray } from 'three/tsl'

import type { UniformNode, UniformArrayNode } from 'three/tsl'
import { rotationToDirection } from '@/rendering/lights/types'

// Maximum number of lights (matches WebGL MAX_LIGHTS)
export const MAX_LIGHTS = 8

// Light type constants
export const LIGHT_TYPE_POINT = 0
export const LIGHT_TYPE_DIRECTIONAL = 1
export const LIGHT_TYPE_SPOT = 2

/**
 * Multi-light TSL uniforms structure using uniformArray for element access
 */
export interface LightTSLUniforms {
  /** Number of active lights (0 to MAX_LIGHTS) */
  uNumLights: UniformNode<number>
  /** Whether each light is enabled (as number: 0.0 or 1.0) */
  uLightsEnabled: UniformArrayNode<number>
  /** Light type integers (0=point, 1=directional, 2=spot) */
  uLightTypes: UniformArrayNode<number>
  /** World-space positions */
  uLightPositions: UniformArrayNode<Vector3>
  /** Normalized direction vectors */
  uLightDirections: UniformArrayNode<Vector3>
  /** RGB colors in linear space */
  uLightColors: UniformArrayNode<Vector3>
  /** Intensity multipliers */
  uLightIntensities: UniformArrayNode<number>
  /** Precomputed cos(innerAngle) for spotlight cone */
  uSpotCosInner: UniformArrayNode<number>
  /** Precomputed cos(outerAngle) for spotlight cone */
  uSpotCosOuter: UniformArrayNode<number>
  /** Light range/distance for attenuation (0 = infinite) */
  uLightRanges: UniformArrayNode<number>
  /** Light decay rate (2 = physically correct inverse square) */
  uLightDecays: UniformArrayNode<number>
  /** Ambient enabled (1.0 = on, 0.0 = off) - matches WebGL uAmbientEnabled */
  uAmbientEnabled: UniformNode<number>
  /** Ambient color in linear space */
  uAmbientColor: UniformNode<Color>
  /** Ambient intensity */
  uAmbientIntensity: UniformNode<number>
}

/**
 * PBR material TSL uniforms
 */
export interface PBRTSLUniforms {
  /** Surface roughness (0-1) */
  uRoughness: UniformNode<number>
  /** Metalness (0-1) */
  uMetallic: UniformNode<number>
  /** Specular intensity multiplier */
  uSpecularIntensity: UniformNode<number>
  /** Specular tint color */
  uSpecularColor: UniformNode<Color>
}

/**
 * Fresnel rim lighting TSL uniforms
 */
export interface FresnelTSLUniforms {
  /** Whether fresnel is enabled */
  uFresnelEnabled: UniformNode<boolean>
  /** Fresnel effect intensity */
  uFresnelIntensity: UniformNode<number>
  /** Base Fresnel reflectivity (F0) */
  uF0: UniformNode<number>
  /** Rim light color (linear space) */
  uRimColor: UniformNode<Color>
}

/**
 * Create initial light TSL uniforms using uniformArray for element access
 * @returns Light uniform nodes ready for TSL materials
 */
export function createLightTSLUniforms(): LightTSLUniforms {
  // Initialize arrays for vec3 uniforms (positions, directions, colors)
  const positions: Vector3[] = []
  const directions: Vector3[] = []
  const colors: Vector3[] = []
  const enabled: number[] = []
  const types: number[] = []
  const intensities: number[] = []
  const cosInner: number[] = []
  const cosOuter: number[] = []
  const ranges: number[] = []
  const decays: number[] = []

  // Set default values
  for (let i = 0; i < MAX_LIGHTS; i++) {
    // Default position: above origin
    positions.push(new Vector3(0, 5, 0))
    // Default direction: pointing down
    directions.push(new Vector3(0, -1, 0))
    // Default color: white (linear)
    colors.push(new Vector3(1, 1, 1))
    // Defaults
    enabled.push(0) // disabled
    types.push(LIGHT_TYPE_POINT)
    intensities.push(1.0)
    // Default 30° cone with 0.5 penumbra
    cosInner.push(Math.cos((Math.PI / 6) * 0.5)) // cos(15°) ≈ 0.966
    cosOuter.push(Math.cos(Math.PI / 6)) // cos(30°) ≈ 0.866
    ranges.push(0) // infinite range
    decays.push(2) // physically correct
  }

  return {
    uNumLights: uniform(0),
    uLightsEnabled: uniformArray(enabled, 'float'),
    uLightTypes: uniformArray(types, 'int'),
    uLightPositions: uniformArray(positions, 'vec3'),
    uLightDirections: uniformArray(directions, 'vec3'),
    uLightColors: uniformArray(colors, 'vec3'),
    uLightIntensities: uniformArray(intensities, 'float'),
    uSpotCosInner: uniformArray(cosInner, 'float'),
    uSpotCosOuter: uniformArray(cosOuter, 'float'),
    uLightRanges: uniformArray(ranges, 'float'),
    uLightDecays: uniformArray(decays, 'float'),
    // Ambient lighting
    uAmbientEnabled: uniform(1.0), // 1.0 = enabled, 0.0 = disabled (matches WebGL)
    uAmbientColor: uniform(new Color('#ffffff').convertSRGBToLinear()),
    uAmbientIntensity: uniform(0.3),
  }
}

/**
 * Create PBR material TSL uniforms
 * @returns PBR uniform nodes
 */
export function createPBRTSLUniforms(): PBRTSLUniforms {
  return {
    uRoughness: uniform(0.3),
    uMetallic: uniform(0.0),
    uSpecularIntensity: uniform(1.0),
    uSpecularColor: uniform(new Color('#ffffff').convertSRGBToLinear()),
  }
}

/**
 * Create Fresnel rim lighting TSL uniforms
 * @returns Fresnel uniform nodes
 */
export function createFresnelTSLUniforms(): FresnelTSLUniforms {
  return {
    uFresnelEnabled: uniform(false),
    uFresnelIntensity: uniform(0.5),
    uF0: uniform(0.04), // Default dielectric F0
    uRimColor: uniform(new Color('#ffffff').convertSRGBToLinear()),
  }
}

/**
 * Update light TSL uniforms from LightSource array
 * Modifies uniform values in-place for performance
 *
 * @param uniforms - Existing TSL uniforms to update
 * @param lights - Array of light source configurations from store
 */
export function updateLightTSLUniforms(
  uniforms: LightTSLUniforms,
  lights: Array<{
    enabled: boolean
    type: 'point' | 'directional' | 'spot'
    position: [number, number, number]
    rotation: [number, number, number] // Euler rotation angles, converted to direction
    color: string
    intensity: number
    coneAngle?: number
    penumbra?: number
    range: number
    decay: number
  }>
): void {
  const numLights = Math.min(lights.length, MAX_LIGHTS)
  uniforms.uNumLights.value = numLights

  // Get underlying arrays - uniformArray uses .array property
  const positions = uniforms.uLightPositions.array
  const directions = uniforms.uLightDirections.array
  const colors = uniforms.uLightColors.array
  const enabled = uniforms.uLightsEnabled.array
  const types = uniforms.uLightTypes.array
  const intensities = uniforms.uLightIntensities.array
  const cosInner = uniforms.uSpotCosInner.array
  const cosOuter = uniforms.uSpotCosOuter.array
  const ranges = uniforms.uLightRanges.array
  const decays = uniforms.uLightDecays.array

  // Temp color for sRGB->linear conversion
  const tempColor = new Color()

  for (let i = 0; i < MAX_LIGHTS; i++) {
    const light = lights[i]

    if (light) {
      enabled[i] = light.enabled ? 1.0 : 0.0
      types[i] =
        light.type === 'point'
          ? LIGHT_TYPE_POINT
          : light.type === 'directional'
            ? LIGHT_TYPE_DIRECTIONAL
            : LIGHT_TYPE_SPOT

      // Position (Vector3) - array is guaranteed to have MAX_LIGHTS elements
      positions[i]!.set(light.position[0], light.position[1], light.position[2])

      // Calculate direction from rotation for directional/spot lights (matches WebGL)
      const dir = rotationToDirection(light.rotation)
      directions[i]!.set(dir[0], dir[1], dir[2])

      // Color (convert sRGB to linear, store as Vector3 components)
      tempColor.set(light.color).convertSRGBToLinear()
      colors[i]!.set(tempColor.r, tempColor.g, tempColor.b)

      intensities[i] = light.intensity

      // Spot light cone angles
      const outerAngleRad = ((light.coneAngle ?? 30) * Math.PI) / 180
      const innerAngleRad = outerAngleRad * (1.0 - (light.penumbra ?? 0.5))
      cosOuter[i] = Math.cos(outerAngleRad)
      cosInner[i] = Math.cos(innerAngleRad)

      ranges[i] = light.range
      decays[i] = light.decay
    } else {
      enabled[i] = 0.0
    }
  }
}

/**
 * Combined lighting uniforms for mesh materials
 */
export interface CombinedLightingTSLUniforms extends LightTSLUniforms, PBRTSLUniforms {}

/**
 * Create all lighting-related TSL uniforms
 * @returns Combined lighting, ambient, and PBR uniform nodes
 */
export function createCombinedLightingTSLUniforms(): CombinedLightingTSLUniforms {
  return {
    ...createLightTSLUniforms(),
    ...createPBRTSLUniforms(),
  }
}
