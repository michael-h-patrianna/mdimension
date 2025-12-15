/**
 * Type definitions for extended n-dimensional objects
 *
 * Configuration interfaces for:
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbrot Set (n-dimensional fractal)
 * - Mandelbox (box-like fractal)
 *
 * ## Scale Consistency
 *
 * All objects are designed to have consistent visual scale when using default settings:
 *
 * - **Polytopes** (hypercube, simplex, cross-polytope):
 *   Use scale=1.0, creating vertices in [-1, 1] per axis.
 *   Bounding box is a cube of side length 2.
 *
 * - **Clifford Torus** (radius=1.0):
 *   Points lie on a torus embedded in S³ with sphere radius 1.0.
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
  scale: number
}

/**
 * Type-specific default scales for polytopes.
 * Different polytope types look best at different initial scales.
 */
export const DEFAULT_POLYTOPE_SCALES: Record<string, number> = {
  hypercube: 1.8,
  simplex: 4.0,
  'cross-polytope': 1.8,
}

/**
 * Default polytope configuration (uses hypercube as baseline)
 */
export const DEFAULT_POLYTOPE_CONFIG: PolytopeConfig = {
  scale: 1.8,
}

// ============================================================================
// Root System Types
// ============================================================================

/**
 * Supported root system types
 * - A: Type A_{n-1} roots (n(n-1) roots)
 * - D: Type D_n roots (2n(n-1) roots, requires n >= 4)
 * - E8: Exceptional E8 roots (240 roots, requires n = 8)
 */
export type RootSystemType = 'A' | 'D' | 'E8'

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
  rootType: RootSystemType
  /** Scale factor for the roots (0.5-4.0, default 2.0) */
  scale: number
}

/**
 * Default root system configuration
 */
export const DEFAULT_ROOT_SYSTEM_CONFIG: RootSystemConfig = {
  rootType: 'A',
  scale: 2.0,
}

// ============================================================================
// Clifford Torus Configuration
// ============================================================================

/**
 * Edge display modes for Clifford torus
 */
export type CliffordTorusEdgeMode = 'grid' | 'none'

/**
 * Clifford torus internal mode
 * - classic: 2D torus T² in S³ ⊂ ℝ⁴ (only works for n >= 4)
 * - generalized: k-torus Tᵏ in S^(2k-1) ⊂ ℝ^(2k) (works for n >= 3, with k ≤ floor(n/2))
 */
export type CliffordTorusMode = 'classic' | 'generalized'

/**
 * Configuration for Clifford torus generation (flat mode only)
 *
 * Clifford torus creates flat, grid-like structures with independent circles.
 * Available for dimensions 3-11.
 *
 * For nested/Hopf tori with coupled angles, use the 'nested-torus' object type.
 *
 * @see docs/research/clifford-tori-guide.md
 */
export interface CliffordTorusConfig {
  /** Radius of the containing sphere (0.5-6.0) */
  radius: number
  /** Edge display mode */
  edgeMode: CliffordTorusEdgeMode

  /** Internal mode: classic (4D) or generalized (nD) */
  mode: CliffordTorusMode
  /** Resolution in U direction for classic mode (8-128) */
  resolutionU: number
  /** Resolution in V direction for classic mode (8-128) */
  resolutionV: number
  /**
   * Torus dimension k for generalized mode.
   * Creates a k-torus Tᵏ living on S^(2k-1) ⊂ ℝ^(2k).
   * Must satisfy: 1 ≤ k ≤ floor(n/2)
   * - k=1: circle (trivial)
   * - k=2: classic 2-torus (same as classic mode in 4D)
   * - k=3: 3-torus in 6D, etc.
   */
  k: number
  /**
   * Angular resolution per circle for generalized mode.
   * Total points = stepsPerCircle^k (use carefully for k >= 3)
   */
  stepsPerCircle: number
}

/**
 * Default Clifford torus configuration
 */
export const DEFAULT_CLIFFORD_TORUS_CONFIG: CliffordTorusConfig = {
  radius: 3.0,
  edgeMode: 'grid',
  mode: 'classic',
  resolutionU: 32,
  resolutionV: 32,
  k: 2,
  stepsPerCircle: 16,
}

// ============================================================================
// Nested Torus Configuration
// ============================================================================

