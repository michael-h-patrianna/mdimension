/**
 * Animation utilities for N-dimensional visualization
 */

export {
  GOLDEN_RATIO,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
  MAX_DEVIATION,
  getPlaneMultiplier,
  getAllPlaneMultipliers,
  getAverageMultiplier,
} from './biasCalculation'

export {
  type OriginDriftConfig,
  DEFAULT_ORIGIN_DRIFT_CONFIG,
  computeDriftedOrigin,
  computeDriftedOriginInPlace,
  getDimensionFrequency,
  getDimensionPhase,
} from './originDrift'

export {
  type DimensionMixConfig,
  DEFAULT_DIMENSION_MIX_CONFIG,
  computeMixingMatrix,
  computeMixingMatrixInPlace,
  extract3DMatrix,
  estimateMatrixScale,
  generateGLSLMixingFunction,
} from './dimensionMix'
