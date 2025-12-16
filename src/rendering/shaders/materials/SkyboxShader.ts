/**
 * Skybox Shader Material
 *
 * Custom shader material for rendering environment skyboxes with
 * configurable visual effects, animations, and procedural generation.
 *
 * Features:
 * - Classic: Cube texture sampling with effects
 * - Procedural Modes: Aurora, Nebula, Void
 * - "Atmospheric Resonance" system (10 delight features)
 * - Cosine Palette Integration
 */

import * as THREE from 'three';
import { GLSL_COSINE_PALETTE } from '@/rendering/shaders/palette/cosine.glsl';

/**
 * Uniforms for the skybox shader material
 */
export interface SkyboxShaderUniforms {
  // Core
  uTex: THREE.CubeTexture | null;
  uRotation: THREE.Matrix3;
  uMode: number; // 0=Classic, 1=Aurora, 2=Nebula, 3=Void
  uTime: number;
  
  // Basic Appearance
  uBlur: number;
  uIntensity: number;
  uHue: number;
  uSaturation: number;
  
  // Procedural Settings
  uScale: number;
  uComplexity: number;
  uTimeScale: number;
  uEvolution: number;
  
  // Palette (Cosine Gradient)
  uColor1: THREE.Vector3;
  uColor2: THREE.Vector3;
  uPalA: THREE.Vector3;
  uPalB: THREE.Vector3;
  uPalC: THREE.Vector3;
  uPalD: THREE.Vector3;
  uUsePalette: number; // 0 or 1
  
  // Delight Features
  uDistortion: number;
  uAberration: number;
  uVignette: number;
  uGrain: number;
  uAtmosphere: number; // Horizon
  uStardust: number;
  uGrid: number;
  uMouseParallax: number;
  uTurbulence: number;
  uDualTone: number;
  uSunIntensity: number;
  uSunPosition: THREE.Vector3;
  uMousePos: THREE.Vector2; // Normalized -1 to 1

  [key: string]: THREE.CubeTexture | THREE.Matrix3 | THREE.Vector3 | THREE.Vector2 | number | null;
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
    
    uColor1: new THREE.Color(0x0000ff),
    uColor2: new THREE.Color(0xff00ff),
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
    uStardust: 0.3,
    uGrid: 0.0,
    uMouseParallax: 0.0,
    uTurbulence: 0.0,
    uDualTone: 0.5,
    uSunIntensity: 0.0,
    uSunPosition: new THREE.Vector3(10, 10, 10),
    uMousePos: new THREE.Vector2(0, 0)
  };
}

/**
 * Vertex shader for skybox rendering
 */
export const skyboxVertexShader = /* glsl */ `
  varying vec3 vWorldDirection;
  varying vec2 vScreenUV;
  varying vec3 vWorldPosition;
  
  uniform mat3 uRotation;

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
`;

/**
 * Fragment shader for skybox rendering
 * Includes: 
 * - Classic Mode
 * - Procedural Modes (Aurora, Nebula, Void)
 * - Cosine Palette Integration
 * - 10 Delight Features
 */
