# Bug: Schroedinger Temporal Reprojection GL_INVALID_OPERATION

**Date**: 2025-12-21
**Status**: RESOLVED
**Severity**: Critical (blocks feature usage)
**Fix Applied**: Solution A - Always output 3 values from shaders

---

## Bug Description

When enabling temporal reprojection with the Schroedinger object type, a WebGL error occurs and the object disappears.

**Error Message**:
```
[.WebGL-0x...] GL_INVALID_OPERATION: glDrawElements: Active draw buffers with missing fragment shader outputs.
```

---

## Reproduction Steps

### Scenario 1: Toggle temporal while on Schroedinger
1. Start with temporal reprojection OFF
2. Select the Schroedinger object type
3. Turn ON temporal reprojection in settings
4. **Observed**: Object disappears, GL_INVALID_OPERATION errors in console

### Scenario 2: Switch to Schroedinger while temporal is ON
1. Have temporal reprojection enabled
2. Select a different object type (e.g., polytope)
3. Switch to Schroedinger object type
4. **Observed**: Same error and disappearing object

### Recovery
- Resizing the browser window makes the object render again

---

## Technical Background

### Render Targets (MRT - Multiple Render Targets)

| Target | Attachments | Used For |
|--------|-------------|----------|
| `cloudTarget` | count: 3 | Volumetric cloud rendering (Color, Normal, Position) |
| `mainObjectMRT` | count: 2 | Main object normals (Color, Normal) |
| `sceneTarget` | count: 1 | Full scene color |
| `objectDepthTarget` | count: 1 | Depth-only pass |

### Shader Outputs

The Schroedinger shader has **conditional outputs** based on `USE_TEMPORAL_ACCUMULATION`:

```glsl
// Always present
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

// Only when USE_TEMPORAL_ACCUMULATION is defined
#ifdef USE_TEMPORAL_ACCUMULATION
layout(location = 2) out vec4 gPosition;
#endif
```

### The GL Error

The error "Active draw buffers with missing fragment shader outputs" occurs when:
- Render target has N color attachments (draw buffers)
- Shader only outputs to < N locations
- Example: cloudTarget (3 attachments) + shader with 2 outputs = ERROR

---

## Relevant Code Locations

| File | Purpose |
|------|---------|
| `src/rendering/environment/PostProcessing.tsx` | Render pipeline orchestration |
| `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` | Mesh component, layer & shader management |
| `src/rendering/materials/TrackedShaderMaterial.tsx` | Shader compilation tracking with placeholder |
| `src/rendering/core/TemporalCloudManager.ts` | cloudTarget creation (count: 3) |
| `src/rendering/core/layers.ts` | `needsVolumetricSeparation()` function |

### Key Variables

**SchroedingerMesh.tsx**:
```typescript
const temporalEnabled = usePerformanceStore((state) => state.temporalReprojectionEnabled);
const useTemporalAccumulation = temporalEnabled && !isoEnabled;

// Shader compiled with USE_TEMPORAL_ACCUMULATION when useTemporalAccumulation is true
// Layer set to VOLUMETRIC when useTemporalAccumulation is true (via useLayoutEffect)
```

**PostProcessing.tsx**:
```typescript
// Uses direct store subscription (synchronous)
const unsubPerf = usePerformanceStore.subscribe((s) => {
  perfStateRef.current = s;
});

// In useFrame:
const wantsTemporalCloud = needsVolumetricSeparation({
  temporalCloudAccumulation: temporalReprojectionEnabled,
  objectType,
});
```

---

## Root Cause Hypothesis

**Race condition between PostProcessing and SchroedingerMesh**:

1. User toggles temporal ON (or switches to Schroedinger)
2. Store updates synchronously
3. PostProcessing subscription updates `perfStateRef` immediately
4. React schedules re-render for SchroedingerMesh (async)
5. `useFrame` runs BEFORE SchroedingerMesh re-renders
6. PostProcessing sees `temporalReprojectionEnabled = true`
7. But SchroedingerMesh hasn't updated yet:
   - Mesh may still be on MAIN_OBJECT layer (not VOLUMETRIC)
   - OR mesh moved to VOLUMETRIC but shader still has 2 outputs
8. gl.render() to cloudTarget with mismatched shader = GL_INVALID_OPERATION

