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
  starburst = pow(starburst, 2.0); // Sharpen spikes
  
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
 */
float shellStepModifier(float ndRadius) {
  float mask = photonShellMask(ndRadius);

  // Reduce step size near shell
  // mix(1.0, shellStepMul, mask) → smaller steps when on shell
  return mix(1.0, uShellStepMul, mask);
}
`