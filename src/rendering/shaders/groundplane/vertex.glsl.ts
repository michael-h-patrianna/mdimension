/**
 * Ground Plane Vertex Shader
 *
 * Standard mesh vertex shader for ground plane surfaces.
 * Outputs world position, normal, and view direction for PBR lighting.
 *
 * NOTE: Three.js ShaderMaterial with glslVersion: GLSL3 automatically provides:
 * - #version 300 es
 * - Built-in attributes: position, normal, uv (as 'in' variables)
 * - Built-in uniforms: modelMatrix, viewMatrix, projectionMatrix, normalMatrix, cameraPosition
 */

export const vertexBlock = `
precision highp float;

// Outputs to fragment shader
out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vViewDirection;
out vec2 vUv;

void main() {
  // Transform to world space
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  // Transform normal to world space
  vNormal = normalize(normalMatrix * normal);

  // View direction (from fragment to camera)
  vViewDirection = normalize(cameraPosition - worldPos.xyz);

  // Pass through UVs for potential texture mapping
  vUv = uv;

  // Final clip space position
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;
