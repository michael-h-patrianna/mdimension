/**
 * TSL Volumetric Accretion Disk
 *
 * Implements a physically-inspired volumetric accretion disk using raymarching.
 *
 * Key Features:
 * - Volumetric density field with ridged multifractal noise
 * - Domain Warping for fluid dynamics
 * - Relativistic beaming (Doppler boosting intensity)
 * - Temperature gradient (Blackbody)
 * - Soft edges and gaps
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/disk
 */

import {
  Fn,
  float,
  vec3,
  vec2,
  sqrt,
  max,
  min,
  pow,
  abs,
  smoothstep,
  dot,
  sin,
  exp,
  atan,
  mix,
  clamp,
  If,
  length,
  log,
  fract,
  uniform,
  viewportCoordinate,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import * as THREE from 'three'
import { safeNormalize3 } from '../../../utils/safe-math'

// Import dependencies from sibling modules
import { noise3D } from './manifold'
import {
  createGravitationalRedshift,
  createDopplerFactor,
  createApplyDopplerShift,
} from './doppler'
import {
  rgb2hsl,
  hsl2rgb,
  createGetAlgorithmColor,
  ALGO_BLACKBODY,
  type ColorUniforms,
} from './colors'

/**
 * Uniforms for accretion disk.
 */
export interface DiskUniforms {
  /** Inner edge of disk (ISCO) */
  uDiskInnerRadius: UniformNode<number>
  /** Outer edge of disk */
  uDiskOuterRadius: UniformNode<number>
  /** Disk half-thickness */
  uDiskHalfThickness: UniformNode<number>
  /** Disk density multiplier */
  uDiskDensity: UniformNode<number>
  /** Disk rotation speed */
  uDiskRotationSpeed: UniformNode<number>
  /** Time for animation */
  uTime: UniformNode<number>
  /** Base disk color */
  uDiskColor: UniformNode<THREE.Color>
  /** Inner temperature (hot core) */
  uDiskTempInner: UniformNode<number>
  /** Outer temperature (cooler edge) */
  uDiskTempOuter: UniformNode<number>
  /** Horizon radius */
  uHorizonRadius?: UniformNode<number>
  /** Manifold thickness */
  uManifoldThickness?: UniformNode<number>
  /** Manifold intensity */
  uManifoldIntensity?: UniformNode<number>
  /** Spin parameter */
  uSpin?: UniformNode<number>
  /** Noise scale */
  uNoiseScale?: UniformNode<number>
  /** Noise amount */
  uNoiseAmount?: UniformNode<number>
  /** Fast mode flag */
  uFastMode?: UniformNode<boolean>
  /** Ultra fast mode flag */
  uUltraFastMode?: UniformNode<boolean>
  /** Disk rotation angle */
  uDiskRotationAngle?: UniformNode<number>
  /** Keplerian differential */
  uKeplerianDifferential?: UniformNode<number>
  /** Pre-computed inner disk radius */
  uDiskInnerR?: UniformNode<number>
  /** Pre-computed outer disk radius */
  uDiskOuterR?: UniformNode<number>
  /** Manifold type for thickness scale */
  uManifoldType?: UniformNode<number>
  /** Max thickness per dimension */
  uThicknessPerDimMax?: UniformNode<number>
  /** Current dimension */
  dimension?: number
  /** Swirl amount */
  uSwirlAmount?: UniformNode<number>
  /** Lighting mode (0=None, 1=FakeLit) */
  uLightingMode?: UniformNode<number>
  /** Color algorithm */
  uColorAlgorithm?: UniformNode<number>
  /** Light positions array */
  uLightPositions?: UniformNode<THREE.Vector3>[]
  /** Light colors array */
  uLightColors?: UniformNode<THREE.Color>[]
  /** Camera position */
  uCameraPosition?: UniformNode<THREE.Vector3>
  /** Material roughness */
  uRoughness?: UniformNode<number>
  /** Specular intensity */
  uSpecular?: UniformNode<number>
  /** Ambient tint */
  uAmbientTint?: UniformNode<number>
  /** Doppler enabled (0 = disabled, 1 = enabled) */
  uDopplerEnabled?: UniformNode<number>
  /** Doppler strength */
  uDopplerStrength?: UniformNode<number>
  /** Multi-intersection gain for Einstein rings */
  uMultiIntersectionGain?: UniformNode<number>
  /** Base color (for non-blackbody algorithms) */
  uBaseColor?: UniformNode<THREE.Color>
  /** Cosine palette parameters (for ALGO_COSINE, ALGO_DISTANCE, ALGO_RADIAL) */
  uCosineA?: UniformNode<THREE.Vector3>
  uCosineB?: UniformNode<THREE.Vector3>
  uCosineC?: UniformNode<THREE.Vector3>
  uCosineD?: UniformNode<THREE.Vector3>
  /** LCH parameters (for ALGO_LCH) */
  uLchLightness?: UniformNode<number>
  uLchChroma?: UniformNode<number>
  /** Sample quality (0=low, 1=medium, 2+=high) - controls noise octaves */
  uSampleQuality?: UniformNode<number>
  /** Pulse animation enabled (WebGL: uPulseEnabled) */
  uPulseEnabled?: UniformNode<boolean>
  /** Pulse animation speed (WebGL: uPulseSpeed) */
  uPulseSpeed?: UniformNode<number>
  /** Pulse animation amount (WebGL: uPulseAmount) */
  uPulseAmount?: UniformNode<number>
}

// Disk geometry constants (matching WebGL)
const DISK_INNER_EDGE_SOFTNESS = 0.9
const DISK_OUTER_EDGE_SOFTNESS = 0.9
const DISK_OUTER_FADE_END = 1.2
const DISK_FLARE_POWER = 2.5
const DISK_FLARE_SCALE = 1.5
const TEMP_FALLOFF_EXPONENT = 0.75

// Density constants
const DENSITY_CUTOFF = 0.001
const DISK_BASE_INTENSITY = 20.0

// Brightness constants
const BLACKBODY_BOOST = 2.0
const PALETTE_BOOST = 2.5
const CORE_BRIGHTNESS = 3.0

// Noise parameters
const DUST_LANE_FREQUENCY = 15.0
const DUST_LANE_STRENGTH = 0.3

// SDF disk constants (used in main raymarch loop)
// const MAX_DISK_CROSSINGS = 8  // Defined in composeBlackHoleTSL.ts

// Color algorithm constants for ALGO_NORMAL check
const ALGO_NORMAL = 3

/**
 * Simplex-like noise 3D for accretion disk.
 *
 * Uses the sin-based value noise from manifold.ts (which returns [0,1])
 * and maps to [-1,1] to match WebGL simplex noise behavior.
 *
 * Note: The original GLSL simplex noise uses vec4 intermediate values which
 * don't map cleanly to TSL's type system. Using value noise provides similar
 * visual results for the ridged multifractal patterns.
 *
 * WebGL: Uses either texture-based noise (USE_NOISE_TEXTURE) or procedural simplex.
 * TSL: Uses value noise - visually similar for plasma/electric FBM patterns.
 */
export const snoise3D = Fn(([v]: [Node]) => {
  // noise3D returns [0, 1], map to [-1, 1] to match simplex noise range
  return noise3D(v).mul(2.0).sub(1.0)
})

/**
 * Ridged multifractal noise for electric/plasma look.
 *
 * PERF OPTIMIZATION (OPT-BH-2): Octave count adapts to quality settings:
 * - Fast mode: 1 octave with amplitude boost (saves 1-3 snoise calls)
 * - Low quality (uSampleQuality < 2): 3 octaves (3 snoise calls)
 * - High quality (uSampleQuality >= 2): 4 octaves (4 snoise calls)
 */
export function createRidgedMF(uniforms: DiskUniforms) {
  const sampleQuality = uniforms.uSampleQuality ?? uniform(1)

  return Fn(([p]: [Node]) => {
    const sum = float(0).toVar('ridgedSum')

    // Fast mode: single octave with amplitude boost
    If(uniforms.uFastMode ?? float(0), () => {
      const n = snoise3D(p)
      const nAbs = float(1.0).sub(abs(n))
      sum.assign(nAbs.mul(nAbs).mul(0.8))
    })

    // Standard path: 3-4 octaves based on quality
    If((uniforms.uFastMode ?? float(0)).not(), () => {
      // First octave (always)
      const n1 = snoise3D(p)
      const v1 = float(1.0).sub(abs(n1))
      sum.assign(v1.mul(v1).mul(0.5))

      // Second octave
      const n2 = snoise3D(p.mul(2.0))
      const v2 = float(1.0).sub(abs(n2))
      sum.assign(sum.add(v2.mul(v2).mul(0.25)))

      // Third octave (quality >= low)
      const n3 = snoise3D(p.mul(4.0))
      const v3 = float(1.0).sub(abs(n3))
      sum.assign(sum.add(v3.mul(v3).mul(0.125)))

      // Fourth octave (quality >= medium, uSampleQuality >= 2)
      // WebGL: if (octaves > 3) { ... }
      If(sampleQuality.greaterThanEqual(float(2)), () => {
        const n4 = snoise3D(p.mul(8.0))
        const v4 = float(1.0).sub(abs(n4))
        sum.assign(sum.add(v4.mul(v4).mul(0.0625)))
      })
    })

    return sum
  })
}

/**
 * Flow noise with domain warping for fluid dynamics look.
 */
export function createFlowNoise(uniforms: DiskUniforms) {
  const ridgedMF = createRidgedMF(uniforms)

  return Fn(([p, time]: [Node, Node]) => {
    const result = float(0).toVar('flowResult')

    // Fast mode: skip domain warping
    If(uniforms.uFastMode ?? float(0), () => {
      const animOffset = vec3(time.mul(0.1), time.mul(0.05), 0)
      result.assign(ridgedMF(p.add(animOffset)))
    })

    // Full quality: domain warping for fluid turbulence
    If((uniforms.uFastMode ?? float(0)).not(), () => {
      const q = vec3(
        snoise3D(p.add(vec3(0, 0, time.mul(0.2)))),
        snoise3D(p.add(vec3(4.2, 1.3, time.mul(0.15)))),
        snoise3D(p.add(vec3(2.4, 8.1, time.mul(0.25))))
      )

      const noiseScale = uniforms.uNoiseScale ?? float(1.0)
      result.assign(ridgedMF(p.add(q.mul(noiseScale))))
    })

    return result
  })
}

/**
 * Compute disk height at given radius (flared disk).
 */
export const diskHeight = Fn(
  ([r, innerR, halfThickness]: [Node, Node, Node]) => {
    // Disk flares outward with radius: h(r) = h0 * (r / r_inner)^flare
    const flareExponent = float(0.5)
    const normalizedR = max(r.div(max(innerR, float(0.1))), float(1))
    return halfThickness.mul(pow(normalizedR, flareExponent))
  }
)

/**
 * Calculate density of the accretion disk at a given point.
 *
 * Full volumetric implementation matching WebGL disk-volumetric.glsl.ts
 */
export function createGetDiskDensity(uniforms: DiskUniforms) {
  const flowNoise = createFlowNoise(uniforms)

  return Fn(([pos, time, r]: [Node, Node, Node]) => {
    const h = abs(pos.y)

    const innerR = uniforms.uDiskInnerRadius
    const outerR = uniforms.uDiskOuterRadius

    // 1. Basic Bounds Check
    const result = float(0).toVar('diskDensity')

    If(
      r
        .greaterThanEqual(innerR.mul(DISK_INNER_EDGE_SOFTNESS))
        .and(r.lessThanEqual(outerR.mul(DISK_OUTER_FADE_END))),
      () => {
        // 2. Vertical Profile (Gaussian with flaring)
        // CRITICAL: Guard outerR - GPU evaluates even when condition is false (see docs/tsl.md)
        const safeOuterR = max(outerR, float(0.001))
        const flare = float(1.0).add(
          pow(r.div(safeOuterR), float(DISK_FLARE_POWER)).mul(DISK_FLARE_SCALE)
        )
        const horizonR = uniforms.uHorizonRadius ?? float(1.0)
        const manifoldThickness = uniforms.uManifoldThickness ?? float(0.1)
        const thickness = manifoldThickness.mul(horizonR).mul(0.5).mul(flare)
        // CRITICAL: Guard thickness - could be zero if uniforms are zero
        const safeThickness = max(thickness, float(0.001))

        const hDensity = exp(h.mul(h).negate().div(safeThickness.mul(safeThickness)))

        If(hDensity.greaterThanEqual(DENSITY_CUTOFF), () => {
          // Ultra-fast mode: skip ALL noise computation
          If(uniforms.uUltraFastMode ?? float(0), () => {
            const rDensity = smoothstep(innerR.mul(DISK_INNER_EDGE_SOFTNESS), innerR, r).mul(
              float(1.0).sub(
                smoothstep(outerR.mul(DISK_OUTER_EDGE_SOFTNESS), outerR.mul(DISK_OUTER_FADE_END), r)
              )
            )
            const rOverInner = r.div(max(innerR, float(0.001)))
            const rDensityScaled = rDensity.mul(float(2.0).div(rOverInner.mul(rOverInner).add(0.1)))

            const manifoldIntensity = uniforms.uManifoldIntensity ?? float(1.0)
            result.assign(hDensity.mul(rDensityScaled).mul(manifoldIntensity).mul(DISK_BASE_INTENSITY))

            // Pulse animation for SDF disk - radial waves propagating outward
            const pulseEnabledSdf = uniforms.uPulseEnabled ?? uniform(false)
            const pulseSpeedSdf = uniforms.uPulseSpeed ?? float(0.3)
            const pulseAmountSdf = uniforms.uPulseAmount ?? float(0.2)

            If(pulseEnabledSdf, () => {
              const horizonRadiusSdf = uniforms.uHorizonRadius ?? float(1.0)
              const safeHorizonRadiusSdf = max(horizonRadiusSdf, float(0.001))
              const wavePhaseSdf = r.div(safeHorizonRadiusSdf).mul(2.0).sub(time.mul(pulseSpeedSdf))
              const pulseFactorSdf = float(1.0).add(sin(wavePhaseSdf).mul(pulseAmountSdf))
              result.assign(result.mul(pulseFactorSdf))
            })
          })

          // Standard path with noise
          If((uniforms.uUltraFastMode ?? float(0)).not(), () => {
            // Asymmetric ISCO: Modulate inner radius based on spin
            // GPU branch: select() evaluates both branches, so guard r before division
            const spin = uniforms.uSpin ?? float(0)
            const safeRForSpin = max(r, float(0.001))
            const spinMod = spin.greaterThan(0.01).select(
              pos.x.div(safeRForSpin).mul(spin).mul(-0.4),
              float(0)
            )
            const effectiveInnerR = innerR.mul(float(1.0).add(spinMod))
            const safeInnerR = max(effectiveInnerR, float(0.001))

            // Radial profile with soft edges
            const rDensity = smoothstep(effectiveInnerR.mul(DISK_INNER_EDGE_SOFTNESS), effectiveInnerR, r)
              .mul(
                float(1.0).sub(
                  smoothstep(outerR.mul(DISK_OUTER_EDGE_SOFTNESS), outerR.mul(DISK_OUTER_FADE_END), r)
                )
              )
              .toVar('rDensity')

            // Inverse square falloff for bulk density
            const rOverInner = r.div(safeInnerR)
            rDensity.assign(rDensity.mul(float(2.0).div(rOverInner.mul(rOverInner).add(0.1))))

            // 4. Volumetric Detail (Keplerian rotation + noise)
            const angle = atan(pos.z, pos.x)

            // Keplerian disk rotation
            const diskRotAngle = uniforms.uDiskRotationAngle ?? float(0)
            const keplerDiff = uniforms.uKeplerianDifferential ?? float(0)
            const phase = float(angle).toVar('phase')

            If(keplerDiff.greaterThan(0.001), () => {
              const safeR = max(r, safeInnerR.mul(0.1))
              const ratio = safeInnerR.div(safeR)
              const keplerianFactor = ratio.mul(sqrt(ratio))
              const rotSpeed = mix(float(1.0), keplerianFactor, keplerDiff)
              phase.assign(angle.add(diskRotAngle.mul(rotSpeed)))
            })

            // Per-pixel noise offset to break coherent sampling (ring artifacts)
            // Uses screen-space coordinates to ensure nearby pixels sample slightly different noise
            // WebGL: vec2 pixelCoord = gl_FragCoord.xy;
            // WebGL: float pixelHash = fract(sin(dot(pixelCoord + fract(time) * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
            const pixelCoord = viewportCoordinate.xy
            const pixelHash = fract(
              sin(
                dot(
                  pixelCoord.add(fract(time).mul(100.0)),
                  vec2(12.9898, 78.233)
                )
              ).mul(43758.5453)
            )
            // WebGL: noiseOffset = pixelHash * 0.1
            const noiseOffset = pixelHash.mul(0.1)

            // Noise coordinates
            // Add per-pixel offset to r-component to break concentric ring patterns
            const noiseScale = uniforms.uNoiseScale ?? float(1.0)
            // WebGL: vec3 noiseCoord = vec3(r * 1.5 + noiseOffset, phase * 2.0, h * 4.0);
            const noiseCoord = vec3(r.mul(1.5).add(noiseOffset), phase.mul(2.0), h.mul(4.0))

            // Apply noise
            const noiseAmount = uniforms.uNoiseAmount ?? float(0)
            If(noiseAmount.greaterThan(0.01), () => {
              const warped = flowNoise(noiseCoord.mul(noiseScale), time.mul(0.2))
              const noiseVal = smoothstep(float(0.1), float(0.9), warped)
              const noiseValSq = noiseVal.mul(noiseVal)
              rDensity.assign(rDensity.mul(mix(float(1.0), noiseValSq.mul(3.0), noiseAmount)))
            })

            // 5. Dust Lanes (dark rings)
            // Apply per-pixel offset to break coherent ring patterns in dust lanes too
            // WebGL: float dustLanes = 0.5 + 0.5 * sin((r + noiseOffset) * DUST_LANE_FREQUENCY / uHorizonRadius);
            //        dustLanes = sqrt(dustLanes); // Sharpen
            If(noiseAmount.greaterThan(0.001), () => {
              const horizonRadius = uniforms.uHorizonRadius ?? float(1.0)
              // CRITICAL: Guard horizonRadius - GPU evaluates even when condition is false
              const safeHorizonRadius = max(horizonRadius, float(0.001))
              // Add noiseOffset to r to break coherent ring patterns
              const dustLanesBase = float(0.5).add(sin(r.add(noiseOffset).mul(DUST_LANE_FREQUENCY).div(safeHorizonRadius)).mul(0.5))
              const dustLanes = sqrt(dustLanesBase) // Sharpen
              rDensity.assign(rDensity.mul(mix(float(1.0), dustLanes, float(DUST_LANE_STRENGTH).mul(noiseAmount))))
            })

            const manifoldIntensity = uniforms.uManifoldIntensity ?? float(1.0)
            result.assign(hDensity.mul(rDensity).mul(manifoldIntensity).mul(DISK_BASE_INTENSITY))

            // Pulse animation - radial waves propagating outward from center
            // WebGL parity: uPulseEnabled, uPulseSpeed, uPulseAmount
            const pulseEnabled = uniforms.uPulseEnabled ?? uniform(false)
            const pulseSpeed = uniforms.uPulseSpeed ?? float(0.3)
            const pulseAmount = uniforms.uPulseAmount ?? float(0.2)

            If(pulseEnabled, () => {
              const horizonRadius = uniforms.uHorizonRadius ?? float(1.0)
              const safeHorizonRadius = max(horizonRadius, float(0.001))
              // Radial wave: sin(r/horizon - time * speed) creates outward propagating waves
              // Frequency scaled by horizon radius for consistent visual appearance
              const wavePhase = r.div(safeHorizonRadius).mul(2.0).sub(time.mul(pulseSpeed))
              // sin returns [-1, 1], map to [1-amount, 1+amount] for density modulation
              const pulseFactor = float(1.0).add(sin(wavePhase).mul(pulseAmount))
              result.assign(result.mul(pulseFactor))
            })
          })
        })
      }
    )

    return result
  })
}

/**
 * Sample disk density at a position (convenience wrapper).
 */
export function createSampleDiskDensity(uniforms: DiskUniforms) {
  const getDiskDensity = createGetDiskDensity(uniforms)

  return Fn(([pos]: [Node]) => {
    const r = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
    return getDiskDensity(pos, uniforms.uTime, r)
  })
}

/**
 * Calculate emission color for a point in the disk.
 *
 * Full implementation matching WebGL disk-volumetric.glsl.ts
 *
 * @param pos - Position in disk (currently unused, kept for API parity)
 * @param time - Animation time (currently unused, kept for API parity)
 * @param normal - Surface normal (currently unused, kept for API parity)
 */
export function createGetDiskEmission(uniforms: DiskUniforms) {
  // Create Doppler functions for relativistic beaming (matching WebGL)
  const dopplerFactor = createDopplerFactor({
    uDopplerEnabled: uniforms.uDopplerEnabled ?? uniform(0),
    uDopplerStrength: uniforms.uDopplerStrength ?? uniform(0.5),
    uHorizonRadius: uniforms.uHorizonRadius ?? uniform(1.0),
    uDiskInnerR: uniforms.uDiskInnerRadius,
  })
  const applyDopplerShift = createApplyDopplerShift({
    uDopplerEnabled: uniforms.uDopplerEnabled ?? uniform(0),
    uDopplerStrength: uniforms.uDopplerStrength ?? uniform(0.5),
    uHorizonRadius: uniforms.uHorizonRadius ?? uniform(1.0),
    uDiskInnerR: uniforms.uDiskInnerRadius,
  })

  // MKB-001: Create algorithm color function OUTSIDE Fn()
  // Only create if color uniforms are provided (for non-blackbody modes)
  const colorAlgorithm = uniforms.uColorAlgorithm ?? uniform(ALGO_BLACKBODY)
  const baseColor = uniforms.uBaseColor ?? uniform(new THREE.Color(1.0, 0.5, 0.1))
  const horizonR = uniforms.uHorizonRadius ?? uniform(1.0)
  const diskTemp = uniforms.uDiskTempInner

  // Create getAlgorithmColor for non-blackbody modes
  const getAlgorithmColor = createGetAlgorithmColor({
    uColorAlgorithm: colorAlgorithm,
    uBaseColor: baseColor,
    uDiskTemperature: diskTemp,
    uHorizonRadius: horizonR,
    uCosineA: uniforms.uCosineA ?? uniform(new THREE.Vector3(0.5, 0.5, 0.5)),
    uCosineB: uniforms.uCosineB ?? uniform(new THREE.Vector3(0.5, 0.5, 0.5)),
    uCosineC: uniforms.uCosineC ?? uniform(new THREE.Vector3(1.0, 1.0, 1.0)),
    uCosineD: uniforms.uCosineD ?? uniform(new THREE.Vector3(0.0, 0.33, 0.67)),
    uLchLightness: uniforms.uLchLightness ?? uniform(0.7),
    uLchChroma: uniforms.uLchChroma ?? uniform(0.5),
  })

  return Fn(([pos, density, _time, rayDir, normal, r, innerR]: [Node, Node, Node, Node, Node, Node, Node]) => {
    const safeInnerR = max(innerR, float(0.001))
    const safeR = max(r, safeInnerR)

    // Standard thin disk temperature profile: T ∝ r^(-3/4)
    const tempRatio = pow(safeInnerR.div(safeR), float(TEMP_FALLOFF_EXPONENT))

    const result = vec3(0).toVar('diskEmission')

    // WebGL: if (uColorAlgorithm == ALGO_BLACKBODY) { ... } else { ... }
    // Blackbody mode: use temperature-based blackbody calculation
    If(colorAlgorithm.equal(float(ALGO_BLACKBODY)), () => {
      // Map ratio to temperature
      const tempVal = diskTemp.mul(tempRatio)
      const bbTemp = clamp(tempVal, float(1000.0), float(40000.0)).div(100.0)

      // Blackbody color calculation (inline to avoid circular deps)
      const bbR = bbTemp.lessThanEqual(float(66.0)).select(
        float(1.0),
        float(329.698727446).mul(pow(max(bbTemp.sub(60.0), float(0.01)), float(-0.1332047592))).div(255.0)
      )
      const bbG = bbTemp.lessThanEqual(float(66.0)).select(
        float(99.4708025861).mul(log(max(bbTemp, float(1.0)))).sub(161.1195681661).div(255.0),
        float(288.1221695283).mul(pow(max(bbTemp.sub(60.0), float(0.01)), float(-0.0755148492))).div(255.0)
      )
      const bbB = bbTemp.greaterThanEqual(float(66.0)).select(
        float(1.0),
        bbTemp.lessThanEqual(float(19.0)).select(
          float(0.0),
          float(138.5177312231).mul(log(max(bbTemp.sub(10.0), float(0.01)))).sub(305.0447927307).div(255.0)
        )
      )
      const bbColor = clamp(vec3(bbR, bbG, bbB), float(0.0), float(1.0))

      result.assign(bbColor.mul(BLACKBODY_BOOST))
    })

    // Non-blackbody mode: use palette/algorithm color
    If(colorAlgorithm.notEqual(float(ALGO_BLACKBODY)), () => {
      // WebGL: float t = pow(max(0.0, 1.0 - tempRatio), 0.8);
      // Guard for GPU branch safety: avoid pow with negative base
      const safeBase = max(float(1.0).sub(tempRatio), float(0.0))
      const t = pow(safeBase, float(0.8))

      // WebGL: color = getAlgorithmColor(t, pos, normal);
      const algorithmColor = getAlgorithmColor(t, pos, normal)

      // WebGL: color = pow(color, vec3(1.5)); // Boost contrast
      const contrastedColor = pow(max(algorithmColor, float(0.001)), vec3(1.5, 1.5, 1.5))

      result.assign(contrastedColor)

      // Add thermal core - lighter/whiter at high temp (for all non-blackbody modes)
      // WebGL: vec3 coreColor = vec3(1.0, 0.98, 0.9);
      const coreColor = vec3(1.0, 0.98, 0.9)
      // WebGL: float coreMix = smoothstep(0.7, 1.0, tempRatio);
      const coreMix = smoothstep(float(0.7), float(1.0), tempRatio)
      // WebGL: color = mix(color, coreColor * CORE_BRIGHTNESS, coreMix * 0.6);
      result.assign(mix(result, coreColor.mul(CORE_BRIGHTNESS), coreMix.mul(0.6)))

      // WebGL: color *= PALETTE_BOOST * tempRatio;
      result.assign(result.mul(PALETTE_BOOST).mul(tempRatio))
    })

    // Gravitational Redshift (applied to both modes)
    const rsOverR = horizonR.div(max(r, horizonR.mul(1.01)))
    const gRedshift = sqrt(max(float(1.0).sub(rsOverR), float(0.01)))
    result.assign(result.mul(gRedshift))

    // Doppler Shift (Relativistic Beaming) - matching WebGL disk-volumetric.glsl.ts
    // Approaching side is brighter and bluer
    const dopplerFac = dopplerFactor(pos, rayDir)
    result.assign(applyDopplerShift(result, dopplerFac))

    // Limb Darkening
    const cosTheta = abs(rayDir.y)
    const limbDarkening = float(1.0).sub(float(0.4).mul(float(1.0).sub(cosTheta)))
    result.assign(result.mul(limbDarkening))

    // Density grading
    result.assign(result.mul(density.mul(0.2).add(0.1)))

    return result.mul(density)
  })
}

/**
 * Sample disk color/emission at a position (convenience wrapper).
 */
export function createSampleDiskEmission(uniforms: DiskUniforms) {
  const sampleDensity = createSampleDiskDensity(uniforms)
  const getDiskEmission = createGetDiskEmission(uniforms)

  return Fn(([pos]: [Node]) => {
    const r = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
    const density = sampleDensity(pos)

    // Default normal (disk plane)
    const normal = vec3(0, 1, 0)
    // Default ray direction (looking down at disk)
    const rayDir = vec3(0, -1, 0)

    return getDiskEmission(pos, density, uniforms.uTime, rayDir, normal, r, uniforms.uDiskInnerRadius)
  })
}

/**
 * Ray-disk intersection for bounding.
 * Returns (tNear, tFar) for the disk bounding volume.
 */
export function createDiskIntersect(uniforms: DiskUniforms) {
  return Fn(([ro, rd]: [Node, Node]) => {
    // Simple bounding sphere around disk
    const outerR = uniforms.uDiskOuterRadius
    const thickness = uniforms.uDiskHalfThickness

    // Sphere radius that encompasses disk
    const boundRadius = sqrt(outerR.mul(outerR).add(thickness.mul(thickness)))

    // Ray-sphere intersection
    const b = dot(ro, rd)
    const c = dot(ro, ro).sub(boundRadius.mul(boundRadius))
    const d = b.mul(b).sub(c)

    // No intersection if discriminant < 0
    const sqrtD = sqrt(max(d, float(0)))
    const tNear = max(b.negate().sub(sqrtD), float(0))
    const tFar = b.negate().add(sqrtD)

    // Return negative if no intersection
    const hasHit = d.greaterThanEqual(0).and(tFar.greaterThan(0))

    return hasHit.select(
      vec3(tNear, tFar, float(1)), // x=tNear, y=tFar, z=hasHit
      vec3(-1, -1, float(0))
    )
  })
}

// ============================================
// SDF-BASED ACCRETION DISK (Einstein Ring)
// ============================================

/**
 * Get disk-specific thickness scale based on dimension.
 *
 * 100% port of WebGL getManifoldThicknessScale() - disk variant for DiskUniforms
 * Note: Renamed to createGetDiskThicknessScale to avoid duplicate export with manifold.ts
 */
export function createGetDiskThicknessScale(uniforms: DiskUniforms) {
  return Fn(() => {
    const manifoldType = uniforms.uManifoldType ?? float(0)
    const dimension = uniforms.dimension ?? 3
    const thicknessPerDimMax = uniforms.uThicknessPerDimMax ?? float(4.0)

    // Auto mode: select based on dimension
    const effectiveType = manifoldType.notEqual(0).select(
      manifoldType,
      dimension <= 3
        ? float(1) // disk
        : dimension === 4
          ? float(2) // sheet
          : dimension <= 6
            ? float(3) // slab
            : float(4) // field
    )

    return effectiveType.equal(1).select(
      float(1.0), // disk
      effectiveType.equal(2).select(
        float(2.0), // sheet
        effectiveType.equal(3).select(
          min(float(dimension - 2), thicknessPerDimMax), // slab
          min(float(dimension), thicknessPerDimMax) // field
        )
      )
    )
  })
}

/**
 * SDF for thick disk (annulus with height).
 * Returns signed distance to disk surface.
 *
 * 100% port of WebGL sdfDisk() - uses getManifoldThicknessScale()
 */
export function createSdfDisk(uniforms: DiskUniforms) {
  const getThicknessScale = createGetDiskThicknessScale(uniforms)

  return Fn(([pos3d]: [Node]) => {
    const r = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))
    const h = abs(pos3d.y)

    // PERF (OPT-BH-6): Use pre-computed disk radii uniforms
    const innerR = uniforms.uDiskInnerR ?? uniforms.uDiskInnerRadius
    const outerR = uniforms.uDiskOuterR ?? uniforms.uDiskOuterRadius
    const horizonR = uniforms.uHorizonRadius ?? float(1.0)
    const manifoldThickness = uniforms.uManifoldThickness ?? float(0.1)
    // WebGL: float thickness = uManifoldThickness * uHorizonRadius * getManifoldThicknessScale();
    const thickness = manifoldThickness.mul(horizonR).mul(getThicknessScale())
    const halfThick = thickness.mul(0.5)

    // Clamp r to annulus range
    const clampedR = clamp(r, innerR, outerR)
    const dr = abs(r.sub(clampedR))

    // Vertical distance to disk surface
    const dh = h.sub(halfThick)

    // Inside radially: SDF is just vertical distance
    // Outside: combine radial and vertical
    return r.greaterThanEqual(innerR).and(r.lessThanEqual(outerR)).select(
      dh,
      dh.lessThanEqual(0).select(dr, sqrt(dr.mul(dr).add(dh.mul(dh))))
    )
  })
}

