/**
 * TSL Polytope Shader Composition
 *
 * Composes TSL shader nodes conditionally based on feature flags.
 * Mirrors the WebGL pattern from src/rendering/shaders/polytope/compose.ts
 *
 * Key principle: Disabled features are completely absent from the shader graph,
 * not just branched at runtime via uniforms. This reduces shader complexity,
 * bind group requirements, and pipeline layout size.
 *
 * @module rendering/tsl/compose/polytope-compose
 */

import * as THREE from 'three'
import {
  abs,
  cameraPosition,
  clamp,
  dot,
  faceDirection,
  float,
  Fn,
  int,
  max,
  positionWorld,
  screenCoordinate,
  select,
  vec3,
  vec4,
  type Node,
} from 'three/tsl'
import { safeNormalizeUp } from '@/rendering/tsl/utils/safe-math'

import type { ColorTSLUniforms } from '@/rendering/tsl/color/color-uniforms'
import { rgb2hsl } from '@/rendering/tsl/color/conversions'
import { createColorSelector } from '@/rendering/tsl/color/selector'
import { createPolytopeSSSNode, type MeshSSSUniforms } from '@/rendering/tsl/features/mesh-sss'
import { computeIBL, type IBLTSLUniforms } from '@/rendering/tsl/lighting/ibl'
import { type FresnelTSLUniforms, type LightTSLUniforms } from '@/rendering/tsl/lighting/light-uniforms'
import { computeAmbient, createMultiLightNode } from '@/rendering/tsl/lighting/mesh-lighting'
import { computeScreenSpaceNormal } from '@/rendering/tsl/normals/screen-space-normals'
import { type ShadowTSLUniforms } from '@/rendering/tsl/shadows'

// =============================================================================
// Configuration Type
// =============================================================================

/**
 * Feature configuration for polytope TSL shader composition.
 * Each flag controls whether that feature's TSL nodes are included in the graph.
 */
export interface PolytopeTSLConfig {
  /** Include shadow sampling nodes (default: false) */
  shadows?: boolean
  /** Include subsurface scattering nodes (default: false) */
  sss?: boolean
  /** Include fresnel rim lighting nodes (default: false) */
  fresnel?: boolean
  /** Include image-based lighting nodes (default: false) */
  ibl?: boolean
}

/**
 * All uniforms needed for polytope shading.
 * Uses loose typing to accept uniform nodes from Three.js TSL.
 */
export interface PolytopeShadingUniforms {
  // Core appearance - accept any Node with value property
  uColor: Node
  uOpacity: Node

  // PBR
  uRoughness: Node
  uMetallic: Node
  uSpecularIntensity: Node
  uSpecularColor: Node

  // Color system
  color: ColorTSLUniforms

  // Lighting
  lighting: LightTSLUniforms

  // Optional feature uniforms (may be undefined if feature disabled)
  fresnel?: FresnelTSLUniforms
  sss?: MeshSSSUniforms
  ibl?: IBLTSLUniforms
  shadows?: ShadowTSLUniforms
}

// =============================================================================
// Shader Composition
// =============================================================================

/**
 * Compose polytope shading function with conditional feature inclusion.
 *
 * This is the TSL equivalent of composeFaceFragmentShader from WebGL.
 * Features are conditionally compiled - disabled features are completely
 * absent from the shader graph, not just branched at runtime.
 *
 * CRITICAL TSL PATTERN: Complex node compositions (shadow samplers, IBL nodes, etc.)
 * must be created OUTSIDE the Fn() at material creation scope, then referenced
 * inside Fn() via closure. Creating them inside Fn() causes WebGPU pipeline layout
 * errors because texture nodes end up in the wrong scope.
 *
 * @param config - Feature flags controlling what to include
 * @param uniforms - All uniforms (only those needed by enabled features are used)
 * @param faceDepthVarying - Face depth varying for color algorithms
 * @returns TSL Fn node that computes final shading color (vec3)
 */
