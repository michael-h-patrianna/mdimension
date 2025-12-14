# Frontend Guide for LLM Coding Agents

**Purpose**: Instructions for creating React components, Three.js renderers, and UI patterns.

**Read This When**: Creating UI components, 3D renderers, or working with state management.

**Stack**: React 19 + React Three Fiber + Zustand + Tailwind CSS 4

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

---

## How to Add data-testid for E2E Testing

Always add `data-testid` to interactive elements:

```tsx
<button
  data-testid="dimension-selector-4"
  onClick={() => setDimension(4)}
>
  4D
</button>

<select
  data-testid="object-type-selector"
  value={objectType}
  onChange={(e) => setObjectType(e.target.value)}
>
  ...
</select>
```

---

## Sidebar Section Template

**Location**: `src/components/sidebar/{Name}/`

**File structure**:
```
src/components/sidebar/{Name}/
├── index.ts           # Export section
└── {Name}Section.tsx  # Section component
```

**Template** (`{Name}Section.tsx`):
```tsx
/**
 * {Name} Section Component
 */

import React from 'react';
import { Section } from '@/components/ui/Section';
import { Slider } from '@/components/ui/Slider';
import { use{Domain}Store } from '@/stores/{domain}Store';

export interface {Name}SectionProps {
  defaultOpen?: boolean;
}

export const {Name}Section: React.FC<{Name}SectionProps> = ({
  defaultOpen = false,
}) => {
  // Use individual selectors
  const value = use{Domain}Store((state) => state.value);
  const setValue = use{Domain}Store((state) => state.setValue);

  return (
    <Section title="{Name}" defaultOpen={defaultOpen}>
      <div className="space-y-4">
        <Slider
          label="Value"
          min={0}
          max={100}
          value={value}
          onChange={setValue}
        />
      </div>
    </Section>
  );
};
```

**Template** (`index.ts`):
```typescript
export { {Name}Section } from './{Name}Section';
```

---

## Hook Decision Tree

| Need to... | Create hook in... | Pattern |
|------------|-------------------|---------|
| Connect store to component | `src/hooks/use{Name}.ts` | Return store values + memoized callbacks |
| Animate in Three.js | `src/hooks/use{Name}.ts` | Use `useFrame` from R3F |
| Transform geometry | `src/hooks/use{Name}.ts` | Memoize with useMemo based on inputs |
| Handle keyboard input | `src/hooks/use{Name}.ts` | Use useEffect with event listeners |
| Sync multiple stores | `src/hooks/useSynced{Name}.ts` | Use useLayoutEffect |

---

## Tailwind CSS 4 Notes

This project uses Tailwind CSS 4 with the Vite plugin. Key differences:

1. **No tailwind.config.js** - Configuration in CSS
2. **CSS variables for theming** - `--color-accent`, `--color-panel-bg`, etc.
3. **`@theme` directive** - Define design tokens in CSS

```css
/* Theme variables available */
var(--color-accent)
var(--color-panel-bg)
var(--color-panel-border)
var(--color-text-primary)
var(--color-text-secondary)
```

---

## More Common Mistakes

❌ **Don't**: Create new components without Props interface
✅ **Do**: Always define and export `{Name}Props` interface

❌ **Don't**: Use `any` type
✅ **Do**: Define proper TypeScript types

❌ **Don't**: Forget to export from index files
✅ **Do**: Add exports to `src/components/ui/index.ts` or similar

❌ **Don't**: Create components without tests
✅ **Do**: Create test file in `src/tests/components/`

❌ **Don't**: Mix HTML and Three.js elements
✅ **Do**: Keep DOM components and Canvas components separate

❌ **Don't**: Import Three.js in non-canvas components
✅ **Do**: Only use Three.js in `src/components/canvas/` and `src/lib/`
