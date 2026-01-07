/**
 * TSL Quaternion Julia Index
 *
 * Exports quaternion math, Julia SDF, and shader composition for TSL.
 *
 * @module rendering/tsl/raymarching/julia
 */

// Shader composition (use this in mesh components)
export { composeJuliaTSL } from './composeJuliaTSL'
export type {
  JuliaShaderConfig,
  ComposedJuliaUniforms,
  ComposedJuliaMaterial,
} from './composeJuliaTSL'

// Quaternion operations
export {
  quatMul,
  quatSqr,
  quatCube,
  quatPow4,
  quatPow5,
  quatPow6,
  quatPow7,
  quatPow8,
  quatPowGeneral,
  quatPowFast,
  quatLength,
  quatConjugate,
  quatInverse,
} from './quaternion'

// Julia SDF
export {
  createJuliaSDF,
  createJuliaSDFSimple,
} from './julia-sdf'
export type { JuliaUniforms } from './julia-sdf'

