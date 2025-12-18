# WebGL Context Recovery Bug Fix Log

## Bug Description
When simulating WebGL context loss and recovery, the Schroedinger object disappears and does not reappear after context is restored. WebGL errors flood the console.

## Session: 2025-12-18

### Initial State
- Bug: Schroedinger object disappears after context recovery
- Errors: "object does not belong to this context", "deleteVertexArray" errors
- Temporal managers report null render targets after recovery

---

## Observations

### Observation 1: Initial Playwright Test (2025-12-18T10:30)

**Test Results:**
- BEFORE screenshot: Schroedinger object visible (green volumetric cloud), 28 FPS
- AFTER screenshot: Schroedinger object GONE (only grid floor visible), 52 FPS
- WebGL errors: 27 total
  - 14x "delete: object does not belong to this context"
  - 13x "deleteVertexArray: object does not belong to this context"
- Console warnings: Hundreds of "[TemporalDepthManager] Temporal reprojection enabled but render targets are null"

**Timeline:**
- Context Lost at: 2025-12-18T10:30:19.394Z
- Context Restored at: 2025-12-18T10:30:22.388Z (3 seconds later)
- First temporal null warning: 2025-12-18T10:30:22.629Z (241ms after restore)
- Warnings continue flooding console on every frame

**Gate Results (Initial):**
- GATE 1: FAIL - Object not visible in AFTER screenshot
- GATE 2: FAIL - 27 WebGL errors
- GATE 3: PARTIAL - Render loop continues (52 FPS) but without the object

---

## Hypotheses

### Hypothesis 1: Cleanup Disposes Temporal Managers After Recovery (CONFIRMED)

The cleanup useEffect in PostProcessing.tsx disposes temporal managers AFTER they've been reinitialized by resourceRecovery.recover().

**Sequence of Events:**
1. Context restored event fires
2. resourceRecovery.recover(gl) is called
3. TemporalDepthManager.invalidateForContextLoss() nulls render targets
4. TemporalDepthManager.reinitialize(gl) creates NEW render targets ✓
5. onContextRestored() sets status='active' and increments restoreCount
6. React schedules re-render of PostProcessing
7. useMemo sees restoreCount changed, creates new composer
8. useEffect cleanup runs (dependencies changed)
9. Cleanup checks contextStatus... which is 'active'! (guard fails)
10. Cleanup calls TemporalDepthManager.dispose() ← BUG!
11. Render targets become null again

### Hypothesis 2: Dispose on Dead Context Objects (CONFIRMED)

The cleanup useEffect tries to dispose render targets (sceneTarget, objectDepthTarget, etc.) that were created with the OLD WebGL context. By the time cleanup runs, contextStatus is 'active', so the guard doesn't prevent disposal.

---

## Fix Attempts

### Attempt 1: Remove Singleton Disposal + Add RestoreCount Guard (SUCCESS)

**Fix Strategy:**
1. Remove TemporalDepthManager.dispose() and TemporalCloudManager.dispose() from PostProcessing's cleanup
   - These are singletons managed by resourceRecovery
   - PostProcessing shouldn't dispose them on its own
2. Add a ref to track restoreCount when useMemo creates objects
3. In cleanup, skip ALL disposal if restoreCount has changed
   - Objects from dead context shouldn't be disposed

**Implementation:**
File: `src/rendering/environment/PostProcessing.tsx`

Changes made:
1. Added `createdAtRestoreCountRef` to track when resources were created:
   ```typescript
   const createdAtRestoreCountRef = useRef(restoreCount);
   ```

2. Updated useMemo to track creation time:
   ```typescript
   const { composer, ... } = useMemo(() => {
     createdAtRestoreCountRef.current = restoreCount;
     // ... create objects
   }, [gl, restoreCount]);
   ```

3. Updated cleanup useEffect to check restoreCount instead of contextStatus:
   ```typescript
   useEffect(() => {
     const createdAt = createdAtRestoreCountRef.current;
     return () => {
       const currentRestoreCount = useWebGLContextStore.getState().restoreCount;
       if (currentRestoreCount > createdAt) {
         return; // Skip disposal - objects are from dead context
       }
       // Normal disposal for unmount
       composer.dispose();
       // ... other disposals ...
       // NOTE: Do NOT dispose TemporalDepthManager/TemporalCloudManager here!
     };
   }, [composer, ...]);
   ```

4. Removed singleton disposal calls:
   - Removed `TemporalDepthManager.dispose()`
   - Removed `TemporalCloudManager.dispose()`

---

## Learnings

### Learning 1: Context Status Check Timing
The cleanup useEffect runs AFTER onContextRestored() is called, so checking `contextStatus === 'restoring'` doesn't work. By cleanup time, status is already 'active'.

### Learning 2: Singleton Lifecycle Management
Singletons (TemporalDepthManager, TemporalCloudManager) should not be disposed by individual components. Their lifecycle is managed by resourceRecovery.

### Learning 3: useMemo Cleanup Pattern
When useMemo depends on restoreCount and creates GPU resources, the cleanup useEffect for those resources needs a way to distinguish:
- Normal unmount → dispose resources
- Context recovery re-creation → skip disposal (old resources are from dead context)

---

## Quality Gate Results

### Gate 1: Object visible after recovery
- Status: **PASS**
- Screenshot: `screenshots/context-recovery/after-context-recovery.png`
- Object confirmed: YES - Schroedinger volumetric cloud visible with same appearance as before context loss

### Gate 2: Zero WebGL errors
- Status: **PASS**
- Error count: 0
- Console log: No "INVALID_OPERATION", "does not belong", or "WebGL:" errors after context restoration

### Gate 3: Render loop continues
- Status: **PASS**
- FPS after recovery: 24 FPS
- Animation confirmed: YES - Comparing after-context-recovery.png and after-context-recovery-2.png shows object has rotated/changed

---

## Resolution

=== BUG FIXED ===

**Root cause:** The cleanup useEffect in PostProcessing.tsx disposed temporal managers and local render targets after context restoration. By the time cleanup ran, contextStatus was already 'active', so the guard check failed. Additionally, temporal managers (singletons) were being disposed by PostProcessing, nulling their render targets that resourceRecovery had just reinitialized.

**Fix applied:**
- `src/rendering/environment/PostProcessing.tsx:116-118` - Added `createdAtRestoreCountRef` to track when resources were created
- `src/rendering/environment/PostProcessing.tsx:199-200` - Track restoreCount in useMemo
- `src/rendering/environment/PostProcessing.tsx:694-725` - Check restoreCount in cleanup instead of contextStatus, skip disposal if context was restored; removed TemporalDepthManager.dispose() and TemporalCloudManager.dispose() calls

**Gate 1:** Object visible after recovery - PASS
- Screenshot: `screenshots/context-recovery/after-context-recovery.png`
- Object confirmed present: YES

**Gate 2:** Zero WebGL errors - PASS
- Error count after recovery: 0
- Console log: No WebGL errors

**Gate 3:** Render loop continues - PASS
- FPS after recovery: 24
- Animation confirmed: YES

===
