# Schrödinger Normal Buffer Bug - Fix Log

## Bug Summary
The Schrödinger object type did not write valid data to the normal buffer (G-buffer `gNormal` output at location 1), and wall normals were being lost during the compositing process.

## Status: FIXED

## Root Causes Identified

### Issue 1: Wrong Coordinate Space for Normal Calculation
The Schrödinger shader was using `rd` (model-space ray direction) with `uViewMatrix` (world-to-view transform), resulting in incorrect normals that appeared as a uniform yellow gradient.

**Fix:** Use `worldRayDir` (world-space) and compute actual density gradient at the weighted center position for proper surface normals.

### Issue 2: Three.js autoClear Wiping Render Target
When rendering fullscreen quad copy passes, `gl.autoClear` was true by default, causing Three.js to clear the normalTarget before each render call. This wiped out previously rendered wall normals.

**Fix:** Explicitly set `gl.autoClear = false` before each copy pass render call.

### Issue 3: Premultiplied Alpha Issues
The gNormal output was using low alpha values (uMetallic), which caused premultiplied alpha blending to scale down the normal values.

**Fix:** Always output `alpha = 1.0` for gNormal to prevent blending artifacts.

## Files Modified

### `src/rendering/shaders/schroedinger/main.glsl.ts`
- Changed normal calculation from ray direction proxy to actual density gradient
- Uses `computeDensityGradient(volumeResult.weightedCenter, animTime, 0.02)` for real surface normals
- Proper coordinate space transforms: model → world → view space
- Fixed alpha to 1.0 for gNormal output

### `src/rendering/environment/PostProcessing.tsx`
- Added `gl.autoClear = false` protection for both normalCopyMaterial and volumetricNormalCopyMaterial render passes
- Skip MAIN_OBJECT normal pass when no objects present (optimization)
- Proper discard logic in copy shaders for background preservation

### `src/rendering/core/TemporalCloudManager.ts`
- Changed cloudRenderTarget from 2 to 3 MRT attachments to include normals
- Added `getCloudNormalTexture()` method returning textures[1]

## Key Learnings

1. **Three.js autoClear Behavior**: When using `gl.render()` with a render target, Three.js may auto-clear the target if `gl.autoClear` is true. Always explicitly disable it when compositing multiple passes.

2. **Coordinate Space Consistency**: When transforming vectors between spaces, ensure the input is in the expected space. `uViewMatrix` transforms from world to view, not model to view.

3. **Volumetric Normals**: For volumetric objects, using the density gradient at the weighted center position provides stable, structure-revealing normals instead of view-dependent gradients.

4. **MRT Alpha Channel**: The alpha channel in MRT outputs can cause issues with blending. Use `alpha = 1.0` for normal buffers to avoid premultiplied alpha artifacts.

5. **Discard vs Alpha Blending**: `discard` in GLSL should preserve destination pixels, but only works reliably when the render target isn't being auto-cleared. Setting `autoClear = false` is critical.

## Quality Gates - All Passed

- **Gate 1 (Variance):** PASS - Normal buffer contains non-uniform data
- **Gate 2 (Plausible):** PASS - Normal values are in valid [0,1] range, non-zero
- **Gate 3 (Object + Wall):** PASS - Both Schrödinger object AND wall normals present

## Timeline

### Session 1 - 2025-12-17

1. Initial investigation revealed Schrödinger on VOLUMETRIC layer, not MAIN_OBJECT
2. Found MRT setup was correct (3 attachments, framebuffer COMPLETE)
3. Discovered gNormal output was being written but with wrong values (yellow tint)
4. Fixed coordinate space: use `worldRayDir` instead of `rd`
5. Fixed normal calculation: use density gradient instead of ray direction
6. Fixed alpha: use 1.0 instead of uMetallic
7. Discovered wall normals being wiped by copy passes
8. Root cause: `gl.autoClear = true` was clearing normalTarget before copy renders
9. Fix: Set `gl.autoClear = false` before all normal copy pass renders
10. All gates passed, fix verified working for all object types
