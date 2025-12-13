/**
 * Core Mathematical Functions for Mandelbrot Generation
 *
 * Implements the iteration step, escape time checks, and norm calculations.
 * - 2D: Classic complex Mandelbrot (z² + c)
 * - 3D: Mandelbulb using spherical coordinates
 * - 4D-11D: Hyperbulb using hyperspherical coordinates
 *
 * @see docs/research/hyperbulb-guide.md for the hyperbulb algorithm
 */

import type { VectorND } from '@/lib/math';
import { hyperbulbStep } from './hyperspherical';

/**
 * Mandelbulb iteration step using spherical coordinates.
 *
 * Implements the power-n Mandelbulb formula:
 * z_{n+1} = r^n * (sin(n*theta)*cos(n*phi), sin(n*theta)*sin(n*phi), cos(n*theta)) + c
 *
 * This produces true fractal self-similarity for 3D Mandelbrot visualization.
 * Power 8 produces the classic Mandelbulb shape.
 *
 * @param z - Current iterate [x, y, z]
 * @param c - Constant c (the point being tested)
 * @param power - Mandelbulb power (default 8)
 * @returns Next iterate z_{n+1}
 */
export function mandelbulbStep(
  z: VectorND,
  c: VectorND,
  power: number = 8
): VectorND {
  const x = z[0] ?? 0;
  const y = z[1] ?? 0;
  const zCoord = z[2] ?? 0;

  const r = Math.sqrt(x * x + y * y + zCoord * zCoord);

  // Handle origin case to avoid division by zero
  if (r < 1e-10) {
    return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0];
  }

  // Convert to spherical coordinates
  const theta = Math.acos(zCoord / r);
  const phi = Math.atan2(y, x);

  // Apply power transformation
  const rPow = Math.pow(r, power);
  const newTheta = theta * power;
  const newPhi = phi * power;

  // Convert back to Cartesian and add c
  return [
    rPow * Math.sin(newTheta) * Math.cos(newPhi) + (c[0] ?? 0),
    rPow * Math.sin(newTheta) * Math.sin(newPhi) + (c[1] ?? 0),
    rPow * Math.cos(newTheta) + (c[2] ?? 0),
  ];
}

/**
 * N-dimensional Mandelbrot-like iteration step
 *
 * Computes z_{n+1} = f(z_n, c) where:
 * - For dimension 2 (complex plane): standard complex square z^2 + c
 * - For dimension 3: Mandelbulb formula using spherical coordinates
 * - For dimensions 4-11: Hyperbulb formula using hyperspherical coordinates
 *
 * The Hyperbulb generalizes the Mandelbulb to arbitrary dimensions by using
 * D-1 angular coordinates instead of just 2 (theta, phi).
 *
 * @param z - Current iterate z_n
 * @param c - Constant c (the point being tested)
 * @param power - Power for Mandelbulb/Hyperbulb (default 8)
 * @returns Next iterate z_{n+1}
 */
export function mandelbrotStep(z: VectorND, c: VectorND, power: number = 8): VectorND {
  const d = z.length;

  // Dimension 2: Standard complex Mandelbrot
  if (d === 2) {
    const zx = z[0] ?? 0;
    const zy = z[1] ?? 0;
    const cx = c[0] ?? 0;
    const cy = c[1] ?? 0;
    return [
      zx * zx - zy * zy + cx,
      2 * zx * zy + cy,
    ];
  }

  // Dimension 3: Use Mandelbulb formula (spherical coordinates)
  if (d === 3) {
    return mandelbulbStep(z, c, power);
  }

  // Dimensions 4-11: Use Hyperbulb formula (hyperspherical coordinates)
  // This properly generalizes the Mandelbulb to higher dimensions
  return hyperbulbStep(z, c, power);
}

/**
 * Compute squared magnitude of a vector
 *
 * @param v - Vector to compute norm^2 for
 * @returns Sum of squared components
 */
export function normSquared(v: VectorND): number {
  return v.reduce((sum, val) => sum + val * val, 0);
}

/**
 * Compute escape time for point c in n-dimensional Mandelbrot
 *
 * Tests whether the orbit of c remains bounded under iteration.
 * Returns the iteration count when it escapes, or maxIter if bounded.
 *
 * Following standard Mandelbrot convention: step first, then check escape.
 * This ensures escape time 0 means escaped after first iteration (z₁).
 *
 * Performance: Uses in-place buffer mutation to avoid array allocations
 * in the hot iteration loop (can have millions of calls).
 *
 * @param c - Point to test (N-dimensional)
 * @param maxIter - Maximum iterations before considering bounded
 * @param escapeRadius - Radius beyond which orbit has escaped
 * @param power - Power for Mandelbulb formula (3D only), default 8
 * @returns Iteration count at escape (0 to maxIter-1), or maxIter if bounded
 */
