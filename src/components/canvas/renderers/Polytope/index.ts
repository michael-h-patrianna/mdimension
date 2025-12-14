/**
 * Polytope Shaders and Scene
 *
 * GLSL shaders for N-dimensional polytope rendering with GPU-accelerated
 * transformations and lighting, plus the PolytopeScene component.
 *
 * @module
 */

export { MAX_EXTRA_DIMS } from './constants'
export { buildEdgeFragmentShader } from './edgeFragment.glsl'
export { buildEdgeVertexShader } from './edgeVertex.glsl'
export { buildFaceFragmentShader } from './faceFragment.glsl'
export { buildFaceVertexShader } from './faceVertex.glsl'
export { PolytopeScene } from './PolytopeScene'
export type { PolytopeSceneProps } from './PolytopeScene'
