/**
 * Dimension Mixing Animation
 *
 * Provides time-varying shear/mixing matrices for intra-iteration dimension coupling.
 * When applied inside the fractal iteration loop, this makes "which dimension is which"
 * matter dynamically, causing rotation to produce morphing instead of just turning.
 *
 * The mixing matrix M has:
 * - Diagonal elements = 1 (preserve magnitude)
 * - Off-diagonal elements = sin(time * frequency + phase_ij) * intensity
 *
 * Phase offsets use golden-ratio spacing for non-repeating patterns.
 *
 * @see docs/prd/fractal-morphing-animation.md
 */

import { GOLDEN_RATIO } from './biasCalculation'

/**
 * Configuration for dimension mixing animation
 */
export interface DimensionMixConfig {
  /** Enable/disable dimension mixing */
  enabled: boolean
  /** Strength of off-diagonal mixing (0.0 to 0.3) */
  intensity: number
  /** How fast the mixing matrix evolves (0.1 to 2.0) */
  frequency: number
}

/**
 * Default dimension mix configuration
 */
export const DEFAULT_DIMENSION_MIX_CONFIG: DimensionMixConfig = {
  enabled: false,
  intensity: 0.1,
  frequency: 0.5,
}

/**
 * Phase offset to ensure element [0,1] doesn't start at sin(0) = 0
 */
const PHASE_OFFSET = Math.PI / 4

/**
 * Computes a time-varying mixing matrix for the given dimension.
 * Returns a flat array representing the matrix in row-major order.
 *
 * For a D-dimensional space, the matrix is DxD with:
 * - M[i][i] = 1.0 (diagonal)
 * - M[i][j] = intensity * sin(time * frequency + phase_ij) for i != j
 *
 * Note: This creates a symmetric matrix (M[i][j] = M[j][i]) to preserve
 * volume (approximately) and avoid degenerate transformations.
 *
 * @param dimension - Space dimension (3-11)
 * @param time - Animation time in seconds
 * @param config - Mixing configuration
 * @param animationSpeed - Global animation speed multiplier
 * @param animationBias - Controls phase spread between pairs (0-1)
 * @returns Flat array of matrix elements (row-major, length = dimension^2)
 */
export function computeMixingMatrix(
  dimension: number,
  time: number,
  config: DimensionMixConfig,
  animationSpeed: number = 1.0,
  animationBias: number = 0.5
): number[] {
  const size = dimension * dimension
  const matrix = new Array(size).fill(0)

  if (!config.enabled) {
    // Return identity matrix
    for (let i = 0; i < dimension; i++) {
      matrix[i * dimension + i] = 1.0
    }
    return matrix
  }

  const effectiveFrequency = config.frequency * animationSpeed * 2 * Math.PI

  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < dimension; j++) {
      const idx = i * dimension + j

      if (i === j) {
        // Diagonal: keep as 1.0
        matrix[idx] = 1.0
      } else if (i < j) {
        // Upper triangle: compute mixing value
        // Use unique phase for each pair based on golden ratio
        const pairIndex = i * dimension + j
        const phase = PHASE_OFFSET + pairIndex * GOLDEN_RATIO * animationBias
        const mixValue = config.intensity * Math.sin(time * effectiveFrequency + phase)
        matrix[idx] = mixValue
        // Mirror to lower triangle for symmetry
        matrix[j * dimension + i] = mixValue
      }
      // Lower triangle is filled by the symmetry condition above
    }
  }

  return matrix
}

// Note: Pre-allocated matrices could be created if needed for further optimization
// Currently the in-place function accepts a pre-allocated output buffer from the caller

/**
 * Computes mixing matrix into a pre-allocated Float32Array.
 * Use this in animation loops to avoid per-frame allocations.
 *
 * @param output - Pre-allocated Float32Array (length >= dimension^2)
 * @param dimension - Space dimension (3-11)
 * @param time - Animation time in seconds
 * @param config - Mixing configuration
 * @param animationSpeed - Global animation speed multiplier
 * @param animationBias - Controls phase spread between pairs (0-1)
 */
