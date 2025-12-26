/**
 * Environment Composite Shader
 *
 * Composites the lensed environment layer behind the main object layer.
 * Uses alpha blending to allow transparent objects (wireframes, glass) to
 * show the lensed environment through them.
 *
 * @module rendering/shaders/postprocessing/environmentComposite
 */

export const environmentCompositeVertexShader = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const environmentCompositeFragmentShader = /* glsl */ `
  precision highp float;

  in vec2 vUv;
  layout(location = 0) out vec4 fragColor;

  uniform sampler2D tLensedEnvironment;  // Lensed environment color
  uniform sampler2D tMainObject;         // Main object color (RGBA)
  uniform sampler2D tMainObjectDepth;    // Main object depth buffer
  uniform float uNear;
  uniform float uFar;

  /**
   * Check if depth value represents the far plane (no object rendered).
   * NDC depth of 1.0 = far plane = no object at this pixel.
   */
  bool isAtFarPlane(float depth) {
    return depth >= 0.9999;
  }

  void main() {
    // Sample both layers
    vec4 envColor = texture(tLensedEnvironment, vUv);
    vec4 objColor = texture(tMainObject, vUv);
    float objDepth = texture(tMainObjectDepth, vUv).r;

    // Alpha blend strategy:
    // - If object depth is at far plane (1.0) AND alpha is low, show environment only
    // - Otherwise, blend based on object's alpha channel
    //
    // This allows:
    // - Wireframe polytopes: low alpha = env shows through
    // - Solid objects: alpha = 1.0 = fully opaque
    // - Semi-transparent effects: partial blending
    // - Black hole horizon: depth=1.0 but alpha=1.0 = fully opaque black
    //
    // NOTE: Black hole horizon intentionally outputs depth=1.0 (far plane) to avoid
    // SSL smearing artifacts, but outputs alpha=1.0 to remain fully opaque.

    if (isAtFarPlane(objDepth) && objColor.a < 0.01) {
      // No object at this pixel (far depth + zero alpha) - show environment
      fragColor = envColor;
    } else {
      // Object exists - blend based on alpha
      // The main object is rendered with forceOpaque=true, so objColor.rgb is NOT pre-multiplied.
      // objColor.a contains the material's opacity (uOpacity from shader).
      // Use standard straight alpha compositing: result = obj.rgb * obj.a + env.rgb * (1 - obj.a)
      vec3 blended = objColor.rgb * objColor.a + envColor.rgb * (1.0 - objColor.a);
      float alpha = max(envColor.a, objColor.a);
      fragColor = vec4(blended, alpha);
    }
  }
`
