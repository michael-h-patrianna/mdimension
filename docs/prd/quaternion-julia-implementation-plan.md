# Quaternion Julia Fractal - Implementation Plan

## Overview

Implementation of the Quaternion Julia fractal type following the Hyperbulb (Mandelbulb) pattern. This plan ensures feature parity with existing raymarched fractals including scale parameter, walls auto-positioning, and proper registration for "Faces" render mode.

---

## File Summary

### New Files (9 files)

| File | Purpose |
|------|---------|
| `src/rendering/renderers/QuaternionJulia/QuaternionJuliaMesh.tsx` | Main React/R3F mesh component |
| `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag` | Fragment shader (raymarching) |
| `src/rendering/renderers/QuaternionJulia/quaternion-julia.vert` | Vertex shader (passthrough) |
| `src/rendering/renderers/QuaternionJulia/index.ts` | Module export |
| `src/stores/slices/geometry/quaternionJuliaSlice.ts` | Zustand store slice |
| `src/components/sections/Geometry/QuaternionJuliaControls.tsx` | UI control panel |
| `src/tests/components/canvas/QuaternionJuliaMesh.test.tsx` | Mesh component tests |
| `src/tests/components/controls/QuaternionJuliaControls.test.tsx` | Controls component tests |
| `src/lib/geometry/extended/quaternion-julia/index.ts` | (Optional) Point cloud generation |

### Modified Files (7 files)

| File | Changes |
|------|---------|
| `src/lib/geometry/types.ts` | Add `'quaternion-julia'` to `ExtendedObjectType` |
| `src/lib/geometry/extended/types.ts` | Add `QuaternionJuliaConfig` interface + defaults |
| `src/stores/slices/geometry/types.ts` | Add `QuaternionJuliaSlice` type |
| `src/stores/extendedObjectStore.ts` | Import and combine slice |
| `src/rendering/renderers/UnifiedRenderer.tsx` | Add render mode + component |
| `src/components/sections/RenderMode/RenderModeToggles.tsx` | Add to face/raymarched checks |
| `src/components/sections/Geometry/ObjectSettingsSection.tsx` | Add controls conditional |

---

## Phase 1: Type System & Store Foundation

### 1.1 Add Object Type Registration

**File: `src/lib/geometry/types.ts`**

```typescript
// Line 18-25: Add to ExtendedObjectType union
export type ExtendedObjectType =
  | 'root-system'
  | 'clifford-torus'
  | 'nested-torus'
  | 'mandelbrot'
  | 'mandelbox'
  | 'menger'
  | 'quaternion-julia'  // ADD THIS

// Line 45-54: Add to isExtendedObjectType function
export function isExtendedObjectType(type: string): type is ExtendedObjectType {
  return (
    type === 'root-system' ||
    type === 'clifford-torus' ||
    type === 'nested-torus' ||
    type === 'mandelbrot' ||
    type === 'mandelbox' ||
    type === 'menger' ||
    type === 'quaternion-julia'  // ADD THIS
  )
}
```

### 1.2 Create QuaternionJuliaConfig Interface

**File: `src/lib/geometry/extended/types.ts`**

Add after `MengerConfig` (around line 900+):

