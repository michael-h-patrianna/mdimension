/**
 * TSL Quaternion Operations for Julia Sets
 *
 * Quaternion math operations in TSL for Julia set iteration.
 * Includes fast paths for common integer powers (2-8) to avoid
 * expensive transcendental functions.
 *
 * @module rendering/tsl/raymarching/julia/quaternion
 */

import {
  abs,
  acos,
  clamp,
  cos,
  exp,
  float,
  Fn,
  If,
  log,
  max,
  sin,
  sqrt,
  vec4,
} from 'three/tsl'

import type { Node } from 'three/tsl'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec4Node = ReturnType<typeof vec4>

// EPS must match WebGL constants.glsl.ts for parity
const EPS = 1e-6

/**
 * Quaternion multiplication: q1 * q2
 *
 * @param q1 - First quaternion (x, y, z, w = scalar, i, j, k)
 * @param q2 - Second quaternion
 * @returns Product quaternion q1 * q2
 */
export const quatMul = Fn(([q1, q2]: [Vec4Node, Vec4Node]) => {
  const q1x = q1.x
  const q1y = q1.y
  const q1z = q1.z
  const q1w = q1.w
  const q2x = q2.x
  const q2y = q2.y
  const q2z = q2.z
  const q2w = q2.w

  return vec4(
    q1x.mul(q2x).sub(q1y.mul(q2y)).sub(q1z.mul(q2z)).sub(q1w.mul(q2w)),
    q1x.mul(q2y).add(q1y.mul(q2x)).add(q1z.mul(q2w)).sub(q1w.mul(q2z)),
    q1x.mul(q2z).sub(q1y.mul(q2w)).add(q1z.mul(q2x)).add(q1w.mul(q2y)),
    q1x.mul(q2w).add(q1y.mul(q2z)).sub(q1z.mul(q2y)).add(q1w.mul(q2x))
  )
})

/**
 * Quaternion squared: q * q
 *
 * Optimized implementation avoiding full multiplication.
 * Saves ~8 multiplications compared to quatMul(q, q).
 *
 * @param q - Quaternion to square
 * @returns Squared quaternion q^2
 */
export const quatSqr = Fn(([q]: [Vec4Node]) => {
  const xx = q.x.mul(q.x)
  const yy = q.y.mul(q.y)
  const zz = q.z.mul(q.z)
  const ww = q.w.mul(q.w)

  return vec4(
    xx.sub(yy).sub(zz).sub(ww),
    q.x.mul(q.y).mul(2),
    q.x.mul(q.z).mul(2),
    q.x.mul(q.w).mul(2)
  )
})

/**
 * Quaternion cubed: q^3 = q^2 * q
 *
 * @param q - Quaternion to cube
 * @returns Cubed quaternion q^3
 */
export const quatCube = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  return quatMul(q2, q)
})

/**
 * Quaternion to 4th power: q^4 = (q^2)^2
 *
 * @param q - Quaternion
 * @returns q^4
 */
export const quatPow4 = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  return quatSqr(q2)
})

/**
 * Quaternion to 5th power: q^5 = q^4 * q
 *
 * @param q - Quaternion
 * @returns q^5
 */
export const quatPow5 = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  const q4 = quatSqr(q2)
  return quatMul(q4, q)
})

/**
 * Quaternion to 6th power: q^6 = q^4 * q^2
 *
 * @param q - Quaternion
 * @returns q^6
 */
export const quatPow6 = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  const q4 = quatSqr(q2)
  return quatMul(q4, q2)
})

/**
 * Quaternion to 7th power: q^7 = q^6 * q
 *
 * @param q - Quaternion
 * @returns q^7
 */
export const quatPow7 = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  const q4 = quatSqr(q2)
  const q6 = quatMul(q4, q2)
  return quatMul(q6, q)
})

/**
 * Quaternion to 8th power: q^8 = ((q^2)^2)^2
 *
 * The classic Mandelbulb power, optimal with only 3 squarings.
 *
 * @param q - Quaternion
 * @returns q^8
 */
export const quatPow8 = Fn(([q]: [Vec4Node]) => {
  const q2 = quatSqr(q)
  const q4 = quatSqr(q2)
  return quatSqr(q4)
})

/**
 * General quaternion power using hyperspherical coordinates.
 *
 * For generalized power n (including non-integer).
 * Uses q = r * (cos(theta) + sin(theta) * v_hat) form.
 * q^n = r^n * (cos(n*theta) + sin(n*theta) * v_hat)
 *
 * Note: For integer powers 2-8, use the optimized fast paths above
 * via quatPowFast() which avoids expensive transcendental functions.
 *
 * @param q - Quaternion
 * @param n - Power
 * @returns q^n
 */
