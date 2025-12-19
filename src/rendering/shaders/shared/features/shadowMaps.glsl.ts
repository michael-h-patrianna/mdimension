/**
 * Shadow Map Sampling Module
 *
 * Provides shadow map sampling for mesh-based objects (Polytope, TubeWireframe).
 * Supports all three light types:
 * - Directional lights: 2D shadow maps with orthographic projection
 * - Spot lights: 2D shadow maps with perspective projection
 * - Point lights: Cube shadow maps for omnidirectional shadows
 *
 * Uses PCF (Percentage Closer Filtering) for soft shadow edges.
 *
 * @see https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping
 */

/**
 * Shadow map uniform declarations.
 * Unrolled due to GLSL ES 3.0 limitation: sampler arrays cannot be indexed with runtime variables.
 */
export const shadowMapsUniformsBlock = `
// ============================================
// Shadow Map Uniforms
// ============================================

// 2D Shadow Maps (Directional and Spot lights)
uniform sampler2D uShadowMap0;
uniform sampler2D uShadowMap1;
uniform sampler2D uShadowMap2;
uniform sampler2D uShadowMap3;

// Shadow Matrices (world to light clip space)
uniform mat4 uShadowMatrix0;
uniform mat4 uShadowMatrix1;
uniform mat4 uShadowMatrix2;
uniform mat4 uShadowMatrix3;

// Cube Shadow Maps (Point lights) - DISABLED: causes WebGL bindTexture errors
// TODO: Fix cube texture placeholder creation for point light shadows
// uniform samplerCube uShadowCubeMap0;
// uniform samplerCube uShadowCubeMap1;
// uniform samplerCube uShadowCubeMap2;
// uniform samplerCube uShadowCubeMap3;

// Per-light shadow enable flags
uniform bool uLightCastsShadow[MAX_LIGHTS];

// Shadow settings
uniform float uShadowMapBias;
uniform float uShadowMapSize;
uniform int uShadowPCFSamples; // 0=hard, 1=3x3 PCF, 2=5x5 PCF
uniform float uShadowCameraNear;
uniform float uShadowCameraFar;
`;

/**
 * Shadow map sampling functions.
 * Includes PCF filtering for soft shadows and cube map sampling for point lights.
 */
export const shadowMapsFunctionsBlock = `
// ============================================
// Shadow Map Functions
// ============================================

// Sample 2D shadow map by index (unrolled for GLSL ES 3.0)
float sampleShadowMapDepth(int index, vec2 uv) {
  // Guard against out-of-bounds index
  if (index < 0 || index >= MAX_LIGHTS) return 1.0;
  if (index == 0) return texture(uShadowMap0, uv).r;
  if (index == 1) return texture(uShadowMap1, uv).r;
  if (index == 2) return texture(uShadowMap2, uv).r;
  if (index == 3) return texture(uShadowMap3, uv).r;
  return 1.0;
}

// Get shadow matrix by index (unrolled for GLSL ES 3.0)
mat4 getShadowMatrix(int index) {
  // Guard against out-of-bounds index
  if (index < 0 || index >= MAX_LIGHTS) return mat4(1.0);
  if (index == 0) return uShadowMatrix0;
  if (index == 1) return uShadowMatrix1;
  if (index == 2) return uShadowMatrix2;
  if (index == 3) return uShadowMatrix3;
  return mat4(1.0);
}

// Sample cube shadow map by index - DISABLED: causes WebGL bindTexture errors
// TODO: Fix cube texture placeholder creation for point light shadows
// float sampleCubeShadowDepth(int index, vec3 dir) {
//   if (index < 0 || index >= MAX_LIGHTS) return 1.0;
//   if (index == 0) return texture(uShadowCubeMap0, dir).r;
//   if (index == 1) return texture(uShadowCubeMap1, dir).r;
//   if (index == 2) return texture(uShadowCubeMap2, dir).r;
//   if (index == 3) return texture(uShadowCubeMap3, dir).r;
//   return 1.0;
// }

// PCF shadow sampling for directional and spot lights
float sampleShadowPCF(int lightIndex, vec3 worldPos) {
  mat4 shadowMatrix = getShadowMatrix(lightIndex);
  vec4 shadowCoord = shadowMatrix * vec4(worldPos, 1.0);

  // Perspective divide (guard against w=0)
  float w = max(abs(shadowCoord.w), 0.0001);
  vec3 projCoord = shadowCoord.xyz / w;

  // Transform from NDC [-1,1] to texture space [0,1]
  projCoord = projCoord * 0.5 + 0.5;

  // Check if outside shadow frustum (including near plane z < 0)
  if (projCoord.x < 0.0 || projCoord.x > 1.0 ||
      projCoord.y < 0.0 || projCoord.y > 1.0 ||
      projCoord.z < 0.0 || projCoord.z > 1.0) {
    return 1.0; // Outside shadow frustum = fully lit
  }

  float currentDepth = projCoord.z;
  float texelSize = 1.0 / max(uShadowMapSize, 1.0);
  float shadow = 0.0;

  // PCF kernel based on quality setting
  // Standard shadow map convention: fragment in shadow if currentDepth > closestDepth + bias
  if (uShadowPCFSamples == 0) {
    // Hard shadows (single sample)
    float closestDepth = sampleShadowMapDepth(lightIndex, projCoord.xy);
    shadow = currentDepth > closestDepth + uShadowMapBias ? 0.0 : 1.0;
  } else if (uShadowPCFSamples == 1) {
    // 3x3 PCF (9 samples)
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize;
        float depth = sampleShadowMapDepth(lightIndex, projCoord.xy + offset);
        shadow += currentDepth > depth + uShadowMapBias ? 0.0 : 1.0;
      }
    }
    shadow /= 9.0;
  } else {
    // 5x5 PCF (25 samples)
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize;
        float depth = sampleShadowMapDepth(lightIndex, projCoord.xy + offset);
        shadow += currentDepth > depth + uShadowMapBias ? 0.0 : 1.0;
      }
    }
    shadow /= 25.0;
  }

  return shadow;
}

// Cube shadow sampling for point lights - DISABLED: causes WebGL bindTexture errors
// TODO: Fix cube texture placeholder creation for point light shadows
// float sampleCubeShadow(int lightIndex, vec3 worldPos) {
//   vec3 lightToFrag = worldPos - uLightPositions[lightIndex];
//   float currentDist = length(lightToFrag);
//   vec3 dir = normalize(lightToFrag);
//   float closestDepth = sampleCubeShadowDepth(lightIndex, dir);
//   float farMinusNear = max(uShadowCameraFar - uShadowCameraNear, 0.1);
//   closestDepth = closestDepth * farMinusNear + uShadowCameraNear;
//   float bias = uShadowMapBias * 2.0;
//   return currentDist > closestDepth + bias ? 0.0 : 1.0;
// }

// Unified shadow function that handles all light types
// NOTE: Point light shadows disabled - only directional/spot shadows work
float getShadow(int lightIndex, vec3 worldPos) {
  // Check if this light casts shadows
  if (lightIndex >= MAX_LIGHTS || !uLightCastsShadow[lightIndex]) {
    return 1.0;
  }

  int lightType = uLightTypes[lightIndex];

  if (lightType == LIGHT_TYPE_POINT) {
    // Point light shadows disabled due to cube texture issues
    return 1.0;
  } else {
    // LIGHT_TYPE_DIRECTIONAL or LIGHT_TYPE_SPOT
    return sampleShadowPCF(lightIndex, worldPos);
  }
}
`;
