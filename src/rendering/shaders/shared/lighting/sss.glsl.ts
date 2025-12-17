export const sssBlock = `
// ============================================
// Subsurface Scattering Approximation
// ============================================

// Fast "Wrap Lighting" SSS Approximation for SDF/Volumetric objects
// approximating translucency when backlit
vec3 computeSSS(vec3 lightDir, vec3 viewDir, vec3 normal, float distortion, float power, float thickness) {
    vec3 halfVec = normalize(lightDir + normal * distortion);
    float trans = pow(clamp(dot(viewDir, -halfVec), 0.0, 1.0), power);
    // Attenuate by thickness (simulated by density or depth)
    return vec3(trans) * exp(-thickness);
}
`;
