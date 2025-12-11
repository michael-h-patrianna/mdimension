# N-Dimensional Visualizer: Revised Implementation Plan (v2)

## Problem Statement

The original implementation plan had work packages that were too large, causing subagents to exhaust context before completing tasks. This revised plan breaks down remaining work into **micro-packages** (~30-60 min each) that are completable within a single focused session.

---

## Current Completion Status

### Phase 1: Foundation - COMPLETE
- [x] 1A: Project Setup & Configuration
- [x] 1B: N-Dimensional Math Library (vector, matrix, rotation, transform, projection)

### Phase 2: Core Features - PARTIALLY COMPLETE
- [x] 2A: Object Generation (hypercube, simplex, cross-polytope)
- [x] 2B-1: Three.js Scene component
- [x] 2B-2: PolytopeRenderer component
- [x] 2B-3: CameraController component
- [x] 2C-1: Rotation store (rotationStore.ts)
- [x] 2C-2: Rotation sliders (RotationSlider.tsx)
- [x] 2C-3: Rotation controls panel (RotationControls.tsx)
- [x] 2D-1: Projection store (projectionStore.ts)
- [x] 2D-2: Projection controls (ProjectionControls.tsx, ProjectionTypeToggle.tsx)
- [x] 2E: UI Framework (Button, Slider, Select, ToggleGroup, Section, Tooltip, ControlPanel)
- [x] Hooks: useProjectedVertices, useRotatedVertices

**REMAINING Phase 2 Work:**
- [ ] 2F-1: Geometry store (dimension + object type state)
- [ ] 2F-2: Dimension selector UI
- [ ] 2F-3: Object type selector UI
- [ ] 2G: App integration (wire everything together)

### Phase 3: Transformations - NOT STARTED
### Phase 4: Advanced Features - NOT STARTED
### Phase 5: Polish & Integration - NOT STARTED

---

## Micro-Package Work Breakdown

Each package is designed to be completable in ONE focused session without context exhaustion.

---

## PHASE 2 COMPLETION (4 micro-packages)

### Package 2F-1: Geometry Store

**Context needed:** Just store patterns from existing stores
**Estimated time:** 30 min
**Deliverables:** 1 file + 1 test file

```markdown
=== TASK: Create Geometry Store ===

Create a Zustand store to manage the current dimension and object type.

REFERENCE FILES (read these first):
- src/stores/rotationStore.ts (pattern to follow)
- src/stores/projectionStore.ts (pattern to follow)
- src/lib/geometry/types.ts (PolytopeType definition)

CREATE:

1. src/stores/geometryStore.ts
```typescript
interface GeometryState {
  dimension: number;  // 3-6, default 4
  objectType: PolytopeType;  // default 'hypercube'
  setDimension(dim: number): void;
  setObjectType(type: PolytopeType): void;
  reset(): void;
}
```

2. src/tests/stores/geometryStore.test.ts
- Test default values (dimension=4, type='hypercube')
- Test setDimension validates range 3-6
- Test setObjectType accepts valid types
- Test reset restores defaults

CONSTRAINTS:
- Dimension must be clamped to 3-6 range
- Follow exact pattern of existing stores

QUALITY GATE:
✓ npm test passes
✓ Store exports correctly from src/stores/index.ts
```

---

### Package 2F-2: Dimension Selector UI

**Context needed:** UI component patterns
**Estimated time:** 30 min
**Deliverables:** 1 file + 1 test file

```markdown
=== TASK: Create Dimension Selector Component ===

Create a UI component for selecting dimension (3D/4D/5D/6D).

REFERENCE FILES:
- src/components/ui/ToggleGroup.tsx (use this component)
- src/stores/geometryStore.ts (use this store)

CREATE:

1. src/components/controls/DimensionSelector.tsx
```typescript
// Simple toggle group for dimension selection
// Options: 3, 4, 5, 6
// Uses geometryStore.dimension and setDimension
// Tooltip: "Select the number of dimensions for the object"
```

2. src/tests/components/controls/DimensionSelector.test.tsx
- Renders 4 options (3,4,5,6)
- Current dimension is highlighted
- Clicking option calls setDimension
- Default selection is 4

CONSTRAINTS:
- Use existing ToggleGroup component
- Connect to geometryStore via Zustand hook

QUALITY GATE:
✓ npm test passes
✓ Component renders without errors
```

---

### Package 2F-3: Object Type Selector UI

**Context needed:** UI component patterns
**Estimated time:** 30 min
**Deliverables:** 1 file + 1 test file

