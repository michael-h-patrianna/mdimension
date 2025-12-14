# Hyperbulb Performance Optimizations

## Overview

This feature implements four performance optimization techniques for hyperbulb fractal rendering: Temporal Reprojection (reusing previous frame data), Resolution Scaling (rendering at lower resolution), Progressive Refinement (incremental quality improvement), and 3D Texture SDF Cache (precomputed distance field). These optimizations enable smoother interaction and higher quality static renders, especially for higher-dimensional fractals (8D-11D).

---

## User Story 1: Performance Settings Panel

**User story:** As a user, I want to access performance optimization settings so that I can tune rendering behavior for my device and use case.

**Acceptance criteria**
1. User sees a "Performance" section in the sidebar (after Post-Processing, before Projection)
2. Section is collapsible with default state closed
3. Section contains subsections for each optimization technique
4. Each optimization has an enable/disable toggle
5. Section header shows overall performance status indicator (icon: green=all optimized, yellow=some, gray=none)
6. Tooltip on header: "Configure rendering optimizations for better performance"
7. Settings persist across sessions (stored in browser)
8. All performance settings are excluded from share URLs (they're device-specific)

**Test scenarios**

Scenario 1: Access performance settings
- Given the user opens the sidebar
- When the user expands the "Performance" section
- Then the user sees optimization controls organized by technique

Scenario 2: Performance indicator
- Given Temporal Reprojection and Resolution Scaling are enabled
- When the user looks at the Performance section header
- Then a yellow indicator shows "Some optimizations enabled"

Scenario 3: All optimizations enabled
- Given all four optimization techniques are enabled
- When the user looks at the Performance section header
- Then a green indicator shows "All optimizations enabled"

Scenario 4: Settings persist
- Given the user enables Resolution Scaling
- When the user closes and reopens the browser
- Then Resolution Scaling remains enabled

Scenario 5: Settings not in URL
- Given the user has custom performance settings
- When the user copies the share URL
- Then the URL does not contain performance settings

---

## User Story 2: Temporal Reprojection

**User story:** As a user, I want the renderer to reuse data from previous frames so that raymarching can skip empty space and render faster during motion.

**Acceptance criteria**
1. User sees "Temporal Reprojection" toggle in Performance section
2. Default state is ON (enabled)
3. When enabled, renderer uses previous frame depth to start rays closer to the surface
4. Speedup is most noticeable during slow camera movements (30-50% faster)
5. No visual artifacts during smooth motion
6. May show brief artifacts during rapid rotation (acceptable tradeoff)
7. Automatically disabled when camera teleports (e.g., preset views, reset)
8. Tooltip: "Reuses previous frame depth to accelerate rendering"

**Test scenarios**

Scenario 1: Enable temporal reprojection
- Given Temporal Reprojection is disabled
- When the user toggles it ON
- Then subsequent frames render faster during camera motion

Scenario 2: Smooth motion performance
- Given Temporal Reprojection is enabled
- When the user slowly rotates the fractal
- Then frame rate is noticeably higher than with reprojection disabled

Scenario 3: Rapid motion handling
- Given Temporal Reprojection is enabled
- When the user rapidly rotates the fractal
- Then there may be minor visual artifacts that resolve when motion stops

Scenario 4: Camera teleport reset
- Given Temporal Reprojection is enabled
- When the user clicks a preset camera position
- Then reprojection temporarily disables for 1 frame (no artifacts from stale data)

Scenario 5: Static view (no effect)
- Given Temporal Reprojection is enabled
- When the camera is stationary
- Then there is no visual difference from disabled state

---

## User Story 3: Resolution Scaling

**User story:** As a user, I want to render at a lower resolution during interaction so that frame rates stay high, with full resolution restored for static views.

**Acceptance criteria**
1. User sees "Resolution Scaling" toggle in Performance section
2. Default state is ON (enabled)
3. User sees "Interaction Scale" slider (0.25 to 1.0, step 0.05, default 0.5)
4. During camera interaction, render at scaled resolution
5. When interaction stops, render at full resolution after 150ms delay
6. Transition from low to high resolution is smooth (fade, not pop)
7. At scale 0.25, pixels are visible but frame rate is 4-16x higher
8. At scale 1.0 (off), full resolution is always used
9. Resolution indicator shows current mode: "50%" during interaction, "100%" when static
10. Slider label shows performance estimate: "~4x faster" at 0.5 scale

**Test scenarios**

Scenario 1: Enable resolution scaling
- Given Resolution Scaling is disabled
- When the user toggles it ON
- Then the Interaction Scale slider appears

Scenario 2: Interaction triggers scaling
- Given Resolution Scaling is ON with scale 0.5
- When the user starts rotating the fractal
- Then the image becomes noticeably pixelated but frame rate increases significantly

Scenario 3: Static restores resolution
- Given the user was rotating (scaled resolution)
- When the user stops rotating for 150ms
- Then the image smoothly sharpens to full resolution

Scenario 4: Aggressive scaling
- Given Resolution Scaling is ON with scale 0.25
- When the user rotates the fractal
- Then pixels are clearly visible but interaction is extremely smooth

Scenario 5: Scaling disabled at 1.0
- Given the user sets Interaction Scale to 1.0
- When the user rotates the fractal
- Then resolution remains full (no scaling applied)

Scenario 6: Resolution indicator
- Given Resolution Scaling is ON at 0.5
- When the user rotates the fractal
- Then a "50%" indicator appears in the viewport corner

Scenario 7: Smooth transition
- Given the user stops rotating
- When resolution restores
- Then the transition is a smooth fade (0.3s) rather than instant pop

---

## User Story 4: Progressive Refinement

**User story:** As a user, I want the renderer to start with a fast low-quality preview and progressively improve to full quality so that I get instant feedback followed by polished results.

**Acceptance criteria**
1. User sees "Progressive Refinement" toggle in Performance section
2. Default state is ON (enabled)
3. When camera stops, rendering begins at low quality and progressively refines
4. User sees refinement progress indicator (0-100% or visual bar)
5. Refinement stages: Low (instant) → Medium (100ms) → High (300ms) → Final (500ms)
6. Any camera movement resets to low quality instantly
7. User can interrupt refinement by moving camera
8. Final quality matches non-progressive full quality exactly
9. Works in combination with other optimizations
10. Tooltip: "Progressively improves image quality after interaction stops"

**Test scenarios**

Scenario 1: Enable progressive refinement
- Given Progressive Refinement is disabled
- When the user toggles it ON
- Then subsequent static views progressively sharpen

Scenario 2: Refinement stages visible
- Given Progressive Refinement is ON
- When the user stops rotating the fractal
- Then the image visibly improves in stages over ~500ms

Scenario 3: Progress indicator
- Given Progressive Refinement is ON
- When the user stops rotating
- Then a progress indicator shows 0% → 25% → 50% → 75% → 100%

Scenario 4: Movement interrupts refinement
- Given the image is at 50% refinement
- When the user starts rotating again
- Then refinement resets to 0% (low quality) instantly

Scenario 5: Final quality matches full quality
- Given Progressive Refinement is ON
- When refinement reaches 100%
- Then the image is identical to what would render with refinement disabled

Scenario 6: Quick interaction patterns
- Given the user repeatedly taps to make small rotations
- When refinement starts between taps
- Then the system handles interruptions gracefully (no flashing/artifacts)

---

## User Story 5: 3D Texture SDF Cache

**User story:** As a user, I want to optionally precompute the fractal distance field into a 3D texture so that rendering is dramatically faster at the cost of precision and memory.

**Acceptance criteria**
1. User sees "SDF Cache" toggle in Performance section
2. Default state is OFF (disabled) - this is an advanced optimization
3. When enabled, user sees cache controls appear:
   - "Resolution" dropdown: 64³, 128³, 256³ (default 128³)
   - "Generate Cache" button
   - "Clear Cache" button
4. Generating cache shows progress: "Generating SDF cache... X%"
5. Generation time varies: 64³ ~1s, 128³ ~5s, 256³ ~30s
6. After generation, rendering uses texture lookup instead of ray iteration
7. Cached rendering is 10x+ faster but shows blocky artifacts at low resolution
8. Cache is invalidated when fractal parameters change (power, iterations, dimension)
9. Memory usage indicator: "~8 MB" for 128³, "~64 MB" for 256³
10. Warning: "SDF Cache uses fixed resolution. Zoom in may show artifacts."

**Test scenarios**

Scenario 1: Enable SDF Cache
- Given SDF Cache is disabled
- When the user toggles it ON
- Then Resolution dropdown and Generate/Clear buttons appear

Scenario 2: Generate cache
- Given SDF Cache is enabled with 128³ resolution
- When the user clicks "Generate Cache"
- Then a progress indicator shows "Generating SDF cache... X%" for ~5 seconds
- And then rendering switches to use the cached texture

Scenario 3: Cached rendering performance
- Given SDF Cache is generated
- When the user rotates a 9D hyperbulb
- Then frame rate is dramatically higher than without cache (10x+ improvement)

Scenario 4: Cache resolution tradeoff
- Given the user generates a 64³ cache
- When the user zooms in closely
- Then blocky/pixelated artifacts are visible on the surface

Scenario 5: High resolution cache
- Given the user generates a 256³ cache (taking ~30s)
- When the user views the fractal at normal zoom
- Then surface quality is good with minimal artifacts

Scenario 6: Parameter change invalidates cache
- Given the user has a cached SDF
- When the user changes Mandelbulb power from 8 to 12
- Then a notification appears: "SDF cache invalidated. Regenerate for cached rendering."
- And rendering falls back to real-time calculation

Scenario 7: Clear cache
- Given the user has a cached SDF
- When the user clicks "Clear Cache"
- Then the cache is deleted and rendering uses real-time calculation

Scenario 8: Memory warning
- Given the user selects 256³ resolution
- When viewing the memory indicator
- Then it shows "~64 MB" with warning icon

Scenario 9: Dimension change invalidates
- Given the user has a cached SDF for 5D
- When the user switches to 6D
- Then cache is invalidated automatically

---

## User Story 6: Dimension-Adaptive Quality

**User story:** As a user, I want the renderer to automatically adjust quality based on fractal dimension so that higher-dimensional fractals remain interactive.

**Acceptance criteria**
1. User sees "Auto-Adjust for Dimension" toggle in Performance section
2. Default state is ON (enabled)
3. When enabled, raymarching quality automatically scales with dimension:
   - 3D-4D: Full quality (128 steps, 64 iterations)
   - 5D-6D: High quality (96 steps, 48 iterations)
   - 7D-8D: Medium quality (64 steps, 32 iterations)
   - 9D-11D: Low quality (48 steps, 24 iterations)
4. Quality reduction is automatic and seamless
5. User sees current quality level indicator: "Quality: High (6D adjusted)"
6. Can be disabled to force full quality at all dimensions
7. When disabled, warning appears for 9D+: "Full quality at high dimensions may reduce performance"

**Test scenarios**

Scenario 1: Enable dimension-adaptive quality
- Given Auto-Adjust is disabled
- When the user toggles it ON
- Then quality automatically adjusts based on current dimension

Scenario 2: Low dimension full quality
- Given Auto-Adjust is enabled
- When the user views a 3D or 4D hyperbulb
- Then full quality is used (no reduction)

Scenario 3: High dimension reduced quality
- Given Auto-Adjust is enabled
- When the user switches to 10D
- Then quality automatically reduces to Low tier
- And quality indicator shows "Quality: Low (10D adjusted)"

Scenario 4: Quality improves when dimension decreases
- Given the user is viewing 9D with Low quality
- When the user switches to 5D
- Then quality automatically increases to High tier

Scenario 5: Disable for full quality
- Given the user is viewing 10D with Auto-Adjust enabled (Low quality)
- When the user disables Auto-Adjust
- Then full quality is used (may reduce frame rate)
- And warning appears about potential performance impact

Scenario 6: Quality indicator updates
- Given Auto-Adjust is enabled
- When the user changes dimension from 4D to 7D
- Then the quality indicator updates from "Quality: Full (4D)" to "Quality: Medium (7D adjusted)"

---

## User Story 7: Performance Preset Profiles

**User story:** As a user, I want to select predefined performance profiles so that I can quickly configure all optimizations for my use case.

**Acceptance criteria**
1. User sees "Performance Profile" dropdown at top of Performance section
2. Options: "Custom", "Fastest", "Balanced" (default), "Quality", "Screenshot"
3. Selecting a profile configures all optimization settings:
   - **Fastest**: All optimizations ON, aggressive settings (scale 0.25, cache ON)
   - **Balanced**: Temporal + Resolution (0.5) + Progressive ON, Cache OFF
   - **Quality**: Only Progressive ON, all others OFF
   - **Screenshot**: All OFF (maximum quality for static capture)
4. Changing any individual setting switches profile to "Custom"
5. Profile persists across sessions
6. Tooltip for each profile explains its purpose

**Test scenarios**

Scenario 1: Select Fastest profile
- Given the user selects "Fastest" profile
- When viewing the performance settings
- Then all optimizations are enabled with aggressive values (scale 0.25)

Scenario 2: Select Screenshot profile
- Given the user selects "Screenshot" profile
- When viewing the performance settings
- Then all optimizations are disabled for maximum quality

Scenario 3: Custom profile on change
- Given the user has "Balanced" profile selected
- When the user changes Resolution Scale from 0.5 to 0.75
- Then the profile automatically switches to "Custom"

Scenario 4: Balanced default
- Given the user opens the application for the first time
- When viewing Performance section
- Then "Balanced" profile is selected

Scenario 5: Profile persistence
- Given the user selects "Quality" profile
- When the user closes and reopens the browser
- Then "Quality" profile is still selected

---

## Specification Summary

**Feature**: Hyperbulb Performance Optimizations
**User Stories (Jira Tickets)**: 7
**Acceptance Criteria**: 62
**Test Scenarios**: 40

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Performance Settings Panel | User | ~1 day | None |
| 2 | Temporal Reprojection | User | ~2 days | Story 1 |
| 3 | Resolution Scaling | User | ~1.5 days | Story 1 |
| 4 | Progressive Refinement | User | ~2 days | Story 1 |
| 5 | 3D Texture SDF Cache | User | ~3 days | Story 1 |
| 6 | Dimension-Adaptive Quality | User | ~1 day | Story 1 |
| 7 | Performance Preset Profiles | User | ~1 day | Stories 2-6 |

### Coverage
- Happy paths: 22
- Error handling: 4
- Edge cases: 8
- Performance: 18
- System behavior: 8

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should SDF Cache support animation (regenerate cache per frame for animated parameters)?
- Should there be a "target frame rate" setting that auto-adjusts quality to maintain fps?
- Should resolution scaling apply to post-processing (bloom, bokeh) as well?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 (settings panel infrastructure)
- Story 7 depends on Stories 2-6 (profiles configure all optimizations)

### Ready for Development: YES
