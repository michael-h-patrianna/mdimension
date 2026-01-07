/**
 * TSL Beer-Lambert Absorption for Volumetric Rendering
 *
 * The Beer-Lambert law describes light absorption through a medium:
 *   I = I_0 · e^{-σρΔl}
 *
 * where:
 *   σ = absorption coefficient (density gain)
 *   ρ = local density
 *   Δl = step length
 *
 * The local opacity (alpha) is:
 *   α = 1 - e^{-σρΔl}
 *
 * And transmittance accumulates as:
 *   T_{n+1} = T_n · (1 - α)
 *
 * **WebGL Parity:**
 * - `computeAlpha` - Exact match with WebGL absorption.glsl.ts
 * - `computeAlphaBoost` - Exact match with WebGL absorption.glsl.ts
 *
 * **TSL-only utilities (not in WebGL):**
 * - `computeTransmittance` - Simple convenience wrapper: T = 1 - α
 * - `accumulateTransmittance` - Convenience for transmittance accumulation
 * - `frontToBackComposite` - Standard front-to-back compositing formula
 *
 * @module rendering/tsl/raymarching/schroedinger/volume/absorption
 */

import { Fn, float, min, max, exp, vec4 } from 'three/tsl'
import type { Node } from 'three/tsl'

/**
 * Compute local alpha from density using Beer-Lambert law.
 *
 * @param rho - Local probability density |ψ|²
 * @param stepLen - Step length along ray
 * @param sigma - Absorption coefficient (uDensityGain)
 * @returns Local opacity [0, 1]
 */
export const computeAlpha = Fn(([rho, stepLen, sigma]: [Node, Node, Node]) => {
  // Clamp density to prevent extreme values
  const clampedRho = min(rho, float(10.0))

  // Beer-Lambert: α = 1 - e^{-σρΔl}
  const exponent = sigma.negate().mul(clampedRho).mul(stepLen)

  // Clamp exponent to prevent underflow/overflow
  const clampedExp = max(exponent, float(-20.0))

  return float(1).sub(exp(clampedExp))
})

/**
 * Compute alpha with density boost for low-density regions.
 * This helps make faint quantum features more visible.
 *
 * @param rho - Local probability density
 * @param stepLen - Step length along ray
 * @param sigma - Absorption coefficient
 * @param boost - Boost factor for low-density regions
 * @returns Boosted local opacity [0, 1]
 */
export const computeAlphaBoost = Fn(
  ([rho, stepLen, sigma, boost]: [Node, Node, Node, Node]) => {
    // Apply boost to low-density regions
    const boostFactor = float(1).add(boost.mul(exp(rho.mul(-10))))
    const boostedRho = rho.mul(boostFactor)
    return computeAlpha(boostedRho, stepLen, sigma)
  }
)

/**
 * Compute transmittance from alpha.
 * T = 1 - α
 */
export const computeTransmittance = Fn(([alpha]: [Node]) => {
  return float(1).sub(alpha)
})

/**
 * Accumulate transmittance along the ray.
 * T_{n+1} = T_n · (1 - α)
 */
export const accumulateTransmittance = Fn(
  ([currentT, alpha]: [Node, Node]) => {
    return currentT.mul(float(1).sub(alpha))
  }
)

/**
 * Front-to-back compositing for volume rendering.
 *
 * C_out = C_in + (1 - α_in) · C_step · α_step
 * α_out = α_in + (1 - α_in) · α_step
 *
 * @param colorIn - Accumulated color so far (vec3)
 * @param alphaIn - Accumulated alpha so far (float)
 * @param colorStep - Color contribution from this step (vec3)
 * @param alphaStep - Alpha contribution from this step (float)
 * @returns vec4(colorOut, alphaOut)
 */
export const frontToBackComposite = Fn(
  ([colorIn, alphaIn, colorStep, alphaStep]: [Node, Node, Node, Node]) => {
    // Color accumulation
    const colorOut = colorIn.add(
      float(1).sub(alphaIn).mul(colorStep).mul(alphaStep)
    )
    // Alpha accumulation
    const alphaOut = alphaIn.add(float(1).sub(alphaIn).mul(alphaStep))
    return vec4(colorOut, alphaOut)
  }
)

