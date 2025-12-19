/**
 * Volumetric Ground Fog Fragment Shader
 *
 * Implements AAA-grade height-based volumetric fog with:
 * - Ray marching through the fog volume
 * - Height-based exponential density falloff
 * - 3D noise for turbulent fog patterns
 * - Henyey-Greenstein phase function for light scattering
 * - Shadow map sampling for volumetric shadows (god rays)
 * - Bilateral upsampling compatible output
 *
 * @see docs/plans/volumetric-ground-fog.md
 */

import {
  shadowMapsFunctionsBlock,
  shadowMapsUniformsBlock,
} from '../shared/features/shadowMaps.glsl'

export interface VolumetricFogShaderOptions {
  use3DNoise: boolean
}

/**
 * Creates the volumetric fog fragment shader.
 *
 * @param options - Shader configuration options
 * @param options.use3DNoise - Whether to use 3D noise texture (WebGL2) or 2D fallback
 * @returns GLSL ES 3.00 fragment shader source
 */
export function createVolumetricFogFragmentShader(options: VolumetricFogShaderOptions): string {
  const { use3DNoise } = options

  // Noise texture uniform - 3D for WebGL2, 2D for fallback
  const noiseUniform = use3DNoise ? 'uniform sampler3D tNoise;' : 'uniform sampler2D tNoise;'

  // Noise sampling function
  const noiseSampler = use3DNoise
    ? /* glsl */ `
// 3D noise sample (WebGL2 native)
float sampleNoise(vec3 p) {
    return texture(tNoise, p).r;
}
`
    : /* glsl */ `
// 2D noise fallback: approximate 3D by blending two offset planes
// Used when 3D textures are unavailable
float sampleNoise(vec3 p) {
    vec2 uvA = p.xz;
    vec2 uvB = p.xy + vec2(p.z * 0.5);
    float n1 = texture(tNoise, uvA).r;
    float n2 = texture(tNoise, uvB).r;
    return mix(n1, n2, 0.5);
}
`

  return /* glsl */ `
precision highp float;

// GLSL ES 3.00 output declaration
layout(location = 0) out vec4 fragColor;
in vec2 vUv;

#define MAX_LIGHTS 4
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_DIRECTIONAL 1
#define LIGHT_TYPE_SPOT 2

// Maximum scattering contribution per step (prevents bloom blowout)
#define MAX_SCATTERING 2.0
// Maximum accumulated color (HDR clamp before output)
#define MAX_ACCUMULATED_COLOR 4.0

// ============================================================================
// Uniforms
// ============================================================================

uniform sampler2D tDepth;
${noiseUniform}
uniform vec3 uCameraPosition;
uniform mat4 uInverseViewProj;
uniform float uTime;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;

// Fog Parameters
uniform float uFogHeight;
uniform float uFogFalloff;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uFogNoiseScale;
uniform vec3 uFogNoiseSpeed;
uniform float uFogScattering; // Anisotropy g (-1 to 1)
uniform bool uVolumetricShadows;
uniform bool uFogFastMode; // Performance mode: fewer steps, samples, shadows

// Light Data (Main Directional Light for scattering)
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uLightIntensity;

// Light arrays (required by shadow functions)
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform int uShadowLightIndex;

// Shadow Maps
${shadowMapsUniformsBlock}

// ============================================================================
// Functions
// ============================================================================

${shadowMapsFunctionsBlock}

${noiseSampler}

// NaN/Inf guards to prevent runaway values in post-processing
bool isInvalidFloat(float v) {
    return isnan(v) || isinf(v);
}

bool isInvalidVec3(vec3 v) {
    return isInvalidFloat(v.x) || isInvalidFloat(v.y) || isInvalidFloat(v.z);
}

// Stable hash (world-space) for dithering to avoid screen-space flicker
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Interleaved Gradient Noise (Bayer-like dithering)
// Used to offset ray start positions to reduce banding artifacts
float interleavedGradientNoise(vec2 uv) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(uv, magic.xy)));
}

// Henyey-Greenstein Phase Function
// Controls the anisotropy of scattering:
// g = -1: full backscattering
// g = 0: isotropic (uniform in all directions)
// g = +1: full forward scattering
float henyeyGreenstein(float g, float costh) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * costh;
    // Guard against division by zero when g=1 and costh=1
    denom = max(denom, 0.0001);
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(denom, 1.5));
}

// World Position Reconstruction from depth buffer
vec3 getWorldPosition(vec2 uv, float depth) {
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 worldPos = uInverseViewProj * clipPos;
    // Guard against w approaching zero
    float safeW = abs(worldPos.w) < 0.0001 ? 0.0001 : worldPos.w;
    return worldPos.xyz / safeW;
}

// Shadow Visibility for volumetric shadows (god rays)
float getShadowVisibility(vec3 worldPos) {
    if (!uVolumetricShadows) return 1.0;

    int idx = uShadowLightIndex;
    if (idx < 0 || idx >= MAX_LIGHTS) return 1.0;
    if (!uLightCastsShadow[idx]) return 1.0;

    // Directional/spot shadow sampling with PCF
    return sampleShadowPCF(idx, worldPos);
}

// Fog Density Function
//
// Gothic horror / Hound of Baskerville style fog:
// - Heavy, still, oppressive atmosphere
// - Barely perceptible creeping movement
// - Dense banks with thin veils between them
float getFogDensity(vec3 pos) {
    float heightLimit = max(uFogHeight, 0.001);

    // 1. Height-based exponential falloff - fog clings to the ground
    float heightDensity = exp(-max(0.0, pos.y) * uFogFalloff);

    // Soft height cap - smoothly fade out above fogHeight
    float heightMask = 1.0 - smoothstep(heightLimit * 0.5, heightLimit, pos.y);
    heightDensity *= heightMask;

    // 2. Static fog structure - the fog banks themselves barely move
    // Large scale: permanent dense/sparse regions (like fog banks on a moor)
    vec3 staticPos = pos * uFogNoiseScale;

    // 3. Extremely slow creeping motion - almost imperceptible
    // Time scale: 0.002 means 500 seconds for one noise cycle
    float creepTime = uTime * 0.002;
    vec3 creepOffset = vec3(creepTime, 0.0, creepTime * 0.7);

    float combinedNoise;
    if (uFogFastMode) {
        // Fast mode: 2 samples (banks + animated structure)
        float banks = sampleNoise(staticPos * 0.1);
        banks = smoothstep(0.25, 0.75, banks);
        float structure = sampleNoise(staticPos * 0.5 + creepOffset * 0.5);
        combinedNoise = banks * 0.6 + structure * 0.4;
    } else {
        // Normal mode: 3 samples (banks + structure + wisps)
        float banks = sampleNoise(staticPos * 0.1);
        banks = smoothstep(0.25, 0.75, banks);
        float structure = sampleNoise(staticPos * 0.5);
        float wisps = sampleNoise(staticPos * 1.5 + creepOffset);
        combinedNoise = banks * 0.5 + structure * 0.35 + wisps * 0.15;
    }

    // Range 0.15 to 1.0 - thin areas are veils, thick areas are impenetrable
    float noiseModulation = 0.15 + combinedNoise * 0.85;

    return uFogDensity * heightDensity * noiseModulation;
}

// ============================================================================
// Main
// ============================================================================

void main() {
    vec2 uv = vUv;
    vec2 pixelCoord = uv * uResolution;

    // Sample Scene Depth
    float depth = texture(tDepth, uv).r;
    if (isInvalidFloat(depth)) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    depth = clamp(depth, 0.0, 1.0);

    // Reconstruct World Position
    vec3 worldPos = getWorldPosition(uv, depth);
    if (isInvalidVec3(worldPos)) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }
    vec3 camPos = uCameraPosition;

    // Ray Setup
    vec3 rayDir = normalize(worldPos - camPos);
    float rayLength = length(worldPos - camPos);
    if (isInvalidVec3(rayDir) || isInvalidFloat(rayLength) || rayLength <= 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // Limit ray length to camera far plane
    rayLength = min(rayLength, uCameraFar);
    // Limit ray length to effective fog visibility distance (200.0)
    // At density 0.02, 200 units gives >98% opacity. Marching further wastes steps and causes aliasing.
    rayLength = min(rayLength, 200.0);

    // Optimization: Ray-Plane Intersection to limit marching to fog volume
    float heightLimit = max(uFogHeight, 0.001);
    float tMin = 0.0;
    float tMax = rayLength;

    if (abs(rayDir.y) > 0.0001) {
        float tCeil = (heightLimit - camPos.y) / rayDir.y;

        if (rayDir.y > 0.0) {
            // Looking up
            if (camPos.y < heightLimit) {
                // Inside fog, looking up -> cap at ceiling
                tMax = min(tMax, tCeil);
            } else {
                // Above fog, looking up -> no fog
                fragColor = vec4(0.0, 0.0, 0.0, 0.0);
                return;
            }
        } else {
            // Looking down
            if (camPos.y > heightLimit) {
                // Above fog, looking down -> start at ceiling
                tMin = max(tMin, tCeil);
            }
            // If inside fog looking down, no change (hits floor/scene)
        }
    }

    // If ray interval is invalid/empty
    if (tMin >= tMax) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // Update ray parameters for the active segment
    vec3 startPos = camPos + rayDir * tMin;
    rayLength = tMax - tMin;

    // Dither ray start to reduce banding (Screen-space hash to avoid world-space flicker)
    // We use Interleaved Gradient Noise which is stable in screen space
    float dither = interleavedGradientNoise(gl_FragCoord.xy);

    // Raymarch settings - use MAX_STEPS with early exit based on quality
    const int MAX_STEPS = 32;
    int activeSteps = uFogFastMode ? 16 : 32;
    float stepSize = rayLength / float(activeSteps);
    if (isInvalidFloat(stepSize) || stepSize <= 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // Start position with dither offset
    vec3 currentPos = startPos + rayDir * stepSize * dither;

    vec3 accumulatedColor = vec3(0.0);
    float transmittance = 1.0;

    // Phase function for directional light scattering
    float costh = dot(rayDir, uLightDirection);
    float phase = henyeyGreenstein(uFogScattering, costh);
    if (isInvalidFloat(phase)) {
        phase = 0.0;
    }

    // Raymarch: integrate scattering using Beer-Lambert extinction
    float lastShadow = 1.0; // Cache shadow for reduced sampling
    int shadowFreq = uFogFastMode ? 4 : 2; // Sample shadows every Nth step
    for (int i = 0; i < MAX_STEPS; i++) {
        // Dynamic step count based on quality mode
        if (i >= activeSteps) break;

        // Early termination when fog is nearly opaque (0.05 threshold)
        if (transmittance < 0.05) break;

        float density = getFogDensity(currentPos);
        if (isInvalidFloat(density)) {
            density = 0.0;
        }

        if (density > 0.001) {
            // Shadow sampling at configurable frequency for performance
            float shadow;
            if ((i % shadowFreq) == 0) {
                shadow = getShadowVisibility(currentPos);
                lastShadow = shadow;
            } else {
                shadow = lastShadow;
            }

            // In-scattering from directional light
            vec3 lightScatter = phase * uLightColor * uLightIntensity * shadow;

            // Fog's own color contribution (ambient self-illumination of the fog)
            // Shadow also darkens ambient fog to create visible god rays
            vec3 fogAmbient = uFogColor * mix(0.3, 1.0, shadow);

            // Combined: fog ambient (60%) + light scattering (40%)
            // Both are now affected by shadows for more pronounced volumetric effect
            vec3 scattering = vec3(density) * (fogAmbient * 0.6 + lightScatter * 0.4);
            scattering = min(scattering, vec3(MAX_SCATTERING));

            // Beer-Lambert Integration
            float opticalDepth = density * stepSize;
            float stepTransmittance = exp(-opticalDepth);

            // Accumulate light contribution for this step
            vec3 stepLight = scattering * (1.0 - stepTransmittance);

            accumulatedColor += stepLight * transmittance;
            transmittance *= stepTransmittance;
        }

        currentPos += rayDir * stepSize;
    }

    // Small ambient boost for visibility in completely unlit areas
    vec3 ambient = uFogColor * 0.05;

    // Final fog color with ambient contribution
    vec3 finalFog = accumulatedColor + ambient * (1.0 - transmittance);

    // HDR clamp to prevent bloom blowout while preserving range for tonemapping
    finalFog = min(finalFog, vec3(MAX_ACCUMULATED_COLOR));
    if (isInvalidVec3(finalFog)) {
        finalFog = vec3(0.0);
    }
    if (isInvalidFloat(transmittance)) {
        transmittance = 1.0;
    }
    transmittance = clamp(transmittance, 0.0, 1.0);

    // Output: RGB = fog scattering color, A = opacity (1 - transmittance)
    fragColor = vec4(finalFog, 1.0 - transmittance);
}
`
}
