# N-Dimensional Visualizer: Implementation Plan & Subagent Distribution

## Overview

This document defines the work distribution for implementing the N-Dimensional Visualizer across multiple parallel subagents. Work is organized into 5 phases with dependencies clearly marked.

## Execution Strategy

```
PHASE 1 (Sequential)      PHASE 2 (Parallel)           PHASE 3 (Parallel)
┌──────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│ 1A: Project Setup│      │ 2A: Object Gen      │      │ 3A: Scale        │
│ 1B: Math Library │──────│ 2B: Three.js Scene  │──────│ 3B: Shear        │
└──────────────────┘      │ 2C: Rotation System │      │ 3C: Translation  │
                          │ 2D: Projection      │      │ 3D: Animation    │
                          │ 2E: UI Framework    │      └──────────────────┘
                          └─────────────────────┘              │
                                                               ▼
PHASE 4 (Parallel)                              PHASE 5 (Sequential)
┌─────────────────────┐                         ┌──────────────────────┐
│ 4A: Cross-Section   │                         │ 5A: Export/Share     │
│ 4B: Visual Styling  │─────────────────────────│ 5B: Education Panel  │
│ 4C: Properties Panel│                         │ 5C: Keyboard Shortcuts│
└─────────────────────┘                         │ 5D: Responsive Layout│
                                                │ 5E: Integration Tests│
                                                └──────────────────────┘
```

---

## Phase 1: Foundation (Sequential - MUST COMPLETE FIRST)

### Agent 1A: Project Setup & Configuration

**Dependencies:** None
**Estimated effort:** ~1 day
**Output:** Configured React + TypeScript + Three.js project skeleton

```markdown
=== TASK DEFINITION ===

You are implementing the project foundation for an N-Dimensional Object Visualizer.
Create a React + TypeScript project with Three.js integration.

OBJECTIVE: Set up a fully configured development environment with all dependencies,
build configuration, and folder structure ready for feature development.

=== CONSTRAINTS ===

TECHNOLOGY STACK (mandatory):
- React 18+ with TypeScript (strict mode)
- Three.js + @react-three/fiber + @react-three/drei
- Vite as build tool
- Vitest for testing
- ESLint + Prettier configured

PROJECT STRUCTURE:
```
src/
├── components/           # React components
│   ├── canvas/          # Three.js canvas components
│   ├── controls/        # UI control panel components
│   └── ui/              # Generic UI components
├── lib/                 # Core libraries
│   ├── math/            # N-dimensional math (Phase 1B)
│   ├── geometry/        # Object generation
│   └── projection/      # Projection algorithms
├── hooks/               # Custom React hooks
├── stores/              # State management (Zustand)
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── tests/               # Test files mirror src structure
```

CONFIGURATION REQUIREMENTS:
- TypeScript strict mode with no 'any' types
- Path aliases configured (@/components, @/lib, etc.)
- CSS modules or Tailwind CSS for styling
- Environment variables setup (.env.example)

=== DELIVERABLES ===

1. Initialized project with all dependencies in package.json
2. TypeScript configuration (tsconfig.json) with strict mode
3. Vite configuration with path aliases
4. ESLint + Prettier configuration
5. Folder structure as specified above
6. Basic App.tsx that renders Three.js canvas (black screen OK)
7. README.md with setup instructions
8. .gitignore configured for Node/React projects

=== QUALITY GATE ===

Before completing, verify:
✓ `npm install` completes without errors
✓ `npm run dev` starts development server
✓ `npm run build` produces production build without errors
✓ `npm run lint` passes with no errors
✓ `npm run test` runs (even if no tests exist yet)
✓ TypeScript compilation has zero errors
✓ Three.js canvas renders (even if empty/black)

=== OUTPUT FORMAT ===

Provide all file contents and terminal commands needed.
Use code blocks with file paths as headers.
End with a verification checklist showing all quality gates pass.
```

---

### Agent 1B: N-Dimensional Math Library

**Dependencies:** Agent 1A complete
**Estimated effort:** ~2 days
**Output:** Core math library for n-dimensional transformations

```markdown
=== TASK DEFINITION ===

Implement a mathematically accurate n-dimensional geometry library that handles:
- N-dimensional vector operations
- Transformation matrices (rotation, scale, shear, translation)
- Projection from nD to 3D

This is the mathematical foundation for the entire application.

=== MATHEMATICAL REQUIREMENTS ===

Based on research synthesis (docs/research/synthesis.md):

1. ROTATION DEGREES OF FREEDOM
   Formula: n(n-1)/2 planes for n-dimensional space
   - 3D: 3 planes (XY, XZ, YZ)
   - 4D: 6 planes (XY, XZ, YZ, XW, YW, ZW)
   - 5D: 10 planes
   - 6D: 15 planes

2. ROTATION MATRIX CONSTRUCTION
   For each rotation plane (i,j), construct matrix where:
   - R[i][i] = cos(θ)
   - R[j][j] = cos(θ)
   - R[i][j] = -sin(θ)
   - R[j][i] = sin(θ)
   - All other diagonal elements = 1

3. PERSPECTIVE PROJECTION (nD → 3D)
   Formula: (x,y,z) = (x/(d-w), y/(d-w), z/(d-w))
   Where d = projection distance, w = higher dimension coordinate

4. TRANSFORMATION ORDER
   Apply in sequence: Scale → Rotation → Shear → Translation

=== IMPLEMENTATION REQUIREMENTS ===

Create these TypeScript modules in src/lib/math/:

```typescript
// src/lib/math/types.ts
export type VectorND = number[];
export type MatrixND = number[][];

// src/lib/math/vector.ts
export function createVector(dimension: number): VectorND;
export function addVectors(a: VectorND, b: VectorND): VectorND;
export function scaleVector(v: VectorND, scalar: number): VectorND;
export function dotProduct(a: VectorND, b: VectorND): number;
export function magnitude(v: VectorND): number;
export function normalize(v: VectorND): VectorND;

// src/lib/math/matrix.ts
export function createIdentityMatrix(dimension: number): MatrixND;
export function multiplyMatrices(a: MatrixND, b: MatrixND): MatrixND;
export function multiplyMatrixVector(m: MatrixND, v: VectorND): VectorND;
export function transposeMatrix(m: MatrixND): MatrixND;

