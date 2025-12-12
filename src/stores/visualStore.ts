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

import { type ColorMode, DEFAULT_COLOR_MODE } from '@/lib/shaders/palette'
import type {
  AllShaderSettings,
  ShaderType,
  SurfaceSettings,
  WireframeSettings,
} from '@/lib/shaders/types'
import { create } from 'zustand'

// ============================================================================
// Default Values
// ============================================================================

/** Default visual settings */
export const DEFAULT_EDGE_COLOR = '#19e697'
export const DEFAULT_EDGE_THICKNESS = 1
export const DEFAULT_VERTEX_VISIBLE = false
export const DEFAULT_VERTEX_SIZE = 1
export const DEFAULT_VERTEX_COLOR = '#19e697'
export const DEFAULT_FACE_OPACITY = 0.3
export const DEFAULT_FACE_COLOR = '#33cc9e'
export const DEFAULT_BACKGROUND_COLOR = '#0F0F1A'

/** Default render mode toggle settings */
export const DEFAULT_EDGES_VISIBLE = true
export const DEFAULT_FACES_VISIBLE = true

/** Default bloom settings (matching original Dual Filter Bloom) */
export const DEFAULT_BLOOM_ENABLED = true
export const DEFAULT_BLOOM_INTENSITY = 0.3
export const DEFAULT_BLOOM_THRESHOLD = 0
export const DEFAULT_BLOOM_RADIUS = 0.3
export const DEFAULT_BLOOM_SOFT_KNEE = 0 // Soft transition at threshold edge
export const DEFAULT_BLOOM_LEVELS = 4 // Mip levels (matches original kMaxMipLevels)

/** Default lighting settings */
export const DEFAULT_LIGHT_ENABLED = true
export const DEFAULT_LIGHT_COLOR = '#FFFFFF'
export const DEFAULT_LIGHT_HORIZONTAL_ANGLE = 45
export const DEFAULT_LIGHT_VERTICAL_ANGLE = 30
export const DEFAULT_AMBIENT_INTENSITY = 0.01
export const DEFAULT_SPECULAR_INTENSITY = 0.5
export const DEFAULT_SPECULAR_POWER = 12
export const DEFAULT_SHOW_LIGHT_INDICATOR = false

/** Default depth effect settings */
export const DEFAULT_DEPTH_ATTENUATION_ENABLED = true
export const DEFAULT_DEPTH_ATTENUATION_STRENGTH = 0.3
export const DEFAULT_FRESNEL_ENABLED = true
export const DEFAULT_FRESNEL_INTENSITY = 0.5
export const DEFAULT_PER_DIMENSION_COLOR_ENABLED = false

/** Default ground plane settings */
export const DEFAULT_SHOW_GROUND_PLANE = true
export const DEFAULT_GROUND_PLANE_OFFSET = 0.5 // Distance below object's lowest point
export const DEFAULT_GROUND_PLANE_OPACITY = 0.3
export const DEFAULT_GROUND_PLANE_REFLECTIVITY = 0.4

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
  specularPower: DEFAULT_SPECULAR_POWER,
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
  vertexColor: string
  vertexSize: number
  backgroundColor: string
  faceColor?: string
}

