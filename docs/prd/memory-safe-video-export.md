# Memory-Safe Video Export System PRD

## Overview

**Feature**: Memory-Safe Multi-Tier Video Export
**Version**: 1.0
**Date**: 2024-12-20
**Status**: Ready for Development

### Problem Statement

The current video export system writes directly to RAM, then offers a preview and download. This approach fails catastrophically for large/long/high-quality exports, especially when:
- Users request high resolution (4K) or high bitrate (50 Mbps) exports
- Users request long durations (30+ seconds)
- The browser tab has been open for hours (reduced memory allowance)
- Users are on memory-constrained devices (mobile, older hardware)

### Solution

A multi-tier export system that automatically selects the safest export strategy based on estimated file size and browser capabilities:

| Tier | Mode | When Used | Browser |
|------|------|-----------|---------|
| 1 | In-Memory | < 100 MB exports | All browsers |
| 2 | Stream-to-File | ≥ 100 MB exports | Chrome, Edge, Opera, Brave |
| 3 | Segmented | ≥ 100 MB exports | Safari, Firefox |

---

## Configuration Constants

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Small export threshold | < 50 MB | Safe everywhere, green indicator |
| Medium export threshold | 50–150 MB | Caution indicator, still uses in-memory |
| Large export threshold | > 150 MB | Warning indicator, requires streaming/segments |
| Auto-mode switch threshold | 100 MB | Conservative threshold for automatic mode selection |
| Segment target size | 50 MB | Empirically safe on mobile Safari and constrained devices |
| Minimum segment duration | 5 seconds | Prevents excessive file fragmentation |
| Preview clip length | 3 seconds | Enough to verify quality, minimal memory |
| Chunk write size | 16 MB | Reduces write-call overhead for streaming |

---

## User Stories

### User Story 1: Estimate Export Size Before Starting

**User story:** As a user, I want to see an accurate estimate of my export's file size and memory requirements before starting so I can make informed decisions about my export settings.

**Acceptance criteria**
1. System displays estimated file size using formula: `estimatedBytes = durationSeconds × (videoBitrateBps) / 8`
2. Estimate updates in real-time as user adjusts duration, resolution, bitrate, or FPS
3. Estimate is displayed prominently in the export settings panel with unit formatting (KB/MB/GB)
4. System classifies exports into size tiers with distinct visual styling:
   - **Small** (< 50 MB): Green indicator
   - **Medium** (50–150 MB): Amber/yellow indicator
   - **Large** (> 150 MB): Red indicator
5. Size tier badge is displayed next to the estimate

**Test scenarios**

Scenario 1: Estimate for default settings
- Given the user opens the export modal with default settings (1080p, 60fps, 5s, 12 Mbps)
- When the modal loads
- Then the user sees an estimated size of approximately "7.5 MB" with a "Small" tier badge (green)

Scenario 2: Estimate updates on setting change
- Given the user is viewing the export settings
- When the user changes duration from 5s to 30s
- Then the estimated size updates immediately to approximately "45 MB"

Scenario 3: Large export indicator for 4K long video
- Given the user selects 4K resolution, 60 FPS, 30 seconds, 50 Mbps
- When the settings are applied
- Then the user sees an estimated size of approximately "187.5 MB" with a "Large" tier badge (red)

Scenario 4: Medium export indicator
- Given the user selects 1080p, 30 FPS, 30 seconds, 20 Mbps
- When the settings are applied
- Then the user sees an estimated size of approximately "75 MB" with a "Medium" tier badge (amber)

---

### User Story 2: Detect Browser Capabilities

**User story:** As the system, I want to detect the user's browser capabilities so I can select the optimal export strategy for their environment.

**Acceptance criteria**
1. System detects whether the browser supports File System Access API (`window.showSaveFilePicker`)
2. System identifies browser as "Chromium-capable" (Chrome, Edge, Opera, Brave) or "Standard" (Safari, Firefox)
3. Detection runs once on export modal open and caches the result for the session
4. Detection result is available to other export components via the export store
5. System gracefully handles browsers where capability detection throws errors (defaults to "Standard")