/**
 * Edge display modes for Nested torus
 */
export type NestedTorusEdgeMode = 'grid' | 'none'

/**
 * Configuration for Nested torus generation
 *
 * Nested tori use Hopf-like coupled structures:
 * - 4D: Hopf fibration (S³ → S²)
 * - 5D: Twisted 2-torus (T² + helix)
 * - 6D: 3-torus (T³) with coupled angles
 * - 7D: Twisted 3-torus (T³ + helix)
 * - 8D: Quaternionic Hopf (S⁷ → S⁴)
 * - 9D: Twisted 4-torus (T⁴ + helix)
 * - 10D: 5-torus (T⁵) with coupled angles
 * - 11D: Twisted 5-torus (T⁵ + helix)
 *
 * @see docs/research/clifford-tori-guide.md
 */
export interface NestedTorusConfig {
  /** Radius of the containing sphere (0.5-6.0) */
  radius: number
  /** Edge display mode */
  edgeMode: NestedTorusEdgeMode

  // ============== Nested (Hopf) Mode Properties - 4D ==============

  /**
   * Torus position (η) in the Hopf fibration (4D only).
   * Range: 0.05 to ~1.52 radians (π/64 to π/2 - π/64).
   * - η = π/4 (0.785): Main Clifford torus with equal circle radii
   * - η → 0: Degenerates to a circle in x₂x₃ plane
   * - η → π/2: Degenerates to a circle in x₀x₁ plane
   */
  eta: number
  /** Resolution in ξ₁ direction for Hopf mode (8-128) */
  resolutionXi1: number
  /** Resolution in ξ₂ direction for Hopf mode (8-128) */
  resolutionXi2: number
  /** Display multiple tori at different η values */
  showNestedTori: boolean
  /** Number of nested tori to display when showNestedTori is true (2-5) */
  numberOfTori: number

  // ============== Nested (Hopf) Mode Properties - 8D ==============

  /** S³ fiber sampling resolution for 8D quaternionic Hopf (4-32) */
  fiberResolution: number
  /** S⁴ base sampling resolution for 8D quaternionic Hopf (4-32) */
  baseResolution: number
  /** Connect points along S³ fibers to reveal fibration structure */
  showFiberStructure: boolean
}

/**
 * Default Nested torus configuration
 */
export const DEFAULT_NESTED_TORUS_CONFIG: NestedTorusConfig = {
  // Shared
  radius: 3.0,
  edgeMode: 'grid',

  // Nested (Hopf) 4D mode
  eta: Math.PI / 4, // Main Clifford torus position
  resolutionXi1: 48,
  resolutionXi2: 48,
  showNestedTori: false,
  numberOfTori: 3,

  // Nested (Hopf) 8D mode
  // NOTE: Face count = fiberRes³ × baseRes² - keep low to avoid memory issues
  // With fiberRes=6, baseRes=8: 216 × 64 = 13,824 faces (manageable)
  // With fiberRes=12, baseRes=12: 1728 × 144 = 248,832 faces (too many!)
  fiberResolution: 6,
  baseResolution: 8,
  showFiberStructure: true,
}

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
  | 'boundaryOnly'

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
export type MandelbrotPalette = 'monochrome' | 'complement' | 'triadic' | 'analogous' | 'shifted'

/**
 * Quality presets for Mandelbrot computation
 */
export type MandelbrotQualityPreset = 'draft' | 'standard' | 'high' | 'ultra'

/**
 * Rendering styles for Mandelbrot visualization
 * - rayMarching: Volumetric ray marching in shader (3D+ only)
 */
export type MandelbrotRenderStyle = 'rayMarching'

/**
 * Configuration for n-dimensional Mandelbrot set generation
 *
 * Supports:
 * - 3D: Mandelbulb (spherical coordinates)
 * - 4D-11D: Hyperbulb (hyperspherical coordinates)
 *
 * @see docs/prd/ndimensional-mandelbrot.md
 * @see docs/research/hyperbulb-guide.md
 */
export interface MandelbrotConfig {
  // Iteration parameters
  /** Maximum iterations before considering point bounded (10-500) */
  maxIterations: number
  /**
   * Escape radius threshold (2.0-16.0).
   * Higher dimensions may need larger values (8-16) for stability.
   * Also known as "bailout" in fractal literature.
   */
  escapeRadius: number
  /** Quality preset (affects iterations and resolution) */
  qualityPreset: MandelbrotQualityPreset

