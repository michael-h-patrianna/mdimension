/**
 * TSL Subsurface Scattering Feature Block
 *
 * Exact port of WebGL sss.glsl.ts computeSSS() function.
 *
 * WebGL Reference:
 * ```glsl
 * float sssHash(vec2 p) {
 *     return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
 * }
 *
 * vec3 computeSSS(vec3 lightDir, vec3 viewDir, vec3 normal, float distortion,
 *                 float power, float thickness, float jitter, vec2 fragCoord) {
 *     float noise = sssHash(fragCoord * 0.1) * 2.0 - 1.0;
 *     float jitteredDistortion = distortion * (1.0 + noise * jitter);
 *     vec3 halfSum = lightDir + normal * jitteredDistortion;
 *     float halfLen = length(halfSum);
 *     vec3 halfVec = halfLen > 0.0001 ? halfSum / halfLen : vec3(0.0, 1.0, 0.0);
 *     float dotVal = clamp(dot(viewDir, -halfVec), 0.0, 1.0);
 *     float safePower = max(power, 0.001);
 *     float trans = pow(max(dotVal, 0.0001), safePower);
 *     return vec3(trans) * exp(-thickness);
 * }
 * ```
 *
 * @module rendering/tsl/compose/feature-blocks/sss
 */

import {
  dot,
  exp,
  float,
  fract,
  Fn,
  If,
  length,
  max,
  clamp,
  pow,
  sin,
  vec2,
  vec3,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import type * as THREE from 'three'

// Type aliases
type Vec3Node = Node
type Vec2Node = Node

/**
 * Uniforms for SSS calculation.
 * Matches WebGL uniforms used in main.glsl.ts.
 */
export interface SSSUniforms {
  /** SSS enabled */
  uSssEnabled: UniformNode<boolean>
  /** SSS intensity (0-1) */
  uSssIntensity: UniformNode<number>
  /** SSS color tint */
  uSssColor: UniformNode<THREE.Color>
  /** SSS thickness/penetration depth (used as power multiplier: power = thickness * 4) */
  uSssThickness: UniformNode<number>
  /** SSS jitter for screen-space noise (0-1) */
  uSssJitter: UniformNode<number>
}

/**
 * Simple hash for screen-space noise (SSS jitter).
 * Exact port of WebGL sssHash().
 *
 * @param p - 2D coordinate (typically fragCoord * 0.1)
 * @returns Pseudo-random value 0-1
 */
export const sssHash = Fn(([p]: [Vec2Node]) => {
  // WebGL: return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  const dotProduct = dot(p, vec2(127.1, 311.7))
  return fract(sin(dotProduct).mul(43758.5453))
})

/**
 * Create a subsurface scattering TSL node.
 *
 * EXACT PORT of WebGL computeSSS():
 * - Uses screen-space jitter noise
 * - Distortion-based wrap lighting
 * - Power-based transmittance
 * - Thickness attenuation via exp(-thickness)
 *
 * @param uniforms - SSS uniforms
 * @returns TSL Fn that computes SSS contribution (vec3 color)
 */
export const createSSSNode = (uniforms: SSSUniforms) => {
  /**
   * Compute SSS contribution at a surface point.
   * Exact port of WebGL computeSSS().
   *
   * @param normal - Surface normal
   * @param viewDir - View direction (from surface to camera)
   * @param lightDir - Light direction (from surface to light)
   * @param lightColor - Light color
   * @param fragCoord - Fragment coordinates (gl_FragCoord.xy equivalent)
   * @returns SSS color contribution (to be multiplied by intensity and attenuation by caller)
   */
  return Fn((
    [normal, viewDir, lightDir, lightColor, fragCoord]: [Vec3Node, Vec3Node, Vec3Node, Vec3Node, Vec2Node]
  ) => {
    // WebGL uses hardcoded distortion = 0.5
    const distortion = float(0.5)
    // WebGL: power = uSssThickness * 4.0
    const power = uniforms.uSssThickness.mul(4.0)
    // WebGL uses hardcoded thickness = 0.0
    const thickness = float(0.0)
    // Jitter from uniform
    const jitter = uniforms.uSssJitter

    // WebGL: float noise = sssHash(fragCoord * 0.1) * 2.0 - 1.0; // -1 to 1
    const noise = sssHash(fragCoord.mul(0.1)).mul(2.0).sub(1.0)

    // WebGL: float jitteredDistortion = distortion * (1.0 + noise * jitter);
    const jitteredDistortion = distortion.mul(float(1.0).add(noise.mul(jitter)))

    // WebGL: vec3 halfSum = lightDir + normal * jitteredDistortion;
    const halfSum = lightDir.add(normal.mul(jitteredDistortion))

    // WebGL: float halfLen = length(halfSum);
    const halfLen = length(halfSum)

    // WebGL: vec3 halfVec = halfLen > 0.0001 ? halfSum / halfLen : vec3(0.0, 1.0, 0.0);
    const halfVec = vec3(0, 1, 0).toVar('halfVec')
    // CRITICAL: Guard division against near-zero values. In TSL, all branches are evaluated,
    // so halfSum.div(halfLen) is computed even when condition is false. Must clamp to avoid NaN/Inf.
    const safeHalfLen = max(halfLen, float(0.0001))
    If(halfLen.greaterThan(0.0001), () => {
      halfVec.assign(halfSum.div(safeHalfLen))
    })

    // WebGL: float dotVal = clamp(dot(viewDir, -halfVec), 0.0, 1.0);
    const dotVal = clamp(dot(viewDir, halfVec.negate()), float(0), float(1))

    // WebGL: float safePower = max(power, 0.001);
    const safePower = max(power, float(0.001))

    // WebGL: float trans = pow(max(dotVal, 0.0001), safePower);
    const trans = pow(max(dotVal, float(0.0001)), safePower)

    // WebGL: return vec3(trans) * exp(-thickness);
    const sssBase = vec3(trans, trans, trans).mul(exp(thickness.negate()))

    // WebGL caller does: sss * uSssColor * uLightColors[i] * uSssIntensity * attenuation
    // We return the base SSS, caller multiplies by lightColor and attenuation
    // But we include sssColor and intensity here to match the compose pattern
    const sssColor = vec3(uniforms.uSssColor)
    return sssBase.mul(sssColor).mul(lightColor).mul(uniforms.uSssIntensity)
  })
}

// NOTE: createSSSNodeSimple was removed during WebGL parity work.
// It was NOT in WebGL - WebGL computeSSS always takes fragCoord.
// Use createSSSNode with fragCoord parameter instead.
