/**
 * TSL Hydrogen ND Common Functions
 *
 * Common utilities for Hydrogen ND wavefunction evaluation:
 * - N-dimensional radius from coordinate array
 * - 3D spherical angles from first 3 dimensions
 * - Extra dimension HO eigenfunction factors
 * - Angular and radial functions
 *
 * The hybrid ND hydrogen approach uses:
 * - R_nl(r_ND) for radial decay (using full ND radius)
 * - Y_lm(theta, phi) for angular shape (from first 3 dims)
 * - Product of ho1D for extra dimensions (dims 4+)
 *
 * @module rendering/tsl/raymarching/schroedinger/hydrogenND/common
 */

import { Fn, float, vec2, sqrt, max, acos, atan, cos, sin, clamp } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import * as THREE from 'three'
import { ho1D } from '../quantum/ho1d'
import { laguerre } from '../quantum/laguerre'

// TSL PI constant
const PI = float(Math.PI)

/**
 * Uniforms for HydrogenND evaluation.
 */
export interface HydrogenNDUniforms {
  // Principal quantum number n (1, 2, 3, ...)
  uPrincipalN: UniformNode<number>
  // Azimuthal quantum number l (0 to n-1)
  uAzimuthalL: UniformNode<number>
  // Magnetic quantum number m (-l to +l)
  uMagneticM: UniformNode<number>
  // Bohr radius (atomic unit scale)
  uBohrRadius: UniformNode<number>
  // Use real orbital representation (true) or complex (false)
  uUseRealOrbitals: UniformNode<boolean>
  // Current dimension (3-11)
  uDimension: UniformNode<number>
  // Extra dimension quantum numbers (n for each extra dim)
  uExtraDimN: UniformNode<THREE.Vector4>[] // Two vec4 uniforms for up to 8 extra dims
  // Extra dimension angular frequencies (omega for each)
  uExtraDimOmega: UniformNode<THREE.Vector4>[]
}

/**
 * Compute 3D radius from first 3 coordinates.
 */
export const radius3D = Fn(([x, y, z]: [Node, Node, Node]) => {
  return sqrt(x.mul(x).add(y.mul(y)).add(z.mul(z)))
})

/**
 * Compute 4D radius from first 4 coordinates.
 */
export const radius4D = Fn(([x0, x1, x2, x3]: [Node, Node, Node, Node]) => {
  return sqrt(x0.mul(x0).add(x1.mul(x1)).add(x2.mul(x2)).add(x3.mul(x3)))
})

/**
 * Compute spherical angles from first 3 dimensions.
 *
 * @returns vec2(theta, phi) where:
 * - theta: polar angle from z-axis [0, pi]
 * - phi: azimuthal angle from x-axis [0, 2pi]
 */
export const sphericalAngles3D = Fn(([x, y, z, r3d]: [Node, Node, Node, Node]) => {
  // Handle near-zero radius
  const epsilon = float(1e-10)

  // theta = arccos(z/r)
  // CRITICAL: Guard against r3d = 0 which would cause NaN
  const safeR3d = max(r3d, epsilon)
  const cosTheta = clamp(z.div(safeR3d), float(-1), float(1))
  const theta = acos(cosTheta)

  // phi = atan(y, x), shifted to [0, 2pi]
  // atan(y, x) is well-defined for all (x, y) except (0, 0)
  // When r3d is near zero, both x and y should be near zero
  // We use safeR3d to avoid returning undefined angles
  const rawPhi = atan(y, x)
  // TSL doesn't have direct conditional, so use select-like pattern
  const phi = rawPhi.add(rawPhi.lessThan(0).select(PI.mul(2), float(0)))

  return vec2(theta, phi)
})

/**
 * Hydrogen radial function R_nl(r).
 *
 * R_nl(r) = N_nl * ρ^l * L^{2l+1}_{n-l-1}(ρ) * exp(-ρ/2)
 *
 * where ρ = 2r / (n * a0) and N_nl is a normalization constant.
 *
 * For visualization, we omit the normalization and apply damping.
 */
export const hydrogenRadial = Fn(
  ([n, l, r, bohrRadius]: [Node, Node, Node, Node]) => {
    // ρ = 2r / (n * a0)
    const nf = max(n, float(1)) // Ensure n >= 1
    const rho = float(2).mul(r).div(nf.mul(bohrRadius))

    // ρ^l term (angular momentum barrier)
    const rhoL = rho.pow(l)

    // Associated Laguerre polynomial L^{2l+1}_{n-l-1}(ρ)
    // k = n - l - 1, alpha = 2l + 1
    const k = nf.sub(l).sub(1)
    const alpha = l.mul(2).add(1)
    const L = laguerre(k, alpha, rho)

    // Exponential decay exp(-ρ/2)
    const decay = rho.negate().div(2).exp()

    // Combine with damping for visualization stability
    const dampFactor = float(1).div(float(1).add(float(0.05).mul(nf.mul(nf))))

    return dampFactor.mul(rhoL).mul(L).mul(decay)
  }
)

