# Coupled-Map Fractal Implementation Plan

## Overview

This document outlines the implementation plan for adding Coupled-Map Fractals as a new object type to mdimension. Based on [PRD: coupled-map-fractal.md](../prd/coupled-map-fractal.md), this implementation follows established patterns from the Kali fractal renderer.

**Reference Implementation**: `src/rendering/renderers/Kali/` (primary pattern source)

---

## Core Concept

Coupled-Map fractals iterate the formula:
```
z_{n+1} = f(A · z_n + b)
```

Where:
- `A` is an N×N coupling matrix controlling inter-dimensional dependencies
- `b` is an N-dimensional bias vector
- `f` is a nonlinear function (tanh, sin, cubic, logistic, relu)

The orbit density or potential is accumulated across iterations and rendered as an isosurface.

---

## Implementation Phases

### Phase 1: Core Infrastructure (Story 1)
**Dependencies**: None
**Deliverables**: Basic rendering working

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `src/lib/geometry/types.ts` | Add `'coupled-map'` to `ExtendedObjectType` union |
| 1.2 | `src/lib/geometry/extended/coupledMapTypes.ts` | Create type definitions, interfaces, defaults |
| 1.3 | `src/lib/geometry/extended/types.ts` | Export CoupledMapConfig from types barrel |
| 1.4 | `src/stores/slices/geometry/coupledMapSlice.ts` | Create Zustand store slice |
| 1.5 | `src/stores/extendedObjectStore.ts` | Import and combine slice |
| 1.6 | `src/rendering/renderers/CoupledMap/coupled-map.vert` | Vertex shader (fullscreen quad) |
| 1.7 | `src/rendering/renderers/CoupledMap/coupled-map.frag` | Fragment shader (basic iteration) |
| 1.8 | `src/rendering/renderers/CoupledMap/CoupledMapMesh.tsx` | React Three Fiber mesh component |
| 1.9 | `src/rendering/renderers/CoupledMap/index.ts` | Module exports |
| 1.10 | `src/lib/geometry/registry/registry.ts` | Add OBJECT_TYPE_REGISTRY entry |
| 1.11 | `src/lib/geometry/extended/index.ts` | Add generator case |
| 1.12 | `src/rendering/renderers/UnifiedRenderer.tsx` | Add render mode case |
| 1.13 | `src/tests/stores/coupledMapSlice.test.ts` | Store slice tests |

### Phase 2: Parameter Configuration (Stories 2-4)
**Dependencies**: Phase 1
**Deliverables**: Full parameter control

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `coupledMapSlice.ts` | Add coupling matrix setters (simple/advanced modes) |
| 2.2 | `coupledMapTypes.ts` | Add CouplingStructure enum and matrix presets |
| 2.3 | `src/lib/geometry/extended/coupledMapUtils.ts` | Matrix generation utilities (identity, full, ring, etc.) |
| 2.4 | `coupledMapSlice.ts` | Add nonlinearity function setters |
| 2.5 | `coupledMapSlice.ts` | Add bias vector setters |
| 2.6 | `coupled-map.frag` | Implement all 5 nonlinearity functions |
| 2.7 | `src/components/sections/Geometry/CoupledMapControls.tsx` | Basic UI controls |
| 2.8 | `src/lib/geometry/registry/components.ts` | Add component loader |
| 2.9 | `src/tests/geometry/coupledMapUtils.test.ts` | Matrix utility tests |

### Phase 3: Field & Rendering (Stories 5-6)
**Dependencies**: Phase 1
**Deliverables**: Accumulation modes, isosurface control

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `coupledMapTypes.ts` | Add AccumulationMode enum |
| 3.2 | `coupledMapSlice.ts` | Add accumulation mode setters |
| 3.3 | `coupled-map.frag` | Implement 5 accumulation modes |
| 3.4 | `coupledMapSlice.ts` | Add isosurface threshold setters |
| 3.5 | `coupled-map.frag` | Implement isosurface inversion |
| 3.6 | `CoupledMapControls.tsx` | Add accumulation and threshold UI |