/**
 * Check if a position is inside the disk annulus (radial bounds only).
 */
export function createIsInDiskBounds(uniforms: DiskUniforms) {
  return Fn(([pos3d]: [Node]) => {
    const r = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))
    return r.greaterThanEqual(uniforms.uDiskInnerRadius).and(r.lessThanEqual(uniforms.uDiskOuterRadius))
  })
}

/**
 * Detect plane crossing between two positions.
 * Returns interpolated crossing point if crossing detected.
 */
export function createDetectDiskCrossing(uniforms: DiskUniforms) {
  const isInDiskBounds = createIsInDiskBounds(uniforms)

  return Fn(([prevPos, currPos]: [Node, Node]) => {
    const prevY = prevPos.y
    const currY = currPos.y

    // Check for sign change (crossing y=0 plane)
    const hasCrossing = prevY.mul(currY).lessThan(0)

    // Default: no crossing
    const result = vec3(-1, -1, -1).toVar('crossingResult')

    If(hasCrossing, () => {
      // Guard against division by zero
      // GPU branch: Even inside If(), div is evaluated - use max() guard
      const deltaY = prevY.sub(currY)
      const safeDeltaY = max(abs(deltaY), float(0.0001)).mul(deltaY.sign())
      If(abs(deltaY).greaterThan(0.0001), () => {
        // Linear interpolation to find crossing point (using safe deltaY)
        const t = clamp(prevY.div(safeDeltaY), float(0.0), float(1.0))
        const crossingPos = mix(prevPos, currPos, t)

        // Check if crossing is within disk radial bounds
        If(isInDiskBounds(crossingPos), () => {
          result.assign(crossingPos)
        })
      })
    })

    return result
  })
}