```markdown
=== TASK: Create Object Type Selector Component ===

Create a UI component for selecting object type.

REFERENCE FILES:
- src/components/ui/Select.tsx (use this component)
- src/stores/geometryStore.ts (use this store)
- src/lib/geometry/index.ts (getAvailableTypes function)

CREATE:

1. src/components/controls/ObjectTypeSelector.tsx
```typescript
// Dropdown select for object type
// Options from getAvailableTypes(): hypercube, simplex, cross-polytope
// Uses geometryStore.objectType and setObjectType
// Shows description in option
```

2. src/tests/components/controls/ObjectTypeSelector.test.tsx
- Renders with correct options
- Current type is selected
- Changing selection calls setObjectType
- Default is 'hypercube'

CONSTRAINTS:
- Use existing Select component
- Show object type descriptions

QUALITY GATE:
✓ npm test passes
✓ Component renders without errors
```

---

### Package 2G: App Integration

**Context needed:** Existing components and stores
**Estimated time:** 45 min
**Deliverables:** Update App.tsx and Layout.tsx

```markdown
=== TASK: Wire Everything Together ===

Connect all stores and components in App.tsx and Layout.tsx.

REFERENCE FILES:
- src/App.tsx (update this)
- src/components/Layout.tsx (update this)
- All stores: geometryStore, rotationStore, projectionStore
- Components: DimensionSelector, ObjectTypeSelector, RotationControls, ProjectionControls
- Hooks: useProjectedVertices, useRotatedVertices
- Geometry: generatePolytope

UPDATE App.tsx:
1. Use geometryStore to get dimension and objectType
2. Generate polytope using generatePolytope(objectType, dimension)
3. Use useRotatedVertices to apply rotation
4. Use useProjectedVertices to project to 3D
5. Pass projected vertices to Scene

UPDATE Layout.tsx:
1. Add DimensionSelector in "Object" section
2. Add ObjectTypeSelector in "Object" section
3. Add RotationControls in "Rotation" section
4. Add ProjectionControls in "Projection" section

TEST:
- App loads with 4D hypercube visible
- Changing dimension updates object
- Changing type updates object
- Rotation sliders rotate object
- Projection settings affect view

QUALITY GATE:
✓ npm test passes
✓ npm run dev shows working visualization
✓ All controls affect the 3D view
```

---

## PHASE 3: TRANSFORMATIONS (5 micro-packages)

### Package 3A-1: Transform Store - Scale

**Context needed:** Store patterns
**Estimated time:** 30 min

```markdown
=== TASK: Add Scale to Transform Store ===

Create transform store with scale functionality.

CREATE src/stores/transformStore.ts:
```typescript
interface TransformState {
  // Scale
  uniformScale: number;  // 0.1-3.0, default 1.0
  perAxisScale: number[];  // per dimension, default all 1.0
  scaleLocked: boolean;  // default true

  setUniformScale(value: number): void;
  setAxisScale(axis: number, value: number): void;
  setScaleLocked(locked: boolean): void;
  resetScale(): void;

  getScaleMatrix(): MatrixND;
}
```

CREATE src/tests/stores/transformStore.scale.test.ts:
- Default uniform scale is 1.0
- Scale clamped to 0.1-3.0
- Locked mode syncs all axes
- getScaleMatrix returns correct diagonal matrix

QUALITY GATE:
✓ npm test passes
```

---

### Package 3A-2: Scale Controls UI

**Context needed:** UI patterns
**Estimated time:** 30 min

```markdown
=== TASK: Create Scale Controls Component ===

CREATE src/components/controls/ScaleControls.tsx:
- Uniform scale slider (0.1 to 3.0)
- Lock toggle button
- Per-axis sliders (X, Y, Z, W...) - disabled when locked
- Reset button
- Warning at extreme values (<0.2 or >2.5)

CREATE src/tests/components/controls/ScaleControls.test.tsx:
- Renders uniform slider
- Lock toggle works
- Per-axis sliders appear for current dimension
- Reset button works

QUALITY GATE:
✓ npm test passes
```

---

### Package 3B: Shear Transform

**Context needed:** Transform store pattern
**Estimated time:** 45 min

```markdown
=== TASK: Add Shear to Transform Store + UI ===

EXTEND src/stores/transformStore.ts:
```typescript
// Add to interface
shears: Map<string, number>;  // plane -> amount (-2 to +2)
setShear(plane: string, amount: number): void;
resetShears(): void;
getShearMatrix(): MatrixND;
```

CREATE src/components/controls/ShearControls.tsx:
- One slider per shear direction (same planes as rotation)
- Range -2.0 to +2.0, default 0
- Reset button
- Formula tooltip

CREATE tests for both.

QUALITY GATE:
✓ npm test passes
```

---

### Package 3C: Translation Transform

**Context needed:** Transform store pattern
**Estimated time:** 30 min

