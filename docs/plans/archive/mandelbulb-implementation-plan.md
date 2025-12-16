# N-Dimensional Mandelbulb Set Implementation Plan

**PRD**: `docs/prd/ndimensional-mandelbulb.md`
**Math Guide**: `docs/research/nd-mandelbulb-threejs-guide.md`
**14 User Stories | 108 Acceptance Criteria | 56 Test Scenarios**

---

## Executive Summary

This plan implements n-dimensional Mandelbulb set visualization (3D-11D) as a new object type in the existing visualizer. The implementation leverages the existing rendering pipeline, shader system, and visual settings wherever possible, only adding Mandelbulb-specific features where necessary.

---

## Integration with Existing Systems

### Reusing Existing Features

| Feature | Existing System | Mandelbulb Usage |
|---------|----------------|------------------|
| Point Cloud Rendering | `PointCloudRenderer.tsx` | Primary render mode |
| Shaders | `visualStore.shaderType` | Wireframe, Neon Glow, Dual Outline |
| Bloom | `visualStore.bloomEnabled` | Post-processing for all modes |
| Vertex Controls | `visualStore.vertexSize/Color` | Point size and base color |
| Depth Attenuation | `visualStore.depthAttenuation` | Depth-based opacity |
| Object Type Selector | `ObjectTypeSelector.tsx` | Add "Mandelbulb Set" option |
| Dimension Selector | `DimensionSelector.tsx` | Reuse for 3-11D selection |
| URL State | `state-serializer.ts` | Persist Mandelbulb config |

### New Features Required

| Feature | Reason |
|---------|--------|
| Visualization Axes Selection | Choose which 3 of N dims to display |
| Parameter Dimension Sliders | Control non-visualized dimensions |
| Escape-Time Color Mapping | Color based on iteration count |
| Zoom/Pan (Extent) Controls | Navigate within Mandelbulb space |
| Isosurface Rendering | Marching cubes for solid surface |
| Interesting Locations | Pre-defined coordinate bookmarks |
| Parameter Animation | Animate through higher dimensions |
| User Bookmarks | Save/load configurations |

---

## Architecture Overview

```
src/
├── lib/geometry/extended/
│   ├── mandelbulb.ts           # Core generator + iteration algorithm
│   ├── mandelbulb-locations.ts # Predefined interesting coordinates
│   ├── mandelbulb-colors.ts    # Color palettes + escape-time mapping
│   ├── marching-cubes.ts       # Isosurface mesh generation
│   └── mandelbulb-worker.ts    # Web Worker for background computation
│
├── stores/
│   ├── mandelbulbStore.ts      # Main Mandelbulb state
│   └── mandelbulbBookmarkStore.ts # User bookmarks (localStorage)
│
├── components/controls/
│   ├── MandelbulbControls.tsx       # Main settings panel
│   ├── MandelbulbAxisSelector.tsx   # Visualization axes
│   ├── MandelbulbParameterSliders.tsx # Non-viz dimension controls
│   ├── MandelbulbColorControls.tsx  # Color mapping settings
│   ├── MandelbulbLocations.tsx      # Interesting locations dropdown
│   ├── MandelbulbAnimationControls.tsx # Parameter animation
│   ├── MandelbulbBookmarks.tsx      # Save/load bookmarks
│   └── MandelbulbProperties.tsx     # Info panel
│
└── components/canvas/
    └── MandelbulbIsosurfaceRenderer.tsx # Marching cubes mesh renderer
```

---

## Sprint 1: Core Foundation

**Stories Covered**: 1, 2, 3 (partial)
**Goal**: Basic Mandelbulb point cloud rendering with iteration controls

### 1.1 Type System Updates

**File**: `src/lib/geometry/types.ts`
```typescript
// Add to ExtendedObjectType union
export type ExtendedObjectType =
  | 'hypersphere'
  | 'root-system'
  | 'clifford-torus'
  | 'mandelbulb';  // NEW

// Update type guard
export function isExtendedObjectType(type: string): type is ExtendedObjectType {
  return ['hypersphere', 'root-system', 'clifford-torus', 'mandelbulb'].includes(type);
}
```

