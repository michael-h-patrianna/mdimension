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
      gl_FragColor = vec4(uEdgeColor, uOpacity);
    }
  `
}
