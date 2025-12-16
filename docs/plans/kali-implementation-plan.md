# Kali Fractal Implementation Plan

## Overview

Implementation of Kali/Reciprocal-Abs fractal type as a new raymarching object.

**Core formula**: `z = abs(z) / dot(z,z) + c` (with variants)

**Critical Requirements**:
1. Must support ALL rendering features from Hyperbulb and QuaternionJulia
2. Animation parameters go in Timeline bottom bar (NOT geometry editor)
3. Must copy lighting and color algorithm code exactly from existing shaders

---

## Phase 1: Types & Store Foundation

### 1.1 Add KaliConfig to types.ts

**File**: `src/lib/geometry/extended/types.ts`

Add after QuaternionJuliaConfig (~line 800):

```typescript
// ============================================================================
// Kali Fractal Configuration
// ============================================================================

/**
 * Kali constant animation parameters
 */
export interface KaliConstantAnimation {
  enabled: boolean
  /** Animation amplitude (0.0-0.3, Kali is sensitive) */
  amplitude: number
  /** Base frequency in Hz (0.01-0.2) */
  frequency: number
  /** Phase offset for multi-frequency motion */
  phaseOffset: number
  /** Animation preset */
  preset: 'breathing' | 'flowing' | 'chaos' | 'custom'
}

/**
 * Reciprocal gain animation parameters
 */
export interface KaliGainAnimation {
  enabled: boolean
  /** Minimum gain (0.5-1.5) */
  minGain: number
  /** Maximum gain (0.8-2.0) */
  maxGain: number
  /** Oscillation speed in Hz (0.01-0.1) */
  speed: number
}

/**
 * Axis weights animation parameters
 */
export interface KaliWeightsAnimation {
  enabled: boolean
  /** Weight variation amplitude (0.0-0.5) */
  amplitude: number
  /** Animation preset */
  preset: 'breathing' | 'wave' | 'random'
}

/**
 * Symmetry breaking matrix presets
 */
export type KaliSymmetryPreset = 'none' | 'subtle-twist' | 'organic-shear' | 'spiral'

/**
 * Configuration for Kali/Reciprocal-Abs fractal generation
 *
 * Mathematical basis: z = abs(z) / dot(z,z) + c
 * The reciprocal step creates intense nonlinear folding that produces
 * fluid, cellular, and "alive" structures.
 *
 * Supports 3D to 11D via hyperspherical generalization.
 *
 * @see docs/prd/kali-reciprocal-fractal.md
 */
export interface KaliConfig {
  // === Core Parameters ===

  /**
   * Kali constant c (n-dimensional).
   * Length matches current dimension.
   * Default: [0.5, 0.5, 0.5, 0.5] ("Coral Cells")
   * Range: -1.0 to 1.0 per component
   */
  kaliConstant: number[]

  /**
   * Reciprocal gain (0.5-2.0, default 1.0).
   * Lower = softer structures, Higher = sharper crystalline.
   * Formula: z = abs(z) / (dot(z,z) * gain + eps) + c
   */
  reciprocalGain: number

  /**
   * Axis weights for symmetry breaking.
   * Length matches current dimension, default all 1.0.
   * Range: 0.5-2.0 per axis.
   */
  axisWeights: number[]

  // === Symmetry Breaking Matrix ===

  /** Enable symmetry breaking transformation */
  symmetryEnabled: boolean
  /** Shear strength (0.0-0.3, default 0.05) */
  symmetryShearStrength: number
  /** Rotation amount in degrees (0.0-15.0, default 2.0) */
  symmetryRotationAmount: number
  /** Preset matrix configuration */
  symmetryPreset: KaliSymmetryPreset

  // === Iteration Parameters ===

  /**
   * Maximum iterations (8-64, default 20).
   * Lower than Julia due to fast divergence.
   */
  maxIterations: number

  /**
   * Bailout radius (2.0-8.0, default 4.0).
   */
  bailoutRadius: number

  /**
   * Epsilon for singularity protection (0.0001-0.01, default 0.001).
   * Prevents division by zero at origin.
   */
  epsilon: number

  // === Quality Parameters ===

  /** Scale/extent for auto-positioning (0.5-5.0, default 2.0) */
  scale: number
  /** Surface distance threshold (0.0005-0.004) */
  surfaceThreshold: number
  /** Maximum raymarch steps (64-512) */
  maxRaymarchSteps: number
  /** Quality multiplier (0.25-1.0) */
  qualityMultiplier: number

  // === D-dimensional Parameters ===

  /** Slice position in extra dimensions (length = dimension - 3) */
  parameterValues: number[]

  // === Animation Configuration ===
  // NOTE: Controls are in Timeline bottom bar, NOT geometry editor

  /** Constant path animation */
  constantAnimation: KaliConstantAnimation
  /** Reciprocal gain animation */
  gainAnimation: KaliGainAnimation
  /** Axis weights animation */
  weightsAnimation: KaliWeightsAnimation

  /** Enable origin drift in extra dimensions (4D+) */
  originDriftEnabled: boolean
  /** Origin drift amplitude (0.01-0.5) */
  originDriftAmplitude: number
  /** Origin drift base frequency Hz (0.01-0.5) */
  originDriftBaseFrequency: number
  /** Origin drift frequency spread (0.0-1.0) */
  originDriftFrequencySpread: number

  /** Enable dimension mixing inside iteration */
  dimensionMixEnabled: boolean
  /** Mixing intensity (0.0-0.3) */
  mixIntensity: number
  /** Mixing frequency multiplier (0.1-2.0) */
  mixFrequency: number
}

/**
 * Kali constant presets
 */
export const KALI_CONSTANT_PRESETS = [
  { name: 'Coral Cells', value: [0.5, 0.5, 0.5, 0.5] },
  { name: 'Sponge', value: [0.3, 0.3, 0.3, 0.3] },
  { name: 'Tubes', value: [0.7, 0.2, 0.7, 0.2] },
  { name: 'Membrane', value: [0.1, 0.1, 0.1, 0.1] },
  { name: 'Chaos', value: [0.8, -0.3, 0.5, -0.7] },
]

/**
 * Quality presets for Kali
 */
export const KALI_QUALITY_PRESETS = {
  draft: { maxIterations: 12, surfaceThreshold: 0.004, maxRaymarchSteps: 64 },
  standard: { maxIterations: 20, surfaceThreshold: 0.002, maxRaymarchSteps: 128 },
  high: { maxIterations: 40, surfaceThreshold: 0.001, maxRaymarchSteps: 256 },
  ultra: { maxIterations: 64, surfaceThreshold: 0.0005, maxRaymarchSteps: 512 },
}

/**
 * Default Kali configuration
 */
export const DEFAULT_KALI_CONFIG: KaliConfig = {
  // Core parameters
  kaliConstant: [0.5, 0.5, 0.5, 0.5],
  reciprocalGain: 1.0,
  axisWeights: [1.0, 1.0, 1.0, 1.0],

  // Symmetry breaking
  symmetryEnabled: false,
  symmetryShearStrength: 0.05,
  symmetryRotationAmount: 2.0,
  symmetryPreset: 'none',

  // Iteration
  maxIterations: 20,
  bailoutRadius: 4.0,
  epsilon: 0.001,

  // Quality
  scale: 2.0,
  surfaceThreshold: 0.002,
  maxRaymarchSteps: 128,
  qualityMultiplier: 1.0,

  // D-dimensional
  parameterValues: [],

  // Constant animation
  constantAnimation: {
    enabled: false,
    amplitude: 0.1,
    frequency: 0.02,
    phaseOffset: 0,
    preset: 'breathing',
  },

  // Gain animation
  gainAnimation: {
    enabled: false,
    minGain: 0.7,
    maxGain: 1.3,
    speed: 0.02,
  },

  // Weights animation
  weightsAnimation: {
    enabled: false,
    amplitude: 0.2,
    preset: 'breathing',
  },

  // Origin drift
  originDriftEnabled: false,
  originDriftAmplitude: 0.1,
  originDriftBaseFrequency: 0.1,
  originDriftFrequencySpread: 0.3,

  // Dimension mixing
  dimensionMixEnabled: false,
  mixIntensity: 0.1,
  mixFrequency: 0.5,
}
```

