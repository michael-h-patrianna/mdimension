/**
 * TSL Color System
 *
 * Complete color algorithm system for WebGPU rendering.
 * 100% parity with WebGL color implementation.
 *
 * @module rendering/tsl/color
 */

// Color space conversions (HSL, Oklab/LCH)
export {
  getPaletteColor,
  hsl2rgb,
  hue2rgb,
  lchColor,
  linearSrgbToOklab,
  oklabToLinearSrgb,
  PAL_ANALOG,
  PAL_COMP,
  PAL_MONO,
  PAL_SPLIT,
  PAL_TRIAD,
  rgb2hsl,
} from './conversions'

// Cosine gradient palette
export {
  applyDistribution,
  cosinePalette,
  getCosinePaletteColor,
} from './cosine-palette'

// Color algorithm selector (11 modes)
export { COLOR_ALGORITHM, createColorSelector } from './selector'

// Color uniforms
export {
  COSINE_PALETTE_DEFAULTS,
  createColorTSLUniforms,
  updateColorTSLUniforms,
} from './color-uniforms'

export type { ColorTSLUniforms } from './color-uniforms'