/**
 * Compute disk surface normal.
 * For thin disk, normal is +/- Y based on approach direction.
 *
 * 100% port of WebGL computeDiskNormal() - uses getManifoldThicknessScale()
 */
export function createComputeDiskNormal(uniforms: DiskUniforms) {
  const sdfDisk = createSdfDisk(uniforms)
  const getThicknessScale = createGetDiskThicknessScale(uniforms)

  return Fn(([pos3d, approachDir]: [Node, Node]) => {
    const horizonR = uniforms.uHorizonRadius ?? float(1.0)
    const manifoldThickness = uniforms.uManifoldThickness ?? float(0.1)
    // WebGL: float thickness = uManifoldThickness * uHorizonRadius * getManifoldThicknessScale();
    const thickness = manifoldThickness.mul(horizonR).mul(getThicknessScale())

    // For very thin disks, use flat normal
    // WebGL: return vec3(0.0, -sign(approachDir.y), 0.0);
    const normal = vec3(0, approachDir.y.sign().negate(), 0).toVar('diskNormal')

    If(thickness.greaterThan(0.05), () => {
      // For thick disks, compute SDF gradient
      const eps = float(0.001)
      const d0 = sdfDisk(pos3d)
      const dx = sdfDisk(pos3d.add(vec3(eps, 0, 0))).sub(d0)
      const dy = sdfDisk(pos3d.add(vec3(0, eps, 0))).sub(d0)
      const dz = sdfDisk(pos3d.add(vec3(0, 0, eps))).sub(d0)

      const grad = vec3(dx, dy, dz)
      const gradLen = length(grad)
      // GPU branch evaluation: both branches always execute, so guard the division
      const safeGradLen = max(gradLen, float(0.0001))

      If(gradLen.greaterThan(0.0001), () => {
        const normalizedGrad = grad.div(safeGradLen)
        // Ensure normal faces the viewer
        normal.assign(
          dot(normalizedGrad, approachDir).greaterThan(0).select(
            normalizedGrad.negate(),
            normalizedGrad
          )
        )
      })
    })

    return normal
  })
}

