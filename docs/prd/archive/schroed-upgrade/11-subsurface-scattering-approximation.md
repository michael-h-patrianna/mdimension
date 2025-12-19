# Schrödinger Upgrade 11: Subsurface Scattering Approximation

## Overview

**Feature**: Backlit Translucency via Subsurface Scattering Approximation
**Priority**: Medium-High
**Performance Impact**: Moderate (~20% overhead)
**Tier**: 2 (Cheap improvements)

## Problem Statement

The current Schrödinger volumetric rendering treats the volume as an opaque participating medium without special handling for backlighting situations. Real translucent media like clouds, wax, and organic materials show characteristic warm backlighting when light passes through thin regions—this "subsurface scattering" creates beautiful stained-glass-like effects that significantly enhance visual appeal.

## Expected Outcome

When a light source is positioned behind the Schrödinger object relative to the camera, thin regions should exhibit warm, translucent glow as light passes through. This creates the appearance of internal illumination and significantly enhances the ethereal, living quality of the object.

---

## User Story 1: Enable Subsurface Scattering Effect

**User story:** As a user viewing the Schrödinger object, I want thin regions to glow warmly when backlit so that the object appears translucent and alive like a backlit cloud or organic material.

**Acceptance criteria**
1. When a light is behind the object relative to the camera, thin regions appear brighter
2. The brightness is proportional to light transmission through the volume (thin = brighter)
3. The transmitted light has a warm color shift (characteristic of SSS)
4. The effect is most visible at object edges and thin lobes
5. Dense central regions show minimal SSS (light is absorbed)
6. The effect creates a "glowing from within" appearance when backlit
7. The effect combines naturally with front lighting

**Test scenarios**

Scenario 1: Backlit thin region glow
- Given the Schrödinger object has thin extending regions
- When a directional light is positioned behind the object
- Then thin regions glow with transmitted light

Scenario 2: Dense region blocking
- Given the Schrödinger object has dense central regions
- When a directional light is positioned behind the object
- Then dense regions block transmission and appear darker than edges

Scenario 3: Warm color transmission
- Given SSS is enabled with default settings
- When viewing backlit thin regions
- Then transmitted light has a warmer color than front-lit surfaces

Scenario 4: Frontlit comparison
- Given the Schrödinger object is viewed with light in front
- When SSS is enabled
- Then the effect is minimal (no transmission path)

Scenario 5: Combined front and back lighting
- Given the scene has both front and back lights
- When viewing the object
- Then front-lit surfaces show normal lighting while back-lit edges show SSS glow

---

## User Story 2: SSS Intensity Control

**User story:** As a user, I want to control the strength of the subsurface scattering effect so that I can achieve appearances from subtle translucency to dramatic backlighting.

**Acceptance criteria**
1. An "SSS Intensity" or "Translucency" control is available in Schrödinger settings
2. The control accepts values from 0.0 to 2.0
3. Value 0.0 completely disables SSS (no backlit transmission)
4. Value 1.0 is the default providing visible but not overwhelming effect
5. Values above 1.0 create exaggerated, dramatic backlit glow
6. Changes update the rendering in real-time
7. The control is grouped with other lighting/material settings

**Test scenarios**

Scenario 1: Default SSS intensity
- Given SSS is enabled with default settings
- When viewing the SSS intensity control
- Then it displays value 1.0

Scenario 2: Zero SSS intensity (disabled)
- Given the user sets SSS intensity to 0.0
- When viewing a backlit object
- Then no transmission glow appears

Scenario 3: Maximum SSS intensity
- Given the user sets SSS intensity to 2.0
- When viewing a backlit object
- Then thin regions glow dramatically bright

Scenario 4: Subtle SSS intensity
- Given the user sets SSS intensity to 0.3
- When viewing a backlit object
- Then a gentle translucent glow is visible

---

## User Story 3: SSS Color Control

**User story:** As a user, I want to control the color of subsurface scattering so that I can achieve different material appearances from warm organic to cool ethereal.

