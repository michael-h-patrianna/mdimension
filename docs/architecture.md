# Architecture Guide for LLM Coding Agents

**Purpose**: This teaches you HOW to add code to this repo without breaking folder boundaries, performance constraints, or WebGL2 shader requirements.

**Read this first**: `docs/meta/styleguide.md` (mandatory engineering + shader rules).

## Tech Stack (Generate code for these tools only)

- **App**: React 19 + TypeScript + Vite
- **3D**: Three.js + @react-three/fiber (+ drei)
- **State**: Zustand 5 (selectors + `useShallow` for perf)
- **Styling**: Tailwind CSS 4 tokens defined in `src/index.css` (`@theme` + `@utility`)
- **Testing**: Vitest (happy-dom) + Playwright (`@playwright/test`)

## Where to Put New Code

```
src/
├── components/
│   ├── ui/            # ONLY reusable UI primitives (Button, Slider, Modal, etc.)
│   ├── layout/        # Layout frames, panels, top bars, drawers
│   ├── sections/      # Sidebar/editor sections (feature groupings)
│   ├── canvas/        # Small R3F helpers (controllers, gizmos) not core pipeline
│   └── ...            # Domain components (presets, share, etc.)
├── hooks/             # React hooks that wire stores + rendering + UI
├── lib/               # Pure logic (math, geometry, shaders-as-strings helpers)
├── rendering/         # Rendering pipeline (Scene, render graph, shaders, passes)
├── stores/            # Zustand stores + slices (global state)
├── workers/           # Web Workers (expensive geometry computations)
└── theme/             # CSS helper utilities (currently `themeUtils.tsx`)
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
- **Creating/adjusting global state**:
  - **Zustand store** (new domain) → `src/stores/<domain>Store.ts`
  - **Store slice** (extend existing store) → `src/stores/slices/...`
  - **Default constants** → `src/stores/defaults/...`
- **Creating/adjusting rendering**:
  - **Scene wiring** / top-level render graph → `src/rendering/`
  - **A specific renderer** (polytope / mandelbulb / etc.) → `src/rendering/renderers/`
  - **Shader code** or shader helpers → `src/rendering/shaders/` (or `src/lib/shaders/` if pure helpers)
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

## UI Rules (Do NOT bypass the UI library)

- **Always** build UI out of `src/components/ui/*` primitives.
- **Never** introduce raw `<input>`, `<select>`, ad-hoc `<button>` styling, or bespoke modals unless there is no suitable primitive.
- **Always** use the project’s Tailwind tokens + utilities:
  - Theme tokens live in `src/index.css` (`@theme` variables).
  - Premium utilities exist (e.g. `glass-panel`, `glass-button-primary`, `glass-input`).
- **If you need inline styles**, prefer `src/theme/themeUtils.tsx` helpers for consistency.

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

### Template: fragment shader output (GLSL3)

```glsl
precision highp float;
precision highp int;

layout(location = 0) out vec4 fragColor;

void main() {
  fragColor = vec4(1.0);
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

## How to Add a New Feature (Standard Procedure)

1. **Decide ownership**: store vs hook vs rendering vs UI.
2. **Add/extend store** in `src/stores/` (selectors + `useShallow`).
3. **Add hook** in `src/hooks/` if any orchestration or derived state is needed.
4. **Add UI** using `src/components/ui` primitives (no raw controls).
5. **Add tests** in `src/tests/` mirroring the folder structure.
6. **If it impacts visual output**, add Playwright coverage in `scripts/playwright/`.

## Common Mistakes

❌ **Don't**: Add bespoke HTML controls with ad-hoc Tailwind classes when a UI primitive exists.
✅ **Do**: Extend or compose `src/components/ui/*` primitives.

❌ **Don't**: Hardcode colors (hex literals) or invent new “design tokens”.
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
