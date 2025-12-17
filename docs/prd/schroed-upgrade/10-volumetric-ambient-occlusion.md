# Schrödinger Upgrade 10: Volumetric Ambient Occlusion

## Overview

**Feature**: Self-Occlusion via Hemisphere Cone Tracing
**Priority**: Medium
**Performance Impact**: Very High (~50-80% overhead)
**Tier**: 4 (Expensive - Ultra Quality option)

## Problem Statement

The current Schrödinger volumetric rendering applies uniform ambient lighting throughout the volume. In reality, interior regions should be darker because surrounding density blocks ambient light from reaching them. This self-occlusion creates important depth cues that make the volume appear more three-dimensional and grounded.

## Expected Outcome

Interior/deep regions of the Schrödinger object should appear darker than exterior regions due to ambient light being blocked by surrounding density. This creates contact shadows, depth perception, and a more realistic, professional-quality appearance. Due to significant performance cost, this must be an optional "Ultra Quality" feature.

---

## User Story 1: Enable Volumetric Ambient Occlusion

**User story:** As a user viewing the Schrödinger object, I want interior regions to appear darker due to self-occlusion so that the volume has enhanced depth perception and professional quality.

**Acceptance criteria**
1. Interior regions of the volume appear darker than exterior regions
2. Regions surrounded by dense material are more occluded (darker)
3. Edge/surface regions with clear view to surroundings are less occluded (brighter)
4. The occlusion creates subtle "contact shadows" where density concentrates
5. The effect enhances perception of internal structure
6. The effect works with all color modes (density, phase, mixed)
7. A clear performance warning is shown when enabling this feature

**Test scenarios**

Scenario 1: Interior darkening
- Given volumetric AO is enabled
- When the user views the object interior
- Then interior regions appear visibly darker than surface regions

Scenario 2: Edge brightness
- Given volumetric AO is enabled
- When the user views the object edges/silhouettes
- Then edges appear brighter (less occluded) than interior

Scenario 3: Contact shadow visibility
- Given the Schrödinger object has regions where dense lobes meet
- When volumetric AO is enabled
- Then visible darkening appears at the junction points

Scenario 4: Depth perception enhancement
- Given volumetric AO is enabled
- When the user views the object
- Then the 3D depth perception is noticeably enhanced compared to AO disabled

Scenario 5: Performance warning
- Given volumetric AO is currently disabled
- When the user attempts to enable it
- Then a warning is displayed: "This effect significantly impacts performance (~50-80% slower)"

---

## User Story 2: Ambient Occlusion Intensity Control

**User story:** As a user, I want to control how strongly ambient occlusion darkens interior regions so that I can achieve subtle depth cues or dramatic shadows.

**Acceptance criteria**
1. An "AO Intensity" or "Occlusion Strength" control is available when AO is enabled
2. The control accepts values from 0.0 to 2.0
3. Value 0.0 makes occlusion invisible (but still computed)
4. Value 1.0 is the physically-motivated default
5. Values above 1.0 create exaggerated, extra-dark occlusion for artistic effect
6. Changes update the rendering in real-time
7. The control only appears when volumetric AO is enabled

**Test scenarios**

Scenario 1: Default AO intensity
- Given volumetric AO is enabled with default settings
- When viewing the AO intensity control
- Then it displays value 1.0

Scenario 2: Zero AO intensity
- Given the user sets AO intensity to 0.0
- When viewing the object
- Then no visible occlusion darkening appears (uniform ambient)

Scenario 3: Maximum AO intensity
- Given the user sets AO intensity to 2.0
- When viewing the object
- Then interior regions are very dark, creating dramatic depth contrast

Scenario 4: Subtle AO intensity
- Given the user sets AO intensity to 0.3
- When viewing the object
- Then gentle depth cues are visible without dramatic darkening

---

## User Story 3: Ambient Occlusion Quality Control

**User story:** As a user, I want to control the quality/performance tradeoff of ambient occlusion so that I can balance visual fidelity with frame rate.

**Acceptance criteria**
1. A "AO Quality" control is available when volumetric AO is enabled
2. Quality levels are: Low (3 cones), Medium (4 cones), High (6 cones), Ultra (8 cones)
3. Each quality level shows estimated performance impact
4. Default quality is Medium (4 cones)
5. Lower quality produces noisier/less accurate occlusion but better performance
6. Higher quality produces smoother, more accurate occlusion but lower performance
7. Cone sampling is distributed in a hemisphere around the local normal

**Test scenarios**

Scenario 1: Default AO quality
- Given volumetric AO is enabled with default settings
- When viewing the quality control
- Then Medium (4 cones) is selected

Scenario 2: Low quality appearance
- Given the user sets AO quality to Low (3 cones)
- When viewing the object with AO
- Then occlusion is visible but may show noise or directional bias

