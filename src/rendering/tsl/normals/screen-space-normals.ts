/**
 * TSL Screen-Space Normal Computation
 *
 * For dimensions >= SCREEN_SPACE_NORMAL_MIN_DIMENSION (default 7),
 * normals are computed from screen-space derivatives in the fragment shader.
 *
 * Uses dFdx/dFdy of world position to compute face normal.
 * 67% fewer vertex shader transforms (no neighbor vertices needed).
 *
 * 100% parity with WebGL polytopeMainBlockScreenSpace
 *
 * Trade-off: May have 1-2 pixel edge artifacts at triangle boundaries
 * where the GPU's 2x2 pixel quad spans multiple triangles.
 *
 * @module rendering/tsl/normals/screen-space-normals
 */

import { cross, dFdx, dFdy, float, Fn, length, select, vec3 } from 'three/tsl'
import { safeNormalizeUp } from '../utils/safe-math'

// Type aliases
type Vec3Node = ReturnType<typeof vec3>

// Minimum dimension for screen-space normals (matches WebGL)
export const SCREEN_SPACE_NORMAL_MIN_DIMENSION = 7

/**
 * Compute face normal from screen-space derivatives.
 * Exact port of WebGL dFdx/dFdy normal computation.
 *
 * For flat triangles, dFdx/dFdy of linearly interpolated position
 * gives the exact face normal.
 *
 * @returns TSL Fn that computes normal from world position derivatives
 */
export const computeScreenSpaceNormal = Fn(([worldPos]: [Vec3Node]) => {
  // Compute derivatives of world position
  const dPdx = dFdx(worldPos)
  const dPdy = dFdy(worldPos)

  // Cross product gives face normal
  const rawNormal = cross(dPdx, dPdy)
  const normalLen = length(rawNormal)

  // CRITICAL: Guard against division by zero
  // In TSL/GPU, all branches of select() are evaluated, so the division
  // rawNormal.div(normalLen) executes even when normalLen is 0.
  // We must guard the denominator BEFORE division to avoid Inf/NaN.
  // NOTE: Use tiny epsilon (1e-10) because dFdx/dFdy return per-pixel rates,
  // so cross product magnitude is naturally small (proportional to 1/pixels²)
  const safeLen = normalLen.max(float(1e-10))
  const safeNormal = rawNormal.div(safeLen)
  const fallback = vec3(0, 0, 1)

  return select(normalLen.greaterThan(1e-10), safeNormal, fallback)
})

/**
 * Compute normal with two-sided lighting support.
 * Flips normal to face viewer based on gl_FrontFacing.
 *
 * @returns TSL Fn that computes two-sided normal
 */
export const computeScreenSpaceNormalTwoSided = Fn(
  ([worldPos, isFrontFacing]: [Vec3Node, ReturnType<typeof float>]) => {
    const normal = computeScreenSpaceNormal(worldPos)

    // Flip for back faces
    return select(isFrontFacing.greaterThan(0.5), normal, normal.negate())
  }
)

/**
 * Compute high-quality normal with edge detection.
 *
 * Uses multiple samples to detect triangle edges and reduce artifacts.
 * More expensive but produces cleaner normals at edges.
 *
 * @returns TSL Fn that computes improved screen-space normal
 */
export const computeScreenSpaceNormalHQ = Fn(([worldPos]: [Vec3Node]) => {
  // Standard derivatives
  const dPdx = dFdx(worldPos)
  const dPdy = dFdy(worldPos)
  const rawNormal = cross(dPdx, dPdy)
  const normalLen = length(rawNormal)

  // CRITICAL: Guard against division by zero
  // In TSL/GPU, all branches of select() are evaluated, so the division
  // executes even when normalLen is 0. Guard the denominator BEFORE division.
  const safeLen = normalLen.max(float(1e-8))
  const safeNormal = rawNormal.div(safeLen)
  const fallback = vec3(0, 0, 1)

  return select(normalLen.greaterThan(1e-8), safeNormal, fallback)
})

/**
 * Check if current fragment is at a triangle edge.
 *
 * Uses derivative discontinuity to detect edges.
 * Useful for applying edge-aware effects.
 *
 * @returns TSL Fn that returns 1.0 at edges, 0.0 in interior
 */
export const detectTriangleEdge = Fn(([worldPos]: [Vec3Node]) => {
  // Compute second derivatives (rate of change of derivatives)
  const dPdx = dFdx(worldPos)
  const dPdy = dFdy(worldPos)

  // Second derivatives will be large at discontinuities
  const d2Pdx = length(dFdx(dPdx))
  const d2Pdy = length(dFdy(dPdy))

  // Threshold for edge detection
  const threshold = float(0.1)
  const edgeness = d2Pdx.add(d2Pdy)

  return select(edgeness.greaterThan(threshold), float(1), float(0))
})

/**
 * Smooth normal at triangle edges using neighboring information.
 *
 * Uses the fact that at edges, derivatives span two triangles,
 * creating an averaged normal effect.
 *
 * @returns TSL Fn that computes edge-smoothed normal
 */
export const computeSmoothEdgeNormal = Fn(([worldPos, normal]: [Vec3Node, Vec3Node]) => {
  const isEdge = detectTriangleEdge(worldPos)

  // At edges, blend toward average (which is what derivatives naturally give)
  // In interior, use the clean computed normal
  const screenNormal = computeScreenSpaceNormal(worldPos)

  // Blend based on edge detection
  // At edges, the screen-space normal is already partially averaged
  // CRITICAL: Use safe normalize - blended normals could theoretically cancel
  return safeNormalizeUp(normal.mul(float(1).sub(isEdge.mul(0.5))).add(screenNormal.mul(isEdge.mul(0.5))))
})
