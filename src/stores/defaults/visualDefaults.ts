/**
 * Default values for visual store
 *
 * Centralized constants used across visual store slices.
 */

import type { TransformMode } from '@/rendering/lights/types'
import { createDefaultLight, createDefaultSpotLight } from '@/rendering/lights/types'
import { DEFAULT_OPACITY_SETTINGS } from '@/rendering/opacity/constants'
import type { HyperbulbOpacitySettings } from '@/rendering/opacity/types'
import {
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_COSINE_COEFFICIENTS,
  DEFAULT_DISTRIBUTION,
  DEFAULT_MULTI_SOURCE_WEIGHTS,
} from '@/rendering/shaders/palette'
import type { ShaderType, ToneMappingAlgorithm } from '@/rendering/shaders/types'

// ============================================================================
// Basic Visual Defaults
// ============================================================================

export const DEFAULT_EDGE_COLOR = '#19e697'
export const DEFAULT_EDGE_THICKNESS = 1
export const DEFAULT_EDGE_METALLIC = 0.0
export const DEFAULT_EDGE_ROUGHNESS = 0.5
export const DEFAULT_FACE_OPACITY = 0.3
export const DEFAULT_FACE_COLOR = '#33cc9e'
export const DEFAULT_BACKGROUND_COLOR = '#0F0F1A'

export const DEFAULT_EDGES_VISIBLE = true
export const DEFAULT_FACES_VISIBLE = true

// ============================================================================
// Bloom Defaults
// ============================================================================

export const DEFAULT_BLOOM_ENABLED = true
export const DEFAULT_BLOOM_INTENSITY = 0.3
export const DEFAULT_BLOOM_THRESHOLD = 0.35
export const DEFAULT_BLOOM_RADIUS = 0.15

// ============================================================================
// Bokeh (Depth of Field) Defaults
// ============================================================================

/** Bokeh focus mode type */
export type BokehFocusMode = 'auto-center' | 'auto-mouse' | 'manual'

/** Bokeh blur method type */
export type BokehBlurMethod = 'disc' | 'jittered' | 'separable' | 'hexagonal'

export const DEFAULT_BOKEH_ENABLED = false
export const DEFAULT_BOKEH_FOCUS_MODE: BokehFocusMode = 'auto-center'
export const DEFAULT_BOKEH_BLUR_METHOD: BokehBlurMethod = 'hexagonal'
export const DEFAULT_BOKEH_WORLD_FOCUS_DISTANCE = 15
export const DEFAULT_BOKEH_WORLD_FOCUS_RANGE = 10
export const DEFAULT_BOKEH_SCALE = 1.0
export const DEFAULT_BOKEH_FOCAL_LENGTH = 0.1
export const DEFAULT_BOKEH_SMOOTH_TIME = 0.25
export const DEFAULT_BOKEH_SHOW_DEBUG = false

// ============================================================================
// SSR (Screen-Space Reflections) Defaults
// ============================================================================

/** SSR quality level - controls ray march steps */
export type SSRQuality = 'low' | 'medium' | 'high'

export const DEFAULT_SSR_ENABLED = false
export const DEFAULT_SSR_INTENSITY = 0.8
export const DEFAULT_SSR_MAX_DISTANCE = 30
export const DEFAULT_SSR_THICKNESS = 0.5
export const DEFAULT_SSR_FADE_START = 0.7
export const DEFAULT_SSR_FADE_END = 1.0
export const DEFAULT_SSR_QUALITY: SSRQuality = 'high'

/** Map SSR quality to ray march steps */
export const SSR_QUALITY_STEPS: Record<SSRQuality, number> = {
  low: 16,
  medium: 32,
  high: 64,
}

// ============================================================================
// Screen-Space Refraction Defaults
// ============================================================================

export const DEFAULT_REFRACTION_ENABLED = false
export const DEFAULT_REFRACTION_IOR = 1.5
export const DEFAULT_REFRACTION_STRENGTH = 0.1
export const DEFAULT_REFRACTION_CHROMATIC_ABERRATION = 0.0

// ============================================================================
// Anti-aliasing Defaults
// ============================================================================

/** Anti-aliasing method type */
export type AntiAliasingMethod = 'none' | 'fxaa' | 'smaa'

export const DEFAULT_ANTI_ALIASING_METHOD: AntiAliasingMethod = 'none'

/** SMAA edge detection threshold (lower = more aggressive, 0.05-0.15 typical range) */
export const DEFAULT_SMAA_THRESHOLD = 0.05

// ============================================================================
// Lighting Defaults
// ============================================================================

export const DEFAULT_LIGHT_ENABLED = true
export const DEFAULT_LIGHT_COLOR = '#FFFFFF'
export const DEFAULT_LIGHT_HORIZONTAL_ANGLE = 145
export const DEFAULT_LIGHT_VERTICAL_ANGLE = 30
export const DEFAULT_AMBIENT_INTENSITY = 0.01
export const DEFAULT_AMBIENT_COLOR = '#FFFFFF'
export const DEFAULT_SPECULAR_INTENSITY = 0.5
export const DEFAULT_SHININESS = 30
export const DEFAULT_SHOW_LIGHT_INDICATOR = false

