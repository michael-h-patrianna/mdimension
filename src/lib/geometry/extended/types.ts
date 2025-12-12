/**
 * Type definitions for extended n-dimensional objects
 *
 * Configuration interfaces for:
 * - Hypersphere (surface/solid point clouds)
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbrot Set (n-dimensional fractal)
 *
 * ## Scale Consistency
 *
 * All objects are designed to have consistent visual scale when using default settings:
 *
 * - **Polytopes** (hypercube, simplex, cross-polytope):
 *   Use scale=1.0, creating vertices in [-1, 1] per axis.
 *   Bounding box is a cube of side length 2.
 *
 * - **Hypersphere** (radius=1.0):
 *   Points lie on or within a sphere of radius 1.0.
 *   The sphere inscribes the polytope's bounding box (touches face centers).
 *   For visual consistency with hypercube corners, users may increase radius to ~1.41 (√2 in 4D).
 *
 * - **Clifford Torus** (radius=1.0):
 *   Points lie on a torus embedded in S³ with sphere radius 1.0.
 *   Similar inscribed relationship as hypersphere.
 *
 * - **Root Systems** (scale=1.0):
 *   Roots are normalized to have maximum coordinate extent ≈ 1.0.
 *
 * - **Mandelbrot** (extent=2.5):
 *   Default viewing region centered at origin, encompassing the main cardioid.
 *
 * @see src/lib/shaders/constants.ts for shared visual constants
 */

// ============================================================================
// Polytope Configuration (for consistency with extended objects)
// ============================================================================

/**
 * Configuration for standard polytope generation.
 *
 * This brings polytopes into alignment with extended objects by providing
 * a unified configuration interface. The scale parameter controls the
 * size of the generated polytope (vertices in [-scale, scale] per axis).
 */
export interface PolytopeConfig {
  /**
   * Scale factor for polytope generation (0.5-3.0).
   * Determines the bounding box: vertices lie in [-scale, scale] per axis.
   * Default: 1.0 (matches extended object defaults)
   */
  scale: number;
}

/**
 * Default polytope configuration
 */
export const DEFAULT_POLYTOPE_CONFIG: PolytopeConfig = {
  scale: 1.0,
};

// ============================================================================
// Root System Types
// ============================================================================

/**
 * Supported root system types
 * - A: Type A_{n-1} roots (n(n-1) roots)
 * - D: Type D_n roots (2n(n-1) roots, requires n >= 4)
 * - E8: Exceptional E8 roots (240 roots, requires n = 8)
 */
export type RootSystemType = 'A' | 'D' | 'E8';

// ============================================================================
// Hypersphere Configuration
// ============================================================================

/**
 * Hypersphere sampling mode
 * - surface: Points on the (n-1)-sphere boundary
 * - solid: Points distributed throughout the n-ball interior
 */
export type HypersphereMode = 'surface' | 'solid';

/**
 * Configuration for hypersphere generation
 */
export interface HypersphereConfig {
  /** Sampling mode: surface or solid */
  mode: HypersphereMode;
  /** Number of sample points (200-10000) */
  sampleCount: number;
  /** Radius of the hypersphere (0.5-3.0) */
  radius: number;
  /** Whether to generate k-NN wireframe edges */
  wireframeEnabled: boolean;
  /** Number of nearest neighbors for wireframe (2-10) */
  neighborCount: number;
}

/**
 * Default hypersphere configuration
 */
export const DEFAULT_HYPERSPHERE_CONFIG: HypersphereConfig = {
  mode: 'surface',
  sampleCount: 2000,
  radius: 1.0,
  wireframeEnabled: false,
  neighborCount: 4,
};

// ============================================================================
// Root System Configuration
// ============================================================================

/**
 * Configuration for root system generation
 *
 * Root systems always have edges enabled (like polytopes).
 * Uses global scale transform for sizing.
 */
export interface RootSystemConfig {
  /** Type of root system (A, D, or E8) */
  rootType: RootSystemType;
  /** Scale factor for the roots (default 1.0) */
  scale: number;
}

/**
 * Default root system configuration
 */
export const DEFAULT_ROOT_SYSTEM_CONFIG: RootSystemConfig = {
  rootType: 'A',
  scale: 1.0,
};

