/**
 * Schroedinger Color Palette Utilities
 *
 * Generates colors for Schroedinger visualization based on escape time values.
 * All palettes are derived from the user's vertexColor setting to ensure
 * visual consistency with the overall theme.
 */

import type { SchroedingerConfig, SchroedingerPalette } from '../types'

// ============================================================================
// Color Constants
// ============================================================================

/** Dark end of monochrome palette (10% lightness) */
const MONOCHROME_DARK_LIGHTNESS = 10
/** Bright end of monochrome palette (95% lightness) */
const MONOCHROME_BRIGHT_LIGHTNESS = 95
/** Minimum saturation for bright color */
const MONOCHROME_MIN_SATURATION = 20
/** Saturation reduction for bright end */
const MONOCHROME_SATURATION_REDUCTION = 20
/** Darkening amount for the "shifted" palette dark base */
const SHIFTED_PALETTE_DARKEN_AMOUNT = 40
/** Darkening amount for interior color derived from base color */
const INTERIOR_COLOR_DARKEN_AMOUNT = 50

// ============================================================================
// Color Space Conversion Utilities
// ============================================================================

interface RGB {
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new Error(`Invalid hex color string: "${hex}". Expected format: #RRGGBB or RRGGBB`)
  }
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  }
}

export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)))
    const hex = clamped.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6
  } else {
    h = ((r - g) / d + 4) / 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100

  if (s === 0) {
    const gray = Math.round(l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

export function hslToHex(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb({ h, s, l }))
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex))
}

// ============================================================================
// Color Manipulation Utilities
// ============================================================================

export function interpolateRgb(color1: RGB, color2: RGB, t: number): RGB {
  const clampedT = Math.max(0, Math.min(1, t))
  return {
    r: color1.r + (color2.r - color1.r) * clampedT,
    g: color1.g + (color2.g - color1.g) * clampedT,
    b: color1.b + (color2.b - color1.b) * clampedT,
  }
}

export function interpolateColor(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  return rgbToHex(interpolateRgb(rgb1, rgb2, t))
}

export function getComplementaryColor(hex: string): string {
  const hsl = hexToHsl(hex)
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
}

export function shiftHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex)
  return hslToHex((hsl.h + degrees + 360) % 360, hsl.s, hsl.l)
}

export function darkenColor(hex: string, amount: number): string {
  const hsl = hexToHsl(hex)
  return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount))
}

export function lightenColor(hex: string, amount: number): string {
  const hsl = hexToHsl(hex)
  return hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + amount))
}

// ============================================================================
// Palette Generation
// ============================================================================

export function generatePalette(
  palette: SchroedingerPalette,
  baseColor: string,
  steps: number = 256
): string[] {
  const colors: string[] = []
  const baseHsl = hexToHsl(baseColor)

  switch (palette) {
    case 'monochrome': {
      const darkColor = hslToHex(baseHsl.h, baseHsl.s, MONOCHROME_DARK_LIGHTNESS)
      const brightColor = hslToHex(
        baseHsl.h,
        Math.max(MONOCHROME_MIN_SATURATION, baseHsl.s - MONOCHROME_SATURATION_REDUCTION),
        MONOCHROME_BRIGHT_LIGHTNESS
      )

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        if (t < 0.5) {
          colors.push(interpolateColor(darkColor, baseColor, t * 2))
        } else {
          colors.push(interpolateColor(baseColor, brightColor, (t - 0.5) * 2))
        }
      }
      break
    }

    case 'complement': {
      const complementColor = getComplementaryColor(baseColor)
      const midWhite = '#FFFFFF'

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        if (t < 0.5) {
          colors.push(interpolateColor(baseColor, midWhite, t * 2))
        } else {
          colors.push(interpolateColor(midWhite, complementColor, (t - 0.5) * 2))
        }
      }
      break
    }

    case 'triadic': {
      const color1 = baseColor
      const color2 = shiftHue(baseColor, 120)
      const color3 = shiftHue(baseColor, 240)

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        if (t < 0.33) {
          colors.push(interpolateColor(color1, color2, t * 3))
        } else if (t < 0.67) {
          colors.push(interpolateColor(color2, color3, (t - 0.33) * 3))
        } else {
          colors.push(interpolateColor(color3, color1, (t - 0.67) * 3))
        }
      }
      break
    }

    case 'analogous': {
      const colorMinus = shiftHue(baseColor, -60)
      const colorPlus = shiftHue(baseColor, 60)

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        if (t < 0.5) {
          colors.push(interpolateColor(colorMinus, baseColor, t * 2))
        } else {
          colors.push(interpolateColor(baseColor, colorPlus, (t - 0.5) * 2))
        }
      }
      break
    }

    case 'shifted': {
      const shiftedColor = shiftHue(baseColor, 90)
      const darkBase = darkenColor(baseColor, SHIFTED_PALETTE_DARKEN_AMOUNT)

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        if (t < 0.3) {
          colors.push(interpolateColor(darkBase, baseColor, t / 0.3))
        } else {
          colors.push(interpolateColor(baseColor, shiftedColor, (t - 0.3) / 0.7))
        }
      }
      break
    }

    default: {
      return generatePalette('monochrome', baseColor, steps)
    }
  }

  return colors
}

export function mapEscapeToColor(
  normalizedValue: number,
  palette: string[],
  cycles: number = 1,
  invertColors: boolean = false,
  interiorColor: string = '#000000'
): string {
  if (normalizedValue >= 1.0) {
    return interiorColor
  }

  if (palette.length === 0) {
    return interiorColor
  }

  let value = invertColors ? 1 - normalizedValue : normalizedValue
  value = (value * cycles) % 1

  const index = Math.min(Math.floor(value * palette.length), palette.length - 1)

  return palette[index] ?? interiorColor
}

export function generatePointColors(
  normalizedEscapeValues: number[],
  config: SchroedingerConfig,
  baseColor: string
): string[] {
  const { palette: paletteType, invertColors, interiorColor, paletteCycles } = config

  const palette = generatePalette(paletteType, baseColor, 256)

  const effectiveInteriorColor =
    interiorColor === '#000000' ? darkenColor(baseColor, INTERIOR_COLOR_DARKEN_AMOUNT) : interiorColor

  return normalizedEscapeValues.map((value) =>
    mapEscapeToColor(value, palette, paletteCycles, invertColors, effectiveInteriorColor)
  )
}
