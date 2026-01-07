/**
 * TSL Color Algorithm Selector
 *
 * 100% port of WebGL selector.glsl.ts
 * All 11 color algorithms with exact same behavior.
 *
 * @module rendering/tsl/color/selector
 */

import {
  atan,
  clamp,
  float,
  Fn,
  length,
  mix,
  select,
  smoothstep,
  vec3,
} from 'three/tsl'

import type { Node } from 'three/tsl'
import type { ColorTSLUniforms } from './color-uniforms'
import { applyDistribution, getCosinePaletteColor } from './cosine-palette'
import { hsl2rgb, lchColor } from './conversions'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

// TSL atan is overloaded to accept 2 args (like atan2) but types don't reflect this
const atan2Args = atan as unknown as (y: Node, x: Node) => FloatNode

// Bounding radius constant (matches WebGL BOUND_R)
const BOUND_R = 2.0

// Algorithm constants
export const COLOR_ALGORITHM = {
  MONOCHROMATIC: 0,
  ANALOGOUS: 1,
  COSINE_PALETTE: 2,
  NORMAL_BASED: 3,
  DISTANCE_FIELD: 4,
  LCH_PERCEPTUAL: 5,
  MULTI_SOURCE: 6,
  RADIAL: 7,
  PHASE_ANGULAR: 8,
  MIXED_PHASE_DIST: 9,
  BLACKBODY: 10,
} as const

/**
 * Unified Color Algorithm Selector
 * Exact port of WebGL getColorByAlgorithm()
 *
 * @param uniforms - Color system uniforms
 * @returns TSL Fn that computes color based on algorithm and parameters
 */
export const createColorSelector = (uniforms: ColorTSLUniforms) =>
  Fn(([t, normal, baseHSL, position]: [FloatNode, Vec3Node, Vec3Node, Vec3Node]) => {
    const algorithm = uniforms.uColorAlgorithm

    // Algorithm 0: Monochromatic - same hue, varying lightness
    const monoDistT = applyDistribution(
      t,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )
    const monoNewL = float(0.3).add(monoDistT.mul(0.4))
    const monoResult = hsl2rgb(vec3(baseHSL.x, baseHSL.y, monoNewL))

    // Algorithm 1: Analogous - hue varies +/-30 deg from base
    const analogDistT = applyDistribution(
      t,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )
    const analogHueOffset = analogDistT.sub(0.5).mul(0.167)
    const analogNewH = baseHSL.x.add(analogHueOffset)
    const analogNewHFract = analogNewH.sub(analogNewH.floor())
    const analogResult = hsl2rgb(vec3(analogNewHFract, baseHSL.y, baseHSL.z))

    // Algorithm 2: Cosine gradient palette
    const cosineResult = getCosinePaletteColor(
      t,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 3: Normal-based coloring
    const normalT = normal.y.mul(0.5).add(0.5)
    const normalResult = getCosinePaletteColor(
      normalT,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 4: Distance-field coloring
    const distFieldResult = getCosinePaletteColor(
      t,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 5: LCH/Oklab perceptual
    const lchDistT = applyDistribution(
      t,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )
    const lchResult = lchColor(lchDistT, uniforms.uLchLightness, uniforms.uLchChroma)

    // Algorithm 6: Multi-source mapping
    // Blends depth (t), orbitTrap (position-based), and normal contributions
    const weights = uniforms.uMultiSourceWeights
    const totalWeight = weights.x.add(weights.y).add(weights.z)
    const normalizedWeights = weights.div(totalWeight.max(0.001))
    const normalValue = normal.y.mul(0.5).add(0.5)
    // Use position-based orbit trap instead of duplicating t
    const orbitTrap = clamp(length(position).div(BOUND_R), float(0), float(1))
    const blendedT = normalizedWeights.x
      .mul(t)
      .add(normalizedWeights.y.mul(orbitTrap))
      .add(normalizedWeights.z.mul(normalValue))
    const multiSourceResult = getCosinePaletteColor(
      blendedT,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 7: Radial - color based on 3D distance from origin
    const radialT = clamp(length(position).div(BOUND_R), float(0), float(1))
    const radialResult = getCosinePaletteColor(
      radialT,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 8: Phase (Angular)
    // Use azimuth angle in XZ plane normalized to 0-1
    const angle = atan2Args(position.z, position.x)
    const phaseT = angle.mul(0.15915).add(0.5) // 1/(2*PI) = 0.15915
    const phaseResult = getCosinePaletteColor(
      phaseT,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 9: Mixed (Phase + Distance)
    const mixedAngle = atan2Args(position.z, position.x)
    const mixedPhaseT = mixedAngle.mul(0.15915).add(0.5)
    const mixedDistT = applyDistribution(
      t,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )
    // Map phase to Hue, Distance to Lightness (conceptually) via Palette
    const mixedT = mix(mixedPhaseT, mixedDistT, float(0.5))
    const mixedResult = getCosinePaletteColor(
      mixedT,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Algorithm 10: Blackbody (Heat)
    const heatDistT = applyDistribution(
      t,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )
    // Simple Kelvin-like gradient: Black->Red->Orange->White
    // t 0.0 -> 0,0,0
    // t 0.33 -> 1,0,0
    // t 0.66 -> 1,1,0
    // t 1.0 -> 1,1,1
    const heatR = smoothstep(float(0), float(0.33), heatDistT)
    const heatG = smoothstep(float(0.33), float(0.66), heatDistT)
    const heatB = smoothstep(float(0.66), float(1), heatDistT)
    const blackbodyResult = vec3(heatR, heatG, heatB)

    // Fallback: cosine palette
    const fallbackResult = getCosinePaletteColor(
      t,
      uniforms.uCosineA,
      uniforms.uCosineB,
      uniforms.uCosineC,
      uniforms.uCosineD,
      uniforms.uDistPower,
      uniforms.uDistCycles,
      uniforms.uDistOffset
    )

    // Select based on algorithm using nested select() chain
    // Exactly matches WebGL if-else chain behavior
    return select(
      algorithm.equal(COLOR_ALGORITHM.MONOCHROMATIC),
      monoResult,
      select(
        algorithm.equal(COLOR_ALGORITHM.ANALOGOUS),
        analogResult,
        select(
          algorithm.equal(COLOR_ALGORITHM.COSINE_PALETTE),
          cosineResult,
          select(
            algorithm.equal(COLOR_ALGORITHM.NORMAL_BASED),
            normalResult,
            select(
              algorithm.equal(COLOR_ALGORITHM.DISTANCE_FIELD),
              distFieldResult,
              select(
                algorithm.equal(COLOR_ALGORITHM.LCH_PERCEPTUAL),
                lchResult,
                select(
                  algorithm.equal(COLOR_ALGORITHM.MULTI_SOURCE),
                  multiSourceResult,
                  select(
                    algorithm.equal(COLOR_ALGORITHM.RADIAL),
                    radialResult,
                    select(
                      algorithm.equal(COLOR_ALGORITHM.PHASE_ANGULAR),
                      phaseResult,
                      select(
                        algorithm.equal(COLOR_ALGORITHM.MIXED_PHASE_DIST),
                        mixedResult,
                        select(
                          algorithm.equal(COLOR_ALGORITHM.BLACKBODY),
                          blackbodyResult,
                          fallbackResult
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  })
