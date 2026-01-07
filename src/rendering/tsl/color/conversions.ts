/**
 * TSL Color Space Conversions
 *
 * 100% port of WebGL color conversion functions.
 * - HSL: rgb2hsl, hsl2rgb, hue2rgb from hsl.glsl.ts
 * - Oklab: linearSrgbToOklab, oklabToLinearSrgb, lchColor from oklab.glsl.ts
 *
 * @module rendering/tsl/color/conversions
 */

import { clamp, cos, float, Fn, max, min, pow, select, sin, vec3 } from 'three/tsl'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

const TWO_PI = 6.28318

// ============================================
// HSL Color Space (from hsl.glsl.ts)
// ============================================

/**
 * Convert RGB to HSL
 * Exact port of WebGL rgb2hsl()
 */
export const rgb2hsl = Fn(([c]: [Vec3Node]) => {
  const maxC = max(c.r, max(c.g, c.b))
  const minC = min(c.r, min(c.g, c.b))
  const l = maxC.add(minC).mul(0.5)

  // Check if grayscale (maxC == minC)
  const isGray = maxC.equal(minC)

  const d = maxC.sub(minC)

  // CRITICAL: Guard against division by zero for saturation
  // In TSL/GPU, all branches of select() are evaluated, so we must guard
  // the denominator BEFORE division to avoid Inf/NaN
  const denom1 = float(2).sub(maxC).sub(minC)
  const denom2 = maxC.add(minC)
  const lGt05 = l.greaterThan(0.5)
  const s = select(
    lGt05,
    d.div(max(denom1, float(0.0001))),
    d.div(max(denom2, float(0.0001)))
  )

  // Hue calculation based on which channel is max
  const isMaxR = maxC.equal(c.r)
  const isMaxG = maxC.equal(c.g)
  const gLtB = c.g.lessThan(c.b)

  // CRITICAL: Guard d against zero for hue calculations
  // In TSL/GPU, all branches are evaluated regardless of isGray condition,
  // so d.div() would produce Inf/NaN when d=0 (grayscale colors)
  const safeD = max(d, float(0.0001))

  // h when maxC == c.r
  const hR = c.g.sub(c.b).div(safeD).add(select(gLtB, float(6), float(0)))
  // h when maxC == c.g
  const hG = c.b.sub(c.r).div(safeD).add(2)
  // h when maxC == c.b
  const hB = c.r.sub(c.g).div(safeD).add(4)

  const h = select(isMaxR, hR, select(isMaxG, hG, hB)).div(6)

  return select(isGray, vec3(0, 0, l), vec3(h, s, l))
})

/**
 * Helper for HSL to RGB conversion
 * Exact port of WebGL hue2rgb()
 */
export const hue2rgb = Fn(([p, q, tIn]: [FloatNode, FloatNode, FloatNode]) => {
  // Normalize t to [0, 1] - using fract-like normalization
  // No toVar() needed since t is only read, not mutated
  const tNorm = select(tIn.lessThan(0), tIn.add(1), select(tIn.greaterThan(1), tIn.sub(1), tIn))

  // Piecewise linear interpolation
  // Using nested select() to compute result without intermediate vars
  const result1 = p.add(q.sub(p).mul(6).mul(tNorm))
  const result3 = p.add(q.sub(p).mul(float(0.66667).sub(tNorm)).mul(6))

  return select(
    tNorm.lessThan(0.16667),
    result1,
    select(tNorm.lessThan(0.5), q, select(tNorm.lessThan(0.66667), result3, p))
  )
})

/**
 * Convert HSL to RGB
 * Exact port of WebGL hsl2rgb()
 */
export const hsl2rgb = Fn(([hsl]: [Vec3Node]) => {
  const h = hsl.x
  const s = hsl.y
  const l = hsl.z

  // Check if grayscale (s == 0)
  const isGray = s.equal(0)

  const lLt05 = l.lessThan(0.5)
  const q = select(lLt05, l.mul(float(1).add(s)), l.add(s).sub(l.mul(s)))
  const p = l.mul(2).sub(q)

  const r = hue2rgb(p, q, h.add(0.33333))
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h.sub(0.33333))

  return select(isGray, vec3(l, l, l), vec3(r, g, b))
})

// ============================================
// Oklab Color Space (from oklab.glsl.ts)
// ============================================

/**
 * Convert linear sRGB to Oklab color space
 * Exact port of WebGL linearSrgbToOklab()
 */
export const linearSrgbToOklab = Fn(([rgb]: [Vec3Node]) => {
  // Linear sRGB to LMS
  const lVal = float(0.4122214708)
    .mul(rgb.r)
    .add(float(0.5363325363).mul(rgb.g))
    .add(float(0.0514459929).mul(rgb.b))
  const mVal = float(0.2119034982)
    .mul(rgb.r)
    .add(float(0.6806995451).mul(rgb.g))
    .add(float(0.1073969566).mul(rgb.b))
  const sVal = float(0.0883024619)
    .mul(rgb.r)
    .add(float(0.2817188376).mul(rgb.g))
    .add(float(0.6299787005).mul(rgb.b))

  // Cube root (non-linear transform)
  const l_ = pow(max(lVal, float(0)), float(0.333333333))
  const m_ = pow(max(mVal, float(0)), float(0.333333333))
  const s_ = pow(max(sVal, float(0)), float(0.333333333))

  // LMS' to Oklab
  const labL = float(0.2104542553)
    .mul(l_)
    .add(float(0.793617785).mul(m_))
    .sub(float(0.0040720468).mul(s_))
  const labA = float(1.9779984951)
    .mul(l_)
    .sub(float(2.428592205).mul(m_))
    .add(float(0.4505937099).mul(s_))
  const labB = float(0.0259040371)
    .mul(l_)
    .add(float(0.7827717662).mul(m_))
    .sub(float(0.808675766).mul(s_))

  return vec3(labL, labA, labB)
})

