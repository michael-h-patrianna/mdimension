# Architecture Guide for LLM Coding Agents

**Purpose**: This teaches you HOW to add code to this repo without breaking folder boundaries, performance constraints, or WebGL2 shader requirements.

**Read this first**: `docs/meta/styleguide.md` (mandatory engineering + shader rules).

## Tech Stack (Generate code for these tools only)

- **App**: React 19 + TypeScript + Vite
- **3D**: Three.js + @react-three/fiber (+ drei)
- **State**: Zustand 5 (selectors + `useShallow` for perf)
- **Styling**: Tailwind CSS 4 tokens defined in `src/index.css` (`@theme` + `@utility`)
- **Testing**: Vitest (happy-dom) + Playwright (`@playwright/test`)
- **Animation**: Motion (framer-motion replacement)
- **WASM**: Rust + wasm-pack for geometry computation

## Where to Put New Code

```
src/
├── components/
│   ├── ui/            # ONLY reusable UI primitives (Button, Slider, Modal, etc.)
│   ├── layout/        # Layout frames, panels, top bars, drawers
│   ├── sections/      # Sidebar/editor sections (feature groupings)
│   ├── canvas/        # Small R3F helpers (controllers, gizmos) not core pipeline
│   ├── controls/      # Domain-specific control components (ExportButton, ShareButton)
│   ├── overlays/      # Modal dialogs, overlays, context-lost screens
│   └── presets/       # Scene/style preset management
├── hooks/             # React hooks that wire stores + rendering + UI
├── lib/               # Pure logic (math, geometry, shaders-as-strings helpers)
│   ├── animation/     # Animation bias calculation, timing utilities
│   ├── cache/         # IndexedDB caching for geometry
│   ├── colors/        # Color utilities and conversions
│   ├── export/        # Image/video export utilities
│   ├── geometry/      # Pure geometry generation (polytopes, extended objects)
│   │   ├── extended/  # Clifford torus, nested torus, root systems, etc.
│   │   ├── registry/  # Object type registry and metadata
│   │   ├── utils/     # Spatial hashing, vertex deduplication
│   │   └── wythoff/   # Wythoff construction algorithms
│   ├── math/          # Vector, matrix, rotation, projection utilities
│   └── wasm/          # WASM bindings and helpers
├── rendering/         # Rendering pipeline (Scene, render graph, shaders, passes)
│   ├── controllers/   # R3F controllers (camera, FPS, performance)
│   ├── core/          # Core rendering utilities (cleanup, recovery, priorities)
│   ├── environment/   # Skybox, ground plane, scene lighting
│   ├── graph/         # WebGL render graph (passes, resource management)
│   ├── graph-tsl/     # TSL (Three Shading Language) render graph
│   ├── materials/     # Shader materials, tracked compilation
│   ├── renderers/     # Object-specific renderers (Polytope, Mandelbulb, BlackHole)
│   ├── shaders/       # GLSL shader code organized by domain
│   ├── shadows/       # Shadow mapping uniforms and utilities
│   ├── tsl/           # TSL node-based shader modules
│   │   ├── color/     # Color processing nodes
│   │   ├── compose/   # Composition and feature blocks
│   │   ├── lighting/  # Lighting calculation nodes
│   │   ├── materials/ # TSL material definitions
│   │   ├── normals/   # Normal calculation nodes
│   │   ├── postprocessing/ # Post-processing effects
│   │   └── raymarching/ # Raymarching core and SDF operations
│   └── uniforms/      # Uniform management and sources
├── stores/            # Zustand stores + slices (global state)
│   ├── defaults/      # Default values for stores
│   ├── slices/        # Store slices organized by domain
│   │   ├── geometry/  # Object-specific slices (blackhole, mandelbulb, etc.)
│   │   └── visual/    # Visual settings slices (color, material, PBR)
│   └── utils/         # Store utilities (merge, serialization)
├── workers/           # Web Workers (expensive geometry computations)
└── types/             # Shared TypeScript type definitions
scripts/
├── playwright/        # Playwright E2E tests ONLY (must be `*.spec.ts`)
└── tools/             # One-off utilities / verification scripts
screenshots/           # Visual artifacts (png/jpg/json) — never in repo root
docs/                  # Documentation
```

### Decision tree: where does this code go?

- **Creating/adjusting UI controls**:
  - **Reusable primitive** (Button/Select/Slider/Modal) → `src/components/ui/`
  - **Feature control group / panel section** → `src/components/sections/<Feature>/`
  - **Layout container** (top bar, drawers, split panes) → `src/components/layout/`
  - **Export/share functionality** → `src/components/controls/`
  - **Modal dialogs** → `src/components/overlays/`
