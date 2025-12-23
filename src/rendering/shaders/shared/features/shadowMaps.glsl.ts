/**
 * Shadow Map Sampling Module
 *
 * Provides shadow map sampling for mesh-based objects (Polytope, TubeWireframe).
 * Supports all three light types:
 * - Directional lights: 2D shadow maps with orthographic projection
 * - Spot lights: 2D shadow maps with perspective projection
 * - Point lights: 2D packed shadow maps (6 cube faces packed into 2D texture)
 *
 * Uses PCF (Percentage Closer Filtering) for soft shadow edges.
 *
 * Point light shadows use Three.js's approach: packing 6 cube faces into a 2D texture
 * with a 4:2 aspect ratio, then using cubeToUV() to map 3D directions to 2D coordinates.
 * This avoids the "bindTexture: textures can not be used with multiple targets" WebGL error.
 *
 * @see https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping
 * @see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js
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

// Point Shadow Maps (2D packed cube faces - Three.js style)
// Each texture contains 6 cube faces packed in a 4:2 layout
uniform sampler2D uPointShadowMap0;
uniform sampler2D uPointShadowMap1;
uniform sampler2D uPointShadowMap2;
uniform sampler2D uPointShadowMap3;

// Per-light shadow enable flags
uniform bool uLightCastsShadow[MAX_LIGHTS];

// Shadow settings
uniform float uShadowMapBias;
uniform float uShadowMapSize;
uniform int uShadowPCFSamples; // 0=hard, 1=3x3 PCF, 2=5x5 PCF
uniform float uShadowCameraNear;
uniform float uShadowCameraFar;
`

/**
 * Shadow map sampling functions.
 * Includes PCF filtering for soft shadows and packed 2D sampling for point lights.
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

// Sample point shadow map by index (unrolled for GLSL ES 3.0)
vec4 samplePointShadowMap(int index, vec2 uv) {
  if (index < 0 || index >= MAX_LIGHTS) return vec4(1.0);
  if (index == 0) return texture(uPointShadowMap0, uv);
  if (index == 1) return texture(uPointShadowMap1, uv);
  if (index == 2) return texture(uPointShadowMap2, uv);
  if (index == 3) return texture(uPointShadowMap3, uv);
  return vec4(1.0);
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

// ============================================
// Point Light Shadow Functions (Three.js style)
// ============================================

// Unpack RGBA to depth value (Three.js packing format)
float unpackRGBAToDepth(vec4 v) {
  // Three.js packs depth as RGBA for precision
  return dot(v, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));
}

// Convert 3D direction to 2D UV coordinates for packed cube shadow map
// Three.js packs 6 cube faces into a 2D texture with layout: xzXZ / y Y
// (lowercase = negative direction, uppercase = positive direction)
// @see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js
vec2 cubeToUV(vec3 v, float texelSizeY) {
  vec3 absV = abs(v);

  // Scale to unit cube intersection - guard against zero vector
  float maxComponent = max(absV.x, max(absV.y, absV.z));
  float scaleToCube = 1.0 / max(maxComponent, 0.0001);
  absV *= scaleToCube;

  // Apply scale to avoid seams (pull slightly inward from edges)
  v *= scaleToCube * (1.0 - 2.0 * texelSizeY);

  // Start with XY plane projection
  vec2 planar = v.xy;

  float almostATexel = 1.5 * texelSizeY;
  float almostOne = 1.0 - almostATexel;

  // Determine which face we're on and remap coordinates
  if (absV.z >= almostOne) {
    // Z faces (+Z or -Z)
    if (v.z > 0.0) {
      planar.x = 4.0 - v.x; // +Z face
    }
    // -Z face uses default v.xy
  } else if (absV.x >= almostOne) {
    // X faces (+X or -X)
    float signX = sign(v.x);
    planar.x = v.z * signX + 2.0 * signX;
  } else if (absV.y >= almostOne) {
    // Y faces (+Y or -Y)
    float signY = sign(v.y);
    planar.x = v.x + 2.0 * signY + 2.0;
    planar.y = v.z * signY - 2.0;
  }

  // Map from [-4,4] x [-2,2] to [0,1] x [0,1]
  return vec2(0.125, 0.25) * planar + vec2(0.375, 0.75);
}

// Sample point light shadow using packed 2D texture
float getPointShadow(int lightIndex, vec3 worldPos) {
  vec3 lightPos = uLightPositions[lightIndex];
  vec3 lightToFrag = worldPos - lightPos;
  float lightDistance = length(lightToFrag);
  
  // Guard against zero distance (fragment at light position)
  if (lightDistance < 0.0001) {
    return 1.0; // Not in shadow
  }
  vec3 lightDir = lightToFrag / lightDistance;

  // Early exit if fragment is outside the shadow camera range
  float cameraNear = uShadowCameraNear;
  float cameraFar = uShadowCameraFar;
  if (lightDistance - cameraFar > 0.0 || lightDistance - cameraNear < 0.0) {
    return 1.0; // Not in shadow (outside range)
  }

  // Calculate texel size for the packed texture (4:2 aspect ratio)
  float texelSizeY = 1.0 / (uShadowMapSize * 2.0);

  // Convert 3D direction to 2D UV
  vec2 uv = cubeToUV(lightDir, texelSizeY);

  // Sample the packed shadow map
  vec4 shadowSample = samplePointShadowMap(lightIndex, uv);
  float closestDepth = unpackRGBAToDepth(shadowSample);

  // Normalize fragment distance the same way the shadow map was written:
  // dist = (distance - near) / (far - near)
  // This matches the MeshDistanceMaterial encoding used by Three.js
  // Guard against cameraFar == cameraNear
  float depthRange = cameraFar - cameraNear;
  float dp = depthRange > 0.0001 ? (lightDistance - cameraNear) / depthRange : 0.0;

  // Point lights need larger bias (2x) due to cube map edge discontinuities
  // and inherent precision issues at face boundaries where depth values jump
  float bias = uShadowMapBias * 2.0;
  dp += bias;

  // Compare in normalized space: if dp > closestDepth, fragment is in shadow
  return step(dp, closestDepth);
}

// Point shadow with PCF (soft edges)
float getPointShadowPCF(int lightIndex, vec3 worldPos) {
  vec3 lightPos = uLightPositions[lightIndex];
  vec3 lightToFrag = worldPos - lightPos;
  float lightDistance = length(lightToFrag);
  
  // Guard against zero distance (fragment at light position)
  if (lightDistance < 0.0001) {
    return 1.0; // Not in shadow
  }
  vec3 lightDir = lightToFrag / lightDistance;

  // Early exit if fragment is outside the shadow camera range
  float cameraNear = uShadowCameraNear;
  float cameraFar = uShadowCameraFar;
  if (lightDistance - cameraFar > 0.0 || lightDistance - cameraNear < 0.0) {
    return 1.0; // Not in shadow (outside range)
  }

  float texelSizeY = 1.0 / (uShadowMapSize * 2.0);
  float shadow = 0.0;

  // Normalize fragment distance the same way the shadow map was written
  // Guard against cameraFar == cameraNear
  float depthRange = cameraFar - cameraNear;
  float dp = depthRange > 0.0001 ? (lightDistance - cameraNear) / depthRange : 0.0;

  // Point lights need larger bias (2x) due to cube map edge discontinuities
  float bias = uShadowMapBias * 2.0;
  dp += bias;

  // PCF with 9 samples (offset the direction slightly)
  float radius = 0.002; // Small angular offset

  // Create perpendicular vectors for PCF offset sampling
  // When lightDir is nearly vertical (parallel to Y-axis), use X-axis as alternative up vector
  // to avoid zero-length cross product which would cause NaN from normalize()
  vec3 up = abs(lightDir.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 perpX = normalize(cross(lightDir, up));
  vec3 perpY = normalize(cross(lightDir, perpX));

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      // Offset direction for PCF sampling
      vec3 offsetDir = normalize(lightDir + perpX * float(x) * radius + perpY * float(y) * radius);

      vec2 uv = cubeToUV(offsetDir, texelSizeY);
      vec4 shadowSample = samplePointShadowMap(lightIndex, uv);
      float closestDepth = unpackRGBAToDepth(shadowSample);

      // Compare in normalized space
      shadow += step(dp, closestDepth);
    }
  }

  return shadow / 9.0;
}

// ============================================
// Directional/Spot Shadow Functions
// ============================================

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

// ============================================
// Unified Shadow Function
// ============================================

// Unified shadow function that handles all light types
float getShadow(int lightIndex, vec3 worldPos) {
  // Check if this light casts shadows
  if (lightIndex >= MAX_LIGHTS || !uLightCastsShadow[lightIndex]) {
    return 1.0;
  }

  int lightType = uLightTypes[lightIndex];

  if (lightType == LIGHT_TYPE_POINT) {
    // Point light: use packed 2D shadow map with cubeToUV
    if (uShadowPCFSamples > 0) {
      return getPointShadowPCF(lightIndex, worldPos);
    }
    return getPointShadow(lightIndex, worldPos);
  } else {
    // LIGHT_TYPE_DIRECTIONAL or LIGHT_TYPE_SPOT: use 2D shadow map with PCF
    return sampleShadowPCF(lightIndex, worldPos);
  }
}
`
