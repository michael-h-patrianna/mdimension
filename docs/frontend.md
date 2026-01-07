# Frontend Guide for LLM Coding Agents

**Purpose**: Instructions for creating React components, Three.js renderers, and UI patterns.

**Read This When**: Creating UI components, 3D renderers, or working with state management.

**Stack**: React 19 + React Three Fiber + Zustand 5 + Tailwind CSS 4 + Motion

## Component Categories

| Category | Location | Purpose |
|----------|----------|---------|
| UI Primitives | `src/components/ui/` | Reusable base components (Button, Slider, etc.) |
| Controls | `src/components/controls/` | Domain-specific control components |
| Canvas | `src/components/canvas/` | Three.js/R3F 3D rendering helpers |
| Layout | `src/components/layout/` | App layout, panels, drawers |
| Sections | `src/components/sections/` | Sidebar sections organized by feature |
| Overlays | `src/components/overlays/` | Modals, dialogs, overlays |
| Presets | `src/components/presets/` | Scene/style preset management |

## Complete UI Component Catalog

### Core Input Components

| Component | Props | Usage |
|-----------|-------|-------|
| `Button` | `variant`, `size`, `disabled`, `onClick` | Primary/secondary/ghost buttons |
| `Slider` | `label`, `min`, `max`, `step`, `value`, `onChange`, `unit`, `formatValue` | Numeric range with label drag |
| `NumberInput` | `value`, `onChange`, `min`, `max`, `step` | Numeric input with validation |
| `Input` | `value`, `onChange`, `placeholder`, `disabled` | Text input |
| `Select` | `options`, `value`, `onChange`, `label` | Dropdown selection |
| `Switch` | `checked`, `onChange`, `label`, `disabled` | Boolean toggle |
| `Knob` | `value`, `onChange`, `min`, `max`, `size` | Rotary control |
| `ColorPicker` | `color`, `onChange`, `label` | Color selection |

### Selection Components

| Component | Props | Usage |
|-----------|-------|-------|
| `ToggleGroup` | `options`, `value`, `onChange` | Exclusive single selection |
| `MultiToggleGroup` | `options`, `value`, `onChange` | Multi-select toggle |
| `Tabs` | `tabs`, `activeTab`, `onChange` | Tabbed content |

### Overlay Components

| Component | Props | Usage |
|-----------|-------|-------|
| `Modal` | `isOpen`, `onClose`, `title`, `children` | Dialog overlay |
| `ConfirmModal` | `isOpen`, `onConfirm`, `onCancel`, `title`, `message` | Confirmation dialog |
| `InputModal` | `isOpen`, `onSubmit`, `onCancel`, `title`, `initialValue` | Text input dialog |
| `Popover` | `trigger`, `content`, `placement` | Click-triggered popover |
| `Tooltip` | `content`, `children`, `placement` | Hover tooltip |
| `DropdownMenu` | `trigger`, `items` | Context/dropdown menu |

### Layout Components

| Component | Props | Usage |
|-----------|-------|-------|
| `ControlGroup` | `label`, `children` | Grouped controls with label |
| `Section` | `title`, `defaultOpen`, `children` | Collapsible section |
| `SpotlightCard` | `children`, `className` | Highlighted card with glow |

### Feedback Components

| Component | Props | Usage |
|-----------|-------|-------|
| `LoadingSpinner` | `size`, `className` | Loading indicator |
| `GlobalProgress` | `progress`, `label` | Progress bar |
| `ErrorBoundary` | `fallback`, `children` | Error catching wrapper |
| `GeometryLoadingIndicator` | - | Geometry computation indicator |

### Utility Components

| Component | Props | Usage |
|-----------|-------|-------|
| `Icon` | `name`, `size`, `className` | SVG icon wrapper |
| `InlineEdit` | `value`, `onChange`, `onCancel` | Inline editable text |
| `Envelope` | `attack`, `decay`, `sustain`, `release`, `onChange` | ADSR envelope editor |
| `WebGPUBadge` | - | WebGPU support indicator |

## How to Create a UI Primitive

**Template** (`src/components/ui/{Name}.tsx`):

