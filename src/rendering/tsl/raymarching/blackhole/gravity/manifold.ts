/**
 * TSL Luminous Manifold (Accretion Disk)
 *
 * N-dimensional accretion structure:
 * - 3D: Classic thin disk in XZ plane (Y is vertical)
 * - 4D: Sheet (disk with thickness in W)
 * - 5D+: Slab/field with increasing volume
 *
 * @module rendering/tsl/raymarching/blackhole/gravity/manifold
 */

import {
  Fn,
  float,
  vec3,
  sqrt,
  max,
  min,
  pow,
  abs,
  exp,
  fract,
  floor,
  dot,
  sin,
  atan,
  smoothstep,
  If,
  mix,
  clamp,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'
import * as THREE from 'three'
import { safeNormalizeUp } from '../../../utils/safe-math'

/**
 * Uniforms for manifold calculations.
 */
export interface ManifoldUniforms {
  /** Manifold type: 0=auto, 1=disk, 2=sheet, 3=slab, 4=field */
  uManifoldType: UniformNode<number>
  /** Manifold thickness */
  uManifoldThickness: UniformNode<number>
  /** Manifold emission intensity */
  uManifoldIntensity: UniformNode<number>
  /** Horizon radius */
  uHorizonRadius: UniformNode<number>
  /** Disk inner radius multiplier */
  uDiskInnerRadiusMul: UniformNode<number>
  /** Disk outer radius multiplier */
  uDiskOuterRadiusMul: UniformNode<number>
  /** Radial softness multiplier */
  uRadialSoftnessMul: UniformNode<number>
  /** Density falloff exponent */
  uDensityFalloff: UniformNode<number>
  /** Swirl amount */
  uSwirlAmount: UniformNode<number>
  /** Noise scale */
  uNoiseScale: UniformNode<number>
  /** Noise amount */
  uNoiseAmount: UniformNode<number>
  /** Max thickness per dimension */
  uThicknessPerDimMax: UniformNode<number>
  /** Time */
  uTime: UniformNode<number>
  /** Time scale */
  uTimeScale: UniformNode<number>
  /** Disk rotation angle from animation */
  uDiskRotationAngle: UniformNode<number>
  /** Keplerian differential */
  uKeplerianDifferential: UniformNode<number>
  /** Pre-computed inner disk radius */
  uDiskInnerR: UniformNode<number>
  /** Pre-computed outer disk radius */
  uDiskOuterR: UniformNode<number>
  /** Base color */
  uBaseColor: UniformNode<THREE.Color>
  /** Palette mode */
  uPaletteMode: UniformNode<number>
  /** Current dimension */
  dimension: number
  /** High-D parameter values (w, v, u, etc.) - optional for D>3 */
  uParamValues?: UniformNode<number>[]
  /** Scale for high-D contribution to effective height */
  uHighDimWScale?: UniformNode<number>
}

/**
 * Noise function for manifold turbulence.
 *
 * This is a local implementation using sin-based hashing for value noise.
 */
export const noise3D = Fn(([p]: [Node]) => {
  const i = floor(p)
  const f = fract(p)
  const ff = f.mul(f).mul(float(3.0).sub(f.mul(2.0))) // Smoothstep

  const n = dot(i, vec3(1.0, 57.0, 113.0))
  const a = fract(sin(n).mul(43758.5453))
  const b = fract(sin(n.add(1.0)).mul(43758.5453))
  const c = fract(sin(n.add(57.0)).mul(43758.5453))
  const d = fract(sin(n.add(58.0)).mul(43758.5453))
  const e = fract(sin(n.add(113.0)).mul(43758.5453))
  const fVal = fract(sin(n.add(114.0)).mul(43758.5453))
  const g = fract(sin(n.add(170.0)).mul(43758.5453))
  const h = fract(sin(n.add(171.0)).mul(43758.5453))

  const k0 = a
  const k1 = b.sub(a)
  const k2 = c.sub(a)
  const k3 = e.sub(a)
  const k4 = a.sub(b).sub(c).add(d)
  const k5 = a.sub(c).sub(e).add(g)
  const k6 = a.sub(b).sub(e).add(fVal)
  // WebGL: k7 = -a + b + c - d + e - ff - g + h
  const k7 = a.negate().add(b).add(c).sub(d).add(e).sub(fVal).sub(g).add(h)

  return k0
    .add(k1.mul(ff.x))
    .add(k2.mul(ff.y))
    .add(k3.mul(ff.z))
    .add(k4.mul(ff.x).mul(ff.y))
    .add(k5.mul(ff.y).mul(ff.z))
    .add(k6.mul(ff.z).mul(ff.x))
    .add(k7.mul(ff.x).mul(ff.y).mul(ff.z))
})

/**
 * Get effective manifold type based on dimension.
 */
export function createGetManifoldType(uniforms: ManifoldUniforms) {
  return Fn(() => {
    return uniforms.uManifoldType.notEqual(0).select(
      uniforms.uManifoldType,
      // Auto mode: select based on dimension
      uniforms.dimension <= 3
        ? float(1) // disk
        : uniforms.dimension === 4
          ? float(2) // sheet
          : uniforms.dimension <= 6
            ? float(3) // slab
            : float(4) // field
    )
  })
}

/**
 * Calculate radial coordinate in the disk plane.
 */
export const diskRadius = Fn(([pos3d]: [Node]) => {
  return sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))
})

