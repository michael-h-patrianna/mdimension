/**
 * Depth Capture Shader
 *
 * Copies depth from the scene's depth texture to a ray distance buffer
 * for use in temporal reprojection. Converts clip-space depth to actual
 * ray distance (not just view-space Z).
 *
 * Key design decisions:
 * - Stores RAY DISTANCE, not view-space Z (viewZ ≠ rayDistance for off-center pixels)
 * - Stores UNNORMALIZED values (FloatType allows real distances, better precision)
 * - Uses CONSERVATIVE MIN sampling when downsampling to prevent overshooting
 *
 * Why ray distance matters:
 * - viewZ is distance along camera's Z axis
 * - rayDistance is distance along the actual ray direction
 * - For off-center pixels: rayDistance = viewZ / cos(angle)
 * - Using viewZ directly would cause systematic errors in ray marching
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
  inverseProjectionMatrix: { value: THREE.Matrix4 };
}

export const DepthCaptureShader = {
  name: 'DepthCaptureShader',

  // Use GLSL3 for WebGL2 - Three.js will handle the #version directive
  glslVersion: THREE.GLSL3,

  uniforms: {
    tDepth: { value: null as THREE.DepthTexture | null },
    nearClip: { value: 0.1 },
    farClip: { value: 1000.0 },
    sourceResolution: { value: new THREE.Vector2(1, 1) },
    inverseProjectionMatrix: { value: new THREE.Matrix4() },
  } as DepthCaptureUniforms,

  vertexShader: /* glsl */ `
    out vec2 vUv;

    void main() {
      vUv = uv;
      // Use direct NDC coordinates instead of projectionMatrix * modelViewMatrix
      // This bypasses any DPR-related issues with Three.js camera matrices
      // PlaneGeometry(2, 2) has positions from -1 to +1, which maps directly to NDC
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    #include <packing>

    uniform sampler2D tDepth;
    uniform float nearClip;
    uniform float farClip;
    uniform vec2 sourceResolution;
    uniform mat4 inverseProjectionMatrix;

    in vec2 vUv;

    // WebGL2 GLSL ES 3.00 output declaration
    layout(location = 0) out vec4 fragColor;

    /**
     * Convert perspective depth buffer value to linear view-space Z.
     * Returns positive distance from camera (along Z axis).
     */
    float getLinearViewZ(float depth) {
      // perspectiveDepthToViewZ returns negative Z (into screen)
      // We want positive distance, so negate it
      return -perspectiveDepthToViewZ(depth, nearClip, farClip);
    }

    /**
     * Get the cosine of the angle between the ray at UV and the camera forward direction.
     * This is used to convert view-space Z to actual ray distance.
     *
     * For a perspective camera:
     * - Center of screen: cos(angle) = 1.0 (ray parallel to Z axis)
     * - Edge of screen: cos(angle) < 1.0 (ray angled outward)
     *
     * The ray direction is computed by unprojecting the NDC position.
     */
    float getRayCosAngle(vec2 uv) {
      // Convert UV to NDC (normalized device coordinates)
      // z = -1.0 is the near plane in OpenGL NDC
      vec2 ndc = uv * 2.0 - 1.0;

      // Unproject to view space using inverse projection matrix
      // We use z = -1.0 (near plane) and w = 1.0, then normalize
      vec4 viewPos = inverseProjectionMatrix * vec4(ndc, -1.0, 1.0);
      // Guard against w=0
      float safeW = abs(viewPos.w) < 0.0001 ? 0.0001 : viewPos.w;
      vec3 rayDir = normalize(viewPos.xyz / safeW);

      // The z-component of the normalized ray direction is the cosine of the angle
      // with the camera forward direction (-Z axis). We take abs since viewZ is positive.
      return abs(rayDir.z);
    }

    void main() {
      // Calculate texel offset for 2x2 sampling in source footprint
      // Since we're at 0.5 resolution, each output pixel covers a 2x2 source area
      vec2 texelSize = 1.0 / sourceResolution;
      vec2 halfTexel = texelSize * 0.5;

      // Sample 2x2 grid centered on this output pixel's footprint
      // The offsets are ±0.5 texels to hit the center of each source texel in the 2x2 block
      float d00 = texture(tDepth, vUv + vec2(-halfTexel.x, -halfTexel.y)).x;
      float d01 = texture(tDepth, vUv + vec2(-halfTexel.x,  halfTexel.y)).x;
      float d10 = texture(tDepth, vUv + vec2( halfTexel.x, -halfTexel.y)).x;
      float d11 = texture(tDepth, vUv + vec2( halfTexel.x,  halfTexel.y)).x;

      // Take MINIMUM depth (closest surface) - this is conservative for ray marching
      // Using min prevents overshooting thin structures that exist in the source footprint
      float depth = min(min(d00, d01), min(d10, d11));

      // Convert to linear view-space Z (distance along camera Z axis)
      float viewZ = getLinearViewZ(depth);

      // Convert view-space Z to actual ray distance
      // rayDistance = viewZ / cos(angle) where angle is between ray and camera forward
      // This is critical for off-center pixels where viewZ ≠ rayDistance
      float cosAngle = getRayCosAngle(vUv);
      float rayDistance = viewZ / max(cosAngle, 0.001); // Clamp to avoid division by near-zero

      // Store raw ray distance (no normalization)
      // Using FloatType allows us to store real distances with full precision
      // Zero distance indicates invalid/no temporal data
      fragColor = vec4(rayDistance, 0.0, 0.0, 1.0);
    }
  `,
};