// src/lib/math/rotation.ts
export function getRotationPlanes(dimension: number): [number, number][];
export function createRotationMatrix(
  dimension: number,
  planeI: number,
  planeJ: number,
  angleRadians: number
): MatrixND;
export function composeRotations(
  dimension: number,
  angles: Map<string, number>  // e.g., "XY" -> 0.5 radians
): MatrixND;

// src/lib/math/transform.ts
export function createScaleMatrix(scales: number[]): MatrixND;
export function createShearMatrix(
  dimension: number,
  shearI: number,
  shearJ: number,
  amount: number
): MatrixND;
export function createTranslationMatrix(translation: VectorND): MatrixND;
export function composeTransformations(matrices: MatrixND[]): MatrixND;

// src/lib/math/projection.ts
export function projectPerspective(
  vertex: VectorND,
  projectionDistance: number,
  fromDimension: number,
  toDimension: number
): VectorND;
export function projectOrthographic(
  vertex: VectorND,
  fromDimension: number,
  toDimension: number
): VectorND;
```

=== CONSTRAINTS ===

- All functions must be pure (no side effects)
- No external math libraries (implement from scratch for learning)
- Full TypeScript type safety
- Handle edge cases (division by zero in projection, etc.)
- Include JSDoc comments with mathematical formulas

=== TEST REQUIREMENTS ===

Create comprehensive tests in src/tests/lib/math/:

1. Vector operations: add, scale, dot product, normalize
2. Matrix operations: multiply, transpose, identity
3. Rotation matrices: verify orthogonality (R * R^T = I)
4. Rotation DOF: verify correct number of planes per dimension
5. Projection: verify 4D tesseract projects to valid 3D coordinates
6. Transformation composition: verify order independence when appropriate

=== QUALITY GATE ===

Before completing, verify:
✓ All tests pass with 100% coverage on math modules
✓ 4D rotation produces 6 unique rotation planes
✓ 5D rotation produces 10 unique rotation planes
✓ Rotation matrices are orthogonal (determinant = 1)
✓ Perspective projection handles w ≈ d case without crash
✓ No TypeScript errors

=== OUTPUT FORMAT ===

Provide complete implementation of all modules with tests.
Include mathematical derivation comments for complex operations.
End with test output showing all tests pass.
```

---

## Phase 2: Core Features (Parallel after Phase 1)

### Agent 2A: Object Generation

**Dependencies:** Phase 1 complete
**Estimated effort:** ~1.5 days
**Output:** Generators for n-dimensional geometric objects

```markdown
=== TASK DEFINITION ===

Implement generators for n-dimensional geometric objects:
- Hypercube (generalization of cube)
- Simplex (generalization of tetrahedron)
- Cross-polytope (generalization of octahedron)
- Demihypercube (for dimensions >= 4)

=== MATHEMATICAL SPECIFICATIONS ===

HYPERCUBE (n-cube):
- Vertices: 2^n points at all combinations of (±1, ±1, ..., ±1)
- Edges: Connect vertices differing in exactly 1 coordinate
- Example: 4D tesseract has 16 vertices, 32 edges

SIMPLEX (n-simplex):
- Vertices: n+1 points
- Standard coordinates: One vertex at each axis plus origin
  OR: Nested radical construction from synthesis.md
- Edges: Connect all pairs of vertices (complete graph K_{n+1})
- Example: 4D pentachoron has 5 vertices, 10 edges

CROSS-POLYTOPE (n-orthoplex):
- Vertices: 2n points at (±1, 0, 0, ...) permutations
- Edges: Connect vertices not on same axis
- Example: 4D 16-cell has 8 vertices, 24 edges

DEMIHYPERCUBE:
- Vertices: Half of hypercube vertices (even number of negative coordinates)
- Only valid for n >= 4
- Example: 4D demitesseract has 8 vertices

=== IMPLEMENTATION REQUIREMENTS ===

Create in src/lib/geometry/:

```typescript
// src/lib/geometry/types.ts
export interface PolytopeGeometry {
  vertices: VectorND[];
  edges: [number, number][];  // Pairs of vertex indices
  faces?: number[][];         // For n >= 3
  cells?: number[][];         // For n >= 4
  dimension: number;
  type: 'hypercube' | 'simplex' | 'cross-polytope' | 'demihypercube';
}

// src/lib/geometry/hypercube.ts
export function generateHypercube(dimension: number): PolytopeGeometry;

// src/lib/geometry/simplex.ts
export function generateSimplex(dimension: number): PolytopeGeometry;

// src/lib/geometry/cross-polytope.ts
export function generateCrossPolytope(dimension: number): PolytopeGeometry;

// src/lib/geometry/demihypercube.ts
export function generateDemihypercube(dimension: number): PolytopeGeometry;

// src/lib/geometry/index.ts
export function generatePolytope(
  type: PolytopeGeometry['type'],
  dimension: number
): PolytopeGeometry;

export function getPolytopeProperties(p: PolytopeGeometry): {
  vertexCount: number;
  edgeCount: number;
  faceCount?: number;
  cellCount?: number;
  formula: string;  // e.g., "2^n = 16 vertices"
};
```

=== CONSTRAINTS ===

- Vertices must be normalized (centered at origin, max extent ±1)
- Edge generation must be automatic from vertex positions
- Support dimensions 3 through 6 minimum
- Efficient generation (no duplicate edges)
- Return frozen/immutable objects

=== TEST REQUIREMENTS ===

1. Hypercube vertex count: 2^n for each dimension 3-6
2. Simplex vertex count: n+1 for each dimension 3-6
3. Cross-polytope vertex count: 2n for each dimension 3-6
4. Edge connectivity: no duplicate edges, no self-loops
5. Vertex normalization: all vertices within [-1, 1]^n

=== QUALITY GATE ===

✓ 4D hypercube generates exactly 16 vertices, 32 edges
✓ 4D simplex generates exactly 5 vertices, 10 edges
✓ 4D cross-polytope generates exactly 8 vertices, 24 edges
✓ Demihypercube throws error for dimension < 4
✓ All tests pass
✓ No TypeScript errors

=== OUTPUT FORMAT ===

Provide complete implementations with tests.
Include edge generation algorithms with comments.
```

---

### Agent 2B: Three.js Scene Setup

**Dependencies:** Phase 1 complete
**Estimated effort:** ~1.5 days
**Output:** Three.js scene with camera controls and rendering

