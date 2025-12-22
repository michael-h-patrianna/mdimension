/**
 * GPU Transform Shaders
 *
 * Provides N-dimensional transformation utilities for vertex shaders.
 */

export {
  DEPTH_NORMALIZATION_BASE_DIMENSION,
  EXTRA_DIMS_SIZE,
  MAX_GPU_DIMENSION,
  calculateDepthNormalizationFactor,
  createNDTransformUniforms,
  generateDepthNormalizationGLSL,
  generateNDTransformFragmentShader,
  generateNDTransformVertexShader,
  matrixToGPUUniforms,
  updateNDTransformUniforms,
} from './ndTransform'
