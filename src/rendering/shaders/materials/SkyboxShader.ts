/**
 * Skybox Shader Material
 *
 * Custom shader material for rendering environment skyboxes with
 * configurable visual effects, animations, and procedural generation.
 *
 * Features:
 * - Classic: Cube texture sampling with effects
 * - Procedural Modes: Aurora, Nebula, Void, Crystalline, Horizon, Ocean, Twilight, Starfield
 * - "Atmospheric Resonance" system (10 delight features)
 * - Cosine Palette Integration
 * - Smooth crossfade transitions
 */

import { GLSL_COSINE_PALETTE } from '@/rendering/shaders/palette/cosine.glsl'
import * as THREE from 'three'

/**
 * Skybox mode constants matching shader uniforms
 * 0=Classic, 1=Aurora, 2=Nebula, 3=Void, 4=Crystalline, 5=Horizon, 6=Ocean, 7=Twilight, 8=Starfield
 */
export const SKYBOX_MODE_CLASSIC = 0
export const SKYBOX_MODE_AURORA = 1
export const SKYBOX_MODE_NEBULA = 2
export const SKYBOX_MODE_VOID = 3
export const SKYBOX_MODE_CRYSTALLINE = 4
export const SKYBOX_MODE_HORIZON = 5
export const SKYBOX_MODE_OCEAN = 6
export const SKYBOX_MODE_TWILIGHT = 7
export const SKYBOX_MODE_STARFIELD = 8

/**
 * Uniforms for the skybox shader material
 */
export interface SkyboxShaderUniforms {
  // Core
  uTex: THREE.CubeTexture | null
  uRotation: THREE.Matrix3
  uMode: number // 0=Classic, 1-8=Procedural modes
  uTime: number

  // Basic Appearance
  uBlur: number
  uIntensity: number
  uHue: number
  uSaturation: number

  // Procedural Settings
  uScale: number
  uComplexity: number
  uTimeScale: number
  uEvolution: number

  // Palette (Cosine Gradient)
  uColor1: THREE.Vector3
  uColor2: THREE.Vector3
  uPalA: THREE.Vector3
  uPalB: THREE.Vector3
  uPalC: THREE.Vector3
  uPalD: THREE.Vector3
  uUsePalette: number // 0 or 1

  // Delight Features
  uDistortion: number
  uAberration: number
  uVignette: number
  uGrain: number
  uAtmosphere: number // Horizon
  uTurbulence: number
  uDualTone: number
  uSunIntensity: number
  uSunPosition: THREE.Vector3

  // Starfield Settings
  uStarDensity: number // 0-1, controls star count
  uStarBrightness: number // 0-2, overall brightness
  uStarSize: number // 0-1, base star size
  uStarTwinkle: number // 0-1, scintillation amount
  uStarGlow: number // 0-1, halo intensity
  uStarColorVariation: number // 0-1, spectral color range

  // Parallax Depth
  uParallaxEnabled: number // 0 or 1
  uParallaxStrength: number // 0-1, layer separation

  // Aurora-specific Settings
  uAuroraCurtainHeight: number // 0-1, vertical coverage
  uAuroraWaveFrequency: number // 0.5-3, wave density

  // Horizon-specific Settings
  uHorizonGradientContrast: number // 0-1, gradient band sharpness
  uHorizonSpotlightFocus: number // 0-1, central spotlight intensity

  [key: string]: THREE.CubeTexture | THREE.Matrix3 | THREE.Vector3 | THREE.Vector2 | number | null
}

/**
 * Default uniform values for the skybox shader.
 */
export function createSkyboxShaderDefaults(): SkyboxShaderUniforms {
  return {
    uTex: null,
    uRotation: new THREE.Matrix3(),
    uMode: 0,
    uTime: 0,

    uBlur: 0,
    uIntensity: 1,
    uHue: 0,
    uSaturation: 1,

    uScale: 1.0,
    uComplexity: 0.5,
    uTimeScale: 0.2,
    uEvolution: 0.0,

    uColor1: new THREE.Color(0x0000ff) as any,
    uColor2: new THREE.Color(0xff00ff) as any,
    uPalA: new THREE.Vector3(0.5, 0.5, 0.5),
    uPalB: new THREE.Vector3(0.5, 0.5, 0.5),
    uPalC: new THREE.Vector3(1.0, 1.0, 1.0),
    uPalD: new THREE.Vector3(0.0, 0.33, 0.67),
    uUsePalette: 0,

    uDistortion: 0,
    uAberration: 0,
    uVignette: 0.15,
    uGrain: 0.02,
    uAtmosphere: 0.0,
    uTurbulence: 0.0,
    uDualTone: 0.5,
    uSunIntensity: 0.0,
    uSunPosition: new THREE.Vector3(10, 10, 10),

    // Starfield defaults
    uStarDensity: 0.5,
    uStarBrightness: 1.0,
    uStarSize: 0.5,
    uStarTwinkle: 0.3,
    uStarGlow: 0.5,
    uStarColorVariation: 0.5,

    // Parallax defaults
    uParallaxEnabled: 0,
    uParallaxStrength: 0.5,

    // Aurora defaults
    uAuroraCurtainHeight: 0.5,
    uAuroraWaveFrequency: 1.0,

    // Horizon defaults
    uHorizonGradientContrast: 0.5,
    uHorizonSpotlightFocus: 0.5,
  }
}

/**
 * GLSL version for WebGL2 - Three.js will handle the #version directive
 */
export const skyboxGlslVersion = THREE.GLSL3

/**
 * Vertex shader for skybox rendering
 */
export const skyboxVertexShader = /* glsl */ `
  precision highp float;

  uniform mat3 uRotation;

  out vec3 vWorldDirection;
  out vec2 vScreenUV;
  out vec3 vWorldPosition;

  void main() {
    // Standard Skybox Rotation
    vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
    vec3 worldPos = worldPos4.xyz;
    vWorldPosition = worldPos;

    vWorldDirection = uRotation * normalize(worldPos);

    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clipPos;

    // Force to background (z = w)
    gl_Position.z = gl_Position.w;

    // Screen UV for post effects
    vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;
  }
`

/**
 * Fragment shader for skybox rendering
 * Includes:
 * - Classic Mode
 * - Procedural Modes (Aurora, Nebula, Void)
 * - Cosine Palette Integration
 * - 10 Delight Features
 */