export function mandelbrotEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number,
  power: number = 8
): number {
  const d = c.length;
  const R2 = escapeRadius * escapeRadius;

  // Dimension 2: Optimized complex Mandelbrot (no array allocation)
  if (d === 2) {
    let zx = 0;
    let zy = 0;
    const cx = c[0] ?? 0;
    const cy = c[1] ?? 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const zx2 = zx * zx;
      const zy2 = zy * zy;
      if (zx2 + zy2 > R2) {
        return iter;
      }
      // z = z² + c
      const newZx = zx2 - zy2 + cx;
      zy = 2 * zx * zy + cy;
      zx = newZx;
    }
    return maxIter;
  }

  // Dimension 3: Optimized Mandelbulb (reuse buffer)
  if (d === 3) {
    let zx = 0, zy = 0, zz = 0;
    const cx = c[0] ?? 0;
    const cy = c[1] ?? 0;
    const cz = c[2] ?? 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const r2 = zx * zx + zy * zy + zz * zz;
      if (r2 > R2) {
        return iter;
      }

      const r = Math.sqrt(r2);
      if (r < 1e-10) {
        zx = cx;
        zy = cy;
        zz = cz;
      } else {
        const theta = Math.acos(zz / r);
        const phi = Math.atan2(zy, zx);
        const rPow = Math.pow(r, power);
        const newTheta = theta * power;
        const newPhi = phi * power;
        zx = rPow * Math.sin(newTheta) * Math.cos(newPhi) + cx;
        zy = rPow * Math.sin(newTheta) * Math.sin(newPhi) + cy;
        zz = rPow * Math.cos(newTheta) + cz;
      }
    }
    return maxIter;
  }

  // Dimensions 4+: Use fallback with array (hyperbulb)
  // Note: hyperspherical.ts has its own optimized version
  let z = new Array(c.length).fill(0) as VectorND;

  for (let iter = 0; iter < maxIter; iter++) {
    z = mandelbrotStep(z, c, power);
    const norm2 = normSquared(z);
    if (norm2 > R2) {
      return iter; // Escaped after this iteration
    }
  }

  return maxIter; // Bounded (inside or near set)
}

/**
 * Compute smooth escape time for gradient coloring (no banding)
 *
 * Uses the fractional iteration count formula to produce continuous
 * values instead of discrete integers. This eliminates color banding.
 *
 * Formula: iter + 1 - log(log(|z|) / log(R)) / log(2)
 *
 * Following standard Mandelbrot convention: step first, then check escape.
 * The smooth formula uses the norm of z that just escaped.
 *
 * Performance: Uses in-place buffer mutation to avoid array allocations
 * in the hot iteration loop (can have millions of calls).
 *
 * @param c - Point to test (N-dimensional)
 * @param maxIter - Maximum iterations
 * @param escapeRadius - Escape radius
 * @param power - Power for Mandelbulb formula (3D only), default 8
 * @returns Smooth escape time (fractional), or maxIter if bounded
 */
export function mandelbrotSmoothEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number,
  power: number = 8
): number {
  const d = c.length;
  const R2 = escapeRadius * escapeRadius;
  const logR = Math.log(escapeRadius);
  const log2 = Math.log(2);

  // Dimension 2: Optimized complex Mandelbrot (no array allocation)
  if (d === 2) {
    let zx = 0;
    let zy = 0;
    const cx = c[0] ?? 0;
    const cy = c[1] ?? 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const zx2 = zx * zx;
      const zy2 = zy * zy;
      const norm2 = zx2 + zy2;
      if (norm2 > R2) {
        const log_zn = Math.log(norm2) / 2;
        const nu = Math.log(log_zn / logR) / log2;
        return iter + 1 - nu;
      }
      // z = z² + c
      const newZx = zx2 - zy2 + cx;
      zy = 2 * zx * zy + cy;
      zx = newZx;
    }
    return maxIter;
  }

  // Dimension 3: Optimized Mandelbulb (reuse buffer)
  if (d === 3) {
    let zx = 0, zy = 0, zz = 0;
    const cx = c[0] ?? 0;
    const cy = c[1] ?? 0;
    const cz = c[2] ?? 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const r2 = zx * zx + zy * zy + zz * zz;
      if (r2 > R2) {
        const log_zn = Math.log(r2) / 2;
        const nu = Math.log(log_zn / logR) / log2;
        return iter + 1 - nu;
      }

      const r = Math.sqrt(r2);
      if (r < 1e-10) {
        zx = cx;
        zy = cy;
        zz = cz;
      } else {
        const theta = Math.acos(zz / r);
        const phi = Math.atan2(zy, zx);
        const rPow = Math.pow(r, power);
        const newTheta = theta * power;
        const newPhi = phi * power;
        zx = rPow * Math.sin(newTheta) * Math.cos(newPhi) + cx;
        zy = rPow * Math.sin(newTheta) * Math.sin(newPhi) + cy;
        zz = rPow * Math.cos(newTheta) + cz;
      }
    }
    return maxIter;
  }

  // Dimensions 4+: Use fallback with array (hyperbulb)
  let z = new Array(c.length).fill(0) as VectorND;

  for (let iter = 0; iter < maxIter; iter++) {
    z = mandelbrotStep(z, c, power);
    const norm2 = normSquared(z);
    if (norm2 > R2) {
      // Smooth coloring formula using escaped z's magnitude
      const log_zn = Math.log(norm2) / 2; // log(|z|) = log(sqrt(norm2))
      const nu = Math.log(log_zn / logR) / log2;
      return iter + 1 - nu;
    }
  }

  return maxIter; // Bounded
}
