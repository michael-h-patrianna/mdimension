export const sunBlock = `
// Sun Glow (Directional Light)
vec3 applySun(vec3 col, vec3 dir) {
    if (uSunIntensity > 0.0) {
        // Guard against zero-length sun position
        float sunLen = length(uSunPosition);
        vec3 sunDir = sunLen > 0.0001 ? uSunPosition / sunLen : vec3(0.0, 1.0, 0.0);
        float sunDot = max(0.0, dot(dir, sunDir));
        float sunGlow = pow(sunDot, 8.0); // sharp glow
        col += vec3(1.0, 0.9, 0.7) * sunGlow * uSunIntensity;
    }
    return col;
}
`;
