---
description: Fix webgpu rendering issue.
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Scene not just black

You CANNOT claim success without running PASSING THE GATE.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

**NEVER** deactivate WebGPU handling. this bug is webgpu only.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

Open the page for the schroedinger type http://localhost:3000/?t=schroedinger. CPU usage climbs to 100%. UI freezes. Even if shader builds and compiles, object is not rendered. The port of schroedinger from WebGL2 to WebGPU resulted in broken code and funactionality.

## Success Criteria

Open the page at `http://localhost:3000/?t=schroedinger`, wait 5 seconds for scene initialization, then read number of non-black pixels and overall brightness in scene. Scene cannot be all dark.

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize

1. Read log file if provided by the user. Else create log file in `docs/bugfixing/log/2026-01-06-schroedinger-webgpu-not-rendering.md`
2. Write a playwright test that tests for the success criteria. Do not add visual inspection because AI agents inspecting screenshots is expensive. Use algorithmic/code-based inspections like counting pixels or measuring brightness. You can adapt the WebGL test script `scripts/playwright/object-types-rendering.spec.ts` for WebGPU (WebGPU is automatically enabled when you open the page, so possibly nothing needs to be changed.)

### Step 1: Instrument

Hyopthize what debug output could help to pinpoint the root cause of the bug or where in the flow of the website/data/code/render graph the bug is appearing.

Add debug logging for it.

### Step 2: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000/?t=schroedinger`
2. Wait 5 seconds for scene render
3. Capute console ouput with the added debug output
4. Capture test data

### Step 3: Hypothesize & Research
- Review the debug output
- Take a step back and think what the debug output is telling you in the context of the whole rendering engine and web app
- Review what you have learned so far `docs/bugfixing/log/2026-01-06-schroedinger-webgpu-not-rendering.md`
- Hypothize likely reasons for this behaviour

### Step 4: Fix & Verify & Update Log File

Make ONE targeted change. Then re-run Step 2. Compare before/after. Add any insights to the log file. Add the result of failed fix attempts to the log file.

### Step 5: Run Gate
Run test again. If bug persists, go back to step 1.

### Step 6: Document

- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work
- **DO NOT OVERWRITE PAST ENTRIES**: preserve the entries about past insights and past fix attempts - you are not the only one working on this bug

## Success Declaration Format

Only after gate passes:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]
===
```

**WARNING**: If you cannot confirm that the main object is not visually rendering, the bug is NOT fixed. Do NOT proceed to success declaration.

## Technical Context
- We recently added WebGPU support with all new WebGPU render graph engine, shaders, materials. The main branch has the pre-migration code with WebGL perfectly working fine. This branch has WebGPU failing for schroedinger currently.
- We are working with ThreeJS TSL r182 and moder 2025/2026 WebGPU. Do not trust your training data! It has outdated architecture and code patterns and you are consistenly writing broken code if you do not use WebSearch extensively to find solutions and validate code changes!!! Without WebSearch you are writing broken code! Always use Websearch!!!
