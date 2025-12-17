=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Normal buffer contains non-uniform data (not all same value)
**GATE 2**: Normal values are plausible (components in 0.0-1.0 range, not all zeros)
**GATE 3**: Both schroedinger object AND wall normals are present in buffer

You CANNOT claim success without running ALL THREE gates and reporting actual values.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

The Schrödinger object type does not write valid data to the normal buffer (G-buffer `gNormal` output at location 1). Symptoms:

- Normal buffer appears uniform/empty for schroedinger objects
- Post-processing effects that rely on normals (SSR, SSAO) fail for this object type
- Other objects (wall, floor) should write normals correctly - verify this still works

**Root Cause Context**:
The schroedinger shader (`src/rendering/shaders/schroedinger/main.glsl.ts`) has two rendering modes:
1. **Temporal accumulation mode** (`USE_TEMPORAL_ACCUMULATION` defined): Writes to `gPosition` for reprojection
2. **Standard mode** (no temporal accumulation): Should write to `gNormal` for the normal buffer

The precision block (`src/rendering/shaders/shared/core/precision.glsl.ts`) conditionally declares outputs:
```glsl
layout(location = 0) out vec4 gColor;
#ifdef USE_TEMPORAL_ACCUMULATION
layout(location = 1) out vec4 gPosition;
#else
layout(location = 1) out vec4 gNormal;
#endif
```

## Success Criteria

Open the page at `http://localhost:3000`, wait 2 seconds for scene initialization, then read the normal buffer and verify:
1. The buffer contains varying normal data (not uniform single color)
2. Normal values encode view-space normals correctly (RGB = normal * 0.5 + 0.5)
3. Both the schroedinger object AND the wall/floor have correct normal data

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize

Read log file if provided by the user. Else create log file in `docs/prd/bugfixing/log/schroedinger-normals.md`

### Step 1: Instrument

Add debug logging to capture normal buffer pixel values at multiple locations.

Instrumentation requirements:
- Sample center pixel (object area)
- Sample corner pixels (background/wall area)
- Sample 4-5 distributed points across the buffer
- Output to browser console with prefix `[NORMAL-DEBUG]`
- Log: pixel coordinates, RGBA values, and whether values differ from each other

### Step 2: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000`
2. Wait 2 seconds for scene render (schroedinger loads automatically)
3. Capture console output containing `[NORMAL-DEBUG]`
4. Report observed values in a structured format:
   ```
   Center pixel: [R, G, B, A]
   Corner (0,0): [R, G, B, A]
   Corner (W,H): [R, G, B, A]
   Variance detected: YES/NO
   ```

### Step 3: Hypothesize & Research

Based on observed values, state:
- What specific values are wrong (all same? all zeros? unexpected range?)
- Which shader/component likely causes the issue
- What the correct values should look like for view-space normals

Research areas:
- How `gNormal` output is configured in the MRT (Multiple Render Target) setup
- Whether the schroedinger shader's `gNormal` write is being executed
- Whether temporal mode affects normal buffer availability
- How other object types (mandelbulb, julia, tubewireframe) write normals

### Step 4: Take a Step Back

Review the full rendering pipeline:
1. **PostProcessing.tsx**: How is the normal buffer created and used?
2. **SchroedingerMesh.tsx**: What determines if temporal accumulation is enabled?
3. **compose.ts**: How are shader defines set up for normal output?
4. **precision.glsl.ts**: Is the MRT output correctly configured?

Key questions:
- Is `USE_TEMPORAL_ACCUMULATION` being defined when it shouldn't be?
- Is the normal buffer render target properly attached?
- Are there WebGL state issues preventing writes?
- Does the layer system (MAIN_OBJECT vs VOLUMETRIC) affect normal buffer writes?

### Step 5: Fix & Verify & Update Log File

Make ONE targeted change. Then re-run Step 2. Compare before/after values. Add any insights to the log file. Add the result of failed fix attempts to the log file.

