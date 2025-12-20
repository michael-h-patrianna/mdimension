/**
 * SDF-Based Accretion Disk
 *
 * Surface intersection approach for thin accretion disk:
 * - Detects plane crossings as ray bends around black hole
 * - Multiple crossings create Einstein ring effect
 * - Uses existing manifold coloring and Doppler shift
 *
 * N-D embedding: The disk plane is defined by the rotated basis vectors,
 * so it rotates with the viewing slice through hyperspace. The disk normal
 * is derived from uBasisY (the rotated Y-axis in N-D space).
 *
 * This module works alongside the volumetric approach (manifold.glsl.ts),
 * providing an alternative rendering mode optimized for Einstein ring visualization.
 */

export const diskSdfBlock = /* glsl */ `
//----------------------------------------------
// SDF-BASED ACCRETION DISK
//----------------------------------------------

// Maximum Einstein ring layers (crossings to track)
const int MAX_DISK_CROSSINGS = 8;

/**
 * Get the disk plane normal from the rotated basis.
 * The disk lies perpendicular to the Y-axis in the rotated coordinate system.
 * This allows the disk to rotate with the N-D slice orientation.
 *
 * @returns Normalized disk normal (3D projection of rotated Y-axis)
 */
vec3 getDiskNormal() {
  // Extract 3D components of the rotated Y-axis
  // uBasisY is an N-D vector; first 3 components are the 3D projection
  vec3 normal = vec3(uBasisY[0], uBasisY[1], uBasisY[2]);
  float len = length(normal);
  return len > 0.0001 ? normal / len : vec3(0.0, 1.0, 0.0);
}

/**
 * Project position onto the disk plane and get radial distance.
 * Uses the rotated basis for proper N-D embedding.
 *
 * @param pos3d - 3D position
 * @param diskNormal - Disk plane normal
 * @returns Radial distance from origin in the disk plane
 */
float getDiskRadius(vec3 pos3d, vec3 diskNormal) {
  // Project position onto disk plane (remove component along normal)
  vec3 inPlane = pos3d - dot(pos3d, diskNormal) * diskNormal;
  return length(inPlane);
}

/**
 * Get signed distance from position to disk plane.
 *
 * @param pos3d - 3D position
 * @param diskNormal - Disk plane normal
 * @returns Signed height above/below disk plane
 */
float getDiskHeight(vec3 pos3d, vec3 diskNormal) {
  return dot(pos3d, diskNormal);
}

/**
 * SDF for thick disk (annulus with height).
 * Returns signed distance to disk surface.
 *
 * The disk plane is defined by the rotated basis vectors for N-D embedding.
 *
 * @param pos3d - 3D position
 * @returns Signed distance (negative inside disk)
 */
float sdfDisk(vec3 pos3d) {
  vec3 diskNormal = getDiskNormal();
  float r = getDiskRadius(pos3d, diskNormal);
  float h = abs(getDiskHeight(pos3d, diskNormal));

  float innerR = uHorizonRadius * uDiskInnerRadiusMul;
  float outerR = uHorizonRadius * uDiskOuterRadiusMul;
  float thickness = uManifoldThickness * uHorizonRadius * getManifoldThicknessScale();
  float halfThick = thickness * 0.5;

  // Clamp r to annulus range
  float clampedR = clamp(r, innerR, outerR);
  float dr = abs(r - clampedR);

  // Vertical distance to disk surface
  float dh = h - halfThick;

  // Inside the radial bounds?
  if (r >= innerR && r <= outerR) {
    // Inside radially: SDF is just vertical distance
    return dh;
  }

  // Outside radially
  if (dh <= 0.0) {
    // Below disk height, just radial distance
    return dr;
  }

  // Outside both: distance to corner
  return length(vec2(dr, dh));
}

/**
 * Check if a position is inside the disk annulus (radial bounds only).
 *
 * @param pos3d - 3D position
 * @returns true if within radial bounds
 */
bool isInDiskBounds(vec3 pos3d) {
  vec3 diskNormal = getDiskNormal();
  float r = getDiskRadius(pos3d, diskNormal);
  float innerR = uHorizonRadius * uDiskInnerRadiusMul;
  float outerR = uHorizonRadius * uDiskOuterRadiusMul;
  return r >= innerR && r <= outerR;
}

/**
 * Detect plane crossing between two positions.
 * Returns interpolated crossing point if crossing detected.
 *
 * N-D embedding: Uses the rotated disk normal instead of hardcoded Y-axis.
 *
 * @param prevPos - Previous ray position
 * @param currPos - Current ray position
 * @param crossingPos - Output: interpolated crossing position
 * @returns true if crossing detected and within disk bounds
 */
bool detectDiskCrossing(vec3 prevPos, vec3 currPos, out vec3 crossingPos) {
  vec3 diskNormal = getDiskNormal();

  // Signed distance from disk plane
  float prevH = dot(prevPos, diskNormal);
  float currH = dot(currPos, diskNormal);

  // Check for sign change (crossing the disk plane)
  if (prevH * currH >= 0.0) {
    return false;  // No crossing
  }

  // Linear interpolation to find crossing point
  float t = prevH / (prevH - currH);
  t = clamp(t, 0.0, 1.0);  // Safety clamp

  crossingPos = mix(prevPos, currPos, t);

  // Check if crossing is within disk radial bounds
  return isInDiskBounds(crossingPos);
}

/**
 * Compute disk surface normal.
 * For thin disk, normal is the rotated disk normal (from basis Y).
 * For thick disk, compute from SDF gradient.
 *
 * N-D embedding: Uses the rotated basis for proper orientation.
 *
 * @param pos3d - Position on disk surface
 * @param approachDir - Ray direction (for determining which side)
 * @returns Surface normal
 */
vec3 computeDiskNormal(vec3 pos3d, vec3 approachDir) {
  vec3 diskNormal = getDiskNormal();
  float thickness = uManifoldThickness * uHorizonRadius * getManifoldThicknessScale();

  // For very thin disks, use the rotated disk normal
  if (thickness < 0.05) {
    // Normal points opposite to approach direction (toward viewer)
    float approachDot = dot(approachDir, diskNormal);
    return approachDot > 0.0 ? -diskNormal : diskNormal;
  }

  // For thick disks, compute SDF gradient
  float eps = 0.001;
  float d0 = sdfDisk(pos3d);
  float dx = sdfDisk(pos3d + vec3(eps, 0.0, 0.0)) - d0;
  float dy = sdfDisk(pos3d + vec3(0.0, eps, 0.0)) - d0;
  float dz = sdfDisk(pos3d + vec3(0.0, 0.0, eps)) - d0;

  vec3 normal = vec3(dx, dy, dz);
  float len = length(normal);
  if (len < 0.0001) {
    float approachDot = dot(approachDir, diskNormal);
    return approachDot > 0.0 ? -diskNormal : diskNormal;
  }
  normal = normal / len;

  // Ensure normal faces the viewer
  if (dot(normal, approachDir) > 0.0) {
    normal = -normal;
  }

  return normal;
}

/**
 * Compute angle in the disk plane for swirl/noise patterns.
 * Uses the rotated basis to maintain consistency with N-D embedding.
 *
 * @param pos3d - 3D position
 * @param diskNormal - Disk plane normal
 * @returns Angle in radians around the disk
 */
float getDiskAngle(vec3 pos3d, vec3 diskNormal) {
  // Project position onto disk plane
  vec3 inPlane = pos3d - dot(pos3d, diskNormal) * diskNormal;

  // Get X and Z basis vectors for the disk plane (perpendicular to diskNormal)
  vec3 basisX = vec3(uBasisX[0], uBasisX[1], uBasisX[2]);
  vec3 basisZ = vec3(uBasisZ[0], uBasisZ[1], uBasisZ[2]);

  // Project onto disk plane basis
  float x = dot(inPlane, basisX);
  float z = dot(inPlane, basisZ);

  return atan(z, x);
}

/**
 * Shade a disk surface hit.
 * Applies temperature gradient, noise, swirl, Doppler shift, and lighting.
 *
 * N-D embedding: Uses the rotated disk plane for all calculations.
 *
 * @param hitPos - Surface hit position
 * @param rayDir - Incoming ray direction
 * @param hitIndex - Which crossing this is (0 = first, higher = Einstein ring layers)
 * @param time - Animation time
 * @returns Shaded color contribution
 */
vec3 shadeDiskHit(vec3 hitPos, vec3 rayDir, int hitIndex, float time) {
  vec3 diskNormal = getDiskNormal();
  float r = getDiskRadius(hitPos, diskNormal);
  float innerR = uHorizonRadius * uDiskInnerRadiusMul;
  float outerR = uHorizonRadius * uDiskOuterRadiusMul;

  // Normalized radial position [0, 1] (0 = inner edge, 1 = outer edge)
  float radialT = clamp((r - innerR) / (outerR - innerR), 0.0, 1.0);

  // Temperature-based color (hot inner, cool outer)
  vec3 color;
  if (uPaletteMode == 0) {
    // Base color mode
    color = uBaseColor;
  } else if (uPaletteMode == 1) {
    // Disk gradient (temperature)
    vec3 innerColor = vec3(1.0, 0.95, 0.85);  // Yellowish-white (hot)
    vec3 outerColor = vec3(1.0, 0.5, 0.15);   // Orange-red (cooler)
    color = mix(innerColor, outerColor, radialT);
  } else if (uPaletteMode == 2) {
    // Quantum mode
    float angle = getDiskAngle(hitPos, diskNormal);
    float phase = angle * 2.0 + r * 0.3 - time * 0.2;
    vec3 c1 = vec3(0.2, 0.5, 1.0);
    vec3 c2 = vec3(1.0, 0.3, 0.8);
    color = mix(c1, c2, sin(phase) * 0.5 + 0.5);
  } else if (uPaletteMode == 3) {
    // Heatmap
    vec3 cold = vec3(0.1, 0.0, 0.3);
    vec3 mid = vec3(1.0, 0.3, 0.0);
    vec3 hot = vec3(1.0, 1.0, 0.8);
    float temp = 1.0 - radialT;  // Hotter at inner edge
    color = temp < 0.5 ? mix(cold, mid, temp * 2.0) : mix(mid, hot, (temp - 0.5) * 2.0);
  } else {
    color = uBaseColor;
  }

  // Add swirl pattern
  if (uSwirlAmount > 0.001) {
    float angle = getDiskAngle(hitPos, diskNormal);
    float swirlPhase = angle * 3.0 + r * 0.5 - time * 0.5;
    float swirlBright = 0.5 + 0.5 * sin(swirlPhase);
    color *= mix(0.7, 1.3, swirlBright * uSwirlAmount);
  }

  // Add noise turbulence
  if (uNoiseAmount > 0.001) {
    float angle = getDiskAngle(hitPos, diskNormal);
    vec3 noisePos = vec3(r * 0.3, angle * 2.0, 0.0) * uNoiseScale;
    float n = noise3D(noisePos + time * 0.1);
    float ridged = 1.0 - abs(2.0 * n - 1.0);
    ridged = pow(ridged, 2.0);
    color *= mix(1.0, ridged, uNoiseAmount);
  }

  // Apply lighting (FakeLit mode)
  if (uLightingMode == 1) {
    vec3 normal = computeDiskNormal(hitPos, rayDir);
    vec3 lightDir = normalize(uLightPositions[0] - hitPos);

    float NdotL = max(dot(normal, lightDir), 0.0);
    float diffuse = NdotL;

    vec3 viewDir = normalize(uCameraPosition - hitPos);
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specular = pow(NdotH, 32.0 * (1.0 - uRoughness + 0.1)) * uSpecular;

    float lightContrib = uAmbientTint + diffuse * (1.0 - uAmbientTint);
    color *= lightContrib;
    color += vec3(specular) * uLightColors[0];
  }

  // Apply Doppler shift (reuse existing function from doppler.glsl.ts)
  float dopplerFac = dopplerFactor(hitPos, rayDir);
  color = applyDopplerShift(color, dopplerFac);

  // Multi-intersection gain (Einstein ring enhancement)
  // Later crossings (back of disk seen through lensing) get brightness boost
  float crossingGain = 1.0 + float(hitIndex) * uMultiIntersectionGain * 0.3;
  color *= crossingGain;

  // Apply intensity
  color *= uManifoldIntensity;

  return color;
}

// Note: accumulateDiskHit is defined in main.glsl.ts where AccumulationState is available
`
