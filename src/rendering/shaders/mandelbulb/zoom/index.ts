/**
 * Zoom shader modules for Mandelbulb fractal rendering
 *
 * Provides zoom functionality through:
 * - uniforms: uZoomEnabled, uZoom
 * - mapping: applyZoomToPosition() - scales object-space coords
 * - de-scaling: scaleDistanceForZoom() - fixes raymarching distances
 *
 * Integration order in compose.ts:
 * 1. zoomUniformsBlock - after mandelbulbUniformsBlock
 * 2. zoomMappingBlock - before SDF evaluation
 * 3. zoomDeScalingBlock - after zoomMappingBlock, before raymarching
 */
export { zoomUniformsBlock } from './uniforms.glsl'
export { zoomMappingBlock } from './mapping.glsl'
export { zoomDeScalingBlock } from './de-scaling.glsl'
