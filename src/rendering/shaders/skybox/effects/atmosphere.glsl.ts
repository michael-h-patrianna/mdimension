export const atmosphereBlock = `
// --- Delight Features ---

vec3 applyHorizon(vec3 col, vec3 dir) {
    if (uAtmosphere <= 0.0) return col;

    // PERF: Use multiplications instead of pow(x, 3.0)
    float horizon = 1.0 - abs(dir.y);
    horizon = horizon * horizon * horizon; // Sharpen

    // Always use cosine palette - color comes from SkyboxPaletteEditor (classic/KTX2)
    // or synced from object palette (procedural with sync enabled)
    vec3 horizonColor = cosinePalette(0.5, uPalA, uPalB, uPalC, uPalD);

    return mix(col, horizonColor, horizon * uAtmosphere * 0.5);
}
`;
