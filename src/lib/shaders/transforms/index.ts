/**
 * GPU Transform Shaders
 *
 * Provides N-dimensional transformation utilities for vertex shaders.
 */

export {
  MAX_GPU_DIMENSION,
  EXTRA_DIMS_SIZE,
  matrixToGPUUniforms,
  generateNDTransformVertexShader,
  generateNDTransformFragmentShader,
  createNDTransformUniforms,
  updateNDTransformUniforms,
} from './ndTransform';