```typescript
/**
 * Julia constant preset for Quaternion Julia sets
 */
export interface JuliaConstantPreset {
  name: string
  value: [number, number, number, number]
}

/**
 * Julia constant animation parameters
 */
export interface JuliaConstantAnimation {
  enabled: boolean
  amplitude: [number, number, number, number]  // Per-component amplitude (0-1)
  frequency: [number, number, number, number]  // Per-component frequency Hz (0.01-0.5)
  phase: [number, number, number, number]      // Per-component phase offset (0-2π)
}

/**
 * Power animation parameters for Quaternion Julia
 */
export interface JuliaPowerAnimation {
  enabled: boolean
  minPower: number   // 2.0-10.0
  maxPower: number   // 2.0-16.0
  speed: number      // Hz (0.01-0.2)
}

/**
 * Configuration for Quaternion Julia fractal generation
 *
 * Mathematical basis: z = z^n + c where z and c are quaternions
 * The Julia constant c is fixed (unlike Mandelbrot where c = initial position)
 */
export interface QuaternionJuliaConfig {
  /**
   * Julia constant c (4D quaternion components)
   * Default: [0.3, 0.5, 0.4, 0.2] ("Classic Bubble")
   */
  juliaConstant: [number, number, number, number]

  /**
   * Iteration power (2-8, default 2 for quadratic)
   * Higher powers create more complex folding patterns
   */
  power: number

  /**
   * Maximum iterations before escape (32-256, default 64)
   */
  maxIterations: number

  /**
   * Bailout/escape radius (2.0-16.0, default 4.0)
   */
  bailoutRadius: number

  /**
   * Scale/extent parameter for auto-positioning (0.5-5.0, default 2.0)
   * Controls the sampling volume - larger values show more of the fractal
   */
  scale: number

  /**
   * Surface distance threshold for raymarching (0.0005-0.004)
   */
  surfaceThreshold: number

  /**
   * Maximum raymarch steps (64-512)
   */
  maxRaymarchSteps: number

  /**
   * Quality multiplier for fine-tuning (0.25-1.0, default 1.0)
   */
  qualityMultiplier: number

  /**
   * D-dimensional rotation parameter values (for dimensions 4-11)
   */
  parameterValues: number[]

  // === Color Configuration ===
  colorMode: number          // 0-7 matching existing color algorithms
  baseColor: string          // Hex color for monochromatic/analogous
  cosineCoefficients: {
    a: [number, number, number]
    b: [number, number, number]
    c: [number, number, number]
    d: [number, number, number]
  }
  colorPower: number         // 0.25-4.0
  colorCycles: number        // 0.5-5.0
  colorOffset: number        // 0.0-1.0
  lchLightness: number       // 0.1-1.0
  lchChroma: number          // 0.0-0.4

  // === Opacity Configuration ===
  opacityMode: number        // 0=Solid, 1=SimpleAlpha, 2=Layered, 3=Volumetric
  opacity: number            // 0.0-1.0 for SimpleAlpha
  layerCount: number         // 2-4 for Layered mode
  layerOpacity: number       // 0.1-0.9 for Layered mode
  volumetricDensity: number  // 0.1-2.0 for Volumetric mode

  // === Shadow Configuration ===
  shadowEnabled: boolean
  shadowQuality: number      // 0=Low(16), 1=Medium(32), 2=High(64), 3=Ultra(128)
  shadowSoftness: number     // 0.0-2.0
  shadowAnimationMode: number // 0=Pause, 1=Low, 2=Full

  // === Animation Configuration ===
  juliaConstantAnimation: JuliaConstantAnimation
  powerAnimation: JuliaPowerAnimation
  originDriftEnabled: boolean
  originDriftAmplitude: number
  originDriftBaseFrequency: number
  originDriftFrequencySpread: number
}

/**
 * Julia constant presets
 */
export const JULIA_CONSTANT_PRESETS: JuliaConstantPreset[] = [
  { name: 'Classic Bubble', value: [0.3, 0.5, 0.4, 0.2] },
  { name: 'Tentacles', value: [-0.2, 0.8, 0.0, -0.3] },
  { name: 'Coral', value: [0.1, -0.1, 0.2, 0.7] },
  { name: 'Sponge', value: [-0.4, -0.4, 0.4, 0.4] },
  { name: 'Whiskers', value: [0.5, 0.5, 0.5, -0.5] },
]

/**
 * Quality presets for Quaternion Julia
 */
export const QUATERNION_JULIA_QUALITY_PRESETS = {
  draft: { maxIterations: 32, surfaceThreshold: 0.004, maxRaymarchSteps: 64 },
  standard: { maxIterations: 64, surfaceThreshold: 0.002, maxRaymarchSteps: 128 },
  high: { maxIterations: 128, surfaceThreshold: 0.001, maxRaymarchSteps: 256 },
  ultra: { maxIterations: 256, surfaceThreshold: 0.0005, maxRaymarchSteps: 512 },
}

/**
 * Default configuration for Quaternion Julia
 */
export const DEFAULT_QUATERNION_JULIA_CONFIG: QuaternionJuliaConfig = {
  juliaConstant: [0.3, 0.5, 0.4, 0.2],
  power: 2,
  maxIterations: 64,
  bailoutRadius: 4.0,
  scale: 2.0,
  surfaceThreshold: 0.002,
  maxRaymarchSteps: 128,
  qualityMultiplier: 1.0,
  parameterValues: [],

  // Color defaults
  colorMode: 2, // Cosine gradient
  baseColor: '#4488ff',
  cosineCoefficients: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  colorPower: 1.0,
  colorCycles: 1.0,
  colorOffset: 0.0,
  lchLightness: 0.7,
  lchChroma: 0.15,

  // Opacity defaults
  opacityMode: 0, // Solid
  opacity: 1.0,
  layerCount: 2,
  layerOpacity: 0.5,
  volumetricDensity: 1.0,

  // Shadow defaults
  shadowEnabled: false,
  shadowQuality: 1, // Medium
  shadowSoftness: 1.0,
  shadowAnimationMode: 1, // Low

  // Animation defaults
  juliaConstantAnimation: {
    enabled: false,
    amplitude: [0.3, 0.3, 0.3, 0.3],
    frequency: [0.05, 0.04, 0.06, 0.03],
    phase: [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4],
  },
  powerAnimation: {
    enabled: false,
    minPower: 2.0,
    maxPower: 8.0,
    speed: 0.03,
  },
  originDriftEnabled: false,
  originDriftAmplitude: 0.03,
  originDriftBaseFrequency: 0.04,
  originDriftFrequencySpread: 0.2,
}
```

