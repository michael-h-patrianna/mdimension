/**
 * Hyperspherical Coordinate Math for N-Dimensional Hyperbulb Fractals
 *
 * Implements dimension-agnostic hyperspherical coordinate transformations
 * for generating Mandelbulb-style fractals in dimensions 4-11.
 *
 * The Hyperbulb generalizes the 3D Mandelbulb to arbitrary dimensions using
 * hyperspherical coordinates: a radius r and D-1 angles theta[0..D-2].
 *
 * @see docs/research/hyperbulb-guide.md
 */

import type { VectorND } from '@/lib/math';

/**
 * Hyperspherical coordinate representation
 */
export interface HypersphericalCoords {
  /** Radial distance from origin */
  r: number;
  /** Angular coordinates (D-1 angles for D dimensions) */
  theta: Float32Array;
}

/**
 * Compute the Euclidean norm (magnitude) of a vector
 *
 * @param v - Input vector
 * @returns ||v|| = sqrt(sum of squared components)
 */
export function norm(v: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    const vi = v[i]!;
    sum += vi * vi;
  }
  return Math.sqrt(sum);
}

/**
 * Clamp a value to a range
 *
 * @param x - Value to clamp
 * @param lo - Lower bound
 * @param hi - Upper bound
 * @returns Clamped value in [lo, hi]
 */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Convert D-dimensional Cartesian vector to hyperspherical coordinates
 *
 * For a D-dimensional vector v = [x0, x1, ..., x(D-1)]:
 * - r = ||v|| (Euclidean norm)
 * - theta[0..D-3] are computed via acos(x_i / ||tail||)
 * - theta[D-2] is computed via atan2(x_{D-1}, x_{D-2})
 *
 * This is the standard hyperspherical convention where angles theta[i]
 * range from 0 to PI for i < D-2, and theta[D-2] ranges from -PI to PI.
 *
 * @param v - D-dimensional Cartesian vector (D >= 2)
 * @param eps - Small value for numerical stability (default 1e-12)
 * @returns Hyperspherical coordinates {r, theta}
 */
export function toHyperspherical(v: Float32Array, eps: number = 1e-12): HypersphericalCoords {
  const D = v.length;

  if (D < 2) {
    throw new Error(`toHyperspherical requires D >= 2, got ${D}`);
  }

  const theta = new Float32Array(D - 1);

  // Compute r = ||v||
  let r2 = 0;
  for (let i = 0; i < D; i++) {
    const vi = v[i]!;
    r2 += vi * vi;
  }
  const r = Math.sqrt(r2);

  // At origin, angles are undefined - return zeros for stability
  if (r < eps) {
    return { r: 0, theta };
  }

  // Compute angles theta[0..D-3] via arccos(x_i / ||tail||)
  // where tail norm is sqrt(x_i^2 + ... + x_{D-1}^2)
  let tail2 = r2;

  for (let i = 0; i < D - 2; i++) {
    const tail = Math.sqrt(Math.max(tail2, eps));
    const vi = v[i]!;
    // Clamp to [-1, 1] to avoid NaN from floating-point drift
    const cosAngle = clamp(vi / tail, -1, 1);
    theta[i] = Math.acos(cosAngle);

    // Remove v[i]^2 from tail for next iteration
    tail2 -= vi * vi;
  }

  // Last angle theta[D-2] uses atan2 for full circle coverage
  theta[D - 2] = Math.atan2(v[D - 1]!, v[D - 2]!);

  return { r, theta };
}

/**
 * Convert hyperspherical coordinates back to D-dimensional Cartesian vector
 *
 * Uses the standard hyperspherical convention:
 * - x[0] = r * cos(theta[0])
 * - x[1] = r * sin(theta[0]) * cos(theta[1])
 * - x[2] = r * sin(theta[0]) * sin(theta[1]) * cos(theta[2])
 * - ...
 * - x[D-2] = r * prod_{k=0..D-3} sin(theta[k]) * cos(theta[D-2])
 * - x[D-1] = r * prod_{k=0..D-3} sin(theta[k]) * sin(theta[D-2])
 *
 * @param r - Radial distance
 * @param theta - Angular coordinates (D-1 angles)
 * @returns D-dimensional Cartesian vector
 */
export function fromHyperspherical(r: number, theta: Float32Array): Float32Array {
  const D = theta.length + 1;

  if (D < 2) {
    throw new Error(`fromHyperspherical requires D >= 2, got ${D}`);
  }

  const out = new Float32Array(D);

  // Special case: 2D (polar coordinates)
  if (D === 2) {
    out[0] = r * Math.cos(theta[0]!);
    out[1] = r * Math.sin(theta[0]!);
    return out;
  }

  // General case: D >= 3
  // Build products of sines progressively
  let sinProduct = 1;

  for (let i = 0; i < D - 2; i++) {
    const ti = theta[i]!;
    out[i] = r * sinProduct * Math.cos(ti);
    sinProduct *= Math.sin(ti);
  }

  // Last two coordinates use the final angle
  const tLast = theta[D - 2]!;
  out[D - 2] = r * sinProduct * Math.cos(tLast);
  out[D - 1] = r * sinProduct * Math.sin(tLast);

  return out;
}

