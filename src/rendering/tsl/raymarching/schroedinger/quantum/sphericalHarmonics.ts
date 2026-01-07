/**
 * TSL Spherical Harmonics Y_lm(θ, φ)
 *
 * Spherical harmonics form the angular part of hydrogen atom wavefunctions.
 * They describe how electron probability density varies with direction.
 *
 * Complex form:
 *   Y_lm(θ, φ) = K_l^m · P^{|m|}_l(cos θ) · e^{imφ}
 *
 * Real form (for px, py, pz notation):
 *   m > 0: Y_lm^real = √2 · Re(Y_lm) = √2 · K · P · cos(mφ)
 *   m < 0: Y_lm^real = √2 · Im(Y_{l|m|}) = √2 · K · P · sin(|m|φ)
 *   m = 0: Y_l0^real = Y_l0 (already real)
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/sphericalHarmonics.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/sphericalHarmonics
 */

import { Fn, float, vec2, If, Loop, Break, abs, sqrt, cos, sin, PI, length, select } from 'three/tsl'
import type { Node } from 'three/tsl'
import { legendre } from './legendre'

// Precomputed factorial lookup table (0! to 12!)
// 12! = 479001600 is the largest integer factorial that fits in float32
const FACTORIAL_LUT = [
  1.0, // 0!
  1.0, // 1!
  2.0, // 2!
  6.0, // 3!
  24.0, // 4!
  120.0, // 5!
  720.0, // 6!
  5040.0, // 7!
  40320.0, // 8!
  362880.0, // 9!
  3628800.0, // 10!
  39916800.0, // 11!
  479001600.0, // 12!
]

/**
 * Factorial function using lookup table
 * Falls back to loop for n > 12 (rare in practice for quantum viz)
 *
 * @param n - Integer value
 * @returns n!
 */
