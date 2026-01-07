/**
 * TSL Full Hydrogen Atom Wavefunction ψ_nlm(r, θ, φ)
 *
 * The complete hydrogen wavefunction is the product of radial
 * and angular parts:
 *   ψ_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ)
 *
 * This module provides:
 * - Cartesian to spherical coordinate conversion
 * - Full wavefunction evaluation at any 3D point
 * - Time evolution via e^{-iEt/ℏ}
 * - Both complex and real (px/py/pz) orbital representations
 *
 * Energy eigenvalues:
 *   E_n = -13.6 eV / n² (in natural units: E_n = -1/(2n²))
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/hydrogenPsi.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/hydrogenPsi
 */

import { Fn, float, vec2, vec3, vec4, sqrt, atan, cos, sin, length, PI, dot, select } from 'three/tsl'
import type { Node } from 'three/tsl'
import { hydrogenRadial } from './hydrogenRadial'
import { fastRealSphericalHarmonic, realSphericalHarmonic, sphericalHarmonic } from './sphericalHarmonics'
import { cmul } from './complex'

/**
 * Convert Cartesian coordinates to spherical coordinates
 *
 * @param pos - Cartesian position (x, y, z)
 * @returns vec3(r, theta, phi) where:
 *   r = radial distance from origin
 *   theta = polar angle from +z axis [0, π]
 *   phi = azimuthal angle from +x axis [0, 2π]
 */
export const cartesianToSpherical = Fn(([pos]: [Node]) => {
  const p = vec3(pos)
  const r = length(p)

  // Handle origin: return zeros
  const atOrigin = r.lessThan(1e-10)

  // θ = polar angle from z-axis [0, π]
  // Using atan(rho_xy, z) instead of acos(z/r) for numerical stability
  const rho_xy = sqrt(p.x.mul(p.x).add(p.y.mul(p.y)))
  const theta = atan(rho_xy, p.z)

  // φ = atan(y, x), azimuthal angle from x-axis
  const rawPhi = atan(p.y, p.x)
  // Ensure φ ∈ [0, 2π]
  const phi = select(rawPhi.lessThan(0), rawPhi.add(float(2).mul(PI)), rawPhi)

  return select(atOrigin, vec3(0, 0, 0), vec3(r, theta, phi))
})

/**
 * Check if hydrogen radial contribution is negligible
 *
 * @param r - Radial distance (3D or ND)
 * @param n - Principal quantum number (1-7)
 * @param a0 - Bohr radius scale (0.5-3.0)
 * @param l - Azimuthal quantum number (0 to n-1)
 * @returns true if contribution is guaranteed negligible
 */
export const hydrogenRadialEarlyExit = Fn(([r, n, a0, l]: [Node, Node, Node, Node]) => {
  const fn = n
  const fl = l
  // Conservative threshold: 25 * n * a0 * (1 + 0.1*l)
  const threshold = float(25).mul(fn).mul(a0).mul(float(1).add(float(0.1).mul(fl)))
  return r.greaterThan(threshold)
})

/**
 * Evaluate hydrogen orbital at a 3D Cartesian position
 *
 * Returns the wavefunction as a complex number (vec2).
 * For real orbitals, the imaginary part will be zero.
 *
 * @param pos - Cartesian position (x, y, z)
 * @param n - Principal quantum number (1-7)
 * @param l - Azimuthal quantum number (0 to n-1)
 * @param m - Magnetic quantum number (-l to +l)
 * @param a0 - Bohr radius scale factor
 * @param useReal - Use real spherical harmonics (px/py/pz notation)
 * @returns Complex wavefunction ψ as vec2(re, im)
 */
