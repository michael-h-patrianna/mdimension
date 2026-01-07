/**
 * TSL Event Horizon
 *
 * Handles ray-horizon intersection.
 *
 * Uses uVisualEventHorizon for the actual event horizon check (shrinks with spin),
 * while uHorizonRadius remains the Schwarzschild radius (rs = 2M) for scale reference.
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/horizon
 */

import { Fn, float, sqrt, dot, max, abs } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

/**
 * Uniforms for event horizon calculations.
 */
export interface HorizonUniforms {
  /** Visual event horizon radius (accounts for Kerr spin) */
  uVisualEventHorizon: UniformNode<number>
  /** Schwarzschild radius (rs = 2M) */
  uHorizonRadius: UniformNode<number>
}

/**
 * Check if position is inside the event horizon.
 *
 * Uses uVisualEventHorizon which accounts for Kerr spin:
 * - For spin=0 (Schwarzschild): equals uHorizonRadius
 * - For spin=0.9: ~72% of uHorizonRadius
 */
export function createIsInsideHorizon(uniforms: HorizonUniforms) {
  return Fn(([ndRadius]: [Node]) => {
    return ndRadius.lessThan(uniforms.uVisualEventHorizon)
  })
}

/**
 * Check for horizon intersection along ray segment.
 * Returns the t-value where ray intersects horizon sphere, or -1 if no hit.
 */
export function createHorizonIntersect(uniforms: HorizonUniforms) {
  return Fn(([rayOrigin, rayDir]: [Node, Node]) => {
    // Ray-sphere intersection using visual event horizon
    // |O + t*D|² = R_h²
    const horizonR = uniforms.uVisualEventHorizon

    const a = dot(rayDir, rayDir)
    const b = float(2.0).mul(dot(rayOrigin, rayDir))
    const c = dot(rayOrigin, rayOrigin).sub(horizonR.mul(horizonR))

    const discriminant = b.mul(b).sub(float(4.0).mul(a).mul(c))

    // Initialize result as no intersection
    const result = float(-1.0).toVar('horizonT')

    // Only proceed if discriminant >= 0 (intersection exists)
    // and a is not near zero (valid ray direction)
    const hasIntersection = discriminant.greaterThanEqual(0).and(abs(a).greaterThan(0.0001))

    // Compute intersection t values if intersection exists
    const sqrtDisc = sqrt(max(discriminant, float(0)))
    const invTwoA = float(1.0).div(max(float(2.0).mul(a), float(0.0001)))
    const t1 = b.negate().sub(sqrtDisc).mul(invTwoA)
    const t2 = b.negate().add(sqrtDisc).mul(invTwoA)

    // Return nearest positive intersection using select chains
    // t1 > 0 ? t1 : (t2 > 0 ? t2 : -1)
    result.assign(
      hasIntersection.select(
        t1.greaterThan(0).select(t1, t2.greaterThan(0).select(t2, float(-1))),
        float(-1)
      )
    )

    return result
  })
}