Also add to `ExtendedObjectConfig`:
```typescript
export interface ExtendedObjectConfig {
  // ... existing properties
  quaternionJulia: QuaternionJuliaConfig  // ADD THIS
}
```

### 1.3 Create Store Slice

**File: `src/stores/slices/geometry/quaternionJuliaSlice.ts`** (NEW)

```typescript
/**
 * Quaternion Julia Store Slice
 *
 * State management for Quaternion Julia fractal parameters.
 * Follows the pattern established by mandelbrotSlice and mandelboxSlice.
 */

import type { StateCreator } from 'zustand'
import {
  DEFAULT_QUATERNION_JULIA_CONFIG,
  type QuaternionJuliaConfig,
} from '@/lib/geometry/extended/types'
import type { ExtendedObjectSlice } from './types'

export interface QuaternionJuliaSliceState {
  quaternionJulia: QuaternionJuliaConfig
}

export interface QuaternionJuliaSliceActions {
  // Core parameters
  setQuaternionJuliaConstant: (value: [number, number, number, number]) => void
  setQuaternionJuliaPower: (value: number) => void
  setQuaternionJuliaMaxIterations: (value: number) => void
  setQuaternionJuliaBailoutRadius: (value: number) => void
  setQuaternionJuliaScale: (value: number) => void

  // Quality parameters
  setQuaternionJuliaSurfaceThreshold: (value: number) => void
  setQuaternionJuliaMaxRaymarchSteps: (value: number) => void
  setQuaternionJuliaQualityMultiplier: (value: number) => void
  setQuaternionJuliaQualityPreset: (preset: 'draft' | 'standard' | 'high' | 'ultra') => void

  // D-dimensional parameters
  setQuaternionJuliaParameterValue: (index: number, value: number) => void
  initializeQuaternionJuliaForDimension: (dimension: number) => void

  // Color parameters
  setQuaternionJuliaColorMode: (value: number) => void
  setQuaternionJuliaBaseColor: (value: string) => void
  setQuaternionJuliaCosineCoefficients: (coefficients: QuaternionJuliaConfig['cosineCoefficients']) => void
  setQuaternionJuliaColorPower: (value: number) => void
  setQuaternionJuliaColorCycles: (value: number) => void
  setQuaternionJuliaColorOffset: (value: number) => void

  // Opacity parameters
  setQuaternionJuliaOpacityMode: (value: number) => void
  setQuaternionJuliaOpacity: (value: number) => void

  // Shadow parameters
  setQuaternionJuliaShadowEnabled: (value: boolean) => void
  setQuaternionJuliaShadowQuality: (value: number) => void
  setQuaternionJuliaShadowSoftness: (value: number) => void

  // Animation parameters
  setQuaternionJuliaConstantAnimationEnabled: (value: boolean) => void
  setQuaternionJuliaPowerAnimationEnabled: (value: boolean) => void
  setQuaternionJuliaOriginDriftEnabled: (value: boolean) => void

  // Utility
  getQuaternionJuliaConfig: () => QuaternionJuliaConfig
  randomizeJuliaConstant: () => void
}

export type QuaternionJuliaSlice = QuaternionJuliaSliceState & QuaternionJuliaSliceActions

export const createQuaternionJuliaSlice: StateCreator<
  ExtendedObjectSlice,
  [],
  [],
  QuaternionJuliaSlice
> = (set, get) => ({
  quaternionJulia: { ...DEFAULT_QUATERNION_JULIA_CONFIG },

  setQuaternionJuliaConstant: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, juliaConstant: value },
    }))
  },

  setQuaternionJuliaPower: (value) => {
    const clamped = Math.max(2, Math.min(8, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, power: clamped },
    }))
  },

  setQuaternionJuliaMaxIterations: (value) => {
    const clamped = Math.max(8, Math.min(512, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, maxIterations: clamped },
    }))
  },

  setQuaternionJuliaBailoutRadius: (value) => {
    const clamped = Math.max(2.0, Math.min(16.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, bailoutRadius: clamped },
    }))
  },

  setQuaternionJuliaScale: (value) => {
    const clamped = Math.max(0.5, Math.min(5.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, scale: clamped },
    }))
  },

  setQuaternionJuliaSurfaceThreshold: (value) => {
    const clamped = Math.max(0.0001, Math.min(0.01, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, surfaceThreshold: clamped },
    }))
  },

  setQuaternionJuliaMaxRaymarchSteps: (value) => {
    const clamped = Math.max(32, Math.min(1024, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, maxRaymarchSteps: clamped },
    }))
  },

  setQuaternionJuliaQualityMultiplier: (value) => {
    const clamped = Math.max(0.25, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, qualityMultiplier: clamped },
    }))
  },

  setQuaternionJuliaQualityPreset: (preset) => {
    const presets = {
      draft: { maxIterations: 32, surfaceThreshold: 0.004, maxRaymarchSteps: 64 },
      standard: { maxIterations: 64, surfaceThreshold: 0.002, maxRaymarchSteps: 128 },
      high: { maxIterations: 128, surfaceThreshold: 0.001, maxRaymarchSteps: 256 },
      ultra: { maxIterations: 256, surfaceThreshold: 0.0005, maxRaymarchSteps: 512 },
    }
    const settings = presets[preset]
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, ...settings },
    }))
  },

  setQuaternionJuliaParameterValue: (index, value) => {
    set((state) => {
      const newValues = [...state.quaternionJulia.parameterValues]
      if (index >= 0 && index < newValues.length) {
        newValues[index] = Math.max(-Math.PI, Math.min(Math.PI, value))
      }
      return {
        quaternionJulia: { ...state.quaternionJulia, parameterValues: newValues },
      }
    })
  },

  initializeQuaternionJuliaForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3)
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        parameterValues: new Array(paramCount).fill(0),
        // Adjust scale for higher dimensions
        scale: dimension <= 4 ? 2.0 : 2.5,
      },
    }))
  },

  setQuaternionJuliaColorMode: (value) => {
    const clamped = Math.max(0, Math.min(7, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorMode: clamped },
    }))
  },

  setQuaternionJuliaBaseColor: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, baseColor: value },
    }))
  },

  setQuaternionJuliaCosineCoefficients: (coefficients) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, cosineCoefficients: coefficients },
    }))
  },

  setQuaternionJuliaColorPower: (value) => {
    const clamped = Math.max(0.25, Math.min(4.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorPower: clamped },
    }))
  },

  setQuaternionJuliaColorCycles: (value) => {
    const clamped = Math.max(0.5, Math.min(5.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorCycles: clamped },
    }))
  },

  setQuaternionJuliaColorOffset: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, colorOffset: clamped },
    }))
  },

  setQuaternionJuliaOpacityMode: (value) => {
    const clamped = Math.max(0, Math.min(3, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, opacityMode: clamped },
    }))
  },

  setQuaternionJuliaOpacity: (value) => {
    const clamped = Math.max(0.0, Math.min(1.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, opacity: clamped },
    }))
  },

  setQuaternionJuliaShadowEnabled: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowEnabled: value },
    }))
  },

  setQuaternionJuliaShadowQuality: (value) => {
    const clamped = Math.max(0, Math.min(3, Math.round(value)))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowQuality: clamped },
    }))
  },

  setQuaternionJuliaShadowSoftness: (value) => {
    const clamped = Math.max(0.0, Math.min(2.0, value))
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, shadowSoftness: clamped },
    }))
  },

  setQuaternionJuliaConstantAnimationEnabled: (value) => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        juliaConstantAnimation: {
          ...state.quaternionJulia.juliaConstantAnimation,
          enabled: value,
        },
      },
    }))
  },

  setQuaternionJuliaPowerAnimationEnabled: (value) => {
    set((state) => ({
      quaternionJulia: {
        ...state.quaternionJulia,
        powerAnimation: {
          ...state.quaternionJulia.powerAnimation,
          enabled: value,
        },
      },
    }))
  },

  setQuaternionJuliaOriginDriftEnabled: (value) => {
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, originDriftEnabled: value },
    }))
  },

  getQuaternionJuliaConfig: () => get().quaternionJulia,

  randomizeJuliaConstant: () => {
    const randomComponent = () => (Math.random() * 2 - 1) * 0.8 // Range: -0.8 to 0.8
    const newConstant: [number, number, number, number] = [
      randomComponent(),
      randomComponent(),
      randomComponent(),
      randomComponent(),
    ]
    set((state) => ({
      quaternionJulia: { ...state.quaternionJulia, juliaConstant: newConstant },
    }))
  },
})
```

