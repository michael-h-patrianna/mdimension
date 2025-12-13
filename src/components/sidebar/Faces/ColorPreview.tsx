/**
 * Color Preview Component
 *
 * Canvas-based preview showing the current color gradient.
 * Updates in real-time as palette settings change.
 */

import { getCosinePaletteColorTS } from '@/lib/shaders/palette';
import { useVisualStore } from '@/stores/visualStore';
import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface ColorPreviewProps {
  className?: string;
  width?: number;
  height?: number;
}

export const ColorPreview: React.FC<ColorPreviewProps> = ({
  className = '',
  width = 200,
  height = 24,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { colorAlgorithm, cosineCoefficients, distribution, lchLightness, lchChroma, faceColor } =
    useVisualStore(
      useShallow((state) => ({
        colorAlgorithm: state.colorAlgorithm,
        cosineCoefficients: state.cosineCoefficients,
        distribution: state.distribution,
        lchLightness: state.lchLightness,
        lchChroma: state.lchChroma,
        faceColor: state.faceColor,
      }))
    );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Helper: Convert hex color to HSL
    const hexToHsl = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return [0, 0, 0.5];
      const r = parseInt(result[1]!, 16) / 255;
      const g = parseInt(result[2]!, 16) / 255;
      const b = parseInt(result[3]!, 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) return [0, 0, l];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = 0;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return [h, s, l];
    };

    // Helper: Convert HSL to RGB
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h * 6) % 2 - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 1/6) { r = c; g = x; }
      else if (h < 2/6) { r = x; g = c; }
      else if (h < 3/6) { g = c; b = x; }
      else if (h < 4/6) { g = x; b = c; }
      else if (h < 5/6) { r = x; b = c; }
      else { r = c; b = x; }
      return [r + m, g + m, b + m];
    };

    // Draw gradient preview based on algorithm
    for (let x = 0; x < canvas.width; x++) {
      const t = x / canvas.width;
      let r: number, g: number, b: number;

      if (colorAlgorithm === 'monochromatic') {
        // Monochromatic: Same hue, varying lightness
        const [hue, sat] = hexToHsl(faceColor);
        const litVar = 0.3 + t * 0.4; // Vary lightness from 0.3 to 0.7
        [r, g, b] = hslToRgb(hue, sat, litVar);
      } else if (colorAlgorithm === 'analogous') {
        // Analogous: Hue varies ±30° from base
        const [baseHue, sat, lit] = hexToHsl(faceColor);
        const hueOffset = (t - 0.5) * 0.167; // ±30° = ±0.0833, doubled for full range
        const hue = (baseHue + hueOffset + 1) % 1;
        [r, g, b] = hslToRgb(hue, sat, lit);
      } else if (colorAlgorithm === 'lch') {
        // LCH preview
        const hue = t * 6.28318;
        // Simplified Oklab to RGB approximation for preview
        r = lchLightness + lchChroma * Math.cos(hue);
        g = lchLightness + lchChroma * Math.cos(hue - 2.094);
        b = lchLightness + lchChroma * Math.cos(hue + 2.094);
      } else {
        // Cosine palette (works for cosine, normal, distance, multiSource)
        const color = getCosinePaletteColorTS(
          t,
          cosineCoefficients.a,
          cosineCoefficients.b,
          cosineCoefficients.c,
          cosineCoefficients.d,
          distribution.power,
          distribution.cycles,
          distribution.offset
        );
        r = color.r;
        g = color.g;
        b = color.b;
      }

      // Clamp and convert to 8-bit
      const r8 = Math.round(Math.max(0, Math.min(1, r)) * 255);
      const g8 = Math.round(Math.max(0, Math.min(1, g)) * 255);
      const b8 = Math.round(Math.max(0, Math.min(1, b)) * 255);

      ctx.fillStyle = `rgb(${r8}, ${g8}, ${b8})`;
      ctx.fillRect(x, 0, 1, canvas.height);
    }
  }, [colorAlgorithm, cosineCoefficients, distribution, lchLightness, lchChroma, faceColor]);

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-text-secondary mb-2">
        Preview
      </label>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full rounded border border-panel-border"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
