/**
 * TSL Fresnel Feature Block
 *
 * Fresnel rim lighting for raymarched fractals.
 * Exact port of WebGL main.glsl.ts fresnel code.
 *
 * WebGL Reference:
 * ```glsl
 * if (uFresnelEnabled && uFresnelIntensity > 0.0) {
 *     float NdotV = max(dot(n, viewDir), 0.0);
 *     float t = 1.0 - NdotV;
 *     float rim = t * t * t * uFresnelIntensity * 2.0;
 *     rim *= (0.3 + 0.7 * totalNdotL);
 *     col += uRimColor * rim;
 * }
 * ```
 *
 * @module rendering/tsl/compose/feature-blocks/fresnel
 */

import {
  float,
  Fn,
  vec3,
  dot,
  max,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import type * as THREE from 'three'

// Type aliases
type Vec3Node = Node
type FloatNode = Node

/**
 * Uniforms for fresnel calculation.
 * Matches WebGL uniforms.
 */
export interface FresnelUniforms {
  /** Fresnel enabled */
  uFresnelEnabled: UniformNode<boolean>
  /** Fresnel intensity (0-2) */
  uFresnelIntensity: UniformNode<number>
  /** Rim color */
  uRimColor: UniformNode<THREE.Color>
}

/**
 * Create a fresnel rim lighting TSL node.
 *
 * EXACT PORT of WebGL fresnel:
 * - Uses pow(3) falloff (t * t * t), NOT pow(5)
 * - Multiplies by intensity * 2.0
 * - Light-influenced: 0.3 + 0.7 * totalNdotL
 *
 * @param uniforms - Fresnel uniforms
 * @returns TSL Fn that computes fresnel rim contribution (vec3 color)
 */
export const createFresnelNode = (uniforms: FresnelUniforms) => {
  /**
   * Compute fresnel rim lighting at a surface point.
   * Exact port of WebGL fresnel calculation.
   *
   * @param normal - Surface normal
   * @param viewDir - View direction (from surface to camera)
   * @param totalNdotL - Total light contribution for light-influenced rim
   * @returns Fresnel rim color contribution
   */
  return Fn(([normal, viewDir, totalNdotL]: [Vec3Node, Vec3Node, FloatNode]) => {
    // WebGL: float NdotV = max(dot(n, viewDir), 0.0);
    const NdotV = max(dot(normal, viewDir), float(0))

    // WebGL: float t = 1.0 - NdotV;
    const t = float(1).sub(NdotV)

    // WebGL: float rim = t * t * t * uFresnelIntensity * 2.0;
    // NOTE: pow(3), NOT pow(5) - this matches WebGL exactly
    const rim = t.mul(t).mul(t).mul(uniforms.uFresnelIntensity).mul(2.0)

    // WebGL: rim *= (0.3 + 0.7 * totalNdotL);
    // Light-influenced rim: 30% base + 70% light-influenced
    const rimFactor = float(0.3).add(float(0.7).mul(totalNdotL))
    const rimWithFactor = rim.mul(rimFactor)

    // WebGL: col += uRimColor * rim;
    const rimColor = vec3(uniforms.uRimColor)
    return rimColor.mul(rimWithFactor)
  })
}
