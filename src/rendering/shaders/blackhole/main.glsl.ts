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
  // CRITICAL: Allow very small steps near horizon (0.02x) to capture grazing rays
  // for the photon ring and Einstein ring effects without clipping into the horizon.
  step *= mix(0.02, 1.0, horizonFactor);

  // Distance-Based Step Relaxation:
  // Allow step size to grow with distance to save steps in empty space.
  // Standard uStepMax (default ~0.2) is too restrictive at far distances (e.g. 35.0).
  // At radius 30, dynamicMax becomes ~0.2 * 16 = 3.2, allowing efficient traversal.
  float dynamicMax = uStepMax * (1.0 + ndRadius * 0.5);

  return clamp(step, uStepMin, dynamicMax);
}

/**
 * Sample background environment with bent ray.
 *
 * Uses the general skybox system - no built-in procedural fallback.
 * When envMap is not ready or skybox is disabled, returns black.
 */
vec3 sampleBackground(vec3 bentDir) {
  #ifdef USE_ENVMAP
    // Only sample envMap when it's valid (avoids sampling null texture)
    if (uEnvMapReady > 0.5) {
      // Transform bent ray from Local Space to World Space for environment sampling.
      // The black hole simulation runs in Local Space (for scale/rotation), but the
      // environment map (Skybox) is in World Space.
      // Without this transform, rotating the black hole rotates the reflection of the skybox.
      vec3 worldBentDir = normalize(mat3(uModelMatrix) * bentDir);
      return texture(envMap, worldBentDir).rgb;
    }
  #endif

  // No envMap available - return black (relies on general skybox feature)
  return vec3(0.0);
}

/**
 * Raymarch result struct for MRT outputs.
 */
struct RaymarchResult {
  vec4 color;           // RGB + alpha
  vec3 weightedCenter;  // Density-weighted position for temporal reprojection
  vec3 averageNormal;   // Accumulated normal direction
  vec3 firstHitPos;     // First surface hit position (for depth buffer)
  float hasHit;         // 1.0 if hit anything, 0.0 otherwise (avoid bool for GPU compatibility)
};

/**
 * Raymarch accumulation state for volumetric integration.
 */
struct AccumulationState {
  vec3 color;              // Accumulated color
  float transmittance;     // Remaining light (starts at 1.0)
  float totalDensity;      // Total integrated density
  vec3 weightedPosSum;     // Density-weighted position sum
  float totalWeight;       // Total weight for averaging
  vec3 normalSum;          // Accumulated normal direction
  vec3 firstHitPos;        // First hit position for depth
  float hasFirstHit;       // 1.0 if recorded, 0.0 otherwise (avoid bool for GPU compat)
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
  s.firstHitPos = vec3(0.0);
  s.hasFirstHit = 0.0;
  return s;
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

  // First hit position for depth buffer
  result.firstHitPos = state.hasFirstHit > 0.5 ? state.firstHitPos : fallbackPos;
  result.hasHit = state.hasFirstHit;

  return result;
}

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
  // Record first hit for depth buffer
  if (accum.hasFirstHit < 0.5) {
    accum.firstHitPos = hitPos;
    accum.hasFirstHit = 1.0;
  }

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

// Interleaved Gradient Noise (High quality dithering)
float interleavedGradientNoise(vec2 uv) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(uv, magic.xy)));
}

/**
 * Main raymarching function.
 */
