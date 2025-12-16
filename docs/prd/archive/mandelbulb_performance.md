# Performance Optimizations

## Overview

This feature implements four performance optimization techniques for fractal and polytope rendering:
- **Temporal Reprojection** (reusing previous frame data) - *Fractals only*
- **Resolution Scaling** (rendering at lower resolution) - *All object types*
- **Progressive Refinement** (incremental quality improvement) - *All object types*
- **3D Texture SDF Cache** (precomputed distance field) - *Fractals only*

These optimizations enable smoother interaction and higher quality static renders, especially for higher-dimensional objects (8D-11D).

### Scope by Object Type

| Feature | Mandelbulb | Mandelbox | Menger | Polytopes |
|---------|-----------|-----------|--------|-----------|
| Performance Panel | ✅ | ✅ | ✅ | ✅ |
| Temporal Reprojection | ✅ | ✅ | ✅ | ❌ |
| Resolution Scaling | ✅ | ✅ | ✅ | ✅ |
| Progressive Refinement | ✅ | ✅ | ✅ | ✅ |
| SDF Cache | ✅ | ✅ | ✅ | ❌ |

---

## User Story 1: Performance Settings Panel

**User story:** As a user, I want to access performance optimization settings so that I can tune rendering behavior for my device and use case.

**Acceptance criteria**
1. User sees a "Performance" section in the sidebar, positioned above the "Settings" section
2. Section contains all four optimization controls, always visible regardless of object type:
   - Resolution Scaling (toggle + slider)
   - Progressive Refinement (toggle + progress indicator)
   - Temporal Reprojection (toggle) - only affects fractals, but always shown
   - SDF Cache (toggle + resolution + generate/clear) - only affects fractals, but always shown
