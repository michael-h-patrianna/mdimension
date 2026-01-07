/**
 * TSL Gravitational Lensing
 *
 * Implements N-dimensional ray bending based on simplified gravitational field.
 * Uses the "Magic Potential" approach from Starless raytracer with Kerr frame dragging.
 *
 * Reference: https://rantonels.github.io/starless/
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/lensing
 */

import {
  Fn,
  float,
  vec3,
  sqrt,
  max,
  abs,
  pow,
  dot,
  length,
  min,
  smoothstep,
  If,
  mix,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import { safeNormalizeNoFallback } from '../../../utils/safe-math'

/**
 * Ray bending mode constants (matching WebGL: 0=spiral, 1=orbital)
 */
export const RAY_BENDING_MODE_SPIRAL = 0
export const RAY_BENDING_MODE_ORBITAL = 1

/**
 * Uniforms for gravitational lensing.
 */
export interface LensingUniforms {
  /** Gravity strength k */
  uGravityStrength: UniformNode<number>
  /** Distance falloff exponent β */
  uDistanceFalloff: UniformNode<number>
  /** Epsilon for numerical stability */
  uEpsilonMul: UniformNode<number>
  /** Pre-computed N^α for dimension scaling */
  uDimPower: UniformNode<number>
  /** Horizon radius for physical units */
  uHorizonRadius: UniformNode<number>
  /** Pre-computed squared length of N-D origin offset */
  uOriginOffsetLengthSq: UniformNode<number>
  /** Dimensionless spin chi = a/M (0 to 0.998) */
  uSpin: UniformNode<number>
  /** Ray bend scale */
  uBendScale: UniformNode<number>
  /** Max bend angle per step */
  uBendMaxPerStep: UniformNode<number>
  /** Maximum lensing effect */
  uLensingClamp: UniformNode<number>
  /** Ray bending mode: 0=spiral, 1=orbital (WebGL: uRayBendingMode) */
  uRayBendingMode?: UniformNode<number>
}

/**
 * Safely normalize a vector, returning a fallback if near zero.
 * GPU branch evaluation: select() evaluates both branches, so guard the division.
 */
export const safeNormalize = Fn(([v, fallback]: [Node, Node]) => {
  const len = length(v)
  const safeLen = max(len, float(1e-6))
  return len.greaterThan(1e-6).select(v.div(safeLen), fallback)
})

/**
 * Compute N-dimensional distance to origin.
 *
 * For a 3D slice defined by orthonormal basis vectors and an origin offset:
 *   Radius^2 = worldX^2 + worldY^2 + worldZ^2 + |OriginOffset|^2
 */
export function createNdDistance(uniforms: LensingUniforms) {
  return Fn(([pos3d]: [Node]) => {
    // Compute distance squared in the 3D slice
    const dist3dSq = dot(pos3d, pos3d)

    // Add the pre-calculated squared length of the N-D origin offset
    const sumSq = dist3dSq.add(uniforms.uOriginOffsetLengthSq)

    return sqrt(max(sumSq, float(1e-10)))
  })
}

/**
 * Compute gravitational lensing strength.
 *
 * Uses the N-dimensional lensing formula:
 *   G(r,N) = k * N^α / (r + ε)^β
 */
export function createDeflectionAngle(uniforms: LensingUniforms) {
  return Fn(([ndRadius]: [Node]) => {
    const k = uniforms.uGravityStrength
    const r = ndRadius
    const epsilon = uniforms.uEpsilonMul
    const beta = uniforms.uDistanceFalloff

    // Compute denominator with beta falloff
    // Fast path for beta ≈ 2 (common case)
    const re = r.add(epsilon)
    const denominator = abs(beta.sub(2.0)).lessThan(0.01).select(
      re.mul(re),
      pow(re, beta)
    )

    const deflectionAngle = k.mul(uniforms.uDimPower).div(max(denominator, float(1e-10)))

    // Scale by horizon radius for physical units
    const scaledAngle = deflectionAngle.mul(uniforms.uHorizonRadius)

    // Clamp to prevent extreme bending per step (matching WebGL)
    return min(scaledAngle, uniforms.uBendMaxPerStep)
  })
}

/**
 * Apply ray bending for one raymarch step using "Magic Potential" approach
 * with Kerr frame dragging and N-dimensional scaling.
 *
 * Base algorithm (from Starless raytracer):
 *   acceleration = -1.5 * h² * pos / |pos|^5
 *
 * Optimization:
 *   h² = |pos|^2 - (pos . rayDir)^2  (Lagrange's identity for |pos x rayDir|^2)
 *   This avoids computing the cross product.
 *
 * N-Dimensional Scaling:
 *   We scale the 3D force by: N^α * r^(2-β)
 *   - N^α: Dimension emphasis (uDimPower)
 *   - r^(2-β): Falloff correction. 3D is 1/r^2. If β=3, we want 1/r^3, so we multiply by 1/r.
 *
 * Kerr frame dragging addition:
 *   The spacetime is "dragged" by the spinning black hole.
 *   This adds an azimuthal component to the acceleration that
 *   pulls light rays in the direction of the black hole's rotation.
 *
 * Reference: https://rantonels.github.io/starless/
 */
export function createBendRay(uniforms: LensingUniforms) {
  return Fn(([rayDir, pos3d, stepSize, ndRadius]: [Node, Node, Node, Node]) => {
    const rs = uniforms.uHorizonRadius

    // N-Dimensional radius (already computed and passed in)
    const r = max(ndRadius, uniforms.uEpsilonMul)
    const r2 = r.mul(r)

    // Optimization: Compute h² without cross product
    // h² = |pos|^2 - (pos . rayDir)^2
    const p_dot_d = dot(pos3d, rayDir)

    // Derive pos3dLenSq from ndRadius instead of recomputing dot product
    // From ndDistance(): ndRadius = sqrt(pos3dLenSq + uOriginOffsetLengthSq)
    // Therefore: pos3dLenSq = ndRadius² - uOriginOffsetLengthSq
    const pos3dLenSq = max(float(1e-10), r2.sub(uniforms.uOriginOffsetLengthSq))
    const h2 = pos3dLenSq.sub(p_dot_d.mul(p_dot_d))

    // Result direction (modified in place)
    const resultDir = rayDir.toVar('resultDir')

    // Only apply bending if h² > 0 (ray is not purely radial)
    If(h2.greaterThan(1e-10), () => {
      // === Photon Sphere Proximity Factor ===
      // ⚠️ ARTISTIC DEPARTURE FROM PHYSICS ⚠️
      // Reduces lensing for rays far from the photon sphere for visual appeal.
      // Note: photonSphereR would be rs.mul(1.5), but we use lensingFalloffStart directly
      const lensingFalloffStart = rs.mul(3.5)
      const lensingFalloffEnd = rs.mul(8.0)
      const minLensingFactor = float(0.1)

      const proximityRaw = float(1.0).sub(smoothstep(lensingFalloffStart, lensingFalloffEnd, r))
      // WebGL: proximityFactor = mix(minLensingFactor, 1.0, proximityFactor)
      // TSL mix(a, b, t) = lerp from a to b by t
      const proximityMixed = mix(minLensingFactor, float(1.0), proximityRaw)

      // Additional quadratic falloff for very far rays
      const farFalloff = float(1.0).div(float(1.0).add(max(float(0.0), r.sub(lensingFalloffStart)).mul(0.25).div(rs)))
      const proximityFactor = proximityMixed.mul(farFalloff).toVar('proximityFactor')

      // === Schwarzschild component ===
      // F_schwarzschild = -1.5 * h² * r_hat / r^5
      const r5 = r2.mul(r2).mul(r)
      const forceMagnitude = float(1.5).mul(h2).div(r5).toVar('forceMag')

      // === N-Dimensional Scaling ===
      const ndScale = abs(uniforms.uDistanceFalloff.sub(2.0))
        .lessThan(0.01)
        .select(uniforms.uDimPower, uniforms.uDimPower.mul(pow(r, float(2.0).sub(uniforms.uDistanceFalloff))))
        .toVar('ndScale')

      forceMagnitude.assign(forceMagnitude.mul(ndScale))

      // Apply gravity strength, bend scale, and proximity factor
      forceMagnitude.assign(
        forceMagnitude.mul(uniforms.uGravityStrength).mul(uniforms.uBendScale).mul(proximityFactor)
      )

      // Apply clamping
      forceMagnitude.assign(min(forceMagnitude, uniforms.uLensingClamp))
      forceMagnitude.assign(min(forceMagnitude, uniforms.uBendMaxPerStep.div(stepSize)))

      // Radial acceleration (toward origin)
      // Use 1/sqrt(x) manually since inverseSqrt isn't in TSL
      const invSqrtPos3dLenSq = float(1.0).div(sqrt(pos3dLenSq))
      const acceleration = pos3d.mul(forceMagnitude.negate().mul(invSqrtPos3dLenSq)).toVar('accel')

      // === Kerr frame dragging component ===
      If(uniforms.uSpin.greaterThan(0.001), () => {
        // Spin axis is Y-axis (vertical)
        // a = chi * M, and M = rs/2, so a = chi * rs/2
        const a = uniforms.uSpin.mul(rs).mul(0.5)

        // Azimuthal direction: cross((0,1,0), pos) = (-pos.z, 0, pos.x)
        const azimuthalDirRaw = vec3(pos3d.z.negate(), 0, pos3d.x)
        const azLenSq = dot(azimuthalDirRaw, azimuthalDirRaw)

        // GPU branch evaluation: If() evaluates both branches, so guard sqrt division
        const safeAzLenSq = max(azLenSq, float(1e-6))

        If(azLenSq.greaterThan(1e-6), () => {
          // Frame dragging acceleration: ~ 2*a/r³ in the azimuthal direction
          const r3 = r2.mul(r)
          const frameDragMag = float(2.0)
            .mul(a)
            .div(r3)
            .mul(uniforms.uGravityStrength)
            .mul(uniforms.uBendScale)
            .mul(ndScale)
            .mul(proximityFactor)
            .toVar('fdMag')

          // Add frame dragging to acceleration
          const invSqrtAzLenSq = float(1.0).div(sqrt(safeAzLenSq))
          acceleration.assign(acceleration.add(azimuthalDirRaw.mul(frameDragMag.mul(invSqrtAzLenSq))))
        })
      })

      // Velocity Verlet integration (semi-implicit Euler)
      // GPU branch: use safe normalize in case accel perfectly cancels rayDir
      resultDir.assign(safeNormalizeNoFallback(rayDir.add(acceleration.mul(stepSize))))
    })

    return resultDir
  })
}

/**
 * Single step of gravitational lensing integration.
 *
 * Updates ray position and direction based on gravitational field.
 * Uses the proper "Magic Potential" approach with Kerr frame dragging.
 */
export function createLensingStep(uniforms: LensingUniforms) {
  const ndDistanceFn = createNdDistance(uniforms)
  const bendRayFn = createBendRay(uniforms)

  // Return a function that performs one step of lensing integration
  // Note: This returns an object, so it's used directly, not as a TSL Fn
  return (pos: Node, dir: Node, stepSize: Node) => {
    // Compute N-D radius
    const ndRadius = ndDistanceFn(pos)

    // Apply gravitational bending
    const newDir = bendRayFn(dir, pos, stepSize, ndRadius)

    // Step position forward
    const newPos = pos.add(newDir.mul(stepSize))

    return { pos: newPos, dir: newDir, ndRadius }
  }
}

