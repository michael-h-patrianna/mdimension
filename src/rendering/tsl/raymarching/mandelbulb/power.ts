/**
 * TSL Power Functions for Mandelbulb
 *
 * Optimized power calculation with fast path for power=8.
 * Direct port of WebGL power.glsl.ts
 *
 * @module rendering/tsl/raymarching/mandelbulb/power
 */

import {
  abs,
  float,
  Fn,
  If,
  max,
  mix,
  pow,
  vec3,
} from 'three/tsl'

import type { UniformNode, Node } from 'three/tsl'

import { EPS } from './types'

// Type alias
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

/**
 * Uniforms for power calculation.
 * Matches WebGL uniforms in uniforms.glsl.ts
 */
export interface PowerUniforms {
  uPower: UniformNode<number>
  uPowerAnimationEnabled: UniformNode<boolean>
  uAnimatedPower: UniformNode<number>
  uAlternatePowerEnabled: UniformNode<boolean>
  uAlternatePowerValue: UniformNode<number>
  uAlternatePowerBlend: UniformNode<number>
}

/**
 * Get effective power value considering animation and alternate power blending.
 *
 * Exact port of WebGL getEffectivePower():
 * ```glsl
 * float getEffectivePower() {
 *     float basePower = uPowerAnimationEnabled ? uAnimatedPower : uPower;
 *     if (uAlternatePowerEnabled) {
 *         basePower = mix(basePower, uAlternatePowerValue, uAlternatePowerBlend);
 *     }
 *     return max(basePower, 2.0);
 * }
 * ```
 *
 * @param uniforms - Power uniforms
 * @returns Effective power value (FloatNode)
 */
export const getEffectivePower = (uniforms: PowerUniforms): Node => {
  // Start with base power (possibly animated)
  const basePower = uniforms.uPowerAnimationEnabled.select(
    uniforms.uAnimatedPower,
    uniforms.uPower
  )

  // Apply alternate power blending if enabled
  const blendedPower = uniforms.uAlternatePowerEnabled.select(
    mix(basePower, uniforms.uAlternatePowerValue, uniforms.uAlternatePowerBlend),
    basePower
  )

  // Clamp to minimum safe value
  return max(blendedPower, float(2))
}

/**
 * Fast integer power for power=8 (most common Mandelbulb value).
 * Uses only 4 multiplications instead of expensive pow().
 * Matches WebGL fastPow8() exactly.
 *
 * @param r - Radius value
 * @returns vec3(r^8, r^7, 0)
 */
export const fastPow8 = Fn(([r]: [FloatNode]) => {
  const r2 = r.mul(r)
  const r4 = r2.mul(r2)
  const rPowMinus1 = r4.mul(r2).mul(r) // r^7
  const rPow = r4.mul(r4)              // r^8
  return vec3(rPow, rPowMinus1, float(0))
})

/**
 * Optimized power calculation for Mandelbulb.
 * Fast path for power=8, generic pow() for others.
 *
 * Exact port of WebGL optimizedPow():
 * ```glsl
 * void optimizedPow(float r, float pwr, out float rPow, out float rPowMinus1) {
 *     if (pwr == 8.0) {
 *         fastPow8(r, rPow, rPowMinus1);
 *     } else {
 *         rPow = pow(r, pwr);
 *         rPowMinus1 = pow(max(r, EPS), pwr - 1.0);
 *     }
 * }
 * ```
 *
 * @param r - Radius value
 * @param n - Power exponent
 * @returns vec3(r^n, r^(n-1), 0)
 */
export const optimizedPow = Fn(([r, n]: [FloatNode, FloatNode]): Vec3Node => {
  // Fast path for power=8 (most common)
  const is8 = abs(n.sub(8)).lessThan(0.01)

  // Compute both paths (GPU evaluates all branches anyway)
  const fast8Result = fastPow8(r)
  // WebGL: rPow = pow(r, pwr); rPowMinus1 = pow(max(r, EPS), pwr - 1.0);
  const rn = pow(r, n)
  const rnm1 = pow(max(r, float(EPS)), n.sub(1))
  const genericResult = vec3(rn, rnm1, float(0))

  // Use select() instead of If/toVar/assign to avoid variable naming conflicts
  return is8.select(fast8Result, genericResult)
})
