/**
 * TSL Julia Shader Composition
 *
 * Composes the Julia TSL material with conditional feature inclusion.
 * Mirrors the WebGL compose.ts pattern where features are conditionally
 * EXCLUDED from the shader graph (not just disabled via uniforms).
 *
 * @module rendering/tsl/raymarching/julia/composeJuliaTSL
 */

import {
  depth,
  dot,
  float,
  Fn,
  If,
  length,
  max,
  sub,
  uniform,
  vec3,
  vec4,
  positionWorld,
  viewportCoordinate,
  Discard,
} from 'three/tsl'
import { safeNormalize3 } from '../../utils/safe-math'

import {
  createMRTStorage,
  createMRTNode,
  updateMRTRaymarched,
  computeClipDepth,
} from '../../mrt'

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'

import type { UniformNode, Node } from 'three/tsl'

import { createJuliaSDF, createJuliaSDFSimple, type JuliaUniforms } from './julia-sdf'
import { createGetNormalTetra } from '../normals'
import {
  createRaymarch,
  createRaymarchWithTemporal,
  RAYMARCH_CONSTANTS,
  type RaymarchQualityUniforms,
  type TemporalUniforms,
} from '../raymarch-core'
import {
  computeAmbient,
  computeFresnelRim,
  computePBRSpecular,
  fastNormalize,
  fresnelSchlick,
  getDistanceAttenuation,
  getSpotAttenuation,
  LIGHT_TYPE_POINT,
  LIGHT_TYPE_DIRECTIONAL,
  LIGHT_TYPE_SPOT,
  MAX_LIGHTS,
} from '../lighting'
import { processFeatureFlags, type FractalShaderConfig } from '../../compose'
import { createSoftShadowNode, type ShadowUniforms } from '../../compose/feature-blocks/shadows'
import { createAONode, type AOUniforms } from '../../compose/feature-blocks/ao'
import { createSSSNode, type SSSUniforms } from '../../compose/feature-blocks/sss'
import { createTemporalUniforms } from '../../compose/feature-blocks/temporal'
import { createColorTSLUniforms, type ColorTSLUniforms } from '../../color/color-uniforms'
import { createColorSelector } from '../../color/selector'
import { rgb2hsl } from '../../color/conversions'
import { computeIBL, createIBLTSLUniforms, type IBLTSLUniforms } from '../../lighting/ibl'

// Type helpers
type Vec3Uniform = UniformNode<THREE.Vector3>
type Vec4Uniform = UniformNode<THREE.Vector4>
type ColorUniform = UniformNode<THREE.Color>

/**
 * Julia shader configuration for composition.
 */
export interface JuliaShaderConfig extends FractalShaderConfig {
  /** Current dimension (3-11) */
  dimension: number
}

/**
 * Uniforms created by composeJuliaTSL.
 * Only includes uniforms for enabled features.
 */
export interface ComposedJuliaUniforms {
  // Camera
  uCameraPosition: Vec3Uniform
  uResolution: UniformNode<THREE.Vector2>

  // Julia parameters
  uPower: UniformNode<number>
  uIterations: UniformNode<number>
  uEscapeRadius: UniformNode<number>
  uJuliaConstant: Vec4Uniform
  uDimension: UniformNode<number>
  uSdfSurfaceDistance: UniformNode<number>

  // Basis vectors
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform

  // Power animation
  uPowerAnimationEnabled: UniformNode<boolean>
  uAnimatedPower: UniformNode<number>

  // Quality
  uFastMode: UniformNode<boolean>
  uQualityMultiplier: UniformNode<number>

  // Color
  uColor: ColorUniform

  // Color algorithm uniforms (matches WebGL getColorByAlgorithm)
  color: ColorTSLUniforms

  // PBR
  uRoughness: UniformNode<number>
  uMetallic: UniformNode<number>
  uSpecularIntensity: UniformNode<number>
  uSpecularColor: ColorUniform

  // Ambient (always included)
  uAmbientEnabled: UniformNode<number>
  uAmbientColor: ColorUniform
  uAmbientIntensity: UniformNode<number>

