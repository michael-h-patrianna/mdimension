/**
 * Doppler Effect
 *
 * Simulates relativistic Doppler shift in the accretion disk.
 * Material approaching the camera appears blue-shifted (brighter),
 * material receding appears red-shifted (dimmer).
 */

export const dopplerBlock = /* glsl */ `
//----------------------------------------------
// DOPPLER EFFECT
//----------------------------------------------

// Named constants for Doppler calculations
const float DOPPLER_EPSILON = 0.0001;     // Prevents division by zero
const float DOPPLER_MIN_RADIUS = 0.001;   // Minimum radius for calculations

/**
 * Calculate orbital velocity direction at a position in the disk.
 * Assumes Keplerian rotation in the XZ plane (horizontal disk like Saturn's rings).
 */
vec3 orbitalVelocity(vec3 pos3d, float r) {
  // Tangent to circle in XZ plane (counter-clockwise when viewed from +Y)
  // Add epsilon to prevent NaN when pos3d.xz is zero
  float safeLen = max(length(pos3d.xz), DOPPLER_EPSILON);
  vec3 tangent = vec3(-pos3d.z, 0.0, pos3d.x) / safeLen;
  return tangent;
}

/**
 * Calculate Doppler factor based on velocity relative to view.
 *
 * Returns a value where:
 * - > 1: approaching (blue shift)
 * - = 1: transverse motion
 * - < 1: receding (red shift)
 */
float dopplerFactor(vec3 pos3d, vec3 viewDir) {
  if (!uDopplerEnabled) return 1.0;

  // Disk is in XZ plane, so radius is in XZ
  float r = length(pos3d.xz);
  if (r < DOPPLER_MIN_RADIUS) return 1.0;

  // Get orbital velocity direction
  vec3 velocity = orbitalVelocity(pos3d, r);

  // Dot product with view direction
  // Negative because viewDir points toward camera
  float approaching = -dot(velocity, viewDir);

  // Doppler factor (simplified, non-relativistic approximation)
  // Scale by position-dependent velocity (closer = faster)
  // Use epsilon-protected max to prevent division by zero
  float safeRadius = max(r, max(uHorizonRadius, DOPPLER_EPSILON));
  
  // Optimization: Use inversesqrt for 1/sqrt(r)
  // v = sqrt(GM/r) = sqrt(GM) * 1/sqrt(r)
  float orbitSpeed = sqrt(uGravityStrength) * inversesqrt(safeRadius);
  
  float dopplerShift = approaching * orbitSpeed * uDopplerStrength;

  return 1.0 + dopplerShift;
}

/**
 * Calculate gravitational redshift factor.
 *
 * Light escaping from near the black hole is redshifted due to
 * gravitational time dilation: z = 1/sqrt(1 - rs/r) - 1
 *
 * For visualization, we use a simplified form that blends smoothly.
 *
 * @param r - Distance from black hole center
 * @returns Redshift factor (1.0 = no shift, <1.0 = redshifted)
 */
float gravitationalRedshift(float r) {
  // Schwarzschild redshift factor: sqrt(1 - rs/r)
  // Clamp to prevent singularity near horizon
  float rsOverR = uHorizonRadius / max(r, uHorizonRadius * 1.01);
  float redshiftFactor = sqrt(max(1.0 - rsOverR, 0.01));
  return redshiftFactor;
}

/**
 * Compute blackbody color from temperature using Planckian locus approximation.
 *
 * Based on the algorithm by Tanner Helland for temperatures 1000K - 40000K.
 *
 * @param temperature - Temperature in Kelvin
 * @returns RGB color (normalized to peak intensity)
 */
vec3 blackbodyColor(float temperature) {
  // Clamp to valid range and convert to hectoKelvin
  float temp = clamp(temperature, 1000.0, 40000.0) / 100.0;

  vec3 rgb;

  // Red channel
  if (temp <= 66.0) {
    rgb.r = 1.0;
  } else {
    rgb.r = 329.698727446 * pow(temp - 60.0, -0.1332047592) / 255.0;
  }

  // Green channel
  if (temp <= 66.0) {
    rgb.g = (99.4708025861 * log(temp) - 161.1195681661) / 255.0;
  } else {
    rgb.g = 288.1221695283 * pow(temp - 60.0, -0.0755148492) / 255.0;
  }

  // Blue channel
  if (temp >= 66.0) {
    rgb.b = 1.0;
  } else if (temp <= 19.0) {
    rgb.b = 0.0;
  } else {
    rgb.b = (138.5177312231 * log(temp - 10.0) - 305.0447927307) / 255.0;
  }

  return clamp(rgb, 0.0, 1.0);
}

/**
 * Compute disk temperature at radius using standard thin-disk profile.
 *
 * T(r) = T_inner * (r / r_inner)^(-3/4)
 *
 * This is the Shakura-Sunyaev thin disk temperature profile.
 *
 * @param r - Radius from center
 * @param rInner - Inner disk radius (ISCO)
 * @returns Temperature in Kelvin
 */
float diskTemperatureProfile(float r, float rInner) {
  if (r <= rInner) return uDiskTemperature;
  return uDiskTemperature * pow(r / rInner, -0.75);
}

/**
 * Apply Doppler color shift using proper HSL hue rotation.
 *
 * Blue shift for approaching (hue rotates toward blue/violet)
 * Red shift for receding (hue rotates toward red)
 */
vec3 applyDopplerShift(vec3 color, float dopplerFac) {
  if (!uDopplerEnabled) return color;

  // Brightness change (relativistic beaming: I' = I * D^3)
  float brightness = pow(dopplerFac, 3.0);
  color *= brightness;

  // Compute hue shift amount
  // Positive = approaching = blue shift (hue decreases toward blue)
  // Negative = receding = red shift (hue increases toward red)
  float hueShift = (dopplerFac - 1.0) * uDopplerHueShift;

  // Convert to HSL for proper hue rotation
  vec3 hsl = rgb2hsl(color);

  // Apply hue shift (blue is ~0.67, red is ~0.0/1.0)
  // For blue shift (approaching), we rotate hue toward blue
  // For red shift (receding), we rotate hue toward red
  hsl.x = fract(hsl.x - hueShift);

  // Optionally boost saturation for stronger effect
  hsl.y = min(hsl.y * (1.0 + abs(hueShift) * 0.5), 1.0);

  // Convert back to RGB
  return max(hsl2rgb(hsl), vec3(0.0));
}
`
