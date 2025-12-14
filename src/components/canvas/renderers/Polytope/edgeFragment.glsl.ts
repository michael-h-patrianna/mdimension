/**
 * Edge Fragment Shader for Polytope Rendering
 *
 * Simple color output shader for edge/wireframe rendering (thin lines).
 * No lighting calculations - just outputs uniform color.
 * Uses single output (not MRT) since thin lines are 1D primitives.
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
    precision highp float;

    // Single output for thin line edges (no MRT needed)
    out vec4 fragColor;

    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      // Simple color output for thin line edges (1D primitives)
      fragColor = vec4(uColor, uOpacity);
    }
  `
}