  // Multi-light system (up to MAX_LIGHTS)
  uNumLights: UniformNode<number>
  uLightsEnabled: UniformNode<boolean>[]
  uLightTypes: UniformNode<number>[]
  uLightPositions: Vec3Uniform[]
  uLightDirections: Vec3Uniform[]
  uLightColors: ColorUniform[]
  uLightIntensities: UniformNode<number>[]
  uLightRanges: UniformNode<number>[]
  uLightDecays: UniformNode<number>[]
  uSpotCosInner: UniformNode<number>[]
  uSpotCosOuter: UniformNode<number>[]

  // Model matrices
  uModelMatrix: UniformNode<THREE.Matrix4>
  uInverseModelMatrix: UniformNode<THREE.Matrix4>

  // View/Projection matrices (for MRT depth calculation)
  uViewMatrix: UniformNode<THREE.Matrix4>
  uProjectionMatrix: UniformNode<THREE.Matrix4>

  // Conditional feature uniforms (only present if feature enabled)
  uFresnelEnabled?: UniformNode<boolean>
  uFresnelIntensity?: UniformNode<number>
  uRimColor?: ColorUniform

  uShadowEnabled?: UniformNode<boolean>
  uShadowQuality?: UniformNode<number>
  uShadowSoftness?: UniformNode<number>

  uAoEnabled?: UniformNode<boolean>
  uAoIntensity?: UniformNode<number>

  uSssEnabled?: UniformNode<boolean>
  uSssIntensity?: UniformNode<number>
  uSssColor?: ColorUniform
  uSssThickness?: UniformNode<number>
  uSssJitter?: UniformNode<number>

  // Temporal reprojection uniforms (only present if temporal enabled)
  // WebGL: uPrevPositionTexture, uTemporalEnabled, uDepthBufferResolution, uTemporalSafetyMargin
  temporal?: TemporalUniforms

  // IBL (Image-Based Lighting)
  ibl: IBLTSLUniforms
}

/**
 * Result of composing Julia TSL material.
 */
export interface ComposedJuliaMaterial {
  /** The composed material */
  material: MeshBasicNodeMaterial
  /** All uniforms (only includes enabled feature uniforms) */
  uniforms: ComposedJuliaUniforms
  /** List of enabled features */
  features: string[]
}

/**
 * Compose Julia TSL material with conditional feature inclusion.
 *
 * This mirrors the WebGL composeJuliaShader pattern:
 * - Features are EXCLUDED from the node graph when disabled
 * - Dimension-specific behavior handled via uniforms (Julia uses single SDF)
 * - Material must be RECREATED when features change
 *
 * @param config - Shader configuration
 * @returns Composed material, uniforms, and feature list
 */