/**
 * Compute volumetric disk normal from density gradient.
 *
 * PERF OPTIMIZATION: Uses analytical approximation instead of numerical gradient.
 * For a thin accretion disk in the XZ plane:
 * - The Y (vertical) gradient dominates and is predictable (Gaussian falloff)
 * - The radial gradient follows the density profile
 *
 * This reduces from 4 expensive getDiskDensity calls to 0 noise samples,
 * a ~10x speedup for normal computation.
 *
 * Note: WebGL uses numerical gradient for HIGH QUALITY (uSampleQuality >= 2)
 * when not in fast mode, but this is complex to implement in TSL due to
 * circular dependencies. The analytical approximation is sufficient for
 * most use cases and matches the WebGL fast path behavior.
 *
 * @param uniforms - Disk uniforms (uses uDiskOuterRadius, uFastMode, uSampleQuality)
 */
export function createComputeVolumetricDiskNormal(uniforms: DiskUniforms) {
  return Fn(([pos, rayDir]: [Node, Node]) => {
    // PERF: Fast mode and low quality use analytical approximation (no noise samples)
    // The disk is thin and mostly flat in XZ plane, so the normal is dominated by Y
    // WebGL: if (uFastMode || uSampleQuality < 2) { ... analytical path ... }

    const r = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
    const outerR = uniforms.uDiskOuterRadius
    // GPU branch evaluation: select() evaluates both branches, so guard the division
    const safeR = max(r, float(0.001))

    // Radial direction in XZ plane (outward from center)
    const radialDir = r.greaterThan(0.001).select(
      vec3(pos.x.div(safeR), 0, pos.z.div(safeR)),
      vec3(1, 0, 0)
    )

    // Vertical component: dominant, points away from disk plane
    const ySign = pos.y.greaterThan(0).select(float(1), float(-1))

    // Slight radial tilt at outer edge (disk flare)
    const flareTilt = smoothstep(outerR.mul(0.5), outerR, r).mul(0.3)

    // CRITICAL: Use safe normalize - radialDir could be near-zero at disk center
    const normal = safeNormalize3(vec3(radialDir.x.mul(flareTilt), ySign, radialDir.z.mul(flareTilt)), vec3(0, 1, 0))

    // Ensure normal faces the viewer
    return dot(normal, rayDir).greaterThan(0).select(normal.negate(), normal)
  })
}

