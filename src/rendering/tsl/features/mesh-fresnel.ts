/**
 * TSL Mesh Fresnel Feature
 *
 * Fresnel rim lighting for mesh-based polytopes and tube wireframes.
 * Provides visual parity with WebGL fresnel implementation.
 *
 * Features:
 * - Basic Schlick fresnel approximation
 * - Light-influenced falloff (30% base + 70% light-influenced)
 * - PBR-compatible fresnel for specular workflows
 *
 * @module rendering/tsl/features/mesh-fresnel
 */

import type { Color } from 'three'
import { dot, float, Fn, max, pow, vec3 } from 'three/tsl'

import type { Node, UniformNode } from 'three/tsl'

// Re-export from existing feature-blocks for compatibility
// NOTE: Only createFresnelNode exists in feature-blocks/fresnel.ts
// The iridescent/PBR/stylized variants were removed during parity work
export { createFresnelNode } from '../compose/feature-blocks/fresnel'

// Type aliases
type Vec3Node = Node
type FloatNode = ReturnType<typeof float>

/**
 * Mesh fresnel uniforms interface
 * Extended from base FresnelUniforms with mesh-specific options
 */
export interface MeshFresnelUniforms {
  /** Whether fresnel is enabled */
  uFresnelEnabled: UniformNode<boolean>
  /** Fresnel intensity (0-2) */
  uFresnelIntensity: UniformNode<number>
  /** Rim color (linear space) */
  uRimColor: UniformNode<Color>
}

/**
 * Create fresnel rim lighting node with light-influenced falloff
 *
 * This matches the WebGL behavior in PolytopeScene.tsx:
 * - 30% base rim (always visible)
 * - 70% light-influenced rim (stronger where lit)
 *
 * @param uniforms - Mesh fresnel uniforms
 * @returns TSL Fn that computes light-influenced fresnel
 */
export const createMeshFresnelNode = (uniforms: MeshFresnelUniforms) => {
  /**
   * Compute fresnel rim with light influence
   *
   * @param normal - Surface normal (world space)
   * @param viewDir - View direction (from surface to camera)
   * @param totalNdotL - Total light contribution (sum of NdotL for all lights)
   * @returns Fresnel rim color contribution
   */
  return Fn(([normal, viewDir, totalNdotL]: [Vec3Node, Vec3Node, FloatNode]) => {
    // N dot V - how much surface faces camera
    const NdotV = max(dot(normal, viewDir), float(0))

    // Fresnel using Schlick approximation with cubic falloff
    // t^3 is softer than t^5, matching WebGL implementation
    const t = float(1).sub(NdotV)
    const rim = t.mul(t).mul(t).mul(uniforms.uFresnelIntensity).mul(2)

    // Light-influenced rim factor
    // 30% base + 70% light-influenced
    // This prevents rim from appearing on completely dark surfaces
    const rimFactor = float(0.3).add(float(0.7).mul(totalNdotL))

    // Final rim contribution
    const rimColor = vec3(uniforms.uRimColor)
    return rimColor.mul(rim).mul(rimFactor)
  })
}

/**
 * Create simple fresnel node without light influence
 *
 * Use this for performance when light influence is not needed.
 *
 * @param uniforms - Mesh fresnel uniforms
 * @returns TSL Fn that computes basic fresnel
 */
export const createSimpleMeshFresnelNode = (uniforms: MeshFresnelUniforms) => {
  return Fn(([normal, viewDir]: [Vec3Node, Vec3Node]) => {
    const NdotV = max(dot(normal, viewDir), float(0))

    // Standard Schlick fresnel (t^5)
    const fresnel = pow(float(1).sub(NdotV), float(5))

    const rimColor = vec3(uniforms.uRimColor)
    return rimColor.mul(fresnel).mul(uniforms.uFresnelIntensity)
  })
}

/**
 * Create Fresnel factor for specular workflow
 *
 * Returns the fresnel factor (0-1) for blending specular contribution.
 * Used in PBR lighting to determine reflection strength.
 *
 * @returns TSL Fn that computes fresnel factor
 */
export const createFresnelFactorNode = () => {
  return Fn(([NdotV, f0, roughness]: [FloatNode, Vec3Node, FloatNode]) => {
    // Schlick-Fresnel with roughness adjustment
    // F = F0 + (max(1-roughness, F0) - F0) * (1 - NdotV)^5
    const oneMinusNdotV5 = pow(float(1).sub(NdotV), float(5))
    const maxRefl = max(float(1).sub(roughness), f0.x) // Use F0.x for scalar comparison
    const fresnelR = f0.x.add(maxRefl.sub(f0.x).mul(oneMinusNdotV5))
    const fresnelG = f0.y.add(max(float(1).sub(roughness), f0.y).sub(f0.y).mul(oneMinusNdotV5))
    const fresnelB = f0.z.add(max(float(1).sub(roughness), f0.z).sub(f0.z).mul(oneMinusNdotV5))

    return vec3(fresnelR, fresnelG, fresnelB)
  })
}

/**
 * Compute total NdotL from all active lights
 *
 * Helper function to calculate the light contribution for fresnel modulation.
 *
 * @param normal - Surface normal
 * @param lightDirections - Array of light direction vectors
 * @param numLights - Number of active lights
 * @returns Total NdotL contribution (clamped 0-1)
 */
export const computeTotalNdotL = Fn(
  ([normal, primaryLightDir]: [Vec3Node, Vec3Node]) => {
    // For simplicity, use primary light direction
    // In multi-light scenarios, this can be extended to sum contributions
    const NdotL = max(dot(normal, primaryLightDir), float(0))
    return NdotL
  }
)
