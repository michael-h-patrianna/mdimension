/**
 * TSL Lighting for Raymarching
 *
 * Base PBR lighting functions shared with mesh-lighting.ts.
 * These functions are the TSL equivalent of the WebGL shared lighting code.
 *
 * IMPORTANT: This file contains ONLY base PBR functions.
 * For multi-light uniforms and high-level functions, use:
 * - ../lighting/light-uniforms.ts (LightTSLUniforms, createLightTSLUniforms)
 * - ../lighting/mesh-lighting.ts (createMultiLightNode)
 *
 * @module rendering/tsl/raymarching/lighting
 */

import {
  clamp,
  dot,
  float,
  Fn,
  max,
  pow,
  smoothstep,
  sqrt,
  sub,
  vec3,
} from 'three/tsl'

import type { Node } from 'three/tsl'

// Import light constants for use in functions below
import {
  LIGHT_TYPE_POINT,
  LIGHT_TYPE_DIRECTIONAL,
  LIGHT_TYPE_SPOT,
  MAX_LIGHTS,
} from '../lighting/light-uniforms'

// Re-export light constants (canonical source is light-uniforms.ts)
export { LIGHT_TYPE_POINT, LIGHT_TYPE_DIRECTIONAL, LIGHT_TYPE_SPOT, MAX_LIGHTS }

// Re-export uniform types from canonical source
export type { LightTSLUniforms, PBRTSLUniforms, FresnelTSLUniforms } from '../lighting/light-uniforms'

// Type aliases for TSL nodes (using ReturnType for simpler types)
type FloatNode = ReturnType<typeof float> | Node
type Vec3Node = ReturnType<typeof vec3> | Node

// Constants - MUST match WebGL constants.glsl.ts for parity
const PI = Math.PI
const EPS = 1e-6 // WebGL: #define EPS 1e-6

/**
 * Fresnel-Schlick approximation
 *
 * Exact port of WebGL fresnelSchlick():
 * ```glsl
 * float x = clamp(1.0 - cosTheta, 0.0, 1.0);
 * float x2 = x * x;
 * float x5 = x2 * x2 * x;
 * return F0 + (1.0 - F0) * x5;
 * ```
 *
 * @param cosTheta - Dot product of half-vector and view direction
 * @param F0 - Base reflectivity
 * @returns Fresnel term
 */
export const fresnelSchlick = Fn(([cosTheta, F0]: [FloatNode, Vec3Node]) => {
  // WebGL: float x = clamp(1.0 - cosTheta, 0.0, 1.0);
  const x = clamp(float(1).sub(cosTheta), float(0), float(1))
  // WebGL: float x2 = x * x; float x5 = x2 * x2 * x;
  const x2 = x.mul(x)
  const x5 = x2.mul(x2).mul(x) // x^5
  // WebGL: return F0 + (1.0 - F0) * x5;
  return F0.add(sub(vec3(1), F0).mul(x5))
})

/**
 * GGX Normal Distribution Function (NDF)
 *
 * Exact port of WebGL distributionGGX():
 * ```glsl
 * float distributionGGX(vec3 N, vec3 H, float roughness) {
 *     float a = roughness * roughness;
 *     float a2 = a * a;
 *     float NdotH = max(dot(N, H), 0.0);
 *     float NdotH2 = NdotH * NdotH;
 *     float num = a2;
 *     float denom = (NdotH2 * (a2 - 1.0) + 1.0);
 *     denom = PI * denom * denom;
 *     return num / max(denom, 0.0001);
 * }
 * ```
 *
 * @param N - Surface normal
 * @param H - Half vector
 * @param roughness - Surface roughness
 * @returns NDF value
 */
export const distributionGGX = Fn(([N, H, roughness]: [Vec3Node, Vec3Node, FloatNode]) => {
  // WebGL: float a = roughness * roughness;
  const a = roughness.mul(roughness)
  // WebGL: float a2 = a * a;
  const a2 = a.mul(a)
  // WebGL: float NdotH = max(dot(N, H), 0.0);
  const NdotH = max(dot(N, H), float(0))
  // WebGL: float NdotH2 = NdotH * NdotH;
  const NdotH2 = NdotH.mul(NdotH)

  // WebGL: float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  // WebGL: denom = PI * denom * denom;
  const denom = NdotH2.mul(a2.sub(1)).add(1)
  const denomFinal = denom.mul(denom).mul(PI)
  // WebGL: return num / max(denom, 0.0001);
  return a2.div(max(denomFinal, float(0.0001)))
})

