# Video Export Feature - Code Review

> **Reviewed by:** Codex CLI (gpt-5.2-codex)
> **Date:** December 20, 2025
> **Scope:** Full in-depth code review of video export functionality

---

## Executive Summary

The video export implementation demonstrates **solid architectural foundations** with clear separation of concerns between the Zustand store, headless controller, recorder class, and UI modal. However, several **high-severity issues** need attention before production use, including non-deterministic timing, unhandled promise rejections, and incomplete error recovery.

---

## Files Reviewed

| File | Purpose |
|------|---------|
| [src/lib/export/video.ts](../src/lib/export/video.ts) | Core VideoRecorder class using mediabunny |
| [src/components/canvas/VideoExportController.tsx](../src/components/canvas/VideoExportController.tsx) | R3F integration and frame capture orchestration |
| [src/stores/exportStore.ts](../src/stores/exportStore.ts) | Zustand state management for export |
| [src/components/ui/ExportModal.tsx](../src/components/ui/ExportModal.tsx) | User interface for export settings |
| [src/lib/export/index.ts](../src/lib/export/index.ts) | Module exports |
| [docs/plans/video-export-requirements.md](../docs/plans/video-export-requirements.md) | Requirements specification |

---

## Findings by Severity

### 🔴 Critical

None found.

---

### 🟠 High Severity

#### 1. Deterministic Timing is Compromised by Real-Time Timestamps

