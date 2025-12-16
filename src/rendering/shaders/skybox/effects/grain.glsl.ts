export const grainBlock = `
// Film Grain
vec3 applyGrain(vec3 col, vec2 uv, float time) {
    if (uGrain > 0.0) {
        float g = hash(vec3(uv * 100.0, time));
        col += (g - 0.5) * uGrain;
    }
    return col;
}
`;
