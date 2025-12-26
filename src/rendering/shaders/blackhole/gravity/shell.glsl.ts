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

  // HARD CHECK: Shell must be OUTSIDE the visual horizon
  // Use uShellRpPrecomputed (shell center = visualHorizon * 1.15)
  // Require ndRadius > visualHorizon, i.e. ndRadius > Rp * 0.87
  if (ndRadius < uShellRpPrecomputed * 0.87) {
    return 0.0;
  }

  float dist = abs(ndRadius - Rp);

  // Sharp ring falloff: use smoothstep with tighter inner edge
  // Inner 30% is full intensity, outer 70% falls off
  float innerEdge = delta * 0.3;
  float mask = 1.0 - smoothstep(innerEdge, delta, dist);

  // Apply contrast boost for even sharper ring (default 1.0 = no change)
  mask = pow(mask, 1.0 / max(uShellContrastBoost, 0.1));

  return mask;
}

/**
 * Calculate photon shell emission.
 * Bright ring at the photon sphere.
 *
 * PERF (OPT-BH-2): Added version that accepts pre-computed mask to avoid
 * redundant photonShellMask() call when mask was already computed in shellStepModifier.
 */
vec3 photonShellEmissionWithMask(float mask, vec3 pos) {
  // DISABLED: Shell uses spherical geometry but visual horizon is lensing-deformed
  // TODO: Implement lensing-aware shell that follows the apparent horizon shape
  return vec3(0.0);
  if (mask < 0.1) return vec3(0.0);

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
  // uShellGlowStrength controls visibility (default 8.0)
  vec3 emission = uShellGlowColor * uShellGlowStrength * mask * pulse * intensityMod;

  return emission;
}

/**
 * Calculate photon shell emission (convenience wrapper).
 * Computes mask internally - use photonShellEmissionWithMask if mask is already available.
 */
vec3 photonShellEmission(float ndRadius, vec3 pos) {
  float mask = photonShellMask(ndRadius);
  return photonShellEmissionWithMask(mask, pos);
}

/**
 * Get adaptive step size modifier near shell, also outputs the computed mask.
 * Smaller steps near the photon sphere for accurate capture.
 *
 * PERF (OPT-BH-2): Returns mask via out parameter to avoid redundant
 * photonShellMask() call in photonShellEmission.
 *
 * @param ndRadius - N-dimensional radius
 * @param outMask - Output: the computed shell mask (0 if outside shell region)
 * @returns Step size modifier (1.0 = no change, <1.0 = smaller steps)
 */
float shellStepModifierWithMask(float ndRadius, out float outMask) {
  // HARD CHECK: No shell inside the visual horizon
  // Use uShellRpPrecomputed (shell center = visualHorizon * 1.15)
  // So visualHorizon ≈ uShellRpPrecomputed / 1.15
  // Require ndRadius > visualHorizon, i.e. ndRadius > Rp / 1.15 = Rp * 0.87
  if (ndRadius < uShellRpPrecomputed * 0.87) {
    outMask = 0.0;
    return 1.0;
  }

  // PERF: Use precomputed values for early exit check
  // shellDelta * 2.0 gives a conservative bounding region
  if (abs(ndRadius - uShellRpPrecomputed) > uShellDeltaPrecomputed * 2.0) {
    outMask = 0.0;
    return 1.0;
  }

  // Inside potential shell region - compute full mask
  outMask = photonShellMask(ndRadius);

  // Reduce step size near shell
  // mix(1.0, shellStepMul, mask) → smaller steps when on shell
  return mix(1.0, uShellStepMul, outMask);
}

/**
 * Get adaptive step size modifier near shell (convenience wrapper).
 * Use shellStepModifierWithMask if you also need the mask for emission.
 */
float shellStepModifier(float ndRadius) {
  float unusedMask;
  return shellStepModifierWithMask(ndRadius, unusedMask);
}
`