export const shadowsBlock = `
// Soft shadow calculation - traces toward light to find occlusion
float calcSoftShadowLegacy(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 24; i++) {
        if (t > maxt) break;
        float h = GetDist(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
    }
    return clamp(res, 0.0, 1.0);
}

// Quality-aware soft shadow with variable sample count and improved penumbra
// quality: 0=low(8), 1=medium(16), 2=high(24), 3=ultra(32)
// softness: 0.0-2.0 controls penumbra size (0=hard, 2=very soft)
float calcSoftShadowQuality(vec3 ro, vec3 rd, float mint, float maxt, float softness, int quality) {
    // Sample counts based on quality level
    int maxSteps = 8 + quality * 8;

    float res = 1.0;
    float t = mint;
    float ph = 1e10;

    // Softness affects penumbra size (k parameter)
    // softness=0 -> k=64 (hard shadows), softness=2 -> k=4 (very soft)
    float k = mix(64.0, 4.0, softness * 0.5);

    // Unrolled loop with max 32 iterations (ultra quality)
    for (int i = 0; i < 32; i++) {
        if (i >= maxSteps || t > maxt) break;

        float h = GetDist(ro + rd * t);
        if (h < 0.001) return 0.0;

        // Improved soft shadow technique (Inigo Quilez)
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));
        ph = h;

        t += clamp(h, 0.02, 0.25);
    }
    return clamp(res, 0.0, 1.0);
}
`;
