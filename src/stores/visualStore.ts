/**
 * Visual state management using Zustand
 *
 * Manages visual styling for the polytope rendering including:
 * - Shader selection and per-shader settings
 * - Bloom post-processing
 * - Lighting configuration
 * - Depth-based visual effects
 * - Color presets
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

import type { LightSource, LightType, TransformMode } from '@/lib/lights/types'
import {
  MAX_LIGHTS,
  MIN_LIGHTS,
  clampConeAngle,
  clampIntensity,
  clampPenumbra,
  cloneLight,
  createDefaultLight,
  createNewLight,
} from '@/lib/lights/types'
import {
  type ColorAlgorithm,
  type CosineCoefficients,
  type DistributionSettings,
  type MultiSourceWeights,
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_COSINE_COEFFICIENTS,
  DEFAULT_DISTRIBUTION,
  DEFAULT_MULTI_SOURCE_WEIGHTS,
} from '@/lib/shaders/palette'
import type {
  AllShaderSettings,
  ShaderType,
  SurfaceSettings,
  ToneMappingAlgorithm,
  WireframeSettings,
} from '@/lib/shaders/types'
import { create } from 'zustand'

// ============================================================================
// Default Values
// ============================================================================

/** Default visual settings */
export const DEFAULT_EDGE_COLOR = '#19e697'
export const DEFAULT_EDGE_THICKNESS = 1
export const DEFAULT_FACE_OPACITY = 0.3
export const DEFAULT_FACE_COLOR = '#33cc9e'
export const DEFAULT_BACKGROUND_COLOR = '#0F0F1A'

/** Default render mode toggle settings */
export const DEFAULT_EDGES_VISIBLE = true
export const DEFAULT_FACES_VISIBLE = true

/** Default bloom settings (matching original Dual Filter Bloom) */
export const DEFAULT_BLOOM_ENABLED = true
export const DEFAULT_BLOOM_INTENSITY = 0.3
export const DEFAULT_BLOOM_THRESHOLD = 0.35
export const DEFAULT_BLOOM_RADIUS = 0.15

/** Default bokeh (depth of field) settings */
export const DEFAULT_BOKEH_ENABLED = false
export const DEFAULT_BOKEH_FOCUS = 1.0
export const DEFAULT_BOKEH_APERTURE = 0.025
export const DEFAULT_BOKEH_MAX_BLUR = 0.01

/** Default lighting settings */
export const DEFAULT_LIGHT_ENABLED = true
export const DEFAULT_LIGHT_COLOR = '#FFFFFF'
export const DEFAULT_LIGHT_HORIZONTAL_ANGLE = 45
export const DEFAULT_LIGHT_VERTICAL_ANGLE = 30
export const DEFAULT_AMBIENT_INTENSITY = 0.01
export const DEFAULT_AMBIENT_COLOR = '#FFFFFF'
export const DEFAULT_SPECULAR_INTENSITY = 0.5
export const DEFAULT_SHININESS = 30 // Three.js default
export const DEFAULT_SHOW_LIGHT_INDICATOR = false

/** Enhanced lighting settings */
export const DEFAULT_SPECULAR_COLOR = '#FFFFFF'
export const DEFAULT_DIFFUSE_INTENSITY = 1.0
export const DEFAULT_LIGHT_STRENGTH = 1.0
export const DEFAULT_TONE_MAPPING_ENABLED = true
export const DEFAULT_TONE_MAPPING_ALGORITHM: ToneMappingAlgorithm = 'aces'
export const DEFAULT_EXPOSURE = 0.7

/** Default depth effect settings */
export const DEFAULT_DEPTH_ATTENUATION_ENABLED = true
export const DEFAULT_DEPTH_ATTENUATION_STRENGTH = 0.3
export const DEFAULT_FRESNEL_ENABLED = true
export const DEFAULT_FRESNEL_INTENSITY = 0.1
export const DEFAULT_PER_DIMENSION_COLOR_ENABLED = false

/** Default LCH coloring settings */
export const DEFAULT_LCH_LIGHTNESS = 0.7
export const DEFAULT_LCH_CHROMA = 0.15

/** Wall position types for environment surfaces */
export type WallPosition = 'floor' | 'back' | 'left' | 'right' | 'top'

/** All wall positions */
export const ALL_WALL_POSITIONS: WallPosition[] = ['floor', 'back', 'left', 'right', 'top']

/** Default ground plane settings */
export const DEFAULT_ACTIVE_WALLS: WallPosition[] = ['floor'] // Which walls are visible
export const DEFAULT_GROUND_PLANE_OFFSET = 2 // Additional distance offset for walls from center
export const DEFAULT_GROUND_PLANE_OPACITY = 0.3
export const DEFAULT_GROUND_PLANE_REFLECTIVITY = 0.4
export const DEFAULT_GROUND_PLANE_COLOR = '#101010'
export const DEFAULT_GROUND_PLANE_TYPE: GroundPlaneType = 'plane'
export const DEFAULT_GROUND_PLANE_SIZE_SCALE = 4 // Multiplier for ground plane size (1 = auto-calculated minimum)
export const DEFAULT_SHOW_GROUND_GRID = true
export const DEFAULT_GROUND_GRID_COLOR = '#ff00dd'
export const DEFAULT_GROUND_GRID_SPACING = 1.0

