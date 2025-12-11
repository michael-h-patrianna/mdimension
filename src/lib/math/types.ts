/**
 * Type definitions for n-dimensional geometry library
 */

/**
 * N-dimensional vector represented as an array of numbers
 */
export type VectorND = number[];

/**
 * N-dimensional matrix represented as a 2D array
 */
export type MatrixND = number[][];

/**
 * 3D vector with fixed dimensions [x, y, z]
 */
export type Vector3D = [number, number, number];

/**
 * Rotation plane defined by two axis indices
 */
export interface RotationPlane {
  indices: [number, number];
  name: string;
}

/**
 * Error epsilon for floating point comparisons
 */
export const EPSILON = 1e-10;
