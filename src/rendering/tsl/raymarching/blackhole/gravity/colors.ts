/**
 * TSL Black Hole Coloring Logic
 *
 * Implements the color algorithm dispatcher for the black hole.
 * Integrates global palette functions with black hole specific modes.
 *
 * NOTE: Uses shared color functions from tsl/color/* to avoid duplication.
 * The shared modules provide exact WebGL parity implementations.
 *
 * CRITICAL: Uses select() chains instead of If().ElseIf() for WebGPU compatibility.
 * TSL If() returns void, so .ElseIf() chaining doesn't work. select() is the
 * correct GPU-friendly pattern for conditional logic.
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/colors
 */

import { Fn, float, vec3, pow, mix, atan, sqrt, max, select } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import * as THREE from 'three'

import { blackbodyColor, createGravitationalRedshift } from './doppler'

// Import shared color functions from tsl/color (100% WebGL parity)
import {
  rgb2hsl as sharedRgb2hsl,
  hsl2rgb as sharedHsl2rgb,
  lchColor as sharedLchColor,
} from '../../../../tsl/color/conversions'
import { cosinePalette } from '../../../../tsl/color/cosine-palette'

// Color algorithm mode constants (must match palette/types.ts)
export const ALGO_MONOCHROMATIC = 0
export const ALGO_ANALOGOUS = 1
export const ALGO_COSINE = 2
export const ALGO_NORMAL = 3
export const ALGO_DISTANCE = 4
export const ALGO_LCH = 5
export const ALGO_MULTISOURCE = 6
export const ALGO_RADIAL = 7
export const ALGO_PHASE = 8
export const ALGO_MIXED = 9
export const ALGO_BLACKBODY = 10
export const ALGO_ACCRETION_GRADIENT = 11
export const ALGO_GRAVITATIONAL_REDSHIFT = 12

/**
 * Uniforms for color algorithms.
 */
export interface ColorUniforms {
  /** Current color algorithm mode */
  uColorAlgorithm: UniformNode<number>
  /** Base color */
  uBaseColor: UniformNode<THREE.Color>
  /** Disk temperature (for blackbody) */
  uDiskTemperature: UniformNode<number>
  /** Horizon radius */
  uHorizonRadius: UniformNode<number>
  /** Cosine palette parameters */
  uCosineA: UniformNode<THREE.Vector3>
  uCosineB: UniformNode<THREE.Vector3>
  uCosineC: UniformNode<THREE.Vector3>
  uCosineD: UniformNode<THREE.Vector3>
  /** LCH parameters */
  uLchLightness: UniformNode<number>
  uLchChroma: UniformNode<number>
}

// Re-export shared color functions for API compatibility
// These are 100% WebGL parity implementations from tsl/color/conversions.ts
export const rgb2hsl = sharedRgb2hsl
export const hsl2rgb = sharedHsl2rgb
export const lchColor = sharedLchColor

/**
 * Cosine palette color function.
 * color = a + b * cos(2π * (c * t + d))
 *
 * Wrapper around shared cosinePalette for API compatibility.
 */
export const getCosinePaletteColor = Fn(
  ([t, a, b, c, d]: [Node, Node, Node, Node, Node]) => {
    return cosinePalette(a, b, c, d, t)
  }
)

/**
 * Get color from the selected algorithm.
 *
 * 100% port of WebGL getAlgorithmColor()
 *
 * Uses select() chain for GPU-friendly conditional logic.
 * Each select() checks a condition and returns the appropriate color.
 * This pattern evaluates all branches but selects the correct result,
 * which is the standard GPU approach for conditional logic.
 *
 * @param t - Input parameter [0, 1] (usually normalized radial distance)
 * @param pos - 3D position (for normal/phase based algorithms)
 * @param normal - Surface normal (for normal-based coloring)
 */
export function createGetAlgorithmColor(uniforms: ColorUniforms) {
  const gravitationalRedshift = createGravitationalRedshift({ uHorizonRadius: uniforms.uHorizonRadius })

  return Fn(([t, pos, normal]: [Node, Node, Node]) => {
    const algo = uniforms.uColorAlgorithm

    // Pre-compute all color options (GPU evaluates all branches)
    // 1. Monochromatic / Analogous (Legacy Palette)
    const baseHSL = rgb2hsl(uniforms.uBaseColor)
    const hueOffset = select(algo.equal(float(ALGO_ANALOGOUS)), t.mul(0.1), float(0))
    const modifiedHSL = vec3(
      baseHSL.x.add(hueOffset).sub(baseHSL.x.add(hueOffset).floor()),
      baseHSL.y,
      mix(float(0.3), float(0.9), t)
    )
    const monochromaticColor = hsl2rgb(modifiedHSL)

    // 2. Cosine Gradient (Standard Radial)
    const cosineColor = getCosinePaletteColor(
      t,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD
    )

    // 3. Normal Based
    const nt = normal.y.mul(0.5).add(0.5)
    const normalColor = getCosinePaletteColor(
      nt,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD
    )

    // 4. Phase (Angular)
    const angle = atan(pos.z, pos.x)
    const pt = angle.mul(0.15915).add(0.5) // [-PI, PI] -> [0, 1]
    const phaseColor = getCosinePaletteColor(
      pt,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD
    )

    // 5. LCH
    const lchColorResult = lchColor(t, uniforms.uLchLightness, uniforms.uLchChroma)

    // 6. Blackbody
    // Guard against negative/zero base for pow with fractional exponent
    const safeBase = max(t.add(0.1), float(0.01))
    const temp = uniforms.uDiskTemperature.mul(pow(safeBase, float(-0.5)))
    const blackbodyColorResult = blackbodyColor(temp)

    // 7. Accretion Gradient
    const deepGold = vec3(1.0, 0.5, 0.1)
    const brightGold = vec3(1.0, 0.9, 0.7)
    const accretionColor = mix(brightGold, deepGold, t)

    // 8. Gravitational Redshift
    const r = sqrt(pos.x.mul(pos.x).add(pos.z.mul(pos.z)))
    const redshift = gravitationalRedshift(r)
    const redshiftColor = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), redshift)

    // Fallback color
    const fallbackColor = vec3(uniforms.uBaseColor)

    // Build the select chain (innermost = fallback, outermost = first check)
    // Order: Gravitational Redshift → Accretion → Blackbody → LCH → Phase → Normal → Cosine → Monochromatic → Fallback
    const result = select(
      algo.equal(float(ALGO_MONOCHROMATIC)).or(algo.equal(float(ALGO_ANALOGOUS))),
      monochromaticColor,
      select(
        algo.equal(float(ALGO_COSINE)).or(algo.equal(float(ALGO_DISTANCE))).or(algo.equal(float(ALGO_RADIAL))),
        cosineColor,
        select(
          algo.equal(float(ALGO_NORMAL)),
          normalColor,
          select(
            algo.equal(float(ALGO_PHASE)),
            phaseColor,
            select(
              algo.equal(float(ALGO_LCH)),
              lchColorResult,
              select(
                algo.equal(float(ALGO_BLACKBODY)),
                blackbodyColorResult,
                select(
                  algo.equal(float(ALGO_ACCRETION_GRADIENT)),
                  accretionColor,
                  select(
                    algo.equal(float(ALGO_GRAVITATIONAL_REDSHIFT)),
                    redshiftColor,
                    fallbackColor
                  )
                )
              )
            )
          )
        )
      )
    )

    return result
  })
}
