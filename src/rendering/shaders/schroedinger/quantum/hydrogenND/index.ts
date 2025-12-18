/**
 * Hydrogen ND shader module exports
 *
 * Per-dimension modules for hydrogen orbital visualization in N dimensions.
 * Uses hybrid approach: Y_lm for first 3 dims + HO basis for extra dims.
 */

export { hydrogenNDCommonBlock } from './hydrogenNDCommon.glsl';
export { hydrogenND3dBlock } from './hydrogenND3d.glsl';
export { hydrogenND4dBlock } from './hydrogenND4d.glsl';
export { hydrogenND5dBlock } from './hydrogenND5d.glsl';
export { hydrogenND6dBlock } from './hydrogenND6d.glsl';
export { hydrogenND7dBlock } from './hydrogenND7d.glsl';
export { hydrogenND8dBlock } from './hydrogenND8d.glsl';
export { hydrogenND9dBlock } from './hydrogenND9d.glsl';
export { hydrogenND10dBlock } from './hydrogenND10d.glsl';
export { hydrogenND11dBlock } from './hydrogenND11d.glsl';