// Enhanced lighting
export const DEFAULT_SPECULAR_COLOR = '#FFFFFF'
export const DEFAULT_DIFFUSE_INTENSITY = 1.0
export const DEFAULT_LIGHT_STRENGTH = 1.0
export const DEFAULT_TONE_MAPPING_ENABLED = true
export const DEFAULT_TONE_MAPPING_ALGORITHM: ToneMappingAlgorithm = 'aces'
export const DEFAULT_EXPOSURE = 0.7

// Multi-light system
export const DEFAULT_LIGHTS = [createDefaultLight(), createDefaultSpotLight()]
export const DEFAULT_SELECTED_LIGHT_ID: string | null = null
export const DEFAULT_TRANSFORM_MODE: TransformMode = 'translate'
export const DEFAULT_SHOW_LIGHT_GIZMOS = false

// Shadow system - re-export from lib for convenience
export {
  DEFAULT_SHADOW_ANIMATION_MODE,
  DEFAULT_SHADOW_ENABLED,
  DEFAULT_SHADOW_QUALITY,
  DEFAULT_SHADOW_SOFTNESS,
  SHADOW_SOFTNESS_RANGE,
} from '@/rendering/shadows/constants'
export type { ShadowAnimationMode, ShadowQuality } from '@/rendering/shadows/types'

// ============================================================================
// Depth Effect Defaults
// ============================================================================

export const DEFAULT_DEPTH_ATTENUATION_ENABLED = true
export const DEFAULT_DEPTH_ATTENUATION_STRENGTH = 0.3
export const DEFAULT_FRESNEL_ENABLED = true
export const DEFAULT_FRESNEL_INTENSITY = 0.1
export const DEFAULT_PER_DIMENSION_COLOR_ENABLED = false

// ============================================================================
// LCH Color Defaults
// ============================================================================

export const DEFAULT_LCH_LIGHTNESS = 0.7
export const DEFAULT_LCH_CHROMA = 0.15

// ============================================================================
// Ground Plane Defaults
// ============================================================================

/** Wall position types for environment surfaces */
export type WallPosition = 'floor' | 'back' | 'left' | 'right' | 'top'

/** All wall positions */
export const ALL_WALL_POSITIONS: WallPosition[] = ['floor', 'back', 'left', 'right', 'top']

/** Ground plane surface type */
export type GroundPlaneType = 'two-sided' | 'plane'

export const DEFAULT_ACTIVE_WALLS: WallPosition[] = ['floor']
export const DEFAULT_GROUND_PLANE_OFFSET = 10
export const DEFAULT_GROUND_PLANE_OPACITY = 0.5
export const DEFAULT_GROUND_PLANE_REFLECTIVITY = 0.4
export const DEFAULT_GROUND_PLANE_COLOR = '#ead6e8'
export const DEFAULT_GROUND_PLANE_TYPE: GroundPlaneType = 'plane'
export const DEFAULT_GROUND_PLANE_SIZE_SCALE = 10
export const DEFAULT_SHOW_GROUND_GRID = true
export const DEFAULT_GROUND_GRID_COLOR = '#dbdcdb'
export const DEFAULT_GROUND_GRID_SPACING = 5.0

// Ground material
export const DEFAULT_GROUND_MATERIAL_ROUGHNESS = 0.2
export const DEFAULT_GROUND_MATERIAL_METALNESS = 0.6
export const DEFAULT_GROUND_MATERIAL_ENVMAP_INTENSITY = 1.6

// ============================================================================
// Skybox Defaults
// ============================================================================

export type SkyboxTexture = 'space_blue' | 'space_lightblue' | 'space_red' | 'none'

export const DEFAULT_SKYBOX_ENABLED = true
export const DEFAULT_SKYBOX_TEXTURE: SkyboxTexture = 'space_blue'
export const DEFAULT_SKYBOX_BLUR = 0
export const DEFAULT_SKYBOX_INTENSITY = 1
export const DEFAULT_SKYBOX_ROTATION = 0
export const DEFAULT_SKYBOX_HIGH_QUALITY = false

export type SkyboxAnimationMode =
  | 'none'
  | 'cinematic' // Smooth Y orbit + subtle vertical bob (The "Standard")
  | 'heatwave' // UV Distortion (The "Hot")
  | 'tumble' // Chaotic tumbling (The "Disaster")
  | 'ethereal' // Complex rot + Shimmer (The "Magic")
  | 'nebula' // Color shifting (The "Cosmic")

export const DEFAULT_SKYBOX_ANIMATION_MODE: SkyboxAnimationMode = 'heatwave'
export const DEFAULT_SKYBOX_ANIMATION_SPEED = 0.01

