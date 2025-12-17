# PRD: Dual-Scattering (Powder Effect)

## 1. Overview
Simulate "Powder" scattering (light bouncing around inside thin edges) to create soft, puffy boundaries.

## 2. Mathematical Concept
HZD Approximation:
$$ E_{powder} = 1 - e^{-\rho \cdot 2} $$

This term is high (1.0) for dense regions but drops off *slower* than pure absorption, effectively boosting the brightness of semi-transparent regions relative to their opacity.

Combined with Beer-Lambert:
$$ Light = Light_{in} \cdot e^{-d} \cdot (1 - e^{-d \cdot 2}) $$

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/emission.glsl.ts`

Modify `computeEmissionLit`:

```glsl
// Standard Beer-Lambert attenuation from light to point (approximated here by density)
// Note: True depth needs shadow marching. Here we approximate "local" powderiness.

float powder = 1.0 - exp(-rho * uPowderScale);
col += lightColor * powder * ...;
```

## 4. Uniforms Required
- `uPowderScale` (float): Controls the "puffiness". Default 2.0.

## 5. Performance Impact
🟢 **Low Cost**: Single `exp()` call.

```