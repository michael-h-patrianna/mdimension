/**
 * TSL Hydrogen ND 7D - Hydrogen orbital + 4 HO dimensions
 *
 * Wavefunction: ψ = R_nl(r_7D) × Y_lm(θ,φ) × ∏_{i=3}^{6} φ_{ni}(xi)
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND/hydrogenND7d
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
 * Create the 7D Hydrogen ND wavefunction evaluator.
 */
export function createHydrogenNDPsi7D(uniforms: HydrogenNDUniforms) {
  return Fn(([x0, x1, x2, x3, x4, x5, x6, t]: [Node, Node, Node, Node, Node, Node, Node, Node]) => {
    // Extract omegas from vec4
    const omega0 = uniforms.uExtraDimOmega[0]!.x
    const omega1 = uniforms.uExtraDimOmega[0]!.y
    const omega2 = uniforms.uExtraDimOmega[0]!.z
    const omega3 = uniforms.uExtraDimOmega[0]!.w

    // Early exits for extra dimensions
    const earlyExit1 = extraDimEarlyExitCheck(x3, omega0)
      .or(extraDimEarlyExitCheck(x4, omega1))
      .or(extraDimEarlyExitCheck(x5, omega2))
      .or(extraDimEarlyExitCheck(x6, omega3))

    // Compute 7D radius
    const r7D = sqrt(
      x0.mul(x0).add(x1.mul(x1)).add(x2.mul(x2))
        .add(x3.mul(x3)).add(x4.mul(x4)).add(x5.mul(x5))
        .add(x6.mul(x6))
    )

    // Early exit: radial threshold
    const earlyExit2 = hydrogenRadialEarlyExit(
      r7D,
      uniforms.uPrincipalN,
      uniforms.uBohrRadius,
      uniforms.uAzimuthalL
    )

    // 3D radius for spherical harmonics
    const r3D = radius3D(x0, x1, x2)
    const angles = sphericalAngles3D(x0, x1, x2, r3D)

    // Radial and angular parts
    const R = hydrogenRadial(
      uniforms.uPrincipalN,
      uniforms.uAzimuthalL,
      r7D,
      uniforms.uBohrRadius
    )

    const Y = evalHydrogenNDAngular(
      uniforms.uAzimuthalL,
      uniforms.uMagneticM,
      angles.x,
      angles.y
    )

    // Extra dimension factors (unrolled)
    const n0 = uniforms.uExtraDimN[0]!.x
    const n1 = uniforms.uExtraDimN[0]!.y
    const n2 = uniforms.uExtraDimN[0]!.z
    const n3 = uniforms.uExtraDimN[0]!.w
    const ef0 = extraDimFactor(n0, omega0, x3)
    const ef1 = extraDimFactor(n1, omega1, x4)
    const ef2 = extraDimFactor(n2, omega2, x5)
    const ef3 = extraDimFactor(n3, omega3, x6)

    // Combine
    const psiReal = R.mul(Y).mul(ef0).mul(ef1).mul(ef2).mul(ef3)
    const result = hydrogenNDTimeEvolution(psiReal, uniforms.uPrincipalN, t)

    return earlyExit1.or(earlyExit2).select(vec2(0, 0), result)
  })
}

