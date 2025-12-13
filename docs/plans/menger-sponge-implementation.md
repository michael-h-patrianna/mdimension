# Menger Sponge Implementation Plan

## Overview

Add a new "Menger" extended object type following the established patterns from Hyperbulb and Mandelbox. The Menger Sponge is a geometric IFS fractal with a true SDF (not approximate distance estimation), making it computationally efficient and visually consistent across all dimensions.

**Key Differences from Escape-Time Fractals:**
- Uses KIFS (Kaleidoscopic IFS) fold operations instead of escape-time iteration
- True geometric SDF - no running derivative needed
- Parameter-light: only iterations and scale (vs 4+ params for Mandelbox)
- Consistent lattice structure at all dimensions

---

## Phase 1: Type Definitions

### File: `src/lib/geometry/extended/types.ts`

Add after `MandelboxConfig` (around line 424):

```typescript
// ============================================================================
// Menger Sponge Configuration
// ============================================================================

/**
 * Configuration for n-dimensional Menger Sponge (Sierpinski N-cube) generation
 *
 * The Menger sponge is a geometric IFS fractal defined by recursive removal:
 * - Divide cube into 3^N subcubes
 * - Remove subcubes where 2+ coordinates are in the "middle third"
 * - Repeat recursively
 *
 * Unlike escape-time fractals, the Menger sponge has a TRUE SDF via KIFS
 * fold operations, making it computationally efficient and visually consistent.
 *
 * Supports 3D to 11D with identical algorithm (coordinate sorting + cross subtraction).
 *
 * @see docs/prd/menger-sponge.md
 */
export interface MengerConfig {
  /**
   * Recursion depth / detail level (3 to 8, default 5).
   * Higher values create finer holes but cost more computation.
   * - 3: Coarse, clearly visible cube structure
   * - 5: Good balance of detail and performance
   * - 7-8: Very fine detail, may impact performance
   */
  iterations: number;

  /**
   * Bounding cube scale (0.5 to 2.0, default 1.0).
   * Controls the overall size of the Menger sponge.
   */
  scale: number;

  /**
   * Fixed values for dimensions beyond the 3D slice (for 4D+).
   * Array length = dimension - 3.
   * Controls which cross-section of the N-dimensional Menger hypersponge is visible.
   */
  parameterValues: number[];
}

/**
 * Default Menger sponge configuration
 */
export const DEFAULT_MENGER_CONFIG: MengerConfig = {
  iterations: 5,           // Good balance of detail and performance
  scale: 1.0,              // Unit cube bounding box
  parameterValues: [],     // No extra dimensions by default
};
```

### Update `ExtendedObjectParams` interface (line ~457):

```typescript
export interface ExtendedObjectParams {
  polytope: PolytopeConfig;
  rootSystem: RootSystemConfig;
  cliffordTorus: CliffordTorusConfig;
  mandelbrot: MandelbrotConfig;
  mandelbox: MandelboxConfig;
  menger: MengerConfig;  // ADD THIS
}
```

### Update `DEFAULT_EXTENDED_OBJECT_PARAMS` (line ~473):

```typescript
export const DEFAULT_EXTENDED_OBJECT_PARAMS: ExtendedObjectParams = {
  polytope: DEFAULT_POLYTOPE_CONFIG,
  rootSystem: DEFAULT_ROOT_SYSTEM_CONFIG,
  cliffordTorus: DEFAULT_CLIFFORD_TORUS_CONFIG,
  mandelbrot: DEFAULT_MANDELBROT_CONFIG,
  mandelbox: DEFAULT_MANDELBOX_CONFIG,
  menger: DEFAULT_MENGER_CONFIG,  // ADD THIS
};
```

---

## Phase 2: Store Integration

### File: `src/stores/extendedObjectStore.ts`

**Add imports (line ~31):**

```typescript
import type {
  // ... existing imports ...
  MengerConfig,
} from '@/lib/geometry/extended/types';

import {
  // ... existing imports ...
  DEFAULT_MENGER_CONFIG,
} from '@/lib/geometry/extended/types';
```

**Add to `ExtendedObjectState` interface (line ~46):**