```markdown
=== TASK DEFINITION ===

Create the Three.js scene infrastructure using @react-three/fiber and drei.
This is the visual foundation that renders n-dimensional objects as 3D projections.

=== IMPLEMENTATION REQUIREMENTS ===

Create in src/components/canvas/:

```typescript
// src/components/canvas/Scene.tsx
// Main scene component with:
// - Ambient light + directional light
// - OrbitControls for camera manipulation
// - Background gradient (dark theme)
// - Grid helper (optional, toggleable)
// - Axes helper (optional, toggleable)
// - Post-processing effects (bloom for glow)

// src/components/canvas/PolytopeRenderer.tsx
// Renders a PolytopeGeometry as Three.js objects:
// - Vertices as small spheres (configurable size/color)
// - Edges as lines/tubes (configurable thickness/color)
// - Faces as semi-transparent meshes (optional)
// - Updates efficiently when geometry changes

// src/components/canvas/CameraController.tsx
// Camera management:
// - Smooth orbit controls
// - Zoom limits (min/max distance)
// - Auto-rotation mode
// - Reset camera button

// src/hooks/usePolytopeGeometry.ts
// Hook that:
// - Takes PolytopeGeometry from state
// - Applies current transformations
// - Projects to 3D
// - Returns Three.js-compatible buffers
```

=== VISUAL REQUIREMENTS ===

LIGHTING:
- Ambient light: intensity 0.4, white
- Directional light: intensity 0.8, from (5, 5, 5), casts shadows
- Optional point light at camera position for "headlight" effect

MATERIALS:
- Edges: MeshBasicMaterial or LineBasicMaterial, emissive for glow
- Vertices: MeshStandardMaterial, slight metalness
- Faces: MeshBasicMaterial, transparent, opacity 0.2

CAMERA:
- PerspectiveCamera, FOV 60, near 0.1, far 1000
- Initial position: (0, 0, 5)
- OrbitControls: damping enabled, smooth rotation

EFFECTS:
- Bloom post-processing for "neon glow" aesthetic
- Optional: depth of field for focus effect

=== CONSTRAINTS ===

- Must achieve 60 FPS on modern hardware
- Use BufferGeometry for performance
- Minimize re-renders with proper React optimization
- Support dynamic updates to vertices/edges without full remount
- Mobile-friendly (touch controls work)

=== TEST REQUIREMENTS ===

Visual tests (Playwright):
1. Scene renders without errors
2. Camera orbit works with mouse drag
3. Zoom works with scroll
4. Object is visible and centered
5. Auto-rotation functions

Unit tests:
1. usePolytopeGeometry returns correct buffer format
2. Transformation application is correct
3. Projection to 3D produces valid coordinates

=== QUALITY GATE ===

✓ Canvas renders at 60 FPS
✓ OrbitControls work on desktop and mobile
✓ 4D tesseract renders with visible inner/outer cube structure
✓ Edge glow effect is visible
✓ No console errors or warnings
✓ All tests pass

=== OUTPUT FORMAT ===

Provide complete component implementations.
Include performance optimization notes.
Show screenshot of rendered tesseract (or describe expected appearance).
```

---

### Agent 2C: Rotation System

**Dependencies:** Phase 1, Agent 2B complete
**Estimated effort:** ~1.5 days
**Output:** Interactive rotation controls for all n(n-1)/2 planes

```markdown
=== TASK DEFINITION ===

Implement the rotation control system that allows users to rotate
n-dimensional objects in each available rotation plane.

=== ROTATION PLANE SPECIFICATION ===

The number of rotation planes follows n(n-1)/2:
- 3D: XY, XZ, YZ (3 planes)
- 4D: XY, XZ, YZ, XW, YW, ZW (6 planes)
- 5D: 10 planes (add XV, YV, ZV, WV where V is 5th axis)
- 6D: 15 planes

PLANE NAMING CONVENTION:
Use axis indices for generality:
- Axes: X=0, Y=1, Z=2, W=3, V=4, U=5
- Plane names: "01" for XY, "03" for XW, etc.
- Display names: "XY", "XW", etc. (map indices to letters)

=== IMPLEMENTATION REQUIREMENTS ===

Create in src/components/controls/:

```typescript
// src/components/controls/RotationControls.tsx
// Panel containing:
// - One slider per rotation plane
// - Grouped: "3D Rotations" (familiar) vs "Higher-D Rotations" (W-axis+)
// - Value display (degrees) next to each slider
// - Double-click to reset individual slider to 0
// - "Reset All Rotations" button

// src/stores/rotationStore.ts (Zustand)
// State management:
// - rotations: Map<string, number> (plane name -> angle in radians)
// - setRotation(plane: string, angle: number): void
// - resetRotation(plane: string): void
// - resetAllRotations(): void
// - getComposedRotationMatrix(): MatrixND

// src/hooks/useRotationPlanes.ts
// Returns available rotation planes for current dimension
// with display names, tooltips, and grouping

// src/components/controls/RotationSlider.tsx
// Individual slider component:
// - Range: 0-360 degrees
// - Converts to radians internally
// - Shows current value
// - Tooltip explaining the plane
// - Double-click to reset
```

=== UI REQUIREMENTS ===

SLIDER DESIGN:
- Horizontal sliders, full width of control panel
- Range labels: 0° to 360°
- Current value badge showing exact degrees
- Color coding: familiar planes (blue), W-axis planes (purple), higher (orange)

GROUPING (for 4D+):
- Section: "Familiar Rotations (3D)" - XY, XZ, YZ
- Section: "4th Dimension Rotations" - XW, YW, ZW
- Section: "5th Dimension Rotations" - XV, YV, ZV, WV (if 5D+)
- Continue pattern for 6D

TOOLTIPS:
- XY: "Rotates in the X-Y plane (like spinning a top viewed from above)"
- XW: "Rotates between X and the 4th dimension W"
- Explain effect on projection

=== CONSTRAINTS ===

- Slider updates must be smooth (no jank)
- Rotation matrix computation must not block UI
- State updates trigger geometry re-render
- Support rapid slider dragging without lag

=== TEST REQUIREMENTS ===

1. Correct number of sliders for each dimension (3,4,5,6)
2. Slider values persist across dimension changes (when applicable)
3. Reset button resets all to 0
4. Double-click resets individual slider
5. Composed rotation matrix is mathematically correct

=== QUALITY GATE ===

✓ 4D mode shows exactly 6 sliders
✓ 5D mode shows exactly 10 sliders
✓ Sliders grouped correctly
✓ Visual update is smooth when dragging
✓ Reset functions work
✓ All tests pass

=== OUTPUT FORMAT ===

Provide complete implementations.
Include store with proper TypeScript types.
Show how rotation matrix is computed and passed to renderer.
```

