---
description: Fix WebGL context loss/recovery bug for Schroedinger object.
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: After context recovery, the Schroedinger object is visible in a screenshot (not just the floor plane)
**GATE 2**: After context recovery, there are ZERO WebGL error/warning messages in the console
**GATE 3**: The render loop continues normally after recovery (FPS > 0, no frozen frame)

You CANNOT claim success without running ALL THREE gates and reporting actual evidence.

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every new observation, failed fix, learning made, insight gathered, add it to the log file.
**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete. You only may correct insights if they turn out to be false.
**Update Log While Working**: Do not wait with log files update after all gates passed. Write to log as soon as you have made a new learning or observation or a fix failed.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

When simulating WebGL context loss and recovery using the debug button in the Performance Monitor (Buffers tab), the following issues occur:

1. **Schroedinger object disappears** and does not reappear after context is restored
2. **WebGL errors flood the console**: "object does not belong to this context" and "deleteVertexArray" errors
3. **Temporal managers report null render targets** after recovery

### How to Reproduce

1. Open `http://localhost:3000` (Schroedinger object loads by default)
2. Open the Performance Monitor (floating pill, top-left)
3. Expand it and go to the "Buffers" tab
4. Click "Simulate Context Loss" button
5. Wait 3 seconds for automatic recovery
6. Observe: object is gone, console has WebGL errors

### Technical Context

The context loss/recovery flow involves:
- `ContextEventHandler.tsx`: Handles `webglcontextlost` and `webglcontextrestored` events
- `ResourceRecovery.ts`: Coordinates resource invalidation and reinitialization
- `TemporalDepthManager.ts` / `TemporalCloudManager.ts`: Manage ping-pong buffers for temporal effects
- `PostProcessing.tsx`: Creates render targets, composer, and post-processing pipeline
- `SchroedingerMesh.tsx`: The mesh component that renders the volumetric object

When context is lost:
- All GPU resources (textures, buffers, VAOs, programs) become invalid
- The browser fires `webglcontextlost` event
- After recovery, `webglcontextrestored` fires
- BUT: Old references to dead GPU objects must NOT be disposed (causes errors)
- AND: New resources must be created for the fresh context

## Success Criteria

After clicking "Simulate Context Loss" and waiting for recovery:
1. The Schroedinger object is visible and rendering (take screenshot, verify visually)
2. Console shows ZERO lines containing "INVALID_OPERATION", "does not belong to this context", or similar WebGL errors
3. The render loop continues (scene animates, FPS counter shows non-zero values)

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps. Do not claim success without evidence.

### Step 0: Initialize

Read log file if provided by the user. Else create log file in `docs/bugfixing/log/context-recovery.md`

### Step 1: Instrument

Add debug logging to capture the recovery flow. Create a Playwright test that:

1. Opens the page
2. Waits for initial render
3. Takes a "before" screenshot
4. Triggers context loss via the debug button OR by calling the store action directly:
   ```javascript
   // In browser console or via Playwright evaluate:
   window.__stores?.webglContext?.getState()?.debugTriggerContextLoss()
   ```
5. Waits 4 seconds (3s recovery delay + 1s buffer)
6. Takes an "after" screenshot
7. Captures all console messages

Instrumentation requirements:
- Log `[CONTEXT-DEBUG]` prefix for all debug output
- Log timestamps for: context lost, context restored, managers reinitialized
- Log any WebGL errors/warnings with full message text
- Compare before/after screenshots for object presence

### Step 2: Observe

Use Playwright to execute the test and capture:

```
BEFORE screenshot: [path]
AFTER screenshot: [path]
Context lost at: [timestamp]
Context restored at: [timestamp]
WebGL errors captured: [count]
  - [error 1]
  - [error 2]
  ...
Object visible in AFTER screenshot: YES/NO (visual inspection or pixel analysis)
```

### Step 3: Hypothesize & Research

Based on observed behavior, investigate:

1. **Why does the object not reappear?**
   - Is the mesh being recreated?
   - Are the uniforms valid?
   - Is the shader recompiled?
   - Are render targets initialized?

2. **Why do WebGL errors occur?**
   - What code path is calling dispose() on dead resources?
   - Which components still hold references to old GPU objects?
   - Is the cleanup/disposal happening at the wrong time?