/** Visual presets */
export const VISUAL_PRESETS = {
  neon: {
    edgeColor: '#00FF88',
    edgeThickness: 3,
    vertexColor: '#FF00FF',
    vertexSize: 5,
    backgroundColor: '#0A0A12',
  },
  blueprint: {
    edgeColor: '#4488FF',
    edgeThickness: 1,
    vertexColor: '#88AAFF',
    vertexSize: 3,
    backgroundColor: '#0A1628',
  },
  hologram: {
    edgeColor: '#00FFFF',
    edgeThickness: 2,
    vertexColor: '#00FFFF',
    vertexSize: 4,
    backgroundColor: '#000011',
  },
  scientific: {
    edgeColor: '#FFFFFF',
    edgeThickness: 1,
    vertexColor: '#FF4444',
    vertexSize: 3,
    backgroundColor: '#1A1A2E',
  },
  synthwave: {
    edgeColor: '#FF00FF',
    edgeThickness: 2,
    vertexColor: '#00FFFF',
    vertexSize: 4,
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
  /** Whether vertices are visible */
  vertexVisible: boolean
  /** Size of vertex points (1-10) */
  vertexSize: number
  /** Color of vertices (hex string) */
  vertexColor: string
  /** Opacity of faces (0-1, 0 = wireframe) */
  faceOpacity: number
  /** Color of faces (hex string) */
  faceColor: string
  /** Color palette mode for surface rendering */
  colorMode: ColorMode
  /** Background color (hex string) */
  backgroundColor: string

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
  /** Soft knee - smooth transition at threshold edge (0-1) */
  bloomSoftKnee: number
  /** Number of mip levels for blur chain (1-8) */
  bloomLevels: number

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
  /** Specular highlight intensity (0-2) */
  specularIntensity: number
  /** Specular power/shininess (1-128) */
  specularPower: number
  /** Whether to show light direction indicator */
  showLightIndicator: boolean

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
  /** Whether ground plane is visible */
  showGroundPlane: boolean
  /** Ground plane offset below object (0-2) */
  groundPlaneOffset: number
  /** Ground plane opacity (0-1) */
  groundPlaneOpacity: number
  /** Ground plane reflectivity (0-1) */
  groundPlaneReflectivity: number

  // --- Actions: Basic Visual ---
  setEdgeColor: (color: string) => void
  setEdgeThickness: (thickness: number) => void
  setVertexVisible: (visible: boolean) => void
  setVertexSize: (size: number) => void
  setVertexColor: (color: string) => void
  setFaceOpacity: (opacity: number) => void
  setFaceColor: (color: string) => void
  setColorMode: (mode: ColorMode) => void
  setBackgroundColor: (color: string) => void

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
  setBloomSoftKnee: (softKnee: number) => void
  setBloomLevels: (levels: number) => void

  // --- Actions: Lighting ---
  setLightEnabled: (enabled: boolean) => void
  setLightColor: (color: string) => void
  setLightHorizontalAngle: (angle: number) => void
  setLightVerticalAngle: (angle: number) => void
  setAmbientIntensity: (intensity: number) => void
  setSpecularIntensity: (intensity: number) => void
  setSpecularPower: (power: number) => void
  setShowLightIndicator: (show: boolean) => void

  // --- Actions: Depth Effects ---
  setDepthAttenuationEnabled: (enabled: boolean) => void
  setDepthAttenuationStrength: (strength: number) => void
  setFresnelEnabled: (enabled: boolean) => void
  setFresnelIntensity: (intensity: number) => void
  setPerDimensionColorEnabled: (enabled: boolean) => void

  // --- Actions: Ground Plane ---
  setShowGroundPlane: (show: boolean) => void
  setGroundPlaneOffset: (offset: number) => void
  setGroundPlaneOpacity: (opacity: number) => void
  setGroundPlaneReflectivity: (reflectivity: number) => void

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
  vertexVisible: DEFAULT_VERTEX_VISIBLE,
  vertexSize: DEFAULT_VERTEX_SIZE,
  vertexColor: DEFAULT_VERTEX_COLOR,
  faceOpacity: DEFAULT_FACE_OPACITY,
  faceColor: DEFAULT_FACE_COLOR,
  colorMode: DEFAULT_COLOR_MODE,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,

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
  bloomSoftKnee: DEFAULT_BLOOM_SOFT_KNEE,
  bloomLevels: DEFAULT_BLOOM_LEVELS,

  // Lighting
  lightEnabled: DEFAULT_LIGHT_ENABLED,
  lightColor: DEFAULT_LIGHT_COLOR,
  lightHorizontalAngle: DEFAULT_LIGHT_HORIZONTAL_ANGLE,
  lightVerticalAngle: DEFAULT_LIGHT_VERTICAL_ANGLE,
  ambientIntensity: DEFAULT_AMBIENT_INTENSITY,
  specularIntensity: DEFAULT_SPECULAR_INTENSITY,
  specularPower: DEFAULT_SPECULAR_POWER,
  showLightIndicator: DEFAULT_SHOW_LIGHT_INDICATOR,

  // Depth effects
  depthAttenuationEnabled: DEFAULT_DEPTH_ATTENUATION_ENABLED,
  depthAttenuationStrength: DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
  fresnelIntensity: DEFAULT_FRESNEL_INTENSITY,
  perDimensionColorEnabled: DEFAULT_PER_DIMENSION_COLOR_ENABLED,

  // Ground plane
  showGroundPlane: DEFAULT_SHOW_GROUND_PLANE,
  groundPlaneOffset: DEFAULT_GROUND_PLANE_OFFSET,
  groundPlaneOpacity: DEFAULT_GROUND_PLANE_OPACITY,
  groundPlaneReflectivity: DEFAULT_GROUND_PLANE_REFLECTIVITY,
}

type VisualStateFunctions = Pick<
  VisualState,
  | 'setEdgeColor'
  | 'setEdgeThickness'
  | 'setVertexVisible'
  | 'setVertexSize'
  | 'setVertexColor'
  | 'setFaceOpacity'
  | 'setFaceColor'
  | 'setColorMode'
  | 'setBackgroundColor'
  | 'setEdgesVisible'
  | 'setFacesVisible'
  | 'setShaderType'
  | 'setWireframeSettings'
  | 'setSurfaceSettings'
  | 'setBloomEnabled'
  | 'setBloomIntensity'
  | 'setBloomThreshold'
  | 'setBloomRadius'
  | 'setBloomSoftKnee'
  | 'setBloomLevels'
  | 'setLightEnabled'
  | 'setLightColor'
  | 'setLightHorizontalAngle'
  | 'setLightVerticalAngle'
  | 'setAmbientIntensity'
  | 'setSpecularIntensity'
  | 'setSpecularPower'
  | 'setShowLightIndicator'
  | 'setDepthAttenuationEnabled'
  | 'setDepthAttenuationStrength'
  | 'setFresnelEnabled'
  | 'setFresnelIntensity'
  | 'setPerDimensionColorEnabled'
  | 'setShowGroundPlane'
  | 'setGroundPlaneOffset'
  | 'setGroundPlaneOpacity'
  | 'setGroundPlaneReflectivity'
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

  setVertexVisible: (visible: boolean) => {
    set({ vertexVisible: visible })
  },

  setVertexSize: (size: number) => {
    set({ vertexSize: Math.max(1, Math.min(10, size)) })
  },

  setVertexColor: (color: string) => {
    set({ vertexColor: color })
  },

  setFaceOpacity: (opacity: number) => {
    set({ faceOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setFaceColor: (color: string) => {
    set({ faceColor: color })
  },

  setColorMode: (mode: ColorMode) => {
    set({ colorMode: mode })
  },

  setBackgroundColor: (color: string) => {
    set({ backgroundColor: color })
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
          specularPower:
            settings.specularPower !== undefined
              ? Math.max(1, Math.min(128, settings.specularPower))
              : state.shaderSettings.surface.specularPower,
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

  setBloomSoftKnee: (softKnee: number) => {
    set({ bloomSoftKnee: Math.max(0, Math.min(1, softKnee)) })
  },

  setBloomLevels: (levels: number) => {
    set({ bloomLevels: Math.max(1, Math.min(8, Math.round(levels))) })
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

  setSpecularIntensity: (intensity: number) => {
    set({ specularIntensity: Math.max(0, Math.min(2, intensity)) })
  },

  setSpecularPower: (power: number) => {
    set({ specularPower: Math.max(1, Math.min(128, power)) })
  },

  setShowLightIndicator: (show: boolean) => {
    set({ showLightIndicator: show })
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
  setShowGroundPlane: (show: boolean) => {
    set({ showGroundPlane: show })
  },

  setGroundPlaneOffset: (offset: number) => {
    set({ groundPlaneOffset: Math.max(0, Math.min(2, offset)) })
  },

  setGroundPlaneOpacity: (opacity: number) => {
    set({ groundPlaneOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setGroundPlaneReflectivity: (reflectivity: number) => {
    set({ groundPlaneReflectivity: Math.max(0, Math.min(1, reflectivity)) })
  },

  // --- Actions: Presets & Reset ---
  applyPreset: (preset: VisualPreset) => {
    const settings = VISUAL_PRESETS[preset]
    if (!settings) return

    const updates: Partial<VisualState> = {
      edgeColor: settings.edgeColor,
      edgeThickness: settings.edgeThickness,
      vertexColor: settings.vertexColor,
      vertexSize: settings.vertexSize,
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
