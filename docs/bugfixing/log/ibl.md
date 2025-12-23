# IBL (Image-Based Lighting) Debugging Log

**Date:** 2024-12-23
**Status:** Resolved

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

---

## Additional Attempts (2024-12-23 continued)

### Attempt 4: Decouple Export from Capture Logic

**Insight from user:** The issue is a synchronization problem:
- When `needsCapture = false`, no new data is written
- But `advanceFrame()` keeps cycling buffer indices
- Read pointer eventually points to empty/stale buffers
- Empty buffers exported → black PMREM → black scene

**Changes Made:**
1. Added `capturedThisFrame` flag to track when actual capture happened
2. Created separate `executeExports()` method - exports every frame if history valid
3. Modified `postFrame()` to only call `advanceFrame()` if `capturedThisFrame === true`
4. Added `postFrame()` to RenderPass interface
5. Added postFrame loop to RenderGraph after `executeExports()`

**Result:** ❌ STILL BROKE RENDERING

**Logs showed:**
```
Frame 0: framesSinceReset=0, hasValid=false, capturedThisFrame=true
Frame 1: framesSinceReset=1, hasValid=false, capturedThisFrame=true
Frame 2: framesSinceReset=2, hasValid=TRUE, capturedThisFrame=true ← Success!
Frame 3: needsCapture=false, capture skipped
```

Despite `hasValid=true` and exports being queued, scene went black.

### Key Finding

The problem is NOT just about buffer cycling. Even with:
- `capturedThisFrame` tracking
- `advanceFrame()` only called when capture happened
- Separate export logic that runs every frame

...the scene still goes black when the postFrame loop is added to RenderGraph.

### Unresolved Mystery

Something about calling ANY `postFrame()` method from RenderGraph breaks rendering, even when:
1. Only CubemapCapturePass has the method
2. The method only advances when capture happened
3. The logs show correct behavior

## Current State (After All Reverts)

solved


## Solution
 The reason "nothing renders at all" is a Premature Disposal / Race Condition in the CubemapCapturePass logic regarding the PMREM generation.

  Here is the exact sequence causing the black screen:

   1. Frame Start: The scene.environment is holding a reference to PMREM_Texture_A (generated in the previous frame).
   2. `CubemapCapturePass` Executes:
       * It determines it needs to update (because hasValidHistory is true due to your postFrame fix).
       * It calls this.pmremRenderTarget?.dispose(). This immediately destroys `PMREM_Texture_A`.
       * It generates PMREM_Texture_B.
       * It queues PMREM_Texture_B to be exported to scene.environment at the end of the frame.
   3. `ScenePass` Executes:
       * It tries to render the main scene.
       * Three.js looks at scene.environment to compute PBR lighting.
       * It sees PMREM_Texture_A, which is now disposed/invalid.
       * Result: The shader receives invalid texture data (black), causing the entire render to fail or output black.
   4. Frame End: ExternalBridge updates scene.environment to PMREM_Texture_B.

  Why the previous solutions failed:
   * Without postFrame: The capture logic never ran, so dispose() was never called. scene.environment remained null or stale but valid.
   * With postFrame: The capture logic runs, destroys the active environment map before the scene can use it, resulting in a black render.

  The Fix Required:
  You must implement Double Buffering (Ping-Pong) for the PMREM target, just like you have for the Cubemap target. You cannot dispose the pmremRenderTarget immediately. You need to hold onto two targets and
  flip-flop between them, or only dispose the old one after you are sure the scene has switched to the new one (next frame).

---

## Session 2024-12-23 (continued) - Additional Attempts

### Issue Found: `writeTarget` Out of Scope

When `hasValidHistory=true` but `needsCapture=false`, the export code tried to use `writeTarget.texture` for PMREM generation, but `writeTarget` is only defined inside the `if (this.needsCapture)` block.

**Fix attempted:** Changed to use `readTarget.texture` instead (which is always defined when hasValidHistory is true).

### Issue Found: `needsCapture` Set Too Early

After first capture, `needsCapture` was set to `false`, but `hasValidHistory(1)` needs `framesSinceReset > 1` (2+ captures). Since `advanceFrame()` only runs when `didCaptureThisFrame=true`, and that only happens when `needsCapture=true`, the frame counter got stuck at 1.

**Fix attempted:** Only set `needsCapture=false` after `hasValidHistory(1)` returns true.

### Result: Still Black Screen

Even with both fixes applied:
- Logs showed correct progression: framesSinceReset 0→1→2
- `hasValidHistory` became true on frame 2
- PMREM was generated from readTarget
- scene.environment export was queued
- BUT scene went black

### New Hypothesis: scene.background Export Problem

The exports are queued for both `scene.background` AND `scene.environment`. When `hasValidHistory` becomes true:
1. `ctx.queueExport({ id: 'scene.background', value: readTarget.texture })`
2. `ctx.queueExport({ id: 'scene.environment', value: pmremTexture })`

Both exports happen AFTER all passes complete via `executeExports()`. But something about setting `scene.background` to the cubemap texture might be causing issues.

### Current State (Reverted)

All changes reverted via `git checkout`. Rendering works, IBL does not.

### Remaining Questions

1. **Why does setting scene.background break rendering?**
   - The black hole shader reads scene.background
   - Maybe setting it to the cubemap texture causes issues with the ScenePass?

2. **Is the texture format wrong?**
   - CubeRenderTarget texture vs CubeTexture
   - Mapping type (CubeReflectionMapping)

3. **Is ScenePass reading stale data?**
   - Even with deferred PMREM disposal, maybe something else is wrong

4. **Should IBL even use scene.environment?**
   - Maybe IBL should use a separate uniform instead of scene.environment