```markdown
=== TASK: Add Translation to Transform Store + UI ===

EXTEND src/stores/transformStore.ts:
```typescript
// Add to interface
translation: number[];  // per dimension, default all 0
setTranslation(axis: number, value: number): void;
resetTranslation(): void;
center(): void;
getTranslationMatrix(): MatrixND;
```

CREATE src/components/controls/TranslationControls.tsx:
- Per-axis sliders (X, Y, Z, W...)
- Range -5.0 to +5.0
- Center button (resets all to 0)

CREATE tests.

QUALITY GATE:
✓ npm test passes
```

---

### Package 3D: Animation System

**Context needed:** Store patterns, requestAnimationFrame
**Estimated time:** 45 min

```markdown
=== TASK: Create Animation Store + Hook ===

CREATE src/stores/animationStore.ts:
```typescript
interface AnimationState {
  isPlaying: boolean;
  speed: number;  // 0.1-5.0
  direction: 1 | -1;
  animatingPlanes: Set<string>;

  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  toggleDirection(): void;
  togglePlane(plane: string): void;
  animateAll(): void;
  stopAll(): void;
}
```

CREATE src/hooks/useAnimationLoop.ts:
- Uses requestAnimationFrame
- Updates rotation angles for animating planes
- Respects speed and direction
- Stops when not playing

CREATE src/components/controls/AnimationControls.tsx:
- Play/Pause button
- Speed slider
- Plane checkboxes
- Animate All / Stop All buttons

CREATE tests.

QUALITY GATE:
✓ npm test passes
✓ Animation runs smoothly
```

---

## PHASE 4: ADVANCED FEATURES (4 micro-packages)

### Package 4A-1: Cross-Section Math

**Context needed:** Geometry types
**Estimated time:** 30 min

```markdown
=== TASK: Cross-Section Computation ===

CREATE src/lib/geometry/cross-section.ts:
```typescript
export function computeCrossSection(
  geometry: PolytopeGeometry,
  sliceW: number
): Vector3D[];  // intersection points

// Algorithm:
// For each edge, check if it crosses W=sliceW
// Calculate intersection point
// Return 3D points (drop W coordinate)
```

CREATE src/tests/lib/geometry/cross-section.test.ts:
- Tesseract at W=0 produces 8 points (cube vertices)
- Tesseract at W=0.5 produces smaller cube
- Tesseract at W=1.5 produces no points

QUALITY GATE:
✓ npm test passes
```

---

### Package 4A-2: Cross-Section UI

**Context needed:** Three.js patterns
**Estimated time:** 45 min

```markdown
=== TASK: Cross-Section Renderer + Controls ===

CREATE src/components/canvas/CrossSectionRenderer.tsx:
- Renders cross-section points as solid surface
- Uses Three.js ConvexGeometry or custom triangulation
- Color gradient based on slice position

CREATE src/stores/crossSectionStore.ts:
- enabled: boolean
- sliceW: number (-2 to +2)
- showOriginal: boolean
- originalOpacity: number

CREATE src/components/controls/CrossSectionControls.tsx:
- Enable toggle
- Slice position slider
- Show original toggle
- Animate slice button

QUALITY GATE:
✓ npm test passes
```

---

### Package 4B: Visual Customization

**Context needed:** Store patterns
**Estimated time:** 45 min

```markdown
=== TASK: Visual Store + Controls ===

CREATE src/stores/visualStore.ts:
```typescript
interface VisualState {
  edgeColor: string;  // default '#00FFFF'
  edgeThickness: number;  // 1-5
  vertexVisible: boolean;
  vertexSize: number;  // 1-10
  vertexColor: string;
  faceOpacity: number;  // 0-1
  backgroundColor: string;
}
```

CREATE src/components/controls/VisualControls.tsx:
- Color pickers for edge, vertex, background
- Sliders for thickness, size, opacity
- Toggle for vertex visibility
- Preset buttons (Neon, Blueprint, Hologram, Scientific)

UPDATE PolytopeRenderer to use visualStore values.

QUALITY GATE:
✓ npm test passes
✓ Visual changes apply immediately
```

---

### Package 4C: Properties Panel

**Context needed:** Geometry properties
**Estimated time:** 30 min

```markdown
=== TASK: Object Properties Display ===

CREATE src/components/controls/PropertiesPanel.tsx:
- Display: dimension, object type
- Show: vertex count, edge count (with formulas)
- Show: active rotations summary
- Expandable: vertex coordinates list

Use getPolytopeProperties from geometry library.

CREATE tests.

QUALITY GATE:
✓ npm test passes
✓ Properties update when object changes
```

---

## PHASE 5: POLISH (6 micro-packages)

