/**
 * Motion Blur for Black Hole Accretion Disk
 *
 * Creates rotational motion blur effect for the accretion disk.
 * Uses temporal sampling to blur along the orbital motion direction.
 *
 * The blur follows Keplerian velocity: faster near the center, slower at edge.
 * v ∝ r^(-0.5) (orbital velocity decreases with sqrt of radius)
 */

export const motionBlurBlock = /* glsl */ `
//----------------------------------------------
// MOTION BLUR
//----------------------------------------------

/**
 * Compute orbital velocity factor at given radius.
 * Based on Keplerian orbit: v ∝ 1/√r
 *
 * @param radius - Distance from center
 * @param innerR - Inner disk radius
 * @param outerR - Outer disk radius
 * @returns Normalized velocity factor [0, 1]
 */
float orbitalVelocityFactor(float radius, float innerR, float outerR) {
  // Avoid division by zero - ensure both innerR and r have minimum values
  float safeInnerR = max(innerR, 0.001);
  float r = max(radius, safeInnerR * 0.5);

  // Keplerian velocity: v ∝ 1/√r
  // Normalize so inner edge = 1.0, outer edge ≈ 0.35 (for typical disk ratio)
  float v = sqrt(safeInnerR / r);

  // Apply radial falloff (no blur outside disk)
  float radialMask = smoothstep(innerR * 0.8, innerR, radius) *
                     (1.0 - smoothstep(outerR, outerR * 1.2, radius));

  return v * radialMask * uMotionBlurRadialFalloff;
}

/**
 * Get motion blur offset direction at given position.
 * Returns the tangent direction (perpendicular to radial in XZ plane).
 *
 * Coordinate system matches accretion disk:
 * - Disk plane: XZ (horizontal)
 * - Vertical axis: Y
 * - Orbital motion: circular in XZ plane
 *
 * @param pos3d - Current 3D position
 * @returns Tangent direction for motion blur sampling
 */
vec3 getMotionBlurDirection(vec3 pos3d) {
  // Tangent direction in XZ plane (orbital direction)
  float xzLen = length(pos3d.xz);
  // Guard against zero-length vector (position on Y axis)
  if (xzLen < 0.0001) {
    return vec3(1.0, 0.0, 0.0); // Default tangent direction
  }
  // Radial direction in XZ plane: (x/r, 0, z/r)
  // Tangent (perpendicular, orbital direction): (-z/r, 0, x/r)
  vec3 tangent = vec3(-pos3d.z / xzLen, 0.0, pos3d.x / xzLen);

  return tangent;
}

/**
 * Apply motion blur to manifold color.
 *
 * Samples the manifold at multiple time offsets along the orbital path
 * and averages the results for a motion blur effect.
 *
 * @param baseColor - Original manifold color
 * @param pos3d - Current 3D position
 * @param ndRadius - N-dimensional radius
 * @param density - Current density
 * @param time - Animation time
 * @returns Motion-blurred color
 */
vec3 applyMotionBlur(
  vec3 baseColor,
  vec3 pos3d,
  float ndRadius,
  float density,
  float time
) {
  if (!uMotionBlurEnabled || uMotionBlurStrength < 0.001) {
    return baseColor;
  }

  // Disk is in XZ plane, so radius is in XZ
  float radius = length(pos3d.xz);
  float innerR = uHorizonRadius * uDiskInnerRadiusMul;
  float outerR = uHorizonRadius * uDiskOuterRadiusMul;

  // Compute blur amount based on orbital velocity
  float velocityFactor = orbitalVelocityFactor(radius, innerR, outerR);
  float blurAmount = velocityFactor * uMotionBlurStrength;

  if (blurAmount < 0.001) {
    return baseColor;
  }

  // Get blur direction (tangent to orbit)
  vec3 blurDir = getMotionBlurDirection(pos3d);

  // Sample count (capped lower for performance in CI-Round 1)
  int samples = min(uMotionBlurSamples, 4);
  if (samples < 2) {
    return baseColor;
  }

  // Accumulate samples along motion path
  vec3 accumColor = vec3(0.0);
  float totalWeight = 0.0;

  // PERF: Pre-compute shared values outside loop
  float safeSamples = float(max(samples - 1, 1));
  float blurScale = blurAmount * radius * 0.05;

  for (int i = 0; i < 4; i++) {
    if (i >= samples) break;

    // Sample offset: -0.5 to +0.5 of blur range
    float t = (float(i) / safeSamples - 0.5) * 2.0;

    // Position offset along blur direction (tangent)
    vec3 samplePos = pos3d + blurDir * t * blurScale;

    float sampleDensity = manifoldDensity(samplePos, ndRadius, time);

    if (sampleDensity > 0.001) {
      vec3 sampleColor = manifoldColor(samplePos, ndRadius, sampleDensity, time);

      // Weight by distance from center of blur kernel (triangle kernel)
      float weight = 1.0 - abs(t);
      accumColor += sampleColor * weight;
      totalWeight += weight;
    }
  }

  // Blend with original based on blur amount
  if (totalWeight > 0.001) {
    vec3 blurredColor = accumColor / totalWeight;
    return mix(baseColor, blurredColor, blurAmount * 0.5);
  }

  return baseColor;
}
`
