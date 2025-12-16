# Schroedinger Implementation Plan

Create an exact copy of the Mandelbulb content object with all its features, renamed to "Schroedinger". This will be the foundation for future modifications.

## Overview

The Mandelbulb implementation spans multiple layers:
- **Geometry library** - Math, sampling, coloring algorithms
- **Store slice** - State management with Zustand
- **Registry** - Object type metadata and capabilities
- **Rendering** - Fragment/vertex shaders and mesh component
- **UI** - Controls panel and animation drawer
- **Hooks** - Derived state helpers
- **Tests** - Full test coverage

---

## Phase 1: Core Type Definitions

### 1.1 Add `schroedinger` to ObjectType union

**File:** `src/lib/geometry/types.ts`

Add `'schroedinger'` to the `ExtendedObjectType` union:

```typescript
export type ExtendedObjectType =
  | 'root-system'
  | 'clifford-torus'
  | 'nested-torus'
  | 'mandelbulb'
  | 'quaternion-julia'
  | 'schroedinger'  // ADD THIS
```

Update `isExtendedObjectType()` type guard to include `'schroedinger'`.

### 1.2 Add SchroedingerConfig to extended types

**File:** `src/lib/geometry/extended/types.ts`

1. Create `SchroedingerConfig` interface (copy from `MandelbulbConfig`)
2. Create `SchroedingerColorMode`, `SchroedingerPalette`, etc. types
3. Create `SCHROEDINGER_QUALITY_PRESETS` constant
4. Create `DEFAULT_SCHROEDINGER_CONFIG` constant
5. Add `schroedinger: SchroedingerConfig` to `ExtendedObjectParams` interface
6. Add `schroedinger: DEFAULT_SCHROEDINGER_CONFIG` to `DEFAULT_EXTENDED_OBJECT_PARAMS`

### 1.3 Add SchroedingerSlice types

**File:** `src/stores/slices/geometry/types.ts`

1. Create `SchroedingerSliceState` interface
2. Create `SchroedingerSliceActions` interface (copy from MandelbulbSliceActions, rename methods)
3. Create `SchroedingerSlice` type
4. Add `SchroedingerSlice` to `ExtendedObjectSlice` union

---

## Phase 2: Geometry Library

**Create folder:** `src/lib/geometry/extended/schroedinger/`

### 2.1 Create math.ts
Copy from `mandelbulb/math.ts`, rename exports to use `schroedinger` prefix.

### 2.2 Create hyperspherical.ts
Copy from `mandelbulb/hyperspherical.ts`, rename exports.

### 2.3 Create utils.ts
Copy from `mandelbulb/utils.ts`, rename exports.

### 2.4 Create sampling.ts
Copy from `mandelbulb/sampling.ts`, rename exports.

### 2.5 Create edges.ts
Copy from `mandelbulb/edges.ts`, rename exports.

### 2.6 Create colors.ts
Copy from `mandelbulb/colors.ts`, rename exports.

### 2.7 Create index.ts
Export all functions with schroedinger naming:
- `generateSchroedinger`
- `schroedingerEscapeTime`
- `schroedingerStep`
- etc.

---

## Phase 3: Store Slice

### 3.1 Create schroedingerSlice.ts

**File:** `src/stores/slices/geometry/schroedingerSlice.ts`

Copy from `mandelbulbSlice.ts`, rename:
- All functions from `setMandelbulb*` to `setSchroedinger*`
- State property from `mandelbulb` to `schroedinger`
- Import `DEFAULT_SCHROEDINGER_CONFIG` instead of `DEFAULT_MANDELBROT_CONFIG`

### 3.2 Update extendedObjectStore.ts

**File:** `src/stores/extendedObjectStore.ts`

1. Import `createSchroedingerSlice`
2. Import `DEFAULT_SCHROEDINGER_CONFIG`
3. Add `...createSchroedingerSlice(...a)` to store creation
4. Add `schroedinger: { ...DEFAULT_SCHROEDINGER_CONFIG }` to reset action

---

## Phase 4: Registry Configuration

### 4.1 Add to OBJECT_TYPE_REGISTRY

**File:** `src/lib/geometry/registry/registry.ts`

Add complete registry entry for 'schroedinger' (copy mandelbulb entry, rename):

