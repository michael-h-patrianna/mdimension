// ============================================
// TubeWireframe Fragment Shader
// PBR lighting with multi-light support
// ============================================

precision highp float;

// MRT output declarations for WebGL2
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

#define PI 3.14159265359
#define MAX_LIGHTS 4
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_DIRECTIONAL 1
#define LIGHT_TYPE_SPOT 2

// Material uniforms
uniform vec3 uColor;
uniform float uOpacity;
uniform float uMetallic;
uniform float uRoughness;

// Multi-Light System uniforms
uniform int uNumLights;
uniform bool uLightsEnabled[MAX_LIGHTS];
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uSpotAngles[MAX_LIGHTS];
uniform float uSpotPenumbras[MAX_LIGHTS];
uniform float uSpotCosInner[MAX_LIGHTS];
uniform float uSpotCosOuter[MAX_LIGHTS];
uniform float uLightRanges[MAX_LIGHTS];
uniform float uLightDecays[MAX_LIGHTS];

// Global lighting uniforms
uniform float uAmbientIntensity;
uniform vec3 uAmbientColor;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;

// Fresnel rim lighting uniforms
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Inputs from vertex shader
in vec3 vNormal;
in vec3 vWorldPosition;
in vec3 vViewDirection;

// ============================================
// PBR Helper Functions
// ============================================

// Normal Distribution Function (GGX/Trowbridge-Reitz)
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;

  float num = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  return num / max(denom, 0.0001);
}

// Geometry function (Schlick-GGX)
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;

  float num = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return num / max(denom, 0.0001);
}

// Smith's method for geometry
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx1 = geometrySchlickGGX(NdotV, roughness);
  float ggx2 = geometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

// Fresnel-Schlick approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// ============================================
// Light Helper Functions
// ============================================

vec3 getLightDirection(int lightIndex, vec3 fragPos) {
  int lightType = uLightTypes[lightIndex];

  if (lightType == LIGHT_TYPE_POINT) {
    return normalize(uLightPositions[lightIndex] - fragPos);
  } else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
    return normalize(uLightDirections[lightIndex]);
  } else if (lightType == LIGHT_TYPE_SPOT) {
    return normalize(uLightPositions[lightIndex] - fragPos);
  }

  return vec3(0.0, 1.0, 0.0);
}

float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
  float cosAngle = dot(lightToFrag, normalize(uLightDirections[lightIndex]));
  // Use precomputed cosines to avoid per-fragment trig
  return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
}

/**
 * Calculate distance attenuation for point and spot lights.
 * range = 0: infinite range (no falloff)
 * range > 0: light reaches zero intensity at this distance
 * decay = 0: no decay, 1: linear, 2: physically correct inverse square
 */
float getDistanceAttenuation(int lightIndex, float distance) {
  float range = uLightRanges[lightIndex];
  float decay = uLightDecays[lightIndex];

  // No distance falloff when range is 0 (infinite range)
  if (range <= 0.0) {
    return 1.0;
  }

  // Clamp distance to prevent division by zero
  float d = max(distance, 0.0001);

  // Three.js attenuation formula
  float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);
  return pow(rangeAttenuation, decay);
}

// ============================================
// Main
// ============================================

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDirection);

  // Clamp roughness to prevent numerical issues (roughness=0 causes NDF=0)
  float roughness = max(uRoughness, 0.04);

  // Base reflectivity - dielectrics have F0 of 0.04, metals use albedo
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, uColor, uMetallic);

  // Start with ambient light
  vec3 Lo = uColor * uAmbientColor * uAmbientIntensity;

  // Accumulator for total light contribution (for fresnel rim)
  float totalNdotL = 0.0;

  // Loop over all active lights
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uNumLights) break;
    if (!uLightsEnabled[i]) continue;

    // Get light direction
    vec3 L = getLightDirection(i, vWorldPosition);
    vec3 H = normalize(V + L);

    float attenuation = uLightIntensities[i];

    // Apply distance attenuation for point and spot lights
    int lightType = uLightTypes[i];
    if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
      float distance = length(uLightPositions[i] - vWorldPosition);
      attenuation *= getDistanceAttenuation(i, distance);
    }

    // Apply spot light cone attenuation
    if (lightType == LIGHT_TYPE_SPOT) {
      vec3 lightToFrag = normalize(vWorldPosition - uLightPositions[i]);
      attenuation *= getSpotAttenuation(i, lightToFrag);
    }

    // Skip negligible contributions
    if (attenuation < 0.001) continue;

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, uRoughness);
    float G = geometrySmith(N, V, L, uRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    // Specular term
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    // Energy conservation: what's not reflected is refracted (diffuse)
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    // Metals have no diffuse reflection
    kD *= 1.0 - uMetallic;

    float NdotL = max(dot(N, L), 0.0);

    // Add light contribution
    vec3 radiance = uLightColors[i] * attenuation;
    Lo += (kD * uColor / PI + specular * uSpecularIntensity) * radiance * NdotL * uDiffuseIntensity;

    // Track total light for fresnel calculation
    totalNdotL = max(totalNdotL, NdotL * attenuation);
  }

  // Fresnel rim lighting
  if (uFresnelEnabled && uFresnelIntensity > 0.0) {
    float NdotV = max(dot(N, V), 0.0);
    float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
    rim *= (0.3 + 0.7 * totalNdotL);
    Lo += uRimColor * rim;
  }

  // Final color (tone mapping is applied by post-processing OutputPass)
  vec3 color = Lo;

  // Output to MRT (Multiple Render Targets)
  // gColor: Color buffer (RGBA)
  // gNormal: Normal buffer (RGB = normal * 0.5 + 0.5, A = reflectivity/metallic)
  gColor = vec4(color, uOpacity);
  gNormal = vec4(N * 0.5 + 0.5, uMetallic);
}
