/**
 * TSL Schrödinger Module Index
 *
 * Exports quantum wavefunction visualization utilities for N-dimensional
 * Schrödinger equation rendering using TSL.
 *
 * Supports three quantum physics modes:
 * 1. HARMONIC OSCILLATOR: Superposition of HO eigenstates
 * 2. HYDROGEN ORBITAL: Hydrogen atom wavefunctions
 * 3. HYDROGEN ND: N-dimensional hydrogen-like wavefunctions
 *
 * @module rendering/tsl/raymarching/schroedinger
 */

// Quantum math utilities - explicit exports to avoid conflicts
export {
  // Complex operations
  cmul,
  cconj,
  cmod,
  cmod2,
  cexpI,
  cexp_i,
  cexp,
  cscale,
  cadd,
  csub,
  cdiv,
  cpow,
  csqrt,
  // Hermite polynomials
  hermite,
  hermite0,
  hermite1,
  hermite2,
  hermite3,
  hermite4,
  hermite5,
  hermite6,
  selectHermite,
  // Laguerre polynomials
  laguerre,
  laguerreDamped,
  laguerre0,
  laguerre1,
  laguerre2,
  laguerre3,
  selectLaguerre,
  // Legendre polynomials
  legendre,
  legendreP,
  // Spherical harmonics
  factorial,
  sphericalHarmonicNorm,
  sphericalHarmonic,
  realSphericalHarmonic,
  fastRealSphericalHarmonic,
  // 1D harmonic oscillator
  ho1D,
  ho1D_n0,
  ho1D_n1,
  ho1D_n2,
  isWithinGaussianEnvelope,
  selectHO1D,
  // N-D harmonic oscillator
  MAX_DIM,
  MAX_TERMS,
  computeEarlyExitThreshold,
  createHONDEvaluator,
  createHONDWithUniforms,
  DIM_THRESHOLDS,
  selectHONDEvaluator,
  type HONDUniforms,
  // Hydrogen radial (from quantum/hydrogenRadial)
  hydrogenRadialNorm,
  hydrogenRadial as quantumHydrogenRadial,
  hydrogenRadialProbability,
  hydrogenRadialMaxRadius,
  // Hydrogen wavefunction (from quantum/hydrogenPsi)
  cartesianToSpherical,
  hydrogenRadialEarlyExit as quantumHydrogenRadialEarlyExit,
  evalHydrogenPsi,
  evalHydrogenPsiTime,
  evalHydrogenPsiWithPhase,
  hydrogenProbabilityDensity,
  // Unified PSI
  QUANTUM_MODE_HARMONIC,
  QUANTUM_MODE_HYDROGEN,
  QUANTUM_MODE_HYDROGEN_ND,
  createHarmonicOscillatorPsi,
  createUnifiedPsi,
  createPsiWithSpatialPhase,
  createSpatialPhase,
  type PsiUniforms,
  // Density
  rhoFromPsi,
  sFromRho,
  densityPair,
  mapPosToND,
  createSampleDensity,
  createSampleDensityWithPhase,
  type DensityUniforms,
  type NDCoordinates,
  type PsiEvaluator,
} from './quantum'

// Hydrogen ND dimension-specific evaluators
export {
  selectHydrogenNDEvaluator,
  type HydrogenNDUniforms,
} from './hydrogenND'

// Volume rendering utilities
export {
  computeAlpha,
  createComputeEmissionLit,
  type EmissionUniforms,
} from './volume'

// Shader composition
export {
  composeSchroedingerTSL,
  type SchroedingerShaderConfig,
  type ComposedSchroedingerUniforms,
  type ComposedSchroedingerMaterial,
  type QuantumMode,
} from './composeSchroedingerTSL'

// Temporal cloud accumulation (Horizon-style 1/4 res reconstruction)
export {
  // Types
  type ReprojectionUniforms,
  type ReconstructionUniforms,
  type TemporalAccumulationMainUniforms,
  // Reprojection pass nodes
  createReprojectionNode,
  createReprojectionValidityNode,
  createReprojectionMaterial,
  // Reconstruction pass nodes
  createReconstructionColorNode,
  createReconstructionPositionNode,
  createReconstructionMaterial,
} from './temporal'
