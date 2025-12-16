/**
 * Skybox Shader Material
 *
 * Custom shader material for rendering environment skyboxes with
 * configurable visual effects, animations, and procedural generation.
 *
 * Features:
 * - Classic: Cube texture sampling with effects
 * - Procedural Modes: Aurora, Nebula, Void, Crystalline, Horizon, Ocean, Twilight, Starfield
 * - "Atmospheric Resonance" system (10 delight features)
 * - Cosine Palette Integration
 * - Smooth crossfade transitions
 */

import * as THREE from 'three'
import { GLSL_COSINE_PALETTE } from '@/rendering/shaders/palette/cosine.glsl'
import skyboxVertexShaderRaw from './skybox.vert?raw'
import skyboxFragmentShaderRaw from './skybox.frag?raw'

/**
 * Skybox mode constants matching shader uniforms
 * 0=Classic, 1=Aurora, 2=Nebula, 3=Void, 4=Crystalline, 5=Horizon, 6=Ocean, 7=Twilight, 8=Starfield
 */
export const SKYBOX_MODE_CLASSIC = 0
export const SKYBOX_MODE_AURORA = 1
export const SKYBOX_MODE_NEBULA = 2
export const SKYBOX_MODE_VOID = 3
export const SKYBOX_MODE_CRYSTALLINE = 4
export const SKYBOX_MODE_HORIZON = 5
export const SKYBOX_MODE_OCEAN = 6
export const SKYBOX_MODE_TWILIGHT = 7
export const SKYBOX_MODE_STARFIELD = 8

/**
 * Uniforms for the skybox shader material
 */
export interface SkyboxShaderUniforms {
  // Core
  uTex: THREE.CubeTexture | null
  uRotation: THREE.Matrix3
  uMode: number // 0=Classic, 1-8=Procedural modes
  uTime: number
  uIsCapture: number // 0=screen render, 1=cubemap capture

  // Basic Appearance
  uBlur: number
  uIntensity: number
  uHue: number
  uSaturation: number

  // Procedural Settings
  uScale: number
  uComplexity: number
  uTimeScale: number
  uEvolution: number

  // Palette (Cosine Gradient)
  uColor1: THREE.Vector3
  uColor2: THREE.Vector3
  uPalA: THREE.Vector3
  uPalB: THREE.Vector3
  uPalC: THREE.Vector3
  uPalD: THREE.Vector3
  uUsePalette: number // 0 or 1

  // Delight Features
  uDistortion: number
  uAberration: number
  uVignette: number
  uGrain: number
  uAtmosphere: number // Horizon
  uTurbulence: number
  uDualTone: number
  uSunIntensity: number
  uSunPosition: THREE.Vector3

  // Starfield Settings
  uStarDensity: number // 0-1, controls star count
  uStarBrightness: number // 0-2, overall brightness
  uStarSize: number // 0-1, base star size
  uStarTwinkle: number // 0-1, scintillation amount
  uStarGlow: number // 0-1, halo intensity
  uStarColorVariation: number // 0-1, spectral color range

  // Parallax Depth
  uParallaxEnabled: number // 0 or 1
  uParallaxStrength: number // 0-1, layer separation

  // Aurora-specific Settings
  uAuroraCurtainHeight: number // 0-1, vertical coverage
  uAuroraWaveFrequency: number // 0.5-3, wave density

  // Horizon-specific Settings
  uHorizonGradientContrast: number // 0-1, gradient band sharpness
  uHorizonSpotlightFocus: number // 0-1, central spotlight intensity

  // Ocean-specific Settings
  uOceanCausticIntensity: number // 0-1, caustic pattern strength
  uOceanDepthGradient: number // 0-1, depth color falloff
  uOceanBubbleDensity: number // 0-1, rising bubble particles
  uOceanSurfaceShimmer: number // 0-1, surface light shimmer

  [key: string]: THREE.CubeTexture | THREE.Matrix3 | THREE.Vector3 | THREE.Vector2 | number | null
}

/**
 * Default uniform values for the skybox shader.
 */
export function createSkyboxShaderDefaults(): SkyboxShaderUniforms {
  return {
    uTex: null,
    uRotation: new THREE.Matrix3(),
    uMode: 0,
    uTime: 0,
    uIsCapture: 0,

    uBlur: 0,
    uIntensity: 1,
    uHue: 0,
    uSaturation: 1,

    uScale: 1.0,
    uComplexity: 0.5,
    uTimeScale: 0.2,
    uEvolution: 0.0,

    uColor1: new THREE.Color(0x0000ff) as unknown as THREE.Vector3,
    uColor2: new THREE.Color(0xff00ff) as unknown as THREE.Vector3,
    uPalA: new THREE.Vector3(0.5, 0.5, 0.5),
    uPalB: new THREE.Vector3(0.5, 0.5, 0.5),
    uPalC: new THREE.Vector3(1.0, 1.0, 1.0),
    uPalD: new THREE.Vector3(0.0, 0.33, 0.67),
    uUsePalette: 0,

    uDistortion: 0,
    uAberration: 0,
    uVignette: 0.15,
    uGrain: 0.02,
    uAtmosphere: 0.0,
    uTurbulence: 0.0,
    uDualTone: 0.5,
    uSunIntensity: 0.0,
    uSunPosition: new THREE.Vector3(10, 10, 10),

    // Starfield defaults
    uStarDensity: 0.5,
    uStarBrightness: 1.0,
    uStarSize: 0.5,
    uStarTwinkle: 0.3,
    uStarGlow: 0.5,
    uStarColorVariation: 0.5,

    // Parallax defaults
    uParallaxEnabled: 0,
    uParallaxStrength: 0.5,

    // Aurora defaults
    uAuroraCurtainHeight: 0.5,
    uAuroraWaveFrequency: 1.0,

    // Horizon defaults
    uHorizonGradientContrast: 0.5,
    uHorizonSpotlightFocus: 0.5,

    // Ocean defaults
    uOceanCausticIntensity: 0.5,
    uOceanDepthGradient: 0.5,
    uOceanBubbleDensity: 0.3,
    uOceanSurfaceShimmer: 0.4,
  }
}

/**
 * GLSL version for WebGL2 - Three.js will handle the #version directive
 */
export const skyboxGlslVersion = THREE.GLSL3

/**
 * Vertex shader for skybox rendering.
 * Loaded from external skybox.vert file.
 */
export const skyboxVertexShader = skyboxVertexShaderRaw

/**
 * Fragment shader for skybox rendering.
 * Loaded from external skybox.frag file with cosine palette code injected.
 *
 * Includes:
 * - Classic Mode
 * - Procedural Modes (Aurora, Nebula, Void, Crystalline, Horizon, Ocean, Twilight, Starfield)
 * - Cosine Palette Integration
 * - 10 Delight Features
 */
export const skyboxFragmentShader = skyboxFragmentShaderRaw.replace(
  '// COSINE_PALETTE_INCLUDE',
  GLSL_COSINE_PALETTE
)

