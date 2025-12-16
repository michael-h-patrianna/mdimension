/**
 * Type definitions for extended n-dimensional objects
 *
 * Configuration interfaces for:
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

  // === Power Animation (Hyperbulb-specific) ===

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

  // === Alternate Power (Hyperbulb variant of Technique B) ===

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
   * For 4D+ Hyperbulbs, animates which 3D cross-section is visible,
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

  // === Julia Morphing ===

  /**
   * Enable/disable Julia mode with animated constant.
   * Instead of z = z^n + samplePoint, uses z = z^n + juliaC
   * where juliaC orbits through space.
   */
  juliaModeEnabled: boolean

  /**
   * Speed of Julia constant orbit (0.01 to 0.1, default 0.02).
   * Controls how fast the Julia constant moves through space.
   */
  juliaOrbitSpeed: number

  /**
   * Radius of Julia constant orbit (0.1 to 1.5, default 0.5).
   * Controls the magnitude of the Julia constant during animation.
   */
  juliaOrbitRadius: number

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
  // Power Animation defaults (Hyperbulb-specific)
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
  // Julia Morphing defaults
  juliaModeEnabled: false,
  juliaOrbitSpeed: 0.02, // Slow orbit for smooth morphing
  juliaOrbitRadius: 0.5, // Moderate orbit radius
  // Angular Phase Shifts defaults
  phaseShiftEnabled: false,
  phaseSpeed: 0.03, // Slow phase evolution
  phaseAmplitude: 0.3, // ~17 degrees max phase shift
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
 * Julia constant animation parameters
 */
export interface JuliaConstantAnimation {
  enabled: boolean
  /** Per-component amplitude (0-1) */
  amplitude: [number, number, number, number]
  /** Per-component frequency Hz (0.01-0.5) */
  frequency: [number, number, number, number]
  /** Per-component phase offset (0-2pi) */
  phase: [number, number, number, number]
}

/**
 * Power animation parameters for Quaternion Julia
 */
export interface JuliaPowerAnimation {
  enabled: boolean
  /** Minimum power (2.0-10.0) */
  minPower: number
  /** Maximum power (2.0-16.0) */
  maxPower: number
  /** Speed in Hz (0.01-0.2) */
  speed: number
}

/**
 * Configuration for Quaternion Julia fractal generation
 *
 * Mathematical basis: z = z^n + c where z and c are quaternions
 * The Julia constant c is fixed (unlike Mandelbrot where c = initial position)
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

  // === Animation Configuration ===

  /** Julia constant path animation settings */
  juliaConstantAnimation: JuliaConstantAnimation
  /** Power morphing animation settings */
  powerAnimation: JuliaPowerAnimation
  /** Enable origin drift in extra dimensions */
  originDriftEnabled: boolean
  /** Origin drift amplitude (0.01-0.5) */
  originDriftAmplitude: number
  /** Origin drift base frequency Hz (0.01-0.5) */
  originDriftBaseFrequency: number
  /** Origin drift frequency spread (0.0-1.0) */
  originDriftFrequencySpread: number

  // === Dimension Mixing Animation (Technique A) ===

  /** Enable dimension mixing inside iteration */
  dimensionMixEnabled: boolean
  /** Mixing intensity (0.0-0.3) */
  mixIntensity: number
  /** Mixing frequency multiplier (0.1-2.0) */
  mixFrequency: number
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

  // Animation defaults
  juliaConstantAnimation: {
    enabled: false,
    amplitude: [0.3, 0.3, 0.3, 0.3],
    frequency: [0.05, 0.04, 0.06, 0.03],
    phase: [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4],
  },
  powerAnimation: {
    enabled: false,
    minPower: 2.0,
    maxPower: 8.0,
    speed: 0.03,
  },
  originDriftEnabled: false,
  originDriftAmplitude: 0.03,
  originDriftBaseFrequency: 0.04,
  originDriftFrequencySpread: 0.2,

  // Dimension Mixing defaults
  dimensionMixEnabled: false,
  mixIntensity: 0.1,
  mixFrequency: 0.5,
}

// ============================================================================
// Kali Fractal Configuration
// ============================================================================

/**
 * Kali constant animation parameters
 */
export interface KaliConstantAnimation {
  enabled: boolean
  /** Animation amplitude (0.0-0.3, Kali is sensitive) */
  amplitude: number
  /** Base frequency in Hz (0.01-0.2) */
  frequency: number
  /** Phase offset for multi-frequency motion */
  phaseOffset: number
}

/**
 * Reciprocal gain animation parameters
 */
export interface KaliGainAnimation {
  enabled: boolean
  /** Minimum gain (0.5-1.5) */
  minGain: number
  /** Maximum gain (0.8-2.0) */
  maxGain: number
  /** Oscillation speed in Hz (0.01-0.1) */
  speed: number
}

/**
 * Axis weights animation parameters
 */
export interface KaliWeightsAnimation {
  enabled: boolean
  /** Weight variation amplitude (0.0-0.5) */
  amplitude: number
}

/**
 * Configuration for Kali/Reciprocal-Abs fractal generation
 *
 * Mathematical basis: z = abs(z) / dot(z,z) + c
 * The reciprocal step creates intense nonlinear folding that produces
 * fluid, cellular, and "alive" structures.
 *
 * Supports 3D to 11D via hyperspherical generalization.
 *
 * @see docs/prd/kali-reciprocal-fractal.md
 */
export interface KaliConfig {
  // === Core Parameters ===

