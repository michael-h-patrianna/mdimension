/**
 * Volume integration loop for Schrödinger density field
 *
 * Performs front-to-back compositing along rays through the volume.
 * Uses Beer-Lambert absorption and emission accumulation.
 *
 * Key optimizations:
 * - Early ray termination when transmittance is low
 * - Adaptive step size based on density
 * - Gaussian bounds allow aggressive culling
 */
export const volumeIntegrationBlock = `
// ============================================
// Volume Integration (Beer-Lambert Compositing)
// ============================================

// Maximum samples per ray
#define MAX_VOLUME_SAMPLES 128

// Minimum transmittance before early exit
#define MIN_TRANSMITTANCE 0.01

// Minimum density to consider for accumulation
#define MIN_DENSITY 1e-8

// Threshold for considering a sample as "entry" into the volume
#define ENTRY_ALPHA_THRESHOLD 0.01

// Result structure for volume raymarching
// Includes weighted center for temporal reprojection (more stable than entry point)
struct VolumeResult {
    vec3 color;
    float alpha;
    float entryT;         // Distance to first meaningful contribution (-1 if none)
    vec3 weightedCenter;  // Density-weighted center position (for stable reprojection)
    float centerWeight;   // Weight sum for center (0 if no valid center)
};

// Compute time value for animation
float getVolumeTime() {
    return uTime * uTimeScale;
}

// Compute gradient of log-density for pseudo-normals (central differences - higher accuracy)
// Used by isosurface mode where precision matters
vec3 computeDensityGradient(vec3 pos, float t, float delta) {
    vec3 grad;

    float sxp = sFromRho(sampleDensity(pos + vec3(delta, 0.0, 0.0), t));
    float sxn = sFromRho(sampleDensity(pos - vec3(delta, 0.0, 0.0), t));
    grad.x = sxp - sxn;

    float syp = sFromRho(sampleDensity(pos + vec3(0.0, delta, 0.0), t));
    float syn = sFromRho(sampleDensity(pos - vec3(0.0, delta, 0.0), t));
    grad.y = syp - syn;

    float szp = sFromRho(sampleDensity(pos + vec3(0.0, 0.0, delta), t));
    float szn = sFromRho(sampleDensity(pos - vec3(0.0, 0.0, delta), t));
    grad.z = szp - szn;

    return grad / (2.0 * delta);
}

// OPTIMIZED: Compute gradient using forward differences with pre-computed center value
// Reduces samples from 6 to 3 by reusing the already-computed center density
// Used by volumetric mode where speed matters more than precision
vec3 computeDensityGradientFast(vec3 pos, float t, float delta, float sCenter) {
    // Forward differences: f'(x) ≈ (f(x+h) - f(x)) / h
    float sxp = sFromRho(sampleDensity(pos + vec3(delta, 0.0, 0.0), t));
    float syp = sFromRho(sampleDensity(pos + vec3(0.0, delta, 0.0), t));
    float szp = sFromRho(sampleDensity(pos + vec3(0.0, 0.0, delta), t));

    return vec3(sxp - sCenter, syp - sCenter, szp - sCenter) / delta;
}

// Main volume raymarching function (Fast Mode)
// Now supports lighting (matched to Mandelbulb behavior) but with reduced sample count
// When dispersion is enabled, uses vec3 transmittance for proper per-channel absorption
// Returns: VolumeResult with color, alpha, entry distance, and density-weighted centroid
VolumeResult volumeRaymarch(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float entryT = -1.0;  // Track first meaningful contribution

    // Centroid accumulation for stable temporal reprojection
    vec3 centroidSum = vec3(0.0);
    float centroidWeight = 0.0;

    // Calculate step count based on uniform (from LOD system)
    int sampleCount = uSampleCount > 0 ? uSampleCount : uSampleQuality;
    if (uFastMode) sampleCount /= 2;
    sampleCount = clamp(sampleCount, 16, MAX_VOLUME_SAMPLES);

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    // Time for animation
    float animTime = getVolumeTime();
    vec3 viewDir = -rayDir;

#ifdef USE_DISPERSION
    // Dispersion requires per-channel transmittance for proper wavelength-dependent absorption
    vec3 transmittance3 = vec3(1.0);
    vec3 dispOffsetR = vec3(0.0);
    vec3 dispOffsetB = vec3(0.0);
    bool dispersionActive = uDispersionEnabled && uDispersionStrength > 0.0;

    if (dispersionActive) {
        float dispAmount = uDispersionStrength * 0.15;

        if (uDispersionDirection == 1) { // View-aligned
            // Use alternative up vector when rayDir is nearly vertical to avoid NaN from zero cross product
            vec3 up = abs(rayDir.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
            vec3 right = normalize(cross(rayDir, up));
            dispOffsetR = right * dispAmount;
            dispOffsetB = -right * dispAmount;
        }
        // Radial mode: offset updated inside loop
    }
#else
    // Without dispersion, use scalar transmittance for better performance
    float transmittance = 1.0;
#endif

    // Consecutive low-density samples (for early exit)
    int lowDensityCount = 0;
    bool allowEarlyExit = (uQuantumMode == QUANTUM_MODE_HARMONIC);

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;

#ifdef USE_DISPERSION
        // Exit when all channels are blocked
        if (transmittance3.r < MIN_TRANSMITTANCE &&
            transmittance3.g < MIN_TRANSMITTANCE &&
            transmittance3.b < MIN_TRANSMITTANCE) break;
#else
        if (transmittance < MIN_TRANSMITTANCE) break;
#endif

        vec3 pos = rayOrigin + rayDir * t;

        // Sample density with phase info
        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
        float sCenter = densityInfo.y; // Pre-computed log-density
        float phase = densityInfo.z;

        // Early exit if density is consistently low (harmonic oscillator only)
        if (allowEarlyExit && rho < MIN_DENSITY) {
            lowDensityCount++;
            if (lowDensityCount > 5) break;
        } else {
            lowDensityCount = 0;
        }

        // Compute gradient for lighting (Fast version - 3 taps)
        // Must be computed BEFORE dispersion to enable gradient-based density extrapolation
        vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);

#ifdef USE_DISPERSION
        // Chromatic Dispersion: compute per-channel densities BEFORE alpha check
        // This matches HQ mode structure - dispersion can make R/B visible even when center is dim
        vec3 rhoRGB = vec3(rho);

        if (dispersionActive) {
            // Update radial offset per sample
            if (uDispersionDirection == 0) {
                vec3 normalProxy = normalize(pos);
                float dispAmount = uDispersionStrength * 0.15;
                dispOffsetR = normalProxy * dispAmount;
                dispOffsetB = -normalProxy * dispAmount;
            }

            // Extrapolate log-density for R/B channels using gradient (zero extra cost)
            float s_r = sCenter + dot(gradient, dispOffsetR);
            float s_b = sCenter + dot(gradient, dispOffsetB);

            // Per-channel density from gradient extrapolation
            rhoRGB.r = exp(s_r);
            rhoRGB.b = exp(s_b);
        }

        // Nodal Surface Opacity Boost - apply to ALL channels (matches HQ mode)
        vec3 rhoAlpha = rhoRGB;
#ifdef USE_NODAL
        if (uNodalEnabled) {
             if (sCenter < -5.0 && sCenter > -12.0) {
                 float intensity = 1.0 - smoothstep(-12.0, -5.0, sCenter);
                 rhoAlpha += vec3(5.0 * uNodalStrength * intensity);
             }
        }
#endif

        // Per-channel alpha (matches HQ mode structure)
        vec3 alpha3;
        alpha3.r = computeAlpha(rhoAlpha.r, stepLen, uDensityGain);
        alpha3.g = computeAlpha(rhoAlpha.g, stepLen, uDensityGain);
        alpha3.b = computeAlpha(rhoAlpha.b, stepLen, uDensityGain);

        // Check if ANY channel has significant contribution (matches HQ mode)
        if (alpha3.g > 0.001 || alpha3.r > 0.001 || alpha3.b > 0.001) {
            // Track entry point (use Green/Center channel)
            if (entryT < 0.0 && alpha3.g > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // CENTROID ACCUMULATION (use average)
            float avgAlpha = (alpha3.r + alpha3.g + alpha3.b) / 3.0;
            float avgTrans = (transmittance3.r + transmittance3.g + transmittance3.b) / 3.0;
            float weight = avgAlpha * avgTrans;
            centroidSum += pos * weight;
            centroidWeight += weight;

            // Compute emission from green channel, modulate R/B (matches HQ mode)
            vec3 emissionCenter = computeEmissionLit(rhoRGB.g, phase, pos, gradient, viewDir);
            vec3 emission;
            emission.g = emissionCenter.g;
            emission.r = emissionCenter.r * (rhoRGB.r / max(rhoRGB.g, 0.0001));
            emission.b = emissionCenter.b * (rhoRGB.b / max(rhoRGB.g, 0.0001));

            // Front-to-back compositing with per-channel transmittance
            accColor += transmittance3 * alpha3 * emission;
            transmittance3 *= (vec3(1.0) - alpha3);
        }
#else
        // Non-dispersion path: scalar alpha for better performance
        float rhoAlpha = rho;
#ifdef USE_NODAL
        if (uNodalEnabled) {
             if (sCenter < -5.0 && sCenter > -12.0) {
                 float intensity = 1.0 - smoothstep(-12.0, -5.0, sCenter);
                 rhoAlpha += 5.0 * uNodalStrength * intensity;
             }
        }
#endif

        float alpha = computeAlpha(rhoAlpha, stepLen, uDensityGain);

        if (alpha > 0.001) {
            if (entryT < 0.0 && alpha > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // CENTROID ACCUMULATION
            float weight = alpha * transmittance;
            centroidSum += pos * weight;
            centroidWeight += weight;

            // Compute emission with lighting
            vec3 emission = computeEmissionLit(rho, phase, pos, gradient, viewDir);

            // Front-to-back compositing (scalar path)
            accColor += transmittance * alpha * emission;
            transmittance *= (1.0 - alpha);
        }
#endif

        t += stepLen;
    }

    // Final alpha
#ifdef USE_DISPERSION
    float finalAlpha = 1.0 - (transmittance3.r + transmittance3.g + transmittance3.b) / 3.0;
#else
    float finalAlpha = 1.0 - transmittance;
#endif

    // Fallback: if no entry found, use midpoint for depth
    if (entryT < 0.0) {
        entryT = (tNear + tFar) * 0.5;
    }

    // Compute final weighted center
    vec3 wCenter = centroidWeight > 0.001
        ? centroidSum / centroidWeight
        : rayOrigin + rayDir * entryT;

    return VolumeResult(accColor, finalAlpha, entryT, wCenter, centroidWeight);
}

// High-quality volume integration with lighting
// OPTIMIZED: Uses forward differences gradient (3 samples) instead of central (6 samples)
VolumeResult volumeRaymarchHQ(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    vec3 transmittance = vec3(1.0); // Now vec3 for chromatic dispersion support
    float entryT = -1.0;  // Track first meaningful contribution

    // Centroid accumulation for stable temporal reprojection
    vec3 centroidSum = vec3(0.0);
    float centroidWeight = 0.0;

    int sampleCount = uSampleCount > 0 ? uSampleCount : 48; // Fallback to 48 if not set
    // Fast mode: halve sample count for better performance during rotation
    // This applies even with dispersion enabled (via gradient hack)
    if (uFastMode) sampleCount /= 2;
    sampleCount = clamp(sampleCount, 16, MAX_VOLUME_SAMPLES); // Allow down to 16 for performance

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    float animTime = getVolumeTime();
    vec3 viewDir = -rayDir;

#ifdef USE_DISPERSION
    // Dispersion offsets
    vec3 dispOffsetR = vec3(0.0);
    vec3 dispOffsetB = vec3(0.0);

    if (uDispersionEnabled && uDispersionStrength > 0.0) {
        float dispAmount = uDispersionStrength * 0.15; // Increased scale for visibility

        if (uDispersionDirection == 0) { // Radial (from center)
             // Updated inside loop
        } else { // View-aligned
             // Use alternative up vector when rayDir is nearly vertical to avoid NaN from zero cross product
             vec3 up = abs(rayDir.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
             vec3 right = normalize(cross(rayDir, up));
             dispOffsetR = right * dispAmount;
             dispOffsetB = -right * dispAmount;
        }
    }
#endif

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;
        // Exit if ALL channels are blocked
        if (transmittance.r < MIN_TRANSMITTANCE && transmittance.g < MIN_TRANSMITTANCE && transmittance.b < MIN_TRANSMITTANCE) break;

        vec3 pos = rayOrigin + rayDir * t;

#ifdef USE_DISPERSION
        // Radial dispersion update per sample
        if (uDispersionEnabled && uDispersionDirection == 0) {
             vec3 normalProxy = normalize(pos); // From center
             float dispAmount = uDispersionStrength * 0.15;
             dispOffsetR = normalProxy * dispAmount;
             dispOffsetB = -normalProxy * dispAmount;
        }
#endif

        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
        float sCenter = densityInfo.y; // Pre-computed log-density
        float phase = densityInfo.z;

        // OPTIMIZATION: Compute gradient ONCE for reuse by both dispersion and lighting
        // This eliminates the duplicate gradient computation that was wasting 3 density samples
        vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);

        // Chromatic Dispersion Logic
        vec3 rhoRGB = vec3(rho); // Default: all channels same

#ifdef USE_DISPERSION
        if (uDispersionEnabled && uDispersionStrength > 0.0) {
             // Force gradient hack when in fast mode (during rotation)
             // Full sampling (3x density evaluations) is too expensive for interactive use
             bool useFullSampling = (uDispersionQuality == 1) && !uFastMode;
             if (useFullSampling) { // High Quality: Full Sampling
                 vec3 dInfoR = sampleDensityWithPhase(pos + dispOffsetR, animTime);
                 vec3 dInfoB = sampleDensityWithPhase(pos + dispOffsetB, animTime);
                 rhoRGB.r = dInfoR.x;
                 rhoRGB.b = dInfoB.x;
             } else {
                 // Gradient Hack: reuse cached gradient (zero additional cost)
                 float s_r = sCenter + dot(gradient, dispOffsetR);
                 float s_b = sCenter + dot(gradient, dispOffsetB);

                 rhoRGB.r = exp(s_r);
                 rhoRGB.b = exp(s_b);
             }
        }
#endif

        // Nodal Surface Opacity Boost
        // We calculate a separate density for alpha/opacity to make nodes visible (opaque)
        // while keeping the original density for emission color logic (so it knows it's a node)
        vec3 rhoAlpha = rhoRGB;

#ifdef USE_NODAL
        if (uNodalEnabled) {
            // Use raw log-density for robust detection of nodal shells
            // Range: -12 (approx 6e-6) to -5 (approx 0.006)
            // This captures the transition zone around nodes without hitting background noise
            if (sCenter < -5.0 && sCenter > -12.0) {
                // Boost factor: stronger when density is lower (closer to node core)
                // 1.0 at s=-12, 0.0 at s=-5
                float intensity = 1.0 - smoothstep(-12.0, -5.0, sCenter);
                float boost = 5.0 * uNodalStrength * intensity;
                rhoAlpha += vec3(boost);
            }
        }
#endif

        // Alpha per channel (using boosted density)
        vec3 alpha;
        alpha.r = computeAlpha(rhoAlpha.r, stepLen, uDensityGain);
        alpha.g = computeAlpha(rhoAlpha.g, stepLen, uDensityGain);
        alpha.b = computeAlpha(rhoAlpha.b, stepLen, uDensityGain);

        if (alpha.g > 0.001 || alpha.r > 0.001 || alpha.b > 0.001) {
            // Track entry point (use Green/Center channel)
            if (entryT < 0.0 && alpha.g > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // CENTROID ACCUMULATION
            // Use average alpha/transmittance for weighting
            float avgAlpha = (alpha.r + alpha.g + alpha.b) / 3.0;
            float avgTrans = (transmittance.r + transmittance.g + transmittance.b) / 3.0;
            float weight = avgAlpha * avgTrans;
            centroidSum += pos * weight;
            centroidWeight += weight;

            // Compute emission using ORIGINAL density (rhoRGB) so coloring logic works
            // Use Green channel as representative for center
            // Note: gradient was computed earlier and is reused here (no redundant computation)
            vec3 emissionCenter = computeEmissionLit(rhoRGB.g, phase, pos, gradient, viewDir);

            // Modulate emission for R/B channels based on their density relative to G
            vec3 emission;
            emission.g = emissionCenter.g;
            emission.r = emissionCenter.r * (rhoRGB.r / max(rhoRGB.g, 0.0001));
            emission.b = emissionCenter.b * (rhoRGB.b / max(rhoRGB.g, 0.0001));

            accColor += transmittance * alpha * emission;
            transmittance *= (vec3(1.0) - alpha);
        }

        t += stepLen;
    }

    // Fallback: if no entry found, use midpoint for depth
    if (entryT < 0.0) {
        entryT = (tNear + tFar) * 0.5;
    }

    // Compute final weighted center
    vec3 wCenter = centroidWeight > 0.001
        ? centroidSum / centroidWeight
        : rayOrigin + rayDir * entryT;

    // Final alpha (average or max?)
    // For depth writing and composition, average remaining transmittance?
    float finalAlpha = 1.0 - (transmittance.r + transmittance.g + transmittance.b) / 3.0;

    return VolumeResult(accColor, finalAlpha, entryT, wCenter, centroidWeight);
}
`
