# Hyperbulb Opacity Modes - Implementation Plan

Based on PRD: `docs/prd/hyperbulb_opacity.md`

## Overview

This plan implements 4 opacity rendering modes for hyperbulb fractals:
- **Solid** (default) - Fully opaque surface
- **Simple Alpha** - Uniform transparency with slider
- **Layered Surfaces** - Multiple transparent nested surfaces
- **Volumetric Density** - Cloud-like volumetric rendering

---

## Phase 1: Types and State Management

**Files to create/modify:**
- `src/lib/opacity/types.ts` (new)
- `src/lib/opacity/constants.ts` (new)
- `src/stores/visualStore.ts` (modify)

### Task 1.1: Create opacity types

```typescript
// src/lib/opacity/types.ts
export type OpacityMode = 'solid' | 'simpleAlpha' | 'layeredSurfaces' | 'volumetricDensity';
export type SampleQuality = 'low' | 'medium' | 'high';

export interface HyperbulbOpacitySettings {
  mode: OpacityMode;
  simpleAlphaOpacity: number;    // 0.0-1.0, default 0.7
  layerCount: 2 | 3 | 4;         // default 2
  layerOpacity: number;          // 0.1-0.9, default 0.5
  volumetricDensity: number;     // 0.1-2.0, default 1.0
  sampleQuality: SampleQuality;  // default 'medium'
}
```

### Task 1.2: Create opacity constants

```typescript
// src/lib/opacity/constants.ts
export const OPACITY_DEFAULTS = {
  mode: 'solid' as const,
  simpleAlphaOpacity: 0.7,
  layerCount: 2 as const,
  layerOpacity: 0.5,
  volumetricDensity: 1.0,
  sampleQuality: 'medium' as const,
};

export const OPACITY_RANGES = {
  simpleAlpha: { min: 0, max: 1, step: 0.05 },
  layerOpacity: { min: 0.1, max: 0.9, step: 0.05 },
  volumetricDensity: { min: 0.1, max: 2.0, step: 0.1 },
};
```

### Task 1.3: Update visualStore

Add to `visualStore.ts`:
- State property: `hyperbulbOpacitySettings: HyperbulbOpacitySettings`
- State property: `hasSeenVolumetricWarning: boolean`
- Actions: `setOpacityMode`, `setSimpleAlphaOpacity`, `setLayerCount`, `setLayerOpacity`, `setVolumetricDensity`, `setSampleQuality`, `setHasSeenVolumetricWarning`

---

## Phase 2: Shader Implementation

**Files to modify:**
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`

### Task 2.1: Add opacity uniforms

```glsl
// Add near other uniforms
uniform int uOpacityMode;        // 0=solid, 1=simpleAlpha, 2=layered, 3=volumetric
uniform float uSimpleAlpha;      // 0.0-1.0
uniform int uLayerCount;         // 2-4
uniform float uLayerOpacity;     // 0.1-0.9
uniform float uDensity;          // 0.1-2.0
uniform int uSampleQuality;      // 0=low, 1=medium, 2=high
```

### Task 2.2: Implement opacity mode functions

```glsl
float calculateSolidAlpha() {
  return 1.0;
}

float calculateSimpleAlpha() {
  return uSimpleAlpha;
}

float calculateLayeredAlpha(float depth, float maxDepth) {
  // Calculate which layer this hit belongs to
  float layerDepth = maxDepth / float(uLayerCount);
  int layer = int(depth / layerDepth);
  // Each layer contributes its opacity, outer layers first
  float alpha = uLayerOpacity;
  // Fade based on layer depth for visual distinction
  alpha *= 1.0 - (float(layer) * 0.15);
  return alpha;
}

