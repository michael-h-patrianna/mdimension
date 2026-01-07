/**
 * TSL Quantum Math Module Index
 *
 * Exports quantum mechanics utilities for Schrödinger wavefunction computation:
 * - Complex number operations
 * - Hermite polynomials
 * - Laguerre polynomials
 * - Legendre polynomials
 * - Spherical harmonics
 * - 1D harmonic oscillator eigenfunctions
 * - N-D harmonic oscillator variants
 * - Hydrogen radial functions
 * - Hydrogen wavefunction
 * - Unified PSI evaluation
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum
 */

// Complex number operations
export {
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
} from './complex'

// Hermite polynomials
export {
  hermite,
  hermite0,
  hermite1,
  hermite2,
  hermite3,
  hermite4,
  hermite5,
  hermite6,
  selectHermite,
} from './hermite'

// Laguerre polynomials
export {
  laguerre,
  laguerreDamped,
  laguerre0,
  laguerre1,
  laguerre2,
  laguerre3,
  selectLaguerre,
} from './laguerre'

// Legendre polynomials
export { legendre, legendreP } from './legendre'

// Spherical harmonics
export {
  factorial,
  sphericalHarmonicNorm,
  sphericalHarmonic,
  realSphericalHarmonic,
  fastRealSphericalHarmonic,
} from './sphericalHarmonics'

// 1D harmonic oscillator
export { ho1D, ho1D_n0, ho1D_n1, ho1D_n2, isWithinGaussianEnvelope, selectHO1D } from './ho1d'

// N-D harmonic oscillator variants
export {
  MAX_DIM,
  MAX_TERMS,
  computeEarlyExitThreshold,
  createHONDEvaluator,
  createHONDWithUniforms,
  DIM_THRESHOLDS,
  selectHONDEvaluator,
  type HONDUniforms,
} from './hoNDVariants'

// Hydrogen radial functions
export {
  hydrogenRadialNorm,
  hydrogenRadial,
  hydrogenRadialProbability,
  hydrogenRadialMaxRadius,
} from './hydrogenRadial'

// Hydrogen wavefunction
export {
  cartesianToSpherical,
  hydrogenRadialEarlyExit,
  evalHydrogenPsi,
  evalHydrogenPsiTime,
  evalHydrogenPsiWithPhase,
  hydrogenProbabilityDensity,
} from './hydrogenPsi'

// Unified PSI evaluation
export {
  QUANTUM_MODE_HARMONIC,
  QUANTUM_MODE_HYDROGEN,
  QUANTUM_MODE_HYDROGEN_ND,
  createHarmonicOscillatorPsi,
  createUnifiedPsi,
  createPsiWithSpatialPhase,
  createSpatialPhase,
  type PsiUniforms,
} from './psi'

// Density field calculations
export {
  rhoFromPsi,
  sFromRho,
  densityPair,
  mapPosToND,
  createSampleDensity,
  createSampleDensityWithPhase,
  type DensityUniforms,
  type NDCoordinates,
  type PsiEvaluator,
} from './density'
