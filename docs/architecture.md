# Architecture Guide for LLM Coding Agents

**Purpose**: Instructions for where to put code and what patterns to follow.
**Tech Stack**: TypeScript + React + Vite + Three.js/R3F + Zustand + Tailwind CSS

## Where to Put New Code

```
src/
├── components/         # React UI components
│   ├── canvas/         # Three.js/R3F 3D rendering components
│   ├── controls/       # UI controls (sliders, selectors, panels)
│   └── ui/             # Reusable base UI components (Button, Slider, etc.)
├── hooks/              # Custom React hooks (logic orchestration)
├── stores/             # Zustand state stores
├── lib/                # Pure domain logic (framework-agnostic)
│   ├── geometry/       # Polytope generation, face detection, cross-sections
│   ├── math/           # Linear algebra, vectors, matrices, rotations
│   ├── projection/     # N-dimensional projection algorithms
│   ├── shaders/        # Custom Three.js shader materials
│   ├── url/            # URL state serialization
│   ├── education/      # Educational content for UI
│   └── export/         # Image/data export utilities
├── types/              # Shared TypeScript type definitions
└── utils/              # Generic utilities
```

**Decision tree**:
- Creating new 3D renderer? → Put in `src/components/canvas/`, name `{Name}Renderer.tsx`
- Creating new control panel widget? → Put in `src/components/controls/`, name `{Name}Controls.tsx`
- Creating reusable UI primitive? → Put in `src/components/ui/`, name `{Name}.tsx`
- Creating state management? → Put in `src/stores/`, name `{domain}Store.ts`
- Creating reusable logic hook? → Put in `src/hooks/`, name `use{Name}.ts`
- Creating pure math/geometry? → Put in `src/lib/{domain}/`, name `{feature}.ts`
- Creating custom shader? → Put in `src/lib/shaders/`, name `{Name}Material.ts`

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| React component | `PascalCase.tsx` | `DimensionSelector.tsx` |
| Hook | `use{Name}.ts` | `useRotatedVertices.ts` |
| Store | `{domain}Store.ts` | `geometryStore.ts` |
| Lib module | `kebab-case.ts` | `cross-section.ts` |
| Types | `types.ts` in folder | `lib/geometry/types.ts` |
| Test | `{filename}.test.ts(x)` | `DimensionSelector.test.tsx` |
| Index re-export | `index.ts` | `hooks/index.ts` |

## How to Create a Zustand Store

**Template**:
```typescript
/**
 * {Domain} state management using Zustand
 * {Brief description of what this store manages}
 */

import { create } from 'zustand';
import type { SomeType } from '@/lib/{domain}/types';

// Constants
export const DEFAULT_VALUE = 'default';

// State interface
interface {Domain}State {
  /** State property description */
  value: SomeType;

  // Actions
  setValue: (value: SomeType) => void;
  reset: () => void;
}

export const use{Domain}Store = create<{Domain}State>((set) => ({
  value: DEFAULT_VALUE,

  setValue: (value: SomeType) => {
    set({ value });
  },

  reset: () => {
    set({ value: DEFAULT_VALUE });
  },
}));
```

**Steps**:
1. Create file at `src/stores/{domain}Store.ts`
2. Define interface with state + actions
3. Export constants for defaults
4. Export store hook with `use{Domain}Store` naming
5. Add to `src/stores/index.ts` barrel export

## How to Create a Control Component

**Template**:
```tsx
/**
 * {Name} Controls Component
 * {Brief description}
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { use{Domain}Store } from '@/stores/{domain}Store';

export interface {Name}ControlsProps {
  className?: string;
  disabled?: boolean;
}

export const {Name}Controls: React.FC<{Name}ControlsProps> = ({
  className = '',
  disabled = false,
}) => {
  const value = use{Domain}Store((state) => state.value);
  const setValue = use{Domain}Store((state) => state.setValue);

  return (
    <div className={`space-y-4 ${className}`}>
      <Slider
        label="Value"
        min={0}
        max={100}
        value={value}
        onChange={setValue}
        disabled={disabled}
      />
    </div>
  );
};
```

**Steps**:
1. Create file at `src/components/controls/{Name}Controls.tsx`
2. Import UI primitives from `@/components/ui/`
3. Connect to store with individual selectors (not full state)
4. Export named component with Props interface

## How to Create a Custom Hook