export const skyboxFragmentShader = /* glsl */ `
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
  uniform float uStardust;
  uniform float uGrid;
  uniform float uMouseParallax;
  uniform float uTurbulence;
  uniform float uDualTone;
  uniform float uSunIntensity;
  uniform vec3 uSunPosition;
  uniform vec2 uMousePos;

  // --- Varyings ---
  varying vec3 vWorldDirection;
  varying vec2 vScreenUV;
  varying vec3 vWorldPosition;

  // --- Constants ---
  #define PI 3.14159265359
  #define MODE_CLASSIC 0.0
  #define MODE_AURORA 1.0
  #define MODE_NEBULA 2.0
  #define MODE_VOID 3.0

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

  // Mode 1: Aurora (Domain Warping Trig)
  // Smooth, flowing ribbons. Cheap and beautiful.
  vec3 getAurora(vec3 dir, float time) {
      vec3 p = dir * uScale * 2.0;
      
      // Polyrhythmic animation
      float t1 = time * 0.5;
      float t2 = time * 0.2;
      
      // Domain Warping
      vec3 q = p;
      q.x += sin(q.z * 0.5 + t1) * 0.5 * uTurbulence;
      q.z += cos(q.y * 0.5 + t2) * 0.5 * uTurbulence;
      
      // Evolution morph
      q += uEvolution * 2.0;
      
      // Primary pattern
      float v = sin(q.x * 10.0 + q.y * 5.0 + time);
      v += sin(q.y * 8.0 - q.z * 3.0 + time * 1.5);
      v = v * 0.5 + 0.5; // range 0-1
      
      // Sharpen bands
      v = smoothstep(0.2, 0.8, v);
      
      // Color Mapping
      vec3 col;
      if (uUsePalette > 0.5) {
          // Use Cosine Palette
          // Map v to palette input
          col = cosinePalette(v, uPalA, uPalB, uPalC, uPalD);
          
          // Dual Tone Shadowing
          if (uDualTone > 0.0) {
             col = mix(col * 0.2, col, smoothstep(0.0, 0.8, v + (1.0 - uDualTone) * 0.5)); 
          }
      } else {
          // Manual Lerp
          col = mix(uColor1, uColor2, v);
      }
      
      return col;
  }

  // Mode 2: Nebula (Volumetric FBM)
  // Deep, cloudy, organic.
  vec3 getNebula(vec3 dir, float time) {
      vec3 p = dir * uScale * 1.5;
      
      // Mouse Parallax (fake depth)
      if (uMouseParallax > 0.0) {
          p += vec3(uMousePos * uMouseParallax, 0.0);
      }
      
      // Movement
      p.x -= time * 0.1;
      
      // Domain Warping for turbulence
      vec3 q = p;
      q.x += fbm(p + vec3(0.0, 0.0, time * 0.2), 2) * uTurbulence;
      
      // Evolution
      q += uEvolution * 5.0;
      
      // Main cloud density
      int octaves = int(mix(2.0, 5.0, uComplexity));
      float density = fbm(q, octaves);
      
      // Normalize density
      density = smoothstep(0.2, 0.8, density);
      
      // Coloring
      vec3 col;
      if (uUsePalette > 0.5) {
          // Use palette, but use density to drive it
          // We can use the density to pick from the palette
          col = cosinePalette(density, uPalA, uPalB, uPalC, uPalD);
          
          // Darken low density areas for void effect
          col *= smoothstep(0.1, 0.6, density);
      } else {
          col = mix(uColor1 * 0.1, uColor2, density);
      }
      
      return col;
  }

  // Mode 3: Void (Gradient Fields)
  // Clean, studio-like, minimalistic.
  vec3 getVoid(vec3 dir, float time) {
      // Base dark color
      vec3 bg = uColor1 * 0.1; // Deep background
      
      // Sun/Light Source
      vec3 sunDir = normalize(uSunPosition);
      float sunDot = dot(dir, sunDir);
      float sunGlow = smoothstep(0.5, 1.0, sunDot);
      
      // Interactive Highlight (Mouse)
      if (uMouseParallax > 0.0) {
          vec3 mouseDir = normalize(vec3(uMousePos.x, uMousePos.y, -1.0));
          float mouseDot = dot(dir, mouseDir);
          sunGlow += smoothstep(0.9, 1.0, mouseDot) * uMouseParallax;
      }
      
      vec3 glowColor = (uUsePalette > 0.5) ? cosinePalette(1.0, uPalA, uPalB, uPalC, uPalD) : uColor2;
      
      // Grid effect for Void mode (Tron style)
      float grid = 0.0;
      if (uGrid > 0.0) {
          // Spherical grid
          float theta = atan(dir.z, dir.x);
          float phi = acos(dir.y);
          
          float size = 20.0 * uScale;
          float g1 = sin(theta * size + time * 0.1);
          float g2 = sin(phi * size);
          
          grid = smoothstep(0.95, 1.0, max(g1, g2));
          
          // Warp grid with turbulence
          if (uTurbulence > 0.0) {
             grid *= noise(dir * 10.0 + time);
          }
      }

      vec3 col = mix(bg, glowColor, sunGlow * 0.5 * uIntensity);
      col += glowColor * grid * uGrid;
      
      return col;
  }

  // --- Delight Features ---

  vec3 applyStardust(vec3 col, vec3 dir, float time) {
      if (uStardust <= 0.0) return col;
      
      // High frequency noise for stars
      vec3 starDir = dir * 100.0;
      float n = hash(starDir); // cheap static noise
      
      // Twinkle
      float twinkle = sin(time * 2.0 + n * 100.0) * 0.5 + 0.5;
      
      // Threshold
      float star = smoothstep(1.0 - (uStardust * 0.02), 1.0, n);
      
      return col + vec3(star * twinkle);
  }
  
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
          
          // Chromatic Aberration (Classic only, procedural handles it differently)
          if (uAberration > 0.0) {
              float spread = uAberration * 0.02;
              vec3 dirR = dir; dirR.x += spread;
              vec3 dirB = dir; dirB.x -= spread;
              float r = textureCube(uTex, dirR).r;
              float g = textureCube(uTex, dir).g;
              float b = textureCube(uTex, dirB).b;
              color = vec3(r, g, b);
          } else {
              color = textureCube(uTex, dir).rgb;
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
      } else {
          // --- Void ---
          color = getVoid(dir, time);
      }
      
      // 3. Post-Process Delight Features
      
      // Stardust (Sparkles)
      if (uMode > 0.5) { // Only on procedural modes
          color = applyStardust(color, dir, time);
      }
      
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

      gl_FragColor = vec4(color, 1.0);
  }
`;