### Phase 4: D-Dimensional & Lighting (Stories 7-9)
**Dependencies**: Phase 1, partial Phase 3
**Deliverables**: Full rotation, lighting, shadows

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | `CoupledMapMesh.tsx` | Integrate rotation matrix from store |
| 4.2 | `coupled-map.frag` | Add basis vector uniforms and D-dim coordinate transform |
| 4.3 | `coupled-map.frag` | Add lighting uniforms and calculations |
| 4.4 | `coupled-map.frag` | Add soft shadow raymarching |
| 4.5 | `CoupledMapControls.tsx` | Add lighting/shadow UI sections |

### Phase 5: Color & Opacity (Stories 10-11)
**Dependencies**: Phase 3 (needs accumulation data)
**Deliverables**: Full color system

| Task | File(s) | Description |
|------|---------|-------------|
| 5.1 | `coupledMapTypes.ts` | Add CoupledMapColorMode enum |
| 5.2 | `coupled-map.frag` | Implement coupled-map specific coloring modes |
| 5.3 | `coupledMapTypes.ts` | Add gradient presets (Plasma Flow, Deep Ocean, etc.) |
| 5.4 | `coupled-map.frag` | Implement opacity/transparency modes |
| 5.5 | `CoupledMapControls.tsx` | Add color and opacity UI |

### Phase 6: Animation Systems (Stories 12-14)
**Dependencies**: Phases 2-4
**Deliverables**: All animation modes

| Task | File(s) | Description |
|------|---------|-------------|
| 6.1 | `coupledMapTypes.ts` | Add animation config interfaces |
| 6.2 | `coupledMapSlice.ts` | Add coupling strength animation setters |
| 6.3 | `coupledMapSlice.ts` | Add bias path animation setters |
| 6.4 | `coupledMapSlice.ts` | Add gain animation setters |
| 6.5 | `CoupledMapMesh.tsx` | Pass animation params to shader |
| 6.6 | `coupled-map.frag` | Implement time-based animations |
| 6.7 | `registry.ts` | Add animation system definitions |

### Phase 7: Performance & Quality (Story 15)
**Dependencies**: All previous phases
**Deliverables**: Quality presets, optimization

| Task | File(s) | Description |
|------|---------|-------------|
| 7.1 | `coupledMapTypes.ts` | Add quality preset definitions |
| 7.2 | `coupledMapSlice.ts` | Add quality preset loader |
| 7.3 | `coupled-map.frag` | Implement gradient mode switching (fast/accurate) |
| 7.4 | `CoupledMapMesh.tsx` | Add adaptive quality during interaction |
| 7.5 | `CoupledMapControls.tsx` | Add quality preset UI |
| 7.6 | Performance profiling and optimization |

### Phase 8: Testing & Polish
**Dependencies**: All phases
**Deliverables**: 100% test coverage, documentation

| Task | File(s) | Description |
|------|---------|-------------|
| 8.1 | `src/tests/components/CoupledMapControls.test.tsx` | Component tests |
| 8.2 | `scripts/playwright/coupled-map-e2e.spec.ts` | E2E tests |
| 8.3 | Integration testing across all features |
| 8.4 | Documentation updates |

---

## Type Definitions

### Core Configuration Interface

