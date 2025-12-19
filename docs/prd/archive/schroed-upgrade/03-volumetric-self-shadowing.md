# Schrödinger Upgrade 03: Volumetric Self-Shadowing

## Overview

**Feature**: Self-Shadowing via Light Cone Sampling
**Priority**: Medium-High
**Performance Impact**: High (~40-60% overhead)
**Tier**: 4 (Expensive - Ultra Quality option)

## Problem Statement

The current Schrödinger volumetric rendering does not compute shadows within the volume itself. All regions receive the same lighting regardless of whether dense regions block the light path. This makes the interior appear flat and unrealistic—real volumes show beautiful internal shadow structure where dense regions occlude light from reaching deeper areas.

## Expected Outcome

Dense regions of the Schrödinger object should cast shadows onto regions behind them (relative to the light source). This creates dramatic depth cues, internal structure visibility, and significantly more realistic volumetric appearance. Due to performance cost, this should be an optional quality setting.

---

## User Story 1: Enable Volumetric Self-Shadowing

**User story:** As a user viewing the Schrödinger object, I want dense regions to cast shadows within the volume so that the internal structure is visible and the object looks more three-dimensional.

**Acceptance criteria**
1. Regions of the volume that are behind dense areas (relative to light) appear darker
2. The shadow intensity is proportional to the density between the sample point and the light
3. Shadows are visible for all supported light types (directional, point, spot)
4. Shadow boundaries are soft, not hard-edged
5. The effect creates visible "shadow beams" or dark regions within the volume
6. Multiple lights cast independent shadows that combine naturally
7. The effect significantly enhances the perception of internal structure

**Test scenarios**

Scenario 1: Directional light shadowing
- Given the Schrödinger object has a dense lobe on one side and thinner regions behind it
- When lit by a directional light from the dense lobe side
- Then the thin regions behind the dense lobe appear darker due to shadowing

Scenario 2: Shadow beam visibility
- Given the Schrödinger object has multiple dense regions
- When lit by a single directional light
- Then dark "beam" regions are visible between dense areas where light is blocked

Scenario 3: Point light shadowing
- Given a point light is positioned near the Schrödinger object
- When viewing the object
- Then regions on the far side of dense areas (relative to the point light) are shadowed

Scenario 4: Multiple light shadow interaction
- Given two directional lights from different angles
- When viewing the object with self-shadowing enabled
- Then each light casts independent shadows, with doubly-shadowed regions being darkest

Scenario 5: Shadow softness
- Given self-shadowing is enabled
- When viewing shadow boundaries within the volume
- Then shadows have soft, gradual transitions rather than hard edges

---

## User Story 2: Self-Shadowing Quality Control

**User story:** As a user, I want to control the quality/performance tradeoff of self-shadowing so that I can balance visual fidelity with frame rate.

**Acceptance criteria**
1. A "Self-Shadow Quality" control is available when self-shadowing is enabled
2. Quality levels are: Low (2 samples), Medium (4 samples), High (6 samples), Ultra (8 samples)
3. Each quality level shows estimated performance impact
4. Default quality is Medium (4 samples)
5. Lower quality produces more banding/stepping artifacts but better performance
6. Higher quality produces smoother shadows but lower performance
7. The quality setting affects all lights equally

**Test scenarios**

Scenario 1: Low quality appearance
- Given the user sets self-shadow quality to Low (2 samples)
- When viewing the object with self-shadowing
- Then shadows are visible but show noticeable banding/stepping artifacts

Scenario 2: Ultra quality appearance
- Given the user sets self-shadow quality to Ultra (8 samples)
- When viewing the object with self-shadowing
- Then shadows appear smooth with minimal visible banding

Scenario 3: Performance difference
- Given the user toggles between Low and Ultra quality
- When monitoring frame rate
- Then Ultra quality shows measurably lower frame rate than Low quality

Scenario 4: Default quality selection
- Given self-shadowing is enabled for the first time
- When viewing the quality control
- Then Medium (4 samples) is selected by default

---

## User Story 3: Self-Shadow Intensity Control

**User story:** As a user, I want to control how dark self-shadows appear so that I can achieve subtle depth cues or dramatic shadow effects.

