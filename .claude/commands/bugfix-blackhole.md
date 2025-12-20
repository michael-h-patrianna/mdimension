---
description: Fix black hole rendering bug
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Scene is neither mostly white (< 50%) nor mostly black (< 85%)
**GATE 2**: Black hole with accretion disk is visible in center of scene (SKIP if Gate 1 fails)

You CANNOT claim success without passing BOTH gates with evidence.
If Gate 1 fails, you MUST skip Gate 2 and continue fixing.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

The black hole object type when in default 3D mode and default "Interstellar" preset selected does not render correctly. The scene shows a disk but lacking all the properties of a black hole. See for comparison what the default in 3D should look similar to: screenshots/Interstellar.jpg

**Expected Behavior**:
- Event horizon (dark center)
- Photon shell (bright ring around event horizon)
- Accretion disk/manifold (glowing material around the black hole)
- Gravitational lensing effects
- Camera movement/rotation should change the view

**Current State**:
- Shader compiles without errors but produces wrong output
- Lensing effect visible when moving camera
- Object lacks the visual properties of a typical movie black hole

## Success Criteria

1. **Gate 1**: The test reports less than 50% white pixels AND less than 85% black pixels
2. **Gate 2**: Visual inspection shows recognizable black hole with accretion disk in scene center

#### Step 0: Initialize

Read log file if provided by the user. Else create log file in `docs/bugfixing/log/blackhole.md`

### Step 1: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000`
2. Wait 2 seconds for scene render (black hole with "Interstellar" preset in 3D loads automatically)
3. Capture console output
4. Take a screenshot
5. Inspect the console output
6. Inspect the screenshot

### Step 3: Hypothesize & Research

Based on observed values and screenshot, state:
- Which shader/component likely causes the issue
- Which mathematical concept may be responsible or missing
- What could be the cause of the gap between observed and expected debug values / screenshot appearance

### Step 4: Take a Step Back
- Look at the problem holistically
- What combination of issues could be at play?
- Do web research!

### Step 5: Fix & Verify & Update Log File

Make ONE targeted change. Then re-run Step 2. Compare before/after. Add any insights to the log file. Add the result of failed fix attempts to the log file.

## Success Declaration Format

Only after gate passes:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]

Gate 1: Black hole visible - PASS
  Screenshot: screenshots/blackhole-render-test.png
  Event horizon: Visible (dark center)
  Photon shell: Visible (bright ring)
  Accretion disk: Visible (glowing material)
===
```

## Constraints

- Do NOT disable the black hole renderer
- Do NOT remove raymarching - the effect requires it
- Do NOT claim success without gate passing
- Preserve all log file entries from previous attempts