```typescript
interface ExtendedObjectState {
  // ... existing state ...

  // --- Menger State ---
  menger: MengerConfig;

  // ... existing actions ...

  // --- Menger Actions ---
  setMengerIterations: (iterations: number) => void;
  setMengerScale: (scale: number) => void;
  setMengerParameterValue: (dimIndex: number, value: number) => void;
  setMengerParameterValues: (values: number[]) => void;
  resetMengerParameters: () => void;
  initializeMengerForDimension: (dimension: number) => void;
  getMengerConfig: () => MengerConfig;
}
```

**Add initial state (after line 133):**

```typescript
menger: { ...DEFAULT_MENGER_CONFIG },
```

**Add actions (after Mandelbox actions, around line 590):**

```typescript
// --- Menger Actions ---
setMengerIterations: (iterations: number) => {
  // Range 3 to 8 (higher values are very expensive)
  const clampedIterations = Math.max(3, Math.min(8, Math.floor(iterations)));
  set((state) => ({
    menger: { ...state.menger, iterations: clampedIterations },
  }));
},

setMengerScale: (scale: number) => {
  // Range 0.5 to 2.0
  const clampedScale = Math.max(0.5, Math.min(2.0, scale));
  set((state) => ({
    menger: { ...state.menger, scale: clampedScale },
  }));
},

setMengerParameterValue: (dimIndex: number, value: number) => {
  const values = [...get().menger.parameterValues];
  if (dimIndex < 0 || dimIndex >= values.length) {
    if (import.meta.env.DEV) {
      console.warn(
        `setMengerParameterValue: Invalid dimension index ${dimIndex} (valid range: 0-${values.length - 1})`
      );
    }
    return;
  }
  // Clamp to reasonable range (Menger is bounded in unit cube)
  const clampedValue = Math.max(-2.0, Math.min(2.0, value));
  values[dimIndex] = clampedValue;
  set((state) => ({
    menger: { ...state.menger, parameterValues: values },
  }));
},

setMengerParameterValues: (values: number[]) => {
  const clampedValues = values.map(v => Math.max(-2.0, Math.min(2.0, v)));
  set((state) => ({
    menger: { ...state.menger, parameterValues: clampedValues },
  }));
},

resetMengerParameters: () => {
  const len = get().menger.parameterValues.length;
  set((state) => ({
    menger: { ...state.menger, parameterValues: new Array(len).fill(0) },
  }));
},

initializeMengerForDimension: (dimension: number) => {
  const paramCount = Math.max(0, dimension - 3);

  // Dimension-specific iteration defaults:
  // Higher dimensions = sparser structure, can use fewer iterations
  // But also more computationally expensive per iteration
  let iterations: number;
  if (dimension >= 9) {
    iterations = 4;   // 9D-11D: conservative for performance
  } else if (dimension >= 7) {
    iterations = 4;   // 7D-8D: moderate
  } else if (dimension >= 5) {
    iterations = 5;   // 5D-6D: standard
  } else {
    iterations = 5;   // 3D-4D: good detail
  }

  set((state) => ({
    menger: {
      ...state.menger,
      parameterValues: new Array(paramCount).fill(0),
      iterations,
    },
  }));
},

getMengerConfig: (): MengerConfig => {
  return { ...get().menger };
},
```

**Update reset action (line ~593):**

```typescript
reset: () => {
  set({
    // ... existing resets ...
    menger: { ...DEFAULT_MENGER_CONFIG },
  });
},
```

---

## Phase 3: Geometry Type Registration

### File: `src/lib/geometry/types.ts`

Add `'menger'` to the `ObjectType` union type.

### File: `src/stores/geometryStore.ts`

Add initialization call in `setObjectType` action when switching to menger:

```typescript
if (objectType === 'menger') {
  useExtendedObjectStore.getState().initializeMengerForDimension(get().dimension);
}
```

---

## Phase 4: Shader Implementation

### Create directory: `src/components/canvas/renderers/Menger/`

### File: `src/components/canvas/renderers/Menger/menger.vert`

```glsl
// Menger Sponge Vertex Shader
// Standard fullscreen quad setup for raymarching

varying vec3 vPosition;
varying vec2 vUv;

void main() {
    vPosition = position;
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
```

### File: `src/components/canvas/renderers/Menger/menger.frag`

**Key Algorithm (KIFS approach from PRD):**

