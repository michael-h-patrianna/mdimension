export const nebulaBlock = `
// Mode 2: Nebula (Multi-Layer Volumetric Clouds)
// Deep space nebula with emission regions, dust lanes, and embedded stars
vec3 getNebula(vec3 dir, float time) {
    vec3 p = dir * uScale * 2.0;

    // Slow drift animation
    p.x -= time * 0.05;
    p.z += time * 0.03;

    // Evolution offset
    p += uEvolution * 3.0;

    // --- Layer 1: Deep background (large scale structure) ---
    vec3 bgCoord = p * 0.5;
    bgCoord.x += fbm(p * 0.3 + time * 0.02, 2) * uTurbulence * 0.5;
    float bgDensity = fbm(bgCoord, 3);
    bgDensity = smoothstep(0.3, 0.7, bgDensity);

    // --- Layer 2: Mid-ground emission clouds ---
    vec3 midCoord = p * 1.0;
    midCoord += fbm(p + vec3(time * 0.1, 0.0, 0.0), 2) * uTurbulence;
    int octaves = int(mix(2.0, 5.0, uComplexity));
    float midDensity = fbm(midCoord, octaves);
    midDensity = smoothstep(0.25, 0.75, midDensity);

    // --- Layer 3: Fine detail/dust lanes (absorption) ---
    vec3 dustCoord = p * 2.5 + vec3(0.0, time * 0.02, 0.0);
    float dustDensity = fbm(dustCoord, 3);
    dustDensity = smoothstep(0.4, 0.6, dustDensity);

    // --- Layer 4: Bright emission knots ---
    vec3 knotCoord = p * 3.0;
    float knotNoise = noise(knotCoord + time * 0.05);
    float knots = pow(smoothstep(0.6, 0.9, knotNoise), 3.0) * uComplexity;

    // Combine density layers
    float totalDensity = bgDensity * 0.3 + midDensity * 0.5 + knots * 0.3;
    float absorption = dustDensity * 0.4; // Dark lanes reduce brightness

    // Coloring with depth variation
    vec3 col;
    if (uUsePalette > 0.5) {
        // Background: dark palette color
        vec3 deepColor = cosinePalette(0.1, uPalA, uPalB, uPalC, uPalD) * 0.1;
        // Mid emission: primary palette range
        vec3 emissionColor = cosinePalette(midDensity * 0.6 + 0.2, uPalA, uPalB, uPalC, uPalD);
        // Bright knots: palette highlight
        vec3 knotColor = cosinePalette(0.85, uPalA, uPalB, uPalC, uPalD) * 1.5;
        // Dust: darker tint
        vec3 dustColor = cosinePalette(0.3, uPalA, uPalB, uPalC, uPalD) * 0.3;

        // Composite layers
        col = deepColor;
        col = mix(col, emissionColor, midDensity * 0.8);
        col = mix(col, dustColor, absorption * (1.0 - midDensity));
        col += knotColor * knots;

        // Darken void regions
        col *= smoothstep(0.0, 0.4, totalDensity) * 0.7 + 0.3;
    } else {
        // Non-palette mode with user colors
        vec3 deepColor = uColor1 * 0.1;
        vec3 emissionColor = mix(uColor1, uColor2, midDensity);
        vec3 knotColor = uColor2 * 1.5;

        col = deepColor;
        col = mix(col, emissionColor, midDensity * 0.8);
        col = mix(col, uColor1 * 0.2, absorption * (1.0 - midDensity));
        col += knotColor * knots;

        col *= smoothstep(0.0, 0.4, totalDensity) * 0.7 + 0.3;
    }

    return col;
}
`;
