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
   * Scale factor for polytope generation (0.5-8.0).
   * Determines the bounding box: vertices lie in [-scale, scale] per axis.
   * Default varies by type: hypercube 1.8, simplex 4.0, cross-polytope 1.8
   */
  scale: number;
}

/**
 * Type-specific default scales for polytopes.
 * Different polytope types look best at different initial scales.
 */
export const DEFAULT_POLYTOPE_SCALES: Record<string, number> = {
  'hypercube': 1.8,
  'simplex': 4.0,
  'cross-polytope': 1.8,
};

/**
 * Default polytope configuration (uses hypercube as baseline)
 */
export const DEFAULT_POLYTOPE_CONFIG: PolytopeConfig = {
  scale: 1.8,
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
  /** Radius of the hypersphere (0.5-6.0) */
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
  radius: 3.0,
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
  /** Scale factor for the roots (0.5-4.0, default 2.0) */
  scale: number;
}

/**
 * Default root system configuration
 */
export const DEFAULT_ROOT_SYSTEM_CONFIG: RootSystemConfig = {
  rootType: 'A',
  scale: 2.0,
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
  /** Radius of the containing sphere (0.5-6.0) */
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
  radius: 3.0,
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
 * - boundaryOnly: Show only points near the boundary (useful for 3D+)
 */
export type MandelbrotColorMode =
  | 'escapeTime'
  | 'smoothColoring'
  | 'distanceEstimation'
  | 'interiorOnly'
  | 'boundaryOnly';

/**
 * Color palette presets for Mandelbrot visualization.
 *
 * All palettes (except 'custom') are derived from the user's vertexColor
 * setting, ensuring visual consistency with the overall theme.
 *
 * - monochrome: Dark → vertexColor → White (shades of selected hue)
 * - complement: vertexColor → White → complementary color (180° hue shift)
 * - triadic: Uses vertexColor in a triadic scheme (120° shifts)
 * - analogous: vertexColor with ±60° hue variations
 * - shifted: vertexColor → 90° hue-shifted version
 */
export type MandelbrotPalette =
  | 'monochrome'
  | 'complement'
  | 'triadic'
  | 'analogous'
  | 'shifted';

/**
 * Quality presets for Mandelbrot computation
 */
export type MandelbrotQualityPreset = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Rendering styles for Mandelbrot visualization
 * - pointCloud: Individual points (uses existing PointCloudRenderer)
 * - rayMarching: Volumetric ray marching in shader (3D+ only)
 */
export type MandelbrotRenderStyle = 'pointCloud' | 'rayMarching';

/**
 * Configuration for n-dimensional Mandelbrot set generation
 *
 * Supports:
 * - 2D: Classic Mandelbrot set (complex plane)
 * - 3D: Mandelbulb (spherical coordinates)
 * - 4D-11D: Hyperbulb (hyperspherical coordinates)
 *
 * @see docs/prd/ndimensional-mandelbrot.md
 * @see docs/research/hyperbulb-guide.md
 */
export interface MandelbrotConfig {
  // Iteration parameters
  /** Maximum iterations before considering point bounded (10-500) */
  maxIterations: number;
  /**
   * Escape radius threshold (2.0-16.0).
   * Higher dimensions may need larger values (8-16) for stability.
   * Also known as "bailout" in fractal literature.
   */
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

  // Boundary filtering (for 3D+ visualization)
  /**
   * Boundary threshold range for 'boundaryOnly' color mode.
   * Points with escape time in [min*maxIter, max*maxIter] are shown.
   * Default: [0.1, 0.9] shows points escaping between 10%-90% of maxIterations.
   */
  boundaryThreshold: [number, number];

  // Mandelbulb/Hyperbulb settings (for 3D+)
  /**
   * Power for Mandelbulb/Hyperbulb formula (3D and higher).
   * Default: 8 produces the classic bulb shape.
   * Range: 2-16
   */
  mandelbulbPower: number;

  /**
   * Epsilon for numerical stability near origin.
   * Used in hyperspherical coordinate calculations to avoid
   * division by zero and undefined angles.
   * Default: 1e-12
   */
  epsilon: number;

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
  extent: 1.75,  // Adjusted for better 2D Mandelbrot framing (was 2.5)
  colorMode: 'escapeTime',
  palette: 'complement',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  invertColors: false,
  interiorColor: '#000000',
  paletteCycles: 1,
  renderStyle: 'pointCloud',
  pointSize: 3,
  boundaryThreshold: [0.1, 0.9],  // Show points with escape time 10%-90% of maxIter
  mandelbulbPower: 8,  // Classic Mandelbulb/Hyperbulb power
  epsilon: 1e-12,  // Numerical stability for hyperspherical calculations
};

// ============================================================================
// Mandelbox Configuration
// ============================================================================

/**
 * Configuration for n-dimensional Mandelbox fractal generation
 *
 * The Mandelbox is a box-like fractal discovered by Tom Lowe in 2010.
 * Unlike the Mandelbulb (which uses hyperspherical coordinate transformations),
 * the Mandelbox uses simple geometric operations—conditional reflections and
 * sphere inversions—that generalize naturally to any dimension.
 *
 * Supports 3D to 11D with the same algorithm (no dimension-specific code needed).
 *
 * @see docs/prd/mandelbox.md
 */
export interface MandelboxConfig {
  /**
   * Iteration scale factor (-3.0 to 3.0, default -1.5).
   * Controls the character of the fractal:
   * - -1.5: Classic folded/organic look
   * - -2.0: Sponge-like patterns
   * - -1.0: Soft, flower-like shapes
   * - 1.0: Abstract geometric
   * - 2.0: Boxy, structured
   */
  scale: number;

  /**
   * Box fold boundary (0.5 to 2.0, default 1.0).
   * Controls the folding limit for box fold operation.
   */
  foldingLimit: number;

  /**
   * Inner sphere radius for sphere fold (0.1 to 1.0, default 0.5).
   * Points closer than this are scaled up.
   */
  minRadius: number;

  /**
   * Outer sphere radius for sphere fold (0.5 to 2.0, default 1.0).
   * Points between minRadius and fixedRadius are inverted.
   */
  fixedRadius: number;

  /**
   * Maximum iterations before considering point bounded (10 to 100, default 50).
   */
  maxIterations: number;

  /**
   * Escape radius threshold (4.0 to 100.0, default 10.0).
   * Higher dimensions may need larger values for stability.
   */
  escapeRadius: number;

  /**
   * Fixed values for dimensions beyond the 3D slice (for 4D+).
   * Array length = dimension - 3.
   */
  parameterValues: number[];
}

/**
 * Default Mandelbox configuration
 */
export const DEFAULT_MANDELBOX_CONFIG: MandelboxConfig = {
  scale: -1.5,          // Classic folded/organic look
  foldingLimit: 1.0,    // Standard box fold boundary
  minRadius: 0.5,       // Standard inner sphere
  fixedRadius: 1.0,     // Standard outer sphere
  maxIterations: 50,    // Balanced quality/performance
  escapeRadius: 10.0,   // Safe bailout for most dimensions
  parameterValues: [],  // No extra dimensions by default
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
  /** Configuration for Mandelbox fractal generation */
  mandelbox: MandelboxConfig;
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
  mandelbox: DEFAULT_MANDELBOX_CONFIG,
};