  // Sampling resolution
  /** Samples per axis in the 3D grid (16-128) */
  resolution: number

  // Visualization axes (which 3 of N dimensions to render)
  /** Indices of dimensions to map to X, Y, Z */
  visualizationAxes: [number, number, number]

  // Parameter values for non-visualized dimensions
  /** Fixed values for dimensions not being visualized */
  parameterValues: number[]

  // Navigation (zoom/pan)
  /** Center coordinates in N-dimensional space */
  center: number[]
  /** Extent (zoom level) - half-width of viewing region */
  extent: number

  // Color mapping
  /** Color algorithm to use */
  colorMode: MandelbrotColorMode
  /** Color palette preset */
  palette: MandelbrotPalette
  /** Custom palette colors (used when palette='custom') */
  customPalette: { start: string; mid: string; end: string }
  /** Whether to invert color mapping */
  invertColors: boolean
  /** Color for points inside the set */
  interiorColor: string
  /** Number of palette cycles (1-20) */
  paletteCycles: number

  // Rendering style
  /** How to render the point cloud */
  renderStyle: MandelbrotRenderStyle
  /** Point size for point cloud mode */
  pointSize: number

  // Boundary filtering (for 3D+ visualization)
  /**
   * Boundary threshold range for 'boundaryOnly' color mode.
   * Points with escape time in [min*maxIter, max*maxIter] are shown.
   * Default: [0.1, 0.9] shows points escaping between 10%-90% of maxIterations.
   */
  boundaryThreshold: [number, number]

  // Mandelbulb/Hyperbulb settings (for 3D+)
  /**
   * Power for Mandelbulb/Hyperbulb formula (3D and higher).
   * Default: 8 produces the classic bulb shape.
   * Range: 2-16
   */
  mandelbulbPower: number

  /**
   * Epsilon for numerical stability near origin.
   * Used in hyperspherical coordinate calculations to avoid
   * division by zero and undefined angles.
   * Default: 1e-12
   */
  epsilon: number
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
}

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
  extent: 2.0, // Default extent for 3D+ Mandelbulb/Hyperbulb
  colorMode: 'escapeTime',
  palette: 'complement',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  invertColors: false,
  interiorColor: '#000000',
  paletteCycles: 1,
  renderStyle: 'rayMarching',
  pointSize: 3,
  boundaryThreshold: [0.1, 0.9], // Show points with escape time 10%-90% of maxIter
  mandelbulbPower: 8, // Classic Mandelbulb/Hyperbulb power
  epsilon: 1e-12, // Numerical stability for hyperspherical calculations
}

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
 * NOTE: To create genuine N-dimensional structure (vs just a 3D fractal embedded
 * in higher dimensions), enable intra-iteration rotations. This breaks the SO(N)
 * symmetry of the standard Mandelbox operations and creates interdimensional mixing.
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
  scale: number

  /**
   * Box fold boundary (0.5 to 2.0, default 1.0).
   * Controls the folding limit for box fold operation.
   */
  foldingLimit: number

  /**
   * Inner sphere radius for sphere fold (0.1 to 1.0, default 0.5).
   * Points closer than this are scaled up.
   */
  minRadius: number

  /**
   * Outer sphere radius for sphere fold (0.5 to 2.0, default 1.0).
   * Points between minRadius and fixedRadius are inverted.
   */
  fixedRadius: number

  /**
   * Maximum iterations before considering point bounded (10 to 100, default 50).
   */
  maxIterations: number

  /**
   * Escape radius threshold (4.0 to 100.0, default 10.0).
   * Higher dimensions may need larger values for stability.
   */
  escapeRadius: number

  /**
   * Fixed values for dimensions beyond the 3D slice (for 4D+).
   * Array length = dimension - 3.
   */
  parameterValues: number[]

  /**
   * Rotation angle (in radians) applied per iteration in higher-dimensional planes.
   * Range: 0.0 to 0.5 (0 to ~28.6 degrees), default 0.1.
   *
   * This is the key parameter for creating genuine N-dimensional Mandelbox structure.
   * Without iteration rotation, the Mandelbox is SO(N) symmetric and looks identical
   * from all rotation angles. With iteration rotation, dimensions mix during iteration,
   * creating unique cross-sections when rotating in XW, YW, etc. planes.
   *
   * Higher values create more dramatic interdimensional mixing but may produce
   * chaotic-looking results. Start with 0.05-0.15 for best visual results.
   *
   * Only affects 4D+ dimensions (3D Mandelbox is inherently 3D).
   */
  iterationRotation: number

  // === Scale Animation ===

  /**
   * Enable/disable scale oscillation animation.
   * When enabled, scale oscillates around scaleCenter with the specified amplitude.
   */
  scaleAnimationEnabled: boolean

  /**
   * Center value for scale oscillation (-3.0 to 3.0, default -1.5).
   * The scale oscillates around this value.
   */
  scaleCenter: number

  /**
   * Amplitude of scale oscillation (0.0 to 1.5, default 0.5).
   * Scale ranges from (scaleCenter - amplitude) to (scaleCenter + amplitude).
   */
  scaleAmplitude: number

  /**
   * Speed multiplier for scale oscillation (0.1 to 2.0, default 1.0).
   * Higher values create faster oscillation.
   */
  scaleSpeed: number

  // === Julia Mode ===

  /**
   * Enable Julia mode for Mandelbox iteration.
   * When enabled, uses a global animated 'c' constant instead of per-pixel c.
   * Creates smooth morphing through different Julia-like fractal shapes.
   */
  juliaMode: boolean

  /**
   * Speed of Julia c orbit animation (0.1 to 2.0, default 1.0).
   * Controls how fast the c constant orbits through N-dimensional space.
   */
  juliaSpeed: number

  /**
   * Radius/amplitude of Julia c orbit (0.5 to 2.0, default 1.0).
   * Controls the magnitude of c values during animation.
   * Higher values explore more extreme regions of parameter space.
   */
  juliaRadius: number
}