```typescript
[
  'schroedinger',
  {
    type: 'schroedinger',
    name: 'Schroedinger',
    description: 'Fractal via escape-time iteration (3D: Schroedinger, 4D+: Schroedinger)',
    category: 'fractal',
    dimensions: { min: 3, max: 11, recommended: 4 },
    rendering: {
      supportsFaces: true,
      supportsEdges: true,
      supportsPoints: false,
      renderMethod: 'raymarch',
      faceDetection: 'none',
      requiresRaymarching: true,
      edgesAreFresnelRim: true,
    },
    animation: { ... }, // Copy mandelbulb animation systems, rename keys
    urlSerialization: {
      typeKey: 'schroedinger',
      serializableParams: ['maxIterations', 'escapeRadius', 'resolution', 'schroedingerPower'],
    },
    ui: {
      controlsComponentKey: 'SchroedingerControls',
      hasTimelineControls: true,
      qualityPresets: ['draft', 'standard', 'high', 'ultra'],
    },
    configStoreKey: 'schroedinger',
  },
],
```

### 4.2 Add to component loaders

**File:** `src/lib/geometry/registry/components.ts`

Add lazy loader for SchroedingerControls:

```typescript
SchroedingerControls: () =>
  import('@/components/sections/Geometry/SchroedingerControls').then((m) => ({
    default: m.SchroedingerControls as ComponentType<unknown>,
  })),
```

### 4.3 Update determineRenderMode helper

**File:** `src/lib/geometry/registry/helpers.ts`

Update the `determineRenderMode` function return type and add schroedinger case:

```typescript
export function determineRenderMode(
  type: ObjectType,
  dimension: number,
  facesVisible: boolean
): 'polytope' | 'raymarch-mandelbulb' | 'raymarch-quaternion-julia' | 'raymarch-schroedinger' | 'none' {
  // ... existing code ...
  if (type === 'schroedinger') return 'raymarch-schroedinger'
  // ...
}
```

---

## Phase 5: Rendering

**Create folder:** `src/rendering/renderers/Schroedinger/`

### 5.1 Create schroedinger.vert

Copy from `mandelbulb.vert`, no changes needed (generic vertex shader).

### 5.2 Create schroedinger.frag

Copy from `mandelbulb.frag`, rename uniform references and any Mandelbulb-specific naming.

### 5.3 Create SchroedingerMesh.tsx

Copy from `MandelbulbMesh.tsx`, rename:
- Component name to `SchroedingerMesh`
- Store hooks from `useExtendedObjectStore(...mandelbulb...)` to `...schroedinger...`
- Shader imports

### 5.4 Create index.ts

```typescript
export { default as SchroedingerMesh } from './SchroedingerMesh'
```

### 5.5 Update UnifiedRenderer.tsx

**File:** `src/rendering/renderers/UnifiedRenderer.tsx`

1. Import `SchroedingerMesh`
2. Add to `RenderMode` type: `'raymarch-schroedinger'`
3. Add render case:
```typescript
{renderMode === 'raymarch-schroedinger' && <SchroedingerMesh />}
```

---

## Phase 6: UI Components

### 6.1 Create SchroedingerControls.tsx

**File:** `src/components/sections/Geometry/SchroedingerControls.tsx`

Copy from `MandelbulbControls.tsx`, rename:
- Component name
- Store selectors from `mandelbulb` to `schroedinger`
- Action calls from `setMandelbulb*` to `setSchroedinger*`

### 6.2 Create SchroedingerAnimationDrawer.tsx

**File:** `src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx`

Copy from `MandelbulbAnimationDrawer.tsx`, rename:
- Component name
- Store selectors and actions

### 6.3 Update TimelineControls index

**File:** `src/components/layout/TimelineControls/index.ts`

Add export:
```typescript
export { SchroedingerAnimationDrawer } from './SchroedingerAnimationDrawer';
```

---

## Phase 7: Hooks

### 7.1 Create useSchroedingerColors.ts

**File:** `src/hooks/useSchroedingerColors.ts`

Copy from `useMandelbulbColors.ts`, rename:
- Hook name to `useSchroedingerColors`
- Store selectors from `mandelbulb` to `schroedinger`

---

## Phase 8: Extended Object Integration

### 8.1 Update extended/index.ts

**File:** `src/lib/geometry/extended/index.ts`

1. Add type exports for Schroedinger types
2. Add default config exports
3. Add function exports from schroedinger module
4. Add `'schroedinger'` case to `generateExtendedObject()`:

```typescript
case 'schroedinger':
  return {
    dimension,
    type: 'schroedinger',
    vertices: [],
    edges: [],
    metadata: {
      name: 'Schroedinger',
      properties: { renderMode: 'raymarching' },
    },
  }
```

---

## Phase 9: URL Serialization (if needed)

**File:** `src/lib/url/state-serializer.ts`