3. Each optimization has an enable/disable toggle
4. All performance settings are excluded from share URLs (they're device-specific)
5. Controls that don't affect the current object type still function (settings are preserved when switching object types)

**Test scenarios**

Scenario 1: Access performance settings
- Given the user opens the sidebar
- When the user scrolls to the "Performance" section
- Then the user sees all four optimization controls organized by technique
- And the section is positioned above "Settings"

Scenario 2: Settings persist across object types
- Given the user enables Temporal Reprojection while viewing a Mandelbulb
- When the user switches to a Hypercube (polytope)
- Then Temporal Reprojection remains enabled in the UI
- And the setting takes effect again when switching back to a fractal

Scenario 3: Settings not in URL
- Given the user has custom performance settings
- When the user copies the share URL
- Then the URL does not contain performance settings

---

## User Story 2: Temporal Reprojection

**User story:** As a user, I want the renderer to reuse data from previous frames so that raymarching can skip empty space and render faster during motion.

**Acceptance criteria**
1. User sees "Temporal Reprojection" toggle in Performance section
2. Default state is ON (enabled)
3. When enabled, renderer uses previous frame depth to start rays closer to the surface
4. Speedup is most noticeable during slow camera movements (30-50% faster)
5. No visual artifacts during smooth motion
6. May show brief artifacts during rapid rotation (acceptable tradeoff)
7. Automatically disabled when camera teleports (e.g., preset views, reset)
8. Tooltip: "Reuses previous frame depth to accelerate rendering"

**Test scenarios**

Scenario 1: Enable temporal reprojection
- Given Temporal Reprojection is disabled
- When the user toggles it ON
- Then subsequent frames render faster during camera motion

Scenario 2: Smooth motion performance
- Given Temporal Reprojection is enabled
- When the user slowly rotates the fractal
- Then frame rate is noticeably higher than with reprojection disabled

Scenario 3: Rapid motion handling
- Given Temporal Reprojection is enabled
- When the user rapidly rotates the fractal
- Then there may be minor visual artifacts that resolve when motion stops

Scenario 4: Camera teleport reset
- Given Temporal Reprojection is enabled
- When the user clicks a preset camera position
- Then reprojection temporarily disables for 1 frame (no artifacts from stale data)

Scenario 5: Static view (no effect)
- Given Temporal Reprojection is enabled
- When the camera is stationary
- Then there is no visual difference from disabled state

---

## User Story 3: Resolution Scaling

**User story:** As a user, I want to render at a lower resolution during interaction so that frame rates stay high, with full resolution restored for static views.

**Acceptance criteria**
1. User sees "Resolution Scaling" toggle in Performance section
2. Default state is ON (enabled)
3. User sees "Interaction Scale" slider (0.25 to 1.0, step 0.05, default 0.5)
4. During camera interaction, render at scaled resolution
5. When interaction stops, render at full resolution after 150ms delay
6. Transition from low to high resolution is smooth (fade, not pop)
7. At scale 0.25, pixels are visible but frame rate is 4-16x higher
8. At scale 1.0 (off), full resolution is always used
9. Resolution indicator shows current mode: "50%" during interaction, "100%" when static
10. Slider label shows performance estimate: "~4x faster" at 0.5 scale

**Test scenarios**

Scenario 1: Enable resolution scaling
- Given Resolution Scaling is disabled
- When the user toggles it ON
- Then the Interaction Scale slider appears

Scenario 2: Interaction triggers scaling
- Given Resolution Scaling is ON with scale 0.5
- When the user starts rotating the fractal
- Then the image becomes noticeably pixelated but frame rate increases significantly

Scenario 3: Static restores resolution
- Given the user was rotating (scaled resolution)
- When the user stops rotating for 150ms
- Then the image smoothly sharpens to full resolution

Scenario 4: Aggressive scaling
- Given Resolution Scaling is ON with scale 0.25
- When the user rotates the fractal
- Then pixels are clearly visible but interaction is extremely smooth

Scenario 5: Scaling disabled at 1.0
- Given the user sets Interaction Scale to 1.0
- When the user rotates the fractal
- Then resolution remains full (no scaling applied)

Scenario 6: Resolution indicator
- Given Resolution Scaling is ON at 0.5
- When the user rotates the fractal
- Then a "50%" indicator appears in the viewport corner

Scenario 7: Smooth transition
- Given the user stops rotating
- When resolution restores
- Then the transition is a smooth fade (0.3s) rather than instant pop

---

## User Story 4: Progressive Refinement

**User story:** As a user, I want the renderer to start with a fast low-quality preview and progressively improve to full quality so that I get instant feedback followed by polished results.

**Acceptance criteria**
1. User sees "Progressive Refinement" toggle in Performance section
2. Default state is ON (enabled)
3. When camera stops, rendering begins at low quality and progressively refines
4. User sees refinement progress indicator (0-100% or visual bar)
5. Refinement stages: Low (instant) → Medium (100ms) → High (300ms) → Final (500ms)
6. Any camera movement resets to low quality instantly
7. User can interrupt refinement by moving camera
8. Final quality matches non-progressive full quality exactly
9. Works in combination with other optimizations
10. Tooltip: "Progressively improves image quality after interaction stops"

**Test scenarios**

Scenario 1: Enable progressive refinement
- Given Progressive Refinement is disabled
- When the user toggles it ON
- Then subsequent static views progressively sharpen

Scenario 2: Refinement stages visible
- Given Progressive Refinement is ON
- When the user stops rotating the fractal
- Then the image visibly improves in stages over ~500ms

Scenario 3: Progress indicator
- Given Progressive Refinement is ON
- When the user stops rotating
- Then a progress indicator shows 0% → 25% → 50% → 75% → 100%

Scenario 4: Movement interrupts refinement
- Given the image is at 50% refinement
- When the user starts rotating again
- Then refinement resets to 0% (low quality) instantly

Scenario 5: Final quality matches full quality
- Given Progressive Refinement is ON
- When refinement reaches 100%
- Then the image is identical to what would render with refinement disabled

Scenario 6: Quick interaction patterns
- Given the user repeatedly taps to make small rotations
- When refinement starts between taps
- Then the system handles interruptions gracefully (no flashing/artifacts)

---

## User Story 5: 3D Texture SDF Cache

**User story:** As a user, I want to optionally precompute the fractal distance field into a 3D texture so that rendering is dramatically faster at the cost of precision and memory.

**Acceptance criteria**
1. User sees "SDF Cache" toggle in Performance section
2. Default state is OFF (disabled) - this is an advanced optimization
3. When enabled, user sees cache controls appear:
   - "Resolution" dropdown: 64³, 128³, 256³ (default 128³)
   - "Generate Cache" button
   - "Clear Cache" button
4. Generating cache shows progress: "Generating SDF cache... X%"
5. Generation time varies: 64³ ~1s, 128³ ~5s, 256³ ~30s
6. After generation, rendering uses texture lookup instead of ray iteration
7. Cached rendering is 10x+ faster but shows blocky artifacts at low resolution
8. Cache is invalidated when fractal parameters change (power, iterations, dimension)
9. Memory usage indicator: "~8 MB" for 128³, "~64 MB" for 256³
10. Warning: "SDF Cache uses fixed resolution. Zoom in may show artifacts."

**Test scenarios**

Scenario 1: Enable SDF Cache
- Given SDF Cache is disabled
- When the user toggles it ON
- Then Resolution dropdown and Generate/Clear buttons appear

Scenario 2: Generate cache
- Given SDF Cache is enabled with 128³ resolution
- When the user clicks "Generate Cache"
- Then a progress indicator shows "Generating SDF cache... X%" for ~5 seconds
- And then rendering switches to use the cached texture

Scenario 3: Cached rendering performance
- Given SDF Cache is generated
- When the user rotates a 9D mandelbulb
- Then frame rate is dramatically higher than without cache (10x+ improvement)

Scenario 4: Cache resolution tradeoff
- Given the user generates a 64³ cache
- When the user zooms in closely
- Then blocky/pixelated artifacts are visible on the surface

Scenario 5: High resolution cache
- Given the user generates a 256³ cache (taking ~30s)
- When the user views the fractal at normal zoom
- Then surface quality is good with minimal artifacts

Scenario 6: Parameter change invalidates cache
- Given the user has a cached SDF
- When the user changes Mandelbulb power from 8 to 12
- Then a notification appears: "SDF cache invalidated. Regenerate for cached rendering."
- And rendering falls back to real-time calculation

Scenario 7: Clear cache
- Given the user has a cached SDF
- When the user clicks "Clear Cache"
- Then the cache is deleted and rendering uses real-time calculation

Scenario 8: Memory warning
- Given the user selects 256³ resolution
- When viewing the memory indicator
- Then it shows "~64 MB" with warning icon

Scenario 9: Dimension change invalidates
- Given the user has a cached SDF for 5D
- When the user switches to 6D
- Then cache is invalidated automatically

---

## Implementation Plan

### Phase 1: Foundation (Store + UI Structure)

#### 1.1 Create Performance Store
**File**: `src/stores/performanceStore.ts`

```typescript
interface PerformanceState {
  // Resolution Scaling (ALL objects)
  resolutionScalingEnabled: boolean; // default: true
  interactionScale: number; // 0.25-1.0, step 0.05, default: 0.5

  // Progressive Refinement (ALL objects)
  progressiveRefinementEnabled: boolean; // default: true
  refinementProgress: number; // 0-100, read-only UI state

  // Temporal Reprojection (Fractals only)
  temporalReprojectionEnabled: boolean; // default: true

  // SDF Cache (Fractals only)
  sdfCacheEnabled: boolean; // default: false
  sdfCacheResolution: 64 | 128 | 256; // default: 128
  sdfCacheGenerated: boolean; // read-only state
  sdfCacheProgress: number; // 0-100 during generation
}
```

#### 1.2 Exclude from URL Serialization
- Update share URL logic to explicitly exclude `performanceStore` state
- Performance settings are device-specific, not shareable

#### 1.3 Create UI Folder Structure
```
src/components/sidebar/Performance/
├── index.ts
├── PerformanceSection.tsx            # Top-level collapsible section
├── ResolutionScalingControls.tsx     # Toggle + scale slider
├── ProgressiveRefinementControls.tsx # Toggle + progress indicator
├── TemporalReprojectionControls.tsx  # Toggle (affects fractals only)
└── SDFCacheControls.tsx              # Toggle + resolution + buttons (affects fractals only)
```

#### 1.4 Add Section to Sidebar
- Add `<PerformanceSection />` to `Sidebar.tsx`
- Position above the "Settings" section
- All controls always visible (no conditional rendering based on object type)

---

### Phase 2: Resolution Scaling (All Objects)

#### 2.1 Interaction Detection Hook
**File**: `src/hooks/useInteractionState.ts`

- Track camera position/rotation changes via `useFrame`
- Track mouse/touch drag state via event listeners
- Export `isInteracting: boolean` and `lastInteractionTime: number`
- 150ms debounce before `isInteracting` becomes false

#### 2.2 Resolution Scaling Hook
**File**: `src/hooks/useResolutionScaling.ts`

- Manage WebGLRenderTarget with dynamic size
- Calculate scaled size: `canvasSize * interactionScale`
- Handle render target resize on canvas resize
- Provide `currentScale` and `targetScale` for smooth transitions

#### 2.3 Scaled Renderer Component
**File**: `src/components/canvas/ScaledRenderer.tsx`

- Wrap scene content with FBO rendering
- Render to scaled target during interaction
- Cross-fade to full resolution over 300ms when interaction stops
- Use custom shader for bilinear upscaling

#### 2.4 Resolution Indicator
**File**: `src/components/ui/ResolutionIndicator.tsx`

- Overlay showing "50%" (or current scale) during interaction
- Positioned in viewport corner
- Fade in/out with interaction state

---

### Phase 3: Progressive Refinement (All Objects)

#### 3.1 Refinement State Machine
**File**: `src/hooks/useProgressiveRefinement.ts`

```typescript
type RefinementStage = 'low' | 'medium' | 'high' | 'final';

// Stage timing after interaction stops:
// low (instant) → medium (100ms) → high (300ms) → final (500ms)

// Quality multipliers per stage:
// low: 0.25, medium: 0.50, high: 0.75, final: 1.0
```

#### 3.2 Shader Quality Uniform
- Add `uQualityMultiplier` uniform to all shaders
- Fractals: `maxIterations * uQualityMultiplier`
- Polytopes: Adjust edge quality / sample count

#### 3.3 Refinement Progress Indicator
**File**: `src/components/ui/RefinementIndicator.tsx`

- Visual progress bar: 0% → 25% → 50% → 75% → 100%
- Fade out after reaching 100%
- Reset instantly on interaction

---

### Phase 4: Temporal Reprojection (Fractals Only)

#### 4.1 Ping-Pong Depth Buffer Hook
**File**: `src/hooks/useTemporalDepth.ts`

- Create two WebGLRenderTargets with depth texture attachment
- Swap each frame: current ↔ previous
- Store previous camera view-projection matrix
- Detect camera teleport (large delta) to disable for 1 frame

#### 4.2 Shader Modifications
**Files**: `mandelbulb.frag`, `mandelbox.frag`, `menger.frag`

New uniforms:
```glsl
uniform sampler2D uPreviousDepth;
uniform mat4 uPreviousViewProjection;
uniform mat4 uCurrentViewProjectionInverse;
uniform bool uTemporalEnabled;
```

Reprojection logic:
```glsl
// Reproject current pixel to previous frame
vec4 prevClip = uPreviousViewProjection * worldPos;
vec2 prevUV = prevClip.xy / prevClip.w * 0.5 + 0.5;

// Sample previous depth and start ray closer
if (validUV(prevUV)) {
  float prevDepth = texture(uPreviousDepth, prevUV).r;
  startDistance = prevDepth * 0.9; // Safety margin
}
```

#### 4.3 Mesh Component Updates
**Files**: `MandelbulbMesh.tsx`, `MandelboxMesh.tsx`, `MengerMesh.tsx`

- Integrate `useTemporalDepth` hook
- Update uniforms each frame
- Handle teleport detection (preset camera, reset)

---

### Phase 5: SDF Cache (Fractals Only)

#### 5.1 SDF Cache Generator
**File**: `src/lib/sdf/SDFCacheGenerator.ts`

```typescript
class SDFCacheGenerator {
  async generate(
    fractalType: 'mandelbulb' | 'mandelbox' | 'menger',
    params: FractalParams,
    resolution: 64 | 128 | 256,
    onProgress: (percent: number) => void
  ): Promise<THREE.Data3DTexture>
}
```

Generation approach:
- Compute SDF values on CPU in chunks (avoid blocking UI)
- Use `requestIdleCallback` or Web Worker for background computation
- Create `THREE.Data3DTexture` from Float32Array

#### 5.2 SDF Cache Hook
**File**: `src/hooks/useSDFCache.ts`

- Manage cache lifecycle (generate, clear, invalidate)
- Track generation progress
- Detect param changes that invalidate cache

#### 5.3 Shader Modifications
**Files**: `mandelbulb.frag`, `mandelbox.frag`, `menger.frag`

New uniforms:
```glsl
uniform sampler3D uSDFCache;
uniform bool uUseSDFCache;
uniform vec3 uCacheBoundsMin;
uniform vec3 uCacheBoundsMax;
```

Cached SDF lookup:
```glsl
float getDistance(vec3 p) {
  if (uUseSDFCache) {
    vec3 uv = (p - uCacheBoundsMin) / (uCacheBoundsMax - uCacheBoundsMin);
    return texture(uSDFCache, uv).r;
  }
  return fractalSDF(p);
}
```

#### 5.4 Memory Estimates
| Resolution | Voxels | Memory |
|------------|--------|--------|
| 64³ | 262K | ~1 MB |
| 128³ | 2.1M | ~8 MB |
| 256³ | 16.8M | ~64 MB |

---

### New Files Summary

```
src/
├── stores/
│   └── performanceStore.ts           # NEW
├── hooks/
│   ├── useInteractionState.ts        # NEW
│   ├── useResolutionScaling.ts       # NEW
│   ├── useProgressiveRefinement.ts   # NEW
│   ├── useTemporalDepth.ts           # NEW
│   └── useSDFCache.ts                # NEW
├── lib/
│   └── sdf/
│       ├── types.ts                  # NEW
│       └── SDFCacheGenerator.ts      # NEW
├── components/
│   ├── canvas/
│   │   └── ScaledRenderer.tsx        # NEW
│   ├── ui/
│   │   ├── ResolutionIndicator.tsx   # NEW
│   │   └── RefinementIndicator.tsx   # NEW
│   └── sidebar/
│       └── Performance/              # NEW top-level section
│           ├── index.ts                      # NEW
│           ├── PerformanceSection.tsx        # NEW
│           ├── ResolutionScalingControls.tsx # NEW
│           ├── ProgressiveRefinementControls.tsx # NEW
│           ├── TemporalReprojectionControls.tsx  # NEW
│           └── SDFCacheControls.tsx              # NEW
└── tests/
    ├── stores/performanceStore.test.ts           # NEW
    ├── hooks/useInteractionState.test.ts         # NEW
    ├── hooks/useResolutionScaling.test.ts        # NEW
    ├── hooks/useProgressiveRefinement.test.ts    # NEW
    ├── hooks/useTemporalDepth.test.ts            # NEW
    └── hooks/useSDFCache.test.ts                 # NEW
```

### Files to Modify

- `src/stores/index.ts` - Export performanceStore
- `src/components/sidebar/Sidebar.tsx` - Add PerformanceSection above Settings
- `src/lib/shaders/mandelbulb.frag` - Add temporal + SDF cache uniforms
- `src/lib/shaders/mandelbox.frag` - Add temporal + SDF cache uniforms
- `src/lib/shaders/menger.frag` - Add temporal + SDF cache uniforms
- `src/components/canvas/renderers/Mandelbulb/MandelbulbMesh.tsx` - New uniform handling
- `src/components/canvas/renderers/Mandelbox/MandelboxMesh.tsx` - New uniform handling
- `src/components/canvas/renderers/Menger/MengerMesh.tsx` - New uniform handling
- Share URL serialization logic - Exclude performance settings

---

### Implementation Order

1. **Phase 1** (Foundation) - Required first, ~2-3 files
2. **Phase 2** (Resolution Scaling) - Can start after Phase 1
3. **Phase 3** (Progressive Refinement) - Can start after Phase 2 (uses same infrastructure)
4. **Phase 4** (Temporal Reprojection) - Can start after Phase 1, independent of 2/3
5. **Phase 5** (SDF Cache) - Can start after Phase 1, most complex

Phases 2-5 can be developed in parallel once Phase 1 is complete.
