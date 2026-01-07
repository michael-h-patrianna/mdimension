/**
 * TSL Normal Computation System
 *
 * Provides two normal computation modes for polytope rendering:
 *
 * 1. Geometry-based (dim < 7): Compute normals from triangle vertices
 *    - Requires all 3 vertices transformed through N-D pipeline
 *    - Passed via flat varying to fragment shader
 *    - Exact normals with no edge artifacts
 *
 * 2. Screen-space (dim >= 7): Compute normals from dFdx/dFdy
 *    - Only THIS vertex transformed (67% fewer transforms)
 *    - Normal computed in fragment shader
 *    - Minor 1-2 pixel edge artifacts
 *
 * @module rendering/tsl/normals
 */

// Geometry-based normals (low dimensions)
export {
  computeFaceNormal,
  computeVertexNormal,
  ensureNormalFacingViewer,
  transformNormalByMat3,
  transformNormalToWorld,
} from './geometry-normals'

// Screen-space normals (high dimensions)
export {
  computeScreenSpaceNormal,
  computeScreenSpaceNormalHQ,
  computeScreenSpaceNormalTwoSided,
  computeSmoothEdgeNormal,
  detectTriangleEdge,
  SCREEN_SPACE_NORMAL_MIN_DIMENSION,
} from './screen-space-normals'
