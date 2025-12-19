# Schrödinger Upgrade 09: Distance-Adaptive Quality (LOD)

## Overview

**Feature**: Level-of-Detail System Based on Distance and Screen Coverage
**Priority**: Medium-High
**Performance Impact**: Positive (can improve performance by 20-40% for distant objects)
**Tier**: 2 (Cheap improvements with positive performance impact)

## Problem Statement

The current Schrödinger volumetric rendering uses uniform sample counts regardless of the object's distance from the camera or its screen coverage. This is inefficient—distant objects that occupy few pixels receive the same computational budget as close-up objects filling the screen. An adaptive LOD system would allow higher quality for close views while maintaining performance for distant objects.

## Expected Outcome

Objects far from the camera or occupying small screen area should automatically reduce sample counts, while close-up views maintain maximum quality. This enables better performance when zoomed out and higher quality settings when zoomed in, improving overall user experience in both scenarios.

---

## User Story 1: Automatic Sample Count Scaling

**User story:** As a user viewing the Schrödinger object, I want the rendering quality to automatically adjust based on distance so that close-up views are detailed and distant views maintain good performance.

**Acceptance criteria**
1. Sample count automatically increases when camera is close to the object
2. Sample count automatically decreases when camera is far from the object
3. The transition between quality levels is smooth, not jarring
4. Close-up views match or exceed the current maximum quality
5. Distant views maintain acceptable visual quality despite reduced samples
6. Performance improves noticeably when viewing distant objects
7. The adaptation is transparent to the user (no manual intervention needed)

**Test scenarios**

Scenario 1: Close-up quality
- Given the camera is positioned very close to the Schrödinger object (filling screen)
- When viewing the object
- Then rendering uses maximum sample count with full detail

Scenario 2: Distant quality
- Given the camera is positioned far from the Schrödinger object (small on screen)
- When viewing the object
- Then rendering uses reduced sample count but maintains acceptable appearance

Scenario 3: Smooth transition
- Given the user zooms from close to far or vice versa
- When observing the quality during zoom
- Then quality transitions smoothly without visible popping or sudden changes

Scenario 4: Performance improvement at distance
- Given the object is viewed from a distance
- When monitoring frame rate
- Then frame rate is noticeably higher than when viewing up close

Scenario 5: Visual acceptability at distance
- Given the object is viewed from a distance with LOD active
- When observing the visual quality
- Then the object appears acceptable without obvious degradation artifacts

---

## User Story 2: LOD Distance Configuration

**User story:** As a user, I want to configure the distance ranges for LOD transitions so that I can tune the quality/performance balance for my system.

**Acceptance criteria**
1. A "LOD Settings" section is available in Schrödinger performance/quality settings
2. "Near Distance" setting defines where maximum quality is used (default: camera within 2 units)
3. "Far Distance" setting defines where minimum quality is used (default: camera beyond 10 units)
4. Quality interpolates linearly between near and far distances
5. Settings can be adjusted to favor quality (wider near range) or performance (narrower)
6. A "Reset to Defaults" option restores recommended values
7. Distance values are in world units consistent with the rest of the application

**Test scenarios**

Scenario 1: Default LOD distances
- Given LOD is enabled with default settings
- When viewing the LOD distance settings
- Then Near Distance is 2.0 and Far Distance is 10.0

Scenario 2: Quality-biased configuration
- Given the user sets Near Distance to 5.0 and Far Distance to 15.0
- When viewing the object at distance 4.0
- Then maximum quality is still used (within expanded near range)

Scenario 3: Performance-biased configuration
- Given the user sets Near Distance to 1.0 and Far Distance to 5.0
- When viewing the object at distance 3.0
- Then reduced quality is used (already in transition zone)

Scenario 4: Reset to defaults
- Given the user has modified LOD distance settings
- When the user clicks "Reset to Defaults"
- Then Near Distance returns to 2.0 and Far Distance returns to 10.0

---

## User Story 3: Quality Level Range Configuration

**User story:** As a user, I want to configure the minimum and maximum sample counts used by LOD so that I can set quality bounds appropriate for my system.

**Acceptance criteria**
1. "Maximum Samples" setting defines quality at close range (default: 128)
2. "Minimum Samples" setting defines quality at far range (default: 32)
3. Maximum samples cannot be less than minimum samples (validation)
4. Minimum samples has a lower bound of 16 (below this causes visual artifacts)
5. Maximum samples has an upper bound of 256 (beyond this shows diminishing returns)
6. Changes take effect immediately on the rendering

**Test scenarios**

Scenario 1: Default sample range
- Given LOD is enabled with default settings
- When viewing the sample count settings
- Then Maximum is 128 and Minimum is 32

Scenario 2: High quality range
- Given the user sets Maximum to 256 and Minimum to 64
- When viewing the object at various distances
- Then quality range is higher throughout (more samples everywhere)

