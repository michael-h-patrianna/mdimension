# PRD: Electric Arcs (Ridged Noise)

## 1. Overview
Generate procedural "lightning" or "plasma filaments" inside the core using Ridged Multifractal Noise.

## 2. Mathematical Concept
Ridged Noise:
$$ N = 1.0 - | \text{Perlin}(P) | $$
Sharpened:
$$ N_{sharp} = N^4 $$

This creates sharp "valleys" turned into peaks, looking like electricity.

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/emission.glsl.ts`

Modify `computeEmissionLit`:

```glsl
float noise = texture(tPerlinNoise, pos * uArcScale).r;
float arc = pow(1.0 - abs(noise * 2.0 - 1.0), 8.0); // Very sharp ridges

vec3 arcColor = uArcColor * arc * uArcIntensity;
col += arcColor;
```

## 4. Uniforms Required
- `tPerlinNoise` (sampler3D): Can reuse same texture as other noise.
- `uArcScale`, `uArcIntensity`, `uArcColor`.

## 5. Performance Impact
🟡 **Medium Cost**: Texture lookup per step.

```