---
description: Fix temporal depth buffer bug.
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: No GL_INVALID_OPERATION message in the browser console

You CANNOT claim success without running PASSING THE GATE.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

Open the page for any object type, e.g. http://localhost:3000/?t=hypercube. Capture browser console messages. It shows and GL_INVALID_OPERATION error

## Success Criteria

Open the page at `http://localhost:3000/?t=hypercube`, wait 2 seconds for scene initialization, then read browser console and confirm that there is not message "GL_INVALID_OPERATION"

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize

Read log file if provided by the user. Else create log file in `docs/bugfixing/log/gl_invalid_operation.md`

### Step 1: Instrument

Hyopthize what debug output could help to pinpoint the root cause of the bug or where in the flow of the website/data/code/render graph the bug is appearing.

Add debug logging for it.

### Step 2: Observe

Use Playwright to:
1. Navigate to `http://localhost:3000/?type=hypercube`
2. Wait 2 seconds for scene render
3. Capture console output containing `GL_INVALID_OPERATION`
4. Capute console ouput with the added debug output

### Step 3: Hypothesize & Research
- Review the debug output
- Take a step back and think what the debug output is telling you in the context of the whole rendering engine and web app
- Review what you have learned so far `docs/bugfixing/log/gl_invalid_operation.md`
- Hypothize likely reasons for this behaviour

### Step 4: Fix & Verify & Update Log File

Make ONE targeted change. Then re-run Step 2. Compare before/after. Add any insights to the log file. Add the result of failed fix attempts to the log file.

### Step 5: Run Gate
Run test again. The gate passes when GL_INVALID_OPERATION is no longer appearing in dev console output. If bug persists, go back to step 1.

### Step 6: Document

- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work
- **DO NOT OVERWRITE PAST ENTRIES**: preserve the entries about past insights and past fix attempts - you are not the only one working on this bug


## Constraints

- Do NOT change attachments to 2 (3 are needed for temporal reprojection)
- Do NOT break temporal accumulation mode (both modes must work)
- If stuck after 5 iterations, summarize findings and ask for guidance

## Success Declaration Format

Only after gate passes:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]
===
```

**WARNING**: If you cannot confirm "GL_INVALID_OPERATION" no longer being present in the browser console, the bug is NOT fixed. Do NOT proceed to success declaration.

## Technical Context: Normal Buffer Encoding

- This is not an issue specific to an object type. All object types will cause the bug.
- This is likely not a shader bug. It only appears when launching the page. It does not reproduce when on page and selecting other object types and then returning back to the initial object type.
- Setting attachments to 2 is not the solution. We need 3 for temporal reprojection.
