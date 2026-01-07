/**
 * TSL Shader Composition for Black Hole N-dimensional Visualization
 *
 * Dynamically builds the TSL node graph for black hole rendering:
 * - Gravitational lensing with Kerr frame dragging
 * - Event horizon
 * - Photon shell
 * - Accretion disk (volumetric and SDF modes)
 *
 * Mirrors the WebGL composeBlackHoleShader pattern but uses TSL nodes.
 *
 * @module rendering/tsl/raymarching/blackhole/composeBlackHoleTSL
 */

import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  mat3,
  uniform,
  positionWorld,
  Loop,
  If,
  Break,
  max,
  min,
  sqrt,
  dot,
  sub,
  abs,
  clamp,
  smoothstep,
  fract,
  exp,
  mix,
  cubeTexture,
  mrt,
  output,
  viewportCoordinate,
} from 'three/tsl'
import type { Node, UniformNode, CubeTextureNode } from 'three/tsl'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { safeNormalizeUp, safeNormalizeNoFallback } from '../../utils/safe-math'

import {
  createNdDistance,
  createBendRay,
  type LensingUniforms,
} from './gravity/lensing'
import {
  createIsInsideHorizon,
  type HorizonUniforms,
} from './gravity/horizon'
import {
  createPhotonShellMask,
  createShellStepModifierWithMask,
  type ShellUniforms,
} from './gravity/shell'
import {
  createGetDiskDensity,
  createGetDiskEmission,
  createDetectDiskCrossing,
  createComputeVolumetricDiskNormal,
  createShadeDiskHit,
  type DiskUniforms,
  type ShadeDiskHitUniforms,
} from './gravity/disk'
// Doppler and Color uniforms are handled internally by createShadeDiskHit

// Type aliases
type Vec3Uniform = UniformNode<THREE.Vector3>
type Vec4Uniform = UniformNode<THREE.Vector4>
type ColorUniform = UniformNode<THREE.Color>
type Mat4Uniform = UniformNode<THREE.Matrix4>

// Constants (matching WebGL)
const MAX_STEPS = 512
const MIN_TRANSMITTANCE = 0.01
const MAX_DISK_CROSSINGS = 8

/**
 * Shader configuration for Black Hole TSL composition.
 */
export interface BlackHoleShaderConfig {
  /** Current dimension (3-11) */
  dimension: number
  /** Enable Doppler effect */
  doppler?: boolean
  /** Enable volumetric disk */
  volumetricDisk?: boolean
  /** Enable environment map */
  envMap?: boolean
  /** Environment map texture (required if envMap is true) */
  envMapTexture?: THREE.CubeTexture
  /** Enable temporal accumulation */
  temporalAccumulation?: boolean
}

/**
 * Uniforms created by the composition function.
 */
export interface ComposedBlackHoleUniforms {
  // Core
  uCameraPosition: Vec3Uniform
  uResolution: UniformNode<THREE.Vector2>
  uTime: UniformNode<number>
  uTimeScale: UniformNode<number>
  uModelMatrix: Mat4Uniform
  uInverseModelMatrix: Mat4Uniform
  uViewMatrix: Mat4Uniform
  uProjectionMatrix: Mat4Uniform

  // Dimension
  uDimension: UniformNode<number>

  // Basis vectors (packed as vec4)
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform

  // Gravity/Lensing
  uGravityStrength: UniformNode<number>
  uDistanceFalloff: UniformNode<number>
  uEpsilonMul: UniformNode<number>
  uDimPower: UniformNode<number>
  uHorizonRadius: UniformNode<number>
  uOriginOffsetLengthSq: UniformNode<number>
  uSpin: UniformNode<number>
  uBendScale: UniformNode<number>
  uBendMaxPerStep: UniformNode<number>
  uLensingClamp: UniformNode<number>

  // Horizon
  uVisualEventHorizon: UniformNode<number>

  // Photon Shell
  uShellRpPrecomputed: UniformNode<number>
  uShellDeltaPrecomputed: UniformNode<number>
  uShellContrastBoost: UniformNode<number>
  uShellIntensity: UniformNode<number>
  uShellColor: ColorUniform
  uShellStepMul: UniformNode<number>
  uShellGlowStrength: UniformNode<number>

  // Accretion Disk
  uDiskInnerRadius: UniformNode<number>
  uDiskOuterRadius: UniformNode<number>
  uDiskHalfThickness: UniformNode<number>
  uDiskDensity: UniformNode<number>
  uDiskRotationSpeed: UniformNode<number>
  uDiskColor: ColorUniform
  uDiskTempInner: UniformNode<number>
  uDiskTempOuter: UniformNode<number>
  uManifoldThickness: UniformNode<number>
  uManifoldIntensity: UniformNode<number>
  uNoiseScale: UniformNode<number>
  uNoiseAmount: UniformNode<number>
  uDiskRotationAngle: UniformNode<number>
  uKeplerianDifferential: UniformNode<number>
  uMultiIntersectionGain: UniformNode<number>
  uSwirlAmount: UniformNode<number>

  // Raymarching quality
  uMaxSteps: UniformNode<number>
  uStepBase: UniformNode<number>
  uStepMin: UniformNode<number>
  uStepMax: UniformNode<number>
  uStepAdaptG: UniformNode<number>
  uStepAdaptR: UniformNode<number>
  uTransmittanceCutoff: UniformNode<number>
  uFarRadius: UniformNode<number>
  uQualityMultiplier: UniformNode<number>
  uFastMode: UniformNode<boolean>
  uUltraFastMode: UniformNode<boolean>

