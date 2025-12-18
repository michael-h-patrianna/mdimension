export const sssBlock = `
// ============================================
// Subsurface Scattering Approximation
// ============================================

// Fast "Wrap Lighting" SSS Approximation for SDF/Volumetric objects
// approximating translucency when backlit
vec3 computeSSS(vec3 lightDir, vec3 viewDir, vec3 normal, float distortion, float power, float thickness) {
    vec3 halfSum = lightDir + normal * distortion;
    float halfLen = length(halfSum);
    // Guard against zero-length vector (rare edge case)
    vec3 halfVec = halfLen > 0.0001 ? halfSum / halfLen : vec3(0.0, 1.0, 0.0);
    // Guard pow() with clamped base and ensure power > 0
    float dotVal = clamp(dot(viewDir, -halfVec), 0.0, 1.0);
    float safePower = max(power, 0.001);
    float trans = pow(max(dotVal, 0.0001), safePower);
    // Attenuate by thickness (simulated by density or depth)
    return vec3(trans) * exp(-thickness);
}
`;
