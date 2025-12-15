# Render Mode Toggles - Implementation Plan

## Overview

Replace the current shader selection system with three toggle buttons (Vertices, Edges, Faces) at the top of the sidebar. Remove the Dual Outline shader entirely.

**PRD:** `docs/prd/render-mode-toggles.md`

---

## Phase 1: State Layer Changes

### 1.1 Update Visual Store
**File:** `src/stores/visualStore.ts`

- Add `edgesVisible: boolean` (default: `true`)
- Add `facesVisible: boolean` (default: `false`)
- Add `setEdgesVisible(visible: boolean)` action
- Add `setFacesVisible(visible: boolean)` action - auto-sets `shaderType` to `'surface'` when true, `'wireframe'` when false
- Remove `setDualOutlineSettings` action
- Remove `dualOutline` from `shaderSettings` in INITIAL_STATE
- Update `reset()` to reset new state

### 1.2 Update Shader Types
**File:** `src/lib/shaders/types.ts`

- Change `ShaderType` from `'wireframe' | 'dualOutline' | 'surface'` to `'wireframe' | 'surface'`
- Remove `DualOutlineSettings` interface
- Remove `DEFAULT_DUAL_OUTLINE_SETTINGS`
- Remove `dualOutline` from `AllShaderSettings`
- Remove `isDualOutlineSettings` type guard
- Update `SHADER_DISPLAY_NAMES` and `SHADER_DESCRIPTIONS`

---

## Phase 2: Rendering Pipeline Updates

### 2.1 Update PolytopeRenderer
**File:** `src/components/canvas/PolytopeRenderer.tsx`

- Subscribe to `edgesVisible` from store
- Remove `isDualOutline` logic and dual-line rendering
- Wrap Wireframe component in `{edgesVisible && ...}`

### 2.2 Update Scene
**File:** `src/components/canvas/Scene.tsx`

- Subscribe to `facesVisible` from store
- Change `shouldRenderFaces` from `shaderType === 'surface'` to `facesVisible`

---

## Phase 3: UI Component Changes

### 3.1 Create RenderModeToggles Component
**New File:** `src/components/controls/RenderModeToggles.tsx`

```
Component structure:
- Row of 3 ToggleButton components: "Vertices", "Edges", "Faces"
- Subscribe to vertexVisible, edgesVisible, facesVisible from visualStore
- Subscribe to objectType from geometryStore
- Disable Faces toggle when: !isPolytopeType(objectType) && objectType !== 'root-system'
- Include tooltip for disabled state: "Faces not available for this object type"
```

### 3.2 Update Layout
**File:** `src/components/Layout.tsx`

- Import `RenderModeToggles`
- Remove `ShaderSelector` import
- Add `<RenderModeToggles />` above first Section (with border-bottom separator)
- Remove `<ShaderSelector />` from Visual section

### 3.3 Update ShaderSettings
**File:** `src/components/controls/ShaderSettings.tsx`

- Remove `dualOutline` imports and references
- Remove entire `{shaderType === 'dualOutline' && ...}` block

### 3.4 Update VisualControls
**File:** `src/components/controls/VisualControls.tsx`

- Remove "Show Vertices" ToggleButton (moved to top toggles)
- Keep vertex color/size controls (always visible now, controlled by top toggle)

---

## Phase 4: File Cleanup

### 4.1 Delete Files
- `src/components/controls/ShaderSelector.tsx`
- `src/lib/shaders/materials/DualOutlineMaterial.ts`

### 4.2 Update Shader Materials Index
**File:** `src/lib/shaders/materials/index.ts`

- Remove all DualOutline exports

---

## Phase 5: URL State Serialization

**File:** `src/lib/url/state-serializer.ts`

- Remove `'dualOutline'` from `VALID_SHADER_TYPES`
- Add `edgesVisible` serialization: `ev=0` when false (omit when true)
- Add `facesVisible` serialization: `fv=1` when true (omit when false)
- Backward compatibility: map `sh=dualOutline` to `wireframe`

---

## Phase 6: Test Updates

### 6.1 Delete Tests
- `src/tests/components/controls/ShaderSelector.test.tsx`

### 6.2 Create New Tests
**New File:** `src/tests/components/controls/RenderModeToggles.test.tsx`

Test cases:
- Initial state: Vertices ON, Edges ON, Faces OFF
- Toggle each visibility
- Faces toggle disabled for hypersphere, clifford-torus, mandelbrot
- Faces toggle enabled for hypercube, simplex, cross-polytope, root-system
- Faces toggle auto-changes shaderType

### 6.3 Update Existing Tests
- `src/tests/stores/visualStore.test.ts` - add edgesVisible/facesVisible tests
- `src/tests/components/controls/ShaderSettings.test.tsx` - remove dualOutline tests
- `src/tests/lib/url/state-serializer.test.ts` - update for new state, add backward compat test

---

## Implementation Order

| Step | Phase | Description | Files |
|------|-------|-------------|-------|
| 1 | 1.1-1.2 | State layer changes | `visualStore.ts`, `types.ts` |
| 2 | 2.1-2.2 | Rendering updates | `PolytopeRenderer.tsx`, `Scene.tsx` |
| 3 | 3.1 | Create toggle component | `RenderModeToggles.tsx` (new) |
| 4 | 3.2 | Update layout | `Layout.tsx` |
| 5 | 3.3-3.4 | Update control components | `ShaderSettings.tsx`, `VisualControls.tsx` |
| 6 | 4.1-4.2 | Delete obsolete files | `ShaderSelector.tsx`, `DualOutlineMaterial.ts`, `materials/index.ts` |
| 7 | 5 | URL serialization | `state-serializer.ts` |
| 8 | 6 | Tests | All test files |

---

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/stores/visualStore.ts` | Modify | Add edgesVisible, facesVisible state |
| `src/lib/shaders/types.ts` | Modify | Remove dualOutline from ShaderType |
| `src/components/controls/RenderModeToggles.tsx` | Create | New toggle row component |
| `src/components/Layout.tsx` | Modify | Add toggle row, remove ShaderSelector |
| `src/components/canvas/PolytopeRenderer.tsx` | Modify | Respect edgesVisible |
| `src/components/canvas/Scene.tsx` | Modify | Use facesVisible for face rendering |
| `src/components/controls/ShaderSelector.tsx` | Delete | Replaced by toggles |
| `src/lib/shaders/materials/DualOutlineMaterial.ts` | Delete | Shader removed |

---

## Verification

After implementation:
1. `npm test` - all tests pass
2. Toggle Vertices ON/OFF - vertices appear/disappear
3. Toggle Edges ON/OFF - edges appear/disappear
4. Toggle Faces ON/OFF - faces appear/disappear, shader changes
5. Faces toggle disabled for hypersphere, clifford-torus, mandelbrot
6. URL sharing preserves toggle states
7. Old URLs with `sh=dualOutline` load without errors (maps to wireframe)
