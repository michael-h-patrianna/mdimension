/**
 * Color Palette Type Definitions
 *
 * Shared types for the unified color palette system.
 * Used by both shaders and UI components.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

/**
 * Available color palette modes based on color theory principles.
 *
 * - monochromatic: Same hue, varying lightness only
 * - analogous: Hue varies ±30° from base color
 * - complementary: Base hue and its complement (180° opposite)
 * - triadic: Three colors 120° apart on the color wheel
 * - splitComplementary: Base + two colors flanking the complement
 */
export type ColorMode =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'splitComplementary';

/**
 * Options for the Color Mode dropdown in the UI.
 * Used by ShaderSettings component.
 */
export const COLOR_MODE_OPTIONS = [
  { value: 'monochromatic' as const, label: 'Monochromatic' },
  { value: 'analogous' as const, label: 'Analogous' },
  { value: 'complementary' as const, label: 'Complementary' },
  { value: 'triadic' as const, label: 'Triadic' },
  { value: 'splitComplementary' as const, label: 'Split Complementary' },
] as const;

/**
 * Map from ColorMode string to integer for shader uniform.
 * Must match PALETTE_* defines in palette.glsl.ts.
 */
export const COLOR_MODE_TO_INT: Record<ColorMode, number> = {
  monochromatic: 0,
  analogous: 1,
  complementary: 2,
  triadic: 3,
  splitComplementary: 4,
};

/**
 * Default color mode for new sessions.
 */
export const DEFAULT_COLOR_MODE: ColorMode = 'monochromatic';
