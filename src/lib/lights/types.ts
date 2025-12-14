/**
 * Multi-Light System Types
 *
 * Type definitions for the advanced lighting system supporting up to 4
 * dynamic light sources of different types (Point, Directional, Spot).
 *
 * @see docs/prd/advanced-lighting-system.md
 */

/**
 * Light source type enumeration.
 * - point: Radiates light equally in all directions from position
 * - directional: Parallel rays in a fixed direction (like sunlight)
 * - spot: Cone of light from position in a specific direction
 */
export type LightType = 'point' | 'directional' | 'spot'

/**
 * Transform manipulation mode for gizmo controls.
 * - translate: Move light position via XYZ axis arrows
 * - rotate: Rotate light direction via XYZ rotation rings
 */
export type TransformMode = 'translate' | 'rotate'

/**
 * Light source configuration.
 * Represents a single dynamic light in the scene.
 */
export interface LightSource {
  /** Unique identifier for the light */
  id: string
  /** Display name shown in sidebar */
  name: string
  /** Light type (point, directional, spot) */
  type: LightType
  /** Whether the light is currently active */
  enabled: boolean
  /** World-space position [x, y, z] */
  position: [number, number, number]
  /** Euler rotation angles in radians [x, y, z] for direction */
  rotation: [number, number, number]
  /** Light color as hex string (e.g., '#FFFFFF') */
  color: string
  /** Light intensity multiplier (0-3) */
  intensity: number
  /** Spot light cone angle in degrees (1-120) */
  coneAngle: number
  /** Spot light penumbra/softness (0-1, where 0=hard edge, 1=fully soft) */
  penumbra: number
}

/** Maximum number of dynamic lights supported */
export const MAX_LIGHTS = 4

/** Minimum number of lights required (0 = can delete all lights) */
export const MIN_LIGHTS = 0

/**
 * Light type to GLSL shader integer mapping.
 * Must match constants in shader code.
 */
export const LIGHT_TYPE_TO_INT: Record<LightType, number> = {
  point: 0,
  directional: 1,
  spot: 2,
} as const

/**
 * Default values for new lights by type.
 */
export const DEFAULT_LIGHT_VALUES: Record<LightType, Partial<LightSource>> = {
  point: {
    coneAngle: 30,
    penumbra: 0.5,
  },
  directional: {
    coneAngle: 30,
    penumbra: 0.5,
  },
  spot: {
    coneAngle: 30,
    penumbra: 0.2,
  },
} as const

/**
 * Default position offset when adding new lights.
 * Each new light is offset to avoid overlapping.
 */
export const DEFAULT_NEW_LIGHT_POSITIONS: [number, number, number][] = [
  [5, 5, 5],
  [-5, 5, 5],
  [5, 5, -5],
  [-5, 5, -5],
]

/**
 * Create a default light matching the current single-light behavior.
 * Position derived from: horizontal=45deg, vertical=30deg, distance=10
 */
export function createDefaultLight(): LightSource {
  // Convert spherical coordinates to Cartesian
  // h=45deg, v=30deg, d=10 => x~6.12, y=5, z~6.12
  const h = (45 * Math.PI) / 180
  const v = (130 * Math.PI) / 180
  const d = 8

  return {
    id: 'light-default',
    name: 'Main Light',
    type: 'point',
    enabled: true,
    position: [Math.cos(v) * Math.cos(h) * d, Math.sin(v) * d, Math.cos(v) * Math.sin(h) * d],
    rotation: [0, 0, 0],
    color: '#FFFFFF',
    intensity: 1.0,
    coneAngle: 30,
    penumbra: 0.5,
  }
}

/**
 * Create a new light with sensible defaults.
 *
 * @param type - Light type to create
 * @param existingCount - Number of existing lights (for position offset)
 * @returns New light source configuration
 */
export function createNewLight(type: LightType, existingCount: number): LightSource {
  const positionIndex = Math.min(existingCount, DEFAULT_NEW_LIGHT_POSITIONS.length - 1)
  // Fallback to [5,5,5] if somehow index is out of bounds (shouldn't happen)
  const position =
    DEFAULT_NEW_LIGHT_POSITIONS[positionIndex] ?? ([5, 5, 5] as [number, number, number])
  const typeDefaults = DEFAULT_LIGHT_VALUES[type]

  // Generate unique ID
  const id = `light-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // Generate name based on type
  const typeName = type.charAt(0).toUpperCase() + type.slice(1)
  const name = `${typeName} Light ${existingCount + 1}`

  return {
    id,
    name,
    type,
    enabled: true,
    position: [position[0], position[1], position[2]] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    color: '#FFFFFF',
    intensity: 1.0,
    coneAngle: typeDefaults.coneAngle ?? 30,
    penumbra: typeDefaults.penumbra ?? 0.5,
  }
}

/**
 * Clone a light source with a new ID and offset position.
 *
 * @param source - Light to clone
 * @returns New light source with offset position
 */
export function cloneLight(source: LightSource): LightSource {
  const id = `light-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return {
    ...source,
    id,
    name: `${source.name} (Copy)`,
    position: [source.position[0] + 1, source.position[1], source.position[2]],
  }
}

/**
 * Calculate direction vector from Euler rotation angles.
 * Used for directional and spot lights.
 *
 * @param rotation - Euler angles in radians [x, y, z]
 * @returns Normalized direction vector [x, y, z]
 */
export function rotationToDirection(rotation: [number, number, number]): [number, number, number] {
  const [rx, ry] = rotation

  // Start with forward direction (0, 0, -1) and apply rotations
  // Apply Y rotation (yaw) then X rotation (pitch)
  const cosX = Math.cos(rx)
  const sinX = Math.sin(rx)
  const cosY = Math.cos(ry)
  const sinY = Math.sin(ry)

  return [-sinY * cosX, sinX, -cosY * cosX]
}

/**
 * Validate light intensity is within bounds.
 *
 * @param intensity - Input intensity value
 * @returns Clamped intensity (0-3)
 */
export function clampIntensity(intensity: number): number {
  return Math.max(0, Math.min(3, intensity))
}

/**
 * Validate cone angle is within bounds.
 *
 * @param angle - Input angle in degrees
 * @returns Clamped angle (1-120)
 */
export function clampConeAngle(angle: number): number {
  return Math.max(1, Math.min(120, angle))
}

/**
 * Validate penumbra is within bounds.
 *
 * @param penumbra - Input penumbra value
 * @returns Clamped penumbra (0-1)
 */
export function clampPenumbra(penumbra: number): number {
  return Math.max(0, Math.min(1, penumbra))
}
