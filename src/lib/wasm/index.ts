/**
 * WASM Services
 *
 * This module provides high-performance WASM-accelerated functions
 * for the animation loop and other CPU-intensive operations.
 */

export {
  // Initialization
  initAnimationWasm,
  isAnimationWasmReady,
  getWasmError,
  // Phase 1: Animation functions
  composeRotationsWasm,
  projectVerticesWasm,
  projectEdgesWasm,
  multiplyMatrixVectorWasm,
  applyRotationWasm,
  // Phase 2: Matrix and vector functions
  multiplyMatricesWasm,
  dotProductWasm,
  magnitudeWasm,
  normalizeVectorWasm,
  subtractVectorsWasm,
  distanceWasm,
  distanceSquaredWasm,
  // Data conversion helpers
  matrixToFloat64,
  float64ToMatrix,
  vectorToFloat64,
  float64ToVector,
  flattenVertices,
  flattenEdges,
} from './animation-wasm'