### 1.2 Create kaliSlice.ts

**File**: `src/stores/slices/geometry/kaliSlice.ts`

Follow the exact pattern of `quaternionJuliaSlice.ts`:
- Define KaliSliceState and KaliSliceActions interfaces
- Implement all setters with proper clamping
- Include `initializeKaliForDimension(dimension)` to resize arrays
- Include utility actions like `randomizeKaliConstant()`

### 1.3 Wire up Extended Object Store

**File**: `src/stores/extendedObjectStore.ts`

Add:
```typescript
import { createKaliSlice, type KaliSlice } from './slices/geometry/kaliSlice'

// Add to ExtendedObjectSlice type
export type ExtendedObjectSlice =
  // ...existing...
  & KaliSlice

// Add to store creation
export const useExtendedObjectStore = create<ExtendedObjectSlice>()((...a) => ({
  // ...existing slices...
  ...createKaliSlice(...a),
}))
```

---

## Phase 2: Shader & Renderer

### 2.1 Create Vertex Shader

**File**: `src/rendering/renderers/Kali/kali.vert`

Copy exactly from `quaternion-julia.vert`:
```glsl
out vec2 vUv;
out vec3 vPosition;

void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
```

### 2.2 Create Fragment Shader

**File**: `src/rendering/renderers/Kali/kali.frag`