float calculateVolumetricAlpha(float distanceInVolume) {
  // Sample count based on quality
  int samples = uSampleQuality == 0 ? 32 : (uSampleQuality == 1 ? 64 : 128);
  // Accumulate density along ray
  float alpha = 1.0 - exp(-distanceInVolume * uDensity);
  return alpha;
}
```

### Task 2.3: Update main() output

Replace line 1257 `gl_FragColor = vec4(col, 1.0)` with mode dispatch:

```glsl
float alpha = 1.0;
if (uOpacityMode == 0) {
  alpha = calculateSolidAlpha();
} else if (uOpacityMode == 1) {
  alpha = calculateSimpleAlpha();
} else if (uOpacityMode == 2) {
  alpha = calculateLayeredAlpha(t, MAX_DIST);
} else if (uOpacityMode == 3) {
  alpha = calculateVolumetricAlpha(t);
}
gl_FragColor = vec4(col, alpha);
```

---

## Phase 3: Mesh Component Updates

**Files to modify:**
- `src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx`

### Task 3.1: Add uniforms to mesh

```typescript
// In uniforms useMemo (around line 148)
uOpacityMode: { value: 0 },
uSimpleAlpha: { value: 0.7 },
uLayerCount: { value: 2 },
uLayerOpacity: { value: 0.5 },
uDensity: { value: 1.0 },
uSampleQuality: { value: 1 },
```

### Task 3.2: Read from store and update uniforms

```typescript
// Add to store subscriptions
const opacitySettings = useVisualStore((s) => s.hyperbulbOpacitySettings);

// In useFrame callback
const modeMap = { solid: 0, simpleAlpha: 1, layeredSurfaces: 2, volumetricDensity: 3 };
material.uniforms.uOpacityMode.value = modeMap[opacitySettings.mode];
material.uniforms.uSimpleAlpha.value = opacitySettings.simpleAlphaOpacity;
material.uniforms.uLayerCount.value = opacitySettings.layerCount;
material.uniforms.uLayerOpacity.value = opacitySettings.layerOpacity;
material.uniforms.uDensity.value = opacitySettings.volumetricDensity;
const qualityMap = { low: 0, medium: 1, high: 2 };
material.uniforms.uSampleQuality.value = qualityMap[opacitySettings.sampleQuality];
```

### Task 3.3: Configure material transparency

```typescript
// Set material properties based on opacity mode
const isTransparent = opacitySettings.mode !== 'solid';
material.transparent = isTransparent;
material.depthWrite = !isTransparent;
```

---

## Phase 4: UI Implementation

**Files to modify:**
- `src/components/sidebar/Faces/FacesSection.tsx`

### Task 4.1: Add opacity mode dropdown

In `MaterialTabContent`, add conditional rendering for hyperbulb:

```tsx
const objectType = useGeometryStore((s) => s.objectType);
const isHyperbulb = objectType === 'mandelbrot';

{isHyperbulb && (
  <div className="space-y-3">
    <label className="text-xs text-neutral-400">Opacity Mode</label>
    <select value={opacitySettings.mode} onChange={handleModeChange}>
      <option value="solid">Solid</option>
      <option value="simpleAlpha">Simple Alpha</option>
      <option value="layeredSurfaces">Layered Surfaces</option>
      <option value="volumetricDensity">Volumetric Density</option>
    </select>
  </div>
)}
```

### Task 4.2: Add mode-specific controls

```tsx
{/* Simple Alpha Controls */}
{isHyperbulb && opacitySettings.mode === 'simpleAlpha' && (
  <Slider
    label="Face Opacity"
    value={opacitySettings.simpleAlphaOpacity}
    min={0} max={1} step={0.05}
    onDoubleClick={() => setSimpleAlphaOpacity(0.7)}
  />
)}

{/* Layered Surfaces Controls */}
{isHyperbulb && opacitySettings.mode === 'layeredSurfaces' && (
  <>
    <Select label="Layer Count" options={[2,3,4]} />
    <Slider label="Layer Opacity" min={0.1} max={0.9} step={0.05} />
  </>
)}

{/* Volumetric Density Controls */}
{isHyperbulb && opacitySettings.mode === 'volumetricDensity' && (
  <>
    <Slider label="Density" min={0.1} max={2.0} step={0.1} />
    <Select label="Sample Quality" options={['Low', 'Medium', 'High']} />
  </>
)}
```

### Task 4.3: Add volumetric warning

```tsx
const [showWarning, setShowWarning] = useState(false);

const handleModeChange = (mode: OpacityMode) => {
  if (mode === 'volumetricDensity' && !hasSeenVolumetricWarning) {
    setShowWarning(true);
    setHasSeenVolumetricWarning(true);
  }
  setOpacityMode(mode);
};

