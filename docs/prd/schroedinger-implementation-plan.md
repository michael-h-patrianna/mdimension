# Schrödinger ND Volume Visualizer - Implementation Plan

Based on PRD: `docs/prd/schroedinger.md`

## Executive Summary

Transform the current Schroedinger object (a Mandelbulb clone) into a true N-dimensional Schrödinger wavefunction visualizer using:
- **Harmonic Oscillator eigenstates** with quantum superposition
- **Beer-Lambert volumetric rendering** (not SDF raymarching)
- **Time-dependent interference** for organic morphing

---

## Architecture Overview

### Current State (Mandelbulb Clone)
- Fractal iteration: `z = z^n + c`
- SDF-based sphere tracing
- Power/phase animation techniques
- D-dimensional hyperspherical coordinates

### Target State (Quantum Volume)
- Density field: `ρ(x,t) = |ψ(x,t)|²`
- Superposition of HO eigenstates: `ψ = Σ c_k φ_k(x) e^(-iE_k t)`
- True volumetric accumulation (Beer-Lambert)
- Time-dependent interference creates morphing

---

## Implementation Milestones

### Milestone 1: Core Quantum Math Functions
**Goal:** Implement the mathematical foundation in GLSL

#### Files to Create

**`src/rendering/shaders/schroedinger/quantum/complex.glsl.ts`**
```glsl
// Complex number utilities
vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cexp_i(float theta) {
  return vec2(cos(theta), sin(theta));
}
```

**`src/rendering/shaders/schroedinger/quantum/hermite.glsl.ts`**
```glsl
// Hermite polynomial via recurrence (n ≤ 6)
float hermite(int n, float u) {
  if (n == 0) return 1.0;
  if (n == 1) return 2.0 * u;
  float Hnm1 = 1.0;
  float Hn = 2.0 * u;
  for (int k = 1; k < n; k++) {
    float Hnp1 = 2.0 * u * Hn - 2.0 * float(k) * Hnm1;
    Hnm1 = Hn;
    Hn = Hnp1;
  }
  return Hn;
}
```

**`src/rendering/shaders/schroedinger/quantum/ho1d.glsl.ts`**
```glsl
// 1D Harmonic Oscillator eigenfunction (visual normalization)
float ho1D(int n, float x, float omega) {
  float a = sqrt(omega);
  float u = a * x;
  float gauss = exp(-0.5 * u * u);
  float H = hermite(n, u);
  // Damp higher orders to prevent blowup
  float damp = 1.0 / (1.0 + 0.15 * float(n) * float(n));
  return damp * H * gauss;
}
```

**`src/rendering/shaders/schroedinger/quantum/psi.glsl.ts`**
```glsl
// Evaluate wavefunction superposition
vec2 evalPsi(float xND[MAX_DIM], float t) {
  vec2 psi = vec2(0.0);

  for (int k = 0; k < MAX_TERMS; k++) {
    if (k >= uTermCount) break;

    // Time phase: e^{-iEt}
    float phase = -uEnergy[k] * t;
    vec2 term = cmul(uCoeff[k], cexp_i(phase));

    // Separable spatial eigenfunction
    float amp = 1.0;
    for (int j = 0; j < MAX_DIM; j++) {
      if (j >= uDimension) break;
      int n = uQuantum[k * MAX_DIM + j];
      amp *= ho1D(n, xND[j] * uFieldScale, uOmega[j]);
    }

    psi += term * amp;
  }

  return psi;
}
```

**`src/rendering/shaders/schroedinger/quantum/density.glsl.ts`**
```glsl
float rhoFromPsi(vec2 psi) {
  return dot(psi, psi); // |ψ|² = re² + im²
}

float sFromRho(float rho) {
  return log(rho + 1e-8); // Log-density for stability
}
```

#### Tasks
- [ ] Create `quantum/` folder structure
- [ ] Implement `complex.glsl.ts` with cmul, cexp_i
- [ ] Implement `hermite.glsl.ts` with recurrence relation
- [ ] Implement `ho1d.glsl.ts` with Gaussian envelope and damping
- [ ] Implement `psi.glsl.ts` with superposition evaluation
- [ ] Implement `density.glsl.ts` with rho and log-density
- [ ] Write unit tests for Hermite polynomial values (H_0 through H_6)
- [ ] Write unit tests for complex multiplication

