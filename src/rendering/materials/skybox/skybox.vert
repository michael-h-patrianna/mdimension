/**
 * Skybox Vertex Shader
 * 
 * Handles skybox cube rendering with rotation support.
 * 
 * WebGL2 / GLSL ES 3.00
 */
precision highp float;

uniform mat3 uRotation;

out vec3 vWorldDirection;
out vec2 vScreenUV;
out vec3 vWorldPosition;

void main() {
  // Standard Skybox Rotation
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vec3 worldPos = worldPos4.xyz;
  vWorldPosition = worldPos;

  vWorldDirection = uRotation * normalize(worldPos);

  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clipPos;

  // Force to background (z = w)
  gl_Position.z = gl_Position.w;

  // Screen UV for post effects
  vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;
}

