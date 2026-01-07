/**
 * TSL Photon Shell
 *
 * The photon sphere where light orbits the black hole.
 * For Schwarzschild black hole, R_p = 1.5 * R_h (photon sphere at 1.5× horizon).
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/shell
 */

import { Fn, float, vec3, abs, max, pow, smoothstep, mix } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import * as THREE from 'three'

/**
 * Uniforms for photon shell calculations.
 */
export interface ShellUniforms {
  /** Pre-computed photon shell radius */
  uShellRpPrecomputed: UniformNode<number>
  /** Pre-computed shell delta (width) */
  uShellDeltaPrecomputed: UniformNode<number>
  /** Shell contrast boost */
  uShellContrastBoost: UniformNode<number>
  /** Shell intensity multiplier */
  uShellIntensity: UniformNode<number>
  /** Shell step multiplier (for adaptive stepping) */
  uShellStepMul?: UniformNode<number>
  /** Shell glow strength */
  uShellGlowStrength?: UniformNode<number>
  /** Shell glow color */
  uShellGlowColor?: UniformNode<THREE.Color>
}

/**
 * Get photon shell radius.
 *
 * Uses precomputed value from CPU to avoid per-pixel calculations.
 */
export function createGetPhotonShellRadius(uniforms: ShellUniforms) {
  return Fn(() => {
    return uniforms.uShellRpPrecomputed
  })
}

/**
 * Calculate photon shell mask.
 * Returns 1 when on the shell, 0 elsewhere.
 *
 * mask = 1 - smoothstep(0, Δ, |r - R_p|)
 */
export function createPhotonShellMask(uniforms: ShellUniforms) {
  return Fn(([ndRadius]: [Node]) => {
    const Rp = uniforms.uShellRpPrecomputed
    const delta = uniforms.uShellDeltaPrecomputed

    // Distance from shell radius
    const dist = abs(ndRadius.sub(Rp))

    // Smooth ring falloff using smoothstep
    const mask = float(1.0).sub(smoothstep(float(0), delta, dist))

    // Apply contrast boost for sharper ring
    // WebGL: mask = pow(mask, 1.0 / max(uShellContrastBoost, 0.1)); return mask;
    const boostedMask = pow(mask, float(1.0).div(max(uniforms.uShellContrastBoost, float(0.1))))

    // Note: WebGL does NOT multiply by uShellIntensity here - that's applied elsewhere
    return boostedMask
  })
}

/**
 * Get adaptive step size modifier near shell, also outputs the computed mask.
 * Smaller steps near the photon sphere for accurate capture.
 *
 * Returns { stepMod, mask } where:
 * - stepMod: Step size modifier (1.0 = no change, <1.0 = smaller steps)
 * - mask: The computed shell mask (0 if outside shell region)
 */
export function createShellStepModifierWithMask(uniforms: ShellUniforms) {
  return Fn(([ndRadius]: [Node]) => {
    // Use smooth transitions instead of hard cutoffs to prevent aliasing
    const adaptiveCenter = uniforms.uShellRpPrecomputed
    const adaptiveWidth = uniforms.uShellDeltaPrecomputed.mul(2.0)

    const dist = abs(ndRadius.sub(adaptiveCenter))

    // Smooth mask using smoothstep (no hard cutoffs)
    const mask = float(1.0).sub(smoothstep(float(0), adaptiveWidth, dist))

    // Default step multiplier if not provided
    const stepMul = uniforms.uShellStepMul ?? float(0.3)

    // Reduce step size smoothly near the region of interest
    const stepMod = mix(float(1.0), stepMul, mask)

    return vec3(stepMod, mask, float(0))
  })
}

/**
 * Get adaptive step size modifier near shell (convenience wrapper).
 */
export function createShellStepModifier(uniforms: ShellUniforms) {
  const shellStepModWithMask = createShellStepModifierWithMask(uniforms)

  return Fn(([ndRadius]: [Node]) => {
    return shellStepModWithMask(ndRadius).x
  })
}

/**
 * Calculate photon shell emission.
 *
 * NOTE: Shell emission is now handled in main.glsl.ts using
 * lensing-aware closest approach tracking. This function returns vec3(0.0)
 * to match the WebGL stub behavior.
 *
 * The new implementation emits glow when a ray is at its closest approach
 * to the black hole, which naturally follows the lensing-deformed visual
 * shape instead of being a geometric sphere.
 *
 * @param mask - Shell mask (unused, kept for API parity)
 * @param pos - Position (unused, kept for API parity)
 */
export function createPhotonShellEmission(_uniforms: ShellUniforms) {
  return Fn(([_mask, _pos]: [Node, Node]) => {
    // Shell emission moved to main composition for lensing-aware rendering
    // WebGL: return vec3(0.0);
    return vec3(0, 0, 0)
  })
}