/**
 * Check if radial contribution is negligible (early exit optimization).
 *
 * Returns true if the position is far enough from the nucleus that
 * the exponential decay makes the contribution negligible.
 *
 * The threshold formula includes:
 * - Polynomial growth: ρ^l term
 * - Laguerre polynomial oscillations
 * - Density boost: 50 * n² * 3^l * dimFactor (up to ~6 million)
 *
 * Formula: 25 * n * a0 * (1 + 0.1 * l)
 * This matches WebGL hydrogenRadialEarlyExit exactly.
 */
export const hydrogenRadialEarlyExit = Fn(
  ([r, n, bohrRadius, l]: [Node, Node, Node, Node]) => {
    // At large r, exp(-ρ/2) ~ exp(-r/(n*a0)) becomes negligible
    // Conservative threshold: 25 * n * a0 * (1 + 0.1*l)
    // At n=7, l=6, a0=3.0: threshold = 840
    const fn = max(n, float(1))
    const fl = l
    const threshold = float(25).mul(fn).mul(bohrRadius).mul(float(1).add(float(0.1).mul(fl)))
    return r.greaterThan(threshold)
  }
)

/**
 * Check if extra dimension HO contribution is negligible (single dimension).
 *
 * Uses the 3-sigma threshold for Gaussian decay.
 */
export const extraDimEarlyExitCheck = Fn(
  ([coord, omega]: [Node, Node]) => {
    const alpha = sqrt(max(omega, float(0.01)))
    const u = alpha.mul(coord)
    const u2 = u.mul(u)
    // 3-sigma threshold: contribution < 1e-8
    return u2.greaterThan(18)
  }
)

/**
 * Maximum extra dimensions supported (dims 4-11 = 8 extra)
 */
export const MAX_EXTRA_DIM = 8

/**
 * Check if extra dimension HO contribution is negligible for ALL extra dimensions.
 *
 * Matches WebGL extraDimEarlyExit() which checks all extra dimensions in a loop.
 * The total distSq across all extra dimensions is compared to threshold 18.
 *
 * @param extraDimCount - Number of extra dimensions (dimension - 3)
 * @param coords - Array of extra dimension coordinates (starting from dim 4)
 * @param omegas - Array of extra dimension omega values
 * @returns True if contribution is negligible
 */
export function createExtraDimEarlyExit(extraDimCount: number) {
  return Fn(([...args]: Node[]) => {
    // args are alternating: coord0, omega0, coord1, omega1, ...
    if (extraDimCount <= 0) return float(0).greaterThan(1) // Always false

    const distSq = float(0).toVar()

    for (let i = 0; i < extraDimCount && i < MAX_EXTRA_DIM; i++) {
      const coord = args[i * 2] ?? float(0)
      const omega = args[i * 2 + 1] ?? float(1)
      const alpha = sqrt(max(omega, float(0.01)))
      const u = alpha.mul(coord)
      distSq.addAssign(u.mul(u))
    }

    // 3-sigma threshold: contribution < 1e-8
    return distSq.greaterThan(18)
  })
}

/**
 * Evaluate extra dimension HO factor.
 *
 * This wraps ho1D for use with extra dimensions.
 */
export const extraDimFactor = Fn(([n, omega, coord]: [Node, Node, Node]) => {
  return ho1D(n, coord, omega)
})

/**
 * Apply time evolution to hydrogen ND wavefunction.
 *
 * ψ(t) = ψ(0) * exp(-i * E * t)
 * Energy E_n = -1/(2n²) in atomic units (Hartree).
 */
export const hydrogenNDTimeEvolution = Fn(
  ([psiReal, n, t]: [Node, Node, Node]) => {
    const fn = max(n, float(1))
    const E = float(-0.5).div(fn.mul(fn))
    const phase = E.negate().mul(t)
    return vec2(psiReal.mul(cos(phase)), psiReal.mul(sin(phase)))
  }
)

