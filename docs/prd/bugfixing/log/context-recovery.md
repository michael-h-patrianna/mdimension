# WebGL Context Recovery Bug - Investigation Log

## Bug Summary
When simulating WebGL context loss and recovery, the Schroedinger object disappears and WebGL errors flood the console.

---

## Prior Fix Attempts (Session 1)

### Attempt 1: Added `invalidateForContextLoss()` methods
**Files modified:**
- `TemporalDepthManager.ts` - Added method to null render targets without disposing
- `TemporalCloudManager.ts` - Same
- `Skybox.tsx` - Added `clearPMREMCacheForContextLoss()`

**Result:** Reduced WebGL errors from 76+27 to 14+13, but still present. Object still not reappearing.

**Learning:** Disposing resources from dead context causes "object does not belong to this context" errors. Must null references instead.

---

### Attempt 2: Added `restoreCount` to mesh material keys
**Files modified:**
- `SchroedingerMesh.tsx` - Added `restoreCount` to `materialKey` dependency
- `MandelbulbMesh.tsx` - Same
- `QuaternionJuliaMesh.tsx` - Same

**Result:** Material keys now change on context restore, but object still not reappearing.

**Learning:** Material recreation alone is not sufficient.

---

### Attempt 3: Skip disposal in PostProcessing cleanup during context restore
**Files modified:**
- `PostProcessing.tsx` - Check context status in cleanup useEffect, skip if restoring/lost

**Result:** Still WebGL errors present.

**Learning:** There may be other disposal paths not covered.

---

### Attempt 4: Added `restoreCount` to temporal manager initialization effects
**Files modified:**
- `PostProcessing.tsx` - Added `restoreCount` to useLayoutEffect dependencies for TemporalDepthManager.initialize() and TemporalCloudManager.initialize()

**Result:** Not tested yet - this was the last change before switching to test-driven approach.

**Hypothesis:** The useLayoutEffects for temporal manager initialization were not re-running after context restore because `restoreCount` was not in their dependencies.

---

## Open Questions

1. Is `restoreCount` actually being incremented? Where exactly in the flow?
2. Are React components re-rendering when `restoreCount` changes?
3. Is there a race condition between recovery and render loop?
4. What other components might be holding references to dead GPU resources?
5. Does Three.js/R3F have built-in context recovery that we're interfering with?

---

## Investigation Notes

### Files Known to Register with ResourceRecovery
- `TemporalDepthManager.ts` - priority 20
- `TemporalCloudManager.ts` - priority 30
- `Skybox.tsx` (SkyboxPMREMCache) - priority 60

### Context Status Values
- `active` - Normal operation
- `lost` - Context has been lost
- `restoring` - Recovery in progress
- `failed` - Recovery failed after max attempts

### Observed Error Messages
```
WebGL: INVALID_OPERATION: delete: object does not belong to this context
WebGL: INVALID_OPERATION: deleteVertexArray: object does not belong to this context
[TemporalDepthManager] Temporal reprojection enabled but render targets are null
[TemporalCloudManager] Temporal reprojection enabled but render targets are null
```

---

## Next Steps

1. Run the Playwright test to get baseline measurements
2. Verify `restoreCount` is incrementing
3. Add console logs to track component re-renders
4. Trace where remaining dispose() calls originate

---

*Log started: 2024-12-18*