export const skyboxFragmentShader = /* glsl */ `
  precision highp float;

  // --- Uniforms ---
  uniform samplerCube uTex;
  uniform float uMode; // 0=Classic, 1=Aurora, 2=Nebula, 3=Void
  uniform float uTime;

  // Basic
  uniform float uBlur;
  uniform float uIntensity;
  uniform float uHue;
  uniform float uSaturation;

  // Procedural
  uniform float uScale;
  uniform float uComplexity;
  uniform float uTimeScale;
  uniform float uEvolution;

  // Colors
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uPalA;
  uniform vec3 uPalB;
  uniform vec3 uPalC;
  uniform vec3 uPalD;
  uniform float uUsePalette;

  // Delight
  uniform float uDistortion;
  uniform float uAberration;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uAtmosphere; // Horizon
  uniform float uTurbulence;
  uniform float uDualTone;
  uniform float uSunIntensity;
  uniform vec3 uSunPosition;

  // Starfield
  uniform float uStarDensity;
  uniform float uStarBrightness;
  uniform float uStarSize;
  uniform float uStarTwinkle;
  uniform float uStarGlow;
  uniform float uStarColorVariation;

  // Parallax
  uniform float uParallaxEnabled;
  uniform float uParallaxStrength;

  // Aurora-specific
  uniform float uAuroraCurtainHeight;
  uniform float uAuroraWaveFrequency;

  // Horizon-specific
  uniform float uHorizonGradientContrast;
  uniform float uHorizonSpotlightFocus;

  // --- Varyings ---
  in vec3 vWorldDirection;
  in vec2 vScreenUV;
  in vec3 vWorldPosition;

  // --- Output ---
  layout(location = 0) out vec4 fragColor;

  // --- Constants ---
  #define PI 3.14159265359
  #define TAU 6.28318530718
  #define MODE_CLASSIC 0.0
  #define MODE_AURORA 1.0
  #define MODE_NEBULA 2.0
  #define MODE_VOID 3.0
  #define MODE_CRYSTALLINE 4.0
  #define MODE_HORIZON 5.0
  #define MODE_OCEAN 6.0
  #define MODE_TWILIGHT 7.0
  #define MODE_STARFIELD 8.0

  // --- External Functions (Injected) ---
  ${GLSL_COSINE_PALETTE}

  // --- Utility Functions ---

  vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // High quality hash
  float hash(vec3 p) {
    p  = fract( p*0.3183099+.1 );
    p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
  }

  float noise( in vec3 x ) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix( hash(i+vec3(0,0,0)),
                        hash(i+vec3(1,0,0)),f.x),
                   mix( hash(i+vec3(0,1,0)),
                        hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash(i+vec3(0,0,1)),
                        hash(i+vec3(1,0,1)),f.x),
                   mix( hash(i+vec3(0,1,1)),
                        hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }

  // FBM (Fractal Brownian Motion)
  float fbm(vec3 x, int octaves) {
      float v = 0.0;
      float a = 0.5;
      vec3 shift = vec3(100.0);
      for (int i = 0; i < 5; ++i) { // Fixed loop size for unrolling
          if(i >= octaves) break;
          v += a * noise(x);
          x = x * 2.0 + shift;
          a *= 0.5;
      }
      return v;
  }

  // 3D Rotation Matrix
  mat3 rotateY(float theta) {
      float c = cos(theta);
      float s = sin(theta);
      return mat3(
          vec3(c, 0, s),
          vec3(0, 1, 0),
          vec3(-s, 0, c)
      );
  }

  // --- Procedural Modes ---

  // Mode 1: Aurora (Flowing Vertical Curtains)
  // Realistic aurora borealis with flowing ribbon-like curtains
  vec3 getAurora(vec3 dir, float time) {
      // Spherical coordinates for proper curtain mapping
      float theta = atan(dir.x, dir.z); // Horizontal angle
      float phi = asin(clamp(dir.y, -1.0, 1.0)); // Vertical angle

      // Aurora vertical coverage controlled by uAuroraCurtainHeight
      // 0 = low aurora near horizon, 1 = aurora reaches zenith
      float heightLow = mix(-0.2, 0.1, uAuroraCurtainHeight);
      float heightHigh = mix(0.3, 0.8, uAuroraCurtainHeight);
      float auroraHeight = smoothstep(heightLow, heightHigh, dir.y);

      // Wave frequency multiplier for curtain density
      float waveFreq = uAuroraWaveFrequency;

      // Multiple curtain layers with different speeds and frequencies
      float curtain1 = 0.0;
      float curtain2 = 0.0;
      float curtain3 = 0.0;

      // Layer 1: Primary slow-moving curtains
      // Use only integer multipliers of theta for seamless wrapping
      float h1 = theta * 3.0 + uEvolution * TAU;
      float wave1 = sin(h1 + time * 0.3) * cos(theta * 2.0 + time * 0.2);
      float fold1 = sin(phi * 8.0 * waveFreq + wave1 * 2.0 * uTurbulence + time * 0.5);
      curtain1 = smoothstep(0.0, 0.8, fold1) * smoothstep(1.0, 0.3, fold1);

      // Layer 2: Secondary faster ribbons
      float h2 = theta * 5.0 + 1.5 + uEvolution * TAU;
      float wave2 = sin(h2 + time * 0.5) * cos(theta * 2.0 - time * 0.3);
      float fold2 = sin(phi * 12.0 * waveFreq + wave2 * 3.0 * uTurbulence + time * 0.7);
      curtain2 = smoothstep(0.1, 0.7, fold2) * smoothstep(0.9, 0.4, fold2);

      // Layer 3: Fine detail shimmer
      float h3 = theta * 8.0 + 3.0;
      float fold3 = sin(phi * 20.0 * waveFreq + sin(h3 + time) * uTurbulence + time * 1.2);
      curtain3 = smoothstep(0.3, 0.6, fold3) * smoothstep(0.8, 0.5, fold3) * 0.5;

      // Layer 4: Slow pulsing glow (subtle brightness variation)
      float pulse1 = sin(time * 0.15 + theta * 2.0) * 0.5 + 0.5;
      float pulse2 = sin(time * 0.23 + theta * 3.0 + 1.0) * 0.5 + 0.5;
      float pulseGlow = mix(0.85, 1.15, pulse1 * pulse2);

      // Layer 5: Horizontal drift waves (aurora bands moving laterally)
      float drift = sin(phi * 6.0 * waveFreq + time * 0.4) * sin(theta * 4.0 + time * 0.2);
      float driftLayer = smoothstep(0.2, 0.5, drift) * smoothstep(0.7, 0.4, drift) * 0.3;

      // Combine curtain layers with vertical fade
      float verticalFade = pow(clamp(dir.y + 0.2, 0.0, 1.0), 0.5);
      float bottomFade = smoothstep(-0.3, 0.2, dir.y);
      float intensity = (curtain1 * 0.45 + curtain2 * 0.30 + curtain3 * 0.12 + driftLayer * 0.13) * verticalFade * bottomFade;

      // Apply pulsing glow
      intensity *= pulseGlow;

      // Scale by user settings
      intensity *= uScale;

      // Add subtle shimmer at edges
      // Use direction vector directly for seamless noise (no theta discontinuity)
      float shimmer = noise(dir * 10.0 + vec3(0.0, 0.0, time * 2.0)) * 0.2;
      intensity += shimmer * curtain1 * uComplexity;

      // Normalize for color mapping
      float v = clamp(intensity, 0.0, 1.0);

      // Dark sky background
      vec3 nightSky = vec3(0.02, 0.02, 0.05);

      // Color Mapping with animated color drift
      vec3 auroraColor;

      // Slow color drift over time (Layer 6: color shifting)
      float colorDrift = sin(time * 0.08) * 0.15;

      if (uUsePalette > 0.5) {
          // Use Cosine Palette for aurora glow with color drift
          float paletteT = v * 0.7 + 0.15 + colorDrift;
          auroraColor = cosinePalette(paletteT, uPalA, uPalB, uPalC, uPalD);

          // Add vertical color variation (greens at bottom, purples/reds at top)
          float heightColor = smoothstep(0.0, 0.6, dir.y);
          vec3 topColor = cosinePalette(0.8 + colorDrift * 0.5, uPalA, uPalB, uPalC, uPalD);
          auroraColor = mix(auroraColor, topColor, heightColor * 0.4);
      } else {
          // Gradient from color1 (base) to color2 (tips) with drift
          float gradientT = smoothstep(0.0, 0.5, dir.y) + colorDrift;
          auroraColor = mix(uColor1, uColor2, clamp(gradientT, 0.0, 1.0));
      }

      // Final composite: dark sky + aurora glow
      vec3 col = mix(nightSky, auroraColor, intensity * auroraHeight * 1.5);

      return col;
  }

  // Mode 2: Nebula (Multi-Layer Volumetric Clouds)
  // Deep space nebula with emission regions, dust lanes, and embedded stars
  vec3 getNebula(vec3 dir, float time) {
      vec3 p = dir * uScale * 2.0;

      // Slow drift animation
      p.x -= time * 0.05;
      p.z += time * 0.03;

      // Evolution offset
      p += uEvolution * 3.0;

      // --- Layer 1: Deep background (large scale structure) ---
      vec3 bgCoord = p * 0.5;
      bgCoord.x += fbm(p * 0.3 + time * 0.02, 2) * uTurbulence * 0.5;
      float bgDensity = fbm(bgCoord, 3);
      bgDensity = smoothstep(0.3, 0.7, bgDensity);

      // --- Layer 2: Mid-ground emission clouds ---
      vec3 midCoord = p * 1.0;
      midCoord += fbm(p + vec3(time * 0.1, 0.0, 0.0), 2) * uTurbulence;
      int octaves = int(mix(2.0, 5.0, uComplexity));
      float midDensity = fbm(midCoord, octaves);
      midDensity = smoothstep(0.25, 0.75, midDensity);

      // --- Layer 3: Fine detail/dust lanes (absorption) ---
      vec3 dustCoord = p * 2.5 + vec3(0.0, time * 0.02, 0.0);
      float dustDensity = fbm(dustCoord, 3);
      dustDensity = smoothstep(0.4, 0.6, dustDensity);

      // --- Layer 4: Bright emission knots ---
      vec3 knotCoord = p * 3.0;
      float knotNoise = noise(knotCoord + time * 0.05);
      float knots = pow(smoothstep(0.6, 0.9, knotNoise), 3.0) * uComplexity;

      // Combine density layers
      float totalDensity = bgDensity * 0.3 + midDensity * 0.5 + knots * 0.3;
      float absorption = dustDensity * 0.4; // Dark lanes reduce brightness

      // Coloring with depth variation
      vec3 col;
      if (uUsePalette > 0.5) {
          // Background: dark palette color
          vec3 deepColor = cosinePalette(0.1, uPalA, uPalB, uPalC, uPalD) * 0.1;
          // Mid emission: primary palette range
          vec3 emissionColor = cosinePalette(midDensity * 0.6 + 0.2, uPalA, uPalB, uPalC, uPalD);
          // Bright knots: palette highlight
          vec3 knotColor = cosinePalette(0.85, uPalA, uPalB, uPalC, uPalD) * 1.5;
          // Dust: darker tint
          vec3 dustColor = cosinePalette(0.3, uPalA, uPalB, uPalC, uPalD) * 0.3;

          // Composite layers
          col = deepColor;
          col = mix(col, emissionColor, midDensity * 0.8);
          col = mix(col, dustColor, absorption * (1.0 - midDensity));
          col += knotColor * knots;

          // Darken void regions
          col *= smoothstep(0.0, 0.4, totalDensity) * 0.7 + 0.3;
      } else {
          // Non-palette mode with user colors
          vec3 deepColor = uColor1 * 0.1;
          vec3 emissionColor = mix(uColor1, uColor2, midDensity);
          vec3 knotColor = uColor2 * 1.5;

          col = deepColor;
          col = mix(col, emissionColor, midDensity * 0.8);
          col = mix(col, uColor1 * 0.2, absorption * (1.0 - midDensity));
          col += knotColor * knots;

          col *= smoothstep(0.0, 0.4, totalDensity) * 0.7 + 0.3;
      }

      return col;
  }

  // Mode 3: Void (Meditative Radial Gradient)
  // Subtle, contemplative environment with soft radial glow
  vec3 getVoid(vec3 dir, float time) {
      // Spherical mapping for smooth gradients
      float phi = asin(clamp(dir.y, -1.0, 1.0)); // -PI/2 to PI/2
      float theta = atan(dir.x, dir.z);

      // Create a soft radial gradient from a focus point
      vec3 focusDir = normalize(uSunPosition);
      float focusDist = 1.0 - max(0.0, dot(dir, focusDir));

      // Multiple soft gradient layers for depth
      float layer1 = pow(1.0 - focusDist, 2.0); // Bright center
      float layer2 = pow(1.0 - focusDist * 0.7, 3.0); // Soft outer glow
      float layer3 = smoothstep(1.0, 0.0, focusDist * 1.5); // Wide ambient

      // Subtle breathing animation
      float breathe = sin(time * 0.3) * 0.05 + 1.0;
      layer1 *= breathe;

      // Very subtle noise for organic feel (not harsh)
      float subtleNoise = noise(dir * 3.0 + time * 0.1) * 0.03 * uComplexity;

      // Combine layers
      float gradient = layer1 * 0.4 + layer2 * 0.3 + layer3 * 0.3 + subtleNoise;
      gradient *= uScale;

      // Color application
      vec3 col;
      if (uUsePalette > 0.5) {
          // Deep background from palette dark end
          vec3 deepColor = cosinePalette(0.0, uPalA, uPalB, uPalC, uPalD) * 0.15;
          // Glow color from palette bright end
          vec3 glowColor = cosinePalette(0.7, uPalA, uPalB, uPalC, uPalD);
          // Mid-tone for transition
          vec3 midColor = cosinePalette(0.35, uPalA, uPalB, uPalC, uPalD) * 0.5;

          // Smooth 3-color gradient
          col = mix(deepColor, midColor, smoothstep(0.0, 0.3, gradient));
          col = mix(col, glowColor, smoothstep(0.2, 0.8, gradient) * uSunIntensity + layer1 * 0.3);
      } else {
          // Use user colors: color1 = deep, color2 = glow
          vec3 deepColor = uColor1 * 0.15;
          vec3 midColor = mix(uColor1, uColor2, 0.3) * 0.5;
          vec3 glowColor = uColor2;

          col = mix(deepColor, midColor, smoothstep(0.0, 0.3, gradient));
          col = mix(col, glowColor, smoothstep(0.2, 0.8, gradient) * uSunIntensity + layer1 * 0.3);
      }

      // Subtle vignette toward edges
      float edgeFade = 1.0 - pow(abs(dir.y), 4.0) * 0.3;
      col *= edgeFade;

      return col;
  }

  // ============================================================================
  // NEW PROCEDURAL MODES (Premium $599 Quality)
  // ============================================================================

  // Voronoi distance function for Crystalline mode
  vec2 voronoi(vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);

      float minDist = 1.0;
      float secondDist = 1.0;

      for (int k = -1; k <= 1; k++) {
          for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                  vec3 b = vec3(float(i), float(j), float(k));
                  vec3 r = b - f + hash(p + b);
                  float d = dot(r, r);

                  if (d < minDist) {
                      secondDist = minDist;
                      minDist = d;
                  } else if (d < secondDist) {
                      secondDist = d;
                  }
              }
          }
      }

      return vec2(sqrt(minDist), sqrt(secondDist));
  }

  // Mode 4: Crystalline - Geometric Voronoi patterns with iridescent coloring
  // Creates an elegant, abstract mathematical feel
  vec3 getCrystalline(vec3 dir, float time) {
      vec3 p = dir * uScale * 3.0;

      // Very slow rotation of the entire pattern
      float rotAngle = time * 0.02;
      float c = cos(rotAngle);
      float s = sin(rotAngle);
      p.xz = mat2(c, -s, s, c) * p.xz;

      // Add evolution offset
      p += uEvolution * 2.0;

      // Multi-layer voronoi for depth
      vec2 v1 = voronoi(p * 1.0);
      vec2 v2 = voronoi(p * 2.0 + 100.0);

      // Edge detection - creates the crystal facet lines
      float edge1 = smoothstep(0.02, 0.08, v1.y - v1.x);
      float edge2 = smoothstep(0.02, 0.06, v2.y - v2.x);

      // Cell value for color variation
      float cellValue = v1.x * 0.6 + v2.x * 0.4;

      // Iridescent color based on viewing angle
      float iridescence = dot(dir, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
      iridescence += sin(cellValue * TAU + time * 0.1) * 0.2;

      vec3 col;
      if (uUsePalette > 0.5) {
          col = cosinePalette(iridescence, uPalA, uPalB, uPalC, uPalD);
          // Add subtle facet highlights
          col = mix(col * 0.3, col, edge1 * edge2);
          // Shimmer on edges using palette highlight color
          vec3 shimmerColor = cosinePalette(0.9, uPalA, uPalB, uPalC, uPalD);
          col += shimmerColor * 0.15 * (1.0 - edge1) * pow(iridescence, 2.0);
      } else {
          col = mix(uColor1, uColor2, iridescence);
          col = mix(col * 0.2, col, edge1 * edge2);
          // Shimmer using secondary color
          col += uColor2 * 0.15 * (1.0 - edge1) * pow(iridescence, 2.0);
      }

      return col;
  }

  // Mode 5: Horizon Gradient - Clean Studio Environment
  // Professional presentation backdrop with smooth multi-band gradient
  vec3 getHorizonGradient(vec3 dir, float time) {
      // Vertical position: -1 (bottom) to 1 (top)
      float y = dir.y;

      // Gradient contrast affects zone sharpness
      float contrastMod = 0.5 + uHorizonGradientContrast * 1.0; // 0.5-1.5

      // Create distinct gradient zones for studio look
      // Zone 1: Floor reflection zone (bottom third)
      // Zone 2: Horizon band (middle - the "infinity curve")
      // Zone 3: Upper backdrop (top half)

      float floorZone = smoothstep(-1.0, -0.2 * contrastMod, y);
      float horizonZone = 1.0 - abs(y) * (1.0 + contrastMod * 0.5);
      horizonZone = pow(max(0.0, horizonZone), 1.5 + contrastMod);
      float upperZone = smoothstep(-0.1 * contrastMod, 0.8 * contrastMod, y);

      // Subtle seamless gradient curve (no harsh transitions)
      float gradientPos = y * 0.5 + 0.5;
      gradientPos = pow(clamp(gradientPos, 0.0, 1.0), 0.8 + uComplexity * 0.4);

      // Very subtle horizontal sweep for depth (like studio lighting)
      float sweep = sin(dir.x * PI * 0.5) * 0.05;
      gradientPos += sweep * (1.0 - abs(y));

      // Animation Layer 1: Subtle slow breathing animation
      float breathe = sin(time * 0.2) * 0.02;
      gradientPos += breathe * horizonZone;

      // Animation Layer 2: Color temperature pulse (warm/cool shift)
      float tempPulse = sin(time * 0.12) * 0.08 + sin(time * 0.07) * 0.04;

      // Animation Layer 3: Light sweep across horizon
      float sweepAngle = mod(time * 0.15, TAU);
      float lightSweep = sin(atan(dir.x, dir.z) - sweepAngle);
      lightSweep = pow(max(0.0, lightSweep), 8.0) * 0.15 * horizonZone;

      // Animation Layer 4: Ambient brightness variation
      float ambientPulse = sin(time * 0.1 + dir.x * 0.5) * 0.03 + 1.0;

      vec3 col;
      if (uUsePalette > 0.5) {
          // 4-point gradient for smooth studio look
          // Apply temperature pulse to palette sampling
          vec3 floorColor = cosinePalette(0.1 + tempPulse * 0.1, uPalA, uPalB, uPalC, uPalD) * 0.6;
          vec3 horizonColor = cosinePalette(0.4 + tempPulse * 0.05, uPalA, uPalB, uPalC, uPalD);
          vec3 midColor = cosinePalette(0.6, uPalA, uPalB, uPalC, uPalD);
          vec3 topColor = cosinePalette(0.85 - tempPulse * 0.05, uPalA, uPalB, uPalC, uPalD);

          // Smooth 4-zone blend
          col = mix(floorColor, horizonColor, floorZone);
          col = mix(col, midColor, smoothstep(-0.1, 0.3, y));
          col = mix(col, topColor, upperZone);

          // Add subtle horizon glow (the "infinity" effect)
          col += horizonColor * horizonZone * 0.2 * uScale;

          // Add light sweep highlight
          vec3 sweepColor = cosinePalette(0.95, uPalA, uPalB, uPalC, uPalD);
          col += sweepColor * lightSweep;
      } else {
          // Two-color mode: color1 = floor/dark, color2 = top/light
          // Apply temperature modulation via interpolation shift
          float tempShift = tempPulse * 0.1;
          vec3 floorColor = uColor1 * (0.5 + tempShift);
          vec3 horizonColor = mix(uColor1, uColor2, 0.5 + tempShift);
          vec3 topColor = uColor2 * (1.0 - tempShift * 0.5);

          col = mix(floorColor, horizonColor, floorZone);
          col = mix(col, topColor, upperZone);
          col += horizonColor * horizonZone * 0.15 * uScale;

          // Add light sweep highlight
          col += mix(uColor1, uColor2, 0.8) * lightSweep;
      }

      // Apply ambient pulse
      col *= ambientPulse;

      // Premium film-like micro-texture (very subtle)
      float microTexture = noise(dir * 50.0) * 0.015 * uComplexity;
      col += microTexture;

      // Soft radial falloff from center (spotlight feel)
      // Controlled by uHorizonSpotlightFocus
      float spotlightStrength = 0.05 + uHorizonSpotlightFocus * 0.25; // 0.05-0.30
      float spotlight = 1.0 - length(vec2(dir.x, dir.z)) * spotlightStrength;
      float spotlightMin = 0.7 + (1.0 - uHorizonSpotlightFocus) * 0.25; // 0.7-0.95
      col *= max(spotlightMin, spotlight);

      return col;
  }

  // Mode 6: Deep Ocean - Underwater atmosphere with caustic patterns
  // Serene, calming, elegant
  vec3 getDeepOcean(vec3 dir, float time) {
      // Base gradient from deep to surface
      float depth = 1.0 - (dir.y * 0.5 + 0.5);
      depth = pow(depth, 0.7); // More gradual transition

      // Caustic pattern calculation
      vec3 p = dir * uScale * 4.0;
      p.y *= 0.5; // Stretch vertically

      // Multiple layers of caustics
      float caustic1 = 0.0;
      float caustic2 = 0.0;

      // First caustic layer
      vec3 c1 = p + vec3(time * 0.03, time * 0.02, 0.0);
      caustic1 = sin(c1.x * 2.0 + sin(c1.z * 3.0)) * sin(c1.z * 2.0 + sin(c1.x * 3.0));
      caustic1 = caustic1 * 0.5 + 0.5;
      caustic1 = pow(caustic1, 3.0);

      // Second caustic layer (different frequency)
      vec3 c2 = p * 1.5 + vec3(-time * 0.02, time * 0.015, time * 0.01);
      caustic2 = sin(c2.x * 3.0 + sin(c2.z * 2.0)) * sin(c2.z * 3.0 + sin(c2.x * 2.0));
      caustic2 = caustic2 * 0.5 + 0.5;
      caustic2 = pow(caustic2, 3.0);

      // Combine caustics
      float caustics = (caustic1 + caustic2) * 0.5;
      caustics *= (1.0 - depth * 0.5); // Stronger near surface
      caustics *= uComplexity;

      // Color
      vec3 col;
      if (uUsePalette > 0.5) {
          vec3 deepColor = cosinePalette(0.0, uPalA, uPalB, uPalC, uPalD) * 0.1;
          vec3 midColor = cosinePalette(0.5, uPalA, uPalB, uPalC, uPalD) * 0.5;
          vec3 surfaceColor = cosinePalette(1.0, uPalA, uPalB, uPalC, uPalD);

          col = mix(surfaceColor, midColor, depth);
          col = mix(col, deepColor, depth * depth);
          col += caustics * surfaceColor * 0.5;
      } else {
          // Use user colors: color1 = deep, color2 = surface
          vec3 deepColor = uColor1 * 0.1;
          vec3 midColor = mix(uColor1, uColor2, 0.4) * 0.5;
          vec3 surfaceColor = uColor2;

          col = mix(surfaceColor, midColor, depth);
          col = mix(col, deepColor, depth * depth);
          // Caustic highlight uses surface color instead of hardcoded blue
          col += caustics * surfaceColor * 0.4;
      }

      // Subtle light rays from above
      float rays = smoothstep(0.7, 1.0, dir.y);
      rays *= noise(vec3(dir.xz * 2.0, time * 0.1)) * 0.3;
      // Use surface color for light rays
      vec3 rayColor = (uUsePalette > 0.5)
          ? cosinePalette(0.9, uPalA, uPalB, uPalC, uPalD)
          : uColor2;
      col += rays * rayColor * (1.0 - depth) * 0.2;

      return col;
  }

  // Mode 7: Twilight - Sunset/sunrise gradient with atmospheric layers
  // Warm and cool tones that slowly evolve
  vec3 getTwilight(vec3 dir, float time) {
      // Vertical position
      float y = dir.y;

      // Time-based color temperature shift (very slow, continuous)
      float tempShift = sin(time * 0.02) * 0.5 + 0.5;

      // Horizontal position for sun placement
      float sunAngle = time * 0.01 + uEvolution;
      vec3 sunDir = normalize(vec3(cos(sunAngle), 0.1, sin(sunAngle)));
      float sunDist = 1.0 - max(0.0, dot(dir, sunDir));

      // Atmospheric scattering simulation (simplified)
      float scatter = pow(1.0 - abs(y), 2.0);

      // Create layered gradient
      float gradientY = y * 0.5 + 0.5;

      // Color layers
      vec3 col;
      if (uUsePalette > 0.5) {
          // Use palette with temperature variation
          float palettePos = gradientY + tempShift * 0.2 - 0.1;
          palettePos = clamp(palettePos, 0.0, 1.0);

          vec3 skyColor = cosinePalette(palettePos, uPalA, uPalB, uPalC, uPalD);
          vec3 horizonColor = cosinePalette(0.5 + tempShift * 0.3, uPalA, uPalB, uPalC, uPalD);

          col = mix(horizonColor, skyColor, pow(abs(y), 0.5));

          // Sun glow
          float sunGlow = pow(max(0.0, dot(dir, sunDir)), 4.0);
          vec3 sunColor = cosinePalette(tempShift, uPalA, uPalB, uPalC, uPalD) * 1.5;
          col = mix(col, sunColor, sunGlow * 0.5);
      } else {
          // Manual gradient using user colors
          vec3 topColor = mix(uColor1, uColor2, tempShift);
          vec3 horizonColor = mix(uColor2, uColor1, tempShift) * 1.2;
          vec3 bottomColor = uColor1 * 0.3;

          if (y > 0.0) {
              col = mix(horizonColor, topColor, pow(y, 0.7));
          } else {
              col = mix(horizonColor, bottomColor, pow(-y, 0.5));
          }

          // Sun glow using brighter blend of user colors
          float sunGlow = pow(max(0.0, dot(dir, sunDir)), 4.0);
          vec3 sunColor = mix(uColor2, uColor1, tempShift) * 1.5;
          col = mix(col, sunColor, sunGlow * 0.5);
      }

      // Subtle atmospheric layers (horizontal bands)
      float layers = sin(y * 20.0 + noise(dir * 3.0) * 2.0) * 0.02;
      col += layers * scatter;

      // Atmospheric dust/haze
      float haze = scatter * noise(dir * 5.0 + time * 0.01) * 0.1;
      col = mix(col, col * 1.2, haze);

      return col;
  }

  // Stellar Spectral Class Colors for Starfield
  // Maps temperature value (0-1) to realistic star colors
  // O/B (hot blue) -> A (white) -> F/G (yellow) -> K (orange) -> M (red)
  vec3 getSpectralColor(float temp, float variation) {
      // Reduce variation based on variation parameter
      float t = mix(0.5, temp, variation);

      vec3 starCol;
      if (t < 0.15) {
          // O/B class - Blue-white (hot)
          starCol = vec3(0.7, 0.8, 1.0);
      } else if (t < 0.35) {
          // A class - White
          starCol = vec3(0.95, 0.95, 1.0);
      } else if (t < 0.55) {
          // F class - Yellow-white
          starCol = vec3(1.0, 0.98, 0.9);
      } else if (t < 0.75) {
          // G class - Yellow (sun-like)
          starCol = vec3(1.0, 0.95, 0.8);
      } else if (t < 0.9) {
          // K class - Orange
          starCol = vec3(1.0, 0.8, 0.6);
      } else {
          // M class - Red (cool)
          starCol = vec3(1.0, 0.6, 0.5);
      }
      return starCol;
  }

  // Mode 8: Starfield - High-quality astronomical starfield
  // Features: magnitude classes, spectral colors, glow halos, natural twinkling
  vec3 getStarfield(vec3 dir, float time) {
      // === BACKGROUND ===
      // Deep space background with subtle color from palette
      vec3 bg;
      if (uUsePalette > 0.5) {
          bg = cosinePalette(0.0, uPalA, uPalB, uPalC, uPalD) * 0.02;
      } else {
          bg = uColor1 * 0.02;
      }
      bg = max(bg, vec3(0.005, 0.005, 0.015)); // Ensure deep space darkness

      // Subtle nebula dust clouds in background (controlled by complexity)
      float nebulaValue = fbm(dir * 1.5 + uEvolution * 2.0, 3);
      vec3 nebulaColor;
      if (uUsePalette > 0.5) {
          nebulaColor = cosinePalette(nebulaValue * 0.5 + 0.25, uPalA, uPalB, uPalC, uPalD);
      } else {
          nebulaColor = mix(uColor1, uColor2, nebulaValue);
      }
      // Nebula intensity based on complexity
      float nebulaIntensity = smoothstep(0.3, 0.7, nebulaValue) * 0.08 * uComplexity;
      vec3 col = bg + nebulaColor * nebulaIntensity;

      // === STAR RENDERING ===
      // Density threshold - maps uStarDensity (0-1) to probability threshold
      float densityThreshold = 1.0 - uStarDensity * 0.15; // 0.85 to 1.0 range

      // Base size for star point spread function
      float baseSize = 0.03 + uStarSize * 0.08; // 0.03 to 0.11

      // Multiple star layers for depth and parallax
      for (int layer = 0; layer < 4; layer++) {
          // Layer configuration
          float layerScale = 40.0 + float(layer) * 25.0; // 40, 65, 90, 115
          float layerSpeed = 0.0005 * float(layer + 1);
          float layerDensityMod = float(layer) * 0.015; // More stars in distant layers
          float layerBrightnessMod = 1.0 - float(layer) * 0.2; // Dimmer distant stars

          // Parallax motion
          vec3 starDir = dir;
          starDir.x += time * layerSpeed * (float(layer) - 1.5);
          starDir.y += time * layerSpeed * 0.3 * sin(float(layer) * 1.3);

          // Grid cell coordinates
          vec3 starCoord = starDir * layerScale;
          vec3 starCell = floor(starCoord);
          vec3 starFract = fract(starCoord);

          // Star presence based on hash
          float starRand = hash(starCell);
          float threshold = densityThreshold - layerDensityMod;

          if (starRand > threshold) {
              // === STAR PROPERTIES ===

              // Position within cell (centered)
              vec3 starOffset = vec3(
                  hash(starCell + 1.0),
                  hash(starCell + 2.0),
                  hash(starCell + 3.0)
              ) * 0.7 + 0.15;

              float dist = length(starFract - starOffset);

              // Magnitude class (1-6 scale, lower = brighter)
              // Bright stars are rare, dim stars are common
              float magRand = hash(starCell + 5.0);
              float magnitude = 1.0 + pow(magRand, 0.3) * 5.0; // 1.0 to 6.0

              // Size based on magnitude (bright stars appear larger)
              float starSize = baseSize * (1.5 - magnitude * 0.15);
              starSize *= layerBrightnessMod;

              // Core brightness (sharp center)
              float core = smoothstep(starSize, starSize * 0.1, dist);

              // Glow halo (soft falloff for bright stars)
              float glowSize = starSize * (3.0 + (6.0 - magnitude) * 0.5);
              float glow = smoothstep(glowSize, 0.0, dist);
              glow = pow(glow, 2.5) * (7.0 - magnitude) / 6.0; // Brighter stars have more glow

              // === TWINKLING (Scintillation) ===
              // Multi-frequency for natural atmospheric effect
              float twinklePhase = hash(starCell + 7.0) * TAU;
              float twinkle1 = sin(time * 2.0 + twinklePhase) * 0.15;
              float twinkle2 = sin(time * 5.3 + twinklePhase * 1.7) * 0.08;
              float twinkle3 = sin(time * 11.7 + twinklePhase * 2.3) * 0.05;
              float twinkle = 1.0 + (twinkle1 + twinkle2 + twinkle3) * uStarTwinkle;

              // Bright stars twinkle less (atmospheric physics)
              twinkle = mix(1.0, twinkle, magnitude / 6.0);

              // === COLOR ===
              float tempRand = hash(starCell + 10.0);
              vec3 spectralColor = getSpectralColor(tempRand, uStarColorVariation);

              // Blend with palette colors if enabled
              vec3 starColor;
              if (uUsePalette > 0.5) {
                  vec3 paletteColor = cosinePalette(tempRand, uPalA, uPalB, uPalC, uPalD);
                  // Mix spectral physics with artistic palette
                  starColor = mix(spectralColor, paletteColor, 0.4);
              } else {
                  // Blend user colors with spectral base
                  vec3 userBlend = mix(uColor1, uColor2, tempRand);
                  starColor = mix(spectralColor, userBlend, 0.5);
              }

              // Ensure minimum visibility
              starColor = max(starColor, vec3(0.3));

              // === FINAL STAR INTENSITY ===
              // Magnitude to brightness (astronomical scale: each magnitude is ~2.5x dimmer)
              float baseBrightness = pow(2.512, 3.0 - magnitude); // Magnitude 3 = 1.0

              // Combine core + glow
              float coreIntensity = core * baseBrightness * twinkle;
              float glowIntensity = glow * baseBrightness * 0.3 * uStarGlow;

              // Apply overall brightness control
              float totalIntensity = (coreIntensity + glowIntensity) * uStarBrightness * layerBrightnessMod;

              // Add to accumulator
              col += starColor * totalIntensity;
          }
      }

      // === AMBIENT SPACE GLOW ===
      // Subtle directional glow suggesting galactic plane
      float galacticGlow = pow(1.0 - abs(dir.y), 4.0) * 0.015;
      if (uUsePalette > 0.5) {
          col += cosinePalette(0.5, uPalA, uPalB, uPalC, uPalD) * galacticGlow * uComplexity;
      } else {
          col += mix(uColor1, uColor2, 0.5) * galacticGlow * uComplexity;
      }

      return col;
  }

  // --- Delight Features ---

  vec3 applyHorizon(vec3 col, vec3 dir) {
      if (uAtmosphere <= 0.0) return col;

      float horizon = 1.0 - abs(dir.y);
      horizon = pow(horizon, 3.0); // Sharpen

      vec3 horizonColor = (uUsePalette > 0.5) ? cosinePalette(0.5, uPalA, uPalB, uPalC, uPalD) : uColor2;

      return mix(col, horizonColor, horizon * uAtmosphere * 0.5);
  }

  // --- Main ---

  void main() {
      vec3 dir = normalize(vWorldDirection);
      float time = uTime * uTimeScale;

      // 1. Distortion (Heatwave/Turbulence global)
      if (uDistortion > 0.0) {
          float dNoise = sin(dir.y * 20.0 + time * 5.0) * 0.01 * uDistortion;
          dir.x += dNoise;
          dir.z += dNoise;
          dir = normalize(dir);
      }

      vec3 color = vec3(0.0);

      // 2. Mode Select
      if (uMode < 0.5) {
          // --- Classic Mode (Texture) ---

          // Calculate mip level for blur effect (0 = sharp, higher = blurrier)
          float lod = uBlur * 6.0;

          // Parallax depth effect - 3-layer system for perceived depth
          if (uParallaxEnabled > 0.5) {
              // Strength controls visual intensity, NOT layer positions
              float intensity = uParallaxStrength;

              // === PRE-SAMPLE to determine per-pixel movement amount ===
              vec3 baseColor = textureLod(uTex, dir, lod).rgb;
              float baseMax = max(baseColor.r, max(baseColor.g, baseColor.b));
              float baseMin = min(baseColor.r, min(baseColor.g, baseColor.b));
              float baseSat = (baseMax > 0.01) ? (baseMax - baseMin) / baseMax : 0.0;
              float baseLum = dot(baseColor, vec3(0.299, 0.587, 0.114));

              // Color purity - how dominant is the strongest channel
              float bluePurity = max(0.0, baseColor.b - max(baseColor.r, baseColor.g) * 0.6);
              float redPurity = max(0.0, baseColor.r - max(baseColor.g, baseColor.b) * 0.6);
              float greenPurity = max(0.0, baseColor.g - max(baseColor.r, baseColor.b) * 0.6);
              float colorPurity = (bluePurity + redPurity + greenPurity) * 2.0 + baseSat;
              colorPurity = clamp(colorPurity, 0.0, 1.0);

              // Movement multiplier: pure colors move more, grays barely move
              float moveAmount = colorPurity * smoothstep(0.1, 0.4, baseLum) * (1.0 - smoothstep(0.9, 1.0, baseLum));

              // === LAYER 1: Deep Background (furthest) ===
              // Very slow uniform sway - background is mostly dark anyway
              vec3 deepDir = dir;
              float deepSway = sin(time * 0.015) * 0.002;
              deepDir.x += deepSway;
              deepDir = normalize(deepDir);
              vec3 deepColor = textureLod(uTex, deepDir, lod + 1.0).rgb;

              // === LAYER 2: Mid layer (base) ===
              // Movement scaled by color purity - pure colors orbit their center
              vec3 midDir = dir;
              float midPhase = time * 0.03 + baseLum * TAU; // Phase offset by luminance for variety
              float midSwayX = sin(midPhase) * 0.003 * moveAmount;
              float midSwayY = cos(midPhase * 0.7) * 0.002 * moveAmount;
              midDir.x += midSwayX;
              midDir.y += midSwayY;
              midDir = normalize(midDir);
              vec3 midColor = textureLod(uTex, midDir, lod).rgb;
              float midLum = dot(midColor, vec3(0.299, 0.587, 0.114));

              // === LAYER 3: Foreground (closest) - colorful elements move most ===
              vec3 nearDir = dir;
              // Faster, larger orbit for foreground - scaled heavily by purity
              float nearPhase = time * 0.05 + colorPurity * PI; // Different phase based on color
              float nearSwayX = sin(nearPhase) * 0.006 * moveAmount;
              float nearSwayY = cos(nearPhase * 1.3 + 0.5) * 0.004 * moveAmount;
              // Add slight unique offset based on which color dominates
              nearSwayX += (redPurity - bluePurity) * sin(time * 0.04) * 0.003;
              nearSwayY += (greenPurity - redPurity) * cos(time * 0.035) * 0.002;
              nearDir.x += nearSwayX;
              nearDir.y += nearSwayY;
              nearDir = normalize(nearDir);
              vec3 nearColor = textureLod(uTex, nearDir, lod).rgb;

              // Recalculate saturation for near layer
              float nearMax = max(nearColor.r, max(nearColor.g, nearColor.b));
              float nearMin = min(nearColor.r, min(nearColor.g, nearColor.b));
              float nearSat = (nearMax > 0.01) ? (nearMax - nearMin) / nearMax : 0.0;
              float nearLum = dot(nearColor, vec3(0.299, 0.587, 0.114));

              // Colorfulness score for compositing
              float colorfulness = nearSat * smoothstep(0.15, 0.5, nearLum) * (1.0 - smoothstep(0.85, 1.0, nearLum));
              float nearBlueDom = max(0.0, nearColor.b - max(nearColor.r, nearColor.g) * 0.7);
              float nearRedDom = max(0.0, nearColor.r - max(nearColor.g, nearColor.b) * 0.7);
              float nearGreenDom = max(0.0, nearColor.g - max(nearColor.r, nearColor.b) * 0.7);
              float colorDominance = nearBlueDom + nearRedDom + nearGreenDom;

              // Combined mask: colorful elements come forward
              float nearMask = (colorfulness + colorDominance * 0.5) * mix(1.0, 2.0, intensity);
              nearMask = clamp(nearMask, 0.0, 1.0);

              // === COMPOSITING - preserve overall brightness ===
              color = midColor;

              // Darken only the darkest areas slightly
              float darkMask = 1.0 - smoothstep(0.0, 0.3, midLum);
              float depthDarken = mix(1.0, 0.85, intensity * darkMask);
              color *= depthDarken;

              // Blend in the deep layer for dark regions
              float deepBlend = darkMask * mix(0.1, 0.25, intensity);
              color = mix(color, deepColor * 0.9, deepBlend);

              // Pop colorful elements forward with saturation boost
              vec3 saturatedNear = nearColor * (1.0 + nearSat * 0.15);
              color = mix(color, saturatedNear, nearMask * mix(0.15, 0.4, intensity));

              // Glow on most colorful foreground elements
              float glowMask = smoothstep(0.3, 0.7, colorfulness + colorDominance);
              float glowIntensity = mix(0.03, 0.12, intensity);
              color += nearColor * glowMask * glowIntensity;
          } else {
              // Chromatic Aberration (Classic only, procedural handles it differently)
              if (uAberration > 0.0) {
                  float spread = uAberration * 0.02;
                  vec3 dirR = dir; dirR.x += spread;
                  vec3 dirB = dir; dirB.x -= spread;
                  float r = textureLod(uTex, dirR, lod).r;
                  float g = textureLod(uTex, dir, lod).g;
                  float b = textureLod(uTex, dirB, lod).b;
                  color = vec3(r, g, b);
              } else {
                  color = textureLod(uTex, dir, lod).rgb;
              }
          }

          // Classic tinting
          color *= uIntensity;

          if (uHue != 0.0 || uSaturation != 1.0) {
              vec3 hsv = rgb2hsv(color);
              hsv.x += uHue;
              hsv.y *= uSaturation;
              color = hsv2rgb(hsv);
          }

      } else if (uMode < 1.5) {
          // --- Aurora ---
          color = getAurora(dir, time);
          color *= uIntensity;
      } else if (uMode < 2.5) {
          // --- Nebula ---
          color = getNebula(dir, time);
          color *= uIntensity;
      } else if (uMode < 3.5) {
          // --- Void ---
          color = getVoid(dir, time);
      } else if (uMode < 4.5) {
          // --- Crystalline ---
          color = getCrystalline(dir, time);
          color *= uIntensity;
      } else if (uMode < 5.5) {
          // --- Horizon Gradient ---
          color = getHorizonGradient(dir, time);
          color *= uIntensity;
      } else if (uMode < 6.5) {
          // --- Deep Ocean ---
          color = getDeepOcean(dir, time);
          color *= uIntensity;
      } else if (uMode < 7.5) {
          // --- Twilight ---
          color = getTwilight(dir, time);
          color *= uIntensity;
      } else {
          // --- Starfield ---
          color = getStarfield(dir, time);
          color *= uIntensity;
      }

      // 3. Post-Process Delight Features

      // Horizon / Atmosphere
      color = applyHorizon(color, dir);

      // Sun Glow (Directional Light)
      if (uSunIntensity > 0.0) {
          vec3 sunDir = normalize(uSunPosition);
          float sunDot = max(0.0, dot(dir, sunDir));
          float sunGlow = pow(sunDot, 8.0); // sharp glow
          color += vec3(1.0, 0.9, 0.7) * sunGlow * uSunIntensity;
      }

      // Vignette
      if (uVignette > 0.0) {
          float dist = distance(vScreenUV, vec2(0.5));
          float vig = smoothstep(0.4, 0.9, dist);
          color *= 1.0 - vig * uVignette;
      }

      // Film Grain
      if (uGrain > 0.0) {
          float g = hash(vec3(vScreenUV * 100.0, uTime));
          color += (g - 0.5) * uGrain;
      }

      // Radial Chromatic Aberration (Lens style)
      if (uAberration > 0.0 && uMode > 0.5) {
          // For procedural, we shift the hue slightly at edges instead of re-sampling
          float dist = distance(vScreenUV, vec2(0.5));
          if (dist > 0.3) {
             float shift = (dist - 0.3) * uAberration;
             color.r += shift;
             color.b -= shift;
          }
      }

      fragColor = vec4(color, 1.0);
  }
`
