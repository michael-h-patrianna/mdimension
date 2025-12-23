/**
 * IBL (Image-Based Lighting) Shader Module
 *
 * Provides environment map sampling for specular and diffuse IBL.
 * Supports two quality levels:
 * - Low: Single sample at roughness-based LOD
 * - High: Multiple samples with better roughness approximation
 *
 * Uses the skybox cubemap as the environment source.
 */

export const iblUniformsBlock = `
// IBL Uniforms
uniform samplerCube uEnvMap;
uniform float uIBLIntensity;
uniform int uIBLQuality; // 0 = off, 1 = low, 2 = high
`;

export const iblBlock = `
// ============================================
// Image-Based Lighting (IBL)
// ============================================

// Approximate environment LOD from roughness
// PMREM typically has 5-6 mip levels
float getEnvMapLOD(float roughness) {
    return roughness * 5.0;
}

// Fresnel-Schlick with roughness compensation for IBL
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Sample environment for specular IBL (low quality - single sample)
vec3 sampleEnvMapSpecularLow(vec3 R, float roughness) {
    float lod = getEnvMapLOD(roughness);
    return textureLod(uEnvMap, R, lod).rgb;
}

// Sample environment for specular IBL (high quality - importance sampled approximation)
vec3 sampleEnvMapSpecularHigh(vec3 R, float roughness, vec3 N, vec3 V) {
    // For high quality, we sample at multiple roughness levels and blend
    float lod = getEnvMapLOD(roughness);

    // Main reflection sample
    vec3 specular = textureLod(uEnvMap, R, lod).rgb;

    // Add slightly offset samples for rougher surfaces (approximates importance sampling)
    if (roughness > 0.3) {
        // Create tangent frame for offset sampling
        vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent = normalize(cross(up, N));
        vec3 bitangent = cross(N, tangent);

        float offset = roughness * 0.15;
        vec3 R1 = normalize(R + tangent * offset);
        vec3 R2 = normalize(R - tangent * offset);
        vec3 R3 = normalize(R + bitangent * offset);
        vec3 R4 = normalize(R - bitangent * offset);

        specular += textureLod(uEnvMap, R1, lod).rgb;
        specular += textureLod(uEnvMap, R2, lod).rgb;
        specular += textureLod(uEnvMap, R3, lod).rgb;
        specular += textureLod(uEnvMap, R4, lod).rgb;
        specular *= 0.2; // Average of 5 samples
    }

    return specular;
}

// Compute IBL contribution
// Returns vec3 color to add to final output
vec3 computeIBL(vec3 N, vec3 V, vec3 F0, float roughness, float metallic, vec3 albedo) {
    if (uIBLQuality == 0) return vec3(0.0);

    vec3 R = reflect(-V, N);
    float NdotV = max(dot(N, V), 0.0);

    // Fresnel with roughness compensation
    vec3 F = fresnelSchlickRoughness(NdotV, F0, roughness);

    // Specular IBL - quality-dependent sampling
    vec3 specularIBL;
    if (uIBLQuality == 1) {
        specularIBL = sampleEnvMapSpecularLow(R, roughness);
    } else {
        specularIBL = sampleEnvMapSpecularHigh(R, roughness, N, V);
    }
    specularIBL *= F;

    // Diffuse IBL - sample at max roughness (fully diffuse)
    // Energy conservation: diffuse is reduced by specular reflectance
    vec3 kD = (1.0 - F) * (1.0 - metallic);
    vec3 diffuseIBL = textureLod(uEnvMap, N, 5.0).rgb * kD * albedo;

    return (specularIBL + diffuseIBL) * uIBLIntensity;
}
`;
