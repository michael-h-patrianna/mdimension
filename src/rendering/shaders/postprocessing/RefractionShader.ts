/**
 * Screen-Space Refraction Shader
 *
 * Distorts the image based on surface normals to simulate refraction.
 *
 * Algorithm:
 * 1. Sample normal from G-buffer
 * 2. Calculate UV offset based on normal and IOR
 * 3. Optional: chromatic aberration (sample R/G/B at different offsets)
 * 4. Sample color at offset UV
 */

import * as THREE from 'three';

export interface RefractionUniforms {
  tDiffuse: { value: THREE.Texture | null };
  tNormal: { value: THREE.Texture | null };
  tDepth: { value: THREE.DepthTexture | null };
  invProjMatrix: { value: THREE.Matrix4 };
  ior: { value: number };
  strength: { value: number };
  chromaticAberration: { value: number };
  resolution: { value: THREE.Vector2 };
  nearClip: { value: number };
  farClip: { value: number };
}

export const RefractionShader = {
  name: 'RefractionShader',

  // Use GLSL3 for WebGL2 - Three.js will handle the #version directive
  glslVersion: THREE.GLSL3,

  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    invProjMatrix: { value: new THREE.Matrix4() },
    ior: { value: 1.5 },
    strength: { value: 0.1 },
    chromaticAberration: { value: 0.0 },
    resolution: { value: new THREE.Vector2() },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
  } as RefractionUniforms,

  vertexShader: /* glsl */ `
    out vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    #include <packing>

    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform mat4 invProjMatrix;
    uniform float ior;
    uniform float strength;
    uniform float chromaticAberration;
    uniform vec2 resolution;
    uniform float nearClip;
    uniform float farClip;

    in vec2 vUv;
    layout(location = 0) out vec4 fragColor;

    // Get linear depth from depth buffer
    float getLinearDepth(vec2 coord) {
      float depth = texture(tDepth, coord).x;
      return perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    // Get view-space position from UV and depth
    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewPos = invProjMatrix * clipPos;
      return viewPos.xyz / viewPos.w;
    }

    // Reconstruct VIEW-SPACE normal from depth buffer
    // Uses neighboring depth samples to compute view-space positions,
    // then calculates the surface normal from the cross product of tangent vectors
    vec3 reconstructNormal(vec2 coord) {
      vec2 texel = 1.0 / resolution;

      // Sample depth at center and neighboring pixels
      float depthC = texture(tDepth, coord).x;
      float depthL = texture(tDepth, coord - vec2(texel.x, 0.0)).x;
      float depthR = texture(tDepth, coord + vec2(texel.x, 0.0)).x;
      float depthU = texture(tDepth, coord - vec2(0.0, texel.y)).x;
      float depthD = texture(tDepth, coord + vec2(0.0, texel.y)).x;

      // Reconstruct view-space positions
      vec3 posC = getViewPosition(coord, depthC);
      vec3 posL = getViewPosition(coord - vec2(texel.x, 0.0), depthL);
      vec3 posR = getViewPosition(coord + vec2(texel.x, 0.0), depthR);
      vec3 posU = getViewPosition(coord - vec2(0.0, texel.y), depthU);
      vec3 posD = getViewPosition(coord + vec2(0.0, texel.y), depthD);

      // Calculate tangent vectors using central differences for better accuracy
      // Use the smaller difference to avoid artifacts at depth discontinuities
      vec3 ddx = (abs(posR.z - posC.z) < abs(posC.z - posL.z)) ? (posR - posC) : (posC - posL);
      vec3 ddy = (abs(posD.z - posC.z) < abs(posC.z - posU.z)) ? (posD - posC) : (posC - posU);

      // Cross product gives the surface normal in view space
      // Note: In view space, camera looks down -Z, so we use ddy × ddx for correct orientation
      vec3 normal = normalize(cross(ddy, ddx));

      return normal;
    }

    // Get normal from G-buffer (encoded as RGB = normal * 0.5 + 0.5)
    // Falls back to depth reconstruction if normal buffer not available
    vec3 getNormal(vec2 coord) {
      vec4 normalData = texture(tNormal, coord);

      // Check if we have valid normal data (non-zero alpha or valid RGB)
      if (length(normalData.rgb) > 0.01) {
        return normalize(normalData.rgb * 2.0 - 1.0);
      }

      // Fallback: reconstruct from depth
      return reconstructNormal(coord);
    }

    // Check if this pixel has valid G-buffer data (not background)
    bool hasGBufferData(vec2 coord) {
      float depth = texture(tDepth, coord).x;
      return depth < 0.9999;
    }

    void main() {
      // Early exit if no G-buffer data at this pixel
      if (!hasGBufferData(vUv)) {
        fragColor = texture(tDiffuse, vUv);
        return;
      }

      // Sample normal
      vec3 normal = getNormal(vUv);

      // Calculate refraction offset based on normal deviation from camera-facing
      // Normal facing camera = (0, 0, 1) in view space, deviation causes distortion
      vec2 normalXY = normal.xy;

      // IOR affects the amount of bending
      // IOR > 1 means light bends toward the normal when entering the material
      float iorEffect = (ior - 1.0) * 2.0;

      // Base offset from normal
      vec2 offset = normalXY * strength * iorEffect;

      // Adjust for aspect ratio
      offset.x *= resolution.y / resolution.x;

      if (chromaticAberration > 0.0) {
        // Chromatic aberration: sample R, G, B at slightly different offsets
        // Red bends less, blue bends more (matches real-world dispersion)
        float caOffset = chromaticAberration * 0.02;

        vec2 offsetR = offset * (1.0 - caOffset);
        vec2 offsetG = offset;
        vec2 offsetB = offset * (1.0 + caOffset);

        // Clamp UVs to prevent sampling outside texture
        vec2 uvR = clamp(vUv + offsetR, 0.0, 1.0);
        vec2 uvG = clamp(vUv + offsetG, 0.0, 1.0);
        vec2 uvB = clamp(vUv + offsetB, 0.0, 1.0);

        float r = texture(tDiffuse, uvR).r;
        float g = texture(tDiffuse, uvG).g;
        float b = texture(tDiffuse, uvB).b;

        fragColor = vec4(r, g, b, 1.0);
      } else {
        // No chromatic aberration - simple offset
        vec2 refractedUV = clamp(vUv + offset, 0.0, 1.0);
        fragColor = texture(tDiffuse, refractedUV);
      }
    }
  `,
};
