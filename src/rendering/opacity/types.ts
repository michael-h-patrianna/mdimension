/**
 * Hyperbulb Opacity Mode Types
 *
 * Defines the four opacity rendering modes for hyperbulb fractals:
 * - solid: Fully opaque surface (default)
 * - simpleAlpha: Uniform transparency with slider
 * - layeredSurfaces: Multiple transparent nested surfaces
 * - volumetricDensity: Cloud-like volumetric rendering
 *
 * @see docs/prd/hyperbulb_opacity.md
 */

/** Opacity rendering modes for hyperbulb fractals */
export type OpacityMode = 'solid' | 'simpleAlpha' | 'layeredSurfaces' | 'volumetricDensity';

/** Sample quality levels for volumetric rendering */
export type SampleQuality = 'low' | 'medium' | 'high';

/** Animation quality preference for volumetric mode */
export type VolumetricAnimationQuality = 'reduce' | 'full';

/**
 * Complete opacity settings for hyperbulb rendering.
 * All mode-specific values are stored even when not active,
 * so switching modes preserves previous settings.
 */
export interface HyperbulbOpacitySettings {
  /** Current opacity mode */
  mode: OpacityMode;

  // Simple Alpha mode settings
  /** Opacity value for simple alpha mode (0.0-1.0, default 0.7) */
  simpleAlphaOpacity: number;

  // Layered Surfaces mode settings
  /** Number of visible layers (2-4, default 2) */
  layerCount: 2 | 3 | 4;
  /** Opacity per layer (0.1-0.9, default 0.5) */
  layerOpacity: number;

  // Volumetric Density mode settings
  /** Overall volume density (0.1-2.0, default 1.0) */
  volumetricDensity: number;
  /** Sample quality level (default 'medium') */
  sampleQuality: SampleQuality;
  /** Quality during animation - 'reduce' or 'full' (default 'reduce') */
  volumetricAnimationQuality: VolumetricAnimationQuality;
}

/** Mapping of opacity modes to shader integer values */
export const OPACITY_MODE_TO_INT: Record<OpacityMode, number> = {
  solid: 0,
  simpleAlpha: 1,
  layeredSurfaces: 2,
  volumetricDensity: 3,
};

/** Mapping of sample quality to shader integer values */
export const SAMPLE_QUALITY_TO_INT: Record<SampleQuality, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Display labels for opacity modes */
export const OPACITY_MODE_LABELS: Record<OpacityMode, string> = {
  solid: 'Solid',
  simpleAlpha: 'Simple Alpha',
  layeredSurfaces: 'Layered Surfaces',
  volumetricDensity: 'Volumetric Density',
};

/** Display labels for sample quality */
export const SAMPLE_QUALITY_LABELS: Record<SampleQuality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** Tooltips for opacity modes */
export const OPACITY_MODE_TOOLTIPS: Record<OpacityMode, string> = {
  solid: 'Fully opaque surface rendering',
  simpleAlpha: 'Uniform transparency applied to the entire surface',
  layeredSurfaces: 'Shows multiple depth layers of the fractal surface',
  volumetricDensity: 'Cloud-like volumetric rendering (may reduce performance)',
};