/**
 * Calculate vertical distance from disk plane.
 */
export const verticalDiskDistance = Fn(([pos3d]: [Node]) => {
  return abs(pos3d.y)
})

/**
 * Get effective manifold thickness based on dimension.
 */
export function createGetManifoldThicknessScale(uniforms: ManifoldUniforms) {
  const getManifoldType = createGetManifoldType(uniforms)

  return Fn(() => {
    const manifoldType = getManifoldType()

    return manifoldType.equal(1).select(
      float(1.0), // disk
      manifoldType.equal(2).select(
        float(2.0), // sheet
        manifoldType.equal(3).select(
          min(float(uniforms.dimension - 2), uniforms.uThicknessPerDimMax), // slab
          min(float(uniforms.dimension), uniforms.uThicknessPerDimMax) // field
        )
      )
    )
  })
}

/**
 * Calculate manifold density at given position.
 *
 * @param ndRadius - N-dimensional radius (currently unused, kept for API parity)
 */
export function createManifoldDensity(uniforms: ManifoldUniforms) {
  const getThicknessScale = createGetManifoldThicknessScale(uniforms)

  return Fn(([pos3d, _ndRadius, time]: [Node, Node, Node]) => {
    const r = diskRadius(pos3d)
    const h = verticalDiskDistance(pos3d)

    // Radial bounds
    const innerR = uniforms.uHorizonRadius.mul(uniforms.uDiskInnerRadiusMul)
    const outerR = uniforms.uHorizonRadius.mul(uniforms.uDiskOuterRadiusMul)

    // Radial falloff
    const radialFactor = float(1.0).toVar('radFac')
    If(r.lessThan(innerR), () => {
      radialFactor.assign(
        smoothstep(innerR.mul(float(1.0).sub(uniforms.uRadialSoftnessMul)), innerR, r)
      )
    })
    If(r.greaterThan(outerR), () => {
      radialFactor.assign(
        float(1.0).sub(smoothstep(outerR, outerR.mul(float(1.0).add(uniforms.uRadialSoftnessMul)), r))
      )
    })

    // Calculate thickness
    const thicknessScale = getThicknessScale()
    const thickness = uniforms.uManifoldThickness.mul(uniforms.uHorizonRadius).mul(thicknessScale)

    // Add extra dimension contributions to height for higher D
    // WebGL: for (int i = 0; i < DIMENSION - 3; i++) { effectiveH += abs(w) * uHighDimWScale; }
    let effectiveH = h
    if (uniforms.dimension > 3 && uniforms.uParamValues && uniforms.uHighDimWScale) {
      const extraDims = uniforms.dimension - 3
      for (let i = 0; i < extraDims && i < uniforms.uParamValues.length; i++) {
        const paramValue = uniforms.uParamValues[i]
        if (paramValue) {
          effectiveH = effectiveH.add(abs(paramValue).mul(uniforms.uHighDimWScale))
        }
      }
    }

    // Vertical falloff
    const safeThickness = max(thickness, float(0.0001))
    const safeExponent = clamp(uniforms.uDensityFalloff, float(0.1), float(10.0))
    const heightRatio = effectiveH.div(safeThickness)
    const verticalFactor = exp(pow(min(heightRatio, float(100.0)), safeExponent).negate())

    // Combine factors
    const density = radialFactor.mul(verticalFactor).toVar('density')

    // Add turbulence noise
    If(uniforms.uNoiseAmount.greaterThan(0.001), () => {
      const angle = atan(pos3d.z, pos3d.x)
      const swirlOffset = uniforms.uSwirlAmount.mul(r).mul(0.5).mul(sin(time))
      const noisePos = vec3(
        r.mul(0.3),
        angle.mul(2.0).add(swirlOffset),
        h.mul(0.5)
      ).mul(uniforms.uNoiseScale)

      const n = noise3D(noisePos.add(time.mul(0.1)))

      // Ridged multifractal noise (electric/filigree look)
      const ridged = float(1.0).sub(abs(float(2.0).mul(n).sub(1.0)))
      const ridgedSq = ridged.mul(ridged)

      density.assign(density.mul(mix(float(1.0), ridgedSq, uniforms.uNoiseAmount)))
    })

    return max(density, float(0))
  })
}