/**
 * Default Mandelbox configuration
 */
export const DEFAULT_MANDELBOX_CONFIG: MandelboxConfig = {
  scale: -1.5, // Classic folded/organic look
  foldingLimit: 1.0, // Standard box fold boundary
  minRadius: 0.5, // Standard inner sphere
  fixedRadius: 1.0, // Standard outer sphere
  maxIterations: 50, // Balanced quality/performance
  escapeRadius: 10.0, // Safe bailout for most dimensions
  parameterValues: [], // No extra dimensions by default
  iterationRotation: 0.1, // Moderate interdimensional mixing for 4D+
  // Scale Animation defaults
  scaleAnimationEnabled: false,
  scaleCenter: -1.5,
  scaleAmplitude: 0.5,
  scaleSpeed: 1.0,
  // Julia Mode defaults
  juliaMode: false,
  juliaSpeed: 1.0,
  juliaRadius: 1.0,
}

// ============================================================================
// Menger Sponge Configuration
// ============================================================================

/**
 * Configuration for n-dimensional Menger Sponge (Sierpinski N-cube) generation
 *
 * The Menger sponge is a geometric IFS fractal defined by recursive removal:
 * - Divide cube into 3^N subcubes
 * - Remove subcubes where 2+ coordinates are in the "middle third"
 * - Repeat recursively
 *
 * Unlike escape-time fractals (Mandelbrot, Mandelbox), the Menger sponge has a
 * TRUE SDF via KIFS (Kaleidoscopic IFS) fold operations, making it computationally
 * efficient and visually consistent across all dimensions.
 *
 * Supports 3D to 11D with identical algorithm (coordinate sorting + cross subtraction).
 *
 * @see docs/prd/menger-sponge.md
 */
export interface MengerConfig {
  /**
   * Recursion depth / detail level (3 to 8, default 5).
   * Higher values create finer holes but cost more computation.
   * - 3: Coarse, clearly visible cube structure
   * - 5: Good balance of detail and performance
   * - 7-8: Very fine detail, may impact performance
   */
  iterations: number

  /**
   * Bounding cube scale (0.5 to 2.0, default 1.0).
   * Controls the overall size of the Menger sponge.
   */
  scale: number

  /**
   * Fixed values for dimensions beyond the 3D slice (for 4D+).
   * Array length = dimension - 3.
   * Controls which cross-section of the N-dimensional Menger hypersponge is visible.
   */
  parameterValues: number[]