---

### Agent 2D: Projection System

**Dependencies:** Phase 1, Agent 2B complete
**Estimated effort:** ~1.5 days
**Output:** Configurable projection from nD to 3D

```markdown
=== TASK DEFINITION ===

Implement the projection system that transforms n-dimensional geometry
into 3D for rendering. Support multiple projection methods.

=== PROJECTION METHODS ===

1. PERSPECTIVE PROJECTION (default)
   Formula: (x,y,z) = (x/(d-w), y/(d-w), z/(d-w))
   - d = projection distance (configurable, default 4.0)
   - Creates vanishing point effect (objects "further" in W appear smaller)
   - Handles d ≈ w case by clamping divisor to minimum 0.001

2. ORTHOGRAPHIC PROJECTION
   Formula: Simply drop higher dimensions
   - (x,y,z,w) → (x,y,z)
   - No foreshortening, parallel lines stay parallel
   - Inner and outer structures appear same size

=== IMPLEMENTATION REQUIREMENTS ===

Create in src/lib/projection/:

```typescript
// src/lib/projection/types.ts
export type ProjectionType = 'perspective' | 'orthographic';

export interface ProjectionConfig {
  type: ProjectionType;
  distance: number;      // For perspective (2.0 to 10.0)
  fromDimension: number; // Source dimension (4, 5, 6)
  toDimension: number;   // Target dimension (always 3)
}

// src/lib/projection/perspective.ts
export function perspectiveProject(
  vertices: VectorND[],
  config: ProjectionConfig
): Vector3D[];

// src/lib/projection/orthographic.ts
export function orthographicProject(
  vertices: VectorND[],
  config: ProjectionConfig
): Vector3D[];

// src/lib/projection/index.ts
export function projectVertices(
  vertices: VectorND[],
  config: ProjectionConfig
): Vector3D[];
```

Create in src/components/controls/:

```typescript
// src/components/controls/ProjectionControls.tsx
// UI panel:
// - Projection type toggle (Perspective / Orthographic)
// - Distance slider (only shown for Perspective)
// - 3D FOV slider (for final render, 30-120 degrees)
// - Visual preview showing projection effect

// src/stores/projectionStore.ts
// State:
// - projectionType: ProjectionType
// - projectionDistance: number
// - fov: number
// - setProjectionType, setDistance, setFov
```

=== VISUAL FEEDBACK ===

When user changes projection settings:
- Smooth transition between projection types (interpolate over 300ms)
- Distance changes update in real-time
- Show mini-diagram explaining current projection

=== CONSTRAINTS ===

- Handle edge cases: vertices at exactly d distance
- Projection must work for any dimension 3-6
- Perspective projection must not produce NaN/Infinity
- Smooth transitions when settings change

=== TEST REQUIREMENTS ===

1. Perspective projection produces smaller values for higher W
2. Orthographic projection ignores W completely
3. Projection distance affects scale correctly
4. Edge cases (w = d) handled gracefully
5. Multi-stage projection (6D → 5D → 4D → 3D) produces valid results

=== QUALITY GATE ===

✓ 4D tesseract inner cube smaller than outer in perspective mode
✓ 4D tesseract inner cube same size as outer in orthographic mode
✓ Distance slider visibly affects projection
✓ No NaN values in projected coordinates
✓ All tests pass

=== OUTPUT FORMAT ===

Provide complete projection implementations.
Include visual diagram of projection methods in comments.
Show test cases with expected outputs.
```

---

### Agent 2E: UI Framework & Control Panel

**Dependencies:** Phase 1 complete
**Estimated effort:** ~1.5 days
**Output:** Control panel structure and UI components

```markdown
=== TASK DEFINITION ===

Create the UI framework and control panel structure that houses all
visualization controls. This establishes the visual design system.

=== DESIGN SYSTEM ===

THEME: Dark mode with accent colors
- Background: #0F0F1A (near black with blue tint)
- Panel background: #1A1A2E (dark blue-gray)
- Text: #FFFFFF (white) and #A0A0B0 (gray)
- Accent: #00D4FF (cyan) for primary actions
- Secondary: #FF00FF (magenta) for highlighting

LAYOUT:
- Canvas: 70% width on desktop, full on mobile
- Control panel: 30% width on desktop, bottom sheet on mobile
- Collapsible sections for organization
- Scrollable panel when content exceeds viewport

=== IMPLEMENTATION REQUIREMENTS ===

Create in src/components/ui/:

```typescript
// src/components/ui/ControlPanel.tsx
// Main control panel container:
// - Fixed position on right side (desktop)
// - Bottom sheet with handle (mobile)
// - Scroll when content overflows
// - Collapse/expand toggle

// src/components/ui/Section.tsx
// Collapsible section component:
// - Header with title and collapse chevron
// - Content area that animates open/closed
// - Optional icon
// - Default open/closed state

// src/components/ui/Slider.tsx
// Custom slider component:
// - Value label
// - Min/max labels
// - Step configuration
// - Double-click to reset
// - Smooth dragging
// - Color customizable

// src/components/ui/ToggleGroup.tsx
// Radio button group styled as toggle:
// - For options like projection type
// - Highlight selected option
// - Accessible

// src/components/ui/ColorPicker.tsx
// Compact color picker:
// - Shows current color swatch
// - Opens picker on click
// - Preset colors available
// - Hex input option

// src/components/ui/Button.tsx
// Styled button:
// - Primary (cyan) and secondary (gray) variants
// - Icon support
// - Disabled state
// - Loading state

