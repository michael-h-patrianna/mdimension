/**
 * TSL Associated Laguerre Polynomial Evaluation
 *
 * Associated Laguerre polynomials L^α_k(x) appear in the radial part
 * of hydrogen atom wavefunctions:
 *   R_nl(r) ∝ ρ^l · L^{2l+1}_{n-l-1}(ρ) · e^{-ρ/2}
 *
 * Recurrence relation (numerically stable for GPU):
 *   L^α_0(x) = 1
 *   L^α_1(x) = 1 + α - x
 *   (k+1)L^α_{k+1}(x) = (2k + 1 + α - x)L^α_k(x) - (k + α)L^α_{k-1}(x)
 *
 * @see https://mathworld.wolfram.com/AssociatedLaguerrePolynomial.html
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/laguerre
 */

import { Fn, float, Loop, If, select, min, Break } from 'three/tsl'
import type { Node } from 'three/tsl'

// Maximum supported degree for Laguerre polynomials
// For hydrogen orbitals: k = n - l - 1, so for n=7, l=0: k=6
const MAX_LAGUERRE_K = 7

/**
 * Evaluate associated Laguerre polynomial L^α_k(x)
 *
 * Uses three-term recurrence relation for numerical stability.
 * This is more efficient than direct summation on GPU.
 *
 * @param k - Polynomial degree (non-negative integer)
 * @param alpha - Associated parameter (typically 2l+1 for hydrogen)
 * @param x - Evaluation point (typically ρ = 2r/na₀)
 * @returns L^α_k(x)
 */
export const laguerre = Fn(([kNode, alpha, x]: [Node, Node, Node]) => {
  // L^α_0(x) = 1
  const L0 = float(1)

  // L^α_1(x) = 1 + α - x
  const L1 = float(1).add(alpha).sub(x)

  // Result variable
  const result = float(1).toVar()

  // Handle k <= 0
  result.assign(
    select(
      kNode.lessThanEqual(0),
      L0,
      select(
        kNode.equal(1),
        L1,
        // For k >= 2, use recurrence
        float(0) // Placeholder, will be overwritten
      )
    )
  )

  // For k >= 2, compute using recurrence relation
  // We need to use explicit loop with break conditions
  const Lkm1 = L0.toVar()
  const Lk = L1.toVar()

  // Clamp k to prevent excessive iterations
  const kClamped = min(kNode, float(MAX_LAGUERRE_K)).toVar()

  // Only execute loop if k >= 2
  If(kNode.greaterThan(1), () => {
    // Three-term recurrence loop
    Loop(MAX_LAGUERRE_K - 1, ({ i }) => {
      // i goes from 0 to MAX_LAGUERRE_K-2
      // We need to compute for i = 1, 2, ..., k-1
      const fi = float(i).add(1) // fi = 1, 2, 3, ...

      // Exit if we've computed enough terms
      If(fi.greaterThanEqual(kClamped), () => {
        Break()
      })

      // (k+1)L_{k+1} = (2k + 1 + α - x)L_k - (k + α)L_{k-1}
      const coeff1 = fi.mul(2).add(1).add(alpha).sub(x)
      const coeff2 = fi.add(alpha)
      const Lkp1 = coeff1.mul(Lk).sub(coeff2.mul(Lkm1)).div(fi.add(1))

      Lkm1.assign(Lk)
      Lk.assign(Lkp1)
    })

    result.assign(Lk)
  })

  return result
})

/**
 * Evaluate associated Laguerre polynomial with damping for visualization.
 *
 * High-degree polynomials can have large oscillations. This version
 * applies mild damping to keep values reasonable for volume rendering.
 *
 * @param k - Polynomial degree
 * @param alpha - Associated parameter
 * @param x - Evaluation point
 * @returns Damped L^α_k(x)
 */
export const laguerreDamped = Fn(([k, alpha, x]: [Node, Node, Node]) => {
  const L = laguerre(k, alpha, x)
  // Damping factor to reduce oscillation amplitude at high k
  const damp = float(1).div(float(1).add(float(0.05).mul(k.mul(k))))
  return damp.mul(L)
})

/**
 * Fast paths for low-degree Laguerre polynomials.
 * Use these when k is known at compile time.
 */

/**
 * L^α_0(x) = 1
 */
export const laguerre0 = Fn(([_alpha, _x]: [Node, Node]) => float(1))

/**
 * L^α_1(x) = 1 + α - x
 */
export const laguerre1 = Fn(([alpha, x]: [Node, Node]) => float(1).add(alpha).sub(x))

/**
 * L^α_2(x) = (1/2)[(α+1)(α+2) - 2(α+2)x + x²]
 * Using recurrence: L^α_2 = ((3+α-x)L^α_1 - (1+α)L^α_0) / 2
 */
export const laguerre2 = Fn(([alpha, x]: [Node, Node]) => {
  const L0 = float(1)
  const L1 = float(1).add(alpha).sub(x)
  return float(3).add(alpha).sub(x).mul(L1).sub(float(1).add(alpha).mul(L0)).div(2)
})

/**
 * L^α_3(x) using recurrence from L^α_1 and L^α_2
 */
export const laguerre3 = Fn(([alpha, x]: [Node, Node]) => {
  const L1 = float(1).add(alpha).sub(x)
  const L2 = float(3).add(alpha).sub(x).mul(L1).sub(float(1).add(alpha)).div(2)
  return float(5).add(alpha).sub(x).mul(L2).sub(float(2).add(alpha).mul(L1)).div(3)
})

/**
 * Select Laguerre polynomial at compile time based on known k.
 *
 * @param k - Compile-time constant degree (0-3 for fast paths)
 * @returns Function to evaluate L^α_k(x)
 */
export function selectLaguerre(k: number): ReturnType<typeof Fn> {
  switch (k) {
    case 0:
      return laguerre0
    case 1:
      return laguerre1
    case 2:
      return laguerre2
    case 3:
      return laguerre3
    default:
      // For k > 3, use the general recurrence
      return laguerre
  }
}