// ============================================================================
// Clifford Torus Configuration
// ============================================================================

/**
 * Edge display modes for Clifford torus
 */
export type CliffordTorusEdgeMode = 'grid' | 'none';

/**
 * Clifford torus mode
 * - classic: 2D torus T² in S³ ⊂ ℝ⁴ (only works for n >= 4)
 * - generalized: k-torus Tᵏ in S^(2k-1) ⊂ ℝ^(2k) (works for n >= 2, with k ≤ floor(n/2))
 */
export type CliffordTorusMode = 'classic' | 'generalized';

/**
 * Configuration for Clifford torus generation
 *
 * Supports both the classic 4D Clifford torus and generalized higher-dimensional tori.
 *
 * @see docs/research/clifford-tori-guide.md
 */
export interface CliffordTorusConfig {
  /** Clifford torus mode: classic (4D) or generalized (nD) */
  mode: CliffordTorusMode;
  /** Radius of the containing sphere (0.5-3.0) */
  radius: number;
  /** Resolution in U direction for classic mode (8-128) */
  resolutionU: number;
  /** Resolution in V direction for classic mode (8-128) */
  resolutionV: number;
  /** Edge display mode */
  edgeMode: CliffordTorusEdgeMode;
  /**
   * Torus dimension k for generalized mode.
   * Creates a k-torus Tᵏ living on S^(2k-1) ⊂ ℝ^(2k).
   * Must satisfy: 1 ≤ k ≤ floor(n/2)
   * - k=1: circle (trivial)
   * - k=2: classic 2-torus (same as classic mode in 4D)
   * - k=3: 3-torus in 6D, etc.
   */
  k: number;
  /**
   * Angular resolution per circle for generalized mode.
   * Total points = stepsPerCircle^k (use carefully for k >= 3)
   */
  stepsPerCircle: number;
}

/**
 * Default Clifford torus configuration
 */
export const DEFAULT_CLIFFORD_TORUS_CONFIG: CliffordTorusConfig = {
  mode: 'classic',
  radius: 1.0,
  resolutionU: 32,
  resolutionV: 32,
  edgeMode: 'grid',
  k: 2,
  stepsPerCircle: 16,
};

// ============================================================================
// Mandelbrot Set Configuration
// ============================================================================

/**
 * Color modes for Mandelbrot visualization
 * - escapeTime: Basic discrete coloring based on iteration count
 * - smoothColoring: Continuous coloring without banding
 * - distanceEstimation: Color based on distance to set boundary
 * - interiorOnly: Show only points inside the set
 */
export type MandelbrotColorMode =
  | 'escapeTime'
  | 'smoothColoring'
  | 'distanceEstimation'
  | 'interiorOnly';

/**
 * Color palette presets for Mandelbrot visualization
 */
export type MandelbrotPalette =
  | 'classic'
  | 'fire'
  | 'ocean'
  | 'rainbow'
  | 'monochrome'
  | 'custom';

/**
 * Quality presets for Mandelbrot computation
 */
export type MandelbrotQualityPreset = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Rendering styles for Mandelbrot visualization
 * - pointCloud: Individual points (uses existing PointCloudRenderer)
 * - isosurface: Marching cubes surface (future)
 * - volume: Volumetric rendering (future)
 */
export type MandelbrotRenderStyle = 'pointCloud' | 'isosurface' | 'volume';

/**
 * Edge modes for Mandelbrot visualization
 * - none: No edges (point cloud only)
 * - grid: Connect adjacent points in the sampling grid
 */
export type MandelbrotEdgeMode = 'none' | 'grid';

/**
 * Configuration for n-dimensional Mandelbrot set generation
 *
 * @see docs/prd/ndimensional-mandelbrot.md
 * @see docs/research/nd-mandelbrot-threejs-guide.md
 */
export interface MandelbrotConfig {
  // Iteration parameters
  /** Maximum iterations before considering point bounded (10-500) */
  maxIterations: number;
  /** Escape radius threshold (2.0-10.0) */
  escapeRadius: number;
  /** Quality preset (affects iterations and resolution) */
  qualityPreset: MandelbrotQualityPreset;

