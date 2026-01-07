/**
 * TSL 1D Harmonic Oscillator Eigenfunction
 *
 * The quantum harmonic oscillator eigenfunctions are:
 *   φ_n(x) = (α/π)^{1/4} · (1/√(2^n n!)) · H_n(αx) · e^{-½(αx)²}
 *
 * where α = √(mω/ℏ) and H_n is the Hermite polynomial.
 *
 * For visualization (not physical simulation), we use a simplified version
 * without the normalization constant, and add damping for stability:
 *   φ_n(x) ∝ damp(n) · H_n(αx) · e^{-½(αx)²}
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/ho1d
 */

import { Fn, float, max, sqrt, min, exp } from 'three/tsl'
import type { Node } from 'three/tsl'
import { hermite } from './hermite'

/**
 * Evaluate 1D harmonic oscillator eigenfunction φ_n(x, ω)
 *
 * Uses visual normalization (not physically exact but stable)
 *
 * @param n - Quantum number (0-6)
 * @param x - Position coordinate
 * @param omega - Angular frequency (affects spread)
 * @returns Eigenfunction value (real)
 */
export const ho1D = Fn(([n, x, omega]: [Node, Node, Node]) => {
  // α = √ω (in dimensionless units with ℏ=m=1)
  const alpha = sqrt(max(omega, float(0.01)))
  const u = alpha.mul(x)

  // Gaussian envelope: e^{-½u²}
  // Clamp u² to prevent underflow
  const u2 = min(u.mul(u), float(40.0))
  const gauss = exp(u2.mul(-0.5))

  // Hermite polynomial
  const H = hermite(n, u)

  // Damping factor to prevent blowup at higher n
  // This keeps visual amplitude reasonable across quantum numbers
  const damp = float(1).div(float(1).add(float(0.15).mul(n.mul(n))))

  return damp.mul(H).mul(gauss)
})

/**
 * Fast path for n=0 (ground state)
 * φ_0(x, ω) = gauss(αx)
 */
export const ho1D_n0 = Fn(([x, omega]: [Node, Node]) => {
  const alpha = sqrt(max(omega, float(0.01)))
  const u = alpha.mul(x)
  const u2 = min(u.mul(u), float(40.0))
  return exp(u2.mul(-0.5))
})

/**
 * Fast path for n=1 (first excited state)
 * φ_1(x, ω) = 2αx · gauss(αx)
 */
export const ho1D_n1 = Fn(([x, omega]: [Node, Node]) => {
  const alpha = sqrt(max(omega, float(0.01)))
  const u = alpha.mul(x)
  const u2 = min(u.mul(u), float(40.0))
  const gauss = exp(u2.mul(-0.5))
  const H1 = u.mul(2) // H_1(u) = 2u
  return H1.mul(gauss)
})

/**
 * Fast path for n=2
 * φ_2(x, ω) = (4u² - 2) · gauss(αx) · damp
 */
export const ho1D_n2 = Fn(([x, omega]: [Node, Node]) => {
  const alpha = sqrt(max(omega, float(0.01)))
  const u = alpha.mul(x)
  const u2 = min(u.mul(u), float(40.0))
  const gauss = exp(u2.mul(-0.5))
  const H2 = u2.mul(4).sub(2) // H_2(u) = 4u² - 2
  const damp = float(1).div(float(1).add(float(0.15).mul(4))) // n=2, n²=4
  return damp.mul(H2).mul(gauss)
})

/**
 * Check if position is within significant Gaussian envelope.
 * Returns true if the position contributes meaningfully.
 *
 * @param xND - D-dimensional coordinates array
 * @param dim - Number of dimensions
 * @param omegas - Omega values array
 * @returns Boolean node (true if within envelope)
 */
export const isWithinGaussianEnvelope = Fn(
  ([x, omega]: [Node, Node]) => {
    const alpha = sqrt(max(omega, float(0.01)))
    const u = alpha.mul(x)
    const u2 = u.mul(u)
    // Check if within ~3σ envelope
    return u2.lessThan(18.0)
  }
)

/**
 * Select 1D harmonic oscillator at compile time for known n.
 *
 * @param n - Compile-time constant quantum number
 * @returns Optimized function for that n value
 */
export function selectHO1D(n: number): ReturnType<typeof Fn> {
  switch (n) {
    case 0:
      return ho1D_n0
    case 1:
      return ho1D_n1
    case 2:
      return ho1D_n2
    default:
      return ho1D
  }
}

