export const precisionBlock = `
precision highp float;

// Output declarations for WebGL2
// When temporal accumulation is active, we render to a single-attachment target
// so only declare gColor. For normal rendering, use MRT with both outputs.
layout(location = 0) out vec4 gColor;
#ifndef USE_TEMPORAL_ACCUMULATION
layout(location = 1) out vec4 gNormal;
#endif
`;
