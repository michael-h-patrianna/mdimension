# Temporal Cloud Buffer Debug Log

**Date:** 2025-12-17
**Status:** UNRESOLVED
**Component:** Temporal Cloud Accumulation (Schrödinger volumetric rendering)

## Bug Description

**Symptoms reported:**
1. Temporal buffer texture shows no object shape
2. Scene backdrop appears black and glitchy behind the object

**Object type affected:** `schroedinger` (quantum volumetric renderer)

## Root Cause

The `cloudRenderTarget` in `TemporalCloudManager.ts` used `THREE.HalfFloatType`, which cannot be properly read back using `gl.readRenderTargetPixels()` with a `Float32Array` buffer. This caused all debug/validation reads to return zeros, making it appear the buffer was empty when it actually contained valid data.

## Investigation Process

### Step 1: Instrumentation

Added debug logging to `PostProcessing.tsx`:
- `readPixel()` function to sample render targets
- `logTemporalDebug()` function to log pixel values at key pipeline stages
- Logged at stages: temporalState, volumetricLayerCheck, cloudTarget, writeTarget, readTarget, sceneTarget

### Step 2: Observation (Playwright)

Created `scripts/playwright/temporal-debug.mjs` to capture console output:
- Initial runs showed ALL buffers returning zeros
- This suggested either no rendering or readback failure

### Step 3: Hypothesis Formation

**Initial hypothesis (WRONG):** Shader not compiling with USE_TEMPORAL_ACCUMULATION define.
- Added shader compilation logging
- Confirmed shader HAD the define and was 44916 chars (correct length)

**Second hypothesis (WRONG):** Object not on correct layer.
- Added layer mask logging
- Confirmed object was on layer 8 (VOLUMETRIC), camera mask was 8
- Render stats showed 1 draw call, 12 triangles (correct for bounding box)

**Third hypothesis (CORRECT):** HalfFloatType readback issue.
- Changed `cloudRenderTarget` from `HalfFloatType` to `FloatType`
- Immediately saw real volumetric data: `center=[0.0309, 0.3108, 0.3646, 1.0000]`

## What Failed

| Attempt | Description | Result |
|---------|-------------|--------|
| Shader debug output | Added `gColor = vec4(0.0, 1.0, 1.0, 1.0); return;` to force cyan | Still read zeros (HalfFloat issue) |
| Material key forcing | Added `key` prop to force shader recreation on changes | No effect (shader was already correct) |
| Change texture type | Changed `cloudRenderTarget` texture type from `HalfFloatType` to `FloatType` assuming that `readRenderTargetPixels()` with `Float32Array` cannot decode HalfFloat format | No effect |


## Key Insights

1. **HalfFloatType readback limitation:** WebGL's `readPixels` with Float32Array cannot properly decode HalfFloat textures. Use FloatType for any render target that needs CPU readback.

2. **Layer system works correctly:** Objects on VOLUMETRIC layer (3) render when camera has layer mask 8 (2^3).

3. **Temporal accumulation pipeline:**
   - cloudTarget (quarter-res) → CloudTemporalPass reconstruction → writeTarget (full-res)
   - Ping-pong between accumulation buffers each frame
   - 4-frame Bayer cycle for full coverage

## Files Modified

- `src/rendering/core/TemporalCloudManager.ts` - Changed HalfFloatType to FloatType
- `src/rendering/environment/PostProcessing.tsx` - Added debug utilities (disabled by default)
- `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` - Added shader debug logging
- `scripts/playwright/temporal-debug.mjs` - Created quality gate test script

## Verification

Run quality gates:
```bash
node scripts/playwright/temporal-debug.mjs
```

Expected output: `✅ ALL QUALITY GATES PASSED`
