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

// Compute time value for animation
float getVolumeTime() {
    return uTime * uTimeScale;
}

// Compute gradient of log-density for pseudo-normals
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

// Main volume raymarching function
// Returns: vec4(rgb, alpha)
vec4 volumeRaymarch(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float transmittance = 1.0;

    // Calculate step count based on quality settings
    int sampleCount = uFastMode ? (uSampleQuality / 2) : uSampleQuality;
    sampleCount = clamp(sampleCount, 16, MAX_VOLUME_SAMPLES);

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    // Time for animation
    float animTime = getVolumeTime();

    // Consecutive low-density samples (for early exit)
    int lowDensityCount = 0;

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;
        if (transmittance < MIN_TRANSMITTANCE) break;

        vec3 pos = rayOrigin + rayDir * t;

        // Sample density with phase info
        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
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
            // Compute emission color
            vec3 emission = computeEmission(rho, phase, pos);

            // Front-to-back compositing
            accColor += transmittance * alpha * emission;
            transmittance *= (1.0 - alpha);
        }

        t += stepLen;
    }

    // Final alpha is 1 - remaining transmittance
    float finalAlpha = 1.0 - transmittance;

    return vec4(accColor, finalAlpha);
}

// High-quality volume integration with lighting
vec4 volumeRaymarchHQ(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float transmittance = 1.0;

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
        float phase = densityInfo.z;

        float alpha = computeAlpha(rho, stepLen, uDensityGain);

        if (alpha > 0.001) {
            // Compute gradient for lighting (larger delta for smoother volumetric data)
            vec3 gradient = computeDensityGradient(pos, animTime, 0.05);
            vec3 emission = computeEmissionLit(rho, phase, pos, gradient, viewDir);

            accColor += transmittance * alpha * emission;
            transmittance *= (1.0 - alpha);
        }

        t += stepLen;
    }

    return vec4(accColor, 1.0 - transmittance);
}
`;
