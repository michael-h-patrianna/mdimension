/**
 * SkyboxUtilsTSL - TSL utility functions for procedural skybox
 *
 * Ports GLSL noise, hash, fbm, and voronoi functions to TSL Fn().
 */

import {
  float,
  Fn,
  Loop,
  vec2,
  vec3,
} from 'three/tsl'
import type { Node } from 'three/tsl'

// ============================================================================
// Constants
// ============================================================================

export const PI = float(3.14159265359)
export const TAU = float(6.28318530718)

// ============================================================================
// Hash Function - High quality 3D hash
// ============================================================================

export const hash3D = Fn(([p]: [Node]) => {
  // p = fract(p * 0.3183099 + 0.1)
  const p1 = p.mul(0.3183099).add(0.1).fract()
  // p *= 17.0
  const p2 = p1.mul(17.0)
  // return fract(p.x * p.y * p.z * (p.x + p.y + p.z))
  const sum = p2.x.add(p2.y).add(p2.z)
  const product = p2.x.mul(p2.y).mul(p2.z).mul(sum)
  return product.fract()
})

// ============================================================================
// 3D Noise Function - Smooth value noise
// ============================================================================

export const noise3D = Fn(([x]: [Node]) => {
  // Floor and fract
  const i = x.floor()
  const f = x.fract()

  // Smoothstep interpolation: f = f * f * (3 - 2 * f)
  const f2 = f.mul(f).mul(f.mul(-2).add(3))

  // Sample 8 corners and trilinear interpolate
  // Using nested mix() for trilinear interpolation
  const h000 = hash3D(i)
  const h100 = hash3D(i.add(vec3(1, 0, 0)))
  const h010 = hash3D(i.add(vec3(0, 1, 0)))
  const h110 = hash3D(i.add(vec3(1, 1, 0)))
  const h001 = hash3D(i.add(vec3(0, 0, 1)))
  const h101 = hash3D(i.add(vec3(1, 0, 1)))
  const h011 = hash3D(i.add(vec3(0, 1, 1)))
  const h111 = hash3D(i.add(vec3(1, 1, 1)))

  // Trilinear interpolation
  const x0 = h000.mix(h100, f2.x)
  const x1 = h010.mix(h110, f2.x)
  const x2 = h001.mix(h101, f2.x)
  const x3 = h011.mix(h111, f2.x)

  const y0 = x0.mix(x1, f2.y)
  const y1 = x2.mix(x3, f2.y)

  return y0.mix(y1, f2.z)
})

// ============================================================================
// FBM - Fractal Brownian Motion (2 octaves for performance)
// ============================================================================

export const fbm2 = Fn(([x]: [Node]) => {
  let v = float(0.0).toVar('fbmValue')
  let a = float(0.5).toVar('fbmAmp')
  const shift = vec3(100.0, 100.0, 100.0)
  let pos = vec3(x).toVar('fbmPos')

  // Unrolled 2 octaves
  v.assign(v.add(a.mul(noise3D(pos))))
  pos.assign(pos.mul(2.0).add(shift))
  a.assign(a.mul(0.5))

  v.assign(v.add(a.mul(noise3D(pos))))

  return v
})

export const fbm3 = Fn(([x]: [Node]) => {
  let v = float(0.0).toVar('fbmValue')
  let a = float(0.5).toVar('fbmAmp')
  const shift = vec3(100.0, 100.0, 100.0)
  let pos = vec3(x).toVar('fbmPos')

  // Unrolled 3 octaves
  v.assign(v.add(a.mul(noise3D(pos))))
  pos.assign(pos.mul(2.0).add(shift))
  a.assign(a.mul(0.5))

  v.assign(v.add(a.mul(noise3D(pos))))
  pos.assign(pos.mul(2.0).add(shift))
  a.assign(a.mul(0.5))

  v.assign(v.add(a.mul(noise3D(pos))))

  return v
})

// ============================================================================
// Voronoi - 3D Voronoi for crystalline patterns
// ============================================================================

export const voronoi3D = Fn(([x]: [Node]) => {
  const p = x.floor()
  const f = x.fract()

  let minDist = float(1.0).toVar('minDist')
  let secondDist = float(1.0).toVar('secondDist')

  // 3x3x3 neighbor search (unrolled for TSL)
  // This is computationally expensive but necessary for proper voronoi
  Loop(3, ({ i: ki }) => {
    Loop(3, ({ i: kj }) => {
      Loop(3, ({ i: kk }) => {
        const b = vec3(
          float(ki).sub(1),
          float(kj).sub(1),
          float(kk).sub(1)
        )
        const neighbor = p.add(b)
        const r = b.sub(f).add(hash3D(neighbor))
        const d = r.dot(r)

        // Update distances
        const newMin = d.lessThan(minDist)
        const newSecond = d.lessThan(secondDist)

        // If d < minDist: secondDist = minDist, minDist = d
        // If d < secondDist but d >= minDist: secondDist = d
        secondDist.assign(
          newMin.select(minDist, newSecond.select(d, secondDist))
        )
        minDist.assign(newMin.select(d, minDist))
      })
    })
  })

  return vec2(minDist.sqrt(), secondDist.sqrt())
})

// ============================================================================
// Color Space Conversions
// ============================================================================

