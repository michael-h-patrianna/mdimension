export const dispatchBlock = `
// ============================================
// SDF Dispatcher
// ============================================

float GetDistWithTrap(vec3 pos, out float trap) {
    float pwr = getEffectivePower();
    float bail = max(uEscapeRadius, 2.0);
    // Calculate iteration limit based on performance mode and quality multiplier
    int maxIterLimit;
    if (uFastMode) {
        maxIterLimit = MAX_ITER_LQ;
    } else {
        float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
        maxIterLimit = int(mix(float(MAX_ITER_LQ), float(MAX_ITER_HQ), t));
    }
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    return sdfJulia3D(pos, pwr, bail, maxIt, trap);
}

float GetDist(vec3 pos) {
    float pwr = getEffectivePower();
    float bail = max(uEscapeRadius, 2.0);
    int maxIterLimit = uFastMode ? MAX_ITER_LQ : MAX_ITER_HQ;
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    return sdfJulia3D_simple(pos, pwr, bail, maxIt);
}
`;
