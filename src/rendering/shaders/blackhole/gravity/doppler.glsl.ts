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
  float orbitSpeed = sqrt(uGravityStrength / safeRadius);
  float dopplerShift = approaching * orbitSpeed * uDopplerStrength;

  return 1.0 + dopplerShift;
}

/**
 * Convert RGB to HSL color space.
 */
vec3 rgb2hsl(vec3 rgb) {
  float maxC = max(max(rgb.r, rgb.g), rgb.b);
  float minC = min(min(rgb.r, rgb.g), rgb.b);
  float delta = maxC - minC;

  float l = (maxC + minC) * 0.5;
  float s = 0.0;
  float h = 0.0;

  if (delta > 0.0001) {
    s = l < 0.5 ? delta / (maxC + minC) : delta / (2.0 - maxC - minC);

    if (maxC == rgb.r) {
      h = (rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0);
    } else if (maxC == rgb.g) {
      h = (rgb.b - rgb.r) / delta + 2.0;
    } else {
      h = (rgb.r - rgb.g) / delta + 4.0;
    }
    h /= 6.0;
  }

  return vec3(h, s, l);
}

/**
 * Helper function for HSL to RGB conversion.
 */
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

/**
 * Convert HSL to RGB color space.
 */
vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;

  if (s < 0.0001) {
    return vec3(l);
  }

  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;

  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
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
