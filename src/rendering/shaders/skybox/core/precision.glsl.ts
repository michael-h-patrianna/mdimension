/**
 * Skybox-specific precision block
 *
 * Unlike the shared precision block used by MRT renderers (Mandelbulb, Schroedinger, BlackHole),
 * the skybox only needs a single color output. The skybox is rendered to:
 * - Single-attachment WebGLRenderTarget (main scene pass)
 * - WebGLCubeRenderTarget (for black hole lensing capture)
 *
 * Writing to undefined output locations (like gNormal at location 1) when rendering
 * to single-attachment targets is undefined behavior in WebGL2/GLSL3.
 *
 * See layers.ts: "Skybox - excluded from normal buffer (skybox normals shouldn't affect SSR)"
 */
export const skyboxPrecisionBlock = `
precision highp float;

// Single color output - skybox never writes to normal buffer
layout(location = 0) out vec4 gColor;
`
