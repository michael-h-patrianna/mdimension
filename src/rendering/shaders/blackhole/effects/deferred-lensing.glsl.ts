/**
 * Deferred Gravitational Lensing
 *
 * Post-processing pass that distorts the scene image based on
 * gravitational field. This applies lensing effects to background
 * objects that were rendered separately from the black hole.
 *
 * The distortion is calculated from:
 * - Black hole position in screen space
 * - Distance from each pixel to the black hole center
 * - Gravitational lensing formula
 */

export const deferredLensingBlock = /* glsl */ `
//----------------------------------------------
// DEFERRED GRAVITATIONAL LENSING
//----------------------------------------------

/**
 * Compute radial distortion magnitude based on distance from center.
 *
 * Uses the gravitational lensing formula to determine how much
 * each pixel should be displaced toward the black hole center.
 *
 * @param r - Distance from black hole center (in NDC space, 0-1)
 * @param strength - Overall lensing strength
 * @param falloff - How quickly lensing falls off with distance
 * @returns Displacement magnitude (can be negative for inward pull)
 */
float lensingMagnitude(float r, float strength, float falloff) {
  // Prevent division by zero at center
  float safeR = max(r, 0.001);

  // Gravitational lensing falls off with distance
  // Using 1/r^falloff formula with Einstein ring scaling
  float deflection = strength / pow(safeR, falloff);

  // Clamp to prevent extreme distortion
  return min(deflection, 0.5);
}

/**
 * Compute displacement vector for a UV coordinate.
 *
 * @param uv - Current UV coordinate
 * @param center - Black hole center in UV space (0-1)
 * @param strength - Overall lensing strength
 * @param falloff - Distance falloff exponent
 * @returns UV displacement to apply
 */
vec2 computeLensingDisplacement(vec2 uv, vec2 center, float strength, float falloff) {
  // Vector from pixel to black hole center
  vec2 toCenter = center - uv;

  // Distance from center
  float r = length(toCenter);

  // Skip if very close to center (inside event horizon region)
  if (r < 0.01) {
    return vec2(0.0);
  }

  // Direction toward center
  vec2 dir = normalize(toCenter);

  // Calculate displacement magnitude
  float mag = lensingMagnitude(r, strength, falloff);

  // Return displacement vector (pulls toward center)
  return dir * mag;
}

/**
 * Apply chromatic aberration to lensing.
 * Simulates wavelength-dependent light bending.
 *
 * @param uv - Current UV coordinate
 * @param displacement - Base displacement vector
 * @param chromaticAmount - Strength of chromatic separation
 * @returns RGB color with chromatic separation
 */
vec3 applyLensingChromatic(sampler2D sceneTexture, vec2 uv, vec2 displacement, float chromaticAmount) {
  // Each color channel bends slightly differently
  float rScale = 1.0 - chromaticAmount * 0.02;
  float gScale = 1.0;
  float bScale = 1.0 + chromaticAmount * 0.02;

  // Sample with offset for each channel
  float r = texture(sceneTexture, uv + displacement * rScale).r;
  float g = texture(sceneTexture, uv + displacement * gScale).g;
  float b = texture(sceneTexture, uv + displacement * bScale).b;

  return vec3(r, g, b);
}

/**
 * Compute Einstein ring brightness boost.
 * Pixels near the critical radius get brightness amplification.
 *
 * @param r - Distance from center
 * @param ringRadius - Critical Einstein ring radius
 * @param ringWidth - Width of the ring effect
 * @returns Brightness multiplier
 */
float einsteinRingBoost(float r, float ringRadius, float ringWidth) {
  // Gaussian profile centered on ring radius
  float diff = abs(r - ringRadius);
  float falloff = exp(-diff * diff / (ringWidth * ringWidth * 2.0));

  // Return boost factor (1.0 = no boost)
  return 1.0 + falloff * 0.5;
}

/**
 * Sample scene with gravitational lensing distortion.
 * This is the main function for the deferred lensing pass.
 *
 * @param sceneTexture - The rendered scene texture to distort
 * @param uv - Current UV coordinate
 * @param blackHoleCenter - Black hole center in UV space
 * @param horizonRadius - Event horizon radius in UV space
 * @param strength - Overall lensing strength
 * @param falloff - Distance falloff exponent
 * @param enableChromatic - Whether to apply chromatic aberration
 * @param chromaticAmount - Chromatic aberration strength
 * @returns Final distorted color
 */
vec4 sampleWithLensing(
  sampler2D sceneTexture,
  vec2 uv,
  vec2 blackHoleCenter,
  float horizonRadius,
  float strength,
  float falloff,
  bool enableChromatic,
  float chromaticAmount
) {
  // Compute displacement
  vec2 displacement = computeLensingDisplacement(uv, blackHoleCenter, strength, falloff);

  // Distance from center for horizon check
  float r = length(uv - blackHoleCenter);

  // Inside event horizon: return black
  if (r < horizonRadius) {
    return vec4(0.0, 0.0, 0.0, 1.0);
  }

  // Apply displacement to UV
  vec2 distortedUV = uv + displacement;

  // Clamp to valid UV range
  distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));

  // Sample scene with optional chromatic aberration
  vec3 color;
  if (enableChromatic && chromaticAmount > 0.0) {
    color = applyLensingChromatic(sceneTexture, uv, displacement, chromaticAmount);
  } else {
    color = texture(sceneTexture, distortedUV).rgb;
  }

  // Apply Einstein ring brightness boost
  float ringRadius = horizonRadius * 1.5; // Photon sphere location
  float boost = einsteinRingBoost(r, ringRadius, horizonRadius * 0.3);
  color *= boost;

  return vec4(color, 1.0);
}
`

/**
 * Uniforms for deferred lensing pass
 */
export const deferredLensingUniforms = /* glsl */ `
uniform sampler2D uSceneTexture;       // Rendered scene
uniform vec2 uBlackHoleCenter;          // Center in UV space (0-1)
uniform float uHorizonRadiusUV;         // Horizon radius in UV space
uniform float uDeferredLensingStrength; // Overall strength
uniform float uDeferredLensingFalloff;  // Distance falloff
uniform bool uChromaticEnabled;         // Enable chromatic aberration
uniform float uChromaticAmount;         // Chromatic aberration strength
`
