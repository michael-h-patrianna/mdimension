/**
 * Black Hole Renderer
 *
 * Exports for the N-dimensional black hole visualization.
 */

export { default as BlackHoleMesh } from './BlackHoleMesh'
export {
  LIGHTING_MODE_MAP,
  MANIFOLD_TYPE_MAP,
  MAX_DIMENSION,
  PALETTE_MODE_MAP,
  RAY_BENDING_MODE_MAP,
} from './types'
export { useBlackHoleUniforms, type BlackHoleUniforms } from './useBlackHoleUniforms'
export { useBlackHoleUniformUpdates } from './useBlackHoleUniformUpdates'