/** Ground plane surface type */
export type GroundPlaneType = 'two-sided' | 'plane'

/** Default ground material settings */
export const DEFAULT_GROUND_MATERIAL_ROUGHNESS = 0.85
export const DEFAULT_GROUND_MATERIAL_METALNESS = 0.85
export const DEFAULT_GROUND_MATERIAL_ENVMAP_INTENSITY = 0.5

/** Default axis helper settings */
export const DEFAULT_SHOW_AXIS_HELPER = false

/** Default animation bias settings */
export const DEFAULT_ANIMATION_BIAS = 0

/** Default multi-light settings */
export const DEFAULT_LIGHTS: LightSource[] = [createDefaultLight()]
export const DEFAULT_SELECTED_LIGHT_ID: string | null = null
export const DEFAULT_TRANSFORM_MODE: TransformMode = 'translate'
export const DEFAULT_SHOW_LIGHT_GIZMOS = false
export const MIN_ANIMATION_BIAS = 0
export const MAX_ANIMATION_BIAS = 1

/** Default shader type */
export const DEFAULT_SHADER_TYPE: ShaderType = 'surface'

/** Default wireframe shader settings */
export const DEFAULT_WIREFRAME_SETTINGS: WireframeSettings = {
  lineThickness: DEFAULT_EDGE_THICKNESS,
}

/** Default surface shader settings - uses same values as top-level lighting defaults */
export const DEFAULT_SURFACE_SETTINGS: SurfaceSettings = {
  faceOpacity: DEFAULT_FACE_OPACITY,
  specularIntensity: DEFAULT_SPECULAR_INTENSITY,
  shininess: DEFAULT_SHININESS,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
}

/** All default shader settings */
export const DEFAULT_SHADER_SETTINGS: AllShaderSettings = {
  wireframe: DEFAULT_WIREFRAME_SETTINGS,
  surface: DEFAULT_SURFACE_SETTINGS,
}

// ============================================================================
// Visual Presets
// ============================================================================

/** Visual preset configuration */
export interface VisualPresetConfig {
  edgeColor: string
  edgeThickness: number
  backgroundColor: string
  faceColor?: string
}

/** Visual presets */
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
// State Interface
// ============================================================================

interface VisualState {
  // --- Basic Visual Settings ---
  /** Color of polytope edges (hex string) */
  edgeColor: string
  /** Thickness of edges in pixels (1-5) */
  edgeThickness: number
  /** Opacity of faces (0-1, 0 = wireframe) */
  faceOpacity: number
  /** Color of faces (hex string) */
  faceColor: string
  /** Background color (hex string) */
  backgroundColor: string

  // --- Advanced Color System ---
  /** Color algorithm selection */
  colorAlgorithm: ColorAlgorithm
  /** Cosine palette coefficients */
  cosineCoefficients: CosineCoefficients
  /** Distribution settings for value remapping */
  distribution: DistributionSettings
  /** Multi-source blend weights (for multiSource algorithm) */
  multiSourceWeights: MultiSourceWeights
  /** LCH lightness value (for lch algorithm) */
  lchLightness: number
  /** LCH chroma value (for lch algorithm) */
  lchChroma: number

  // --- Render Mode Toggles ---
  /** Whether edges are visible (PRD: Render Mode Toggles) */
  edgesVisible: boolean
  /** Whether faces are visible (PRD: Render Mode Toggles) */
  facesVisible: boolean

  // --- Shader System ---
  /** Currently selected shader type */
  shaderType: ShaderType
  /** Per-shader settings */
  shaderSettings: AllShaderSettings

  // --- Bloom Post-Processing (Dual Filter Bloom) ---
  /** Whether bloom effect is enabled */
  bloomEnabled: boolean
  /** Bloom intensity (0-2) */
  bloomIntensity: number
  /** Bloom luminance threshold (0-1) */
  bloomThreshold: number
  /** Bloom radius/spread (0-1) */
  bloomRadius: number

  // --- Bokeh (Depth of Field) Post-Processing ---
  /** Whether bokeh/depth of field effect is enabled */
  bokehEnabled: boolean
  /** Focus distance from camera (0.1-10) */
  bokehFocus: number
  /** Camera aperture size - affects blur amount (0.001-0.1) */
  bokehAperture: number
  /** Maximum blur intensity (0-0.1) */
  bokehMaxBlur: number

