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
    // Output declaration for WebGL2
    layout(location = 0) out vec4 fragColor;

    uniform vec3 uEdgeColor;
    uniform float uOpacity;

    void main() {
      fragColor = vec4(uEdgeColor, uOpacity);
    }
  `
}
