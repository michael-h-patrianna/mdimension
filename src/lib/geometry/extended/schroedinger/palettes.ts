import { SchroedingerPalette } from '../types';

/**
 * Cosine gradient parameters (a, b, c, d)
 * Color = a + b * cos(2 * PI * (c * t + d))
 */
export interface CosineGradient {
    a: [number, number, number];
    b: [number, number, number];
    c: [number, number, number];
    d: [number, number, number];
}

/**
 * Palette definitions for Schrödinger visualization
 */
export const SCHROEDINGER_PALETTE_DEFINITIONS: Record<SchroedingerPalette, CosineGradient> = {
    // Standard Hue Shifters (Mapped to simple cosine)
    monochrome: {
        a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67]
    },
    complement: {
        a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.20]
    },
    triadic: {
        a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.30, 0.20, 0.20]
    },
    analogous: {
        a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.80, 0.90, 0.30]
    },
    shifted: {
        a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.50, 0.50, 0.50]
    },

    // Artistic Presets (Inigo Quilez style)
    nebula: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.33, 0.67]
    },
    sunset: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.30, 0.20, 0.20]
    },
    aurora: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 0.7, 0.4],
        d: [0.00, 0.15, 0.20]
    },
    ocean: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [2.0, 1.0, 0.0],
        d: [0.50, 0.20, 0.25]
    },
    fire: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.10, 0.20] // Needs tuning
    },
    ice: {
        a: [0.8, 0.9, 1.0],
        b: [0.2, 0.2, 0.2],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.33, 0.67]
    },
    forest: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.10, 0.20]
    },
    plasma: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.33, 0.67]
    }
};
