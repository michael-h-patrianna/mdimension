# PRD: Curl Noise Domain Warping

## 1. Overview
Apply fluid-like turbulence to the wavefunction by warping the coordinate domain with 3D Curl Noise.

## 2. Mathematical Concept
$$ P_{new} = P + \text{Curl}(P \cdot \text{scale} + \text{time}) \cdot \text{strength} $$

Curl noise is divergence-free ($\nabla \cdot F = 0$), meaning it mimics incompressible fluid flow (no sinks/sources), preserving the volume of the "cloud."

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/quantum/density.glsl.ts`

Modify `sampleDensity`:

```glsl
vec3 curl = texture(tCurlNoise, pos * uCurlScale + vec3(uTime * uCurlSpeed)).xyz;
pos += (curl * 2.0 - 1.0) * uCurlStrength;

// Then sample wavefunction at distorted pos
```

## 4. Uniforms Required
- `tCurlNoise` (sampler3D or 2D): Curl noise texture.
- `uCurlStrength` (float): Distortion amount.
- `uCurlScale` (float): Frequency.
- `uCurlSpeed` (float): Animation speed.

## 5. Performance Impact
🟡 **Medium Cost**: Adds a texture lookup to every density sample.