  // --- Lighting ---
  /** Whether directional light is enabled */
  lightEnabled: boolean
  /** Light color (hex string) */
  lightColor: string
  /** Light horizontal angle in degrees (0-360) */
  lightHorizontalAngle: number
  /** Light vertical angle in degrees (-90 to 90) */
  lightVerticalAngle: number
  /** Ambient light intensity (0-1) */
  ambientIntensity: number
  /** Ambient light color (hex string) */
  ambientColor: string
  /** Specular highlight intensity (0-2) */
  specularIntensity: number
  /** Shininess - controls specular highlight size (1-128, Three.js default: 30) */
  shininess: number
  /** Whether to show light direction indicator */
  showLightIndicator: boolean

  // --- Enhanced Lighting ---
  /** Specular highlight color (hex string) */
  specularColor: string
  /** Diffuse intensity multiplier (0-2) */
  diffuseIntensity: number
  /** Light strength multiplier (0-3) */
  lightStrength: number
  /** Whether tone mapping is enabled */
  toneMappingEnabled: boolean
  /** Tone mapping algorithm */
  toneMappingAlgorithm: ToneMappingAlgorithm
  /** Exposure multiplier for tone mapping (0.1-3.0) */
  exposure: number

  // --- Depth Effects ---
  /** Whether depth attenuation is enabled */
  depthAttenuationEnabled: boolean
  /** Depth attenuation strength (0-0.5) */
  depthAttenuationStrength: number
  /** Whether fresnel rim lighting is enabled */
  fresnelEnabled: boolean
  /** Fresnel effect intensity (0-1) */
  fresnelIntensity: number
  /** Whether per-dimension color coding is enabled */
  perDimensionColorEnabled: boolean

  // --- Ground Plane ---
  /** Which walls are currently active/visible */
  activeWalls: WallPosition[]
  /** Ground plane offset below object (0-2) */
  groundPlaneOffset: number
  /** Ground plane opacity (0-1) */
  groundPlaneOpacity: number
  /** Ground plane reflectivity (0-1) */
  groundPlaneReflectivity: number
  /** Ground plane surface color (hex string) */
  groundPlaneColor: string
  /** Ground plane surface type */
  groundPlaneType: GroundPlaneType
  /** Ground plane size scale multiplier (1-5, 1 = auto-calculated minimum) */
  groundPlaneSizeScale: number
  /** Whether ground grid is visible */
  showGroundGrid: boolean
  /** Ground grid line color (hex string) */
  groundGridColor: string
  /** Ground grid spacing/cell size (0.5-5) */
  groundGridSpacing: number

  // --- Ground Material ---
  /** Ground material roughness (0-1, lower = shinier) */
  groundMaterialRoughness: number
  /** Ground material metalness (0-1, higher = more metallic) */
  groundMaterialMetalness: number
  /** Ground material environment map intensity (0-1) */
  groundMaterialEnvMapIntensity: number

  // --- Axis Helper ---
  /** Whether axis helper is visible */
  showAxisHelper: boolean

  // --- Animation ---
  /** Animation bias: 0 = uniform rotation, 1 = wildly different per plane (0-1) */
  animationBias: number

  // --- Multi-Light System ---
  /** Array of light sources (max 4) */
  lights: LightSource[]
  /** Currently selected light ID for gizmo manipulation */
  selectedLightId: string | null
  /** Transform mode for selected light (translate or rotate) */
  transformMode: TransformMode
  /** Whether light gizmos are visible in the scene */
  showLightGizmos: boolean
  /** Whether a light is currently being dragged (disables camera controls) */
  isDraggingLight: boolean

  // --- Actions: Basic Visual ---
  setEdgeColor: (color: string) => void
  setEdgeThickness: (thickness: number) => void
  setFaceOpacity: (opacity: number) => void
  setFaceColor: (color: string) => void
  setBackgroundColor: (color: string) => void

  // --- Actions: Advanced Color System ---
  setColorAlgorithm: (algorithm: ColorAlgorithm) => void
  setCosineCoefficients: (coefficients: CosineCoefficients) => void
  setCosineCoefficient: (key: 'a' | 'b' | 'c' | 'd', index: number, value: number) => void
  setDistribution: (settings: Partial<DistributionSettings>) => void
  setMultiSourceWeights: (weights: Partial<MultiSourceWeights>) => void
  setLchLightness: (lightness: number) => void
  setLchChroma: (chroma: number) => void

  // --- Actions: Render Mode Toggles ---
  setEdgesVisible: (visible: boolean) => void
  setFacesVisible: (visible: boolean) => void

  // --- Actions: Shader System ---
  setShaderType: (shaderType: ShaderType) => void
  setWireframeSettings: (settings: Partial<WireframeSettings>) => void
  setSurfaceSettings: (settings: Partial<SurfaceSettings>) => void

  // --- Actions: Bloom ---
  setBloomEnabled: (enabled: boolean) => void
  setBloomIntensity: (intensity: number) => void
  setBloomThreshold: (threshold: number) => void
  setBloomRadius: (radius: number) => void