**CRITICAL**: Copy the following sections EXACTLY from `quaternion-julia.frag`:

1. **Lines 1-133**: All uniform declarations (precision, MRT outputs, camera, lights, colors, opacity, shadow, performance)
2. **Lines 155-262**: All color utility functions (rgb2hsl, hsl2rgb, cosinePalette, getColorByAlgorithm, fresnelSchlick)
3. **Lines 516-523**: intersectSphere()
4. **Lines 560-614**: Multi-light helper functions (getLightDirection, getDistanceAttenuation, getSpotAttenuation)
5. **Lines 618-664**: Opacity calculations
6. **Lines 670-766**: main() function structure (lighting loop, shadows, fresnel)

**NEW Kali-specific uniforms** (add after uJuliaConstant):
```glsl
// Kali constant (n-dimensional, max 11)
uniform float uKaliConstant[11];
uniform float uReciprocalGain;
uniform float uAxisWeights[11];

// Symmetry breaking
uniform bool uSymmetryEnabled;
uniform float uSymmetryShearStrength;
uniform float uSymmetryRotationAmount;

// Kali iteration params
uniform float uEpsilon;
```

**NEW Kali SDF function**:
```glsl
float sdfKali(vec3 pos, out float trap) {
    // Map 3D to n-dimensional using basis vectors
    float z[11];
    for (int i = 0; i < 11; i++) z[i] = 0.0;

    for (int i = 0; i < uDimension; i++) {
        z[i] = uOrigin[i] + pos.x*uBasisX[i] + pos.y*uBasisY[i] + pos.z*uBasisZ[i];
    }

    float dr = 1.0;
    float minDist = 1e10;
    int escIt = 0;

    for (int iter = 0; iter < MAX_ITER_HQ; iter++) {
        if (iter >= int(uIterations)) break;

        // Apply axis weights
        for (int i = 0; i < uDimension; i++) {
            z[i] *= uAxisWeights[i];
        }

        // Absolute value fold
        for (int i = 0; i < uDimension; i++) {
            z[i] = abs(z[i]);
        }

        // Calculate dot(z,z)
        float dotZZ = uEpsilon; // Epsilon prevents singularity
        for (int i = 0; i < uDimension; i++) {
            dotZZ += z[i] * z[i];
        }

        float r = sqrt(dotZZ);
        if (r > uEscapeRadius) { escIt = iter; break; }

        // Reciprocal with gain
        float reciprocal = 1.0 / (dotZZ * uReciprocalGain);

        // Update derivative
        dr = dr * 2.0 * reciprocal + 1.0;

        // Apply reciprocal and add constant
        for (int i = 0; i < uDimension; i++) {
            z[i] = z[i] * reciprocal + uKaliConstant[i];
        }

        // Orbit trap
        minDist = min(minDist, r);
        escIt = iter;
    }

    // Final radius
    float finalR = 0.0;
    for (int i = 0; i < uDimension; i++) {
        finalR += z[i] * z[i];
    }
    finalR = sqrt(finalR);

    trap = exp(-minDist * 3.0) * 0.4 + float(escIt) / uIterations * 0.6;

    return max(0.5 * log(max(finalR, EPS)) * finalR / max(dr, EPS), EPS);
}
```

### 2.3 Create KaliMesh.tsx

**File**: `src/rendering/renderers/Kali/KaliMesh.tsx`

Follow `QuaternionJuliaMesh.tsx` exactly:
1. Same imports and structure
2. Same working arrays pattern for basis vectors
3. Same animation time tracking (animationTimeRef respects play/pause)
4. Same adaptive quality system (fastModeRef)
5. Same color caching pattern
6. Same multi-light uniform updates