**File**: `src/lib/geometry/extended/types.ts`
```typescript
export interface MandelbulbConfig {
  // Iteration parameters (Story 2)
  maxIterations: number;      // 10-500, default 80
  escapeRadius: number;       // 2.0-10.0, default 4.0
  qualityPreset: 'draft' | 'standard' | 'high' | 'ultra';

  // Sampling resolution (Story 3)
  resolution: number;         // Samples per axis: 16,24,32,48,64,96,128

  // Visualization axes (Story 4)
  visualizationAxes: [number, number, number]; // Which dims map to X,Y,Z

  // Parameter values for non-visualized dims (Story 5)
  parameterValues: number[];  // Length = dimension - 3

  // Navigation (Story 7)
  center: number[];           // N-dimensional center coords
  extent: number;             // Zoom level (0.001 to 10.0)

  // Color mapping (Story 8)
  colorMode: 'escapeTime' | 'smoothColoring' | 'distanceEstimation' | 'interiorOnly';
  palette: 'classic' | 'fire' | 'ocean' | 'rainbow' | 'monochrome' | 'custom';
  customPalette: { start: string; mid: string; end: string };
  invertColors: boolean;
  interiorColor: string;
  paletteCycles: number;      // 1-20

  // Rendering style (Story 9)
  renderStyle: 'pointCloud' | 'isosurface' | 'volume';
  pointSize: number;          // For point cloud
  isosurfaceThreshold: number; // For isosurface (0.0-1.0)
}

export const DEFAULT_MANDELBROT_CONFIG: MandelbulbConfig = {
  maxIterations: 80,
  escapeRadius: 4.0,
  qualityPreset: 'standard',
  resolution: 32,
  visualizationAxes: [0, 1, 2],
  parameterValues: [],
  center: [],
  extent: 2.5,
  colorMode: 'escapeTime',
  palette: 'classic',
  customPalette: { start: '#0000ff', mid: '#ffffff', end: '#ff8000' },
  invertColors: false,
  interiorColor: '#000000',
  paletteCycles: 1,
  renderStyle: 'pointCloud',
  pointSize: 3,
  isosurfaceThreshold: 0.5,
};
```

### 1.2 Core Algorithm

