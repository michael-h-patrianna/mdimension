/**
 * TSL Mandelbulb SDF Index
 *
 * Exports all dimension-specific Mandelbulb SDFs with a unified interface.
 * Provides a dimension-dispatch function to select the correct SDF at compose time.
 *
 * @module rendering/tsl/raymarching/mandelbulb
 */

// Types
export * from './types'

// Power functions (centralized like WebGL power.glsl.ts)
export { getEffectivePower, fastPow8, optimizedPow } from './power'
export type { PowerUniforms } from './power'

// Shader composition (use this in mesh components)
export { composeMandelbulbTSL } from './composeMandelbulbTSL'
export type {
  MandelbulbShaderConfig,
  ComposedMandelbulbUniforms,
  ComposedMandelbulbMaterial,
} from './composeMandelbulbTSL'

// Dimension-specific SDFs
export { createMandelbulb3DSDF, createMandelbulb3DSDFSimple } from './sdf3d'
export { createMandelbulb4DSDF, createMandelbulb4DSDFSimple } from './sdf4d'
export { createMandelbulb5DSDF, createMandelbulb5DSDFSimple } from './sdf5d'
export { createMandelbulb6DSDF, createMandelbulb6DSDFSimple } from './sdf6d'
export { createMandelbulb7DSDF, createMandelbulb7DSDFSimple } from './sdf7d'
export { createMandelbulb8DSDF, createMandelbulb8DSDFSimple } from './sdf8d'
export { createMandelbulb9DSDF, createMandelbulb9DSDFSimple } from './sdf9d'
export { createMandelbulb10DSDF, createMandelbulb10DSDFSimple } from './sdf10d'
export { createMandelbulb11DSDF, createMandelbulb11DSDFSimple } from './sdf11d'

import type { MandelbulbUniforms } from './types'

// Import all dimension SDFs for dispatch
import { createMandelbulb3DSDF, createMandelbulb3DSDFSimple } from './sdf3d'
import { createMandelbulb4DSDF, createMandelbulb4DSDFSimple } from './sdf4d'
import { createMandelbulb5DSDF, createMandelbulb5DSDFSimple } from './sdf5d'
import { createMandelbulb6DSDF, createMandelbulb6DSDFSimple } from './sdf6d'
import { createMandelbulb7DSDF, createMandelbulb7DSDFSimple } from './sdf7d'
import { createMandelbulb8DSDF, createMandelbulb8DSDFSimple } from './sdf8d'
import { createMandelbulb9DSDF, createMandelbulb9DSDFSimple } from './sdf9d'
import { createMandelbulb10DSDF, createMandelbulb10DSDFSimple } from './sdf10d'
import { createMandelbulb11DSDF, createMandelbulb11DSDFSimple } from './sdf11d'

type SDFCreator = (uniforms: MandelbulbUniforms) => ReturnType<typeof createMandelbulb3DSDF>
type SDFSimpleCreator = (uniforms: MandelbulbUniforms) => ReturnType<typeof createMandelbulb3DSDFSimple>

/**
 * Map of dimension to SDF creator functions (with orbit traps).
 */
const sdfCreators: Record<number, SDFCreator> = {
  3: createMandelbulb3DSDF as SDFCreator,
  4: createMandelbulb4DSDF as SDFCreator,
  5: createMandelbulb5DSDF as SDFCreator,
  6: createMandelbulb6DSDF as SDFCreator,
  7: createMandelbulb7DSDF as SDFCreator,
  8: createMandelbulb8DSDF as SDFCreator,
  9: createMandelbulb9DSDF as SDFCreator,
  10: createMandelbulb10DSDF as SDFCreator,
  11: createMandelbulb11DSDF as SDFCreator,
}

/**
 * Map of dimension to simple SDF creator functions (no orbit traps).
 */
const sdfSimpleCreators: Record<number, SDFSimpleCreator> = {
  3: createMandelbulb3DSDFSimple as SDFSimpleCreator,
  4: createMandelbulb4DSDFSimple as SDFSimpleCreator,
  5: createMandelbulb5DSDFSimple as SDFSimpleCreator,
  6: createMandelbulb6DSDFSimple as SDFSimpleCreator,
  7: createMandelbulb7DSDFSimple as SDFSimpleCreator,
  8: createMandelbulb8DSDFSimple as SDFSimpleCreator,
  9: createMandelbulb9DSDFSimple as SDFSimpleCreator,
  10: createMandelbulb10DSDFSimple as SDFSimpleCreator,
  11: createMandelbulb11DSDFSimple as SDFSimpleCreator,
}

/**
 * Create a dimension-specific Mandelbulb SDF with orbit traps.
 *
 * Dispatches to the appropriate optimized SDF based on dimension.
 * Each dimension has unrolled basis transformations and the correct
 * number of hyperspherical angles.
 *
 * @param dimension - Current dimension (3-11)
 * @param uniforms - Mandelbulb uniforms
 * @returns SDF function that returns vec3(dist, trap, valid)
 */
export function createMandelbulbSDFForDimension(
  dimension: number,
  uniforms: MandelbulbUniforms
): ReturnType<typeof createMandelbulb3DSDF> {
  const dim = Math.max(3, Math.min(11, dimension))
  const creator = sdfCreators[dim]
  if (!creator) {
    console.warn(`[Mandelbulb TSL] No SDF for dimension ${dim}, falling back to 4D`)
    return createMandelbulb4DSDF(uniforms)
  }
  return creator(uniforms)
}

/**
 * Create a dimension-specific simple Mandelbulb SDF (no orbit traps).
 *
 * Used for normal calculation and shadow rays where traps aren't needed.
 * Faster than the full version.
 *
 * @param dimension - Current dimension (3-11)
 * @param uniforms - Mandelbulb uniforms
 * @returns SDF function that returns distance only
 */
export function createMandelbulbSimpleSDFForDimension(
  dimension: number,
  uniforms: MandelbulbUniforms
): ReturnType<typeof createMandelbulb3DSDFSimple> {
  const dim = Math.max(3, Math.min(11, dimension))
  const creator = sdfSimpleCreators[dim]
  if (!creator) {
    console.warn(`[Mandelbulb TSL] No simple SDF for dimension ${dim}, falling back to 4D`)
    return createMandelbulb4DSDFSimple(uniforms)
  }
  return creator(uniforms)
}

