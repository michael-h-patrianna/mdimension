/**
 * Bilateral Upsample Shader
 *
 * OPTIMIZATION: Depth-aware upsampling for half-resolution effects.
 * Preserves edges by comparing depth values, preventing blur across depth discontinuities.
 *
 * Used for upsampling SSR, GTAO, and other effects rendered at half resolution.
 *
 * @module rendering/shaders/postprocessing/BilateralUpsampleShader
 */

import * as THREE from 'three';

export const BilateralUpsampleShader = {
  uniforms: {
    tInput: { value: null as THREE.Texture | null },
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDepthThreshold: { value: 0.01 }, // Depth discontinuity threshold
    uNearClip: { value: 0.1 },
    uFarClip: { value: 1000 },
  },

  vertexShader: /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tInput;     // Half-res effect (e.g., SSR)
    uniform sampler2D tColor;     // Full-res scene color
    uniform sampler2D tDepth;     // Full-res depth
    uniform vec2 uResolution;     // Full resolution
    uniform float uDepthThreshold;
    uniform float uNearClip;
    uniform float uFarClip;

    in vec2 vUv;
    layout(location = 0) out vec4 fragColor;

    // Convert raw depth to linear depth
    float linearizeDepth(float rawDepth) {
      return (2.0 * uNearClip * uFarClip) / 
             (uFarClip + uNearClip - rawDepth * (uFarClip - uNearClip));
    }

    void main() {
      vec2 texelSize = 1.0 / uResolution;
      vec2 halfTexelSize = texelSize * 2.0; // Half-res texel size
      
      // Sample full-res depth at current pixel
      float centerDepth = linearizeDepth(texture(tDepth, vUv).r);
      
      // Sample the 4 nearest half-res pixels
      vec2 halfResUv = vUv;
      vec2 halfOffset = texelSize * 0.5;
      
      vec2 offsets[4];
      offsets[0] = vec2(-halfOffset.x, -halfOffset.y);
      offsets[1] = vec2( halfOffset.x, -halfOffset.y);
      offsets[2] = vec2(-halfOffset.x,  halfOffset.y);
      offsets[3] = vec2( halfOffset.x,  halfOffset.y);
      
      vec4 samples[4];
      float depths[4];
      float weights[4];
      float totalWeight = 0.0;
      
      for (int i = 0; i < 4; i++) {
        vec2 sampleUv = vUv + offsets[i];
        samples[i] = texture(tInput, sampleUv);
        depths[i] = linearizeDepth(texture(tDepth, sampleUv).r);
        
        // Calculate bilateral weight based on depth similarity
        float depthDiff = abs(depths[i] - centerDepth);
        float depthWeight = exp(-depthDiff / (uDepthThreshold * centerDepth));
        
        // Also use distance weight for bilinear interpolation
        vec2 distToSample = abs(offsets[i]) / halfOffset;
        float distWeight = (1.0 - distToSample.x) * (1.0 - distToSample.y);
        
        weights[i] = depthWeight * distWeight;
        totalWeight += weights[i];
      }
      
      // Normalize and blend
      if (totalWeight > 0.001) {
        vec4 result = vec4(0.0);
        for (int i = 0; i < 4; i++) {
          result += samples[i] * (weights[i] / totalWeight);
        }
        
        // Blend SSR with original color
        vec4 sceneColor = texture(tColor, vUv);
        fragColor = vec4(sceneColor.rgb + result.rgb * result.a, sceneColor.a);
      } else {
        // Fallback to original color if no valid samples
        fragColor = texture(tColor, vUv);
      }
    }
  `,
};

export type BilateralUpsampleUniforms = {
  tInput: THREE.Uniform<THREE.Texture | null>;
  tColor: THREE.Uniform<THREE.Texture | null>;
  tDepth: THREE.Uniform<THREE.Texture | null>;
  uResolution: THREE.Uniform<THREE.Vector2>;
  uDepthThreshold: THREE.Uniform<number>;
  uNearClip: THREE.Uniform<number>;
  uFarClip: THREE.Uniform<number>;
};

