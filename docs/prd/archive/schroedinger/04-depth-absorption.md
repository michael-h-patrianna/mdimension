# PRD: Depth-Based Absorption

## 1. Overview
Make the volume absorption wavelength-dependent. Instead of a single `float` absorption coefficient, use a `vec3` (RGB).

## 2. Mathematical Concept
Beer-Lambert Law for RGB:
$$ T_{rgb} = e^{-\vec{\sigma} \cdot \rho \cdot \Delta l} $$

Common physical coefficients:
- **Smoke/Dust**: Absorbs Blue/Green faster -> Transmits Red/Orange.
- **Water/Ice**: Absorbs Red faster -> Transmits Blue/Cyan.

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/absorption.glsl.ts`

Update `computeAlpha` signature:

```glsl
// Returns opacity for each channel
vec3 computeAlphaRGB(float rho, float stepLen, vec3 sigmaRGB) {
    vec3 exponent = -sigmaRGB * rho * stepLen;
    return vec3(1.0) - exp(exponent);
}
```

### Shader: `src/rendering/shaders/schroedinger/volume/integration.glsl.ts`

Update the integration loop to track `vec3 transmittance` instead of `float`.

```glsl
vec3 transmittance = vec3(1.0);
// ...
vec3 alphaRGB = computeAlphaRGB(rho, stepLen, uAbsorptionColor);
transmittance *= (vec3(1.0) - alphaRGB);
```

## 4. Uniforms Required
- `uAbsorptionColor` (vec3): The absorption coefficients for R, G, B.

## 5. Performance Impact
🟢 **Low Cost**: Vector math (SIMD) is native to GPUs. Minimal overhead over scalar float.

```