  // --- Actions: Bokeh ---
  setBokehEnabled: (enabled: boolean) => void
  setBokehFocus: (focus: number) => void
  setBokehAperture: (aperture: number) => void
  setBokehMaxBlur: (maxBlur: number) => void

  // --- Actions: Lighting ---
  setLightEnabled: (enabled: boolean) => void
  setLightColor: (color: string) => void
  setLightHorizontalAngle: (angle: number) => void
  setLightVerticalAngle: (angle: number) => void
  setAmbientIntensity: (intensity: number) => void
  setAmbientColor: (color: string) => void
  setSpecularIntensity: (intensity: number) => void
  setShininess: (shininess: number) => void
  setShowLightIndicator: (show: boolean) => void

  // --- Actions: Enhanced Lighting ---
  setSpecularColor: (color: string) => void
  setDiffuseIntensity: (intensity: number) => void
  setLightStrength: (strength: number) => void
  setToneMappingEnabled: (enabled: boolean) => void
  setToneMappingAlgorithm: (algorithm: ToneMappingAlgorithm) => void
  setExposure: (exposure: number) => void

  // --- Actions: Depth Effects ---
  setDepthAttenuationEnabled: (enabled: boolean) => void
  setDepthAttenuationStrength: (strength: number) => void
  setFresnelEnabled: (enabled: boolean) => void
  setFresnelIntensity: (intensity: number) => void
  setPerDimensionColorEnabled: (enabled: boolean) => void

  // --- Actions: Ground Plane ---
  setActiveWalls: (walls: WallPosition[]) => void
  toggleWall: (wall: WallPosition) => void
  setGroundPlaneOffset: (offset: number) => void
  setGroundPlaneOpacity: (opacity: number) => void
  setGroundPlaneReflectivity: (reflectivity: number) => void
  setGroundPlaneColor: (color: string) => void
  setGroundPlaneType: (type: GroundPlaneType) => void
  setGroundPlaneSizeScale: (scale: number) => void
  setShowGroundGrid: (show: boolean) => void
  setGroundGridColor: (color: string) => void
  setGroundGridSpacing: (spacing: number) => void

  // --- Actions: Ground Material ---
  setGroundMaterialRoughness: (roughness: number) => void
  setGroundMaterialMetalness: (metalness: number) => void
  setGroundMaterialEnvMapIntensity: (intensity: number) => void

  // --- Actions: Axis Helper ---
  setShowAxisHelper: (show: boolean) => void

  // --- Actions: Animation ---
  setAnimationBias: (bias: number) => void

  // --- Actions: Multi-Light System ---
  /** Add a new light source (returns light ID or null if at max) */
  addLight: (type: LightType) => string | null
  /** Remove a light source by ID */
  removeLight: (id: string) => void
  /** Update a light source's properties */
  updateLight: (id: string, updates: Partial<Omit<LightSource, 'id'>>) => void
  /** Duplicate a light source (returns new light ID or null if at max) */
  duplicateLight: (id: string) => string | null
  /** Select a light for manipulation (null to deselect) */
  selectLight: (id: string | null) => void
  /** Set transform mode (translate or rotate) */
  setTransformMode: (mode: TransformMode) => void
  /** Set light gizmos visibility */
  setShowLightGizmos: (show: boolean) => void
  /** Set whether a light is currently being dragged */
  setIsDraggingLight: (dragging: boolean) => void

