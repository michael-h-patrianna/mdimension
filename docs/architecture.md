# Architecture Guide for LLM Coding Agents

**Purpose**: This document helps you make architectural decisions and locate/place code correctly.
## TECH STACK

### Core Framework
- **React** 19.2.3 - UI library
- **TypeScript** 5.6.3 - Type-safe JavaScript
- **Vite** 7.2.7 - Build tool and dev server

### 3D Graphics & Rendering
- **Three.js** 0.181.0 - WebGL 3D library
- **@react-three/fiber** 9.4.2 - React renderer for Three.js
- **@react-three/drei** 10.7.7 - Three.js utilities
- **@react-three/postprocessing** 3.0.4 - Post-processing effects
- **postprocessing** 6.38.0 - Post-processing library

### UI & Styling
- **Tailwind CSS** 4.1.18 - Utility-first CSS framework
- **@tailwindcss/vite** 4.1.18 - Vite plugin for Tailwind
- **Motion** 12.23.26 - Animation library

### State Management & Utilities
- **Zustand** 5.0.2 - State management
- **convex-hull** 1.0.3 - Computational geometry

### Testing
- **Vitest** 4.0.15 - Unit testing framework
- **@testing-library/react** 16.3.0 - React testing utilities
- **@testing-library/jest-dom** 6.6.3 - Custom matchers
- **@testing-library/user-event** 14.6.1 - User interaction simulation
- **happy-dom** 15.11.7 - DOM implementation for testing
- **jsdom** 25.0.1 - Alternative DOM implementation
- **Playwright** 1.57.0 - E2E testing

### Development Tools
- **ESLint** 9.15.0 - Code linting
- **@typescript-eslint/parser** 8.15.0 - TypeScript ESLint parser
- **@typescript-eslint/eslint-plugin** 8.15.0 - TypeScript linting rules
- **eslint-plugin-react-hooks** 5.0.0 - React Hooks linting
- **eslint-plugin-react-refresh** 0.4.14 - React Refresh linting
- **eslint-plugin-jsdoc** 61.5.0 - JSDoc linting
- **Prettier** 3.4.1 - Code formatting
- **@vitejs/plugin-react** 5.1.2 - Vite React plugin

---

## Core Architectural Principles

### 1. Visualization-First Architecture
**Mental Model**: The application is a pipeline that transforms abstract mathematical data into 3D visual geometry.
**Flow**: `Math/Logic` → `State (Zustand)` → `Canvas (Three.js)` → `User Interaction`

### 2. Separation of Concerns
- **Math/Geometry**: Pure functions in `src/lib/`. No React, no Three.js dependencies (unless absolutely necessary for shaders).
- **State**: Zustand stores in `src/stores/`. Manages "what is being displayed".
- **View**: React components in `src/components/`. Two types:
    - **UI Components**: HTML overlays (`src/components/ui/`).
    - **Canvas Components**: 3D scene elements (`src/components/canvas/`).
- **Integration**: Custom hooks in `src/hooks/`. Connects Stores/Math to Components.

---

## Where to Put New Code

```
src/
├── components/
│   ├── canvas/       # 3D Objects (Meshes, Lights, Scene)
│   ├── ui/           # HTML Overlays (Buttons, Sliders)
│   └── controls/     # Camera/Interaction Controls
├── hooks/            # React Hooks (Business Logic)
├── lib/              # Pure Logic (Math, Geometry, Shaders)
│   ├── geometry/     # ND Generation Logic
│   ├── math/         # Matrix/Vector Math
│   └── shaders/      # GLSL Shaders
├── stores/           # Global State (Zustand)
└── theme/            # Styling Constants
```

### Decision Tree: "Where do I put X?"
1. **Is it a pure mathematical formula?** → `src/lib/math/` or `src/lib/geometry/`
2. **Is it global state (e.g., current dimension)?** → `src/stores/`
3. **Is it a React Hook?** → `src/hooks/`
4. **Is it a 3D object in the scene?** → `src/components/canvas/`
5. **Is it a UI button/overlay?** → `src/components/ui/`
6. **Is it a shader?** → `src/lib/shaders/`

---

## Component Patterns

### 1. Canvas Components (`src/components/canvas/`)
**Rule**: Must be rendered inside a `<Canvas>` (R3F).
**Pattern**:
```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function My3DObject({ prop }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Animation loop
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}
```

### 2. UI Components (`src/components/ui/`)
**Rule**: Standard React DOM components. Use Tailwind CSS.
**Pattern**:
```tsx
export function ControlPanel() {
  const { value, setValue } = useStore();

  return (
    <div className="absolute top-4 left-4 bg-black/50 p-4 rounded">
      <button
        onClick={() => setValue(value + 1)}
        className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
      >
        Increment
      </button>
    </div>
  );
}
```

---

## State Management Pattern
**Library**: Zustand
**Pattern**: Split stores by domain (Geometry, UI, Animation).
**Location**: `src/stores/`

---

## Common Mistakes
❌ **Don't**: Put complex math logic inside React components.
✅ **Do**: Extract math to `src/lib/` and use it via hooks.

❌ **Don't**: Mix DOM elements (`<div>`) inside `<Canvas>` components.
✅ **Do**: Keep 3D and 2D components separate; use `drei/Html` if 3D-attached text is needed.

❌ **Don't**: Use `useState` for rapidly changing animation values (causes re-renders).
✅ **Do**: Use `useRef` or `useFrame` for animation loops.
