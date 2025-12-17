/**
 * Emission color computation for volumetric rendering
 *
 * Computes the emission color at each point based on:
 * - User's color palette (uColor as base)
 * - Density (brightness/saturation)
 * - Wavefunction phase (subtle hue modulation)
 *
 * Three color modes:
 * 0 = Density only (user color with density-based brightness)
 * 1 = Phase tint (user color with phase-based hue shift)
 * 2 = Mixed (user color + phase shift + density brightness)
 */
export const emissionBlock = `
// ============================================
// Volume Emission Color
// ============================================

// Color mode constants
#define COLOR_MODE_DENSITY 0
#define COLOR_MODE_PHASE 1
#define COLOR_MODE_MIXED 2

// Phase influence on hue (0.0 = no phase color, 1.0 = full rainbow)
#define PHASE_HUE_INFLUENCE 0.4

// Compute base surface color (no lighting applied)
vec3 computeBaseColor(float rho, float phase, vec3 pos) {
    // Normalize log-density to [0, 1] range for color mapping
    float s = sFromRho(rho);
    float normalized = clamp((s + 8.0) / 8.0, 0.0, 1.0);

    // Get base color from user's palette
    vec3 baseHSL = rgb2hsl(uColor);

    if (uColorMode == COLOR_MODE_DENSITY) {
        return getColorByAlgorithm(normalized, vec3(0.0, 1.0, 0.0), baseHSL, pos);
    }
    else if (uColorMode == COLOR_MODE_PHASE) {
        float phaseNorm = (phase + PI) / TAU;
        float hueShift = (phaseNorm - 0.5) * PHASE_HUE_INFLUENCE;
        float hue = fract(baseHSL.x + hueShift);
        return hsl2rgb(vec3(hue, 0.75, 0.35));
    }
    else {
        float phaseNorm = (phase + PI) / TAU;
        float hueShift = (phaseNorm - 0.5) * PHASE_HUE_INFLUENCE;
        float hue = fract(baseHSL.x + hueShift);
        float lightness = 0.15 + 0.35 * normalized;
        float saturation = 0.7 + 0.25 * normalized;
        return hsl2rgb(vec3(hue, saturation, lightness));
    }
}

// Compute emission with ambient lighting only (for fast mode)
// Same pattern as Mandelbulb: col = surfaceColor * uAmbientColor * uAmbientIntensity
vec3 computeEmission(float rho, float phase, vec3 pos) {
    vec3 baseColor = computeBaseColor(rho, phase, pos);
    return baseColor * uAmbientColor * uAmbientIntensity;
}

// Compute emission with full scene lighting (for HQ mode)
// Same pattern as Mandelbulb main.glsl.ts lines 53-103
vec3 computeEmissionLit(float rho, float phase, vec3 p, vec3 gradient, vec3 viewDir) {
    vec3 surfaceColor = computeBaseColor(rho, phase, p);

    // Start with ambient (same as Mandelbulb line 53)
    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;

    // Normalize gradient as pseudo-normal
    float gradLen = length(gradient);
    if (gradLen < 0.0001) return col;

    vec3 n = gradient / gradLen;

    // Loop through lights - exact same pattern as Mandelbulb lines 57-103
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        vec3 l = getLightDirection(i, p);
        float attenuation = uLightIntensities[i];

        int lightType = uLightTypes[i];
        if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
            float distance = length(uLightPositions[i] - p);
            attenuation *= getDistanceAttenuation(i, distance);
        }

        if (lightType == LIGHT_TYPE_SPOT) {
            vec3 lightToFrag = normalize(p - uLightPositions[i]);
            attenuation *= getSpotAttenuation(i, lightToFrag);
        }

        if (attenuation < 0.001) continue;

        // Diffuse
        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation;

        // Specular
        vec3 halfDir = normalize(l + viewDir);
        float NdotH = max(dot(n, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation;
        col += uSpecularColor * uLightColors[i] * spec;
    }

    return col;
}
`;