Scenario 3: Ultra quality appearance
- Given the user sets AO quality to Ultra (8 cones)
- When viewing the object with AO
- Then occlusion appears smooth and accurate

Scenario 4: Performance difference
- Given the user toggles between Low and Ultra quality
- When monitoring frame rate
- Then significant performance difference is measurable

---

## User Story 4: Occlusion Radius Control

**User story:** As a user, I want to control how far the occlusion sampling extends so that I can have local contact shadows or broader ambient darkening.

**Acceptance criteria**
1. An "Occlusion Radius" control is available when AO is enabled
2. The control accepts values from 0.1 to 2.0 (world units or object-relative)
3. Value 0.5 is the default providing medium-range occlusion
4. Smaller values (0.1-0.3) create tight contact shadows, less broad darkening
5. Larger values (1.0-2.0) create broad ambient darkening, less precise
6. Radius affects the length of cone traces for occlusion sampling
7. Changes update the rendering in real-time

**Test scenarios**

Scenario 1: Default occlusion radius
- Given volumetric AO is enabled with default settings
- When viewing the radius control
- Then it displays value 0.5

Scenario 2: Small radius (contact shadows)
- Given the user sets occlusion radius to 0.15
- When viewing the object
- Then tight contact shadows appear where density concentrates, but broad regions are less affected

Scenario 3: Large radius (broad darkening)
- Given the user sets occlusion radius to 1.5
- When viewing the object
- Then broad ambient darkening affects large regions, with less precise contact shadows

Scenario 4: Radius visual comparison
- Given the user toggles between radius 0.2 and 1.0
- When comparing the two appearances
- Then the difference between tight and broad occlusion is clearly visible

---

## User Story 5: Ambient Occlusion Color Tint

**User story:** As a user, I want to optionally tint the ambient occlusion color so that shadows can appear cool/blue (sky bounce) or warm (reflected light).

**Acceptance criteria**
1. An "AO Color" or "Shadow Tint" control is available when AO is enabled
2. Default is neutral (darkens without color shift)
3. Cool tint option adds blue to occluded regions (simulating sky bounce)
4. Warm tint option adds brown/amber to occluded regions (simulating ground bounce)
5. Custom color option allows any tint color
6. Tint intensity is adjustable from subtle to prominent

**Test scenarios**

Scenario 1: Neutral AO color (default)
- Given volumetric AO is enabled with default settings
- When viewing occluded regions
- Then darkening is neutral gray without color tint

Scenario 2: Cool tint
- Given the user sets AO tint to Cool (blue)
- When viewing occluded regions
- Then darkened areas have a subtle blue tint

Scenario 3: Warm tint
- Given the user sets AO tint to Warm (amber)
- When viewing occluded regions
- Then darkened areas have a subtle amber/brown tint

Scenario 4: Custom tint color
- Given the user sets AO tint to Custom with purple color
- When viewing occluded regions
- Then darkened areas have a purple tint

---

## User Story 6: Volumetric AO Toggle with Performance Warning

**User story:** As a user, I want clear indication of the performance cost of volumetric AO so that I can make informed decisions about enabling it.

**Acceptance criteria**
1. Volumetric AO has an enable/disable toggle in quality/performance settings
2. The toggle is OFF by default (due to performance cost)
3. When hovering over the toggle, a tooltip shows "Performance impact: Very High (50-80% slower)"
4. When enabled, a brief notification appears with performance information
5. The toggle is grouped with other "Ultra Quality" features
6. Disabling volumetric AO immediately improves frame rate

**Test scenarios**

Scenario 1: Default state (disabled)
- Given a fresh session with default settings
- When viewing the volumetric AO toggle
- Then it is disabled (OFF)

Scenario 2: Performance tooltip
- Given the user hovers over the volumetric AO toggle
- When the tooltip appears
- Then it displays information about significant performance impact

Scenario 3: Frame rate recovery on disable
- Given volumetric AO is enabled and frame rate is reduced
- When the user disables volumetric AO
- Then frame rate returns to pre-enabled levels within a few frames

Scenario 4: Grouping with Ultra features
- Given the user views the quality settings
- When looking at the settings organization
- Then volumetric AO is grouped with other expensive "Ultra Quality" features

---

## Specification Summary

**Feature**: Volumetric Ambient Occlusion via Cone Tracing
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 35
**Test Scenarios**: 24

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Volumetric Ambient Occlusion | User/Viewer | ~2 days | None |
| 2 | AO Intensity Control | User | ~0.5 days | Story 1 |
| 3 | AO Quality Control | User | ~0.5 days | Story 1 |
| 4 | Occlusion Radius Control | User | ~0.5 days | Story 1 |
| 5 | AO Color Tint | User | ~0.5 days | Story 1 |
| 6 | Toggle with Performance Warning | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 14
- Error handling: 1
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should AO cones share samples with self-shadow cones when both features are enabled?
- Should AO automatically reduce quality during camera movement for interactivity?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
