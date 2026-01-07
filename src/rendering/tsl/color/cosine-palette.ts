/**
 * TSL Cosine Gradient Palette Functions
 *
 * 100% port of WebGL cosine-palette.glsl.ts
 * Based on Inigo Quilez's technique: a + b * cos(2π(c*t + d))
 *
 * @module rendering/tsl/color/cosine-palette
 */

import { clamp, cos, float, Fn, fract, max, pow, vec3 } from 'three/tsl'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

const TWO_PI = 6.28318

/**
 * Cosine palette color generation
 * Exact port of WebGL cosinePalette()
 *
 * @param t - Normalized parameter [0, 1]
 * @param a - Base color offset
 * @param b - Color amplitude
 * @param c - Color frequency
 * @param d - Color phase
 * @returns Palette color as vec3
 */
export const cosinePalette = Fn(
  ([t, a, b, c, d]: [FloatNode, Vec3Node, Vec3Node, Vec3Node, Vec3Node]) => {
    // a + b * cos(2π(c*t + d))
    const phase = c.mul(t).add(d).mul(TWO_PI)
    return a.add(b.mul(vec3(cos(phase.x), cos(phase.y), cos(phase.z))))
  }
)

/**
 * Apply distribution curve to parameter
 * Exact port of WebGL applyDistribution()
 *
 * @param t - Input parameter [0, 1]
 * @param power - Power curve exponent
 * @param cycles - Number of cycles
 * @param offset - Phase offset
 * @returns Distributed parameter [0, 1]
 */
export const applyDistribution = Fn(
  ([t, power, cycles, offset]: [FloatNode, FloatNode, FloatNode, FloatNode]) => {
    const clamped = clamp(t, float(0), float(1))

    // Guard pow() - ensure base > 0 when power could be negative
    // and ensure power >= small value to avoid pow(x, 0) edge cases
    const safePower = max(power, float(0.001))
    const safeBase = max(clamped, float(0.0001))

    const curved = pow(safeBase, safePower)
    const cycled = fract(curved.mul(cycles).add(offset))

    return cycled
  }
)

/**
 * Get cosine palette color with distribution applied
 * Exact port of WebGL getCosinePaletteColor()
 *
 * @param t - Normalized parameter [0, 1]
 * @param a - Base color offset
 * @param b - Color amplitude
 * @param c - Color frequency
 * @param d - Color phase
 * @param power - Distribution power
 * @param cycles - Distribution cycles
 * @param offset - Distribution offset
 * @returns Palette color as vec3
 */
export const getCosinePaletteColor = Fn(
  ([t, a, b, c, d, power, cycles, offset]: [
    FloatNode,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode
  ]) => {
    const distributedT = applyDistribution(t, power, cycles, offset)
    return cosinePalette(distributedT, a, b, c, d)
  }
)