**File**: `src/lib/geometry/extended/mandelbulb.ts`
```typescript
import type { NdGeometry, VectorND } from '../types';
import type { MandelbulbConfig } from './types';

/**
 * N-dimensional Mandelbulb-like iteration step
 * Uses complex square on first 2 coords, coupled quadratics on rest
 */
export function mandelbulbStep(z: VectorND, c: VectorND): VectorND {
  const d = z.length;
  const out = new Array(d).fill(0);

  // Complex square for first two coordinates (Re, Im)
  const zx = z[0] ?? 0;
  const zy = z[1] ?? 0;
  const cx = c[0] ?? 0;
  const cy = c[1] ?? 0;

  out[0] = zx * zx - zy * zy + cx;
  out[1] = 2 * zx * zy + cy;

  // Coupled quadratics for higher dimensions
  for (let i = 2; i < d; i++) {
    const zi = z[i] ?? 0;
    const ci = c[i] ?? 0;
    const coupling = zx * zi - zy * ci; // Cross-interaction
    out[i] = zi * zi - ci * ci + ci + 0.1 * coupling;
  }

  return out;
}

/**
 * Compute escape time for point c
 * Returns iteration count (0 to maxIter), or -1 if bounded (inside set)
 */
export function mandelbulbEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number
): number {
  let z = new Array(c.length).fill(0);
  const R2 = escapeRadius * escapeRadius;

  for (let iter = 0; iter < maxIter; iter++) {
    const norm2 = z.reduce((sum, val) => sum + val * val, 0);
    if (norm2 > R2) {
      return iter; // Escaped
    }
    z = mandelbulbStep(z, c);
  }

  return -1; // Bounded (inside set)
}

/**
 * Smooth escape time for gradient coloring (no banding)
 */
export function mandelbulbSmoothEscapeTime(
  c: VectorND,
  maxIter: number,
  escapeRadius: number
): number {
  let z = new Array(c.length).fill(0);
  const R2 = escapeRadius * escapeRadius;

  for (let iter = 0; iter < maxIter; iter++) {
    const norm2 = z.reduce((sum, val) => sum + val * val, 0);
    if (norm2 > R2) {
      // Smooth coloring formula
      const log_zn = Math.log(norm2) / 2;
      const nu = Math.log(log_zn / Math.log(escapeRadius)) / Math.log(2);
      return iter + 1 - nu;
    }
    z = mandelbulbStep(z, c);
  }

  return -1;
}

/**
 * Generate 3D sample grid within extent bounds
 */
function generateSampleGrid(
  dimension: number,
  config: MandelbulbConfig
): { worldPos: [number, number, number]; cVector: VectorND }[] {
  const { resolution, visualizationAxes, parameterValues, center, extent } = config;
  const [ax, ay, az] = visualizationAxes;
  const samples: { worldPos: [number, number, number]; cVector: VectorND }[] = [];

  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      for (let iz = 0; iz < resolution; iz++) {
        // Map grid indices to world coordinates
        const tx = ix / (resolution - 1);
        const ty = iy / (resolution - 1);
        const tz = iz / (resolution - 1);

        const x = (center[ax] ?? 0) - extent + 2 * extent * tx;
        const y = (center[ay] ?? 0) - extent + 2 * extent * ty;
        const z = (center[az] ?? 0) - extent + 2 * extent * tz;

        // Build N-dimensional c vector
        const cVector: VectorND = new Array(dimension).fill(0);
        cVector[ax] = x;
        cVector[ay] = y;
        cVector[az] = z;

        // Fill non-visualized dimensions with parameter values
        let paramIdx = 0;
        for (let d = 0; d < dimension; d++) {
          if (d !== ax && d !== ay && d !== az) {
            cVector[d] = parameterValues[paramIdx] ?? 0;
            paramIdx++;
          }
        }

        samples.push({ worldPos: [x, y, z], cVector });
      }
    }
  }

  return samples;
}

/**
 * Main generator function - returns point cloud geometry
 */
export function generateMandelbulb(
  dimension: number,
  config: MandelbulbConfig
): NdGeometry {
  const samples = generateSampleGrid(dimension, config);
  const vertices: VectorND[] = [];
  const escapeValues: number[] = [];

  const { maxIterations, escapeRadius, colorMode } = config;
  const useSmooth = colorMode === 'smoothColoring';

  for (const { worldPos, cVector } of samples) {
    const escapeTime = useSmooth
      ? mandelbulbSmoothEscapeTime(cVector, maxIterations, escapeRadius)
      : mandelbulbEscapeTime(cVector, maxIterations, escapeRadius);

    // For point cloud, include points near/in the set
    // (escapeTime === -1 means inside, high values mean near boundary)
    if (escapeTime === -1 || escapeTime > maxIterations * 0.1) {
      // Store as N-dimensional vertex (pad with param values for full dimensionality)
      vertices.push(cVector);
      escapeValues.push(escapeTime);
    }
  }

  return {
    dimension,
    type: 'mandelbulb',
    vertices,
    edges: [], // Point cloud - no edges by default
    faces: [],
    isPointCloud: true,
    metadata: {
      name: `${dimension}D Mandelbulb Set`,
      formula: 'z_{n+1} = f(z_n, c), |z| bounded',
      escapeValues, // Store for color mapping
      properties: {
        maxIterations,
        escapeRadius,
        resolution: config.resolution,
        sampleCount: vertices.length,
      },
    },
  };
}
```

### 1.3 Store Implementation