- **Creating/adjusting global state**:
  - **Zustand store** (new domain) → `src/stores/<domain>Store.ts`
  - **Store slice** (extend existing store) → `src/stores/slices/...`
  - **Default constants** → `src/stores/defaults/...`
- **Creating/adjusting rendering**:
  - **Scene wiring** / top-level render graph → `src/rendering/`
  - **A specific renderer** (polytope / mandelbulb / etc.) → `src/rendering/renderers/`
  - **Shader code** or shader helpers → `src/rendering/shaders/` (or `src/lib/shaders/` if pure helpers)
  - **TSL shader nodes** → `src/rendering/tsl/` (organized by function)
  - **Render pass** → `src/rendering/graph/passes/` or `src/rendering/graph-tsl/passes/`
- **Pure math/geometry** (no React) → `src/lib/`
- **Heavy computation** that blocks the main thread → `src/workers/` + a `src/hooks/use…Worker.ts` wrapper

## Naming & Import Rules

- **Always use path aliases** (`@/...`) instead of deep relative imports.
- **File naming**:
  - Components: `PascalCase.tsx`
  - Hooks: `useCamelCase.ts`
  - Stores: `camelCaseStore.ts`
  - Slices: `*Slice.ts`
  - Tests: `*.test.ts` or `*.test.tsx`
  - Playwright: `*.spec.ts`
  - TSL modules: `kebab-case.ts`
  - GLSL shaders: `kebab-case.ts` (TypeScript template strings)

### Path Aliases

Defined in both `vite.config.ts` and `vitest.config.ts`:

```typescript
'@': './src'
'@/components': './src/components'
'@/lib': './src/lib'
'@/hooks': './src/hooks'
'@/stores': './src/stores'
'@/types': './src/types'
'@/utils': './src/utils'
'mdimension-core': './src/wasm/mdimension_core/pkg'  // WASM module
```

## UI Rules (Do NOT bypass the UI library)

- **Always** build UI out of `src/components/ui/*` primitives.
- **Never** introduce raw `<input>`, `<select>`, ad-hoc `<button>` styling, or bespoke modals unless there is no suitable primitive.
- **Always** use the project's Tailwind tokens + utilities:
  - Theme tokens live in `src/index.css` (`@theme` variables).
  - Premium utilities exist (e.g. `glass-panel`, `glass-button-primary`, `glass-input`).
- **If you need inline styles**, prefer `src/theme/themeUtils.tsx` helpers for consistency.

### Available UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `Button` | Primary/secondary/ghost buttons | `@/components/ui/Button` |
| `Slider` | Numeric range input with label drag | `@/components/ui/Slider` |
| `Select` | Dropdown selection | `@/components/ui/Select` |
| `Switch` | Boolean toggle | `@/components/ui/Switch` |
| `ToggleGroup` | Exclusive option selection | `@/components/ui/ToggleGroup` |
| `MultiToggleGroup` | Multi-select toggle group | `@/components/ui/MultiToggleGroup` |
| `Tabs` | Tabbed content | `@/components/ui/Tabs` |
| `Modal` | Dialog overlay | `@/components/ui/Modal` |
| `ConfirmModal` | Confirmation dialog | `@/components/ui/ConfirmModal` |
| `InputModal` | Text input dialog | `@/components/ui/InputModal` |
| `Tooltip` | Hover tooltips | `@/components/ui/Tooltip` |
| `Popover` | Click-triggered popovers | `@/components/ui/Popover` |
| `DropdownMenu` | Context/dropdown menus | `@/components/ui/DropdownMenu` |
| `ColorPicker` | Color selection | `@/components/ui/ColorPicker` |
| `NumberInput` | Numeric input with validation | `@/components/ui/NumberInput` |
| `Input` | Text input | `@/components/ui/Input` |
| `InlineEdit` | Inline editable text | `@/components/ui/InlineEdit` |
| `Knob` | Rotary knob control | `@/components/ui/Knob` |
| `Envelope` | ADSR envelope editor | `@/components/ui/Envelope` |
| `ControlGroup` | Grouped controls with label | `@/components/ui/ControlGroup` |
| `Icon` | SVG icon wrapper | `@/components/ui/Icon` |
| `LoadingSpinner` | Loading indicator | `@/components/ui/LoadingSpinner` |
| `GlobalProgress` | Progress bar | `@/components/ui/GlobalProgress` |
| `ErrorBoundary` | Error catching wrapper | `@/components/ui/ErrorBoundary` |
| `SpotlightCard` | Highlighted card with glow | `@/components/ui/SpotlightCard` |

