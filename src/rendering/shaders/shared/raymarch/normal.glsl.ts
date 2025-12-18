export const normalBlock = `
// High-quality normal calculation using central differences (6 SDF evaluations)
// More accurate than forward differences, especially at sharp features
// Use when quality matters more than speed (static renders, paused animation)
vec3 GetNormal(vec3 p) {
    float h = 0.0005;
    vec3 n = vec3(
        GetDist(p + vec3(h, 0, 0)) - GetDist(p - vec3(h, 0, 0)),
        GetDist(p + vec3(0, h, 0)) - GetDist(p - vec3(0, h, 0)),
        GetDist(p + vec3(0, 0, h)) - GetDist(p - vec3(0, 0, h))
    );
    // Guard against zero-length normal (flat surface or numerical issues)
    float len = length(n);
    return len > 0.0001 ? n / len : vec3(0.0, 1.0, 0.0);
}

// Fast normal calculation using forward differences (4 SDF evaluations)
// ~33% faster than central differences with acceptable quality
// Use during animation and camera movement (uFastMode)
vec3 GetNormalFast(vec3 p) {
    float h = 0.001;
    float d0 = GetDist(p);
    vec3 n = vec3(
        GetDist(p + vec3(h, 0, 0)) - d0,
        GetDist(p + vec3(0, h, 0)) - d0,
        GetDist(p + vec3(0, 0, h)) - d0
    );
    // Guard against zero-length normal (flat surface or numerical issues)
    float len = length(n);
    return len > 0.0001 ? n / len : vec3(0.0, 1.0, 0.0);
}
`;
