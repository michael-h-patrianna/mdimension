/**
 * TSL Ambient Occlusion Feature Block
 *
 * Raymarched ambient occlusion for fractals.
 * Exact port of WebGL ao.glsl.ts calcAO() function.
 *
 * WebGL Reference:
 * ```glsl
 * float calcAO(vec3 p, vec3 n) {
 *     float occ = 0.0;
 *     occ += (0.02 - GetDist(p + 0.02 * n));
 *     occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
 *     occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
 *     return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
 * }
 * ```
 *
 * @module rendering/tsl/compose/feature-blocks/ao
 */

import {
  float,
  Fn,
  clamp,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = Node

/**
 * Uniforms for AO calculation.
 */
export interface AOUniforms {
  /** AO enabled flag */
  uAoEnabled: UniformNode<boolean>
  /** AO intensity (0-1) - optional, defaults to 1.0 */
  uAoIntensity?: UniformNode<number>
}

/**
 * Create a raymarched ambient occlusion TSL node.
 *
 * EXACT PORT of WebGL calcAO():
 * - 3 fixed samples at distances 0.02, 0.08, 0.16
 * - Fixed weights: 1.0, 0.7, 0.5
 * - Final: clamp(1.0 - 2.5 * occ, 0.0, 1.0)
 *
 * @param getDistFn - SDF distance function (GetDist equivalent)
 * @param _uniforms - AO uniforms (uAoIntensity applied by caller)
 * @returns TSL Fn that computes AO factor (0=fully occluded, 1=no occlusion)
 */
export const createAONode = (
  getDistFn: (pos: Vec3Node) => FloatNode,
  _uniforms: AOUniforms
) => {
  /**
   * Compute ambient occlusion at a surface point.
   * Exact port of WebGL calcAO(vec3 p, vec3 n).
   *
   * @param pos - Surface position (p)
   * @param normal - Surface normal (n)
   * @returns AO factor 0-1
   */
  return Fn(([pos, normal]: [Vec3Node, Vec3Node]) => {
    // WebGL: float occ = 0.0;
    const occ = float(0).toVar('occ')

    // WebGL: occ += (0.02 - GetDist(p + 0.02 * n));
    // Sample 1: distance 0.02, weight 1.0
    const samplePos1 = pos.add(normal.mul(0.02))
    const dist1 = getDistFn(samplePos1)
    occ.addAssign(float(0.02).sub(dist1))

    // WebGL: occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
    // Sample 2: distance 0.08, weight 0.7
    const samplePos2 = pos.add(normal.mul(0.08))
    const dist2 = getDistFn(samplePos2)
    occ.addAssign(float(0.08).sub(dist2).mul(0.7))

    // WebGL: occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
    // Sample 3: distance 0.16, weight 0.5
    const samplePos3 = pos.add(normal.mul(0.16))
    const dist3 = getDistFn(samplePos3)
    occ.addAssign(float(0.16).sub(dist3).mul(0.5))

    // WebGL: return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
    return clamp(float(1).sub(occ.mul(2.5)), float(0), float(1))
  })
}