**File**: `src/stores/mandelbulbStore.ts`
```typescript
import { create } from 'zustand';
import { DEFAULT_MANDELBROT_CONFIG, type MandelbulbConfig } from '@/lib/geometry/extended/types';

interface MandelbulbState extends MandelbulbConfig {
  // Actions - Iteration
  setMaxIterations: (value: number) => void;
  setEscapeRadius: (value: number) => void;
  setQualityPreset: (preset: MandelbulbConfig['qualityPreset']) => void;

  // Actions - Resolution
  setResolution: (value: number) => void;

  // Actions - Axes
  setVisualizationAxes: (axes: [number, number, number]) => void;
  setVisualizationAxis: (index: 0 | 1 | 2, dimIndex: number) => void;

  // Actions - Parameters
  setParameterValue: (dimIndex: number, value: number) => void;
  setParameterValues: (values: number[]) => void;
  resetParameters: () => void;

  // Actions - Navigation
  setCenter: (center: number[]) => void;
  setExtent: (extent: number) => void;
  fitToView: () => void;

  // Actions - Color
  setColorMode: (mode: MandelbulbConfig['colorMode']) => void;
  setPalette: (palette: MandelbulbConfig['palette']) => void;
  setCustomPalette: (palette: MandelbulbConfig['customPalette']) => void;
  setInvertColors: (invert: boolean) => void;
  setInteriorColor: (color: string) => void;
  setPaletteCycles: (cycles: number) => void;

  // Actions - Rendering
  setRenderStyle: (style: MandelbulbConfig['renderStyle']) => void;
  setPointSize: (size: number) => void;
  setIsosurfaceThreshold: (threshold: number) => void;

  // Initialize for dimension
  initializeForDimension: (dimension: number) => void;

  // Get current config
  getConfig: () => MandelbulbConfig;
}

const QUALITY_PRESETS = {
  draft: { maxIterations: 30, resolution: 24 },
  standard: { maxIterations: 80, resolution: 32 },
  high: { maxIterations: 200, resolution: 64 },
  ultra: { maxIterations: 500, resolution: 96 },
};

export const useMandelbulbStore = create<MandelbulbState>((set, get) => ({
  ...DEFAULT_MANDELBROT_CONFIG,

  setMaxIterations: (value) => set({ maxIterations: value }),
  setEscapeRadius: (value) => set({ escapeRadius: value }),

  setQualityPreset: (preset) => {
    const settings = QUALITY_PRESETS[preset];
    set({
      qualityPreset: preset,
      maxIterations: settings.maxIterations,
      resolution: settings.resolution,
    });
  },

  setResolution: (value) => set({ resolution: value }),

  setVisualizationAxes: (axes) => set({ visualizationAxes: axes }),

  setVisualizationAxis: (index, dimIndex) => {
    const current = [...get().visualizationAxes] as [number, number, number];
    current[index] = dimIndex;
    set({ visualizationAxes: current });
  },

  setParameterValue: (dimIndex, value) => {
    const values = [...get().parameterValues];
    values[dimIndex] = value;
    set({ parameterValues: values });
  },

  setParameterValues: (values) => set({ parameterValues: values }),

  resetParameters: () => {
    const len = get().parameterValues.length;
    set({ parameterValues: new Array(len).fill(0) });
  },

  setCenter: (center) => set({ center }),
  setExtent: (extent) => set({ extent }),

  fitToView: () => set({
    center: new Array(get().center.length).fill(0),
    extent: 2.5,
  }),

  setColorMode: (mode) => set({ colorMode: mode }),
  setPalette: (palette) => set({ palette }),
  setCustomPalette: (palette) => set({ customPalette: palette }),
  setInvertColors: (invert) => set({ invertColors: invert }),
  setInteriorColor: (color) => set({ interiorColor: color }),
  setPaletteCycles: (cycles) => set({ paletteCycles: cycles }),

  setRenderStyle: (style) => set({ renderStyle: style }),
  setPointSize: (size) => set({ pointSize: size }),
  setIsosurfaceThreshold: (threshold) => set({ isosurfaceThreshold: threshold }),

  initializeForDimension: (dimension) => {
    const paramCount = Math.max(0, dimension - 3);
    set({
      parameterValues: new Array(paramCount).fill(0),
      center: new Array(dimension).fill(0),
      visualizationAxes: [0, 1, 2],
    });
  },

  getConfig: () => {
    const state = get();
    return {
      maxIterations: state.maxIterations,
      escapeRadius: state.escapeRadius,
      qualityPreset: state.qualityPreset,
      resolution: state.resolution,
      visualizationAxes: state.visualizationAxes,
      parameterValues: state.parameterValues,
      center: state.center,
      extent: state.extent,
      colorMode: state.colorMode,
      palette: state.palette,
      customPalette: state.customPalette,
      invertColors: state.invertColors,
      interiorColor: state.interiorColor,
      paletteCycles: state.paletteCycles,
      renderStyle: state.renderStyle,
      pointSize: state.pointSize,
      isosurfaceThreshold: state.isosurfaceThreshold,
    };
  },
}));
```