### 1.4 Update Store Types

**File: `src/stores/slices/geometry/types.ts`**

Add import and type:
```typescript
import type { QuaternionJuliaSlice } from './quaternionJuliaSlice'

// Add to the combined slice type (around line where other slices are combined)
export type ExtendedObjectSlice =
  MandelbrotSlice &
  MandelboxSlice &
  MengerSlice &
  QuaternionJuliaSlice &  // ADD THIS
  // ... other slices
```

### 1.5 Update Extended Object Store

**File: `src/stores/extendedObjectStore.ts`**

```typescript
// Add import
import { createQuaternionJuliaSlice } from './slices/geometry/quaternionJuliaSlice'
import { DEFAULT_QUATERNION_JULIA_CONFIG } from '@/lib/geometry/extended/types'

// In create() function, add the slice
export const useExtendedObjectStore = create<ExtendedObjectSlice>()((...a) => ({
  ...createMandelbrotSlice(...a),
  ...createMandelboxSlice(...a),
  ...createMengerSlice(...a),
  ...createQuaternionJuliaSlice(...a),  // ADD THIS
  // ... other slices
}))

// In reset() if present, add:
quaternionJulia: { ...DEFAULT_QUATERNION_JULIA_CONFIG },
```

---

## Phase 2: GPU Renderer