**Key differences**:
- Use `extStore.kali` instead of `extStore.quaternionJulia`
- Add uniforms for Kali-specific parameters (uKaliConstant, uReciprocalGain, uAxisWeights, etc.)
- Implement constant animation, gain animation, weights animation using animTime

---

## Phase 3: UI Controls

### 3.1 Add Kali to Object Type Registry

**File**: `src/lib/geometry/registry/registry.ts`

Add Kali entry to OBJECT_TYPE_REGISTRY (after 'quaternion-julia' entry ~line 661):

```typescript
[
  'kali',
  {
    type: 'kali',
    name: 'Kali',
    description: 'Reciprocal-abs fractal with cellular/organic structures (z = abs(z)/dot(z,z) + c)',
    category: 'fractal',

    dimensions: {
      min: 3,
      max: 11,
      recommended: 4,
      recommendedReason: '4D provides dramatic morphing when rotating in higher-dimensional planes',
    },

    rendering: {
      supportsFaces: true,
      supportsEdges: true,
      supportsPoints: false,
      renderMethod: 'raymarch',
      faceDetection: 'none',
      requiresRaymarching: true,
      edgesAreFresnelRim: true,
    },

    animation: {
      hasTypeSpecificAnimations: true,
      systems: {
        constantAnimation: {
          name: 'Constant Animation',
          description: 'Animates the Kali constant c for organic morphing',
          enabledByDefault: false,
          enabledKey: 'constantAnimation.enabled',
          params: {
            'constantAnimation.amplitude': {
              min: 0.01,
              max: 0.3,
              default: 0.1,
              step: 0.01,
              label: 'Amplitude',
              description: 'Small amplitude recommended - Kali is sensitive',
            },
            'constantAnimation.frequency': {
              min: 0.01,
              max: 0.2,
              default: 0.02,
              step: 0.01,
              label: 'Frequency',
              description: 'Oscillation speed in Hz',
            },
          },
        },

        gainAnimation: {
          name: 'Reciprocal Gain',
          description: 'Oscillates gain between soft and sharp structures',
          enabledByDefault: false,
          enabledKey: 'gainAnimation.enabled',
          params: {
            'gainAnimation.minGain': {
              min: 0.5,
              max: 1.5,
              default: 0.7,
              step: 0.05,
              label: 'Min Gain',
              description: 'Produces softer, more rounded structures',
            },
            'gainAnimation.maxGain': {
              min: 0.8,
              max: 2.0,
              default: 1.3,
              step: 0.05,
              label: 'Max Gain',
              description: 'Produces sharper, more crystalline structures',
            },
            'gainAnimation.speed': {
              min: 0.01,
              max: 0.1,
              default: 0.02,
              step: 0.01,
              label: 'Speed',
              description: 'Oscillation speed in Hz',
            },
          },
        },

        weightsAnimation: {
          name: 'Axis Weights',
          description: 'Animates axis weights for breathing/wave effects',
          enabledByDefault: false,
          enabledKey: 'weightsAnimation.enabled',
          params: {
            'weightsAnimation.amplitude': {
              min: 0.0,
              max: 0.5,
              default: 0.2,
              step: 0.05,
              label: 'Amplitude',
              description: 'Weight variation range',
            },
          },
        },

        originDrift: {
          name: 'Origin Drift',
          description: 'Extra dimension wandering for feature evolution',
          enabledByDefault: false,
          minDimension: 4,
          enabledKey: 'originDriftEnabled',
          params: {
            originDriftAmplitude: {
              min: 0.01,
              max: 0.5,
              default: 0.1,
              step: 0.01,
              label: 'Amplitude',
            },
            originDriftBaseFrequency: {
              min: 0.01,
              max: 0.5,
              default: 0.1,
              step: 0.01,
              label: 'Base Freq',
            },
            originDriftFrequencySpread: {
              min: 0.0,
              max: 1.0,
              default: 0.3,
              step: 0.05,
              label: 'Spread',
            },
          },
        },

        dimensionMix: {
          name: 'Dimension Mixing',
          description: 'Cross-dimensional coupling via time-varying shear',
          enabledByDefault: false,
          minDimension: 4,
          enabledKey: 'dimensionMixEnabled',
          params: {
            mixIntensity: {
              min: 0.0,
              max: 0.3,
              default: 0.1,
              step: 0.01,
              label: 'Intensity',
            },
            mixFrequency: {
              min: 0.1,
              max: 2.0,
              default: 0.5,
              step: 0.1,
              label: 'Frequency',
            },
          },
        },
      },
    },

    urlSerialization: {
      typeKey: 'kali',
      serializableParams: ['kaliConstant', 'reciprocalGain', 'maxIterations', 'bailoutRadius'],
    },

    ui: {
      controlsComponentKey: 'KaliControls',
      hasTimelineControls: true,
      qualityPresets: ['draft', 'standard', 'high', 'ultra'],
    },

    configStoreKey: 'kali',
  },
],
```