RaymarchResult raymarchBlackHole(vec3 rayOrigin, vec3 rayDir, float time) {
  AccumulationState accum = initAccumulation();

  // Bounding sphere skip
  // Scale is now handled by mesh transform, so rayOrigin/rayDir are already in local space
  // We remove the hardcoded 500.0 min radius to respect uFarRadius and match geometry
  float farRadius = uFarRadius * uHorizonRadius;
  vec2 intersect = intersectSphere(rayOrigin, rayDir, farRadius);

  // Early exit if entire bounding sphere is behind the camera
  // intersect.y is the far intersection - if it's negative, the sphere is entirely behind us
  if (intersect.y < 0.0) {
    RaymarchResult res;
    res.color = vec4(sampleBackground(rayDir), 1.0);
    res.weightedCenter = rayOrigin + rayDir * 1000.0;
    res.averageNormal = -rayDir;
    res.firstHitPos = rayOrigin + rayDir * 1000.0;
    res.hasHit = 0.0;
    return res;
  }

  float tNear = max(0.0, intersect.x);
  float tFar = intersect.y;

  // Dithering to hide banding (Interleaved Gradient Noise)
  float dither = interleavedGradientNoise(gl_FragCoord.xy + fract(time));

  // Apply dithering to start position (jitter along ray)
  // Small base jitter to break up banding artifacts
  float startOffset = dither * 0.1;

  vec3 pos = rayOrigin + rayDir * (tNear + startOffset);
  vec3 dir = rayDir;
  vec3 prevPos = pos;
  
  float totalDist = tNear + startOffset;
  float maxDist = tFar;

  // Pre-bend ray (initial deflection)
  float entryNdRadius = ndDistance(pos);
  dir = bendRay(dir, pos, 0.1, entryNdRadius);
  vec3 bentDirection = dir;

  bool hitHorizon = false;
  int diskCrossings = 0;

  // Adaptive quality: reduce max steps based on screen coverage
  // When zoomed in close, uQualityMultiplier decreases to maintain FPS
  int effectiveMaxSteps = max(int(float(uMaxSteps) * uQualityMultiplier), 32);

  for (int i = 0; i < 512; i++) {
    if (i >= effectiveMaxSteps) break;
    if (totalDist > maxDist) break;
    if (accum.transmittance < uTransmittanceCutoff) break; // Early exit for opaque

    float ndRadius = ndDistance(pos);

    // Horizon check
    if (isInsideHorizon(ndRadius)) {
      hitHorizon = true;
      break;
    }

    // Adaptive step size
    float stepSize = adaptiveStepSize(ndRadius);
    
    // In volumetric mode, we might want smaller steps inside the disk
    #ifdef USE_VOLUMETRIC_DISK
    float diskH = abs(pos.y);
    float diskR = length(pos.xz);
    // Simple check if we are near the disk plane
    if (diskH < uManifoldThickness * uHorizonRadius * 2.0 && 
        diskR > uHorizonRadius * uDiskInnerRadiusMul * 0.8 && 
        diskR < uHorizonRadius * uDiskOuterRadiusMul * 1.2) {
       // Relax step size in fast mode (0.1) vs high quality (0.05)
       float diskStepLimit = uFastMode ? 0.1 : 0.05;
       stepSize = min(stepSize, diskStepLimit * uHorizonRadius); // Force smaller steps in disk
    }
    #endif

    // Apply lensing
    dir = bendRay(dir, pos, stepSize, ndRadius);
    bentDirection = dir;

    // Sample photon shell (volumetric glow effect)
    vec3 shellColor = photonShellEmission(ndRadius, pos);
    if (length(shellColor) > 0.001) {
      accum.color += shellColor * accum.transmittance * stepSize * 2.0;
    }

    prevPos = pos;
    pos += dir * stepSize;
    totalDist += stepSize;

    // === ACCRETION DISK ===
    
    #ifdef USE_VOLUMETRIC_DISK
    // Volumetric sampling
    float density = getDiskDensity(pos, time);
    if (density > 0.001) {
        // Calculate normal if needed for coloring or if likely needed for depth
        // Optimization: reuse normal for both
        vec3 stepNormal = vec3(0.0, 1.0, 0.0);
        bool computedNormal = false;

        if (uColorAlgorithm == ALGO_NORMAL) {
             stepNormal = computeVolumetricDiskNormal(pos, dir);
             computedNormal = true;
        }

        // Calculate emission with Doppler support (pass dir as viewDir)
        vec3 emission = getDiskEmission(pos, density, time, dir, stepNormal);
        
        // Beer-Lambert law integration
        // transmittance *= exp(-density * stepSize * absorption_coeff)
        // For emission-absorption:
        // L_out = L_in * T + L_emit * (1-T)
        // Here we approximate with additive blending damped by transmittance
        
        float absorption = density * uAbsorption * 2.0;
        float stepTransmittance = exp(-absorption * stepSize);
        
        // Emission contribution
        // Physically: emission * (1 - stepTransmittance) / absorption
        // Simply: emission * stepSize * transmittance
        
        vec3 stepEmission = emission * stepSize * accum.transmittance;
        accum.color += stepEmission;
        accum.transmittance *= stepTransmittance;
        
        // Update depth/normal info if this is the first significant hit
        if (accum.hasFirstHit < 0.5 && density > 0.5) {
             accum.firstHitPos = pos;
             accum.hasFirstHit = 1.0;
             if (!computedNormal) {
                 stepNormal = computeVolumetricDiskNormal(pos, dir); // Gradient-based normal
             }
             accum.normalSum = stepNormal;
        }
        
        // Accumulate weighted position
        float weight = (1.0 - stepTransmittance) * accum.transmittance;
        accum.weightedPosSum += pos * weight;
        accum.totalWeight += weight;
    }
    
    // === DISK PLANE CROSSING DETECTION (Einstein Ring) ===
    // Even in volumetric mode, we detect disk plane crossings to create
    // the Einstein ring effect. Rays bending around the black hole cross
    // the disk plane multiple times, and each crossing accumulates color.
    if (diskCrossings < MAX_DISK_CROSSINGS) {
      vec3 crossingPos;
      if (detectDiskCrossing(prevPos, pos, crossingPos)) {
        vec3 hitColor = shadeDiskHit(crossingPos, dir, diskCrossings, time);
        vec3 diskNormal = vec3(0.0, sign(prevPos.y), 0.0); // Simple normal for thin disk
        accumulateDiskHit(accum, hitColor, crossingPos, diskNormal);
        diskCrossings++;
      }
    }
    #endif

    #ifdef USE_SDF_DISK
    // Thin disk plane crossing (Einstein Ring) - Legacy SDF-only mode
    if (diskCrossings < MAX_DISK_CROSSINGS) {
      vec3 crossingPos;
      if (detectDiskCrossing(prevPos, pos, crossingPos)) {
        vec3 hitColor = shadeDiskHit(crossingPos, dir, diskCrossings, time);
        vec3 diskNormal = computeDiskNormal(crossingPos, dir);
        accumulateDiskHit(accum, hitColor, crossingPos, diskNormal);
        diskCrossings++;
      }
    }
    #endif

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

    // Edge glow
    vec3 edgeGlow = computeEdgeGlow(ndRadius, accum.color);
    accum.color += edgeGlow * accum.transmittance * stepSize * 0.1;
  }

  // Handle horizon or background
  if (hitHorizon) {
    // Record hit position for depth buffer, but DON'T reset accumulated color
    // Color from photon shell, disk, etc. should be preserved
    if (accum.hasFirstHit < 0.5) {
      accum.firstHitPos = pos;
      accum.hasFirstHit = 1.0;
      // Note: We intentionally do NOT set accum.color = vec3(0.0) here
      // because the ray may have accumulated color from the photon shell
      // or disk before reaching the horizon
    }
    accum.transmittance = 0.0;
  } else if (accum.transmittance > 0.01) {
    vec3 bgColor = sampleBackground(bentDirection);
    accum.color += bgColor * accum.transmittance;
    accum.transmittance = 0.0;
  }

  accum.color *= uBloomBoost;

  return finalizeAccumulation(accum, pos, rayDir);
}

