/**
 * Photon Shell
 *
 * The photon sphere where light orbits the black hole.
 * For Schwarzschild black hole, R_p = 1.5 * R_h (photon sphere at 1.5× horizon).
 */

export const shellBlock = /* glsl */ `
//----------------------------------------------
// PHOTON SHELL
//----------------------------------------------

/**
 * Calculate photon sphere radius for given dimension.
 * R_p = uPhotonShellRadiusMul * R_h * (1 + bias * log(N))
 *
 * Uses logarithmic scaling for smooth transition across dimensions.
 * log(3) ≈ 1.1, log(11) ≈ 2.4, providing gentle expansion in high-D.
 */
float getPhotonShellRadius() {
  float baseMul = uPhotonShellRadiusMul;
  // Use log(N) for smoother scaling across dimensions
  float dimBias = uPhotonShellRadiusDimBias * log(float(DIMENSION));
  return uHorizonRadius * (baseMul + dimBias);
}

/**
 * Calculate photon shell mask.
 * Returns 1 when on the shell, 0 elsewhere.
 *
 * mask = 1 - smoothstep(0, Δ, |r - R_p|)
 */
float photonShellMask(float ndRadius) {
  float Rp = getPhotonShellRadius();
  float delta = uPhotonShellWidth * uHorizonRadius;

  float dist = abs(ndRadius - Rp);
  float mask = 1.0 - smoothstep(0.0, delta, dist);

  // Apply contrast boost for sharper ring
  mask = pow(mask, 1.0 / max(uShellContrastBoost, 0.1));

  return mask;
}

/**
 * Calculate photon shell emission.
 * Bright ring at the photon sphere.
 */
vec3 photonShellEmission(float ndRadius, vec3 pos) {
  float mask = photonShellMask(ndRadius);

  if (mask < 0.001) return vec3(0.0);

  // Starburst interference pattern
  // High frequency angular modulation
  float angle = atan(pos.z, pos.x);
  
  // Use a combination of sines for a "caustic" look
  float starburst = 0.5 + 0.5 * sin(angle * 40.0 + uTime * 0.5) * sin(angle * 13.0 - uTime * 0.2);
  starburst = starburst * starburst; // PERF: Sharpen spikes (x² instead of pow)
  
  float intensityMod = 0.7 + 0.3 * starburst;
  
  // Pulse
  float pulse = 1.0 + 0.1 * sin(uTime * 2.0);

  // Shell color with intensity
  vec3 emission = uShellGlowColor * uShellGlowStrength * mask * pulse * intensityMod;

  return emission;
}

/**
 * Get adaptive step size modifier near shell.
 * Smaller steps near the photon sphere for accurate capture.
 *
 * PERF: Uses early exit when clearly outside shell region to avoid
 * expensive getPhotonShellRadius() and smoothstep/pow computations.
 */
float shellStepModifier(float ndRadius) {
  // PERF: Quick bounding check before full mask calculation
  // Uses same formula as getPhotonShellRadius() to ensure consistency
  float shellDimBias = uPhotonShellRadiusDimBias * log(float(DIMENSION));
  float shellRp = uHorizonRadius * (uPhotonShellRadiusMul + shellDimBias);
  float shellDelta = uPhotonShellWidth * uHorizonRadius * 2.0;

  // Early exit if clearly outside shell region
  if (abs(ndRadius - shellRp) > shellDelta) {
    return 1.0;
  }

  // Inside potential shell region - compute full mask
  float mask = photonShellMask(ndRadius);

  // Reduce step size near shell
  // mix(1.0, shellStepMul, mask) → smaller steps when on shell
  return mix(1.0, uShellStepMul, mask);
}
`