export const voidBlock = `
// Mode 3: Void (Meditative Radial Gradient)
// Subtle, contemplative environment with soft radial glow
vec3 getVoid(vec3 dir, float time) {
    // Spherical mapping for smooth gradients
    float phi = asin(clamp(dir.y, -1.0, 1.0)); // -PI/2 to PI/2
    float theta = atan(dir.x, dir.z);

    // Create a soft radial gradient from a focus point
    // Guard against zero-length sun position
    float sunLen = length(uSunPosition);
    vec3 focusDir = sunLen > 0.0001 ? uSunPosition / sunLen : vec3(0.0, 1.0, 0.0);
    float focusDist = 1.0 - max(0.0, dot(dir, focusDir));

    // Multiple soft gradient layers for depth
    // PERF: Use multiplications instead of pow()
    float t1 = 1.0 - focusDist;
    float layer1 = t1 * t1; // Bright center (pow 2)
    float t2 = 1.0 - focusDist * 0.7;
    float layer2 = t2 * t2 * t2; // Soft outer glow (pow 3)
    float layer3 = smoothstep(1.0, 0.0, focusDist * 1.5); // Wide ambient

    // Subtle breathing animation
    float breathe = sin(time * 0.3) * 0.05 + 1.0;
    layer1 *= breathe;

    // Very subtle noise for organic feel (not harsh)
    float subtleNoise = noise(dir * 3.0 + time * 0.1) * 0.03 * uComplexity;

    // Combine layers
    float gradient = layer1 * 0.4 + layer2 * 0.3 + layer3 * 0.3 + subtleNoise;
    gradient *= uScale;

    // Color application
    vec3 col;
    if (uUsePalette > 0.5) {
        // Deep background from palette dark end
        vec3 deepColor = cosinePalette(0.0, uPalA, uPalB, uPalC, uPalD) * 0.15;
        // Glow color from palette bright end
        vec3 glowColor = cosinePalette(0.7, uPalA, uPalB, uPalC, uPalD);
        // Mid-tone for transition
        vec3 midColor = cosinePalette(0.35, uPalA, uPalB, uPalC, uPalD) * 0.5;

        // Smooth 3-color gradient
        col = mix(deepColor, midColor, smoothstep(0.0, 0.3, gradient));
        col = mix(col, glowColor, smoothstep(0.2, 0.8, gradient) * uSunIntensity + layer1 * 0.3);
    } else {
        // Use user colors: color1 = deep, color2 = glow
        vec3 deepColor = uColor1 * 0.15;
        vec3 midColor = mix(uColor1, uColor2, 0.3) * 0.5;
        vec3 glowColor = uColor2;

        col = mix(deepColor, midColor, smoothstep(0.0, 0.3, gradient));
        col = mix(col, glowColor, smoothstep(0.2, 0.8, gradient) * uSunIntensity + layer1 * 0.3);
    }

    // Subtle vignette toward edges
    // PERF: Use multiplications instead of pow(x, 4.0)
    float absY = abs(dir.y);
    float absY2 = absY * absY;
    float edgeFade = 1.0 - absY2 * absY2 * 0.3;
    col *= edgeFade;

    return col;
}
`;