**Test scenarios**

Scenario 1: Chrome browser detected
- Given the user opens the export modal in Chrome
- When the system performs capability detection
- Then the system identifies "Chromium-capable" browser with File System Access API support

Scenario 2: Safari browser detected
- Given the user opens the export modal in Safari
- When the system performs capability detection
- Then the system identifies "Standard" browser without File System Access API

Scenario 3: Detection error handling
- Given the browser throws an error during capability detection
- When the system attempts detection
- Then the system defaults to "Standard" browser mode without crashing

Scenario 4: Detection is cached
- Given capability detection has already run
- When the user closes and reopens the export modal
- Then the cached result is used without re-running detection

---

### User Story 3: Guide Users to Optimal Browser for Large Exports

**User story:** As a user on Safari or Firefox, I want to be informed that Chrome or Edge provides better support for large exports so I can make an informed choice.

**Acceptance criteria**
1. When user's export is classified as "Large" (> 150 MB) AND browser is "Standard", system displays a browser recommendation notice
2. Notice appears below the estimated size, styled as an informational callout (blue/info styling, not blocking)
3. Notice text: "For large exports, Chrome or Edge can save directly to disk without memory limits."
4. Notice includes browser icons (Chrome, Edge) for visual clarity
5. Notice is dismissible via an "×" button
6. Dismissal is remembered for the current session (does not reappear until page reload)
7. Notice does NOT appear for Chromium-capable browsers
8. Notice does NOT appear for Small or Medium exports

**Test scenarios**

Scenario 1: Large export on Firefox shows recommendation
- Given the user is on Firefox with a "Large" export configured (> 150 MB)
- When the user views the export settings
- Then the user sees a browser recommendation notice with Chrome and Edge icons

Scenario 2: Large export on Chrome shows no recommendation
- Given the user is on Chrome with a "Large" export configured
- When the user views the export settings
- Then no browser recommendation notice is displayed

Scenario 3: Small export on Firefox shows no recommendation
- Given the user is on Firefox with a "Small" export configured (< 50 MB)
- When the user views the export settings
- Then no browser recommendation notice is displayed

Scenario 4: User dismisses recommendation
- Given the user sees the browser recommendation notice
- When the user clicks the dismiss button
- Then the notice disappears and does not reappear during the session

Scenario 5: Medium export shows no recommendation
- Given the user is on Safari with a "Medium" export configured (75 MB)
- When the user views the export settings
- Then no browser recommendation notice is displayed

---

### User Story 4: Select Export Mode Based on Size and Browser

**User story:** As the system, I want to automatically select the appropriate export mode based on export size and browser capabilities so the export completes reliably without crashing.

**Acceptance criteria**
1. System selects "In-Memory" mode when export size < 100 MB (regardless of browser)
2. System selects "Stream-to-File" mode when export size ≥ 100 MB AND browser is Chromium-capable
3. System selects "Segmented" mode when export size ≥ 100 MB AND browser is Standard (Safari/Firefox)
4. Mode selection happens automatically when export settings change
5. Selected mode is displayed in the export settings as a subtle indicator (e.g., icon + tooltip)
6. User can override automatic selection via an "Advanced Settings" section
7. Override toggle shows warning: "Manual mode selection may cause browser crashes on some devices"
8. Override preference is NOT persisted (resets to automatic on modal close)

**Test scenarios**

Scenario 1: Small export selects In-Memory
- Given the user has configured a 50 MB export on Chrome
- When the export mode is determined
- Then the system selects "In-Memory" mode and displays the indicator

Scenario 2: Large export on Chrome selects Stream-to-File
- Given the user has configured a 200 MB export on Chrome
- When the export mode is determined
- Then the system selects "Stream-to-File" mode