/**
 * Extended uniforms for shadeDiskHit that includes all dependencies.
 * Uses Omit to exclude conflicting properties from DiskUniforms, then adds
 * ColorUniforms and DopplerUniforms properties directly to avoid extends conflicts.
 */
export interface ShadeDiskHitUniforms
  extends Omit<
    DiskUniforms,
    'uColorAlgorithm' | 'uDopplerEnabled' | 'uDopplerStrength' | 'uDiskInnerR' | 'uHorizonRadius'
  > {
  // From ColorUniforms
  uColorAlgorithm: UniformNode<number>
  uDiskTemperature: UniformNode<number>
  // From DopplerUniforms
  uDopplerEnabled: UniformNode<number>
  uDopplerStrength: UniformNode<number>
  // Inherited from DiskUniforms
  uDiskInnerR?: UniformNode<number>
  uHorizonRadius?: UniformNode<number>
}

/**
 * Shade a disk surface hit.
 * Applies temperature gradient, noise, swirl, Doppler shift, and lighting.
 *
 * 100% port of WebGL shadeDiskHit()
 *
 * @param hitPos - Surface hit position
 * @param rayDir - Incoming ray direction
 * @param hitIndex - Which crossing this is (0 = first, higher = Einstein ring layers)
 * @param time - Animation time
 * @returns Shaded color contribution
 */
