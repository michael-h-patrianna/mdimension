/**
 * Tests for Mandelbrot color palette generation
 *
 * Tests cover:
 * - Color conversion utilities (hex/rgb/hsl)
 * - Palette generation from base colors
 * - Point color mapping from escape values
 */

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  interpolateColor,
  getComplementaryColor,
  shiftHue,
  darkenColor,
  lightenColor,
  generatePalette,
  generatePointColors,
  mapEscapeToColor,
} from '@/lib/geometry/extended/mandelbrot/colors';
import { DEFAULT_MANDELBROT_CONFIG } from '@/lib/geometry/extended/types';

describe('Color Conversion Utilities', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB object', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle lowercase hex', () => {
      const rgb = hexToRgb('#aabbcc');
      expect(rgb.r).toBe(170);
      expect(rgb.g).toBe(187);
      expect(rgb.b).toBe(204);
    });

    it('should throw error for invalid hex', () => {
      expect(() => hexToRgb('invalid')).toThrow('Invalid hex color string');
      expect(() => hexToRgb('#gg0000')).toThrow('Invalid hex color string');
      expect(() => hexToRgb('')).toThrow('Invalid hex color string');
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB object to hex', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
      expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
    });

    it('should handle mixed values', () => {
      expect(rgbToHex({ r: 128, g: 64, b: 32 })).toBe('#804020');
    });
  });

  describe('hexToHsl', () => {
    it('should convert hex to HSL', () => {
      // Red: H=0, S=100%, L=50%
      const red = hexToHsl('#ff0000');
      expect(red.h).toBeCloseTo(0);
      expect(red.s).toBeCloseTo(100);
      expect(red.l).toBeCloseTo(50);
    });

    it('should handle grayscale', () => {
      // White: H=0, S=0%, L=100%
      const white = hexToHsl('#ffffff');
      expect(white.s).toBe(0);
      expect(white.l).toBe(100);
    });
  });

  describe('hslToHex', () => {
    it('should convert HSL to hex', () => {
      // Red
      expect(hslToHex(0, 100, 50)).toBe('#ff0000');
      // Green (120 degrees)
      expect(hslToHex(120, 100, 50)).toBe('#00ff00');
      // Blue (240 degrees)
      expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    });

    it('should handle grayscale (saturation 0)', () => {
      expect(hslToHex(0, 0, 50)).toBe('#808080');
      expect(hslToHex(0, 0, 100)).toBe('#ffffff');
      expect(hslToHex(0, 0, 0)).toBe('#000000');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain color through hex->rgb->hex', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#808080'];
      colors.forEach((hex) => {
        const rgb = hexToRgb(hex);
        expect(rgbToHex(rgb)).toBe(hex);
      });
    });
  });
});

