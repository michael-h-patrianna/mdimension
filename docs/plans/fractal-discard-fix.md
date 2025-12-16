# Plan: Fix Fractal Shader "Freeze Frame Effect"

## Problem Statement

The Mandelbulb and Quaternion Julia fragment shaders use `discard` for rays that miss the fractal:

```glsl
if (d > maxDist) discard;
```

This can cause stale pixel artifacts ("freeze frame effect") when:
1. Temporal systems render into intermediate targets where clearing may be disabled
2. Post-processing composer passes chain without full clears
3. MRT (Multiple Render Target) setups where `discard` leaves ALL outputs unwritten

## Current State Analysis

### Shaders Using `discard`
- `src/rendering/renderers/Mandelbulb/mandelbulb.frag:1527`
- `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag:799`

### MRT Outputs
Both shaders output to two render targets:
```glsl
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
```

### Current Rendering Pipeline
In `PostProcessing.tsx`:
- `gl.autoClear = false` is set before scene rendering
- Explicit `gl.clear(true, true, true)` is called for `sceneTarget`
- Object depth pass uses `gl.clear(true, true, false)`

While the current pipeline DOES clear targets, this is fragile:
- Future post-processing additions could break this assumption
- Other render paths may not clear properly
- `discard` prevents writing to ANY output, including normal buffer

## Implementation Plan

### Task 1: Update Mandelbulb Fragment Shader

**File:** `src/rendering/renderers/Mandelbulb/mandelbulb.frag`

**Change:** Replace `discard` with explicit MRT writes for missed rays

**Current code (~line 1527):**
```glsl
if (d > maxDist) discard;
```

**New code:**
```glsl
if (d > maxDist) {
    // Write transparent background instead of discard to avoid freeze-frame artifacts
    // Alpha = 0 allows proper compositing, far depth prevents z-fighting
    gColor = vec4(0.0, 0.0, 0.0, 0.0);
    gNormal = vec4(0.5, 0.5, 1.0, 0.0);  // Default normal pointing at camera, no metallic
    gl_FragDepth = 1.0;  // Maximum depth (background)
    return;
}
```

### Task 2: Update Quaternion Julia Fragment Shader

**File:** `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag`

**Change:** Replace `discard` with explicit MRT writes for missed rays

**Current code (~line 799):**
```glsl
if (d > maxDist) discard;
```

**New code:**
```glsl
if (d > maxDist) {
    // Write transparent background instead of discard to avoid freeze-frame artifacts
    // Alpha = 0 allows proper compositing, far depth prevents z-fighting
    gColor = vec4(0.0, 0.0, 0.0, 0.0);
    gNormal = vec4(0.5, 0.5, 1.0, 0.0);  // Default normal pointing at camera, no metallic
    gl_FragDepth = 1.0;  // Maximum depth (background)
    return;
}
```

### Task 3: Verify Render Target Clearing in PostProcessing.tsx

**File:** `src/rendering/environment/PostProcessing.tsx`

**Verification points:**
1. `sceneTarget` is cleared with `gl.clear(true, true, true)` before fractal rendering - **CONFIRMED**
2. `objectDepthTarget` is cleared with `gl.clear(true, true, false)` - **CONFIRMED**

**Optional hardening (if issues persist):**
Add explicit clear color for transparency:
```typescript
gl.setClearColor(0x000000, 0);  // Already present at line 405 and 450
```

The current clearing is sufficient, but the shader changes provide defense-in-depth.

### Task 4: Update Tests

**Files to update:**
- `src/tests/components/layout/MandelbulbAnimationDrawer.test.tsx` - verify test still passes
- Create new shader output verification tests if needed

**Test scenarios:**
1. Verify fractals render correctly with new no-hit handling
2. Verify no visual artifacts during camera rotation/animation
3. Verify alpha blending works correctly for background pixels

## Technical Notes

### Why `gl_FragDepth = 1.0`?
- Maximum depth value ensures missed rays are "behind" everything
- Consistent with cleared depth buffer value
- Prevents depth conflicts with subsequent render passes

### Why `gNormal = vec4(0.5, 0.5, 1.0, 0.0)`?
- `(0.5, 0.5, 1.0)` encodes a normal pointing toward the camera `(0, 0, 1)`
- `alpha = 0.0` for metallic channel indicates non-reflective background
- Provides sensible defaults for SSR and other normal-dependent effects

### Why `gColor alpha = 0.0`?
- Allows proper alpha compositing in post-processing
- Background shows through correctly
- Compatible with bloom and other effects that use alpha

## Files Modified

1. `src/rendering/renderers/Mandelbulb/mandelbulb.frag`
2. `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag`

## Files Verified (No Changes Needed)

1. `src/rendering/environment/PostProcessing.tsx` - Already clears render targets correctly

## Rollback Plan

If issues occur, simply revert the shader changes:
```glsl
// Revert to:
if (d > maxDist) discard;
```

## Success Criteria

1. No visual artifacts during camera movement or animation
2. All existing tests pass
3. No performance regression (explicit writes vs discard should be similar)
4. Background compositing works correctly with skybox/environment
