# PRD: Screen-Space God Rays (Crepuscular Rays)

## 1. Overview
Post-processing pass to generate light shafts emanating from the bright core of the wavefunction.

## 2. Mathematical Concept
Radial Blur from the screen-space position of the light source (or object center).
1. Isolate bright pixels (Threshold).
2. Blur radially away from Center.
3. Additively blend back onto main image.

## 3. Implementation Details

### New Pass: `GodRaysPass.tsx` / `godrays.frag`

```glsl
// Simple radial blur
vec2 center = getScreenPos(uObjectCenter);
vec3 color = vec3(0.0);
float decay = 1.0;

for(int i=0; i<NUM_SAMPLES; i++) {
    uv -= (uv - center) * density;
    vec3 sample = texture(tInput, uv).rgb;
    sample *= decay * weight;
    color += sample;
    decay *= decayFactor;
}
```

## 4. Uniforms Required
- `uExposure`, `uDecay`, `uDensity`, `uWeight`.

## 5. Performance Impact
🟡 **Medium Cost**: Full-screen post-process pass.