{showWarning && (
  <Toast message="Volumetric mode may reduce performance" onClose={() => setShowWarning(false)} />
)}
```

### Task 4.4: Hide Face Opacity slider in Solid mode

Only show the existing face opacity slider when mode is Simple Alpha.

---

## Phase 5: URL Serialization

**Files to modify:**
- `src/lib/url/state-serializer.ts`

### Task 5.1: Update ShareableState interface

```typescript
interface ShareableState {
  // ... existing fields
  opacityMode?: OpacityMode;
  simpleAlphaOpacity?: number;
  layerCount?: number;
  layerOpacity?: number;
  volumetricDensity?: number;
  sampleQuality?: SampleQuality;
}
```

### Task 5.2: Add serialization logic

```typescript
// In serializeState()
if (state.opacityMode && state.opacityMode !== 'solid') {
  const modeMap = { simpleAlpha: 1, layeredSurfaces: 2, volumetricDensity: 3 };
  params.set('om', String(modeMap[state.opacityMode]));

  if (state.opacityMode === 'simpleAlpha') {
    params.set('sao', String(state.simpleAlphaOpacity));
  } else if (state.opacityMode === 'layeredSurfaces') {
    params.set('lc', String(state.layerCount));
    params.set('lo', String(state.layerOpacity));
  } else if (state.opacityMode === 'volumetricDensity') {
    params.set('vd', String(state.volumetricDensity));
    const sqMap = { low: 0, medium: 1, high: 2 };
    params.set('sq', String(sqMap[state.sampleQuality]));
  }
}
```

### Task 5.3: Add deserialization logic

```typescript
// In deserializeState()
const om = params.get('om');
if (om) {
  const modeMap = ['solid', 'simpleAlpha', 'layeredSurfaces', 'volumetricDensity'];
  state.opacityMode = modeMap[parseInt(om)] || 'solid';

  if (state.opacityMode === 'simpleAlpha') {
    state.simpleAlphaOpacity = parseFloat(params.get('sao') || '0.7');
  } else if (state.opacityMode === 'layeredSurfaces') {
    state.layerCount = parseInt(params.get('lc') || '2');
    state.layerOpacity = parseFloat(params.get('lo') || '0.5');
  } else if (state.opacityMode === 'volumetricDensity') {
    state.volumetricDensity = parseFloat(params.get('vd') || '1.0');
    const sqMap = ['low', 'medium', 'high'];
    state.sampleQuality = sqMap[parseInt(params.get('sq') || '1')];
  }
}
```

---

## Phase 6: Testing

**Files to create:**
- `src/tests/lib/opacity/types.test.ts`
- `src/tests/lib/opacity/constants.test.ts`
- `src/tests/stores/visualStore.opacity.test.ts`
- `src/tests/components/sidebar/OpacityControls.test.tsx`
- `src/tests/lib/url/opacity-serialization.test.ts`
- `scripts/playwright/opacity-modes.spec.ts`

### Test Coverage Requirements

| Test Area | Test Count |
|-----------|------------|
| Type definitions | 5 |
| Store actions | 12 |
| UI controls | 15 |
| URL serialization | 10 |
| Mode persistence | 4 |
| E2E visual tests | 6 |

---

## Implementation Order

| Step | Story | Tasks | Dependencies |
|------|-------|-------|--------------|
| 1 | Story 1 | Phase 1 (Types + Store) | None |
| 2 | Story 2 | Phase 2.1-2.2 (Solid shader) | Step 1 |
| 3 | Story 3 | Phase 2.2 (Simple Alpha) + Phase 4.1-4.2 | Steps 1-2 |
| 4 | Story 1 | Phase 3 (Mesh updates) | Steps 1-3 |
| 5 | Story 1 | Phase 4.1 (Mode dropdown) | Step 4 |
| 6 | Story 4 | Phase 2.2 (Layered) + UI | Step 5 |
| 7 | Story 5 | Phase 2.2 (Volumetric) + Phase 4.3 | Step 5 |
| 8 | Story 6 | Phase 5 (URL) | Steps 1-7 |
| 9 | All | Phase 6 (Testing) | Step 8 |

---

## Open Questions from PRD

1. **Volumetric during rotation**: Consider using lower sample quality during rotation, switch to full quality when static (already supported by adaptive quality system)

2. **Layer colors**: Recommend keeping same color with depth-based alpha gradation (simpler implementation, visually cleaner)

---

## Estimated Complexity

- Phase 1: Low (boilerplate types/state)
- Phase 2: High (shader math for layered/volumetric)
- Phase 3: Low (uniform passing)
- Phase 4: Medium (conditional UI)
- Phase 5: Low (serialization patterns exist)
- Phase 6: Medium (comprehensive test coverage)