// --- Procedural Skybox Defaults ---

export type SkyboxMode = 'classic' | 'procedural_aurora' | 'procedural_nebula' | 'procedural_void'

export interface SkyboxProceduralSettings {
  // Core
  scale: number
  complexity: number // 0-1 (Quality)
  timeScale: number
  
  // Appearance
  paletteId: string // Link to Cosine Palette Presets
  syncWithObject: boolean // "Harmonic Link"
  color1: string // Custom Primary
  color2: string // Custom Secondary
  
  // Delight Features (The 10 "Wow" Factors)
  stardustDensity: number // 0-1
  chromaticAberration: number // 0-1 (Radial/Lens style)
  horizon: number // 0-1 (0 = none, 1 = strong plane)
  gridIntensity: number // 0-1
  mouseParallaxStrength: number // 0-1
  turbulence: number // 0-1
  dualToneContrast: number // 0-1 (Shadow intensity)
  sunIntensity: number // 0-1
  sunPosition: [number, number, number]
  noiseGrain: number // 0-1
  evolution: number // 0-1 (The "Seed" / W-coordinate)
}

export const DEFAULT_SKYBOX_MODE: SkyboxMode = 'classic'

export const DEFAULT_SKYBOX_PROCEDURAL_SETTINGS: SkyboxProceduralSettings = {
  scale: 1.0,
  complexity: 0.5,
  timeScale: 0.2,
  paletteId: 'rainbow',
  syncWithObject: true,
  color1: '#0000ff',
  color2: '#ff00ff',
  stardustDensity: 0.3,
  chromaticAberration: 0.1,
  horizon: 0.0,
  gridIntensity: 0.0,
  mouseParallaxStrength: 0.2,
  turbulence: 0.3,
  dualToneContrast: 0.5,
  sunIntensity: 0.0,
  sunPosition: [10, 10, 10],
  noiseGrain: 0.1,
  evolution: 0.0
}

// ============================================================================
// Shader Defaults
// ============================================================================

export const DEFAULT_SHADER_TYPE: ShaderType = 'surface'

export const DEFAULT_WIREFRAME_SETTINGS = {
  lineThickness: DEFAULT_EDGE_THICKNESS,
}

export const DEFAULT_SURFACE_SETTINGS = {
  faceOpacity: DEFAULT_FACE_OPACITY,
  specularIntensity: DEFAULT_SPECULAR_INTENSITY,
  shininess: DEFAULT_SHININESS,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
}

export const DEFAULT_SHADER_SETTINGS = {
  wireframe: DEFAULT_WIREFRAME_SETTINGS,
  surface: DEFAULT_SURFACE_SETTINGS,
}

// ============================================================================
// UI / Miscellaneous Defaults
// ============================================================================

export const DEFAULT_SHOW_AXIS_HELPER = false
export const DEFAULT_SHOW_PERF_MONITOR = true
export const DEFAULT_SHOW_DEPTH_BUFFER = false
export const DEFAULT_SHOW_TEMPORAL_DEPTH_BUFFER = false
export const DEFAULT_ANIMATION_BIAS = 0
export const MIN_ANIMATION_BIAS = 0
export const MAX_ANIMATION_BIAS = 1

// FPS Limiting
export const DEFAULT_MAX_FPS = 60
export const MIN_MAX_FPS = 15
export const MAX_MAX_FPS = 120

// ============================================================================
// Visual Presets
// ============================================================================

export interface VisualPresetConfig {
  edgeColor: string
  edgeThickness: number
  backgroundColor: string
  faceColor?: string
}

export const VISUAL_PRESETS = {
  neon: {
    edgeColor: '#00FF88',
    edgeThickness: 3,
    backgroundColor: '#0A0A12',
  },
  blueprint: {
    edgeColor: '#4488FF',
    edgeThickness: 1,
    backgroundColor: '#0A1628',
  },
  hologram: {
    edgeColor: '#00FFFF',
    edgeThickness: 2,
    backgroundColor: '#000011',
  },
  scientific: {
    edgeColor: '#FFFFFF',
    edgeThickness: 1,
    backgroundColor: '#1A1A2E',
  },
  synthwave: {
    edgeColor: '#FF00FF',
    edgeThickness: 2,
    backgroundColor: '#1A0A2E',
    faceColor: '#8800FF',
  },
} as const satisfies Record<string, VisualPresetConfig>

export type VisualPreset = keyof typeof VISUAL_PRESETS

// ============================================================================
// Re-exports from lib for convenience
// ============================================================================

export {
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_COSINE_COEFFICIENTS,
  DEFAULT_DISTRIBUTION,
  DEFAULT_MULTI_SOURCE_WEIGHTS,
}

export { DEFAULT_OPACITY_SETTINGS }
export type { HyperbulbOpacitySettings }
