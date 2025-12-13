# N-Dimensional Visualizer - Copilot Instructions

## Project Overview

Interactive React/Three.js visualizer for N-dimensional mathematical objects (2D-11D). Transforms abstract geometry into real-time 3D projections using `Math → State → Canvas → User` pipeline.

## Architecture: Visualization Pipeline

```
src/lib/math/         → Pure math (rotations, projections, vectors)
src/lib/geometry/     → Object generators (polytopes, hyperspheres, Mandelbrot)
src/stores/           → Zustand state (geometry, animation, visual settings)
src/hooks/            → Glue: connect stores to rendering
src/components/canvas → Three.js renderers (inside <Canvas>)
src/components/ui/    → HTML overlays (outside <Canvas>)
```

**Key Decision Tree:**

- Pure math function → `src/lib/math/` or `src/lib/geometry/`
- Global state → `src/stores/`
- React hook → `src/hooks/`
- 3D mesh/object → `src/components/canvas/`
- HTML overlay → `src/components/ui/`
- GLSL shader → `src/lib/shaders/`

## Critical Patterns

### 1. High-Performance Rendering (useFrame Pattern)

All animation uses `useFrame` with `getState()` to bypass React re-renders:

```tsx
// ✅ Correct: Read from store without subscription
useFrame(() => {
  const { rotation } = useRotationStore.getState()
  meshRef.current.rotation.set(...rotation)
})

// ❌ Wrong: Causes re-renders every frame
const rotation = useRotationStore((s) => s.rotation)
```

See: `src/components/canvas/scenes/PolytopeScene.tsx`, `src/components/canvas/scenes/PointCloudScene.tsx`

### 2. Object Type System

Two categories with different render paths:

- **Polytopes** (`hypercube`, `simplex`, `cross-polytope`): Finite vertices/edges → PolytopeScene
- **Extended** (`hypersphere`, `root-system`, `clifford-torus`, `mandelbrot`): Point clouds → PointCloudScene or raymarching

Type guards in `src/lib/geometry/types.ts`: `isPolytopeType()`, `isExtendedObjectType()`

### 3. Dimension-Agnostic Math

All geometry uses `VectorND` (number arrays). Rotation planes scale with dimension: `n(n-1)/2` planes for nD space.

```ts
// 4D has 6 rotation planes: XY, XZ, YZ, XW, YW, ZW
const planes = getRotationPlanes(4)
```

### 4. Canvas vs DOM Separation

Never mix:

```tsx
// ❌ Wrong: DOM inside Canvas
<Canvas><div>Text</div></Canvas>

// ✅ Correct: Use drei's Html for 3D-attached text
<Canvas><Html>Text</Html></Canvas>
```

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm test          # Run Vitest (NEVER use watch mode in CI)
npm run build     # TypeScript check + Vite build
npx playwright test scripts/playwright/  # E2E tests
```

## Testing Rules

- **Unit tests** (`src/tests/lib/`): Pure math/geometry functions
- **Component tests** (`src/tests/components/`): React Testing Library
- **E2E tests** (`scripts/playwright/`): Visual verification, animation flows

**Memory Guard**: Max 4 workers in `vitest.config.ts`. Never increase without measuring RAM.

**Test file placement**: `.test.ts` for logic, `.test.tsx` only when testing React components (JSDOM is heavy).

## Folder Rules

| Type               | Location                               |
| ------------------ | -------------------------------------- |
| Playwright scripts | `scripts/playwright/`                  |
| Screenshots/videos | `screenshots/`                         |
| Documentation      | `docs/`                                |
| 🚫 Project root    | Keep clean—no scripts or scratch files |

## Style Requirements

Follow `docs/meta/styleguide.md`:

- JSDoc on all exports with `@param`, `@returns`, side effects
- TypeScript strict mode, no `any`
- Memoize: `useMemo`, `useCallback`, `React.memo` for render-heavy components
- Use theme utilities from `theme/themeUtils.tsx` for consistent styling

## Store Architecture

Zustand stores are domain-split:

- `geometryStore`: dimension, objectType
- `rotationStore`: rotation angles per plane
- `visualStore`: colors, visibility toggles
- `animationStore`: auto-rotation, timing
- `extendedObjectStore`: per-object-type configs

Access pattern for animation:

```tsx
// In useFrame - direct access, no subscription
const state = useGeometryStore.getState()

// In component render - selective subscription
const dimension = useGeometryStore((s) => s.dimension)
```

## Common Mistakes

- Using `useState` for animation values (causes re-renders)
- Forgetting `useShallow` when selecting multiple store values
- Placing complex math inside React components (extract to `src/lib/`)
- Running Vitest in watch mode during automation
- Creating files in project root instead of proper folders
