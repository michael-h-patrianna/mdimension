# PRD: Blue Noise Dithering

## 1. Overview
Use stochastic sampling to reduce "wood grain" stepping artifacts.

## 2. Mathematical Concept
Offset the ray starting position `tNear` by a random amount [0, stepLen].
Using **Blue Noise** (high-frequency noise) is superior to White Noise because the artifacts are high-frequency and easily removed by Temporal Anti-Aliasing (TAA), whereas White Noise creates low-frequency clumps.

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/main.glsl.ts`

```glsl
uniform sampler2D tBlueNoise;

// Inside main()
vec2 noiseUV = gl_FragCoord.xy / vec2(textureSize(tBlueNoise, 0));
float jitter = texture(tBlueNoise, noiseUV).r;

// Offset start
t += stepLen * jitter;
```

## 4. Uniforms Required
- `tBlueNoise` (sampler2D): Blue noise texture (needs to be loaded).

## 5. Performance Impact
🟢 **Low Cost**: Single texture fetch.