**Template**:
```typescript
/**
 * Hook for {description}
 * {Additional details about side effects, performance}
 */

import { useMemo } from 'react';
import { use{Domain}Store } from '@/stores';
import { someTransform } from '@/lib/{domain}';
import type { InputType, OutputType } from '@/lib/{domain}/types';

/**
 * {Detailed JSDoc description}
 * @param input - Description
 * @returns Transformed output
 */
export function use{Name}(input: InputType): OutputType {
  const storeValue = use{Domain}Store((state) => state.value);

  const result = useMemo(() => {
    return someTransform(input, storeValue);
  }, [input, storeValue]);

  return result;
}
```

**Steps**:
1. Create file at `src/hooks/use{Name}.ts`
2. Subscribe to stores with individual selectors
3. Memoize expensive computations
4. Add JSDoc with `@param` and `@returns`
5. Export from `src/hooks/index.ts`

## How to Create a Pure Library Module

**Template**:
```typescript
/**
 * {Module Name}
 *
 * {Description of what this module provides}
 * - Feature 1
 * - Feature 2
 */

import type { InputType, OutputType } from './types';

/**
 * {Function description}
 *
 * @param input - Description
 * @returns Description
 * @throws {Error} When {condition}
 *
 * @example
 * ```typescript
 * const result = myFunction(input);
 * ```
 */
export function myFunction(input: InputType): OutputType {
  // Validate input
  if (!isValid(input)) {
    throw new Error('Invalid input: {reason}');
  }

  // Pure computation
  return transform(input);
}
```

**Steps**:
1. Create file at `src/lib/{domain}/{feature}.ts`
2. Keep functions pure (no side effects, no React)
3. Export types from `types.ts` in same folder
4. Add JSDoc with examples
5. Re-export from `src/lib/{domain}/index.ts`

## How to Create a Three.js Canvas Component

**Template**:
```tsx
/**
 * {Name} Renderer Component
 * {Description of what this renders}
 */

import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { Vector3D } from '@/lib/math/types';
import { useVisualStore } from '@/stores/visualStore';

export interface {Name}RendererProps {
  vertices: Vector3D[];
  edges: [number, number][];
  opacity?: number;
}

export function {Name}Renderer({
  vertices,
  edges,
  opacity = 1.0,
}: {Name}RendererProps) {
  const color = useVisualStore((state) => state.edgeColor);

  const geometry = useMemo(() => {
    // Transform vertices to Three.js format
    return vertices.map((v) => new Vector3(...v));
  }, [vertices]);

  return (
    <group>
      {/* Three.js JSX elements */}
      <mesh>
        <bufferGeometry />
        <meshStandardMaterial color={color} opacity={opacity} />
      </mesh>
    </group>
  );
}
```

## Import Path Aliases

Always use these aliases (configured in `vite.config.ts` and `tsconfig.json`):

```typescript
// DO use aliases
import { Button } from '@/components/ui/Button';
import { useGeometryStore } from '@/stores/geometryStore';
import { generatePolytope } from '@/lib/geometry';
import type { Vector3D } from '@/lib/math/types';

// DON'T use relative paths across domains
import { Button } from '../../components/ui/Button';  // BAD
```

## State Management Rules

1. **One store per domain**: `geometryStore`, `visualStore`, `animationStore`, etc.
2. **Individual selectors**: Subscribe to specific state, not entire store
3. **Actions in store**: All state mutations happen through store actions
4. **Sync across stores**: Use `useLayoutEffect` to sync dependent stores

```typescript
// GOOD: Individual selectors
const dimension = useGeometryStore((state) => state.dimension);
const setDimension = useGeometryStore((state) => state.setDimension);

// BAD: Full store subscription (causes unnecessary re-renders)
const store = useGeometryStore();
```

## Common Mistakes

**Don't**: Put React components in `src/lib/`
**Do**: Keep `src/lib/` pure TypeScript, no React dependencies

**Don't**: Import full store state
**Do**: Use individual state selectors for better performance

**Don't**: Create deeply nested component folders
**Do**: Keep components max 2 levels deep (`components/canvas/`, `components/ui/`)

**Don't**: Put business logic in components
**Do**: Extract logic to hooks or lib modules, keep components presentational

**Don't**: Use relative imports across domains
**Do**: Use `@/` path aliases for all cross-folder imports

**Don't**: Skip JSDoc on exported functions
**Do**: Add JSDoc with `@param`, `@returns`, `@example` on all exports

**Don't**: Create new state with `useState` for shared state
**Do**: Add to appropriate Zustand store

**Don't**: Name files with underscores: `my_component.tsx`
**Do**: Use PascalCase for components: `MyComponent.tsx`

**Don't**: Put shader/material code in components
**Do**: Create materials in `src/lib/shaders/` and import them
