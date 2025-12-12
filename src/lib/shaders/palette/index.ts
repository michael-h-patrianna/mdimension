/**
 * Color Palette Module
 *
 * Unified color palette system for surface rendering.
 * Provides both GLSL functions (for shaders) and TypeScript types (for UI/store).
 *
 * @example
 * ```typescript
 * // In a shader file:
 * import { GLSL_PALETTE_FUNCTIONS } from '@/lib/shaders/palette';
 * const fragmentShader = GLSL_PALETTE_FUNCTIONS + myShaderCode;
 *
 * // In a component:
 * import { COLOR_MODE_OPTIONS, type ColorMode } from '@/lib/shaders/palette';
 * ```
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

export { GLSL_PALETTE_FUNCTIONS } from './palette.glsl';
export {
  type ColorMode,
  COLOR_MODE_OPTIONS,
  COLOR_MODE_TO_INT,
  DEFAULT_COLOR_MODE,
} from './types';
