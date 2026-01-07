/**
 * TSL Shadows Feature Block
 *
 * Soft shadow calculation for raymarched fractals.
 * Conditionally included when shadows are enabled.
 *
 * @module rendering/tsl/compose/feature-blocks/shadows
 */

import {
  float,
  Fn,
  If,
  int,
  Loop,
  max,
  min,
  clamp,
  mix,
  sqrt,
  Break,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

// Type aliases for TSL nodes
type FloatNode = ReturnType<typeof float>
type Vec3Node = Node

// Constants matching WebGL shadows.glsl.ts
const SHADOW_EPSILON = 0.001
const SHADOW_MINT = 0.02 // WebGL: calcSoftShadowQuality is called with mint=0.02
const SHADOW_MAX_STEPS = 32 // Ultra quality

/**
 * Uniforms required for shadow calculation.
 */
export interface ShadowUniforms {
  /** Shadow quality (0=off, 1=low, 2=med, 3=high) */
  uShadowQuality: UniformNode<number>
  /** Shadow softness (0-1, higher = softer) */
  uShadowSoftness: UniformNode<number>
  /** Fast mode flag - uses quality 0 when true */
  uFastMode?: UniformNode<boolean>
}

/**
 * Create a soft shadow calculation TSL node.
 *
 * Quality-aware soft shadow with variable sample count and improved penumbra.
 * Uses Inigo Quilez's improved soft shadow technique.
 * Direct port of WebGL shadows.glsl.ts calcSoftShadowQuality().
 *
 * WebGL signature: calcSoftShadowQuality(ro, rd, mint, maxt, softness, quality)
 * TSL takes maxt as parameter (WebGL uses 10.0 for directional, distance for point lights)
 *
 * quality: 0=low(8), 1=medium(16), 2=high(24), 3=ultra(32)
 * softness: 0.0-1.0 controls penumbra size (0=hard, 1=very soft)
 *
 * @param getDistFn - SDF distance function
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0=full shadow, 1=no shadow)
 */
export const createSoftShadowNode = (
  getDistFn: (pos: Vec3Node) => FloatNode,
  uniforms: ShadowUniforms
) => {
  return Fn(([ro, rd, maxt]: [Vec3Node, Vec3Node, FloatNode]) => {
    // Fast mode uses quality 0, otherwise use uShadowQuality
    // Matches WebGL: int effectiveQuality = uFastMode ? 0 : uShadowQuality;
    const effectiveQuality = uniforms.uFastMode
      ? uniforms.uFastMode.select(int(0), int(uniforms.uShadowQuality))
      : int(uniforms.uShadowQuality)

    // Sample counts based on quality level: 8 + quality * 8
    // quality 0 = 8 steps, quality 1 = 16, quality 2 = 24, quality 3 = 32
    const maxSteps = int(8).add(effectiveQuality.mul(8))

    // Use unnamed toVar() to let TSL auto-generate unique names
    // This avoids naming conflicts when this Fn is called multiple times (per-light)
    const res = float(1.0).toVar()
    // WebGL: float t = mint; where mint = 0.02
    const t = float(SHADOW_MINT).toVar()
    const ph = float(1e10).toVar()

    // Softness affects penumbra size (k parameter)
    // softness=0 -> k=64 (hard shadows), softness=2 -> k=4 (very soft)
    // Matches WebGL: float k = mix(64.0, 4.0, softness * 0.5);
    const k = mix(float(64), float(4), uniforms.uShadowSoftness.mul(0.5))

    // Unrolled loop with max 32 iterations (ultra quality)
    Loop(SHADOW_MAX_STEPS, ({ i }) => {
      // Break if exceeded max steps for current quality level
      // WebGL: if (i >= maxSteps || t > maxt) break;
      If(int(i).greaterThanEqual(maxSteps).or(t.greaterThan(maxt)), () => {
        Break()
      })

      const p = ro.add(rd.mul(t))
      const h = getDistFn(p)

      // Hit surface - full shadow
      If(h.lessThan(float(SHADOW_EPSILON)), () => {
        res.assign(float(0))
        Break()
      })

      // Improved soft shadow technique (Inigo Quilez)
      // y represents the perpendicular distance to the occluder
      // Clamp y to [0, h] to ensure h*h - y*y >= 0 (valid for sqrt)
      const y = min(h.mul(h).div(float(2.0).mul(ph)), h)
      // Double guard: clamp y above + max here for floating-point safety
      const d = sqrt(max(float(0), h.mul(h).sub(y.mul(y))))
      res.assign(min(res, k.mul(d).div(max(float(0.0001), t.sub(y)))))
      ph.assign(h)

      // March forward
      t.assign(t.add(clamp(h, float(0.02), float(0.25))))
    })

    return clamp(res, float(0), float(1))
  })
}

// NOTE: createHardShadowNode was removed during WebGL parity work.
// It was NOT in WebGL - WebGL only has calcSoftShadowQuality().
// Use createSoftShadowNode with quality=0 for equivalent low-quality shadows.