  // Absorption
  uEnableAbsorption: UniformNode<boolean>
  uAbsorption: UniformNode<number>

  // Doppler
  uDopplerEnabled: UniformNode<number>
  uDopplerStrength: UniformNode<number>

  // Ray Bending Mode (WebGL: uRayBendingMode)
  // 0 = spiral (default - natural photon sphere behavior)
  // 1 = orbital (Einstein ring mode - rays orbit closer to photon sphere)
  uRayBendingMode: UniformNode<number>

  // Pulse Animation (WebGL: uPulseEnabled, uPulseSpeed, uPulseAmount)
  uPulseEnabled: UniformNode<boolean>
  uPulseSpeed: UniformNode<number>
  uPulseAmount: UniformNode<number>

  // Color
  uColorAlgorithm: UniformNode<number>
  uBaseColor: ColorUniform
  uCosineA: Vec3Uniform
  uCosineB: Vec3Uniform
  uCosineC: Vec3Uniform
  uCosineD: Vec3Uniform
  uLchLightness: UniformNode<number>
  uLchChroma: UniformNode<number>
  uDiskTemperature: UniformNode<number>

  // Bloom
  uBloomBoost: UniformNode<number>

  // Debug
  uDebugMode: UniformNode<number>

  // Environment map
  uEnvMapReady: UniformNode<number>

  // Quality
  uSampleQuality: UniformNode<number>
}

/**
 * Result of composition.
 */
export interface ComposedBlackHoleMaterial {
  material: MeshBasicNodeMaterial
  uniforms: ComposedBlackHoleUniforms
  features: string[]
  /** Environment map texture node for updating at runtime */
  envMapNode: CubeTextureNode | null
}

/**
 * Interleaved Gradient Noise (high quality dithering)
 *
 * Uses screen-space pixel coordinates (matching WebGL gl_FragCoord.xy).
 * This is critical for proper dithering - worldPos would cause incorrect
 * spatial correlation breaking the noise pattern.
 *
 * @param screenCoord - vec2 screen coordinates (pixels)
 * @param timeOffset - float time offset for temporal variation
 */
const interleavedGradientNoise = Fn(([screenCoord, timeOffset]: [Node, Node]) => {
  // WebGL: vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  // WebGL: return fract(magic.z * fract(dot(uv, magic.xy)));
  const magic = vec3(0.06711056, 0.00583715, 52.9829189)
  // Add timeOffset to x coordinate for temporal variation
  const coordWithTime = screenCoord.add(timeOffset)
  return fract(magic.z.mul(fract(dot(coordWithTime, vec2(magic.x, magic.y)))))
})

/**
 * Compose the Black Hole TSL material.
 *
 * @param config - Shader configuration
 * @returns Composed material, uniforms, and feature list
 */
