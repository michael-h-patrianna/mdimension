/**
 * TSL Deferred Gravitational Lensing
 *
 * Post-processing pass that distorts the scene image based on
 * gravitational field. This applies lensing effects to background
 * objects that were rendered separately from the black hole.
 *
 * @module rendering/tsl/raymarching/blackhole/effects/deferred-lensing
 */

import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  max,
  min,
  pow,
  abs,
  length,
  clamp,
  exp,
  texture,
  If,
} from 'three/tsl'
import type { Node, UniformNode, TextureNode } from 'three/tsl'
import * as THREE from 'three'

/**
 * Uniforms for deferred lensing pass.
 */
export interface DeferredLensingUniforms {
  /** Black hole center in UV space (0-1) */
  uBlackHoleCenter: UniformNode<THREE.Vector2>
  /** Horizon radius in UV space */
  uHorizonRadiusUV: UniformNode<number>
  /** Overall strength */
  uDeferredLensingStrength: UniformNode<number>
  /** Distance falloff exponent */
  uDeferredLensingFalloff: UniformNode<number>
  /** Enable chromatic aberration */
  uChromaticEnabled: UniformNode<boolean>
  /** Chromatic aberration strength */
  uChromaticAmount: UniformNode<number>
}

/**
 * Compute radial distortion magnitude based on distance from center.
 *
 * Uses the gravitational lensing formula: deflection = strength / r^falloff
 */
export const lensingMagnitude = Fn(([r, strength, falloff]: [Node, Node, Node]) => {
  // Prevent division by zero at center
  const safeR = max(r, float(0.001))

  // Gravitational lensing: deflection = strength / r^falloff
  const deflection = strength.div(pow(safeR, falloff))

  // Clamp to prevent extreme distortion
  return min(deflection, float(0.5))
})

/**
 * Compute displacement vector for a UV coordinate.
 */
export const computeLensingDisplacement = Fn(
  ([uv, center, strength, falloff]: [Node, Node, Node, Node]) => {
    // Vector from pixel to black hole center
    const toCenter = center.sub(uv)

    // Distance from center
    const r = length(toCenter)

    // Skip if very close to center (inside event horizon region)
    // GPU branch evaluation: select() evaluates both branches, so guard normalize
    const safeR = max(r, float(0.01))
    return r.lessThan(0.01).select(
      vec2(0, 0),
      (() => {
        // Direction toward center (use safe division for GPU branch safety)
        const dir = toCenter.div(safeR)

        // Calculate displacement magnitude
        const mag = lensingMagnitude(r, strength, falloff)

        // Return displacement vector (pulls toward center)
        return dir.mul(mag)
      })()
    )
  }
)

/**
 * Apply chromatic aberration to lensing.
 * Simulates wavelength-dependent light bending.
 */
export function createApplyLensingChromatic(uniforms: DeferredLensingUniforms) {
  return Fn(([sceneTexture, uv, displacement]: [TextureNode, Node, Node]) => {
    // Each color channel bends slightly differently
    const rScale = float(1.0).sub(uniforms.uChromaticAmount.mul(0.02))
    const gScale = float(1.0)
    const bScale = float(1.0).add(uniforms.uChromaticAmount.mul(0.02))

    // Sample with offset for each channel
    const r = texture(sceneTexture, uv.add(displacement.mul(rScale))).r
    const g = texture(sceneTexture, uv.add(displacement.mul(gScale))).g
    const b = texture(sceneTexture, uv.add(displacement.mul(bScale))).b

    return vec3(r, g, b)
  })
}

/**
 * Compute Einstein ring brightness boost.
 * Pixels near the critical radius get brightness amplification.
 */
export const einsteinRingBoost = Fn(([r, ringRadius, ringWidth]: [Node, Node, Node]) => {
  // Gaussian profile centered on ring radius
  const diff = abs(r.sub(ringRadius))
  const safeWidth = max(ringWidth, float(0.001))
  const falloff = exp(diff.mul(diff).negate().div(safeWidth.mul(safeWidth).mul(2.0)))

  // Return boost factor (1.0 = no boost)
  return float(1.0).add(falloff.mul(0.5))
})

/**
 * Sample scene with gravitational lensing distortion.
 * This is the main function for the deferred lensing pass.
 */
export function createSampleWithLensing(uniforms: DeferredLensingUniforms) {
  const applyChromatic = createApplyLensingChromatic(uniforms)

  return Fn(([sceneTexture, uv]: [TextureNode, Node]) => {
    const blackHoleCenter = uniforms.uBlackHoleCenter
    const horizonRadius = uniforms.uHorizonRadiusUV
    const strength = uniforms.uDeferredLensingStrength
    const falloff = uniforms.uDeferredLensingFalloff

    // Compute displacement
    const displacement = computeLensingDisplacement(uv, blackHoleCenter, strength, falloff)

    // Distance from center for horizon check
    const r = length(uv.sub(blackHoleCenter))

    // Inside event horizon: return black
    const result = vec4(0, 0, 0, 1).toVar('lensingResult')

    If(r.lessThan(horizonRadius), () => {
      result.assign(vec4(0, 0, 0, 1))
    })

    If(r.greaterThanEqual(horizonRadius), () => {
      // Apply displacement to UV
      const distortedUV = clamp(uv.add(displacement), vec2(0), vec2(1))

      // Sample scene with optional chromatic aberration
      const color = vec3(0).toVar('lensColor')

      If(uniforms.uChromaticEnabled.and(uniforms.uChromaticAmount.greaterThan(0)), () => {
        color.assign(applyChromatic(sceneTexture, uv, displacement))
      })

      If(uniforms.uChromaticEnabled.not().or(uniforms.uChromaticAmount.lessThanEqual(0)), () => {
        color.assign(texture(sceneTexture, distortedUV).rgb)
      })

      // Apply Einstein ring brightness boost
      const ringRadius = horizonRadius.mul(1.5) // Photon sphere location
      const boost = einsteinRingBoost(r, ringRadius, horizonRadius.mul(0.3))
      color.assign(color.mul(boost))

      result.assign(vec4(color, float(1)))
    })

    return result
  })
}

