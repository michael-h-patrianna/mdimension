# Schrödinger Upgrade 02: Beer-Powder Multiple Scattering

## Overview

**Feature**: Multiple Scattering Approximation via Beer-Powder Effect
**Priority**: High
**Performance Impact**: Minimal (~2% overhead)
**Tier**: 1 (Free improvements - do first)

## Problem Statement

The current Schrödinger volumetric rendering uses only Beer-Lambert absorption, which models light being absorbed as it travels through the volume. This produces dark, absorptive appearance but misses the characteristic "puffy glow" of real volumetric media where light bounces multiple times inside before exiting—making edges and shallow regions appear brighter.

## Expected Outcome

Volume edges and thin regions should exhibit a bright "silver lining" effect, making the Schrödinger object appear more like a luminous cloud or nebula rather than dark smoke. This technique, proven in AAA games like Horizon Zero Dawn, significantly enhances visual appeal with negligible performance cost.

---

## User Story 1: Enable Powder Effect for Multiple Scattering

**User story:** As a user viewing the Schrödinger object, I want shallow/edge regions to appear brighter due to simulated multiple scattering so that the object looks more luminous and cloud-like.

**Acceptance criteria**
1. Thin regions of the volume (low accumulated density) appear brighter than deep regions
2. The brightness increase is most visible at volume silhouettes and edges
3. The effect creates a characteristic "puffy" or "glowing" appearance
4. The effect combines naturally with existing Beer-Lambert absorption
5. The effect is visible across all color modes (density, phase, mixed)
6. The effect does not wash out or over-brighten the entire volume
7. Interior dense regions maintain their relative darkness compared to edges

**Test scenarios**

Scenario 1: Edge brightness enhancement
- Given the Schrödinger object is rendered with default settings
- When the user views the object silhouette against a dark background
- Then the edges appear noticeably brighter than the dense interior regions

Scenario 2: Comparison with powder disabled
- Given the powder effect can be toggled
- When the user disables the powder effect
- Then the edges become visibly darker and the overall appearance is more uniformly absorptive

Scenario 3: Thin lobe brightness
- Given the Schrödinger object has both thick central regions and thin extending lobes
- When the user views the object
- Then the thin lobes appear proportionally brighter than the thick central mass

Scenario 4: Color mode compatibility
- Given the user switches between density, phase, and mixed color modes
- When the powder effect is active
- Then the brightness enhancement is visible in all three color modes

Scenario 5: Interior darkness maintained
- Given the Schrödinger object has dense interior regions
- When the powder effect is active
- Then the deep interior remains darker than the edges (effect does not flatten the depth)

---

## User Story 2: Powder Effect Intensity Control

**User story:** As a user, I want to control the strength of the multiple scattering effect so that I can achieve appearances ranging from subtle to dramatic luminosity.

**Acceptance criteria**
1. A "Multiple Scattering" or "Powder Effect" control is available in the Schrödinger settings
2. The control accepts values from 0.0 to 2.0
3. Value 0.0 completely disables the effect (pure Beer-Lambert absorption)
4. Value 1.0 is the physically-motivated default
5. Values above 1.0 create exaggerated glowing effects for artistic purposes
6. Changes update the rendering in real-time
7. The control is positioned near other lighting/material controls
8. A tooltip explains that this simulates light bouncing multiple times inside the volume

**Test scenarios**

Scenario 1: Default intensity
- Given the Schrödinger object is rendered with default settings
- When the user views the powder effect control
- Then it displays value 1.0

Scenario 2: Zero intensity (disabled)
- Given the user sets powder effect intensity to 0.0
- When viewing the object
- Then the appearance matches pure Beer-Lambert absorption with no edge brightening

Scenario 3: Maximum intensity
- Given the user sets powder effect intensity to 2.0
- When viewing the object
- Then edges appear dramatically bright, almost glowing white at silhouettes

Scenario 4: Subtle intensity
- Given the user sets powder effect intensity to 0.3
- When viewing the object
- Then a subtle brightness lift is visible at edges but not overwhelming

Scenario 5: Real-time adjustment
- Given the Schrödinger object is currently rendering
- When the user drags the powder effect slider
- Then the brightness change is immediately visible without frame drops

Scenario 6: Preset preservation
- Given the user sets powder effect to 1.5 and saves a preset
- When the preset is loaded later
- Then the powder effect value is restored to 1.5

---

## User Story 3: Interaction with Light Color

**User story:** As a user, I want the multiple scattering effect to properly interact with light colors so that the glowing edges take on the light's color characteristics.

**Acceptance criteria**
1. When lit by a colored light, the powder effect brightening takes on that light's color
2. Multiple colored lights contribute their respective colors to the edge brightening
3. The effect blends naturally with the object's base color
4. Warm lights create warm-tinted edge glow; cool lights create cool-tinted edge glow
5. White lights produce neutral brightening without color tint

**Test scenarios**

Scenario 1: Orange light powder effect
- Given the scene has an orange-colored directional light
- When viewing the Schrödinger object with powder effect active
- Then the bright edges have an orange tint

Scenario 2: Blue light powder effect
- Given the scene has a blue-colored point light
- When viewing the Schrödinger object with powder effect active
- Then the bright edges near that light have a blue tint

Scenario 3: Multiple colored lights
- Given the scene has both a red light on one side and a blue light on the other
- When viewing the Schrödinger object with powder effect active
- Then edges near the red light glow reddish and edges near the blue light glow bluish

Scenario 4: White light neutrality
- Given the scene has a pure white directional light
- When viewing the Schrödinger object with powder effect active
- Then the edge brightening adds luminosity without shifting the base color

---

## Specification Summary

**Feature**: Beer-Powder Multiple Scattering Approximation
**User Stories (Jira Tickets)**: 3
**Acceptance Criteria**: 17
**Test Scenarios**: 14

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Powder Effect | User/Viewer | ~1 day | None |
| 2 | Powder Effect Intensity Control | User | ~0.5 days | Story 1 |
| 3 | Light Color Interaction | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 7
- Error handling: 0
- Edge cases: 3
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should the powder effect use a fixed absorption multiplier (2×) or be configurable?
- Should there be a "physically accurate" toggle that locks the multiplier to 2.0?

### Dependencies Between Stories
- Stories 2 and 3 depend on Story 1 being completed first

### Ready for Development: YES