**Acceptance criteria**
1. A "Shadow Intensity" or "Shadow Darkness" control is available
2. The control accepts values from 0.0 to 2.0
3. Value 0.0 makes shadows completely invisible (but still computed)
4. Value 1.0 is physically-motivated default darkness
5. Values above 1.0 create exaggerated, extra-dark shadows for artistic effect
6. Changes update the rendering in real-time
7. The control only appears when self-shadowing is enabled

**Test scenarios**

Scenario 1: Default shadow intensity
- Given self-shadowing is enabled with default settings
- When viewing the shadow intensity control
- Then it displays value 1.0

Scenario 2: Zero shadow intensity
- Given the user sets shadow intensity to 0.0
- When viewing the object
- Then no visible shadows appear (uniform lighting within volume)

Scenario 3: Maximum shadow intensity
- Given the user sets shadow intensity to 2.0
- When viewing the object
- Then shadows are extremely dark, nearly black in heavily occluded regions

Scenario 4: Subtle shadows
- Given the user sets shadow intensity to 0.3
- When viewing the object
- Then shadows provide subtle depth cues without dramatic darkening

---

## User Story 4: Far Shadow Sample

**User story:** As a user, I want shadows from distant dense regions to be captured so that large-scale occlusion is represented even with limited sample counts.

**Acceptance criteria**
1. In addition to nearby cone samples, one "far sample" checks for distant occluders
2. The far sample is positioned at a significant distance toward the light (beyond normal cone)
3. This captures shadows from dense regions that would otherwise be missed
4. The far sample adds minimal performance overhead (one extra density evaluation)
5. Far shadow contribution blends smoothly with near shadow samples

**Test scenarios**

Scenario 1: Distant occluder detection
- Given the Schrödinger object has a dense region far from the current view area
- When that dense region is between a sample point and the light
- Then the sample point shows darkening from the distant occluder

Scenario 2: Near-far shadow blending
- Given both near and far occluders exist along a light path
- When viewing the shadowed region
- Then shadows blend smoothly without visible discontinuity between near and far contributions

---

## User Story 5: Self-Shadowing Toggle with Performance Warning

**User story:** As a user, I want clear indication of the performance cost of self-shadowing so that I can make informed decisions about enabling it.

**Acceptance criteria**
1. Self-shadowing has an enable/disable toggle in the Schrödinger settings
2. The toggle is OFF by default (due to performance cost)
3. When hovering over the toggle, a tooltip shows "Performance impact: High (40-60% slower)"
4. When enabled, a brief notification appears: "Self-shadowing enabled. May reduce frame rate."
5. The toggle is grouped with other quality/performance settings
6. Disabling self-shadowing immediately improves frame rate

**Test scenarios**

Scenario 1: Default state
- Given a fresh session with default settings
- When viewing the self-shadowing toggle
- Then it is disabled (OFF)

Scenario 2: Performance tooltip
- Given the user hovers over the self-shadowing toggle
- When the tooltip appears
- Then it displays information about performance impact

Scenario 3: Enable notification
- Given self-shadowing is currently disabled
- When the user enables self-shadowing
- Then a brief notification indicates the feature is enabled with performance note

Scenario 4: Frame rate recovery on disable
- Given self-shadowing is enabled and frame rate is reduced
- When the user disables self-shadowing
- Then frame rate returns to pre-enabled levels within a few frames

---

## Specification Summary

**Feature**: Volumetric Self-Shadowing via Cone Sampling
**User Stories (Jira Tickets)**: 5
**Acceptance Criteria**: 26
**Test Scenarios**: 18

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Volumetric Self-Shadowing | User/Viewer | ~2 days | None |
| 2 | Self-Shadowing Quality Control | User | ~0.5 days | Story 1 |
| 3 | Self-Shadow Intensity Control | User | ~0.5 days | Story 1 |
| 4 | Far Shadow Sample | User | ~0.5 days | Story 1 |
| 5 | Toggle with Performance Warning | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 10
- Error handling: 0
- Edge cases: 4
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should shadow quality automatically reduce during camera movement for better interactivity?
- Should there be a "Preview" mode that shows shadows at reduced quality during interaction?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 being completed first
- Stories 2-5 are independent of each other

### Ready for Development: YES
