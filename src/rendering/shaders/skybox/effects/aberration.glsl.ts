export const aberrationBlock = `
// Radial Chromatic Aberration (Lens style)
vec3 applyAberration(vec3 col, vec2 uv) {
    if (uAberration > 0.0) {
        // For procedural, we shift the hue slightly at edges instead of re-sampling
        float dist = distance(uv, vec2(0.5));
        if (dist > 0.3) {
           float shift = (dist - 0.3) * uAberration;
           col.r += shift;
           col.b -= shift;
        }
    }
    return col;
}
`;