```typescript
// src/lib/geometry/extended/coupledMapTypes.ts

/** Nonlinearity function applied after matrix multiplication */
export type NonlinearityType = 'tanh' | 'sin' | 'cubic' | 'logistic' | 'relu'

/** Accumulation mode for orbit field generation */
export type AccumulationMode =
  | 'exponential-density'  // acc += exp(-k * dot(z,z))
  | 'distance-minimum'     // acc = min(acc, length(z - trap))
  | 'orbit-average'        // acc = average of |z| over iterations
  | 'lyapunov'             // acc based on trajectory divergence
  | 'recurrence'           // acc based on returns to starting point

/** Coupling matrix structure presets */
export type CouplingStructure = 'identity' | 'full' | 'nearest-neighbor' | 'ring' | 'random'

/** Orbit averaging weight distribution */
export type OrbitWeighting = 'uniform' | 'early-weighted' | 'late-weighted'

/** Bias vector animation path types */
export type BiasPathType = 'circular' | 'lissajous' | 'drift'

/** Coupling strength animation presets */
export type CouplingAnimationPreset = 'breathing' | 'wave' | 'random-walk'

/** Gradient computation method */
export type GradientMode = 'fast' | 'accurate'

/** Coupled-map specific color modes */
export type CoupledMapColorMode = 'orbit-energy' | 'divergence' | 'component-dominance'

// Animation sub-configs
export interface CouplingStrengthAnimation {
  enabled: boolean
  preset: CouplingAnimationPreset
  minStrength: number      // 0.3-1.5
  maxStrength: number      // 0.5-2.0
  frequency: number        // 0.01-0.1 Hz
  perElement: boolean      // Animate individual matrix elements
}

export interface BiasPathAnimation {
  enabled: boolean
  pathType: BiasPathType
  amplitude: number        // 0.1-0.5
  frequency: number        // 0.01-0.1 Hz
  phaseOffsets: number[]   // Per-dimension phases
}

export interface GainAnimation {
  enabled: boolean
  minGain: number          // 0.5-1.5
  maxGain: number          // 1.0-2.5
  frequency: number        // 0.01-0.1 Hz
  perComponent: boolean    // Different phases per dimension
}

// Main configuration interface
export interface CoupledMapConfig {
  // === Core Parameters ===
  couplingMatrix: number[][]           // N×N matrix A (row-major)
  couplingStrength: number             // Global multiplier 0.0-2.0, default 0.7
  couplingStructure: CouplingStructure // Preset structure type
  couplingMatrixMode: 'simple' | 'advanced'
  symmetrizeCoupling: boolean          // Force A = Aᵀ
  normalizeCoupling: boolean           // Scale to prevent explosion

  // === Nonlinearity ===
  nonlinearity: NonlinearityType       // Function type
  nonlinearityGain: number             // 0.5-3.0, default 1.0
  reluLeak: number                     // For ReLU mode, 0.0-0.3
  perComponentGain: boolean            // Different gain per dimension
  componentGains: number[]             // Per-dimension gains

  // === Bias Vector ===
  biasVector: number[]                 // N-dimensional, each -1.0 to 1.0
  lockBiasComponents: boolean          // All components move together

  // === Accumulation ===
  accumulationMode: AccumulationMode
  densityDecayRate: number             // k for exponential, 1.0-10.0
  trapPosition: number[]               // For distance-minimum mode
  orbitWeighting: OrbitWeighting       // For orbit-average mode

  // === Isosurface ===
  isosurfaceThreshold: number          // 0.01-2.0, default 0.3
  autoThreshold: boolean               // Adjust based on field stats
  invertIsosurface: boolean            // Render below threshold

  // === Iteration & Quality ===
  maxIterations: number                // 10-100, default 30
  safetyFactor: number                 // 0.3-0.8, default 0.5
  maxRaymarchSteps: number             // 64-512
  qualityMultiplier: number            // 0.25-1.0
  gradientMode: GradientMode           // 'fast' (2-point) or 'accurate' (6-point)

  // === D-Dimensional ===
  parameterValues: number[]            // For 4D+ slicing
  scale: number                        // Auto-positioning 0.5-5.0

  // === Animation Configs ===
  couplingAnimation: CouplingStrengthAnimation
  biasAnimation: BiasPathAnimation
  gainAnimation: GainAnimation
}

// Quality presets
export const COUPLED_MAP_QUALITY_PRESETS = {
  draft: {
    maxIterations: 15,
    maxRaymarchSteps: 64,
    qualityMultiplier: 0.5,
    gradientMode: 'fast' as GradientMode
  },
  standard: {
    maxIterations: 30,
    maxRaymarchSteps: 128,
    qualityMultiplier: 0.75,
    gradientMode: 'fast' as GradientMode
  },
  high: {
    maxIterations: 50,
    maxRaymarchSteps: 256,
    qualityMultiplier: 1.0,
    gradientMode: 'accurate' as GradientMode
  },
  ultra: {
    maxIterations: 80,
    maxRaymarchSteps: 512,
    qualityMultiplier: 1.0,
    gradientMode: 'accurate' as GradientMode
  },
} as const

// Gradient presets for cosine palette
export const COUPLED_MAP_GRADIENT_PRESETS = [
  { name: 'Plasma Flow', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 0.5], d: [0.8, 0.9, 0.3] },
  { name: 'Deep Ocean', a: [0.0, 0.5, 0.5], b: [0.0, 0.5, 0.5], c: [0.0, 0.5, 0.33], d: [0.0, 0.5, 0.67] },
  { name: 'Aurora', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 0.7, 0.4], d: [0.0, 0.15, 0.2] },
  { name: 'Thermal', a: [0.5, 0.0, 0.0], b: [0.5, 0.0, 0.0], c: [0.5, 0.5, 0.0], d: [0.5, 1.0, 0.5] },
] as const

// Default configuration
export const DEFAULT_COUPLED_MAP_CONFIG: CoupledMapConfig = {
  // Core - conservative defaults for stability
  couplingMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  couplingStrength: 0.7,
  couplingStructure: 'identity',
  couplingMatrixMode: 'simple',
  symmetrizeCoupling: false,
  normalizeCoupling: true,

  // Nonlinearity
  nonlinearity: 'tanh',
  nonlinearityGain: 1.0,
  reluLeak: 0.1,
  perComponentGain: false,
  componentGains: [1.0, 1.0, 1.0, 1.0],

  // Bias
  biasVector: [0.0, 0.0, 0.0, 0.0],
  lockBiasComponents: false,

  // Accumulation
  accumulationMode: 'exponential-density',
  densityDecayRate: 3.0,
  trapPosition: [0.0, 0.0, 0.0, 0.0],
  orbitWeighting: 'uniform',

  // Isosurface
  isosurfaceThreshold: 0.3,
  autoThreshold: false,
  invertIsosurface: false,

  // Quality
  maxIterations: 30,
  safetyFactor: 0.5,
  maxRaymarchSteps: 128,
  qualityMultiplier: 1.0,
  gradientMode: 'fast',

  // D-dimensional
  parameterValues: [],
  scale: 2.0,

  // Animations - disabled by default
  couplingAnimation: {
    enabled: false,
    preset: 'breathing',
    minStrength: 0.5,
    maxStrength: 1.0,
    frequency: 0.02,
    perElement: false,
  },
  biasAnimation: {
    enabled: false,
    pathType: 'circular',
    amplitude: 0.2,
    frequency: 0.02,
    phaseOffsets: [0, 0, 0, 0],
  },
  gainAnimation: {
    enabled: false,
    minGain: 0.8,
    maxGain: 1.5,
    frequency: 0.015,
    perComponent: false,
  },
}
```

