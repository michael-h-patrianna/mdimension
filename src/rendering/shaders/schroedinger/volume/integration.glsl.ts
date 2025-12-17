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
// Includes entry distance for temporal reprojection
struct VolumeResult {
    vec3 color;
    float alpha;
    float entryT;  // Distance to first meaningful contribution (-1 if none)
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
// Returns: VolumeResult with color, alpha, and entry distance
VolumeResult volumeRaymarch(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float transmittance = 1.0;
    float entryT = -1.0;  // Track first meaningful contribution

    // Calculate step count based on quality settings
    int sampleCount = uFastMode ? (uSampleQuality / 2) : uSampleQuality;
    sampleCount = clamp(sampleCount, 16, MAX_VOLUME_SAMPLES);

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    // Time for animation
    float animTime = getVolumeTime();
    vec3 viewDir = -rayDir;

    // Consecutive low-density samples (for early exit)
    int lowDensityCount = 0;

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;
        if (transmittance < MIN_TRANSMITTANCE) break;

        vec3 pos = rayOrigin + rayDir * t;

        // Sample density with phase info
        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
        float sCenter = densityInfo.y; // Pre-computed log-density
        float phase = densityInfo.z;

        // Early exit if density is consistently low
        if (rho < MIN_DENSITY) {
            lowDensityCount++;
            if (lowDensityCount > 5) break;
        } else {
            lowDensityCount = 0;
        }

        // Compute local alpha
        float alpha = computeAlpha(rho, stepLen, uDensityGain);

        // Skip negligible contributions
        if (alpha > 0.001) {
            // Track entry point for temporal reprojection
            if (entryT < 0.0 && alpha > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // Compute gradient for lighting (Fast version - 3 taps)
            vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);

            // Compute emission with lighting
            vec3 emission = computeEmissionLit(rho, phase, pos, gradient, viewDir);

            // Front-to-back compositing
            accColor += transmittance * alpha * emission;
            transmittance *= (1.0 - alpha);
        }

        t += stepLen;
    }

    // Final alpha is 1 - remaining transmittance
    float finalAlpha = 1.0 - transmittance;

    // Fallback: if no entry found, use midpoint for depth
    if (entryT < 0.0) {
        entryT = (tNear + tFar) * 0.5;
    }

    return VolumeResult(accColor, finalAlpha, entryT);
}

// High-quality volume integration with lighting
// OPTIMIZED: Uses forward differences gradient (3 samples) instead of central (6 samples)
VolumeResult volumeRaymarchHQ(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float transmittance = 1.0;
    float entryT = -1.0;  // Track first meaningful contribution

    int sampleCount = uSampleQuality;
    sampleCount = clamp(sampleCount, 32, MAX_VOLUME_SAMPLES);

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    float animTime = getVolumeTime();
    vec3 viewDir = -rayDir;

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;
        if (transmittance < MIN_TRANSMITTANCE) break;

        vec3 pos = rayOrigin + rayDir * t;

        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
        float sCenter = densityInfo.y; // Pre-computed log-density
        float phase = densityInfo.z;

        float alpha = computeAlpha(rho, stepLen, uDensityGain);

        if (alpha > 0.001) {
            // Track entry point for temporal reprojection
            if (entryT < 0.0 && alpha > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // OPTIMIZED: Use forward differences with pre-computed center value
            // Reduces gradient computation from 6 to 3 additional samples
            vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);
            vec3 emission = computeEmissionLit(rho, phase, pos, gradient, viewDir);

            accColor += transmittance * alpha * emission;
            transmittance *= (1.0 - alpha);
        }

        t += stepLen;
    }

    // Fallback: if no entry found, use midpoint for depth
    if (entryT < 0.0) {
        entryT = (tNear + tFar) * 0.5;
    }

    return VolumeResult(accColor, 1.0 - transmittance, entryT);
}
`;
