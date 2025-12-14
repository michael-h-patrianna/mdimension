/**
 * Edge Fragment Shader for Polytope Rendering
 *
 * Simple color output shader for edge/wireframe rendering.
 * No lighting calculations - just outputs uniform color.
 *
 * @module
 */

/**
 * Build edge fragment shader (simple color output).
 *
 * @returns GLSL fragment shader string
 */
export function buildEdgeFragmentShader(): string {
  return `
    // Output declaration for WebGL2
    layout(location = 0) out vec4 fragColor;

    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      fragColor = vec4(uColor, uOpacity);
    }
  `
}
