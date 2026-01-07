/**
 * TSL Hydrogen ND Module Index
 *
 * Exports dimension-specific hydrogen ND wavefunction evaluators.
 * Each function is unrolled for optimal GPU performance.
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND
 */

// Common utilities
export {
  radius3D,
  radius4D,
  sphericalAngles3D,
  hydrogenRadial,
  hydrogenRadialEarlyExit,
  extraDimEarlyExitCheck,
  extraDimFactor,
  evalHydrogenNDAngular,
  hydrogenNDTimeEvolution,
  sphericalHarmonicL0,
  sphericalHarmonicL1,
  sphericalHarmonicL2,
  type HydrogenNDUniforms,
} from './common'

// Dimension-specific evaluators - import for local use, re-export for module consumers
import { createHydrogenNDPsi3D } from './hydrogenND3d'
import { createHydrogenNDPsi4D } from './hydrogenND4d'
import { createHydrogenNDPsi5D } from './hydrogenND5d'
import { createHydrogenNDPsi6D } from './hydrogenND6d'
import { createHydrogenNDPsi7D } from './hydrogenND7d'
import { createHydrogenNDPsi8D } from './hydrogenND8d'
import { createHydrogenNDPsi9D } from './hydrogenND9d'
import { createHydrogenNDPsi10D } from './hydrogenND10d'
import { createHydrogenNDPsi11D } from './hydrogenND11d'

// Re-export for module consumers
export {
  createHydrogenNDPsi3D,
  createHydrogenNDPsi4D,
  createHydrogenNDPsi5D,
  createHydrogenNDPsi6D,
  createHydrogenNDPsi7D,
  createHydrogenNDPsi8D,
  createHydrogenNDPsi9D,
  createHydrogenNDPsi10D,
  createHydrogenNDPsi11D,
}

/**
 * Select the appropriate HydrogenND evaluator for the given dimension.
 *
 * This mirrors the WebGL compile-time dimension dispatch pattern.
 * Each dimension has its own unrolled evaluator for optimal performance.
 *
 * @param dimension - Current dimension (3-11)
 * @param uniforms - HydrogenND uniforms
 * @returns The evaluator function for that dimension
 */
export function selectHydrogenNDEvaluator(
  dimension: number,
  uniforms: import('./common').HydrogenNDUniforms
) {
  switch (dimension) {
    case 3:
      return createHydrogenNDPsi3D(uniforms)
    case 4:
      return createHydrogenNDPsi4D(uniforms)
    case 5:
      return createHydrogenNDPsi5D(uniforms)
    case 6:
      return createHydrogenNDPsi6D(uniforms)
    case 7:
      return createHydrogenNDPsi7D(uniforms)
    case 8:
      return createHydrogenNDPsi8D(uniforms)
    case 9:
      return createHydrogenNDPsi9D(uniforms)
    case 10:
      return createHydrogenNDPsi10D(uniforms)
    case 11:
    default:
      return createHydrogenNDPsi11D(uniforms)
  }
}

