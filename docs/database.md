# State Management Guide

**Purpose**: This document teaches you how to manage application state using Zustand.

**Library**: Zustand (v5)
**Location**: `src/stores/`

---

## Core Principles

### 1. Single Responsibility Stores
**Rule**: Split state into logical domains.
-   `geometryStore.ts`: Dimension, Object Type.
-   `visualStore.ts`: Colors, Opacity, Render Modes.
-   `animationStore.ts`: Play/Pause, Speed.

### 2. Actions co-located with State
**Rule**: Define setters/actions inside the store.
**Why**: Encapsulates logic (validation, side effects) within the store.

---

## How to Create a New Store

### Step 1: Define Interface
**File**: `src/stores/myFeatureStore.ts`
**Template**:
```typescript
import { create } from 'zustand';

interface MyFeatureState {
  // State
  isEnabled: boolean;
  intensity: number;

  // Actions
  toggleEnabled: () => void;
  setIntensity: (value: number) => void;
  reset: () => void;
}
```

### Step 2: Implement Store
**Template**:
```typescript
export const useMyFeatureStore = create<MyFeatureState>((set) => ({
  isEnabled: false,
  intensity: 0.5,

  toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
  
  setIntensity: (value) => {
    // Validation logic here
    const clamped = Math.max(0, Math.min(1, value));
    set({ intensity: clamped });
  },

  reset: () => set({ isEnabled: false, intensity: 0.5 }),
}));
```

---

## Accessing State

### In React Components
```tsx
import { useMyFeatureStore } from '@/stores/myFeatureStore';

function MyComponent() {
  // Select specific properties to optimize re-renders
  const intensity = useMyFeatureStore((state) => state.intensity);
  const setIntensity = useMyFeatureStore((state) => state.setIntensity);
  
  return <input value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />;
}
```

### Outside React (e.g., in utility functions)
```typescript
import { useMyFeatureStore } from '@/stores/myFeatureStore';

function doSomething() {
  const state = useMyFeatureStore.getState();
  console.log(state.intensity);
}
```

---

## Common Patterns

### 1. Validation Logic
Put validation inside the setter action, not the component.
```typescript
setDimension: (dim) => {
  if (dim < 2 || dim > 11) return; // Validation
  set({ dimension: dim });
}
```

### 2. Derived State
If state is derived from other state, compute it in the hook or component, or use a selector.
```tsx
const isHighIntensity = useMyFeatureStore((state) => state.intensity > 0.8);
```

---

## Common Mistakes
❌ **Don't**: Mutate state directly (`state.value = 5`).
✅ **Do**: Use `set({ value: 5 })`.

❌ **Don't**: Put non-serializable data (like THREE.Mesh instances) in global stores if possible.
✅ **Do**: Keep stores for serializable config; use `useRef` for ephemeral 3D objects.
