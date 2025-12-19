# PRD: Phase-Dependent Materiality

## 1. Overview
Leverage the quantum wavefunction phase $\phi$ to differentiate "Matter" from "Anti-Matter" (or positive vs. negative real parts) by assigning them distinct volumetric material properties.

## 2. Mathematical Concept
In Wigner quasi-probability distributions, regions can have "negative" probability. While $|\psi|^2$ is always positive, we can visualize the underlying amplitude's sign or phase quadrant to imply this complexity.

- **Phase $0$ to $\pi$**: Positive Real Part -> **Emissive Plasma** (Additive)
- **Phase $\pi$ to $2\pi$**: Negative Real Part -> **Absorbing Smoke** (Subtractive)

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/volume/emission.glsl.ts`

Modify `computeEmissionLit`:

```glsl
// Pseudo-code
float phaseMod = fract((phase + PI) / TAU); // 0..1

// Material 1: Hot Plasma (Phase ~0.5 / Real +)
vec3 plasmaColor = blackbody(density * temperature);
float plasmaWeight = smoothstep(0.4, 0.6, phaseMod); // Soft transition

// Material 2: Cold Smoke (Phase ~0.0 or 1.0 / Real -)
vec3 smokeColor = vec3(0.1, 0.1, 0.3) * lightContribution; // Dark, scattered light
float smokeWeight = 1.0 - plasmaWeight;

// Result
vec3 finalColor = plasmaColor * plasmaWeight + smokeColor * smokeWeight;
```

### Shader: `src/rendering/shaders/schroedinger/volume/absorption.glsl.ts`

Modify `computeAlpha`:

```glsl
// Plasma is thinner, Smoke is denser
float densityMod = mix(1.0, 3.0, smokeWeight); // Smoke is 3x denser
float alpha = 1.0 - exp(-density * densityMod * stepLen);
```

## 4. Uniforms Required
- `uPhaseMaterialStrength` (float): Blend factor (0.0 = uniform, 1.0 = full separation).

## 5. Performance Impact
🟢 **Low Cost**: Simple mixing logic.
