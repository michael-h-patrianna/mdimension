/**
 * Skybox-specific precision block
 *
 * CRITICAL FIX: Must output to all 3 MRT locations to prevent GL_INVALID_OPERATION
 * when the skybox mesh is in the scene and any MRT pass renders. Even though skybox
 * is on a separate layer (SKYBOX = 2) and should only render during ScenePass
 * (single attachment), having incomplete outputs can cause driver issues.
 *
 * Extra outputs (gNormal, gPosition) are safely ignored when rendering to
 * single-attachment targets.
 *
 * See: docs/bugfixing/log/2025-12-21-schroedinger-temporal-gl-invalid-operation.md
 */
export const skyboxPrecisionBlock = `
precision highp float;

// MRT outputs - must output to all 3 locations for compatibility
// Extra outputs are safely ignored when rendering to single-attachment targets
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gPosition;
`