/**
 * Hyperbulb-style power map in D dimensions
 *
 * Applies the power transformation in hyperspherical coordinates:
 * 1. Convert v to hyperspherical (r, theta[])
 * 2. r' = r^power
 * 3. theta'[i] = theta[i] * power for all angles
 * 4. Convert back to Cartesian
 *
 * This mirrors how the 3D Mandelbulb applies its power transformation,
 * generalized to arbitrary dimensions.
 *
 * @param v - Input D-dimensional vector
 * @param power - Exponent to apply (typically 8 for classic bulb shape)
 * @param eps - Small value for numerical stability (default 1e-12)
 * @returns Transformed D-dimensional vector
 */
export function powMap(v: Float32Array, power: number, eps: number = 1e-12): Float32Array {
  const { r, theta } = toHyperspherical(v, eps);

  // Zero stays zero under any power
  if (r < eps) {
    return new Float32Array(v.length);
  }

  // Apply power transformation
  const rPow = Math.pow(r, power);
  const thetaPow = new Float32Array(theta.length);
  for (let i = 0; i < theta.length; i++) {
    thetaPow[i] = theta[i]! * power;
  }

  return fromHyperspherical(rPow, thetaPow);
}

/**
 * Single iteration step for the Hyperbulb fractal (dimensions >= 4)
 *
 * Computes z_{n+1} = powMap(z_n, power) + c
 *
 * This is the D-dimensional generalization of the Mandelbulb iteration,
 * using hyperspherical coordinates for the power transformation.
 *
 * @param z - Current iterate z_n (D-dimensional)
 * @param c - Constant c (the point being tested)
 * @param power - Hyperbulb power (default 8)
 * @param eps - Epsilon for numerical stability (default 1e-12)
 * @returns Next iterate z_{n+1}
 */
export function hyperbulbStep(
  z: VectorND,
  c: VectorND,
  power: number = 8,
  eps: number = 1e-12
): VectorND {
  const D = z.length;

  // Convert VectorND to Float32Array for computation
  const zFloat = new Float32Array(D);
  for (let i = 0; i < D; i++) {
    zFloat[i] = z[i] ?? 0;
  }

  // Apply power map
  const vP = powMap(zFloat, power, eps);

  // Add c: v = powMap(z) + c
  const result: VectorND = new Array(D);
  for (let i = 0; i < D; i++) {
    result[i] = vP[i]! + (c[i] ?? 0);
  }

  return result;
}

/**
 * Compute escape time for a point c using the Hyperbulb iteration
 *
 * Tests whether the orbit of 0 under f_c(v) = powMap(v, power) + c
 * remains bounded. Returns the iteration count when it escapes,
 * or maxIter if bounded.
 *
 * @param c - Point to test (D-dimensional)
 * @param power - Hyperbulb power (default 8)
 * @param maxIter - Maximum iterations before considering bounded
 * @param bailout - Radius beyond which orbit has escaped (default 8)
 * @param eps - Epsilon for numerical stability (default 1e-12)
 * @returns Iteration count at escape (0 to maxIter-1), or maxIter if bounded
 */
export function hyperbulbEscapeTime(
  c: VectorND,
  power: number = 8,
  maxIter: number = 60,
  bailout: number = 8,
  eps: number = 1e-12
): number {
  const D = c.length;
  const bailout2 = bailout * bailout;

  // Start at origin
  const v = new Float32Array(D);

  for (let iter = 0; iter < maxIter; iter++) {
    // v = powMap(v) + c
    const vP = powMap(v, power, eps);
    for (let i = 0; i < D; i++) {
      v[i] = vP[i]! + (c[i] ?? 0);
    }

    // Check escape
    let norm2 = 0;
    for (let i = 0; i < D; i++) {
      const vi = v[i]!;
      norm2 += vi * vi;
    }

    if (norm2 > bailout2) {
      return iter;
    }
  }

  return maxIter; // Bounded
}

/**
 * Compute smooth escape time for gradient coloring (no banding)
 *
 * Uses the fractional iteration count formula to produce continuous
 * values instead of discrete integers.
 *
 * Formula: iter + 1 - log(log(|z|) / log(bailout)) / log(power)
 *
 * Note: For hyperbulb, we use log(power) instead of log(2) since
 * the escape rate depends on the power parameter.
 *
 * @param c - Point to test (D-dimensional)
 * @param power - Hyperbulb power (default 8)
 * @param maxIter - Maximum iterations
 * @param bailout - Escape radius (default 8)
 * @param eps - Epsilon for numerical stability (default 1e-12)
 * @returns Smooth escape time (fractional), or maxIter if bounded
 */
export function hyperbulbSmoothEscapeTime(
  c: VectorND,
  power: number = 8,
  maxIter: number = 60,
  bailout: number = 8,
  eps: number = 1e-12
): number {
  const D = c.length;
  const bailout2 = bailout * bailout;
  const logBailout = Math.log(bailout);
  const logPower = Math.log(power);

  // Start at origin
  const v = new Float32Array(D);

  for (let iter = 0; iter < maxIter; iter++) {
    // v = powMap(v) + c
    const vP = powMap(v, power, eps);
    for (let i = 0; i < D; i++) {
      v[i] = vP[i]! + (c[i] ?? 0);
    }

    // Check escape and compute smooth value
    let norm2 = 0;
    for (let i = 0; i < D; i++) {
      const vi = v[i]!;
      norm2 += vi * vi;
    }

    if (norm2 > bailout2) {
      // Smooth coloring formula
      const logNorm = Math.log(Math.sqrt(norm2));
      const nu = Math.log(logNorm / logBailout) / logPower;
      return Math.max(0, iter + 1 - nu);
    }
  }

  return maxIter; // Bounded
}
