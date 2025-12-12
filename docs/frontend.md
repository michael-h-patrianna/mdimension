# Frontend Guide for LLM Coding Agents

**Purpose**: Instructions for creating React components, Three.js renderers, and UI patterns.
**Stack**: React 18 + React Three Fiber + Zustand + Tailwind CSS

## Component Categories

| Category | Location | Purpose |
|----------|----------|---------|
| UI Primitives | `src/components/ui/` | Reusable base components (Button, Slider, etc.) |
| Controls | `src/components/controls/` | Domain-specific control panels |
| Canvas | `src/components/canvas/` | Three.js/R3F 3D rendering |
| Layout | `src/components/` | App layout components |

## How to Create a UI Primitive

**Template** (`src/components/ui/{Name}.tsx`):
```tsx
/**
 * {Name} Component
 * {Brief description}
 */

import React from 'react';

export interface {Name}Props {
  /** Primary prop description */
  value: string;
  /** Callback description */
  onChange?: (value: string) => void;
  /** Optional styling */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * {Detailed JSDoc description}
 *
 * @param props - Component props
 * @returns Rendered component
 *
 * @example
 * ```tsx
 * <{Name} value="example" onChange={handleChange} />
 * ```
 */
export const {Name}: React.FC<{Name}Props> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`{base-styles} ${className}`}>
      {/* Implementation */}
    </div>
  );
};
```

**Steps**:
1. Create file at `src/components/ui/{Name}.tsx`
2. Define Props interface with JSDoc comments
3. Use Tailwind for styling
4. Export from `src/components/ui/index.ts`

## How to Create a Control Component

**Template** (`src/components/controls/{Name}Controls.tsx`):
```tsx
/**
 * {Name} Controls Component
 * {Brief description of what this controls}
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { use{Domain}Store } from '@/stores/{domain}Store';

export interface {Name}ControlsProps {
  className?: string;
  disabled?: boolean;
}

export const {Name}Controls: React.FC<{Name}ControlsProps> = ({
  className = '',
  disabled = false,
}) => {
  // Individual selectors for performance
  const value = use{Domain}Store((state) => state.value);
  const setValue = use{Domain}Store((state) => state.setValue);
  const options = use{Domain}Store((state) => state.options);

  return (
    <div className={`space-y-4 ${className}`}>
      <Slider
        label="Value Label"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={setValue}
        disabled={disabled}
        showValue
      />

      <ToggleGroup
        options={options}
        value={selectedOption}
        onChange={setOption}
        disabled={disabled}
      />
    </div>
  );
};
```

## How to Create a Three.js Renderer

**Template** (`src/components/canvas/{Name}Renderer.tsx`):
```tsx
/**
 * {Name} Renderer Component
 * {Description of what this renders in 3D}
 */

import { useMemo } from 'react';
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import type { Vector3D } from '@/lib/math/types';
import { useVisualStore } from '@/stores/visualStore';

export interface {Name}RendererProps {
  /** 3D vertices to render */
  vertices: Vector3D[];
  /** Edge connections as index pairs */
  edges: [number, number][];
  /** Opacity (0-1) */
  opacity?: number;
}

/**
 * Renders {description}
 *
 * @param props - Renderer props
 * @returns Three.js group with geometry
 */
export function {Name}Renderer({
  vertices,
  edges,
  opacity = 1.0,
}: {Name}RendererProps) {
  // Get visual settings from store
  const color = useVisualStore((state) => state.edgeColor);
  const thickness = useVisualStore((state) => state.edgeThickness);

  // Memoize geometry creation
  const geometry = useMemo(() => {
    if (vertices.length === 0) return null;

    const positions = new Float32Array(
      edges.flatMap(([start, end]) => [
        ...vertices[start],
        ...vertices[end],
      ])
    );

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [vertices, edges]);

  if (!geometry) return null;

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={color}
          linewidth={thickness}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </lineSegments>
    </group>
  );
}
```

## Available UI Components

### Slider
```tsx
<Slider
  label="Label Text"
  min={0}
  max={100}
  step={1}
  value={value}
  onChange={setValue}
  onReset={() => setValue(defaultValue)}
  showValue
  disabled={false}
/>
```

### Button
```tsx
<Button
  variant="primary" // 'primary' | 'secondary' | 'ghost'
  size="md"         // 'sm' | 'md' | 'lg'
  onClick={handler}
  disabled={false}
>
  Button Text
</Button>
```

