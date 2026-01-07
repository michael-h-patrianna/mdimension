/**
 * TSL Shader Composition for Schrödinger N-dimensional Quantum Volume Visualizer
 *
 * Dynamically builds the TSL node graph based on:
 * - Dimension (3D-11D) - selects the appropriate evaluator
 * - Quantum mode (harmonicOscillator, hydrogenOrbital, hydrogenND)
 * - Features (isosurface vs volumetric, shadows, SSS, etc.)
 *
 * Mirrors the WebGL composeSchroedingerShader pattern but uses TSL nodes.
 *
 * Ported for parity with WebGL: shaders/schroedinger/compose.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/composeSchroedingerTSL
 */

import * as THREE from 'three'
import type { Node, UniformArrayNode, UniformNode } from 'three/tsl'
import {
  Break,
  Fn,
  If,
  Loop,
  abs,
  atan,
  clamp,
  dot,
  float,
  int,
  length,
  max,
  mrt,
  output,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  sqrt,
  sub,
  uniform,
  uniformArray,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
// texture3D is not exported from three/tsl types but exists at runtime
// Use texture() for 3D textures - TSL auto-detects Data3DTexture
import { texture3D } from 'three/src/nodes/accessors/Texture3DNode.js'
import { MeshBasicNodeMaterial } from 'three/webgpu'

/**
 * Extended material interface to include TSL node properties not in TypeScript definitions.
 * These properties are valid at runtime but not included in @types/three.
 */
type NodeMaterialWithMRT = MeshBasicNodeMaterial & {
  mrtNode?: ReturnType<typeof mrt>
  depthNode?: Node
}

import {
  createGetTemporalDepthNode,
  createTemporalUniforms,
  type TemporalUniforms,
} from '../../compose/feature-blocks/temporal'
import { createLightTSLUniforms, type LightTSLUniforms } from '../../lighting/light-uniforms'
import { safeNormalizeUp } from '../../utils/safe-math'
import { selectHydrogenNDEvaluator, type HydrogenNDUniforms } from './hydrogenND'
import { cexp_i, cmul, cscale } from './quantum/complex'
import { applyFlow, erodeDensity, gradientNoise, sFromRho } from './quantum/density'
import { MAX_DIM, MAX_TERMS, createHONDForTerm, type HONDUniforms } from './quantum/hoNDVariants'
import type { HOTextureResult } from './quantum/hoTexture'
import { evalHydrogenPsiTime } from './quantum/hydrogenPsi'
import {
  QUANTUM_MODE_HARMONIC,
  QUANTUM_MODE_HYDROGEN,
  QUANTUM_MODE_HYDROGEN_ND,
} from './quantum/psi'
import { computeAlpha } from './volume/absorption'
import { createComputeEmissionLit, type EmissionUniforms } from './volume/emission'

// Type aliases
type Vec3Uniform = UniformNode<THREE.Vector3>
type Vec4Uniform = UniformNode<THREE.Vector4>
type ColorUniform = UniformNode<THREE.Color>
type Mat4Uniform = UniformNode<THREE.Matrix4>
type FloatNode = ReturnType<typeof float>

// TSL atan is overloaded to accept 2 args (like atan2) but types don't reflect this
const atan2 = atan as unknown as (y: Node, x: Node) => FloatNode

// Constants
const MAX_VOLUME_SAMPLES = 64
const MIN_TRANSMITTANCE = 0.01

/**
 * Quantum mode for Schrödinger visualization.
 *
 * - harmonicOscillator: N-dimensional harmonic oscillator eigenstates
 * - hydrogenOrbital: Standard 3D hydrogen atom orbitals
 * - hydrogenND: N-dimensional hydrogen-like wavefunctions (hybrid approach)
 */
export type QuantumMode = 'harmonicOscillator' | 'hydrogenOrbital' | 'hydrogenND'

/**
 * Shader configuration for Schrödinger TSL composition.
 */
export interface SchroedingerShaderConfig {
  /** Current dimension (3-11) */
  dimension: number
  /** Quantum physics mode */
  quantumMode: QuantumMode
  /** Use isosurface rendering instead of volumetric */
  isosurface?: boolean
  /** Use temporal accumulation (Horizon-style 1/4 res reconstruction) - volumetric only */
  temporalAccumulation?: boolean
  /** Enable shadows */
  shadows?: boolean
  /** Enable ambient occlusion */
  ambientOcclusion?: boolean
  /** Enable SSS */
  sss?: boolean
  /** Enable fresnel */
  fresnel?: boolean
  /** Enable curl flow */
  curl?: boolean
  /** Enable dispersion */
  dispersion?: boolean
  /** Enable nodal surfaces */
  nodal?: boolean
  /** Enable energy coloring */
  energyColor?: boolean
  /** Enable shimmer */
  shimmer?: boolean
  /** Enable erosion */
  erosion?: boolean
  /**
   * Precomputed eigenfunction textures for harmonicOscillator mode.
   * When provided, uses O(1) texture lookups instead of inline computation.
   * This enables full 8-term support without shader graph explosion.
   * Generate via generateHOEigenfunctionTextures() from hoTexture.ts.
   */
  eigenfunctionTextures?: HOTextureResult
}

/**
 * Complete uniforms created by the composition function.
 * Matches WebGL schroedingerUniformsBlock structure.
 */
export interface ComposedSchroedingerUniforms {
  // Core
  uCameraPosition: Vec3Uniform
  uResolution: UniformNode<THREE.Vector2>
  uTime: UniformNode<number>
  uTimeScale: UniformNode<number>
  uModelMatrix: Mat4Uniform
  uInverseModelMatrix: Mat4Uniform
  uViewMatrix: Mat4Uniform
  uProjectionMatrix: Mat4Uniform
  uInverseViewProjectionMatrix: Mat4Uniform

  // Dimension
  uDimension: UniformNode<number>

  // Quantum mode selection
  uQuantumMode: UniformNode<number>

  // Harmonic oscillator state configuration
  uTermCount: UniformNode<number>
  // CRITICAL: Use UniformArrayNode for array uniforms (uniformArray() return type)
  uOmega: UniformArrayNode<number>
  uQuantum: UniformArrayNode<number>
  uCoeff: UniformArrayNode<THREE.Vector2>
  uEnergy: UniformArrayNode<number>

  // Hydrogen orbital configuration
  uPrincipalN: UniformNode<number>
  uAzimuthalL: UniformNode<number>
  uMagneticM: UniformNode<number>
  uBohrRadius: UniformNode<number>
  uUseRealOrbitals: UniformNode<boolean>

  // Hydrogen ND configuration
  uExtraDimN0: Vec4Uniform
  uExtraDimN1: Vec4Uniform
  uExtraDimOmega0: Vec4Uniform
  uExtraDimOmega1: Vec4Uniform
  uPhaseAnimationEnabled: UniformNode<boolean>

  // Basis vectors (packed as vec4)
  // Dimensions 0-3
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform
  // Dimensions 4-7
  uBasisX1: Vec4Uniform
  uBasisY1: Vec4Uniform
  uBasisZ1: Vec4Uniform
  uOrigin1: Vec4Uniform
  // Dimensions 8-10 (for 9D, 10D, 11D modes)
  uBasisX2: Vec4Uniform
  uBasisY2: Vec4Uniform
  uBasisZ2: Vec4Uniform
  uOrigin2: Vec4Uniform

  // Volume rendering
  uFieldScale: UniformNode<number>
  uDensityGain: UniformNode<number>
  uVolumeScale: UniformNode<number>
  uFastMode: UniformNode<boolean>
  uSampleCount: UniformNode<number>

  // Appearance
  uColor: ColorUniform
  uColorAlgorithm: UniformNode<number>
  uOpacity: UniformNode<number>
  uMetallic: UniformNode<number>
  uRoughness: UniformNode<number>

  // Color system uniforms (for algorithms 0-7)
  uCosineA: Vec3Uniform
  uCosineB: Vec3Uniform
  uCosineC: Vec3Uniform
  uCosineD: Vec3Uniform
  uDistPower: UniformNode<number>
  uDistCycles: UniformNode<number>
  uDistOffset: UniformNode<number>
  uLchLightness: UniformNode<number>
  uLchChroma: UniformNode<number>
  uMultiSourceWeights: Vec3Uniform

  // Lighting
  uAmbientColor: ColorUniform
  uAmbientIntensity: UniformNode<number>
  uAmbientEnabled: UniformNode<boolean>
  uSpecularColor: ColorUniform
  uSpecularIntensity: UniformNode<number>

  // Volume effects
  uPowderScale: UniformNode<number>
  uScatteringAnisotropy: UniformNode<number>

  // Emission
  uEmissionIntensity: UniformNode<number>
  uEmissionThreshold: UniformNode<number>
  uEmissionColorShift: UniformNode<number>
  uEmissionPulsing: UniformNode<boolean>

  // Fresnel/Rim
  uFresnelEnabled: UniformNode<boolean>
  uFresnelIntensity: UniformNode<number>
  uRimExponent: UniformNode<number>
  uRimColor: ColorUniform

  // Nodal
  uNodalEnabled: UniformNode<boolean>
  uNodalColor: ColorUniform
  uNodalStrength: UniformNode<number>

  // Energy color
  uEnergyColorEnabled: UniformNode<boolean>

  // Debug
  uDebugMode: UniformNode<number>

  // Isosurface
  uIsoEnabled: UniformNode<boolean>
  uIsoThreshold: UniformNode<number>

  // Temporal Accumulation (Horizon-style for volumetric)
  uBayerOffset: UniformNode<THREE.Vector2>
  uFullResolution: UniformNode<THREE.Vector2>

  // Multi-light system (extends LightTSLUniforms)
  uNumLights: UniformNode<number>
  uLightsEnabled: UniformArrayNode<number>
  uLightTypes: UniformArrayNode<number>
  uLightPositions: UniformArrayNode<THREE.Vector3>
  uLightDirections: UniformArrayNode<THREE.Vector3>
  uLightColors: UniformArrayNode<THREE.Vector3>
  uLightIntensities: UniformArrayNode<number>
  uLightRanges: UniformArrayNode<number>
  uLightDecays: UniformArrayNode<number>
  uSpotCosInner: UniformArrayNode<number>
  uSpotCosOuter: UniformArrayNode<number>

  // Volumetric shadows
  uShadowsEnabled: UniformNode<boolean>
  uShadowStrength: UniformNode<number>
  uShadowSteps: UniformNode<number>

  // Volumetric AO
  uAoEnabled: UniformNode<boolean>
  uAoStrength: UniformNode<number>
  uAoRadius: UniformNode<number>
  uAoSteps: UniformNode<number>
  uAoColor: ColorUniform

  // Subsurface Scattering
  uSssEnabled: UniformNode<boolean>
  uSssIntensity: UniformNode<number>
  uSssColor: ColorUniform
  uSssThickness: UniformNode<number>
  uSssJitter: UniformNode<number>

  // Erosion (edge erosion for volumetric clouds look)
  uErosionStrength: UniformNode<number>
  uErosionScale: UniformNode<number>
  uErosionTurbulence: UniformNode<number>
  uErosionNoiseType: UniformNode<number>

  // Curl Flow (animated flow distortion)
  uCurlEnabled: UniformNode<boolean>
  uCurlStrength: UniformNode<number>
  uCurlScale: UniformNode<number>
  uCurlSpeed: UniformNode<number>
  uCurlBias: UniformNode<number>

  // Shimmer (uncertainty shimmer effect)
  uShimmerEnabled: UniformNode<boolean>
  uShimmerStrength: UniformNode<number>

  // Dispersion (chromatic dispersion)
  uDispersionEnabled: UniformNode<boolean>
  uDispersionStrength: UniformNode<number>

  // Temporal reprojection (depth-skip optimization)
  temporal: TemporalUniforms
}

/**
 * Result of composition.
 */
export interface ComposedSchroedingerMaterial {
  material: MeshBasicNodeMaterial
  uniforms: ComposedSchroedingerUniforms
  features: string[]
}

/**
 * Compose the Schrödinger TSL material with dimension-specific density evaluation.
 *
 * @param config - Shader configuration
 * @returns Composed material, uniforms, and feature list
 */
export function composeSchroedingerTSL(
  config: SchroedingerShaderConfig
): ComposedSchroedingerMaterial {
  const { dimension, quantumMode, isosurface = false } = config

  const features: string[] = []
  features.push(`${dimension}D`)
  features.push(quantumMode)
  if (isosurface) features.push('Isosurface')
  else features.push('Volumetric')

  // ============================================
  // Create all uniforms matching WebGL structure
  // ============================================

  // Core transforms
  const uCameraPosition = uniform(new THREE.Vector3()) as Vec3Uniform
  const uResolution = uniform(new THREE.Vector2(1920, 1080))
  const uTime = uniform(0.0)
  const uTimeScale = uniform(1.0)
  const uModelMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uInverseModelMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uViewMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uProjectionMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uInverseViewProjectionMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform

  // Dimension and mode
  const uDimension = uniform(dimension)
  const uQuantumMode = uniform(
    quantumMode === 'harmonicOscillator'
      ? QUANTUM_MODE_HARMONIC
      : quantumMode === 'hydrogenOrbital'
        ? QUANTUM_MODE_HYDROGEN
        : QUANTUM_MODE_HYDROGEN_ND
  )

  // Harmonic oscillator configuration
  const uTermCount = uniform(1)
  // CRITICAL: Use uniformArray() for array uniforms - uniform() with arrays causes
  // "THREE.TSL: Error: Uniform 'null' not implemented" because TSL's getValueType()
  // doesn't recognize TypedArrays or JS arrays, returning null type
  const uOmega = uniformArray(
    Array.from({ length: MAX_DIM }, () => 1.0),
    'float'
  )
  const uQuantum = uniformArray(
    Array.from({ length: MAX_TERMS * MAX_DIM }, () => 0),
    'int'
  )
  // Ensure the arrays are sized to MAX_TERMS so element(k) access in the shader
  // never indexes past the allocated storage.
  const uCoeff = uniformArray(
    Array.from({ length: MAX_TERMS }, () => new THREE.Vector2(1, 0)),
    'vec2'
  )
  const uEnergy = uniformArray(
    Array.from({ length: MAX_TERMS }, () => 0.5),
    'float'
  )

  // Hydrogen orbital configuration
  const uPrincipalN = uniform(3.0)
  const uAzimuthalL = uniform(2.0)
  const uMagneticM = uniform(0.0)
  const uBohrRadius = uniform(1.0)
  const uUseRealOrbitals = uniform(true)

  // Hydrogen ND configuration
  const uExtraDimN0 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uExtraDimN1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uExtraDimOmega0 = uniform(new THREE.Vector4(1, 1, 1, 1)) as Vec4Uniform
  const uExtraDimOmega1 = uniform(new THREE.Vector4(1, 1, 1, 1)) as Vec4Uniform
  const uPhaseAnimationEnabled = uniform(false)

  // Basis vectors
  // Dimensions 0-3
  const uBasisX0 = uniform(new THREE.Vector4(1, 0, 0, 0)) as Vec4Uniform
  const uBasisY0 = uniform(new THREE.Vector4(0, 1, 0, 0)) as Vec4Uniform
  const uBasisZ0 = uniform(new THREE.Vector4(0, 0, 1, 0)) as Vec4Uniform
  const uOrigin0 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  // Dimensions 4-7
  const uBasisX1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisY1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisZ1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uOrigin1 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  // Dimensions 8-10 (for 9D, 10D, 11D modes) - uses xyz only, w unused
  const uBasisX2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisY2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uBasisZ2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform
  const uOrigin2 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform

  // Volume rendering
  const uFieldScale = uniform(1.0)
  const uDensityGain = uniform(1.0)
  const uVolumeScale = uniform(1.0)
  const uFastMode = uniform(false)
  const uSampleCount = uniform(64)

  // Appearance
  const uColor = uniform(new THREE.Color('#88ccff').convertSRGBToLinear()) as ColorUniform
  const uColorAlgorithm = uniform(0)
  const uOpacity = uniform(1.0)
  const uMetallic = uniform(0.0)
  const uRoughness = uniform(0.5)

  // Color system uniforms (for algorithms 0-7)
  const uCosineA = uniform(new THREE.Vector3(0.5, 0.5, 0.5)) as Vec3Uniform
  const uCosineB = uniform(new THREE.Vector3(0.5, 0.5, 0.5)) as Vec3Uniform
  const uCosineC = uniform(new THREE.Vector3(1.0, 1.0, 1.0)) as Vec3Uniform
  const uCosineD = uniform(new THREE.Vector3(0.0, 0.33, 0.67)) as Vec3Uniform
  const uDistPower = uniform(1.0)
  const uDistCycles = uniform(1.0)
  const uDistOffset = uniform(0.0)
  const uLchLightness = uniform(0.7)
  const uLchChroma = uniform(0.15)
  const uMultiSourceWeights = uniform(new THREE.Vector3(0.5, 0.25, 0.25)) as Vec3Uniform

  // Lighting
  const uAmbientColor = uniform(new THREE.Color('#ffffff')) as ColorUniform
  const uAmbientIntensity = uniform(0.3)
  const uAmbientEnabled = uniform(true)
  const uSpecularColor = uniform(new THREE.Color('#ffffff')) as ColorUniform
  const uSpecularIntensity = uniform(0.5)

  // Volume effects
  const uPowderScale = uniform(0.5)
  const uScatteringAnisotropy = uniform(0.0)

  // Emission
  const uEmissionIntensity = uniform(0.0)
  const uEmissionThreshold = uniform(0.5)
  const uEmissionColorShift = uniform(0.0)
  const uEmissionPulsing = uniform(false)

  // Fresnel/Rim
  const uFresnelEnabled = uniform(false)
  const uFresnelIntensity = uniform(0.5)
  const uRimExponent = uniform(3.0)
  const uRimColor = uniform(new THREE.Color('#ffffff')) as ColorUniform

  // Nodal
  const uNodalEnabled = uniform(false)
  const uNodalColor = uniform(new THREE.Color('#00ff00')) as ColorUniform
  const uNodalStrength = uniform(1.0)

  // Energy color
  const uEnergyColorEnabled = uniform(false)

  // Debug
  const uDebugMode = uniform(0)

  // Isosurface
  const uIsoEnabled = uniform(isosurface)
  const uIsoThreshold = uniform(-3.0)

  // Temporal Accumulation (Horizon-style for volumetric)
  const uBayerOffset = uniform(new THREE.Vector2(0, 0))
  const uFullResolution = uniform(new THREE.Vector2(1920, 1080))

  // Add temporal feature to feature list if enabled
  const useTemporalAccumulation = config.temporalAccumulation && !isosurface
  if (useTemporalAccumulation) {
    features.push('Temporal Accumulation (1/4 res)')
  }

  // Multi-light system (using createLightTSLUniforms helper)
  const lightUniforms: LightTSLUniforms = createLightTSLUniforms()
  const {
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
  } = lightUniforms

  // Volumetric shadows
  const uShadowsEnabled = uniform(config.shadows ?? false)
  const uShadowStrength = uniform(0.5)
  const uShadowSteps = uniform(4)

  // Volumetric AO
  const uAoEnabled = uniform(config.ambientOcclusion ?? false)
  const uAoStrength = uniform(0.5)
  const uAoRadius = uniform(0.5)
  const uAoSteps = uniform(4)
  const uAoColor = uniform(new THREE.Color('#000000')) as ColorUniform

  // Subsurface Scattering
  const uSssEnabled = uniform(config.sss ?? false)
  const uSssIntensity = uniform(0.5)
  const uSssColor = uniform(new THREE.Color('#ff8855')) as ColorUniform
  const uSssThickness = uniform(1.0)
  const uSssJitter = uniform(0.1)

  // Erosion (edge erosion for volumetric clouds look)
  // Matches WebGL uniforms.glsl.ts lines 66-69
  const uErosionStrength = uniform(config.erosion ? 0.3 : 0.0)
  const uErosionScale = uniform(1.0)
  const uErosionTurbulence = uniform(0.3)
  const uErosionNoiseType = uniform(0) // 0=Worley, 1=Perlin, 2=Hybrid

  // Curl Flow (animated flow distortion)
  // Matches WebGL uniforms.glsl.ts lines 70-74
  const uCurlEnabled = uniform(config.curl ?? false)
  const uCurlStrength = uniform(0.3)
  const uCurlScale = uniform(1.0)
  const uCurlSpeed = uniform(1.0)
  const uCurlBias = uniform(0) // 0=None, 1=Up, 2=Out, 3=In

  // Shimmer (uncertainty shimmer effect)
  // Matches WebGL uniforms.glsl.ts lines 91-92
  const uShimmerEnabled = uniform(config.shimmer ?? false)
  const uShimmerStrength = uniform(0.5)

  // Dispersion (chromatic dispersion)
  // Matches WebGL uniforms.glsl.ts lines 75-78
  const uDispersionEnabled = uniform(config.dispersion ?? false)
  const uDispersionStrength = uniform(0.3)

  // Temporal reprojection (depth-skip optimization)
  const temporalUniforms = createTemporalUniforms()

  const uniforms: ComposedSchroedingerUniforms = {
    uCameraPosition,
    uResolution,
    uTime,
    uTimeScale,
    uModelMatrix,
    uInverseModelMatrix,
    uViewMatrix,
    uProjectionMatrix,
    uInverseViewProjectionMatrix,
    uDimension,
    uQuantumMode,
    uTermCount,
    uOmega,
    uQuantum,
    uCoeff,
    uEnergy,
    uPrincipalN,
    uAzimuthalL,
    uMagneticM,
    uBohrRadius,
    uUseRealOrbitals,
    uExtraDimN0,
    uExtraDimN1,
    uExtraDimOmega0,
    uExtraDimOmega1,
    uPhaseAnimationEnabled,
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
    uFieldScale,
    uDensityGain,
    uVolumeScale,
    uFastMode,
    uSampleCount,
    uColor,
    uColorAlgorithm,
    uOpacity,
    uMetallic,
    uRoughness,
    // Color system uniforms for algorithms 0-7
    uCosineA,
    uCosineB,
    uCosineC,
    uCosineD,
    uDistPower,
    uDistCycles,
    uDistOffset,
    uLchLightness,
    uLchChroma,
    uMultiSourceWeights,
    uAmbientColor,
    uAmbientIntensity,
    uAmbientEnabled,
    uSpecularColor,
    uSpecularIntensity,
    uPowderScale,
    uScatteringAnisotropy,
    uEmissionIntensity,
    uEmissionThreshold,
    uEmissionColorShift,
    uEmissionPulsing,
    uFresnelEnabled,
    uFresnelIntensity,
    uRimExponent,
    uRimColor,
    uNodalEnabled,
    uNodalColor,
    uNodalStrength,
    uEnergyColorEnabled,
    uDebugMode,
    uIsoEnabled,
    uIsoThreshold,
    uBayerOffset,
    uFullResolution,
    // Multi-light system
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
    // Volumetric shadows
    uShadowsEnabled,
    uShadowStrength,
    uShadowSteps,
    // Volumetric AO
    uAoEnabled,
    uAoStrength,
    uAoRadius,
    uAoSteps,
    uAoColor,
    // Subsurface Scattering
    uSssEnabled,
    uSssIntensity,
    uSssColor,
    uSssThickness,
    uSssJitter,
    // Erosion
    uErosionStrength,
    uErosionScale,
    uErosionTurbulence,
    uErosionNoiseType,
    // Curl Flow
    uCurlEnabled,
    uCurlStrength,
    uCurlScale,
    uCurlSpeed,
    uCurlBias,
    // Shimmer
    uShimmerEnabled,
    uShimmerStrength,
    // Dispersion
    uDispersionEnabled,
    uDispersionStrength,
    // Temporal reprojection
    temporal: temporalUniforms,
  }

  // ============================================
  // Create dimension-specific evaluators
  // ============================================

  // Build HydrogenND uniforms
  const hydrogenUniforms: HydrogenNDUniforms = {
    uPrincipalN,
    uAzimuthalL,
    uMagneticM,
    uBohrRadius,
    uUseRealOrbitals,
    uDimension,
    uExtraDimN: [uExtraDimN0, uExtraDimN1],
    uExtraDimOmega: [uExtraDimOmega0, uExtraDimOmega1],
  }

  // Select dimension-specific evaluators
  const hydrogenNDEval = selectHydrogenNDEvaluator(dimension, hydrogenUniforms)

  // Create HO ND evaluator for harmonic oscillator mode
  // This evaluator computes the spatial eigenfunction Φ_k(x) for a given term
  const hoNDUniforms: HONDUniforms = {
    uOmega,
    uQuantum,
  }

  // ============================================
  // TEXTURE-BASED EIGENFUNCTION EVALUATION
  // When eigenfunctionTextures are provided, use O(1) texture lookups.
  // This enables full 8-term support without shader graph explosion.
  // ============================================
  const useTextureEigenfunctions = !!(
    config.eigenfunctionTextures &&
    config.eigenfunctionTextures.textures.length > 0 &&
    quantumMode === 'harmonicOscillator'
  )

  // Create texture uniform nodes for eigenfunction lookup
  // Each texture stores Φ_k(x,y,z) for one term k
  type Texture3DNode = ReturnType<typeof texture3D>
  const hoTextureNodes: Texture3DNode[] = []
  let hoTextureFieldScale = 5.0 // Default field scale

  if (useTextureEigenfunctions && config.eigenfunctionTextures) {
    const { textures, fieldScale, termCount } = config.eigenfunctionTextures
    hoTextureFieldScale = fieldScale

    // Create texture uniform nodes for each term
    for (let k = 0; k < Math.min(termCount, MAX_TERMS); k++) {
      const tex = textures[k]
      if (tex) {
        hoTextureNodes.push(texture3D(tex, null, 0))
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[composeSchroedingerTSL] Using texture-based eigenfunctions: ${hoTextureNodes.length} terms, fieldScale=${fieldScale}`)
    }
  }

  // FALLBACK: Create inline evaluators only if textures not available
  // Note: With MAX_TERMS=8, inline evaluation will cause freeze - textures are required!
  // We create max 2 evaluators for fallback to prevent freeze in edge cases.
  const FALLBACK_MAX_TERMS = 2
  const hoNDTermEvaluators = (!useTextureEigenfunctions && quantumMode === 'harmonicOscillator')
    ? Array.from({ length: FALLBACK_MAX_TERMS }, (_, k) => createHONDForTerm(dimension, hoNDUniforms, k))
    : []

  if (!useTextureEigenfunctions && quantumMode === 'harmonicOscillator' && import.meta.env.DEV) {
    console.warn(`[composeSchroedingerTSL] No eigenfunction textures provided - falling back to ${FALLBACK_MAX_TERMS}-term inline computation`)
  }

  // Build emission uniforms
  // CRITICAL: Only include shadow/AO/SSS uniforms when those features are ENABLED in config.
  // Unlike WebGL which uses #define preprocessor conditionals to exclude code paths,
  // TSL builds the shader graph based on which uniforms are present.
  // If shadow uniforms are passed, the shadow sampling loops are created - even if disabled at runtime.
  // This was causing shader graph explosion and WebGPU compilation freeze/crash.
  // Build color uniforms for algorithms 0-7
  const colorUniforms = {
    uColorAlgorithm,
    uCosineA,
    uCosineB,
    uCosineC,
    uCosineD,
    uDistPower,
    uDistCycles,
    uDistOffset,
    uLchLightness,
    uLchChroma,
    uMultiSourceWeights,
  }

  const emissionUniforms: EmissionUniforms = {
    uColor,
    uColorAlgorithm,
    uDensityGain,
    uTime,
    uTimeScale,
    uMetallic,
    uRoughness,
    uAmbientColor,
    uAmbientIntensity,
    uAmbientEnabled,
    uSpecularColor,
    uSpecularIntensity,
    uPowderScale,
    uScatteringAnisotropy,
    uEmissionIntensity,
    uEmissionThreshold,
    uEmissionColorShift,
    uEmissionPulsing,
    // Color system uniforms for algorithms 0-7
    colorUniforms,
    // Fresnel - only if enabled
    ...(config.fresnel
      ? {
          uFresnelEnabled,
          uFresnelIntensity,
          uRimExponent,
          uRimColor,
        }
      : {}),
    // Nodal surfaces - only if enabled
    ...(config.nodal
      ? {
          uNodalEnabled,
          uNodalColor,
          uNodalStrength,
        }
      : {}),
    // Energy color - only if enabled
    ...(config.energyColor
      ? {
          uEnergyColorEnabled,
        }
      : {}),
    // Multi-light system
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
    // Volumetric shadows - ONLY include if shadows enabled in config
    // This prevents shadow sampling loop nodes from being created when disabled
    ...(config.shadows
      ? {
          uShadowsEnabled,
          uShadowStrength,
          uShadowSteps,
          uFastMode,
        }
      : {}),
    // Volumetric AO - ONLY include if AO enabled in config
    // This prevents AO sampling loop nodes from being created when disabled
    ...(config.ambientOcclusion
      ? {
          uAoEnabled,
          uAoStrength,
          uAoRadius,
          uAoSteps,
          uAoColor,
        }
      : {}),
    // Subsurface Scattering - ONLY include if SSS enabled in config
    // This prevents SSS calculation nodes from being created when disabled
    ...(config.sss
      ? {
          uSssEnabled,
          uSssIntensity,
          uSssColor,
          uSssThickness,
          uSssJitter,
        }
      : {}),
  }

  // ============================================
  // Create density sampling function
  // Returns vec2(density, phase) for TSL compatibility
  //
  // Matches WebGL sampleDensity() and sampleDensityWithPhase():
  // 1. Apply curl flow to position (applyFlow)
  // 2. Map flowed position to ND coordinates
  // 3. Evaluate wavefunction
  // 4. Apply hydrogen boosts
  // 5. Apply erosion (erodeDensity)
  // 6. Apply shimmer (for phase-aware sampling)
  // ============================================

  const createDensitySampler = (dim: number) => {
    return Fn(([pos, time]: [Node, Node]) => {
      const animTime = uTime.mul(uTimeScale)
      const p = vec3(pos)

      // ============================================
      // Step 1: Apply Curl Flow (animated flow distortion)
      // Matches WebGL: vec3 flowedPos = applyFlow(pos, t);
      // ============================================
      const flowedPos = applyFlow(
        p,
        uCurlEnabled,
        uCurlStrength,
        uCurlScale,
        uCurlSpeed,
        uCurlBias,
        animTime
      )

      // ============================================
      // Step 2: Map flowed 3D position to ND coordinates
      // Matches WebGL: mapPosToND(flowedPos, xND);
      // ============================================
      const fp = vec3(flowedPos)
      const x0 = uOrigin0.x
        .add(fp.x.mul(uBasisX0.x))
        .add(fp.y.mul(uBasisY0.x))
        .add(fp.z.mul(uBasisZ0.x))
        .mul(uFieldScale)
      const x1 = uOrigin0.y
        .add(fp.x.mul(uBasisX0.y))
        .add(fp.y.mul(uBasisY0.y))
        .add(fp.z.mul(uBasisZ0.y))
        .mul(uFieldScale)
      const x2 = uOrigin0.z
        .add(fp.x.mul(uBasisX0.z))
        .add(fp.y.mul(uBasisY0.z))
        .add(fp.z.mul(uBasisZ0.z))
        .mul(uFieldScale)
      const x3 = uOrigin0.w
        .add(fp.x.mul(uBasisX0.w))
        .add(fp.y.mul(uBasisY0.w))
        .add(fp.z.mul(uBasisZ0.w))
        .mul(uFieldScale)
      const x4 = uOrigin1.x
        .add(fp.x.mul(uBasisX1.x))
        .add(fp.y.mul(uBasisY1.x))
        .add(fp.z.mul(uBasisZ1.x))
        .mul(uFieldScale)
      const x5 = uOrigin1.y
        .add(fp.x.mul(uBasisX1.y))
        .add(fp.y.mul(uBasisY1.y))
        .add(fp.z.mul(uBasisZ1.y))
        .mul(uFieldScale)
      const x6 = uOrigin1.z
        .add(fp.x.mul(uBasisX1.z))
        .add(fp.y.mul(uBasisY1.z))
        .add(fp.z.mul(uBasisZ1.z))
        .mul(uFieldScale)
      const x7 = uOrigin1.w
        .add(fp.x.mul(uBasisX1.w))
        .add(fp.y.mul(uBasisY1.w))
        .add(fp.z.mul(uBasisZ1.w))
        .mul(uFieldScale)
      // Dimensions 8-10 for 9D, 10D, 11D modes
      const x8 = uOrigin2.x
        .add(fp.x.mul(uBasisX2.x))
        .add(fp.y.mul(uBasisY2.x))
        .add(fp.z.mul(uBasisZ2.x))
        .mul(uFieldScale)
      const x9 = uOrigin2.y
        .add(fp.x.mul(uBasisX2.y))
        .add(fp.y.mul(uBasisY2.y))
        .add(fp.z.mul(uBasisZ2.y))
        .mul(uFieldScale)
      const x10 = uOrigin2.z
        .add(fp.x.mul(uBasisX2.z))
        .add(fp.y.mul(uBasisY2.z))
        .add(fp.z.mul(uBasisZ2.z))
        .mul(uFieldScale)

      // ============================================
      // Step 3: Evaluate wavefunction based on quantum mode
      // Matches WebGL psi.glsl.ts mode switching
      // ============================================
      // CRITICAL: Use anonymous toVar() inside Fn() to avoid TSL declaration name conflicts
      // Named toVar('psi') causes WGSL "var psi_17" conflicts when Fn() is invoked multiple times
      const psi = vec2(0, 0).toVar()

      // ============================================
      // CRITICAL PERFORMANCE FIX: Use JS conditionals instead of TSL If() blocks
      //
      // Before: All three quantum modes were compiled into ONE shader via TSL If()
      // This caused 14,000+ shader nodes and 20+ second WGSL compilation freeze.
      //
      // After: Only the selected mode's code is included in the shader.
      // Each mode creates a separate shader variant via the composition key.
      // ============================================

      // Harmonic Oscillator mode - JS-unrolled loop over terms
      // Matches WebGL psi.glsl.ts evalHarmonicOscillatorPsi():
      //   for (int k = 0; k < MAX_TERMS; k++) {
      //     float spatial = hoNDOptimized(xND, k);
      //     psi += cscale(spatial, cmul(uCoeff[k], cexp_i(-uEnergy[k] * t)));
      //   }
      if (quantumMode === 'harmonicOscillator') {
        // Determine which evaluation method to use
        const termCount = useTextureEigenfunctions ? hoTextureNodes.length : hoNDTermEvaluators.length

        if (useTextureEigenfunctions) {
          // ============================================
          // TEXTURE-BASED EVALUATION (8 terms, O(1) per lookup)
          // Sample eigenfunction values from precomputed 3D textures
          // ============================================

          // Compute normalized texture coordinates from flowedPos
          // Texture stores values for [-fieldScale, +fieldScale]³ → [0, 1]³
          const texCoord = vec3(flowedPos)
            .div(hoTextureFieldScale * 2)  // [-0.5, 0.5]
            .add(0.5)                       // [0, 1]

          // JS-unrolled loop over texture terms
          for (let k = 0; k < termCount; k++) {
            const textureNode = hoTextureNodes[k]
            if (!textureNode) continue

            // Sample eigenfunction from 3D texture (R32F format, value in .x)
            // Type assertion needed: texture3D import has different Node type than three/tsl
            const spatial = textureNode.sample(texCoord as unknown as Parameters<typeof textureNode.sample>[0]).x

            // Time phase factor: e^{-iE_k t}
            const phase = uEnergy.element(k).negate().mul(time)
            const timeFactor = cexp_i(phase)

            // Complex coefficient c_k
            const coeff = uCoeff.element(k)

            // Combined: c_k · e^{-iE_k t}
            const term = cmul(coeff, timeFactor)

            // Accumulate: ψ += c_k · Φ_k(x) · e^{-iE_k t}
            // Type assertion needed: spatial comes from texture3D module with different Node type
            const termResult = cscale(spatial as unknown as Node, term)
            psi.assign(
              select(
                float(k).lessThan(uTermCount),
                vec2(psi.x.add(termResult.x), psi.y.add(termResult.y)),
                psi
              )
            )
          }
        } else {
          // ============================================
          // FALLBACK: INLINE EVALUATION (limited to 2 terms)
          // Used when no textures provided - prevents freeze
          // ============================================

          // Build coordinates array for dimension-specific evaluator calls
          const coordArgs = [x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10].slice(0, dim)

          // JS-unrolled loop: evaluate each term with JS constant k
          for (let k = 0; k < termCount; k++) {
            // Spatial eigenfunction Φ_k(x) - uses k as JS constant
            const evaluator = hoNDTermEvaluators[k]
            if (!evaluator) continue

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const evalFn = evaluator as (...args: Node[]) => Node
            const spatial = evalFn(...coordArgs)

            // Time phase factor: e^{-iE_k t}
            const phase = uEnergy.element(k).negate().mul(time)
            const timeFactor = cexp_i(phase)

            // Complex coefficient c_k
            const coeff = uCoeff.element(k)

            // Combined: c_k · e^{-iE_k t}
            const term = cmul(coeff, timeFactor)

            // Accumulate: ψ += c_k · Φ_k(x) · e^{-iE_k t}
            const termResult = cscale(spatial, term)
            psi.assign(
              select(
                float(k).lessThan(uTermCount),
                vec2(psi.x.add(termResult.x), psi.y.add(termResult.y)),
                psi
              )
            )
          }
        }
      }

      // Hydrogen Orbital mode (3D only) - only included if quantumMode === 'hydrogenOrbital'
      if (quantumMode === 'hydrogenOrbital') {
        const pos3D = vec3(x0, x1, x2)
        const hydrogenResult = evalHydrogenPsiTime(
          pos3D,
          uPrincipalN,
          uAzimuthalL,
          uMagneticM,
          uBohrRadius,
          uUseRealOrbitals,
          time
        )
        psi.assign(vec2(hydrogenResult.x, hydrogenResult.y))
      }

      // Hydrogen ND mode - dimension-specific evaluator
      if (quantumMode === 'hydrogenND') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evalPsiAny = hydrogenNDEval as (...args: Node[]) => Node
        let psiResult: Node
        switch (dim) {
          case 3:
            psiResult = evalPsiAny(x0, x1, x2, time)
            break
          case 4:
            psiResult = evalPsiAny(x0, x1, x2, x3, time)
            break
          case 5:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, time)
            break
          case 6:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, time)
            break
          case 7:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, x6, time)
            break
          case 8:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, x6, x7, time)
            break
          case 9:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, x6, x7, x8, time)
            break
          case 10:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, time)
            break
          case 11:
          default:
            psiResult = evalPsiAny(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, time)
            break
        }
        psi.assign(vec2(psiResult.x, psiResult.y))
      }

      // Density = |psi|² = psi.x² + psi.y²
      // CRITICAL: Use anonymous toVar() inside Fn() to avoid TSL declaration name conflicts
      const rho = psi.x.mul(psi.x).add(psi.y.mul(psi.y)).toVar()

      // ============================================
      // Step 4: Apply hydrogen boosts (using JS conditionals at composition time)
      // Matches WebGL density.glsl.ts lines 393-425
      // ============================================
      if (quantumMode === 'hydrogenOrbital') {
        const fn = float(uPrincipalN)
        const fl = float(uAzimuthalL)
        const lBoost = pow(float(3), fl)
        const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)
        rho.assign(rho.mul(hydrogenBoost))
      }

      // Hydrogen ND boost (extra dimension factor)
      // Matches WebGL: float dimFactor = 1.0 + float(uDimension - 3) * 0.3;
      if (quantumMode === 'hydrogenND') {
        const fn = float(uPrincipalN)
        const fl = float(uAzimuthalL)
        const lBoost = pow(float(3), fl)
        const dimFactor = float(1).add(float(uDimension).sub(3).mul(0.3))
        const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)
        rho.assign(rho.mul(hydrogenNDBoost))
      }

      // ============================================
      // Step 5: Apply edge erosion
      // Matches WebGL: rho = erodeDensity(rho, flowedPos);
      // ============================================
      const erodedRho = erodeDensity(
        rho,
        flowedPos,
        uErosionStrength,
        uErosionScale,
        uErosionTurbulence,
        uErosionNoiseType,
        animTime
      )
      rho.assign(erodedRho)

      // ============================================
      // Step 6: Apply uncertainty shimmer
      // Matches WebGL density.glsl.ts lines 479-498
      // Only shimmer at low densities (edges)
      // ============================================
      const shouldShimmer = uShimmerEnabled
        .and(uShimmerStrength.greaterThan(0))
        .and(rho.greaterThan(0.001))
        .and(rho.lessThan(0.5))

      // High frequency noise for shimmer
      const noisePos = flowedPos.mul(5).add(vec3(0, 0, animTime.mul(2)))
      const shimmerNoise = gradientNoise(noisePos).mul(0.5).add(0.5)

      // Uncertainty inversely proportional to density
      const uncertainty = float(1).sub(clamp(rho.mul(2), float(0), float(1)))

      const shimmerFactor = float(1).add(
        shimmerNoise.sub(0.5).mul(uShimmerStrength).mul(uncertainty)
      )

      // Apply shimmer conditionally
      const shimmeredRho = rho.mul(shimmerFactor)
      rho.assign(shouldShimmer.select(shimmeredRho, rho))

      // Apply density gain and return vec2(density, phase)
      // Phase extracted from complex wavefunction: arg(ψ) = atan2(ψ.y, ψ.x)
      const phase = atan2(psi.y, psi.x)
      return vec2(rho.mul(uDensityGain), phase)
    })
  }

  const sampleDensity = createDensitySampler(dimension)

  // ============================================
  // Sphere intersection for volume bounds
  // ============================================

  const sphereIntersect = Fn(([ro, rd, radius]: [Node, Node, Node]) => {
    const b = dot(ro, rd)
    const c = dot(ro, ro).sub(radius.mul(radius))
    const d = b.mul(b).sub(c)

    // CRITICAL: Use anonymous toVar() inside Fn() to avoid TSL declaration name conflicts
    const result = vec2(-1, -1).toVar()

    // CRITICAL: Guard sqrt against negative d - GPU evaluates ALL branches
    // so sqrt(d) executes even when d < 0 (see docs/tsl.md GPU Branch Evaluation)
    const safeD = max(d, float(0))

    If(d.greaterThanEqual(0), () => {
      const sqrtD = sqrt(safeD)
      const tNear = b.negate().sub(sqrtD)
      const tFar = b.negate().add(sqrtD)
      result.assign(vec2(max(tNear, float(0)), tFar))
    })

    return result
  })

  // Create density-only sampler for shadows/AO (extracts just density from vec2)
  // CRITICAL: Only create and pass the sampler when shadows OR AO are enabled.
  // The density sampler is used by emission.ts for shadow ray sampling and AO hemisphere sampling.
  // If neither feature is enabled, passing undefined prevents those code paths from being generated.
  const needsDensitySampler = config.shadows || config.ambientOcclusion
  const densityOnlySampler = needsDensitySampler
    ? (pos: Node, time: Node) => {
        const sample = sampleDensity(pos, time)
        return sample.x // density is in .x component
      }
    : undefined

  // Create emission function with density sampler for shadows/AO
  const computeEmissionLit = createComputeEmissionLit(emissionUniforms, densityOnlySampler)

  // ============================================
  // Tetrahedral gradient sampling
  // ============================================

  const TETRA_V0 = vec3(+1.0, +1.0, -1.0).mul(0.5773503)
  const TETRA_V1 = vec3(+1.0, -1.0, +1.0).mul(0.5773503)
  const TETRA_V2 = vec3(-1.0, +1.0, +1.0).mul(0.5773503)
  const TETRA_V3 = vec3(-1.0, -1.0, -1.0).mul(0.5773503)

  const computeGradient = Fn(([pos, time, delta]: [Node, Node, Node]) => {
    // Sample density and extract .x component (density)
    const s0 = sFromRho(sampleDensity(pos.add(TETRA_V0.mul(delta)), time).x)
    const s1 = sFromRho(sampleDensity(pos.add(TETRA_V1.mul(delta)), time).x)
    const s2 = sFromRho(sampleDensity(pos.add(TETRA_V2.mul(delta)), time).x)
    const s3 = sFromRho(sampleDensity(pos.add(TETRA_V3.mul(delta)), time).x)

    const gradScale = float(0.75).div(delta)
    return TETRA_V0.mul(s0)
      .add(TETRA_V1.mul(s1))
      .add(TETRA_V2.mul(s2))
      .add(TETRA_V3.mul(s3))
      .mul(gradScale)
  })

  // ============================================
  // MRT (Multiple Render Target) Storage Nodes
  //
  // These nodes store raymarching results for MRT output:
  // - mrtNormalView: View-space normal (encoded to [0,1] range)
  // - mrtHasHit: Hit flag (1.0 = valid normal/depth, 0.0 = background)
  // - mrtClipDepth: Clip-space depth for gl_FragDepth equivalent
  // - mrtWorldPos: World position for temporal reprojection
  // - mrtNormalW: Alpha channel for normal (metallic for isosurface, hasHit for volumetric)
  // ============================================
  const mrtNormalView = vec3(0, 0, 1).toVar('mrtNormalView')
  const mrtHasHit = float(0).toVar('mrtHasHit')
  const mrtClipDepth = float(1).toVar('mrtClipDepth')
  const mrtWorldPos = vec3(0).toVar('mrtWorldPos')
  // For isosurface: alpha = uMetallic (WebGL: gNormal.w = uMetallic)
  // For volumetric: alpha = 1.0 (always solid hits)
  const mrtNormalW = float(0).toVar('mrtNormalW')

  // ============================================
  // Isosurface raymarching shader
  // Matches WebGL isosurface mode in main.glsl.ts
  // ============================================

  // CRITICAL: All toVar() inside Fn() MUST be anonymous to avoid WGSL declaration name conflicts
  const isosurfaceShader = Fn(() => {
    const worldPos = positionWorld
    const cameraPos = uCameraPosition
    const invModel = uInverseModelMatrix

    // Transform to model space
    const roModel = invModel.mul(vec4(cameraPos, 1.0)).xyz.toVar()
    // CRITICAL: Use safe normalize - camera could theoretically be at surface position
    const worldRayDir = safeNormalizeUp(sub(worldPos, cameraPos))
    const rdModel = safeNormalizeUp(invModel.mul(vec4(worldRayDir, 0.0)).xyz).toVar()

    // Intersect with bounding sphere
    // NOTE: Use fixed BOUND_R = 2.0 to match WebGL (not multiplied by fieldScale)
    const sphereRadius = float(2.0)
    const tRange = sphereIntersect(roModel, rdModel, sphereRadius)
    const tNear = max(tRange.x, float(0)).toVar()
    const tFar = tRange.y.toVar()

    // Default output color (transparent)
    const finalColor = vec4(0, 0, 0, 0).toVar()

    // Check for intersection
    If(tFar.greaterThanEqual(0), () => {
      const animTime = uTime.mul(uTimeScale)
      const threshold = uIsoThreshold

      // Step size based on fast mode
      const maxSteps = uFastMode.select(float(64), float(128))
      const stepLen = tFar.sub(tNear).div(maxSteps).toVar()

      const marchT = tNear.toVar()
      const hitT = float(-1).toVar()
      const prevS = float(-100).toVar() // Initialize well below any threshold

      // Track iteration count for debug heatmap (WebGL: g_volumeIterations)
      const isoIterations = float(0).toVar()
      const maxIsoIterations = maxSteps

      // Main search loop
      Loop(128, ({ i }) => {
        If(float(i).greaterThanEqual(maxSteps), () => Break())
        If(marchT.greaterThan(tFar), () => Break())
        If(hitT.greaterThan(0), () => Break())

        // Track iterations for debug visualization
        isoIterations.addAssign(1)

        const pos = roModel.add(rdModel.mul(marchT))
        const sample = sampleDensity(pos, animTime)
        const density = sample.x
        const s = sFromRho(density)

        // Check if we crossed the threshold
        If(s.greaterThan(threshold).and(prevS.lessThanEqual(threshold)), () => {
          // Binary search refinement (5 iterations)
          const tLo = marchT.sub(stepLen).toVar()
          const tHi = marchT.toVar()

          Loop(5, () => {
            const tMid = tLo.add(tHi).mul(0.5).toVar()
            const midPos = roModel.add(rdModel.mul(tMid))
            const midDensity = sampleDensity(midPos, animTime).x
            const midS = sFromRho(midDensity)

            If(midS.greaterThan(threshold), () => {
              tHi.assign(tMid)
            })
            If(midS.lessThanEqual(threshold), () => {
              tLo.assign(tMid)
            })
          })

          hitT.assign(tLo.add(tHi).mul(0.5))
        })

        prevS.assign(s)
        marchT.addAssign(stepLen)
      })

      // ============================================
      // Debug Mode 1: Iteration Heatmap (isosurface mode)
      // WebGL: Shows green→yellow→red gradient based on iteration count
      // Matches WebGL main.glsl.ts lines 300-319
      // ============================================
      If(int(uDebugMode).equal(1), () => {
        const iterT = isoIterations.div(max(maxIsoIterations, float(1)))
        // Heatmap: green (low) → yellow (mid) → red (high)
        const heatR = smoothstep(float(0), float(0.5), iterT)
        const heatG = float(1).sub(smoothstep(float(0.5), float(1), iterT))
        const heatB = float(0)
        const heatmap = vec3(heatR, heatG, heatB).toVar()
        // For misses, show slightly darker
        If(hitT.lessThan(0), () => {
          heatmap.assign(heatmap.mul(0.7))
        })
        finalColor.assign(vec4(heatmap, float(1)))
        // Set MRT outputs for debug mode
        mrtNormalView.assign(vec3(0.5, 0.5, 1))
        mrtHasHit.assign(0)
        const debugDepthPos = roModel.add(rdModel.mul(hitT.greaterThan(0).select(hitT, tNear)))
        mrtWorldPos.assign(debugDepthPos)
        mrtClipDepth.assign(0.5)
      })

      // If we have a hit, compute surface properties (skip in debug mode)
      If(int(uDebugMode).equal(0).and(hitT.greaterThan(0)), () => {
        const hitPos = roModel.add(rdModel.mul(hitT))
        const viewDir = rdModel.negate()

        // Surface normal from gradient
        const gradientRaw = computeGradient(hitPos, animTime, float(0.01))
        const gradLen = sqrt(dot(gradientRaw, gradientRaw))
        const n = gradientRaw.div(max(gradLen, float(0.0001)))

        // Sample for color
        const hitSample = sampleDensity(hitPos, animTime)
        const hitDensity = hitSample.x
        const hitPhase = hitSample.y

        // Compute surface color using emission
        const surfaceColor = computeEmissionLit(hitDensity, hitPhase, hitPos, n, viewDir)

        finalColor.assign(vec4(surfaceColor, float(1)))

        // ============================================
        // Compute MRT outputs for isosurface
        // ============================================

        // Compute world position at hit point
        const worldHitPos = uModelMatrix.mul(vec4(hitPos, 1.0))
        mrtWorldPos.assign(worldHitPos.xyz)
        mrtHasHit.assign(1)

        // Compute view-space normal
        const viewNormalRaw = uViewMatrix.mul(uModelMatrix).mul(vec4(n, 0.0)).xyz
        const viewNormalLen = sqrt(dot(viewNormalRaw, viewNormalRaw))
        const viewNormal = viewNormalRaw.div(max(viewNormalLen, float(0.0001)))
        mrtNormalView.assign(viewNormal)

        // WebGL: gNormal.w = uMetallic for isosurface mode
        // This stores metallic in the normal's alpha channel for G-buffer PBR
        mrtNormalW.assign(uMetallic)

        // Compute clip-space depth
        // WebGPU: NDC z is already in [0,1] - use z/w directly (no * 0.5 + 0.5 conversion)
        const clipPos = uProjectionMatrix.mul(uViewMatrix.mul(worldHitPos))
        const clipW = abs(clipPos.w)
          .lessThan(0.0001)
          .select(clipPos.w.greaterThanEqual(0).select(float(0.0001), float(-0.0001)), clipPos.w)
        mrtClipDepth.assign(clamp(clipPos.z.div(clipW), float(0), float(1)))
      })
    })

    // For miss pixels, set defaults
    If(mrtHasHit.lessThan(0.5), () => {
      mrtNormalView.assign(vec3(0, 0, 1))
      mrtClipDepth.assign(1) // Far plane
      mrtWorldPos.assign(vec3(0, 0, 0))
    })

    return finalColor
  })

  // ============================================
  // Temporal Reprojection Node (created OUTSIDE Fn per MKB-001)
  // Uses position-based temporal hints from previous frame's gPosition buffer
  // ============================================
  const getTemporalDepth = createGetTemporalDepthNode(temporalUniforms)

  // ============================================
  // Main volumetric raymarching shader
  // ============================================

  // CRITICAL: All toVar() inside Fn() MUST be anonymous to avoid WGSL declaration name conflicts
  const volumetricShader = Fn(() => {
    const worldPos = positionWorld
    const cameraPos = uCameraPosition
    const invModel = uInverseModelMatrix

    // Transform to model space
    const roModel = invModel.mul(vec4(cameraPos, 1.0)).xyz.toVar()
    // CRITICAL: Use safe normalize - camera could theoretically be at surface position
    const worldRayDir = safeNormalizeUp(sub(worldPos, cameraPos))
    const rdModel = safeNormalizeUp(invModel.mul(vec4(worldRayDir, 0.0)).xyz).toVar()

    // Intersect with bounding sphere
    // NOTE: Use fixed BOUND_R = 2.0 to match WebGL (not multiplied by fieldScale)
    const sphereRadius = float(2.0)
    const tRange = sphereIntersect(roModel, rdModel, sphereRadius)
    const tNearOriginal = max(tRange.x, float(0)).toVar()
    const tNear = tNearOriginal.toVar()
    const tFar = tRange.y.toVar()
    const usedTemporal = float(0).toVar()

    // ============================================
    // Temporal Reprojection for Volumetric Rendering
    // CONSERVATIVE approach - volumetric has soft boundaries:
    // 1. Large margin (50%) because visible density extends before recorded entry
    // 2. Never skip more than 40% of total ray length
    // 3. Only use if skip provides meaningful benefit (> 10% of ray)
    // Matches WebGL main.glsl.ts lines 82-117
    // ============================================
    If(temporalUniforms.uTemporalEnabled.and(tFar.greaterThanEqual(0)), () => {
      const temporalDepth = getTemporalDepth(roModel, rdModel)
      const rayLength = tFar.sub(tNearOriginal)

      // Valid temporal hint: positive depth and within ray bounds
      If(
        temporalDepth
          .greaterThan(0)
          .and(temporalDepth.lessThan(tFar))
          .and(rayLength.greaterThan(0)),
        () => {
          // Apply 50% margin - step back halfway from temporal hint to sphere entry
          // This accounts for soft volumetric boundaries where density extends
          // significantly before our recorded "entry point"
          // WebGL: temporalStart = mix(tNearOriginal, temporalDepth, 0.5)
          const temporalStart = tNearOriginal.add(temporalDepth.sub(tNearOriginal).mul(0.5))

          // Calculate how much we'd skip as fraction of total ray
          const skipDistance = temporalStart.sub(tNearOriginal)
          const skipFraction = skipDistance.div(max(rayLength, float(0.0001)))

          // Safety limits:
          // - Never skip more than 40% of ray (too aggressive for soft volumes)
          // - Only skip if benefit is meaningful (> 10% of ray)
          const maxSkipFraction = float(0.4)
          const minSkipFraction = float(0.1)

          // If skip fraction is in valid range, use temporalStart
          If(
            skipFraction
              .greaterThan(minSkipFraction)
              .and(skipFraction.lessThanEqual(maxSkipFraction)),
            () => {
              tNear.assign(temporalStart)
              usedTemporal.assign(1)
            }
          )

          // If temporal suggests skipping too much, clamp to safe maximum
          If(skipFraction.greaterThan(maxSkipFraction), () => {
            tNear.assign(tNearOriginal.add(rayLength.mul(maxSkipFraction)))
            usedTemporal.assign(1)
          })
          // If skipFraction <= minSkipFraction, don't bother - not worth the risk
        }
      )
    })

    // Default output color (transparent)
    const finalColor = vec4(0, 0, 0, 0).toVar()

    // Check for intersection - only proceed if we hit the bounding sphere
    If(tFar.greaterThanEqual(0), () => {
      // Volume raymarching
      const sampleCount = uFastMode.select(float(32), float(MAX_VOLUME_SAMPLES))
      const stepLen = tFar.sub(tNear).div(sampleCount).toVar()

      const accColor = vec3(0, 0, 0).toVar()
      const transmittance = float(1).toVar()
      const volMarchT = tNear.toVar()
      const animTime = uTime.mul(uTimeScale)
      const viewDir = rdModel.negate()

      // Track weighted center for normal estimation
      // WebGL: weightedCenter += pos * alpha * transmittance
      const weightedCenter = vec3(0, 0, 0).toVar()
      const totalWeight = float(0).toVar()

      // Track if we have any valid samples (for MRT output)
      const hasValidSamples = float(0).toVar()

      // Track iteration count for debug heatmap (WebGL: g_volumeIterations)
      const volumeIterations = float(0).toVar()
      const maxVolumeIterations = sampleCount

      Loop(MAX_VOLUME_SAMPLES, ({ i }) => {
        If(float(i).greaterThanEqual(sampleCount), () => Break())
        If(transmittance.lessThan(MIN_TRANSMITTANCE), () => Break())

        // Track iterations for debug visualization
        volumeIterations.addAssign(1)

        const pos = roModel.add(rdModel.mul(volMarchT))

        // Sample density at current position
        const sample = sampleDensity(pos, animTime)
        const density = sample.x
        const phase = sample.y

        // Compute alpha from density
        const alpha = computeAlpha(density, stepLen, float(1))

        If(alpha.greaterThan(0.001), () => {
          hasValidSamples.assign(1)

          // Compute gradient: tetrahedral in HQ mode, radial in fast mode
          // With texture-based eigenfunctions, tetrahedral gradient is now viable
          const radialGradLen = max(length(pos), float(0.001))
          const radialGrad = pos.div(radialGradLen).negate()

          // HQ mode: O(h²) accurate tetrahedral gradient
          const tetraGrad = computeGradient(pos, animTime, float(0.05))
          const tetraLen = max(length(tetraGrad), float(0.0001))
          const tetraNormGrad = tetraGrad.div(tetraLen).negate()

          // Select based on fast mode
          const useTetra = uFastMode.not().and(alpha.greaterThan(0.01))
          const gradient = select(useTetra, tetraNormGrad, radialGrad)

          // Accumulate weighted center for normal estimation
          const weight = alpha.mul(transmittance)
          weightedCenter.addAssign(pos.mul(weight))
          totalWeight.addAssign(weight)

          // Compute emission: simplified phase-based HSV coloring
          // NOTE: Full computeEmissionLit causes "Invalid PipelineLayout" in volumetric loop
          // (called 32-64x per ray, too complex for WebGPU pipeline)
          // computeEmissionVolumetric also fails to render visible output
          // Phase-based coloring is the key visual feature for quantum wavefunctions
          const hue = phase.mul(0.15915).add(0.5) // phase / 2π + 0.5
          const emission = vec3(
            sin(hue.mul(6.283)).mul(0.5).add(0.5),
            sin(hue.add(0.333).mul(6.283)).mul(0.5).add(0.5),
            sin(hue.add(0.666).mul(6.283)).mul(0.5).add(0.5)
          ).mul(density.mul(2.0).add(0.5))

          // Front-to-back compositing
          accColor.assign(accColor.add(transmittance.mul(alpha).mul(emission)))
          transmittance.assign(transmittance.mul(float(1).sub(alpha)))
        })

        volMarchT.addAssign(stepLen)
      })

      const finalAlpha = float(1).sub(transmittance).mul(uOpacity)

      // ============================================
      // Debug Mode 1: Iteration Heatmap
      // WebGL: Shows green→yellow→red gradient based on iteration count
      // Green = few iterations (efficient), Red = many iterations (expensive)
      // Matches WebGL main.glsl.ts lines 132-152
      // ============================================
      If(int(uDebugMode).equal(1), () => {
        const iterT = volumeIterations.div(max(maxVolumeIterations, float(1)))
        // Heatmap: green (low) → yellow (mid) → red (high)
        const heatR = smoothstep(float(0), float(0.5), iterT)
        const heatG = float(1).sub(smoothstep(float(0.5), float(1), iterT))
        const heatB = float(0)
        const heatmap = vec3(heatR, heatG, heatB).toVar()
        // For low alpha (nearly transparent), show slightly darker
        If(finalAlpha.lessThan(0.5), () => {
          heatmap.assign(heatmap.mul(float(0.5).add(float(0.5).mul(finalAlpha))))
        })
        finalColor.assign(vec4(heatmap, float(1)))
        // Set MRT outputs for debug mode
        mrtNormalView.assign(vec3(0.5, 0.5, 1))
        mrtHasHit.assign(0)
        mrtClipDepth.assign(0.5)
      })

      // Normal rendering path (not debug mode)
      If(int(uDebugMode).notEqual(1), () => {
        finalColor.assign(vec4(accColor, finalAlpha))
      })

      // ============================================
      // Compute MRT outputs for depth/normal buffer
      // Skip if in debug mode (debug mode sets its own MRT values above)
      // ============================================

      If(int(uDebugMode).equal(0).and(hasValidSamples.greaterThan(0.5)), () => {
        // Compute weighted center for normal estimation
        // Guard against zero total weight
        const safeTotalWeight = max(totalWeight, float(0.0001))
        const centerPos = weightedCenter.div(safeTotalWeight)

        // Compute view-space normal from gradient at weighted center
        // Use simplified radial gradient (same as raymarching loop)
        const centerGradLen = max(length(centerPos), float(0.001))
        const centerGradient = centerPos.div(centerGradLen).negate()
        // Normalize with safe length check
        const gradLen = sqrt(dot(centerGradient, centerGradient))
        const safeGradLen = max(gradLen, float(0.0001))
        const worldNormal = centerGradient.div(safeGradLen)

        // Transform normal to view space
        // WebGL: viewNormal = normalize((uViewMatrix * uModelMatrix * vec4(worldNormal, 0.0)).xyz)
        const viewNormalRaw = uViewMatrix.mul(uModelMatrix).mul(vec4(worldNormal, 0.0)).xyz
        const viewNormalLen = sqrt(dot(viewNormalRaw, viewNormalRaw))
        const safeViewNormalLen = max(viewNormalLen, float(0.0001))
        const viewNormal = viewNormalRaw.div(safeViewNormalLen)

        // Assign to MRT storage nodes
        mrtNormalView.assign(viewNormal)
        mrtHasHit.assign(1)
        // WebGL: gNormal.w = 1.0 for volumetric mode (alpha = 1, always opaque hits)
        mrtNormalW.assign(1)

        // Compute world position at entry point for depth calculation
        // WebGL: worldEntryPos = uModelMatrix * vec4(ro + rd * tNear, 1.0)
        const entryPosModel = roModel.add(rdModel.mul(tNear))
        const worldEntryPos = uModelMatrix.mul(vec4(entryPosModel, 1.0))
        mrtWorldPos.assign(worldEntryPos.xyz)

        // Compute clip-space depth (depthNode equivalent)
        // WebGPU: NDC z is already in [0,1] - use z/w directly (no * 0.5 + 0.5 conversion)
        // Note: WebGL uses gl_FragDepth = clamp((z/w) * 0.5 + 0.5, 0, 1) but TSL is WebGPU
        const clipPos = uProjectionMatrix.mul(uViewMatrix.mul(worldEntryPos))
        // Guard against near-zero clipPos.w (perspective division singularity)
        const clipW = abs(clipPos.w)
          .lessThan(0.0001)
          .select(clipPos.w.greaterThanEqual(0).select(float(0.0001), float(-0.0001)), clipPos.w)
        mrtClipDepth.assign(clamp(clipPos.z.div(clipW), float(0), float(1)))
      })
    })

    // For background/miss pixels, set defaults (already initialized)
    If(mrtHasHit.lessThan(0.5), () => {
      mrtNormalView.assign(vec3(0, 0, 1))
      mrtClipDepth.assign(1) // Far plane
      mrtWorldPos.assign(vec3(0, 0, 0))
    })

    return finalColor
  })

  // ============================================
  // Create material
  // ============================================

  const material = new MeshBasicNodeMaterial() as NodeMaterialWithMRT
  material.side = THREE.BackSide
  material.transparent = !isosurface // Isosurface is opaque
  material.depthWrite = false // Depth handled via depthNode
  material.blending = isosurface ? THREE.NoBlending : THREE.NormalBlending

  // Create the main shader node - choose based on mode
  const shaderOutput = isosurface ? isosurfaceShader() : volumetricShader()
  material.colorNode = shaderOutput

  // ============================================
  // MRT (Multiple Render Target) Configuration
  // Matches WebGL output layout:
  //   location 0 = gColor (handled by colorNode via 'output')
  //   location 1 = gNormal (view-space normal, encoded to [0,1], with hit flag in alpha)
  //   location 2 = gPosition (world position for temporal reprojection)
  //
  // Per TSL r182+ docs: mrt() configures what gets written to each render target
  // Per webgpu_mrt.html example: output names map to render target textures
  // ============================================
  material.mrtNode = mrt({
    // 'output' uses the built-in output node which references colorNode
    output: output,
    // 'normal' uses our computed view-space normal, encoded to [0,1] range
    // Alpha channel: uMetallic for isosurface (PBR), 1.0 for volumetric
    // WebGL: gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic) for isosurface
    // WebGL: gNormal = vec4(encodedNormal, 1.0) for volumetric
    normal: vec4(mrtNormalView.mul(0.5).add(0.5), mrtNormalW),
    // 'position' provides world position for temporal reprojection
    // Alpha channel stores hit flag (1 = valid, 0 = miss)
    position: vec4(mrtWorldPos, mrtHasHit),
  })

  // Custom depth output for gl_FragDepth equivalent
  // This ensures proper depth sorting for raymarched geometry
  material.depthNode = mrtClipDepth

  // Log material setup in development mode
  if (import.meta.env.DEV) {
    console.log('[composeSchroedingerTSL] Material created:', {
      hasColorNode: !!material.colorNode,
      hasMrtNode: !!material.mrtNode,
      hasDepthNode: !!material.depthNode,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      side: material.side,
      blending: material.blending,
    })
  }

  return {
    material,
    uniforms,
    features,
  }
}