```tsx
/**
 * {Name} Component
 * {Brief description}
 */

import React, { useCallback } from 'react';
import { soundManager } from '@/lib/audio/SoundManager';

export interface {Name}Props {
  /** Primary prop description */
  value: string;
  /** Callback description */
  onChange?: (value: string) => void;
  /** Optional styling */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Test ID for Playwright */
  'data-testid'?: string;
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
export const {Name}: React.FC<{Name}Props> = React.memo(({
  value,
  onChange,
  className = '',
  disabled = false,
  'data-testid': dataTestId,
}) => {
  const handleChange = useCallback((newValue: string) => {
    if (disabled) return;
    soundManager.playClick();
    onChange?.(newValue);
  }, [disabled, onChange]);

  return (
    <div 
      data-testid={dataTestId} 
      className={`glass-panel ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Implementation */}
    </div>
  );
});

{Name}.displayName = '{Name}';
```

**Steps**:
1. Create file at `src/components/ui/{Name}.tsx`
2. Define Props interface with JSDoc comments
3. Use Tailwind utilities from the theme
4. Include `data-testid` prop for testing
5. Use `React.memo` for performance
6. Set `displayName` for DevTools
7. Export from `src/components/ui/index.ts`
8. Create test in `src/tests/components/ui/{Name}.test.tsx`

## How to Create a Section Component

**Template** (`src/components/sections/{Feature}/{Feature}Section.tsx`):

```tsx
/**
 * {Feature} Section Component
 * Controls for {feature description}
 */

import React from 'react';
import { Section } from '@/components/sections/Section';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { use{Domain}Store } from '@/stores/{domain}Store';

export interface {Feature}SectionProps {
  defaultOpen?: boolean;
}

export const {Feature}Section: React.FC<{Feature}SectionProps> = ({
  defaultOpen = false,
}) => {
  // Use individual selectors for performance
  const value = use{Domain}Store((state) => state.value);
  const setValue = use{Domain}Store((state) => state.setValue);
  const options = use{Domain}Store((state) => state.options);
  const selectedOption = use{Domain}Store((state) => state.selectedOption);
  const setOption = use{Domain}Store((state) => state.setOption);

  return (
    <Section title="{Feature}" defaultOpen={defaultOpen}>
      <div className="space-y-4">
        <Slider
          label="Value Label"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={setValue}
          showValue
          data-testid="{feature}-value-slider"
        />

        <ToggleGroup
          options={options}
          value={selectedOption}
          onChange={setOption}
          data-testid="{feature}-option-toggle"
        />
      </div>
    </Section>
  );
};
```

## How to Create a Three.js Renderer

**Template** (`src/rendering/renderers/{Name}/{Name}Mesh.tsx`):

```tsx
/**
 * {Name} Renderer Component
 * {Description of what this renders in 3D}
 */

import { useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Mesh, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities';
import { useAppearanceStore } from '@/stores/appearanceStore';

export interface {Name}MeshProps {
  /** 3D vertices to render */
  vertices: Float32Array;
  /** Opacity (0-1) */
  opacity?: number;
}

/**
 * Renders {description}
 *
 * @param props - Renderer props
 * @returns Three.js mesh with geometry
 */
export function {Name}Mesh({
  vertices,
  opacity = 1.0,
}: {Name}MeshProps) {
  const meshRef = useRef<Mesh>(null);
  
  // Get visual settings from store
  const color = useAppearanceStore((state) => state.color);

  // Memoize geometry creation
  const geometry = useMemo(() => {
    if (vertices.length === 0) return null;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, [vertices]);

  // Memoize material creation
  const material = useMemo(() => {
    return new ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */`
        in vec3 position;
        in vec3 normal;
        out vec3 vNormal;
        
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat3 normalMatrix;
        
        void main() {
          vNormal = normalMatrix * normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        in vec3 vNormal;
        layout(location = 0) out vec4 fragColor;
        
        uniform vec3 uColor;
        uniform float uOpacity;
        
        void main() {
          vec3 normal = normalize(vNormal);
          float lighting = dot(normal, normalize(vec3(1.0, 1.0, 1.0))) * 0.5 + 0.5;
          fragColor = vec4(uColor * lighting, uOpacity);
        }
      `,
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: opacity },
      },
      transparent: opacity < 1,
    });
  }, [color, opacity]);

  // Update uniforms each frame
  useFrame(() => {
    if (meshRef.current && material) {
      material.uniforms.uOpacity.value = opacity;
    }
  }, FRAME_PRIORITY.RENDER);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
}
```

## Tailwind CSS 4 Theme System

This project uses Tailwind CSS 4 with the Vite plugin. Theme tokens are defined in `src/index.css`.

### Theme Variables

```css
/* Available via @theme in src/index.css */

