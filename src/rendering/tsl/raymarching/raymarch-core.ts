/**
 * TSL Raymarching Core
 *
 * Core raymarching loop with relaxed sphere tracing.
 * Mirrors the GLSL RayMarchCore function.
 *
 * Now includes temporal reprojection support matching WebGL core.glsl.ts
 *
 * @module rendering/tsl/raymarching/raymarch-core
 */

import {
  Break,
  clamp,
  float,
  Fn,
  If,
  int,
  Loop,
  max,
  min,
  mix,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

import type { UniformNode } from 'three/tsl'
import { createApplyTemporalHint, type TemporalUniforms } from '../compose/feature-blocks/temporal'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>
type SDFWithTrapFunc = (p: Vec3Node) => { dist: FloatNode; trap: FloatNode }

/** Raymarching quality settings */
export interface RaymarchQualityUniforms {
  uFastMode: UniformNode<boolean>
  uQualityMultiplier: UniformNode<number>
  uSdfSurfaceDistance: UniformNode<number>
}

/**
 * Raymarching quality constants
 * MUST match WebGL constants.glsl.ts exactly:
 * ```glsl
 * #define MAX_MARCH_STEPS_HQ 128
 * #define SURF_DIST_HQ 0.002
 * #define MAX_MARCH_STEPS_LQ 64
 * #define SURF_DIST_LQ 0.002
 * #define BOUND_R 2.0
 * ```
 */
export const RAYMARCH_CONSTANTS = {
  MAX_MARCH_STEPS_LQ: 64,
  MAX_MARCH_STEPS_HQ: 128,
  SURF_DIST_LQ: 0.002,
  SURF_DIST_HQ: 0.002,
  BOUND_R: 2.0,
} as const

/**
 * Sphere intersection test
 *
 * Returns entry and exit distances for ray-sphere intersection.
 *
 * @param ro - Ray origin
 * @param rd - Ray direction (normalized)
 * @param r - Sphere radius
 * @returns vec2(entry, exit) distances, or (-1, -1) if no intersection
 */
export const intersectSphere = Fn(([ro, rd, r]: [Vec3Node, Vec3Node, FloatNode]) => {
  // Solve: |ro + rd*t|^2 = r^2
  // t^2 + 2*dot(ro,rd)*t + dot(ro,ro) - r^2 = 0
  const b = ro.dot(rd)
  const c = ro.dot(ro).sub(r.mul(r))
  const h = b.mul(b).sub(c)

  // No intersection if discriminant is negative
  const noHit = h.lessThan(0)

  // CRITICAL FIX: Clamp discriminant to 0 to prevent NaN from sqrt(negative)
  // In WebGL, early return prevents sqrt on negative values.
  // In TSL, all branches are evaluated, so we must ensure sqrt input is non-negative.
  // When h < 0, sqrtH = 0, and the select below returns -1 anyway.
  const sqrtH = max(h, float(0)).sqrt()
  const t1 = b.negate().sub(sqrtH)
  const t2 = b.negate().add(sqrtH)

  // Return (-1, -1) for no hit, otherwise (entry, exit)
  return vec2(
    noHit.select(float(-1), t1),
    noHit.select(float(-1), t2)
  )
})

/**
 * Create a raymarching core function
 *
 * This is the main raymarching loop using relaxed sphere tracing.
 * Supports quality interpolation and overrelaxation for efficiency.
 *
 * @param sdfWithTrap - SDF function that returns both distance and trap value
 * @param qualityUniforms - Quality control uniforms
 * @returns Raymarching function
 */
export const createRaymarchCore = (
  sdfWithTrap: SDFWithTrapFunc,
  qualityUniforms: RaymarchQualityUniforms
) => {
  /**
   * Core raymarching loop
   *
   * @param ro - Ray origin
   * @param rd - Ray direction (normalized)
   * @param startDist - Starting distance along ray
   * @param maxT - Maximum distance to march
   * @returns vec4(hitDistance, trap, hitFlag, iterations) where hitFlag=1 means hit, 0 means miss
   */
  return Fn(([ro, rd, startDist, maxT]: [Vec3Node, Vec3Node, FloatNode, FloatNode]) => {
    // Use unnamed toVar() to let TSL auto-generate unique names
    // This avoids naming conflicts if this Fn is inlined multiple times
    const dO = float(startDist).toVar()
    const trap = float(0).toVar()
    const hit = float(0).toVar()
    // WebGL: g_raymarchIterations - track iterations for debug heatmap
    const iterations = float(0).toVar()

    // Calculate march steps and surface distance based on performance mode and quality multiplier
    // WebGL: Fast mode uses LQ settings immediately
    // WebGL: Normal mode interpolates between LQ and HQ based on quality multiplier (0.25-1.0)
    const maxSteps = int(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_HQ).toVar()
    const surfDist = float(qualityUniforms.uSdfSurfaceDistance).toVar()
    const omega = float(1.2).toVar()

    // WebGL: float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
    // Progressive refinement: interpolate based on quality multiplier
    const t = clamp(
      qualityUniforms.uQualityMultiplier.sub(0.25).div(0.75),
      float(0),
      float(1)
    )

    // Fast mode uses low quality settings, otherwise interpolate
    const isFast = qualityUniforms.uFastMode

    // WebGL: maxSteps = int(mix(float(MAX_MARCH_STEPS_LQ), float(MAX_MARCH_STEPS_HQ), t));
    const interpolatedMaxSteps = int(mix(
      float(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_LQ),
      float(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_HQ),
      t
    ))
    maxSteps.assign(isFast.select(
      int(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_LQ),
      interpolatedMaxSteps
    ))

    // WebGL: omega = mix(1.0, 1.2, t); // Gradually enable overrelaxation as quality increases
    // No overrelaxation in fast mode (already fast)
    const interpolatedOmega = mix(float(1.0), float(1.2), t)
    omega.assign(isFast.select(float(1.0), interpolatedOmega))

    // Relaxed sphere tracing with overrelaxation
    const prevDist = float(1e10).toVar('prevDist')

    // Main raymarching loop - use simple count-based loop
    Loop(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_HQ, ({ i }) => {
      // Early exit if past max steps
      If(i.greaterThanEqual(maxSteps), () => {
        Break()
      })

      // WebGL: g_raymarchIterations = i + 1;
      iterations.assign(float(i).add(1))

      const p = ro.add(rd.mul(dO))
      const result = sdfWithTrap(p)
      const dS = result.dist

      // Hit detection
      If(dS.lessThan(surfDist), () => {
        trap.assign(result.trap)
        hit.assign(1)
        Break()
      })

      // Relaxed sphere tracing: take larger steps when safe
      const step = dS.mul(omega).toVar('step')

      // Safety check: if step would be larger than previous distance,
      // we might have overstepped - use conservative step instead
      If(step.greaterThan(prevDist.add(dS)), () => {
        step.assign(dS)
      })

      // Update distance (use assign instead of addAssign)
      dO.assign(dO.add(step))
      prevDist.assign(dS)

      // Exit if past max distance
      If(dO.greaterThan(maxT), () => {
        Break()
      })
    })

    // Return: x=distance, y=trap, z=hit flag, w=iterations
    // WebGL stores iterations in g_raymarchIterations global; TSL returns in result
    return vec4(dO, trap, hit, iterations)
  })
}

/**
 * Create full raymarching function with sphere bounds check
 *
 * @param sdfWithTrap - SDF function
 * @param qualityUniforms - Quality uniforms
 * @param boundRadius - Bounding sphere radius
 * @returns Full raymarching function returning vec4(dist, trap, hit, iterations)
 */
export const createRaymarch = (
  sdfWithTrap: SDFWithTrapFunc,
  qualityUniforms: RaymarchQualityUniforms,
  boundRadius: number = RAYMARCH_CONSTANTS.BOUND_R
) => {
  const raymarchCore = createRaymarchCore(sdfWithTrap, qualityUniforms)

  return Fn(([ro, rd]: [Vec3Node, Vec3Node]) => {
    const camDist = ro.length()
    const maxDist = camDist.add(boundRadius * 2 + 1)

    // Bounding sphere intersection
    const tSphere = intersectSphere(ro, rd, float(boundRadius))

    // Check for miss (exit < 0)
    // Miss result: large distance, 0 trap, 0 hit, 0 iterations
    const missResult = vec4(maxDist.add(1), float(0), float(0), float(0))
    const doRaymarch = tSphere.y.greaterThanEqual(0)

    const startDist = max(float(0), tSphere.x)
    const endDist = min(tSphere.y, maxDist)

    const result = doRaymarch.select(
      raymarchCore(ro, rd, startDist, endDist),
      missResult
    )

    return result
  })
}

/**
 * Create raymarching function with temporal reprojection support.
 *
 * This is the TSL equivalent of WebGL RayMarch() with #ifdef USE_TEMPORAL.
 * Uses previous frame's position data to skip empty space.
 *
 * WebGL equivalent (from core.glsl.ts):
 * ```glsl
 * float RayMarch(vec3 ro, vec3 rd, vec3 worldRayDir, out float trap, out bool usedTemporal) {
 *     // ... sphere intersection ...
 *     #ifdef USE_TEMPORAL
 *     float temporalDepth = getTemporalDepth(ro, rd, worldRayDir);
 *     if (temporalDepth > 0.0 && temporalDepth < maxT) {
 *         dO = max(dO, temporalDepth * uTemporalSafetyMargin);
 *         usedTemporal = true;
 *     }
 *     #endif
 *     return RayMarchCore(ro, rd, dO, maxT, maxDist, trap);
 * }
 * ```
 *
 * @param sdfWithTrap - SDF function
 * @param qualityUniforms - Quality uniforms
 * @param temporalUniforms - Temporal reprojection uniforms
 * @param boundRadius - Bounding sphere radius
 * @returns Full raymarching function returning vec4(dist, trap, hit, iterations)
 */
export const createRaymarchWithTemporal = (
  sdfWithTrap: SDFWithTrapFunc,
  qualityUniforms: RaymarchQualityUniforms,
  temporalUniforms: TemporalUniforms,
  boundRadius: number = RAYMARCH_CONSTANTS.BOUND_R
) => {
  const raymarchCore = createRaymarchCore(sdfWithTrap, qualityUniforms)
  const applyTemporalHint = createApplyTemporalHint(temporalUniforms)

  return Fn(([ro, rd]: [Vec3Node, Vec3Node]) => {
    const camDist = ro.length()
    const maxDist = camDist.add(boundRadius * 2 + 1)

    // Bounding sphere intersection
    const tSphere = intersectSphere(ro, rd, float(boundRadius))

    // Check for miss (exit < 0)
    // Miss result: large distance, 0 trap, 0 hit, 0 iterations
    const missResult = vec4(maxDist.add(1), float(0), float(0), float(0))
    const doRaymarch = tSphere.y.greaterThanEqual(0)

    // Base start distance from sphere intersection
    const sphereEntry = max(float(0), tSphere.x)
    const endDist = min(tSphere.y, maxDist)

    // Apply temporal hint to potentially skip empty space
    // WebGL: dO = max(dO, temporalDepth * uTemporalSafetyMargin);
    const temporalResult = applyTemporalHint(ro, rd, sphereEntry, endDist)
    const startDist = temporalResult.x  // Potentially advanced by temporal hint
    // temporalResult.y = usedTemporal flag (not currently used in output, could be added)

    const result = doRaymarch.select(
      raymarchCore(ro, rd, startDist, endDist),
      missResult
    )

    return result
  })
}

// Re-export TemporalUniforms type for convenience
export type { TemporalUniforms }