### Why resizing fixes it
Resizing triggers:
- Render target recreation
- Component re-renders
- Cache invalidation
- By the time rendering resumes, React has caught up

---

## TrackedShaderMaterial Placeholder

When shader source changes, TrackedShaderMaterial uses a placeholder:

```tsx
<shaderMaterial
  visible={false}  // Material is invisible
  glslVersion={THREE.GLSL3}
  fragmentShader={`
    layout(location = 0) out vec4 gColor;
    layout(location = 1) out vec4 gNormal;
    layout(location = 2) out vec4 gPosition;  // Has 3 outputs!
    void main() { discard; }
  `}
/>
```

The placeholder has 3 outputs and `visible=false`. In theory:
- If placeholder is used, it's compatible with cloudTarget (3 outputs)
- If placeholder is invisible, Three.js should skip the draw call

---

## Attempted Fixes

### Fix 1: Cache Invalidation on Temporal Toggle
**Location**: PostProcessing.tsx subscription

```typescript
if (s.temporalReprojectionEnabled !== perfStateRef.current.temporalReprojectionEnabled) {
  volumetricMeshesValidRef.current = false;
  mainObjectCountCacheRef.current.valid = false;
}
```

**Outcome**: NOT SUFFICIENT - Error still occurs

---

### Fix 2: Skip Cloud Render When No Volumetric Meshes

**Logic**: Only use temporal cloud mode if volumetric meshes exist

```typescript
if (wantsTemporalCloud) {
  updateVolumetricResolutionCached(...);
  hasVisibleVolumetricMeshes = volumetricMeshesRef.current.size > 0;
  useTemporalCloud = hasVisibleVolumetricMeshes;
}
```

**Outcome**: NOT SUFFICIENT - Error still occurs

---

### Fix 3: Filter Cache by material.visible

**Logic**: Only include meshes with visible materials in cache

```typescript
scene.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh && obj.layers.test(volumetricLayerMask)) {
    const mat = (obj as THREE.Mesh).material as THREE.Material;
    if (mat && mat.visible !== false) {
      cachedMeshes.add(obj as THREE.Mesh);
    }
  }
});
```

**Outcome**: NOT SUFFICIENT - Error still occurs

---

### Fix 4: Always Rebuild Cache (Performance Hog)

**Logic**: Remove caching, traverse scene every frame

**Outcome**: NOT SUFFICIENT and causes performance issues - Reverted

---

### Fix 5: Shader Compatibility Check Before Render

**Logic**: Before gl.render() to cloudTarget, check if shaders have gPosition output

```typescript
scene.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh && obj.layers.test(volumetricLayerMask)) {
    const mat = (obj as THREE.Mesh).material as THREE.ShaderMaterial;
    const fragSrc = mat.fragmentShader || '';
    const has3Outputs = fragSrc.includes('gPosition');
    if (mat.visible !== false && !has3Outputs) {
      hasIncompatibleShader = true;
    }
  }
});

if (hasIncompatibleShader) {
  // Skip cloud render, fall back to main scene
  useTemporalCloud = false;
}
```

**Outcome**: UNKNOWN - Debug logging added but not yet analyzed

---

## Current State

Debug logging is in place (PostProcessing.tsx ~line 1177-1205):
- Logs each mesh on VOLUMETRIC layer with:
  - `name`
  - `visible` (material.visible)
  - `has3Outputs` (shader contains "gPosition")
  - `fragShaderLength`
- Warns if skipping render due to incompatible shader

**Next Step**: User needs to reproduce the bug and share console output to understand:
1. Is the mesh on VOLUMETRIC layer when the error occurs?
2. What is `material.visible` at that moment?
3. Does the shader have 3 outputs?
4. Is the "SKIPPING render" warning appearing?

---

## Open Questions

1. **Is the placeholder actually being used?**
   - Need to verify R3F applies `visible={false}` correctly

2. **Is Three.js caching shader programs incorrectly?**
   - When material changes, does Three.js use the new program immediately?

3. **Is there a frame where the mesh is on VOLUMETRIC but has old 2-output shader?**
   - The layer change (useLayoutEffect) and shader change (useMemo) should happen in same render
   - But TrackedShaderMaterial's placeholder introduces a delay

4. **Could the error come from a different mesh?**
   - Are there other objects on VOLUMETRIC layer we're not aware of?