/* Backgrounds */
--color-background    /* Main app background */
--color-panel         /* Panel background */
--color-surface       /* Surface background */
--color-elevated      /* Elevated elements */
--color-glass         /* Glass effect background */
--color-overlay       /* Overlay backdrop */

/* Text */
--color-text-primary    /* Main text */
--color-text-secondary  /* Subdued text */
--color-text-tertiary   /* Muted text */
--color-text-muted      /* Very muted text */
--color-text-inverse    /* Inverse text */

/* Accent */
--color-accent          /* Theme accent color */
--color-accent-glow     /* Accent glow effect */
--color-accent-subtle   /* Subtle accent */
--color-accent-muted    /* Muted accent */

/* Status Colors */
--color-danger          /* Error text */
--color-danger-bg       /* Error background */
--color-success         /* Success text */
--color-success-bg      /* Success background */
--color-warning         /* Warning text */
--color-warning-bg      /* Warning background */

/* Borders */
--color-border-subtle   /* Subtle borders */
--color-border-default  /* Default borders */
--color-border-strong   /* Strong borders */
```

### Premium Glass Utilities

```css
/* Glass panels */
.glass-panel         /* Standard glass panel with blur */
.glass-panel-dark    /* Darker glass panel */

/* Glass inputs */
.glass-input         /* Input with glass effect and focus states */

/* Glass buttons */
.glass-button        /* Secondary button with glass effect */
.glass-button-primary /* Primary accent button */

/* Effects */
.glass-separator     /* Gradient separator line */
.text-glow           /* Text glow effect */
.text-glow-subtle    /* Subtle text glow */
.border-glow         /* Border glow effect */
.led-glow            /* LED indicator glow */
.shimmer-text        /* Animated shimmer text */
.hover-card          /* Hover lift effect */

/* Status badges */
.status-danger       /* Danger badge */
.status-success      /* Success badge */
.status-warning      /* Warning badge */

/* Health indicators (performance monitor) */
.health-high         /* Good performance */
.health-medium       /* Medium performance */
.health-low          /* Poor performance */

/* Accent glows */
.glow-accent-sm      /* Small accent glow */
.glow-accent-md      /* Medium accent glow */
.glow-accent-lg      /* Large accent glow */

/* Overlay */
.overlay-backdrop    /* Modal backdrop with blur */

/* Scrollbar */
.scrollbar-none      /* Hide scrollbar */
```

### Usage Examples

```tsx
// Panel with glass effect
<div className="glass-panel rounded-lg p-4">
  Content
</div>

// Primary button
<button className="glass-button-primary px-4 py-2 rounded-md">
  Submit
</button>

// Input with focus states
<input className="glass-input rounded-md px-3 py-2" />

// Status badge
<span className="status-success px-2 py-1 rounded text-xs">
  Success
</span>

// Accent text with glow
<h1 className="text-accent text-glow">
  Title
</h1>
```

## State Management Pattern

### Connecting Component to Store (CRITICAL)

```tsx
// ✅ GOOD: Individual selectors (prevents unnecessary re-renders)
const dimension = useGeometryStore((state) => state.dimension);
const setDimension = useGeometryStore((state) => state.setDimension);

// ❌ BAD: Full store (re-renders on any change)
const { dimension, setDimension } = useGeometryStore();
```

### useShallow Pattern (React 19 + Zustand 5)

```tsx
import { useShallow } from 'zustand/react/shallow';
import { useGeometryStore } from '@/stores/geometryStore';

// Create selector OUTSIDE component or at top level
const geometrySelector = useShallow((state: ReturnType<typeof useGeometryStore.getState>) => ({
  dimension: state.dimension,
  objectType: state.objectType,
  setDimension: state.setDimension,
}));

export function Component() {
  // Use the pre-created selector
  const { dimension, objectType, setDimension } = useGeometryStore(geometrySelector);
  // ...
}
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

### Reading State in Animation Callbacks