export function composeJuliaTSL(config: JuliaShaderConfig): ComposedJuliaMaterial {
  // Process feature flags
  const flags = processFeatureFlags(config)

  // ============================================
  // Create uniforms (only for enabled features)
  // ============================================

  // Camera uniforms (always needed)
  const uCameraPosition = uniform(new THREE.Vector3()) as Vec3Uniform
  const uResolution = uniform(new THREE.Vector2()) as UniformNode<THREE.Vector2>

  // Julia parameters (always needed)
  const uPower = uniform(2.0)
  const uIterations = uniform(48.0)
  const uEscapeRadius = uniform(4.0)
  const uJuliaConstant = uniform(new THREE.Vector4(0.3, 0.5, 0.4, 0.2)) as Vec4Uniform
  const uDimension = uniform(config.dimension)
  const uSdfSurfaceDistance = uniform(0.002)

  // Basis vectors (always needed)
  const uBasisX0 = uniform(new THREE.Vector4(1, 0, 0, 0)) as Vec4Uniform
  const uBasisY0 = uniform(new THREE.Vector4(0, 1, 0, 0)) as Vec4Uniform
  const uBasisZ0 = uniform(new THREE.Vector4(0, 0, 1, 0)) as Vec4Uniform
  const uOrigin0 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform

  // Power animation
  const uPowerAnimationEnabled = uniform(false)
  const uAnimatedPower = uniform(2.0)

  // Quality
  const uFastMode = uniform(false)
  const uQualityMultiplier = uniform(1.0)

  // Color
  const uColor = uniform(new THREE.Color('#ffffff').convertSRGBToLinear()) as ColorUniform

  // Color algorithm uniforms (matches WebGL)
  const colorUniforms = createColorTSLUniforms()

  // PBR
  const uRoughness = uniform(0.3)
  const uMetallic = uniform(0.0)
  const uSpecularIntensity = uniform(1.0)
  const uSpecularColor = uniform(new THREE.Color('#ffffff')) as ColorUniform

  // Ambient (always included)
  const uAmbientEnabled = uniform(1.0)
  const uAmbientColor = uniform(new THREE.Color('#ffffff')) as ColorUniform
  const uAmbientIntensity = uniform(0.3)

  // Multi-light system
  const uNumLights = uniform(1)
  const uLightsEnabled: UniformNode<boolean>[] = []
  const uLightTypes: UniformNode<number>[] = []
  const uLightPositions: Vec3Uniform[] = []
  const uLightDirections: Vec3Uniform[] = []
  const uLightColors: ColorUniform[] = []
  const uLightIntensities: UniformNode<number>[] = []
  const uLightRanges: UniformNode<number>[] = []
  const uLightDecays: UniformNode<number>[] = []
  const uSpotCosInner: UniformNode<number>[] = []
  const uSpotCosOuter: UniformNode<number>[] = []

  // Initialize arrays for MAX_LIGHTS
  for (let i = 0; i < MAX_LIGHTS; i++) {
    uLightsEnabled.push(uniform(i === 0)) // Only first light enabled by default
    uLightTypes.push(uniform(LIGHT_TYPE_DIRECTIONAL))
    uLightPositions.push(uniform(new THREE.Vector3(0, 5, 0)) as Vec3Uniform)
    uLightDirections.push(uniform(new THREE.Vector3(-1, -1, -1).normalize()) as Vec3Uniform)
    uLightColors.push(uniform(new THREE.Color('#ffffff')) as ColorUniform)
    uLightIntensities.push(uniform(i === 0 ? 1.0 : 0.0))
    uLightRanges.push(uniform(0)) // 0 = infinite range
    uLightDecays.push(uniform(2)) // Physically correct
    uSpotCosInner.push(uniform(Math.cos(Math.PI / 6))) // 30 degrees
    uSpotCosOuter.push(uniform(Math.cos(Math.PI / 4))) // 45 degrees
  }

  // Model matrices
  const uModelMatrix = uniform(new THREE.Matrix4())
  const uInverseModelMatrix = uniform(new THREE.Matrix4())

  // View/Projection matrices (for custom depth calculation matching WebGL gl_FragDepth)
  const uViewMatrix = uniform(new THREE.Matrix4())
  const uProjectionMatrix = uniform(new THREE.Matrix4())

  // Build uniforms object
  const uniforms: ComposedJuliaUniforms = {
    uCameraPosition,
    uResolution,
    uPower,
    uIterations,
    uEscapeRadius,
    uJuliaConstant,
    uDimension,
    uSdfSurfaceDistance,
    uBasisX0,
    uBasisY0,
    uBasisZ0,
    uOrigin0,
    uPowerAnimationEnabled,
    uAnimatedPower,
    uFastMode,
    uQualityMultiplier,
    uColor,
    color: colorUniforms,
    uRoughness,
    uMetallic,
    uSpecularIntensity,
    uSpecularColor,
    uAmbientEnabled,
    uAmbientColor,
    uAmbientIntensity,
    uNumLights,
    uLightsEnabled,
    uLightTypes,
    uLightPositions,
    uLightDirections,
    uLightColors,
    uLightIntensities,
    uLightRanges,
    uLightDecays,
    uSpotCosInner,
    uSpotCosOuter,
    uModelMatrix,
    uInverseModelMatrix,
    uViewMatrix,
    uProjectionMatrix,
    // IBL uniforms (always created, quality=0 disables at runtime)
    ibl: createIBLTSLUniforms(),
  }

  // ============================================
  // MRT Storage - MUST be created outside Fn() per MKB-001
  // Uses shared helper for consistency with other raymarched objects
  // ============================================
  const mrtStorage = createMRTStorage()

  // Conditional feature uniforms
  if (flags.useFresnel) {
    uniforms.uFresnelEnabled = uniform(true)
    uniforms.uFresnelIntensity = uniform(0.5)
    uniforms.uRimColor = uniform(new THREE.Color('#ffffff')) as ColorUniform
  }

  if (flags.useShadows) {
    uniforms.uShadowEnabled = uniform(true)
    uniforms.uShadowQuality = uniform(2.0)
    uniforms.uShadowSoftness = uniform(0.5)
  }

  if (flags.useAO) {
    uniforms.uAoEnabled = uniform(true)
    uniforms.uAoIntensity = uniform(0.5)
  }

  if (flags.useSss) {
    uniforms.uSssEnabled = uniform(true)
    uniforms.uSssIntensity = uniform(0.3)
    uniforms.uSssColor = uniform(new THREE.Color('#ff8866')) as ColorUniform
    uniforms.uSssThickness = uniform(0.5)
    uniforms.uSssJitter = uniform(0.1) // WebGL default
  }

  // Temporal reprojection uniforms (only if enabled at compose time)
  // WebGL: #ifdef USE_TEMPORAL
  if (flags.useTemporal) {
    uniforms.temporal = createTemporalUniforms()
  }

  // ============================================
  // Create SDF functions
  // ============================================

  const juliaUniforms: JuliaUniforms = {
    uPower,
    uIterations,
    uEscapeRadius,
    uJuliaConstant,
    uDimension,
    uBasisX0,
    uBasisY0,
    uBasisZ0,
    uOrigin0,
    uPowerAnimationEnabled,
    uAnimatedPower,
  }

  const qualityUniforms: RaymarchQualityUniforms = {
    uFastMode,
    uQualityMultiplier,
    uSdfSurfaceDistance,
  }

  // Julia uses a single SDF for all dimensions (quaternion math handles it)
  const sdfWithTrap = createJuliaSDF(juliaUniforms)
  const sdfSimple = createJuliaSDFSimple(juliaUniforms)

  // Create normal calculator
  const getNormal = createGetNormalTetra((p) => sdfSimple(p))

  // Create raymarching function
  // Use temporal variant when temporal reprojection is enabled
  // WebGL: #ifdef USE_TEMPORAL uses RayMarch with temporal hint, else RayMarchNoTemporal
  const sdfWithTrapFn = (p: ReturnType<typeof vec3>) => {
    const result = sdfWithTrap(p)
    return { dist: result.x, trap: result.y }
  }

  const raymarch = flags.useTemporal && uniforms.temporal
    ? createRaymarchWithTemporal(
        sdfWithTrapFn,
        qualityUniforms,
        uniforms.temporal,
        RAYMARCH_CONSTANTS.BOUND_R
      )
    : createRaymarch(
        sdfWithTrapFn,
        qualityUniforms,
        RAYMARCH_CONSTANTS.BOUND_R
      )

  // ============================================
  // Conditional feature nodes
  // ============================================

  // Shadow calculation (only if enabled)
  let shadowNode: ReturnType<typeof createSoftShadowNode> | null = null
  if (flags.useShadows && uniforms.uShadowQuality && uniforms.uShadowSoftness) {
    const shadowUniforms: ShadowUniforms = {
      uShadowQuality: uniforms.uShadowQuality,
      uShadowSoftness: uniforms.uShadowSoftness,
      uFastMode: uniforms.uFastMode, // Fast mode uses quality 0
    }
    shadowNode = createSoftShadowNode((p) => sdfSimple(p), shadowUniforms)
  }

  // AO calculation (only if enabled)
  let aoNode: ReturnType<typeof createAONode> | null = null
  if (flags.useAO && uniforms.uAoEnabled && uniforms.uAoIntensity) {
    const aoUniforms: AOUniforms = {
      uAoEnabled: uniforms.uAoEnabled,
      uAoIntensity: uniforms.uAoIntensity,
    }
    aoNode = createAONode((p) => sdfSimple(p), aoUniforms)
  }

  // SSS calculation (only if enabled)
  let sssNode: ReturnType<typeof createSSSNode> | null = null
  if (flags.useSss && uniforms.uSssEnabled && uniforms.uSssIntensity && uniforms.uSssColor && uniforms.uSssThickness && uniforms.uSssJitter) {
    const sssUniforms: SSSUniforms = {
      uSssEnabled: uniforms.uSssEnabled,
      uSssIntensity: uniforms.uSssIntensity,
      uSssColor: uniforms.uSssColor,
      uSssThickness: uniforms.uSssThickness,
      uSssJitter: uniforms.uSssJitter,
    }
    sssNode = createSSSNode(sssUniforms)
  }

  // ============================================
  // Complex nodes MUST be created OUTSIDE Fn() per docs/tsl.md Fix #4
  // ============================================

  // Color selector for color algorithm - must be outside Fn()
  const colorSelector = createColorSelector(colorUniforms)

  // IBL node - must be outside Fn() (creates texture samplers)
  const iblNode = computeIBL(uniforms.ibl)

  // ============================================
  // Main raymarching shader
  // ============================================

  const raymarchShader = Fn(() => {
    const worldPos = positionWorld
    const cameraPos = uCameraPosition
    const invModel = uInverseModelMatrix

    // Transform to model space
    const roModel = invModel.mul(vec4(cameraPos, 1.0)).xyz.toVar('ro')
    // CRITICAL: Use safe normalize - camera could theoretically be at surface position
    const worldRayDir = safeNormalize3(sub(worldPos, cameraPos), vec3(0, 0, 1))
    const rdModel = safeNormalize3(invModel.mul(vec4(worldRayDir, 0.0)).xyz, vec3(0, 0, 1)).toVar('rd')

    // Raymarch
    const result = raymarch(roModel, rdModel)
    const hitDist = result.x.toVar('marchDist')
    const orbitTrap = result.y.toVar('orbitTrap')
    const hitFlag = result.z.toVar('hitFlag')

    // Discard if miss
    If(hitFlag.lessThan(0.5), () => {
      Discard()
    })

    // Hit point
    const p = roModel.add(rdModel.mul(hitDist))

    // Normal calculation
    const n = getNormal(p)

    // ============================================
    // MRT Updates - Store hit data for post-processing
    // Uses shared helper for consistency with other raymarched objects
    // ============================================
    If(hitFlag.greaterThan(0.5), () => {
      updateMRTRaymarched(mrtStorage, { uModelMatrix, uViewMatrix, uProjectionMatrix }, {
        hitPosLocal: p,
        normalLocal: n,
        hasHit: float(1),
      })
    })

    // View direction
    const viewDir = rdModel.negate()

    // Base color from orbit trap value (matches WebGL main.glsl.ts)
    // vec3 baseHSL = rgb2hsl(uColor);
    // float t = 1.0 - trap;
    // vec3 surfaceColor = getColorByAlgorithm(t, n, baseHSL, p);
    // NOTE: colorSelector is created OUTSIDE Fn() per docs/tsl.md Fix #4
    const t = float(1).sub(orbitTrap)
    const baseHSL = rgb2hsl(uColor)
    const surfaceColor = colorSelector(t, n, baseHSL, p).toVar('surfaceColor')

    // AO factor (only if AO enabled at compose time)
    // Matches WebGL: ao = uFastMode ? 1.0 : calcAO(p, n);
    // CRITICAL: AO must be computed BEFORE modifying surfaceColor (WebGL line 89-92)
    let aoFactor: Node = float(1)
    if (aoNode) {
      aoFactor = uniforms.uFastMode.select(float(1), aoNode(p, n))
    }

    // CRITICAL PARITY FIX: Apply AO to surfaceColor BEFORE ambient calculation
    // WebGL: surfaceColor *= (0.3 + 0.7 * ao);  (Line 106)
    // This ensures AO affects ambient, diffuse, AND specular (via F0 for metals)
    const aoModulator = float(0.3).add(float(0.7).mul(aoFactor))
    surfaceColor.mulAssign(aoModulator)

    // Ambient lighting (always included)
    // WebGL: col = surfaceColor * max(1.0 - uMetallic, 0.0) * uAmbientColor * uAmbientIntensity * uAmbientEnabled;
    // Now using AO-modified surfaceColor
    const ambient = computeAmbient(
      surfaceColor,
      uAmbientColor,
      uAmbientIntensity.mul(uAmbientEnabled),
      uMetallic
    )

    const finalColor = vec3(ambient).toVar('finalColor')

    // Track total NdotL for fresnel rim lighting
    const totalNdotL = float(0).toVar('totalNdotL')

    // Clamp roughness to prevent numerical issues
    const roughness = max(uRoughness, float(0.04))

    // ============================================
    // Multi-light loop (unrolled for MAX_LIGHTS=4)
    // ============================================

    // Helper to process a single light
    // Arrays are guaranteed to have MAX_LIGHTS elements (initialized in loop above)
    const processLight = (lightIndex: number) => {
      const enabled = uLightsEnabled[lightIndex]!
      const lightType = uLightTypes[lightIndex]!
      const lightPos = uLightPositions[lightIndex]!
      const lightDir = uLightDirections[lightIndex]!
      const lightColor = uLightColors[lightIndex]!
      const lightIntensity = uLightIntensities[lightIndex]!
      const lightRange = uLightRanges[lightIndex]!
      const lightDecay = uLightDecays[lightIndex]!
      const cosInner = uSpotCosInner[lightIndex]!
      const cosOuter = uSpotCosOuter[lightIndex]!

      If(enabled, () => {
        // Calculate light direction based on type
        const L = vec3(0, 1, 0).toVar(`lightDir${lightIndex}`)
        const attenuation = float(lightIntensity).toVar(`atten${lightIndex}`)
        // WebGL: float shadowMaxDist = lightType == LIGHT_TYPE_DIRECTIONAL ? 10.0 : length(uLightPositions[i] - p);
        const shadowMaxDist = float(10.0).toVar(`shadowMaxDist${lightIndex}`)

        // Directional light
        If(lightType.equal(LIGHT_TYPE_DIRECTIONAL), () => {
          L.assign(fastNormalize(lightDir.negate()))
          // shadowMaxDist stays at 10.0 for directional
        })

        // Point light
        If(lightType.equal(LIGHT_TYPE_POINT), () => {
          const diff = lightPos.sub(p)
          const dist = length(diff)
          L.assign(fastNormalize(diff))
          const distAtten = getDistanceAttenuation(dist, lightRange, lightDecay)
          attenuation.assign(lightIntensity.mul(distAtten))
          shadowMaxDist.assign(dist)
        })

        // Spot light
        If(lightType.equal(LIGHT_TYPE_SPOT), () => {
          const diff = lightPos.sub(p)
          const dist = length(diff)
          L.assign(fastNormalize(diff))
          const lightToFrag = fastNormalize(diff.negate())
          const distAtten = getDistanceAttenuation(dist, lightRange, lightDecay)
          const spotAtten = getSpotAttenuation(lightToFrag, lightDir, cosInner, cosOuter)
          attenuation.assign(lightIntensity.mul(distAtten).mul(spotAtten))
          shadowMaxDist.assign(dist)
        })

        // Skip if attenuation is too low (matches WebGL: if (attenuation < 0.001) continue;)
        If(attenuation.greaterThan(0.001), () => {
          // Shadow calculation
          const shadow = float(1).toVar(`shadow${lightIndex}`)
          if (shadowNode) {
            const shadowOffset = p.add(n.mul(0.02))
            shadow.assign(shadowNode(shadowOffset, L, shadowMaxDist))
          }

          // NdotL for this light
          const NdotL = max(dot(n, L), float(0))
          totalNdotL.assign(max(totalNdotL, NdotL.mul(attenuation).mul(shadow)))

          // ============================================
          // INLINE PBR (matches WebGL main.glsl.ts exactly)
          // ============================================

          // GGX Specular with energy conservation
          // CRITICAL: Use safe normalize - L + viewDir can be zero when opposite
          const halfDir = safeNormalize3(L.add(viewDir), n)

          // F0: mix dielectric base (0.04) with albedo for metals
          const F0 = vec3(0.04).mix(surfaceColor, uMetallic)
          const F = fresnelSchlick(max(dot(halfDir, viewDir), float(0)), F0)

          // Energy conservation: kS is specular reflectance, kD is diffuse
          const kS = F
          const kD = sub(vec3(1), kS).mul(float(1).sub(uMetallic))

          // Diffuse (energy-conserved, Lambertian BRDF = albedo/PI)
          // WebGL: col += kD * surfaceColor / PI * uLightColors[i] * NdotL * attenuation * shadow;
          // NOTE: surfaceColor already has AO baked in, so NO additional .mul(aoFactor)
          const PI = Math.PI
          const diffuseContrib = kD.mul(surfaceColor).div(PI)
            .mul(lightColor)
            .mul(NdotL)
            .mul(attenuation)
            .mul(shadow)
          finalColor.addAssign(diffuseContrib)

          // Specular (with artist-controlled color tint)
          // WebGL: col += specular * uSpecularColor * uLightColors[i] * NdotL * uSpecularIntensity * attenuation * shadow;
          // NOTE: AO is NOT applied to specular in WebGL - it affects surfaceColor/F0 for metals only
          const specular = computePBRSpecular(n, viewDir, L, roughness, F0)
          const specContrib = specular
            .mul(uSpecularColor)
            .mul(lightColor)
            .mul(NdotL)
            .mul(uSpecularIntensity)
            .mul(attenuation)
            .mul(shadow)
          finalColor.addAssign(specContrib)

          // SSS contribution per light (only if SSS enabled)
          if (sssNode) {
            // WebGL: computeSSS(L, viewDir, n, 0.5, power, 0.0, jitter, gl_FragCoord.xy)
            const sssContribution = sssNode(n, viewDir, L, lightColor, viewportCoordinate)
            finalColor.addAssign(sssContribution.mul(attenuation))
          }
        })
      })
    }

    // Process all lights (unrolled loop)
    processLight(0)
    processLight(1)
    processLight(2)
    processLight(3)

    // Fresnel rim lighting (only if fresnel enabled at compose time)
    if (flags.useFresnel && uniforms.uFresnelEnabled && uniforms.uFresnelIntensity && uniforms.uRimColor) {
      const rim = computeFresnelRim(
        n,
        viewDir,
        uniforms.uRimColor,
        uniforms.uFresnelIntensity,
        totalNdotL
      )
      finalColor.assign(finalColor.add(rim))
    }

    // IBL (environment reflections)
    // Matches WebGL: vec3 F0_ibl = mix(vec3(0.04), surfaceColor, uMetallic);
    // col += computeIBL(n, viewDir, F0_ibl, roughness, uMetallic, surfaceColor);
    // NOTE: iblNode created OUTSIDE Fn() per TSL docs Fix #4 (line 473)
    const F0_ibl = vec3(0.04, 0.04, 0.04).mix(surfaceColor, uMetallic)
    finalColor.addAssign(iblNode(n, viewDir, F0_ibl, roughness, uMetallic, surfaceColor))

    // Custom depth using shared helper for consistency
    // Note: updateMRTRaymarched already sets mrtClipDepth, we only need to set the main depth output
    const worldHitPos = uModelMatrix.mul(vec4(p, 1.0))
    const clipDepthValue = computeClipDepth({ uModelMatrix, uViewMatrix, uProjectionMatrix }, worldHitPos)
    ;(depth as unknown as { assign: (v: unknown) => void }).assign(clipDepthValue)

    return vec4(finalColor, 1.0)
  })

  // ============================================
  // Create material
  // ============================================

  const material = new MeshBasicNodeMaterial()
  material.side = THREE.BackSide
  material.colorNode = raymarchShader()

  // ============================================
  // MRT Configuration for post-processing passes
  // Uses shared helper for consistency with other raymarched objects
  // ============================================
  material.mrtNode = createMRTNode(mrtStorage)
  material.depthNode = mrtStorage.mrtClipDepth

  return {
    material,
    uniforms,
    features: flags.features,
  }
}

