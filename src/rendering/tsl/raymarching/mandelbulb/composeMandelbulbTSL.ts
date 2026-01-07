/**
 * TSL Mandelbulb Shader Composition
 *
 * Composes the Mandelbulb TSL material with:
 * - Dimension-specific SDF selection (3D-11D)
 * - Conditional feature inclusion (SSS, AO, Shadows, Fresnel)
 *
 * Mirrors the WebGL composeMandelbulbShader pattern where:
 * - SDF is selected at compose time based on dimension
 * - Features are EXCLUDED from the shader graph when disabled
 * - Material must be RECREATED when dimension/features change
 *
 * @module rendering/tsl/raymarching/mandelbulb/composeMandelbulbTSL
 */

import {
  depth,
  dot,
  float,
  Fn,
  If,
  int,
  length,
  max,
  smoothstep,
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

import {
  createMandelbulbSDFForDimension,
  createMandelbulbSimpleSDFForDimension,
  type MandelbulbUniforms,
} from './index'
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
 * Mandelbulb shader configuration for composition.
 */
export interface MandelbulbShaderConfig extends FractalShaderConfig {
  /** Current dimension (3-11) */
  dimension: number
}

/**
 * Uniforms created by composeMandelbulbTSL.
 * Only includes uniforms for enabled features.
 */
export interface ComposedMandelbulbUniforms {
  // Camera
  uCameraPosition: Vec3Uniform
  uResolution: UniformNode<THREE.Vector2>

  // Mandelbulb parameters
  uPower: UniformNode<number>
  uIterations: UniformNode<number>
  uEscapeRadius: UniformNode<number>
  uSdfSurfaceDistance: UniformNode<number>

  // Basis vectors (3 sets for full 11D support)
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform
  uBasisX1: Vec4Uniform
  uBasisY1: Vec4Uniform
  uBasisZ1: Vec4Uniform
  uOrigin1: Vec4Uniform
  uBasisX2: Vec4Uniform
  uBasisY2: Vec4Uniform
  uBasisZ2: Vec4Uniform
  uOrigin2: Vec4Uniform

  // Power animation (Technique B - power oscillation)
  // WebGL: uniform bool uPowerAnimationEnabled; uniform float uAnimatedPower;
  uPowerAnimationEnabled: UniformNode<boolean>
  uAnimatedPower: UniformNode<number>

  // Phase animation
  uPhaseEnabled: UniformNode<boolean>
  uPhaseTheta: UniformNode<number>
  uPhasePhi: UniformNode<number>

  // Alternate power
  uAlternatePowerEnabled: UniformNode<boolean>
  uAlternatePowerValue: UniformNode<number>
  uAlternatePowerBlend: UniformNode<number>

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

  // GPU Profiling mode (0=normal, 1=raymarch only, 2=raymarch+normal, 3=no shadows, 4=no lighting)
  // WebGL: uniform int uProfileMode;
  uProfileMode: UniformNode<number>

  // Debug visualization mode (0=off, 1=iteration heatmap, 2=depth, 3=normals)
  // WebGL: uniform int uDebugMode;
  uDebugMode: UniformNode<number>

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
 * Result of composing Mandelbulb TSL material.
 */
export interface ComposedMandelbulbMaterial {
  /** The composed material */
  material: MeshBasicNodeMaterial
  /** All uniforms (only includes enabled feature uniforms) */
  uniforms: ComposedMandelbulbUniforms
  /** List of enabled features */
  features: string[]
  /** Selected SDF name for debugging */
  sdfName: string
}

/**
 * Compose Mandelbulb TSL material with dimension-specific SDF and conditional features.
 *
 * This mirrors the WebGL composeMandelbulbShader pattern:
 * - SDF is SELECTED at compose time based on dimension (3D-11D)
 * - Features are EXCLUDED from the node graph when disabled
 * - Material must be RECREATED when dimension/features change
 *
 * @param config - Shader configuration including dimension and feature flags
 * @returns Composed material, uniforms, feature list, and SDF name
 */
export function composeMandelbulbTSL(config: MandelbulbShaderConfig): ComposedMandelbulbMaterial {
  const { dimension } = config

  // Process feature flags
  const flags = processFeatureFlags(config)

  // Determine SDF name for debugging
  const sdfName = `SDF ${dimension}D`

  // ============================================
  // Create uniforms (only for enabled features)
  // ============================================

  // Camera uniforms
  const uCameraPosition = uniform(new THREE.Vector3()) as Vec3Uniform
  const uResolution = uniform(new THREE.Vector2()) as UniformNode<THREE.Vector2>

  // Mandelbulb parameters
  const uPower = uniform(8.0)
  const uIterations = uniform(48.0)
  const uEscapeRadius = uniform(8.0)
  const uSdfSurfaceDistance = uniform(0.002)

  // Basis vectors - 3 sets for full 11D support
  const uBasisX0 = uniform(new THREE.Vector4(1, 0, 0, 0)) as Vec4Uniform
  const uBasisY0 = uniform(new THREE.Vector4(0, 1, 0, 0)) as Vec4Uniform
  const uBasisZ0 = uniform(new THREE.Vector4(0, 0, 1, 0)) as Vec4Uniform
  const uOrigin0 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisX1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisY1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisZ1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uOrigin1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisX2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisY2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisZ2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uOrigin2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform

  // Power animation (Technique B - power oscillation)
  // WebGL: uniform bool uPowerAnimationEnabled; uniform float uAnimatedPower;
  const uPowerAnimationEnabled = uniform(false)
  const uAnimatedPower = uniform(8.0) // Default to power 8 (standard Mandelbulb)

  // Phase animation
  const uPhaseEnabled = uniform(false)
  const uPhaseTheta = uniform(0.0)
  const uPhasePhi = uniform(0.0)

  // Alternate power
  const uAlternatePowerEnabled = uniform(false)
  const uAlternatePowerValue = uniform(4.0)
  const uAlternatePowerBlend = uniform(0.5)

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

  // GPU Profiling mode (0=normal, 1=raymarch only, 2=raymarch+normal, 3=no shadows, 4=no lighting)
  const uProfileMode = uniform(0)

  // Debug visualization mode (0=off, 1=iteration heatmap, 2=depth, 3=normals)
  const uDebugMode = uniform(0)

  // Build uniforms object
  const uniforms: ComposedMandelbulbUniforms = {
    uCameraPosition,
    uResolution,
    uPower,
    uIterations,
    uEscapeRadius,
    uSdfSurfaceDistance,
    uBasisX0,
    uBasisY0,
    uBasisZ0,
    uOrigin0,
    uBasisX1,
    uBasisY1,
    uBasisZ1,
    uOrigin1,
    uBasisX2,
    uBasisY2,
    uBasisZ2,
    uOrigin2,
    uPowerAnimationEnabled,
    uAnimatedPower,
    uPhaseEnabled,
    uPhaseTheta,
    uPhasePhi,
    uAlternatePowerEnabled,
    uAlternatePowerValue,
    uAlternatePowerBlend,
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
    // GPU Profiling and Debug modes
    uProfileMode,
    uDebugMode,
    // IBL uniforms (always created, quality=0 disables at runtime)
    ibl: createIBLTSLUniforms(),
  }

  // ============================================
  // MRT Storage nodes - MUST be created outside Fn() per MKB-001
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
  // Create dimension-specific SDF functions
  // ============================================

  const mandelbulbUniforms: MandelbulbUniforms = {
    uPower,
    uIterations,
    uEscapeRadius,
    uPowerAnimationEnabled,
    uAnimatedPower,
    uBasisX0,
    uBasisY0,
    uBasisZ0,
    uOrigin0,
    uBasisX1,
    uBasisY1,
    uBasisZ1,
    uOrigin1,
    uBasisX2,
    uBasisY2,
    uBasisZ2,
    uOrigin2,
    uPhaseEnabled,
    uPhaseTheta,
    uPhasePhi,
    uAlternatePowerEnabled,
    uAlternatePowerValue,
    uAlternatePowerBlend,
  }

  const qualityUniforms: RaymarchQualityUniforms = {
    uFastMode,
    uQualityMultiplier,
    uSdfSurfaceDistance,
  }

  // SELECT DIMENSION-SPECIFIC SDF AT COMPOSE TIME (not runtime!)
  const sdfWithTrap = createMandelbulbSDFForDimension(dimension, mandelbulbUniforms)
  const sdfSimple = createMandelbulbSimpleSDFForDimension(dimension, mandelbulbUniforms)

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

  // Shadow calculation (only if enabled at compose time)
  let shadowNode: ReturnType<typeof createSoftShadowNode> | null = null
  if (flags.useShadows && uniforms.uShadowQuality && uniforms.uShadowSoftness) {
    const shadowUniforms: ShadowUniforms = {
      uShadowQuality: uniforms.uShadowQuality,
      uShadowSoftness: uniforms.uShadowSoftness,
      uFastMode: uniforms.uFastMode, // Fast mode uses quality 0
    }
    shadowNode = createSoftShadowNode((p) => sdfSimple(p), shadowUniforms)
  }

  // AO calculation (only if enabled at compose time)
  let aoNode: ReturnType<typeof createAONode> | null = null
  if (flags.useAO && uniforms.uAoEnabled) {
    const aoUniforms: AOUniforms = {
      uAoEnabled: uniforms.uAoEnabled,
      uAoIntensity: uniforms.uAoIntensity,
    }
    aoNode = createAONode((p) => sdfSimple(p), aoUniforms)
  }

  // SSS calculation (only if enabled at compose time)
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

    // Raymarch - result is vec4(dist, trap, hit, iterations)
    const result = raymarch(roModel, rdModel)
    // Use unnamed toVar() to let TSL auto-generate unique names
    const hitDist = result.x.toVar()
    const orbitTrap = result.y.toVar()
    const hitFlag = result.z.toVar()
    const iterations = result.w.toVar()

    // WebGL: g_raymarchMaxIterations used for heatmap normalization
    // TSL uses maxSteps constant since we don't have globals
    const maxIterations = float(RAYMARCH_CONSTANTS.MAX_MARCH_STEPS_HQ)

    // Final output color (TSL pattern: use conditional assignment instead of early returns)
    const outputColor = vec4(0, 0, 0, 1).toVar()
    // Flag to track if we're in a special mode (debug/profile)
    const specialMode = float(0).toVar()

    // ============================================
    // Debug Mode 1: Iteration Heatmap
    // WebGL: Shows green→yellow→red gradient based on iteration count
    // Green = few iterations (efficient), Red = many iterations (expensive)
    // ============================================
    If(int(uDebugMode).equal(1), () => {
      const t = iterations.div(maxIterations)
      // Heatmap: green (low) → yellow (mid) → red (high)
      const heatR = smoothstep(float(0), float(0.5), t)
      const heatG = float(1).sub(smoothstep(float(0.5), float(1), t))
      const heatB = float(0)
      const heatmap = vec3(heatR, heatG, heatB).toVar('heatmap')
      // For misses, show slightly darker to distinguish from hits
      If(hitFlag.lessThan(0.5), () => {
        heatmap.assign(heatmap.mul(0.7))
      })
      outputColor.assign(vec4(heatmap, 1.0))
      specialMode.assign(1)
    })

    // Discard if miss (only when not in debug mode)
    If(hitFlag.lessThan(0.5).and(specialMode.lessThan(0.5)), () => {
      Discard()
    })

    // Hit point
    const p = roModel.add(rdModel.mul(hitDist))

    // ============================================
    // PROFILE MODE 1: Raymarch only - measure pure SDF iteration cost
    // WebGL: gColor = vec4(vec3(trap), 1.0);
    // ============================================
    If(int(uProfileMode).equal(1).and(specialMode.lessThan(0.5)), () => {
      outputColor.assign(vec4(vec3(orbitTrap, orbitTrap, orbitTrap), 1.0))
      specialMode.assign(1)
    })

    // Normal calculation (skip if in special mode to save computation)
    const n = vec3(0, 1, 0).toVar('normal')
    If(specialMode.lessThan(0.5).or(int(uProfileMode).greaterThanEqual(2)), () => {
      n.assign(getNormal(p))
    })

    // ============================================
    // MRT Updates - Store hit data for post-processing
    // ============================================
    If(hitFlag.greaterThan(0.5), () => {
      updateMRTRaymarched(mrtStorage, { uModelMatrix, uViewMatrix, uProjectionMatrix }, {
        hitPosLocal: p,
        normalLocal: n,
        hasHit: float(1),
      })
    })

    // ============================================
    // PROFILE MODE 2: Raymarch + normals - measure SDF + normal cost
    // WebGL: gColor = vec4(n * 0.5 + 0.5, 1.0);
    // ============================================
    If(int(uProfileMode).equal(2).and(specialMode.lessThan(0.5)), () => {
      outputColor.assign(vec4(n.mul(0.5).add(0.5), 1.0))
      specialMode.assign(1)
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

    // ============================================
    // PROFILE MODE 3: Raymarch + normals + AO - measure before lighting
    // WebGL: gColor = vec4(vec3(ao), 1.0);
    // ============================================
    If(int(uProfileMode).equal(3).and(specialMode.lessThan(0.5)), () => {
      outputColor.assign(vec4(vec3(aoFactor, aoFactor, aoFactor), 1.0))
      specialMode.assign(1)
    })

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
          // NOTE: surfaceColor already has AO baked in from line ~680, so NO additional .mul(aoFactor)
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
    // NOTE: iblNode is created OUTSIDE Fn() per docs/tsl.md Fix #4
    const F0_ibl = vec3(0.04, 0.04, 0.04).mix(surfaceColor, uMetallic)
    finalColor.addAssign(iblNode(n, viewDir, F0_ibl, roughness, uMetallic, surfaceColor))

    // Custom depth (matches WebGL gl_FragDepth exactly)
    // Note: updateMRTRaymarched already sets mrtClipDepth, we only need to set the main depth output
    const worldHitPos = uModelMatrix.mul(vec4(p, 1.0))
    const clipDepthValue = computeClipDepth({ uModelMatrix, uViewMatrix, uProjectionMatrix }, worldHitPos)
    ;(depth as unknown as { assign: (v: unknown) => void }).assign(clipDepthValue)

    // Assign final color to output for normal rendering
    If(specialMode.lessThan(0.5), () => {
      outputColor.assign(vec4(finalColor, 1.0))
    })

    return outputColor
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
    sdfName,
  }
}

