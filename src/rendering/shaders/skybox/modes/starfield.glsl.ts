export const starfieldBlock = `
// Stellar Spectral Class Colors for Starfield
// Maps temperature value (0-1) to realistic star colors
// O/B (hot blue) -> A (white) -> F/G (yellow) -> K (orange) -> M (red)
vec3 getSpectralColor(float temp, float variation) {
    // Reduce variation based on variation parameter
    float t = mix(0.5, temp, variation);

    vec3 starCol;
    if (t < 0.15) {
        // O/B class - Blue-white (hot)
        starCol = vec3(0.7, 0.8, 1.0);
    } else if (t < 0.35) {
        // A class - White
        starCol = vec3(0.95, 0.95, 1.0);
    } else if (t < 0.55) {
        // F class - Yellow-white
        starCol = vec3(1.0, 0.98, 0.9);
    } else if (t < 0.75) {
        // G class - Yellow (sun-like)
        starCol = vec3(1.0, 0.95, 0.8);
    } else if (t < 0.9) {
        // K class - Orange
        starCol = vec3(1.0, 0.8, 0.6);
    } else {
        // M class - Red (cool)
        starCol = vec3(1.0, 0.6, 0.5);
    }
    return starCol;
}

// Mode 8: Starfield - High-quality astronomical starfield
// Features: magnitude classes, spectral colors, glow halos, natural twinkling
vec3 getStarfield(vec3 dir, float time) {
    // === BACKGROUND ===
    // Deep space background with subtle color from palette
    vec3 bg;
    if (uUsePalette > 0.5) {
        bg = cosinePalette(0.0, uPalA, uPalB, uPalC, uPalD) * 0.02;
    } else {
        bg = uColor1 * 0.02;
    }
    bg = max(bg, vec3(0.005, 0.005, 0.015)); // Ensure deep space darkness

    // Subtle nebula dust clouds in background (controlled by complexity)
    vec3 col = bg;
    if (uComplexity > 0.01) {
        float nebulaValue = fbm(dir * 1.5 + uEvolution * 2.0, 3);
        vec3 nebulaColor;
        if (uUsePalette > 0.5) {
            nebulaColor = cosinePalette(nebulaValue * 0.5 + 0.25, uPalA, uPalB, uPalC, uPalD);
        } else {
            nebulaColor = mix(uColor1, uColor2, nebulaValue);
        }
        // Nebula intensity based on complexity
        float nebulaIntensity = smoothstep(0.3, 0.7, nebulaValue) * 0.08 * uComplexity;
        col += nebulaColor * nebulaIntensity;
    }

    // === STAR RENDERING ===
    // Density threshold - maps uStarDensity (0-1) to probability threshold
    // Lower threshold = more stars. Range 0.6 to 0.95 for good visual density.
    float densityThreshold = 0.95 - uStarDensity * 0.35;

    // Base size for star point spread function, also affected by scale
    float baseSize = (0.03 + uStarSize * 0.08) * (0.5 + uScale * 0.5); // 0.03 to 0.11, scaled

    // Multiple star layers for depth and parallax (4 layers for full starfield)
    for (int layer = 0; layer < 4; layer++) {
        // Layer configuration
        float layerScale = 40.0 + float(layer) * 25.0; // 40, 65, 90, 115
        float layerSpeed = 0.0005 * float(layer + 1);
        float layerDensityMod = float(layer) * 0.015; // More stars in distant layers
        float layerBrightnessMod = 1.0 - float(layer) * 0.2; // Dimmer distant stars

        // Parallax motion
        vec3 starDir = dir;
        starDir.x += time * layerSpeed * (float(layer) - 1.5);
        starDir.y += time * layerSpeed * 0.3 * sin(float(layer) * 1.3);

        // Grid cell coordinates
        vec3 starCoord = starDir * layerScale;
        vec3 starCell = floor(starCoord);
        vec3 starFract = fract(starCoord);

        // Star presence based on hash
        float starRand = hash(starCell);
        float threshold = densityThreshold - layerDensityMod;

        if (starRand > threshold) {
            // === STAR PROPERTIES ===

            // Position within cell (centered)
            vec3 starOffset = vec3(
                hash(starCell + 1.0),
                hash(starCell + 2.0),
                hash(starCell + 3.0)
            ) * 0.7 + 0.15;
            float dist = length(starFract - starOffset);

            // Magnitude class (1-6 scale, lower = brighter)
            // Bright stars are rare, dim stars are common
            float magRand = hash(starCell + 5.0);
            float magnitude = 1.0 + pow(magRand, 0.3) * 5.0; // 1.0 to 6.0

            // Size based on magnitude (bright stars appear larger)
            float starSize = baseSize * (1.5 - magnitude * 0.15);
            starSize *= layerBrightnessMod;

            // Core brightness (sharp center)
            float core = smoothstep(starSize, starSize * 0.1, dist);

            // Glow halo (soft falloff for bright stars)
            float glowSize = starSize * (3.0 + (6.0 - magnitude) * 0.5);
            float glow = smoothstep(glowSize, 0.0, dist);
            glow = pow(glow, 2.5) * (7.0 - magnitude) / 6.0; // Brighter stars have more glow

            // === TWINKLING (Scintillation) ===
            // Combined twinkle: primary frequency dominates, secondary adds texture
            float twinklePhase = hash(starCell + 7.0) * TAU;
            float twinkleBase = time * 2.0 + twinklePhase;
            float twinkle = 1.0 + sin(twinkleBase) * (0.15 + 0.08 * sin(twinkleBase * 2.65) + 0.05 * sin(twinkleBase * 5.85)) * uStarTwinkle;

            // Bright stars twinkle less (atmospheric physics)
            twinkle = mix(1.0, twinkle, magnitude / 6.0);

            // === COLOR ===
            float tempRand = hash(starCell + 10.0);
            vec3 spectralColor = getSpectralColor(tempRand, uStarColorVariation);

            // Blend with palette colors if enabled
            vec3 starColor;
            if (uUsePalette > 0.5) {
                vec3 paletteColor = cosinePalette(tempRand, uPalA, uPalB, uPalC, uPalD);
                // Mix spectral physics with artistic palette
                starColor = mix(spectralColor, paletteColor, 0.4);
            } else {
                // Blend user colors with spectral base
                vec3 userBlend = mix(uColor1, uColor2, tempRand);
                starColor = mix(spectralColor, userBlend, 0.5);
            }

            // Ensure minimum visibility
            starColor = max(starColor, vec3(0.3));

            // === FINAL STAR INTENSITY ===
            // Magnitude to brightness (astronomical scale: each magnitude is ~2.5x dimmer)
            float baseBrightness = pow(2.512, 3.0 - magnitude); // Magnitude 3 = 1.0

            // Combine core + glow
            float coreIntensity = core * baseBrightness * twinkle;
            float glowIntensity = glow * baseBrightness * 0.3 * uStarGlow;

            // Apply overall brightness control (complexity adds extra glow)
            float complexityBoost = 1.0 + uComplexity * 0.3;
            float totalIntensity = (coreIntensity + glowIntensity) * uStarBrightness * layerBrightnessMod * complexityBoost;

            // Add to accumulator
            col += starColor * totalIntensity;
        }
    }

    // === AMBIENT SPACE GLOW ===
    // Subtle directional glow suggesting galactic plane
    // PERF: Use multiplications instead of pow(x, 4.0)
    float galacticT = 1.0 - abs(dir.y);
    float galacticT2 = galacticT * galacticT;
    float galacticGlow = galacticT2 * galacticT2 * 0.015;
    if (uUsePalette > 0.5) {
        col += cosinePalette(0.5, uPalA, uPalB, uPalC, uPalD) * galacticGlow * uComplexity;
    } else {
        col += mix(uColor1, uColor2, 0.5) * galacticGlow * uComplexity;
    }

    return col;
}
`;
