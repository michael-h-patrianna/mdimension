/**
 * Shared Visual Constants
 *
 * Centralized constants for visual rendering settings to ensure
 * consistency across PolytopeRenderer, PointCloudRenderer, and
 * other rendering components.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// ============================================================================
// Material Properties
// ============================================================================

/**
 * Default emissive intensity for vertex/point rendering.
 * Provides a subtle glow effect without overwhelming the base color.
 * Used by both PolytopeRenderer and PointCloudRenderer for consistency.
 */
export const DEFAULT_EMISSIVE_INTENSITY = 0.2;

/**
 * Default roughness for MeshStandardMaterial.
 * Higher values create a more matte appearance.
 */
export const DEFAULT_MATERIAL_ROUGHNESS = 0.6;

/**
 * Default metalness for MeshStandardMaterial.
 * Low value for non-metallic appearance while maintaining some reflectivity.
 */
export const DEFAULT_MATERIAL_METALNESS = 0.1;

// ============================================================================
// Vertex/Point Size Constants
// ============================================================================

/**
 * Base vertex size as a factor of the store's vertex size setting.
 * Store value (1-10) is divided by this to get actual 3D scale.
 * Example: vertexSize=4 in store → 4/100 = 0.04 in 3D space.
 */
export const VERTEX_SIZE_DIVISOR = 100;

/**
 * Default base vertex size when no store value is available.
 * This matches the default store value (4) divided by VERTEX_SIZE_DIVISOR.
 */
export const DEFAULT_BASE_VERTEX_SIZE = 0.04;

// ============================================================================
// Density Scaling Constants
// ============================================================================

/**
 * Vertex count threshold below which no density scaling is applied.
 * Objects with fewer vertices than this render at full vertex size.
 */
export const DENSITY_SCALING_THRESHOLD = 16;

/**
 * Reference vertex count for density scaling calculation.
 * Used as the base in the scaling formula: (count/BASE)^EXPONENT
 */
export const DENSITY_SCALING_BASE = 8;

/**
 * Exponent for density scaling calculation.
 * Lower values create more gradual size reduction for dense geometries.
 */
export const DENSITY_SCALING_EXPONENT = 0.35;

/**
 * Minimum scale factor for density scaling.
 * Prevents vertices from becoming too small to see.
 */
export const DENSITY_SCALING_MIN = 0.15;

// ============================================================================
// Scale Constants
// ============================================================================

/**
 * Default scale for polytope generation.
 * Vertices are generated in the range [-DEFAULT_SCALE, DEFAULT_SCALE] per axis.
 */
export const DEFAULT_POLYTOPE_SCALE = 1.0;

/**
 * Default radius for hypersphere generation.
 * Matches DEFAULT_POLYTOPE_SCALE so hyperspheres inscribe polytopes.
 */
export const DEFAULT_HYPERSPHERE_RADIUS = 1.0;

/**
 * Default radius for Clifford torus generation.
 * This is the radius of the containing sphere (S³).
 */
export const DEFAULT_CLIFFORD_RADIUS = 1.0;

// ============================================================================
// Face Rendering Constants
// ============================================================================

/**
 * Default color for face rendering (surface shader).
 * Purple color chosen for good visibility against common backgrounds.
 */
export const DEFAULT_FACE_COLOR = '#8800FF';

/**
 * Default opacity for face rendering.
 * Semi-transparent to show internal structure while maintaining surface visibility.
 */
export const DEFAULT_FACE_OPACITY = 0.6;

/**
 * Default specular intensity for face lighting.
 * Controls the brightness of specular highlights.
 */
export const DEFAULT_FACE_SPECULAR_INTENSITY = 1.0;

/**
 * Default specular power (shininess) for face lighting.
 * Higher values create smaller, sharper highlights.
 */
export const DEFAULT_FACE_SPECULAR_POWER = 32;
