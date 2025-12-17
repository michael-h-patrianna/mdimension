# PRD: Quantum Foam Noise

## 1. Overview
Add a low-amplitude, high-frequency noise floor to simulate vacuum fluctuations.

## 2. Mathematical Concept
Background Density:
$$ \rho_{total} = \rho_{psi} + \text{Noise}(P) \cdot \epsilon $$ 

This ensures that even where the wavefunction is zero, there is "something" to see, connecting the object to the space around it.

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/quantum/density.glsl.ts`

```glsl
float foam = texture(tPerlinNoise, pos * uFoamScale).r;
rho += foam * uFoamStrength * (1.0 - saturate(rho)); // Only add where density is low
```

## 4. Uniforms Required
- `uFoamStrength`: Small value (e.g., 0.05).
- `uFoamScale`: High frequency.

## 5. Performance Impact
🟡 **Medium Cost**: Texture lookup per step.

```