/**
 * Get manifold emission color based on position and mode.
 *
 * @param ndRadius - N-dimensional radius (currently unused, kept for API parity)
 * @param time - Animation time (currently unused, kept for API parity)
 */
export function createManifoldColor(uniforms: ManifoldUniforms) {
  return Fn(([pos3d, _ndRadius, density, _time]: [Node, Node, Node, Node]) => {
    const r = diskRadius(pos3d)
    const innerR = uniforms.uHorizonRadius.mul(uniforms.uDiskInnerRadiusMul)
    const outerR = uniforms.uHorizonRadius.mul(uniforms.uDiskOuterRadiusMul)

    // Normalized radial position [0, 1]
    const radialRange = max(outerR.sub(innerR), float(0.001))
    const radialT = clamp(r.sub(innerR).div(radialRange), float(0.0), float(1.0))

    const color = uniforms.uBaseColor.toVar('manifoldColor')

    // Palette mode 0: Disk gradient
    If(uniforms.uPaletteMode.equal(0), () => {
      const innerColor = vec3(1.0, 0.9, 0.7) // Yellowish-white (hot)
      const outerColor = vec3(1.0, 0.4, 0.1) // Orange-red (cooler)
      color.assign(mix(innerColor, outerColor, radialT).mul(uniforms.uBaseColor))
    })

    // Palette mode 1: Normal-based
    // GPU branch: If() blocks execute all paths, use safe normalize for pos3d near origin
    If(uniforms.uPaletteMode.equal(1), () => {
      const normal = safeNormalizeUp(pos3d)
      color.assign(abs(normal).mul(uniforms.uBaseColor))
    })

    // Palette mode 2: Shell only - no manifold color
    If(uniforms.uPaletteMode.equal(2), () => {
      color.assign(vec3(0))
    })

    // Palette mode 3: Heatmap based on density
    If(uniforms.uPaletteMode.equal(3), () => {
      const cold = vec3(0.1, 0.0, 0.3)
      const mid = vec3(1.0, 0.3, 0.0)
      const hot = vec3(1.0, 1.0, 0.8)
      color.assign(
        density.lessThan(0.5).select(
          mix(cold, mid, density.mul(2.0)),
          mix(mid, hot, density.sub(0.5).mul(2.0))
        )
      )
    })

    // Add swirl pattern with Keplerian rotation
    If(uniforms.uSwirlAmount.greaterThan(0.001), () => {
      const angle = atan(pos3d.z, pos3d.x)
      // WebGL: float innerR = max(uDiskInnerR, 0.001);
      const safeInnerR = max(uniforms.uDiskInnerR, float(0.001))
      // WebGL: float safeR = max(r, max(innerR * 0.1, 0.001));
      const safeR = max(r, max(safeInnerR.mul(0.1), float(0.001)))
      const ratio = safeInnerR.div(safeR)
      const keplerianFactor = ratio.mul(sqrt(ratio))
      const rotationOffset = uniforms.uDiskRotationAngle.mul(
        mix(float(1.0), keplerianFactor, uniforms.uKeplerianDifferential)
      )

      const swirlPhase = angle.mul(3.0).add(r.mul(0.5)).add(rotationOffset)
      const swirlBright = float(0.5).add(sin(swirlPhase).mul(0.5))
      color.assign(color.mul(mix(float(0.7), float(1.3), swirlBright.mul(uniforms.uSwirlAmount))))
    })

    // Apply intensity
    color.assign(color.mul(uniforms.uManifoldIntensity).mul(density))

    return color
  })
}

