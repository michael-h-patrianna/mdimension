# PRD: Chromatic Density Dispersion

## 1. Overview
Simulate "Quantum Glitch" or spectral uncertainty by sampling density at different offsets for R, G, and B.

## 2. Mathematical Concept
$$ \rho_R = \rho(P + \vec{\delta}_R) $$
$$ \rho_G = \rho(P) $$
$$ \rho_B = \rho(P + \vec{\delta}_B) $$

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/main.glsl.ts`

Inside the raymarch loop, instead of one sample:

```glsl
// Very expensive version
float rhoR = sampleDensity(pos + offsetR);
float rhoG = sampleDensity(pos);
float rhoB = sampleDensity(pos + offsetB);
vec3 rhoRGB = vec3(rhoR, rhoG, rhoB);

// Use rhoRGB for alpha/emission calculation
```

**Optimization:**
Only do this when `transmittance` is in a specific range (edges) or use a cheaper hack (gradient-based approximation).
Gradient Hack: `rho_R = rho + dot(gradient, offsetR)`. This requires gradient, but avoids full re-evaluation.

## 4. Uniforms Required
- `uDispersionStrength` (float).

## 5. Performance Impact
🔴 **High Cost**: Triples density evaluation cost (without hack).

```