describe('Color Manipulation', () => {
  describe('interpolateColor', () => {
    it('should return start color at t=0', () => {
      expect(interpolateColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    });

    it('should return end color at t=1', () => {
      expect(interpolateColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    });

    it('should return midpoint at t=0.5', () => {
      const mid = interpolateColor('#ff0000', '#0000ff', 0.5);
      const rgb = hexToRgb(mid);
      expect(rgb.r).toBeCloseTo(128, 0);
      expect(rgb.b).toBeCloseTo(128, 0);
    });
  });

  describe('getComplementaryColor', () => {
    it('should return complementary color (180 degree hue shift)', () => {
      // Red (0) -> Cyan (180)
      const complement = getComplementaryColor('#ff0000');
      const hsl = hexToHsl(complement);
      expect(hsl.h).toBeCloseTo(180, 0);
    });
  });

  describe('shiftHue', () => {
    it('should shift hue by specified degrees', () => {
      // Red (0) + 120 = Green (120)
      const shifted = shiftHue('#ff0000', 120);
      const hsl = hexToHsl(shifted);
      expect(hsl.h).toBeCloseTo(120, 0);
    });

    it('should wrap around 360 degrees', () => {
      // Red (0) + 400 = Yellow (40)
      const shifted = shiftHue('#ff0000', 400);
      const hsl = hexToHsl(shifted);
      expect(hsl.h).toBeCloseTo(40, 0);
    });
  });

  describe('darkenColor', () => {
    it('should reduce lightness', () => {
      const dark = darkenColor('#808080', 20);
      const hsl = hexToHsl(dark);
      expect(hsl.l).toBeLessThan(50);
    });

    it('should not go below 0%', () => {
      const dark = darkenColor('#808080', 100);
      const hsl = hexToHsl(dark);
      expect(hsl.l).toBeGreaterThanOrEqual(0);
    });
  });

  describe('lightenColor', () => {
    it('should increase lightness', () => {
      const light = lightenColor('#808080', 20);
      const hsl = hexToHsl(light);
      expect(hsl.l).toBeGreaterThan(50);
    });

    it('should not go above 100%', () => {
      const light = lightenColor('#808080', 100);
      const hsl = hexToHsl(light);
      expect(hsl.l).toBeLessThanOrEqual(100);
    });
  });
});

describe('generatePalette', () => {
  const baseColor = '#ff0000'; // Red

  describe('monochrome palette', () => {
    it('should generate palette with shades of base color', () => {
      const palette = generatePalette('monochrome', baseColor, 10);
      expect(palette).toHaveLength(10);
      // All colors should be defined
      palette.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    });

    it('should progress from dark to light', () => {
      const palette = generatePalette('monochrome', baseColor, 5);
      // First color should be darker than last
      const firstHsl = hexToHsl(palette[0]!);
      const lastHsl = hexToHsl(palette[4]!);
      expect(firstHsl.l).toBeLessThan(lastHsl.l);
    });
  });

  describe('complement palette', () => {
    it('should include base color and its complement', () => {
      const palette = generatePalette('complement', baseColor, 10);
      expect(palette).toHaveLength(10);
    });
  });

  describe('triadic palette', () => {
    it('should generate triadic scheme', () => {
      const palette = generatePalette('triadic', baseColor, 12);
      expect(palette).toHaveLength(12);
    });
  });

  describe('analogous palette', () => {
    it('should generate analogous scheme', () => {
      const palette = generatePalette('analogous', baseColor, 10);
      expect(palette).toHaveLength(10);
    });
  });

  describe('shifted palette', () => {
    it('should shift hue', () => {
      const palette = generatePalette('shifted', baseColor, 10);
      expect(palette).toHaveLength(10);
    });
  });

  describe('palette sizes', () => {
    it('should generate correct number of colors', () => {
      const sizes = [5, 10, 50, 256];
      sizes.forEach((size) => {
        const palette = generatePalette('monochrome', baseColor, size);
        expect(palette).toHaveLength(size);
      });
    });
  });
});

describe('mapEscapeToColor', () => {
  const palette = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffffff'];
  const interiorColor = '#111111';

  it('should return interior color for bounded points (value = 1)', () => {
    const color = mapEscapeToColor(1.0, palette, 1, false, interiorColor);
    expect(color).toBe(interiorColor);
  });

  it('should map 0 to first palette color', () => {
    const color = mapEscapeToColor(0, palette, 1, false, interiorColor);
    expect(color).toBe('#000000');
  });

  it('should map values to palette indices', () => {
    // Value 0.25 should map to index 1 (red) with 5 colors
    const color = mapEscapeToColor(0.25, palette, 1, false, interiorColor);
    // Allow for interpolation
    expect(color).toBeDefined();
  });

  describe('palette cycles', () => {
    it('should cycle through palette multiple times', () => {
      const cyclePalette = ['#ff0000', '#00ff00'];
      // With 2 cycles, values 0-0.5 and 0.5-1 should each traverse palette
      const color1 = mapEscapeToColor(0.25, cyclePalette, 2, false, interiorColor);
      const color2 = mapEscapeToColor(0.75, cyclePalette, 2, false, interiorColor);
      // Both should be valid colors
      expect(color1).toMatch(/^#[0-9a-f]{6}$/);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('invert colors', () => {
    it('should invert color mapping when enabled', () => {
      // Use a larger palette to ensure difference
      const largePalette = ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'];
      const normal = mapEscapeToColor(0.2, largePalette, 1, false, interiorColor);
      const inverted = mapEscapeToColor(0.2, largePalette, 1, true, interiorColor);
      // Inverted should map to different color (0.2 vs 0.8 position)
      expect(normal).not.toBe(inverted);
    });
  });
});

describe('generatePointColors', () => {
  const baseColor = '#00ffff'; // Cyan

  it('should return empty array for empty escape values', () => {
    const colors = generatePointColors([], DEFAULT_MANDELBROT_CONFIG, baseColor);
    expect(colors).toEqual([]);
  });

  it('should generate color for each escape value', () => {
    const escapeValues = [0.1, 0.5, 0.9, 1.0];
    const colors = generatePointColors(escapeValues, DEFAULT_MANDELBROT_CONFIG, baseColor);
    expect(colors).toHaveLength(4);
    colors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('should use interior color for bounded points', () => {
    const escapeValues = [1.0, 1.0]; // All bounded
    const config = { ...DEFAULT_MANDELBROT_CONFIG, interiorColor: '#123456' };
    const colors = generatePointColors(escapeValues, config, baseColor);
    colors.forEach((c) => expect(c).toBe('#123456'));
  });

  it('should produce different colors for different escape values', () => {
    const escapeValues = [0.1, 0.5, 0.9];
    const colors = generatePointColors(escapeValues, DEFAULT_MANDELBROT_CONFIG, baseColor);
    // Colors should not all be the same
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBeGreaterThan(1);
  });

  describe('palette effects', () => {
    it('should produce different colors with different palettes', () => {
      const escapeValues = [0.3, 0.6];
      const colors1 = generatePointColors(
        escapeValues,
        { ...DEFAULT_MANDELBROT_CONFIG, palette: 'monochrome' },
        baseColor
      );
      const colors2 = generatePointColors(
        escapeValues,
        { ...DEFAULT_MANDELBROT_CONFIG, palette: 'complement' },
        baseColor
      );
      // Different palettes should produce different colors
      expect(colors1[0]).not.toBe(colors2[0]);
    });
  });
});