**Common fixes to consider**:
1. Ensure `gNormal` output is declared when temporal accumulation is disabled
2. Verify the normal buffer attachment in the render pass
3. Check that schroedinger objects on the correct layer write to the normal buffer
4. Ensure the normal calculation `vec4(viewNormal * 0.5 + 0.5, uMetallic)` is reached

### Step 6: Gate Check

Run quality gates IN ORDER. Stop at first failure.

```
GATE 1 (non-uniform data):
  Sample 5+ pixels from normal buffer
  Expected: At least 2 pixels have different values
  Result: PASS/FAIL
  → If FAIL: No data being written. Check shader output, MRT attachment.

GATE 2 (plausible normals):
  Check all sampled pixels
  Expected: RGB components in [0.0, 1.0] range (encoded from [-1, 1])
  Expected: Values NOT all zero
  Expected: Alpha channel contains metallic value (typically 0.0-1.0)
  Result: PASS/FAIL
  → If FAIL: Data is garbage. Check encoding, buffer format.

GATE 3 (object + wall present): ONLY RUN IF GATE 1 AND 2 PASSED
  Sample pixel in object region (center screen)
  Sample pixel in wall/floor region (lower portion of screen)
  Expected: Both regions have valid, different normal data
  Result: PASS/FAIL
  → If FAIL: One object type not writing. Check per-object shader paths.
```

**GATE 3 Instructions (skip if Gate 1 or 2 failed):**
1. Take a screenshot of the normal buffer visualization (if available)
2. Verify schroedinger object area shows varying normals (spherical surface = radial normals)
3. Verify wall/floor shows flat normal (typically [0.5, 0.5, 1.0] for Z-facing surface)
4. If only one object type has normals, investigate that specific shader

### Step 7: Document

- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work
- **DO NOT OVERWRITE PAST ENTRIES**: preserve the entries about past insights and past fix attempts - you are not the only one working on this bug

## Key Files to Investigate

| File | Purpose | What to Check |
|------|---------|---------------|
| `src/rendering/shaders/schroedinger/main.glsl.ts` | Main shader | Lines 178-194: gNormal write |
| `src/rendering/shaders/shared/core/precision.glsl.ts` | MRT outputs | Conditional output declaration |
| `src/rendering/shaders/schroedinger/compose.ts` | Shader composition | USE_TEMPORAL_ACCUMULATION define |
| `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` | Mesh component | `useTemporalAccumulation` logic |
| `src/rendering/environment/PostProcessing.tsx` | Render pipeline | Normal buffer setup and attachment |
| `src/rendering/core/layers.ts` | Render layers | Layer assignment for objects |

## Constraints

- Do NOT disable the normal buffer system
- Do NOT remove gNormal outputs from other shaders
- Do NOT claim success without gate evidence
- Do NOT break temporal accumulation mode (both modes must work)
- If stuck after 5 iterations, summarize findings and ask for guidance

## Success Declaration Format

Only after ALL THREE gates pass:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]
Gate 1: Variance detected - PASS
  Pixel 1: [values]
  Pixel 2: [values] (different from Pixel 1)
Gate 2: Plausible normals - PASS
  All values in [0.0, 1.0] range
  Non-zero values confirmed
Gate 3: Object + Wall normals - PASS
  Object center: [values] (schroedinger normals)
  Wall region: [values] (wall normals)
===
```

**WARNING**: If you cannot confirm "Object center" shows valid schroedinger normals, the bug is NOT fixed. Do NOT proceed to success declaration.

## Technical Context: Normal Buffer Encoding

Valid normal buffer values should look like:
- **Flat surface facing camera (Z+)**: `[0.5, 0.5, 1.0, metallic]` (normal = [0, 0, 1])
- **Surface facing right (X+)**: `[1.0, 0.5, 0.5, metallic]` (normal = [1, 0, 0])
- **Surface facing up (Y+)**: `[0.5, 1.0, 0.5, metallic]` (normal = [0, 1, 0])
- **Spherical object**: Gradient of values representing radial normals

If all values are `[0.5, 0.5, 0.5, 0.0]` or `[0.0, 0.0, 0.0, 0.0]`, the normal data is NOT being written correctly.
