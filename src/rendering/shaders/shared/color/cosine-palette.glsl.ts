export const cosinePaletteBlock = `
// ============================================
// Cosine Gradient Palette Functions
// Based on Inigo Quilez's technique
// ============================================

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

float applyDistribution(float t, float power, float cycles, float offset) {
  float clamped = clamp(t, 0.0, 1.0);
  float curved = pow(clamped, power);
  float cycled = fract(curved * cycles + offset);
  return cycled;
}

vec3 getCosinePaletteColor(
  float t,
  vec3 a, vec3 b, vec3 c, vec3 d,
  float power, float cycles, float offset
) {
  float distributedT = applyDistribution(t, power, cycles, offset);
  return cosinePalette(distributedT, a, b, c, d);
}
`;
