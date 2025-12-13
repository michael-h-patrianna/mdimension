# Hypersphere Removal Plan

## Overview

This plan details the complete removal of the Hypersphere object type and all functionality exclusively used by it from the codebase.

**Total Files Affected:** 15 source files + 4 test files + 9 documentation files

---

## Phase 1: Delete Exclusive Files

These files exist solely for Hypersphere and should be deleted completely.

| File | Description |
|------|-------------|
| `src/lib/geometry/extended/hypersphere.ts` | Main implementation (generateHypersphere, sampleHypersphereSurface, sampleHypersphereSolid) |
| `src/tests/lib/geometry/extended/hypersphere.test.ts` | All Hypersphere unit tests |

---

## Phase 2: Update Type Definitions

### `src/lib/geometry/extended/types.ts`

Remove:
- `HypersphereMode` type (line ~94): `"surface" | "solid"`
- `HypersphereConfig` interface (lines ~99-110)
- `DEFAULT_HYPERSPHERE_CONFIG` constant (lines ~115-121)
- `hypersphere` property from `ExtendedObjectParams` interface
- `hypersphere` from `DEFAULT_EXTENDED_OBJECT_PARAMS`

### `src/lib/geometry/types.ts`

Remove:
- `"hypersphere"` from `ExtendedObjectType` union type
- `"hypersphere"` from `ObjectType` union type
- `"hypersphere"` case from `isExtendedObjectType()` function

---

## Phase 3: Update Library Exports

### `src/lib/geometry/extended/index.ts`

Remove:
- Type exports: `HypersphereMode`, `HypersphereConfig`
- Default config export: `DEFAULT_HYPERSPHERE_CONFIG`
- Function exports: `generateHypersphere`, `sampleHypersphereSurface`, `sampleHypersphereSolid`
- `case "hypersphere"` from `generateExtendedObject()` switch statement

### `src/lib/geometry/index.ts`

Remove:
- Type re-exports: `HypersphereMode`, `HypersphereConfig`
- Default config re-export: `DEFAULT_HYPERSPHERE_CONFIG`
- Function re-exports: `generateHypersphere`, `sampleHypersphereSurface`, `sampleHypersphereSolid`
- `"hypersphere"` from `getAvailableTypes()` return array
- `"hypersphere"` case from `getTypeName()` function

---

## Phase 4: Update State Management

### `src/stores/extendedObjectStore.ts`

Remove imports:
```typescript
import { HypersphereConfig, HypersphereMode } from '...';
import { DEFAULT_HYPERSPHERE_CONFIG } from '...';
```

Remove from state interface:
```typescript
hypersphere: HypersphereConfig;
```

Remove action type signatures:
- `setHypersphereMode: (mode: HypersphereMode) => void`
- `setHypersphereSampleCount: (count: number) => void`
- `setHypersphereRadius: (radius: number) => void`
- `setHypersphereWireframeEnabled: (enabled: boolean) => void`
- `setHypersphereNeighborCount: (count: number) => void`

Remove from initial state:
```typescript
hypersphere: { ...DEFAULT_HYPERSPHERE_CONFIG },
```

Remove all action implementations (5 functions).

Remove from `reset()` function:
```typescript
hypersphere: { ...DEFAULT_HYPERSPHERE_CONFIG },
```

---

## Phase 5: Update UI Components

### `src/components/sidebar/Geometry/ObjectSettingsSection.tsx`

Remove:
- `HypersphereSettings` component definition (lines ~91-143)
- Render condition: `{objectType === 'hypersphere' && <HypersphereSettings />}`
- Related imports from extendedObjectStore

### `src/components/sidebar/RenderMode/RenderModeToggles.tsx`

Update:
- Remove `"hypersphere"` from `canRenderFaces()` exclusion list
- Update/remove comment about faces toggle disabled for hypersphere

### `src/components/controls/RenderModeToggles.tsx`