```glsl
// ============================================
// Menger Sponge Fragment Shader
// D-dimensional (3D-11D) raymarching
// Uses KIFS fold operations for true SDF
// ============================================

precision highp float;

// === UNIFORMS (same structure as Mandelbox) ===
uniform vec3 uCameraPosition;
uniform float uIterations;      // Recursion depth (3-8)
uniform float uScale;           // Bounding box scale
uniform vec3 uColor;
uniform mat4 uModelMatrix;
uniform mat4 uInverseModelMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

uniform int uDimension;

// D-dimensional rotated coordinate system
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];

// Lighting uniforms (full set from Mandelbox)
uniform bool uLightEnabled;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uAmbientIntensity;
uniform vec3 uAmbientColor;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform float uLightStrength;
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;

// Fresnel rim lighting
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Advanced Color System uniforms (full set)
uniform int uColorAlgorithm;
uniform vec3 uCosineA, uCosineB, uCosineC, uCosineD;
uniform float uDistPower, uDistCycles, uDistOffset;
uniform float uLchLightness, uLchChroma;
uniform vec3 uMultiSourceWeights;

// Performance mode
uniform bool uFastMode;

varying vec3 vPosition;
varying vec2 vUv;

// Performance constants
#define MAX_MARCH_STEPS_HQ 128
#define MAX_MARCH_STEPS_LQ 64
#define SURF_DIST_HQ 0.001
#define SURF_DIST_LQ 0.002
#define BOUND_R 2.0
#define EPS 1e-6
#define PI 3.14159265359

// === COLOR UTILITIES (copy from Mandelbox) ===
// [Include all color functions: rgb2hsl, hsl2rgb, cosinePalette, lchColor, etc.]

// === MENGER CORE OPERATIONS ===

// N-dimensional box SDF
float sdBoxND(float z[11], int D, float size) {
    float maxDist = 0.0;
    for (int i = 0; i < 11; i++) {
        if (i >= D) break;
        maxDist = max(maxDist, abs(z[i]) - size);
    }
    return maxDist;
}

// N-dimensional cross SDF
// Returns negative if point is inside the cross (2+ coords in middle third)
float sdCrossND(float z[11], int D) {
    // Find two smallest |z[i]| values
    float smallest = 1e10;
    float secondSmallest = 1e10;
    for (int i = 0; i < 11; i++) {
        if (i >= D) break;
        float v = abs(z[i]);
        if (v < smallest) {
            secondSmallest = smallest;
            smallest = v;
        } else if (v < secondSmallest) {
            secondSmallest = v;
        }
    }
    return secondSmallest - 1.0;  // Negative inside cross
}

// Sort coordinates descending (bubble sort for small D)
void sortDescending(inout float z[11], int D) {
    for (int i = 0; i < 10; i++) {
        if (i >= D - 1) break;
        for (int j = 0; j < 10; j++) {
            if (j >= D - 1 - i) break;
            if (z[j] < z[j + 1]) {
                float tmp = z[j];
                z[j] = z[j + 1];
                z[j + 1] = tmp;
            }
        }
    }
}

// N-dimensional Menger SDF using KIFS folds
float mengerSDF_ND(vec3 pos, int D, int maxIter, float boundScale, out float trap) {
    // Map 3D position to D-dimensional point
    float z[11];
    for (int i = 0; i < 11; i++) {
        if (i >= D) { z[i] = 0.0; continue; }
        z[i] = uOrigin[i] + pos.x * uBasisX[i] + pos.y * uBasisY[i] + pos.z * uBasisZ[i];
    }

    // Scale to unit cube
    for (int i = 0; i < 11; i++) {
        if (i >= D) break;
        z[i] /= boundScale;
    }

    // Start with D-dimensional box distance
    float d = sdBoxND(z, D, 1.0);
    float s = 1.0;
    trap = 1000.0;

    for (int iter = 0; iter < 8; iter++) {
        if (iter >= maxIter) break;

        // Fold into positive orthant (absolute value)
        for (int i = 0; i < 11; i++) {
            if (i >= D) break;
            z[i] = abs(z[i]);
        }

        // Sort coordinates descending (creates kaleidoscopic symmetry)
        sortDescending(z, D);

        // Scale and translate
        s *= 3.0;
        for (int i = 0; i < 11; i++) {
            if (i >= D) break;
            z[i] = z[i] * 3.0 - 2.0;
        }

        // Fold back: clamp smaller coordinates
        // This is the N-D generalization of p.z = max(p.z, -1.0)
        for (int i = 2; i < 11; i++) {
            if (i >= D) break;
            z[i] = max(z[i], -1.0);
        }

        // Update distance with cross subtraction
        float crossDist = sdCrossND(z, D);
        d = max(d, crossDist / s);

        // Track orbit trap for coloring
        float r2 = 0.0;
        for (int i = 0; i < 11; i++) {
            if (i >= D) break;
            r2 += z[i] * z[i];
        }
        trap = min(trap, sqrt(r2));
    }

    return d * boundScale;  // Scale back to world space
}

// === DIMENSION-SPECIFIC SDF WRAPPERS ===
// (Unrolled versions for 3D, 4D, 5D, etc. for performance)
// Follow the pattern from Mandelbox shader

// === RAYMARCHING ===
// (Copy from Mandelbox - identical ray setup and lighting)

// === MAIN ===
void main() {
    // ... standard raymarching setup from Mandelbox ...
    // Replace sdf call with mengerSDF_ND
    // ... apply lighting and coloring ...
}
```