3. **Research the Three.js/R3F context recovery pattern**
   - How does Three.js handle context loss internally?
   - What does R3F do when context is restored?
   - Are there lifecycle hooks we should use?

Web search topics:
- "three.js webgl context lost restore"
- "react-three-fiber context loss handling"
- "webgl context restore best practices"

### Step 4: Take a Step Back

Review the full recovery pipeline:

1. **ContextEventHandler.tsx**:
   - How is `webglcontextrestored` handled?
   - Is `resourceRecovery.recover()` completing successfully?
   - Is `restoreCount` incrementing?

2. **ResourceRecovery.ts**:
   - Are all managers' `invalidate()` methods being called?
   - Are all managers' `reinitialize()` methods completing?
   - Is there an error being swallowed?

3. **PostProcessing.tsx**:
   - Does the useMemo with `restoreCount` run?
   - Does the cleanup useEffect skip disposal during recovery?
   - Do the useLayoutEffects reinitialize temporal managers?

4. **SchroedingerMesh.tsx**:
   - Does the material get recreated (check `materialKey`)?
   - Are uniforms rebound correctly?
   - Is the mesh still in the scene?

Key questions:
- Is `restoreCount` actually changing?
- Is React re-rendering the affected components?
- Are there circular dependencies or race conditions?
- Is the render loop paused during recovery?

### Step 5: Fix & Verify & Update Log File

Make ONE targeted change. Then re-run Step 2. Compare before/after. Add insights to log file.

**Potential fix areas**:
1. Ensure `invalidateForContextLoss()` nulls resources WITHOUT disposing
2. Ensure `reinitialize()` is actually called and creates new resources
3. Ensure `restoreCount` triggers React re-renders in all necessary components
4. Ensure cleanup functions check context status before disposing
5. Ensure the render loop resumes after recovery

### Step 6: Gate Check

Run quality gates IN ORDER. Stop at first failure.

```
GATE 1 (Object visible after recovery):
  Take screenshot 4 seconds after triggering context loss
  Analyze screenshot for Schroedinger object presence
  Expected: Object is visible (not just floor plane)
  Method: Visual inspection OR pixel color analysis (object has distinct colors)
  Result: PASS/FAIL
  Screenshot path: [path]
  → If FAIL: Mesh not recreated or not rendering. Check material, uniforms, scene.

GATE 2 (Zero WebGL errors):
  Capture all console messages during recovery
  Filter for: "INVALID_OPERATION", "does not belong", "WebGL", "GL ERROR"
  Expected: 0 matching messages after "Context Restored" log
  Result: PASS/FAIL
  Error count: [N]
  → If FAIL: Something is disposing dead resources. Find the dispose() call.

GATE 3 (Render loop continues): ONLY RUN IF GATE 1 AND 2 PASSED
  After recovery, wait 2 more seconds
  Check that the scene is animating (rotation continues)
  Check FPS counter shows > 0
  Take another screenshot to confirm different from first "after" screenshot
  Result: PASS/FAIL
  → If FAIL: Render loop is frozen. Check for blocking errors or state corruption.
```

### Step 7: Document

- Document insights in the log file
- Document every fix that you have tried but has failed in the log file
- Document what worked and what did not work
- **DO NOT OVERWRITE PAST ENTRIES**: preserve the entries about past insights and past fix attempts

## Key Files to Investigate

| File | Purpose | What to Check |
|------|---------|---------------|
| `src/rendering/core/ContextEventHandler.tsx` | Event handling | Lines 67-115: handleContextLost/Restored |
| `src/rendering/core/ResourceRecovery.ts` | Recovery coordinator | recover() method, manager iteration |
| `src/rendering/core/TemporalDepthManager.ts` | Depth buffers | invalidateForContextLoss(), reinitialize() |
| `src/rendering/core/TemporalCloudManager.ts` | Cloud buffers | invalidateForContextLoss(), reinitialize() |
| `src/rendering/environment/PostProcessing.tsx` | Render pipeline | useMemo with restoreCount, cleanup useEffect |
| `src/rendering/environment/Skybox.tsx` | PMREM cache | clearPMREMCacheForContextLoss() |
| `src/stores/slices/webglContextSlice.ts` | Context state | onContextRestored(), restoreCount |
| `src/rendering/renderers/Schroedinger/SchroedingerMesh.tsx` | Mesh component | materialKey with restoreCount |

