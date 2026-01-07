/**
 * TSL 4D Mandelbulb SDF
 *
 * Re-exports from the main mandelbulb-sdf.ts for consistency with other dimensions.
 * The 4D implementation was the first to be created and lives in the parent directory.
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf4d
 */

export { createMandelbulb4DSDF, createMandelbulb4DSDFSimple } from '../mandelbulb-sdf'
export type { MandelbulbUniforms as Mandelbulb4DUniforms } from '../mandelbulb-sdf'

