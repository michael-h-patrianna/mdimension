/**
 * Constants for PointCloud shaders
 *
 * Shared constants used across vertex and fragment shaders for N-dimensional
 * point cloud rendering.
 */

/**
 * Maximum number of extra dimensions beyond XYZ + W.
 * Supports up to 11D (3 base + 1 W + 7 extra = 11).
 */
export const MAX_EXTRA_DIMS = 7
