# PRD: Volumetric Self-Shadowing

## 1. Overview
Implement Ray-Marched Shadows for true volumetric depth. This is the most computationally expensive but most visually impactful change.

## 2. Mathematical Concept
For each step along the view ray (Primary Ray), cast a Secondary Ray towards the main light source.
$$ Light(P) = Light_{source} \cdot e^{-\int_P^{Light} \rho(l) dl} $$

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/integration.glsl.ts`

Modify `volumeRaymarchHQ`:

```glsl
// Inside loop
if (uShadowsEnabled) {
    vec3 lightDir = normalize(uLightPos - pos);
    float shadowT = 0.0;
    float shadowDens = 0.0;
    
    // Short march towards light
    for(int s=0; s<4; s++) { // 4 steps usually enough for soft volume shadows
        vec3 sPos = pos + lightDir * shadowT;
        shadowDens += sampleDensity(sPos) * shadowStepLen;
        shadowT += shadowStepLen;
    }
    
    float shadowAtten = exp(-shadowDens * uShadowDensityGain);
    lightContribution *= shadowAtten;
}
```

## 4. Uniforms Required
- `uShadowsEnabled` (bool).
- `uShadowDensityGain` (float).
- `uShadowSteps` (int): 2-4 recommended.

## 5. Performance Impact
🔴 **High Cost**: Adds $N_{view} \times N_{shadow}$ samples.
