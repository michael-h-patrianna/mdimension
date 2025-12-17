=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Object rendering OFF → center pixel color is NOT black
**GATE 2**: Object rendering ON → temporal buffer center pixel differs from pixel(1,1)
**GATE 3**: Visual confirmation via screenshot (MANDATORY FINAL CHECK)

You CANNOT claim success without running ALL THREE gates and reporting actual values.
=== END IMMUTABLE GATES ===

## Bug Description

Temporal reprojection fails for schroedinger object type. Symptoms:
- Temporal buffer texture shows no object shape.
- Scene backdrop appears black and glitchy behind the object.
- **The object itself is rendering 100% fine.** It is the writing to the temporal depth buffer and the application of that temporal depth buffer that is breaking the render.

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize
Read log file if provided by the user. Else create log file in `prd/bugfixing/temporaldepthbuffer.md`

### Step 1: Instrument

Add debug logging to capture pixel values from temporal buffer and scene.
Output to browser console with prefix `[TR-DEBUG]`.

### Step 2: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000`
2. Wait for scene to render (page loads schroedinger automatically)
3. Capture console output containing `[TR-DEBUG]`
4. Report observed values

### Step 3: Hypothesize

Based on observed values, state:
- What specific value is wrong
- What component likely causes it
- What change you will try

### Step 4: Fix & Verify

Make ONE targeted change. Then re-run Step 2. Compare before/after values.

### Step 5: Gate Check

Run quality gates IN ORDER. Stop at first failure.

```
GATE 1 (object OFF): Center pixel = [R, G, B, A]
  Expected: NOT [0, 0, 0, *]
  Result: PASS/FAIL
  → If FAIL: Stop here. Fix scene rendering first.

GATE 2 (object ON): Center = [R, G, B, A], Pixel(1,1) = [R, G, B, A]
  Expected: Values differ
  Result: PASS/FAIL
  → If FAIL: Stop here. Fix temporal buffer writing.

GATE 3 (visual confirmation): ONLY RUN IF GATE 1 AND 2 PASSED
  Screenshot of canvas required.
  Required elements visible:
    [ ] Ground floor plane with grid pattern (NOT black void)
    [ ] Central object (sphere-like volumetric structure)
    [ ] Both elements rendered together in same scene
  Result: PASS/FAIL
```

**GATE 3 Instructions (skip if Gate 1 or 2 failed):**
1. Take a screenshot using Playwright: `await page.screenshot({ path: 'screenshots/temporal-debug-visual.png' })`
2. Use the Read tool to view the screenshot image
3. Visually confirm the scene contains:
   - **Ground floor**: A plane with a visible grid pattern below/around the object. This is the environment backdrop. If you only see black void behind the object, GATE 3 FAILS.
   - **Central object**: The Schrödinger volumetric object (sphere-like, cloud-like structure) in the center.
4. If ONLY the object is visible with black background, the temporal buffer is NOT working correctly - GATE 3 FAILS regardless of pixel values.

**CRITICAL**: Gates 1 and 2 passing with Gate 3 failing indicates a false positive in your pixel tests. The bug is NOT fixed until all three gates pass.

### Step 6: Document
- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work

## Known Pitfalls (from previous debugging attempts)

### 1. HalfFloatType Readback Returns Zeros
`gl.readRenderTargetPixels()` with `Float32Array` cannot properly decode `HalfFloatType` textures - it returns all zeros even when the buffer contains valid data.

**Workaround for debugging:** Temporarily change render target to `FloatType` to verify data exists.
**Do NOT assume:** Zeros in readback means the buffer is empty.

### 2. cloudTarget Having Data ≠ Full Pipeline Working
The temporal accumulation pipeline has multiple stages:
```
cloudTarget (quarter-res) → CloudTemporalPass reconstruction → writeTarget → composite → sceneTarget
```
Data in `cloudTarget` only proves the volumetric shader renders. The bug may be in reconstruction or compositing.

### 3. Shader Compilation is Likely Correct
The Schrödinger shader compiles with `USE_TEMPORAL_ACCUMULATION` define. Verified via:
```javascript
console.log(`[TR-DEBUG] Shader compiled: ${JSON.stringify({
  hasTemporalAccumDefine: result.glsl.includes('#define USE_TEMPORAL_ACCUMULATION'),
  shaderLength: result.glsl.length, // ~44916 chars when correct
})}`);
```

### 4. Layer System is Working
- VOLUMETRIC layer = 3, camera mask = 8 (2^3)
- Objects render when `obj.layers.test(camera.layers)` returns true
- Render stats show 1 draw call, 12 triangles for bounding box

### 5. Reconstruction Shader Has No-History Fallback
When `uHasValidHistory=false` (first 4 frames), the reconstruction shader uses `spatialInterpolationFromCloud()` which samples directly from cloudTarget. The bug is NOT in this fallback logic.

### 6. Focus Areas for Investigation
Based on prior analysis, likely problem areas:
- **Ping-pong buffer swap timing** in `TemporalCloudManager.endFrame()`
- **Composite material** `cloudCompositeMaterial` blending settings
- **Render target state** after `CloudTemporalPass.render()` returns
- **Camera layer mask restoration** after volumetric-only render pass

## Constraints

- Do NOT disable temporal reprojection
- Do NOT change the fundamental approach
- Do NOT claim success without gate evidence
- If stuck after 5 iterations, summarize findings and ask for guidance

## Success Declaration Format

Only after ALL THREE gates pass:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]
Gate 1: Center=[values] - PASS
Gate 2: Center=[values], (1,1)=[values] - PASS
Gate 3: Visual confirmation - PASS
  Screenshot: screenshots/temporal-debug-visual.png
  Ground floor grid: VISIBLE
  Central object: VISIBLE
  Black void background: NO
===
```

**WARNING**: If you cannot check the "Ground floor grid: VISIBLE" box, the bug is NOT fixed. Do NOT proceed to success declaration.