### ToggleGroup
```tsx
<ToggleGroup
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
  value={selected}
  onChange={setSelected}
/>
```

### Select
```tsx
<Select
  label="Select Label"
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
  value={selected}
  onChange={setSelected}
/>
```

### Section (Collapsible)
```tsx
<Section title="Section Title" defaultOpen={true}>
  <div>Section content</div>
</Section>
```

### Tooltip
```tsx
<Tooltip content="Tooltip text">
  <span>Hover me</span>
</Tooltip>
```

## Tailwind Patterns

### Color Tokens (from tailwind.config.js)
```tsx
// Background
className="bg-app-bg"       // Main app background
className="bg-panel-bg"     // Panel background
className="bg-panel-border" // Border color as background

// Text
className="text-text-primary"   // Main text
className="text-text-secondary" // Subdued text

// Accent colors
className="text-accent-cyan"    // Cyan accent
className="bg-accent-cyan/20"   // Cyan with opacity
```

### Common Patterns
```tsx
// Spacing
className="space-y-4"  // Vertical stack with gap
className="gap-4"      // Flex/grid gap

// Flex layouts
className="flex items-center justify-between"
className="flex flex-col"

// Interactive states
className="hover:bg-panel-border transition-colors"
className="disabled:opacity-50 disabled:cursor-not-allowed"

// Borders
className="border border-panel-border rounded-md"
```

## State Management Pattern

### Connecting Component to Store
```tsx
// GOOD: Individual selectors (prevents unnecessary re-renders)
const dimension = useGeometryStore((state) => state.dimension);
const setDimension = useGeometryStore((state) => state.setDimension);

// BAD: Full store (re-renders on any change)
const { dimension, setDimension } = useGeometryStore();
```

### Syncing Multiple Stores
```tsx
import { useLayoutEffect } from 'react';

function Component() {
  const dimension = useGeometryStore((state) => state.dimension);
  const setRotationDimension = useRotationStore((state) => state.setDimension);

  // Sync before render
  useLayoutEffect(() => {
    setRotationDimension(dimension);
  }, [dimension, setRotationDimension]);
}
```

## Performance Patterns

### Memoize Expensive Computations
```tsx
const transformedData = useMemo(() => {
  return expensiveTransform(data);
}, [data]);
```

### Memoize Callback References
```tsx
const handleChange = useCallback((value: number) => {
  setValue(value);
}, [setValue]);
```

### Avoid Inline Objects in JSX
```tsx
// BAD: Creates new object every render
<Mesh position={{ x: 0, y: 0, z: 0 }} />

// GOOD: Stable reference
const position = useMemo(() => [0, 0, 0] as const, []);
<Mesh position={position} />
```

## Three.js/R3F Patterns

### Basic Scene Structure
```tsx
<Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
  <SceneLighting />
  <PostProcessing />
  <CameraController />
  <PolytopeRenderer vertices={vertices} edges={edges} />
</Canvas>
```

### Accessing Three.js Objects
```tsx
import { useThree } from '@react-three/fiber';

function MyComponent() {
  const { camera, scene, gl } = useThree();
  // Use Three.js objects directly
}
```

### Animation Loop
```tsx
import { useFrame } from '@react-three/fiber';

function AnimatedMesh() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta;
    }
  });

  return <mesh ref={meshRef}>...</mesh>;
}
```

## Adding to Layout

To add a new control section:

```tsx
// In src/components/Layout.tsx
import { NewControls } from './controls/NewControls';

// Inside ControlPanel
<Section title="New Section" defaultOpen={false}>
  <NewControls />
</Section>
```

## Common Mistakes

**Don't**: Create components without TypeScript interfaces
**Do**: Define Props interface for every component

**Don't**: Use inline styles for layout
**Do**: Use Tailwind utility classes

**Don't**: Subscribe to entire store state
**Do**: Use individual state selectors

**Don't**: Create Three.js objects in render function
**Do**: Memoize geometry/material creation with useMemo

**Don't**: Put business logic in components
**Do**: Extract to hooks or lib modules

**Don't**: Skip memoization for expensive Three.js geometry
**Do**: Always useMemo for BufferGeometry, materials, etc.

**Don't**: Use arbitrary color values
**Do**: Use Tailwind color tokens (`accent-cyan`, `text-primary`, etc.)

**Don't**: Create new arrays/objects in JSX props
**Do**: Create stable references with useMemo or outside component

**Don't**: Forget cleanup in useEffect
**Do**: Return cleanup function for subscriptions/timers
