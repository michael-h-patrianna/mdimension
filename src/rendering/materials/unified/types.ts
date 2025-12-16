/**
 * Unified Material Type Definitions
 *
 * Types for the unified N-dimensional material system.
 *
 * @module
 */

/**
 * Render mode for the material
 */
export type UnifiedRenderMode = 'solid' | 'wireframe' | 'points'

/**
 * Color mode for the material
 */
export type UnifiedColorMode = 'solid' | 'palette' | 'depth'

/**
 * Options for creating a unified material
 */
export interface UnifiedMaterialOptions {
  /** Render mode: solid faces, wireframe edges, or point cloud */
  renderMode?: UnifiedRenderMode
  /** Maximum dimension to support (default: 11) */
  maxDimension?: number
  /** Color mode for the material */
  colorMode?: UnifiedColorMode
  /** Base color (hex string or Color) */
  color?: string | import('three').Color
  /** Opacity (0-1) */
  opacity?: number
  /** Enable lighting calculations */
  lighting?: boolean
  /** Enable fresnel rim lighting */
  fresnelEnabled?: boolean
  /** Point size for points mode */
  pointSize?: number
  /** Line width for wireframe mode */
  lineWidth?: number
}