**Note:** The full shader will be ~800-1000 lines, copying the raymarching infrastructure, lighting, and color systems from `mandelbox.frag`, replacing only the SDF core.

---

## Phase 5: Mesh Component

### File: `src/components/canvas/renderers/Menger/MengerMesh.tsx`

Follow the exact pattern from `MandelboxMesh.tsx`:

```typescript
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import vertexShader from './menger.vert?raw';
import fragmentShader from './menger.frag?raw';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette';
import type { MatrixND } from '@/lib/math/types';
import type { RotationState } from '@/stores/rotationStore';

const QUALITY_RESTORE_DELAY_MS = 150;

// Helper functions (copy from MandelboxMesh)
function anglesToDirection(horizontalDeg: number, verticalDeg: number): THREE.Vector3 { ... }
function applyRotation(matrix: MatrixND, vec: number[]): Float32Array { ... }

/**
 * MengerMesh - Renders 3D-11D Menger Sponge using GPU raymarching
 *
 * The Menger sponge uses KIFS fold operations that work identically
 * across all dimensions - simpler than escape-time fractals.
 */
const MengerMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();

  // Adaptive quality tracking (copy from Mandelbox)
  const prevRotationsRef = useRef<RotationState['rotations'] | null>(null);
  const fastModeRef = useRef(false);
  const restoreQualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => { ... }, []);

  // Get dimension
  const dimension = useGeometryStore((state) => state.dimension);

  // Get Menger config from store
  const iterations = useExtendedObjectStore((state) => state.menger.iterations);
  const scale = useExtendedObjectStore((state) => state.menger.scale);
  const parameterValues = useExtendedObjectStore((state) => state.menger.parameterValues);

  // Get visual settings (copy all from MandelboxMesh)
  const faceColor = useVisualStore((state) => state.faceColor);
  const colorAlgorithm = useVisualStore((state) => state.colorAlgorithm);
  // ... all other visual store subscriptions ...

  const uniforms = useMemo(() => ({
    // Time and resolution
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2() },
    uCameraPosition: { value: new THREE.Vector3() },

    // Menger parameters (simpler than Mandelbox)
    uDimension: { value: 3 },
    uIterations: { value: 5.0 },
    uScale: { value: 1.0 },

    // D-dimensional rotated coordinate system
    uBasisX: { value: new Float32Array(11) },
    uBasisY: { value: new Float32Array(11) },
    uBasisZ: { value: new Float32Array(11) },
    uOrigin: { value: new Float32Array(11) },

    // Color (copy from Mandelbox)
    uColor: { value: new THREE.Color() },

    // Matrices
    uModelMatrix: { value: new THREE.Matrix4() },
    uInverseModelMatrix: { value: new THREE.Matrix4() },
    uProjectionMatrix: { value: new THREE.Matrix4() },
    uViewMatrix: { value: new THREE.Matrix4() },

    // Lighting (full set from Mandelbox)
    uLightEnabled: { value: true },
    uLightColor: { value: new THREE.Color() },
    uLightDirection: { value: new THREE.Vector3() },
    // ... all other lighting uniforms ...

    // Fresnel rim lighting
    uFresnelEnabled: { value: true },
    uFresnelIntensity: { value: 0.5 },
    uRimColor: { value: new THREE.Color('#FFFFFF') },

    // Performance mode
    uFastMode: { value: false },

    // Advanced Color System (full set from Mandelbox)
    uColorAlgorithm: { value: 1 },
    // ... all other color uniforms ...
  }), []);

  const hasRotationsChanged = useCallback(...);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;

      // Get rotations from store
      const rotations = useRotationStore.getState().rotations;

      // Adaptive quality (copy from Mandelbox)
      // ...

      // Update Menger-specific uniforms
      if (material.uniforms.uDimension) material.uniforms.uDimension.value = dimension;
      if (material.uniforms.uIterations) material.uniforms.uIterations.value = iterations;
      if (material.uniforms.uScale) material.uniforms.uScale.value = scale;

      // Update lighting uniforms (copy from Mandelbox)
      // ...

      // Update color uniforms (copy from Mandelbox)
      // ...

      // Build D-dimensional rotation matrix and basis vectors
      // (identical to Mandelbox)
      const rotationMatrix = composeRotations(dimension, rotations);
      const D = dimension;
      const unitX = new Array(D).fill(0); unitX[0] = 1;
      const unitY = new Array(D).fill(0); unitY[1] = 1;
      const unitZ = new Array(D).fill(0); unitZ[2] = 1;
      const origin = new Array(D).fill(0);
      for (let i = 3; i < D; i++) {
        origin[i] = parameterValues[i - 3] ?? 0;
      }

      const rotatedX = applyRotation(rotationMatrix, unitX);
      const rotatedY = applyRotation(rotationMatrix, unitY);
      const rotatedZ = applyRotation(rotationMatrix, unitZ);
      const rotatedOrigin = applyRotation(rotationMatrix, origin);

      // Update basis uniforms (copy from Mandelbox)
      // ...
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Menger is bounded within unit cube, but give some margin */}
      <boxGeometry args={[4, 4, 4]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export default MengerMesh;
```

