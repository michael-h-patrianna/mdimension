/**
 * Shader Type System for Enhanced Visuals
 *
 * Defines shader types and per-shader settings interfaces.
 * Default values are centralized in @/stores/visualStore.ts to avoid conflicts.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

/** Available shader types for polytope rendering */
export type ShaderType =
  | 'wireframe'
  | 'surface';

/** Wireframe shader settings - simple line rendering */
export interface WireframeSettings {
  /** Line thickness in pixels (1-5) */
  lineThickness: number;
}

/** Surface shader settings - filled faces with lighting */
export interface SurfaceSettings {
  /** Face opacity (0-1, 0 = wireframe, 1 = solid) */
  faceOpacity: number;
  /** Specular intensity multiplier (0-2) */
  specularIntensity: number;
  /** Shininess - controls specular highlight size (1-128, Three.js default: 30) */
  shininess: number;
  /** Enable fresnel rim lighting effect */
  fresnelEnabled: boolean;
}

/** Union type for all shader settings */
export type ShaderSettings =
  | WireframeSettings
  | SurfaceSettings;

/** Complete shader settings object for all shader types */
export interface AllShaderSettings {
  wireframe: WireframeSettings;
  surface: SurfaceSettings;
}

// ============================================================================
// NOTE: Default values are defined in @/stores/visualStore.ts
// This file contains only type definitions to avoid duplicate/conflicting defaults.
// Import DEFAULT_SHADER_SETTINGS, DEFAULT_SURFACE_SETTINGS, etc. from visualStore.
// ============================================================================

/** Shader display names for UI */
export const SHADER_DISPLAY_NAMES: Record<ShaderType, string> = {
  wireframe: 'Wireframe',
  surface: 'Surface',
};

/** Shader descriptions for UI tooltips */
export const SHADER_DESCRIPTIONS: Record<ShaderType, string> = {
  wireframe: 'Simple solid color edges',
  surface: 'Filled faces with lighting',
};

// ============================================================================
// Tone Mapping Types
// ============================================================================

/** Available tone mapping algorithms */
export type ToneMappingAlgorithm = 'reinhard' | 'aces' | 'uncharted2';

/** Tone mapping algorithm options for UI dropdown */
export const TONE_MAPPING_OPTIONS = [
  { value: 'reinhard' as const, label: 'Reinhard' },
  { value: 'aces' as const, label: 'ACES Filmic' },
  { value: 'uncharted2' as const, label: 'Uncharted 2' },
] as const;

/** Tone mapping algorithm to shader int mapping */
export const TONE_MAPPING_TO_INT: Record<ToneMappingAlgorithm, number> = {
  reinhard: 0,
  aces: 1,
  uncharted2: 2,
};

/**
 * Type guard to check if settings match a specific shader type
 * @param settings
 */
export function isWireframeSettings(
  settings: ShaderSettings
): settings is WireframeSettings {
  return 'lineThickness' in settings;
}

/**
 * Type guard to check if settings match surface shader type
 * @param settings
 */
export function isSurfaceSettings(
  settings: ShaderSettings
): settings is SurfaceSettings {
  return 'faceOpacity' in settings && 'shininess' in settings;
}

