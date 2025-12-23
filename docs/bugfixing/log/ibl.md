# IBL (Image-Based Lighting) Debugging Log

**Date:** 2024-12-23  
**Status:** TESTING SOLUTION - Codex analysis provided key insights  

## Problem Statement

IBL (Image-Based Lighting) is not working. Objects and walls should show environment reflections based on the skybox, but no reflections appear regardless of IBL quality settings.

## Architecture Overview

### Components Involved

1. **`CubemapCapturePass`** (`src/rendering/graph/passes/CubemapCapturePass.ts`)
   - Captures skybox (procedural or classic) to a `WebGLCubeRenderTarget`
   - Uses `TemporalResource` for 2-frame history buffer
   - Generates PMREM for PBR reflections
   - Exports to `scene.background` and `scene.environment` via `ExternalBridge`

2. **`TemporalResource`** (`src/rendering/graph/TemporalResource.ts`)
   - Manages N-frame history for temporal effects
   - Key methods:
     - `getWrite()`: Returns current frame's write target
     - `getRead(frameOffset)`: Returns previous frame's target
     - `hasValidHistory(frameOffset)`: Checks if history is valid
     - `advanceFrame()`: Moves to next frame, increments `framesSinceReset`

3. **`RenderGraph`** (`src/rendering/graph/RenderGraph.ts`)
   - Orchestrates pass execution
   - Manages exports via `ExternalBridge`
   - Does NOT currently call `postFrame()` on passes

4. **`ExternalBridge`** (`src/rendering/graph/ExternalBridge.ts`)
   - Handles import/export contract between render graph and external systems
   - `queueExport()`: Queues values during pass execution
   - `executeExports()`: Applies queued values after all passes complete

### Data Flow

```
CubemapCapturePass.execute()
  → ensureTemporalHistory() - creates 2-buffer TemporalResource
  → cubemapHistory.getWrite() - get current write target
  → cubeCamera.update() - render skybox to cubemap
  → hasValidHistory(1) - check if previous frame is valid
  → if valid: queueExport('scene.background', texture)
  → if valid: generate PMREM, queueExport('scene.environment', pmrem)

RenderGraph.execute()
  → execute all passes
  → externalBridge.executeExports() - apply scene.background/environment
  → [MISSING] pass.postFrame() - advance temporal resources
```

## Root Cause Identified

**`TemporalResource.hasValidHistory(1)` always returns `false`** because `advanceFrame()` is never called.

### Evidence from Console Logs

```
Frame 0: framesSinceReset=0, hasValid=false
Frame 1: framesSinceReset=0, hasValid=false  ← Never increments!
Frame 2: framesSinceReset=0, hasValid=false
...forever...
```

### Why `hasValidHistory(1)` Fails

The method checks: `return this.framesSinceReset > frameOffset`

For `frameOffset=1`, it needs `framesSinceReset > 1`, meaning at least 2 frames of captured data.

But `framesSinceReset` stays at 0 because `advanceFrame()` is never called.

## Attempted Solutions

### Attempt 1: Add `postFrame()` loop to RenderGraph

**Change:** Added loop after `executeExports()` to call `postFrame()` on all passes.

```typescript
for (const pass of this.compiled.passes) {
  if (typeof pass.postFrame === 'function') {
    pass.postFrame()
  }
}
```

**Result:** ❌ BROKE RENDERING - 3D scene became completely black (no object, no skybox, no walls). UI still rendered.

### Attempt 2: Track executed passes, call `postFrame()` only on those

**Change:** Collected passes that actually executed (not disabled), called `postFrame()` only on those.

```typescript
const executedPasses: RenderPass[] = []
// ...in pass loop...
executedPasses.push(pass)
// ...after exports...
for (const pass of executedPasses) {
  if (typeof pass.postFrame === 'function') {
    pass.postFrame()
  }
}
```

**Result:** ❌ SAME - Rendering completely broken.

### Attempt 3: Call `advanceFrame()` directly in `executeCapture()`

**Change:** Called `this.cubemapHistory.advanceFrame()` at end of `executeCapture()`.

**Result:** ❌ SAME - Rendering completely broken.

## Key Observations

1. **When postFrame loop is added:**
   - `IBL-DEBUG-E` logs show `postFrame()` IS being called
   - `framesSinceReset` DOES increment (0 → 1 → 2)
   - `hasValid` becomes `true` on frame 2
   - BUT the 3D scene is black

