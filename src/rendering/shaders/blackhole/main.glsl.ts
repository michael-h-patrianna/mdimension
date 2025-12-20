/**
 * Black Hole Main Shader
 *
 * Core raymarching loop with:
 * - Gravitational lensing (ray bending)
 * - Photon shell detection
 * - Accretion manifold sampling
 * - Background sampling with lensing
 * - Volumetric integration
 */

export const mainBlock = /* glsl */ `
//----------------------------------------------
// MAIN SHADER
//----------------------------------------------

// Note: MRT (Multiple Render Target) output declarations are in precision.glsl.ts
// gColor (location 0), gNormal (location 1), gPosition (location 2 when USE_TEMPORAL_ACCUMULATION)

// Named constants for raymarching
const float RAYMARCH_EPSILON = 0.0001;
const float PHOTON_SPHERE_RATIO = 1.5;        // r_photon = 1.5 * r_schwarzschild
const float EINSTEIN_RING_WIDTH_RATIO = 0.3;  // Fraction of horizon radius
const float MAX_LENSING_DEFLECTION = 0.5;     // Prevents extreme distortion

/**
 * Calculate intersection with a sphere.
 * Returns vec2(near, far). If no intersection, returns vec2(-1.0).
 */
vec2 intersectSphere(vec3 ro, vec3 rd, float rad) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - rad * rad;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    float sqrtH = sqrt(h);
    return vec2(-b - sqrtH, -b + sqrtH);
}

/**
 * Calculate adaptive step size based on position.
 */
float adaptiveStepSize(float ndRadius) {
  // Base step - scale with distance to allow efficient travel far from hole
  float step = uStepBase * (1.0 + ndRadius * 0.5);

  // Reduce step near horizon (gravity adaption)
  float gravityFactor = 1.0 / (1.0 + uStepAdaptG * uGravityStrength / max(ndRadius, uEpsilonMul));
  step *= gravityFactor;

  // Reduce step near photon shell
  float shellMod = shellStepModifier(ndRadius);
  step *= shellMod;

  // Reduce step when close to horizon
  float horizonDist = max(ndRadius - uHorizonRadius, 0.0);
  float horizonFactor = smoothstep(0.0, uHorizonRadius * uStepAdaptR, horizonDist);
  step *= mix(0.2, 1.0, horizonFactor);

  // Clamp to min/max
  return clamp(step, uStepMin, uStepMax);
}

/**
 * Sample background environment with bent ray.
 */
vec3 sampleBackground(vec3 bentDir) {
  vec3 bgColor = vec3(0.0);

  if (uBackgroundMode == 0) {
    // Environment map
    #ifdef USE_ENVMAP
      bgColor = texture(envMap, bentDir).rgb;
    #else
      // Fallback: dark blue gradient
      float up = bentDir.y * 0.5 + 0.5;
      bgColor = mix(vec3(0.0, 0.0, 0.05), vec3(0.0, 0.02, 0.1), up);
    #endif
  } else if (uBackgroundMode == 1) {
    // Procedural starfield
    bgColor = proceduralStars(bentDir);
  } else {
    // Solid black
    bgColor = vec3(0.0);
  }

  return bgColor;
}

/**
 * Raymarch result struct for MRT outputs.
 */
struct RaymarchResult {
  vec4 color;           // RGB + alpha
  vec3 weightedCenter;  // Density-weighted position for temporal reprojection
  vec3 averageNormal;   // Accumulated normal direction
};

/**
 * Raymarch accumulation state for volumetric integration.
 * Shared between slice3D and trueND modes to avoid code duplication.
 */
struct AccumulationState {
  vec3 color;              // Accumulated color
  float transmittance;     // Remaining light (starts at 1.0)
  float totalDensity;      // Total integrated density
  vec3 weightedPosSum;     // Density-weighted position sum
  float totalWeight;       // Total weight for averaging
  vec3 normalSum;          // Accumulated normal direction
};

/**
 * Initialize accumulation state.
 */
AccumulationState initAccumulation() {
  AccumulationState s;
  s.color = vec3(0.0);
  s.transmittance = 1.0;
  s.totalDensity = 0.0;
  s.weightedPosSum = vec3(0.0);
  s.totalWeight = 0.0;
  s.normalSum = vec3(0.0);
  return s;
}

/**
 * Accumulate emission into the raymarch state.
 * Handles volumetric integration with emission-absorption model.
 *
 * @param state - Current accumulation state (modified in place)
 * @param emission - Emitted color at this sample
 * @param density - Sample density
 * @param stepSize - Current ray step size
 * @param pos3d - 3D position for weighted averaging
 */
void accumulateEmission(
  inout AccumulationState state,
  vec3 emission,
  float density,
  float stepSize,
  vec3 pos3d
) {
  // Volumetric integration (emission-absorption)
  float absorption = manifoldAbsorption(density, stepSize);
  if (uEnableAbsorption) {
    // Beer-Lambert: emission weighted by (1 - absorption)
    state.color += emission * state.transmittance * (1.0 - absorption);
    state.transmittance *= absorption;
  } else {
    // No absorption: use density-based emission only
    state.color += emission * state.transmittance * density * stepSize;
  }

  state.totalDensity += density * stepSize;

  // Accumulate weighted position for temporal reprojection
  float weight = density * state.transmittance;
  state.weightedPosSum += pos3d * weight;
  state.totalWeight += weight;

  // Accumulate normal from gravitational direction
  vec3 toCenter = normalize(-pos3d);
  state.normalSum += toCenter * weight;
}

/**
 * Finalize accumulation state into RaymarchResult.
 *
 * @param state - Final accumulation state
 * @param fallbackPos - Fallback position if no density was accumulated
 * @param rayDir - Ray direction for fallback normal
 * @returns Finalized RaymarchResult
 */
RaymarchResult finalizeAccumulation(
  AccumulationState state,
  vec3 fallbackPos,
  vec3 rayDir
) {
  RaymarchResult result;

  // Calculate alpha from transmittance
  float alpha = 1.0 - state.transmittance;
  result.color = vec4(state.color, alpha);

  // Compute final weighted center position
  result.weightedCenter = state.totalWeight > 0.001
    ? state.weightedPosSum / state.totalWeight
    : fallbackPos;

  // Compute final normal direction
  result.averageNormal = length(state.normalSum) > 0.001
    ? normalize(state.normalSum)
    : normalize(rayDir);

  return result;
}

//----------------------------------------------
// TRUE N-D RAYMARCHING (when USE_TRUE_ND is defined)
//----------------------------------------------
#ifdef USE_TRUE_ND

/**
 * Main raymarching function for true N-D mode.
 * Uses float[11] arrays for proper N-dimensional calculations.
 *
 * Returns: RaymarchResult with color, weighted position, and normal
 */
RaymarchResult raymarchBlackHoleND(vec3 rayOrigin, vec3 rayDir, float time) {
  // Use shared accumulation state to reduce code duplication
  AccumulationState accum = initAccumulation();

  // Bounding Sphere Skip
  float farRadius = uFarRadius * uHorizonRadius;
  vec2 intersect = intersectSphere(rayOrigin, rayDir, farRadius);
  
  // If miss or sphere is behind, sample background immediately
  if (intersect.x < 0.0 && intersect.y < 0.0 || intersect.y < 0.0) {
      RaymarchResult res;
      // Alpha = 1.0 so black hole's background is visible (not scene's un-lensed skybox)
      res.color = vec4(sampleBackground(rayDir), 1.0);
      res.weightedCenter = rayOrigin + rayDir * 1000.0;
      res.averageNormal = -rayDir;
      return res;
  }

  float tNear = max(0.0, intersect.x);
  float tFar = intersect.y;
  
  // Advance start position to sphere entry
  vec3 startPos = rayOrigin + rayDir * tNear;
  
  // Initialize N-D position and direction from the start point
  float posN[11];
  float dirN[11];
  embedRay3DtoND(startPos, rayDir, posN, dirN, time);

  float totalDist = tNear;
  float maxDist = tFar;

  // Store direction for background sampling
  vec3 bentDirection = rayDir;

  bool hitHorizon = false;

  for (int i = 0; i < 512; i++) {
    if (i >= uMaxSteps) break;
    if (totalDist > maxDist) break;
    if (accum.transmittance < uTransmittanceCutoff) break;

    // Calculate N-dimensional distance using full N-D position
    float ndRadius = ndDistanceND(posN);

    // Check for horizon crossing
    if (isInsideHorizon(ndRadius)) {
      hitHorizon = true;
      break;
    }

    // Calculate adaptive step size
    float stepSize = adaptiveStepSize(ndRadius);

    // Apply gravitational lensing in N-D (bend the ray)
    bendRayND(dirN, posN, stepSize, ndRadius);

    // Project to 3D for background and manifold sampling
    vec3 pos3d = projectNDto3D(posN);
    bentDirection = normalize(vec3(dirN[0], dirN[1], dirN[2]));

    // Sample photon shell
    vec3 shellColor = photonShellEmission(ndRadius);
    if (length(shellColor) > 0.001) {
      accum.color += shellColor * accum.transmittance;
    }

    // Sample accretion manifold using 3D projection
    float density = manifoldDensity(pos3d, ndRadius, time);
    if (density > 0.001) {
      // Get manifold emission
      vec3 manifoldEmit = manifoldColor(pos3d, ndRadius, density, time);

      // Apply FakeLit lighting if enabled (uLightingMode == 1)
      if (uLightingMode == 1) {
        // Compute pseudo-normal from density gradient
        vec3 normal = computeManifoldNormal(pos3d, ndRadius, time);

        // Simple lambertian diffuse + specular
        vec3 lightPos = uLightPositions[0];
        vec3 lightDir = normalize(lightPos - pos3d);

        // Diffuse (Lambertian)
        float NdotL = max(dot(normal, lightDir), 0.0);
        float diffuse = NdotL;

        // Specular (Blinn-Phong)
        vec3 viewDir = normalize(uCameraPosition - pos3d);
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float specular = pow(NdotH, 32.0 * (1.0 - uRoughness + 0.1)) * uSpecular;

        // Apply lighting: ambient + diffuse + specular
        float lightContrib = uAmbientTint + diffuse * (1.0 - uAmbientTint);
        manifoldEmit *= lightContrib;
        manifoldEmit += vec3(specular) * uLightColors[0];
      }

      // Apply motion blur if enabled
      #ifdef USE_MOTION_BLUR
        manifoldEmit = applyMotionBlur(manifoldEmit, pos3d, ndRadius, density, time);
      #endif

      // Apply Doppler shift
      float dopplerFac = dopplerFactor(pos3d, rayDir);
      manifoldEmit = applyDopplerShift(manifoldEmit, dopplerFac);

      // Use shared accumulation helper for volumetric integration
      accumulateEmission(accum, manifoldEmit, density, stepSize, pos3d);
    }

    // Sample polar jets
    #ifdef USE_JETS
    float jetDens = jetDensity(pos3d, time);
    if (jetDens > 0.001) {
      vec3 jetColor = jetEmission(pos3d, jetDens, time);
      float jetAbsorption = exp(-jetDens * uAbsorption * 0.5 * stepSize);
      accum.color += jetColor * accum.transmittance * (1.0 - jetAbsorption);
      accum.transmittance *= jetAbsorption;
    }
    #endif

    // Add edge glow near horizon
    vec3 edgeGlow = computeEdgeGlow(ndRadius, accum.color);
    accum.color += edgeGlow * accum.transmittance * stepSize * 0.1;

    // Advance ray position in N-D
    advanceRayND(posN, dirN, stepSize);
    totalDist += stepSize;
  }

  // Get final 3D position for fallback
  vec3 finalPos3d = projectNDto3D(posN);

  // Handle horizon hit or background
  if (hitHorizon) {
    accum.color += uEdgeGlowColor * uEdgeGlowIntensity * accum.transmittance * 0.5;
    accum.transmittance = 0.0;
  } else if (accum.transmittance > 0.01) {
    vec3 bgColor = sampleBackground(bentDirection);
    accum.color += bgColor * accum.transmittance;
    // Set transmittance to 0 so alpha = 1.0, making bent background opaque
    accum.transmittance = 0.0;
  }

  // Apply bloom boost for HDR
  accum.color *= uBloomBoost;

  // Use shared finalization helper
  return finalizeAccumulation(accum, finalPos3d, rayDir);
}

#endif // USE_TRUE_ND

//----------------------------------------------
// 3D SLICE RAYMARCHING (default mode)
//----------------------------------------------

/**
 * Main raymarching function (3D slice mode).
 * Uses 3D position with paramValues for higher dimensions.
 *
 * Returns: RaymarchResult with color, weighted position, and normal
 */
RaymarchResult raymarchBlackHole(vec3 rayOrigin, vec3 rayDir, float time) {
  // Use shared accumulation state to reduce code duplication
  AccumulationState accum = initAccumulation();

  // Bounding Sphere Intersection
  float farRadius = uFarRadius * uHorizonRadius;
  vec2 intersect = intersectSphere(rayOrigin, rayDir, farRadius);

  // Skip if ray misses the bounding volume
  if (intersect.x < 0.0 && intersect.y < 0.0 || intersect.y < 0.0) {
      RaymarchResult res;
      // Alpha = 1.0 so black hole's background is visible (not scene's un-lensed skybox)
      res.color = vec4(sampleBackground(rayDir), 1.0);
      res.weightedCenter = rayOrigin + rayDir * 1000.0;
      res.averageNormal = -rayDir;
      return res;
  }

  // Jump to entry point
  float tNear = max(0.0, intersect.x);
  float tFar = intersect.y;
  
  vec3 pos = rayOrigin + rayDir * tNear;
  vec3 dir = rayDir;
  
  // Track total distance travelled along the ray (including the jump)
  float totalDist = tNear;
  float maxDist = tFar;

  // Store initial direction for background sampling
  vec3 bentDirection = dir;

  bool hitHorizon = false;

  for (int i = 0; i < 512; i++) {
    if (i >= uMaxSteps) break;
    // Stop if we exit the bounding sphere
    if (totalDist > maxDist) break;
    if (accum.transmittance < uTransmittanceCutoff) break;

    // Calculate N-dimensional distance
    float ndRadius = ndDistance(pos);

    // Check for horizon crossing
    if (isInsideHorizon(ndRadius)) {
      hitHorizon = true;
      break;
    }

    // Calculate adaptive step size
    float stepSize = adaptiveStepSize(ndRadius);

    // Apply gravitational lensing (bend the ray)
    dir = bendRay(dir, pos, stepSize, ndRadius);
    bentDirection = dir; // Track for background

    // Sample photon shell
    vec3 shellColor = photonShellEmission(ndRadius);
    if (length(shellColor) > 0.001) {
      accum.color += shellColor * accum.transmittance;
    }

    // Sample accretion manifold
    float density = manifoldDensity(pos, ndRadius, time);
    if (density > 0.001) {
      // Get manifold emission
      vec3 manifoldEmit = manifoldColor(pos, ndRadius, density, time);

      // Apply FakeLit lighting if enabled (uLightingMode == 1)
      if (uLightingMode == 1) {
        // Compute pseudo-normal from density gradient
        vec3 normal = computeManifoldNormal(pos, ndRadius, time);

        // Simple lambertian diffuse + specular
        // Use first light position if available, otherwise default to camera-relative
        vec3 lightPos = uLightPositions[0];
        vec3 lightDir = normalize(lightPos - pos);

        // Diffuse (Lambertian)
        float NdotL = max(dot(normal, lightDir), 0.0);
        float diffuse = NdotL;

        // Specular (Blinn-Phong)
        vec3 viewDir = normalize(uCameraPosition - pos);
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float specular = pow(NdotH, 32.0 * (1.0 - uRoughness + 0.1)) * uSpecular;

        // Apply lighting: ambient + diffuse + specular
        float lightContrib = uAmbientTint + diffuse * (1.0 - uAmbientTint);
        manifoldEmit *= lightContrib;
        manifoldEmit += vec3(specular) * uLightColors[0];
      }

      // Apply motion blur if enabled
      #ifdef USE_MOTION_BLUR
        manifoldEmit = applyMotionBlur(manifoldEmit, pos, ndRadius, density, time);
      #endif

      // Apply Doppler shift
      float dopplerFac = dopplerFactor(pos, rayDir);
      manifoldEmit = applyDopplerShift(manifoldEmit, dopplerFac);

      // Use shared accumulation helper for volumetric integration
      accumulateEmission(accum, manifoldEmit, density, stepSize, pos);
    }

    // Sample polar jets
    #ifdef USE_JETS
    float jetDens = jetDensity(pos, time);
    if (jetDens > 0.001) {
      vec3 jetColor = jetEmission(pos, jetDens, time);
      float jetAbsorption = exp(-jetDens * uAbsorption * 0.5 * stepSize);
      accum.color += jetColor * accum.transmittance * (1.0 - jetAbsorption);
      accum.transmittance *= jetAbsorption;
    }
    #endif

    // Add edge glow near horizon
    vec3 edgeGlow = computeEdgeGlow(ndRadius, accum.color);
    accum.color += edgeGlow * accum.transmittance * stepSize * 0.1;

    // Advance ray position
    pos += dir * stepSize;
    totalDist += stepSize;
  }

  // Handle horizon hit or background
  if (hitHorizon) {
    // Inside horizon: event horizon should be PURE BLACK
    // Light cannot escape the event horizon - complete absorption
    // Edge glow is already added NEAR the horizon during raymarch loop
    accum.color = vec3(0.0);
    accum.transmittance = 0.0;
  } else if (accum.transmittance > 0.01) {
    // Sample background with bent ray direction
    vec3 bgColor = sampleBackground(bentDirection);
    accum.color += bgColor * accum.transmittance;
    // Set transmittance to 0 so alpha = 1.0, making bent background opaque
    // This prevents the scene's un-lensed skybox from showing through
    accum.transmittance = 0.0;
  }

  // Apply bloom boost for HDR
  accum.color *= uBloomBoost;

  // Use shared finalization helper
  return finalizeAccumulation(accum, pos, rayDir);
}

//----------------------------------------------
// SDF DISK RAYMARCHING (Einstein Ring mode)
//----------------------------------------------
#ifdef USE_SDF_DISK

/**
 * Accumulate disk hit into raymarch result.
 * Handles transparency/absorption per hit.
 */
void accumulateDiskHit(
  inout AccumulationState accum,
  vec3 hitColor,
  vec3 hitPos,
  vec3 normal
) {
  // For surface hits, use opacity-based blending
  float hitOpacity = 0.85;

  if (uEnableAbsorption) {
    float absorption = exp(-uAbsorption * 0.5);
    accum.color += hitColor * accum.transmittance * (1.0 - absorption);
    accum.transmittance *= absorption;
  } else {
    accum.color += hitColor * accum.transmittance * hitOpacity;
    accum.transmittance *= (1.0 - hitOpacity);
  }

  // Accumulate position for temporal reprojection
  float weight = accum.transmittance + 0.1;
  accum.weightedPosSum += hitPos * weight;
  accum.totalWeight += weight;
  accum.normalSum += normal * weight;
}

/**
 * Main raymarching function for SDF disk mode.
 *
 * Uses plane crossing detection for Einstein ring effect:
 * - Rays bend around black hole via gravitational lensing
 * - Each time the ray crosses y=0 (disk plane), we check if it's in disk bounds
 * - Multiple crossings accumulate color, naturally creating Einstein rings
 *
 * Photon shell and jets still use volumetric sampling for glow effects.
 */
RaymarchResult raymarchBlackHoleSDF(vec3 rayOrigin, vec3 rayDir, float time) {
  AccumulationState accum = initAccumulation();

  // Bounding sphere skip
  float farRadius = uFarRadius * uHorizonRadius;
  vec2 intersect = intersectSphere(rayOrigin, rayDir, farRadius);

  if (intersect.x < 0.0 && intersect.y < 0.0 || intersect.y < 0.0) {
    RaymarchResult res;
    res.color = vec4(sampleBackground(rayDir), 1.0);
    res.weightedCenter = rayOrigin + rayDir * 1000.0;
    res.averageNormal = -rayDir;
    return res;
  }

  float tNear = max(0.0, intersect.x);
  float tFar = intersect.y;

  vec3 pos = rayOrigin + rayDir * tNear;
  vec3 dir = rayDir;
  vec3 prevPos = pos;

  float totalDist = tNear;
  float maxDist = tFar;
  vec3 bentDirection = dir;

  bool hitHorizon = false;
  int diskCrossings = 0;

  for (int i = 0; i < 512; i++) {
    if (i >= uMaxSteps) break;
    if (totalDist > maxDist) break;
    if (accum.transmittance < uTransmittanceCutoff) break;

    float ndRadius = ndDistance(pos);

    // Horizon check
    if (isInsideHorizon(ndRadius)) {
      hitHorizon = true;
      break;
    }

    // Adaptive step size
    float stepSize = adaptiveStepSize(ndRadius);

    // Apply gravitational lensing (reused from volumetric)
    dir = bendRay(dir, pos, stepSize, ndRadius);
    bentDirection = dir;

    // Sample photon shell (volumetric glow effect)
    vec3 shellColor = photonShellEmission(ndRadius);
    if (length(shellColor) > 0.001) {
      accum.color += shellColor * accum.transmittance * stepSize * 2.0;
    }

    // Store previous position before advancing
    prevPos = pos;

    // Advance ray
    pos += dir * stepSize;
    totalDist += stepSize;

    // === DISK PLANE CROSSING DETECTION ===
    if (diskCrossings < MAX_DISK_CROSSINGS) {
      vec3 crossingPos;
      if (detectDiskCrossing(prevPos, pos, crossingPos)) {
        // Shade this disk hit
        vec3 hitColor = shadeDiskHit(crossingPos, dir, diskCrossings, time);
        vec3 diskNormal = computeDiskNormal(crossingPos, dir);
        accumulateDiskHit(accum, hitColor, crossingPos, diskNormal);
        diskCrossings++;
      }
    }

    // Sample polar jets (volumetric, if enabled)
    #ifdef USE_JETS
    float jetDens = jetDensity(pos, time);
    if (jetDens > 0.001) {
      vec3 jetColor = jetEmission(pos, jetDens, time);
      float jetAbsorption = exp(-jetDens * uAbsorption * 0.5 * stepSize);
      accum.color += jetColor * accum.transmittance * (1.0 - jetAbsorption);
      accum.transmittance *= jetAbsorption;
    }
    #endif

    // Edge glow near horizon
    vec3 edgeGlow = computeEdgeGlow(ndRadius, accum.color);
    accum.color += edgeGlow * accum.transmittance * stepSize * 0.1;
  }

  // Handle horizon or background
  if (hitHorizon) {
    accum.color = vec3(0.0);
    accum.transmittance = 0.0;
  } else if (accum.transmittance > 0.01) {
    vec3 bgColor = sampleBackground(bentDirection);
    accum.color += bgColor * accum.transmittance;
    accum.transmittance = 0.0;
  }

  accum.color *= uBloomBoost;

  return finalizeAccumulation(accum, pos, rayDir);
}

#endif // USE_SDF_DISK

void main() {
  // Get ray from camera through box surface point (BackSide rendering)
  // This is the standard raymarching approach used by Mandelbulb/Schroedinger
  vec3 rayOrigin = uCameraPosition;
  vec3 rayDir = normalize(vPosition - uCameraPosition);

  // DEBUG: Visualize ray direction to verify rays are set up correctly
  // Uncomment the following block to debug:
  // gColor = vec4(rayDir * 0.5 + 0.5, 1.0);
  // gNormal = vec4(0.5, 0.5, 1.0, 1.0);
  // return;

  // Get animation time
  float time = uTime * uTimeScale;

  // Raymarch the black hole using appropriate mode
  #ifdef USE_SDF_DISK
    // SDF disk with plane crossing detection for Einstein ring
    RaymarchResult result = raymarchBlackHoleSDF(rayOrigin, rayDir, time);
  #elif defined(USE_TRUE_ND)
    // True N-D raymarching with float[11] arrays
    RaymarchResult result = raymarchBlackHoleND(rayOrigin, rayDir, time);
  #else
    // 3D slice raymarching (faster, uses paramValues for higher dimensions)
    RaymarchResult result = raymarchBlackHole(rayOrigin, rayDir, time);
  #endif

  // Output color
  gColor = result.color;

  // Compute view-space normal for deferred rendering
  // Transform world-space normal to view-space
  vec3 viewNormalRaw = mat3(uViewMatrix) * result.averageNormal;
  float vnLen = length(viewNormalRaw);
  vec3 viewNormal = vnLen > 0.0001 ? viewNormalRaw / vnLen : vec3(0.0, 0.0, 1.0);

  // Encode normal to [0,1] range and output
  // Alpha = 1.0 to prevent premultiplied alpha issues
  gNormal = vec4(viewNormal * 0.5 + 0.5, 1.0);

  // Output world position for temporal reprojection (only when gPosition is declared)
  #ifdef USE_TEMPORAL_ACCUMULATION
    // Use density-weighted center position for stable reprojection
    // This prevents smearing artifacts during camera rotation
    gPosition = vec4(result.weightedCenter, result.color.a);
  #endif
}
`

export const mainBlockIsosurface = mainBlock // Same for now, could add isosurface mode later
