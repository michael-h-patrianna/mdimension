/**
 * TSL Probability Density Field Calculations
 *
 * The probability density is:
 *   ρ(x,t) = |ψ(x,t)|² = ψ*ψ = re² + im²
 *
 * For rendering stability and better dynamic range, we often use
 * log-density:
 *   s(x,t) = log(ρ + ε)
 *
 * This compresses the large range of ρ values and provides
 * better numerical stability for gradient computation.
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/density.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/density
 */

import {
  Fn,
  float,
  vec2,
  vec3,
  log,
  dot,
  select,
  pow,
  floor,
  fract,
  mix,
  min,
  max,
  If,
  sqrt,
  clamp,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import type * as THREE from 'three'
import { QUANTUM_MODE_HYDROGEN, QUANTUM_MODE_HYDROGEN_ND } from './psi'

// Small epsilon to prevent log(0)
const DENSITY_EPS = 1e-8

// ============================================
// Noise & Erosion Functions
// Ported from WebGL: shaders/schroedinger/quantum/density.glsl.ts
// ============================================

/**
 * Sin-based pseudo-random hash for TSL.
 * Note: TSL doesn't support uvec3/ivec3, so we use the classic sin-based approach.
 *
 * @param p - Input position
 * @returns Pseudo-random vec3 in [-1, 1]
 */
export const hash33 = Fn(([p]: [Node]) => {
  // Classic sin-based hash (TSL-compatible)
  const p3 = fract(vec3(p).mul(vec3(0.1031, 0.1030, 0.0973)))
  // TSL: use vec3(y,z,x) instead of .yzx swizzle
  const p3_yzx = vec3(p3.y, p3.z, p3.x)
  const pp = p3.add(dot(p3, p3_yzx.add(33.33)))
  const hash = fract(
    vec3(pp.x.add(pp.y).mul(pp.z), pp.x.add(pp.z).mul(pp.y), pp.y.add(pp.z).mul(pp.x))
  )
  // Map from [0, 1] to [-1, 1]
  return hash.mul(2).sub(1)
})

/**
 * 3D Perlin/Gradient Noise.
 *
 * @param p - Input position
 * @returns Noise value in approximately [-1, 1]
 */
export const gradientNoise = Fn(([p]: [Node]) => {
  const pos = vec3(p)
  const i = floor(pos)
  const f = fract(pos)
  // Smoothstep interpolation
  const u = f.mul(f).mul(float(3).sub(f.mul(2)))

  // Sample 8 corners of the cell
  const c000 = dot(hash33(i.add(vec3(0, 0, 0))), f.sub(vec3(0, 0, 0)))
  const c100 = dot(hash33(i.add(vec3(1, 0, 0))), f.sub(vec3(1, 0, 0)))
  const c010 = dot(hash33(i.add(vec3(0, 1, 0))), f.sub(vec3(0, 1, 0)))
  const c110 = dot(hash33(i.add(vec3(1, 1, 0))), f.sub(vec3(1, 1, 0)))
  const c001 = dot(hash33(i.add(vec3(0, 0, 1))), f.sub(vec3(0, 0, 1)))
  const c101 = dot(hash33(i.add(vec3(1, 0, 1))), f.sub(vec3(1, 0, 1)))
  const c011 = dot(hash33(i.add(vec3(0, 1, 1))), f.sub(vec3(0, 1, 1)))
  const c111 = dot(hash33(i.add(vec3(1, 1, 1))), f.sub(vec3(1, 1, 1)))

  // Trilinear interpolation
  return mix(
    mix(mix(c000, c100, u.x), mix(c010, c110, u.x), u.y),
    mix(mix(c001, c101, u.x), mix(c011, c111, u.x), u.y),
    u.z
  )
})

/**
 * Worley Noise (2×2×2 octant search - Fast variant).
 * Returns squared distance to nearest cell point.
 *
 * @param p - Input position
 * @returns Squared distance to nearest point
 */
export const worleyNoiseSquared = Fn(([p]: [Node]) => {
  const pos = vec3(p)
  const id = floor(pos)
  const f = fract(pos)

  // Determine which octant of the cell we're in
  const o = vec3(
    select(f.x.greaterThanEqual(0.5), float(0), float(-1)),
    select(f.y.greaterThanEqual(0.5), float(0), float(-1)),
    select(f.z.greaterThanEqual(0.5), float(0), float(-1))
  )

  // 8 neighbor checks (2×2×2 unrolled)
  const d0 = o.add(hash33(id.add(o)).mul(0.5).add(0.5)).sub(f)
  const d1 = o.add(vec3(1, 0, 0)).add(hash33(id.add(o).add(vec3(1, 0, 0))).mul(0.5).add(0.5)).sub(f)
  const d2 = o.add(vec3(0, 1, 0)).add(hash33(id.add(o).add(vec3(0, 1, 0))).mul(0.5).add(0.5)).sub(f)
  const d3 = o.add(vec3(1, 1, 0)).add(hash33(id.add(o).add(vec3(1, 1, 0))).mul(0.5).add(0.5)).sub(f)
  const d4 = o.add(vec3(0, 0, 1)).add(hash33(id.add(o).add(vec3(0, 0, 1))).mul(0.5).add(0.5)).sub(f)
  const d5 = o.add(vec3(1, 0, 1)).add(hash33(id.add(o).add(vec3(1, 0, 1))).mul(0.5).add(0.5)).sub(f)
  const d6 = o.add(vec3(0, 1, 1)).add(hash33(id.add(o).add(vec3(0, 1, 1))).mul(0.5).add(0.5)).sub(f)
  const d7 = o.add(vec3(1, 1, 1)).add(hash33(id.add(o).add(vec3(1, 1, 1))).mul(0.5).add(0.5)).sub(f)

  // Find minimum squared distance
  const m = min(
    min(min(dot(d0, d0), dot(d1, d1)), min(dot(d2, d2), dot(d3, d3))),
    min(min(dot(d4, d4), dot(d5, d5)), min(dot(d6, d6), dot(d7, d7)))
  )

  return m
})

/**
 * Worley Noise (3×3×3 full cell search - HQ variant).
 * Searches all 27 neighbors for higher quality but ~3.4× slower.
 * Returns squared distance to nearest cell point.
 *
 * @param p - Input position
 * @returns Squared distance to nearest point
 */
export const worleyNoiseSquaredHQ = Fn(([p]: [Node]) => {
  const pos = vec3(p)
  const id = floor(pos)
  const f = fract(pos)

  const m = float(1e20).toVar()

  // Layer z = -1 (9 cells)
  const d_m1_m1_m1 = vec3(-1, -1, -1).add(hash33(id.add(vec3(-1, -1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_m1_m1, d_m1_m1_m1)))
  const d_0_m1_m1 = vec3(0, -1, -1).add(hash33(id.add(vec3(0, -1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_m1_m1, d_0_m1_m1)))
  const d_1_m1_m1 = vec3(1, -1, -1).add(hash33(id.add(vec3(1, -1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_m1_m1, d_1_m1_m1)))
  const d_m1_0_m1 = vec3(-1, 0, -1).add(hash33(id.add(vec3(-1, 0, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_0_m1, d_m1_0_m1)))
  const d_0_0_m1 = vec3(0, 0, -1).add(hash33(id.add(vec3(0, 0, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_0_m1, d_0_0_m1)))
  const d_1_0_m1 = vec3(1, 0, -1).add(hash33(id.add(vec3(1, 0, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_0_m1, d_1_0_m1)))
  const d_m1_1_m1 = vec3(-1, 1, -1).add(hash33(id.add(vec3(-1, 1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_1_m1, d_m1_1_m1)))
  const d_0_1_m1 = vec3(0, 1, -1).add(hash33(id.add(vec3(0, 1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_1_m1, d_0_1_m1)))
  const d_1_1_m1 = vec3(1, 1, -1).add(hash33(id.add(vec3(1, 1, -1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_1_m1, d_1_1_m1)))

  // Layer z = 0 (9 cells)
  const d_m1_m1_0 = vec3(-1, -1, 0).add(hash33(id.add(vec3(-1, -1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_m1_0, d_m1_m1_0)))
  const d_0_m1_0 = vec3(0, -1, 0).add(hash33(id.add(vec3(0, -1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_m1_0, d_0_m1_0)))
  const d_1_m1_0 = vec3(1, -1, 0).add(hash33(id.add(vec3(1, -1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_m1_0, d_1_m1_0)))
  const d_m1_0_0 = vec3(-1, 0, 0).add(hash33(id.add(vec3(-1, 0, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_0_0, d_m1_0_0)))
  const d_0_0_0 = vec3(0, 0, 0).add(hash33(id.add(vec3(0, 0, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_0_0, d_0_0_0)))
  const d_1_0_0 = vec3(1, 0, 0).add(hash33(id.add(vec3(1, 0, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_0_0, d_1_0_0)))
  const d_m1_1_0 = vec3(-1, 1, 0).add(hash33(id.add(vec3(-1, 1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_1_0, d_m1_1_0)))
  const d_0_1_0 = vec3(0, 1, 0).add(hash33(id.add(vec3(0, 1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_1_0, d_0_1_0)))
  const d_1_1_0 = vec3(1, 1, 0).add(hash33(id.add(vec3(1, 1, 0))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_1_0, d_1_1_0)))

  // Layer z = 1 (9 cells)
  const d_m1_m1_1 = vec3(-1, -1, 1).add(hash33(id.add(vec3(-1, -1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_m1_1, d_m1_m1_1)))
  const d_0_m1_1 = vec3(0, -1, 1).add(hash33(id.add(vec3(0, -1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_m1_1, d_0_m1_1)))
  const d_1_m1_1 = vec3(1, -1, 1).add(hash33(id.add(vec3(1, -1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_m1_1, d_1_m1_1)))
  const d_m1_0_1 = vec3(-1, 0, 1).add(hash33(id.add(vec3(-1, 0, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_0_1, d_m1_0_1)))
  const d_0_0_1 = vec3(0, 0, 1).add(hash33(id.add(vec3(0, 0, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_0_1, d_0_0_1)))
  const d_1_0_1 = vec3(1, 0, 1).add(hash33(id.add(vec3(1, 0, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_0_1, d_1_0_1)))
  const d_m1_1_1 = vec3(-1, 1, 1).add(hash33(id.add(vec3(-1, 1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_m1_1_1, d_m1_1_1)))
  const d_0_1_1 = vec3(0, 1, 1).add(hash33(id.add(vec3(0, 1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_0_1_1, d_0_1_1)))
  const d_1_1_1 = vec3(1, 1, 1).add(hash33(id.add(vec3(1, 1, 1))).mul(0.5).add(0.5)).sub(f)
  m.assign(min(m, dot(d_1_1_1, d_1_1_1)))

  return m
})

/**
 * Erosion noise based on type (Fast variant).
 * 0 = Worley (Billowy), 1 = Perlin (Smooth), 2 = Hybrid
 *
 * @param p - Input position
 * @param noiseType - Type of noise (0, 1, or 2)
 * @returns Noise value in [0, 1]
 */
export const getErosionNoise = Fn(([p, noiseType]: [Node, Node]) => {
  const pos = vec3(p)

  // Worley: sqrt of squared distance, inverted for billowy clouds
  const worley = float(1).sub(sqrt(worleyNoiseSquared(pos)))

  // Perlin: map from [-1, 1] to [0, 1]
  const perlin = gradientNoise(pos).mul(0.5).add(0.5)

  // Hybrid: Perlin-Worley blend
  const perlinHybrid = gradientNoise(pos).mul(0.5).add(0.5)
  const worleyHybrid = float(1).sub(sqrt(worleyNoiseSquared(pos.mul(2))))
  const hybrid = mix(perlinHybrid, worleyHybrid, float(0.5))

  return select(
    noiseType.equal(0),
    worley,
    select(noiseType.equal(1), perlin, hybrid)
  )
})

/**
 * Erosion noise based on type (HQ variant with 3×3×3 Worley).
 * Higher quality noise for better erosion detail.
 *
 * @param p - Input position
 * @param noiseType - Type of noise (0, 1, or 2)
 * @returns Noise value in [0, 1]
 */
export const getErosionNoiseHQ = Fn(([p, noiseType]: [Node, Node]) => {
  const pos = vec3(p)

  // Worley HQ: sqrt of squared distance, inverted for billowy clouds
  const worley = float(1).sub(sqrt(worleyNoiseSquaredHQ(pos)))

  // Perlin: map from [-1, 1] to [0, 1]
  const perlin = gradientNoise(pos).mul(0.5).add(0.5)

  // Hybrid: Perlin-Worley blend (using HQ Worley)
  const perlinHybrid = gradientNoise(pos).mul(0.5).add(0.5)
  const worleyHybrid = float(1).sub(sqrt(worleyNoiseSquaredHQ(pos.mul(2))))
  const hybrid = mix(perlinHybrid, worleyHybrid, float(0.5))

  return select(
    noiseType.equal(0),
    worley,
    select(noiseType.equal(1), perlin, hybrid)
  )
})

/**
 * Pseudo-curl distortion with 2 samples (Fast variant).
 * Creates divergence-free-ish rotational displacement.
 *
 * @param p - Input position
 * @param strength - Distortion strength
 * @returns Distorted position
 */
export const distortPosition = Fn(([p, strength]: [Node, Node]) => {
  const pos = vec3(p)

  // Skip when visually imperceptible
  const skipDistortion = strength.lessThan(0.1)

  // Pseudo-curl with 2 noise samples
  const n1 = gradientNoise(pos.add(vec3(0.1, 0, 0)))
  const n2 = gradientNoise(pos.add(vec3(0, 0.1, 0)))

  // Create pseudo-curl displacement
  const displacement = vec3(n2, n1.negate(), n1.sub(n2))

  const distortedPos = pos.add(displacement.mul(strength))

  return select(skipDistortion, pos, distortedPos)
})

/**
 * Full curl distortion with 4 samples (HQ variant).
 * Computes true curl of gradient noise field using finite differences.
 * Higher quality but ~2× slower than fast variant.
 *
 * @param p - Input position
 * @param strength - Distortion strength
 * @returns Distorted position
 */
export const distortPositionHQ = Fn(([p, strength]: [Node, Node]) => {
  const pos = vec3(p)

  // Skip when visually imperceptible
  const skipDistortion = strength.lessThan(0.1)

  const eps = 0.01

  // Sample gradient noise at 4 offset positions for true curl computation
  // curl = nabla × F = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
  const nx = gradientNoise(pos.add(vec3(eps, 0, 0)))
  const ny = gradientNoise(pos.add(vec3(0, eps, 0)))
  const nz = gradientNoise(pos.add(vec3(0, 0, eps)))
  const n0 = gradientNoise(pos)

  // Finite difference approximation of curl
  const curl = vec3(
    ny.sub(n0).sub(nz.sub(n0)), // dz/dy - dy/dz
    nz.sub(n0).sub(nx.sub(n0)), // dx/dz - dz/dx
    nx.sub(n0).sub(ny.sub(n0))  // dy/dx - dx/dy
  ).div(eps)

  const distortedPos = pos.add(curl.mul(strength).mul(0.1))

  return select(skipDistortion, pos, distortedPos)
})

/**
 * Curl noise vector (for flow effects).
 *
 * @param p - Input position
 * @returns Curl noise vector
 */
export const curlNoise = Fn(([p]: [Node]) => {
  return distortPosition(p, float(1)).sub(p)
})

/**
 * Erode density based on noise.
 * Applies edge erosion for more realistic volumetric appearance.
 *
 * @param rho - Input density
 * @param pos - Position
 * @param strength - Erosion strength
 * @param scale - Erosion scale
 * @param turbulence - Turbulence amount
 * @param noiseType - Noise type (0=Worley, 1=Perlin, 2=Hybrid)
 * @param time - Animation time
 * @returns Eroded density
 */
export const erodeDensity = Fn(
  ([rho, pos, strength, scale, turbulence, noiseType, time]: [
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
  ]) => {
    const posVec = vec3(pos)

    // Early exit: erosion disabled or very low/high density
    const skipErosion = strength
      .lessThanEqual(0.001)
      .or(rho.lessThan(0.001))
      .or(rho.greaterThan(2))

    // Scale position for noise
    const noisePos = posVec.mul(scale).toVar()

    // Add turbulence/distortion
    If(turbulence.greaterThan(0), () => {
      // Animate swirl
      const scrollY = time.mul(0.2).negate()
      noisePos.assign(noisePos.add(vec3(0, scrollY, 0)))
      noisePos.assign(distortPosition(noisePos, turbulence))
    })

    // Sample noise
    const noise = getErosionNoise(noisePos, noiseType)

    // Direct subtraction in linear space
    const erodedRho = max(float(0), rho.sub(noise.mul(strength).mul(2)))

    // Smooth blending
    const result = mix(rho, erodedRho, strength)

    return select(skipErosion, rho, result)
  }
)

/**
 * Apply curl noise flow to position.
 *
 * @param pos - Input position
 * @param curlEnabled - Whether curl is enabled
 * @param curlStrength - Curl strength
 * @param curlScale - Curl scale
 * @param curlSpeed - Curl speed
 * @param curlBias - Curl bias (0=None, 1=Up, 2=Out, 3=In)
 * @param time - Animation time
 * @returns Flowed position
 */
export const applyFlow = Fn(
  ([pos, curlEnabled, curlStrength, curlScale, curlSpeed, curlBias, time]: [
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
  ]) => {
    const posVec = vec3(pos)

    // Skip if disabled or strength too low
    const skipFlow = curlEnabled.not().or(curlStrength.lessThanEqual(0.001))

    // Flow position with time animation
    const flowPos = posVec.mul(curlScale).add(vec3(0, 0, time.mul(curlSpeed).mul(0.2)))

    // Base curl vector
    const curl = curlNoise(flowPos).toVar()

    // Apply bias
    // CRITICAL: Guard normalize() against zero-length vectors
    // GPU evaluates ALL branches even when skipFlow is true (see docs/tsl.md GPU Branch Evaluation)
    const posLenSq = dot(posVec, posVec)
    const safePosLen = sqrt(max(posLenSq, float(0.0001)))
    const normalizedPos = posVec.div(safePosLen)

    const upBias = vec3(0, 1, 0).mul(0.5)
    const outBias = normalizedPos.mul(0.5)
    const inBias = normalizedPos.mul(-0.5)

    const biasedCurl = select(
      curlBias.equal(1),
      curl.add(upBias),
      select(curlBias.equal(2), curl.add(outBias), select(curlBias.equal(3), curl.add(inBias), curl))
    )

    // Distort sampling position by the curl vector
    // Advection: new_density(x) = old_density(x - v*dt)
    const flowedPos = posVec.sub(biasedCurl.mul(curlStrength))

    return select(skipFlow, posVec, flowedPos)
  }
)

/**
 * Uniforms for erosion effects.
 */
export interface ErosionUniforms {
  uErosionStrength: UniformNode<number>
  uErosionScale: UniformNode<number>
  uErosionTurbulence: UniformNode<number>
  uErosionNoiseType: UniformNode<number>
}

/**
 * Uniforms for curl flow effects.
 */
export interface CurlUniforms {
  uCurlEnabled: UniformNode<boolean>
  uCurlStrength: UniformNode<number>
  uCurlScale: UniformNode<number>
  uCurlSpeed: UniformNode<number>
  uCurlBias: UniformNode<number>
}

/**
 * Uniforms for shimmer effect.
 */
export interface ShimmerUniforms {
  uShimmerEnabled: UniformNode<boolean>
  uShimmerStrength: UniformNode<number>
}

/**
 * Uniforms for density calculations
 */
export interface DensityUniforms {
  /** Quantum mode selector */
  uQuantumMode: UniformNode<number>
  /** Current dimension */
  uDimension: UniformNode<number>
  /** Coordinate field scale */
  uFieldScale: UniformNode<number>
  /** Time */
  uTime: UniformNode<number>
  /** Time scale */
  uTimeScale: UniformNode<number>
  /** Density gain */
  uDensityGain: UniformNode<number>

  // Hydrogen uniforms
  uPrincipalN: UniformNode<number>
  uAzimuthalL: UniformNode<number>

  // Basis vectors for ND coordinate mapping
  // WebGL uses float arrays uOrigin[MAX_DIM], uBasisX[MAX_DIM], etc.
  // TSL packs these into vec4 groups for GPU efficiency:
  //   uOrigin0: dims 0-3, uOrigin1: dims 4-7, uOrigin2: dims 8-10
  /** Origin (coords 0-3) */
  uOrigin0: UniformNode<THREE.Vector4>
  /** Origin (coords 4-7) */
  uOrigin1?: UniformNode<THREE.Vector4>
  /** Origin (coords 8-10, xyz only) */
  uOrigin2?: UniformNode<THREE.Vector4>
  /** Basis X (coords 0-3) */
  uBasisX0: UniformNode<THREE.Vector4>
  /** Basis X (coords 4-7) */
  uBasisX1?: UniformNode<THREE.Vector4>
  /** Basis X (coords 8-10, xyz only) */
  uBasisX2?: UniformNode<THREE.Vector4>
  /** Basis Y (coords 0-3) */
  uBasisY0: UniformNode<THREE.Vector4>
  /** Basis Y (coords 4-7) */
  uBasisY1?: UniformNode<THREE.Vector4>
  /** Basis Y (coords 8-10, xyz only) */
  uBasisY2?: UniformNode<THREE.Vector4>
  /** Basis Z (coords 0-3) */
  uBasisZ0: UniformNode<THREE.Vector4>
  /** Basis Z (coords 4-7) */
  uBasisZ1?: UniformNode<THREE.Vector4>
  /** Basis Z (coords 8-10, xyz only) */
  uBasisZ2?: UniformNode<THREE.Vector4>
}

/**
 * Compute probability density ρ = |ψ|²
 *
 * @param psi - Complex wavefunction as vec2(re, im)
 * @returns ρ = re² + im²
 */
export const rhoFromPsi = Fn(([psi]: [Node]) => {
  return dot(psi, psi) // re² + im²
})

/**
 * Compute log-density for stability and dynamic range
 * s = log(ρ + ε)
 *
 * @param rho - Probability density
 * @returns Log-density
 */
export const sFromRho = Fn(([rho]: [Node]) => {
  return log(rho.add(DENSITY_EPS))
})

/**
 * Compute both ρ and s efficiently, returning vec2(rho, s)
 *
 * @param psi - Complex wavefunction
 * @returns vec2(rho, s)
 */
export const densityPair = Fn(([psi]: [Node]) => {
  const rho = rhoFromPsi(psi)
  const s = sFromRho(rho)
  return vec2(rho, s)
})

/**
 * ND coordinate structure returned from mapPosToND
 */
export interface NDCoordinates {
  x0: Node
  x1: Node
  x2: Node
  x3: Node
  x4: Node
  x5: Node
  x6: Node
  x7: Node
  x8: Node
  x9: Node
  x10: Node
}

/**
 * Map 3D position to ND coordinates using basis vectors.
 *
 * This is a FACTORY function, not a TSL Fn. It builds TSL expressions
 * for the ND coordinate mapping but returns them as a JS object.
 *
 * @param pos - 3D position TSL node
 * @param uniforms - Density uniforms with basis vectors
 * @param dim - Number of dimensions (3-11)
 * @returns Object containing ND coordinate nodes
 */
export function mapPosToND(pos: Node, uniforms: DensityUniforms, dim: number): NDCoordinates {
  const p = vec3(pos)
  const scale = uniforms.uFieldScale

  // First 4 dimensions (always available)
  const x0 = uniforms.uOrigin0.x
    .add(p.x.mul(uniforms.uBasisX0.x))
    .add(p.y.mul(uniforms.uBasisY0.x))
    .add(p.z.mul(uniforms.uBasisZ0.x))
    .mul(scale)

  const x1 = uniforms.uOrigin0.y
    .add(p.x.mul(uniforms.uBasisX0.y))
    .add(p.y.mul(uniforms.uBasisY0.y))
    .add(p.z.mul(uniforms.uBasisZ0.y))
    .mul(scale)

  const x2 = uniforms.uOrigin0.z
    .add(p.x.mul(uniforms.uBasisX0.z))
    .add(p.y.mul(uniforms.uBasisY0.z))
    .add(p.z.mul(uniforms.uBasisZ0.z))
    .mul(scale)

  const x3 = uniforms.uOrigin0.w
    .add(p.x.mul(uniforms.uBasisX0.w))
    .add(p.y.mul(uniforms.uBasisY0.w))
    .add(p.z.mul(uniforms.uBasisZ0.w))
    .mul(scale)

  // Dimensions 5-8 (if available)
  const x4 =
    dim > 4 && uniforms.uOrigin1 && uniforms.uBasisX1 && uniforms.uBasisY1 && uniforms.uBasisZ1
      ? uniforms.uOrigin1.x
          .add(p.x.mul(uniforms.uBasisX1.x))
          .add(p.y.mul(uniforms.uBasisY1.x))
          .add(p.z.mul(uniforms.uBasisZ1.x))
          .mul(scale)
      : float(0)

  const x5 =
    dim > 5 && uniforms.uOrigin1 && uniforms.uBasisX1 && uniforms.uBasisY1 && uniforms.uBasisZ1
      ? uniforms.uOrigin1.y
          .add(p.x.mul(uniforms.uBasisX1.y))
          .add(p.y.mul(uniforms.uBasisY1.y))
          .add(p.z.mul(uniforms.uBasisZ1.y))
          .mul(scale)
      : float(0)

  const x6 =
    dim > 6 && uniforms.uOrigin1 && uniforms.uBasisX1 && uniforms.uBasisY1 && uniforms.uBasisZ1
      ? uniforms.uOrigin1.z
          .add(p.x.mul(uniforms.uBasisX1.z))
          .add(p.y.mul(uniforms.uBasisY1.z))
          .add(p.z.mul(uniforms.uBasisZ1.z))
          .mul(scale)
      : float(0)

  const x7 =
    dim > 7 && uniforms.uOrigin1 && uniforms.uBasisX1 && uniforms.uBasisY1 && uniforms.uBasisZ1
      ? uniforms.uOrigin1.w
          .add(p.x.mul(uniforms.uBasisX1.w))
          .add(p.y.mul(uniforms.uBasisY1.w))
          .add(p.z.mul(uniforms.uBasisZ1.w))
          .mul(scale)
      : float(0)

  // Dimensions 9-11 (coords 8-10) - uses third vec4 set
  // WebGL: xND[8] = (uOrigin[8] + pos.x*uBasisX[8] + pos.y*uBasisY[8] + pos.z*uBasisZ[8]) * uFieldScale;
  const x8 =
    dim > 8 && uniforms.uOrigin2 && uniforms.uBasisX2 && uniforms.uBasisY2 && uniforms.uBasisZ2
      ? uniforms.uOrigin2.x
          .add(p.x.mul(uniforms.uBasisX2.x))
          .add(p.y.mul(uniforms.uBasisY2.x))
          .add(p.z.mul(uniforms.uBasisZ2.x))
          .mul(scale)
      : float(0)

  const x9 =
    dim > 9 && uniforms.uOrigin2 && uniforms.uBasisX2 && uniforms.uBasisY2 && uniforms.uBasisZ2
      ? uniforms.uOrigin2.y
          .add(p.x.mul(uniforms.uBasisX2.y))
          .add(p.y.mul(uniforms.uBasisY2.y))
          .add(p.z.mul(uniforms.uBasisZ2.y))
          .mul(scale)
      : float(0)

  const x10 =
    dim > 10 && uniforms.uOrigin2 && uniforms.uBasisX2 && uniforms.uBasisY2 && uniforms.uBasisZ2
      ? uniforms.uOrigin2.z
          .add(p.x.mul(uniforms.uBasisX2.z))
          .add(p.y.mul(uniforms.uBasisY2.z))
          .add(p.z.mul(uniforms.uBasisZ2.z))
          .mul(scale)
      : float(0)

  return { x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10 }
}

/**
 * Type for a PSI evaluator function
 */
export type PsiEvaluator = (...coords: Node[]) => Node

/**
 * Create density sampling function for a specific dimension.
 *
 * @param uniforms - Density uniforms
 * @param evalPsi - Dimension-specific PSI evaluator
 * @param dim - Current dimension
 * @returns TSL Fn that samples density at a 3D position
 */
export function createSampleDensity(
  uniforms: DensityUniforms,
  evalPsi: PsiEvaluator,
  dim: number
) {
  return Fn(([pos, t]: [Node, Node]) => {
    // Map 3D position to ND coordinates
    const coords = mapPosToND(pos, uniforms, dim)

    // Get coordinate array based on dimension
    const coordArr = [
      coords.x0,
      coords.x1,
      coords.x2,
      coords.x3,
      coords.x4,
      coords.x5,
      coords.x6,
      coords.x7,
      coords.x8,
      coords.x9,
      coords.x10,
    ].slice(0, dim)

    // Evaluate wavefunction
    const psi = evalPsi(...coordArr, t)

    // Compute density
    const rho = rhoFromPsi(psi)

    // Apply boost based on quantum mode
    const boostedRho = rho.toVar()

    // Hydrogen orbital density boost
    const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
    const fn = uniforms.uPrincipalN
    const fl = uniforms.uAzimuthalL
    const lBoost = pow(float(3), fl)
    const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)

    boostedRho.assign(select(isHydrogen, boostedRho.mul(hydrogenBoost), boostedRho))

    // Hydrogen ND density boost
    const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)
    const dimFactor = float(1).add(float(uniforms.uDimension).sub(3).mul(0.3))
    const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)

    boostedRho.assign(select(isHydrogenND, rho.mul(hydrogenNDBoost), boostedRho))

    return boostedRho.mul(uniforms.uDensityGain)
  })
}

/**
 * Create density sampling with phase information for coloring.
 *
 * Returns: vec3(rho, logRho, spatialPhase)
 *
 * @param uniforms - Density uniforms
 * @param evalPsiWithPhase - PSI evaluator that returns vec3(psi.x, psi.y, phase)
 * @param dim - Current dimension
 * @returns TSL Fn that samples density with phase
 */
export function createSampleDensityWithPhase(
  uniforms: DensityUniforms,
  evalPsiWithPhase: PsiEvaluator,
  dim: number
) {
  return Fn(([pos, t]: [Node, Node]) => {
    // Map 3D position to ND coordinates
    const coords = mapPosToND(pos, uniforms, dim)

    const coordArr = [
      coords.x0,
      coords.x1,
      coords.x2,
      coords.x3,
      coords.x4,
      coords.x5,
      coords.x6,
      coords.x7,
      coords.x8,
      coords.x9,
      coords.x10,
    ].slice(0, dim)

    // Evaluate wavefunction with phase - returns vec3(psi.x, psi.y, spatialPhase)
    const psiResult = evalPsiWithPhase(...coordArr, t)
    const psiX = psiResult.x
    const psiY = psiResult.y
    const spatialPhase = psiResult.z

    // Compute density
    const rho = psiX.mul(psiX).add(psiY.mul(psiY))

    // Apply boost (same as createSampleDensity)
    const boostedRho = rho.toVar()

    const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
    const fn = uniforms.uPrincipalN
    const fl = uniforms.uAzimuthalL
    const lBoost = pow(float(3), fl)
    const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)

    boostedRho.assign(select(isHydrogen, boostedRho.mul(hydrogenBoost), boostedRho))

    const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)
    const dimFactor = float(1).add(float(uniforms.uDimension).sub(3).mul(0.3))
    const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)

    boostedRho.assign(select(isHydrogenND, rho.mul(hydrogenNDBoost), boostedRho))

    const finalRho = boostedRho.mul(uniforms.uDensityGain)
    const s = sFromRho(finalRho)

    return vec3(finalRho, s, spatialPhase)
  })
}

/**
 * Extended density uniforms including erosion, curl, and shimmer.
 */
export interface ExtendedDensityUniforms extends DensityUniforms {
  // Erosion
  uErosionStrength?: UniformNode<number>
  uErosionScale?: UniformNode<number>
  uErosionTurbulence?: UniformNode<number>
  uErosionNoiseType?: UniformNode<number>

  // Curl
  uCurlEnabled?: UniformNode<boolean>
  uCurlStrength?: UniformNode<number>
  uCurlScale?: UniformNode<number>
  uCurlSpeed?: UniformNode<number>
  uCurlBias?: UniformNode<number>

  // Shimmer
  uShimmerEnabled?: UniformNode<boolean>
  uShimmerStrength?: UniformNode<number>
}

/**
 * Create density sampling with phase and flow support.
 * Returns vec3(rho, logRho, spatialPhase) and outputs flowedPos for gradient reuse.
 *
 * This is the optimized version that:
 * 1. Applies curl flow to position ONCE
 * 2. Returns the flowed position for gradient sampling
 * 3. Applies erosion to the density
 *
 * @param uniforms - Extended density uniforms
 * @param evalPsiWithPhase - PSI evaluator
 * @param dim - Current dimension
 * @returns Object with sampleFn and internal access to flowedPos
 */
export function createSampleDensityWithPhaseAndFlow(
  uniforms: ExtendedDensityUniforms,
  evalPsiWithPhase: PsiEvaluator,
  dim: number
) {
  return Fn(([pos, t]: [Node, Node]) => {
    const posVec = vec3(pos)
    const animTime = uniforms.uTime.mul(uniforms.uTimeScale)

    // Apply curl flow to position
    const flowedPos = uniforms.uCurlEnabled
      ? applyFlow(
          posVec,
          uniforms.uCurlEnabled ?? float(0),
          uniforms.uCurlStrength ?? float(0),
          uniforms.uCurlScale ?? float(1),
          uniforms.uCurlSpeed ?? float(1),
          uniforms.uCurlBias ?? float(0),
          animTime
        )
      : posVec

    // Map flowed position to ND coordinates
    const coords = mapPosToND(flowedPos, uniforms, dim)

    const coordArr = [
      coords.x0,
      coords.x1,
      coords.x2,
      coords.x3,
      coords.x4,
      coords.x5,
      coords.x6,
      coords.x7,
      coords.x8,
      coords.x9,
      coords.x10,
    ].slice(0, dim)

    // Evaluate wavefunction with phase
    const psiResult = evalPsiWithPhase(...coordArr, t)
    const psiX = psiResult.x
    const psiY = psiResult.y
    const spatialPhase = psiResult.z

    // Compute density
    const rho = psiX.mul(psiX).add(psiY.mul(psiY))

    // Apply boost based on quantum mode
    const boostedRho = rho.toVar()

    const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
    const fn = uniforms.uPrincipalN
    const fl = uniforms.uAzimuthalL
    const lBoost = pow(float(3), fl)
    const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)

    boostedRho.assign(select(isHydrogen, boostedRho.mul(hydrogenBoost), boostedRho))

    const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)
    const dimFactor = float(1).add(float(uniforms.uDimension).sub(3).mul(0.3))
    const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)

    boostedRho.assign(select(isHydrogenND, rho.mul(hydrogenNDBoost), boostedRho))

    // Apply density gain
    const gainedRho = boostedRho.mul(uniforms.uDensityGain).toVar()

    // Apply edge erosion (if enabled)
    if (uniforms.uErosionStrength) {
      const erodedRho = erodeDensity(
        gainedRho,
        flowedPos,
        uniforms.uErosionStrength,
        uniforms.uErosionScale ?? float(1),
        uniforms.uErosionTurbulence ?? float(0),
        uniforms.uErosionNoiseType ?? float(0),
        animTime
      )
      gainedRho.assign(erodedRho)
    }

    // Apply shimmer (if enabled)
    if (uniforms.uShimmerEnabled && uniforms.uShimmerStrength) {
      const shimmerEnabled = uniforms.uShimmerEnabled
      const shimmerStrength = uniforms.uShimmerStrength

      // Only shimmer at low densities (edges)
      const shouldShimmer = shimmerEnabled
        .and(shimmerStrength.greaterThan(0))
        .and(gainedRho.greaterThan(0.001))
        .and(gainedRho.lessThan(0.5))

      // High frequency noise for shimmer
      const noisePos = flowedPos.mul(5).add(vec3(0, 0, animTime.mul(2)))
      const shimmerNoise = gradientNoise(noisePos).mul(0.5).add(0.5)

      // Uncertainty inversely proportional to density
      const uncertainty = float(1).sub(clamp(gainedRho.mul(2), float(0), float(1)))

      const shimmerFactor = float(1).add(
        shimmerNoise.sub(0.5).mul(shimmerStrength).mul(uncertainty)
      )

      const shimmeredRho = gainedRho.mul(shimmerFactor)
      gainedRho.assign(select(shouldShimmer, shimmeredRho, gainedRho))
    }

    const s = sFromRho(gainedRho)

    // Return vec4(rho, s, spatialPhase, 0) - the 4th component could hold flowedPos info
    // But TSL doesn't allow returning multiple values easily, so we pack into vec3
    return vec3(gainedRho, s, spatialPhase)
  })
}

/**
 * Create density sampling at pre-flowed position (skips applyFlow).
 * Use this for gradient sampling when flowedPos is already computed.
 *
 * Matches WebGL sampleDensityAtFlowedPos - STILL applies erosion!
 * WebGL: density.glsl.ts lines 573-609
 *
 * @param uniforms - Extended density uniforms (includes erosion)
 * @param evalPsi - PSI evaluator
 * @param dim - Current dimension
 * @returns TSL Fn that samples density at a pre-flowed position
 */
export function createSampleDensityAtFlowedPos(
  uniforms: ExtendedDensityUniforms,
  evalPsi: PsiEvaluator,
  dim: number
) {
  return Fn(([flowedPos, t]: [Node, Node]) => {
    const flowedPosVec = vec3(flowedPos)
    const animTime = uniforms.uTime.mul(uniforms.uTimeScale)

    // Map pre-flowed position to ND coordinates
    const coords = mapPosToND(flowedPosVec, uniforms, dim)

    const coordArr = [
      coords.x0,
      coords.x1,
      coords.x2,
      coords.x3,
      coords.x4,
      coords.x5,
      coords.x6,
      coords.x7,
      coords.x8,
      coords.x9,
      coords.x10,
    ].slice(0, dim)

    // Evaluate wavefunction
    const psi = evalPsi(...coordArr, t)

    // Compute density
    const rho = rhoFromPsi(psi).toVar()

    // Apply boost based on quantum mode
    const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
    const fn = uniforms.uPrincipalN
    const fl = uniforms.uAzimuthalL
    const lBoost = pow(float(3), fl)
    const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)

    rho.assign(select(isHydrogen, rho.mul(hydrogenBoost), rho))

    const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)
    const dimFactor = float(1).add(float(uniforms.uDimension).sub(3).mul(0.3))
    const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)

    rho.assign(select(isHydrogenND, rho.mul(hydrogenNDBoost), rho))

    // Apply edge erosion (using flowedPos since it's already flowed)
    // Matches WebGL: rho = erodeDensity(rho, flowedPos);
    if (uniforms.uErosionStrength) {
      const erodedRho = erodeDensity(
        rho,
        flowedPosVec,
        uniforms.uErosionStrength,
        uniforms.uErosionScale ?? float(1),
        uniforms.uErosionTurbulence ?? float(0),
        uniforms.uErosionNoiseType ?? float(0),
        animTime
      )
      rho.assign(erodedRho)
    }

    return rho.mul(uniforms.uDensityGain)
  })
}

/**
 * Create density sampling at pre-flowed position WITHOUT erosion.
 * Use this for gradient sampling where erosion is unnecessary.
 * Saves ~80% of erosion noise evaluations.
 *
 * Matches WebGL sampleDensityAtFlowedPosNoErosion - NO erosion applied.
 * WebGL: density.glsl.ts lines 615-648
 *
 * @param uniforms - Density uniforms
 * @param evalPsi - PSI evaluator
 * @param dim - Current dimension
 * @returns TSL Fn that samples density without erosion
 */
export function createSampleDensityAtFlowedPosNoErosion(
  uniforms: DensityUniforms,
  evalPsi: PsiEvaluator,
  dim: number
) {
  return Fn(([flowedPos, t]: [Node, Node]) => {
    // Map pre-flowed position to ND coordinates
    const coords = mapPosToND(flowedPos, uniforms, dim)

    const coordArr = [
      coords.x0,
      coords.x1,
      coords.x2,
      coords.x3,
      coords.x4,
      coords.x5,
      coords.x6,
      coords.x7,
      coords.x8,
      coords.x9,
      coords.x10,
    ].slice(0, dim)

    // Evaluate wavefunction
    const psi = evalPsi(...coordArr, t)

    // Compute density
    const rho = rhoFromPsi(psi).toVar()

    // Apply boost based on quantum mode
    const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
    const fn = uniforms.uPrincipalN
    const fl = uniforms.uAzimuthalL
    const lBoost = pow(float(3), fl)
    const hydrogenBoost = float(50).mul(fn).mul(fn).mul(lBoost)

    rho.assign(select(isHydrogen, rho.mul(hydrogenBoost), rho))

    const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)
    const dimFactor = float(1).add(float(uniforms.uDimension).sub(3).mul(0.3))
    const hydrogenNDBoost = float(50).mul(fn).mul(fn).mul(lBoost).mul(dimFactor)

    rho.assign(select(isHydrogenND, rho.mul(hydrogenNDBoost), rho))

    // NO erosion applied - gradient shape from base wavefunction is sufficient
    return rho.mul(uniforms.uDensityGain)
  })
}