5. **Why does the cache-based fix not work?**
   - If cache only includes visible materials, and placeholder has visible=false...
   - Cache should be empty, useTemporalCloud should be false
   - Main scene should include VOLUMETRIC layer
   - But error still occurs - WHERE is the render happening?

---

## Potential Solutions (Not Yet Tried)

### Solution A: Always Use 3 Outputs
Modify shader composition to always include gPosition output, even when not needed.
- Pro: Eliminates the mismatch possibility
- Con: Slight performance overhead, shader complexity

### Solution B: Defer Layer Change
Keep mesh on MAIN_OBJECT layer until shader is confirmed ready (has 3 outputs).
- Pro: Prevents the race condition
- Con: Requires exposing "ready" state from TrackedShaderMaterial

### Solution C: Use Single Render Target for Transition
During the transition frame(s), use a compatible single-attachment target.
- Pro: Avoids MRT mismatch entirely
- Con: Complex to implement, may cause visual artifacts

### Solution D: Synchronous Shader Compilation
Force shader compilation to complete before proceeding.
- Pro: No race condition
- Con: Causes UI freeze during compilation

---

## Files Modified During Investigation

- `src/rendering/environment/PostProcessing.tsx`
  - Added cache invalidation on temporal toggle
  - Added visibility check in cache building
  - Added shader compatibility check before cloud render
  - Added debug logging

---

## Critical Discovery: Bug Origin

**This bug was INTRODUCED by the billboard fix documented in `temporaldepthbuffer.md`!**

From that log (line 75-76):
> "WebGL Error 1282 (GL_INVALID_OPERATION) appears on frame ~20, after volumetric render"
> "...unrelated to the main bug and should be investigated separately"

**This IS that bug.** The billboard fix (lines 260-289 of that log):
1. Added `gPosition` MRT output to Schroedinger shader (only when `USE_TEMPORAL_ACCUMULATION` defined)
2. Changed `cloudRenderTarget` to `count: 3`

Before the billboard fix:
- cloudRenderTarget had count: 1 (or 2)
- Shader outputs didn't need to match exactly

After the billboard fix:
- cloudRenderTarget requires 3 outputs
- Shader only has 3 outputs when `USE_TEMPORAL_ACCUMULATION` is defined
- Race condition: shader may not have the define when cloudTarget is used

---

## Resolution (2025-12-21)

### Solution Implemented: Always Output 3 Values

The fix was to **always declare and write to `gPosition`** in all shaders, regardless of whether `USE_TEMPORAL_ACCUMULATION` is defined. This eliminates the race condition entirely because:

1. **When temporal is OFF**: Shader has 3 outputs, rendered to mainObjectMRT (count: 2) - WebGL silently ignores extra outputs
2. **When temporal is ON**: Shader has 3 outputs, rendered to cloudTarget (count: 3) - perfect match
3. **During transition**: Shader always has 3 outputs, no mismatch possible

### Files Modified

1. **`src/rendering/shaders/shared/core/precision.glsl.ts`**
   - Removed `#ifdef USE_TEMPORAL_ACCUMULATION` around `gPosition` declaration
   - `gPosition` is now always declared

2. **`src/rendering/shaders/schroedinger/main.glsl.ts`**
   - Volumetric mode: Always writes to `gPosition` (real data when temporal enabled, dummy `vec4(0.0)` when disabled)
   - Isosurface mode: Added `gPosition` output

3. **`src/rendering/shaders/blackhole/main.glsl.ts`**
   - Added fallback `gPosition = vec4(0.0)` when `USE_TEMPORAL_ACCUMULATION` is not defined

### Why This Works

WebGL is asymmetric about MRT mismatches:
- **Shader outputs < framebuffer attachments**: GL_INVALID_OPERATION error
- **Shader outputs > framebuffer attachments**: Silently ignored (safe)

By always outputting 3 values, the shader is compatible with both 2-attachment and 3-attachment render targets.

### Performance Impact

Negligible. Writing an extra `vec4(0.0)` when not needed costs essentially nothing.

---

## Related Documentation

- Three.js WebGLRenderTarget with `count` for MRT
- GLSL `layout(location = N) out` declarations
- React useLayoutEffect timing vs useFrame
- Zustand subscription (sync) vs React hook selectors (async)
- **`docs/bugfixing/log/temporaldepthbuffer.md`** - Billboard fix that introduced this issue
