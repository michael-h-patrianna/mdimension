/**
 * Depth Capture Shader
 *
 * Copies depth from the scene's depth texture to a linear depth buffer
 * for use in temporal reprojection. Converts clip-space depth to linear
 * world-space distance.
 *
 * Used by the temporal reprojection system to store the previous frame's
 * depth information in a ping-pong buffer setup.
 */

import * as THREE from 'three';

export interface DepthCaptureUniforms {
  tDepth: { value: THREE.DepthTexture | null };
  nearClip: { value: number };
  farClip: { value: number };
}

export const DepthCaptureShader = {
  name: 'DepthCaptureShader',

  uniforms: {
    tDepth: { value: null as THREE.DepthTexture | null },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
  } as DepthCaptureUniforms,

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    #include <packing>

    uniform sampler2D tDepth;
    uniform float nearClip;
    uniform float farClip;

    varying vec2 vUv;

    /**
     * Convert perspective depth buffer value to linear view-space Z.
     * Returns positive distance from camera.
     */
    float getLinearDepth(float depth) {
      // perspectiveDepthToViewZ returns negative Z (into screen)
      // We want positive distance, so negate it
      return -perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    void main() {
      float depth = texture2D(tDepth, vUv).x;

      // Convert to linear depth (world units from camera)
      float linearDepth = getLinearDepth(depth);

      // Normalize to [0, 1] range for storage
      // Use far clip as max to preserve precision for nearby surfaces
      float normalizedDepth = clamp(linearDepth / farClip, 0.0, 1.0);

      // Output to single-channel float texture
      gl_FragColor = vec4(normalizedDepth, 0.0, 0.0, 1.0);
    }
  `,
};