### Package 5A: Export PNG

**Context needed:** Canvas export
**Estimated time:** 30 min

```markdown
=== TASK: PNG Export ===

CREATE src/lib/export/image.ts:
- exportAsPNG(canvas, options) -> downloads PNG

CREATE src/components/ExportButton.tsx:
- Button that exports current view
- Options: transparent bg, resolution scale

QUALITY GATE:
✓ Clicking export downloads valid PNG
```

---

### Package 5B: Share URL

**Context needed:** URL encoding
**Estimated time:** 30 min

```markdown
=== TASK: Configuration Share URL ===

CREATE src/lib/export/config.ts:
- exportConfiguration() -> JSON string of all store states
- importConfiguration(json) -> restores all stores
- configToURL() -> encodes config in URL params
- urlToConfig(url) -> decodes URL params

CREATE src/components/ShareButton.tsx:
- Generates shareable URL
- Copy to clipboard

UPDATE App.tsx:
- Check URL on load, import config if present

QUALITY GATE:
✓ Share URL recreates exact state
```

---

### Package 5C: Education Panel

**Context needed:** Modal patterns
**Estimated time:** 45 min

```markdown
=== TASK: Educational Content ===

CREATE src/components/EducationPanel.tsx:
- Modal with educational content
- Sections: Introduction, Rotation, Projection, Object Guide
- Simple markdown-style content
- Close button

CREATE src/content/education.ts:
- Text content for each section

ADD help button to Layout header.

QUALITY GATE:
✓ Panel opens/closes
✓ Content is readable
```

---

### Package 5D: Keyboard Shortcuts

**Context needed:** Event handling
**Estimated time:** 30 min

```markdown
=== TASK: Keyboard Controls ===

CREATE src/hooks/useKeyboardShortcuts.ts:
- Space: toggle animation
- R: reset all
- 3/4/5/6: set dimension
- F: fullscreen
- ?: show shortcuts help

CREATE src/components/ShortcutsPanel.tsx:
- Shows all available shortcuts

QUALITY GATE:
✓ All shortcuts work
✓ Don't fire when typing in inputs
```

---

### Package 5E: Responsive Layout

**Context needed:** CSS/Tailwind
**Estimated time:** 45 min

```markdown
=== TASK: Mobile/Tablet Layout ===

CREATE src/hooks/useResponsive.ts:
- Returns { isMobile, isTablet, isDesktop }

CREATE src/components/ui/BottomSheet.tsx:
- Mobile control panel
- Swipe gestures

UPDATE Layout.tsx:
- Switch layouts at breakpoints
- Desktop: side panel
- Tablet: collapsible
- Mobile: bottom sheet

QUALITY GATE:
✓ Works at 375px, 768px, 1024px+ widths
```

---

### Package 5F: Integration Tests

**Context needed:** Playwright
**Estimated time:** 45 min

```markdown
=== TASK: End-to-End Tests ===

CREATE scripts/playwright/e2e.spec.ts:
1. App loads with default tesseract
2. Dimension change updates object
3. Type change updates object
4. Rotation sliders work
5. Animation plays/pauses
6. Export produces image
7. Share URL works

QUALITY GATE:
✓ All e2e tests pass
✓ No console errors
```

---

## Execution Order

### Immediate Next Steps (complete Phase 2):
1. **Package 2F-1**: Geometry Store (~30 min)
2. **Package 2F-2**: Dimension Selector (~30 min)
3. **Package 2F-3**: Object Type Selector (~30 min)
4. **Package 2G**: App Integration (~45 min)

### After Phase 2 Complete:
5. Package 3A-1: Scale Store
6. Package 3A-2: Scale Controls
7. Package 3B: Shear
8. Package 3C: Translation
9. Package 3D: Animation

### After Phase 3 Complete:
10. Package 4A-1: Cross-Section Math
11. Package 4A-2: Cross-Section UI
12. Package 4B: Visual Customization
13. Package 4C: Properties Panel

### Final Polish:
14. Package 5A: Export PNG
15. Package 5B: Share URL
16. Package 5C: Education Panel
17. Package 5D: Keyboard Shortcuts
18. Package 5E: Responsive Layout
19. Package 5F: Integration Tests

---

## Summary

| Phase | Packages | Total Time |
|-------|----------|------------|
| 2 (Remaining) | 4 packages | ~2 hours |
| 3 | 5 packages | ~3 hours |
| 4 | 4 packages | ~2.5 hours |
| 5 | 6 packages | ~3.5 hours |
| **Total** | **19 packages** | **~11 hours** |

Each package is designed to be:
- Completable in 30-45 minutes
- Independently testable
- Minimal context requirements
- Clear, focused deliverables
