/**
 * N-Dimensional Geometry Library
 * Mathematical foundation for the N-Dimensional Visualizer
 *
 * This library provides:
 * - N-dimensional vector operations
 * - Matrix operations and transformations
 * - Rotation in arbitrary planes
 * - Perspective and orthographic projection from nD to 3D
 */

// Type definitions
export type { VectorND, MatrixND, Vector3D, RotationPlane } from './types';
export { EPSILON } from './types';

// Vector operations
export {
  createVector,
  addVectors,
  subtractVectors,
  scaleVector,
  dotProduct,
  magnitude,
  normalize,
  vectorsEqual,
  copyVector,
} from './vector';

// Matrix operations
export {
  createIdentityMatrix,
  createZeroMatrix,
  multiplyMatrices,
  multiplyMatrixVector,
  transposeMatrix,
  determinant,
  matricesEqual,
  copyMatrix,
  getMatrixDimensions,
} from './matrix';

// Rotation operations
export {
  getRotationPlaneCount,
  getRotationPlanes,
  getAxisName,
  createRotationMatrix,
  composeRotations,
  parsePlaneName,
  createPlaneName,
} from './rotation';

// Transformation operations
export {
  createScaleMatrix,
  createUniformScaleMatrix,
  createShearMatrix,
  createTranslationMatrix,
  translateVector,
  toHomogeneous,
  fromHomogeneous,
  composeTransformations,
  createTransformMatrix,
} from './transform';

// Projection operations
export {
  DEFAULT_PROJECTION_DISTANCE,
  MIN_SAFE_DISTANCE,
  projectPerspective,
  projectOrthographic,
  projectVertices,
  calculateDepth,
  sortByDepth,
  calculateProjectionDistance,
  clipLine,
} from './projection';
