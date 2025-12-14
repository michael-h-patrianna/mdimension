/**
 * Screen-Space Reflections Shader
 *
 * Ray marches in screen space to find reflections.
 *
 * Algorithm:
 * 1. Sample normal and depth from G-buffer
 * 2. Calculate reflection direction in view space
 * 3. Ray march in screen space to find hit
 * 4. Sample color at hit point
 * 5. Apply Fresnel and distance fade
 */

import * as THREE from 'three';

export interface SSRUniforms {
  tDiffuse: { value: THREE.Texture | null };
  tNormal: { value: THREE.Texture | null };
  tDepth: { value: THREE.DepthTexture | null };
  resolution: { value: THREE.Vector2 };
  projMatrix: { value: THREE.Matrix4 };
  invProjMatrix: { value: THREE.Matrix4 };
  uViewMat: { value: THREE.Matrix4 };
  intensity: { value: number };
  maxDistance: { value: number };
  thickness: { value: number };
  fadeStart: { value: number };
  fadeEnd: { value: number };
  maxSteps: { value: number };
  nearClip: { value: number };
  farClip: { value: number };
}

export const SSRShader = {
  name: 'SSRShader',

  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    resolution: { value: new THREE.Vector2() },
    projMatrix: { value: new THREE.Matrix4() },
    invProjMatrix: { value: new THREE.Matrix4() },
    uViewMat: { value: new THREE.Matrix4() },
    intensity: { value: 0.5 },
    maxDistance: { value: 20.0 },
    thickness: { value: 0.1 },
    fadeStart: { value: 0.5 },
    fadeEnd: { value: 1.0 },
    maxSteps: { value: 32 },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
  } as SSRUniforms,

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    #include <packing>

    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 projMatrix;
    uniform mat4 invProjMatrix;
    uniform mat4 uViewMat;
    uniform float intensity;
    uniform float maxDistance;
    uniform float thickness;
    uniform float fadeStart;
    uniform float fadeEnd;
    uniform int maxSteps;
    uniform float nearClip;
    uniform float farClip;

    varying vec2 vUv;

    // Get linear depth from depth buffer
    float getLinearDepth(vec2 coord) {
      float depth = texture2D(tDepth, coord).x;
      return perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    // Get view-space position from UV and depth
    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewPos = invProjMatrix * clipPos;
      return viewPos.xyz / viewPos.w;
    }

    // Reconstruct normal from depth buffer using screen-space derivatives
    // This is a fallback when no G-buffer normal is available
    vec3 reconstructNormal(vec2 coord) {
      vec2 texel = 1.0 / resolution;

      // Sample depth at neighboring pixels
      float depthC = getLinearDepth(coord);
      float depthL = getLinearDepth(coord - vec2(texel.x, 0.0));
      float depthR = getLinearDepth(coord + vec2(texel.x, 0.0));
      float depthU = getLinearDepth(coord - vec2(0.0, texel.y));
      float depthD = getLinearDepth(coord + vec2(0.0, texel.y));

      // Calculate screen-space derivatives
      float dzdx = (depthR - depthL) * 0.5;
      float dzdy = (depthD - depthU) * 0.5;

      // Reconstruct normal from gradient
      vec3 normal = normalize(vec3(-dzdx, -dzdy, 1.0));
      return normal;
    }

    // Get normal from G-buffer (encoded as RGB = normal * 0.5 + 0.5)
    // Falls back to depth reconstruction if normal buffer not available
    vec3 getNormal(vec2 coord) {
      vec4 normalData = texture2D(tNormal, coord);

      // Check if we have valid normal data (non-zero alpha or valid RGB)
      if (length(normalData.rgb) > 0.01) {
        return normalize(normalData.rgb * 2.0 - 1.0);
      }

      // Fallback: reconstruct from depth
      return reconstructNormal(coord);
    }

    // Get reflectivity from G-buffer alpha channel
    // Falls back to a default value if not available
    float getReflectivity(vec2 coord) {
      vec4 normalData = texture2D(tNormal, coord);
      // If alpha is 0 (no G-buffer), use metallic approximation from scene
      return normalData.a > 0.0 ? normalData.a : 0.3;
    }

    // Project view-space position to screen UV
    vec2 projectToScreen(vec3 viewPos) {
      vec4 clipPos = projMatrix * vec4(viewPos, 1.0);
      return (clipPos.xy / clipPos.w) * 0.5 + 0.5;
    }

    // Fresnel approximation (Schlick)
    float fresnel(vec3 viewDir, vec3 normal, float f0) {
      float cosTheta = max(dot(viewDir, normal), 0.0);
      return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
    }

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);

      // Early exit if SSR is disabled or intensity is zero
      if (intensity <= 0.0) {
        gl_FragColor = sceneColor;
        return;
      }

      // Sample G-buffer
      float depth = texture2D(tDepth, vUv).x;

      // Skip background (depth = 1.0 means nothing there)
      if (depth >= 0.9999) {
        gl_FragColor = sceneColor;
        return;
      }

      vec3 normal = getNormal(vUv);
      float reflectivity = getReflectivity(vUv);

      // Skip non-reflective surfaces
      if (reflectivity <= 0.0) {
        gl_FragColor = sceneColor;
        return;
      }

      // Get view-space position
      vec3 viewPos = getViewPosition(vUv, depth);
      vec3 viewDir = normalize(-viewPos);

      // Calculate reflection direction in view space
      vec3 reflectDir = reflect(-viewDir, normal);

      // Fresnel effect - more reflection at grazing angles
      float fresnelFactor = fresnel(viewDir, normal, 0.04);

      // Ray march in view space
      vec3 rayOrigin = viewPos;
      vec3 rayDir = reflectDir;

      // Calculate step size based on max distance and steps
      float stepSize = maxDistance / float(maxSteps);

      vec2 hitUV = vec2(-1.0);
      float hitDist = 0.0;

      for (int i = 1; i <= 64; i++) {
        if (i > maxSteps) break;

        // Step along ray
        vec3 rayPos = rayOrigin + rayDir * (stepSize * float(i));

        // Check if ray goes behind camera
        if (rayPos.z > -nearClip) break;

        // Project to screen
        vec2 sampleUV = projectToScreen(rayPos);

        // Check if outside screen bounds
        if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
          continue;
        }

        // Sample depth at this position
        float sampleDepth = texture2D(tDepth, sampleUV).x;
        vec3 sampleViewPos = getViewPosition(sampleUV, sampleDepth);

        // Check for intersection (ray is behind surface)
        float depthDiff = rayPos.z - sampleViewPos.z;

        if (depthDiff > 0.0 && depthDiff < thickness) {
          // Hit found
          hitUV = sampleUV;
          hitDist = length(rayPos - rayOrigin);
          break;
        }
      }

      // Apply reflection if hit was found
      if (hitUV.x >= 0.0) {
        vec4 reflectionColor = texture2D(tDiffuse, hitUV);

        // Distance fade
        float distFade = 1.0 - smoothstep(fadeStart * maxDistance, fadeEnd * maxDistance, hitDist);

        // Edge fade (fade out near screen edges)
        vec2 edgeDist = abs(hitUV - 0.5) * 2.0;
        float edgeFade = 1.0 - max(edgeDist.x, edgeDist.y);
        edgeFade = smoothstep(0.0, 0.2, edgeFade);

        // Combine all factors
        float reflectionStrength = intensity * reflectivity * fresnelFactor * distFade * edgeFade;

        // Blend reflection with scene color
        gl_FragColor = mix(sceneColor, reflectionColor, reflectionStrength);
      } else {
        gl_FragColor = sceneColor;
      }
    }
  `,
};