2. **When postFrame loop is NOT added:**
   - Rendering works perfectly (object, skybox, walls visible)
   - But `framesSinceReset` stays at 0 forever
   - IBL never works (no environment reflections)

3. **No console errors** are logged when rendering breaks.

4. **Only `CubemapCapturePass`** has a `postFrame()` method - no other passes.

## Mysteries to Investigate

1. **Why does calling `advanceFrame()` break rendering?**
   - `advanceFrame()` only modifies private variables (`writeIndex`, `framesSinceReset`)
   - It doesn't touch any WebGL state
   - It doesn't modify `scene.background` or `scene.environment`

2. **What is different between working and broken states?**
   - Same passes execute
   - Same exports are queued
   - Same external bridge logic runs
   - The ONLY difference is `advanceFrame()` being called

3. **Is there timing/order sensitivity?**
   - Maybe `advanceFrame()` affects something in the NEXT frame?
   - Maybe the order of operations matters more than expected?

## Current State

- **IBL Quality:** Set to `'high'` in `visualDefaults.ts` for testing
- **Debug Logs:** Still present in `CubemapCapturePass.ts` (IBL-DEBUG-A through E)
- **RenderGraph:** Reverted to working state (no postFrame loop)
- **Rendering:** Working (object, skybox visible)
- **IBL:** NOT working (no reflections)

## Files Modified

1. `src/stores/defaults/visualDefaults.ts` - Changed `DEFAULT_IBL_QUALITY` to `'high'`
2. `src/rendering/graph/passes/CubemapCapturePass.ts` - Added debug console.logs
3. `src/rendering/graph/FrameContext.ts` - Added `iblQuality` and `iblIntensity` to frozen state
4. `src/rendering/environment/PostProcessingV2.tsx` - Added `hasIBL` to enabled condition

## Next Steps to Investigate

1. **Isolate the exact moment rendering breaks:**
   - Add logging to every step of RenderGraph.execute()
   - Capture screenshots at different points in the frame

2. **Check if exports are actually being applied:**
   - Log `scene.background` and `scene.environment` after `executeExports()`
   - Verify the exported textures are valid

3. **Check for side effects of `advanceFrame()`:**
   - What happens on the frame AFTER `hasValid` becomes true?
   - Is `needsCapture` being set incorrectly?

4. **Consider alternative architectures:**
   - Maybe `TemporalResource` isn't the right pattern here?
   - Maybe the cubemap should be exported immediately without history validation?

## Relevant Code Locations

- `src/rendering/graph/passes/CubemapCapturePass.ts:163-272` - execute and executeCapture
- `src/rendering/graph/TemporalResource.ts:171-179` - hasValidHistory logic
- `src/rendering/graph/RenderGraph.ts:750-850` - pass execution loop
- `src/rendering/environment/PostProcessingV2.tsx:705-735` - CubemapCapturePass instantiation


## Codex Root Cause Analysis (2024-12-23)

After deep analysis using codex CLI, the key insight is: **`advanceFrame()` isn't directly breaking rendering** - it's enabling exports that then cause problems.

### Top Hypothesis: PMREM Disposal Timing

The code disposes the previous PMREM **before** new exports are applied:
```typescript
this.pmremRenderTarget?.dispose();
this.pmremRenderTarget = this.pmremGenerator.fromCubemap(...);
ctx.queueExport({ id: 'scene.environment', value: this.pmremRenderTarget.texture });
```

This means `scene.environment` (still bound in shaders) points to a **disposed WebGLTexture** until frame end → black lighting.

### Secondary Hypothesis: Buffer Index Timing

`advanceFrame()` was being called at the wrong time, possibly before or during pass execution. It should happen **after** `executeExports()` to ensure:
1. New textures are captured
2. Exports are applied to scene
3. THEN buffer indices advance for next frame

## Latest Solution Attempt (Testing in Progress)

### Changes Made

1. **PostProcessingV2.tsx**
   - Temporarily disabled PMREM: `generatePMREM: () => false`
   - This tests if PMREM disposal is the root cause

2. **RenderGraph.ts**
   - Added `postFrame()` call **after** `executeExports()`
   - Ensures `advanceFrame()` runs with correct timing

### Expected Outcomes

**If PMREM disposal was the culprit:**
- ✅ Scene renders correctly (objects, skybox, walls visible)
- ✅ `framesSinceReset` increments properly
- ✅ Scene.background is exported and works
- ❌ No wall reflections (PMREM disabled)

**If buffer timing was the issue:**
- ✅ Everything works including wall reflections

**Current State:** TESTING - Dev server running on port 3002
