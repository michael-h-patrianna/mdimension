# Schrödinger Upgrade 07: Chromatic Dispersion

## Overview

**Feature**: RGB Channel Separation for Prismatic/Iridescent Effects
**Priority**: Medium
**Performance Impact**: High (~200% overhead when enabled)
**Tier**: 3 (Moderate - Optional toggle)

## Problem Statement

The current Schrödinger volumetric rendering treats all wavelengths of light identically. Real optical phenomena exhibit chromatic dispersion where different wavelengths interact differently with media—creating rainbow fringing, prismatic effects, and iridescence. For a quantum probability visualization, chromatic effects would enhance the sci-fi/quantum aesthetic significantly.

## Expected Outcome

Volume edges should exhibit subtle rainbow fringing where red, green, and blue channels are slightly offset. This creates a prismatic, iridescent appearance that strongly reinforces the quantum/sci-fi aesthetic. Due to the significant performance cost (3× density evaluations), this must be an optional feature.

---

## User Story 1: Enable Chromatic Dispersion Mode

**User story:** As a user viewing the Schrödinger object, I want the option to enable chromatic dispersion so that edges show prismatic rainbow effects for enhanced sci-fi aesthetic.

**Acceptance criteria**
1. When chromatic dispersion is enabled, edges show visible RGB separation/fringing
2. Red, green, and blue channels appear slightly offset from each other
3. The effect is most visible at high-contrast edges and silhouettes
4. The chromatic pattern is consistent (not random noise) based on view direction
5. The effect creates a prismatic, "holographic" appearance
6. Dense interior regions show minimal chromatic effect (concentrated at edges)
7. A clear performance warning is shown when enabling this feature

**Test scenarios**

Scenario 1: Edge rainbow fringing
- Given chromatic dispersion is enabled
- When the user views the object silhouette
- Then edges show visible rainbow color separation (red on one side, blue on other)

Scenario 2: Interior regions unaffected
- Given chromatic dispersion is enabled
- When viewing the dense interior of the object
- Then minimal to no chromatic aberration is visible in the interior

Scenario 3: Consistent pattern
- Given the camera is stationary
- When chromatic dispersion is enabled
- Then the rainbow pattern remains stable and consistent (not flickering)

Scenario 4: View-dependent orientation
- Given chromatic dispersion is enabled
- When the user rotates the camera around the object
- Then the chromatic fringe orientation changes based on view direction

Scenario 5: Performance warning
- Given chromatic dispersion is currently disabled
- When the user attempts to enable it
- Then a warning is displayed: "This effect significantly impacts performance (~3× density calculations)"

---

## User Story 2: Chromatic Dispersion Strength Control

**User story:** As a user, I want to control the amount of chromatic separation so that I can achieve subtle iridescence or dramatic prismatic effects.

**Acceptance criteria**
1. A "Chromatic Strength" or "Dispersion Amount" control is available when enabled
2. The control accepts values from 0.0 to 1.0
3. Value 0.0 shows no visible separation (but feature remains active)
4. Value 0.2 is the default providing subtle, tasteful iridescence
5. Value 1.0 creates dramatic, clearly visible RGB separation
6. Changes update the rendering in real-time
7. The control includes a visual preview indicator

**Test scenarios**

Scenario 1: Default dispersion strength
- Given chromatic dispersion is enabled with default settings
- When viewing the dispersion strength control
- Then it displays value 0.2

Scenario 2: Zero dispersion (no visible effect)
- Given the user sets dispersion strength to 0.0
- When viewing the object
- Then no visible chromatic separation appears at edges

Scenario 3: Maximum dispersion
- Given the user sets dispersion strength to 1.0
- When viewing the object
- Then dramatic, clearly visible RGB separation appears with wide rainbow bands

Scenario 4: Subtle dispersion
- Given the user sets dispersion strength to 0.1
- When viewing the object
- Then a very subtle iridescent sheen is visible at edges

---

## User Story 3: Dispersion Direction Control

**User story:** As a user, I want to control the direction of chromatic separation so that I can orient the rainbow effect artistically.

**Acceptance criteria**
1. A "Dispersion Direction" control offers options: Radial, View-Aligned, Custom Angle
2. Radial: RGB separates outward from object center (default)
3. View-Aligned: RGB separates along the view direction (depth-based)
4. Custom Angle: RGB separates along a user-specified angle
5. Different directions create distinctly different visual effects
6. Direction can be animated for dynamic prismatic effects (optional)