**Location:** [VideoExportController.tsx#L159](../src/components/canvas/VideoExportController.tsx#L159)

```typescript
const timestamp = performance.now() + (currentTime * 1000)
```

**Issue:** Uses a fresh `performance.now()` every frame, so the delta includes real wall-clock delays from `setTimeout`, breaking deterministic playback promised in the requirements doc.

**Impact:** Animation speed varies by device/load; temporal effects can drift.

**Fix:**
```typescript
// Capture start time once at beginning of export
const startTimestamp = performance.now()

// In processFrame:
const timestamp = startTimestamp + (frameIdRef.current * frameDuration * 1000)
```

---

#### 2. Unhandled Promise Rejections in Frame Loop

**Location:** [VideoExportController.tsx#L118](../src/components/canvas/VideoExportController.tsx#L118)

```typescript
const processFrame = async () => {
  // ... await recorder.captureFrame(...) - not wrapped in try/catch
}
setTimeout(processFrame, 0)
```

**Issue:** `processFrame` is invoked via `setTimeout` without its own try/catch; errors in `VideoRecorder.captureFrame` won't be caught by the outer `startExport` try/catch.

**Impact:** Export can fail silently, leaving renderer resized and store stuck in `rendering` state.

**Fix:**
```typescript
const processFrame = async () => {
  try {
    if (abortRef.current || frameIdRef.current >= totalFrames) {
      finishExport(originalSize, originalPixelRatio)
      return
    }
    // ... existing frame capture logic
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Frame capture failed')
    setStatus('error')
    restoreRenderer(originalSize, originalPixelRatio)
  }
}
```

---

#### 3. Renderer Size/Pixel Ratio Not Restored on Early Failure

**Location:** [VideoExportController.tsx#L71-77](../src/components/canvas/VideoExportController.tsx#L71-77) and [#L177-186](../src/components/canvas/VideoExportController.tsx#L177-186)

**Issue:** The renderer is resized during initialization, but the `catch` block only logs and comments about the issue. `originalSize` captured in catch may be wrong since it was already resized.

**Impact:** App remains at export resolution after an initialization error (mediabunny, WebCodecs, etc.).

**Fix:** Hoist `originalSize`/`originalPixelRatio` into refs and restore in a `finally` around the whole export:

```typescript
const originalSizeRef = useRef<THREE.Vector2>(new THREE.Vector2())
const originalPixelRatioRef = useRef<number>(1)

const startExport = async () => {
  // Save BEFORE any resize
  gl.getSize(originalSizeRef.current)
  originalPixelRatioRef.current = gl.getPixelRatio()

  try {
    // ... export logic
  } catch (e) {
    // ... error handling
  } finally {
    // Always restore
    gl.setSize(originalSizeRef.current.x, originalSizeRef.current.y, false)
    gl.setPixelRatio(originalPixelRatioRef.current)
  }
}
```

---

### 🟡 Medium Severity

#### 4. WebM Format Selection is Ignored

**Location:** [video.ts#L15](../src/lib/export/video.ts#L15), [video.ts#L37](../src/lib/export/video.ts#L37)

```typescript
format: 'mp4' | 'webm'  // Defined in interface
// But always uses:
const format = new Mp4OutputFormat()  // Hardcoded
```

**Issue:** Format option is exposed but `initialize()` always uses `Mp4OutputFormat` and `finalize()` returns `video/mp4`. Download uses `.mp4` extension unconditionally.

**Impact:** Choosing WebM would still produce MP4 with incorrect extension.

**Fix:** Either disable WebM in UI until supported, or implement WebM output path with correct MIME type and filename extension.

---

#### 5. Object URL Memory Leak

**Location:** [VideoExportController.tsx#L201](../src/components/canvas/VideoExportController.tsx#L201), [exportStore.ts#L65-70](../src/stores/exportStore.ts#L65-70)

```typescript
const url = URL.createObjectURL(blob)  // Created
// Never revoked - reset() only nulls the string
```

**Issue:** `URL.createObjectURL` is never revoked; `reset` only nulls the string and `handleDownload` doesn't revoke.

**Impact:** Large blobs accumulate in memory across multiple exports.

**Fix:**
```typescript
// In exportStore.ts:
setPreviewUrl: (url) => set((state) => {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl)
  }
  return { previewUrl: url }
}),
```

---

#### 6. Abort/Cancel Desync During Encoding Phase

**Location:** [ExportModal.tsx#L31-41](../src/components/ui/ExportModal.tsx#L31-41)

**Issue:** `handleClose` only confirms cancel during `rendering` status, but closing during `encoding` will reset state while `finalize()` continues in background.

**Impact:** Background encode may later set `completed` and leak URLs while modal is closed.

**Fix:** Block close during encoding, or gate `setStatus`/`setPreviewUrl` calls on `isExporting && isModalOpen`, and add an abort signal to `finalize` if possible.

---

#### 7. Missing Input Validation for Settings

**Location:** [ExportModal.tsx#L215-228](../src/components/ui/ExportModal.tsx#L215-228)

```typescript
onChange={(e) => updateSettings({ customWidth: Number(e.target.value) })}
```

**Issue:** `customWidth/customHeight` are set from raw `Number(e.target.value)`, then used to resize renderer. No validation for NaN, 0, negative, or excessively large values.

**Impact:** `NaN/0/negative/huge` values can blow memory or fail `gl.setSize`.

**Fix:**
```typescript
// In store or before use:
const clampDimension = (val: number) =>
  Math.max(128, Math.min(7680, Math.round(val) || 1920))

// Add min/max/step to inputs
<input type="number" min="128" max="7680" step="2" />
```

---

### 🟢 Low Severity

#### 8. Progress Never Reaches 100%

**Location:** [video.ts#L78](../src/lib/export/video.ts#L78)

```typescript
const progress = Math.min((timestamp / totalDuration), 0.99)
```

**Issue:** Progress is capped at 0.99 and no later update sets it to 1.

**Impact:** UI shows 99% even after success.

**Fix:** Set `setProgress(1)` when status changes to `completed`.

---

#### 9. Incomplete Resource Cleanup in VideoRecorder

**Location:** [video.ts#L19-61](../src/lib/export/video.ts#L19-61)

**Issue:** No `dispose()`/`close()` for `source/output/target` and abort path skips finalize.

**Impact:** Memory pressure for long renders.

**Fix:**
```typescript
dispose() {
  this.isRecording = false
  this.source = null
  this.output = null
  this.target = null
}
```

---

#### 10. Accessibility Gaps in Modal

**Location:** [ExportModal.tsx#L65-96](../src/components/ui/ExportModal.tsx#L65-96)

**Issue:** Modal lacks `role="dialog"`, `aria-modal`, focus management, and aria-live updates for status changes.

**Impact:** Keyboard/screen-reader usability is limited.

**Fix:**
```tsx
<m.div
  role="dialog"
  aria-modal="true"
  aria-labelledby="export-modal-title"
  // Add focus trap logic
>
```

---

## Requirements Conformance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Frame-by-frame rendering | ✅ Implemented | Uses `advance()` correctly |
| MediaStream Recording API fallback | ❌ Missing | Listed in requirements but not implemented |
| MP4 output | ✅ Working | Via mediabunny |
| WebM output | ⚠️ Broken | UI exposed but ignored |
| Preview function | ✅ Working | Video player after completion |
| Cancel capability | ⚠️ Partial | Works during rendering, issues during encoding |
| Duration control | ✅ Working | 1-30 seconds slider |
| Bitrate control | ✅ Working | 2-50 Mbps slider |
| Resolution presets | ✅ Working | 720p/1080p/4K/Custom |
| Estimated file size | ✅ Working | Calculated from bitrate × duration |
| Warmup frames | ✅ Working | Configurable in settings |
| Deterministic rendering | ⚠️ Broken | Timing uses wall-clock (see High #1) |

---

## Positive Practices Worth Keeping

1. **Clear Separation of Concerns** - Store, headless controller, recorder, and modal are properly decoupled
2. **Correct R3F Integration** - `advance()` is used to drive the full pipeline including post-processing
3. **UI Responsiveness** - Yielding to main thread via `setTimeout` during long renders
4. **Encoder Compatibility** - Even-dimension enforcement and pixel ratio forcing
5. **Visual Feedback** - Progress UI and cancel affordance are present and clear

---

## Concrete Recommendations

### Immediate Actions (Before Release)

1. **Fix deterministic timing** - Use captured start timestamp + frame index
2. **Add try/catch in processFrame** - Prevent unhandled promise rejections
3. **Fix renderer restoration** - Store original values in refs before any resize
4. **Revoke object URLs** - Clean up in `setPreviewUrl` and `reset`

### Short-Term Improvements

5. **Implement state machine** - Single export lifecycle (idle → rendering → encoding → completed/error/aborted) to prevent desync
6. **Validate settings** - Clamp ranges, ensure integers, handle NaN
7. **Add VideoRecorder.dispose()** - Clean up resources on abort and after finalize
8. **Fix/remove WebM** - Either implement or hide from UI

### Medium-Term Enhancements

9. **Add accessibility** - Dialog role, focus trap, aria-live announcements
10. **Add tests** - Store transition unit tests + integration test for renderer restoration
11. **Streaming target** - If mediabunny supports it, reduce memory spikes on long exports
12. **Implement MediaStream fallback** - For quick/draft mode per requirements

---

## Test Coverage Recommendations

```typescript
// Suggested test cases

describe('VideoExportController', () => {
  it('restores renderer size on successful export')
  it('restores renderer size on error during initialization')
  it('restores renderer size on user cancellation')
  it('handles mediabunny initialization failure gracefully')
})

describe('useExportStore', () => {
  it('transitions: idle → rendering → encoding → completed')
  it('transitions: rendering → error on failure')
  it('revokes previous URL when setting new previewUrl')
  it('validates dimension inputs within acceptable range')
})

describe('VideoRecorder', () => {
  it('throws when capturing before initialize()')
  it('throws when finalizing without capture')
  it('disposes resources on abort')
})
```

---

## Appendix: Commands Run During Review

```bash
rg -n "" /Users/Spare/Documents/code/mdimension/src/lib/export/video.ts
rg -n "" /Users/Spare/Documents/code/mdimension/src/components/canvas/VideoExportController.tsx
rg -n "" /Users/Spare/Documents/code/mdimension/src/components/ui/ExportModal.tsx
rg -n "" /Users/Spare/Documents/code/mdimension/src/stores/exportStore.ts
rg --files -g '*video-export*' /Users/Spare/Documents/code/mdimension
nl -ba  # For line references
```

---

*Review completed using Codex CLI code reviewer role.*