// src/components/ui/Tooltip.tsx
// Tooltip component:
// - Appears on hover
// - Supports rich content
// - Positions intelligently
```

Create main layout:

```typescript
// src/components/Layout.tsx
// App layout structure:
// - Header with title and help button
// - Canvas area (Three.js)
// - Control panel (all controls)
// - Responsive breakpoints
```

=== SECTION ORGANIZATION ===

Control panel sections (in order):
1. **Object** - Dimension selector, object type
2. **Rotation** - All rotation sliders (from Agent 2C)
3. **Projection** - Projection settings (from Agent 2D)
4. **Transform** - Scale, shear, translation (Phase 3)
5. **Animation** - Playback controls (Phase 3)
6. **Visual** - Colors, materials, styles (Phase 4)
7. **Properties** - Object info (Phase 4)

=== CONSTRAINTS ===

- All components must be accessible (ARIA labels)
- Keyboard navigation supported
- Consistent spacing and sizing
- Performance: no unnecessary re-renders
- Mobile-first responsive design

=== TEST REQUIREMENTS ===

1. All components render without errors
2. Slider values update correctly
3. Collapsible sections animate smoothly
4. Color picker returns valid hex values
5. Responsive layout switches correctly at breakpoints

=== QUALITY GATE ===

✓ Control panel renders with all sections
✓ Sliders are draggable and update state
✓ Dark theme applied consistently
✓ Mobile layout works at 375px width
✓ No accessibility warnings
✓ All tests pass

=== OUTPUT FORMAT ===

Provide complete component library.
Include Storybook-style examples showing each component.
Document props and usage for each component.
```

---

## Phase 3: Transformations (Parallel after Phase 2)

### Agent 3A: Scale Transformation Controls

**Dependencies:** Phase 2 complete
**Estimated effort:** ~1 day
**Output:** Uniform and per-axis scale controls

```markdown
=== TASK DEFINITION ===

Implement scale transformation controls allowing uniform scaling
and per-axis scaling of n-dimensional objects.

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/stores/transformStore.ts (extend or create)
interface ScaleState {
  uniform: number;           // 0.1 to 3.0, default 1.0
  perAxis: number[];         // Per dimension, default [1,1,1,1...]
  locked: boolean;           // When true, perAxis follows uniform
  setUniformScale(value: number): void;
  setAxisScale(axis: number, value: number): void;
  setLocked(locked: boolean): void;
  resetScales(): void;
  getScaleMatrix(): MatrixND;
}

// src/components/controls/ScaleControls.tsx
// UI:
// - "Uniform Scale" slider (0.1 to 3.0)
// - "Lock Uniform" toggle
// - Per-axis sliders (X, Y, Z, W, V, U based on dimension)
// - "Reset Scales" button
// - Warning at extreme values

// Scale matrix integration in usePolytopeGeometry hook
```

=== CONSTRAINTS ===

- Scale applied before rotation in transformation order
- Per-axis sliders disabled when lock is on
- Warn user at scale < 0.2 or > 2.5
- Double-click any slider to reset to 1.0

=== TEST REQUIREMENTS ===

1. Uniform scale affects all axes equally
2. Lock toggle links/unlinks per-axis sliders
3. Scale matrix is diagonal with correct values
4. Reset restores all scales to 1.0

=== QUALITY GATE ===

✓ Uniform scale visually changes object size
✓ Per-axis scale stretches in correct direction
✓ Lock toggle works correctly
✓ All tests pass
```

---

### Agent 3B: Shear Transformation Controls

**Dependencies:** Phase 2 complete
**Estimated effort:** ~1 day
**Output:** Shear transformation controls for all dimension pairs

```markdown
=== TASK DEFINITION ===

Implement shear transformation controls allowing skewing
of n-dimensional objects along dimension pairs.

=== SHEAR SPECIFICATION ===

Shear transforms one coordinate based on another:
- Shear XY: x' = x + s*y, y' = y (s = shear amount)
- Shear XW: x' = x + s*w, w' = w

Number of shear directions = n(n-1)/2 (same as rotation planes)

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/stores/transformStore.ts (extend)
interface ShearState {
  shears: Map<string, number>;  // plane -> amount (-2 to +2)
  setShear(plane: string, amount: number): void;
  resetShears(): void;
  getShearMatrix(): MatrixND;
}

// src/components/controls/ShearControls.tsx
// UI:
// - Section header explaining shear
// - One slider per shear direction (0 to ±2)
// - Grouped like rotation: familiar vs higher-D
// - "Reset Shears" button
// - Formula display for selected shear
```

=== CONSTRAINTS ===

- Shear applied after rotation in transformation order
- Shear range -2.0 to +2.0, default 0
- Show formula tooltip: "x' = x + s*y"
- Double-click to reset individual shear

=== TEST REQUIREMENTS ===

1. Correct number of shear sliders per dimension
2. Shear matrix has 1s on diagonal, shear values off-diagonal
3. Shear visually skews the object correctly
4. Reset clears all shears

=== QUALITY GATE ===

✓ XY shear makes object lean in X direction
✓ XW shear separates inner/outer cube horizontally
✓ All shear sliders functional
✓ All tests pass
```

---

### Agent 3C: Translation Controls

**Dependencies:** Phase 2 complete
**Estimated effort:** ~0.5 days
**Output:** Per-axis translation controls

```markdown
=== TASK DEFINITION ===

Implement translation controls allowing movement
of n-dimensional objects along each axis.

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/stores/transformStore.ts (extend)
interface TranslationState {
  translation: number[];  // Per dimension, default [0,0,0,0...]
  setTranslation(axis: number, value: number): void;
  resetTranslation(): void;
  center(): void;
  getTranslationMatrix(): MatrixND;
}

// src/components/controls/TranslationControls.tsx
// UI:
// - Per-axis sliders (X, Y, Z, W, V, U)
// - Range: -5.0 to +5.0
// - "Center Object" button
// - Note: W translation affects perspective
```

=== CONSTRAINTS ===

- Translation applied last in transformation order
- W translation tooltip: "Moving in W affects apparent size in perspective mode"
- Double-click to reset individual axis

=== TEST REQUIREMENTS ===

1. X translation moves object right/left in viewport
2. W translation affects perspective scale
3. Center button resets all to 0
4. Translation matrix has values in last column

=== QUALITY GATE ===

✓ Object moves visibly when translating
✓ W translation changes apparent size (perspective)
✓ Center works
✓ All tests pass
```

---

### Agent 3D: Animation System

**Dependencies:** Phase 2, Agents 3A-3C complete
**Estimated effort:** ~1.5 days
**Output:** Animation playback controls and auto-rotation

```markdown
=== TASK DEFINITION ===

Implement animation system for automatic rotation with
playback controls, speed adjustment, and special modes.

=== ANIMATION FEATURES ===

