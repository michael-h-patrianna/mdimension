/**
 * TSL Mesh Lighting for Polytopes and TubeWireframe
 *
 * Full PBR lighting system for mesh-based rendering with multi-light support.
 * Ports WebGL lighting to TSL for visual parity between WebGL and WebGPU.
 *
 * Re-exports shared functions from raymarching/lighting.ts and adds:
 * - computePointLight(): Point light with distance attenuation
 * - computeSpotLight(): Spot light with distance + angular attenuation
 * - createMultiLightNode(): Loop over light array with all light types
 *
 * @module rendering/tsl/lighting/mesh-lighting
 */

import {
  abs,
  add,
  clamp,
  dot,
  float,
  Fn,
  int,
  length,
  Loop,
  max,
  min,
  pow,
  select,
  sub,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

import type { LightTSLUniforms } from './light-uniforms'
import { MAX_LIGHTS, LIGHT_TYPE_DIRECTIONAL, LIGHT_TYPE_POINT, LIGHT_TYPE_SPOT } from './light-uniforms'
import { safeNormalize3, safeNormalizeUp } from '../utils/safe-math'

// Import PBR functions for local use
import {
  computeAmbient,
  computeDirectionalLight,
  computeFresnelRim,
  computePBRSpecular,
  distributionGGX,
  fresnelSchlick,
  geometrySchlickGGX,
  geometrySmith,
  getDistanceAttenuation,
  getSpotAttenuation,
} from '../raymarching/lighting'

// Re-export shared PBR functions (no duplication)
export {
  computeAmbient,
  computeDirectionalLight,
  computeFresnelRim,
  computePBRSpecular,
  distributionGGX,
  fresnelSchlick,
  geometrySchlickGGX,
  geometrySmith,
  getDistanceAttenuation,
  getSpotAttenuation,
}

// Type aliases for TSL nodes
type FloatNode = ReturnType<typeof float>
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = ReturnType<typeof vec3>
type IntNode = ReturnType<typeof int>

// Constants matching WebGL GLSL
const PI = Math.PI

/**
 * Distance attenuation with range-based falloff
 * Matches WebGL getDistanceAttenuation from multi-light.glsl.ts
 *
 * @param distance - Distance to light
 * @param range - Light range (0 = infinite)
 * @param decay - Decay rate (2 = physically correct inverse square)
 * @returns Attenuation factor (0-1)
 */
export const getDistanceAttenuationFull = Fn(
  ([distance, range, decay]: [FloatNode, FloatNode, FloatNode]) => {
    // Clamp distance to prevent division by zero
    const d = max(distance, float(0.0001))

    // Three.js attenuation formula: pow(clamp(1 - d/range, 0, 1), decay)
    const rangeAttenuation = select(
      range.greaterThan(0),
      pow(min(max(float(1).sub(d.div(range)), float(0)), float(1)), decay),
      float(1)
    )

    return rangeAttenuation
  }
)

/**
 * Compute point light contribution
 * Matches WebGL compose.ts pattern: diffuse and specular modulated separately
 *
 * @param specularColor - Artist-controlled specular tint (uSpecularColor)
 * @param specularIntensity - Specular intensity multiplier (uSpecularIntensity)
 */
export const computePointLight = Fn(
  ([
    worldPos,
    N,
    V,
    lightPos,
    lightColor,
    lightIntensity,
    range,
    decay,
    surfaceColor,
    roughness,
    metallic,
    shadow,
    specularColor,
    specularIntensity,
  ]: [
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode,
    Vec3Node,
    FloatNode
  ]) => {
    // Light direction (fragment to light)
    // CRITICAL: Use safe normalize - lightVec can be zero if worldPos == lightPos
    const lightVec = sub(lightPos, worldPos)
    const distance = length(lightVec)
    const L = safeNormalizeUp(lightVec)

    // Two-sided lighting: abs() ensures back faces are lit correctly
    // WebGL: float NdotL = abs(dot(normal, l));
    const NdotL = abs(dot(N, L))

    // Distance attenuation
    const attenuation = getDistanceAttenuationFull(distance, range, decay)

    // Base reflectivity: 0.04 for dielectrics, albedo for metals
    const F0 = vec3(0.04).mix(surfaceColor, metallic)

    // Fresnel for energy conservation
    // CRITICAL: Use safe normalize - L and V could be opposite
    const H = safeNormalize3(add(L, V), N)
    const HdotV = max(dot(H, V), float(0))

    // Fresnel-Schlick approximation
    const t = float(1).sub(HdotV)
    const t2 = t.mul(t)
    const t5 = t2.mul(t2).mul(t)
    const F = add(F0, sub(vec3(1), F0).mul(t5))

    // kS is specular reflectance, kD is diffuse
    const kS = F
    const kD = sub(vec3(1), kS).mul(float(1).sub(metallic))

    // Lambertian diffuse (albedo/PI)
    const diffuse = kD.mul(surfaceColor).div(PI)

    // Cook-Torrance specular with artist modulation (WebGL pattern)
    const specular = computePBRSpecular(N, V, L, roughness, F0)
      .mul(specularColor)
      .mul(specularIntensity)

    // Combine with light color, intensity, attenuation and shadow
    // WebGL: diffuse * lightColor * NdotL * attenuation * shadow
    //      + specular * specularColor * lightColor * NdotL * specularIntensity * attenuation * shadow
    return add(diffuse, specular)
      .mul(lightColor)
      .mul(lightIntensity)
      .mul(NdotL)
      .mul(attenuation)
      .mul(shadow)
  }
)

/**
 * Compute spot light contribution
 * Matches WebGL compose.ts pattern: diffuse and specular modulated separately
 *
 * @param specularColor - Artist-controlled specular tint (uSpecularColor)
 * @param specularIntensity - Specular intensity multiplier (uSpecularIntensity)
 */
export const computeSpotLight = Fn(
  ([
    worldPos,
    N,
    V,
    lightPos,
    lightDir,
    lightColor,
    lightIntensity,
    range,
    decay,
    cosInner,
    cosOuter,
    surfaceColor,
    roughness,
    metallic,
    shadow,
    specularColor,
    specularIntensity,
  ]: [
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode,
    FloatNode,
    FloatNode,
    Vec3Node,
    FloatNode,
    FloatNode,
    FloatNode,
    Vec3Node,
    FloatNode
  ]) => {
    // Light vector (fragment to light)
    // CRITICAL: Use safe normalize - lightVec can be zero if worldPos == lightPos
    const lightVec = sub(lightPos, worldPos)
    const distance = length(lightVec)
    const L = safeNormalizeUp(lightVec)
    const lightToFrag = safeNormalizeUp(sub(worldPos, lightPos))

    // Two-sided lighting: abs() ensures back faces are lit correctly
    // WebGL: float NdotL = abs(dot(normal, l));
    const NdotL = abs(dot(N, L))

    // Distance attenuation
    const distanceAtten = getDistanceAttenuationFull(distance, range, decay)

    // Spot cone attenuation (smoothstep between outer and inner angles)
    const cosTheta = dot(lightToFrag, lightDir)
    const spotT = cosTheta.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
    const spotAtten = pow(min(max(spotT, float(0)), float(1)), float(2))

    const attenuation = distanceAtten.mul(spotAtten)

    // Base reflectivity
    const F0 = vec3(0.04).mix(surfaceColor, metallic)

    // Fresnel-Schlick
    // CRITICAL: Use safe normalize - L and V could be opposite
    const H = safeNormalize3(add(L, V), N)
    const HdotV = max(dot(H, V), float(0))
    const t = float(1).sub(HdotV)
    const t2 = t.mul(t)
    const t5 = t2.mul(t2).mul(t)
    const F = add(F0, sub(vec3(1), F0).mul(t5))

    // kD for diffuse
    const kS = F
    const kD = sub(vec3(1), kS).mul(float(1).sub(metallic))

    // Lambertian diffuse
    const diffuse = kD.mul(surfaceColor).div(PI)

    // Cook-Torrance specular with artist modulation (WebGL pattern)
    const specular = computePBRSpecular(N, V, L, roughness, F0)
      .mul(specularColor)
      .mul(specularIntensity)

    // Combine
    return add(diffuse, specular)
      .mul(lightColor)
      .mul(lightIntensity)
      .mul(NdotL)
      .mul(attenuation)
      .mul(shadow)
  }
)

/**
 * SSS callback type for per-light SSS computation
 * Called inside the light loop for each active light
 *
 * @param lightDir - Direction from fragment to light (normalized)
 * @param viewDir - Direction from fragment to camera (normalized)
 * @param normal - Surface normal
 * @param attenuation - Combined distance/spot attenuation (0-1)
 * @param lightColor - Light color (vec3)
 * @returns SSS contribution for this light (vec3)
 */
export type SSSCallback = (
  lightDir: Vec3Node,
  viewDir: Vec3Node,
  normal: Vec3Node,
  attenuation: FloatNode,
  lightColor: Vec3Node
) => Vec3Node

/**
 * Specular modulation parameters for artist control
 */
export interface SpecularModulation {
  /** Specular color tint (default: white) */
  color: Vec3Node
  /** Specular intensity multiplier (default: 1.0) */
  intensity: FloatNode
}

/**
 * Options for multi-light node creation
 */
export interface MultiLightOptions {
  /** Callback to get shadow factor for light index (legacy approach) */
  getShadowForLight?: (lightIndex: IntNode, worldPos: Vec3Node) => FloatNode
  /** Pre-computed shadows for all 4 lights (vec4, optimized approach) */
  precomputedShadows?: ReturnType<typeof vec4>
  /** SSS callback for per-light SSS computation */
  getSSSForLight?: SSSCallback
  /** Specular modulation parameters */
  specularMod?: SpecularModulation
}

// Type for precomputed shadows (vec4 where xyzw = shadow factors for lights 0-3)
type Vec4Node = ReturnType<typeof vec4>

/**
 * Create a multi-light node that loops over all lights
 *
 * @param uniforms - Multi-light uniforms (using uniformArray)
 * @param getShadowForLight - Optional callback to get shadow factor for light index (DEPRECATED: use precomputedShadows)
 * @param getSSSForLight - Optional callback to get SSS contribution per light (WebGL pattern)
 * @param specularMod - Optional specular color/intensity modulation (WebGL uSpecularColor/uSpecularIntensity)
 * @param precomputedShadows - Optional vec4 of pre-sampled shadow factors (WebGPU-safe, no nested Fn)
 * @returns TSL Fn that computes total light contribution (vec4: xyz = color, w = totalNdotL for Fresnel)
 */
export const createMultiLightNode = (
  uniforms: LightTSLUniforms,
  getShadowForLight?: (lightIndex: IntNode, worldPos: Vec3Node) => FloatNode,
  getSSSForLight?: SSSCallback,
  specularMod?: SpecularModulation
) => {
  return Fn(
    ([worldPos, N, V, surfaceColor, roughness, metallic, precomputedShadows]: [
      Vec3Node,
      Vec3Node,
      Vec3Node,
      Vec3Node,
      FloatNode,
      FloatNode,
      Vec4Node // 7th parameter: precomputed shadow factors (x,y,z,w = lights 0,1,2,3)
    ]) => {
      // Default specular modulation (no change)
      const specColor = specularMod?.color ?? vec3(1, 1, 1)
      const specIntensity = specularMod?.intensity ?? float(1)
      // Accumulate light contributions - use unnamed toVar() to avoid naming conflicts
      const totalLight = vec3(0, 0, 0).toVar()
      // Track maximum NdotL * attenuation for Fresnel rim modulation (WebGL parity)
      // WebGL: totalNdotL = max(totalNdotL, NdotL * attenuation)
      const totalNdotL = float(0).toVar()

      // Unroll loop over MAX_LIGHTS using JavaScript for loop
      // CRITICAL: Using JS for loop instead of TSL Loop() because uniformArray.element()
      // with a TSL IntNode index causes "Invalid PipelineLayout" WebGPU errors.
      // With JS loop, each .element(i) uses a constant number that gets compiled statically.
      for (let i = 0; i < MAX_LIGHTS; i++) {
        // Skip if light index >= numLights OR light is disabled
        // WebGL pattern: if (i >= uNumLights) break; if (!uLightsEnabled[i]) continue;
        const isInRange = int(i).lessThan(uniforms.uNumLights)
        const isEnabled = uniforms.uLightsEnabled.element(i).greaterThan(0.5)
        const isActive = isInRange.and(isEnabled)

        // Get light properties by index using .element() with constant JS index
        const lightPos = uniforms.uLightPositions.element(i)
        const lightDir = uniforms.uLightDirections.element(i)
        const lightColor = uniforms.uLightColors.element(i)
        const lightType = uniforms.uLightTypes.element(i)
        const lightIntensity = float(uniforms.uLightIntensities.element(i))
        const range = float(uniforms.uLightRanges.element(i))
        const decay = float(uniforms.uLightDecays.element(i))
        const cosInner = float(uniforms.uSpotCosInner.element(i))
        const cosOuter = float(uniforms.uSpotCosOuter.element(i))

        // Get shadow factor for this light from precomputedShadows (passed as 7th param)
        // precomputedShadows.xyzw = shadow factors for lights 0,1,2,3
        // If all components are 1.0, shadows are disabled
        // Using precomputedShadows avoids nested Fn() calls that break WebGPU pipeline
        // NOTE: Since i is a JS constant, use direct component access instead of select()
        const shadow = i === 0 ? precomputedShadows.x
          : i === 1 ? precomputedShadows.y
          : i === 2 ? precomputedShadows.z
          : i === 3 ? precomputedShadows.w
          : float(1) // Lights 4-7: no shadow support (only 4 shadow maps)

        // Compute light contribution based on type
        const isPoint = lightType.equal(LIGHT_TYPE_POINT)
        const isDirectional = lightType.equal(LIGHT_TYPE_DIRECTIONAL)
        const isSpot = lightType.equal(LIGHT_TYPE_SPOT)

        // Directional light with specular modulation (inline to avoid modifying shared function)
        // Matches WebGL pattern: diffuse * lightColor + specular * specularColor * specularIntensity * lightColor
        // CRITICAL: Use safe normalize - lightDir could be zero (disabled light)
        const L_dir = safeNormalizeUp(vec3(lightDir).negate())
        // Two-sided lighting: abs() for back faces
        const NdotL_dir = abs(dot(N, L_dir))
        const F0_dir = vec3(0.04).mix(surfaceColor, metallic)
        // CRITICAL: Use safe normalize - L_dir and V could be opposite
        const H_dir = safeNormalize3(L_dir.add(V), N)
        const HdotV_dir = max(dot(H_dir, V), float(0))
        const F_dir = fresnelSchlick(HdotV_dir, F0_dir)
        const kD_dir = sub(vec3(1), F_dir).mul(float(1).sub(metallic))
        const diffuse_dir = kD_dir.mul(surfaceColor).div(PI)
        const specular_dir = computePBRSpecular(N, V, L_dir, roughness, F0_dir)
          .mul(specColor)
          .mul(specIntensity)
        const dirLight = diffuse_dir.add(specular_dir)
          .mul(vec3(lightColor))
          .mul(lightIntensity)
          .mul(NdotL_dir)
          .mul(shadow)

        // Point light with specular modulation
        const pointLight = computePointLight(
          worldPos,
          N,
          V,
          vec3(lightPos),
          vec3(lightColor),
          lightIntensity,
          range,
          decay,
          surfaceColor,
          roughness,
          metallic,
          shadow,
          specColor,
          specIntensity
        )

        // Spot light with specular modulation
        // CRITICAL: Use safe normalize - lightDir could be zero (disabled light)
        const spotLight = computeSpotLight(
          worldPos,
          N,
          V,
          vec3(lightPos),
          safeNormalize3(vec3(lightDir), vec3(0, -1, 0)),
          vec3(lightColor),
          lightIntensity,
          range,
          decay,
          cosInner,
          cosOuter,
          surfaceColor,
          roughness,
          metallic,
          shadow,
          specColor,
          specIntensity
        )

        // Select light contribution based on type
        const contribution = select(
          isDirectional,
          dirLight,
          select(isPoint, pointLight, select(isSpot, spotLight, vec3(0, 0, 0)))
        )

        // Add to total only if light is active
        totalLight.addAssign(select(isActive, contribution, vec3(0, 0, 0)))

        // Track totalNdotL for Fresnel rim modulation (WebGL parity)
        // WebGL: totalNdotL = max(totalNdotL, NdotL * attenuation)
        // Compute NdotL for each light type
        // CRITICAL: Use safe normalize - lightVec can be zero if worldPos == lightPos
        const lightVecForNdotL = sub(vec3(lightPos), worldPos)
        const distForNdotL = length(lightVecForNdotL)
        const L_pointForNdotL = safeNormalizeUp(lightVecForNdotL)
        // Note: L_dirForNdotL is same as L_dir above (light direction negated), already computed

        // Compute NdotL per light type (abs for two-sided)
        const NdotL_point = abs(dot(N, L_pointForNdotL))
        // NdotL_dir already computed above as NdotL_dir

        // Compute attenuation per light type for NdotL tracking
        const att_dir = float(1) // Directional: no distance attenuation, just intensity
        const att_point = getDistanceAttenuationFull(distForNdotL, range, decay)
        // Spot attenuation - CRITICAL: Use safe normalize
        const lightToFragNdotL = safeNormalizeUp(sub(worldPos, vec3(lightPos)))
        const cosThetaNdotL = dot(lightToFragNdotL, safeNormalize3(vec3(lightDir), vec3(0, -1, 0)))
        const spotTNdotL = cosThetaNdotL.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
        const spotAttenNdotL = pow(min(max(spotTNdotL, float(0)), float(1)), float(2))
        const att_spot = att_point.mul(spotAttenNdotL)

        // Select NdotL * attenuation based on light type
        const NdotL_times_att = select(
          isDirectional,
          NdotL_dir.mul(att_dir),
          select(isPoint, NdotL_point.mul(att_point), select(isSpot, NdotL_point.mul(att_spot), float(0)))
        )

        // Update totalNdotL with max (only if light is active)
        const candidateNdotL = select(isActive, NdotL_times_att, float(0))
        totalNdotL.assign(max(totalNdotL, candidateNdotL))

        // SSS contribution (per-light, WebGL pattern from compose.ts)
        // SSS needs: per-light direction L, per-light attenuation, per-light color
        if (getSSSForLight) {
          // Compute light direction for SSS (same as PBR uses)
          // CRITICAL: Use safe normalize - lightVec can be zero
          const lightVec = sub(vec3(lightPos), worldPos)
          const distance = length(lightVec)
          const L_point = safeNormalizeUp(lightVec)
          const L_dir_sss = safeNormalizeUp(vec3(lightDir).negate())
          const L_spot = L_point // Spot uses same direction as point

          // Compute attenuation for SSS
          const attDir = float(1) // Directional: no attenuation
          const attPoint = getDistanceAttenuationFull(distance, range, decay)
          // Spot attenuation: distance + angular - CRITICAL: Use safe normalize
          const lightToFrag = safeNormalizeUp(sub(worldPos, vec3(lightPos)))
          const cosTheta = dot(lightToFrag, safeNormalize3(vec3(lightDir), vec3(0, -1, 0)))
          const spotT = cosTheta.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
          const spotAtten = pow(min(max(spotT, float(0)), float(1)), float(2))
          const attSpot = attPoint.mul(spotAtten)

          // Select L and attenuation based on light type
          const L = select(isDirectional, L_dir_sss, select(isPoint, L_point, select(isSpot, L_spot, vec3(0, 1, 0))))
          const attenuation = select(isDirectional, attDir, select(isPoint, attPoint, select(isSpot, attSpot, float(0))))

          // Get SSS contribution from callback
          const sssContrib = getSSSForLight(L, V, N, attenuation, vec3(lightColor))

          // Add SSS only if light is active
          totalLight.addAssign(select(isActive, sssContrib, vec3(0, 0, 0)))
        }
      }

      // Return vec4: xyz = light contribution, w = totalNdotL (for Fresnel rim modulation)
      return vec4(totalLight.x, totalLight.y, totalLight.z, totalNdotL)
    }
  )
}

/**
 * Shadow uniforms type for inline sampling
 * NOTE: TSL texture.sample() expects vec2 UV, not vec3
 */
export interface InlineShadowUniforms {
  uShadowMap0: { sample: (uv: Vec2Node) => Vec4Node }
  uShadowMap1: { sample: (uv: Vec2Node) => Vec4Node }
  uShadowMap2: { sample: (uv: Vec2Node) => Vec4Node }
  uShadowMap3: { sample: (uv: Vec2Node) => Vec4Node }
  uShadowMatrix0: { mul: (v: Vec4Node) => Vec4Node }
  uShadowMatrix1: { mul: (v: Vec4Node) => Vec4Node }
  uShadowMatrix2: { mul: (v: Vec4Node) => Vec4Node }
  uShadowMatrix3: { mul: (v: Vec4Node) => Vec4Node }
  uShadowMapBias: FloatNode
  // WebGPU-safe (docs/tsl.md): vec4 components used instead of uniformArray.element(nodeIndex)
  uLightCastsShadow: { x: FloatNode; y: FloatNode; z: FloatNode; w: FloatNode }
}

type Vec4Node = ReturnType<typeof vec4>

/**
 * Create a multi-light node with INLINE shadow sampling.
 *
 * CRITICAL: Shadow sampling is done INLINE in this Fn() body, NOT via a separate Fn().
 * This avoids the "Invalid PipelineLayout" error caused by nested Fn() calls with textures.
 *
 * Each shadow texture is sampled exactly ONCE at the start, before the light loop.
 * The light loop then uses cheap select() on the pre-sampled float values.
 *
 * @param uniforms - Multi-light uniforms
 * @param shadowUniforms - Shadow map uniforms (null if shadows disabled)
 * @param getSSSForLight - Optional SSS callback
 * @param specularMod - Optional specular modulation
 */
export const createMultiLightNodeWithShadows = (
  uniforms: LightTSLUniforms,
  shadowUniforms: InlineShadowUniforms | null,
  getSSSForLight?: SSSCallback,
  specularMod?: SpecularModulation
) =>
  Fn(
    ([worldPos, N, V, surfaceColor, roughness, metallic]: [
      Vec3Node,
      Vec3Node,
      Vec3Node,
      Vec3Node,
      FloatNode,
      FloatNode
    ]) => {
      // Default specular modulation
      const specColor = specularMod?.color ?? vec3(1, 1, 1)
      const specIntensity = specularMod?.intensity ?? float(1)

      // Accumulate light contributions - use unnamed toVar() to avoid naming conflicts
      const totalLight = vec3(0, 0, 0).toVar()
      const totalNdotL = float(0).toVar()

      // ================================================================
      // INLINE SHADOW SAMPLING - Sample all 4 dir/spot shadow maps ONCE
      // This is done INLINE (not via separate Fn) to avoid pipeline errors
      // ================================================================
      let shadowVec4: ReturnType<typeof vec4>

      if (shadowUniforms) {
        const bias = shadowUniforms.uShadowMapBias

        // Helper to sample a single dir/spot shadow map
        const sampleDirSpotShadow = (
          shadowMap: { sample: (uv: Vec2Node) => Vec4Node },
          shadowMatrix: { mul: (v: Vec4Node) => Vec4Node },
          wPos: Vec3Node
        ) => {
          const pos4 = vec4(wPos, 1)
          const shadowCoord = shadowMatrix.mul(pos4)
          const w = max(abs(shadowCoord.w), float(0.0001))
          const projCoord = shadowCoord.xyz.div(w)
          // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
          const texCoordXY = projCoord.xy.mul(0.5).add(0.5)
          const currentDepth = clamp(projCoord.z, float(0), float(1))

          const outsideX = texCoordXY.x.lessThan(0).or(texCoordXY.x.greaterThan(1))
          const outsideY = texCoordXY.y.lessThan(0).or(texCoordXY.y.greaterThan(1))
          const outsideZ = currentDepth.lessThan(0).or(currentDepth.greaterThan(1))
          const outside = outsideX.or(outsideY).or(outsideZ)

          // CRITICAL: TSL texture.sample() expects vec2 UV, use .xy swizzle
          const closestDepth = shadowMap.sample(texCoordXY).x
          const inShadow = currentDepth.greaterThan(closestDepth.add(bias))

          return select(outside, float(1), select(inShadow, float(0), float(1)))
        }

        // Sample all 4 shadow maps ONCE (INLINE, not via Fn call)
        const s0 = sampleDirSpotShadow(shadowUniforms.uShadowMap0, shadowUniforms.uShadowMatrix0, worldPos)
        const s1 = sampleDirSpotShadow(shadowUniforms.uShadowMap1, shadowUniforms.uShadowMatrix1, worldPos)
        const s2 = sampleDirSpotShadow(shadowUniforms.uShadowMap2, shadowUniforms.uShadowMatrix2, worldPos)
        const s3 = sampleDirSpotShadow(shadowUniforms.uShadowMap3, shadowUniforms.uShadowMatrix3, worldPos)

        // Apply castsShadow flags using vec4 components (x,y,z,w = lights 0,1,2,3)
        // NOTE: Using vec4.x/y/z/w instead of uniformArray.element() because
        // uniformArray.element() causes "Invalid PipelineLayout" errors in WebGPU
        const cs0 = shadowUniforms.uLightCastsShadow.x.greaterThan(0.5)
        const cs1 = shadowUniforms.uLightCastsShadow.y.greaterThan(0.5)
        const cs2 = shadowUniforms.uLightCastsShadow.z.greaterThan(0.5)
        const cs3 = shadowUniforms.uLightCastsShadow.w.greaterThan(0.5)

        // No toVar() needed - shadowVec4 is only read, never mutated
        shadowVec4 = vec4(
          select(cs0, s0, float(1)),
          select(cs1, s1, float(1)),
          select(cs2, s2, float(1)),
          select(cs3, s3, float(1))
        )
      } else {
        shadowVec4 = vec4(1, 1, 1, 1)
      }

      // Helper to get shadow for light index from pre-computed vec4
      // NOTE: Now takes JS number since we use unrolled for loop
      const getShadowForIndex = (idx: number) =>
        idx === 0 ? shadowVec4.x
          : idx === 1 ? shadowVec4.y
          : idx === 2 ? shadowVec4.z
          : idx === 3 ? shadowVec4.w
          : float(1) // Lights 4-7: no shadow support

      // Unroll loop over MAX_LIGHTS using JavaScript for loop
      // CRITICAL: Using JS for loop instead of TSL Loop() because uniformArray.element()
      // with a TSL IntNode index causes "Invalid PipelineLayout" WebGPU errors.
      for (let i = 0; i < MAX_LIGHTS; i++) {
        const isInRange = int(i).lessThan(uniforms.uNumLights)
        const isEnabled = uniforms.uLightsEnabled.element(i).greaterThan(0.5)
        const isActive = isInRange.and(isEnabled)

        // Get light properties using .element() with constant JS index
        const lightPos = uniforms.uLightPositions.element(i)
        const lightDir = uniforms.uLightDirections.element(i)
        const lightColor = uniforms.uLightColors.element(i)
        const lightType = uniforms.uLightTypes.element(i)
        const lightIntensity = float(uniforms.uLightIntensities.element(i))
        const range = float(uniforms.uLightRanges.element(i))
        const decay = float(uniforms.uLightDecays.element(i))
        const cosInner = float(uniforms.uSpotCosInner.element(i))
        const cosOuter = float(uniforms.uSpotCosOuter.element(i))

        // Get shadow from pre-computed values (cheap select on floats)
        const shadow = getShadowForIndex(i)

        // Light type checks
        const isPoint = lightType.equal(LIGHT_TYPE_POINT)
        const isDirectional = lightType.equal(LIGHT_TYPE_DIRECTIONAL)
        const isSpot = lightType.equal(LIGHT_TYPE_SPOT)

        // Directional light
        const L_dir = safeNormalizeUp(vec3(lightDir).negate())
        const NdotL_dir = abs(dot(N, L_dir))
        const F0_dir = vec3(0.04).mix(surfaceColor, metallic)
        const H_dir = safeNormalize3(L_dir.add(V), N)
        const HdotV_dir = max(dot(H_dir, V), float(0))
        const F_dir = fresnelSchlick(HdotV_dir, F0_dir)
        const kD_dir = sub(vec3(1), F_dir).mul(float(1).sub(metallic))
        const diffuse_dir = kD_dir.mul(surfaceColor).div(PI)
        const specular_dir = computePBRSpecular(N, V, L_dir, roughness, F0_dir)
          .mul(specColor)
          .mul(specIntensity)
        const dirLight = diffuse_dir
          .add(specular_dir)
          .mul(vec3(lightColor))
          .mul(lightIntensity)
          .mul(NdotL_dir)
          .mul(shadow)

        // Point light
        const pointLight = computePointLight(
          worldPos,
          N,
          V,
          vec3(lightPos),
          vec3(lightColor),
          lightIntensity,
          range,
          decay,
          surfaceColor,
          roughness,
          metallic,
          shadow,
          specColor,
          specIntensity
        )

        // Spot light
        const spotLight = computeSpotLight(
          worldPos,
          N,
          V,
          vec3(lightPos),
          safeNormalize3(vec3(lightDir), vec3(0, -1, 0)),
          vec3(lightColor),
          lightIntensity,
          range,
          decay,
          cosInner,
          cosOuter,
          surfaceColor,
          roughness,
          metallic,
          shadow,
          specColor,
          specIntensity
        )

        // Select contribution based on type
        const contribution = select(
          isDirectional,
          dirLight,
          select(isPoint, pointLight, select(isSpot, spotLight, vec3(0, 0, 0)))
        )

        totalLight.addAssign(select(isActive, contribution, vec3(0, 0, 0)))

        // Track totalNdotL for Fresnel
        const lightVecForNdotL = sub(vec3(lightPos), worldPos)
        const distForNdotL = length(lightVecForNdotL)
        const L_pointForNdotL = safeNormalizeUp(lightVecForNdotL)
        const NdotL_point = abs(dot(N, L_pointForNdotL))
        const att_dir = float(1)
        const att_point = getDistanceAttenuationFull(distForNdotL, range, decay)
        const lightToFragNdotL = safeNormalizeUp(sub(worldPos, vec3(lightPos)))
        const cosThetaNdotL = dot(lightToFragNdotL, safeNormalize3(vec3(lightDir), vec3(0, -1, 0)))
        const spotTNdotL = cosThetaNdotL.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
        const spotAttenNdotL = pow(min(max(spotTNdotL, float(0)), float(1)), float(2))
        const att_spot = att_point.mul(spotAttenNdotL)
        const NdotL_times_att = select(
          isDirectional,
          NdotL_dir.mul(att_dir),
          select(isPoint, NdotL_point.mul(att_point), select(isSpot, NdotL_point.mul(att_spot), float(0)))
        )
        const candidateNdotL = select(isActive, NdotL_times_att, float(0))
        totalNdotL.assign(max(totalNdotL, candidateNdotL))

        // SSS contribution
        if (getSSSForLight) {
          const lightVec = sub(vec3(lightPos), worldPos)
          const distance = length(lightVec)
          const L_point = safeNormalizeUp(lightVec)
          const L_dir_sss = safeNormalizeUp(vec3(lightDir).negate())
          const L_spot = L_point
          const attDir = float(1)
          const attPoint = getDistanceAttenuationFull(distance, range, decay)
          const lightToFrag = safeNormalizeUp(sub(worldPos, vec3(lightPos)))
          const cosTheta = dot(lightToFrag, safeNormalize3(vec3(lightDir), vec3(0, -1, 0)))
          const spotT = cosTheta.sub(cosOuter).div(cosInner.sub(cosOuter).add(0.0001))
          const spotAtten = pow(min(max(spotT, float(0)), float(1)), float(2))
          const attSpot = attPoint.mul(spotAtten)
          const L = select(isDirectional, L_dir_sss, select(isPoint, L_point, select(isSpot, L_spot, vec3(0, 1, 0))))
          const attenuation = select(isDirectional, attDir, select(isPoint, attPoint, select(isSpot, attSpot, float(0))))
          const sssContrib = getSSSForLight(L, V, N, attenuation, vec3(lightColor))
          totalLight.addAssign(select(isActive, sssContrib, vec3(0, 0, 0)))
        }
      }

      return vec4(totalLight.x, totalLight.y, totalLight.z, totalNdotL)
    }
  )
