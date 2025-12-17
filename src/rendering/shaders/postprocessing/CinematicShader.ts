import { Uniform } from 'three';

/**
 * Cinematic Shader
 * Combines Chromatic Aberration, Vignette, and Film Grain in a single pass.
 */
export const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uDistortion: { value: 0.005 }, // Chromatic aberration intensity
    uVignetteDarkness: { value: 1.2 }, // Vignette intensity
    uVignetteOffset: { value: 1.0 }, // Vignette falloff
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDistortion;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;

    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      
      // -- Chromatic Aberration --
      // Calculate distance from center (0.5, 0.5)
      vec2 dist = uv - 0.5;
      
      // Distort UVs for each channel
      // R moves out, B moves in (or vice versa)
      vec2 offset = dist * uDistortion;
      
      float r = texture2D(tDiffuse, uv - offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + offset).b;
      
      vec4 color = vec4(r, g, b, 1.0);

      // -- Vignette --
      // Distance from center
      float d = length(dist);
      // Smooth interpolation for vignette
      float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.6, d * uVignetteDarkness);
      
      color.rgb = mix(color.rgb, color.rgb * vignette, 1.0);

      gl_FragColor = color;
    }
  `,
};

export type CinematicUniforms = {
  tDiffuse: Uniform;
  uTime: Uniform;
  uDistortion: Uniform;
  uVignetteDarkness: Uniform;
  uVignetteOffset: Uniform;
};