/**
 * Convert Oklab to linear sRGB color space
 * Exact port of WebGL oklabToLinearSrgb()
 */
export const oklabToLinearSrgb = Fn(([lab]: [Vec3Node]) => {
  const l_ = lab.x
    .add(float(0.3963377774).mul(lab.y))
    .add(float(0.2158037573).mul(lab.z))
  const m_ = lab.x
    .sub(float(0.1055613458).mul(lab.y))
    .sub(float(0.0638541728).mul(lab.z))
  const s_ = lab.x
    .sub(float(0.0894841775).mul(lab.y))
    .sub(float(1.291485548).mul(lab.z))

  // Cube
  const lVal = l_.mul(l_).mul(l_)
  const mVal = m_.mul(m_).mul(m_)
  const sVal = s_.mul(s_).mul(s_)

  // LMS to linear sRGB
  const r = float(4.0767416621)
    .mul(lVal)
    .sub(float(3.3077115913).mul(mVal))
    .add(float(0.2309699292).mul(sVal))
  const g = float(-1.2684380046)
    .mul(lVal)
    .add(float(2.6097574011).mul(mVal))
    .sub(float(0.3413193965).mul(sVal))
  const b = float(-0.0041960863)
    .mul(lVal)
    .sub(float(0.7034186147).mul(mVal))
    .add(float(1.707614701).mul(sVal))

  return vec3(r, g, b)
})

/**
 * Create LCH color from normalized hue parameter
 * Exact port of WebGL lchColor()
 */
export const lchColor = Fn(
  ([t, lightness, chroma]: [FloatNode, FloatNode, FloatNode]) => {
    const hue = t.mul(TWO_PI)
    const oklab = vec3(lightness, chroma.mul(cos(hue)), chroma.mul(sin(hue)))
    const rgb = oklabToLinearSrgb(oklab)
    return clamp(rgb, float(0), float(1))
  }
)

// ============================================
// HSL Palette Functions (from hsl.glsl.ts)
// ============================================

// Palette mode constants (match WebGL)
export const PAL_MONO = 0
export const PAL_ANALOG = 1
export const PAL_COMP = 2
export const PAL_TRIAD = 3
export const PAL_SPLIT = 4

/**
 * Get palette color based on mode
 * Exact port of WebGL getPaletteColor()
 */
export const getPaletteColor = Fn(
  ([hsl, t, mode]: [Vec3Node, FloatNode, FloatNode]) => {
    const h = hsl.x
    const s = hsl.y
    const l = hsl.z

    const minL = min(l.mul(0.15), float(0.08))
    const maxL = l.add(float(1).sub(l).mul(0.7))

    // If saturation is low and not monochromatic, boost it
    const lowSat = s.lessThan(0.1)
    const notMono = mode.notEqual(PAL_MONO)
    const needsBoost = lowSat.and(notMono)
    const boostedH = select(needsBoost, float(0), h)
    const boostedS = select(needsBoost, float(0.4), s)

    const newL = minL.add(maxL.sub(minL).mul(t))

    // Mode 0: Monochromatic
    const monoResult = hsl2rgb(vec3(h, hsl.y, newL))

    // Mode 1: Analogous
    const analogHueOffset = t.sub(0.5).mul(0.167)
    const analogH = boostedH.add(analogHueOffset)
    // TSL fract() equivalent
    const analogHFract = analogH.sub(analogH.floor())
    const analogResult = hsl2rgb(vec3(analogHFract, boostedS, newL))

    // Mode 2: Complementary
    const compIsSecondHalf = t.greaterThanEqual(0.5)
    const compH = select(compIsSecondHalf, boostedH.add(0.5), boostedH)
    const compHFract = compH.sub(compH.floor())
    const compResult = hsl2rgb(vec3(compHFract, boostedS, newL))

    // Mode 3: Triadic
    const triadT1 = t.lessThan(0.333)
    const triadT2 = t.lessThan(0.667)
    const triadH = select(
      triadT1,
      boostedH,
      select(triadT2, boostedH.add(0.333), boostedH.add(0.667))
    )
    const triadHFract = triadH.sub(triadH.floor())
    const triadResult = hsl2rgb(vec3(triadHFract, boostedS, newL))

    // Mode 4: Split-complementary
    const splitT1 = t.lessThan(0.333)
    const splitT2 = t.lessThan(0.667)
    const splitH = select(
      splitT1,
      boostedH,
      select(splitT2, boostedH.add(0.417), boostedH.add(0.583))
    )
    const splitHFract = splitH.sub(splitH.floor())
    const splitResult = hsl2rgb(vec3(splitHFract, boostedS, newL))

    // Default fallback
    const defaultResult = hsl2rgb(vec3(h, hsl.y, newL))

    // Select based on mode
    return select(
      mode.equal(PAL_MONO),
      monoResult,
      select(
        mode.equal(PAL_ANALOG),
        analogResult,
        select(
          mode.equal(PAL_COMP),
          compResult,
          select(mode.equal(PAL_TRIAD), triadResult, select(mode.equal(PAL_SPLIT), splitResult, defaultResult))
        )
      )
    )
  }
)
