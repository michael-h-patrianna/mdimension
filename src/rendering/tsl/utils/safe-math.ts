/**
 * Safe Math Utilities for TSL
 *
 * Provides GPU-safe math operations that handle edge cases like
 * division by zero, zero-length vectors, etc.
 *
 * CRITICAL: In TSL/WGSL, GPU evaluates ALL branches due to SIMD architecture.
 * Operations like normalize(zeroVec), div(x, 0), sqrt(-x) will produce NaN/Inf
 * even inside a conditional that "should" prevent execution.
 *
 * These utilities provide guarded versions that are safe to call anywhere.
 *
 * See: docs/tsl.md "GPU Branch Evaluation - CRITICAL DIFFERENCE FROM CPU"
 *
 * @module rendering/tsl/utils/safe-math
 */

import { Fn, float, vec3, dot, sqrt, max, length, select } from 'three/tsl'
import type { Node } from 'three/tsl'

/**
 * Safely normalize a vec3, returning a fallback if near zero.
 *
 * CRITICAL: Use this instead of `normalize()` inside If() blocks or when
 * the vector could potentially be zero. GPU evaluates all branches,
 * so normalize(zeroVec) will produce NaN even if condition is false.
 *
 * @param v - Vector to normalize
 * @param fallback - Fallback vector to return if v is near-zero
 * @returns Normalized vector or fallback
 *
 * @example
 * ```typescript
 * // WRONG - normalize() on potentially zero vector inside If()
 * If(hasLight, () => {
 *   const L = normalize(lightPos.sub(pos))  // NaN if at light position!
 * })
 *
 * // CORRECT - Use safeNormalize
 * If(hasLight, () => {
 *   const L = safeNormalize3(lightPos.sub(pos), vec3(0, 1, 0))
 * })
 * ```
 */
export const safeNormalize3 = Fn(([v, fallback]: [Node, Node]) => {
  const len = length(v)
  // CRITICAL: Guard division BEFORE select() - GPU evaluates both branches
  const safeLen = max(len, float(1e-6))
  return select(len.greaterThan(1e-6), v.div(safeLen), fallback)
})

/**
 * Safely normalize a vec3, returning (0, 1, 0) as default fallback.
 *
 * @param v - Vector to normalize
 * @returns Normalized vector or (0, 1, 0)
 */
export const safeNormalizeUp = Fn(([v]: [Node]) => {
  const len = length(v)
  // CRITICAL: Guard division BEFORE select() - GPU evaluates both branches
  const safeLen = max(len, float(1e-6))
  return select(len.greaterThan(1e-6), v.div(safeLen), vec3(0, 1, 0))
})

/**
 * Safely normalize a vec3, returning the original if near-zero.
 * This avoids division by zero but may return a non-unit vector.
 *
 * Use when you need a direction hint rather than a true unit vector.
 *
 * @param v - Vector to normalize
 * @returns Normalized vector or original if near-zero
 */
export const safeNormalizeNoFallback = Fn(([v]: [Node]) => {
  const lenSq = dot(v, v)
  const safeLen = sqrt(max(lenSq, float(1e-10)))
  return v.div(safeLen)
})

/**
 * Safe division that guards against divide-by-zero.
 *
 * @param a - Numerator
 * @param b - Denominator
 * @returns a / max(b, epsilon)
 */
export const safeDiv = Fn(([a, b]: [Node, Node]) => {
  const safeDenom = max(b, float(1e-8))
  return a.div(safeDenom)
})

/**
 * Safe division that guards against divide-by-zero for signed values.
 * Preserves sign of denominator.
 *
 * @param a - Numerator
 * @param b - Denominator (can be negative)
 * @returns a / b with protection against near-zero b
 */
export const safeDivSigned = Fn(([a, b]: [Node, Node]) => {
  // Use absolute value comparison, preserve sign
  const absB = b.abs()
  const safeDenom = select(absB.lessThan(1e-8), b.greaterThanEqual(0).select(float(1e-8), float(-1e-8)), b)
  return a.div(safeDenom)
})

/**
 * Safe sqrt that clamps input to non-negative.
 *
 * @param x - Value to take square root of
 * @returns sqrt(max(x, 0))
 */
export const safeSqrt = Fn(([x]: [Node]) => {
  return sqrt(max(x, float(0)))
})

/**
 * Safe inverse square root that guards against zero.
 *
 * @param x - Value
 * @returns 1 / sqrt(max(x, epsilon))
 */
export const safeInverseSqrt = Fn(([x]: [Node]) => {
  return float(1).div(sqrt(max(x, float(1e-8))))
})

/**
 * Compute length with guard against very small values.
 *
 * @param v - Vector
 * @returns max(length(v), epsilon)
 */
export const safeLength = Fn(([v]: [Node]) => {
  return max(length(v), float(1e-8))
})