export const factorial = Fn(([n]: [Node]) => {
  const result = float(1).toVar()

  // n <= 1: return 1
  If(n.lessThanEqual(1), () => {
    result.assign(1)
  })

  // Use lookup table with nested selects for n <= 12
  // Using explicit indices to avoid TypeScript undefined warnings
  If(n.greaterThan(1).and(n.lessThanEqual(12)), () => {
    const f2 = FACTORIAL_LUT[2] as number
    const f3 = FACTORIAL_LUT[3] as number
    const f4 = FACTORIAL_LUT[4] as number
    const f5 = FACTORIAL_LUT[5] as number
    const f6 = FACTORIAL_LUT[6] as number
    const f7 = FACTORIAL_LUT[7] as number
    const f8 = FACTORIAL_LUT[8] as number
    const f9 = FACTORIAL_LUT[9] as number
    const f10 = FACTORIAL_LUT[10] as number
    const f11 = FACTORIAL_LUT[11] as number
    const f12 = FACTORIAL_LUT[12] as number
    result.assign(
      select(
        n.equal(2),
        float(f2),
        select(
          n.equal(3),
          float(f3),
          select(
            n.equal(4),
            float(f4),
            select(
              n.equal(5),
              float(f5),
              select(
                n.equal(6),
                float(f6),
                select(
                  n.equal(7),
                  float(f7),
                  select(
                    n.equal(8),
                    float(f8),
                    select(
                      n.equal(9),
                      float(f9),
                      select(
                        n.equal(10),
                        float(f10),
                        select(n.equal(11), float(f11), float(f12))
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  })

  // Fallback for n > 12 (rarely needed)
  If(n.greaterThan(12), () => {
    const f12 = FACTORIAL_LUT[12] as number
    result.assign(f12)
    Loop(20, ({ i }) => {
      const idx = float(i).add(13)
      If(idx.greaterThan(n), () => {
        Break()
      })
      result.assign(result.mul(idx))
    })
  })

  return result
})

/**
 * Compute normalization constant K_l^m for spherical harmonics
 *
 * K_l^m = sqrt((2l+1)/(4π) · (l-|m|)!/(l+|m|)!)
 *
 * This ensures ∫|Y_lm|² dΩ = 1
 *
 * @param l - Degree
 * @param m - Order
 * @returns Normalization constant
 */
export const sphericalHarmonicNorm = Fn(([l, m]: [Node, Node]) => {
  const absM = abs(m)

  // (2l+1) / (4π)
  const front = float(2).mul(l).add(1).div(float(4).mul(PI))

  // (l-|m|)! / (l+|m|)!
  // Compute as product to avoid large factorial values
  const factRatio = float(1).toVar()

  Loop(14, ({ i }) => {
    const idx = float(i).add(l.sub(absM).add(1))
    If(idx.greaterThan(l.add(absM)), () => {
      Break()
    })
    factRatio.assign(factRatio.mul(idx))
  })

  const ratio = float(1).div(factRatio)

  return sqrt(front.mul(ratio))
})

/**
 * Compute complex spherical harmonic Y_lm(θ, φ)
 *
 * Returns vec2(Re, Im) representing the complex value.
 *
 * @param l - Degree (0 to MAX_LEGENDRE_L)
 * @param m - Order (-l to +l)
 * @param theta - Polar angle from z-axis [0, π]
 * @param phi - Azimuthal angle [0, 2π]
 * @returns Complex Y_lm as vec2(re, im)
 */
export const sphericalHarmonic = Fn(([l, m, theta, phi]: [Node, Node, Node, Node]) => {
  // Normalization constant
  const K = sphericalHarmonicNorm(l, m)

  // Associated Legendre polynomial P^{|m|}_l(cos θ)
  const P = legendre(l, m, cos(theta))

  // Phase factor e^{imφ}
  const mPhi = m.mul(phi)
  const phaseRe = cos(mPhi)
  const phaseIm = sin(mPhi)

  // Y_lm = K · P · e^{imφ}
  return vec2(K.mul(P).mul(phaseRe), K.mul(P).mul(phaseIm))
})

/**
 * Compute real spherical harmonic for orbital visualization
 *
 * Real spherical harmonics are linear combinations of Y_lm and Y_l(-m)
 * that produce real-valued functions. These correspond to the familiar
 * orbital shapes: px, py, pz, dxy, dxz, etc.
 *
 * Real form:
 *   m > 0: S_lm = √2 · (-1)^m · Re(Y_lm) ∝ cos(mφ)
 *   m < 0: S_lm = √2 · (-1)^m · Im(Y_{l|m|}) ∝ sin(|m|φ)
 *   m = 0: S_l0 = Y_l0 (already real)
 *
 * @param l - Degree
 * @param m - Order
 * @param theta - Polar angle [0, π]
 * @param phi - Azimuthal angle [0, 2π]
 * @param useReal - If true, return real orbital; if false, return |Y_lm|
 * @returns Real spherical harmonic value
 */
export const realSphericalHarmonic = Fn(
  ([l, m, theta, phi, useReal]: [Node, Node, Node, Node, Node]) => {
    // Not using real form: return magnitude of complex spherical harmonic
    const Y = sphericalHarmonic(l, m, theta, phi)
    const magResult = length(Y)

    // Real spherical harmonic computation
    const K = sphericalHarmonicNorm(l, abs(m))
    const P = legendre(l, abs(m), cos(theta))

    // m = 0: Y_l0 is already real
    const mZeroResult = K.mul(P)

    // m > 0: proportional to cos(mφ)
    const mPositiveResult = sqrt(float(2)).mul(K).mul(P).mul(cos(m.mul(phi)))

    // m < 0: proportional to sin(|m|φ)
    const mNegativeResult = sqrt(float(2)).mul(K).mul(P).mul(sin(m.negate().mul(phi)))

    // Combine using nested select
    const realResult = select(
      m.equal(0),
      mZeroResult,
      select(m.greaterThan(0), mPositiveResult, mNegativeResult)
    )

    return select(useReal.not(), magResult, realResult)
  }
)

/**
 * Fast evaluation for common orbital shapes (l <= 2)
 *
 * Direct computation without Legendre recursion.
 * These are the most commonly visualized orbitals.
 *
 * @param l - Degree (0, 1, or 2)
 * @param m - Order
 * @param theta - Polar angle
 * @param phi - Azimuthal angle
 * @returns Real spherical harmonic value
 */
export const fastRealSphericalHarmonic = Fn(([l, m, theta, phi]: [Node, Node, Node, Node]) => {
  const ct = cos(theta)
  const st = sin(theta)

  // s orbital (l=0): Y_00 = 1/(2√π)
  const sOrbital = float(0.28209479)

  // p orbitals (l=1)
  const pNorm = float(0.48860251) // sqrt(3/(4*PI))
  const pz = pNorm.mul(ct)
  const px = pNorm.mul(st).mul(cos(phi))
  const py = pNorm.mul(st).mul(sin(phi))
  const pOrbital = select(m.equal(0), pz, select(m.equal(1), px, py))

  // d orbitals (l=2)
  const ct2 = ct.mul(ct)
  const st2 = st.mul(st)

  // dz2: ∝ (3cos²θ - 1)
  const dz2Norm = float(0.31539157) // sqrt(5/(16*PI))
  const dz2 = dz2Norm.mul(float(3).mul(ct2).sub(1))

  // dxz/dyz: ∝ sin(θ)cos(θ)cos(φ) or sin(φ)
  const dxzNorm = float(0.77254840) // sqrt(15/(4*PI))
  const dxz = dxzNorm.mul(st).mul(ct).mul(cos(phi))
  const dyz = dxzNorm.mul(st).mul(ct).mul(sin(phi))

  // dxy/dx2-y2: ∝ sin²(θ)sin(2φ) or cos(2φ)
  const dxyNorm = float(0.54627422) // sqrt(15/(16*PI))
  const dxy = dxyNorm.mul(st2).mul(sin(float(2).mul(phi)))
  const dx2y2 = dxyNorm.mul(st2).mul(cos(float(2).mul(phi)))

  const dOrbital = select(
    m.equal(0),
    dz2,
    select(m.equal(1), dxz, select(m.equal(-1), dyz, select(m.equal(2), dxy, dx2y2)))
  )

  // Fall back to general computation for l > 2
  const generalResult = realSphericalHarmonic(l, m, theta, phi, float(1))

  return select(
    l.equal(0),
    sOrbital,
    select(l.equal(1), pOrbital, select(l.equal(2), dOrbital, generalResult))
  )
})
