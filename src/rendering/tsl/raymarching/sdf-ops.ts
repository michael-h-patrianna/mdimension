/**
 * TSL SDF Operations
 *
 * Common signed distance field operations for raymarching.
 * These mirror the GLSL SDF functions used in the original shaders.
 *
 * @module rendering/tsl/raymarching/sdf-ops
 */

import {
  abs,
  float,
  Fn,
  length,
  max,
  min,
  mix,
  pow,
  sub,
  vec3,
} from 'three/tsl'

// Type alias for TSL nodes
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

/**
 * Sphere SDF
 *
 * @param p - Point to evaluate
 * @param r - Sphere radius
 * @returns Signed distance to sphere surface
 */
export const sdSphere = Fn(([p, r]: [Vec3Node, FloatNode]) => {
  return length(p).sub(r)
})

/**
 * Box SDF
 *
 * @param p - Point to evaluate
 * @param b - Box half-extents (size/2)
 * @returns Signed distance to box surface
 */
export const sdBox = Fn(([p, b]: [Vec3Node, Vec3Node]) => {
  const q = sub(abs(p), b)
  const outsideDist = length(max(q, vec3(0)))
  const insideDist = min(max(q.x, max(q.y, q.z)), float(0))
  return outsideDist.add(insideDist)
})

/**
 * Smooth minimum (polynomial smooth-min)
 *
 * Blends two SDF values smoothly for organic unions.
 *
 * @param a - First SDF value
 * @param b - Second SDF value
 * @param k - Smoothing factor (0 = no smoothing)
 * @returns Smoothly blended minimum
 */
export const smin = Fn(([a, b, k]: [FloatNode, FloatNode, FloatNode]) => {
  const h = max(sub(k, abs(sub(a, b))), float(0)).div(k)
  return min(a, b).sub(h.mul(h).mul(k).mul(0.25))
})

/**
 * Smooth maximum (polynomial smooth-max)
 *
 * @param a - First SDF value
 * @param b - Second SDF value
 * @param k - Smoothing factor
 * @returns Smoothly blended maximum
 */
export const smax = Fn(([a, b, k]: [FloatNode, FloatNode, FloatNode]) => {
  const h = max(sub(k, abs(sub(a, b))), float(0)).div(k)
  return max(a, b).add(h.mul(h).mul(k).mul(0.25))
})

/**
 * Union of two SDFs (simple min)
 *
 * @param a - First SDF value
 * @param b - Second SDF value
 * @returns Union distance
 */
export const opUnion = Fn(([a, b]: [FloatNode, FloatNode]) => {
  return min(a, b)
})

/**
 * Subtraction of SDFs (a minus b)
 *
 * @param a - Base SDF value
 * @param b - SDF to subtract
 * @returns Subtraction distance
 */
export const opSubtract = Fn(([a, b]: [FloatNode, FloatNode]) => {
  return max(a, b.negate())
})

/**
 * Intersection of two SDFs
 *
 * @param a - First SDF value
 * @param b - Second SDF value
 * @returns Intersection distance
 */
export const opIntersect = Fn(([a, b]: [FloatNode, FloatNode]) => {
  return max(a, b)
})

/**
 * Optimized power calculation for Mandelbulb
 *
 * Computes both r^n and r^(n-1) efficiently using a single log.
 * This matches the GLSL optimizedPow function.
 *
 * @param r - Base value
 * @param n - Exponent (power)
 * @returns Tuple of [r^n, r^(n-1)]
 */
export const optimizedPow = Fn(([r, n]: [FloatNode, FloatNode]) => {
  // ln(r) computed once, then used for both powers
  // r^n = exp(n * ln(r))
  // r^(n-1) = exp((n-1) * ln(r)) = r^n / r
  const rn = pow(r, n)
  const rnm1 = rn.div(max(r, float(0.0001)))
  return vec3(rn, rnm1, float(0)) // Pack into vec3 for multi-return
})

/**
 * Linear interpolation (same as mix but explicit naming)
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export const lerp = Fn(([a, b, t]: [FloatNode, FloatNode, FloatNode]) => {
  return mix(a, b, t)
})
