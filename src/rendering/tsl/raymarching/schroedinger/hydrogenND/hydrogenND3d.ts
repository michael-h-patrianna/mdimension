/**
 * TSL Hydrogen ND 3D - Pure hydrogen orbital (no extra dimensions)
 *
 * In 3D, HydrogenND is identical to the standard hydrogen orbital.
 * This module provides compatibility when dimension = 3.
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND/hydrogenND3d
 */

import { Fn, vec2 } from 'three/tsl'
import type { Node } from 'three/tsl'
import {
  radius3D,
  sphericalAngles3D,
  hydrogenRadial,
  hydrogenRadialEarlyExit,
  evalHydrogenNDAngular,
  hydrogenNDTimeEvolution,
  type HydrogenNDUniforms,
} from './common'

/**
 * Create the 3D Hydrogen ND wavefunction evaluator.
 *
 * This is a pure 3D hydrogen orbital with no extra dimensions.
 *
 * @param uniforms - HydrogenND uniforms
 * @returns TSL Fn that evaluates the wavefunction
 */
export function createHydrogenNDPsi3D(uniforms: HydrogenNDUniforms) {
  /**
   * Evaluate Hydrogen ND wavefunction in 3D.
   *
   * @param x0, x1, x2 - 3D coordinates
   * @param t - Time for phase evolution
   * @returns vec2(re, im) of wavefunction
   */
  return Fn(([x0, x1, x2, t]: [Node, Node, Node, Node]) => {
    // 3D radius
    const r3D = radius3D(x0, x1, x2)

    // Early exit if radial contribution is negligible
    const tooFar = hydrogenRadialEarlyExit(
      r3D,
      uniforms.uPrincipalN,
      uniforms.uBohrRadius,
      uniforms.uAzimuthalL
    )

    // Get angles
    const angles = sphericalAngles3D(x0, x1, x2, r3D)
    const theta = angles.x
    const phi = angles.y

    // Radial part R_nl(r)
    const R = hydrogenRadial(
      uniforms.uPrincipalN,
      uniforms.uAzimuthalL,
      r3D,
      uniforms.uBohrRadius
    )

    // Angular part Y_lm(theta, phi)
    const Y = evalHydrogenNDAngular(
      uniforms.uAzimuthalL,
      uniforms.uMagneticM,
      theta,
      phi
    )

    // Combine and apply time evolution
    const psiReal = R.mul(Y)

    // Apply early exit - return zero if too far
    const result = hydrogenNDTimeEvolution(psiReal, uniforms.uPrincipalN, t)

    return tooFar.select(vec2(0, 0), result)
  })
}