### 2.1 Vertex Shader

**File: `src/rendering/renderers/QuaternionJulia/quaternion-julia.vert`** (NEW)

```glsl
#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

out vec2 vUv;
out vec3 vPosition;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### 2.2 Fragment Shader (Core Raymarching)

**File: `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag`** (NEW)

This shader implements the quaternion Julia set iteration: `z = z^n + c`

Key sections:
1. Uniforms declaration (matching HyperbulbMesh uniforms)
2. Quaternion multiplication and power functions
3. Distance estimator for quaternion Julia
4. Raymarching loop
5. Normal estimation via gradient
6. Lighting calculation
7. Color algorithms (8 modes)
8. Opacity modes
9. Shadow calculation

The shader should be ~1500-2000 lines following the `hyperbulb.frag` structure but with:
- Quaternion-specific iteration: `z = quatPow(z, power) + c` where `c` is uniform, not position-derived
- Julia constant uniform `uJuliaConstant` (vec4)
- All existing lighting, color, opacity, and shadow systems

### 2.3 Mesh Component

**File: `src/rendering/renderers/QuaternionJulia/QuaternionJuliaMesh.tsx`** (NEW)

Follow `HyperbulbMesh.tsx` pattern (~700 lines) with these changes:
- Read from `quaternionJulia` store slice
- Add `uJuliaConstant` uniform (vec4)
- Add Julia constant animation in useFrame
- Import quaternion-julia shaders

Key uniforms to add:
```typescript
uJuliaConstant: { value: new THREE.Vector4() },
uJuliaConstantAnimated: { value: new THREE.Vector4() },
```

Key useFrame updates:
```typescript
// Julia constant animation
if (config.juliaConstantAnimation.enabled && isPlaying) {
  const { amplitude, frequency, phase } = config.juliaConstantAnimation;
  uniforms.uJuliaConstantAnimated.value.set(
    config.juliaConstant[0] + amplitude[0] * Math.sin(frequency[0] * time + phase[0]),
    config.juliaConstant[1] + amplitude[1] * Math.cos(frequency[1] * time + phase[1]),
    config.juliaConstant[2] + amplitude[2] * Math.sin(frequency[2] * time + phase[2]),
    config.juliaConstant[3] + amplitude[3] * Math.cos(frequency[3] * time + phase[3]),
  );
} else {
  uniforms.uJuliaConstantAnimated.value.set(...config.juliaConstant);
}
```

### 2.4 Module Export

**File: `src/rendering/renderers/QuaternionJulia/index.ts`** (NEW)

```typescript
export { default as QuaternionJuliaMesh } from './QuaternionJuliaMesh'
```

---

## Phase 3: Registration for Faces Render Mode

### 3.1 UnifiedRenderer Registration (3 locations)

**File: `src/rendering/renderers/UnifiedRenderer.tsx`**

```typescript
// 1. Import (line ~24)
import QuaternionJuliaMesh from './QuaternionJulia/QuaternionJuliaMesh';

