/**
 * Constants for PointCloud shaders
 *
 * Shared constants used across vertex and fragment shaders for N-dimensional
 * point cloud rendering.
 */

// Re-export shared shader constants for convenience
export {
  PERSPECTIVE_POINT_SCALE,
  SHADER_EPSILON,
  MIN_DISTANCE_ATTENUATION,
  FRESNEL_POWER,
  RIM_BASE_FACTOR,
  RIM_NDOTL_FACTOR,
} from '@/lib/shaders/constants'

/**
 * Maximum number of extra dimensions beyond XYZ + W.
 * Supports up to 11D (3 base + 1 W + 7 extra = 11).
 */
export const MAX_EXTRA_DIMS = 7