---

### Milestone 2: Volumetric Rendering Pipeline
**Goal:** Replace SDF raymarching with true volumetric accumulation

#### Files to Create

**`src/rendering/shaders/schroedinger/volume/absorption.glsl.ts`**
```glsl
// Beer-Lambert absorption
float computeAlpha(float rho, float stepLen, float densityGain) {
  float sigma = densityGain;
  return 1.0 - exp(-sigma * rho * stepLen);
}
```

**`src/rendering/shaders/schroedinger/volume/integration.glsl.ts`**
```glsl
// Volume integration loop
vec4 volumeRaymarch(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
  vec3 accColor = vec3(0.0);
  float transmittance = 1.0;

  float stepLen = (tFar - tNear) / float(uSampleCount);
  float t = tNear;

  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uSampleCount || transmittance < 0.01) break;

    vec3 pos = rayOrigin + rayDir * t;

    // Map to ND coordinates
    float xND[MAX_DIM];
    mapToND(pos, xND);

    // Evaluate density
    vec2 psi = evalPsi(xND, uTime * uTimeScale);
    float rho = rhoFromPsi(psi);

    // Accumulate
    float alpha = computeAlpha(rho, stepLen, uDensityGain);
    vec3 emission = computeEmission(rho, psi, pos);

    accColor += transmittance * alpha * emission;
    transmittance *= (1.0 - alpha);

    t += stepLen;
  }

  return vec4(accColor, 1.0 - transmittance);
}
```

**`src/rendering/shaders/schroedinger/volume/emission.glsl.ts`**
```glsl
// Emission color based on density, phase, or gradient
vec3 computeEmission(float rho, vec2 psi, vec3 pos) {
  if (uColorMode == 0) {
    // Density-based coloring
    float s = sFromRho(rho);
    float normalized = clamp((s + 8.0) / 8.0, 0.0, 1.0);
    return getColor(normalized);
  } else if (uColorMode == 1) {
    // Phase-based coloring
    float phase = atan(psi.y, psi.x);
    float hue = (phase + PI) / (2.0 * PI);
    return hslToRgb(vec3(hue, 0.8, 0.6));
  } else {
    // Mixed: density for brightness, phase for hue
    float s = sFromRho(rho);
    float brightness = clamp((s + 8.0) / 8.0, 0.0, 1.0);
    float phase = atan(psi.y, psi.x);
    float hue = (phase + PI) / (2.0 * PI);
    return hslToRgb(vec3(hue, 0.7, brightness * 0.7));
  }
}
```

#### Files to Modify

**`src/rendering/shaders/schroedinger/normal.glsl.ts`**
- Replace SDF gradient with log-density gradient:
```glsl
vec3 computeNormal(vec3 pos, float delta) {
  float xND[MAX_DIM];

  // Sample log-density at offset positions
  mapToND(pos + vec3(delta, 0, 0), xND);
  float sxp = sFromRho(rhoFromPsi(evalPsi(xND, uTime * uTimeScale)));

  mapToND(pos - vec3(delta, 0, 0), xND);
  float sxn = sFromRho(rhoFromPsi(evalPsi(xND, uTime * uTimeScale)));

  // ... same for y, z

  return normalize(vec3(sxp - sxn, syp - syn, szp - szn));
}
```

#### Tasks
- [ ] Create `volume/` folder structure
- [ ] Implement `absorption.glsl.ts` with Beer-Lambert
- [ ] Implement `integration.glsl.ts` with accumulation loop
- [ ] Implement `emission.glsl.ts` with color modes
- [ ] Modify `normal.glsl.ts` for log-density gradient
- [ ] Remove old SDF files from `sdf/` folder
- [ ] Update `dispatch.glsl.ts` to call density evaluation
- [ ] Update `main.glsl.ts` for volumetric output

---

### Milestone 3: Uniform System & Types
**Goal:** Add new shader uniforms and TypeScript types

#### New Shader Uniforms

