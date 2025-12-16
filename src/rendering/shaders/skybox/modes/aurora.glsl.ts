export const auroraBlock = `
// Mode 1: Aurora (Flowing Vertical Curtains)
// Realistic aurora borealis with flowing ribbon-like curtains
vec3 getAurora(vec3 dir, float time) {
    // Spherical coordinates for proper curtain mapping
    float theta = atan(dir.x, dir.z); // Horizontal angle
    float phi = asin(clamp(dir.y, -1.0, 1.0)); // Vertical angle

    // Aurora vertical coverage controlled by uAuroraCurtainHeight
    // 0 = low aurora near horizon, 1 = aurora reaches zenith
    float heightLow = mix(-0.2, 0.1, uAuroraCurtainHeight);
    float heightHigh = mix(0.3, 0.8, uAuroraCurtainHeight);
    float auroraHeight = smoothstep(heightLow, heightHigh, dir.y);

    // Wave frequency multiplier for curtain density
    float waveFreq = uAuroraWaveFrequency;

    // Multiple curtain layers with different speeds and frequencies
    float curtain1 = 0.0;
    float curtain2 = 0.0;
    float curtain3 = 0.0;

    // Layer 1: Primary slow-moving curtains
    // Use only integer multipliers of theta for seamless wrapping
    float h1 = theta * 3.0 + uEvolution * TAU;
    float wave1 = sin(h1 + time * 0.3) * cos(theta * 2.0 + time * 0.2);
    float fold1 = sin(phi * 8.0 * waveFreq + wave1 * 2.0 * uTurbulence + time * 0.5);
    curtain1 = smoothstep(0.0, 0.8, fold1) * smoothstep(1.0, 0.3, fold1);

    // Layer 2: Secondary faster ribbons
    float h2 = theta * 5.0 + 1.5 + uEvolution * TAU;
    float wave2 = sin(h2 + time * 0.5) * cos(theta * 2.0 - time * 0.3);
    float fold2 = sin(phi * 12.0 * waveFreq + wave2 * 3.0 * uTurbulence + time * 0.7);
    curtain2 = smoothstep(0.1, 0.7, fold2) * smoothstep(0.9, 0.4, fold2);

    // Layer 3: Fine detail shimmer
    float h3 = theta * 8.0 + 3.0;
    float fold3 = sin(phi * 20.0 * waveFreq + sin(h3 + time) * uTurbulence + time * 1.2);
    curtain3 = smoothstep(0.3, 0.6, fold3) * smoothstep(0.8, 0.5, fold3) * 0.5;

    // Layer 4: Slow pulsing glow (subtle brightness variation)
    float pulse1 = sin(time * 0.15 + theta * 2.0) * 0.5 + 0.5;
    float pulse2 = sin(time * 0.23 + theta * 3.0 + 1.0) * 0.5 + 0.5;
    float pulseGlow = mix(0.85, 1.15, pulse1 * pulse2);

    // Layer 5: Horizontal drift waves (aurora bands moving laterally)
    float drift = sin(phi * 6.0 * waveFreq + time * 0.4) * sin(theta * 4.0 + time * 0.2);
    float driftLayer = smoothstep(0.2, 0.5, drift) * smoothstep(0.7, 0.4, drift) * 0.3;

    // Combine curtain layers with vertical fade
    float verticalFade = pow(clamp(dir.y + 0.2, 0.0, 1.0), 0.5);
    float bottomFade = smoothstep(-0.3, 0.2, dir.y);
    float intensity = (curtain1 * 0.45 + curtain2 * 0.30 + curtain3 * 0.12 + driftLayer * 0.13) * verticalFade * bottomFade;

    // Apply pulsing glow
    intensity *= pulseGlow;

    // Scale by user settings
    intensity *= uScale;

    // Add subtle shimmer at edges
    // Use direction vector directly for seamless noise (no theta discontinuity)
    float shimmer = noise(dir * 10.0 + vec3(0.0, 0.0, time * 2.0)) * 0.2;
    intensity += shimmer * curtain1 * uComplexity;

    // Normalize for color mapping
    float v = clamp(intensity, 0.0, 1.0);

    // Dark sky background
    vec3 nightSky = vec3(0.02, 0.02, 0.05);

    // Color Mapping with animated color drift
    vec3 auroraColor;

    // Slow color drift over time (Layer 6: color shifting)
    float colorDrift = sin(time * 0.08) * 0.15;

    if (uUsePalette > 0.5) {
        // Use Cosine Palette for aurora glow with color drift
        float paletteT = v * 0.7 + 0.15 + colorDrift;
        auroraColor = cosinePalette(paletteT, uPalA, uPalB, uPalC, uPalD);

        // Add vertical color variation (greens at bottom, purples/reds at top)
        float heightColor = smoothstep(0.0, 0.6, dir.y);
        vec3 topColor = cosinePalette(0.8 + colorDrift * 0.5, uPalA, uPalB, uPalC, uPalD);
        auroraColor = mix(auroraColor, topColor, heightColor * 0.4);
    } else {
        // Gradient from color1 (base) to color2 (tips) with drift
        float gradientT = smoothstep(0.0, 0.5, dir.y) + colorDrift;
        auroraColor = mix(uColor1, uColor2, clamp(gradientT, 0.0, 1.0));
    }

    // Final composite: dark sky + aurora glow
    vec3 col = mix(nightSky, auroraColor, intensity * auroraHeight * 1.5);

    return col;
}
`;
