/**
 * TSL Associated Legendre Polynomial Evaluation
 *
 * Associated Legendre polynomials P^m_l(x) are the θ-dependent part
 * of spherical harmonics:
 *   Y_lm(θ, φ) ∝ P^{|m|}_l(cos θ) · e^{imφ}
 *
 * Recurrence relations used:
 *   P^m_m(x) = (-1)^m (2m-1)!! (1-x²)^{m/2}
 *   P^m_{m+1}(x) = x(2m+1) P^m_m(x)
 *   (l-m)P^m_l(x) = x(2l-1)P^m_{l-1}(x) - (l+m-1)P^m_{l-2}(x)
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/legendre.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/legendre
 */

import { Fn, float, If, Loop, abs, clamp, sqrt, select, min } from 'three/tsl'
import type { Node } from 'three/tsl'

// Maximum supported l for Legendre polynomials
// For hydrogen orbitals: l can be up to n-1, so for n=12: l=11
// Note: Must match WebGL MAX_LEGENDRE_L in legendre.glsl.ts
// The loop for (2m-1)!! needs to run absM times, so this must be >= max(l)
const MAX_LEGENDRE_L = 12

/**
 * Evaluate associated Legendre polynomial P^m_l(x)
 *
 * Uses upward recurrence from P^m_m, which is numerically stable for |x| <= 1.
 *
 * Note: This computes P^{|m|}_l(x). The Condon-Shortley phase factor
 * (-1)^m is included in the spherical harmonic normalization.
 *
 * @param l - Degree (l >= 0)
 * @param m - Order (|m| <= l)
 * @param x - Evaluation point (typically cos(θ), so |x| <= 1)
 * @returns P^{|m|}_l(x)
 */
export const legendre = Fn(([l, m, x]: [Node, Node, Node]) => {
  const absM = abs(m).toVar()

  // Clamp x to valid range to avoid numerical issues
  const xClamped = clamp(x, float(-1), float(1)).toVar()

  // Compute (1 - x²)^{1/2} = sin(θ) for x = cos(θ)
  const somx2 = sqrt(float(1).sub(xClamped).mul(float(1).add(xClamped))).toVar()

  // Start with P^m_m using the closed form
  const pmm = float(1).toVar()

  // (2m-1)!! = 1·3·5·...·(2m-1) when absM > 0
  const fact = float(1).toVar()

  Loop(MAX_LEGENDRE_L, ({ i }) => {
    const iFloat = float(i)
    If(iFloat.lessThan(absM), () => {
      pmm.assign(pmm.mul(fact).mul(somx2))
      fact.addAssign(2)
    })
  })

  // Include (-1)^m Condon-Shortley phase (if absM is odd, negate)
  const isOdd = absM.mod(2).equal(1)
  pmm.assign(select(isOdd, pmm.negate(), pmm))

  // Compute P^m_{m+1} = x(2m+1) P^m_m
  const pmmp1 = xClamped.mul(float(2).mul(absM).add(1)).mul(pmm).toVar()

  // Upward recurrence for l > |m| + 1
  // WebGL: for (int ll = absM + 2; ll <= min(l, MAX_LEGENDRE_L); ll++)
  const pll = pmmp1.toVar()
  const pmm2 = pmm.toVar()
  const pmmp1_2 = pmmp1.toVar()

  // WebGL uses min(l, MAX_LEGENDRE_L) as upper bound
  const lClamped = min(l, float(MAX_LEGENDRE_L))

  Loop(MAX_LEGENDRE_L + 1, ({ i }) => {
    const ll = float(i).add(absM).add(2)
    If(ll.lessThanEqual(lClamped), () => {
      const fll = ll
      const fm = absM
      const newPll = xClamped
        .mul(float(2).mul(fll).sub(1))
        .mul(pmmp1_2)
        .sub(fll.add(fm).sub(1).mul(pmm2))
        .div(fll.sub(fm))

      pmm2.assign(pmmp1_2)
      pmmp1_2.assign(newPll)
      pll.assign(newPll)
    })
  })

  // Result selection based on l and absM relationship
  // if |m| > l: return 0
  // if l == |m|: return pmm
  // if l == |m| + 1: return pmmp1
  // else: return pll
  const isInvalid = absM.greaterThan(l)
  const isExact = l.equal(absM)
  const isPlus1 = l.equal(absM.add(1))

  return select(
    isInvalid,
    float(0),
    select(isExact, pmm, select(isPlus1, pmmp1, pll))
  )
})

/**
 * Compute P_l(x) - the regular Legendre polynomial (m=0 case)
 *
 * This is a simpler recurrence:
 *   P_0(x) = 1
 *   P_1(x) = x
 *   (l+1)P_{l+1}(x) = (2l+1)x P_l(x) - l P_{l-1}(x)
 *
 * @param l - Degree
 * @param x - Evaluation point
 * @returns P_l(x)
 */
export const legendreP = Fn(([l, x]: [Node, Node]) => {
  const P0 = float(1).toVar()
  const P1 = x.toVar()
  const Pl = P1.toVar()

  // WebGL: for (int i = 1; i < min(l, MAX_LEGENDRE_L); i++)
  const lClamped = min(l, float(MAX_LEGENDRE_L))

  Loop(MAX_LEGENDRE_L, ({ i }) => {
    const iFloat = float(i)
    // WebGL loop: i = 1 to min(l, MAX_LEGENDRE_L) - 1
    // TSL: i = 0 to MAX_LEGENDRE_L - 1, with condition i < l - 1
    // Since WebGL starts at i=1, condition is: i+1 < min(l, MAX_LEGENDRE_L)
    // which is: i < min(l, MAX_LEGENDRE_L) - 1 = lClamped - 1
    If(iFloat.lessThan(lClamped.sub(1)), () => {
      // WebGL uses i directly (starting from 1), so fi = i+1 for TSL
      const fi = iFloat.add(1)
      const newPl = float(2)
        .mul(fi)
        .add(1)
        .mul(x)
        .mul(P1)
        .sub(fi.mul(P0))
        .div(fi.add(1))

      P0.assign(P1)
      P1.assign(newPl)
      Pl.assign(newPl)
    })
  })

  // Result selection
  const isNegative = l.lessThan(0)
  const isZero = l.equal(0)
  const isOne = l.equal(1)

  return select(isNegative, float(0), select(isZero, float(1), select(isOne, x, Pl)))
})
