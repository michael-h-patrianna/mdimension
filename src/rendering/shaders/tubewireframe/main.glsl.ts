export const mainBlock = `
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
    vec3 F = fresnelSchlickVec3(max(dot(H, V), 0.0), F0);

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

  // Explicitly write depth to ensure it's captured in depth-only passes
  gl_FragDepth = gl_FragCoord.z;

  // Output to MRT (Multiple Render Targets)
  // gColor: Color buffer (RGBA)
  // gNormal: Normal buffer (RGB = normal * 0.5 + 0.5, A = reflectivity/metallic)
  gColor = vec4(color, uOpacity);
  gNormal = vec4(N * 0.5 + 0.5, uMetallic);
}
`;