**`src/rendering/shaders/schroedinger/uniforms.glsl.ts`**
```glsl
// Constants
#define MAX_DIM 11
#define MAX_TERMS 8
#define MAX_SAMPLES 128

// Quantum configuration
uniform int uTermCount;                    // 1..8
uniform float uOmega[MAX_DIM];             // Per-dimension frequency
uniform int uQuantum[MAX_TERMS * MAX_DIM]; // Quantum numbers (flattened)
uniform vec2 uCoeff[MAX_TERMS];            // Complex coefficients
uniform float uEnergy[MAX_TERMS];          // Precomputed energies

// Volume rendering
uniform float uTimeScale;      // Morph speed (0.1-2.0)
uniform float uFieldScale;     // Coordinate scale (0.5-2.0)
uniform float uDensityGain;    // Opacity strength (0.1-5.0)
uniform int uSampleCount;      // Samples per ray
uniform int uColorMode;        // 0=density, 1=phase, 2=mixed

// Optional isosurface
uniform float uIsoThreshold;   // Log-density threshold
uniform bool uIsoEnabled;      // Enable isosurface mode
```

#### TypeScript Types

**`src/lib/geometry/extended/types.ts`** - Update SchroedingerConfig:
```typescript
interface SchroedingerConfig {
  // Core (KEEP)
  qualityPreset: SchroedingerQualityPreset;
  resolution: number;
  visualizationAxes: [number, number, number];
  parameterValues: number[];
  center: number[];
  extent: number;

  // Quantum parameters (NEW)
  seed: number;
  termCount: number;              // 1-8
  maxQuantumNumber: number;       // 2-6
  frequencySpread: number;        // 0.0-0.5
  omega: number[];                // Per-dimension frequencies
  quantumNumbers: number[][];     // [term][dim] quantum numbers
  coefficients: [number, number][]; // Complex [re, im] per term
  energies: number[];             // Precomputed energies

  // Volume rendering (NEW)
  timeScale: number;              // 0.1-2.0
  fieldScale: number;             // 0.5-2.0
  densityGain: number;            // 0.1-5.0
  sampleCount: number;            // 32-128
  colorMode: 'density' | 'phase' | 'mixed';

  // Isosurface (NEW, optional)
  isoEnabled: boolean;
  isoThreshold: number;

  // Animation (KEEP, modify)
  sliceAnimationEnabled: boolean;
  sliceSpeed: number;
  sliceAmplitude: number;
  originDriftEnabled: boolean;
  driftAmplitude: number;
  driftBaseFrequency: number;
  driftFrequencySpread: number;

  // REMOVE these fractal-specific fields
  // maxIterations, escapeRadius, schroedingerPower
  // powerAnimationEnabled, powerMin, powerMax, powerSpeed
  // alternatePowerEnabled, alternatePowerValue, alternatePowerBlend
  // dimensionMixEnabled, mixIntensity, mixFrequency
  // phaseShiftEnabled, phaseSpeed, phaseAmplitude
}
```

#### Tasks
- [ ] Update `uniforms.glsl.ts` with quantum uniforms
- [ ] Update `SchroedingerConfig` interface in `types.ts`
- [ ] Add default values for new config fields
- [ ] Update `extendedObjectStore.ts` with new state and setters
- [ ] Update `SchroedingerMesh.tsx` to wire new uniforms
- [ ] Remove deprecated fractal uniform wiring

---

### Milestone 4: Preset Generation System
**Goal:** Create seeded preset generator for visual variety

#### Files to Create