1. AUTO-ROTATION
   - Rotate in selected planes automatically
   - Configurable speed (0.1x to 5x)
   - Direction toggle (CW/CCW)
   - Multiple planes can animate simultaneously

2. ISOCLINIC ROTATION (4D only)
   - Special mode: XY and ZW rotate at same rate
   - Creates unique 4D double-rotation effect

3. PLAYBACK CONTROLS
   - Play/Pause toggle
   - Per-plane animation selection
   - Speed slider
   - Direction toggle
   - "Animate All" button

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/stores/animationStore.ts
interface AnimationState {
  isPlaying: boolean;
  speed: number;                    // 0.1 to 5.0
  direction: 1 | -1;                // CW or CCW
  animatingPlanes: Set<string>;     // Which planes are animating
  isoclinicMode: boolean;           // For 4D

  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  toggleDirection(): void;
  togglePlane(plane: string): void;
  animateAll(): void;
  stopAll(): void;
  setIsoclinicMode(enabled: boolean): void;
}

// src/hooks/useAnimationLoop.ts
// Custom hook that:
// - Uses requestAnimationFrame
// - Updates rotation angles based on animating planes
// - Respects speed and direction settings
// - Stops when not playing

// src/components/controls/AnimationControls.tsx
// UI:
// - Play/Pause button (large, prominent)
// - Speed slider
// - Direction toggle
// - Checkboxes for each rotation plane
// - "Animate All" / "Stop All" buttons
// - Isoclinic mode toggle (4D only)
```

=== CONSTRAINTS ===

- Animation uses requestAnimationFrame (60 FPS target)
- Speed is multiplier: 1x = one full rotation per 10 seconds
- Manual slider adjustment pauses that plane's animation
- Isoclinic mode only available for 4D

=== TEST REQUIREMENTS ===

1. Play/pause toggles animation
2. Speed affects rotation rate
3. Multiple planes can animate simultaneously
4. Manual slider stops that plane's animation
5. Isoclinic mode links XY and ZW (4D)

=== QUALITY GATE ===

✓ Animation runs at 60 FPS
✓ Speed slider affects rotation rate
✓ Pause stops all animation
✓ Isoclinic mode works in 4D
✓ All tests pass
```

---

## Phase 4: Advanced Features (Parallel after Phase 3)

### Agent 4A: Cross-Section Slicing

**Dependencies:** Phase 3 complete
**Estimated effort:** ~2 days
**Output:** Hyperplane slicing visualization

```markdown
=== TASK DEFINITION ===

Implement cross-section rendering that shows the intersection
of n-dimensional objects with 3D hyperplanes.

=== CROSS-SECTION ALGORITHM ===

For each edge (v0, v1) in the n-dimensional object:
1. Check if edge crosses the slicing hyperplane (w = slice_w)
2. If v0.w and v1.w are on opposite sides:
   - Calculate intersection parameter: t = (slice_w - v0.w) / (v1.w - v0.w)
   - Intersection point: v0 + t * (v1 - v0)
3. Collect all intersection points
4. Triangulate the resulting polygon/surface

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/lib/geometry/cross-section.ts
export interface CrossSectionConfig {
  sliceW: number;           // W-coordinate of slicing plane
  showOriginal: boolean;    // Show wireframe of full object
  originalOpacity: number;  // Opacity of original (0-1)
}

export function computeCrossSection(
  geometry: PolytopeGeometry,
  sliceW: number
): Vector3D[];  // 3D points of intersection

export function triangulateCrossSection(
  points: Vector3D[]
): number[][];  // Triangle indices

// src/components/canvas/CrossSectionRenderer.tsx
// Three.js component that:
// - Renders the cross-section as solid mesh
// - Colors by depth (gradient)
// - Updates in real-time as sliceW changes
// - Optionally shows original wireframe

// src/components/controls/CrossSectionControls.tsx
// UI:
// - Enable/disable toggle
// - Slice position slider (-2 to +2)
// - "Animate slice" button
// - Show original toggle
// - Original opacity slider
```

=== CONSTRAINTS ===

- Cross-section must update in real-time
- Handle edge cases (slice outside object bounds)
- Triangulation must handle non-convex polygons
- Color gradient from blue (low W) to red (high W)

=== TEST REQUIREMENTS ===

1. Tesseract at W=0 produces cube cross-section
2. Tesseract at W=0.5 produces smaller cube
3. Tesseract at W=1.5 produces no cross-section
4. Animation smoothly moves slice
5. Original wireframe overlay works

=== QUALITY GATE ===

✓ Cross-section renders as solid shape
✓ Slice slider changes cross-section in real-time
✓ Animation works
✓ Colors indicate depth
✓ All tests pass
```

---

### Agent 4B: Visual Customization System

**Dependencies:** Phase 2 complete
**Estimated effort:** ~1.5 days
**Output:** Comprehensive visual styling controls

```markdown
=== TASK DEFINITION ===

Implement visual customization allowing users to style
the visualization with colors, materials, and effects.

=== VISUAL OPTIONS ===