Scenario 3: Performance-oriented range
- Given the user sets Maximum to 64 and Minimum to 16
- When viewing the object at various distances
- Then sample counts are lower throughout (better performance)

Scenario 4: Invalid range prevention
- Given the user attempts to set Maximum to 20 and Minimum to 40
- When the validation occurs
- Then the system prevents this configuration or swaps the values

---

## User Story 4: Screen Coverage-Based LOD

**User story:** As a user, I want LOD to also consider screen coverage so that small objects on screen use fewer samples regardless of world-space distance.

**Acceptance criteria**
1. LOD considers both distance AND screen coverage (projected size)
2. An object that is far but large on screen maintains higher quality
3. An object that is close but small on screen can use reduced quality
4. Screen coverage is measured in approximate pixel count or percentage
5. This handles cases like wide field-of-view where objects appear smaller
6. Screen coverage contribution can be weighted relative to distance

**Test scenarios**

Scenario 1: Large screen coverage far object
- Given a large Schrödinger object is viewed from moderate distance (fills 60% of screen)
- When LOD calculates quality level
- Then quality is higher than distance alone would suggest (screen coverage boost)

Scenario 2: Small screen coverage close object
- Given a small Schrödinger object is viewed from close (fills 10% of screen)
- When LOD calculates quality level
- Then quality can be reduced despite close distance (screen coverage reduction)

Scenario 3: Consistent appearance during zoom
- Given the user zooms in/out while the object maintains constant screen size (due to object scaling)
- When observing quality
- Then quality remains relatively consistent (screen coverage is primary factor)

---

## User Story 5: LOD Enable/Disable Toggle

**User story:** As a user, I want to enable or disable the LOD system so that I can choose between automatic optimization and consistent quality.

**Acceptance criteria**
1. LOD has an enable/disable toggle in performance settings
2. The toggle is ON by default (LOD active)
3. When disabled, rendering uses the configured maximum samples at all distances
4. Disabling LOD may significantly impact performance at certain zoom levels
5. A tooltip explains the tradeoff: "When disabled, uses maximum quality at all distances"
6. The toggle state persists across sessions

**Test scenarios**

Scenario 1: Default state (enabled)
- Given a fresh session with default settings
- When viewing the LOD toggle
- Then it is enabled (ON)

Scenario 2: Disable LOD effect
- Given LOD is enabled and the object is viewed from far distance
- When the user disables LOD
- Then quality increases (maximum samples used) and frame rate may decrease

Scenario 3: Enable LOD effect
- Given LOD is disabled and the object is viewed from far distance
- When the user enables LOD
- Then sample count reduces and frame rate improves

Scenario 4: Tooltip information
- Given the user hovers over the LOD toggle
- When the tooltip appears
- Then it explains the quality/performance tradeoff

---

## User Story 6: LOD Quality Indicator

**User story:** As a user, I want to see the current LOD level being used so that I can understand how the system is adapting to my view.

**Acceptance criteria**
1. An optional "LOD Indicator" can be displayed on screen
2. The indicator shows current sample count or quality percentage
3. The indicator updates in real-time as the camera moves
4. The indicator can be toggled on/off (off by default for cleaner view)
5. The indicator helps users understand and tune LOD settings
6. The indicator is subtle and doesn't obstruct the main view

**Test scenarios**

Scenario 1: Enable LOD indicator
- Given LOD is active
- When the user enables the LOD indicator
- Then a small display shows current quality level (e.g., "Samples: 96")

Scenario 2: Indicator updates with movement
- Given the LOD indicator is visible
- When the user moves the camera closer or farther
- Then the indicator updates to reflect the changing sample count

Scenario 3: Indicator hidden by default
- Given a fresh session
- When viewing the screen
- Then no LOD indicator is visible (clean view)

Scenario 4: Indicator position
- Given the LOD indicator is enabled
- When viewing the display
- Then the indicator is positioned unobtrusively (e.g., corner of screen)

---

## Specification Summary

**Feature**: Distance-Adaptive Quality (Level of Detail)
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 35
**Test Scenarios**: 24

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Automatic Sample Count Scaling | User/Viewer | ~1.5 days | None |
| 2 | LOD Distance Configuration | User | ~0.5 days | Story 1 |
| 3 | Quality Level Range Configuration | User | ~0.5 days | Story 1 |
| 4 | Screen Coverage-Based LOD | User | ~1 day | Story 1 |
| 5 | LOD Enable/Disable Toggle | User | ~0.5 days | Story 1 |
| 6 | LOD Quality Indicator | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 14
- Error handling: 1
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should LOD also affect shadow quality when self-shadowing is enabled?
- Should there be LOD hysteresis to prevent rapid switching when near thresholds?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