export const rgb2hsv = Fn(([c]: [Node]) => {
  const clamped = c.clamp(0, 1)
  const r = clamped.x
  const g = clamped.y
  const b = clamped.z

  const maxC = r.max(g).max(b)
  const minC = r.min(g).min(b)
  const delta = maxC.sub(minC)

  // Value
  const v = maxC

  // Saturation - guard maxC against zero
  const safeMaxC = maxC.max(float(0.0001))
  const s = maxC.greaterThan(0).select(delta.div(safeMaxC), float(0))

  // Hue
  let h = float(0).toVar('hue')
  const deltaPos = delta.greaterThan(0.00001)

  // CRITICAL: Guard delta against zero for hue calculations
  // In TSL/GPU, all branches of select() are evaluated regardless of deltaPos,
  // so delta.div() would produce Inf/NaN when delta=0 (grayscale colors)
  const safeDelta = delta.max(float(0.0001))

  // If max == r
  const hR = g.sub(b).div(safeDelta).add(g.lessThan(b).select(6, 0)).div(6)
  // If max == g
  const hG = b.sub(r).div(safeDelta).add(2).div(6)
  // If max == b
  const hB = r.sub(g).div(safeDelta).add(4).div(6)

  const maxIsR = maxC.equal(r)
  const maxIsG = maxC.equal(g)

  h.assign(
    deltaPos.select(
      maxIsR.select(hR, maxIsG.select(hG, hB)),
      float(0)
    )
  )

  return vec3(h, s, v)
})

export const hsv2rgb = Fn(([c]: [Node]) => {
  const h = c.x
  const s = c.y
  const v = c.z

  // HSV to RGB conversion
  const i = h.mul(6).floor()
  const f = h.mul(6).sub(i)
  const p = v.mul(s.oneMinus())
  const q = v.mul(f.mul(s).oneMinus())
  const t = v.mul(s.mul(f.oneMinus()).oneMinus())

  const iMod = i.mod(6)

  // Simplified branch selection using conditional math
  const r = iMod.lessThan(1).select(v,
            iMod.lessThan(2).select(q,
            iMod.lessThan(3).select(p,
            iMod.lessThan(4).select(p,
            iMod.lessThan(5).select(t, v)))))

  const g = iMod.lessThan(1).select(t,
            iMod.lessThan(2).select(v,
            iMod.lessThan(3).select(v,
            iMod.lessThan(4).select(q,
            iMod.lessThan(5).select(p, p)))))

  const b = iMod.lessThan(1).select(p,
            iMod.lessThan(2).select(p,
            iMod.lessThan(3).select(t,
            iMod.lessThan(4).select(v,
            iMod.lessThan(5).select(v, q)))))

  return vec3(r, g, b)
})

// ============================================================================
// Cosine Palette
// ============================================================================

export const cosinePalette = Fn(([t, a, b, c, d]: [Node, Node, Node, Node, Node]) => {
  // a + b * cos(2π * (c * t + d))
  // Apply cos() directly to vec3, not to individual components
  const angle = c.mul(t).add(d).mul(TAU)
  return a.add(b.mul(angle.cos()))
})

// ============================================================================
// Distortion Effect - Heatwave/Turbulence
// Ported from shaders/skybox/main.glsl.ts
// ============================================================================

export const applyDistortion = Fn(([dir, time, uDistortion]: [Node, Node, Node]) => {
  // if (uDistortion > 0.0) {
  //     float dNoise = sin(dir.y * 20.0 + time * 5.0) * 0.01 * uDistortion;
  //     dir.x += dNoise;
  //     dir.z += dNoise;
  //     dir = normalize(dir);
  // }
  const dNoise = dir.y.mul(20.0).add(time.mul(5.0)).sin().mul(0.01).mul(uDistortion)
  const distortedDir = vec3(
    dir.x.add(dNoise),
    dir.y,
    dir.z.add(dNoise)
  ).normalize()
  // Only apply when distortion > 0
  return uDistortion.greaterThan(0).select(distortedDir, dir)
})

// ============================================================================
// Sun Glow Effect
// Ported from shaders/skybox/effects/sun.glsl.ts
// ============================================================================

export const applySun = Fn(([col, dir, uSunIntensity, uSunPosition]: [Node, Node, Node, Node]) => {
  // Guard against zero-length sun position
  const sunLen = uSunPosition.length()
  const safeSunDir = uSunPosition.div(sunLen)
  const defaultSunDir = vec3(0, 1, 0)
  const sunDir = sunLen.greaterThan(0.0001).select(safeSunDir, defaultSunDir)

  const sunDot = dir.dot(sunDir).max(0)
  // sharp glow: sunDot^8 = (sunDot^2)^2)^2
  // PERF: Use multiplications instead of pow(x, 8.0)
  const s2 = sunDot.mul(sunDot)
  const s4 = s2.mul(s2)
  const sunGlow = s4.mul(s4)

  const sunColor = vec3(1.0, 0.9, 0.7)
  const glowContribution = sunColor.mul(sunGlow).mul(uSunIntensity)

  // Only apply when sun intensity > 0
  return uSunIntensity.greaterThan(0).select(col.add(glowContribution), col)
})

// ============================================================================
// Vignette Effect
// Ported from shaders/skybox/effects/vignette.glsl.ts
// ============================================================================

export const applyVignette = Fn(([col, uv, uVignette]: [Node, Node, Node]) => {
  // float dist = distance(uv, vec2(0.5));
  // float vig = smoothstep(0.4, 0.9, dist);
  // col *= 1.0 - vig * uVignette;
  const dist = uv.sub(vec2(0.5, 0.5)).length()
  const vig = dist.smoothstep(0.4, 0.9)
  const vigFactor = vig.mul(uVignette).oneMinus()

  // Only apply when vignette > 0
  return uVignette.greaterThan(0).select(col.mul(vigFactor), col)
})