### Template: new UI primitive

Create: `src/components/ui/<NAME>.tsx`, export it from `src/components/ui/index.ts`.

```tsx
import React from 'react'

export interface <NAME>Props {
  className?: string
  disabled?: boolean
  'data-testid'?: string
}

export function <NAME>({ className = '', disabled = false, 'data-testid': testId }: <NAME>Props) {
  return (
    <div data-testid={testId} className={`glass-panel ${className}`} aria-disabled={disabled}>
      {/* TODO: implement */}
    </div>
  )
}
```

## Zustand Rules (Performance-critical)

- **Never** subscribe to an entire store object in a React component.
- **Always** use either:
  - Individual selectors (`useStore(s => s.value)`) OR
  - A shallow object selector via `useShallow`.

### CRITICAL `useShallow` rule (React 19 + Zustand 5)

`useShallow` is a hook. **Do not call it inside another hook call**.

✅ Correct pattern:

```ts
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '@/stores'

const uiSelector = useShallow((s: ReturnType<typeof useUIStore.getState>) => ({
  isOpen: s.isOpen,
  setOpen: s.setOpen,
}))

export function Component() {
  const { isOpen, setOpen } = useUIStore(uiSelector)
  // ...
}
```

❌ Incorrect pattern:

```ts
// DO NOT DO THIS
const { isOpen } = useUIStore(useShallow((s) => ({ isOpen: s.isOpen })))
```

### Available Stores

| Store | Purpose | Key State |
|-------|---------|-----------|
| `useGeometryStore` | Dimension, object type | `dimension`, `objectType` |
| `useAnimationStore` | Animation playback | `isPlaying`, `speed`, `animatingPlanes` |
| `useRotationStore` | Rotation angles per plane | `rotations` Map |
| `useTransformStore` | Scale, translation | `scale`, `translation` |
| `useAppearanceStore` | Visual appearance | `facesVisible`, `edgesVisible`, `colorAlgorithm` |
| `useLightingStore` | Light configuration | `lights[]`, shadow settings |
| `usePostProcessingStore` | Post-processing effects | `bloom`, `ssao`, `ssr`, `gravity` |
| `useEnvironmentStore` | Environment settings | `skyboxPreset`, `groundVisible` |
| `usePerformanceStore` | Performance/quality | `qualityLevel`, `sceneTransitioning` |
| `useCameraStore` | Camera state | `position`, `target`, `fov` |
| `useLayoutStore` | UI layout | `sidebarWidth`, `layoutMode` |
| `useUIStore` | UI state | `sidebarOpen`, `animationBias` |
| `useExportStore` | Export state | `isExporting`, `format` |
| `useThemeStore` | Theme settings | `mode`, `accent` |
| `useExtendedObjectStore` | Extended object params | Mandelbulb, Julia, Schroedinger settings |
| `usePBRStore` | PBR material settings | `roughness`, `metalness` |
| `useMsgBoxStore` | Modal dialogs | `showMsgBox()`, `closeMsgBox()` |
| `useRendererStore` | Renderer backend | `backend` (webgl/webgpu) |

### Template: add a new store

Create: `src/stores/<domain>Store.ts`, export from `src/stores/index.ts`, add tests in `src/tests/stores/`.

```ts
import { create } from 'zustand'

export interface <Domain>State {
  value: number
  setValue: (value: number) => void
  reset: () => void
}

const DEFAULT_VALUE = 0

export const use<Domain>Store = create<<Domain>State>((set) => ({
  value: DEFAULT_VALUE,
  setValue: (value) => set({ value }),
  reset: () => set({ value: DEFAULT_VALUE }),
}))
```

## WebGL2 / Shader Rules (Non-negotiable)

- **All shaders must be WebGL2 / GLSL ES 3.00**.
- **Never** use WebGL1 syntax (`attribute`, `varying`, `gl_FragColor`, `texture2D`, `textureCube`).
- When using `THREE.ShaderMaterial`, **always** set `glslVersion: THREE.GLSL3`.

### Required GLSL ES 3.00 Syntax

| WebGL1 (Forbidden) | WebGL2 (Required) |
|-------------------|-------------------|
| `attribute` | `in` (vertex shader) |
| `varying` (vertex) | `out` |
| `varying` (fragment) | `in` |
| `gl_FragColor` | `layout(location = N) out vec4 varName;` |
| `texture2D()` | `texture()` |
| `textureCube()` | `texture()` |

