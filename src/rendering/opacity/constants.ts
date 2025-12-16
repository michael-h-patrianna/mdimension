/**
 * Mandelbulb Opacity Mode Constants
 *
 * Default values and ranges for opacity mode controls.
 *
 * @see docs/prd/mandelbulb_opacity.md
 */

import type { MandelbulbOpacitySettings, OpacityMode, SampleQuality, VolumetricAnimationQuality } from './types';

// Re-export labels and tooltips from types for convenient access
export {
  OPACITY_MODE_LABELS,
  OPACITY_MODE_TOOLTIPS,
  SAMPLE_QUALITY_LABELS,
} from './types';

// =============================================================================
// Default Values
// =============================================================================

/** Default opacity mode */
export const DEFAULT_OPACITY_MODE: OpacityMode = 'solid';

/** Default simple alpha opacity (PRD: 0.7) */
export const DEFAULT_SIMPLE_ALPHA_OPACITY = 0.7;

/** Default layer count (PRD: 2 for performance) */
export const DEFAULT_LAYER_COUNT: 2 | 3 | 4 = 2;

/** Default layer opacity (PRD: 0.5) */
export const DEFAULT_LAYER_OPACITY = 0.5;

/** Default volumetric density (PRD: 1.0) */
export const DEFAULT_VOLUMETRIC_DENSITY = 1.0;

/** Default sample quality (PRD: 'medium') */
export const DEFAULT_SAMPLE_QUALITY: SampleQuality = 'medium';

/** Default animation quality preference (PRD: user choice) */
export const DEFAULT_VOLUMETRIC_ANIMATION_QUALITY: VolumetricAnimationQuality = 'reduce';

/** Complete default opacity settings */
export const DEFAULT_OPACITY_SETTINGS: MandelbulbOpacitySettings = {
  mode: DEFAULT_OPACITY_MODE,
  simpleAlphaOpacity: DEFAULT_SIMPLE_ALPHA_OPACITY,
  layerCount: DEFAULT_LAYER_COUNT,
  layerOpacity: DEFAULT_LAYER_OPACITY,
  volumetricDensity: DEFAULT_VOLUMETRIC_DENSITY,
  sampleQuality: DEFAULT_SAMPLE_QUALITY,
  volumetricAnimationQuality: DEFAULT_VOLUMETRIC_ANIMATION_QUALITY,
};

// =============================================================================
// Slider Ranges (from PRD)
// =============================================================================

/** Simple alpha slider range */
export const SIMPLE_ALPHA_RANGE = {
  min: 0,
  max: 1,
  step: 0.05,
  default: DEFAULT_SIMPLE_ALPHA_OPACITY,
} as const;

/** Layer opacity slider range */
export const LAYER_OPACITY_RANGE = {
  min: 0.1,
  max: 0.9,
  step: 0.05,
  default: DEFAULT_LAYER_OPACITY,
} as const;

/** Volumetric density slider range */
export const VOLUMETRIC_DENSITY_RANGE = {
  min: 0.1,
  max: 2.0,
  step: 0.1,
  default: DEFAULT_VOLUMETRIC_DENSITY,
} as const;

/** Valid layer count options */
export const LAYER_COUNT_OPTIONS: readonly (2 | 3 | 4)[] = [2, 3, 4] as const;

/** Valid sample quality options */
export const SAMPLE_QUALITY_OPTIONS: readonly SampleQuality[] = ['low', 'medium', 'high'] as const;

/** Valid opacity modes */
export const OPACITY_MODE_OPTIONS: readonly OpacityMode[] = [
  'solid',
  'simpleAlpha',
  'layeredSurfaces',
  'volumetricDensity',
] as const;

// =============================================================================
// URL Serialization Keys (compact for shorter URLs)
// =============================================================================

/** URL parameter key for opacity mode */
export const URL_KEY_OPACITY_MODE = 'om';

/** URL parameter key for simple alpha opacity */
export const URL_KEY_SIMPLE_ALPHA = 'sao';

/** URL parameter key for layer count */
export const URL_KEY_LAYER_COUNT = 'lc';

/** URL parameter key for layer opacity */
export const URL_KEY_LAYER_OPACITY = 'lo';

/** URL parameter key for volumetric density */
export const URL_KEY_VOLUMETRIC_DENSITY = 'vd';

/** URL parameter key for sample quality */
export const URL_KEY_SAMPLE_QUALITY = 'sq';

/** URL parameter key for volumetric animation quality */
export const URL_KEY_VOLUMETRIC_ANIM_QUALITY = 'vaq';