// 2. RenderMode type (line 30)
export type RenderMode =
  | 'polytope'
  | 'raymarch-mandelbrot'
  | 'raymarch-mandelbox'
  | 'raymarch-menger'
  | 'raymarch-quaternion-julia'  // ADD THIS
  | 'none';

// 3. determineRenderMode function (after line 76, before mandelbrot check)
if (objectType === 'quaternion-julia' && dimension >= 3) {
  return facesVisible ? 'raymarch-quaternion-julia' : 'none';
}

// 4. JSX render conditional (after line 144)
{renderMode === 'raymarch-quaternion-julia' && <QuaternionJuliaMesh />}
```

### 3.2 RenderModeToggles Registration (2 locations)

**File: `src/components/sections/RenderMode/RenderModeToggles.tsx`**

```typescript
// 1. canRenderFaces function (line 42-52)
function canRenderFaces(objectType: string): boolean {
  const polytopeTypes = ['hypercube', 'simplex', 'cross-polytope'];
  return (
    polytopeTypes.includes(objectType) ||
    objectType === 'root-system' ||
    objectType === 'mandelbrot' ||
    objectType === 'mandelbox' ||
    objectType === 'menger' ||
    objectType === 'quaternion-julia' ||  // ADD THIS
    objectType === 'clifford-torus' ||
    objectType === 'nested-torus'
  );
}