/**
 * Smith's Geometry Function (single direction)
 *
 * Exact port of WebGL geometrySchlickGGX():
 * ```glsl
 * float r = (roughness + 1.0);
 * float k = (r*r) / 8.0;
 * float denom = NdotV * (1.0 - k) + k;
 * return NdotV / max(denom, 0.0001);
 * ```
 *
 * @param NdotV - Dot product of normal and view/light direction
 * @param roughness - Surface roughness
 * @returns Geometry term
 */
export const geometrySchlickGGX = Fn(([NdotV, roughness]: [FloatNode, FloatNode]) => {
  // WebGL: float r = (roughness + 1.0);
  const r = roughness.add(1)
  // WebGL: float k = (r*r) / 8.0;
  const k = r.mul(r).div(8)
  // WebGL: float denom = NdotV * (1.0 - k) + k;
  const denom = NdotV.mul(float(1).sub(k)).add(k)
  // WebGL: return NdotV / max(denom, 0.0001);
  return NdotV.div(max(denom, float(0.0001)))
})

/**
 * Smith's Geometry Function (both directions combined)
 *
 * @param NdotV - Dot product of normal and view direction
 * @param NdotL - Dot product of normal and light direction
 * @param roughness - Surface roughness
 * @returns Combined geometry term
 */
export const geometrySmith = Fn(([NdotV, NdotL, roughness]: [FloatNode, FloatNode, FloatNode]) => {
  const ggx2 = geometrySchlickGGX(NdotV, roughness)
  const ggx1 = geometrySchlickGGX(NdotL, roughness)
  return ggx1.mul(ggx2)
})

/**
 * OPT-LIGHT-2: Fast normalize using 1/sqrt pattern
 * Returns (0, 1, 0) for zero-length vectors.
 *
 * @param v - Vector to normalize
 * @returns Normalized vector
 */
export const fastNormalize = Fn(([v]: [Vec3Node]) => {
  const lenSq = dot(v, v)
  // CRITICAL: Guard sqrt against near-zero values. In TSL, all branches are evaluated,
  // so sqrt(lenSq) is computed even when condition is false. Must clamp to avoid NaN/Inf.
  const safeLenSq = max(lenSq, float(0.00000001))
  const len = sqrt(safeLenSq)
  // Use select() instead of If/toVar/assign to avoid variable naming conflicts
  // when this Fn is called multiple times (e.g., per-light loop)
  return lenSq.greaterThan(0.00000001).select(v.div(len), vec3(0, 1, 0))
})

/**
 * OPT-LIGHT-2: Fast normalize with length output
 * Computes both normalized vector and length in one pass.
 *
 * @param v - Vector to normalize
 * @returns Tuple of [direction, length]
 */
export const fastNormalizeWithLength = (v: Vec3Node) => {
  const lenSq = dot(v, v)
  const len = sqrt(max(lenSq, float(0.00000001)))
  const dir = v.div(len)
  return { dir, len }
}

/**
 * Calculate light direction for a given light.
 * Returns normalized direction FROM fragment TO light source.
 *
 * @param lightType - LIGHT_TYPE_POINT, LIGHT_TYPE_DIRECTIONAL, or LIGHT_TYPE_SPOT
 * @param lightPosition - Light world position
 * @param lightDirection - Light direction (for directional/spot)
 * @param fragPos - Fragment world position
 * @returns Direction from fragment to light
 */
