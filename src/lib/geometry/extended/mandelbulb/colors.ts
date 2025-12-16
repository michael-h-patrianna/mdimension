/**
 * Mandelbulb Color Palette Utilities
 *
 * Generates colors for Mandelbulb visualization based on escape time values.
 * All palettes are derived from the user's vertexColor setting to ensure
 * visual consistency with the overall theme.
 *
 * @see docs/research/nd-mandelbulb-threejs-guide.md
 */

import type { MandelbulbConfig, MandelbulbPalette } from '../types';

// ============================================================================
// Color Constants
// ============================================================================

/** Dark end of monochrome palette (10% lightness) */
const MONOCHROME_DARK_LIGHTNESS = 10;
/** Bright end of monochrome palette (95% lightness) */
const MONOCHROME_BRIGHT_LIGHTNESS = 95;
/** Minimum saturation for bright color (prevents washed out appearance) */
const MONOCHROME_MIN_SATURATION = 20;
/** Saturation reduction for bright end of monochrome palette */
const MONOCHROME_SATURATION_REDUCTION = 20;
/** Darkening amount for the "shifted" palette dark base */
const SHIFTED_PALETTE_DARKEN_AMOUNT = 40;
/** Darkening amount for interior color derived from base color */
const INTERIOR_COLOR_DARKEN_AMOUNT = 50;

// ============================================================================
// Color Space Conversion Utilities
// ============================================================================

/**
 * RGB color components (0-255)
 */
interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL color components
 * h: 0-360, s: 0-100, l: 0-100
 */
interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Parse hex color string to RGB components.
 *
 * @param hex - Hex color string (with or without # prefix)
 * @returns RGB object with r, g, b components (0-255)
 * @throws Error if hex string is invalid
 *
 * @example
 * hexToRgb('#ff0000') // { r: 255, g: 0, b: 0 }
 * hexToRgb('00ff00')  // { r: 0, g: 255, b: 0 }
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color string: "${hex}". Expected format: #RRGGBB or RRGGBB`);
  }
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Convert HSL values directly to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb({ h, s, l }));
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

// ============================================================================
// Color Manipulation Utilities
// ============================================================================

/**
 * Interpolate between two RGB colors
 */
export function interpolateRgb(color1: RGB, color2: RGB, t: number): RGB {
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    r: color1.r + (color2.r - color1.r) * clampedT,
    g: color1.g + (color2.g - color1.g) * clampedT,
    b: color1.b + (color2.b - color1.b) * clampedT,
  };
}

/**
 * Interpolate between two hex colors
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  return rgbToHex(interpolateRgb(rgb1, rgb2, t));
}

/**
 * Get complementary color (180° hue shift)
 */
export function getComplementaryColor(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

/**
 * Shift hue by specified degrees
 */
export function shiftHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex((hsl.h + degrees + 360) % 360, hsl.s, hsl.l);
}

/**
 * Darken a color by reducing lightness
 */
export function darkenColor(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount));
}

/**
 * Lighten a color by increasing lightness
 */
export function lightenColor(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + amount));
}

// ============================================================================
// Palette Generation
// ============================================================================

/**
 * Generate a color palette derived from the base vertex color.
 *
 * All palette types use the baseColor as their foundation, ensuring
 * visual consistency when the user changes their color theme.
 *
 * @param palette - Palette type
 * @param baseColor - User's vertex color from visualStore
 * @param steps - Number of color steps (typically 256)
 * @returns Array of hex color strings
 */
