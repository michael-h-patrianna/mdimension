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
  ior: { value: number };
  strength: { value: number };
  chromaticAberration: { value: number };
  resolution: { value: THREE.Vector2 };
  nearClip: { value: number };
  farClip: { value: number };
}

export const RefractionShader = {
  name: 'RefractionShader',

  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.DepthTexture | null },
    ior: { value: 1.5 },
    strength: { value: 0.1 },
    chromaticAberration: { value: 0.0 },
    resolution: { value: new THREE.Vector2() },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
  } as RefractionUniforms,

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
    uniform float ior;
    uniform float strength;
    uniform float chromaticAberration;
    uniform vec2 resolution;
    uniform float nearClip;
    uniform float farClip;

    varying vec2 vUv;

    // Get linear depth from depth buffer
    float getLinearDepth(vec2 coord) {
      float depth = texture2D(tDepth, coord).x;
      return perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    // Reconstruct normal from depth buffer using screen-space derivatives
    vec3 reconstructNormal(vec2 coord) {
      vec2 texel = 1.0 / resolution;

      // Sample depth at neighboring pixels
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

    // Check if this pixel has valid G-buffer data (not background)
    bool hasGBufferData(vec2 coord) {
      float depth = texture2D(tDepth, coord).x;
      return depth < 0.9999;
    }

    void main() {
      // Early exit if no G-buffer data at this pixel
      if (!hasGBufferData(vUv)) {
        gl_FragColor = texture2D(tDiffuse, vUv);
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

        float r = texture2D(tDiffuse, uvR).r;
        float g = texture2D(tDiffuse, uvG).g;
        float b = texture2D(tDiffuse, uvB).b;

        gl_FragColor = vec4(r, g, b, 1.0);
      } else {
        // No chromatic aberration - simple offset
        vec2 refractedUV = clamp(vUv + offset, 0.0, 1.0);
        gl_FragColor = texture2D(tDiffuse, refractedUV);
      }
    }
  `,
};
