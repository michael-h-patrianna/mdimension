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

  // Photon shell (screen-space edge detection)
  uniform bool uShellEnabled;
  uniform vec3 uShellGlowColor;
  uniform float uShellGlowStrength;
  uniform vec2 uResolution;

  /**
   * Check if depth value represents the far plane (no object rendered).
   * NDC depth of 1.0 = far plane = no object at this pixel.
   */
  bool isAtFarPlane(float depth) {
    return depth >= 0.9999;
  }

  /**
   * Check if a pixel is part of the event horizon.
   * Horizon pixels have: depth ≈ 1.0 (far) AND alpha ≈ 1.0 (opaque).
   *
   * The key distinction is:
   * - Horizon: depth=1.0, alpha=1.0 (fully absorbed ray)
   * - Sky/escaped rays: depth=1.0, alpha<0.5 (ray escaped, shows environment)
   * - Disk: depth<1.0 (hit something solid)
   *
   * Note: We don't check luminance because horizon pixels may have
   * accumulated photon shell emission and not be completely black.
   */
  bool isHorizonPixel(vec2 uv) {
    vec4 color = texture(tMainObject, uv);
    float depth = texture(tMainObjectDepth, uv).r;

    // Horizon = far plane + high alpha (distinguishes from sky/escaped rays)
    return depth >= 0.999 && color.a > 0.9;
  }

  /**
   * Detect the visual boundary of the event horizon.
   * This finds pixels that are NOT horizon but have horizon neighbors.
   * The boundary naturally follows the lensing-deformed shape because
   * it's based on actual rendered pixels, not geometric calculations.
   */
  float detectHorizonEdge() {
    vec2 texelSize = 1.0 / uResolution;

    // Check if current pixel is horizon
    bool centerIsHorizon = isHorizonPixel(vUv);

    // Only glow OUTSIDE the horizon (on the bright side of the boundary)
    if (centerIsHorizon) {
      return 0.0;
    }

    // Check neighbors for horizon pixels
    float horizonCount = 0.0;

    // Sample in a small radius to get smooth glow
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      for (float y = -2.0; y <= 2.0; y += 1.0) {
        if (x == 0.0 && y == 0.0) continue;
        vec2 sampleUv = vUv + vec2(x, y) * texelSize;
        if (isHorizonPixel(sampleUv)) {
          // Weight by distance (closer = stronger)
          float dist = length(vec2(x, y));
          horizonCount += 1.0 / (dist + 0.5);
        }
      }
    }

    // Normalize and create smooth falloff
    return smoothstep(0.0, 3.0, horizonCount);
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

    vec3 finalColor;
    float finalAlpha;

    if (isAtFarPlane(objDepth) && objColor.a < 0.01) {
      // No object at this pixel (far depth + zero alpha) - show environment
      finalColor = envColor.rgb;
      finalAlpha = envColor.a;
    } else {
      // Object exists - blend based on alpha
      // The main object is rendered with forceOpaque=true, so objColor.rgb is NOT pre-multiplied.
      // objColor.a contains the material's opacity (uOpacity from shader).
      // Use standard straight alpha compositing: result = obj.rgb * obj.a + env.rgb * (1 - obj.a)
      finalColor = objColor.rgb * objColor.a + envColor.rgb * (1.0 - objColor.a);
      finalAlpha = max(envColor.a, objColor.a);
    }

    // === PHOTON SHELL (Screen-space edge glow) ===
    // Detect the visual boundary of the event horizon - this naturally
    // follows the lensing-deformed shape because it's based on actual
    // rendered pixels (dark + far depth + opaque), not geometric calculations.
    if (uShellEnabled && uShellGlowStrength > 0.0) {
      float edge = detectHorizonEdge();
      vec3 shellGlow = uShellGlowColor * edge * uShellGlowStrength;
      finalColor += shellGlow;
    }

    fragColor = vec4(finalColor, finalAlpha);
  }
`