Add schroedinger serialization/deserialization if URL state persistence is required.

---

## Phase 10: Tests

### 10.1 Unit Tests

Create test files mirroring Mandelbulb tests:

1. `src/tests/lib/geometry/extended/schroedinger.test.ts`
2. `src/tests/lib/geometry/extended/schroedinger-colors.test.ts`
3. `src/tests/components/canvas/SchroedingerMesh.test.tsx`
4. `src/tests/hooks/useSchroedingerColors.test.ts`
5. `src/tests/components/layout/SchroedingerAnimationDrawer.test.tsx`
6. `src/tests/stores/slices/geometry/schroedingerSlice.test.ts`

### 10.2 Run All Tests

```bash
npm test
```

Ensure 100% pass rate and coverage.

---

## File Summary

### New Files (21 total)

| Category | File |
|----------|------|
| Geometry | `src/lib/geometry/extended/schroedinger/index.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/math.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/hyperspherical.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/utils.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/sampling.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/edges.ts` |
| Geometry | `src/lib/geometry/extended/schroedinger/colors.ts` |
| Store | `src/stores/slices/geometry/schroedingerSlice.ts` |
| Rendering | `src/rendering/renderers/Schroedinger/index.ts` |
| Rendering | `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` |
| Rendering | `src/rendering/renderers/Schroedinger/schroedinger.frag` |
| Rendering | `src/rendering/renderers/Schroedinger/schroedinger.vert` |
| UI | `src/components/sections/Geometry/SchroedingerControls.tsx` |
| UI | `src/components/layout/TimelineControls/SchroedingerAnimationDrawer.tsx` |
| Hooks | `src/hooks/useSchroedingerColors.ts` |
| Tests | `src/tests/lib/geometry/extended/schroedinger.test.ts` |
| Tests | `src/tests/lib/geometry/extended/schroedinger-colors.test.ts` |
| Tests | `src/tests/components/canvas/SchroedingerMesh.test.tsx` |
| Tests | `src/tests/hooks/useSchroedingerColors.test.ts` |
| Tests | `src/tests/components/layout/SchroedingerAnimationDrawer.test.tsx` |
| Tests | `src/tests/stores/slices/geometry/schroedingerSlice.test.ts` |

### Modified Files (11 total)

| File | Changes |
|------|---------|
| `src/lib/geometry/types.ts` | Add 'schroedinger' to ExtendedObjectType |
| `src/lib/geometry/extended/types.ts` | Add SchroedingerConfig, defaults |
| `src/stores/slices/geometry/types.ts` | Add SchroedingerSlice types |
| `src/stores/extendedObjectStore.ts` | Add schroedinger slice |
| `src/lib/geometry/registry/registry.ts` | Add schroedinger registry entry |
| `src/lib/geometry/registry/components.ts` | Add SchroedingerControls loader |
| `src/lib/geometry/registry/helpers.ts` | Add schroedinger to determineRenderMode |
| `src/lib/geometry/extended/index.ts` | Export schroedinger module |
| `src/components/layout/TimelineControls/index.ts` | Export SchroedingerAnimationDrawer |
| `src/rendering/renderers/UnifiedRenderer.tsx` | Add raymarch-schroedinger mode |
| `src/lib/url/state-serializer.ts` | Add schroedinger serialization |

---

## Verification Checklist

After implementation, verify:

- [ ] `schroedinger` appears in object type selector dropdown
- [ ] Selecting Schroedinger renders fractal identical to Mandelbulb
- [ ] All animation controls work (power, slice, origin drift, etc.)
- [ ] Timeline animation drawer shows Schroedinger animations
- [ ] Quality presets (draft/standard/high/ultra) work
- [ ] Color modes and palettes work
- [ ] URL serialization preserves Schroedinger state
- [ ] All tests pass with 100% coverage
- [ ] No TypeScript errors

---

## Implementation Order

Execute phases in order (1-10) to ensure dependencies are satisfied:

1. **Phase 1** - Types must exist before anything else
2. **Phase 2** - Geometry library (standalone, no deps)
3. **Phase 3** - Store slice (depends on Phase 1 types)
4. **Phase 4** - Registry (depends on Phase 1 types)
5. **Phase 5** - Rendering (depends on Phases 2, 3)
6. **Phase 6** - UI (depends on Phases 3, 4)
7. **Phase 7** - Hooks (depends on Phase 3)
8. **Phase 8** - Integration (depends on Phase 2)
9. **Phase 9** - Serialization (depends on Phase 3)
10. **Phase 10** - Tests (depends on all above)