/**
 * Calculate absorption for volumetric mode.
 */
export function createManifoldAbsorption(uniforms: {
  uEnableAbsorption: UniformNode<boolean>
  uAbsorption: UniformNode<number>
}) {
  return Fn(([density, stepSize]: [Node, Node]) => {
    return uniforms.uEnableAbsorption.select(
      exp(density.mul(uniforms.uAbsorption).negate().mul(stepSize)),
      float(1.0)
    )
  })
}

/**
 * Compute manifold pseudo-normal from density gradient.
 *
 * Used for FakeLit lighting mode to approximate surface orientation
 * from the volumetric density field.
 *
 * Optimized version: Uses analytical gradient for the vertical component
 * and radial direction for the horizontal component, requiring only 2 extra samples.
 *
 * 100% port of WebGL computeManifoldNormal()
 */
export function createComputeManifoldNormal(uniforms: ManifoldUniforms) {
  const manifoldDensity = createManifoldDensity(uniforms)

  return Fn(([pos3d, ndRadius, time]: [Node, Node, Node]) => {
    // Analytical approach for accretion disk (XZ plane):
    // Normal is primarily vertical (Y) + radial (XZ).

    const eps = float(0.01)
    const d0 = manifoldDensity(pos3d, ndRadius, time)

    // Sample only along Y to get vertical gradient
    const dy = manifoldDensity(pos3d.add(vec3(0, eps, 0)), ndRadius, time)
    const verticalGrad = dy.sub(d0).div(eps)

    // Radial component follows the radial direction in XZ plane
    const r = sqrt(pos3d.x.mul(pos3d.x).add(pos3d.z.mul(pos3d.z)))
    // GPU branch evaluation: select() evaluates both branches, so guard the division
    const safeR = max(r, float(1e-6))
    const radialDir = r.greaterThan(1e-6).select(
      vec3(pos3d.x.div(safeR), 0, pos3d.z.div(safeR)),
      vec3(1, 0, 0)
    )

    // Estimate radial gradient (density decreases with radius)
    const dr = manifoldDensity(pos3d.add(radialDir.mul(eps)), ndRadius, time)
    const radialGrad = dr.sub(d0).div(eps)

    // Combine vertical (Y) and radial (XZ) components
    const normalRaw = radialDir.mul(radialGrad).add(vec3(0, verticalGrad, 0))

    const normalLen = sqrt(dot(normalRaw, normalRaw))
    // GPU branch evaluation: select() evaluates both branches, so guard the division
    const safeNormalLen = max(normalLen, float(0.0001))

    // Return normalized normal pointing toward higher density, or fallback to up vector
    return normalLen.greaterThan(0.0001).select(
      normalRaw.negate().div(safeNormalLen), // Point toward higher density
      vec3(0, 1, 0) // Fallback: up vector
    )
  })
}