EDGE STYLING:
- Color (default: cyan #00FFFF)
- Thickness (1-5, default: 2)
- Glow intensity (0-1, default: 0.5)

VERTEX STYLING:
- Visibility toggle (default: ON)
- Size (1-10, default: 4)
- Color (default: white #FFFFFF)

FACE STYLING:
- Visibility toggle (default: ON)
- Opacity (0-100%, default: 20%)
- Color mode: uniform / depth-coded

BACKGROUND:
- Color (default: #1A1A2E)
- Gradient toggle

PRESETS:
- Neon: dark bg, cyan edges, pink vertices, high glow
- Blueprint: navy bg, white edges, no faces
- Hologram: dark bg, green everything, high glow
- Scientific: white bg, black edges, minimal style

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/stores/visualStore.ts
interface VisualState {
  edges: {
    color: string;
    thickness: number;
    glowIntensity: number;
  };
  vertices: {
    visible: boolean;
    size: number;
    color: string;
  };
  faces: {
    visible: boolean;
    opacity: number;
    depthCoded: boolean;
    color: string;
  };
  background: {
    color: string;
    gradient: boolean;
  };

  setEdgeColor(color: string): void;
  // ... all setters
  applyPreset(name: string): void;
}

// src/components/controls/VisualControls.tsx
// UI organized in subsections:
// - Edges: color picker, thickness slider, glow slider
// - Vertices: toggle, size slider, color picker
// - Faces: toggle, opacity slider, depth-coded toggle, color picker
// - Background: color picker, gradient toggle
// - Presets: buttons for each preset
// - Reset button
```

=== CONSTRAINTS ===

- All changes apply in real-time
- Colors must be valid hex codes
- Presets apply all settings atomically
- Depth-coded coloring: blue for low W, red for high W

=== TEST REQUIREMENTS ===

1. Edge color changes immediately
2. Vertex visibility toggle works
3. Face opacity slider works
4. Presets apply all settings
5. Reset restores defaults

=== QUALITY GATE ===

✓ All visual controls functional
✓ Presets work correctly
✓ Depth-coded coloring visible
✓ No visual glitches
✓ All tests pass
```

---

### Agent 4C: Object Properties Panel

**Dependencies:** Agent 2A complete
**Estimated effort:** ~1 day
**Output:** Properties display and educational content

```markdown
=== TASK DEFINITION ===

Implement the properties panel showing mathematical information
about the current object and its transformations.

=== PROPERTIES TO DISPLAY ===

BASIC PROPERTIES:
- Dimension (n)
- Object type name
- Vertex count with formula (e.g., "16 (2^n)")
- Edge count with formula
- Face count (3D+)
- Cell count (4D+)
- Hypercell count (5D+)

ROTATION INFO:
- Number of rotation planes: n(n-1)/2
- Active rotations: list non-zero angles
- Current rotation angles summary

VERTEX COORDINATES:
- Expandable section showing all vertex coordinates
- Before and after transformation

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/components/controls/PropertiesPanel.tsx
// Collapsible panel showing:
// - Object header (type, dimension)
// - Properties table (vertices, edges, etc.)
// - Formulas in monospace font
// - Rotation state summary
// - Expandable vertex list

// src/hooks/useObjectProperties.ts
// Computes all properties from current geometry and state
```

=== CONSTRAINTS ===

- Update in real-time when object changes
- Formulas displayed clearly
- Vertex coordinates scrollable (16+ vertices)
- Copy-to-clipboard for vertex data

=== TEST REQUIREMENTS ===

1. 4D tesseract shows: 16 vertices, 32 edges, 24 faces, 8 cells
2. Properties update when dimension changes
3. Rotation summary shows active rotations
4. Vertex list expands/collapses

=== QUALITY GATE ===

✓ All properties display correctly for 3D-6D
✓ Formulas render properly
✓ Vertex list is scrollable
✓ All tests pass
```

---

## Phase 5: Polish & Integration (Sequential after Phase 4)

### Agent 5A: Export & Sharing

**Dependencies:** All Phase 4 complete
**Estimated effort:** ~1.5 days
**Output:** Export images, configurations, and share URLs

```markdown
=== TASK DEFINITION ===

Implement export functionality for images, configuration files,
and shareable URLs.

=== EXPORT OPTIONS ===

1. PNG IMAGE
   - Current viewport render
   - Transparent background option
   - Resolution: 1x, 2x, 4x
   - Watermark: "N-Dimensional Visualizer"

2. CONFIGURATION JSON
   - All current settings
   - Importable to restore state
   - Pretty-printed

3. SHARE URL
   - Base64-encoded configuration in URL params
   - Opens app with exact same state
   - Copy to clipboard

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/lib/export/image.ts
export async function exportAsPNG(
  canvas: HTMLCanvasElement,
  options: {
    transparent: boolean;
    scale: number;
    watermark: boolean;
  }
): Promise<Blob>;

// src/lib/export/config.ts
export function exportConfiguration(): string;  // JSON
export function importConfiguration(json: string): void;
export function configToURL(): string;
export function urlToConfig(url: string): object | null;

// src/components/ExportDialog.tsx
// Modal with:
// - Image export options
// - Download buttons
// - Share URL with copy button
// - Import configuration
```

=== CONSTRAINTS ===

- Image export works even with WebGL
- URL must not exceed 2000 characters (compress if needed)
- Import validates configuration format
- Handle invalid share URLs gracefully

=== TEST REQUIREMENTS ===

1. PNG export produces valid image
2. Configuration JSON is valid and complete
3. Share URL correctly encodes state
4. Import restores exact state
5. Invalid imports show error

=== QUALITY GATE ===

✓ Image downloads correctly
✓ Share URL works in new tab
✓ Import/export round-trips correctly
✓ All tests pass
```

---

### Agent 5B: Educational Content Panel

**Dependencies:** Agent 4C complete
**Estimated effort:** ~1 day
**Output:** Help and educational information

```markdown
=== TASK DEFINITION ===

Create educational content panel explaining n-dimensional
geometry concepts to help users understand what they're seeing.

=== CONTENT SECTIONS ===

1. INTRODUCTION
   - What are higher dimensions?
   - Why can't we "see" 4D?
   - How projection helps us understand

2. ROTATION IN HIGHER DIMENSIONS
   - Why planes, not axes
   - n(n-1)/2 formula explanation
   - Visual examples

3. PROJECTION EXPLAINED
   - Perspective vs orthographic
   - Why inner cube looks smaller
   - Analogy: 3D cube shadow on 2D paper

4. OBJECT GUIDE
   - Hypercube family
   - Simplex family
   - Cross-polytope family
   - Key properties of each

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/components/EducationPanel.tsx
// Modal or side panel with:
// - Table of contents
// - Scrollable content
// - Search functionality
// - Links from object properties
// - Mini interactive examples (optional)
```

=== CONSTRAINTS ===

- Content must be accessible to non-mathematicians
- Use analogies and simple language
- Include diagrams (SVG or CSS)
- Link from properties panel to relevant sections

=== TEST REQUIREMENTS ===

1. All sections render
2. Search filters content
3. Links navigate correctly
4. Modal opens/closes smoothly

=== QUALITY GATE ===

✓ Content is readable and informative
✓ Navigation works
✓ Accessible (screen reader compatible)
✓ All tests pass
```

---

### Agent 5C: Keyboard Shortcuts

**Dependencies:** All core features complete
**Estimated effort:** ~0.5 days
**Output:** Keyboard navigation and shortcuts

```markdown
=== TASK DEFINITION ===

Implement keyboard shortcuts for efficient navigation
and control of the visualization.

=== SHORTCUTS ===

PLAYBACK:
- Space: Play/Pause animation
- R: Reset all transformations
- Esc: Close modal/exit fullscreen

DIMENSION:
- 3/4/5/6: Set dimension directly

VIEW:
- F: Toggle fullscreen
- +/-: Zoom in/out
- Arrow keys: Nudge rotation (primary plane)

HELP:
- ?: Show shortcuts panel
- H: Toggle help/education panel

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/hooks/useKeyboardShortcuts.ts
// Hook that:
// - Listens for keyboard events
// - Maps keys to actions
// - Respects focus (not when typing in input)
// - Shows notification when shortcut used

// src/components/ShortcutsPanel.tsx
// Panel showing all available shortcuts
```

=== CONSTRAINTS ===

- Don't conflict with browser shortcuts
- Work when canvas is focused
- Ignore when input field is focused
- Show visual feedback for shortcut activation

=== TEST REQUIREMENTS ===

1. Space toggles play/pause
2. Number keys change dimension
3. Shortcuts ignored in input fields
4. Help panel shows all shortcuts

=== QUALITY GATE ===

✓ All shortcuts functional
✓ No browser conflicts
✓ Visual feedback works
✓ All tests pass
```

---

### Agent 5D: Responsive Layout

**Dependencies:** All UI components complete
**Estimated effort:** ~1 day
**Output:** Mobile and tablet responsive design

```markdown
=== TASK DEFINITION ===

Ensure the application works well on all screen sizes
with appropriate layouts for desktop, tablet, and mobile.

=== BREAKPOINTS ===

- Desktop: > 1024px - Side panel layout
- Tablet: 768-1024px - Collapsible panel
- Mobile: < 768px - Bottom sheet controls

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// src/hooks/useResponsive.ts
export function useResponsive(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

// src/components/Layout.tsx
// Responsive layout that:
// - Switches between layouts at breakpoints
// - Maintains control panel state
// - Supports touch gestures on mobile

// src/components/ui/BottomSheet.tsx
// Mobile control panel:
// - Swipe up to expand
// - Swipe down to collapse
// - Handle for grabbing
```

=== MOBILE TOUCH GESTURES ===

- Single finger drag: orbit camera
- Pinch: zoom
- Two finger drag: pan
- Tap control: open bottom sheet

=== CONSTRAINTS ===

- Minimum width: 320px
- Touch targets minimum 44x44px
- No horizontal scroll on any screen size
- Controls remain accessible on all sizes

=== TEST REQUIREMENTS ===

1. Desktop layout correct at 1920px
2. Tablet layout correct at 768px
3. Mobile layout correct at 375px
4. Touch gestures work on mobile
5. No content overflow

=== QUALITY GATE ===

✓ All breakpoints work correctly
✓ Touch gestures functional
✓ No overflow/scroll issues
✓ All controls accessible
✓ All tests pass
```

---

### Agent 5E: Integration Testing

**Dependencies:** All features complete
**Estimated effort:** ~1.5 days
**Output:** End-to-end tests and final verification

```markdown
=== TASK DEFINITION ===

Create comprehensive integration tests verifying the complete
application works correctly as an integrated system.

=== TEST SCENARIOS ===

USER JOURNEYS:
1. First-time user experience
   - Open app → see tesseract → explore controls

2. Dimension exploration
   - Change dimension → verify object updates
   - Change object type → verify properties

3. Rotation workflow
   - Rotate in single plane → verify visual
   - Animate rotation → verify smooth animation
   - Reset → verify return to default

4. Export/share workflow
   - Customize object → export image
   - Generate share URL → load in new tab → verify same state

5. Cross-section exploration
   - Enable cross-section → move slice → verify shapes

6. Mobile experience
   - Load on mobile → use touch gestures → use bottom sheet

=== IMPLEMENTATION REQUIREMENTS ===

```typescript
// scripts/playwright/integration-tests.spec.ts
// Playwright tests covering all user journeys

// src/tests/integration/
// Vitest integration tests for store interactions
```

=== TEST CATEGORIES ===

1. SMOKE TESTS
   - App loads without errors
   - All sections visible
   - No console errors

2. FUNCTIONAL TESTS
   - Each control affects visualization
   - State persists correctly
   - Reset functions work

3. VISUAL REGRESSION
   - Screenshot comparison for key states
   - Render consistency across browsers

4. PERFORMANCE TESTS
   - 60 FPS maintained during animation
   - No memory leaks during extended use
   - Responsive UI during heavy computation

=== QUALITY GATE ===

✓ All user journey tests pass
✓ No console errors in any scenario
✓ Visual regression tests pass
✓ Performance benchmarks met
✓ Coverage report generated
✓ All tests pass in CI environment
```

---

## Summary Table

| Phase | Agent | Task | Dependencies | Effort | Parallel? |
|-------|-------|------|--------------|--------|-----------|
| 1 | 1A | Project Setup | None | 1 day | No |
| 1 | 1B | Math Library | 1A | 2 days | No |
| 2 | 2A | Object Generation | 1B | 1.5 days | Yes |
| 2 | 2B | Three.js Scene | 1B | 1.5 days | Yes |
| 2 | 2C | Rotation System | 1B, 2B | 1.5 days | Yes |
| 2 | 2D | Projection System | 1B, 2B | 1.5 days | Yes |
| 2 | 2E | UI Framework | 1B | 1.5 days | Yes |
| 3 | 3A | Scale Controls | P2 | 1 day | Yes |
| 3 | 3B | Shear Controls | P2 | 1 day | Yes |
| 3 | 3C | Translation | P2 | 0.5 days | Yes |
| 3 | 3D | Animation System | P2, 3A-C | 1.5 days | Yes |
| 4 | 4A | Cross-Section | P3 | 2 days | Yes |
| 4 | 4B | Visual Styling | P2 | 1.5 days | Yes |
| 4 | 4C | Properties Panel | 2A | 1 day | Yes |
| 5 | 5A | Export/Share | P4 | 1.5 days | No |
| 5 | 5B | Education Panel | 4C | 1 day | No |
| 5 | 5C | Keyboard Shortcuts | P4 | 0.5 days | No |
| 5 | 5D | Responsive Layout | P4 | 1 day | No |
| 5 | 5E | Integration Tests | All | 1.5 days | No |

**Total Effort:** ~24 man-days
**Critical Path:** 1A → 1B → 2B → 2C → 3D → 4A → 5E (~11 days)
**Maximum Parallelization:** 5 agents (Phase 2)