export const quatPowGeneral = Fn(([q, n]: [Vec4Node, FloatNode]) => {
  // Calculate radius
  const r = sqrt(q.x.mul(q.x).add(q.y.mul(q.y)).add(q.z.mul(q.z)).add(q.w.mul(q.w)))

  // Handle near-zero case
  const result = vec4(0, 0, 0, 0).toVar('quatPowResult')

  If(r.greaterThan(EPS), () => {
    // Vector part length
    const vLen = sqrt(q.y.mul(q.y).add(q.z.mul(q.z)).add(q.w.mul(q.w)))

    const isPureScalar = vLen.lessThan(EPS)

    // CRITICAL: Guard vLen BEFORE division due to GPU branch evaluation.
    // TSL If() evaluates ALL branches, so division by vLen happens even
    // when isPureScalar is true. See docs/tsl.md "GPU Branch Evaluation".
    const safeVLen = max(vLen, float(EPS))
    
    // Pure scalar quaternion: q^n = r^n * sign(q.x)
    If(isPureScalar, () => {
      const logR = log(r)
      const rn = exp(n.mul(logR))
      const sign = q.x.greaterThanEqual(0).select(float(1), float(-1))
      result.assign(vec4(rn.mul(sign), float(0), float(0), float(0)))
    })
    
    // General case: convert to hyperspherical
    If(isPureScalar.not(), () => {
      const theta = acos(clamp(q.x.div(r), float(-1), float(1)))
      const vHatX = q.y.div(safeVLen)
      const vHatY = q.z.div(safeVLen)
      const vHatZ = q.w.div(safeVLen)

      // Apply power: q^n = r^n * (cos(n*theta) + sin(n*theta) * v_hat)
      const logR = log(r)
      const rn = exp(n.mul(logR))
      const nTheta = n.mul(theta)
      const cosNT = cos(nTheta)
      const sinNT = sin(nTheta)

      result.assign(vec4(
        rn.mul(cosNT),
        rn.mul(sinNT).mul(vHatX),
        rn.mul(sinNT).mul(vHatY),
        rn.mul(sinNT).mul(vHatZ)
      ))
    })
  })

  return result
})

/**
 * Quaternion power with fast paths for integer powers.
 *
 * For powers 2-8, uses optimized implementations that avoid
 * expensive transcendental functions (acos, cos, sin, pow).
 * Falls back to general implementation for other powers.
 *
 * NOTE: WebGL uses a simple if-return chain:
 * ```glsl
 * if (abs(n - 2.0) < 0.01) { return quatSqr(q); }
 * if (abs(n - 3.0) < 0.01) { return quatMul(quatSqr(q), q); }
 * ...
 * ```
 * TSL cannot use early returns from If blocks, so we use a "handled flag"
 * pattern that achieves the same effect. The generated shader code is
 * functionally equivalent to WebGL.
 *
 * PERF: Powers 2-8 use only quaternion multiplications,
 * saving ~20 ALU operations per call.
 *
 * @param q - Quaternion
 * @param n - Power (should be >= 2)
 * @returns q^n
 */
export const quatPowFast = Fn(([q, n]: [Vec4Node, Node]) => {
  // NOTE: TSL doesn't support early return from If blocks like GLSL.
  // We use a "handled" flag pattern to simulate the WebGL if-return chain.
  // This generates equivalent shader code.

  const result = vec4(0, 0, 0, 0).toVar('quatPowFastResult')
  const nFloat = float(n)
  const handled = float(0).toVar('handled')

  // Check for common integer powers using abs difference
  // Using sequential If statements with a "handled" flag pattern
  
  // Power 2 (most common)
  const is2 = abs(nFloat.sub(2)).lessThan(0.01)
  If(is2, () => {
    result.assign(quatSqr(q))
    handled.assign(1)
  })
  
  // Power 3
  const is3 = abs(nFloat.sub(3)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is3, () => {
    result.assign(quatCube(q))
    handled.assign(1)
  })
  
  // Power 4
  const is4 = abs(nFloat.sub(4)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is4, () => {
    result.assign(quatPow4(q))
    handled.assign(1)
  })
  
  // Power 5
  const is5 = abs(nFloat.sub(5)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is5, () => {
    result.assign(quatPow5(q))
    handled.assign(1)
  })
  
  // Power 6
  const is6 = abs(nFloat.sub(6)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is6, () => {
    result.assign(quatPow6(q))
    handled.assign(1)
  })
  
  // Power 7
  const is7 = abs(nFloat.sub(7)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is7, () => {
    result.assign(quatPow7(q))
    handled.assign(1)
  })
  
  // Power 8
  const is8 = abs(nFloat.sub(8)).lessThan(0.01).and(handled.lessThan(0.5))
  If(is8, () => {
    result.assign(quatPow8(q))
    handled.assign(1)
  })
  
  // General case for other powers
  If(handled.lessThan(0.5), () => {
    result.assign(quatPowGeneral(q, nFloat))
  })

  return result
})

/**
 * Quaternion length (4D norm).
 *
 * @param q - Quaternion
 * @returns Length of quaternion
 */
export const quatLength = Fn(([q]: [Vec4Node]) => {
  return sqrt(q.x.mul(q.x).add(q.y.mul(q.y)).add(q.z.mul(q.z)).add(q.w.mul(q.w)))
})

/**
 * Quaternion conjugate.
 *
 * @param q - Quaternion
 * @returns Conjugate q* = (x, -y, -z, -w)
 */
export const quatConjugate = Fn(([q]: [Vec4Node]) => {
  return vec4(q.x, q.y.negate(), q.z.negate(), q.w.negate())
})

/**
 * Quaternion inverse: q^(-1) = q* / |q|^2
 *
 * @param q - Quaternion
 * @returns Inverse quaternion
 */
export const quatInverse = Fn(([q]: [Vec4Node]) => {
  const norm2 = q.x.mul(q.x).add(q.y.mul(q.y)).add(q.z.mul(q.z)).add(q.w.mul(q.w))
  const normInv = float(1).div(max(norm2, float(EPS)))

  return vec4(
    q.x.mul(normInv),
    q.y.negate().mul(normInv),
    q.z.negate().mul(normInv),
    q.w.negate().mul(normInv)
  )
})

