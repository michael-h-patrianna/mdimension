/**
 * Polar Jets
 *
 * Conical emission along the rotation axis (Z axis).
 * Jets extend above and below the accretion disk.
 */

export const jetsBlock = /* glsl */ `
//----------------------------------------------
// POLAR JETS
//----------------------------------------------

/**
 * Calculate jet density at a position.
 *
 * Jets are modeled as double cones along the Z axis,
 * with emission intensity falling off with distance.
 */
float jetDensity(vec3 pos3d, float time) {
  if (!uJetsEnabled) return 0.0;

  // Height along jet axis
  float h = abs(pos3d.z);

  // Radial distance from axis
  float r = length(pos3d.xy);

  // Jet height range
  float maxHeight = uJetsHeight * uHorizonRadius;
  if (h > maxHeight || h < uHorizonRadius * 0.5) return 0.0;

  // Cone angle (width increases with height)
  float coneRadius = h * uJetsWidth;

  // Check if inside cone
  if (r > coneRadius) return 0.0;

  // Radial falloff within cone
  float radialFactor = 1.0 - pow(r / coneRadius, 2.0);

  // Height falloff
  float heightFactor = exp(-pow(h / maxHeight, uJetsFalloff));

  // Base at horizon
  float baseFactor = smoothstep(uHorizonRadius * 0.5, uHorizonRadius * 1.5, h);

  // Combine
  float density = radialFactor * heightFactor * baseFactor;

  // Add turbulence
  if (uJetsNoiseAmount > 0.001) {
    float noise = noise3D(vec3(r * 2.0, pos3d.z * 0.5, time * uJetsPulsation));
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

  // Vary color along height
  float h = abs(pos3d.z);
  float maxHeight = uJetsHeight * uHorizonRadius;
  float heightT = h / maxHeight;

  // Hotter at base, cooler at tip
  vec3 baseColor = vec3(1.0, 0.8, 0.5); // Yellow-white
  vec3 tipColor = uJetsColor;
  color = mix(baseColor, tipColor, heightT);

  return color * density * uJetsIntensity;
}
`
