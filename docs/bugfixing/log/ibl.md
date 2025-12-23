# IBL (Image-Based Lighting) Implementation Log

**Date:** 2024-12-23
**Status:** ✅ RESOLVED

## Problem Statement

IBL (Image-Based Lighting) was not working. Objects and walls should show environment reflections based on the skybox, but no reflections appeared regardless of IBL quality settings.

## Root Causes Identified

### 1. Shader Type Mismatch (Primary Issue)

The IBL shader was using `samplerCube uEnvMap`, but `PMREMGenerator` produces a 2D texture with `THREE.CubeUVReflectionMapping`. These are incompatible.

**Fix:** Updated `ibl.glsl.ts` to use `sampler2D uEnvMap` with Three.js's `textureCubeUV` functions for proper PMREM sampling.

### 2. PMREM Disposal Race Condition

The code disposed the previous PMREM texture **before** the new export was applied:
1. Frame Start: `scene.environment` holds `PMREM_Texture_A`
2. `CubemapCapturePass` disposes `PMREM_Texture_A`, generates `PMREM_Texture_B`
3. `ScenePass` renders with disposed `PMREM_Texture_A` → black
4. Frame End: Export applies `PMREM_Texture_B` (too late)

**Fix:** Implemented deferred PMREM disposal via `pendingPMREMDispose` - dispose old texture in `postFrame()` after exports are applied.

### 3. TemporalResource Not Advancing

`advanceFrame()` was never called, so `hasValidHistory()` always returned false.

**Fix:** Added conditional `advanceFrame()` call in `postFrame()` when `didCaptureThisFrame=true`.

### 4. Capture Timing with Animated Skyboxes

Skyboxes can animate (rotation, color, procedural effects), but capture was only happening on mode/texture changes.

**Fix:** Added continuous capture with throttling:
- Cubemap capture: every frame (`CAPTURE_UPDATE_INTERVAL = 1`)
- PMREM regeneration: every 2 captures (`PMREM_UPDATE_INTERVAL = 2`)

## Final Architecture

### CubemapCapturePass Flow

```
execute()
  → Check for skybox mode/texture changes → requestCapture() if changed
  → executeCapture()
    → Capture cubemap from SKYBOX layer (if objects present)
    → Generate PMREM (throttled for performance)
    → Queue exports: scene.environment (PMREM for IBL)
  → Set needsCapture=true for next frame (animated skyboxes)

postFrame()
  → Dispose pending PMREM (deferred disposal)
  → Advance temporal history (if captured)
```

### IBL Shader (ibl.glsl.ts)

- Uses `sampler2D uEnvMap` (not `samplerCube`)
- Uses Three.js's `textureCubeUV()` for proper PMREM sampling
- Quality levels: 0=off, 1=low, 2=high
- Proper Fresnel-Schlick with roughness compensation

### Material Bindings

All 6 renderers consistently:
- Check for `CubeUVReflectionMapping` before binding
- Read `scene.environment` for IBL
- Read IBL settings from `useEnvironmentStore`

## Known Limitation

**`scene.background` export disabled** - Exporting the captured cubemap to `scene.background` causes black screen. This doesn't affect IBL (uses `scene.environment`), but may affect black hole gravitational lensing with procedural skyboxes. Marked with TODO for future investigation.

## Files Modified

1. `src/rendering/shaders/shared/lighting/ibl.glsl.ts` - PMREM sampling
2. `src/rendering/graph/passes/CubemapCapturePass.ts` - Capture, PMREM, exports
3. `src/rendering/environment/GroundPlaneMaterial.tsx` - IBL uniform binding
4. `src/rendering/renderers/Polytope/PolytopeScene.tsx` - IBL uniform binding
5. `src/rendering/renderers/TubeWireframe/TubeWireframe.tsx` - IBL uniform binding
6. `src/rendering/renderers/Mandelbulb/MandelbulbMesh.tsx` - IBL uniform binding
7. `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` - IBL uniform binding
8. `src/rendering/renderers/QuaternionJulia/QuaternionJuliaMesh.tsx` - IBL uniform binding
9. `src/rendering/shaders/*/compose.ts` - Added pmremSamplingBlock to shaders
10. `src/stores/defaults/visualDefaults.ts` - Set DEFAULT_IBL_QUALITY to 'high'

## Performance Considerations

- Cubemap capture: 6 render passes per capture (one per cube face)
- PMREM generation: Expensive GPU operation
- Throttling: PMREM regenerates every 2 frames for balance between smoothness and performance
- For static skyboxes, consider increasing throttle intervals
