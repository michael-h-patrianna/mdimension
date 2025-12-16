/**
 * Depth Capture Shader
 *
 * Copies depth from the scene's depth texture to a linear depth buffer
 * for use in temporal reprojection. Converts clip-space depth to linear
 * world-space distance.
 *
 * Uses CONSERVATIVE MIN sampling when downsampling:
 * - Samples a 2x2 grid in the source footprint
 * - Takes the MINIMUM depth (closest surface)
 * - This prevents ray marching from overshooting thin structures
 *
 * Used by the temporal reprojection system to store the previous frame's
 * depth information in a ping-pong buffer setup.
 */

import * as THREE from 'three';

export interface DepthCaptureUniforms {
  tDepth: { value: THREE.DepthTexture | null };
  nearClip: { value: number };
  farClip: { value: number };
  sourceResolution: { value: THREE.Vector2 };
}

export const DepthCaptureShader = {
  name: 'DepthCaptureShader',

  uniforms: {
    tDepth: { value: null as THREE.DepthTexture | null },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
    sourceResolution: { value: new THREE.Vector2(1, 1) },
  } as DepthCaptureUniforms,

  vertexShader: /* glsl */ `#version 300 es
    in vec3 position;
    in vec2 uv;

    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;

    out vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `#version 300 es
    precision highp float;

    #include <packing>

    uniform sampler2D tDepth;
    uniform float nearClip;
    uniform float farClip;
    uniform vec2 sourceResolution;

    in vec2 vUv;

    layout(location = 0) out vec4 fragColor;

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
      // Calculate texel offset for 2x2 sampling in source footprint
      // Since we're at 0.5 resolution, each output pixel covers a 2x2 source area
      vec2 texelSize = 1.0 / sourceResolution;
      vec2 halfTexel = texelSize * 0.5;

      // Sample 2x2 grid centered on this output pixel's footprint
      // The offsets are ±0.25 texels to hit the center of each source texel in the 2x2 block
      float d00 = texture(tDepth, vUv + vec2(-halfTexel.x, -halfTexel.y)).x;
      float d01 = texture(tDepth, vUv + vec2(-halfTexel.x,  halfTexel.y)).x;
      float d10 = texture(tDepth, vUv + vec2( halfTexel.x, -halfTexel.y)).x;
      float d11 = texture(tDepth, vUv + vec2( halfTexel.x,  halfTexel.y)).x;

      // Take MINIMUM depth (closest surface) - this is conservative for ray marching
      // Using min prevents overshooting thin structures that exist in the source footprint
      float depth = min(min(d00, d01), min(d10, d11));

      // Convert to linear depth (world units from camera)
      float linearDepth = getLinearDepth(depth);

      // Normalize to [0, 1] range for storage
      // Use far clip as max to preserve precision for nearby surfaces
      float normalizedDepth = clamp(linearDepth / farClip, 0.0, 1.0);

      // Output to single-channel float texture
      fragColor = vec4(normalizedDepth, 0.0, 0.0, 1.0);
    }
  `,
};
