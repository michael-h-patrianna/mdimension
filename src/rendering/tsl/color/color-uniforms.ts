/**
 * TSL Color System Uniforms
 *
 * Uniform node definitions for color algorithm system.
 * Matches WebGL uniform structure for 100% parity.
 *
 * @module rendering/tsl/color/color-uniforms
 */

import { Vector3 } from 'three'
import { uniform } from 'three/tsl'

import type { UniformNode } from 'three/tsl'

/**
 * Color algorithm TSL uniforms interface
 * Matches WebGL color uniforms exactly
 */
export interface ColorTSLUniforms {
  // Algorithm selection
  uColorAlgorithm: UniformNode<number>

  // Cosine palette parameters
  uCosineA: UniformNode<Vector3>
  uCosineB: UniformNode<Vector3>
  uCosineC: UniformNode<Vector3>
  uCosineD: UniformNode<Vector3>

  // Distribution parameters
  uDistPower: UniformNode<number>
  uDistCycles: UniformNode<number>
  uDistOffset: UniformNode<number>

  // LCH parameters
  uLchLightness: UniformNode<number>
  uLchChroma: UniformNode<number>

  // Multi-source weights (depth, orbitTrap, normal)
  uMultiSourceWeights: UniformNode<Vector3>
}

/**
 * Default cosine palette presets
 * Exact values from WebGL implementation
 */
export const COSINE_PALETTE_DEFAULTS = {
  // Classic rainbow
  rainbow: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  // Sunset
  sunset: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.7, 0.4],
    d: [0.0, 0.15, 0.2],
  },
  // Ice
  ice: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [0.4, 0.7, 1.0],
    d: [0.0, 0.5, 0.5],
  },
}

/**
 * Create color TSL uniforms with defaults
 *
 * @returns Color uniforms initialized with default values
 */
export function createColorTSLUniforms(): ColorTSLUniforms {
  return {
    uColorAlgorithm: uniform(2), // Default to cosine palette

    // Default rainbow palette
    uCosineA: uniform(new Vector3(0.5, 0.5, 0.5)),
    uCosineB: uniform(new Vector3(0.5, 0.5, 0.5)),
    uCosineC: uniform(new Vector3(1.0, 1.0, 1.0)),
    uCosineD: uniform(new Vector3(0.0, 0.33, 0.67)),

    // Distribution defaults
    uDistPower: uniform(1.0),
    uDistCycles: uniform(1.0),
    uDistOffset: uniform(0.0),

    // LCH defaults
    uLchLightness: uniform(0.7),
    uLchChroma: uniform(0.15),

    // Multi-source weights (depth, orbitTrap, normal)
    uMultiSourceWeights: uniform(new Vector3(0.5, 0.25, 0.25)),
  }
}

/**
 * Update color uniforms from store state
 *
 * @param uniforms - Color uniforms to update
 * @param state - Color state from appearance store
 */
export function updateColorTSLUniforms(
  uniforms: ColorTSLUniforms,
  state: {
    colorAlgorithm?: number
    cosineA?: [number, number, number]
    cosineB?: [number, number, number]
    cosineC?: [number, number, number]
    cosineD?: [number, number, number]
    distPower?: number
    distCycles?: number
    distOffset?: number
    lchLightness?: number
    lchChroma?: number
    multiSourceWeights?: [number, number, number]
  }
): void {
  if (state.colorAlgorithm !== undefined) {
    uniforms.uColorAlgorithm.value = state.colorAlgorithm
  }

  if (state.cosineA) {
    uniforms.uCosineA.value = new Vector3(...state.cosineA)
  }
  if (state.cosineB) {
    uniforms.uCosineB.value = new Vector3(...state.cosineB)
  }
  if (state.cosineC) {
    uniforms.uCosineC.value = new Vector3(...state.cosineC)
  }
  if (state.cosineD) {
    uniforms.uCosineD.value = new Vector3(...state.cosineD)
  }

  if (state.distPower !== undefined) {
    uniforms.uDistPower.value = state.distPower
  }
  if (state.distCycles !== undefined) {
    uniforms.uDistCycles.value = state.distCycles
  }
  if (state.distOffset !== undefined) {
    uniforms.uDistOffset.value = state.distOffset
  }

  if (state.lchLightness !== undefined) {
    uniforms.uLchLightness.value = state.lchLightness
  }
  if (state.lchChroma !== undefined) {
    uniforms.uLchChroma.value = state.lchChroma
  }

  if (state.multiSourceWeights) {
    uniforms.uMultiSourceWeights.value = new Vector3(...state.multiSourceWeights)
  }
}