export function computeMixingMatrixInPlace(
  output: Float32Array,
  dimension: number,
  time: number,
  config: DimensionMixConfig,
  animationSpeed: number = 1.0,
  animationBias: number = 0.5
): void {
  const size = dimension * dimension

  if (!config.enabled) {
    // Identity matrix
    output.fill(0, 0, size)
    for (let i = 0; i < dimension; i++) {
      output[i * dimension + i] = 1.0
    }
    return
  }

  const effectiveFrequency = config.frequency * animationSpeed * 2 * Math.PI

  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < dimension; j++) {
      const idx = i * dimension + j

      if (i === j) {
        output[idx] = 1.0
      } else if (i < j) {
        const pairIndex = i * dimension + j
        const phase = PHASE_OFFSET + pairIndex * GOLDEN_RATIO * animationBias
        const mixValue = config.intensity * Math.sin(time * effectiveFrequency + phase)
        output[idx] = mixValue
        output[j * dimension + i] = mixValue
      }
    }
  }
}

/**
 * Extracts the 3D mixing matrix from a higher-dimensional matrix.
 * Used for passing to shaders that operate in the visible 3D subspace.
 *
 * @param fullMatrix - Full mixing matrix (dimension^2 elements)
 * @param dimension - Original dimension
 * @returns 3x3 matrix as flat array (9 elements)
 */
export function extract3DMatrix(fullMatrix: number[] | Float32Array, dimension: number): number[] {
  const result = new Array(9)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const value = fullMatrix[i * dimension + j]
      result[i * 3 + j] = value !== undefined ? value : (i === j ? 1 : 0)
    }
  }
  return result
}

/**
 * Computes the maximum singular value of the mixing matrix (approximately).
 * Used to monitor stability - values > 1.5 may cause numerical issues.
 *
 * This is a cheap approximation using the Frobenius norm.
 *
 * @param matrix - Mixing matrix as flat array
 * @param dimension - Matrix dimension
 * @returns Approximate maximum singular value
 */
export function estimateMatrixScale(matrix: number[] | Float32Array, dimension: number): number {
  let sumSquares = 0
  const size = dimension * dimension
  for (let i = 0; i < size; i++) {
    const value = matrix[i] ?? 0
    sumSquares += value * value
  }
  // Frobenius norm / sqrt(dimension) approximates max singular value
  return Math.sqrt(sumSquares / dimension)
}

/**
 * Generates GLSL code for the dimension mixing function.
 * Used for shader generation to ensure consistency.
 *
 * @param _maxDimension - Maximum dimension to support (typically 11, reserved for future use)
 * @returns GLSL function code as string
 */
export function generateGLSLMixingFunction(_maxDimension: number = 11): string {
  return `
// Dimension mixing: applies time-varying shear to create morphing during rotation
// uMixIntensity: strength of mixing (0.0-0.3)
// uMixTime: animated time value for mixing
// uDimensionMixEnabled: toggle on/off

vec3 applyDimensionMix3D(vec3 z, float mixTime, float intensity) {
    if (intensity < 0.001) return z;

    float phi = 1.618033988749895; // golden ratio
    float phaseOffset = 0.7853981633974483; // PI/4

    // Off-diagonal mixing values with golden-ratio phase spread
    float s01 = sin(mixTime + phaseOffset + 0.0 * phi) * intensity;
    float s02 = sin(mixTime + phaseOffset + 1.0 * phi) * intensity;
    float s12 = sin(mixTime + phaseOffset + 2.0 * phi) * intensity;

    // Apply symmetric mixing matrix
    return vec3(
        z.x + s01 * z.y + s02 * z.z,
        s01 * z.x + z.y + s12 * z.z,
        s02 * z.x + s12 * z.y + z.z
    );
}

vec4 applyDimensionMix4D(vec4 z, float mixTime, float intensity) {
    if (intensity < 0.001) return z;

    float phi = 1.618033988749895;
    float phaseOffset = 0.7853981633974483;

    float s01 = sin(mixTime + phaseOffset + 0.0 * phi) * intensity;
    float s02 = sin(mixTime + phaseOffset + 1.0 * phi) * intensity;
    float s03 = sin(mixTime + phaseOffset + 2.0 * phi) * intensity;
    float s12 = sin(mixTime + phaseOffset + 3.0 * phi) * intensity;
    float s13 = sin(mixTime + phaseOffset + 4.0 * phi) * intensity;
    float s23 = sin(mixTime + phaseOffset + 5.0 * phi) * intensity;

    return vec4(
        z.x + s01*z.y + s02*z.z + s03*z.w,
        s01*z.x + z.y + s12*z.z + s13*z.w,
        s02*z.x + s12*z.y + z.z + s23*z.w,
        s03*z.x + s13*z.y + s23*z.z + z.w
    );
}
`
}