void main() {
  // Transform ray to local space using inverse model matrix
  // This allows the mesh scale to control the visual size of the black hole
  vec3 rayOrigin = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;

  vec3 worldRayDir;

#ifdef USE_TEMPORAL_ACCUMULATION
  // Calculate screen coordinates with Bayer jitter for temporal accumulation
  vec2 screenCoord = gl_FragCoord.xy;

  // Detect quarter-res rendering mode
  bool isQuarterRes = uResolution.x < uFullResolution.x * 0.75;

  if (isQuarterRes) {
    // Quarter-res mode: Each pixel represents a 2x2 block in full res
    // Apply Bayer offset to sample different sub-pixels each frame
    screenCoord = floor(gl_FragCoord.xy) * 2.0 + uBayerOffset + 0.5;
  }

  // Compute ray direction from screen coordinate
  vec2 screenUV = screenCoord / uFullResolution;
  vec2 ndc = screenUV * 2.0 - 1.0;
  vec4 farPointClip = vec4(ndc, 1.0, 1.0);
  vec4 farPointWorld = uInverseViewProjectionMatrix * farPointClip;
  // Guard against division by zero while preserving sign
  // If w is small negative, we need to preserve the negative to avoid flipping ray direction
  float farW = abs(farPointWorld.w) < 0.0001
    ? (farPointWorld.w >= 0.0 ? 0.0001 : -0.0001)
    : farPointWorld.w;
  farPointWorld /= farW;
  worldRayDir = normalize(farPointWorld.xyz - uCameraPosition);
#else
  worldRayDir = normalize(vPosition - uCameraPosition);
#endif

  vec3 rayDir = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);

  // Get animation time
  float time = uTime * uTimeScale;

  // Raymarch the black hole using SDF disk mode
  RaymarchResult result = raymarchBlackHole(rayOrigin, rayDir, time);

  // Output color
  gColor = result.color;

  // Compute view-space normal for deferred rendering
  // Transform local-space normal to world-space (Inverse Transpose of Model Matrix)
  // Then world-space to view-space
  // Normal matrix = transpose(inverse(mat3(modelMatrix)))
  // Since we have uModelMatrix, we can use it directly if uniform scaling
  // For non-uniform scaling, we'd need a proper normal matrix, but scale is uniform here.
  vec3 worldNormal = normalize(mat3(uModelMatrix) * result.averageNormal);
  vec3 viewNormalRaw = mat3(uViewMatrix) * worldNormal;
  float vnLen = length(viewNormalRaw);
  vec3 viewNormal = vnLen > 0.0001 ? viewNormalRaw / vnLen : vec3(0.0, 0.0, 1.0);

  // Encode normal to [0,1] range and output
  // Alpha = 1.0 to prevent premultiplied alpha issues
  gNormal = vec4(viewNormal * 0.5 + 0.5, 1.0);

  // Output depth buffer (same approach as Mandelbulb)
  // For hits: compute clip-space depth from first hit position
  // Scale positions back from "black hole space" to world space using Model Matrix
  // For background only: use far plane (1.0)
  if (result.hasHit > 0.5) {
    vec4 worldHitPos = uModelMatrix * vec4(result.firstHitPos, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    // Guard against division by zero while preserving sign for correct depth
    float clipW = abs(clipPos.w) < 0.0001
      ? (clipPos.w >= 0.0 ? 0.0001 : -0.0001)
      : clipPos.w;
    gl_FragDepth = clamp((clipPos.z / clipW) * 0.5 + 0.5, 0.0, 1.0);
  } else {
    // No hit - use far plane depth
    gl_FragDepth = 1.0;
  }

  // Output world position for temporal reprojection
  // ALWAYS write gPosition to prevent GL_INVALID_OPERATION when switching layers.
  // When temporal is OFF, this output is ignored by mainObjectMRT (count: 2).
  // When temporal is ON, this provides actual position data for reprojection.
  #ifdef USE_TEMPORAL_ACCUMULATION
    // Use density-weighted center position for stable reprojection
    // Transform back to world space
    vec4 worldWeightedPos = uModelMatrix * vec4(result.weightedCenter, 1.0);
    gPosition = vec4(worldWeightedPos.xyz, result.color.a);
  #else
    // Dummy output when temporal is disabled (ignored by render target)
    gPosition = vec4(0.0);
  #endif
}
`

export const mainBlockIsosurface = mainBlock // Same for now, could add isosurface mode later