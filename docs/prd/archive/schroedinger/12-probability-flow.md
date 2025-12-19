# PRD: Probability Current Flow

## 1. Overview
Animate the internal texture flow based on the "Probability Current" (Flux), approximated by the density gradient.

## 2. Mathematical Concept
Flux is high where density changes rapidly (edges) and low where it is constant (core/void).
$$ \vec{v}_{flow} \propto |\nabla \rho| $$

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/quantum/density.glsl.ts`

When sampling the Detail Noise (e.g., Curl or Foam):

```glsl
// Estimate gradient magnitude (available if computing normals, else needs samples)
// Optimization: Use analytic gradient of the Gaussian envelope?
// Or just use the 'rho' value itself to modulate speed:
// Flow faster at low density (edges)?

float speedMod = 1.0 - saturate(rho); // Fast edges, slow core
vec3 offset = vec3(uTime * uFlowSpeed * speedMod);
vec3 noise = texture(tNoise, pos + offset).xyz;
```

## 4. Uniforms Required
- `uFlowSpeed`.

## 5. Performance Impact
🟢 **Low Cost**: Reuses existing density or simple math.

```
