/**
 * Configuration constants for Wythoff polytope generation.
 *
 * All tunable parameters are centralized here for easy adjustment
 * and to avoid magic numbers scattered through the codebase.
 */

/**
 * Wythoff polytope generation configuration
 */
export const WYTHOFF_CONFIG = {
  /**
   * Tolerance for vertex coordinate comparison.
   * Coordinates within this tolerance are considered equal.
   */
  VERTEX_TOLERANCE: 1e-6,

  /**
   * Tolerance for edge distance matching.
   * Edges are created between vertices whose distance is within
   * minDistance * (1 + EDGE_TOLERANCE).
   */
  EDGE_TOLERANCE: 0.01,

  /**
   * Maximum number of faces to generate before early termination.
   * Prevents memory exhaustion for complex polytopes.
   */
  MAX_FACES: 50_000,

  /**
   * Sample size for estimating minimum vertex distance.
   * Used when building spatial hash for edge detection.
   */
  MIN_DISTANCE_SAMPLE_SIZE: 200,

  /**
   * Multiplier for spatial hash cell size.
   * Cell size = estimated min distance * CELL_SIZE_MULTIPLIER.
   * Should be slightly larger than 1 to ensure adjacent cells contain
   * all minimum-distance vertex pairs.
   */
  CELL_SIZE_MULTIPLIER: 1.5,

  /**
   * Minimum cell size to prevent division by zero.
   * Used when estimated min distance is extremely small.
   */
  MIN_CELL_SIZE: 1e-9,

  /**
   * Maximum number of polytopes to keep in memory cache.
   * Older entries are evicted using FIFO policy.
   */
  MAX_CACHE_SIZE: 20,

  /**
   * Maximum vertices by dimension (default limits).
   * These limits prevent excessive computation time.
   */
  MAX_VERTICES: {
    3: 500,
    4: 2000,
    5: 5000,
    6: 10_000,
    7: 15_000,
    8: 20_000,
    9: 25_000,
    10: 30_000,
    11: 40_000,
  } as Record<number, number>,

  /**
   * Maximum vertices for omnitruncated preset.
   * Omnitruncated polytopes have many more vertices, so we use
   * stricter limits to keep edge generation (O(V*k)) fast.
   */
  MAX_VERTICES_OMNITRUNCATED: {
    3: 500,
    4: 1500,
    5: 2500,
    6: 3500,
    7: 4000,
    8: 4500,
    9: 5000,
    10: 5000,
    11: 5000,
  } as Record<number, number>,

  /**
   * Default max vertices for unknown dimensions.
   */
  DEFAULT_MAX_VERTICES: 10_000,

  /**
   * Default max vertices for omnitruncated at unknown dimensions.
   */
  DEFAULT_MAX_VERTICES_OMNITRUNCATED: 5000,
} as const

/**
 * FNV-1a hash constants for vertex hashing.
 * Used for O(1) average-case vertex deduplication.
 *
 * @see https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
export const FNV_CONSTANTS = {
  /** FNV offset basis (32-bit) */
  OFFSET_BASIS: 0x811c9dc5,
  /** FNV prime (32-bit) */
  PRIME: 0x01000193,
} as const

/**
 * Spatial hashing constants.
 */
export const SPATIAL_HASH_CONFIG = {
  /**
   * Maximum dimensions to use for spatial hash key.
   * Higher dimensions are ignored to keep neighbor count manageable.
   * 3^3 = 27 neighbors vs 3^11 = 177,147 neighbors.
   */
  MAX_HASH_DIMS: 3,
} as const

/**
 * Binary serialization format version.
 * Increment when making breaking changes to the binary format.
 */
export const BINARY_FORMAT_VERSION = 1

/**
 * Get maximum vertices for a given dimension and preset.
 *
 * @param dimension - The dimension of the polytope
 * @param isOmnitruncated - Whether this is an omnitruncated preset
 * @returns Maximum number of vertices allowed
 */
export function getMaxVerticesForDimension(
  dimension: number,
  isOmnitruncated: boolean = false
): number {
  if (isOmnitruncated) {
    return (
      WYTHOFF_CONFIG.MAX_VERTICES_OMNITRUNCATED[dimension] ??
      WYTHOFF_CONFIG.DEFAULT_MAX_VERTICES_OMNITRUNCATED
    )
  }
  return (
    WYTHOFF_CONFIG.MAX_VERTICES[dimension] ??
    WYTHOFF_CONFIG.DEFAULT_MAX_VERTICES
  )
}
