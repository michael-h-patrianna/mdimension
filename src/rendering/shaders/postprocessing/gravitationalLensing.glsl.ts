/**
 * Gravitational Lensing Shader
 *
 * Applies gravitational lensing distortion to the environment layer only.
 * The gravity well is assumed to be at the world origin (0,0,0).
 * This effect is independent of the black hole's internal ray-marched lensing.
 *
 * @module rendering/shaders/postprocessing/gravitationalLensing
 */

export const gravitationalLensingVertexShader = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const gravitationalLensingFragmentShader = /* glsl */ `
  precision highp float;

  in vec2 vUv;
  layout(location = 0) out vec4 fragColor;

  uniform sampler2D tEnvironment;
  uniform vec2 uGravityCenter;      // Gravity well center in UV space (projected from 0,0,0)
  uniform float uStrength;          // Gravity strength (0.1-10)
  uniform float uDistortionScale;   // Distortion scale (0.1-5)
  uniform float uFalloff;           // Distance falloff exponent (0.5-4)
  uniform float uChromaticAberration; // Chromatic aberration amount (0-1)

  /**
   * Compute radial distortion magnitude based on distance from gravity center.
   * Uses gravitational lensing formula: deflection = strength / r^falloff
   */
  float lensingMagnitude(float r) {
    float safeR = max(r, 0.001);
    float strength = uStrength * uDistortionScale * 0.02;
    float deflection = strength / pow(safeR, uFalloff);
    return min(deflection, 0.5);
  }

  /**
   * Compute displacement vector for a UV coordinate toward the gravity center.
   */
  vec2 computeLensingDisplacement(vec2 uv, vec2 center) {
    vec2 toCenter = center - uv;
    float r = length(toCenter);
    if (r < 0.001) {
      return vec2(0.0);
    }
    vec2 dir = normalize(toCenter);
    float mag = lensingMagnitude(r);
    return dir * mag;
  }

  /**
   * Apply chromatic aberration to lensing by sampling RGB at different offsets.
   */
  vec3 applyLensingChromatic(vec2 uv, vec2 displacement) {
    float rScale = 1.0 - uChromaticAberration * 0.02;
    float gScale = 1.0;
    float bScale = 1.0 + uChromaticAberration * 0.02;

    float r = texture(tEnvironment, uv + displacement * rScale).r;
    float g = texture(tEnvironment, uv + displacement * gScale).g;
    float b = texture(tEnvironment, uv + displacement * bScale).b;

    return vec3(r, g, b);
  }

  /**
   * Compute Einstein ring brightness boost near the photon sphere.
   */
  float einsteinRingBoost(float r, float ringRadius) {
    float ringWidth = ringRadius * 0.3;
    float diff = abs(r - ringRadius);
    float safeWidth = max(ringWidth, 0.001);
    float falloff = exp(-diff * diff / (safeWidth * safeWidth * 2.0));
    return 1.0 + falloff * 0.3;
  }

  void main() {
    vec2 displacement = computeLensingDisplacement(vUv, uGravityCenter);
    vec2 distortedUV = vUv + displacement;

    // Clamp to valid UV range
    distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));

    vec3 color;

    if (uChromaticAberration > 0.01) {
      color = applyLensingChromatic(vUv, displacement);
    } else {
      color = texture(tEnvironment, distortedUV).rgb;
    }

    // Apply subtle Einstein ring boost
    float r = length(vUv - uGravityCenter);
    float ringRadius = 0.15 * uStrength * 0.1; // Dynamic ring radius based on strength
    float boost = einsteinRingBoost(r, ringRadius);
    color *= boost;

    // Preserve alpha from original texture
    float alpha = texture(tEnvironment, vUv).a;
    fragColor = vec4(color, alpha);
  }
`