### 3.2 Update FractalAnimationDrawer.tsx

**File**: `src/components/layout/TimelineControls/FractalAnimationDrawer.tsx`

Add Kali case to the updateConfig callback (~line 126):

```typescript
} else if (objectType === 'kali') {
  // Kali uses nested keys like quaternion-julia
  if (key.includes('.')) {
    const parts = key.split('.');
    const camelParts = parts.map(
      (part) => part.charAt(0).toUpperCase() + part.slice(1)
    );
    setterName = `setKali${camelParts.join('')}`;
  } else {
    setterName = `setKali${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  }
}
```

### 3.3 Create KaliControls.tsx

**File**: `src/components/sections/Geometry/KaliControls.tsx`

Contains ONLY static geometry parameters (animation controls are in TimelineControls via registry):
- Kali constant presets dropdown + per-component sliders
- Reciprocal gain slider (0.5-2.0)
- Axis weights section with per-axis sliders
- Symmetry breaking toggle with presets
- Quality preset selector
- Slice parameters for 4D+ (dimension - 3 sliders)

### 3.4 Register KaliControls Component

**File**: `src/lib/geometry/registry/components.ts`

Add to CONTROLS_COMPONENTS map:
```typescript
KaliControls: lazy(() => import('@/components/sections/Geometry/KaliControls')),
```

### 3.5 TimelineControls Integration (Automatic)

The `FractalAnimationDrawer` component already:
1. Reads animation systems from registry via `getAvailableAnimationSystems(objectType, dimension)`
2. Generates `AnimationSystemPanel` for each system
3. Bridges registry schema to store actions

No manual changes needed to TimelineControls.tsx - adding 'kali' to the registry enables it automatically.

The only change needed is ensuring `hasTimelineControls: true` in the registry entry (done in 3.1) so the "Fractal Parameters" button appears for Kali.

---

## Phase 4: Integration

### 4.1 Add to Geometry Store

**File**: `src/stores/geometryStore.ts`

Add 'kali' to ObjectType:
```typescript
export type ObjectType =
  | 'hypercube'
  | 'simplex'
  // ...existing...
  | 'quaternion-julia'
  | 'kali'  // Add here
```

### 4.2 Add to Scene Renderer

**File**: `src/rendering/Scene.tsx` (or UnifiedRenderer.tsx)

Add KaliMesh case:
```typescript
import KaliMesh from './renderers/Kali/KaliMesh'

// In render logic:
{objectType === 'kali' && <KaliMesh />}
```

### 4.3 Add to Object Type Selector

Find the component with object type dropdown and add:
```typescript
{ value: 'kali', label: 'Kali' }
```

### 4.4 Add KaliControls to Geometry Panel

Find where type-specific controls are rendered and add:
```typescript
{objectType === 'kali' && <KaliControls />}
```

### 4.5 Initialize on Dimension Change

In the component that handles dimension changes:
```typescript
useEffect(() => {
  if (objectType === 'kali') {
    initializeKaliForDimension(dimension)
  }
}, [dimension, objectType])
```

---

## Phase 5: Testing

### 5.1 Unit Tests

**File**: `src/tests/stores/kaliSlice.test.ts`

Test all actions:
- setKaliConstant with clamping
- setReciprocalGain with clamping
- setAxisWeights with clamping
- initializeKaliForDimension
- All animation parameter setters
- randomizeKaliConstant

### 5.2 Playwright E2E Tests

**File**: `scripts/playwright/kali-controls.spec.ts`

Test UI interactions:
- Select Kali from object type dropdown
- Adjust constant sliders
- Select presets
- Toggle animation controls in timeline
- Verify rendering updates

---

## Critical Implementation Notes

### Lighting - MUST COPY EXACTLY

The lighting calculation in main() must be copied exactly from quaternion-julia.frag:

```glsl
// Lighting
vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;
vec3 viewDir = -rd;
float totalNdotL = 0.0;

