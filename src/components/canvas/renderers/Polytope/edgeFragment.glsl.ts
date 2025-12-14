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
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      gl_FragColor = vec4(uColor, uOpacity);
    }
  `
}
