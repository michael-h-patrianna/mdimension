/**
 * Color Palette Type Definitions
 *
 * Shared types for the unified color palette system.
 * Used by both shaders and UI components.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// ============================================================================
// Color Algorithm System
// ============================================================================

/**
 * Color algorithm selection.
 * Determines how the color palette is generated.
 *
 * - monochromatic: Same hue, varying lightness only (based on base color)
 * - analogous: Hue varies ±30° from base color
 * - cosine: Smooth cosine gradient palette (Inigo Quilez technique)
 * - normal: Color based on surface normal direction
 * - distance: Color based on distance field value
 * - lch: Perceptually uniform LCH/Oklab color space
 * - multiSource: Blend multiple value sources for complex coloring
 */
export type ColorAlgorithm =
  | 'monochromatic'
  | 'analogous'
  | 'cosine'
  | 'normal'
  | 'distance'
  | 'lch'
  | 'multiSource'

/**
 * Options for the Color Algorithm dropdown in the UI.
 */
export const COLOR_ALGORITHM_OPTIONS = [
  { value: 'monochromatic' as const, label: 'Monochromatic' },
  { value: 'analogous' as const, label: 'Analogous' },
  { value: 'cosine' as const, label: 'Cosine Gradient' },
  { value: 'normal' as const, label: 'Normal-Based' },
  { value: 'distance' as const, label: 'Distance Field' },
  { value: 'lch' as const, label: 'LCH Perceptual' },
  { value: 'multiSource' as const, label: 'Multi-Source' },
] as const

/**
 * Map from ColorAlgorithm string to integer for shader uniform.
 */
export const COLOR_ALGORITHM_TO_INT: Record<ColorAlgorithm, number> = {
  monochromatic: 0,
  analogous: 1,
  cosine: 2,
  normal: 3,
  distance: 4,
  lch: 5,
  multiSource: 6,
}

/**
 * Cosine palette coefficients for the Inigo Quilez technique.
 * Formula: color = a + b * cos(2π * (c * t + d))
 *
 * Each array represents [R, G, B] components.
 */
export interface CosineCoefficients {
  /** Base offset - shifts the entire palette */
  a: [number, number, number]
  /** Amplitude - controls color intensity range */
  b: [number, number, number]
  /** Frequency - how many color cycles */
  c: [number, number, number]
  /** Phase - shifts colors along the gradient */
  d: [number, number, number]
}

/**
 * Distribution controls for remapping the input value (t).
 * Applied before palette lookup to shape color distribution.
 */
export interface DistributionSettings {
  /** Power curve exponent (0.25-4.0). <1 expands darks, >1 expands lights */
  power: number
  /** Number of palette cycles (0.5-5.0). >1 repeats the gradient */
  cycles: number
  /** Offset shift (0.0-1.0). Slides the gradient start point */
  offset: number
}

/**
 * Default cosine coefficients (rainbow gradient).
 */
export const DEFAULT_COSINE_COEFFICIENTS: CosineCoefficients = {
  a: [0.5, 0.5, 0.5],
  b: [0.5, 0.5, 0.5],
  c: [1.0, 1.0, 1.0],
  d: [0.0, 0.33, 0.67],
}

/**
 * Default distribution settings (no transformation).
 */
export const DEFAULT_DISTRIBUTION: DistributionSettings = {
  power: 1.0,
  cycles: 1.0,
  offset: 0.0,
}

/**
 * Default color algorithm for new sessions.
 */
export const DEFAULT_COLOR_ALGORITHM: ColorAlgorithm = 'cosine'

/**
 * Multi-source weight configuration for blending different value sources.
 */
export interface MultiSourceWeights {
  /** Weight for depth/iteration value */
  depth: number
  /** Weight for orbit trap value (fractals only) */
  orbitTrap: number
  /** Weight for normal direction */
  normal: number
}

/**
 * Default multi-source weights.
 */
export const DEFAULT_MULTI_SOURCE_WEIGHTS: MultiSourceWeights = {
  depth: 0.5,
  orbitTrap: 0.3,
  normal: 0.2,
}