### 1.4 Integration Points

**File**: `src/lib/geometry/extended/index.ts`
```typescript
// Add export
export { generateMandelbulb, mandelbulbStep, mandelbulbEscapeTime } from './mandelbulb';

// Add to generateExtendedObject switch:
case 'mandelbulb':
  return generateMandelbulb(dimension, params.mandelbulb);
```

**File**: `src/lib/geometry/index.ts`
```typescript
// Add to getAvailableTypes():
{
  type: 'mandelbulb',
  name: 'Mandelbulb Set',
  description: 'N-dimensional fractal via escape-time iteration',
  minDimension: 3,
  maxDimension: 11,
}
```

**File**: `src/lib/url/state-serializer.ts`
```typescript
// Add 'mandelbulb' to VALID_OBJECT_TYPES array
```

### 1.5 Basic UI

**File**: `src/components/controls/MandelbulbControls.tsx`
```typescript
// Basic controls for Sprint 1:
// - Quality preset dropdown
// - Max Iterations slider
// - Escape Radius slider
// - Resolution preset buttons
// - Sample count display
```

### 1.6 Tests

**File**: `src/tests/lib/geometry/extended/mandelbulb.test.ts`
- Test `mandelbulbStep()` for known inputs
- Test `mandelbulbEscapeTime()` for points inside/outside set
- Test `generateMandelbulb()` returns valid geometry
- Test different dimensions (3D, 4D, 7D, 11D)
- Test resolution affects sample count

---

## Sprint 2: Navigation System

**Stories Covered**: 4, 5, 7
**Goal**: Full navigation through n-dimensional Mandelbulb space

### 2.1 Axis Selector

**File**: `src/components/controls/MandelbulbAxisSelector.tsx`
- Three dropdowns for X, Y, Z axis selection
- Options: "Dim 0 (Re)", "Dim 1 (Im)", "Dim 2", ... "Dim N-1"
- Prevent duplicate selection
- Update mandelbulbStore.visualizationAxes

### 2.2 Parameter Sliders

**File**: `src/components/controls/MandelbulbParameterSliders.tsx`
- Dynamic slider for each non-visualized dimension
- Range: -2.0 to +2.0
- Double-click to reset to 0.0
- "Reset All Parameters" button
- Collapsible section

### 2.3 Zoom/Pan Controls

**File**: `src/components/controls/MandelbulbNavigationControls.tsx`
- Center coordinate inputs (X, Y, Z)
- Extent (zoom) slider/input
- "Fit to View" button
- Auto-iteration boost at deep zoom

### 2.4 Scene Integration

**Modify**: `src/components/canvas/Scene.tsx`
- Mouse scroll zoom for Mandelbulb (when object type is mandelbulb)
- Click-drag pan for Mandelbulb
- Update mandelbulbStore.center and extent