## Constraints

- Do NOT disable context loss handling entirely
- Do NOT remove the debug "Simulate Context Loss" button
- Do NOT break normal rendering (non-context-loss scenarios must still work)
- Do NOT claim success without gate evidence
- If stuck after 5 iterations, summarize findings and ask for guidance

## Success Declaration Format

Only after ALL THREE gates pass:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]
Gate 1: Object visible after recovery - PASS
  Screenshot: [path]
  Object confirmed present: YES
Gate 2: Zero WebGL errors - PASS
  Error count after recovery: 0
  Console log: [path or summary]
Gate 3: Render loop continues - PASS
  FPS after recovery: [value]
  Animation confirmed: YES
===
```

**WARNING**: If you cannot confirm the Schroedinger object is visible in the screenshot, the bug is NOT fixed. Do NOT proceed to success declaration.

## Playwright Test Template

Save this as `scripts/playwright/context-recovery-test.mjs`:

```javascript
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'screenshots/context-recovery';

async function runTest() {
  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString()
    });
  });

  // Navigate and wait for initial render
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000); // Wait for scene to fully load

  // Take BEFORE screenshot
  const beforePath = path.join(SCREENSHOT_DIR, 'before-context-loss.png');
  await page.screenshot({ path: beforePath });
  console.log(`[CONTEXT-DEBUG] Before screenshot: ${beforePath}`);

  // Trigger context loss via store action
  console.log('[CONTEXT-DEBUG] Triggering context loss...');
  await page.evaluate(() => {
    // Access the store directly
    const store = window.__ZUSTAND_STORE__;
    if (store?.webglContext) {
      store.webglContext.getState().debugTriggerContextLoss();
    } else {
      // Fallback: try to find the button and click it
      console.warn('Store not found, context loss not triggered');
    }
  });

  // Wait for recovery (3s delay + 2s buffer)
  console.log('[CONTEXT-DEBUG] Waiting for recovery...');
  await page.waitForTimeout(5000);

  // Take AFTER screenshot
  const afterPath = path.join(SCREENSHOT_DIR, 'after-context-recovery.png');
  await page.screenshot({ path: afterPath });
  console.log(`[CONTEXT-DEBUG] After screenshot: ${afterPath}`);

  // Analyze console messages for WebGL errors
  const webglErrors = consoleMessages.filter(msg =>
    msg.text.includes('INVALID_OPERATION') ||
    msg.text.includes('does not belong') ||
    msg.text.includes('WebGL:') ||
    msg.text.includes('GL ERROR')
  );

  console.log(`\n[CONTEXT-DEBUG] === RESULTS ===`);
  console.log(`Before screenshot: ${beforePath}`);
  console.log(`After screenshot: ${afterPath}`);
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`WebGL errors found: ${webglErrors.length}`);

  if (webglErrors.length > 0) {
    console.log('\nWebGL Errors:');
    webglErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type}] ${err.text}`);
    });
  }

  // Save full console log
  const logPath = path.join(SCREENSHOT_DIR, 'console-log.json');
  fs.writeFileSync(logPath, JSON.stringify(consoleMessages, null, 2));
  console.log(`\nFull console log: ${logPath}`);

  await browser.close();

  // Return results for gate checking
  return {
    beforeScreenshot: beforePath,
    afterScreenshot: afterPath,
    webglErrorCount: webglErrors.length,
    webglErrors: webglErrors,
    allMessages: consoleMessages
  };
}

runTest().catch(console.error);
```

Run with: `node scripts/playwright/context-recovery-test.mjs`

## Technical Notes

### The WEBGL_lose_context Extension

When simulating context loss:
- `loseContext()` triggers the `webglcontextlost` event
- `restoreContext()` must be called MANUALLY to trigger `webglcontextrestored`
- The browser does NOT auto-restore simulated losses (only real GPU crashes)

### Three.js Context Loss Behavior

- Three.js logs "Context Lost" and "Context Restored" messages
- Internally, it tracks `_isContextLost` state
- Programs, textures, and buffers need recompilation/reupload
- Materials with `needsUpdate = true` force shader recompilation

### React/R3F Considerations

- The `<Canvas>` component handles context events
- Components using `useThree()` get the `gl` renderer
- State stored in Zustand persists across context loss
- Components must re-render to pick up new GPU resources