export const evalHydrogenPsi = Fn(
  ([pos, n, l, m, a0, useReal]: [Node, Node, Node, Node, Node, Node]) => {
    // Convert to spherical coordinates
    const sph = cartesianToSpherical(pos)
    const r = sph.x
    const theta = sph.y
    const phi = sph.z

    // Check for early exit (negligible contribution)
    const earlyExit = hydrogenRadialEarlyExit(r, n, a0, l)

    // Radial part R_nl(r)
    const R = hydrogenRadial(n, l, r, a0)

    // Real spherical harmonics branch
    // Use fast computation for l <= 2, general for higher l
    const Yreal = select(
      l.lessThanEqual(2),
      fastRealSphericalHarmonic(l, m, theta, phi),
      realSphericalHarmonic(l, m, theta, phi, float(1))
    )
    const realPsi = vec2(R.mul(Yreal), float(0))

    // Complex spherical harmonics branch
    const Ycomplex = sphericalHarmonic(l, m, theta, phi)
    const complexPsi = vec2(R.mul(Ycomplex.x), R.mul(Ycomplex.y))

    // Select based on useReal flag
    const validPsi = select(useReal, realPsi, complexPsi)

    // Return zero if early exit, valid result otherwise
    return select(earlyExit, vec2(0, 0), validPsi)
  }
)

/**
 * Evaluate hydrogen orbital with time evolution
 *
 * Applies the time-dependent phase factor e^{-iE_n t/ℏ}
 *
 * Energy: E_n = -1/(2n²) in atomic units
 *
 * @param pos - Cartesian position
 * @param n - Principal quantum number
 * @param l - Azimuthal quantum number
 * @param m - Magnetic quantum number
 * @param a0 - Bohr radius
 * @param useReal - Use real orbitals
 * @param t - Time parameter
 * @returns Time-evolved ψ(r, t) as vec2(re, im)
 */
export const evalHydrogenPsiTime = Fn(
  ([pos, n, l, m, a0, useReal, t]: [Node, Node, Node, Node, Node, Node, Node]) => {
    // Static wavefunction
    const psi0 = evalHydrogenPsi(pos, n, l, m, a0, useReal)

    // Energy eigenvalue: E_n = -1/(2n²) in atomic units
    const fn = n
    const E = float(-0.5).div(fn.mul(fn))

    // Time evolution: ψ(t) = ψ(0) · e^{-iEt}
    const phase = E.negate().mul(t)
    const timeFactor = vec2(cos(phase), sin(phase))

    // Complex multiplication: ψ(t) = ψ(0) · e^{-iEt}
    return cmul(psi0, timeFactor)
  }
)

/**
 * Evaluate hydrogen orbital with spatial phase for coloring
 *
 * Returns wavefunction value and phase information for
 * phase-based coloring schemes.
 *
 * @param pos - Cartesian position
 * @param n, l, m - Quantum numbers
 * @param a0 - Bohr radius
 * @param useReal - Use real orbitals
 * @param t - Time parameter
 * @returns vec4(psi.re, psi.im, spatialPhase, magnitude)
 */
export const evalHydrogenPsiWithPhase = Fn(
  ([pos, n, l, m, a0, useReal, t]: [Node, Node, Node, Node, Node, Node, Node]) => {
    // Time-evolved wavefunction
    const psi = evalHydrogenPsiTime(pos, n, l, m, a0, useReal, t)

    // Spatial phase (at t=0) for stable coloring
    const psi0 = evalHydrogenPsi(pos, n, l, m, a0, useReal)
    const spatialPhase = atan(psi0.y, psi0.x)

    // Magnitude
    const mag = length(psi)

    return vec4(psi.x, psi.y, spatialPhase, mag)
  }
)

/**
 * Compute probability density |ψ|² at a point
 *
 * @param pos - Cartesian position
 * @param n, l, m - Quantum numbers
 * @param a0 - Bohr radius
 * @param useReal - Use real orbitals
 * @returns Probability density |ψ|²
 */
export const hydrogenProbabilityDensity = Fn(
  ([pos, n, l, m, a0, useReal]: [Node, Node, Node, Node, Node, Node]) => {
    const psi = evalHydrogenPsi(pos, n, l, m, a0, useReal)
    return dot(psi, psi) // |ψ|² = re² + im²
  }
)