---

## Sprint 3: Visual Polish

**Stories Covered**: 8, 9, 12
**Goal**: Rich color mapping and rendering styles

### 3.1 Color System

**File**: `src/lib/geometry/extended/mandelbulb-colors.ts`
```typescript
export const PALETTES = {
  classic: ['#0000ff', '#ffffff', '#ff8000'],
  fire: ['#000000', '#ff0000', '#ffff00'],
  ocean: ['#000033', '#0088ff', '#ffffff'],
  rainbow: null, // Use HSL cycle
  monochrome: ['#000000', '#888888', '#ffffff'],
};

export function escapeTimeToColor(
  escapeTime: number,
  maxIter: number,
  palette: string[],
  cycles: number,
  invert: boolean
): string { /* ... */ }
```

### 3.2 Color Controls UI

**File**: `src/components/controls/MandelbulbColorControls.tsx`
- Color mode dropdown
- Palette selector with preview swatches
- Custom palette color pickers
- Invert toggle
- Interior color picker
- Palette cycles slider

### 3.3 Isosurface Renderer

**File**: `src/lib/geometry/extended/marching-cubes.ts`
- Marching cubes algorithm for 3D scalar field
- Generate triangulated mesh from escape values
- Threshold parameter for surface level

**File**: `src/components/canvas/MandelbulbIsosurfaceRenderer.tsx`
- Three.js mesh rendering
- Surface shader integration
- Lighting response

### 3.4 Shader Integration

**Modify**: `src/components/canvas/PointCloudRenderer.tsx`
- Accept vertex colors array from escape values
- Apply palette-based coloring

---

## Sprint 4: User Experience

**Stories Covered**: 6, 10, 11, 13
**Goal**: Exploration and persistence features

### 4.1 Interesting Locations

**File**: `src/lib/geometry/extended/mandelbulb-locations.ts`
```typescript
export const LOCATIONS = {
  classic2D: [
    { name: 'Main Cardioid Center', coords: [0, 0, 0, ...], extent: 2.5 },
    { name: 'Period-2 Bulb', coords: [-1, 0, 0, ...], extent: 1.0 },
    { name: 'Seahorse Valley', coords: [-0.75, 0.1, 0, ...], extent: 0.3 },
    // ...
  ],
  bulbs3D: [ /* ... */ ],
  spirals4D: [ /* ... */ ],
  deepZooms: [ /* ... */ ],
};
```

**File**: `src/components/controls/MandelbulbLocations.tsx`
- Dropdown organized by category
- "Randomize" button
- Animated transitions

### 4.2 Parameter Animation

**File**: `src/components/controls/MandelbulbAnimationControls.tsx`
- Play/pause per parameter
- "Animate All" with phase offsets
- Speed control
- Direction (bounce/loop)

### 4.3 Bookmarks

**File**: `src/stores/mandelbulbBookmarkStore.ts`
- Save/load full configuration
- LocalStorage persistence
- Max 50 bookmarks
- Import/export JSON

**File**: `src/components/controls/MandelbulbBookmarks.tsx`
- Save with name
- Load from list
- Delete individual
- Export/Import buttons

### 4.4 Properties Panel

**File**: `src/components/controls/MandelbulbProperties.tsx`
- Current configuration display
- Formula section
- Render time stats
- Educational links

---

## Sprint 5: Performance Optimization

**Stories Covered**: 14
**Goal**: Smooth interaction even at high resolutions

### 5.1 Web Worker

**File**: `src/lib/geometry/extended/mandelbulb-worker.ts`
- Offload iteration computation
- Non-blocking UI during generation
- Progress reporting

### 5.2 Progressive Rendering

**Modify**: Generator and Scene
- Low-res preview first (24^3)
- Refine to target after 200ms idle
- Resolution drop during interaction

### 5.3 Performance Controls

