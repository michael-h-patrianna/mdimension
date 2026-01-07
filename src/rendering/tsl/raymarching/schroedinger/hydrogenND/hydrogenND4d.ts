/**
 * TSL Hydrogen ND 4D - Hydrogen orbital + 1 HO dimension
 *
 * Wavefunction: ψ = R_nl(r_4D) × Y_lm(θ,φ) × φ_n3(x3)
 *
 * Fully unrolled for performance - no loops for extra dimension.
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND/hydrogenND4d
 */

import { Fn, vec2, sqrt } from 'three/tsl'
import type { Node } from 'three/tsl'
import {
  radius3D,
  sphericalAngles3D,
  hydrogenRadial,
  hydrogenRadialEarlyExit,
  extraDimEarlyExitCheck,
  extraDimFactor,
  evalHydrogenNDAngular,
  hydrogenNDTimeEvolution,
  type HydrogenNDUniforms,
} from './common'

/**
 * Create the 4D Hydrogen ND wavefunction evaluator.
 *
 * @param uniforms - HydrogenND uniforms
 * @returns TSL Fn that evaluates the wavefunction
 */
export function createHydrogenNDPsi4D(uniforms: HydrogenNDUniforms) {
  /**
   * Evaluate Hydrogen ND wavefunction in 4D.
   *
   * @param x0, x1, x2, x3 - 4D coordinates
   * @param t - Time for phase evolution
   * @returns vec2(re, im) of wavefunction
   */
  return Fn(([x0, x1, x2, x3, t]: [Node, Node, Node, Node, Node]) => {
    // Early exit 1: Check extra dimension Gaussian envelope
    const omega0 = uniforms.uExtraDimOmega[0]!.x
    const earlyExit1 = extraDimEarlyExitCheck(x3, omega0)

    // Compute 4D radius for radial decay
    const r4D = sqrt(
      x0.mul(x0).add(x1.mul(x1)).add(x2.mul(x2)).add(x3.mul(x3))
    )

    // Early exit 2: Check hydrogen radial threshold
    const earlyExit2 = hydrogenRadialEarlyExit(
      r4D,
      uniforms.uPrincipalN,
      uniforms.uBohrRadius,
      uniforms.uAzimuthalL
    )

    // Compute 3D radius for spherical harmonics
    const r3D = radius3D(x0, x1, x2)

    // Spherical angles from first 3 dims
    const angles = sphericalAngles3D(x0, x1, x2, r3D)
    const theta = angles.x
    const phi = angles.y

    // Radial part: R_nl(r_4D) with 4D radius
    const R = hydrogenRadial(
      uniforms.uPrincipalN,
      uniforms.uAzimuthalL,
      r4D,
      uniforms.uBohrRadius
    )

    // Angular part: Y_lm(theta, phi) from first 3 dims
    const Y = evalHydrogenNDAngular(
      uniforms.uAzimuthalL,
      uniforms.uMagneticM,
      theta,
      phi
    )

    // Extra dimension factor: phi_n3(x3)
    const n0 = uniforms.uExtraDimN[0]!.x
    const ef0 = extraDimFactor(n0, omega0, x3)

    // Combine: psi = R * Y * extraFactor
    const psiReal = R.mul(Y).mul(ef0)

    // Time evolution
    const result = hydrogenNDTimeEvolution(psiReal, uniforms.uPrincipalN, t)

    // Apply early exits
    return earlyExit1.or(earlyExit2).select(vec2(0, 0), result)
  })
}

