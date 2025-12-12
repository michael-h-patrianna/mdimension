/**
 * Core Mathematical Functions for Mandelbrot Generation
 *
 * Implements the iteration step, escape time checks, and norm calculations.
 */

import type { VectorND } from '@/lib/math';

/**
 * N-dimensional Mandelbrot-like iteration step
 *
 * Computes z_{n+1} = f(z_n, c) where:
 * - For dimensions 0,1 (Re, Im): standard complex square z^2 + c
 * - For dimensions >= 2: coupled quadratics with cross-interaction
 *
 * @param z - Current iterate z_n
 * @param c - Constant c (the point being tested)
 * @returns Next iterate z_{n+1}
 */
export function mandelbrotStep(z: VectorND, c: VectorND): VectorND {
  const d = z.length;
  const out = new Array(d).fill(0);

  // Complex square for first two coordinates (Re, Im)
  const zx = z[0] ?? 0;
  const zy = z[1] ?? 0;
  const cx = c[0] ?? 0;
  const cy = c[1] ?? 0;

  out[0] = zx * zx - zy * zy + cx;
  out[1] = 2 * zx * zy + cy;

  // Coupled quadratics for higher dimensions
  for (let i = 2; i < d; i++) {
    const zi = z[i] ?? 0;
    const ci = c[i] ?? 0;
    // Cross-interaction creates n-dimensional structure
    const coupling = zx * zi - zy * ci;
    out[i] = zi * zi - ci * ci + ci + 0.1 * coupling;
  }

  return out;
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
 * @param c - Point to test (N-dimensional)
 * @param maxIter - Maximum iterations before considering bounded
 * @param escapeRadius - Radius beyond which orbit has escaped
 * @returns Iteration count at escape (0 to maxIter-1), or maxIter if bounded
 */
export function mandelbrotEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number
): number {
  let z = new Array(c.length).fill(0) as VectorND;
  const R2 = escapeRadius * escapeRadius;

  for (let iter = 0; iter < maxIter; iter++) {
    z = mandelbrotStep(z, c);
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
 * @param c - Point to test (N-dimensional)
 * @param maxIter - Maximum iterations
 * @param escapeRadius - Escape radius
 * @returns Smooth escape time (fractional), or maxIter if bounded
 */
export function mandelbrotSmoothEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number
): number {
  let z = new Array(c.length).fill(0) as VectorND;
  const R2 = escapeRadius * escapeRadius;

  for (let iter = 0; iter < maxIter; iter++) {
    z = mandelbrotStep(z, c);
    const norm2 = normSquared(z);
    if (norm2 > R2) {
      // Smooth coloring formula using escaped z's magnitude
      const log_zn = Math.log(norm2) / 2; // log(|z|) = log(sqrt(norm2))
      const nu = Math.log(log_zn / Math.log(escapeRadius)) / Math.log(2);
      return iter + 1 - nu;
    }
  }

  return maxIter; // Bounded
}