  // Sampling resolution
  /** Samples per axis in the 3D grid (16-128) */
  resolution: number;

  // Visualization axes (which 3 of N dimensions to render)
  /** Indices of dimensions to map to X, Y, Z */
  visualizationAxes: [number, number, number];

  // Parameter values for non-visualized dimensions
  /** Fixed values for dimensions not being visualized */
  parameterValues: number[];

  // Navigation (zoom/pan)
  /** Center coordinates in N-dimensional space */
  center: number[];
  /** Extent (zoom level) - half-width of viewing region */
  extent: number;

  // Color mapping
  /** Color algorithm to use */
  colorMode: MandelbrotColorMode;
  /** Color palette preset */
  palette: MandelbrotPalette;
  /** Custom palette colors (used when palette='custom') */
  customPalette: { start: string; mid: string; end: string };
  /** Whether to invert color mapping */
  invertColors: boolean;
  /** Color for points inside the set */
  interiorColor: string;
  /** Number of palette cycles (1-20) */
  paletteCycles: number;

  // Rendering style
  /** How to render the point cloud */
  renderStyle: MandelbrotRenderStyle;
  /** Point size for point cloud mode */
  pointSize: number;
  /** Threshold for isosurface mode (0.0-1.0) */
  isosurfaceThreshold: number;

  // Edge rendering
  /** Edge mode: 'none' for point cloud only, 'grid' for grid connectivity */
  edgeMode: MandelbrotEdgeMode;
}

/**
 * Quality preset configurations
 */
export const MANDELBROT_QUALITY_PRESETS: Record<
  MandelbrotQualityPreset,
  { maxIterations: number; resolution: number }
> = {
  draft: { maxIterations: 30, resolution: 24 },
  standard: { maxIterations: 80, resolution: 32 },
  high: { maxIterations: 200, resolution: 64 },
  ultra: { maxIterations: 500, resolution: 96 },
};

/**
 * Default Mandelbrot configuration
 */
export const DEFAULT_MANDELBROT_CONFIG: MandelbrotConfig = {
  maxIterations: 80,
  escapeRadius: 4.0,
  qualityPreset: 'standard',
  resolution: 32,
  visualizationAxes: [0, 1, 2],
  parameterValues: [],
  center: [],
  extent: 2.5,
  colorMode: 'escapeTime',
  palette: 'classic',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  invertColors: false,
  interiorColor: '#000000',
  paletteCycles: 1,
  renderStyle: 'pointCloud',
  pointSize: 3,
  isosurfaceThreshold: 0.5,
  edgeMode: 'none',
};

// ============================================================================
// Combined Object Parameters
// ============================================================================

/**
 * Combined parameters for all object types (both polytopes and extended objects).
 * Used by the unified geometry generator for consistent configuration.
 *
 * @example
 * ```typescript
 * const params: ExtendedObjectParams = {
 *   polytope: { scale: 1.5 },  // Larger polytope
 *   hypersphere: { ...DEFAULT_HYPERSPHERE_CONFIG, radius: 1.5 }, // Matching sphere
 *   ...
 * };
 * ```
 */
export interface ExtendedObjectParams {
  /** Configuration for standard polytopes (hypercube, simplex, cross-polytope) */
  polytope: PolytopeConfig;
  /** Configuration for hypersphere generation */
  hypersphere: HypersphereConfig;
  /** Configuration for root system generation */
  rootSystem: RootSystemConfig;
  /** Configuration for Clifford torus generation */
  cliffordTorus: CliffordTorusConfig;
  /** Configuration for Mandelbrot set generation */
  mandelbrot: MandelbrotConfig;
}

/**
 * Default parameters for all object types
 */
export const DEFAULT_EXTENDED_OBJECT_PARAMS: ExtendedObjectParams = {
  polytope: DEFAULT_POLYTOPE_CONFIG,
  hypersphere: DEFAULT_HYPERSPHERE_CONFIG,
  rootSystem: DEFAULT_ROOT_SYSTEM_CONFIG,
  cliffordTorus: DEFAULT_CLIFFORD_TORUS_CONFIG,
  mandelbrot: DEFAULT_MANDELBROT_CONFIG,
};
