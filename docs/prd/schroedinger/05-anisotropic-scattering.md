# PRD: Anisotropic Scattering (Henyey-Greenstein)

## 1. Overview
Implement anisotropic scattering to create realistic volumetric lighting interaction, specifically "forward scattering" (silver lining) effects.

## 2. Mathematical Concept
Henyey-Greenstein Phase Function:
$$ P(\theta) = \frac{1}{4\pi} \frac{1 - g^2}{(1 + g^2 - 2g \cos\theta)^{3/2}} $$

Where:
- $\theta$: Angle between Light Direction and View Direction.
- $g$: Anisotropy factor (-1.0 to 1.0).
  - $g > 0$: Forward scattering (Clouds, Water, Nebulas).
  - $g < 0$: Backward scattering (Dust, Stone).
  - $g = 0$: Isotropic (Lambertian).

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/emission.glsl.ts`

Add function:

```glsl
float henyeyGreenstein(float dotLH, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * dotLH;
    return (1.0 - g2) / (4.0 * PI * pow(max(denom, 0.001), 1.5));
}
```

Modify `computeEmissionLit`:

```glsl
// Calculate phase function
float dotLH = dot(lightDir, viewDir);
float phase = henyeyGreenstein(dotLH, uScatteringAnisotropy);

// Modulate light contribution
col += lightColor * NdotL * attenuation * phase;
```

## 4. Uniforms Required
- `uScatteringAnisotropy` (float): Range -0.9 to 0.9. Default 0.6.

## 5. Performance Impact
🟢 **Low Cost**: Simple arithmetic per light source.

```