### File: `src/components/canvas/renderers/Menger/index.ts`

```typescript
export { default as MengerMesh } from './MengerMesh';
```

---

## Phase 6: Renderer Integration

### File: `src/components/canvas/renderers/UnifiedRenderer.tsx`

**Add import (line ~24):**

```typescript
import MengerMesh from './Menger/MengerMesh';
```

**Update RenderMode type (line ~30):**

```typescript
export type RenderMode = 'polytope' | 'pointcloud' | 'raymarch-3d' | 'raymarch-4d+' | 'raymarch-mandelbox' | 'raymarch-menger' | 'none';
```

**Update `determineRenderMode` function (after Mandelbox check, ~line 64):**

```typescript
// Menger uses raymarching when faces are visible
if (objectType === 'menger' && dimension >= 3) {
  return facesVisible ? 'raymarch-menger' : 'none';
}
```

**Add render case (after MandelboxMesh, ~line 152):**

```typescript
{/* Raymarched 3D-11D Menger Sponge */}
{renderMode === 'raymarch-menger' && <MengerMesh />}
```

---

## Phase 7: UI Controls

### File: `src/components/sidebar/Geometry/MengerControls.tsx`

```typescript
import { useShallow } from 'zustand/react/shallow';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { Slider } from '@/components/ui/Slider';

/**
 * Controls for Menger Sponge parameters.
 * Simpler than Mandelbox - only iterations and scale, plus slice parameters for 4D+.
 */
export const MengerControls = () => {
  const dimension = useGeometryStore((state) => state.dimension);

  const {
    iterations,
    scale,
    parameterValues,
    setIterations,
    setScale,
    setParameterValue,
    resetParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      iterations: state.menger.iterations,
      scale: state.menger.scale,
      parameterValues: state.menger.parameterValues,
      setIterations: state.setMengerIterations,
      setScale: state.setMengerScale,
      setParameterValue: state.setMengerParameterValue,
      resetParameters: state.resetMengerParameters,
    }))
  );

  const hasExtraDimensions = dimension > 3;

  return (
    <div className="space-y-4">
      {/* Iterations (detail level) */}
      <div>
        <label className="text-sm font-medium">
          Detail Level: {iterations}
        </label>
        <Slider
          min={3}
          max={8}
          step={1}
          value={[iterations]}
          onValueChange={([v]) => setIterations(v)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Higher = finer holes, more computation
        </p>
      </div>

      {/* Scale */}
      <div>
        <label className="text-sm font-medium">
          Scale: {scale.toFixed(2)}
        </label>
        <Slider
          min={0.5}
          max={2.0}
          step={0.1}
          value={[scale]}
          onValueChange={([v]) => setScale(v)}
        />
      </div>

      {/* Detail presets */}
      <div className="flex gap-2">
        <button
          className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80"
          onClick={() => setIterations(3)}
        >
          Low
        </button>
        <button
          className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80"
          onClick={() => setIterations(5)}
        >
          Standard
        </button>
        <button
          className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80"
          onClick={() => setIterations(7)}
        >
          High
        </button>
      </div>

      {/* Slice parameters for 4D+ */}
      {hasExtraDimensions && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Slice Position</label>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={resetParameters}
            >
              Reset
            </button>
          </div>
          {parameterValues.map((value, idx) => (
            <div key={idx}>
              <label className="text-xs">
                Dim {idx + 4}: {value.toFixed(2)}
              </label>
              <Slider
                min={-2.0}
                max={2.0}
                step={0.05}
                value={[value]}
                onValueChange={([v]) => setParameterValue(idx, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Integrate into sidebar

Add `MengerControls` to the geometry controls section, conditionally rendered when `objectType === 'menger'`.

---

## Phase 8: Animation Integration

The Menger sponge uses the **same animation system** as all other N-dimensional objects:

1. **Rotation Store**: No changes needed - rotation planes computed identically
2. **Animation Store**: No changes needed - plane selection works the same
3. **Animation Bias**: The bias setting controls per-dimension rotation delta

The `MengerMesh.useFrame` loop already reads from `useRotationStore` and applies the full D-dimensional rotation matrix to the basis vectors, just like Mandelbox.

---

## Phase 9: Testing

### Unit Tests

**File: `src/tests/lib/geometry/extended/menger.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_MENGER_CONFIG } from '@/lib/geometry/extended/types';