### Template: fragment shader output (GLSL3)

```glsl
precision highp float;
precision highp int;

layout(location = 0) out vec4 fragColor;

void main() {
  fragColor = vec4(1.0);
}
```

### Template: MRT (Multiple Render Target)

```glsl
precision highp float;
precision highp int;

layout(location = 0) out vec4 gColor;   // Color buffer
layout(location = 1) out vec4 gNormal;  // Normal buffer (packed: RGB = normal, A = metallic)

void main() {
  gColor = vec4(1.0);
  gNormal = vec4(0.5, 0.5, 1.0, 0.0);  // Up normal, non-metallic
}
```

### Critical Three.js DPR/viewport gotcha (RenderTargets)

When rendering to a `WebGLRenderTarget` at non-standard resolution: **never call `gl.setViewport()`** (it multiplies by DPR).

✅ Correct:

```ts
target.viewport.set(0, 0, target.width, target.height)
gl.setRenderTarget(target)
```

❌ Incorrect:

```ts
gl.setRenderTarget(target)
gl.setViewport(0, 0, target.width, target.height)
```

### Fullscreen quad vertex rule (manual quad rendering)

If you render a fullscreen quad manually (not via ShaderPass), use direct NDC:

```glsl
in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
```

## TSL (Three Shading Language) Patterns

TSL is a node-based shader language that compiles to GLSL. Use it for WebGPU-compatible shaders.

### Template: TSL Raymarching Core

```typescript
import { Fn, float, vec3, vec4, If, Loop, Break, max, min } from 'three/tsl'
import type { UniformNode } from 'three/tsl'

type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

export const createRaymarchCore = (
  sdfFunc: (p: Vec3Node) => FloatNode,
  qualityUniforms: { uMaxSteps: UniformNode<number> }
) => {
  return Fn(([ro, rd]: [Vec3Node, Vec3Node]) => {
    const dO = float(0).toVar('dO')
    const hit = float(0).toVar('hit')

    Loop(128, ({ i }) => {
      If(i.greaterThanEqual(qualityUniforms.uMaxSteps), () => Break())

      const p = ro.add(rd.mul(dO))
      const dS = sdfFunc(p)

      If(dS.lessThan(0.001), () => {
        hit.assign(1)
        Break()
      })

      dO.assign(dO.add(dS))
    })

    return vec4(dO, float(0), hit, float(0))
  })
}
```

### TSL Module Organization

```
src/rendering/tsl/
├── color/          # Color processing (gradients, palettes)
├── compose/        # Feature composition blocks
│   └── feature-blocks/  # Temporal, quality, etc.
├── lighting/       # Lighting calculations
├── materials/      # Material definitions
├── normals/        # Normal calculation
├── postprocessing/ # Post-processing effects
├── raymarching/    # Raymarching core, SDF ops
│   ├── raymarch-core.ts    # Main raymarching loop
│   ├── sdf-ops.ts          # SDF operations (union, smooth)
│   ├── normals.ts          # Normal estimation
│   └── lighting.ts         # Shading
└── utils/          # Common utilities
```

## Render Graph Architecture

The render graph manages multi-pass rendering with automatic resource lifecycle.

### Template: Custom Render Pass

```typescript
import { BasePass } from '@/rendering/graph/BasePass'
import type { RenderContext, RenderPassConfig } from '@/rendering/graph/types'

export class MyCustomPass extends BasePass {
  constructor() {
    super({
      id: 'my-custom',
      inputs: [{ resourceId: 'sceneColor', access: 'read' }],
      outputs: [{ resourceId: 'output', access: 'write' }],
    })
  }

  execute(ctx: RenderContext): void {
    const input = ctx.getReadTexture('sceneColor')
    const output = ctx.getWriteTarget('output')

    // ... render logic using ctx.gl (WebGLRenderer)
    ctx.gl.setRenderTarget(output)
    // ... render
    ctx.gl.setRenderTarget(null)
  }

  dispose(): void {
    // Clean up GPU resources
  }
}
```

### Frame Priorities

Register with R3F's frame system using priorities from `@/rendering/core/framePriorities`:

```typescript
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { useFrame } from '@react-three/fiber'

// Higher number = runs earlier
useFrame(callback, FRAME_PRIORITY.ANIMATION)  // 100
useFrame(callback, FRAME_PRIORITY.CAMERA)     // 200
useFrame(callback, FRAME_PRIORITY.RENDER)     // 300
```

## Hooks Patterns

