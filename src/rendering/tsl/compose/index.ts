/**
 * TSL Composition System Index
 *
 * Re-exports the entire TSL composition system including:
 * - Type definitions
 * - Compose helpers (feature flag processing, node composition)
 * - Feature blocks (shadows, AO, SSS, fresnel)
 *
 * @module rendering/tsl/compose
 */

// Types
export * from './types'

// Compose helpers
export {
  processFeatureFlags,
  processMeshFeatureFlags,
  composeTSLNodes,
  selectDimensionSDF,
  getDimensionConfig,
} from './compose-helpers'

// Feature blocks - explicit exports to avoid duplicate type exports
// NOTE: createHardShadowNode removed during WebGL parity work (not in WebGL)
export {
  createSoftShadowNode,
  type ShadowUniforms as ShadowUniformsBlock,
} from './feature-blocks/shadows'
export {
  createAONode,
  type AOUniforms,
} from './feature-blocks/ao'
// NOTE: createSSSNodeSimple removed during WebGL parity work (not in WebGL)
export {
  createSSSNode,
  sssHash,
  type SSSUniforms as SSSUniformsBlock,
} from './feature-blocks/sss'
export {
  createFresnelNode,
} from './feature-blocks/fresnel'