describe('Menger Config', () => {
  it('has valid default iterations', () => {
    expect(DEFAULT_MENGER_CONFIG.iterations).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_MENGER_CONFIG.iterations).toBeLessThanOrEqual(8);
  });

  it('has valid default scale', () => {
    expect(DEFAULT_MENGER_CONFIG.scale).toBeGreaterThanOrEqual(0.5);
    expect(DEFAULT_MENGER_CONFIG.scale).toBeLessThanOrEqual(2.0);
  });

  it('has empty parameterValues by default', () => {
    expect(DEFAULT_MENGER_CONFIG.parameterValues).toEqual([]);
  });
});
```

**File: `src/tests/stores/extendedObjectStore.menger.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';

describe('ExtendedObjectStore - Menger', () => {
  beforeEach(() => {
    useExtendedObjectStore.getState().reset();
  });

  it('sets iterations within valid range', () => {
    const { setMengerIterations } = useExtendedObjectStore.getState();

    setMengerIterations(10); // Above max
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(8);

    setMengerIterations(1); // Below min
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(3);

    setMengerIterations(6); // Valid
    expect(useExtendedObjectStore.getState().menger.iterations).toBe(6);
  });

  it('sets scale within valid range', () => {
    const { setMengerScale } = useExtendedObjectStore.getState();

    setMengerScale(5.0); // Above max
    expect(useExtendedObjectStore.getState().menger.scale).toBe(2.0);

    setMengerScale(0.1); // Below min
    expect(useExtendedObjectStore.getState().menger.scale).toBe(0.5);
  });

  it('initializes for dimension correctly', () => {
    const { initializeMengerForDimension } = useExtendedObjectStore.getState();

    initializeMengerForDimension(5);
    const config = useExtendedObjectStore.getState().menger;
    expect(config.parameterValues.length).toBe(2); // 5D - 3 = 2 extra dims
    expect(config.iterations).toBe(5);

    initializeMengerForDimension(10);
    const config10 = useExtendedObjectStore.getState().menger;
    expect(config10.parameterValues.length).toBe(7); // 10D - 3 = 7 extra dims
    expect(config10.iterations).toBe(4); // Reduced for high D
  });

  it('sets and resets parameter values', () => {
    const { initializeMengerForDimension, setMengerParameterValue, resetMengerParameters } = useExtendedObjectStore.getState();

    initializeMengerForDimension(5);
    setMengerParameterValue(0, 0.5);
    setMengerParameterValue(1, -0.3);

    const config = useExtendedObjectStore.getState().menger;
    expect(config.parameterValues[0]).toBe(0.5);
    expect(config.parameterValues[1]).toBe(-0.3);

    resetMengerParameters();
    const resetConfig = useExtendedObjectStore.getState().menger;
    expect(resetConfig.parameterValues).toEqual([0, 0]);
  });
});
```

**File: `src/tests/components/canvas/MengerMesh.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import MengerMesh from '@/components/canvas/renderers/Menger/MengerMesh';

