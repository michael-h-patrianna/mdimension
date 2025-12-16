export const opacityBlock = `
// ============================================
// Opacity Mode Functions
// ============================================

/**
 * Solid mode: fully opaque (alpha = 1.0)
 */
float calculateSolidAlpha() {
    return 1.0;
}

/**
 * Simple alpha mode: uniform transparency
 */
float calculateSimpleAlpha() {
    return uSimpleAlpha;
}

/**
 * Layered surfaces mode: calculate alpha based on ray depth and layer count
 * Creates visible depth layers by modulating alpha based on hit distance
 * @param depth - Distance from ray origin to hit point
 * @param maxDepth - Maximum ray distance (for normalization)
 */
float calculateLayeredAlpha(float depth, float maxDepth) {
    // Normalize depth to 0-1 range
    float normalizedDepth = clamp(depth / maxDepth, 0.0, 1.0);

    // Calculate which layer this hit belongs to
    float layerSize = 1.0 / float(uLayerCount);
    int layerIndex = int(normalizedDepth / layerSize);
    layerIndex = min(layerIndex, uLayerCount - 1);

    // Base alpha from layer opacity setting
    float alpha = uLayerOpacity;

    // Slight gradation: outer layers (lower index) are slightly more opaque
    // This creates visual depth distinction between layers
    float layerFactor = 1.0 - float(layerIndex) * 0.1;
    alpha *= layerFactor;

    return clamp(alpha, 0.1, 1.0);
}

/**
 * Volumetric density mode: cloud-like accumulation based on distance in volume
 * @param distanceInVolume - How far the ray traveled inside the fractal volume
 */
float calculateVolumetricAlpha(float distanceInVolume) {
    // Determine sample quality (affects density accumulation rate)
    // Higher quality = more samples = smoother gradients
    float densityMultiplier = 1.0;

    // Check if we should reduce quality during animation
    bool reduceQuality = uFastMode && uVolumetricReduceOnAnim;

    if (reduceQuality) {
        // Reduced quality during animation for performance
        densityMultiplier = 0.5;
    } else {
        // Apply sample quality setting
        if (uSampleQuality == 0) {
            densityMultiplier = 0.6;  // Low: less dense
        } else if (uSampleQuality == 2) {
            densityMultiplier = 1.5;  // High: more dense
        }
        // Medium (1) stays at 1.0
    }

    // Beer-Lambert law for volume absorption
    // alpha = 1 - exp(-density * distance)
    float effectiveDensity = uVolumetricDensity * densityMultiplier;
    float alpha = 1.0 - exp(-effectiveDensity * distanceInVolume);

    return clamp(alpha, 0.0, 1.0);
}

/**
 * Dispatch to appropriate opacity calculation based on mode
 * @param hitDist - Distance from ray origin to hit point
 * @param sphereEntry - Distance where ray enters the bounding sphere
 * @param maxDepth - Maximum possible ray distance
 */
float calculateOpacityAlpha(float hitDist, float sphereEntry, float maxDepth) {
    if (uOpacityMode == OPACITY_SOLID) {
        return calculateSolidAlpha();
    } else if (uOpacityMode == OPACITY_SIMPLE_ALPHA) {
        return calculateSimpleAlpha();
    } else if (uOpacityMode == OPACITY_LAYERED) {
        return calculateLayeredAlpha(hitDist, maxDepth);
    } else if (uOpacityMode == OPACITY_VOLUMETRIC) {
        // Calculate distance traveled inside the bounding sphere
        float distanceInVolume = hitDist - max(0.0, sphereEntry);
        return calculateVolumetricAlpha(distanceInVolume);
    }
    // Fallback to solid
    return 1.0;
}
`;