export function composePolytopeTSLShading(
  config: PolytopeTSLConfig,
  uniforms: PolytopeShadingUniforms,
  faceDepthVarying: Node
): ReturnType<typeof Fn> {
  const {
    shadows: enableShadows = false,
    sss: enableSSS = false,
    fresnel: enableFresnel = false,
    ibl: enableIBL = false,
  } = config

  // ============================================================================
  // CRITICAL: Create complex nodes OUTSIDE Fn() at material creation scope
  // This matches GroundPlaneMaterialTSL pattern that works correctly.
  // Creating these inside Fn() causes "Invalid PipelineLayout" WebGPU errors.
  // ============================================================================

  // === SSS setup (conditional, OUTSIDE Fn) ===
  let getSSSForLight: (
    lightDir: ReturnType<typeof vec3>,
    V: ReturnType<typeof vec3>,
    N: ReturnType<typeof vec3>,
    attenuation: ReturnType<typeof float>,
    lightColor: ReturnType<typeof vec3>
  ) => ReturnType<typeof vec3>

  if (enableSSS && uniforms.sss) {
    const polytopeSSSNode = createPolytopeSSSNode(uniforms.sss)
    const sssIntensityU = float(uniforms.sss.uSssIntensity)

    getSSSForLight = (lightDir, V, N, attenuation, lightColor) => {
      const baseSSS = polytopeSSSNode(lightDir, V, N, screenCoordinate)
      const sssContrib = baseSSS.mul(lightColor).mul(attenuation)
      return select(sssIntensityU.greaterThan(0), sssContrib, vec3(0, 0, 0))
    }
  } else {
    // No SSS - always return 0
    getSSSForLight = () => vec3(0, 0, 0)
  }

  // === Shadow uniforms stored for INLINE sampling in OUTERMOST Fn() body ===
  // CRITICAL: Shadow textures MUST be sampled in the OUTERMOST Fn() body (the one that
  // becomes material.colorNode). Texture sampling in ANY nested Fn() breaks WebGPU pipeline.
  // We store shadow uniforms here and sample them at the TOP of the main Fn() body below.
  const shadowUniforms = enableShadows ? uniforms.shadows : undefined

  // === Multi-light node WITHOUT shadow sampling (OUTSIDE Fn) ===
  // createMultiLightNode takes precomputedShadows as 7th PARAMETER.
  // It uses select() on passed-in floats - NO texture sampling inside.
  // Shadow sampling happens in the OUTERMOST Fn() body and is passed as vec4.
  const specularMod = {
    color: vec3(uniforms.uSpecularColor),
    intensity: float(uniforms.uSpecularIntensity),
  }
  const multiLightNode = createMultiLightNode(
    uniforms.lighting,
    undefined, // No shadow callback - shadows passed as 7th param to Fn()
    getSSSForLight,
    specularMod
  )

  // === IBL node setup (conditional, OUTSIDE Fn) ===
  const iblNode = enableIBL && uniforms.ibl ? computeIBL(uniforms.ibl) : null

  // === Color selector (OUTSIDE Fn per docs/tsl.md Fix #4) ===
  const colorSelector = createColorSelector(uniforms.color)

  // ============================================================================
  // Fn() body - references pre-created nodes via closure
  // ============================================================================

  const mainFn = Fn(() => {
    // Configure flat interpolation for face depth
    // Type assertion needed because TSL types don't expose setInterpolation on Node
    const varyingNode = faceDepthVarying as unknown as {
      setInterpolation(type: THREE.InterpolationSamplingType, mode: THREE.InterpolationSamplingMode): void
    }
    varyingNode.setInterpolation(
      THREE.InterpolationSamplingType.FLAT,
      THREE.InterpolationSamplingMode.FIRST
    )
    const faceDepthAttr = faceDepthVarying

    // ============================================================================
    // CRITICAL: INLINE SHADOW SAMPLING AT TOP OF OUTERMOST Fn() BODY
    // WebGPU bind groups are fixed at material compile time. ALL texture sampling
    // MUST happen in this outermost Fn() body - never in nested Fn() calls.
    // We sample all 4 shadow maps HERE and pass the results (floats) to multiLightNode.
    // ============================================================================
    let precomputedShadows: ReturnType<typeof vec4>

    if (shadowUniforms) {
      const bias = float(shadowUniforms.uShadowMapBias)

      // Inline helper to sample a single directional/spot shadow map
      // This is a plain function, NOT an Fn() - it generates TSL nodes inline
      const sampleDirSpotShadowInline = (
        shadowMap: { sample: (uv: ReturnType<typeof vec3>) => ReturnType<typeof vec4> },
        shadowMatrix: { mul: (v: ReturnType<typeof vec4>) => ReturnType<typeof vec4> }
      ) => {
        const pos4 = vec4(positionWorld, 1)
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

        // Sample shadow map - use .xy for vec2 UV
        const closestDepth = shadowMap.sample(texCoordXY).x
        const inShadow = currentDepth.greaterThan(closestDepth.add(bias))

        return select(outside, float(1), select(inShadow, float(0), float(1)))
      }

      // Sample all 4 shadow maps INLINE at the TOP of this Fn() body
      const s0 = sampleDirSpotShadowInline(shadowUniforms.uShadowMap0, shadowUniforms.uShadowMatrix0)
      const s1 = sampleDirSpotShadowInline(shadowUniforms.uShadowMap1, shadowUniforms.uShadowMatrix1)
      const s2 = sampleDirSpotShadowInline(shadowUniforms.uShadowMap2, shadowUniforms.uShadowMatrix2)
      const s3 = sampleDirSpotShadowInline(shadowUniforms.uShadowMap3, shadowUniforms.uShadowMatrix3)

      // Apply castsShadow flags per light using vec4 components (x,y,z,w = lights 0,1,2,3)
      // NOTE: Using vec4.x/y/z/w instead of uniformArray.element() because
      // uniformArray.element() causes "Invalid PipelineLayout" errors in WebGPU
      const cs0 = shadowUniforms.uLightCastsShadow.x.greaterThan(0.5)
      const cs1 = shadowUniforms.uLightCastsShadow.y.greaterThan(0.5)
      const cs2 = shadowUniforms.uLightCastsShadow.z.greaterThan(0.5)
      const cs3 = shadowUniforms.uLightCastsShadow.w.greaterThan(0.5)

      precomputedShadows = vec4(
        select(cs0, s0, float(1)),
        select(cs1, s1, float(1)),
        select(cs2, s2, float(1)),
        select(cs3, s3, float(1))
      )
    } else {
      // No shadows - all lights fully lit
      precomputedShadows = vec4(1, 1, 1, 1)
    }

    // Screen-space normal from world position derivatives
    const normal = computeScreenSpaceNormal(positionWorld)

    // Two-sided lighting: flip normal for back faces
    const faceNormal = normal.mul(faceDirection)

    // View direction (from surface to camera)
    // CRITICAL: Use safe normalize - camera could theoretically be at surface position
    const viewDir = safeNormalizeUp(cameraPosition.sub(positionWorld))

    // Color algorithm - always included
    // NOTE: colorSelector is created OUTSIDE Fn() per docs/tsl.md Fix #4
    const baseHSL = rgb2hsl(vec3(uniforms.uColor))
    const surfaceColor = colorSelector(faceDepthAttr, faceNormal, baseHSL, positionWorld)

    // PBR parameters - always included
    const roughness = max(uniforms.uRoughness, float(0.04))
    const metallic = uniforms.uMetallic

    // F0: mix dielectric base (0.04) with albedo for metals
    const F0 = vec3(0.04, 0.04, 0.04).mix(surfaceColor, metallic)

    // Initialize lighting accumulator
    const litColor = vec3(0, 0, 0).toVar('litColor')

    // Ambient contribution - always included
    const ambient = computeAmbient(
      surfaceColor,
      vec3(uniforms.lighting.uAmbientColor),
      uniforms.lighting.uAmbientIntensity.mul(uniforms.lighting.uAmbientEnabled),
      metallic
    )
    litColor.addAssign(ambient)

    // Multi-light contribution with PRE-COMPUTED shadows
    // createMultiLightNode takes precomputedShadows as 7th parameter.
    // It uses select() on the passed-in floats - NO texture sampling inside.
    const lightResult = multiLightNode(
      positionWorld,
      faceNormal,
      viewDir,
      surfaceColor,
      roughness,
      metallic,
      precomputedShadows // 7th param: pre-sampled shadow factors (vec4)
    )
    const lightContribution = vec3(lightResult.x, lightResult.y, lightResult.z)
    const totalNdotL = lightResult.w
    litColor.addAssign(lightContribution)

    // === Fresnel rim (conditional) ===
    if (enableFresnel && uniforms.fresnel) {
      const NdotV = abs(dot(normal, viewDir))
      const fresnelIntensityU = float(uniforms.fresnel.uFresnelIntensity)
      const rimColor = vec3(uniforms.fresnel.uRimColor)

      const t = float(1).sub(NdotV)
      const tCubed = t.mul(t).mul(t)
      const rim = tCubed.mul(fresnelIntensityU).mul(2)
      const lightingMod = float(0.3).add(float(0.7).mul(totalNdotL))
      const fresnelContribution = rimColor.mul(rim).mul(lightingMod)
      litColor.addAssign(select(fresnelIntensityU.greaterThan(0), fresnelContribution, vec3(0, 0, 0)))
    }

    // === IBL (conditional, uses pre-created iblNode) ===
    if (iblNode) {
      const iblContribution = iblNode(faceNormal, viewDir, F0, roughness, metallic, surfaceColor)
      litColor.addAssign(iblContribution)
    }

    // Clamp to valid range
    return clamp(litColor, float(0), float(1))
  })
  return mainFn
}

/**
 * Get a descriptive name for the shader based on enabled features.
 * Used for compilation tracking overlay.
 */
export function getPolytopeTSLShaderName(config: PolytopeTSLConfig): string {
  const features: string[] = ['Polytope']

  if (config.shadows) features.push('Shadow')
  if (config.sss) features.push('SSS')
  if (config.fresnel) features.push('Fresnel')
  if (config.ibl) features.push('IBL')

  return features.join(' + ')
}
