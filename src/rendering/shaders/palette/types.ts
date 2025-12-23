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
 * - distance: Color based on distance field value (orbit trap)
 * - lch: Perceptually uniform LCH/Oklab color space
 * - multiSource: Blend multiple value sources for complex coloring
 * - radial: Color based on 3D distance from origin (spherical gradient)
 */
export type ColorAlgorithm =
  | 'monochromatic'
  | 'analogous'
  | 'cosine'
  | 'normal'
  | 'distance'
  | 'lch'
  | 'multiSource'
  | 'radial'
  | 'phase'
  | 'mixed'
  | 'blackbody'
  // Black hole-specific algorithms
  | 'accretionGradient' // Color by disk radial position
  | 'gravitationalRedshift' // Gravitational redshift effect
  | 'lensingIntensity' // Color by ray bend amount
  | 'jetsEmission' // Color for polar jets

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
  { value: 'radial' as const, label: 'Radial (from center)' },
  { value: 'phase' as const, label: 'Phase (Quantum)' },
  { value: 'mixed' as const, label: 'Mixed (Phase/Density)' },
  { value: 'blackbody' as const, label: 'Blackbody (Heat)' },
  // Black hole-specific
  { value: 'accretionGradient' as const, label: 'Accretion Gradient' },
  { value: 'gravitationalRedshift' as const, label: 'Gravitational Redshift' },
  { value: 'lensingIntensity' as const, label: 'Lensing Intensity' },
  { value: 'jetsEmission' as const, label: 'Jets Emission' },
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
  radial: 7,
  phase: 8,
  mixed: 9,
  blackbody: 10,
  // Black hole-specific
  accretionGradient: 11,
  gravitationalRedshift: 12,
  lensingIntensity: 13,
  jetsEmission: 14,
}

/**
 * Color algorithms that are only meaningful for Schroedinger (quantum wavefunction).
 * These use the actual quantum phase from the wavefunction, not geometric position.
 * For non-quantum objects, these should be hidden from the UI.
 */
export const QUANTUM_ONLY_ALGORITHMS: readonly ColorAlgorithm[] = [
  'phase',
  'mixed',
] as const

/**
 * Check if a color algorithm is quantum-specific (Schroedinger only).
 * @param algorithm - The color algorithm to check
 * @returns True if the algorithm is quantum-only
 */
export function isQuantumOnlyAlgorithm(algorithm: ColorAlgorithm): boolean {
  return QUANTUM_ONLY_ALGORITHMS.includes(algorithm)
}

/**
 * Color algorithms that are only meaningful for Black Hole objects.
 * These use gravitational/accretion-specific data.
 * For non-black-hole objects, these should be hidden from the UI.
 */
export const BLACKHOLE_ONLY_ALGORITHMS: readonly ColorAlgorithm[] = [
  'accretionGradient',
  'gravitationalRedshift',
  'lensingIntensity',
  'jetsEmission',
] as const

/**
 * Check if a color algorithm is black-hole-specific.
 * @param algorithm - The color algorithm to check
 * @returns True if the algorithm is black-hole-only
 */
export function isBlackHoleOnlyAlgorithm(algorithm: ColorAlgorithm): boolean {
  return BLACKHOLE_ONLY_ALGORITHMS.includes(algorithm)
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
 * Default cosine coefficients (Crimson Fade - smooth red to pink gradient).
 * Uses half-cycle frequency for smooth, non-rainbow gradients.
 */
export const DEFAULT_COSINE_COEFFICIENTS: CosineCoefficients = {
  a: [0.6, 0.2, 0.3],
  b: [0.4, 0.3, 0.3],
  c: [0.5, 0.5, 0.5],
  d: [0.0, 0.0, 0.0],
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
export const DEFAULT_COLOR_ALGORITHM: ColorAlgorithm = 'monochromatic'

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

// ============================================================================
// LCH Preset System
// ============================================================================

/**
 * LCH preset configuration with lightness and chroma values.
 */
export interface LchPreset {
  value: string
  label: string
  lightness: number
  chroma: number
}

/**
 * Built-in LCH presets for perceptually uniform coloring.
 */
export const LCH_PRESET_OPTIONS: LchPreset[] = [
  { value: 'vibrant', label: 'Vibrant', lightness: 0.7, chroma: 0.15 },
  { value: 'pastel', label: 'Pastel', lightness: 0.85, chroma: 0.08 },
  { value: 'deep', label: 'Deep', lightness: 0.5, chroma: 0.2 },
  { value: 'muted', label: 'Muted', lightness: 0.65, chroma: 0.06 },
  { value: 'neon', label: 'Neon', lightness: 0.75, chroma: 0.25 },
  { value: 'earth', label: 'Earth Tones', lightness: 0.55, chroma: 0.1 },
  { value: 'candy', label: 'Candy', lightness: 0.8, chroma: 0.18 },
  { value: 'jewel', label: 'Jewel Tones', lightness: 0.45, chroma: 0.22 },
]
