export const sunBlock = `
// Sun Glow (Directional Light)
vec3 applySun(vec3 col, vec3 dir) {
    if (uSunIntensity > 0.0) {
        vec3 sunDir = normalize(uSunPosition);
        float sunDot = max(0.0, dot(dir, sunDir));
        float sunGlow = pow(sunDot, 8.0); // sharp glow
        col += vec3(1.0, 0.9, 0.7) * sunGlow * uSunIntensity;
    }
    return col;
}
`;
