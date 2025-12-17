/**
 * Type definitions for extended n-dimensional objects
 *
 * Configuration interfaces for:
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbulb Set (n-dimensional fractal)
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
 * - **Mandelbulb** (extent=2.5):
 *   Default viewing region centered at origin, encompassing the main cardioid.
 *
 * @see src/lib/shaders/constants.ts for shared visual constants
 */

// ============================================================================
// Polytope Configuration (for consistency with extended objects)
// ============================================================================

/**
 * Truncation mode for polytope animation
 * - vertexTruncate: Cut corners (bevels vertices)
 * - edgeTruncate: Bevels edges
 * - cantellate: Combined vertex and edge truncation
 * - none: No truncation
 */
export type TruncationMode = 'vertexTruncate' | 'edgeTruncate' | 'cantellate' | 'none'

/**
 * Dual morph normalization mode
 * - unitSphere: Normalize to unit sphere
 * - inradius1: Normalize inradius to 1
 * - circumradius1: Normalize circumradius to 1
 */
export type DualNormalizeMode = 'unitSphere' | 'inradius1' | 'circumradius1'

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

  // === Truncation Animation ===

  /**
   * Enable truncation animation.
   * Smoothly "shaves" vertices or edges based on truncation mode.
   */
  truncationEnabled: boolean

  /**
   * Truncation mode determines which features are cut.
   * - vertexTruncate: Bevels vertices
   * - edgeTruncate: Bevels edges
   * - cantellate: Combined vertex and edge truncation
   */
  truncationMode: TruncationMode

  /**
   * Current truncation parameter (0.0-1.0).
   * 0 = original polytope, 1 = fully truncated.
   * When animated, this value oscillates between truncationMin and truncationMax.
   */
  truncationT: number

  /**
   * Minimum truncation value during animation (0.0-0.5, default 0.0).
   */
  truncationMin: number

  /**
   * Maximum truncation value during animation (0.5-1.0, default 0.5).
   */
  truncationMax: number

  /**
   * Speed of truncation animation (0.01-0.5, default 0.1).
   */
  truncationSpeed: number

  // === Pulse Animation (organic breathing) ===

  /**
   * Enable pulse animation.
   * Creates gentle breathing effect using layered sine waves
   * with irrational frequency ratios for smooth, non-repeating motion.
   */
  facetOffsetEnabled: boolean

  /**
   * Intensity of pulse animation (0.0-1.0, default 0.3).
   * Controls the amplitude of organic breathing modulation.
   */
  facetOffsetAmplitude: number

  /**
   * Base frequency modifier for pulse animation (0.1-2.0, default 0.3).
   * Note: Actual frequencies are determined by layered sine waves in shader.
   */
  facetOffsetFrequency: number

  /**
   * Distance-based phase offset for wave effect (0.0-1.0, default 0.2).
   * Creates radial waves emanating from center.
   */
  facetOffsetPhaseSpread: number

  /**
   * Per-vertex/dimension phase bias (0.0-1.0, default 0.0).
   * Creates variation so vertices move at different times.
   */
  facetOffsetBias: number

  // === Flow Animation (organic vertex drift) ===

  /**
   * Enable flow animation.
   * Creates organic vertex drift where each vertex moves
   * independently in smooth, flowing patterns.
   */
  dualMorphEnabled: boolean

  /**
   * Intensity of flow animation (0.0-1.0, default 0.3).
   * Controls how much vertices drift from their base positions.
   */
  dualMorphT: number

  /**
   * Flow normalization mode (legacy, not used in organic system).
   */
  dualNormalize: DualNormalizeMode

  /**
   * Flow animation speed modifier (0.01-0.3, default 0.05).
   * Note: Actual speeds are determined by layered frequencies in shader.
   */
  dualMorphSpeed: number

  // === Ripple Animation (smooth radial waves) ===

  /**
   * Enable ripple animation.
   * Creates smooth radial waves emanating from center,
   * giving a gentle pulsing wave effect across the surface.
   */
  explodeEnabled: boolean

  /**
   * Current ripple factor (0.0-1.0, legacy).
   */
  explodeFactor: number

  /**
   * Ripple animation speed modifier (0.01-0.3, default 0.1).
   * Note: Actual wave speed is determined by shader.
   */
  explodeSpeed: number

  /**
   * Intensity of ripple animation (0.0-1.0, default 0.3).
   * Controls the amplitude of radial wave displacement.
   */
  explodeMax: number
}

/**
 * Type-specific default scales for polytopes.
 * Different polytope types look best at different initial scales.
 */
export const DEFAULT_POLYTOPE_SCALES: Record<string, number> = {
  hypercube: 1.8,
  simplex: 4.0,
  'cross-polytope': 1.8,
  'wythoff-polytope': 2.0,
}

/**
 * Default polytope configuration (uses hypercube as baseline)
 */
