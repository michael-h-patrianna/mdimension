/**
 * Screen-Space Lensing Shader
 *
 * Hybrid lensing shader that uses screen-space distortion for nearby objects
 * and sky cubemap sampling for distant background.
 *
 * @module rendering/shaders/postprocessing/screenSpaceLensing
 */

export const screenSpaceLensingVertexShader = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const screenSpaceLensingFragmentShader = /* glsl */ `
  precision highp float;

  in vec2 vUv;
  layout(location = 0) out vec4 fragColor;

  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform samplerCube tSkyCubemap;
  uniform vec2 uBlackHoleCenter;
  uniform float uHorizonRadius;
  uniform float uIntensity;
  uniform float uMass;
  uniform float uDistortionScale;
  uniform float uFalloff;
  uniform float uChromaticAberration;
  uniform float uNear;
  uniform float uFar;
  uniform bool uDepthAvailable;
  uniform bool uHybridSkyEnabled;
  uniform bool uSkyCubemapAvailable;
  uniform mat4 uInverseViewProjection;
  uniform vec3 uCameraPosition;
  uniform vec2 uResolution;

  /**
   * Compute radial distortion magnitude based on distance from center.
   * Uses gravitational lensing formula: deflection = strength / r^falloff
   *
   * The falloff exponent controls how lensing intensity changes with distance:
   * - Higher falloff (2.0-4.0): Effect concentrated near center, drops rapidly
   * - Lower falloff (0.5-1.0): Effect extends further from center, more gradual
   *
   * Note: deflection always increases as r decreases (toward center).
   * The exponent only affects the RATE of change, not the direction.
   * Valid range is [0.5, 4.0] with default 1.5.
   */
  float lensingMagnitude(float r) {
    float safeR = max(r, 0.001);
    float strength = uIntensity * uMass * uDistortionScale * 0.02;
    float deflection = strength / pow(safeR, uFalloff);
    return min(deflection, 0.5);
  }

  /**
   * Compute displacement vector for a UV coordinate.
   */
  vec2 computeLensingDisplacement(vec2 uv, vec2 center) {
    vec2 toCenter = center - uv;
    float r = length(toCenter);
    if (r < 0.01) {
      return vec2(0.0);
    }
    vec2 dir = normalize(toCenter);
    float mag = lensingMagnitude(r);
    return dir * mag;
  }

  /**
   * Reconstruct world ray direction from screen UV.
   */
  vec3 getWorldRayDirection(vec2 uv) {
    vec2 ndc = uv * 2.0 - 1.0;
    vec4 farClip = vec4(ndc, 1.0, 1.0);
    vec4 worldPos = uInverseViewProjection * farClip;
    worldPos /= worldPos.w;
    return normalize(worldPos.xyz - uCameraPosition);
  }

  /**
   * Bend a 3D ray direction toward black hole center.
   */
  vec3 bendRay3D(vec3 rayDir, vec2 center2D) {
    vec2 centerNDC = center2D * 2.0 - 1.0;
    vec4 centerClip = vec4(centerNDC, 0.0, 1.0);
    vec4 centerWorld = uInverseViewProjection * centerClip;
    centerWorld /= centerWorld.w;
    vec3 centerDir = normalize(centerWorld.xyz - uCameraPosition);

    float cosAngle = dot(rayDir, centerDir);
    float angle = acos(clamp(cosAngle, -1.0, 1.0));

    float strength = uIntensity * uMass * uDistortionScale * 0.02;
    float safeAngle = max(angle, 0.001);
    float deflection = strength * 10.0 / pow(safeAngle * 10.0, uFalloff);
    deflection = min(deflection, 0.5);

    vec3 bentDir = mix(rayDir, centerDir, deflection);
    return normalize(bentDir);
  }

  /**
   * Sample sky cubemap with chromatic aberration.
   */
  vec3 sampleSkyChromatic(vec3 bentDir, vec3 baseDir) {
    float rScale = 1.0 - uChromaticAberration * 0.1;
    float gScale = 1.0;
    float bScale = 1.0 + uChromaticAberration * 0.1;

    vec3 rDir = normalize(mix(baseDir, bentDir, rScale));
    vec3 gDir = normalize(mix(baseDir, bentDir, gScale));
    vec3 bDir = normalize(mix(baseDir, bentDir, bScale));

    float r = texture(tSkyCubemap, rDir).r;
    float g = texture(tSkyCubemap, gDir).g;
    float b = texture(tSkyCubemap, bDir).b;

    return vec3(r, g, b);
  }

  /**
   * Apply chromatic aberration to lensing.
   */
  vec3 applyLensingChromatic(vec2 uv, vec2 displacement) {
    float rScale = 1.0 - uChromaticAberration * 0.02;
    float gScale = 1.0;
    float bScale = 1.0 + uChromaticAberration * 0.02;

    float r = texture(tColor, uv + displacement * rScale).r;
    float g = texture(tColor, uv + displacement * gScale).g;
    float b = texture(tColor, uv + displacement * bScale).b;

    return vec3(r, g, b);
  }

  /**
   * Compute Einstein ring brightness boost.
   */
  float einsteinRingBoost(float r, float ringRadius, float ringWidth) {
    float diff = abs(r - ringRadius);
    float falloff = exp(-diff * diff / (ringWidth * ringWidth * 2.0));
    return 1.0 + falloff * 0.5;
  }

  /**
   * Linearize depth from depth buffer.
   */
  float linearizeDepth(float depth, float near, float far) {
    float z = depth * 2.0 - 1.0;
    return (2.0 * near * far) / (far + near - z * (far - near));
  }

  void main() {
    vec2 displacement = computeLensingDisplacement(vUv, uBlackHoleCenter);

    float r = length(vUv - uBlackHoleCenter);
    if (r < uHorizonRadius) {
      fragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec2 distortedUV = vUv + displacement;
    distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));

    float depth = 1.0;
    float linearDepth = uFar;
    bool isSky = true;

    if (uDepthAvailable) {
      depth = texture(tDepth, vUv).r;
      linearDepth = linearizeDepth(depth, uNear, uFar);
      isSky = depth > 0.99;
    }

    float depthFactor = uDepthAvailable
      ? smoothstep(1.0, 10.0, linearDepth)
      : 1.0;

    vec3 color;

    if (uHybridSkyEnabled && uSkyCubemapAvailable && isSky) {
      vec3 baseDir = getWorldRayDirection(vUv);
      vec3 bentDir = bendRay3D(baseDir, uBlackHoleCenter);

      if (uChromaticAberration > 0.01) {
        color = sampleSkyChromatic(bentDir, baseDir);
      } else {
        color = texture(tSkyCubemap, bentDir).rgb;
      }
    } else {
      vec2 finalUV = mix(vUv, distortedUV, depthFactor);

      if (uChromaticAberration > 0.01) {
        vec2 finalDisplacement = displacement * depthFactor;
        color = applyLensingChromatic(vUv, finalDisplacement);
      } else {
        color = texture(tColor, finalUV).rgb;
      }
    }

    float ringRadius = uHorizonRadius * 1.5;
    float boost = einsteinRingBoost(r, ringRadius, uHorizonRadius * 0.3);
    color *= boost;

    fragColor = vec4(color, 1.0);
  }
`