export function generatePalette(
  palette: MandelbulbPalette,
  baseColor: string,
  steps: number = 256
): string[] {
  const colors: string[] = [];
  const baseHsl = hexToHsl(baseColor);

  switch (palette) {
    case 'monochrome': {
      // Dark → baseColor → White (shades of the selected hue)
      const darkColor = hslToHex(baseHsl.h, baseHsl.s, MONOCHROME_DARK_LIGHTNESS);
      const brightColor = hslToHex(
        baseHsl.h,
        Math.max(MONOCHROME_MIN_SATURATION, baseHsl.s - MONOCHROME_SATURATION_REDUCTION),
        MONOCHROME_BRIGHT_LIGHTNESS
      );

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        if (t < 0.5) {
          // Dark to base color
          colors.push(interpolateColor(darkColor, baseColor, t * 2));
        } else {
          // Base color to bright
          colors.push(interpolateColor(baseColor, brightColor, (t - 0.5) * 2));
        }
      }
      break;
    }

    case 'complement': {
      // baseColor → White → complementary color
      const complementColor = getComplementaryColor(baseColor);
      const midWhite = '#FFFFFF';

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        if (t < 0.5) {
          colors.push(interpolateColor(baseColor, midWhite, t * 2));
        } else {
          colors.push(interpolateColor(midWhite, complementColor, (t - 0.5) * 2));
        }
      }
      break;
    }

    case 'triadic': {
      // Uses baseColor in a triadic color scheme (120° shifts)
      const color1 = baseColor;
      const color2 = shiftHue(baseColor, 120);
      const color3 = shiftHue(baseColor, 240);

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        if (t < 0.33) {
          colors.push(interpolateColor(color1, color2, t * 3));
        } else if (t < 0.67) {
          colors.push(interpolateColor(color2, color3, (t - 0.33) * 3));
        } else {
          colors.push(interpolateColor(color3, color1, (t - 0.67) * 3));
        }
      }
      break;
    }

    case 'analogous': {
      // baseColor with ±60° hue variations
      const colorMinus = shiftHue(baseColor, -60);
      const colorPlus = shiftHue(baseColor, 60);

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        if (t < 0.5) {
          colors.push(interpolateColor(colorMinus, baseColor, t * 2));
        } else {
          colors.push(interpolateColor(baseColor, colorPlus, (t - 0.5) * 2));
        }
      }
      break;
    }

    case 'shifted': {
      // baseColor → hue-shifted version (90° shift for variety)
      const shiftedColor = shiftHue(baseColor, 90);
      const darkBase = darkenColor(baseColor, SHIFTED_PALETTE_DARKEN_AMOUNT);

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        if (t < 0.3) {
          colors.push(interpolateColor(darkBase, baseColor, t / 0.3));
        } else {
          colors.push(interpolateColor(baseColor, shiftedColor, (t - 0.3) / 0.7));
        }
      }
      break;
    }

    default: {
      // Default to monochrome if unknown palette
      return generatePalette('monochrome', baseColor, steps);
    }
  }

  return colors;
}

/**
 * Map a normalized escape value to a color from the palette.
 *
 * @param normalizedValue - Value in [0, 1] range (0=escaped immediately, 1=bounded)
 * @param palette - Pre-generated palette array
 * @param cycles - Number of palette cycles (creates banding effect)
 * @param invertColors - Whether to invert the mapping
 * @param interiorColor - Color for interior points (normalizedValue = 1)
 * @returns Hex color string
 */
export function mapEscapeToColor(
  normalizedValue: number,
  palette: string[],
  cycles: number = 1,
  invertColors: boolean = false,
  interiorColor: string = '#000000'
): string {
  // Interior points (bounded) get the interior color
  if (normalizedValue >= 1.0) {
    return interiorColor;
  }

  // Handle empty palette case
  if (palette.length === 0) {
    return interiorColor;
  }

  // Apply inversion if requested
  let value = invertColors ? 1 - normalizedValue : normalizedValue;

  // Apply cycles (wrap around the palette multiple times)
  value = (value * cycles) % 1;

  // Map to palette index
  const index = Math.min(
    Math.floor(value * palette.length),
    palette.length - 1
  );

  return palette[index] ?? interiorColor;
}

/**
 * Generate colors for all points from normalized escape values.
 *
 * This is the main entry point for coloring Mandelbulb point clouds.
 *
 * @param normalizedEscapeValues - Array of values in [0, 1]
 * @param config - Mandelbulb configuration with color settings
 * @param baseColor - User's vertex color from visualStore
 * @returns Array of hex color strings matching input length
 */
export function generatePointColors(
  normalizedEscapeValues: number[],
  config: MandelbulbConfig,
  baseColor: string
): string[] {
  const {
    palette: paletteType,
    invertColors,
    interiorColor,
    paletteCycles,
  } = config;

  // Generate the color palette from the base color
  const palette = generatePalette(paletteType, baseColor, 256);

  // Derive interior color from base color (very dark version)
  const effectiveInteriorColor = interiorColor === '#000000'
    ? darkenColor(baseColor, INTERIOR_COLOR_DARKEN_AMOUNT)
    : interiorColor;

  // Map each escape value to a color
  return normalizedEscapeValues.map(value =>
    mapEscapeToColor(value, palette, paletteCycles, invertColors, effectiveInteriorColor)
  );
}