// 2. isRaymarchedFractal function (line 73-79)
function isRaymarchedFractal(objectType: string, dimension: number): boolean {
  return (
    (objectType === 'mandelbrot' && dimension >= 3) ||
    (objectType === 'mandelbox' && dimension >= 3) ||
    (objectType === 'menger' && dimension >= 3) ||
    (objectType === 'quaternion-julia' && dimension >= 3)  // ADD THIS
  );
}
```

---

## Phase 4: UI Controls

### 4.1 QuaternionJuliaControls Component

**File: `src/components/sections/Geometry/QuaternionJuliaControls.tsx`** (NEW)

Follow `MandelbrotControls.tsx` pattern with these sections:
1. Quality preset dropdown (Draft/Standard/High/Ultra)
2. Julia constant sliders (c.x, c.y, c.z, c.w) with range -2 to 2
3. Julia constant preset dropdown
4. Randomize button
5. Power slider (2-8)
6. Scale slider (0.5-5.0) - **important: user-requested**
7. Max iterations slider
8. Bailout radius slider
9. D-dimensional parameter sliders (for dimensions 4+)
10. Color mode selector
11. Animation toggles

### 4.2 ObjectSettingsSection Update

**File: `src/components/sections/Geometry/ObjectSettingsSection.tsx`**

```typescript
// Import
import { QuaternionJuliaControls } from './QuaternionJuliaControls'

// Add conditional (around line 57-60)
{objectType === 'quaternion-julia' && <QuaternionJuliaControls />}
```

---

## Phase 5: Tests

### 5.1 Mesh Component Tests

**File: `src/tests/components/canvas/QuaternionJuliaMesh.test.tsx`** (NEW)

Test cases:
- Renders without crashing
- Creates ShaderMaterial with correct uniforms
- Updates uniforms on store changes
- Handles dimension changes
- Animation updates work correctly
- Cleanup on unmount

### 5.2 Controls Component Tests

**File: `src/tests/components/controls/QuaternionJuliaControls.test.tsx`** (NEW)

Test cases:
- Renders all control sections
- Quality preset changes update store
- Julia constant sliders update store
- Preset dropdown loads correct values
- Randomize button generates valid constants
- Power slider respects bounds
- Scale slider respects bounds

---

## Summary: All Registration Points for "Faces" Mode

| # | File | Location | Change |
|---|------|----------|--------|
| 1 | `src/lib/geometry/types.ts` | `ExtendedObjectType` | Add `'quaternion-julia'` |
| 2 | `src/lib/geometry/types.ts` | `isExtendedObjectType()` | Add check |
| 3 | `src/rendering/renderers/UnifiedRenderer.tsx` | `RenderMode` type | Add `'raymarch-quaternion-julia'` |
| 4 | `src/rendering/renderers/UnifiedRenderer.tsx` | `determineRenderMode()` | Add condition |
| 5 | `src/rendering/renderers/UnifiedRenderer.tsx` | JSX return | Add render conditional |
| 6 | `src/components/sections/RenderMode/RenderModeToggles.tsx` | `canRenderFaces()` | Add check |
| 7 | `src/components/sections/RenderMode/RenderModeToggles.tsx` | `isRaymarchedFractal()` | Add check |

---

## Implementation Order

1. **Phase 1** (Foundation): Types, store slice, store integration
2. **Phase 2** (Core): Shaders and mesh component
3. **Phase 3** (Registration): UnifiedRenderer and RenderModeToggles
4. **Phase 4** (UI): Controls component
5. **Phase 5** (Tests): Unit and component tests

Each phase should be committed separately to maintain clean git history.

---

## Key Differences from Hyperbulb

| Aspect | Hyperbulb (Mandelbulb) | Quaternion Julia |
|--------|------------------------|------------------|
| Iteration | `z = z^n` | `z = z^n + c` |
| Constant c | Derived from sample position | Fixed uniform parameter |
| Primary control | Power (n) | Julia constant (c) |
| Unique feature | Hyperspherical coordinates | Quaternion algebra |
| Animation focus | Power oscillation | Julia constant path |

---

## Walls Auto-Positioning

The "walls" in raymarched fractals are implicit - the fractal surface naturally terminates where the distance estimator indicates escape. Auto-positioning is achieved through the `scale` parameter:

- **scale = 1.0**: Tight framing, may clip some features
- **scale = 2.0**: Default, shows full fractal with margin
- **scale = 3.0+**: Wide view, fractal appears smaller

The `initializeQuaternionJuliaForDimension()` function sets appropriate scale defaults for each dimension to ensure the fractal fits well in the viewport.