export const getLightDirection = Fn(
  ([lightType, lightPosition, lightDirection, fragPos]: [
    FloatNode,
    Vec3Node,
    Vec3Node,
    Vec3Node
  ]) => {
    // Compute all directions (GPU evaluates all branches anyway)
    const pointSpotDir = fastNormalize(lightPosition.sub(fragPos))
    const directionalDir = fastNormalize(lightDirection.negate())

    // Use nested select() to avoid toVar/If/assign pattern
    const isPointOrSpot = lightType.equal(LIGHT_TYPE_POINT).or(lightType.equal(LIGHT_TYPE_SPOT))
    const isDirectional = lightType.equal(LIGHT_TYPE_DIRECTIONAL)

    // Priority: Point/Spot > Directional > fallback
    return isPointOrSpot.select(pointSpotDir, isDirectional.select(directionalDir, vec3(0, 1, 0)))
  }
)

/**
 * Compute PBR specular component (Cook-Torrance BRDF)
 *
 * Exact port of WebGL computePBRSpecular():
 * ```glsl
 * vec3 halfSum = V + L;
 * float halfLen = length(halfSum);
 * vec3 H = halfLen > 0.0001 ? halfSum / halfLen : N;
 * // ... Cook-Torrance BRDF
 * ```
 *
 * @param N - Surface normal
 * @param V - View direction
 * @param L - Light direction
 * @param roughness - Surface roughness
 * @param F0 - Base reflectivity
 * @returns Specular color contribution
 */
export const computePBRSpecular = Fn(
  ([N, V, L, roughness, F0]: [Vec3Node, Vec3Node, Vec3Node, FloatNode, Vec3Node]) => {
    // WebGL: Guard against V and L being opposite (zero-length half vector)
    // vec3 halfSum = V + L;
    // float halfLen = length(halfSum);
    // vec3 H = halfLen > 0.0001 ? halfSum / halfLen : N;
    const halfSum = V.add(L)
    const halfLenSq = dot(halfSum, halfSum)
    // CRITICAL: Guard sqrt against near-zero values. In TSL, all branches are evaluated,
    // so sqrt(halfLenSq) is computed even when condition is false. Must clamp to avoid NaN/Inf.
    const safeHalfLenSq = max(halfLenSq, float(0.0001 * 0.0001))
    const halfLen = sqrt(safeHalfLenSq)
    // Use select() instead of If/toVar/assign to avoid variable naming conflicts
    // when this Fn is called multiple times (e.g., per-light loop)
    const H = halfLenSq.greaterThan(0.0001 * 0.0001).select(halfSum.div(halfLen), N)

    const NdotV = max(dot(N, V), float(EPS))
    const NdotL = max(dot(N, L), float(EPS))
    const HdotV = max(dot(H, V), float(EPS))

    // Cook-Torrance BRDF components
    // Note: distributionGGX now takes (N, H, roughness) matching WebGL signature
    const D = distributionGGX(N, H, roughness)
    const G = geometrySmith(NdotV, NdotL, roughness)
    const F = fresnelSchlick(HdotV, F0)

    // Cook-Torrance denominator
    const denom = NdotV.mul(NdotL).mul(4).add(EPS)

    return D.mul(G).mul(F).div(denom)
  }
)

/**
 * Compute ambient lighting with metallic energy conservation
 *
 * @param surfaceColor - Base surface color
 * @param ambientColor - Ambient light color
 * @param ambientIntensity - Ambient light intensity
 * @param metallic - Metalness (0-1)
 * @returns Ambient contribution
 */
export const computeAmbient = Fn(
  ([surfaceColor, ambientColor, ambientIntensity, metallic]: [
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode
  ]) => {
    // Metals don't scatter diffuse light (energy conservation)
    const diffuseFactor = max(float(1).sub(metallic), float(0))
    return surfaceColor.mul(diffuseFactor).mul(ambientColor).mul(ambientIntensity)
  }
)

/**
 * Compute Fresnel rim lighting
 *
 * @param N - Surface normal
 * @param V - View direction
 * @param rimColor - Rim light color
 * @param intensity - Fresnel intensity
 * @param totalNdotL - Total light contribution (for light-dependent rim)
 * @returns Rim light contribution
 */
export const computeFresnelRim = Fn(
  ([N, V, rimColor, intensity, totalNdotL]: [
    Vec3Node,
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode
  ]) => {
    const NdotV = max(dot(N, V), float(0))
    const t = float(1).sub(NdotV)
    const rim = t.mul(t).mul(t).mul(intensity).mul(2)

    // Light-dependent rim (30% base + 70% light-influenced)
    const rimFactor = float(0.3).add(float(0.7).mul(totalNdotL))

    return rimColor.mul(rim).mul(rimFactor)
  }
)