**File**: `src/components/controls/MandelbulbPerformanceControls.tsx`
- Performance Mode toggle
- Auto Quality toggle
- Worker Threads toggle
- FPS/render time display

---

## File Summary

### New Files (20)

| File | Sprint | Purpose |
|------|--------|---------|
| `src/lib/geometry/extended/mandelbulb.ts` | 1 | Core algorithm |
| `src/stores/mandelbulbStore.ts` | 1 | State management |
| `src/components/controls/MandelbulbControls.tsx` | 1 | Main settings |
| `src/tests/lib/geometry/extended/mandelbulb.test.ts` | 1 | Unit tests |
| `src/components/controls/MandelbulbAxisSelector.tsx` | 2 | Axis selection |
| `src/components/controls/MandelbulbParameterSliders.tsx` | 2 | Param controls |
| `src/components/controls/MandelbulbNavigationControls.tsx` | 2 | Zoom/pan |
| `src/lib/geometry/extended/mandelbulb-colors.ts` | 3 | Color palettes |
| `src/components/controls/MandelbulbColorControls.tsx` | 3 | Color UI |
| `src/lib/geometry/extended/marching-cubes.ts` | 3 | Isosurface |
| `src/components/canvas/MandelbulbIsosurfaceRenderer.tsx` | 3 | Isosurface renderer |
| `src/lib/geometry/extended/mandelbulb-locations.ts` | 4 | Preset locations |
| `src/components/controls/MandelbulbLocations.tsx` | 4 | Locations UI |
| `src/components/controls/MandelbulbAnimationControls.tsx` | 4 | Animation |
| `src/stores/mandelbulbBookmarkStore.ts` | 4 | Bookmarks |
| `src/components/controls/MandelbulbBookmarks.tsx` | 4 | Bookmarks UI |
| `src/components/controls/MandelbulbProperties.tsx` | 4 | Properties panel |
| `src/lib/geometry/extended/mandelbulb-worker.ts` | 5 | Web Worker |
| `src/components/controls/MandelbulbPerformanceControls.tsx` | 5 | Perf controls |
| Additional test files | All | Test coverage |

### Modified Files (9)

| File | Changes |
|------|---------|
| `src/lib/geometry/types.ts` | Add 'mandelbulb' type |
| `src/lib/geometry/extended/types.ts` | Add MandelbulbConfig |
| `src/lib/geometry/extended/index.ts` | Export + switch case |
| `src/lib/geometry/index.ts` | Add to available types |
| `src/stores/index.ts` | Export new stores |
| `src/lib/url/state-serializer.ts` | URL persistence |
| `src/components/controls/ObjectSettingsSection.tsx` | Render Mandelbulb controls |
| `src/components/canvas/Scene.tsx` | Zoom/pan + isosurface |
| `src/components/canvas/PointCloudRenderer.tsx` | Vertex colors |

---

## Testing Requirements

### Unit Tests
- `mandelbulb.test.ts` - Algorithm correctness
- `mandelbulb-colors.test.ts` - Color mapping
- `marching-cubes.test.ts` - Mesh generation
- `mandelbulbStore.test.ts` - Store actions

### Component Tests
- `MandelbulbControls.test.tsx`
- `MandelbulbAxisSelector.test.tsx`
- `MandelbulbParameterSliders.test.tsx`
- `MandelbulbColorControls.test.tsx`

### Integration Tests
- Full rendering pipeline
- URL state persistence
- Dimension changes

### Manual Testing
- Visual verification at each sprint
- Performance benchmarking
- Cross-browser testing

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance with high resolution | Progressive rendering, Web Workers |
| Memory with large point clouds | Efficient typed arrays, cleanup |
| Complex isosurface generation | Start with point cloud, add later |
| UI complexity | Collapsible sections, presets |

---

## Success Criteria

Per PRD:
- 108 acceptance criteria across 14 stories
- 56 test scenarios passing
- All shaders work with Mandelbulb
- URL sharing functional
- Performance targets met (< 2s initial render, < 500ms updates)
