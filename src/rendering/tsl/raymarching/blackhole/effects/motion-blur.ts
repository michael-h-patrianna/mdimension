/**
 * TSL Motion Blur for Black Hole Accretion Disk
 *
 * Creates rotational motion blur effect for the accretion disk.
 * Uses temporal sampling to blur along the orbital motion direction.
 *
 * The blur follows Keplerian velocity: faster near the center, slower at edge.
 * v ∝ r^(-0.5) (orbital velocity decreases with sqrt of radius)
 *
 * @module rendering/tsl/raymarching/blackhole/effects/motion-blur
 */

import {
  Fn,
  float,
  vec3,
  sqrt,
  max,
  abs,
  smoothstep,
  If,
  Loop,
  Break,
  mix,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

/**
 * Uniforms for motion blur effect.
 */
export interface MotionBlurUniforms {
  /** Enable motion blur */
  uMotionBlurEnabled: UniformNode<boolean>
  /** Blur intensity */
  uMotionBlurStrength: UniformNode<number>
  /** Blur sample count */
  uMotionBlurSamples: UniformNode<number>
  /** Radial falloff */
  uMotionBlurRadialFalloff: UniformNode<number>
  /** Horizon radius */
  uHorizonRadius: UniformNode<number>
  /** Disk inner radius multiplier */
  uDiskInnerRadiusMul: UniformNode<number>
  /** Disk outer radius multiplier */
  uDiskOuterRadiusMul: UniformNode<number>
}

/**
 * Compute orbital velocity factor at given radius.
 * Based on Keplerian orbit: v ∝ 1/√r
 */
export function createOrbitalVelocityFactor(uniforms: MotionBlurUniforms) {
  return Fn(([radius, innerR, outerR]: [Node, Node, Node]) => {
    // Avoid division by zero
    const safeInnerR = max(innerR, float(0.001))
    const r = max(radius, safeInnerR.mul(0.5))

    // Keplerian velocity: v ∝ 1/√r
    const v = sqrt(safeInnerR.div(r))

    // Apply radial falloff (no blur outside disk)
    const radialMask = smoothstep(innerR.mul(0.8), innerR, radius).mul(
      float(1).sub(smoothstep(outerR, outerR.mul(1.2), radius))
    )

    return v.mul(radialMask).mul(uniforms.uMotionBlurRadialFalloff)
  })
}

/**
 * Get motion blur offset direction at given position.
 * Returns the tangent direction (perpendicular to radial in XZ plane).
 */
export const getMotionBlurDirection = Fn(([pos3d]: [Node]) => {
  // Tangent direction in XZ plane (orbital direction)
  const xzLen = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))

  // Guard against zero-length vector
  // GPU branch evaluation: select() evaluates both branches, so guard the division
  const safeXzLen = max(xzLen, float(0.0001))
  return xzLen.lessThan(0.0001).select(
    vec3(1, 0, 0), // Default tangent direction
    vec3(pos3d.z.negate().div(safeXzLen), 0, pos3d.x.div(safeXzLen))
  )
})

/**
 * Apply motion blur to manifold color.
 *
 * Samples the manifold at multiple time offsets along the orbital path
 * and averages the results for a motion blur effect.
 */
/**
 * @param density - Density (currently unused, kept for API parity)
 */
export function createApplyMotionBlur(
  uniforms: MotionBlurUniforms,
  sampleManifold: ReturnType<typeof Fn>
) {
  const orbitalVelocityFactor = createOrbitalVelocityFactor(uniforms)

  return Fn(
    ([baseColor, pos3d, ndRadius, _density, time]: [Node, Node, Node, Node, Node]) => {
      const result = baseColor.toVar('blurredColor')

      If(uniforms.uMotionBlurEnabled.and(uniforms.uMotionBlurStrength.greaterThan(0.001)), () => {
        // Disk is in XZ plane, so radius is in XZ
        const radius = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))
        const innerR = uniforms.uHorizonRadius.mul(uniforms.uDiskInnerRadiusMul)
        const outerR = uniforms.uHorizonRadius.mul(uniforms.uDiskOuterRadiusMul)

        // Compute blur amount based on orbital velocity
        const velocityFactor = orbitalVelocityFactor(radius, innerR, outerR)
        const blurAmount = velocityFactor.mul(uniforms.uMotionBlurStrength)

        If(blurAmount.greaterThan(0.001), () => {
          // Get blur direction (tangent to orbit)
          const blurDir = getMotionBlurDirection(pos3d)

          // Sample count (capped for performance)
          const maxSamples = float(4)

          // Accumulate samples along motion path
          const accumColor = vec3(0).toVar('accumColor')
          const totalWeight = float(0).toVar('totalWeight')

          // Pre-compute shared values
          const safeSamples = max(maxSamples.sub(1), float(1))
          const blurScale = blurAmount.mul(radius).mul(0.05)

          Loop(maxSamples, ({ i }) => {
            If(float(i).greaterThanEqual(uniforms.uMotionBlurSamples), () => Break())

            // Sample offset: -0.5 to +0.5 of blur range
            const tVal = float(i).div(safeSamples).sub(0.5).mul(2.0)

            // Position offset along blur direction (tangent)
            const samplePos = pos3d.add(blurDir.mul(tVal).mul(blurScale))

            // Sample manifold at offset position
            const sampleResult = sampleManifold(samplePos, ndRadius, time)
            const sampleDensity = sampleResult.w
            const sampleColor = sampleResult.xyz

            If(sampleDensity.greaterThan(0.001), () => {
              // Weight by distance from center of blur kernel (triangle kernel)
              const weight = float(1).sub(abs(tVal))
              accumColor.assign(accumColor.add(sampleColor.mul(weight)))
              totalWeight.assign(totalWeight.add(weight))
            })
          })

          // Blend with original based on blur amount
          // GPU branch: If() evaluates both branches, guard totalWeight before division
          const safeTotalWeight = max(totalWeight, float(0.001))
          If(totalWeight.greaterThan(0.001), () => {
            const blurredColor = accumColor.div(safeTotalWeight)
            result.assign(mix(baseColor, blurredColor, blurAmount.mul(0.5)))
          })
        })
      })

      return result
    }
  )
}