---

## Shader Architecture

### Uniform Structure

```glsl
// coupled-map.frag

#version 300 es
precision highp float;

// Output
layout(location = 0) out vec4 fragColor;

// Core parameters
uniform float uCouplingMatrix[121];    // 11×11 flattened (row-major)
uniform float uCouplingStrength;
uniform float uBiasVector[11];
uniform int uNonlinearityType;         // 0=tanh, 1=sin, 2=cubic, 3=logistic, 4=relu
uniform float uNonlinearityGain;
uniform float uReluLeak;
uniform float uComponentGains[11];
uniform bool uPerComponentGain;

// Accumulation
uniform int uAccumulationMode;         // 0=exp-density, 1=dist-min, 2=orbit-avg, 3=lyapunov, 4=recurrence
uniform float uDensityDecayRate;
uniform float uTrapPosition[11];
uniform int uOrbitWeighting;

// Isosurface
uniform float uIsosurfaceThreshold;
uniform bool uInvertIsosurface;

// Quality
uniform int uMaxIterations;
uniform float uSafetyFactor;
uniform int uMaxRaymarchSteps;

// D-dimensional
uniform int uDimension;
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];
uniform float uScale;

// Time for animations
uniform float uTime;

// Animation params
uniform bool uCouplingAnimEnabled;
uniform float uCouplingAnimMin;
uniform float uCouplingAnimMax;
uniform float uCouplingAnimFreq;
// ... etc
```