Update:
- Remove `"hypersphere"` from `canRenderFaces()` exclusion list
- Update/remove comment about faces toggle disabled for hypersphere

---

## Phase 6: Update Hooks

### `src/hooks/useGeometryGenerator.ts`

Remove:
- Import: `hypersphereConfig` selector from extendedObjectStore
- Reference in `extendedParams` object construction
- Update comment about Edges toggle controlling hypersphere wireframe

---

## Phase 7: Update Utilities

### `src/lib/url/state-serializer.ts`

Remove:
- `"hypersphere"` from `VALID_OBJECT_TYPES` array

---

## Phase 8: Update Tests

### `src/tests/lib/geometry/index.test.ts`

Update:
- Remove `"hypersphere"` from `getAvailableTypes()` test expectations

### `src/tests/stores/geometryStore.test.ts`

Remove:
- Test case for `setObjectType("hypersphere")`

### `src/tests/stores/extendedObjectStore.test.ts`

Remove:
- Import: `DEFAULT_HYPERSPHERE_CONFIG`
- Test: default hypersphere config verification
- Test: `setHypersphereMode()` action
- Test: `setHypersphereSampleCount()` action
- Test: `setHypersphereRadius()` action
- Test: `setHypersphereWireframeEnabled()` action
- Test: `setHypersphereNeighborCount()` action

---

## Phase 9: Update Comments (Low Priority)

These files contain only comments referencing Hypersphere:

| File | Action |
|------|--------|
| `src/components/canvas/scenes/PointCloudScene.tsx` | Update "Used for" comment |
| `src/components/canvas/renderers/PointCloudRenderer.tsx` | Update description comments |
| `src/components/canvas/renderers/UnifiedRenderer.tsx` | Update routing comments |
| `src/lib/shaders/constants.ts` | Update radius comments |
| `src/App.tsx` | Update extended objects comment |

---

## Phase 10: Update Documentation

| Document | Action |
|----------|--------|
| `docs/prd/extended-objects.md` | Remove Hypersphere section |
| `docs/research/nd-extended-objects-guide.md` | Remove Section 1 (Hypersphere) |
| `docs/plans/extended-objects.md` | Remove Hypersphere references |
| `docs/prd/render-mode-toggles.md` | Remove Hypersphere rendering notes |
| `docs/plans/render-mode-toggles-implementation.md` | Update if Hypersphere mentioned |
| `docs/prd/torus-surface-shader.md` | Remove Hypersphere comparison |
| `docs/research/executive_overview.md` | Update extended objects list |
| `docs/research/synthesis.md` | Update if referenced |
| `.github/copilot-instructions.md` | Remove Hypersphere reference |

---

## Verification Checklist

After removal, verify:

- [ ] `npm run build` completes without errors
- [ ] `npm test` passes all tests
- [ ] No TypeScript errors related to missing Hypersphere types
- [ ] Object type selector no longer shows Hypersphere option
- [ ] URL state serializer handles legacy `?type=hypersphere` URLs gracefully
- [ ] No runtime errors when switching between remaining object types

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Shared utilities used by Hypersphere | Analysis shows all Hypersphere functions are self-contained |
| URL state with `type=hypersphere` | Serializer will reject invalid type, fallback to default |
| Missing type in switch statements | TypeScript exhaustiveness checking will catch these |

---

## Estimated Changes Summary

| Category | Files | Deletions | Modifications |
|----------|-------|-----------|---------------|
| Core Implementation | 1 | 1 | 0 |
| Type Definitions | 2 | 0 | 2 |
| Library Exports | 2 | 0 | 2 |
| State Management | 1 | 0 | 1 |
| UI Components | 3 | 0 | 3 |
| Hooks | 1 | 0 | 1 |
| Utilities | 1 | 0 | 1 |
| Tests | 4 | 1 | 3 |
| Comments Only | 5 | 0 | 5 |
| Documentation | 9 | 0 | 9 |
| **Total** | **29** | **2** | **27** |