**Acceptance criteria**
1. An "SSS Color" or "Transmission Tint" control is available when SSS is enabled
2. Default color is warm orange (#FF8844) simulating organic/cloud translucency
3. The user can select any color for the SSS tint
4. A "Temperature Shift" slider offers easy warm/cool adjustment
5. The SSS color blends with the transmitted light color
6. A "Use Surface Color" option tints transmission with the object's base color

**Test scenarios**

Scenario 1: Default warm SSS color
- Given SSS is enabled with default settings
- When viewing backlit regions
- Then transmission appears warm orange

Scenario 2: Custom cool SSS color
- Given the user sets SSS color to cyan
- When viewing backlit regions
- Then transmission appears with cool cyan tint

Scenario 3: Temperature shift warm
- Given the user sets temperature shift to +1.0 (maximum warm)
- When viewing backlit regions
- Then transmission appears very warm (orange/red)

Scenario 4: Temperature shift cool
- Given the user sets temperature shift to -1.0 (maximum cool)
- When viewing backlit regions
- Then transmission appears cool (blue/white)

Scenario 5: Use surface color mode
- Given the user enables "Use Surface Color" for SSS
- When viewing backlit regions
- Then transmission is tinted toward the object's base color

---

## User Story 4: Transmission Thickness Calculation

**User story:** As a user, I want the SSS effect to accurately consider volume thickness so that transmission is physically motivated.

**Acceptance criteria**
1. SSS intensity is based on optical thickness (path length × density) through the volume
2. Very thin regions show maximum transmission
3. Very thick regions show minimal transmission
4. The thickness calculation considers the actual density along the light path
5. A "Thickness Exponent" control allows adjusting the falloff rate
6. Default thickness behavior matches real-world translucent materials

**Test scenarios**

Scenario 1: Thin region maximum transmission
- Given a very thin region of the Schrödinger object (wispy edge)
- When that region is backlit
- Then transmission is near maximum brightness

Scenario 2: Thick region minimal transmission
- Given a very dense/thick region of the object
- When that region is backlit
- Then transmission is minimal (blocked by density)

Scenario 3: Gradual thickness transition
- Given regions of varying thickness from thin to dense
- When backlit uniformly
- Then transmission brightness transitions gradually across the thickness gradient

Scenario 4: Thickness exponent adjustment
- Given the user increases the thickness exponent
- When viewing backlit regions
- Then transmission falls off more rapidly with thickness

---

## User Story 5: Multiple Light SSS Contribution

**User story:** As a user, I want SSS to work correctly with multiple lights so that each backlight contributes appropriately.

**Acceptance criteria**
1. Each light source contributes independently to SSS based on its position
2. Lights in front of the object (relative to camera) contribute minimal SSS
3. Lights behind the object contribute SSS proportional to their intensity
4. Multiple backlights sum their SSS contributions
5. Light color affects SSS color contribution
6. Point/spot light attenuation is respected for SSS calculation

**Test scenarios**

Scenario 1: Single backlight SSS
- Given one directional light behind the object
- When viewing the object
- Then SSS contribution comes from that single light

Scenario 2: Multiple backlight SSS
- Given two directional lights behind the object (left and right)
- When viewing the object
- Then both lights contribute SSS, with combined brightness

Scenario 3: Mixed front and back lights
- Given one light in front and one light behind
- When viewing the object
- Then only the back light contributes SSS

Scenario 4: Colored light SSS
- Given a blue light behind the object
- When viewing with SSS enabled
- Then SSS transmission is tinted by the blue light color (combined with SSS color)

---

## User Story 6: SSS Enable Toggle

**User story:** As a user, I want to easily enable/disable subsurface scattering so that I can compare with and without the effect.

**Acceptance criteria**
1. SSS has an enable/disable toggle in Schrödinger settings
2. The toggle is OFF by default
3. When disabled, all SSS-related controls are hidden or grayed out
4. Settings are preserved when toggling off/on
5. Toggle includes tooltip: "Simulates light transmission through thin regions when backlit"
6. Performance impact is modest (~20% overhead)

**Test scenarios**

Scenario 1: Default state (disabled)
- Given a fresh session with default settings
- When viewing the SSS toggle
- Then it is disabled (OFF)

Scenario 2: Controls visibility
- Given SSS is disabled
- When viewing the settings panel
- Then SSS controls (intensity, color, etc.) are hidden or grayed

Scenario 3: Settings preservation
- Given SSS is enabled with custom settings
- When the user toggles SSS off then back on
- Then the custom settings are preserved

Scenario 4: Performance impact indication
- Given the user hovers over the SSS toggle
- When the tooltip appears
- Then it indicates modest performance impact

---

## Specification Summary

**Feature**: Subsurface Scattering Approximation
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 35
**Test Scenarios**: 24

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Subsurface Scattering Effect | User/Viewer | ~1.5 days | None |
| 2 | SSS Intensity Control | User | ~0.5 days | Story 1 |
| 3 | SSS Color Control | User | ~0.5 days | Story 1 |
| 4 | Transmission Thickness Calculation | User | ~1 day | Story 1 |
| 5 | Multiple Light SSS Contribution | User | ~0.5 days | Story 1 |
| 6 | SSS Enable Toggle | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 15
- Error handling: 0
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should SSS interact with the phase function (Henyey-Greenstein) for enhanced accuracy?
- Should there be "material presets" for SSS (e.g., "Cloud", "Wax", "Jade")?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