Scenario 3: Large export on Safari selects Segmented
- Given the user has configured a 200 MB export on Safari
- When the export mode is determined
- Then the system selects "Segmented" mode

Scenario 4: User overrides to In-Memory with warning
- Given the user has a 200 MB export on Safari
- When the user enables advanced settings and selects "In-Memory" mode
- Then the warning is displayed and the mode is set to In-Memory

Scenario 5: Override resets on modal close
- Given the user has overridden the export mode
- When the user closes and reopens the modal
- Then automatic mode selection is restored

---

### User Story 5: Export Using In-Memory Mode (Tier 1)

**User story:** As a user with a small export, I want my video rendered to memory with preview and download options so I can review before saving.

**Acceptance criteria**
1. Export renders frames to an in-memory buffer using MediaBunny's BufferTarget
2. Progress indicator shows: circular ring, percentage, ETA, frame count
3. Upon completion, system generates a video preview playable in the modal
4. Preview plays inline with standard video controls (play, pause, seek, volume)
5. Preview auto-plays and loops
6. Download button saves the video with suggested filename `mdimension-{timestamp}.mp4`
7. "New Export" button clears the preview and returns to settings
8. System revokes the preview URL when modal closes or new export starts (memory cleanup)

**Test scenarios**

Scenario 1: Successful in-memory export with preview
- Given the user starts a small export (5s, 1080p, 12 Mbps)
- When the export completes
- Then the user sees a video preview that auto-plays and loops, plus a "Download Video" button

Scenario 2: Progress display during rendering
- Given an in-memory export is 50% complete
- When the user views the modal
- Then they see a circular progress ring at 50%, ETA, and "Rendering Frame by Frame..."

Scenario 3: Download saves file correctly
- Given the user has completed an in-memory export
- When the user clicks "Download Video"
- Then the browser downloads a file named `mdimension-{timestamp}.mp4`

Scenario 4: Memory cleanup on modal close
- Given the user has a preview loaded
- When the user closes the export modal
- Then the system revokes the preview URL to free memory

Scenario 5: New Export clears state
- Given the user has a completed export with preview
- When the user clicks "New Export"
- Then the preview is cleared and settings are shown

---

### User Story 6: Export Using Stream-to-File Mode (Tier 2)

**User story:** As a user on Chrome or Edge with a large export, I want my video streamed directly to a file on disk so the export doesn't consume excessive memory.

**Acceptance criteria**
1. Before rendering begins, system prompts user to select a save location using the native file picker (`showSaveFilePicker`)
2. File picker suggests filename `mdimension-{timestamp}.mp4` with MP4 file type filter
3. User can cancel the file picker to abort the export before any rendering occurs
4. Video frames are encoded and written directly to the selected file using MediaBunny's StreamTarget
5. System uses fragmented MP4 format (`fastStart: "fragmented"`) for streaming compatibility
6. System writes in 16 MB chunks (`chunkSize: 16 * 1024 * 1024`) to reduce write-call overhead
7. Progress indicator shows: linear progress bar, percentage, ETA, filename being saved
8. Upon completion, system displays success message: "Export Complete! Saved to {filename}"
9. If user cancels mid-export, system closes the file handle gracefully
10. Partial file may remain on disk after cancellation (user is informed)

**Test scenarios**

Scenario 1: File picker appears for large Chromium export
- Given the user is on Chrome with a 200 MB export configured
- When the user clicks "Start Rendering"
- Then the system displays the native file save dialog before rendering begins

Scenario 2: User selects save location and export starts
- Given the file save dialog is displayed
- When the user selects a location and confirms
- Then rendering begins and progress shows percentage, ETA, and filename

Scenario 3: User cancels file picker
- Given the file save dialog is displayed
- When the user cancels the dialog
- Then the export is aborted, no rendering occurs, and modal returns to settings

