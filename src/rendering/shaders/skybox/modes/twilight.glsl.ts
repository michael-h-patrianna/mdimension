export const twilightBlock = `
// Mode 7: Twilight - Sunset/sunrise gradient with atmospheric layers
// Warm and cool tones that slowly evolve
vec3 getTwilight(vec3 dir, float time) {
    // Vertical position
    float y = dir.y;

    // Time-based color temperature shift (very slow, continuous)
    float tempShift = sin(time * 0.02) * 0.5 + 0.5;

    // Horizontal position for sun placement
    float sunAngle = time * 0.01 + uEvolution;
    vec3 sunDir = normalize(vec3(cos(sunAngle), 0.1, sin(sunAngle)));
    float sunDist = 1.0 - max(0.0, dot(dir, sunDir));

    // Atmospheric scattering simulation (simplified)
    float scatter = pow(1.0 - abs(y), 2.0);

    // Create layered gradient
    float gradientY = y * 0.5 + 0.5;

    // Color layers
    vec3 col;
    if (uUsePalette > 0.5) {
        // Use palette with temperature variation
        float palettePos = gradientY + tempShift * 0.2 - 0.1;
        palettePos = clamp(palettePos, 0.0, 1.0);

        vec3 skyColor = cosinePalette(palettePos, uPalA, uPalB, uPalC, uPalD);
        vec3 horizonColor = cosinePalette(0.5 + tempShift * 0.3, uPalA, uPalB, uPalC, uPalD);

        col = mix(horizonColor, skyColor, pow(abs(y), 0.5));

        // Sun glow
        float sunGlow = pow(max(0.0, dot(dir, sunDir)), 4.0);
        vec3 sunColor = cosinePalette(tempShift, uPalA, uPalB, uPalC, uPalD) * 1.5;
        col = mix(col, sunColor, sunGlow * 0.5);
    } else {
        // Manual gradient using user colors
        vec3 topColor = mix(uColor1, uColor2, tempShift);
        vec3 horizonColor = mix(uColor2, uColor1, tempShift) * 1.2;
        vec3 bottomColor = uColor1 * 0.3;

        if (y > 0.0) {
            col = mix(horizonColor, topColor, pow(y, 0.7));
        } else {
            col = mix(horizonColor, bottomColor, pow(-y, 0.5));
        }

        // Sun glow using brighter blend of user colors
        float sunGlow = pow(max(0.0, dot(dir, sunDir)), 4.0);
        vec3 sunColor = mix(uColor2, uColor1, tempShift) * 1.5;
        col = mix(col, sunColor, sunGlow * 0.5);
    }

    // Subtle atmospheric layers (horizontal bands)
    float layers = sin(y * 20.0 + noise(dir * 3.0) * 2.0) * 0.02;
    col += layers * scatter;

    // Atmospheric dust/haze
    float haze = scatter * noise(dir * 5.0 + time * 0.01) * 0.1;
    col = mix(col, col * 1.2, haze);

    return col;
}
`;
