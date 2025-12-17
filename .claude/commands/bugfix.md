---
description: Fix temporal depth buffer bug.
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Object rendering OFF → center pixel color is NOT black
**GATE 2**: Object rendering ON → temporal buffer center pixel differs from pixel(1,1)
**GATE 3**: Visual confirmation via screenshot (MANDATORY FINAL CHECK)

You CANNOT claim success without running ALL THREE gates and reporting actual values.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

Temporal reprojection fails for schroedinger object type. Symptoms:
- Temporal buffer texture shows no object shape.
- Scene backdrop appears black and glitchy behind the object.
- **The object itself is rendering 100% fine.** It is the writing to the temporal depth buffer and the application of that temporal depth buffer that is breaking the render.

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize
Read log file if provided by the user. Else create log file in `docs/bugfixing/log/temporaldepthbuffer.md`

### Step 1: Instrument

Add debug logging to capture pixel values from temporal buffer and scene.
Output to browser console with prefix `[TR-DEBUG]`.

### Step 2: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000`
2. Wait for scene to render (page loads schroedinger automatically)
3. Capture console output containing `[TR-DEBUG]`
4. Report observed values

### Step 3: Hypothesize & Research

Based on observed values, state:
- What specific value is wrong
- What component likely causes it
- What change you will try

Research with websearch to find solutions and more information and explanations for what you observe.

### Step 4: Take a step back and look at the big picture
Take a step back and look at the big picture.

Review your understanding of the problem in context of the whole application and what the feature is supposed to do once working.

Understand best practices and pitfalls and constraints of our techstack and how our rendering pipeline works.

Research with websearch to find more information.

### Step 5: Fix & Verify & Update log file

Make ONE targeted change. Then re-run Step 2. Compare before/after values. Add any insights in the log file. Add the result of a failed fix attempt to the log file.

### Step 6: Gate Check

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
    [ ] Ground floor plane with grid pattern (NOT black void - the floor is enabled by default)
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

### Step 7: Document
- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work
- **DO NOT OVERWRITE PAST ENTRIES**: preserve the entries about past insights and past fix attempts - you are not the only one working on this bug

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
