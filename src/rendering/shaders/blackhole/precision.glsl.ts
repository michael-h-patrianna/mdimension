/**
 * Black Hole Precision Block
 *
 * Conditional MRT output declarations for black hole shader.
 * When USE_SINGLE_TARGET is defined, only gColor is declared.
 * This prevents GL errors when rendering to single-attachment targets.
 *
 * @module rendering/shaders/blackhole/precision
 */

export const blackholePrecisionBlock = /* glsl */ `
precision highp float;

// Output declarations for WebGL2 MRT (Multiple Render Targets)
//
// CONDITIONAL MRT OUTPUTS:
// When USE_SINGLE_TARGET is defined (rendering to single-attachment target),
// only gColor is declared to prevent GL_INVALID_OPERATION errors.
// Without this, writing to location 1/2 on single-attachment targets causes
// undefined behavior and can result in alpha channel issues.
//
// Layout:
//   location 0 = Color (RGB + alpha) - ALWAYS declared
//   location 1 = Normal (view-space normal * 0.5 + 0.5, metallic in alpha) - MRT only
//   location 2 = Position (world position for temporal reprojection) - MRT only

layout(location = 0) out vec4 gColor;

#ifndef USE_SINGLE_TARGET
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gPosition;
#endif
`