// Mock the shader imports
vi.mock('./menger.vert?raw', () => ({ default: 'void main() {}' }));
vi.mock('./menger.frag?raw', () => ({ default: 'void main() {}' }));

describe('MengerMesh', () => {
  it('renders without crashing', () => {
    expect(() => {
      render(
        <Canvas>
          <MengerMesh />
        </Canvas>
      );
    }).not.toThrow();
  });
});
```

**File: `src/tests/components/sidebar/MengerControls.test.tsx`**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MengerControls } from '@/components/sidebar/Geometry/MengerControls';

describe('MengerControls', () => {
  it('renders detail level slider', () => {
    render(<MengerControls />);
    expect(screen.getByText(/Detail Level/i)).toBeInTheDocument();
  });

  it('renders scale slider', () => {
    render(<MengerControls />);
    expect(screen.getByText(/Scale/i)).toBeInTheDocument();
  });

  it('renders preset buttons', () => {
    render(<MengerControls />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
```

### E2E Tests

**File: `scripts/playwright/menger-e2e.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Menger Sponge', () => {
  test('renders Menger sponge at 3D', async ({ page }) => {
    await page.goto('/');

    // Select Menger object type
    await page.click('[data-testid="object-type-selector"]');
    await page.click('[data-testid="object-type-menger"]');

    // Verify canvas renders
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'screenshots/menger-3d.png' });
  });

  test('animates rotation in 4D', async ({ page }) => {
    await page.goto('/');

    // Select Menger and set 4D
    await page.click('[data-testid="object-type-selector"]');
    await page.click('[data-testid="object-type-menger"]');
    await page.click('[data-testid="dimension-4"]');

    // Start animation
    await page.click('[data-testid="animation-play"]');

    // Wait for animation
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/menger-4d-animated.png' });
  });
});
```

---

## Summary

### Files to Create (6 new files)
1. `src/components/canvas/renderers/Menger/menger.vert` - Vertex shader
2. `src/components/canvas/renderers/Menger/menger.frag` - Fragment shader (~800 lines)
3. `src/components/canvas/renderers/Menger/MengerMesh.tsx` - Mesh component
4. `src/components/canvas/renderers/Menger/index.ts` - Export
5. `src/components/sidebar/Geometry/MengerControls.tsx` - UI controls
6. Test files (4-5 files)

### Files to Modify (5 files)
1. `src/lib/geometry/extended/types.ts` - Add MengerConfig
2. `src/stores/extendedObjectStore.ts` - Add Menger state and actions
3. `src/lib/geometry/types.ts` - Add 'menger' to ObjectType
4. `src/stores/geometryStore.ts` - Initialize Menger on type change
5. `src/components/canvas/renderers/UnifiedRenderer.tsx` - Add render mode

### Feature Parity with Mandelbox
- All 8 color algorithms
- Full lighting system (ambient, diffuse, specular, Fresnel rim)
- Adaptive quality (fast mode during rotation)
- D-dimensional rotation with basis vectors
- Animation bias support
- Slice parameters for 4D+

### Unique Menger Characteristics
- True SDF (faster, more accurate than escape-time)
- Only 2 parameters (iterations, scale) vs 6+ for Mandelbox
- Consistent visual character across all dimensions
- KIFS fold operations instead of escape-time iteration
