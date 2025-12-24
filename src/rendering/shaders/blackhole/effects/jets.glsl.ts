/**
 * Polar Jets
 *
 * Conical emission along the rotation axis (Y axis).
 * Jets extend above and below the accretion disk (XZ plane).
 */

export const jetsBlock = /* glsl */ `
//----------------------------------------------
// POLAR JETS
//----------------------------------------------

/**
 * Calculate jet density at a position.
 *
 * Jets are modeled as double cones along the Y axis (perpendicular to disk),
 * with emission intensity falling off with distance.
 *
 * Coordinate system matches accretion disk:
 * - Disk plane: XZ (horizontal, like Saturn's rings)
 * - Vertical axis: Y (jets shoot along Y axis)
 */
float jetDensity(vec3 pos3d, float time) {
  if (!uJetsEnabled) return 0.0;

  // Height along jet axis (Y is vertical, perpendicular to disk)
  float h = abs(pos3d.y);

  // Radial distance from axis (XZ plane)
  float r = length(pos3d.xz);

  // Jet height range
  float maxHeight = uJetsHeight * uHorizonRadius;
  if (h > maxHeight || h < uHorizonRadius * 0.5) return 0.0;

  // Cone angle (width increases with height)
  float coneRadius = h * uJetsWidth;

  // Check if inside cone - guard against coneRadius being zero
  if (coneRadius < 0.0001 || r > coneRadius) return 0.0;

  // Radial falloff within cone
  // PERF: Use multiplication instead of pow(x, 2.0)
  float rRatio = r / coneRadius;
  float radialFactor = 1.0 - rRatio * rRatio;

  // Height falloff - guard against maxHeight being zero
  float safeMaxHeight = max(maxHeight, 0.0001);
  float safeJetsFalloff = max(uJetsFalloff, 0.1);
  float heightFactor = exp(-pow(min(h / safeMaxHeight, 10.0), safeJetsFalloff));

  // Base at horizon
  float baseFactor = smoothstep(uHorizonRadius * 0.5, uHorizonRadius * 1.5, h);

  // Combine
  float density = radialFactor * heightFactor * baseFactor;

  // Add turbulence
  if (uJetsNoiseAmount > 0.001) {
    float noise = noise3D(vec3(r * 2.0, pos3d.y * 0.5, time * uJetsPulsation));
    density *= mix(1.0, 0.5 + noise, uJetsNoiseAmount);
  }

  // Pulsation
  if (uJetsPulsation > 0.001) {
    float pulse = 0.8 + 0.2 * sin(time * uJetsPulsation * 3.0 - h * 0.5);
    density *= pulse;
  }

  return max(density, 0.0);
}

/**
 * Get jet emission color.
 */
vec3 jetEmission(vec3 pos3d, float density, float time) {
  if (density < 0.001) return vec3(0.0);

  // Base jet color
  vec3 color = uJetsColor;

  // Vary color along height (Y is vertical axis)
  float h = abs(pos3d.y);
  float maxHeight = uJetsHeight * uHorizonRadius;
  // Guard against maxHeight being zero
  float safeMaxHeight = max(maxHeight, 0.0001);
  float heightT = clamp(h / safeMaxHeight, 0.0, 1.0);

  // Hotter at base, cooler at tip
  vec3 baseColor = vec3(1.0, 0.8, 0.5); // Yellow-white
  vec3 tipColor = uJetsColor;
  color = mix(baseColor, tipColor, heightT);

  return color * density * uJetsIntensity;
}
`
