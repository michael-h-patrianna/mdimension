/**
 * TSL Hydrogen Atom Radial Wavefunction R_nl(r)
 *
 * The radial part of the hydrogen wavefunction describes how
 * the probability density varies with distance from the nucleus.
 *
 * Formula:
 *   R_nl(r) = N_nl · (2r/na₀)^l · L^{2l+1}_{n-l-1}(2r/na₀) · e^{-r/na₀}
 *
 * where:
 *   N_nl = normalization constant
 *   a₀ = Bohr radius (scaling factor)
 *   L^α_k = associated Laguerre polynomial
 *
 * Properties:
 *   - n - l - 1 radial nodes (zeros)
 *   - Decays exponentially at large r
 *   - Scales as r^l near the origin
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/hydrogenRadial.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/hydrogenRadial
 */

import { Fn, float, If, Loop, Break, pow, sqrt, exp, max, select } from 'three/tsl'
import type { Node } from 'three/tsl'
import { laguerre } from './laguerre'

/**
 * Compute normalization constant for R_nl(r)
 *
 * N_nl = sqrt((2/na₀)³ · (n-l-1)! / (2n·(n+l)!))
 *
 * For visualization, we use a simplified normalization that
 * maintains relative amplitudes but avoids numerical issues.
 *
 * @param n - Principal quantum number (1-7)
 * @param l - Azimuthal quantum number (0 to n-1)
 * @param a0 - Bohr radius scale factor
 * @returns Normalization constant
 */
export const hydrogenRadialNorm = Fn(([n, l, a0]: [Node, Node, Node]) => {
  const fn = n

  // (2/na₀)^{3/2}
  const front = pow(float(2).div(fn.mul(a0)), float(1.5))

  // sqrt((n-l-1)! / (2n·(n+l)!))
  // Compute ratio of factorials carefully
  const factNum = float(1).toVar()
  const nMinusLMinus1 = n.sub(l).sub(1)

  Loop(10, ({ i }) => {
    const idx = float(i).add(1)
    If(idx.greaterThan(nMinusLMinus1), () => {
      Break()
    })
    factNum.assign(factNum.mul(idx))
  })

  const factDen = float(2).mul(fn).toVar()
  const nPlusL = n.add(l)

  Loop(14, ({ i }) => {
    const idx = float(i).add(1)
    If(idx.greaterThan(nPlusL), () => {
      Break()
    })
    factDen.assign(factDen.mul(idx))
  })

  return front.mul(sqrt(factNum.div(factDen)))
})

/**
 * Evaluate hydrogen radial wavefunction R_nl(r)
 *
 * @param n - Principal quantum number (n >= 1)
 * @param l - Azimuthal quantum number (0 <= l < n)
 * @param r - Radial distance from nucleus
 * @param a0 - Bohr radius scale factor (controls orbital size)
 * @returns R_nl(r)
 */
export const hydrogenRadial = Fn(([n, l, r, a0]: [Node, Node, Node, Node]) => {
  // Validate quantum numbers using select for invalid cases
  const invalid = n.lessThan(1).or(l.lessThan(0).or(l.greaterThanEqual(n)))

  // Avoid division by zero
  const safeA0 = max(a0, float(0.001))

  // Scaled radial coordinate: ρ = 2r / (n·a₀)
  const fn = n
  const rho = float(2).mul(r).div(fn.mul(safeA0))

  // Normalization constant (simplified for visualization)
  const norm = hydrogenRadialNorm(n, l, safeA0)

  // ρ^l factor (behavior near origin)
  const fl = l
  const rhoL = select(l.greaterThan(0), pow(max(rho, float(1e-10)), fl), float(1))

  // Associated Laguerre polynomial L^{2l+1}_{n-l-1}(ρ)
  const lagK = n.sub(l).sub(1)
  const alpha = float(2).mul(l).add(1)
  const L = laguerre(lagK, alpha, rho)

  // Exponential decay: e^{-ρ/2} = e^{-r/(na₀)}
  const expPart = exp(rho.mul(-0.5))

  // Damping for high n to prevent numerical blowup
  const damp = float(1).div(float(1).add(float(0.02).mul(n.mul(n))))

  const validResult = damp.mul(norm).mul(rhoL).mul(L).mul(expPart)

  // Return 0 for invalid quantum numbers, valid result otherwise
  return select(invalid, float(0), validResult)
})

/**
 * Compute radial probability density r²|R_nl|²
 *
 * This is what's often plotted to show where electrons are likely
 * to be found. The r² factor accounts for the spherical volume element.
 *
 * @param n - Principal quantum number
 * @param l - Azimuthal quantum number
 * @param r - Radial distance
 * @param a0 - Bohr radius
 * @returns r²|R_nl(r)|²
 */
export const hydrogenRadialProbability = Fn(([n, l, r, a0]: [Node, Node, Node, Node]) => {
  const R = hydrogenRadial(n, l, r, a0)
  return r.mul(r).mul(R).mul(R)
})

/**
 * Find approximate maximum of radial wavefunction
 *
 * Used for adaptive scaling in visualization.
 * For l=0 (s orbitals), max is near r ≈ n²·a₀
 * For l>0, max is near r ≈ n·a₀·(n - sqrt(n² - l²))
 *
 * @param n - Principal quantum number
 * @param l - Azimuthal quantum number
 * @param a0 - Bohr radius
 * @returns Approximate radius of maximum probability
 */
export const hydrogenRadialMaxRadius = Fn(([n, l, a0]: [Node, Node, Node]) => {
  const fn = n
  const fl = l

  // s orbitals: max at r ≈ n·a₀
  const sOrbitalMax = fn.mul(a0)

  // General case: max near r = n·a₀·(1 + sqrt(1 - (l/n)²))
  const ratio = fl.div(fn)
  const generalMax = fn.mul(a0).mul(float(1).add(sqrt(max(float(0), float(1).sub(ratio.mul(ratio))))))

  return select(l.equal(0), sOrbitalMax, generalMax)
})