  /**
   * Kali constant c (n-dimensional).
   * Length matches current dimension.
   * Default: [0.5, 0.5, 0.5, 0.5] ("Coral Cells")
   * Range: -1.0 to 1.0 per component
   */
  kaliConstant: number[]

  /**
   * Reciprocal gain (0.5-2.0, default 1.0).
   * Lower = softer structures, Higher = sharper crystalline.
   * Formula: z = abs(z) / (dot(z,z) * gain + eps) + c
   */
  reciprocalGain: number

  /**
   * Axis weights for symmetry breaking.
   * Length matches current dimension, default all 1.0.
   * Range: 0.5-2.0 per axis.
   */
  axisWeights: number[]

  // === Iteration Parameters ===

  /**
   * Maximum iterations (8-64, default 20).
   * Lower than Julia due to fast divergence.
   */
  maxIterations: number

  /**
   * Bailout radius (2.0-8.0, default 4.0).
   */
  bailoutRadius: number

  /**
   * Epsilon for singularity protection (0.0001-0.01, default 0.001).
   * Prevents division by zero at origin.
   */
  epsilon: number

  // === Quality Parameters ===

  /** Scale/extent for auto-positioning (0.5-5.0, default 2.0) */
  scale: number
  /** Surface distance threshold (0.0005-0.004) */
  surfaceThreshold: number
  /** Maximum raymarch steps (64-512) */
  maxRaymarchSteps: number
  /** Quality multiplier (0.25-1.0) */
  qualityMultiplier: number

  // === D-dimensional Parameters ===

  /** Slice position in extra dimensions (length = dimension - 3) */
  parameterValues: number[]

  // === Animation Configuration ===
  // NOTE: Controls are in Timeline bottom bar, NOT geometry editor

  /** Constant path animation */
  constantAnimation: KaliConstantAnimation
  /** Reciprocal gain animation */
  gainAnimation: KaliGainAnimation
  /** Axis weights animation */
  weightsAnimation: KaliWeightsAnimation

  /** Enable origin drift in extra dimensions (4D+) */
  originDriftEnabled: boolean
  /** Origin drift amplitude (0.01-0.5) */
  originDriftAmplitude: number
  /** Origin drift base frequency Hz (0.01-0.5) */
  originDriftBaseFrequency: number
  /** Origin drift frequency spread (0.0-1.0) */
  originDriftFrequencySpread: number

  /** Enable dimension mixing inside iteration */
  dimensionMixEnabled: boolean
  /** Mixing intensity (0.0-0.3) */
  mixIntensity: number
  /** Mixing frequency multiplier (0.1-2.0) */
  mixFrequency: number
}

/**
 * Kali constant presets
 */
export interface KaliConstantPreset {
  name: string
  value: number[]
}

/**
 * Kali constant presets
 */
export const KALI_CONSTANT_PRESETS: KaliConstantPreset[] = [
  { name: 'Coral Cells', value: [0.5, 0.5, 0.5, 0.5] },
  { name: 'Sponge', value: [0.3, 0.3, 0.3, 0.3] },
  { name: 'Tubes', value: [0.7, 0.2, 0.7, 0.2] },
  { name: 'Membrane', value: [0.1, 0.1, 0.1, 0.1] },
  { name: 'Chaos', value: [0.8, -0.3, 0.5, -0.7] },
]

/**
 * Quality presets for Kali
 */
export const KALI_QUALITY_PRESETS = {
  draft: { maxIterations: 12, surfaceThreshold: 0.004, maxRaymarchSteps: 64 },
  standard: { maxIterations: 20, surfaceThreshold: 0.002, maxRaymarchSteps: 128 },
  high: { maxIterations: 40, surfaceThreshold: 0.001, maxRaymarchSteps: 256 },
  ultra: { maxIterations: 64, surfaceThreshold: 0.0005, maxRaymarchSteps: 512 },
}

/**
 * Default Kali configuration
 */
export const DEFAULT_KALI_CONFIG: KaliConfig = {
  // Core parameters
  kaliConstant: [0.5, 0.5, 0.5, 0.5],
  reciprocalGain: 1.0,
  axisWeights: [1.0, 1.0, 1.0, 1.0],

  // Iteration
  maxIterations: 20,
  bailoutRadius: 4.0,
  epsilon: 0.001,

  // Quality
  scale: 2.0,
  surfaceThreshold: 0.002,
  maxRaymarchSteps: 128,
  qualityMultiplier: 1.0,

  // D-dimensional
  parameterValues: [],

  // Constant animation
  constantAnimation: {
    enabled: false,
    amplitude: 0.1,
    frequency: 0.02,
    phaseOffset: 0,
  },

  // Gain animation
  gainAnimation: {
    enabled: false,
    minGain: 0.7,
    maxGain: 1.3,
    speed: 0.02,
  },

  // Weights animation
  weightsAnimation: {
    enabled: false,
    amplitude: 0.2,
  },

  // Origin drift
  originDriftEnabled: false,
  originDriftAmplitude: 0.1,
  originDriftBaseFrequency: 0.1,
  originDriftFrequencySpread: 0.3,

  // Dimension mixing
  dimensionMixEnabled: false,
  mixIntensity: 0.1,
  mixFrequency: 0.5,
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
  /** Configuration for Quaternion Julia fractal generation */
  quaternionJulia: QuaternionJuliaConfig
  /** Configuration for Kali fractal generation */
  kali: KaliConfig
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
  quaternionJulia: DEFAULT_QUATERNION_JULIA_CONFIG,
  kali: DEFAULT_KALI_CONFIG,
}
