# PRD: Interference Fringing

## 1. Overview
Visualize the "Wave" nature of the wavefunction by modulating density with high-frequency phase bands. This creates "Ripples" or "Interference Rings" inside the lobes.

## 2. Mathematical Concept
Simulate constructive/destructive interference fringes:
$$ \rho_{new} = \rho \cdot (1 + A \cdot \sin(B \cdot \phi + C \cdot t)) $$

Where:
- $A$: Amplitude of fringes (0.0 to 1.0)
- $B$: Frequency (Number of rings)
- $\phi$: Wavefunction Phase
- $C$: Time speed (flow of rings)

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/quantum/density.glsl.ts`

Modify `sampleDensityWithPhase`:

```glsl
// existing code...
vec3 result = sampleDensityWithPhase(...);
float rho = result.x;
float phase = result.z;

// Apply Interference
float fringe = 1.0 + uInterferenceAmp * sin(phase * uInterferenceFreq + uTime * uInterferenceSpeed);
rho *= fringe;

return vec3(rho, sFromRho(rho), phase);
```

## 4. Uniforms Required
- `uInterferenceAmp` (float): 0.0 to 1.0.
- `uInterferenceFreq` (float): 1.0 to 50.0.
- `uInterferenceSpeed` (float): Animation speed.

## 5. Performance Impact
🟢 **Low Cost**: One `sin()` and one `mult`.