export function createShadeDiskHit(uniforms: ShadeDiskHitUniforms) {
  const computeDiskNormal = createComputeDiskNormal(uniforms)
  const gravitationalRedshift = createGravitationalRedshift({ uHorizonRadius: uniforms.uHorizonRadius! })
  // Cast to ColorUniforms since ShadeDiskHitUniforms has all required properties
  const getAlgorithmColor = createGetAlgorithmColor({ uColorAlgorithm: uniforms.uColorAlgorithm } as ColorUniforms)
  // Cast uniforms to DopplerUniforms - all required fields are present in ShadeDiskHitUniforms
  const dopplerUniforms = {
    uDopplerEnabled: uniforms.uDopplerEnabled,
    uDopplerStrength: uniforms.uDopplerStrength,
    uHorizonRadius: uniforms.uHorizonRadius!,
    uDiskInnerR: uniforms.uDiskInnerR!,
  }
  const dopplerFactor = createDopplerFactor(dopplerUniforms)
  const applyDopplerShift = createApplyDopplerShift(dopplerUniforms)

  return Fn(([hitPos, rayDir, hitIndex, time]: [Node, Node, Node, Node]) => {
    const r = sqrt(hitPos.x.mul(hitPos.x).add(hitPos.z.mul(hitPos.z)))

    // PERF (OPT-BH-6): Use pre-computed disk radii uniforms
    const innerR = uniforms.uDiskInnerR ?? uniforms.uDiskInnerRadius
    const outerR = uniforms.uDiskOuterR ?? uniforms.uDiskOuterRadius

    // Normalized radial position [0, 1] (0 = inner edge, 1 = outer edge)
    // Guard against division by zero when innerR >= outerR
    const radialRange = max(outerR.sub(innerR), float(0.001))
    const radialT = clamp(r.sub(innerR).div(radialRange), float(0.0), float(1.0))

    // Compute normal early if needed for lighting or coloring (ALGO_NORMAL)
    const normal = vec3(0, 1, 0).toVar('diskHitNormal')
    const lightingMode = uniforms.uLightingMode ?? float(0)
    const colorAlgo = uniforms.uColorAlgorithm ?? float(0)

    If(lightingMode.equal(1).or(colorAlgo.equal(ALGO_NORMAL)), () => {
      normal.assign(computeDiskNormal(hitPos, rayDir))
    })

    // Get base color from selected algorithm
    const color = getAlgorithmColor(radialT, hitPos, normal).toVar('diskHitColor')

    // Apply gravitational redshift
    // Light from closer to the horizon is redshifted (dimmer and redder)
    const gRedshift = gravitationalRedshift(r)
    color.assign(color.mul(gRedshift)) // Intensity reduction

    // Also shift hue slightly toward red for visual effect
    // WebGL: hsl.x = fract(hsl.x + (1.0 - gRedshift) * 0.05);
    const hsl = rgb2hsl(color).toVar('diskHitHSL')
    // TSL: Cannot assign to swizzle accessor, reconstruct vec3 with new x
    const newHue = fract(hsl.x.add(float(1.0).sub(gRedshift).mul(0.05)))
    hsl.assign(vec3(newHue, hsl.y, hsl.z))
    color.assign(hsl2rgb(hsl))

    // Add swirl pattern
    const swirlAmount = uniforms.uSwirlAmount ?? float(0)
    If(swirlAmount.greaterThan(0.001), () => {
      const angle = atan(hitPos.z, hitPos.x)
      const swirlPhase = angle.mul(3.0).add(r.mul(0.5)).sub(time.mul(0.5))
      const swirlBright = float(0.5).add(sin(swirlPhase).mul(0.5))
      color.assign(color.mul(mix(float(0.7), float(1.3), swirlBright.mul(swirlAmount))))
    })

    // Add noise turbulence
    const noiseAmount = uniforms.uNoiseAmount ?? float(0)
    If(noiseAmount.greaterThan(0.001), () => {
      const angle = atan(hitPos.z, hitPos.x)
      const noiseScale = uniforms.uNoiseScale ?? float(1.0)
      const noisePos = vec3(r.mul(0.3), angle.mul(2.0), float(0)).mul(noiseScale)
      const n = noise3D(noisePos.add(time.mul(0.1)))

      // Ridged multifractal noise
      const ridged = float(1.0).sub(abs(float(2.0).mul(n).sub(1.0)))
      // PERF: x² instead of pow
      const ridgedSq = ridged.mul(ridged)
      color.assign(color.mul(mix(float(1.0), ridgedSq, noiseAmount)))
    })

    // Apply lighting (FakeLit mode)
    If(lightingMode.equal(1), () => {
      // Normal is already computed above
      const lightPos = uniforms.uLightPositions?.[0] ?? vec3(10, 10, 10)
      const lightColor = uniforms.uLightColors?.[0] ?? vec3(1, 1, 1)
      // CRITICAL: Use safe normalize - GPU evaluates ALL branches
      const lightDir = safeNormalize3(lightPos.sub(hitPos), vec3(0, 1, 0))

      const NdotL = max(dot(normal, lightDir), float(0))
      const diffuse = NdotL

      const cameraPos = uniforms.uCameraPosition ?? vec3(0, 0, 5)
      // CRITICAL: Use safe normalize - can be zero at camera position
      const viewDir = safeNormalize3(cameraPos.sub(hitPos), vec3(0, 0, 1))
      // CRITICAL: Use safe normalize - L + viewDir can be zero when opposite
      const halfDir = safeNormalize3(lightDir.add(viewDir), normal)
      const NdotH = max(dot(normal, halfDir), float(0))

      const roughness = uniforms.uRoughness ?? float(0.5)
      const specularIntensity = uniforms.uSpecular ?? float(0.5)
      // WebGL: pow(NdotH, 32.0 * (1.0 - uRoughness + 0.1)) * uSpecular
      const specular = pow(NdotH, float(32.0).mul(float(1.0).sub(roughness).add(0.1))).mul(specularIntensity)

      const ambientTint = uniforms.uAmbientTint ?? float(0.2)
      // WebGL: lightContrib = uAmbientTint + diffuse * (1.0 - uAmbientTint)
      const lightContrib = ambientTint.add(diffuse.mul(float(1.0).sub(ambientTint)))
      color.assign(color.mul(lightContrib))
      color.assign(color.add(vec3(specular, specular, specular).mul(lightColor)))
    })

    // Apply Doppler shift (reuse existing function from doppler.ts)
    const dopplerFac = dopplerFactor(hitPos, rayDir)
    color.assign(applyDopplerShift(color, dopplerFac))

    // Multi-intersection gain (Einstein ring enhancement)
    // Later crossings (back of disk seen through lensing) get brightness boost
    const multiGain = uniforms.uMultiIntersectionGain ?? float(0.5)
    // WebGL: crossingGain = 1.0 + float(hitIndex) * uMultiIntersectionGain * 0.3
    const crossingGain = float(1.0).add(hitIndex.mul(multiGain).mul(0.3))
    color.assign(color.mul(crossingGain))

    // Apply intensity
    const manifoldIntensity = uniforms.uManifoldIntensity ?? float(1.0)
    color.assign(color.mul(manifoldIntensity))

    return color
  })
}