  // --- Actions: Presets & Reset ---
  applyPreset: (preset: VisualPreset) => void
  reset: () => void
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: Omit<VisualState, keyof VisualStateFunctions> = {
  // Basic visual
  edgeColor: DEFAULT_EDGE_COLOR,
  edgeThickness: DEFAULT_EDGE_THICKNESS,
  faceOpacity: DEFAULT_FACE_OPACITY,
  faceColor: DEFAULT_FACE_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,

  // Advanced color system
  colorAlgorithm: DEFAULT_COLOR_ALGORITHM,
  cosineCoefficients: { ...DEFAULT_COSINE_COEFFICIENTS },
  distribution: { ...DEFAULT_DISTRIBUTION },
  multiSourceWeights: { ...DEFAULT_MULTI_SOURCE_WEIGHTS },
  lchLightness: DEFAULT_LCH_LIGHTNESS,
  lchChroma: DEFAULT_LCH_CHROMA,

  // Render mode toggles
  edgesVisible: DEFAULT_EDGES_VISIBLE,
  facesVisible: DEFAULT_FACES_VISIBLE,

  // Shader system
  shaderType: DEFAULT_SHADER_TYPE,
  shaderSettings: { ...DEFAULT_SHADER_SETTINGS },

  // Bloom
  bloomEnabled: DEFAULT_BLOOM_ENABLED,
  bloomIntensity: DEFAULT_BLOOM_INTENSITY,
  bloomThreshold: DEFAULT_BLOOM_THRESHOLD,
  bloomRadius: DEFAULT_BLOOM_RADIUS,

  // Bokeh (Depth of Field)
  bokehEnabled: DEFAULT_BOKEH_ENABLED,
  bokehFocus: DEFAULT_BOKEH_FOCUS,
  bokehAperture: DEFAULT_BOKEH_APERTURE,
  bokehMaxBlur: DEFAULT_BOKEH_MAX_BLUR,

  // Lighting
  lightEnabled: DEFAULT_LIGHT_ENABLED,
  lightColor: DEFAULT_LIGHT_COLOR,
  lightHorizontalAngle: DEFAULT_LIGHT_HORIZONTAL_ANGLE,
  lightVerticalAngle: DEFAULT_LIGHT_VERTICAL_ANGLE,
  ambientIntensity: DEFAULT_AMBIENT_INTENSITY,
  ambientColor: DEFAULT_AMBIENT_COLOR,
  specularIntensity: DEFAULT_SPECULAR_INTENSITY,
  shininess: DEFAULT_SHININESS,
  showLightIndicator: DEFAULT_SHOW_LIGHT_INDICATOR,

  // Enhanced lighting
  specularColor: DEFAULT_SPECULAR_COLOR,
  diffuseIntensity: DEFAULT_DIFFUSE_INTENSITY,
  lightStrength: DEFAULT_LIGHT_STRENGTH,
  toneMappingEnabled: DEFAULT_TONE_MAPPING_ENABLED,
  toneMappingAlgorithm: DEFAULT_TONE_MAPPING_ALGORITHM,
  exposure: DEFAULT_EXPOSURE,

  // Depth effects
  depthAttenuationEnabled: DEFAULT_DEPTH_ATTENUATION_ENABLED,
  depthAttenuationStrength: DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
  fresnelIntensity: DEFAULT_FRESNEL_INTENSITY,
  perDimensionColorEnabled: DEFAULT_PER_DIMENSION_COLOR_ENABLED,

  // Ground plane
  activeWalls: [...DEFAULT_ACTIVE_WALLS],
  groundPlaneOffset: DEFAULT_GROUND_PLANE_OFFSET,
  groundPlaneOpacity: DEFAULT_GROUND_PLANE_OPACITY,
  groundPlaneReflectivity: DEFAULT_GROUND_PLANE_REFLECTIVITY,
  groundPlaneColor: DEFAULT_GROUND_PLANE_COLOR,
  groundPlaneType: DEFAULT_GROUND_PLANE_TYPE,
  groundPlaneSizeScale: DEFAULT_GROUND_PLANE_SIZE_SCALE,
  showGroundGrid: DEFAULT_SHOW_GROUND_GRID,
  groundGridColor: DEFAULT_GROUND_GRID_COLOR,
  groundGridSpacing: DEFAULT_GROUND_GRID_SPACING,

  // Ground material
  groundMaterialRoughness: DEFAULT_GROUND_MATERIAL_ROUGHNESS,
  groundMaterialMetalness: DEFAULT_GROUND_MATERIAL_METALNESS,
  groundMaterialEnvMapIntensity: DEFAULT_GROUND_MATERIAL_ENVMAP_INTENSITY,

  // Axis helper
  showAxisHelper: DEFAULT_SHOW_AXIS_HELPER,

  // Animation
  animationBias: DEFAULT_ANIMATION_BIAS,

  // Multi-light system
  lights: DEFAULT_LIGHTS,
  selectedLightId: DEFAULT_SELECTED_LIGHT_ID,
  transformMode: DEFAULT_TRANSFORM_MODE,
  showLightGizmos: DEFAULT_SHOW_LIGHT_GIZMOS,
  isDraggingLight: false,
}

type VisualStateFunctions = Pick<
  VisualState,
  | 'setEdgeColor'
  | 'setEdgeThickness'
  | 'setFaceOpacity'
  | 'setFaceColor'
  | 'setBackgroundColor'
  | 'setColorAlgorithm'
  | 'setCosineCoefficients'
  | 'setCosineCoefficient'
  | 'setDistribution'
  | 'setMultiSourceWeights'
  | 'setLchLightness'
  | 'setLchChroma'
  | 'setEdgesVisible'
  | 'setFacesVisible'
  | 'setShaderType'
  | 'setWireframeSettings'
  | 'setSurfaceSettings'
  | 'setBloomEnabled'
  | 'setBloomIntensity'
  | 'setBloomThreshold'
  | 'setBloomRadius'
  | 'setBokehEnabled'
  | 'setBokehFocus'
  | 'setBokehAperture'
  | 'setBokehMaxBlur'
  | 'setLightEnabled'
  | 'setLightColor'
  | 'setLightHorizontalAngle'
  | 'setLightVerticalAngle'
  | 'setAmbientIntensity'
  | 'setAmbientColor'
  | 'setSpecularIntensity'
  | 'setShininess'
  | 'setShowLightIndicator'
  | 'setSpecularColor'
  | 'setDiffuseIntensity'
  | 'setLightStrength'
  | 'setToneMappingEnabled'
  | 'setToneMappingAlgorithm'
  | 'setExposure'
  | 'setDepthAttenuationEnabled'
  | 'setDepthAttenuationStrength'
  | 'setFresnelEnabled'
  | 'setFresnelIntensity'
  | 'setPerDimensionColorEnabled'
  | 'setActiveWalls'
  | 'toggleWall'
  | 'setGroundPlaneOffset'
  | 'setGroundPlaneOpacity'
  | 'setGroundPlaneReflectivity'
  | 'setGroundPlaneColor'
  | 'setGroundPlaneType'
  | 'setGroundPlaneSizeScale'
  | 'setShowGroundGrid'
  | 'setGroundGridColor'
  | 'setGroundGridSpacing'
  | 'setGroundMaterialRoughness'
  | 'setGroundMaterialMetalness'
  | 'setGroundMaterialEnvMapIntensity'
  | 'setShowAxisHelper'
  | 'setAnimationBias'
  | 'addLight'
  | 'removeLight'
  | 'updateLight'
  | 'duplicateLight'
  | 'selectLight'
  | 'setTransformMode'
  | 'setShowLightGizmos'
  | 'setIsDraggingLight'
  | 'applyPreset'
  | 'reset'
>

// ============================================================================
// Store Implementation
// ============================================================================

export const useVisualStore = create<VisualState>((set) => ({
  ...INITIAL_STATE,

  // --- Actions: Basic Visual ---
  setEdgeColor: (color: string) => {
    set({ edgeColor: color })
  },

  setEdgeThickness: (thickness: number) => {
    set({ edgeThickness: Math.max(1, Math.min(5, thickness)) })
  },

  setFaceOpacity: (opacity: number) => {
    set({ faceOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setFaceColor: (color: string) => {
    set({ faceColor: color })
  },

  setBackgroundColor: (color: string) => {
    set({ backgroundColor: color })
  },

  // --- Actions: Advanced Color System ---
  setColorAlgorithm: (algorithm: ColorAlgorithm) => {
    set({ colorAlgorithm: algorithm })
  },

  setCosineCoefficients: (coefficients: CosineCoefficients) => {
    set({ cosineCoefficients: { ...coefficients } })
  },

  setCosineCoefficient: (key: 'a' | 'b' | 'c' | 'd', index: number, value: number) => {
    set((state) => {
      const newCoefficients = { ...state.cosineCoefficients }
      const arr = [...newCoefficients[key]] as [number, number, number]
      arr[index] = Math.max(0, Math.min(2, value))
      newCoefficients[key] = arr
      return { cosineCoefficients: newCoefficients }
    })
  },

  setDistribution: (settings: Partial<DistributionSettings>) => {
    set((state) => ({
      distribution: {
        ...state.distribution,
        power:
          settings.power !== undefined
            ? Math.max(0.25, Math.min(4, settings.power))
            : state.distribution.power,
        cycles:
          settings.cycles !== undefined
            ? Math.max(0.5, Math.min(5, settings.cycles))
            : state.distribution.cycles,
        offset:
          settings.offset !== undefined
            ? Math.max(0, Math.min(1, settings.offset))
            : state.distribution.offset,
      },
    }))
  },

  setMultiSourceWeights: (weights: Partial<MultiSourceWeights>) => {
    set((state) => ({
      multiSourceWeights: {
        ...state.multiSourceWeights,
        depth:
          weights.depth !== undefined
            ? Math.max(0, Math.min(1, weights.depth))
            : state.multiSourceWeights.depth,
        orbitTrap:
          weights.orbitTrap !== undefined
            ? Math.max(0, Math.min(1, weights.orbitTrap))
            : state.multiSourceWeights.orbitTrap,
        normal:
          weights.normal !== undefined
            ? Math.max(0, Math.min(1, weights.normal))
            : state.multiSourceWeights.normal,
      },
    }))
  },

  setLchLightness: (lightness: number) => {
    set({ lchLightness: Math.max(0.1, Math.min(1, lightness)) })
  },

  setLchChroma: (chroma: number) => {
    set({ lchChroma: Math.max(0, Math.min(0.4, chroma)) })
  },

  // --- Actions: Render Mode Toggles ---
  setEdgesVisible: (visible: boolean) => {
    set({ edgesVisible: visible })
  },

  setFacesVisible: (visible: boolean) => {
    // Auto-set shader type based on faces visibility (PRD: Faces Toggle Behavior)
    set({
      facesVisible: visible,
      shaderType: visible ? 'surface' : 'wireframe',
    })
  },

  // --- Actions: Shader System ---
  setShaderType: (shaderType: ShaderType) => {
    set({ shaderType })
  },

  setWireframeSettings: (settings: Partial<WireframeSettings>) => {
    set((state) => ({
      shaderSettings: {
        ...state.shaderSettings,
        wireframe: {
          ...state.shaderSettings.wireframe,
          ...settings,
          lineThickness:
            settings.lineThickness !== undefined
              ? Math.max(1, Math.min(5, settings.lineThickness))
              : state.shaderSettings.wireframe.lineThickness,
        },
      },
    }))
  },

  setSurfaceSettings: (settings: Partial<SurfaceSettings>) => {
    set((state) => ({
      shaderSettings: {
        ...state.shaderSettings,
        surface: {
          ...state.shaderSettings.surface,
          ...settings,
          faceOpacity:
            settings.faceOpacity !== undefined
              ? Math.max(0, Math.min(1, settings.faceOpacity))
              : state.shaderSettings.surface.faceOpacity,
          specularIntensity:
            settings.specularIntensity !== undefined
              ? Math.max(0, Math.min(2, settings.specularIntensity))
              : state.shaderSettings.surface.specularIntensity,
          shininess:
            settings.shininess !== undefined
              ? Math.max(1, Math.min(128, settings.shininess))
              : state.shaderSettings.surface.shininess,
        },
      },
    }))
  },

  // --- Actions: Bloom ---
  setBloomEnabled: (enabled: boolean) => {
    set({ bloomEnabled: enabled })
  },

  setBloomIntensity: (intensity: number) => {
    set({ bloomIntensity: Math.max(0, Math.min(2, intensity)) })
  },

  setBloomThreshold: (threshold: number) => {
    set({ bloomThreshold: Math.max(0, Math.min(1, threshold)) })
  },

  setBloomRadius: (radius: number) => {
    set({ bloomRadius: Math.max(0, Math.min(1, radius)) })
  },

  // --- Actions: Bokeh ---
  setBokehEnabled: (enabled: boolean) => {
    set({ bokehEnabled: enabled })
  },

  setBokehFocus: (focus: number) => {
    set({ bokehFocus: Math.max(0.1, Math.min(10, focus)) })
  },

  setBokehAperture: (aperture: number) => {
    set({ bokehAperture: Math.max(0.001, Math.min(0.1, aperture)) })
  },

  setBokehMaxBlur: (maxBlur: number) => {
    set({ bokehMaxBlur: Math.max(0, Math.min(0.1, maxBlur)) })
  },

  // --- Actions: Lighting ---
  setLightEnabled: (enabled: boolean) => {
    set({ lightEnabled: enabled })
  },

  setLightColor: (color: string) => {
    set({ lightColor: color })
  },

  setLightHorizontalAngle: (angle: number) => {
    // Normalize to 0-360
    const normalized = ((angle % 360) + 360) % 360
    set({ lightHorizontalAngle: normalized })
  },

  setLightVerticalAngle: (angle: number) => {
    set({ lightVerticalAngle: Math.max(-90, Math.min(90, angle)) })
  },

  setAmbientIntensity: (intensity: number) => {
    set({ ambientIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  setAmbientColor: (color: string) => {
    set({ ambientColor: color })
  },

  setSpecularIntensity: (intensity: number) => {
    set({ specularIntensity: Math.max(0, Math.min(2, intensity)) })
  },

  setShininess: (shininess: number) => {
    set({ shininess: Math.max(1, Math.min(128, shininess)) })
  },

  setShowLightIndicator: (show: boolean) => {
    set({ showLightIndicator: show })
  },

  // --- Actions: Enhanced Lighting ---
  setSpecularColor: (color: string) => {
    set({ specularColor: color })
  },

  setDiffuseIntensity: (intensity: number) => {
    set({ diffuseIntensity: Math.max(0, Math.min(2, intensity)) })
  },

  setLightStrength: (strength: number) => {
    set({ lightStrength: Math.max(0, Math.min(3, strength)) })
  },

  setToneMappingEnabled: (enabled: boolean) => {
    set({ toneMappingEnabled: enabled })
  },

  setToneMappingAlgorithm: (algorithm: ToneMappingAlgorithm) => {
    set({ toneMappingAlgorithm: algorithm })
  },

  setExposure: (exposure: number) => {
    set({ exposure: Math.max(0.1, Math.min(3, exposure)) })
  },

  // --- Actions: Depth Effects ---
  setDepthAttenuationEnabled: (enabled: boolean) => {
    set({ depthAttenuationEnabled: enabled })
  },

  setDepthAttenuationStrength: (strength: number) => {
    set({ depthAttenuationStrength: Math.max(0, Math.min(0.5, strength)) })
  },

  setFresnelEnabled: (enabled: boolean) => {
    set({ fresnelEnabled: enabled })
  },

  setFresnelIntensity: (intensity: number) => {
    set({ fresnelIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  setPerDimensionColorEnabled: (enabled: boolean) => {
    set({ perDimensionColorEnabled: enabled })
  },

  // --- Actions: Ground Plane ---
  setActiveWalls: (walls: WallPosition[]) => {
    set({ activeWalls: [...walls] })
  },

  toggleWall: (wall: WallPosition) => {
    set((state) => {
      const isActive = state.activeWalls.includes(wall)
      if (isActive) {
        return { activeWalls: state.activeWalls.filter((w) => w !== wall) }
      } else {
        return { activeWalls: [...state.activeWalls, wall] }
      }
    })
  },

  setGroundPlaneOffset: (offset: number) => {
    set({ groundPlaneOffset: Math.max(0, Math.min(10, offset)) })
  },

  setGroundPlaneOpacity: (opacity: number) => {
    set({ groundPlaneOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setGroundPlaneReflectivity: (reflectivity: number) => {
    set({ groundPlaneReflectivity: Math.max(0, Math.min(1, reflectivity)) })
  },

  setGroundPlaneColor: (color: string) => {
    set({ groundPlaneColor: color })
  },

  setGroundPlaneType: (type: GroundPlaneType) => {
    set({ groundPlaneType: type })
  },

  setGroundPlaneSizeScale: (scale: number) => {
    set({ groundPlaneSizeScale: Math.max(1, Math.min(5, scale)) })
  },

  setShowGroundGrid: (show: boolean) => {
    set({ showGroundGrid: show })
  },

  setGroundGridColor: (color: string) => {
    set({ groundGridColor: color })
  },

  setGroundGridSpacing: (spacing: number) => {
    set({ groundGridSpacing: Math.max(0.5, Math.min(5, spacing)) })
  },

  // --- Actions: Ground Material ---
  setGroundMaterialRoughness: (roughness: number) => {
    set({ groundMaterialRoughness: Math.max(0, Math.min(1, roughness)) })
  },

  setGroundMaterialMetalness: (metalness: number) => {
    set({ groundMaterialMetalness: Math.max(0, Math.min(1, metalness)) })
  },

  setGroundMaterialEnvMapIntensity: (intensity: number) => {
    set({ groundMaterialEnvMapIntensity: Math.max(0, Math.min(1, intensity)) })
  },

  // --- Actions: Axis Helper ---
  setShowAxisHelper: (show: boolean) => {
    set({ showAxisHelper: show })
  },

  // --- Actions: Animation ---
  setAnimationBias: (bias: number) => {
    set({ animationBias: Math.max(0, Math.min(1, bias)) })
  },

  // --- Actions: Multi-Light System ---
  addLight: (type: LightType) => {
    const state = useVisualStore.getState()
    if (state.lights.length >= MAX_LIGHTS) {
      return null
    }
    const newLight = createNewLight(type, state.lights.length)
    set({ lights: [...state.lights, newLight], selectedLightId: newLight.id })
    return newLight.id
  },

  removeLight: (id: string) => {
    const state = useVisualStore.getState()
    // Cannot remove if only one light remains
    if (state.lights.length <= MIN_LIGHTS) {
      return
    }
    const newLights = state.lights.filter((light) => light.id !== id)
    // If the removed light was selected, deselect
    const newSelectedId = state.selectedLightId === id ? null : state.selectedLightId
    set({ lights: newLights, selectedLightId: newSelectedId })
  },

  updateLight: (id: string, updates: Partial<Omit<LightSource, 'id'>>) => {
    set((state) => ({
      lights: state.lights.map((light) => {
        if (light.id !== id) return light
        return {
          ...light,
          ...updates,
          // Apply validation for specific fields
          intensity:
            updates.intensity !== undefined ? clampIntensity(updates.intensity) : light.intensity,
          coneAngle:
            updates.coneAngle !== undefined ? clampConeAngle(updates.coneAngle) : light.coneAngle,
          penumbra:
            updates.penumbra !== undefined ? clampPenumbra(updates.penumbra) : light.penumbra,
        }
      }),
    }))
  },

  duplicateLight: (id: string) => {
    const state = useVisualStore.getState()
    if (state.lights.length >= MAX_LIGHTS) {
      return null
    }
    const sourceLight = state.lights.find((light) => light.id === id)
    if (!sourceLight) {
      return null
    }
    const newLight = cloneLight(sourceLight)
    set({ lights: [...state.lights, newLight], selectedLightId: newLight.id })
    return newLight.id
  },

  selectLight: (id: string | null) => {
    set({ selectedLightId: id })
  },

  setTransformMode: (mode: TransformMode) => {
    set({ transformMode: mode })
  },

  setShowLightGizmos: (show: boolean) => {
    set({ showLightGizmos: show })
  },

  setIsDraggingLight: (dragging: boolean) => {
    set({ isDraggingLight: dragging })
  },

  // --- Actions: Presets & Reset ---
  applyPreset: (preset: VisualPreset) => {
    const settings = VISUAL_PRESETS[preset]
    if (!settings) return

    const updates: Partial<VisualState> = {
      edgeColor: settings.edgeColor,
      edgeThickness: settings.edgeThickness,
      backgroundColor: settings.backgroundColor,
    }

    // Handle optional faceColor (only synthwave has it)
    if ('faceColor' in settings && settings.faceColor) {
      updates.faceColor = settings.faceColor
    }

    set(updates)
  },

  reset: () => {
    set({ ...INITIAL_STATE })
  },
}))