/**
 * Compute single directional light contribution
 *
 * @param N - Surface normal
 * @param V - View direction
 * @param L - Light direction
 * @param lightColor - Light color
 * @param surfaceColor - Surface albedo
 * @param roughness - Surface roughness
 * @param metallic - Surface metalness
 * @param shadow - Shadow factor (0-1)
 * @returns Light contribution
 */
export const computeDirectionalLight = Fn(
  ([N, V, L, lightColor, surfaceColor, roughness, metallic, shadow]: [
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode
  ]) => {
    const NdotL = max(dot(N, L), float(0))

    // Base reflectivity: 0.04 for dielectrics, albedo for metals
    const F0 = vec3(0.04).mix(surfaceColor, metallic)

    // Fresnel for energy conservation
    // CRITICAL: Guard against zero-length half vector (L and V opposite)
    const halfSum = L.add(V)
    const halfLenSq = dot(halfSum, halfSum)
    const safeHalfLen = sqrt(max(halfLenSq, float(0.0001)))
    const H = halfLenSq.greaterThan(0.0001).select(halfSum.div(safeHalfLen), N)
    const HdotV = max(dot(H, V), float(0))
    const F = fresnelSchlick(HdotV, F0)

    // kS is specular reflectance, kD is diffuse
    const kS = F
    const kD = sub(vec3(1), kS).mul(float(1).sub(metallic))

    // Lambertian diffuse (albedo/PI)
    const diffuse = kD.mul(surfaceColor).div(PI)

    // Cook-Torrance specular
    const specular = computePBRSpecular(N, V, L, roughness, F0)

    // Combine with light color and shadow
    return diffuse.add(specular).mul(lightColor).mul(NdotL).mul(shadow)
  }
)

/**
 * Distance attenuation for point/spot lights
 *
 * Matches Three.js / WebGL attenuation formula:
 * - range = 0: infinite range (no falloff)
 * - range > 0: light reaches zero intensity at this distance
 * - decay = 0: no decay, 1: linear, 2: physically correct inverse square
 *
 * @param distance - Distance to light
 * @param range - Light range (0 = infinite)
 * @param decay - Decay exponent (0-2, 2 = physically correct)
 * @returns Attenuation factor (0-1)
 */
export const getDistanceAttenuation = Fn(
  ([distance, range, decay]: [FloatNode, FloatNode, FloatNode]) => {
    // Clamp distance to prevent division by zero
    const d = max(distance, float(0.0001))

    // When range is 0 (infinite range), return 1.0 (no attenuation)
    // When range > 0, use Three.js attenuation formula
    const rangeAttenuation = range.greaterThan(0).select(
      pow(max(float(1).sub(d.div(range)), float(0)), decay),
      float(1)
    )

    return rangeAttenuation
  }
)

/**
 * Spot light angular attenuation
 *
 * Uses smoothstep for penumbra falloff matching WebGL behavior.
 *
 * @param lightToFrag - Direction from light to fragment (normalized)
 * @param spotDir - Spot light direction (normalized, points light->surface)
 * @param cosInner - Cosine of inner cone angle
 * @param cosOuter - Cosine of outer cone angle
 * @returns Angular attenuation (0-1)
 */
export const getSpotAttenuation = Fn(
  ([lightToFrag, spotDir, cosInner, cosOuter]: [Vec3Node, Vec3Node, FloatNode, FloatNode]) => {
    // Normalize spotDir in case it wasn't already
    const normSpotDir = fastNormalize(spotDir)
    // Angle between light-to-fragment direction and spot direction
    const cosAngle = dot(lightToFrag, normSpotDir)
    // Smoothstep for smooth penumbra falloff
    return smoothstep(cosOuter, cosInner, cosAngle)
  }
)

// NOTE: High-level light functions (computePointLight, computeSpotLight,
// createMultiLightNode) are in ../lighting/mesh-lighting.ts
// This file contains only the base PBR building blocks.
