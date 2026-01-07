/**
 * TSL Hydrogen ND 5D - Hydrogen orbital + 2 HO dimensions
 *
 * Wavefunction: ψ = R_nl(r_5D) × Y_lm(θ,φ) × φ_n3(x3) × φ_n4(x4)
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND/hydrogenND5d
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
 * Create the 5D Hydrogen ND wavefunction evaluator.
 */
export function createHydrogenNDPsi5D(uniforms: HydrogenNDUniforms) {
  return Fn(([x0, x1, x2, x3, x4, t]: [Node, Node, Node, Node, Node, Node]) => {
    // Early exits for extra dimensions
    const omega0 = uniforms.uExtraDimOmega[0]!.x
    const omega1 = uniforms.uExtraDimOmega[0]!.y
    const earlyExit1 = extraDimEarlyExitCheck(x3, omega0)
      .or(extraDimEarlyExitCheck(x4, omega1))

    // Compute 5D radius
    const r5D = sqrt(
      x0.mul(x0).add(x1.mul(x1)).add(x2.mul(x2))
        .add(x3.mul(x3)).add(x4.mul(x4))
    )

    // Early exit: radial threshold
    const earlyExit2 = hydrogenRadialEarlyExit(
      r5D,
      uniforms.uPrincipalN,
      uniforms.uBohrRadius,
      uniforms.uAzimuthalL
    )

    // 3D radius for spherical harmonics
    const r3D = radius3D(x0, x1, x2)
    const angles = sphericalAngles3D(x0, x1, x2, r3D)

    // Radial part with 5D radius
    const R = hydrogenRadial(
      uniforms.uPrincipalN,
      uniforms.uAzimuthalL,
      r5D,
      uniforms.uBohrRadius
    )

    // Angular part
    const Y = evalHydrogenNDAngular(
      uniforms.uAzimuthalL,
      uniforms.uMagneticM,
      angles.x,
      angles.y
    )

    // Extra dimension factors (unrolled)
    const n0 = uniforms.uExtraDimN[0]!.x
    const n1 = uniforms.uExtraDimN[0]!.y
    const ef0 = extraDimFactor(n0, omega0, x3)
    const ef1 = extraDimFactor(n1, omega1, x4)

    // Combine
    const psiReal = R.mul(Y).mul(ef0).mul(ef1)
    const result = hydrogenNDTimeEvolution(psiReal, uniforms.uPrincipalN, t)

    return earlyExit1.or(earlyExit2).select(vec2(0, 0), result)
  })
}

