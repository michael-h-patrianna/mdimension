export const precisionBlock = `
precision highp float;

// Output declarations for WebGL2
// For temporal accumulation: MRT with color (loc 0) and world position (loc 1)
// For normal rendering: MRT with color (loc 0) and normal (loc 1)
layout(location = 0) out vec4 gColor;
#ifdef USE_TEMPORAL_ACCUMULATION
// World position for temporal reprojection (xyz = world pos, w = depth weight)
layout(location = 1) out vec4 gPosition;
#else
layout(location = 1) out vec4 gNormal;
#endif
`;