**`src/lib/geometry/extended/schroedinger/presets.ts`**
```typescript
// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

interface QuantumPreset {
  termCount: number;
  omega: number[];
  quantumNumbers: number[][];
  coefficients: [number, number][];
  energies: number[];
}

export function generateQuantumPreset(
  seed: number,
  dimension: number,
  termCount: number = 6,
  maxN: number = 5,
  frequencySpread: number = 0.25
): QuantumPreset {
  const rng = mulberry32(seed);

  // Generate per-dimension frequencies (0.8 - 1.3 range)
  const omega = Array.from({ length: dimension }, () =>
    0.8 + rng() * frequencySpread * 2
  );

  // Generate quantum numbers for each term
  const quantumNumbers: number[][] = [];
  const coefficients: [number, number][] = [];
  const energies: number[] = [];

  for (let k = 0; k < termCount; k++) {
    // Quantum numbers: mostly low, occasionally higher
    const n = Array.from({ length: dimension }, () => {
      const r = rng();
      if (r < 0.5) return 0;
      if (r < 0.75) return 1;
      if (r < 0.9) return 2;
      return Math.min(Math.floor(rng() * maxN), maxN);
    });
    quantumNumbers.push(n);

    // Compute energy
    const E = n.reduce((sum, ni, j) => sum + omega[j] * (ni + 0.5), 0);
    energies.push(E);

    // Coefficient: amplitude decreases with energy, random phase
    const amplitude = 1.0 / (1.0 + 0.2 * E);
    const phase = rng() * 2 * Math.PI;
    coefficients.push([
      amplitude * Math.cos(phase),
      amplitude * Math.sin(phase)
    ]);
  }

  return { termCount, omega, quantumNumbers, coefficients, energies };
}

// Named presets
export const SCHROEDINGER_PRESETS = {
  organicBlob: { seed: 42, termCount: 4, maxN: 3, frequencySpread: 0.1 },
  quantumFoam: { seed: 137, termCount: 8, maxN: 5, frequencySpread: 0.3 },
  breathing: { seed: 314, termCount: 3, maxN: 2, frequencySpread: 0.05 },
  kaleidoscope: { seed: 2718, termCount: 6, maxN: 4, frequencySpread: 0.4 },
  alien: { seed: 1618, termCount: 5, maxN: 6, frequencySpread: 0.2 },
} as const;
```

#### Tasks
- [ ] Create `presets.ts` with seeded PRNG
- [ ] Implement `generateQuantumPreset()` function
- [ ] Add named preset configurations
- [ ] Write unit tests for deterministic generation
- [ ] Integrate preset generation into store actions

---

### Milestone 5: UI Controls Update
**Goal:** Replace fractal controls with quantum visualization controls

#### Files to Modify

**`src/components/sections/Geometry/SchroedingerControls.tsx`**

New control sections:
1. **Preset Selection**
   - Dropdown: Organic Blob, Quantum Foam, Breathing, Kaleidoscope, Alien
   - Seed input field with randomize button

2. **Quantum Configuration**
   - Term Count slider (1-8)
   - Max Quantum Number slider (2-6)
   - Frequency Spread slider (0.0-0.5)

3. **Volume Rendering**
   - Field Scale slider (0.5-2.0)
   - Density Gain slider (0.1-5.0)
   - Sample Count slider (32-128)
   - Color Mode selector (Density/Phase/Mixed)

4. **Dimension & Slice** (KEEP existing)
   - Dimension slider (3-11)
   - Slice parameter sliders for extra dimensions

**`src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx`**

Update animation panels:
1. **Time Evolution** (replaces Power Animation)
   - Toggle time evolution
   - Time Scale slider (0.1-2.0)

2. **Slice Animation** (KEEP)
   - Toggle, speed, amplitude

3. **Origin Drift** (KEEP)
   - Toggle, amplitude, frequency

Remove panels:
- Power Animation
- Phase Shifts
- Alternate Power

#### Tasks
- [ ] Update `SchroedingerControls.tsx` with new control sections
- [ ] Update `SchroedingerAnimationDrawer.tsx` with time evolution panel
- [ ] Remove deprecated animation controls
- [ ] Add preset dropdown with named presets
- [ ] Add seed input with randomize button
- [ ] Wire new controls to store actions

---

### Milestone 6: Shader Composition Integration
**Goal:** Wire all new modules into the shader composition system

#### Files to Modify

**`src/rendering/shaders/schroedinger/compose.ts`**
```typescript
export function composeSchroedingerShader(config: ShaderConfig) {
  const blocks = [
    precisionBlock,
    vertexInputsBlock,
    definesBlock(config),
    constantsBlock,
    sharedUniformsBlock,
    schroedingerUniformsBlock,     // Updated

    // Quantum math modules (NEW)
    complexMathBlock,
    hermiteBlock,
    ho1dBlock,
    psiBlock,
    densityBlock,

    // Volume rendering (NEW)
    absorptionBlock,
    emissionBlock,

    // Color system (KEEP)
    ...colorBlocks,

    // Volume integration (NEW - replaces SDF raymarch)
    volumeIntegrationBlock,

    // Normal from log-density gradient
    normalBlock,

    // Lighting (for isosurface mode)
    ...(config.isoEnabled ? lightingBlocks : []),

    // Main shader
    mainBlock,
  ];

  return {
    glsl: blocks.join('\n'),
    modules: blocks.map(b => b.name),
    features: extractFeatures(config),
  };
}
```

