export const normalBlock = `
// Standard normal calculation (4 SDF evaluations)
vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(0.001, 0);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

// Faster normal calculation with larger epsilon (smoother but faster)
vec3 GetNormalFast(vec3 p) {
    vec2 e = vec2(0.005, 0);  // Larger epsilon = fewer iterations needed
    float d = GetDist(p);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}
`;
