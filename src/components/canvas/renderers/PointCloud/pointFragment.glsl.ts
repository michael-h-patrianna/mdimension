/**
 * Point Fragment Shader for Point Cloud Rendering
 *
 * Renders circular points with soft edges and optional per-vertex coloring.
 *
 * @module
 */

/**
 * Build fragment shader for GPU point rendering.
 *
 * Features:
 * - Circular point shape via discard
 * - Soft edge smoothing
 * - Per-vertex or uniform coloring
 *
 * @returns GLSL fragment shader string
 */
export function buildPointFragmentShader(): string {
  return `
    uniform vec3 uPointColor;
    uniform float uOpacity;
    uniform bool uUseVertexColors;

    in vec3 vColor;

    void main() {
      // Circular point shape
      vec2 center = gl_PointCoord - vec2(0.5);
      if (length(center) > 0.5) discard;

      vec3 color = uUseVertexColors ? vColor : uPointColor;

      // Soft edge
      float dist = length(center) * 2.0;
      float alpha = smoothstep(1.0, 0.7, dist) * uOpacity;

      // Three.js GLSL3 provides pc_fragColor output automatically
      pc_fragColor = vec4(color, alpha);
    }
  `
}