### Core Functions

```glsl
// Matrix-vector multiplication (D-dimensional)
void matVecMul(out float result[11], float mat[121], float vec[11], int dim) {
  for (int i = 0; i < dim; i++) {
    result[i] = 0.0;
    for (int j = 0; j < dim; j++) {
      result[i] += mat[i * 11 + j] * vec[j];
    }
  }
}

// Nonlinearity functions
float applyNonlinearity(float x, float gain, int type) {
  if (type == 0) return tanh(gain * x);
  if (type == 1) return sin(gain * x);
  if (type == 2) return x - x*x*x;  // cubic
  if (type == 3) return 4.0 * x * (1.0 - x);  // logistic
  if (type == 4) return x > 0.0 ? x : uReluLeak * x;  // relu
  return x;
}

// Apply nonlinearity to vector
void applyNonlinearityVec(inout float z[11], int dim) {
  for (int i = 0; i < dim; i++) {
    float g = uPerComponentGain ? uComponentGains[i] : uNonlinearityGain;
    z[i] = applyNonlinearity(z[i], g, uNonlinearityType);
  }
}

// Coupled map iteration: z = f(A*z + b)
void iterate(inout float z[11], int dim) {
  float temp[11];

  // Matrix multiplication
  matVecMul(temp, uCouplingMatrix, z, dim);

  // Scale by coupling strength and add bias
  for (int i = 0; i < dim; i++) {
    z[i] = uCouplingStrength * temp[i] + uBiasVector[i];
  }

  // Apply nonlinearity
  applyNonlinearityVec(z, dim);
}

// Accumulate field value based on mode
float accumulate(float z[11], float prevAcc, int iter, int dim) {
  float magSq = dot_d(z, z, dim);

  if (uAccumulationMode == 0) {
    // Exponential density
    return prevAcc + exp(-uDensityDecayRate * magSq);
  }
  else if (uAccumulationMode == 1) {
    // Distance minimum
    float dist = distance_d(z, uTrapPosition, dim);
    return min(prevAcc, dist);
  }
  else if (uAccumulationMode == 2) {
    // Orbit average (weighted)
    float weight = 1.0;
    if (uOrbitWeighting == 1) weight = float(uMaxIterations - iter) / float(uMaxIterations);
    if (uOrbitWeighting == 2) weight = float(iter) / float(uMaxIterations);
    return prevAcc + sqrt(magSq) * weight;
  }
  // ... lyapunov and recurrence modes

  return prevAcc;
}
```

---

## Registry Entry

```typescript
// In src/lib/geometry/registry/registry.ts

'coupled-map': {
  type: 'coupled-map',
  name: 'Coupled Map',
  description: 'Organic dynamical system sculptures from coupled nonlinear maps',
  category: 'fractal',
  dimensions: {
    min: 3,
    max: 11,
    default: 4,
  },
  rendering: {
    supportsRaymarching: true,
    requiresRaymarching: true,
    renderMode: 'raymarch-coupled-map',
    hasCustomRenderer: true,
    customRendererKey: 'CoupledMapMesh',
  },
  animation: {
    hasTypeSpecificAnimations: true,
    systems: {
      couplingAnimation: {
        name: 'Coupling Animation',
        description: 'Animate coupling matrix strength for pulsing dynamics',
        enabledByDefault: false,
        enabledKey: 'couplingAnimation.enabled',
        params: {
          'couplingAnimation.minStrength': { min: 0.3, max: 1.5, default: 0.5, step: 0.05, label: 'Min Strength' },
          'couplingAnimation.maxStrength': { min: 0.5, max: 2.0, default: 1.0, step: 0.05, label: 'Max Strength' },
          'couplingAnimation.frequency': { min: 0.01, max: 0.1, default: 0.02, step: 0.005, label: 'Frequency' },
        },
      },
      biasAnimation: {
        name: 'Bias Path Animation',
        description: 'Animate bias vector along paths through parameter space',
        enabledByDefault: false,
        enabledKey: 'biasAnimation.enabled',
        params: {
          'biasAnimation.amplitude': { min: 0.1, max: 0.5, default: 0.2, step: 0.05, label: 'Amplitude' },
          'biasAnimation.frequency': { min: 0.01, max: 0.1, default: 0.02, step: 0.005, label: 'Frequency' },
        },
      },
      gainAnimation: {
        name: 'Gain Animation',
        description: 'Animate nonlinearity gain for varying sharpness',
        enabledByDefault: false,
        enabledKey: 'gainAnimation.enabled',
        params: {
          'gainAnimation.minGain': { min: 0.5, max: 1.5, default: 0.8, step: 0.05, label: 'Min Gain' },
          'gainAnimation.maxGain': { min: 1.0, max: 2.5, default: 1.5, step: 0.05, label: 'Max Gain' },
          'gainAnimation.frequency': { min: 0.01, max: 0.1, default: 0.015, step: 0.005, label: 'Frequency' },
        },
      },
    },
  },
  urlSerialization: {
    parameters: [
      'couplingStrength',
      'nonlinearity',
      'nonlinearityGain',
      'accumulationMode',
      'isosurfaceThreshold',
      'maxIterations',
    ],
  },
  ui: {
    controlsComponentKey: 'CoupledMapControls',
    hasTimelineControls: true,
    icon: 'waves',  // Suggest organic flowing icon
  },
  configStoreKey: 'coupledMap',
} as const,
```

