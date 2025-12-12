/**
 * Shader Type System for Enhanced Visuals
 *
 * Defines shader types, per-shader settings interfaces, and defaults
 * for the enhanced visual rendering pipeline.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

/** Available shader types for polytope rendering */
export type ShaderType =
  | 'wireframe'
  | 'dualOutline'
  | 'surface';

/** Wireframe shader settings - simple line rendering */
export interface WireframeSettings {
  /** Line thickness in pixels (1-5) */
  lineThickness: number;
}

/** Dual outline shader settings - double-line edge effect */
export interface DualOutlineSettings {
  /** Inner line color (hex) */
  innerColor: string;
  /** Outer line color (hex) */
  outerColor: string;
  /** Gap between inner and outer lines in pixels (1-5) */
  gap: number;
}

/** Surface shader settings - filled faces with lighting */
export interface SurfaceSettings {
  /** Face opacity (0-1, 0 = wireframe, 1 = solid) */
  faceOpacity: number;
  /** Specular intensity multiplier (0-2) */
  specularIntensity: number;
  /** Specular power/shininess (1-128) */
  specularPower: number;
  /** Enable fresnel rim lighting effect */
  fresnelEnabled: boolean;
}

/** Union type for all shader settings */
export type ShaderSettings =
  | WireframeSettings
  | DualOutlineSettings
  | SurfaceSettings;

/** Complete shader settings object for all shader types */
export interface AllShaderSettings {
  wireframe: WireframeSettings;
  dualOutline: DualOutlineSettings;
  surface: SurfaceSettings;
}

/** Default settings for wireframe shader */
export const DEFAULT_WIREFRAME_SETTINGS: WireframeSettings = {
  lineThickness: 2,
};

/** Default settings for dual outline shader */
export const DEFAULT_DUAL_OUTLINE_SETTINGS: DualOutlineSettings = {
  innerColor: '#FFFFFF',
  outerColor: '#00FFFF',
  gap: 2,
};

/** Default settings for surface shader */
export const DEFAULT_SURFACE_SETTINGS: SurfaceSettings = {
  faceOpacity: 0.8,
  specularIntensity: 1.0,
  specularPower: 32,
  fresnelEnabled: true,
};

/** All default shader settings */
export const DEFAULT_SHADER_SETTINGS: AllShaderSettings = {
  wireframe: DEFAULT_WIREFRAME_SETTINGS,
  dualOutline: DEFAULT_DUAL_OUTLINE_SETTINGS,
  surface: DEFAULT_SURFACE_SETTINGS,
};

// ============================================================================
// Defaults
// ============================================================================

/** Default shader type */
export const DEFAULT_SHADER_TYPE: ShaderType = 'surface';

/** Shader display names for UI */
export const SHADER_DISPLAY_NAMES: Record<ShaderType, string> = {
  wireframe: 'Wireframe',
  dualOutline: 'Dual Outline',
  surface: 'Surface',
};

/** Shader descriptions for UI tooltips */
export const SHADER_DESCRIPTIONS: Record<ShaderType, string> = {
  wireframe: 'Simple solid color edges',
  dualOutline: 'Double-line edge effect',
  surface: 'Filled faces with lighting',
};

/**
 * Type guard to check if settings match a specific shader type
 */
export function isWireframeSettings(
  settings: ShaderSettings
): settings is WireframeSettings {
  return 'lineThickness' in settings;
}

export function isDualOutlineSettings(
  settings: ShaderSettings
): settings is DualOutlineSettings {
  return 'innerColor' in settings && 'outerColor' in settings && 'gap' in settings;
}

export function isSurfaceSettings(
  settings: ShaderSettings
): settings is SurfaceSettings {
  return 'faceOpacity' in settings && 'specularPower' in settings;
}

/**
 * Get default settings for a specific shader type
 */
export function getDefaultSettingsForShader(shaderType: ShaderType): ShaderSettings {
  return DEFAULT_SHADER_SETTINGS[shaderType];
}