for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uNumLights) break;
    if (!uLightsEnabled[i]) continue;

    vec3 l = getLightDirection(i, p);
    float attenuation = uLightIntensities[i];

    int lightType = uLightTypes[i];
    if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
        float distance = length(uLightPositions[i] - p);
        attenuation *= getDistanceAttenuation(i, distance);
    }

    if (lightType == LIGHT_TYPE_SPOT) {
        vec3 lightToFrag = normalize(p - uLightPositions[i]);
        attenuation *= getSpotAttenuation(i, lightToFrag);
    }

    if (attenuation < 0.001) continue;

    // Shadow
    float shadow = 1.0;
    if (uShadowEnabled) {
        // ... shadow calculation ...
    }

    // Diffuse
    float NdotL = max(dot(n, l), 0.0);
    col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

    // Specular
    vec3 halfDir = normalize(l + viewDir);
    float NdotH = max(dot(n, halfDir), 0.0);
    float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation * shadow;
    col += uSpecularColor * uLightColors[i] * spec;

    totalNdotL = max(totalNdotL, NdotL * attenuation);
}

// Fresnel rim
if (uFresnelEnabled && uFresnelIntensity > 0.0) {
    float NdotV = max(dot(n, viewDir), 0.0);
    float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
    rim *= (0.3 + 0.7 * totalNdotL);
    col += uRimColor * rim;
}
```

### Color Algorithms - MUST COPY EXACTLY

Copy the entire getColorByAlgorithm function and all helper functions from quaternion-julia.frag.

### Animation Time - MUST USE animationTimeRef

```typescript
// In useFrame:
const currentTime = state.clock.elapsedTime
const delta = currentTime - lastFrameTimeRef.current
lastFrameTimeRef.current = currentTime

if (animStore.isPlaying) {
    animationTimeRef.current += delta * animStore.speed
}
const animTime = animationTimeRef.current

// Use animTime for ALL animation calculations:
if (config.constantAnimation.enabled) {
    const t = animTime * config.constantAnimation.frequency * 2 * Math.PI
    // ... calculate animated constant
}
```

---

## Dependencies Between Tasks

```
Phase 1: Types & Store (must complete first)
    └── 1.1 KaliConfig types
        └── 1.2 kaliSlice
            └── 1.3 extendedObjectStore wiring

Phase 2: Shader & Renderer (requires Phase 1)
    └── 2.1 Vertex shader (no deps)
    └── 2.2 Fragment shader (no deps)
        └── 2.3 KaliMesh (requires 2.1, 2.2, 1.3)

Phase 3: UI Controls (requires Phase 1)
    ├── 3.1 Registry entry (enables animation drawer automatically)
    ├── 3.2 FractalAnimationDrawer update (add Kali case)
    ├── 3.3 KaliControls component (requires 1.3)
    └── 3.4 Register component in components.ts

Phase 4: Integration (requires Phase 2, 3)
    └── All integration tasks can be done in parallel

Phase 5: Testing (requires Phase 4)
```

## File Summary

| Phase | File | Action |
|-------|------|--------|
| 1.1 | `src/lib/geometry/extended/types.ts` | Add KaliConfig, presets, defaults |
| 1.2 | `src/stores/slices/geometry/kaliSlice.ts` | Create slice |
| 1.3 | `src/stores/extendedObjectStore.ts` | Wire slice |
| 2.1 | `src/rendering/renderers/Kali/kali.vert` | Create (copy from QJ) |
| 2.2 | `src/rendering/renderers/Kali/kali.frag` | Create shader |
| 2.3 | `src/rendering/renderers/Kali/KaliMesh.tsx` | Create mesh component |
| 3.1 | `src/lib/geometry/registry/registry.ts` | Add Kali entry |
| 3.2 | `src/components/layout/TimelineControls/FractalAnimationDrawer.tsx` | Add Kali case |
| 3.3 | `src/components/sections/Geometry/KaliControls.tsx` | Create controls |
| 3.4 | `src/lib/geometry/registry/components.ts` | Register component |
| 4.1 | `src/stores/geometryStore.ts` | Add ObjectType |
| 4.2 | `src/rendering/Scene.tsx` | Add KaliMesh case |
| 5.1 | `src/tests/stores/kaliSlice.test.ts` | Create tests |
| 5.2 | `scripts/playwright/kali-controls.spec.ts` | Create E2E tests |