**Test scenarios**

Scenario 1: Radial dispersion
- Given dispersion direction is set to Radial
- When viewing the object
- Then chromatic separation radiates outward from the object center

Scenario 2: View-aligned dispersion
- Given dispersion direction is set to View-Aligned
- When viewing the object
- Then chromatic separation appears based on depth (front-to-back)

Scenario 3: Custom angle dispersion
- Given dispersion direction is set to Custom Angle at 45 degrees
- When viewing the object
- Then chromatic separation appears along the 45-degree diagonal

Scenario 4: Direction comparison
- Given the user switches between Radial and View-Aligned
- When comparing the two appearances
- Then the orientation of rainbow fringing is clearly different

---

## User Story 4: Performance Quality Tradeoff

**User story:** As a user, I want quality options for chromatic dispersion so that I can balance visual fidelity with performance.

**Acceptance criteria**
1. Quality levels are available: Preview (1.5×), Standard (2×), High (3×)
2. Preview: Approximates dispersion with reduced accuracy, better performance
3. Standard: Full RGB separation with moderate sample count (default)
4. High: Maximum quality with additional intermediate wavelengths
5. Each level shows estimated performance impact
6. Quality level affects both accuracy and sample count

**Test scenarios**

Scenario 1: Preview quality performance
- Given the user selects Preview quality
- When viewing the object with dispersion enabled
- Then frame rate is higher than Standard quality with slightly reduced color accuracy

Scenario 2: High quality appearance
- Given the user selects High quality
- When viewing the object with dispersion enabled
- Then chromatic effect shows smooth gradient transitions (minimal banding)

Scenario 3: Standard quality default
- Given chromatic dispersion is enabled for the first time
- When viewing the quality control
- Then Standard quality is selected by default

Scenario 4: Performance impact indication
- Given the user views the quality options
- When hovering over each option
- Then estimated performance impact is displayed (e.g., "~50% overhead", "~100% overhead", "~200% overhead")

---

## User Story 5: Chromatic Dispersion Toggle with Quick Disable

**User story:** As a user, I want to quickly toggle chromatic dispersion on/off so that I can easily compare with and without the effect, especially given its performance cost.

**Acceptance criteria**
1. Chromatic dispersion has a prominent enable/disable toggle
2. The toggle is OFF by default (due to performance cost)
3. A keyboard shortcut allows quick toggle without accessing settings panel
4. When disabled, performance immediately returns to normal
5. Settings (strength, direction, quality) are preserved when toggling off/on
6. The toggle clearly indicates current state with visual feedback

**Test scenarios**

Scenario 1: Default state (disabled)
- Given a fresh session with default settings
- When viewing the chromatic dispersion toggle
- Then it is disabled (OFF)

Scenario 2: Toggle preservation
- Given the user enables dispersion and adjusts strength to 0.5
- When the user toggles dispersion off then back on
- Then the strength setting is preserved at 0.5

Scenario 3: Keyboard shortcut toggle
- Given chromatic dispersion is enabled
- When the user presses the assigned keyboard shortcut
- Then dispersion is disabled and performance improves

Scenario 4: Quick comparison workflow
- Given the user wants to compare with/without dispersion
- When the user rapidly toggles the feature
- Then the switch is immediate without settings dialogs

---

## Specification Summary

**Feature**: Chromatic Dispersion / RGB Separation
**User Stories (Jira Tickets)**: 5
**Acceptance Criteria**: 26
**Test Scenarios**: 20

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Chromatic Dispersion Mode | User/Viewer | ~1.5 days | None |
| 2 | Dispersion Strength Control | User | ~0.5 days | Story 1 |
| 3 | Dispersion Direction Control | User | ~1 day | Story 1 |
| 4 | Performance Quality Tradeoff | User | ~0.5 days | Story 1 |
| 5 | Toggle with Quick Disable | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 11
- Error handling: 1
- Edge cases: 4
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- Keyboard shortcut for quick toggle (suggest: Shift+C)

### Open Questions
- Should dispersion be wavelength-accurate (physics) or artistically tunable?
- Should there be interaction with the phase coloring mode?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 being completed first
- Stories 2-5 are independent of each other

### Ready for Development: YES