  // === Fold Twist Animation ===

  /**
   * Enable/disable fold twist animation.
   * When enabled, rotates geometry within each KIFS iteration,
   * creating spiraling kaleidoscopic effects.
   */
  foldTwistEnabled: boolean

  /**
   * Static fold twist angle in radians (-π to π, default 0).
   * When animation is enabled, this is the base angle before time is added.
   */
  foldTwistAngle: number

  /**
   * Speed multiplier for fold twist animation (0.0 to 2.0, default 0.5).
   * Higher values create faster spinning.
   */
  foldTwistSpeed: number

  // === Scale Pulse Animation ===

  /**
   * Enable/disable scale pulse (breathing) animation.
   * When enabled, the iteration scale factor oscillates,
   * creating an organic breathing effect.
   */
  scalePulseEnabled: boolean

  /**
   * Amplitude of scale pulse (0.0 to 0.5, default 0.2).
   * Scale oscillates as: scale ± amplitude
   */
  scalePulseAmplitude: number

  /**
   * Speed multiplier for scale pulse animation (0.0 to 2.0, default 1.0).
   * Higher values create faster breathing.
   */
  scalePulseSpeed: number

  // === Slice Sweep Animation (4D+ only) ===

  /**
   * Enable/disable slice sweep animation.
   * When enabled (and dimension >= 4), automatically animates the
   * parameterValues with phase-offset sine waves, creating smooth
   * cross-section sweeps through higher-dimensional space.
   */
  sliceSweepEnabled: boolean

  /**
   * Amplitude of slice sweep (0.0 to 2.0, default 1.0).
   * Controls how far the cross-section sweeps in each extra dimension.
   */
  sliceSweepAmplitude: number

  /**
   * Speed multiplier for slice sweep animation (0.0 to 2.0, default 0.5).
   * Higher values create faster sweeping.
   */
  sliceSweepSpeed: number
}

/**
 * Default Menger sponge configuration
 */
export const DEFAULT_MENGER_CONFIG: MengerConfig = {
  iterations: 5, // Good balance of detail and performance
  scale: 1.0, // Unit cube bounding box
  parameterValues: [], // No extra dimensions by default
  // Fold Twist Animation defaults
  foldTwistEnabled: false,
  foldTwistAngle: 0.0,
  foldTwistSpeed: 0.5,
  // Scale Pulse Animation defaults
  scalePulseEnabled: false,
  scalePulseAmplitude: 0.2,
  scalePulseSpeed: 1.0,
  // Slice Sweep Animation defaults
  sliceSweepEnabled: false,
  sliceSweepAmplitude: 1.0,
  sliceSweepSpeed: 0.5,
}

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
 *   polytope: { scale: 1.5 },
 *   rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG, scale: 2.0 },
 *   ...
 * };
 * ```
 */
export interface ExtendedObjectParams {
  /** Configuration for standard polytopes (hypercube, simplex, cross-polytope) */
  polytope: PolytopeConfig
  /** Configuration for root system generation */
  rootSystem: RootSystemConfig
  /** Configuration for Clifford torus generation */
  cliffordTorus: CliffordTorusConfig
  /** Configuration for Nested torus generation */
  nestedTorus: NestedTorusConfig
  /** Configuration for Mandelbrot set generation */
  mandelbrot: MandelbrotConfig
  /** Configuration for Mandelbox fractal generation */
  mandelbox: MandelboxConfig
  /** Configuration for Menger sponge fractal generation */
  menger: MengerConfig
}

/**
 * Default parameters for all object types
 */
export const DEFAULT_EXTENDED_OBJECT_PARAMS: ExtendedObjectParams = {
  polytope: DEFAULT_POLYTOPE_CONFIG,
  rootSystem: DEFAULT_ROOT_SYSTEM_CONFIG,
  cliffordTorus: DEFAULT_CLIFFORD_TORUS_CONFIG,
  nestedTorus: DEFAULT_NESTED_TORUS_CONFIG,
  mandelbrot: DEFAULT_MANDELBROT_CONFIG,
  mandelbox: DEFAULT_MANDELBOX_CONFIG,
  menger: DEFAULT_MENGER_CONFIG,
}
