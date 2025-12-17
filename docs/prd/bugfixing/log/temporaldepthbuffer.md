# Temporal Cloud Buffer Debug Log

**Date:** 2025-12-17
**Status:** UNRESOLVED
**Component:** Temporal Cloud Accumulation (Schrödinger volumetric rendering)

## Bug Description

**Symptoms reported:**
1. Temporal buffer texture shows no object shape.
2. Scene backdrop appears black and glitchy behind the object.
3. **Object type affected:** `schroedinger` (quantum volumetric renderer).

## Chronological Debugging Log

### Attempt 1: Instrumentation & Initial Observation
**Action:**
- Added `[TR-DEBUG]` logging to `PostProcessing.tsx` to read pixel values from `cloudTarget`, `writeTarget`, and `readTarget`.
- Created `scripts/playwright/temporal-debug.mjs` to automate checking pixel values.
- **Result:** FAILED. All logs returned zeros (e.g., `center=[0.0000, 0.0000, 0.0000, 0.0000]`).
- **Insight:** `readRenderTargetPixels` with `Float32Array` fails on `HalfFloatType` textures. The data might be there, but we can't see it.

### Attempt 2: Fix Buffer Readback (HalfFloat -> Float)
**Hypothesis:** The zero logs are a readback artifact, not a rendering failure.
**Action:**
- Modified `src/rendering/core/TemporalCloudManager.ts`: Changed `accumulationBuffers` type from `THREE.HalfFloatType` to `THREE.FloatType`.
- **Result:** SUCCESS (Partial).
  - Debug logs began showing valid data: `center=[0.0309, 0.3108, 0.3647, 1.0000]`.
  - Gate 1 and Gate 2 PASSED.
  - **New Finding:** The alpha channel was `1.0000`.
  - **Visual Check (Gate 3):** FAILED. The object rendered, but the background was solid black.
- **Insight:** An alpha of 1.0 explains the black background (it occludes everything behind it). The volumetric shader is likely rendering as solid.

### Attempt 3: Opacity Mode Investigation & Fix
**Hypothesis:** The shader is receiving the wrong opacity mode, defaulting to `Solid` (0).
**Action:**
- **Debug:** Added temporary code to `main.glsl.ts` to color-code output by mode (Red=Solid, Green=Volumetric). Result was RED.
- **Root Cause Found:** `SchroedingerMesh.tsx` was using the key `'volumetric'` to set `uOpacityMode`. The correct key in `OPACITY_MODE_TO_INT` is `'volumetricDensity'`. `'volumetric'` returned `undefined`, causing the uniform to be `0` (Solid).
- **Fix:** Updated `SchroedingerMesh.tsx` to use `effectiveMode = useTemporalAccumulation ? 'volumetricDensity' : ...`.
- **Verification:**
  - Removed debug color code.
  - Ran `temporal-debug.mjs`.
- **Result:**
  - **Logs:** Alpha is now correct: `center=[0.0184, 0.1851, 0.2171, 0.5956]`. (Was 1.0).
  - **Visual Check (Gate 3):** FAILED. Despite alpha being ~0.6, the background is STILL black/occluded.

## Current Status
**State:** UNRESOLVED.
- The render pipeline produces the correct pixel values (transparency is present in the buffer).
- The `cloudCompositeMaterial` is failing to blend this transparency correctly with the scene, or the scene itself is missing/cleared.

## Key Insights
1. **HalfFloatType:** Use `FloatType` for any buffer you intend to `readPixels` from for debugging.
2. **Opacity Modes:** Always verify string keys match the `OPACITY_MODE_TO_INT` map exactly.
3. **Current Paradox:** We have valid transparent pixels in the buffer (Alpha ~0.6), but the visual result acts like Alpha 1.0 (or the blend mode is "replace").
4. **HalfFloatType Readback Returns Zeros**
`gl.readRenderTargetPixels()` with `Float32Array` cannot properly decode `HalfFloatType` textures - it returns all zeros even when the buffer contains valid data.

Workaround for debugging: Temporarily change render target to `FloatType` to verify data exists.
Do NOT assume: Zeros in readback means the buffer is empty.

5. **cloudTarget Having Data ≠ Full Pipeline Working**
The temporal accumulation pipeline has multiple stages:
```
cloudTarget (quarter-res) → CloudTemporalPass reconstruction → writeTarget → composite → sceneTarget
```
Data in `cloudTarget` only proves the volumetric shader renders. The bug may be in reconstruction or compositing.

6. **Shader Compilation is Likely Correct**
The Schrödinger shader compiles with `USE_TEMPORAL_ACCUMULATION` define. Verified via:
```javascript
console.log(`[TR-DEBUG] Shader compiled: ${JSON.stringify({
  hasTemporalAccumDefine: result.glsl.includes('#define USE_TEMPORAL_ACCUMULATION'),
  shaderLength: result.glsl.length, // ~44916 chars when correct
})}`);
```

**7. Layer System is Working**
- VOLUMETRIC layer = 3, camera mask = 8 (2^3)
- Objects render when `obj.layers.test(camera.layers)` returns true
- Render stats show 1 draw call, 12 triangles for bounding box

**8. Reconstruction Shader Has No-History Fallback**
When `uHasValidHistory=false` (first 4 frames), the reconstruction shader uses `spatialInterpolationFromCloud()` which samples directly from cloudTarget. The bug is NOT in this fallback logic.

## Next Steps
1. **Investigate Blend Mode:** Check `cloudCompositeMaterial` in `PostProcessing.tsx`. Is it using `OneMinusSrcAlpha`? Is the `sceneTarget` being cleared before compositing?
2. **Check Scene Render:** Is the scene (grid/walls) actually rendering to `sceneTarget` before the cloud composite pass runs?
3. **Scene Target Readback:** `sceneTarget` uses HalfFloat, so we can't debug-read it. Rely on screenshots or temporarily switch `sceneTarget` to `FloatType` to verify it's not empty.