### Template: Animation Loop Hook

```typescript
import { useFrame } from '@react-three/fiber'
import { useCallback, useRef } from 'react'
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities'
import { useAnimationStore } from '@/stores/animationStore'

export function useAnimationLoop(): void {
  // Reuse containers to avoid allocation every frame
  const updatesRef = useRef(new Map<string, number>())

  // Stable callback - all state read via getState() inside
  const animationCallback = useCallback(
    (_state: unknown, delta: number) => {
      // Batch all store reads at start
      const { isPlaying } = useAnimationStore.getState()
      if (!isPlaying) return

      // ... animation logic
    },
    [] // Empty deps - all state read via getState()
  )

  useFrame(animationCallback, FRAME_PRIORITY.ANIMATION)
}
```

### Template: Worker Hook

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'

interface WorkerResult {
  vertices: Float32Array
  edges: number[]
}

export function useGeometryWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [result, setResult] = useState<WorkerResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('@/workers/geometry.worker.ts', import.meta.url),
      { type: 'module' }
    )

    workerRef.current.onmessage = (e) => {
      setResult(e.data)
      setLoading(false)
    }

    return () => workerRef.current?.terminate()
  }, [])

  const compute = useCallback((params: object) => {
    if (!workerRef.current) return
    setLoading(true)
    workerRef.current.postMessage(params)
  }, [])

  return { result, loading, compute }
}
```

## How to Add a New Feature (Standard Procedure)

1. **Decide ownership**: store vs hook vs rendering vs UI.
2. **Add/extend store** in `src/stores/` (selectors + `useShallow`).
3. **Add hook** in `src/hooks/` if any orchestration or derived state is needed.
4. **Add UI** using `src/components/ui` primitives (no raw controls).
5. **Add tests** in `src/tests/` mirroring the folder structure.
6. **If it impacts visual output**, add Playwright coverage in `scripts/playwright/`.

## How to Add a New Object Type

1. **Register in `src/lib/geometry/registry/`**:
   - Add to `ObjectType` union type
   - Add metadata (dimensions, category, recommended dimension)
2. **Add geometry generator** in `src/lib/geometry/extended/` (if extended object)
3. **Add store slice** in `src/stores/slices/geometry/` for object-specific parameters
4. **Add renderer** in `src/rendering/renderers/<ObjectType>/`
5. **Add shaders** in `src/rendering/shaders/<objecttype>/`
6. **Add TSL version** (if WebGPU support needed) in `src/rendering/tsl/raymarching/`
7. **Add UI controls** in `src/components/sections/Geometry/`
8. **Add tests** for geometry, store, and Playwright visual tests

## Common Mistakes

❌ **Don't**: Add bespoke HTML controls with ad-hoc Tailwind classes when a UI primitive exists.
✅ **Do**: Extend or compose `src/components/ui/*` primitives.

❌ **Don't**: Hardcode colors (hex literals) or invent new "design tokens".
✅ **Do**: Use Tailwind theme variables and utilities from `src/index.css`.

❌ **Don't**: Subscribe to a whole Zustand store object (causes rerenders on unrelated changes).
✅ **Do**: Use individual selectors or `useShallow` selectors.

❌ **Don't**: Call `useShallow` inside another hook call.
✅ **Do**: Create the selector via `useShallow(...)` first, then pass it to the store hook.

❌ **Don't**: Write WebGL1 shaders (`gl_FragColor`, `varying`, `texture2D`).
✅ **Do**: Write GLSL ES 3.00 shaders with `layout(location=0) out vec4 ...;` and `texture()`.

❌ **Don't**: Use `gl.setViewport()` when rendering to `WebGLRenderTarget`.
✅ **Do**: Use `target.viewport.set(...)` to avoid DPR multiplication bugs.

❌ **Don't**: Put scripts or screenshots in the repo root.
✅ **Do**: Use `scripts/tools/`, `scripts/playwright/`, and `screenshots/`.

❌ **Don't**: Create geometry in the render loop.
✅ **Do**: Memoize with `useMemo` or use workers for heavy computation.

❌ **Don't**: Read store state directly in render (causes stale closures).
✅ **Do**: Read via `useStore.getState()` inside `useFrame` callbacks.

❌ **Don't**: Forget to dispose of Three.js objects (geometry, materials, textures).
✅ **Do**: Implement `dispose()` methods and clean up in `useEffect` cleanup.

❌ **Don't**: Use barrel exports (`index.ts`) for internal imports.
✅ **Do**: Use direct file imports for better IDE navigation and tree-shaking.