```tsx
import { useFrame } from '@react-three/fiber';
import { useCallback } from 'react';

function AnimatedComponent() {
  const animationCallback = useCallback((state, delta) => {
    // Read via getState() for fresh values without closure issues
    const { speed } = useAnimationStore.getState();
    const { rotations } = useRotationStore.getState();
    
    // ... animation logic
  }, []); // Empty deps - all state read via getState()

  useFrame(animationCallback, FRAME_PRIORITY.ANIMATION);
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
  React.startTransition(() => {
    setValue(value);
  });
}, [setValue]);
```

### React.startTransition for Non-Urgent Updates

```tsx
// For slider/drag updates that can be deferred
const handleSliderChange = useCallback((value: number) => {
  React.startTransition(() => {
    store.setValue(value);
  });
}, []);
```

### Avoid Inline Objects in JSX

```tsx
// ❌ BAD: Creates new object every render
<mesh position={{ x: 0, y: 0, z: 0 }} />

// ✅ GOOD: Stable reference
const position = useMemo(() => [0, 0, 0] as const, []);
<mesh position={position} />
```

### Component Memoization

```tsx
// Wrap with React.memo for pure components
export const ExpensiveComponent = React.memo(({ data }: Props) => {
  // ...
});

ExpensiveComponent.displayName = 'ExpensiveComponent';
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

### Animation Loop with Priorities

```tsx
import { useFrame } from '@react-three/fiber';
import { FRAME_PRIORITY } from '@/rendering/core/framePriorities';

function AnimatedMesh() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta;
    }
  }, FRAME_PRIORITY.ANIMATION);

  return <mesh ref={meshRef}>...</mesh>;
}
```

### Cleanup GPU Resources

```tsx
import { useEffect, useRef } from 'react';
import { BufferGeometry, Material } from 'three';

function MyComponent() {
  const geometryRef = useRef<BufferGeometry | null>(null);
  const materialRef = useRef<Material | null>(null);

  useEffect(() => {
    return () => {
      // Clean up on unmount
      geometryRef.current?.dispose();
      materialRef.current?.dispose();
    };
  }, []);
}
```

## Animation with Motion

```tsx
import { m, AnimatePresence } from 'motion/react';

// Fade in/out
<AnimatePresence>
  {isVisible && (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      Content
    </m.div>
  )}
</AnimatePresence>

// Scale animation
<m.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</m.button>
```

## Adding data-testid for E2E Testing

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

<Slider
  data-testid="rotation-speed-slider"
  value={speed}
  onChange={setSpeed}
/>
```

## Sound Feedback

Use `soundManager` for UI sound feedback:

```tsx
import { soundManager } from '@/lib/audio/SoundManager';

// On click
soundManager.playClick();

// On hover
soundManager.playHover();

// In event handlers
const handleMouseEnter = useCallback(() => {
  soundManager.playHover();
}, []);
```

## Common Mistakes

❌ **Don't**: Create components without TypeScript interfaces
✅ **Do**: Define Props interface for every component

❌ **Don't**: Use inline styles for layout
✅ **Do**: Use Tailwind utility classes

❌ **Don't**: Subscribe to entire store state
✅ **Do**: Use individual state selectors

❌ **Don't**: Create Three.js objects in render function
✅ **Do**: Memoize geometry/material creation with useMemo

❌ **Don't**: Put business logic in components
✅ **Do**: Extract to hooks or lib modules

❌ **Don't**: Skip memoization for expensive Three.js geometry
✅ **Do**: Always useMemo for BufferGeometry, materials, etc.

❌ **Don't**: Use arbitrary color values
✅ **Do**: Use Tailwind color tokens (`accent`, `text-primary`, etc.)

❌ **Don't**: Create new arrays/objects in JSX props
✅ **Do**: Create stable references with useMemo or outside component

❌ **Don't**: Forget cleanup in useEffect
✅ **Do**: Return cleanup function for subscriptions/timers

❌ **Don't**: Call useShallow inside another hook call
✅ **Do**: Create selector with useShallow first, then pass to store hook

❌ **Don't**: Forget data-testid on interactive elements
✅ **Do**: Add data-testid for Playwright testing

❌ **Don't**: Use raw HTML form elements
✅ **Do**: Use `src/components/ui/*` primitives
