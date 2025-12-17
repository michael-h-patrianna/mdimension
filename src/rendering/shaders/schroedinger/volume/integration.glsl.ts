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
// Returns: VolumeResult with color, alpha, entry distance, and density-weighted centroid
VolumeResult volumeRaymarch(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    vec3 accColor = vec3(0.0);
    float transmittance = 1.0;
    float entryT = -1.0;  // Track first meaningful contribution

    // Centroid accumulation for stable temporal reprojection
    // Uses alpha * transmittance weighting - gives more weight to visible contributions
    vec3 centroidSum = vec3(0.0);
    float centroidWeight = 0.0;

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
            // Track entry point (still useful for some purposes)
            if (entryT < 0.0 && alpha > ENTRY_ALPHA_THRESHOLD) {
                entryT = t;
            }

            // CENTROID ACCUMULATION:
            // Weight each position by its contribution to the final pixel color.
            // alpha * transmittance represents how much this sample contributes.
            // This gives a stable "center of mass" position that doesn't jump
            // when viewing angle changes (unlike entry point which is view-dependent).
            float weight = alpha * transmittance;
            centroidSum += pos * weight;
            centroidWeight += weight;

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

    // Compute final weighted center (or fallback to entry point position)
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

    int sampleCount = uSampleQuality;
    sampleCount = clamp(sampleCount, 32, MAX_VOLUME_SAMPLES);

    float stepLen = (tFar - tNear) / float(sampleCount);
    float t = tNear;

    float animTime = getVolumeTime();
    vec3 viewDir = -rayDir;

    // Dispersion offsets
    vec3 dispOffsetR = vec3(0.0);
    vec3 dispOffsetB = vec3(0.0);
    
    if (uDispersionEnabled && uDispersionStrength > 0.0) {
        float dispAmount = uDispersionStrength * 0.05; // Scaling factor
        
        if (uDispersionDirection == 0) { // Radial (from center)
             // We can't know "center" easily here without sampling position first.
             // Updated inside loop.
        } else { // View-aligned (tangent to view? or along view?)
             // "View-aligned" usually means screen space offset.
             // Here we are in world space.
             // Simple: offset along camera Up/Right? 
             // Or just simple constant world vector?
             // Let's use camera up/right proxy or just arbitrary orthogonal vectors.
             // Cross(rayDir, Up).
             vec3 right = normalize(cross(rayDir, vec3(0.0, 1.0, 0.0)));
             dispOffsetR = right * dispAmount;
             dispOffsetB = -right * dispAmount;
        }
    }

    for (int i = 0; i < MAX_VOLUME_SAMPLES; i++) {
        if (i >= sampleCount) break;
        // Exit if ALL channels are blocked
        if (transmittance.r < MIN_TRANSMITTANCE && transmittance.g < MIN_TRANSMITTANCE && transmittance.b < MIN_TRANSMITTANCE) break;

        vec3 pos = rayOrigin + rayDir * t;

        // Radial dispersion update per sample
        if (uDispersionEnabled && uDispersionDirection == 0) {
             vec3 normalProxy = normalize(pos); // From center
             float dispAmount = uDispersionStrength * 0.05;
             dispOffsetR = normalProxy * dispAmount;
             dispOffsetB = -normalProxy * dispAmount;
        }

        vec3 densityInfo = sampleDensityWithPhase(pos, animTime);
        float rho = densityInfo.x;
        float sCenter = densityInfo.y; // Pre-computed log-density
        float phase = densityInfo.z;
        
        // Chromatic Dispersion Logic
        vec3 rhoRGB = vec3(rho); // Default: all channels same
        
        if (uDispersionEnabled && uDispersionStrength > 0.0) {
             if (uDispersionQuality == 1) { // High Quality: Full Sampling
                 vec3 dInfoR = sampleDensityWithPhase(pos + dispOffsetR, animTime);
                 vec3 dInfoB = sampleDensityWithPhase(pos + dispOffsetB, animTime);
                 rhoRGB.r = dInfoR.x;
                 rhoRGB.b = dInfoB.x;
             } else { 
                 // Fast Mode: Gradient Hack
                 // Needs gradient. Calculate it first.
                 // We compute gradient anyway for lighting below.
                 // Move gradient calc up?
                 // Gradient calc uses sCenter.
                 
                 vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);
                 
                 // Extrapolate log-density (s) then convert to rho
                 // s_new = s + dot(grad, offset)
                 float s_r = sCenter + dot(gradient, dispOffsetR);
                 float s_b = sCenter + dot(gradient, dispOffsetB);
                 
                 // rho = exp(s)
                 rhoRGB.r = exp(s_r);
                 rhoRGB.b = exp(s_b);
                 
                 // Reuse gradient for lighting later
             }
        }

        // Alpha per channel
        vec3 alpha;
        alpha.r = computeAlpha(rhoRGB.r, stepLen, uDensityGain);
        alpha.g = computeAlpha(rhoRGB.g, stepLen, uDensityGain);
        alpha.b = computeAlpha(rhoRGB.b, stepLen, uDensityGain);

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

            // OPTIMIZED: Use forward differences with pre-computed center value
            // Note: If Fast Dispersion used gradient, we calculated it already?
            // For code clarity, let's just call it again or assume compiler optimization.
            // Shader compiler will likely deduplicate if identical calls.
            vec3 gradient = computeDensityGradientFast(pos, animTime, 0.05, sCenter);
            
            // Emission needs to be per-channel if density varies?
            // computeEmissionLit takes rho.
            // Ideally we compute emission for R, G, B separately using their rho.
            // But computeEmissionLit is expensive (lighting loop).
            // Approximation: Compute for center rho, then modulate by density ratio?
            // Or: if dispersion is enabled, we assume color is white-ish anyway?
            // Let's compute lighting for center (Green) channel and apply to all, 
            // but modulate intensity by rhoRGB?
            // Better: Compute lighting once using center rho/gradient.
            // Apply to R, G, B scaled by their density?
            
            vec3 emissionCenter = computeEmissionLit(rhoRGB.g, phase, pos, gradient, viewDir);
            
            // If rho is different, emission intensity should be different.
            // Estimate emission ratio.
            // Emission ~ rho (roughly, plus lighting).
            vec3 emission;
            emission.g = emissionCenter.g;
            emission.r = emissionCenter.r * (rhoRGB.r / max(rhoRGB.g, 0.0001));
            emission.b = emissionCenter.b * (rhoRGB.b / max(rhoRGB.g, 0.0001));
            
            // This assumes light color is white. If light is colored, this might shift colors weirdly.
            // But acceptable for dispersion effect.

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
`;
