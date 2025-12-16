/**
 * Geometry Helper Functions
 *
 * Utility functions for working with geometry types.
 */

import type { ObjectType } from './types';

/**
 * Raymarching fractal object types that support opacity and shadow settings.
 */
export const RAYMARCHING_FRACTAL_TYPES: readonly ObjectType[] = [
  'mandelbrot',
  'quaternion-julia',
] as const;

/**
 * Check if an object type is a raymarching fractal that supports
 * opacity modes and shadow settings.
 *
 * @param objectType - The object type to check
 * @returns True if the object type supports opacity/shadow settings
 */
export function isRaymarchingFractal(objectType: string): boolean {
  return (
    objectType === 'mandelbrot' ||
    objectType === 'quaternion-julia'
  );
}
