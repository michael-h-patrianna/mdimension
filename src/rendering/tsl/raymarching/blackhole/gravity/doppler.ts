/**
 * TSL Doppler Effect
 *
 * Simulates relativistic Doppler shift in the accretion disk.
 * Material approaching the camera appears blue-shifted (brighter),
 * material receding appears red-shifted (dimmer).
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/doppler
 */

import {
  Fn,
  float,
  vec3,
  sqrt,
  max,
  abs,
  pow,
  clamp,
  log,
  min,
  dot,
  length,
  If,
  mix,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

// Named constants for Doppler calculations
const DOPPLER_EPSILON = 0.0001
const DOPPLER_MIN_RADIUS = 0.001

/**
 * Uniforms for Doppler effect.
 */
export interface DopplerUniforms {
  /** Enable Doppler shift (0 = disabled, 1 = enabled) */
  uDopplerEnabled: UniformNode<number>
  /** Doppler intensity */
  uDopplerStrength: UniformNode<number>
  /** Horizon radius for scale */
  uHorizonRadius: UniformNode<number>
  /** Pre-computed inner disk radius */
  uDiskInnerR: UniformNode<number>
}

/**
 * Calculate orbital velocity direction at a position in the disk.
 * Assumes Keplerian rotation in the XZ plane (horizontal disk like Saturn's rings).
 *
 * @param r - Radial distance (currently unused, kept for API parity with WebGL)
 */
export const orbitalVelocity = Fn(([pos3d, _r]: [Node, Node]) => {
  // Tangent to circle in XZ plane (counter-clockwise when viewed from +Y)
  const safeLen = max(length(vec3(pos3d.x, 0, pos3d.z)), float(DOPPLER_EPSILON))
  const tangent = vec3(pos3d.z.negate(), 0, pos3d.x).div(safeLen)
  return tangent
})

/**
 * Calculate Doppler factor based on velocity relative to view.
 *
 * Returns a value where:
 * - > 1: approaching (blue shift)
 * - = 1: transverse motion
 * - < 1: receding (red shift)
 */
export function createDopplerFactor(uniforms: DopplerUniforms) {
  return Fn(([pos3d, viewDir]: [Node, Node]) => {
    const result = float(1.0).toVar('dopplerFac')

    // GPU branch: uDopplerEnabled is a number (0 or 1), compare with greaterThan
    If(uniforms.uDopplerEnabled.greaterThan(0.5), () => {
      // Disk is in XZ plane, so radius is in XZ
      const r = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))

      If(r.greaterThan(DOPPLER_MIN_RADIUS), () => {
        // Get orbital velocity direction
        const velocity = orbitalVelocity(pos3d, r)

        // Dot product with view direction (negative because viewDir points toward camera)
        const approaching = dot(velocity, viewDir).negate()

        // Keplerian orbital speed: v ∝ 1/√r
        const safeRadius = max(r, max(uniforms.uDiskInnerR, float(DOPPLER_EPSILON)))

        // Normalize velocity so that innerR gives orbitSpeed ≈ 1.0
        const orbitSpeed = sqrt(uniforms.uDiskInnerR.div(safeRadius))

        const dopplerShift = approaching.mul(orbitSpeed).mul(uniforms.uDopplerStrength)

        result.assign(float(1.0).add(dopplerShift))
      })
    })

    return result
  })
}

/**
 * Calculate gravitational redshift factor.
 *
 * Light escaping from near the black hole is redshifted due to
 * gravitational time dilation: z = 1/sqrt(1 - rs/r) - 1
 *
 * @returns Redshift factor (1.0 = no shift, <1.0 = redshifted)
 */
export function createGravitationalRedshift(uniforms: { uHorizonRadius: UniformNode<number> }) {
  return Fn(([r]: [Node]) => {
    // Schwarzschild redshift factor: sqrt(1 - rs/r)
    // Clamp to prevent singularity near horizon
    const rsOverR = uniforms.uHorizonRadius.div(max(r, uniforms.uHorizonRadius.mul(1.01)))
    const redshiftFactor = sqrt(max(float(1.0).sub(rsOverR), float(0.01)))
    return redshiftFactor
  })
}

/**
 * Compute blackbody color from temperature using Planckian locus approximation.
 *
 * Based on the algorithm by Tanner Helland for temperatures 1000K - 40000K.
 */