#### Tasks
- [ ] Create block exports for all quantum modules
- [ ] Create block exports for volume modules
- [ ] Update `compose.ts` with new block ordering
- [ ] Remove SDF block imports
- [ ] Add conditional isosurface mode support
- [ ] Test shader compilation for all dimensions (3-11)

---

### Milestone 7: Mesh Component Updates
**Goal:** Update SchroedingerMesh to handle new uniform arrays

#### Files to Modify

**`src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx`**

Key changes:
1. Add working arrays for quantum data:
```typescript
interface QuantumWorkingArrays {
  omega: Float32Array;      // [MAX_DIM]
  quantum: Int32Array;      // [MAX_TERMS * MAX_DIM]
  coeff: Float32Array;      // [MAX_TERMS * 2]
  energy: Float32Array;     // [MAX_TERMS]
}
```

2. Update uniform initialization:
```typescript
const uniforms = useMemo(() => ({
  // ... existing uniforms

  // Quantum uniforms
  uTermCount: { value: config.termCount },
  uOmega: { value: new Float32Array(MAX_DIM) },
  uQuantum: { value: new Int32Array(MAX_TERMS * MAX_DIM) },
  uCoeff: { value: new Float32Array(MAX_TERMS * 2) },
  uEnergy: { value: new Float32Array(MAX_TERMS) },

  // Volume uniforms
  uTimeScale: { value: config.timeScale },
  uFieldScale: { value: config.fieldScale },
  uDensityGain: { value: config.densityGain },
  uSampleCount: { value: config.sampleCount },
  uColorMode: { value: colorModeToInt(config.colorMode) },
}), []);
```

3. Update useFrame for quantum data:
```typescript
// Update quantum arrays when config changes
if (quantumDataDirty) {
  fillQuantumArrays(config, quantumArraysRef.current);
  uniforms.uOmega.value.set(quantumArraysRef.current.omega);
  uniforms.uQuantum.value.set(quantumArraysRef.current.quantum);
  uniforms.uCoeff.value.set(quantumArraysRef.current.coeff);
  uniforms.uEnergy.value.set(quantumArraysRef.current.energy);
}
```

#### Tasks
- [ ] Add quantum working arrays interface
- [ ] Initialize quantum uniform arrays
- [ ] Create `fillQuantumArrays()` helper function
- [ ] Update useFrame to sync quantum data
- [ ] Remove fractal-specific uniform updates
- [ ] Handle preset changes (regenerate quantum data)

---

### Milestone 8: Performance Optimization
**Goal:** Ensure interactive performance across all configurations

#### Optimizations

1. **Fast Mode Reductions**
   - Reduce `uTermCount` to min(4, termCount) during rotation
   - Reduce `uSampleCount` by 50% during rotation
   - Increase step size by 2x

2. **Early Exit Conditions**
   - Exit when `transmittance < 0.01`
   - Exit when `rho < 1e-6` for 3+ consecutive samples
   - Use bounding sphere for initial ray-volume intersection

3. **Hermite Stability**
   - Damping factor: `1/(1 + 0.15*n²)` already in ho1D
   - Clamp rho before alpha conversion to prevent blowouts

4. **Memory Layout**
   - Use contiguous Float32Array for all uniform arrays
   - Pre-allocate all working arrays (no per-frame allocation)

#### Tasks
- [ ] Implement fast mode parameter reduction
- [ ] Add early exit conditions in volume loop
- [ ] Add bounding sphere intersection test
- [ ] Verify no per-frame allocations in hot path
- [ ] Profile GPU time for D=11, K=8 configuration
- [ ] Target: 60fps in fast mode, 30fps in quality mode

---

### Milestone 9: Testing & Validation
**Goal:** Comprehensive test coverage and acceptance criteria validation

#### Unit Tests

