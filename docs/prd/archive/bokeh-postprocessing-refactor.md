# PRD: Bokeh/Depth-of-Field Post-Processing Refactor

## Overview

Replace the current broken Three.js BokehPass implementation with a best-in-class depth-of-field system using `@react-three/postprocessing`'s DepthOfField and Autofocus components.

## Problem Statement

### Current Issues (Bug Report)

1. **Coordinate System Mismatch**: The focus parameter doesn't correspond to world units, making it nearly impossible to focus on objects at known distances
2. **Difficult to Focus**: No autofocus capability forces manual trial-and-error
3. **Sharp Transitions**: Abrupt edges between focused and blurred regions due to simple blur implementation lacking proper Circle of Confusion (CoC) calculation
4. **Limited Options**: Only 3 parameters (focus, aperture, maxBlur) with poor defaults

### Root Cause Analysis

The Three.js `BokehPass` uses a simplified bokeh shader that:
- Uses normalized focus values (0-1) instead of world units
- Lacks proper depth linearization using camera near/far planes
- Doesn't implement physically-based CoC calculations
- Has no smoothstep transitions between focal zones

## Solution

### Reference Implementation

Based on analysis of [zemanzoltan.com/x/biblikon/webgl_postprocessing_dof2.html](https://zemanzoltan.com/x/biblikon/webgl_postprocessing_dof2.html):

**Key Features:**
- Physically-based parameters: focalDepth (0-200), focalLength (16-80mm), fstop (0.1-22)
- Quality controls: rings (1-8), samples (1-13)
- Visual effects: vignetting, chromatic fringe, pentagon bokeh, dithering
- Autofocus via raycasting with smooth interpolation
- Proper depth linearization
- Debug focus visualization

### Chosen Implementation

Use `@react-three/postprocessing` library which provides:

1. **DepthOfField effect** - Proper CoC-based bokeh with world-unit focus
2. **Autofocus component** - GPU-accelerated depth picking with smooth transitions
3. **Declarative API** - Clean React integration

## Technical Specification

### Architecture Change

**Before (Three.js passes):**
```tsx
// PostProcessing.tsx
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass'
```

**After (@react-three/postprocessing):**
```tsx
// PostProcessing.tsx
import { EffectComposer, Bloom, DepthOfField, ToneMapping } from '@react-three/postprocessing'
import { Autofocus } from '@react-three/postprocessing'
```

### New Focus Modes

| Mode | Description | Component Used |
|------|-------------|----------------|
| `'auto-center'` | Focus on screen center, smooth tracking | `<Autofocus mouse={false} />` |
| `'auto-mouse'` | Focus follows mouse pointer | `<Autofocus mouse={true} />` |
| `'manual'` | Direct control via worldFocusDistance | `<DepthOfField />` |

### New State Parameters

```typescript
// visualStore.ts additions

// Focus mode selection
bokehFocusMode: 'auto-center' | 'auto-mouse' | 'manual'

// Core DOF parameters (world units)
bokehWorldFocusDistance: number  // 1-100, default 10
bokehWorldFocusRange: number     // 0.5-50, default 5

// Appearance controls
bokehScale: number               // 0-10, default 2 (blur intensity)
bokehFocalLength: number         // 0.01-1, default 0.1

// Autofocus behavior
bokehSmoothTime: number          // 0-2s, default 0.25 (focus transition speed)

// Debug
bokehShowDebug: boolean          // Shows focus point visualization
```

### Deprecated Parameters (to remove)

```typescript
// These will be removed:
bokehFocus: number      // Replaced by bokehWorldFocusDistance
bokehAperture: number   // Replaced by bokehScale
bokehMaxBlur: number    // Replaced by bokehWorldFocusRange
```

### PostProcessing Component Structure

```tsx
// PostProcessing.tsx
export const PostProcessing = memo(function PostProcessing() {
  const {
    bloomEnabled, bloomIntensity, bloomThreshold, bloomRadius,
    bokehEnabled, bokehFocusMode, bokehWorldFocusDistance,
    bokehWorldFocusRange, bokehScale, bokehSmoothTime, bokehShowDebug,
    toneMappingEnabled, toneMappingAlgorithm, exposure,
  } = useVisualStore(useShallow(...))

  return (
    <EffectComposer>
      {/* Bloom */}
      {bloomEnabled && (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={bloomThreshold}
          radius={bloomRadius}
        />
      )}

      {/* Depth of Field */}
      {bokehEnabled && (
        bokehFocusMode === 'manual' ? (
          <DepthOfField
            worldFocusDistance={bokehWorldFocusDistance}
            worldFocusRange={bokehWorldFocusRange}
            bokehScale={bokehScale}
          />
        ) : (
          <Autofocus
            mouse={bokehFocusMode === 'auto-mouse'}
            debug={bokehShowDebug ? 0.1 : undefined}
            smoothTime={bokehSmoothTime}
            worldFocusRange={bokehWorldFocusRange}
            bokehScale={bokehScale}
          />
        )
      )}

      {/* Tone Mapping */}
      {toneMappingEnabled && (
        <ToneMapping
          mode={TONE_MAPPING_MAP[toneMappingAlgorithm]}
        />
      )}
    </EffectComposer>
  )
})
```

### BokehControls Component

```tsx
// BokehControls.tsx
export const BokehControls = () => {
  const {
    bokehEnabled, bokehFocusMode, bokehWorldFocusDistance,
    bokehWorldFocusRange, bokehScale, bokehSmoothTime, bokehShowDebug,
    // setters...
  } = useVisualStore(useShallow(...))

  return (
    <div className="space-y-4">
      <Switch checked={bokehEnabled} onCheckedChange={setBokehEnabled} label="Depth of Field" />

      {bokehEnabled && (
        <>
          {/* Focus Mode Selector */}
          <Select
            label="Focus Mode"
            value={bokehFocusMode}
            onChange={setBokehFocusMode}
            options={[
              { value: 'auto-center', label: 'Auto (Center)' },
              { value: 'auto-mouse', label: 'Auto (Mouse)' },
              { value: 'manual', label: 'Manual' },
            ]}
          />

          {/* Manual focus distance - only shown in manual mode */}
          {bokehFocusMode === 'manual' && (
            <Slider
              label="Focus Distance"
              min={1} max={100} step={0.5}
              value={bokehWorldFocusDistance}
              onChange={setBokehWorldFocusDistance}
            />
          )}

          {/* Common parameters */}
          <Slider
            label="Focus Range"
            min={0.5} max={50} step={0.5}
            value={bokehWorldFocusRange}
            onChange={setBokehWorldFocusRange}
          />

          <Slider
            label="Blur Intensity"
            min={0} max={10} step={0.1}
            value={bokehScale}
            onChange={setBokehScale}
          />

          {/* Autofocus-specific */}
          {bokehFocusMode !== 'manual' && (
            <Slider
              label="Focus Speed"
              min={0} max={2} step={0.05}
              value={bokehSmoothTime}
              onChange={setBokehSmoothTime}
            />
          )}

          <Switch
            checked={bokehShowDebug}
            onCheckedChange={setBokehShowDebug}
            label="Show Focus Point"
          />
        </>
      )}
    </div>
  )
}
```

## Implementation Phases

### Phase 1: Architecture Migration
**Files:** `src/components/canvas/environment/PostProcessing.tsx`

1. Replace Three.js EffectComposer with @react-three/postprocessing EffectComposer
2. Replace UnrealBloomPass with Bloom component
3. Replace OutputPass with ToneMapping component
4. Remove BokehPass (temporarily disable DOF)
5. Verify bloom and tone mapping work correctly

### Phase 2: State Management Update
**Files:** `src/stores/visualStore.ts`

1. Add new bokeh state parameters
2. Add new setters with validation
3. Mark old parameters as deprecated (keep for migration)
4. Update INITIAL_STATE with new defaults

### Phase 3: DOF Implementation
**Files:** `src/components/canvas/environment/PostProcessing.tsx`

1. Implement conditional DepthOfField/Autofocus rendering
2. Wire up all new parameters
3. Test all three focus modes
4. Verify world-unit focus distances work correctly

### Phase 4: UI Controls Update
**Files:** `src/components/sidebar/PostProcessing/BokehControls.tsx`

1. Add focus mode selector dropdown
2. Add new sliders for worldFocusDistance, focusRange, bokehScale
3. Add smoothTime slider (conditional on autofocus modes)
4. Add debug visualization toggle
5. Remove old aperture/maxBlur controls

### Phase 5: Testing & Polish
**Files:**
- `src/tests/components/controls/BokehControls.test.tsx`
- `src/tests/components/canvas/PostProcessing.test.tsx` (new)
- `scripts/playwright/postprocessing.spec.ts` (new)

1. Update unit tests for BokehControls
2. Add integration tests for PostProcessing component
3. Add Playwright visual tests for DOF effect
4. Remove deprecated state parameters after migration verified

## Default Values

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| `bokehEnabled` | `false` | boolean | |
| `bokehFocusMode` | `'auto-center'` | enum | Most intuitive default |
| `bokehWorldFocusDistance` | `10` | 1-100 | Typical viewing distance |
| `bokehWorldFocusRange` | `5` | 0.5-50 | Moderate depth of field |
| `bokehScale` | `2` | 0-10 | Subtle blur |
| `bokehSmoothTime` | `0.25` | 0-2 | Smooth but responsive |
| `bokehShowDebug` | `false` | boolean | |

## Tone Mapping Compatibility

The @react-three/postprocessing ToneMapping effect uses different mode constants. Create a mapping:

```typescript
import { ToneMappingMode } from 'postprocessing'

export const TONE_MAPPING_TO_POSTPROCESSING: Record<ToneMappingAlgorithm, ToneMappingMode> = {
  'linear': ToneMappingMode.LINEAR,
  'reinhard': ToneMappingMode.REINHARD,
  'aces': ToneMappingMode.ACES_FILMIC,
  'agx': ToneMappingMode.AGX,
  'neutral': ToneMappingMode.NEUTRAL,
}
```

## Success Criteria

1. **Focus works in world units**: Setting worldFocusDistance=10 focuses at 10 units from camera
2. **Smooth transitions**: No visible hard edges between focus regions
3. **Autofocus works**: Center and mouse modes correctly track depth
4. **Debug visualization**: Green spheres show focus point when enabled
5. **Performance**: No noticeable frame rate impact vs current implementation
6. **All tests pass**: 100% test coverage maintained

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing bloom settings | Keep bloom parameters unchanged, only change implementation |
| Performance regression from depth picking | Autofocus uses GPU-based depth reading, monitor frame times |
| User confusion from new parameters | Keep defaults that "just work", add tooltips |
| Migration complexity | Phase implementation, keep deprecated params during transition |

## Dependencies

Already installed:
- `@react-three/postprocessing` 3.0.4
- `postprocessing` 6.38.0

No new dependencies required.
