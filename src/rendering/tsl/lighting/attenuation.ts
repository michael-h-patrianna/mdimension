/**
 * TSL Attenuation Functions for Mesh Lighting
 *
 * Distance and angular attenuation for point and spot lights.
 * Re-exports core functions from raymarching/lighting.ts and adds
 * additional utilities for mesh-specific attenuation patterns.
 *
 * @module rendering/tsl/lighting/attenuation
 */

import { float, Fn, max, min, pow, select } from 'three/tsl'

// Re-export core attenuation functions from raymarching
export { getDistanceAttenuation, getSpotAttenuation } from '../raymarching/lighting'

// Type alias
type FloatNode = ReturnType<typeof float>

/**
 * Physically-based distance attenuation with range falloff
 *
 * Matches Three.js point/spot light attenuation formula:
 * pow(saturate(1 - distance/range), decay)
 *
 * @param distance - Distance from light to fragment
 * @param range - Light range (0 = infinite, no falloff)
 * @param decay - Decay exponent (0 = none, 1 = linear, 2 = inverse square)
 * @returns Attenuation factor (0-1)
 */
export const getDistanceAttenuationWithDecay = Fn(
  ([distance, range, decay]: [FloatNode, FloatNode, FloatNode]) => {
    // Guard against division by zero
    const d = max(distance, float(0.0001))

    // No range = no falloff (infinite range)
    const infiniteRange = range.lessThanEqual(0)

    // CRITICAL: Guard division BEFORE select() - GPU evaluates ALL branches
    // Even when infiniteRange is true, d.div(range) is computed, causing div-by-zero
    // See docs/tsl.md "GPU Branch Evaluation"
    const safeRange = max(range, float(0.0001))

    // Three.js attenuation: pow(saturate(1 - d/range), decay)
    const rangeRatio = d.div(safeRange)
    const saturated = min(max(float(1).sub(rangeRatio), float(0)), float(1))
    const attenuated = pow(saturated, decay)

    return select(infiniteRange, float(1), attenuated)
  }
)

/**
 * Inverse square law attenuation (physically correct)
 *
 * Used when you want pure physics-based falloff without range clamping.
 * Formula: 1 / (distance² + epsilon)
 *
 * @param distance - Distance from light to fragment
 * @returns Attenuation factor (unbounded, decreases with distance)
 */
export const getInverseSquareAttenuation = Fn(([distance]: [FloatNode]) => {
  const d2 = distance.mul(distance)
  return float(1).div(d2.add(0.0001))
})

/**
 * Smooth spot light cone attenuation with penumbra
 *
 * Uses smoothstep for soft falloff between inner and outer cone angles.
 * cosTheta = dot(lightToFragment, spotDirection)
 *
 * @param cosTheta - Cosine of angle between light-to-frag and spot direction
 * @param cosInner - Cosine of inner cone angle (full intensity)
 * @param cosOuter - Cosine of outer cone angle (zero intensity)
 * @returns Angular attenuation (0-1)
 */
export const getSpotConeAttenuation = Fn(
  ([cosTheta, cosInner, cosOuter]: [FloatNode, FloatNode, FloatNode]) => {
    // smoothstep from outer to inner
    // t = (cosTheta - cosOuter) / (cosInner - cosOuter)
    const t = cosTheta.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
    const clamped = min(max(t, float(0)), float(1))

    // Quadratic falloff for smoother penumbra
    return clamped.mul(clamped)
  }
)

/**
 * Combined distance and spot attenuation
 *
 * Convenience function for spot lights that combines both attenuation types.
 *
 * @param distance - Distance from light to fragment
 * @param range - Light range (0 = infinite)
 * @param decay - Decay exponent
 * @param cosTheta - Cosine of spot angle
 * @param cosInner - Cosine of inner cone angle
 * @param cosOuter - Cosine of outer cone angle
 * @returns Combined attenuation (0-1)
 */
export const getCombinedSpotAttenuation = Fn(
  ([distance, range, decay, cosTheta, cosInner, cosOuter]: [
    FloatNode,
    FloatNode,
    FloatNode,
    FloatNode,
    FloatNode,
    FloatNode
  ]) => {
    const distAtten = getDistanceAttenuationWithDecay(distance, range, decay)
    const spotAtten = getSpotConeAttenuation(cosTheta, cosInner, cosOuter)
    return distAtten.mul(spotAtten)
  }
)
