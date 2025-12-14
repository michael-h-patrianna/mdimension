/**
 * PointCloud Shaders and Scene
 *
 * GLSL shaders for N-dimensional point cloud rendering with GPU-accelerated
 * transformations, plus the PointCloudScene component.
 *
 * @module
 */

export { MAX_EXTRA_DIMS } from './constants'
export { buildEdgeFragmentShader } from './edgeFragment.glsl'
export { buildEdgeVertexShader } from './edgeVertex.glsl'
export {
  GLSL_ND_TRANSFORM_UNIFORMS,
  GLSL_ND_TRANSFORM_ATTRIBUTES,
  GLSL_ND_TRANSFORM_FUNCTIONS,
} from './ndTransform.glsl'
export { PointCloudScene } from './PointCloudScene'
export type { PointCloudSceneProps } from './PointCloudScene'
export { buildPointFragmentShader } from './pointFragment.glsl'
export { buildPointVertexShader } from './pointVertex.glsl'
