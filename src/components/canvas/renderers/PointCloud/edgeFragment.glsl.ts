/**
 * Edge Fragment Shader for Point Cloud Rendering
 *
 * Simple color output shader for edge/wireframe rendering.
 *
 * @module
 */

/**
 * Build fragment shader for GPU edge rendering.
 *
 * @returns GLSL fragment shader string
 */
export function buildEdgeFragmentShader(): string {
  return `
    uniform vec3 uEdgeColor;
    uniform float uOpacity;

    void main() {
      // Three.js GLSL3 provides pc_fragColor output automatically
      pc_fragColor = vec4(uEdgeColor, uOpacity);
    }
  `
}