export const DEFAULT_POLYTOPE_CONFIG: PolytopeConfig = {
  scale: 1.8,

  // Truncation Animation defaults
  truncationEnabled: false,
  truncationMode: 'vertexTruncate',
  truncationT: 0.0,
  truncationMin: 0.0,
  truncationMax: 0.5,
  truncationSpeed: 0.1,

  // Vertex Modulation defaults (radial breathing)
  // Enabled by default with smooth, organic motion
  facetOffsetEnabled: true,
  facetOffsetAmplitude: 0.2,
  facetOffsetFrequency: 0.01,
  facetOffsetPhaseSpread: 0.12, // Wave effect
  facetOffsetBias: 1.0, // Full per-vertex/dimension variation

  // Flow Animation defaults (organic vertex drift)
  // Creates smooth flowing deformation
  dualMorphEnabled: false,
  dualMorphT: 0.3, // Moderate intensity
  dualNormalize: 'unitSphere',
  dualMorphSpeed: 0.05,

  // Ripple Animation defaults (smooth radial waves)
  // Gentle pulsing waves across the surface
  explodeEnabled: false,
  explodeFactor: 0.0,
  explodeSpeed: 0.1,
  explodeMax: 0.3, // Moderate intensity for visible but subtle effect
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
// Mandelbulb Set Configuration
// ============================================================================

/**
 * Color modes for Mandelbulb visualization
 * - escapeTime: Basic discrete coloring based on iteration count
 * - smoothColoring: Continuous coloring without banding
 * - distanceEstimation: Color based on distance to set boundary
 * - interiorOnly: Show only points inside the set
 * - boundaryOnly: Show only points near the boundary (useful for 3D+)
 */
export type MandelbulbColorMode =
  | 'escapeTime'
  | 'smoothColoring'
  | 'distanceEstimation'
  | 'interiorOnly'
  | 'boundaryOnly'

/**
 * Color palette presets for Mandelbulb visualization.
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
export type MandelbulbPalette = 'monochrome' | 'complement' | 'triadic' | 'analogous' | 'shifted'

/**
 * Quality presets for Mandelbulb computation
 */
export type MandelbulbQualityPreset = 'draft' | 'standard' | 'high' | 'ultra'

/**
 * Rendering styles for Mandelbulb visualization
 * - rayMarching: Volumetric ray marching in shader (3D+ only)
 */
export type MandelbulbRenderStyle = 'rayMarching'

/**
 * Autopilot strategies for zoom void avoidance
 * - centerRayLock: Simple probe-based steering (fastest, least overhead)
 * - interestScore: Hill-climb optimization for visual interest
 * - boundaryTarget: Classic Mandelbrot boundary tracking
 */
export type MandelbulbAutopilotStrategy = 'centerRayLock' | 'interestScore' | 'boundaryTarget'

/**
 * Configuration for n-dimensional Mandelbulb set generation
 *
 * Supports:
 * - 3D: Mandelbulb (spherical coordinates)
 * - 4D-11D: Mandelbulb (hyperspherical coordinates)
 *
 * @see docs/prd/ndimensional-mandelbulb.md
 * @see docs/research/mandelbulb-guide.md
 */
export interface MandelbulbConfig {
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
  qualityPreset: MandelbulbQualityPreset

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
  colorMode: MandelbulbColorMode
  /** Color palette preset */
  palette: MandelbulbPalette
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
  renderStyle: MandelbulbRenderStyle
  /** Point size for point cloud mode */
  pointSize: number

  // Boundary filtering (for 3D+ visualization)
  /**
   * Boundary threshold range for 'boundaryOnly' color mode.
   * Points with escape time in [min*maxIter, max*maxIter] are shown.
   * Default: [0.1, 0.9] shows points escaping between 10%-90% of maxIterations.
   */
  boundaryThreshold: [number, number]

  // Mandelbulb/Mandelbulb settings (for 3D+)
  /**
   * Power for Mandelbulb/Mandelbulb formula (3D and higher).
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

  // === Power Animation (Mandelbulb-specific) ===

  /**
   * Enable/disable power animation.
   * Animates the mandelbulbPower parameter for dramatic morphing.
   * Uses multi-frequency organic motion for non-repeating patterns.
   */
  powerAnimationEnabled: boolean

  /**
   * Minimum power value during animation (2.0 to 10.0, default 5.0).
   * Lower values create more "blobby" shapes.
   */
  powerMin: number

  /**
   * Maximum power value during animation (4.0 to 16.0, default 12.0).
   * Higher values create more detailed, spiky shapes.
   */
  powerMax: number

  /**
   * Speed of power animation (0.01 to 0.2, default 0.03).
   * Lower values create slower, more dramatic morphing.
   * Uses multi-frequency curve for organic, non-repeating motion.
   */
  powerSpeed: number

  // === Alternate Power (Mandelbulb variant of Technique B) ===

  /**
   * Enable/disable power alternation per iteration.
   * Uses different power values for even/odd iterations.
   */
  alternatePowerEnabled: boolean

  /**
   * Power value for odd iterations (2.0 to 16.0, default 4.0).
   * Creates hybrid bulb forms by mixing two powers.
   */
  alternatePowerValue: number

  /**
   * Blend factor between base and alternate power (0.0 to 1.0, default 0.5).
   * 0 = fully base power, 1 = fully alternate on odd iterations.
   */
  alternatePowerBlend: number

  // === Dimension Mixing Animation (Technique A) ===

  /**
   * Enable/disable dimension mixing inside iteration.
   * Applies a time-varying shear matrix to create morphing during rotation.
   */
  dimensionMixEnabled: boolean

  /**
   * Strength of off-diagonal mixing (0.0 to 0.3, default 0.1).
   * Higher values create more dramatic cross-dimensional coupling.
   */
  mixIntensity: number

  /**
   * How fast the mixing matrix evolves (0.1 to 2.0, default 0.5).
   * Multiplied by global animation speed.
   */
  mixFrequency: number

  // === Origin Drift Animation (Technique C) ===

  /**
   * Enable/disable origin drift in extra dimensions.
   * Creates slow multi-frequency wandering for feature birth/death effects.
   */
  originDriftEnabled: boolean

  /**
   * Maximum displacement in extra dimensions (0.01 to 0.5, default 0.1).
   */
  driftAmplitude: number

  /**
   * Base oscillation frequency in Hz (0.05 to 0.5, default 0.1).
   * Multiplied by global animation speed.
   */
  driftBaseFrequency: number

  /**
   * Per-dimension frequency variation (0.0 to 1.0, default 0.3).
   * Higher values create more beating patterns between dimensions.
   */
  driftFrequencySpread: number

  // === Slice Animation (4D+ only) ===

  /**
   * Enable/disable animated slice position through higher dimensions.
   * For 4D+ Mandelbulbs, animates which 3D cross-section is visible,
   * creating a "flying through" effect.
   */
  sliceAnimationEnabled: boolean

  /**
   * Speed of slice animation (0.01 to 0.1, default 0.02).
   * Lower values create slower, more dramatic morphing.
   */
  sliceSpeed: number

  /**
   * Amplitude of slice position oscillation (0.1 to 1.0, default 0.3).
   * Controls how far the slice moves in each extra dimension.
   */
  sliceAmplitude: number

  // === Angular Phase Shifts ===

  /**
   * Enable/disable angular phase shift animation.
   * Adds animated phase offsets to theta/phi angles before power operation,
   * creating twisting/spiraling morphs.
   */
  phaseShiftEnabled: boolean

  /**
   * Speed of phase shift animation (0.01 to 0.2, default 0.03).
   * Controls how fast the phase angles change.
   */
  phaseSpeed: number

  /**
   * Maximum phase shift amplitude in radians (0.0 to PI/4, default 0.3).
   * Controls the intensity of the twisting effect.
   */
  phaseAmplitude: number

  // === Zoom Settings ===

  /**
   * Enable/disable zoom functionality.
   * When enabled, zoom level affects the slice basis scaling.
   */
  zoomEnabled: boolean

  /**
   * Current zoom level (0.001 to 1000000, default 1.0).
   * Higher values zoom in, showing smaller regions of fractal space.
   */
  zoom: number

  /**
   * Internal: logarithm of zoom for smooth animation.
   * Animation uses log-space for perceptually uniform zoom speed.
   */
  logZoom: number

  /**
   * Zoom animation speed (0.1 to 2.0, default 0.5).
   * Controls how fast the zoom level changes during animation.
   */
  zoomSpeed: number

  // === Zoom Animation ===

  /**
   * Enable/disable animated zoom.
   * When enabled, zoom continuously changes during playback.
   */
  zoomAnimationEnabled: boolean

  /**
   * Zoom animation mode.
   * - continuous: Zoom in forever at constant rate
   * - target: Zoom toward a specific target level, then stop
   */
  zoomAnimationMode: 'continuous' | 'target'

  /**
   * Target zoom level for 'target' animation mode (1 to 1000000, default 10.0).
   */
  zoomTargetLevel: number

  // === Autopilot (Void Avoidance) ===

  /**
   * Enable/disable autopilot for avoiding void regions.
   * When enabled, automatically adjusts origin to keep interesting features in view.
   */
  autopilotEnabled: boolean

  /**
   * Autopilot strategy for void avoidance.
   * - centerRayLock: Simple probe-based steering (fastest, default)
   * - interestScore: Hill-climb optimization for visual interest
   * - boundaryTarget: Classic Mandelbrot boundary tracking
   */
  autopilotStrategy: MandelbulbAutopilotStrategy

  // === Strategy A: Center-Ray Lock Settings ===

  /**
   * Probe size for center-ray lock strategy.
   * 1 = single pixel, 4 = 2x2, 16 = 4x4
   * Smaller = faster, larger = more stable
   */
  centerRayProbeSize: 1 | 4 | 16

  /**
   * Probe frequency in Hz (10-30, default 15).
   * How often to sample the center ray for steering decisions.
   */
  centerRayProbeFrequency: number

  /**
   * Miss threshold for zoom speed reduction (0-1, default 0.5).
   * If hit ratio drops below this, zoom slows down.
   */
  centerRayMissThreshold: number

  /**
   * Origin nudge strength (0-0.1, default 0.02).
   * How aggressively to adjust origin when avoiding void.
   */
  centerRayNudgeStrength: number

  // === Strategy B: Interest Score Settings ===

  /**
   * Resolution for interest score probe (32, 64, or 128, default 64).
   * Higher resolution = better quality but slower.
   */
  interestScoreResolution: 32 | 64 | 128

  /**
   * Frames between interest score probes (default 30).
   * Lower = more responsive but higher GPU cost.
   */
  interestScoreInterval: number

  /**
   * Number of candidate nudge directions to evaluate (2-8, default 4).
   */
  interestScoreCandidates: number

  /**
   * Nudge search radius in D-space (0.01-0.2, default 0.05).
   */
  interestScoreNudgeRadius: number

  /**
   * Metric for computing interest score.
   * - hitRatio: Optimize for surfaces in view
   * - variance: Optimize for visual complexity
   * - edgeStrength: Optimize for sharp features
   */
  interestScoreMetric: 'hitRatio' | 'variance' | 'edgeStrength'

  // === Strategy C: Boundary Target Settings ===

  /**
   * Target escape ratio for boundary targeting (0-1, default 0.7).
   * Aims to keep pixels near this escape threshold.
   */
  boundaryTargetEscapeRatio: number

  /**
   * Target band width (0.1-0.3, default 0.2).
   * Width of the "interesting" escape ratio band.
   */
  boundaryTargetBand: number

  /**
   * Correction strength for boundary targeting (0.01-0.1, default 0.03).
   * How aggressively to correct toward the boundary.
   */
  boundaryTargetCorrectionStrength: number

  // === Advanced Rendering ===
  /** Surface roughness for GGX specular (0.0-1.0) */
  roughness: number
  /** Enable subsurface scattering */
  sssEnabled: boolean
  /** SSS intensity (0.0-2.0) */
  sssIntensity: number
  /** SSS tint color (hex) */
  sssColor: string
  /** SSS thickness (0.1-5.0) */
  sssThickness: number
  
  // === Atmosphere ===
  /** Enable scene fog integration */
  fogEnabled: boolean
  /** Fog contribution (0.0-2.0) */
  fogContribution: number
  /** Internal fog density (0.0-1.0) */
  internalFogDensity: number
  
  // === LOD ===
  /** Enable distance-adaptive LOD */
  lodEnabled: boolean
  /** Detail multiplier for LOD (0.1-2.0) */
  lodDetail: number
}

/**
 * Quality preset configurations
 */
export const MANDELBROT_QUALITY_PRESETS: Record<
  MandelbulbQualityPreset,
  { maxIterations: number; resolution: number }
> = {
  draft: { maxIterations: 30, resolution: 24 },
  standard: { maxIterations: 80, resolution: 32 },
  high: { maxIterations: 200, resolution: 64 },
  ultra: { maxIterations: 500, resolution: 96 },
}

/**
 * Default Mandelbulb configuration
 */
export const DEFAULT_MANDELBROT_CONFIG: MandelbulbConfig = {
  maxIterations: 80,
  escapeRadius: 4.0,
  qualityPreset: 'standard',
  resolution: 32,
  visualizationAxes: [0, 1, 2],
  parameterValues: [],
  center: [],
  extent: 2.0, // Default extent for 3D+ Mandelbulb/Mandelbulb
  colorMode: 'escapeTime',
  palette: 'complement',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  invertColors: false,
  interiorColor: '#000000',
  paletteCycles: 1,
  renderStyle: 'rayMarching',
  pointSize: 3,
  boundaryThreshold: [0.1, 0.9], // Show points with escape time 10%-90% of maxIter
  mandelbulbPower: 8, // Classic Mandelbulb/Mandelbulb power
  epsilon: 1e-12, // Numerical stability for hyperspherical calculations
  // Power Animation defaults (Mandelbulb-specific)
  // Uses multi-frequency organic motion for smooth, non-repeating animation
  powerAnimationEnabled: false,
  powerMin: 5.0, // Creates blobby shapes at low end
  powerMax: 12.0, // Creates detailed shapes at high end
  powerSpeed: 0.03, // Very slow organic wandering
  // Alternate Power defaults
  alternatePowerEnabled: false,
  alternatePowerValue: 4.0,
  alternatePowerBlend: 0.5,
  // Dimension Mixing defaults (Technique A)
  dimensionMixEnabled: false,
  mixIntensity: 0.1,
  mixFrequency: 0.5,
  // Origin Drift defaults (Technique C)
  // NOTE: Conservative defaults for smooth, slow morphing
  originDriftEnabled: false,
  driftAmplitude: 0.03, // Very subtle displacement to avoid jitter
  driftBaseFrequency: 0.04, // Slow oscillation (~25 second cycle)
  driftFrequencySpread: 0.2, // Moderate phase spread
  // Slice Animation defaults (4D+ only)
  sliceAnimationEnabled: false,
  sliceSpeed: 0.02, // Slow movement through slices
  sliceAmplitude: 0.3, // Moderate displacement in extra dimensions
  // Angular Phase Shifts defaults
  phaseShiftEnabled: false,
  phaseSpeed: 0.03, // Slow phase evolution
  phaseAmplitude: 0.3, // ~17 degrees max phase shift
  // Zoom Settings defaults
  zoomEnabled: false,
  zoom: 1.0,
  logZoom: 0,
  zoomSpeed: 0.5,
  // Zoom Animation defaults
  zoomAnimationEnabled: false,
  zoomAnimationMode: 'continuous',
  zoomTargetLevel: 10.0,
  // Autopilot defaults (centerRayLock = least performance impact)
  autopilotEnabled: false,
  autopilotStrategy: 'centerRayLock',
  // Strategy A: Center-Ray Lock defaults
  centerRayProbeSize: 1,
  centerRayProbeFrequency: 15,
  centerRayMissThreshold: 0.5,
  centerRayNudgeStrength: 0.02,
  // Strategy B: Interest Score defaults
  interestScoreResolution: 64,
  interestScoreInterval: 30,
  interestScoreCandidates: 4,
  interestScoreNudgeRadius: 0.05,
  interestScoreMetric: 'variance',
  // Strategy C: Boundary Target defaults
  boundaryTargetEscapeRatio: 0.7,
  boundaryTargetBand: 0.2,
  boundaryTargetCorrectionStrength: 0.03,

  // Advanced Rendering
  roughness: 0.3,
  sssEnabled: false,
  sssIntensity: 1.0,
  sssColor: '#ff8844',
  sssThickness: 1.0,
  
  // Atmosphere
  fogEnabled: true,
  fogContribution: 1.0,
  internalFogDensity: 0.0,
  
  // LOD
  lodEnabled: true,
  lodDetail: 1.0,
}

// ============================================================================
// Schroedinger Configuration (Copy of Mandelbulb for future modification)
// ============================================================================

/**
 * Color modes for Schroedinger quantum visualization
 * - density: Color based on probability density |ψ|²
 * - phase: Color based on wavefunction phase arg(ψ)
 * - mixed: Phase for hue, density for brightness
 * - palette: Cosine gradient palette based on density/phase
 * - blackbody: Physical temperature color based on density
 */
export type SchroedingerColorMode = 'density' | 'phase' | 'mixed' | 'palette' | 'blackbody'

/**
 * Named preset identifiers for quantum state configurations
 */
export type SchroedingerPresetName =
  | 'organicBlob'
  | 'quantumFoam'
  | 'breathing'
  | 'kaleidoscope'
  | 'alien'
  | 'nebula'
  | 'crystal'
  | 'chaos'
  | 'custom'

/**
 * Color palette presets for Schroedinger visualization.
 */
export type SchroedingerPalette =
  | 'monochrome'
  | 'complement'
  | 'triadic' | 'analogous' | 'shifted'
  | 'nebula' | 'sunset' | 'aurora' | 'ocean' | 'fire' | 'ice' | 'forest' | 'plasma'

/**
 * Quality presets for Schroedinger computation
 */
export type SchroedingerQualityPreset = 'draft' | 'standard' | 'high' | 'ultra'

/**
 * Rendering styles for Schroedinger visualization
 * - rayMarching: Volumetric ray marching in shader (3D+ only)
 */
export type SchroedingerRenderStyle = 'rayMarching'

/**
 * Configuration for n-dimensional Schroedinger set generation
 *
 * Supports:
 * - 3D: Schroedinger (spherical coordinates)
 * - 4D-11D: Schroedinger (hyperspherical coordinates)
 */
export interface SchroedingerConfig {
  // === Quality Settings ===
  /** Quality preset (affects sample count and resolution) */
  qualityPreset: SchroedingerQualityPreset
  /** Samples per axis in the 3D grid (16-128) */
  resolution: number

  // === Visualization Axes ===
  /** Indices of dimensions to map to X, Y, Z */
  visualizationAxes: [number, number, number]
  /** Fixed values for dimensions not being visualized (slice position) */
  parameterValues: number[]

  // === Navigation ===
  /** Center coordinates in N-dimensional space */
  center: number[]
  /** Extent (zoom level) - half-width of viewing region */
  extent: number

  // === Color Settings ===
  /** Color mode for visualization */
  colorMode: SchroedingerColorMode
  /** Color palette preset */
  palette: SchroedingerPalette
  /** Custom palette colors (used when palette='custom') */
  customPalette: { start: string; mid: string; end: string }
  /** Cosine gradient coefficients (a, b, c, d) for palette mode */
  cosineParams: {
    a: [number, number, number]
    b: [number, number, number]
    c: [number, number, number]
    d: [number, number, number]
  }
  /** Whether to invert color mapping */
  invertColors: boolean

  // === Rendering Style ===
  /** How to render the volume */
  renderStyle: SchroedingerRenderStyle

  // === Quantum State Configuration ===
  /** Named preset or 'custom' */
  presetName: SchroedingerPresetName
  /** Random seed for preset generation */
  seed: number
  /** Number of superposition terms (1-8) */
  termCount: number
  /** Maximum quantum number per dimension (2-6) */
  maxQuantumNumber: number
  /** Variation in per-dimension frequencies (0-0.5) */
  frequencySpread: number

  // === Volume Rendering Parameters ===
  /** Time evolution speed multiplier (0.1-2.0) */
  timeScale: number
  /** Coordinate scale into HO basis (0.5-2.0) */
  fieldScale: number
  /** Absorption coefficient for Beer-Lambert (0.1-5.0) */
  densityGain: number
  /** Multiple scattering "powder" effect strength (0.0-2.0) */
  powderScale: number
  /** Samples per ray (32-128) */
  sampleCount: number

  // === Emission Settings ===
  /** HDR emission intensity (0.0-5.0) */
  emissionIntensity: number
  /** Density threshold for emission (0.0-1.0) */
  emissionThreshold: number
  /** Emission color temperature shift (-1.0 to 1.0) */
  emissionColorShift: number
  /** Enable phase-based emission pulsing */
  emissionPulsing: boolean
  /** Fresnel rim falloff exponent (1.0-10.0) */
  rimExponent: number
  /** Scattering anisotropy (-0.9 to 0.9) */
  scatteringAnisotropy: number
  /** Surface roughness for specular highlights (0.0-1.0) */
  roughness: number

  // === Fog / Atmosphere ===
  /** Enable scene fog integration */
  fogIntegrationEnabled: boolean
  /** Fog contribution strength (0.0-2.0) */
  fogContribution: number
  /** Internal object-space fog density (0.0-1.0) */
  internalFogDensity: number

  // === LOD Settings ===
  /** Enable distance-adaptive level of detail */
  lodEnabled: boolean
  /** Distance for maximum quality (default 2.0) */
  lodNearDistance: number
  /** Distance for minimum quality (default 10.0) */
  lodFarDistance: number
  /** Minimum sample count at far distance (default 32) */
  lodMinSamples: number
  /** Maximum sample count at near distance (default 128) */
  lodMaxSamples: number

  // === Subsurface Scattering (SSS) ===
  /** Enable subsurface scattering approximation */
  sssEnabled: boolean
  /** SSS intensity (0.0-2.0) */
  sssIntensity: number
  /** SSS tint color (hex string) */
  sssColor: string
  /** Thickness factor for SSS attenuation (0.1-5.0) */
  sssThickness: number
  /** Jitter/Noise amount for SSS (0.0-1.0) */
  sssJitter: number

  // === Edge Detail Erosion ===
  /** Strength of edge noise erosion (0.0-1.0) */
  erosionStrength: number
  /** Scale of erosion noise (0.25-4.0) */
  erosionScale: number
  /** Turbulence/swirl amount for erosion (0.0-1.0) */
  erosionTurbulence: number
  /** Noise type for erosion (0=Worley, 1=Perlin, 2=Hybrid) */
  erosionNoiseType: number

  // === Curl Noise Turbulence ===
  /** Enable curl noise flow animation */
  curlEnabled: boolean
  /** Strength of flow distortion (0.0-1.0) */
  curlStrength: number
  /** Scale of flow patterns (0.25-4.0) */
  curlScale: number
  /** Speed of flow animation (0.1-5.0) */
  curlSpeed: number
  /** Flow direction bias (0=None, 1=Up, 2=Out, 3=In) */
  curlBias: number

  // === Chromatic Dispersion ===
  /** Enable chromatic dispersion */
  dispersionEnabled: boolean
  /** Dispersion strength (0.0-1.0) */
  dispersionStrength: number
  /** Dispersion direction (0=Radial, 1=View-Aligned, 2=Custom) */
  dispersionDirection: number
  /** Dispersion quality/accuracy (0=Gradient Hack, 1=Full Sampling) */
  dispersionQuality: number

  // === Volumetric Self-Shadowing ===
  /** Enable volumetric self-shadowing */
  shadowsEnabled: boolean
  /** Shadow strength/darkness (0.0-2.0) */
  shadowStrength: number
  /** Shadow quality steps (1-8) */
  shadowSteps: number

  // === Volumetric Ambient Occlusion (AO) ===
  /** Enable volumetric ambient occlusion */
  aoEnabled: boolean
  /** AO strength/darkness (0.0-2.0) */
  aoStrength: number
  /** AO quality steps/cones (3-8) */
  aoQuality: number
  /** AO radius (0.1-2.0) */
  aoRadius: number
  /** AO tint color (hex string) */
  aoColor: string

  // === Quantum Effects ===
  /** Enable nodal surface highlighting */
  nodalEnabled: boolean
  /** Nodal surface color (hex string) */
  nodalColor: string
  /** Nodal surface strength (0.0-2.0) */
  nodalStrength: number
  /** Enable energy level coloring */
  energyColorEnabled: boolean
  /** Enable uncertainty shimmer */
  shimmerEnabled: boolean
  /** Shimmer strength (0.0-1.0) */
  shimmerStrength: number

  // === Isosurface Mode (Optional) ===
  /** Enable isosurface rendering instead of volumetric */
  isoEnabled: boolean
  /** Log-density threshold for isosurface (-6 to 0) */
  isoThreshold: number

  // === Origin Drift Animation ===
  /** Enable multi-frequency wandering in extra dimensions */
  originDriftEnabled: boolean
  /** Drift amplitude (0.01-0.5) */
  driftAmplitude: number
  /** Base frequency for drift (0.05-0.5) */
  driftBaseFrequency: number
  /** Frequency spread between dimensions (0-1) */
  driftFrequencySpread: number

  // === Slice Animation (4D+ only) ===
  /** Enable slice animation through extra dimensions */
  sliceAnimationEnabled: boolean
  /** Slice animation speed (0.01-0.1) */
  sliceSpeed: number
  /** Slice animation amplitude (0.1-1.0) */
  sliceAmplitude: number
}

/**
 * Quality preset configurations for Schroedinger
 */
export const SCHROEDINGER_QUALITY_PRESETS: Record<
  SchroedingerQualityPreset,
  { maxIterations: number; resolution: number }
> = {
  draft: { maxIterations: 30, resolution: 24 },
  standard: { maxIterations: 80, resolution: 32 },
  high: { maxIterations: 200, resolution: 64 },
  ultra: { maxIterations: 500, resolution: 96 },
}

/**
 * Default Schroedinger quantum visualization configuration
 */
export const DEFAULT_SCHROEDINGER_CONFIG: SchroedingerConfig = {
  // Quality
  qualityPreset: 'standard',
  resolution: 32,

  // Visualization
  visualizationAxes: [0, 1, 2],
  parameterValues: [],
  center: [],
  extent: 2.0,

  // Color
  colorMode: 'mixed',
  palette: 'complement',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  cosineParams: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  invertColors: false,

  // Rendering
  renderStyle: 'rayMarching',

  // Quantum state
  presetName: 'custom',
  seed: 42,
  termCount: 1,
  maxQuantumNumber: 6,
  frequencySpread: 0.01,

  // Volume rendering
  timeScale: 0.8,
  fieldScale: 1.0,
  densityGain: 2.0,
  powderScale: 1.0,
  sampleCount: 64,

  // Emission
  emissionIntensity: 0.0,
  emissionThreshold: 0.3,
  emissionColorShift: 0.0,
  emissionPulsing: false,
  rimExponent: 3.0,
  scatteringAnisotropy: 0.0,
  roughness: 0.3,

  // Fog
  fogIntegrationEnabled: true,
  fogContribution: 1.0,
  internalFogDensity: 0.0,

  // LOD
  lodEnabled: true,
  lodNearDistance: 2.0,
  lodFarDistance: 10.0,
  lodMinSamples: 32,
  lodMaxSamples: 128,

  // SSS
  sssEnabled: false,
  sssIntensity: 1.0,
  sssColor: '#ff8844', // Warm orange default
  sssThickness: 1.0,
  sssJitter: 0.2,

  // Erosion
  erosionStrength: 0.0,
  erosionScale: 1.0,
  erosionTurbulence: 0.5,
  erosionNoiseType: 0,

  // Curl Noise
  curlEnabled: false,
  curlStrength: 0.3,
  curlScale: 1.0,
  curlSpeed: 1.0,
  curlBias: 0,

  // Dispersion
  dispersionEnabled: false,
  dispersionStrength: 0.2,
  dispersionDirection: 0,
  dispersionQuality: 0,

  // Shadows
  shadowsEnabled: false,
  shadowStrength: 1.0,
  shadowSteps: 4,

  // AO
  aoEnabled: false,
  aoStrength: 1.0,
  aoQuality: 4,
  aoRadius: 0.5,
  aoColor: '#000000',

  // Quantum Effects
  nodalEnabled: false,
  nodalColor: '#00ffff', // Cyan
  nodalStrength: 1.0,
  energyColorEnabled: false,
  shimmerEnabled: false,
  shimmerStrength: 0.5,

  // Isosurface (disabled by default)
  isoEnabled: false,
  isoThreshold: -0.76,

  // Origin Drift
  originDriftEnabled: false,
  driftAmplitude: 0.03,
  driftBaseFrequency: 0.04,
  driftFrequencySpread: 0.2,

  // Slice Animation
  sliceAnimationEnabled: false,
  sliceSpeed: 0.02,
  sliceAmplitude: 0.3,
}

// ============================================================================
// Quaternion Julia Configuration
// ============================================================================

/**
 * Julia constant preset for Quaternion Julia sets
 */
export interface JuliaConstantPreset {
  name: string
  value: [number, number, number, number]
}

/**
 * Configuration for Quaternion Julia fractal generation
 *
 * Mathematical basis: z = z^n + c where z and c are quaternions
 * The Julia constant c is fixed (unlike Mandelbulb where c = initial position)
 *
 * Supports 3D to 11D via hyperspherical quaternion generalization.
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */
export interface QuaternionJuliaConfig {
  /**
   * Julia constant c (4D quaternion components).
   * Default: [0.3, 0.5, 0.4, 0.2] ("Classic Bubble")
   * Range: -2.0 to 2.0 per component
   */
  juliaConstant: [number, number, number, number]

  /**
   * Iteration power (2-8, default 2 for quadratic).
   * Higher powers create more complex folding patterns.
   */
  power: number

  /**
   * Maximum iterations before escape (32-256, default 64).
   */
  maxIterations: number

  /**
   * Bailout/escape radius (2.0-16.0, default 4.0).
   */
  bailoutRadius: number

  /**
   * Scale/extent parameter for auto-positioning (0.5-5.0, default 2.0).
   * Controls the sampling volume - larger values show more of the fractal.
   */
  scale: number

  /**
   * Surface distance threshold for raymarching (0.0005-0.004).
   */
  surfaceThreshold: number

  /**
   * Maximum raymarch steps (64-512).
   */
  maxRaymarchSteps: number

  /**
   * Quality multiplier for fine-tuning (0.25-1.0, default 1.0).
   */
  qualityMultiplier: number

  /**
   * D-dimensional rotation parameter values (for dimensions 4-11).
   * Array length = dimension - 3.
   */
  parameterValues: number[]

  // === Color Configuration ===

  /** Color algorithm (0-7): Mono, Analogous, Cosine, Normal, Distance, LCH, Multi, Radial */
  colorMode: number
  /** Base hex color for monochromatic/analogous modes */
  baseColor: string
  /** Cosine palette coefficients (Inigo Quilez formula) */
  cosineCoefficients: {
    a: [number, number, number]
    b: [number, number, number]
    c: [number, number, number]
    d: [number, number, number]
  }
  /** Color distribution power (0.25-4.0) */
  colorPower: number
  /** Number of color cycles (0.5-5.0) */
  colorCycles: number
  /** Color phase offset (0.0-1.0) */
  colorOffset: number
  /** LCH lightness (0.1-1.0) */
  lchLightness: number
  /** LCH chroma (0.0-0.4) */
  lchChroma: number

  // === Opacity Configuration ===

  /** Opacity mode: 0=Solid, 1=SimpleAlpha, 2=Layered, 3=Volumetric */
  opacityMode: number
  /** Global opacity for SimpleAlpha mode (0.0-1.0) */
  opacity: number
  /** Number of layers for Layered mode (2-4) */
  layerCount: number
  /** Per-layer opacity for Layered mode (0.1-0.9) */
  layerOpacity: number
  /** Density for Volumetric mode (0.1-2.0) */
  volumetricDensity: number

  // === Shadow Configuration ===

  /** Enable shadow calculation */
  shadowEnabled: boolean
  /** Shadow quality: 0=Low(16), 1=Medium(32), 2=High(64), 3=Ultra(128) */
  shadowQuality: number
  /** Shadow softness (0.0-2.0) */
  shadowSoftness: number
  /** Shadow animation mode: 0=Pause, 1=Low, 2=Full */
  shadowAnimationMode: number

  // === Advanced Rendering ===
  /** Surface roughness for GGX specular (0.0-1.0) */
  roughness: number
  /** Enable subsurface scattering */
  sssEnabled: boolean
  /** SSS intensity (0.0-2.0) */
  sssIntensity: number
  /** SSS tint color (hex) */
  sssColor: string
  /** SSS thickness (0.1-5.0) */
  sssThickness: number
  
  // === Atmosphere ===
  /** Enable scene fog integration */
  fogEnabled: boolean
  /** Fog contribution (0.0-2.0) */
  fogContribution: number
  /** Internal fog density (0.0-1.0) */
  internalFogDensity: number
  
  // === LOD ===
  /** Enable distance-adaptive LOD */
  lodEnabled: boolean
  /** Detail multiplier for LOD (0.1-2.0) */
  lodDetail: number
}

/**
 * Julia constant presets
 */
export const JULIA_CONSTANT_PRESETS: JuliaConstantPreset[] = [
  { name: 'Tentacles', value: [-0.2, 0.8, 0.0, 0.0] },
  { name: 'Bubble', value: [0.285, 0.01, 0.0, 0.0] },
  { name: 'Coral', value: [-0.1, 0.65, 0.45, -0.2] },
  { name: 'Sponge', value: [-0.4, -0.4, 0.4, 0.4] },
  { name: 'Twisted', value: [-0.08, 0.0, -0.83, 0.025] },
]

/**
 * Quality presets for Quaternion Julia
 */
export const QUATERNION_JULIA_QUALITY_PRESETS = {
  draft: { maxIterations: 32, surfaceThreshold: 0.004, maxRaymarchSteps: 64 },
  standard: { maxIterations: 64, surfaceThreshold: 0.002, maxRaymarchSteps: 128 },
  high: { maxIterations: 128, surfaceThreshold: 0.001, maxRaymarchSteps: 256 },
  ultra: { maxIterations: 256, surfaceThreshold: 0.0005, maxRaymarchSteps: 512 },
}

/**
 * Default configuration for Quaternion Julia
 */
export const DEFAULT_QUATERNION_JULIA_CONFIG: QuaternionJuliaConfig = {
  juliaConstant: [-0.2, 0.8, 0.0, 0.0],
  power: 2,
  maxIterations: 64,
  bailoutRadius: 4.0,
  scale: 1.0,
  surfaceThreshold: 0.002,
  maxRaymarchSteps: 128,
  qualityMultiplier: 1.0,
  parameterValues: [],

  // Color defaults
  colorMode: 2, // Cosine gradient
  baseColor: '#4488ff',
  cosineCoefficients: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  colorPower: 1.0,
  colorCycles: 1.0,
  colorOffset: 0.0,
  lchLightness: 0.7,
  lchChroma: 0.15,

  // Opacity defaults
  opacityMode: 0, // Solid
  opacity: 1.0,
  layerCount: 2,
  layerOpacity: 0.5,
  volumetricDensity: 1.0,

  // Shadow defaults
  shadowEnabled: false,
  shadowQuality: 1, // Medium
  shadowSoftness: 1.0,
  shadowAnimationMode: 1, // Low

  // Advanced Rendering
  roughness: 0.3,
  sssEnabled: false,
  sssIntensity: 1.0,
  sssColor: '#ff8844',
  sssThickness: 1.0,
  
  // Atmosphere
  fogEnabled: true,
  fogContribution: 1.0,
  internalFogDensity: 0.0,
  
  // LOD
  lodEnabled: true,
  lodDetail: 1.0,
}


// ============================================================================
// Wythoff Polytope Configuration
// ============================================================================

/**
 * Symmetry group type for Wythoff construction
 * - A: Simplex symmetry (An) - n! symmetry operations
 * - B: Hypercube/Orthoplex symmetry (Bn/Cn) - 2^n * n! symmetry operations
 * - D: Demihypercube symmetry (Dn) - 2^(n-1) * n! symmetry operations
 */
export type WythoffSymmetryGroup = 'A' | 'B' | 'D'

/**
 * Preset Wythoff polytope types with descriptive names
 */
export type WythoffPreset =
  | 'regular'        // Regular polytope (first node ringed)
  | 'rectified'      // Rectified (second node ringed)
  | 'truncated'      // Truncated (first two nodes ringed)
  | 'cantellated'    // Cantellated (first and third nodes ringed)
  | 'runcinated'     // Runcinated (first and last nodes ringed)
  | 'omnitruncated'  // All nodes ringed
  | 'custom'         // Custom Wythoff symbol

/**
 * Configuration for Wythoff polytope generation
 *
 * Wythoff polytopes are uniform polytopes generated by the Wythoff construction,
 * which reflects a seed point through a system of mirrors arranged according
 * to a Coxeter-Dynkin diagram.
 *
 * @see https://en.wikipedia.org/wiki/Wythoff_construction
 */
export interface WythoffPolytopeConfig {
  /**
   * Symmetry group determines the mirror arrangement:
   * - A: Simplex group (generates simplex-based forms)
   * - B: Hypercube group (generates hypercube/cross-polytope forms)
   * - D: Demihypercube group (generates half-hypercube forms)
   */
  symmetryGroup: WythoffSymmetryGroup

  /**
   * Preset type provides common Wythoff symbol configurations:
   * - regular: First node ringed (standard regular polytope)
   * - rectified: Second node ringed (edge-truncated form)
   * - truncated: First two nodes ringed (vertex-truncated form)
   * - cantellated: First and third nodes ringed
   * - runcinated: First and last nodes ringed
   * - omnitruncated: All nodes ringed (maximum vertex count)
   * - custom: User-defined Wythoff symbol
   */
  preset: WythoffPreset

  /**
   * Custom Wythoff symbol (only used when preset is 'custom').
   * Each boolean indicates whether the corresponding node is "ringed"
   * in the Coxeter-Dynkin diagram.
   */
  customSymbol: boolean[]

  /**
   * Scale factor for the polytope (0.5-5.0, default 2.0).
   * Vertices are normalized to fit within [-scale, scale] per axis.
   */
  scale: number

  /**
   * Enable snub variant (alternated omnitruncation).
   * Creates chiral forms with fewer vertices.
   * Only effective for certain configurations.
   */
  snub: boolean
}

/**
 * Default Wythoff polytope configuration
 */
export const DEFAULT_WYTHOFF_POLYTOPE_CONFIG: WythoffPolytopeConfig = {
  symmetryGroup: 'B',
  preset: 'regular',
  customSymbol: [],
  scale: 2.0,
  snub: false,
}

/**
 * Type-specific default scales for Wythoff polytopes based on preset.
 * Different presets look best at different initial scales.
 */
export const DEFAULT_WYTHOFF_SCALES: Record<WythoffPreset, number> = {
  regular: 2.0,
  rectified: 2.2,
  truncated: 2.5,
  cantellated: 2.5,
  runcinated: 2.5,
  omnitruncated: 3.0,
  custom: 2.0,
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
  /** Configuration for Wythoff polytope generation */
  wythoffPolytope: WythoffPolytopeConfig
  /** Configuration for root system generation */
  rootSystem: RootSystemConfig
  /** Configuration for Clifford torus generation */
  cliffordTorus: CliffordTorusConfig
  /** Configuration for Nested torus generation */
  nestedTorus: NestedTorusConfig
  /** Configuration for Mandelbulb set generation */
  mandelbulb: MandelbulbConfig
  /** Configuration for Quaternion Julia fractal generation */
  quaternionJulia: QuaternionJuliaConfig
  /** Configuration for Schroedinger fractal generation */
  schroedinger: SchroedingerConfig
}

/**
 * Default parameters for all object types
 */
export const DEFAULT_EXTENDED_OBJECT_PARAMS: ExtendedObjectParams = {
  polytope: DEFAULT_POLYTOPE_CONFIG,
  wythoffPolytope: DEFAULT_WYTHOFF_POLYTOPE_CONFIG,
  rootSystem: DEFAULT_ROOT_SYSTEM_CONFIG,
  cliffordTorus: DEFAULT_CLIFFORD_TORUS_CONFIG,
  nestedTorus: DEFAULT_NESTED_TORUS_CONFIG,
  mandelbulb: DEFAULT_MANDELBROT_CONFIG,
  quaternionJulia: DEFAULT_QUATERNION_JULIA_CONFIG,
  schroedinger: DEFAULT_SCHROEDINGER_CONFIG,
}