/**
 * Apply time evolution with FULL energy calculation.
 *
 * Includes energy contributions from extra dimensions (HO modes):
 *   E_total = E_hydrogen + Σ ω_j × (n_j + 0.5)
 *
 * This is physically correct - extra dimensions contribute to total
 * energy and affect animation speed.
 *
 * Matches WebGL hydrogenNDTimeEvolutionFull exactly.
 *
 * @param extraDimCount - Number of extra dimensions (0-8)
 * @returns TSL Fn for full time evolution
 */
export function createHydrogenNDTimeEvolutionFull(extraDimCount: number) {
  return Fn(([psiReal, n, t, ...omegasAndNs]: [Node, Node, Node, ...Node[]]) => {
    const fn = max(n, float(1))
    // Base hydrogen energy: E = -1/(2n²)
    const E = float(-0.5).div(fn.mul(fn)).toVar()

    // Add extra dimension HO contributions: ω × (n + 0.5)
    // omegasAndNs are alternating: omega0, n0, omega1, n1, ...
    for (let i = 0; i < extraDimCount && i < MAX_EXTRA_DIM; i++) {
      const omega = omegasAndNs[i * 2] ?? float(1)
      const nj = omegasAndNs[i * 2 + 1] ?? float(0)
      E.addAssign(omega.mul(nj.add(0.5)))
    }

    const phase = E.negate().mul(t)
    return vec2(psiReal.mul(cos(phase)), psiReal.mul(sin(phase)))
  })
}

/**
 * Simplified real spherical harmonic for l=0 (s orbital).
 * Y_0^0 = 1 / sqrt(4π)
 */
export const sphericalHarmonicL0 = Fn(([_theta, _phi]: [Node, Node]) => {
  // Constant: 1 / sqrt(4π) ≈ 0.282
  return float(0.282)
})

/**
 * Real spherical harmonic for l=1 (p orbitals).
 */
export const sphericalHarmonicL1 = Fn(([m, theta, phi]: [Node, Node, Node]) => {
  // Normalization: sqrt(3/(4π)) ≈ 0.489
  const norm = float(0.489)
  const sinTheta = sin(theta)
  const cosTheta = cos(theta)

  // m=0: Y_1^0 = cos(θ) (pz)
  // m=1: Y_1^1 = sin(θ)cos(φ) (px)
  // m=-1: Y_1^-1 = sin(θ)sin(φ) (py)

  const pz = cosTheta.mul(norm)
  const px = sinTheta.mul(cos(phi)).mul(norm)
  const py = sinTheta.mul(sin(phi)).mul(norm)

  // Select based on m
  return m.equal(0).select(pz, m.greaterThan(0).select(px, py))
})

/**
 * Real spherical harmonic for l=2 (d orbitals).
 */
export const sphericalHarmonicL2 = Fn(([m, theta, phi]: [Node, Node, Node]) => {
  // Simplified d-orbital shapes
  const sinTheta = sin(theta)
  const cosTheta = cos(theta)
  const sin2Theta = sinTheta.mul(sinTheta)
  const cos2Theta = cosTheta.mul(cosTheta)
  const sinPhi = sin(phi)
  const cosPhi = cos(phi)

  // m=0: dz² = 3cos²θ - 1
  const dz2 = cos2Theta.mul(3).sub(1)

  // m=±1: dxz, dyz
  const dxz = sinTheta.mul(cosTheta).mul(cosPhi)
  const dyz = sinTheta.mul(cosTheta).mul(sinPhi)

  // m=±2: dx²-y², dxy
  const cos2Phi = cosPhi.mul(cosPhi).sub(sinPhi.mul(sinPhi))
  const sin2Phi = sinPhi.mul(cosPhi).mul(2)
  const dx2y2 = sin2Theta.mul(cos2Phi)
  const dxy = sin2Theta.mul(sin2Phi)

  // Select based on m
  // This is simplified - full implementation would handle all m values
  const absM = m.abs()
  return absM.equal(0).select(
    dz2.mul(0.315),
    absM.equal(1).select(
      m.greaterThan(0).select(dxz, dyz).mul(0.546),
      m.greaterThan(0).select(dx2y2, dxy).mul(0.546)
    )
  )
})

/**
 * Evaluate angular part Y_lm for hydrogen ND.
 * Simplified version for common l values.
 */
export const evalHydrogenNDAngular = Fn(([l, m, theta, phi]: [Node, Node, Node, Node]) => {
  // Select based on l
  const Y0 = sphericalHarmonicL0(theta, phi)
  const Y1 = sphericalHarmonicL1(m, theta, phi)
  const Y2 = sphericalHarmonicL2(m, theta, phi)

  return l.equal(0).select(Y0, l.equal(1).select(Y1, Y2))
})