---

## File Structure

### New Files to Create

```
src/
├── lib/geometry/extended/
│   ├── coupledMapTypes.ts          # Type definitions
│   └── coupledMapUtils.ts          # Matrix utilities
├── stores/slices/geometry/
│   └── coupledMapSlice.ts          # Zustand slice
├── rendering/renderers/CoupledMap/
│   ├── index.ts                    # Exports
│   ├── CoupledMapMesh.tsx          # R3F mesh component
│   ├── coupled-map.vert            # Vertex shader
│   └── coupled-map.frag            # Fragment shader
├── components/sections/Geometry/
│   └── CoupledMapControls.tsx      # UI controls
└── tests/
    ├── stores/
    │   └── coupledMapSlice.test.ts # Store tests
    ├── geometry/
    │   └── coupledMapUtils.test.ts # Utility tests
    └── components/
        └── CoupledMapControls.test.tsx

scripts/playwright/
└── coupled-map-e2e.spec.ts         # E2E tests
```

### Files to Modify

```
src/lib/geometry/types.ts                    # Add 'coupled-map' to union
src/lib/geometry/extended/types.ts           # Export new types
src/lib/geometry/extended/index.ts           # Add generator case
src/lib/geometry/registry/registry.ts        # Add registry entry
src/lib/geometry/registry/components.ts      # Add component loader
src/stores/extendedObjectStore.ts            # Import slice
src/rendering/renderers/UnifiedRenderer.tsx  # Add render mode
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Matrix explosion | Default `normalizeCoupling: true`, clamp matrix elements |
| Poor performance | Default to cheap accumulation mode, quality presets |
| Complex UI | Simple mode hides advanced controls |
| Shader compilation | Test on multiple GPUs, provide fallbacks |
| Memory limits | Cap array sizes at 11 dimensions |

---

## Success Criteria

1. **Visual Quality**: Organic, flowing structures render correctly
2. **Performance**: 30+ fps at default quality settings
3. **Stability**: No NaN/Infinity values, bounded iteration
4. **Completeness**: All 15 user stories implemented
5. **Test Coverage**: 100% coverage per project mandate
6. **Documentation**: Controls have tooltips, presets are discoverable

---

## Open Questions (From PRD)

- [ ] Should there be a "chaos indicator" showing Lyapunov exponent?
- [ ] Should coupling matrix support complex values?
- [ ] Should there be preset "attractor types" (Lorenz-like, Rossler-like)?

---

## References

- PRD: [docs/prd/coupled-map-fractal.md](../prd/coupled-map-fractal.md)
- Math Foundation: [docs/prd/extended-fractal-types.md](../prd/extended-fractal-types.md) Section 7
- Reference Implementation: `src/rendering/renderers/Kali/`
- Style Guide: [docs/meta/styleguide.md](../meta/styleguide.md)
