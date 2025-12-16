export const selectorBlock = `
// ============================================
// Unified Color Algorithm Selector
// ============================================

vec3 getColorByAlgorithm(float t, vec3 normal, vec3 baseHSL, vec3 position) {
  // Use else-if chain for proper mutual exclusion on all GPU architectures
  if (uColorAlgorithm == 0) {
    // Algorithm 0: Monochromatic - same hue, varying lightness
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float newL = 0.3 + distributedT * 0.4;
    return hsl2rgb(vec3(baseHSL.x, baseHSL.y, newL));
  } else if (uColorAlgorithm == 1) {
    // Algorithm 1: Analogous - hue varies ±30° from base
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float hueOffset = (distributedT - 0.5) * 0.167;
    float newH = fract(baseHSL.x + hueOffset);
    return hsl2rgb(vec3(newH, baseHSL.y, baseHSL.z));
  } else if (uColorAlgorithm == 2) {
    // Algorithm 2: Cosine gradient palette
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 3) {
    // Algorithm 3: Normal-based coloring
    float normalT = normal.y * 0.5 + 0.5;
    return getCosinePaletteColor(normalT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 4) {
    // Algorithm 4: Distance-field coloring
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 5) {
    // Algorithm 5: LCH/Oklab perceptual
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    return lchColor(distributedT, uLchLightness, uLchChroma);
  } else if (uColorAlgorithm == 6) {
    // Algorithm 6: Multi-source mapping
    // Blends depth (t), orbitTrap (position-based), and normal contributions
    float totalWeight = uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z;
    vec3 w = uMultiSourceWeights / max(totalWeight, 0.001);
    float normalValue = normal.y * 0.5 + 0.5;
    // Use position-based orbit trap instead of duplicating t
    float orbitTrap = clamp(length(position) / BOUND_R, 0.0, 1.0);
    float blendedT = w.x * t + w.y * orbitTrap + w.z * normalValue;
    return getCosinePaletteColor(blendedT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 7) {
    // Algorithm 7: Radial - color based on 3D distance from origin
    // Normalize by bounding radius (BOUND_R = 2.0)
    float radialT = clamp(length(position) / BOUND_R, 0.0, 1.0);
    return getCosinePaletteColor(radialT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else {
    // Fallback: cosine palette
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  }
}
`;
