/**
 * Edge Fragment Shader for Point Cloud Rendering
 *
 * MRT-compatible fragment shader for edge/wireframe rendering.
 * Outputs to both color and normal buffers for post-processing compatibility.
 *
 * @module
 */

/**
 * Build fragment shader for GPU edge rendering.
 *
 * Uses MRT (Multiple Render Targets) for compatibility with post-processing:
 * - gColor: Edge color output
 * - gNormal: Normal buffer (edges use view-facing normal, low metallic)
 *
 * @returns GLSL fragment shader string
 */
export function buildEdgeFragmentShader(): string {
  return `
    precision highp float;
    precision highp int;

    // MRT output declarations for WebGL2
    layout(location = 0) out vec4 gColor;
    layout(location = 1) out vec4 gNormal;

    uniform vec3 uEdgeColor;
    uniform float uOpacity;

    void main() {
      // Output edge color
      gColor = vec4(uEdgeColor, uOpacity);

      // Edges don't have real normals - use view-facing normal (0,0,1)
      // Pack normal to [0,1] range and set low metallic for edges
      gNormal = vec4(0.5, 0.5, 1.0, 0.0);
    }
  `
}