export function composeBlackHoleTSL(
  config: BlackHoleShaderConfig
): ComposedBlackHoleMaterial {
  const { dimension, doppler = true, volumetricDisk = true, envMap = false } = config

  const features: string[] = []
  features.push(`${dimension}D Black Hole`)
  if (doppler) features.push('Doppler Effect')
  if (volumetricDisk) features.push('Volumetric Disk')
  if (envMap) features.push('Environment Map')

  // ============================================
  // Create all uniforms
  // ============================================

  const uCameraPosition = uniform(new THREE.Vector3()) as Vec3Uniform
  const uResolution = uniform(new THREE.Vector2(1920, 1080))
  const uTime = uniform(0.0)
  const uTimeScale = uniform(1.0)
  const uModelMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uInverseModelMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uViewMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform
  const uProjectionMatrix = uniform(new THREE.Matrix4()) as Mat4Uniform

  const uDimension = uniform(dimension)

  // Basis vectors
  const uBasisX0 = uniform(new THREE.Vector4(1, 0, 0, 0)) as Vec4Uniform
  const uBasisY0 = uniform(new THREE.Vector4(0, 1, 0, 0)) as Vec4Uniform
  const uBasisZ0 = uniform(new THREE.Vector4(0, 0, 1, 0)) as Vec4Uniform
  const uOrigin0 = uniform(new THREE.Vector4(0, 0, 0, 0)) as Vec4Uniform

  // Gravity/Lensing
  const uGravityStrength = uniform(1.5)
  const uDistanceFalloff = uniform(2.0)
  const uEpsilonMul = uniform(0.1)
  const uDimPower = uniform(1.0)
  const uHorizonRadius = uniform(1.0)
  const uOriginOffsetLengthSq = uniform(0.0)
  const uSpin = uniform(0.0)
  const uBendScale = uniform(1.0)
  const uBendMaxPerStep = uniform(0.5)
  const uLensingClamp = uniform(10.0)

  // Horizon
  const uVisualEventHorizon = uniform(1.0)

  // Photon Shell
  const uShellRpPrecomputed = uniform(1.5)
  const uShellDeltaPrecomputed = uniform(0.2)
  const uShellContrastBoost = uniform(1.0)
  const uShellIntensity = uniform(1.0)
  const uShellColor = uniform(new THREE.Color('#ffffff').convertSRGBToLinear()) as ColorUniform
  const uShellStepMul = uniform(0.3)
  const uShellGlowStrength = uniform(1.0)

  // Accretion Disk
  const uDiskInnerRadius = uniform(3.0)
  const uDiskOuterRadius = uniform(10.0)
  const uDiskHalfThickness = uniform(0.5)
  const uDiskDensity = uniform(1.0)
  const uDiskRotationSpeed = uniform(0.5)
  const uDiskColor = uniform(new THREE.Color('#ffaa44').convertSRGBToLinear()) as ColorUniform
  const uDiskTempInner = uniform(8000.0)
  const uDiskTempOuter = uniform(3000.0)
  const uManifoldThickness = uniform(0.1)
  const uManifoldIntensity = uniform(1.0)
  const uNoiseScale = uniform(1.0)
  const uNoiseAmount = uniform(0.5)
  const uDiskRotationAngle = uniform(0.0)
  const uKeplerianDifferential = uniform(1.0)
  // WebGL default: uMultiIntersectionGain = 0.5 (gain for Einstein ring brightness)
  const uMultiIntersectionGain = uniform(0.5)
  // WebGL default: uSwirlAmount = 0.5 (spiral/swirl intensity)
  const uSwirlAmount = uniform(0.5)

  // Raymarching quality
  const uMaxSteps = uniform(256)
  const uStepBase = uniform(0.1)
  const uStepMin = uniform(0.01)
  const uStepMax = uniform(0.2)
  const uStepAdaptG = uniform(2.0)
  const uStepAdaptR = uniform(1.0)
  const uTransmittanceCutoff = uniform(MIN_TRANSMITTANCE)
  const uFarRadius = uniform(20.0)
  const uQualityMultiplier = uniform(1.0)
  const uFastMode = uniform(false)
  const uUltraFastMode = uniform(false)

  // Absorption
  const uEnableAbsorption = uniform(true)
  const uAbsorption = uniform(2.0)

  // Doppler
  const uDopplerEnabled = uniform(doppler ? 1 : 0)
  const uDopplerStrength = uniform(0.5)

  // Ray Bending Mode (WebGL: uRayBendingMode)
  // 0 = spiral (default - natural photon sphere behavior)
  // 1 = orbital (Einstein ring mode - rays orbit closer to photon sphere)
  const uRayBendingMode = uniform(0)

  // Pulse Animation (WebGL: uPulseEnabled, uPulseSpeed, uPulseAmount)
  // Modulates disk brightness/thickness with time-based pulsation
  const uPulseEnabled = uniform(false)
  const uPulseSpeed = uniform(1.0)
  const uPulseAmount = uniform(0.1)

  // Color
  const uColorAlgorithm = uniform(10) // ALGO_BLACKBODY
  const uBaseColor = uniform(new THREE.Color('#ffaa44').convertSRGBToLinear()) as ColorUniform
  const uCosineA = uniform(new THREE.Vector3(0.5, 0.5, 0.5)) as Vec3Uniform
  const uCosineB = uniform(new THREE.Vector3(0.5, 0.5, 0.5)) as Vec3Uniform
  const uCosineC = uniform(new THREE.Vector3(1, 1, 1)) as Vec3Uniform
  const uCosineD = uniform(new THREE.Vector3(0, 0.33, 0.67)) as Vec3Uniform
  const uLchLightness = uniform(0.6)
  const uLchChroma = uniform(0.5)
  const uDiskTemperature = uniform(6000.0)

  // Bloom
  const uBloomBoost = uniform(1.5)

  // Debug
  const uDebugMode = uniform(0)

  // Environment map
  const uEnvMapReady = uniform(envMap && config.envMapTexture ? 1.0 : 0.0)

  // Quality (matches WebGL: 0=low, 1=medium, 2+=high - controls noise octave count)
  const uSampleQuality = uniform(1)

  // ============================================
  // Create environment map texture node OUTSIDE Fn()
  // Per MKB-001: Complex nodes must be created outside Fn() to avoid
  // WebGPU "Invalid PipelineLayout" errors
  //
  // Per MKB-002: Create with placeholder, update value at runtime
  // This allows the envMap to be set after composition
  // ============================================
  let envMapTextureNode: CubeTextureNode | null = null
  if (envMap) {
    // Create placeholder cube texture (1x1 black faces)
    const placeholderImages = Array(6).fill(null).map(() => {
      const data = new Uint8Array([0, 0, 0, 255])
      return new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    })
    const placeholderCubeTexture = new THREE.CubeTexture(placeholderImages)
    placeholderCubeTexture.needsUpdate = true

    // If actual texture provided, use it; otherwise use placeholder
    const textureToUse = config.envMapTexture ?? placeholderCubeTexture
    envMapTextureNode = cubeTexture(textureToUse)
  }

  // ============================================
  // MRT (Multiple Render Target) Storage Nodes
  // Per MKB-001: These MUST be created OUTSIDE Fn() to avoid WebGPU pipeline errors
  //
  // These nodes store raymarching results for MRT output:
  // - mrtNormalView: View-space normal (encoded to [0,1] range)
  // - mrtHasHit: Hit flag (1.0 = valid normal/depth, 0.0 = background)
  // - mrtClipDepth: Clip-space depth for gl_FragDepth equivalent
  // - mrtWorldPos: World position for temporal reprojection
  // ============================================
  const mrtNormalView = vec3(0, 0, 1).toVar('mrtNormalView')
  const mrtHasHit = float(0).toVar('mrtHasHit')
  const mrtClipDepth = float(1).toVar('mrtClipDepth')
  const mrtWorldPos = vec3(0).toVar('mrtWorldPos')

  const uniforms: ComposedBlackHoleUniforms = {
    uCameraPosition,
    uResolution,
    uTime,
    uTimeScale,
    uModelMatrix,
    uInverseModelMatrix,
    uViewMatrix,
    uProjectionMatrix,
    uDimension,
    uBasisX0,
    uBasisY0,
    uBasisZ0,
    uOrigin0,
    uGravityStrength,
    uDistanceFalloff,
    uEpsilonMul,
    uDimPower,
    uHorizonRadius,
    uOriginOffsetLengthSq,
    uSpin,
    uBendScale,
    uBendMaxPerStep,
    uLensingClamp,
    uVisualEventHorizon,
    uShellRpPrecomputed,
    uShellDeltaPrecomputed,
    uShellContrastBoost,
    uShellIntensity,
    uShellColor,
    uShellStepMul,
    uShellGlowStrength,
    uDiskInnerRadius,
    uDiskOuterRadius,
    uDiskHalfThickness,
    uDiskDensity,
    uDiskRotationSpeed,
    uDiskColor,
    uDiskTempInner,
    uDiskTempOuter,
    uManifoldThickness,
    uManifoldIntensity,
    uNoiseScale,
    uNoiseAmount,
    uDiskRotationAngle,
    uKeplerianDifferential,
    uMultiIntersectionGain,
    uSwirlAmount,
    uMaxSteps,
    uStepBase,
    uStepMin,
    uStepMax,
    uStepAdaptG,
    uStepAdaptR,
    uTransmittanceCutoff,
    uFarRadius,
    uQualityMultiplier,
    uFastMode,
    uUltraFastMode,
    uEnableAbsorption,
    uAbsorption,
    uDopplerEnabled,
    uDopplerStrength,
    uRayBendingMode,
    uPulseEnabled,
    uPulseSpeed,
    uPulseAmount,
    uColorAlgorithm,
    uBaseColor,
    uCosineA,
    uCosineB,
    uCosineC,
    uCosineD,
    uLchLightness,
    uLchChroma,
    uDiskTemperature,
    uBloomBoost,
    uDebugMode,
    uEnvMapReady,
    uSampleQuality,
  }

  // ============================================
  // Create gravity functions
  // ============================================

  const lensingUniforms: LensingUniforms = {
    uGravityStrength,
    uDistanceFalloff,
    uEpsilonMul,
    uDimPower,
    uHorizonRadius,
    uOriginOffsetLengthSq,
    uSpin,
    uBendScale,
    uBendMaxPerStep,
    uLensingClamp,
    uRayBendingMode,
  }

  const horizonUniforms: HorizonUniforms = {
    uVisualEventHorizon,
    uHorizonRadius,
  }

  const shellUniforms: ShellUniforms = {
    uShellRpPrecomputed,
    uShellDeltaPrecomputed,
    uShellContrastBoost,
    uShellIntensity,
    uShellStepMul,
    uShellGlowStrength,
    uShellGlowColor: uShellColor,
  }

  const diskUniforms: DiskUniforms = {
    uDiskInnerRadius,
    uDiskOuterRadius,
    uDiskHalfThickness,
    uDiskDensity,
    uDiskRotationSpeed,
    uTime,
    uDiskColor,
    uDiskTempInner,
    uDiskTempOuter,
    uHorizonRadius,
    uManifoldThickness,
    uManifoldIntensity,
    uSpin,
    uNoiseScale,
    uNoiseAmount,
    uFastMode,
    uUltraFastMode,
    uDiskRotationAngle,
    uKeplerianDifferential,
    uSampleQuality,
    uPulseEnabled,
    uPulseSpeed,
    uPulseAmount,
  }

  const ndDistance = createNdDistance(lensingUniforms)
  const bendRay = createBendRay(lensingUniforms)
  const isInsideHorizon = createIsInsideHorizon(horizonUniforms)
  // photonShellMask is created inside shellStepModWithMask
  void createPhotonShellMask(shellUniforms) // Validate factory exists, but result is unused here
  const shellStepModWithMask = createShellStepModifierWithMask(shellUniforms)
  const getDiskDensity = createGetDiskDensity(diskUniforms)
  const getDiskEmission = createGetDiskEmission(diskUniforms)
  const detectDiskCrossing = createDetectDiskCrossing(diskUniforms)
  const computeDiskNormal = createComputeVolumetricDiskNormal(diskUniforms)

  // ============================================
  // Create ShadeDiskHit for Einstein ring disk crossing
  // MKB-001: Must be created OUTSIDE Fn() to avoid WebGPU pipeline errors
  // This is the full WebGL-parity implementation including:
  // - HSL hue shift for gravitational redshift
  // - Swirl pattern
  // - Noise turbulence  
  // - FakeLit lighting mode
  // - Doppler shift
  // ============================================
  const shadeDiskHitUniforms: ShadeDiskHitUniforms = {
    // From DiskUniforms (without conflicting keys)
    uDiskInnerRadius,
    uDiskOuterRadius,
    uDiskHalfThickness,
    uDiskDensity,
    uDiskRotationSpeed,
    uTime,
    uDiskColor,
    uDiskTempInner,
    uDiskTempOuter,
    uManifoldThickness,
    uManifoldIntensity,
    uSpin,
    uNoiseScale,
    uNoiseAmount,
    uFastMode,
    uUltraFastMode,
    uDiskRotationAngle,
    uKeplerianDifferential,
    uDiskInnerR: uDiskInnerRadius, // Pre-computed radii alias
    uDiskOuterR: uDiskOuterRadius,
    uSwirlAmount,
    uMultiIntersectionGain,
    uLightingMode: uniform(0), // 0=None, 1=FakeLit - add proper uniform if needed
    uLightPositions: undefined, // Add if FakeLit is enabled
    uLightColors: undefined,
    uCameraPosition,
    uRoughness: uniform(0.5),
    uSpecular: uniform(0.5),
    uAmbientTint: uniform(0.2),
    // From ColorUniforms
    uColorAlgorithm,
    uBaseColor,
    uDiskTemperature,
    uHorizonRadius,
    uCosineA,
    uCosineB,
    uCosineC,
    uCosineD,
    uLchLightness,
    uLchChroma,
    // From DopplerUniforms
    uDopplerEnabled,
    uDopplerStrength,
  }
  const shadeDiskHit = createShadeDiskHit(shadeDiskHitUniforms)

  // ============================================
  // Sample background environment with bent ray
  // Uses the general skybox system - no built-in procedural fallback.
  // When envMap is not ready or skybox is disabled, returns black.
  //
  // Per MKB-001: The envMapTextureNode is created OUTSIDE Fn() to avoid
  // WebGPU "Invalid PipelineLayout" errors.
  // ============================================

  const sampleBackground = Fn(([bentDir]: [Node]) => {
    // Check if envMap is ready and texture node exists
    if (!envMapTextureNode) {
      return vec3(0, 0, 0)
    }

    // Only sample envMap when it's valid (avoids sampling null texture)
    const result = vec3(0, 0, 0).toVar('bgColor')
    If(uEnvMapReady.greaterThan(0.5), () => {
      // Transform bent ray from Local Space to World Space for environment sampling.
      // The black hole simulation runs in Local Space (for scale/rotation), but the
      // environment map (Skybox) is in World Space.
      // Without this transform, rotating the black hole rotates the reflection of the skybox.
      // WebGL: vec3 worldBentDir = normalize(mat3(uModelMatrix) * bentDir);
      // GPU branch: use safe normalize for degenerate model matrix cases
      const modelMat3 = mat3(
        uModelMatrix.element(0).xyz,
        uModelMatrix.element(1).xyz,
        uModelMatrix.element(2).xyz
      )
      const worldBentDir = safeNormalizeUp(modelMat3.mul(bentDir))
      result.assign(envMapTextureNode!.sample(worldBentDir).rgb)
    })
    return result
  })

  // ============================================
  // Sphere intersection for far field bounds
  // ============================================

  const sphereIntersect = Fn(([ro, rd, radius]: [Node, Node, Node]) => {
    const b = dot(ro, rd)
    const c = dot(ro, ro).sub(radius.mul(radius))
    const d = b.mul(b).sub(c)

    const sqrtD = sqrt(max(d, float(0)))
    const tNear = max(b.negate().sub(sqrtD), float(0))
    const tFar = b.negate().add(sqrtD)

    const hasHit = d.greaterThanEqual(0).and(tFar.greaterThan(0))
    return hasHit.select(vec3(tNear, tFar, float(1)), vec3(-1, -1, float(0)))
  })

  // ============================================
  // Adaptive step size calculation
  // ============================================

  const adaptiveStepSize = Fn(([ndRadius, shellStepMod]: [Node, Node]) => {
    // Base step - scale with distance to allow efficient travel far from hole
    const step = uStepBase.mul(float(1).add(ndRadius.mul(0.5))).toVar('adaptStep')

    // Reduce step near horizon (gravity adaption)
    const gravityFactor = float(1).div(
      float(1).add(uStepAdaptG.mul(uGravityStrength).div(max(ndRadius, uEpsilonMul)))
    )
    step.assign(step.mul(gravityFactor))

    // Reduce step near photon shell (mask/step modifier is computed outside once per iteration)
    step.assign(step.mul(shellStepMod))

    // Reduce step when close to horizon
    // WebGL: float horizonDist = max(ndRadius - uHorizonRadius, 0.0);
    // WebGL: float horizonFactor = smoothstep(0.0, uHorizonRadius * uStepAdaptR, horizonDist);
    const horizonDist = max(ndRadius.sub(uHorizonRadius), float(0))
    const horizonFactor = smoothstep(float(0), uHorizonRadius.mul(uStepAdaptR), horizonDist)
    step.assign(step.mul(mix(float(0.1), float(1), horizonFactor)))

    // Dynamic max based on distance
    const dynamicMax = uStepMax.mul(float(1).add(ndRadius.mul(0.5)))

    return clamp(step, uStepMin, dynamicMax)
  })

  // ============================================
  // Main black hole raymarching shader
  // ============================================

  const blackHoleShader = Fn(() => {
    const worldPos = positionWorld
    const cameraPos = uCameraPosition
    const invModel = uInverseModelMatrix

    // Transform to model space
    // GPU branch: use safe normalize for edge case where camera == worldPos
    const roModel = invModel.mul(vec4(cameraPos, 1.0)).xyz.toVar('ro')
    const worldRayDir = safeNormalizeNoFallback(sub(worldPos, cameraPos))
    // GPU branch: safe normalize for degenerate inverse model matrix
    const rdModel = safeNormalizeNoFallback(invModel.mul(vec4(worldRayDir, 0.0)).xyz).toVar('rd')

    // Check far field intersection
    const farRadius = uFarRadius.mul(uHorizonRadius)
    const farHit = sphereIntersect(roModel, rdModel, farRadius)

    // Early exit if no intersection
    const finalColor = vec4(0, 0, 0, 0).toVar('finalColor')

    If(farHit.z.lessThan(0.5), () => {
      // WebGL parity: When the bounding sphere is entirely behind the camera OR
      // when there's no intersection, return background with alpha=1.0.
      // WebGL: res.color = vec4(sampleBackground(rayDir), 1.0);
      // Also ensure MRT outputs are the "miss" defaults.
      finalColor.assign(vec4(sampleBackground(rdModel), 1.0))
      mrtNormalView.assign(vec3(0, 0, 0))
      mrtHasHit.assign(0)
      mrtClipDepth.assign(1)
      mrtWorldPos.assign(vec3(0, 0, 0))
    })

    If(farHit.z.greaterThanEqual(0.5), () => {
      // Animation time
      const time = uTime.mul(uTimeScale)

      // Dithering for anti-banding
      // WebGL: float dither = interleavedGradientNoise(gl_FragCoord.xy + fract(time));
      // Use screen coordinates (viewportCoordinate.xy) for proper spatial dithering
      const dither = interleavedGradientNoise(viewportCoordinate.xy, fract(time))

      // Initialize ray state
      const tNear = max(float(0), farHit.x)
      const tFar = farHit.y

      const startOffset = dither.mul(0.1)
      const pos = roModel.add(rdModel.mul(tNear.add(startOffset))).toVar('pos')
      const dir = rdModel.toVar('dir')
      const prevPos = pos.toVar('prevPos')

      const marchT = tNear.add(startOffset).toVar('bhMarchT')

      // Accumulation state
      const accColor = vec3(0).toVar('accColor')
      const transmittance = float(1).toVar('transmittance')
      // WebGL: vec3 weightedPosSum; float totalWeight;
      const weightedPosSum = vec3(0).toVar('weightedPosSum')
      const totalWeight = float(0).toVar('totalWeight')
      const hasFirstHit = float(0).toVar('hasFirstHit')
      const firstHitPos = vec3(0).toVar('firstHitPos')
      const normalSum = vec3(0).toVar('normalSum')
      const diskCrossings = float(0).toVar('diskCrossings')
      const hitHorizon = float(0).toVar('hitHorizon')

      // Pre-compute absorption factor
      const absorptionFactor = uEnableAbsorption.select(exp(uAbsorption.mul(-0.5)), float(0))

      // Compute ndRadius before loop
      const ndRadius = ndDistance(pos).toVar('ndRadius')

      // Pre-bend ray
      dir.assign(bendRay(dir, pos, float(0.1), ndRadius))

      // Step jitter
      const stepJitter = dither.toVar('stepJitter')

      // Effective max steps
      // WebGL: int effectiveMaxSteps = max(int(float(uMaxSteps) * uQualityMultiplier), 32);
      const effectiveMaxSteps = max(float(uMaxSteps).mul(uQualityMultiplier), float(32)).toVar('effMaxSteps')

      // Iteration counter for debug heatmap
      const iterationsUsed = float(0).toVar('iterationsUsed')

      // Main raymarch loop
      Loop(MAX_STEPS, ({ i }) => {
        If(float(i).greaterThanEqual(effectiveMaxSteps), () => Break())
        // Track iterations for debug heatmap
        iterationsUsed.assign(float(i).add(1))
        If(marchT.greaterThan(tFar), () => Break())
        If(transmittance.lessThan(uTransmittanceCutoff), () => Break())

        // Horizon check
        If(isInsideHorizon(ndRadius), () => {
          transmittance.assign(0)
          hitHorizon.assign(1)
          Break()
        })

        // Adaptive step size
        const shellStep = shellStepModWithMask(ndRadius)
        const shellMask = shellStep.y.toVar('shellMask')
        const stepSize = adaptiveStepSize(ndRadius, shellStep.x).toVar('stepSize')

        // Volumetric disk step reduction
        if (volumetricDisk) {
          const diskH = abs(pos.y)
          const diskR = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
          const inDiskRegion = diskH
            .lessThan(uManifoldThickness.mul(uHorizonRadius).mul(2))
            .and(diskR.greaterThan(uDiskInnerRadius.mul(0.8)))
            .and(diskR.lessThan(uDiskOuterRadius.mul(1.2)))

          If(inDiskRegion, () => {
            const diskStepLimit = uFastMode.select(float(0.1), float(0.05))
            stepSize.assign(min(stepSize, diskStepLimit.mul(uHorizonRadius)))
          })
        }

        // Apply step jitter (golden ratio for low-discrepancy)
        stepJitter.assign(fract(stepJitter.add(0.618033988749)))
        const jitterScale = stepJitter.sub(0.5).mul(0.4)
        stepSize.assign(stepSize.mul(float(1).add(jitterScale)))

        // Apply lensing
        dir.assign(bendRay(dir, pos, stepSize, ndRadius))

        // Photon shell emission (WebGL parity: stub returns vec3(0.0))
        If(shellMask.greaterThan(0.001), () => {
          // WebGL: vec3 shellEmit = photonShellEmissionWithMask(shellMask, pos);
          // Which returns vec3(0.0) - so we do the same
          const shellEmit = vec3(0, 0, 0)
          accColor.assign(accColor.add(shellEmit.mul(stepSize).mul(transmittance)))
        })

        // Step forward
        prevPos.assign(pos)
        pos.assign(pos.add(dir.mul(stepSize)))
        marchT.assign(marchT.add(stepSize))

        // Update ndRadius for new position
        ndRadius.assign(ndDistance(pos))

        // Immediate horizon check after step
        If(isInsideHorizon(ndRadius), () => {
          transmittance.assign(0)
          hitHorizon.assign(1)
          Break()
        })

        // === Volumetric disk sampling ===
        if (volumetricDisk) {
          const diskR = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
          const density = getDiskDensity(pos, time, diskR)

          If(density.greaterThan(0.001), () => {
            // WebGL parity: only compute the normal when needed for ALGO_NORMAL, but
            // still compute it for first-hit depth/normal recording when density is significant.
            const stepNormal = vec3(0, 1, 0).toVar('stepNormal')
            const computedNormal = float(0).toVar('computedNormal')

            // WebGL: if (uColorAlgorithm == ALGO_NORMAL) { stepNormal = computeVolumetricDiskNormal(...); }
            If(uColorAlgorithm.equal(float(3)), () => {
              stepNormal.assign(computeDiskNormal(pos, dir))
              computedNormal.assign(1)
            })
            const emission = getDiskEmission(
              pos,
              density,
              time,
              dir,
              stepNormal,
              diskR,
              uDiskInnerRadius
            )

            // Beer-Lambert absorption
            const absorption = density.mul(uAbsorption).mul(2)
            const stepTransmittance = exp(absorption.negate().mul(stepSize))

            // Emission contribution
            const stepEmission = emission.mul(stepSize).mul(transmittance)
            accColor.assign(accColor.add(stepEmission))
            transmittance.assign(transmittance.mul(stepTransmittance))

            // Record first hit
            If(hasFirstHit.lessThan(0.5).and(density.greaterThan(0.05)), () => {
              firstHitPos.assign(pos)
              hasFirstHit.assign(1)
              If(computedNormal.lessThan(0.5), () => {
                stepNormal.assign(computeDiskNormal(pos, dir))
              })
              normalSum.assign(stepNormal)
            })

            // Accumulate weighted position for temporal reprojection (WebGL parity)
            // WebGL: float weight = (1.0 - stepTransmittance) * accum.transmittance;
            const weight = float(1.0).sub(stepTransmittance).mul(transmittance)
            weightedPosSum.assign(weightedPosSum.add(pos.mul(weight)))
            totalWeight.assign(totalWeight.add(weight))
          })

          // Disk plane crossing detection (Einstein ring)
          // Uses shadeDiskHit for full WebGL parity:
          // - Base color from getAlgorithmColor
          // - HSL hue shift for gravitational redshift  
          // - Swirl pattern
          // - Noise turbulence
          // - FakeLit lighting (when enabled)
          // - Doppler shift
          // - Multi-intersection gain
          If(diskCrossings.lessThan(float(MAX_DISK_CROSSINGS)), () => {
            const crossingPos = detectDiskCrossing(prevPos, pos)

            If(crossingPos.x.greaterThan(-0.5), () => {
              // Call full WebGL-parity shadeDiskHit function
              // WebGL: vec3 hitColor = shadeDiskHit(crossingPos, dir, diskCrossings, time);
              const hitColor = shadeDiskHit(crossingPos, dir, diskCrossings, time).toVar('hitColor')

              // Compute disk normal for accumulation
              // WebGL: vec3 diskNormal = vec3(0.0, sign(prevPos.y), 0.0);
              const diskNormal = vec3(0, prevPos.y.sign(), 0)

              // Record first hit for depth buffer
              If(hasFirstHit.lessThan(0.5), () => {
                firstHitPos.assign(crossingPos)
                hasFirstHit.assign(1)
              })

              // Accumulate with absorption (matches WebGL accumulateDiskHit)
              const hitOpacity = float(0.85)
              If(uEnableAbsorption, () => {
                accColor.assign(accColor.add(hitColor.mul(transmittance).mul(float(1).sub(absorptionFactor))))
                transmittance.assign(transmittance.mul(absorptionFactor))
              })
              If(uEnableAbsorption.not(), () => {
                accColor.assign(accColor.add(hitColor.mul(transmittance).mul(hitOpacity)))
                transmittance.assign(transmittance.mul(float(1).sub(hitOpacity)))
              })

              // Accumulate position/normal for temporal reprojection (WebGL accumulateDiskHit parity)
              // WebGL: float weight = accum.transmittance + 0.1;
              const weight = transmittance.add(0.1)
              weightedPosSum.assign(weightedPosSum.add(crossingPos.mul(weight)))
              totalWeight.assign(totalWeight.add(weight))
              normalSum.assign(normalSum.add(diskNormal.mul(weight)))
              diskCrossings.assign(diskCrossings.add(1))
            })
          })
        }
      })

      // Handle horizon or background
      If(hitHorizon.greaterThan(0.5), () => {
        transmittance.assign(0)
      })

      // Escaped rays - sample background for color but keep transmittance high
      // This ensures alpha stays low (transparent) so the gravity composite pass
      // can properly show the environment layer through these pixels.
      // WebGL: if (transmittance > 0.01) { bgColor = sampleBackground(bentDirection); accColor += bgColor * transmittance; }
      If(transmittance.greaterThan(0.01).and(hitHorizon.lessThan(0.5)), () => {
        const bgColor = sampleBackground(dir)
        accColor.assign(accColor.add(bgColor.mul(transmittance)))
        // DO NOT set transmittance = 0 here! That would make alpha = 1.0 and
        // block the environment layer in the composite pass.
        // Keep transmittance as-is so alpha = 1.0 - transmittance stays low.
      })

      // Apply bloom boost
      accColor.assign(accColor.mul(uBloomBoost))

      // Debug mode: iteration heatmap visualization
      // Green (few iterations) → Yellow → Red (many iterations)
      // WebGL: if (uDebugMode == 1) { ... }
      If(uDebugMode.equal(1), () => {
        // WebGL: float t = float(iterationsUsed) / float(effectiveMaxSteps);
        const heatT = iterationsUsed.div(effectiveMaxSteps)
        // Green → Yellow → Red gradient
        // WebGL: vec3 heatmap = vec3(smoothstep(0.0, 0.5, t), 1.0 - smoothstep(0.5, 1.0, t), 0.0);
        const heatR = smoothstep(float(0), float(0.5), heatT)
        const heatG = float(1).sub(smoothstep(float(0.5), float(1), heatT))
        const heatB = float(0)
        accColor.assign(vec3(heatR, heatG, heatB))
        transmittance.assign(0) // Fully opaque
      })

      // ============================================
      // MRT Output Computation
      // Matches WebGL main.glsl.ts gNormal, gPosition, gl_FragDepth outputs
      // ============================================
      // WebGL: result.weightedCenter = totalWeight > 0.001 ? weightedPosSum / totalWeight : fallbackPos;
      const weightedCenter = totalWeight.greaterThan(0.001).select(
        weightedPosSum.div(max(totalWeight, float(0.001))),
        pos
      )

      // WebGL: result.averageNormal = normalLenSq > 1e-6 ? normalSum * inversesqrt(normalLenSq) : normalize(rayDir);
      const normalLenSq = dot(normalSum, normalSum)
      const safeNormalLenSq = max(normalLenSq, float(1e-6))
      const averageNormal = normalLenSq.greaterThan(1e-6).select(
        normalSum.div(sqrt(safeNormalLenSq)),
        rdModel
      )

      If(hasFirstHit.greaterThan(0.5), () => {
        // Transform local-space normal to world-space using model matrix
        // WebGL: vec3 worldNormal = normalize(mat3(uModelMatrix) * result.averageNormal);
        // Note: mat3() in TSL expects 3 vec3 args, use toMat3() to extract 3x3 from 4x4
        const modelMat3 = (uModelMatrix as unknown as { toMat3: () => ReturnType<typeof mat3> }).toMat3()
        const worldNormalRaw = modelMat3.mul(averageNormal)
        const wnLen = sqrt(dot(worldNormalRaw, worldNormalRaw))
        const safeWnLen = max(wnLen, float(0.0001))
        const worldNormal = wnLen.greaterThan(0.0001).select(worldNormalRaw.div(safeWnLen), vec3(0, 1, 0))

        // Transform world-space to view-space
        // WebGL: vec3 viewNormalRaw = mat3(uViewMatrix) * worldNormal;
        const viewMat3 = (uViewMatrix as unknown as { toMat3: () => ReturnType<typeof mat3> }).toMat3()
        const viewNormalRaw = viewMat3.mul(worldNormal)
        const vnLen = sqrt(dot(viewNormalRaw, viewNormalRaw))
        // GPU branch: select() evaluates both branches, guard vnLen before division
        const safeVnLen = max(vnLen, float(0.0001))
        const viewNormal = vnLen.greaterThan(0.0001).select(
          viewNormalRaw.div(safeVnLen),
          vec3(0, 0, 1)
        )

        // Assign to MRT storage nodes
        mrtNormalView.assign(viewNormal)
        mrtHasHit.assign(1)

        // Black hole does not use temporal accumulation (intentionally disabled).
        // Keep gPosition dummy output behavior (vec4(0.0)) by keeping mrtWorldPos at zero.
        mrtWorldPos.assign(vec3(0, 0, 0))

        // Compute clip-space depth (depthNode equivalent)
        // WebGPU: NDC z is already in [0,1] - use z/w directly (no * 0.5 + 0.5 conversion)
        // Note: WebGL uses gl_FragDepth = clamp((z/w) * 0.5 + 0.5, 0, 1) but TSL is WebGPU
        const worldHitPos = uModelMatrix.mul(vec4(firstHitPos, 1.0))
        const clipPos = uProjectionMatrix.mul(uViewMatrix.mul(worldHitPos))
        // GPU branch: guard clipW directly rather than using select() which evaluates both branches
        const safeClipW = max(abs(clipPos.w), float(0.0001)).mul(clipPos.w.greaterThanEqual(0).select(float(1), float(-1)))
        mrtClipDepth.assign(clamp(clipPos.z.div(safeClipW), float(0), float(1)))
      })

      // For background/miss pixels, use far plane depth and zero normal
      If(hasFirstHit.lessThan(0.5), () => {
        mrtNormalView.assign(vec3(0, 0, 0))
        mrtHasHit.assign(0)
        mrtClipDepth.assign(1) // Far plane
        mrtWorldPos.assign(vec3(0, 0, 0))
      })

      // Final alpha from transmittance
      const alpha = float(1).sub(transmittance)
      finalColor.assign(vec4(accColor, alpha))
    })

    return finalColor
  })

  // ============================================
  // Create material
  // ============================================

  const material = new MeshBasicNodeMaterial()
  material.side = THREE.BackSide
  material.transparent = true
  material.depthWrite = false
  ;(material as unknown as { blending: number }).blending = THREE.NormalBlending

  // Create the main shader node
  const shaderOutput = blackHoleShader()
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
    // Alpha channel stores hit flag (1 = valid normal, 0 = background)
    normal: vec4(
      mrtNormalView.mul(0.5).add(0.5),
      mrtHasHit
    ),
    // 'position' provides world position for temporal reprojection
    // Black hole does not use temporal accumulation, so keep this as a dummy output.
    position: vec4(0, 0, 0, 0),
  })

  // Custom depth output for gl_FragDepth equivalent
  // This ensures proper depth sorting for raymarched geometry
  material.depthNode = mrtClipDepth

  return {
    material,
    uniforms,
    features,
    envMapNode: envMapTextureNode,
  }
}
