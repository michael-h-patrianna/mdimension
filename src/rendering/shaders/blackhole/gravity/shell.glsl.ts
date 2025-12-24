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
 * PERF OPTIMIZATION: Now uses precomputed value from CPU to avoid
 * log() and multiplication per-pixel. The value is computed once per
 * frame in useBlackHoleUniformUpdates.ts.
 *
 * Original formula (for reference):
 *   dimBias = uPhotonShellRadiusDimBias * log(DIMENSION)
 *   return uHorizonRadius * (uPhotonShellRadiusMul + dimBias)
 */
float getPhotonShellRadius() {
  return uShellRpPrecomputed;
}

/**
 * Calculate photon shell mask.
 * Returns 1 when on the shell, 0 elsewhere.
 *
 * PERF OPTIMIZATION: Uses precomputed Rp and delta from CPU.
 *
 * mask = 1 - smoothstep(0, Δ, |r - R_p|)
 */
float photonShellMask(float ndRadius) {
  // Use precomputed values (avoids per-pixel getPhotonShellRadius() call)
  float Rp = uShellRpPrecomputed;
  float delta = uShellDeltaPrecomputed;

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
 * PERF OPTIMIZATION: Uses precomputed shellRp and shellDelta from CPU.
 * This eliminates log() and multiple multiplications per-pixel.
 */
float shellStepModifier(float ndRadius) {
  // PERF: Use precomputed values for early exit check
  // shellDelta * 2.0 gives a conservative bounding region
  if (abs(ndRadius - uShellRpPrecomputed) > uShellDeltaPrecomputed * 2.0) {
    return 1.0;
  }

  // Inside potential shell region - compute full mask
  float mask = photonShellMask(ndRadius);

  // Reduce step size near shell
  // mix(1.0, shellStepMul, mask) → smaller steps when on shell
  return mix(1.0, uShellStepMul, mask);
}
`