export const blackbodyColor = Fn(([temperature]: [Node]) => {
  // Clamp to valid range and convert to hectoKelvin
  const temp = clamp(temperature, float(1000.0), float(40000.0)).div(100.0)

  // Red channel
  const r = temp.lessThanEqual(float(66.0)).select(
    float(1.0),
    float(329.698727446).mul(pow(max(temp.sub(60.0), float(0.01)), float(-0.1332047592))).div(255.0)
  )

  // Green channel
  const g = temp.lessThanEqual(float(66.0)).select(
    float(99.4708025861).mul(log(max(temp, float(1.0)))).sub(161.1195681661).div(255.0),
    float(288.1221695283).mul(pow(max(temp.sub(60.0), float(0.01)), float(-0.0755148492))).div(255.0)
  )

  // Blue channel
  const b = temp.greaterThanEqual(float(66.0)).select(
    float(1.0),
    temp.lessThanEqual(float(19.0)).select(
      float(0.0),
      float(138.5177312231).mul(log(max(temp.sub(10.0), float(0.01)))).sub(305.0447927307).div(255.0)
    )
  )

  return clamp(vec3(r, g, b), float(0.0), float(1.0))
})

/**
 * Compute disk temperature at radius using standard thin-disk profile.
 *
 * T(r) = T_inner * (r / r_inner)^(-3/4)
 */
export function createDiskTemperatureProfile(uniforms: {
  uDiskTemperature: UniformNode<number>
  uDiskInnerR: UniformNode<number>
}) {
  return Fn(([r]: [Node]) => {
    const rInner = uniforms.uDiskInnerR
    // GPU branch evaluation: select() evaluates both branches, so guard the division
    const safeRInner = max(rInner, float(0.001))

    return r.lessThanEqual(rInner).select(
      uniforms.uDiskTemperature,
      uniforms.uDiskTemperature.mul(pow(r.div(safeRInner), float(-0.75)))
    )
  })
}

/**
 * Apply Doppler color shift.
 *
 * Blue shift for approaching (hue rotates toward blue/violet)
 * Red shift for receding (hue rotates toward red)
 *
 * Uses direct RGB color mixing instead of HSL conversion for performance.
 */
export function createApplyDopplerShift(uniforms: DopplerUniforms) {
  return Fn(([color, dopplerFac]: [Node, Node]) => {
    const result = color.toVar('dopplerColor')

    // GPU branch: uDopplerEnabled is a number (0 or 1), compare with greaterThan
    If(uniforms.uDopplerEnabled.greaterThan(0.5), () => {
      // Brightness change (relativistic beaming: I' = I * D^3)
      const brightness = dopplerFac.mul(dopplerFac).mul(dopplerFac)
      result.assign(result.mul(brightness))

      // Fast approximation of hue shift using direct RGB mixing
      const shiftAmount = dopplerFac.sub(1.0).mul(uniforms.uDopplerStrength)

      If(abs(shiftAmount).greaterThan(0.01), () => {
        // Luminance for saturation boost
        const luminance = vec3(
          dot(result, vec3(0.299, 0.587, 0.114)),
          dot(result, vec3(0.299, 0.587, 0.114)),
          dot(result, vec3(0.299, 0.587, 0.114))
        )

        // Blue shift (approaching): boost blue, reduce red
        // Red shift (receding): boost red, reduce blue
        const blueShifted = vec3(
          result.x.mul(0.7),
          result.y.mul(0.9),
          min(result.z.mul(1.3).add(0.1), float(2.0))
        )

        const redShifted = vec3(
          min(result.x.mul(1.3).add(0.1), float(2.0)),
          result.y.mul(0.9),
          result.z.mul(0.7)
        )

        result.assign(
          shiftAmount.greaterThan(0).select(
            mix(result, blueShifted, min(shiftAmount, float(1.0))),
            mix(result, redShifted, min(shiftAmount.negate(), float(1.0)))
          )
        )

        // Boost saturation slightly for stronger effect
        const satBoost = float(1.0).add(abs(shiftAmount).mul(0.3))
        result.assign(mix(luminance, result, min(satBoost, float(1.5))))
      })
    })

    return max(result, vec3(0))
  })
}