**`src/tests/lib/geometry/extended/schroedinger-quantum.test.ts`**
```typescript
describe('Hermite polynomials', () => {
  test('H_0(x) = 1', () => { ... });
  test('H_1(x) = 2x', () => { ... });
  test('H_2(x) = 4x² - 2', () => { ... });
  // ... through H_6
});

describe('Preset generation', () => {
  test('deterministic with same seed', () => { ... });
  test('different seeds produce different presets', () => { ... });
  test('energy computation is correct', () => { ... });
});

describe('Complex math', () => {
  test('cmul multiplication', () => { ... });
  test('cexp_i unit circle', () => { ... });
});
```

#### Integration Tests

**`src/tests/rendering/schroedinger-volume.test.ts`**
```typescript
describe('SchroedingerMesh', () => {
  test('compiles shader for all dimensions', () => { ... });
  test('uniform arrays have correct size', () => { ... });
  test('preset changes trigger regeneration', () => { ... });
});
```

#### Playwright Visual Tests

**`scripts/playwright/schroedinger-visual.spec.ts`**
```typescript
test('renders without NaN artifacts', async ({ page }) => { ... });
test('morphs over time', async ({ page }) => { ... });
test('rotation produces different cross-sections', async ({ page }) => { ... });
test('D=3 and D=11 both render', async ({ page }) => { ... });
```

#### Acceptance Criteria Checklist (PRD §10)
- [ ] Morphing volume (continuous, no particles)
- [ ] Dimensional rotation shows different cross-sections
- [ ] D=3..11 works without shader compilation errors
- [ ] Interactive performance in fast mode during rotation
- [ ] No NaN/Inf artifacts across parameter ranges
- [ ] Opacity modes still function correctly

#### Tasks
- [ ] Write Hermite polynomial unit tests
- [ ] Write preset generation unit tests
- [ ] Write complex math unit tests
- [ ] Write shader compilation integration tests
- [ ] Write Playwright visual tests
- [ ] Run full acceptance criteria validation
- [ ] Document any known limitations

---

## File Change Summary

### Files to Create (13 new files)
```
src/rendering/shaders/schroedinger/quantum/
├── complex.glsl.ts
├── hermite.glsl.ts
├── ho1d.glsl.ts
├── psi.glsl.ts
└── density.glsl.ts

src/rendering/shaders/schroedinger/volume/
├── absorption.glsl.ts
├── integration.glsl.ts
└── emission.glsl.ts

src/lib/geometry/extended/schroedinger/
└── presets.ts

src/tests/lib/geometry/extended/
└── schroedinger-quantum.test.ts

src/tests/rendering/
└── schroedinger-volume.test.ts

scripts/playwright/
└── schroedinger-visual.spec.ts
```

### Files to Modify (10 files)
```
src/rendering/shaders/schroedinger/
├── compose.ts
├── uniforms.glsl.ts
├── dispatch.glsl.ts
├── normal.glsl.ts
└── main.glsl.ts

src/lib/geometry/extended/types.ts
src/stores/extendedObjectStore.ts
src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx
src/components/sections/Geometry/SchroedingerControls.tsx
src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx
```

### Files to Delete (11 files)
```
src/rendering/shaders/schroedinger/sdf/
├── sdf3d.glsl.ts
├── sdf4d.glsl.ts
├── sdf5d.glsl.ts
├── sdf6d.glsl.ts
├── sdf7d.glsl.ts
├── sdf8d.glsl.ts
├── sdf9d.glsl.ts
├── sdf10d.glsl.ts
├── sdf11d.glsl.ts
├── sdf-high-d.glsl.ts
└── power.glsl.ts
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hermite polynomial instability at high n | Medium | High | Damping factor, limit n_max to 6 |
| Volume rendering too slow | Medium | High | Aggressive early exits, fast mode |
| Shader compilation errors for high D | Low | Medium | Unrolled loops, test all dimensions |
| NaN artifacts from log(0) | Medium | Medium | Epsilon padding (1e-8) |
| Visual results not "organic" enough | Medium | Medium | Tune preset generation, add more presets |

---

## Definition of Done

1. All shader modules compile without errors for D=3..11
2. Volume renders show continuous morphing (no particle artifacts)
3. All unit tests pass with 100% coverage on new code
4. Playwright visual tests confirm rendering quality
5. Performance: 60fps fast mode, 30fps quality mode on mid-range GPU
6. All acceptance criteria from PRD §10 validated
7. Documentation updated with new parameter descriptions