Scenario 4: Export completes successfully
- Given a stream-to-file export is in progress
- When all frames are rendered and written
- Then the user sees "Export Complete! Saved to {filename}"

Scenario 5: User cancels mid-export
- Given a stream-to-file export is 50% complete
- When the user clicks "Cancel"
- Then the file handle closes, user sees "Export cancelled. Partial file may remain on disk."

Scenario 6: Progress shows file information
- Given a stream-to-file export is 30% complete
- When the user views the modal
- Then they see a linear progress bar, "30%", ETA, and "Saving to render.mp4..."

---

### User Story 7: Export Using Segmented Mode (Tier 3)

**User story:** As a user on Safari or Firefox with a large export, I want my video exported as multiple smaller segments so each segment downloads safely without overwhelming memory.

**Acceptance criteria**
1. System calculates segment duration dynamically: `segment_duration = target_size_bytes / (bitrate_bps / 8)`
2. Target segment size is 50 MB (ensures memory safety across all devices)
3. Minimum segment duration is 5 seconds (prevents excessive file fragmentation at high bitrates)
4. Maximum segment duration is capped at the full export duration (single segment if small enough)
5. Each segment is a complete, playable MP4 file
6. Segments are named sequentially: `mdimension-{timestamp}-part1.mp4`, `part2.mp4`, etc.
7. Each segment downloads automatically as it completes (browser's default download behavior)
8. Progress indicator shows: segment counter (X of Y), segment progress ring, overall progress bar
9. Upon completion of all segments, system displays summary: "Export Complete! {N} segments downloaded"
10. System provides expandable merge instructions for power users

**Test scenarios**

Scenario 1: Segment count calculated correctly
- Given the user is on Safari with a 30-second export at 50 Mbps (~187 MB total)
- When the export settings are displayed
- Then the user sees "This export will create 4 segments" (50 MB each ≈ 8 seconds)

Scenario 2: Low bitrate creates fewer segments
- Given the user is on Firefox with a 30-second export at 12 Mbps (~45 MB total)
- When the export settings are displayed
- Then the user sees "This export will create 1 segment" (under 50 MB threshold)

Scenario 3: Segments download sequentially
- Given a segmented export is in progress
- When segment 1 completes
- Then segment 1 downloads automatically and rendering continues for segment 2

Scenario 4: Progress shows segment information
- Given segment 2 of 4 is being rendered at 65% of that segment
- When the user views the progress indicator
- Then the user sees "Segment 2 of 4", segment progress at 65%, and overall progress bar

Scenario 5: All segments complete
- Given segment 4 of 4 finishes
- When the final segment downloads
- Then the user sees "Export Complete! 4 segments downloaded" with merge instructions link

Scenario 6: Minimum segment duration enforced
- Given the user configures 50 Mbps bitrate (which would create 1.6s segments for 50 MB)
- When segment duration is calculated
- Then minimum 5-second segments are used instead

---

### User Story 8: Provide Merge Instructions for Segmented Exports

**User story:** As a power user who exported segments, I want clear instructions on how to merge them into a single video file.

**Acceptance criteria**
1. Merge instructions appear after all segments complete as an expandable/collapsible section
2. Section header: "Need a single file? Here's how to merge"
3. Instructions are collapsed by default to reduce visual clutter
4. Instructions include step-by-step guide:
   - Step 1: Create a text file named `filelist.txt`
   - Step 2: Add each segment on a new line with format: `file 'mdimension-{timestamp}-part1.mp4'`
   - Step 3: Run FFmpeg command
5. FFmpeg command displayed in monospace code block: `ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged.mp4`
6. Copy button allows one-click copy of the FFmpeg command
7. Copy button shows "Copied!" confirmation for 2 seconds
8. Alternative suggestion: "Or use Chrome/Edge for single-file exports"
9. Link to FFmpeg download page for users who don't have it installed

**Test scenarios**

Scenario 1: Merge instructions appear after segmented export
- Given a 4-segment export has completed
- When the user views the completion screen
- Then collapsible merge instructions are visible with header "Need a single file?"

Scenario 2: Instructions are collapsed by default
- Given the completion screen is displayed
- When the user first sees merge instructions
- Then the instructions section is collapsed (only header visible)

Scenario 3: User expands instructions
- Given the merge instructions are collapsed
- When the user clicks the expand toggle
- Then full instructions with FFmpeg command are displayed

Scenario 4: User copies FFmpeg command
- Given the merge instructions are expanded
- When the user clicks the copy button
- Then the FFmpeg command is copied to clipboard and button shows "Copied!"

Scenario 5: Alternative browser suggestion shown
- Given the merge instructions are expanded
- When the user views the instructions
- Then they see "Or use Chrome/Edge for single-file exports" suggestion

---

### User Story 9: Generate Preview for Stream-to-File Exports

**User story:** As a user exporting via stream-to-file, I want a short preview so I can verify the export looks correct without opening the saved file.

**Acceptance criteria**
1. System renders a 3-second preview clip to memory before starting the full disk export
2. Preview generation happens after file picker confirmation, before main export
3. Preview appears in the modal with label: "Preview (first 3 seconds)"
4. Message below preview: "Full video saved to {filename}"
5. Preview uses same settings (resolution, FPS, bitrate) as full export
6. Preview plays with standard video controls, auto-plays, and loops
7. Preview memory (blob URL) is released when modal closes
8. If user cancels during preview generation, no file is written to disk
9. Preview generation progress shows: "Generating preview..." with small spinner

**Test scenarios**

Scenario 1: Preview displays after stream-to-file export completes
- Given the user completes a stream-to-file export
- When the completion screen appears
- Then a 3-second preview video is shown with label "Preview (first 3 seconds)"

Scenario 2: Preview matches export quality
- Given the user selected 4K, 60 FPS, 25 Mbps
- When the preview renders
- Then the preview displays at 4K, 60 FPS quality

Scenario 3: Full file location shown
- Given the stream-to-file export completed to "render.mp4"
- When the completion screen appears
- Then message shows "Full video saved to render.mp4"

Scenario 4: Cancel during preview generation
- Given preview generation is in progress
- When the user clicks "Cancel"
- Then preview generation stops and no file is written to disk

Scenario 5: Preview memory cleanup
- Given the completion screen with preview is displayed
- When the user closes the modal
- Then the preview blob URL is revoked

---

### User Story 10: Cancel Export Gracefully at Any Stage

**User story:** As a user, I want to cancel an export at any time and have the system clean up properly so I can start fresh.

**Acceptance criteria**
1. Cancel button is visible and enabled during rendering and encoding phases
2. Cancel button is disabled during the brief finalization phase (< 1 second typically)
3. Cancellation stops rendering within one frame (checks abort flag each frame)
4. For In-Memory mode: buffer is discarded, no blob created
5. For Stream-to-File mode: file handle is closed properly, user informed partial file may remain
6. For Segmented mode: current segment is discarded, previous segments remain downloaded
7. System restores renderer to original size, pixel ratio, and quality settings
8. Modal returns to idle state with all settings preserved
9. User sees confirmation message appropriate to the mode
10. No memory leaks occur from incomplete exports (all refs cleaned up)

**Test scenarios**

Scenario 1: Cancel during in-memory rendering
- Given an in-memory export is 30% complete
- When the user clicks "Cancel"
- Then rendering stops, renderer is restored, modal shows "Export cancelled"

Scenario 2: Cancel during stream-to-file
- Given a stream-to-file export is 50% complete
- When the user clicks "Cancel"
- Then file handle closes, message shows "Export cancelled. Partial file may remain on disk."

Scenario 3: Cancel during segmented export
- Given segment 2 of 4 is being rendered
- When the user clicks "Cancel"
- Then current segment is discarded, message shows "Export cancelled. 1 segment was already downloaded."

Scenario 4: Settings preserved after cancel
- Given the user had configured 4K, 30s, 50 Mbps before cancelling
- When the modal returns to idle
- Then all settings remain at 4K, 30s, 50 Mbps

Scenario 5: Renderer restored after cancel
- Given the renderer was resized to 4K for export
- When the export is cancelled
- Then the renderer returns to its original viewport size and pixel ratio

---

### User Story 11: Display Export Progress Appropriately Per Mode

**User story:** As a user, I want clear visual feedback during export that matches my export mode so I understand what's happening.

**Acceptance criteria**
1. **In-Memory mode** shows:
   - Circular progress ring with percentage inside
   - "Rendering Frame by Frame..." heading
   - Frame counter: "Frame X of Y" (subtle secondary text)
   - ETA: "~Xs remaining"
   - Cancel button
2. **Stream-to-File mode** shows:
   - Linear progress bar (full width)
   - Percentage and ETA on same line
   - "Saving to {filename}..." heading
   - Frame counter: "Frame X of Y"
   - Cancel button
3. **Segmented mode** shows:
   - Segment counter prominently: "Segment X of Y"
   - Circular progress ring for current segment
   - Linear overall progress bar below
   - "Processing segments..." heading
   - Cancel button
4. **Encoding phase** (In-Memory only) shows:
   - Spinner animation
   - "Finalizing video..." heading
   - No cancel button (too late to cancel)
5. All ETAs update every 500ms maximum (not every frame)
6. Progress animations are smooth (CSS transitions, not jumpy)

**Test scenarios**

Scenario 1: In-memory progress display
- Given an in-memory export is 45% complete, frame 135 of 300, 12s remaining
- When the user views the modal
- Then they see circular ring at 45%, "Frame 135 of 300", "~12s remaining"

Scenario 2: Stream-to-file progress display
- Given a stream-to-file export to "video.mp4" is 60% complete
- When the user views the modal
- Then they see linear bar at 60%, "Saving to video.mp4...", ETA

Scenario 3: Segmented progress display
- Given segment 2 of 4 is at 30%
- When the user views the modal
- Then they see "Segment 2 of 4" prominently, segment ring at 30%, overall bar at ~40%

Scenario 4: Encoding phase display
- Given in-memory rendering completed and encoding started
- When the user views the modal
- Then they see spinner with "Finalizing video..." and no cancel button

Scenario 5: ETA updates smoothly
- Given export is in progress
- When 500ms passes
- Then ETA updates (not on every frame)

---

### User Story 12: Handle Export Errors with Actionable Feedback

**User story:** As a user, I want clear error messages when something goes wrong so I can take appropriate action.

**Acceptance criteria**
1. Error display includes: error icon, error title, error description, action buttons
2. Memory exhaustion error shows:
   - Title: "Out of Memory"
   - Description: "Export is too large for available memory. Try reducing duration, resolution, or bitrate."
   - For Standard browsers: adds "Or use Chrome/Edge for large exports."
3. File write error shows:
   - Title: "Failed to Save"
   - Description: "Could not write to disk. Check available disk space and permissions."
4. Encoding error shows:
   - Title: "Encoding Failed"
   - Description: "Video encoding encountered an error. Try reducing bitrate or resolution."
5. Generic/unknown errors include:
   - Collapsible "Technical Details" section with error message for bug reports
6. Action buttons:
   - "Adjust Settings" (primary) - returns to settings screen
   - "Try Again" (secondary) - returns to settings, does NOT auto-start
7. isExporting is set to false before returning to settings (prevents auto-restart loop)

**Test scenarios**

Scenario 1: Memory exhaustion on Safari
- Given a large in-memory export runs out of memory on Safari
- When the error is displayed
- Then user sees "Out of Memory" with browser recommendation to use Chrome/Edge

Scenario 2: Memory exhaustion on Chrome
- Given a large in-memory export runs out of memory on Chrome (user overrode mode)
- When the error is displayed
- Then user sees "Out of Memory" with suggestion to use Stream-to-File mode

Scenario 3: File write permission error
- Given a stream-to-file export cannot write to disk
- When the error is displayed
- Then user sees "Failed to Save" with disk space/permission guidance

Scenario 4: Adjust Settings returns to idle
- Given an export has failed
- When the user clicks "Adjust Settings"
- Then isExporting is false and modal shows settings screen

Scenario 5: Try Again does not auto-start
- Given an export has failed
- When the user clicks "Try Again"
- Then modal shows settings screen and export does NOT start automatically

Scenario 6: Technical details available
- Given an unknown error occurred with message "WebCodecs error: xyz"
- When the user expands "Technical Details"
- Then they see the full error message for bug reporting

---

### User Story 13: Display Size Warnings for Risky Exports

**User story:** As the system, I want to warn users when their export settings might cause issues so they can adjust before starting.

**Acceptance criteria**
1. Warning appears when export is classified as "Medium" (50-150 MB) or "Large" (> 150 MB)
2. Medium warning (amber):
   - "This is a moderately large export. Ensure other tabs are closed for best results."
3. Large warning (red):
   - In-Memory mode: "This export may exceed your browser's memory. Consider using Chrome/Edge for safer disk-based export."
   - Stream-to-File mode: "Large export. Ensure sufficient disk space (~{size} MB required)."
   - Segmented mode: "This export will download as {N} separate files."
4. Warnings appear below the size estimate, above the export button
5. Warnings do not block export (informational only)
6. Warnings update immediately when settings change

**Test scenarios**

Scenario 1: Medium export shows amber warning
- Given the user configures a 75 MB export
- When the settings are displayed
- Then an amber warning suggests closing other tabs

Scenario 2: Large in-memory export on Safari
- Given the user is on Safari with a 200 MB export (auto-selected to Segmented)
- When viewing settings
- Then warning indicates export will download as multiple files

Scenario 3: Large stream-to-file export
- Given the user is on Chrome with a 500 MB export
- When viewing settings
- Then warning indicates disk space requirement

Scenario 4: Small export shows no warning
- Given the user configures a 30 MB export
- When the settings are displayed
- Then no warning is shown

Scenario 5: Warning updates on setting change
- Given the user sees no warning for a 40 MB export
- When they increase duration to push size to 80 MB
- Then the medium warning appears immediately

---

### User Story 14: Persist Export Settings Across Sessions

**User story:** As a user, I want my export settings remembered between sessions so I don't have to reconfigure each time.

**Acceptance criteria**
1. Export settings persist to localStorage when changed
2. Persisted settings: resolution, customWidth, customHeight, fps, duration, bitrate
3. NOT persisted: export mode override (always resets to automatic)
4. Settings are restored when export modal opens
5. If persisted settings are invalid or corrupted, system uses defaults without error
6. localStorage key: `mdimension-export-settings`
7. User can reset to defaults via "Reset to Defaults" link in settings
8. Reset confirmation: no confirmation needed (instant reset)

**Test scenarios**

Scenario 1: Settings persist across sessions
- Given the user sets resolution to 4K, duration to 15s, and closes the modal
- When the user reopens the modal in a new browser session
- Then 4K resolution and 15s duration are pre-selected

Scenario 2: Corrupted settings fall back to defaults
- Given localStorage contains `{fps: "invalid"}`
- When the export modal opens
- Then default settings are loaded without error

Scenario 3: User resets to defaults
- Given the user has custom settings (4K, 30s, 50 Mbps)
- When the user clicks "Reset to Defaults"
- Then settings return to 1080p, 5s, 12 Mbps, 60 FPS

Scenario 4: Mode override not persisted
- Given the user enabled manual mode override
- When the user closes and reopens the modal
- Then automatic mode selection is active

Scenario 5: Partial settings preserved
- Given the user only changes bitrate to 25 Mbps
- When the modal reopens
- Then bitrate is 25 Mbps and other settings are defaults

---

## Specification Summary

**Feature**: Memory-Safe Multi-Tier Video Export
**User Stories (Jira Tickets)**: 14
**Acceptance Criteria**: 94
**Test Scenarios**: 56

### Stories Overview

| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Estimate Export Size | User | ~1 day | None |
| 2 | Detect Browser Capabilities | System | ~0.5 days | None |
| 3 | Guide Users to Optimal Browser | User | ~1 day | Stories 1, 2 |
| 4 | Select Export Mode | System | ~1 day | Stories 1, 2 |
| 5 | In-Memory Export (Tier 1) | User | ~0.5 days | Story 4 (mostly existing) |
| 6 | Stream-to-File Export (Tier 2) | User | ~2 days | Story 4 |
| 7 | Segmented Export (Tier 3) | User | ~2 days | Story 4 |
| 8 | Merge Instructions | User | ~0.5 days | Story 7 |
| 9 | Preview for Stream-to-File | User | ~1 day | Story 6 |
| 10 | Cancel Export Gracefully | User | ~1 day | Stories 5, 6, 7 |
| 11 | Progress Display Per Mode | User | ~1 day | Stories 5, 6, 7 |
| 12 | Error Handling | User | ~1 day | Stories 5, 6, 7 |
| 13 | Size Warnings | System | ~0.5 days | Story 1 |
| 14 | Settings Persistence | User | ~0.5 days | None |

**Total Estimated Effort**: ~13-14 days

### Implementation Order (Suggested)

**Phase 1 - Foundation** (Stories 1, 2, 14 - parallel)
- Size estimation
- Browser detection
- Settings persistence

**Phase 2 - Mode Selection & Warnings** (Stories 3, 4, 13)
- Automatic mode selection
- Browser guidance
- Size warnings

**Phase 3 - Export Modes** (Stories 5, 6, 7 - can partially parallel)
- Refactor existing In-Memory
- Implement Stream-to-File
- Implement Segmented

**Phase 4 - Polish** (Stories 8, 9, 10, 11, 12)
- Merge instructions
- Stream-to-File preview
- Cancel handling
- Progress UI
- Error handling

### Coverage Summary

| Category | Count |
|----------|-------|
| Happy paths | 18 |
| Error handling | 10 |
| Edge cases | 12 |
| UI/UX feedback | 10 |
| System behavior | 6 |

### Technical Notes

**MediaBunny Targets:**
- Tier 1 (In-Memory): `BufferTarget` (existing)
- Tier 2 (Stream-to-File): `StreamTarget` with `FileSystemWritableFileStream`
- Tier 3 (Segmented): `BufferTarget` per segment, sequential

**MP4 Format:**
- Tier 1: Standard MP4 (`fastStart: "in-memory"` or default)
- Tier 2: Fragmented MP4 (`fastStart: "fragmented"`) - required for streaming
- Tier 3: Standard MP4 per segment

**File System Access API:**
```typescript
// Detection
const hasFileSystemAccess = 'showSaveFilePicker' in window

// Usage
const handle = await window.showSaveFilePicker({
  suggestedName: `mdimension-${Date.now()}.mp4`,
  types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
})
const writable = await handle.createWritable()
```

### Dependencies Between Stories

```
Stories 1, 2, 14 → Independent (Phase 1)
       ↓
Stories 3, 4, 13 → Depend on 1, 2 (Phase 2)
       ↓
Stories 5, 6, 7 → Depend on 4 (Phase 3)
       ↓
Stories 8, 9, 10, 11, 12 → Depend on 5, 6, 7 (Phase 4)
```

### Open Items - None

All placeholders have been resolved.

### Ready for Development: **YES**
