# Schrödinger Upgrade 01: Henyey-Greenstein Phase Function

## Overview

**Feature**: Anisotropic Light Scattering via Henyey-Greenstein Phase Function
**Priority**: High
**Performance Impact**: Low (~5% overhead)
**Tier**: 2 (Cheap improvements)

## Problem Statement

The current Schrödinger volumetric rendering treats light scattering isotropically—light scatters equally in all directions regardless of the viewing angle relative to the light source. This is physically unrealistic for participating media and misses the dramatic "silver lining" effect when volumes are backlit.

## Expected Outcome

When the Schrödinger object is positioned between the camera and a light source, the edges and thin regions should glow brightly due to forward scattering. When viewed from the same side as the light, the effect should be more subtle. This creates depth perception and dramatic lighting.

---

## User Story 1: Enable Phase Function Scattering Mode

**User story:** As a user viewing the Schrödinger object, I want light to scatter realistically based on viewing angle so that the object looks more three-dimensional and dramatic when backlit.

**Acceptance criteria**
1. When a light source is behind the Schrödinger object relative to the camera, edges appear brighter than when the light is in front
2. The brightness increase is proportional to how directly the light passes through toward the viewer (forward scattering)
3. The effect is visible on all volumetric color modes (density, phase, mixed)
4. The effect works with all supported light types (directional, point, spot)
5. The visual difference between backlit and frontlit views is clearly perceptible at default settings
6. The effect does not introduce visible banding or artifacts

**Test scenarios**

Scenario 1: Backlit view with directional light
- Given the Schrödinger object is rendered with a directional light positioned behind it relative to the camera
- When the user views the object
- Then the object edges appear noticeably brighter than the interior, creating a "silver lining" effect

Scenario 2: Frontlit view with directional light
- Given the Schrödinger object is rendered with a directional light positioned in front of it (same side as camera)
- When the user views the object
- Then the object appears with standard diffuse lighting without the bright edge effect

Scenario 3: Rotating camera around object
- Given the Schrödinger object is rendered with a fixed directional light
- When the user rotates the camera 180 degrees around the object
- Then the brightness distribution visibly shifts as the viewing angle relative to the light changes

Scenario 4: Point light interaction
- Given the Schrödinger object is rendered with a point light positioned behind it
- When the user views the object
- Then forward scattering is visible in regions where light passes through toward the camera

Scenario 5: Multiple lights
- Given the Schrödinger object is rendered with multiple lights at different positions
- When the user views the object
- Then each light contributes phase-dependent scattering based on its individual direction relative to the view

---

## User Story 2: Scattering Anisotropy Control

**User story:** As a user, I want to control how strongly light scatters forward versus backward so that I can achieve different visual styles from subtle to dramatic.

**Acceptance criteria**
1. A "Scattering Anisotropy" control is available in the Schrödinger settings panel
2. The control accepts values from -1.0 to 1.0
3. Value 0.0 produces isotropic scattering (current behavior, no directional preference)
4. Positive values (toward 1.0) increase forward scattering (bright when backlit)
5. Negative values (toward -1.0) increase back scattering (bright when frontlit)
6. Default value is 0.35 (moderate forward scattering)
7. Changes to the control update the rendering in real-time
8. The control value persists across sessions when saved with a preset

**Test scenarios**

Scenario 1: Default value appearance
- Given the Schrödinger object is rendered with default settings
- When the user views the anisotropy control
- Then it displays value 0.35

Scenario 2: Maximum forward scattering
- Given the user sets scattering anisotropy to 0.9
- When a light is positioned behind the object relative to the camera
- Then the silver lining effect is extremely pronounced with very bright edges

Scenario 3: Isotropic scattering
- Given the user sets scattering anisotropy to 0.0
- When the user rotates the camera around the object with a fixed light
- Then the brightness distribution remains relatively constant regardless of view angle

Scenario 4: Back scattering
- Given the user sets scattering anisotropy to -0.5
- When a light is positioned behind the object relative to the camera
- Then the edges appear darker than when the light is in front

Scenario 5: Real-time update
- Given the Schrödinger object is currently rendering
- When the user adjusts the scattering anisotropy slider
- Then the visual effect updates within the next rendered frame

Scenario 6: Preset persistence
- Given the user sets scattering anisotropy to 0.6 and saves the current state as a preset
- When the user loads that preset in a new session
- Then the scattering anisotropy value is restored to 0.6

---

## User Story 3: Dual-Lobe Scattering Option

**User story:** As a user seeking more realistic scattering, I want an option for dual-lobe scattering that combines forward and backward scattering so that I can achieve cloud-like appearance with both silver linings and bright highlights.

**Acceptance criteria**
1. A "Dual-Lobe Scattering" toggle is available when phase function scattering is active
2. When enabled, scattering combines two phase function lobes: one forward, one backward
3. An additional "Back Lobe Weight" control appears when dual-lobe is enabled
4. Back lobe weight ranges from 0.0 to 0.5 (0.0 = forward only, 0.5 = equal mix)
5. Default back lobe weight is 0.15 when dual-lobe is enabled
6. The dual-lobe option provides more natural appearance for cloud-like presets
7. Performance impact of dual-lobe mode is clearly indicated to the user

**Test scenarios**

Scenario 1: Enable dual-lobe scattering
- Given the user is viewing Schrödinger settings with phase function scattering active
- When the user enables "Dual-Lobe Scattering"
- Then a "Back Lobe Weight" slider appears with default value 0.15

Scenario 2: Visual difference with dual-lobe
- Given the user enables dual-lobe scattering with back lobe weight 0.3
- When viewing the object from any angle with a directional light
- Then both the backlit edges AND the frontlit surfaces show enhanced brightness compared to single-lobe mode

Scenario 3: Back lobe weight at zero
- Given the user enables dual-lobe scattering and sets back lobe weight to 0.0
- When viewing the object
- Then the appearance is identical to single-lobe forward scattering mode

Scenario 4: Disable dual-lobe
- Given the user has dual-lobe scattering enabled
- When the user disables the toggle
- Then the "Back Lobe Weight" control disappears and rendering reverts to single-lobe

---

## Specification Summary

**Feature**: Henyey-Greenstein Phase Function Scattering
**User Stories (Jira Tickets)**: 3
**Acceptance Criteria**: 20
**Test Scenarios**: 15

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Phase Function Scattering Mode | User/Viewer | ~1.5 days | None |
| 2 | Scattering Anisotropy Control | User | ~0.5 days | Story 1 |
| 3 | Dual-Lobe Scattering Option | User | ~1 day | Story 1 |

### Coverage
- Happy paths: 8
- Error handling: 0
- Edge cases: 3
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should anisotropy be per-light or global for the object?
- Should there be quick presets for common scattering profiles (e.g., "Cloud", "Fog", "Crystal")?

### Dependencies Between Stories
- Stories 2 and 3 depend on Story 1 being completed first

### Ready for Development: YES
