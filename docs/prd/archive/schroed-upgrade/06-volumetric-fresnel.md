# Schrödinger Upgrade 06: Volumetric Fresnel / Rim Lighting

## Overview

**Feature**: View-Angle Dependent Rim Lighting for Volumetric Objects
**Priority**: High
**Performance Impact**: Minimal (~2% overhead)
**Tier**: 1 (Free improvements - do first)

## Problem Statement

The current Schrödinger volumetric rendering lacks view-angle dependent effects. In real participating media and rendered volumes, edges and silhouettes appear brighter when viewed at grazing angles due to longer light paths through thin material. This "rim lighting" or "fresnel" effect is crucial for making objects visually "pop" and appear three-dimensional.

## Expected Outcome

Volume silhouettes should glow brighter when the viewing angle is nearly tangent to the surface. This creates a beautiful halo effect around the object, enhances depth perception, and gives the Schrödinger object a holographic or ethereal quality. The effect is extremely cheap to compute.

---

## User Story 1: Enable Volumetric Rim Lighting

**User story:** As a user viewing the Schrödinger object, I want edges to appear brighter based on viewing angle so that the object has enhanced silhouette visibility and appears more three-dimensional.

**Acceptance criteria**
1. Volume edges/silhouettes appear brighter than central regions when viewed from any angle
2. The brightness increase is proportional to how tangent the view is to the local surface
3. The effect creates a visible "halo" or "rim" around the object
4. The effect works with all color modes (density, phase, mixed)
5. The rim color can complement or contrast with the base color
6. The effect enhances depth perception without washing out surface detail
7. The rim effect is visible against both light and dark backgrounds

**Test scenarios**

Scenario 1: Rim brightness at silhouette
- Given the Schrödinger object is rendered with rim lighting enabled
- When the user views the object against any background
- Then the outer silhouette appears visibly brighter than the interior

Scenario 2: Angle-dependent brightness
- Given rim lighting is enabled
- When the user rotates the camera around the object
- Then the bright rim consistently appears at edges tangent to the view direction

Scenario 3: Color mode compatibility
- Given the user switches between density, phase, and mixed color modes
- When rim lighting is enabled
- Then the rim effect is visible and complementary in all modes

Scenario 4: Dark background visibility
- Given the Schrödinger object is displayed against a dark background
- When rim lighting is enabled
- Then the rim creates a bright outline making the object clearly visible

Scenario 5: Light background visibility
- Given the Schrödinger object is displayed against a light background
- When rim lighting is enabled
- Then the rim is still perceptible (though potentially more subtle)

---

## User Story 2: Rim Intensity Control

**User story:** As a user, I want to control the strength of the rim lighting effect so that I can achieve appearances from subtle enhancement to dramatic halos.

**Acceptance criteria**
1. A "Rim Intensity" or "Fresnel Strength" control is available in Schrödinger settings
2. The control accepts values from 0.0 to 3.0
3. Value 0.0 completely disables the rim effect
4. Value 1.0 is the default providing noticeable but not overwhelming rim
5. Values above 2.0 create dramatic, glowing halos
6. Changes update the rendering in real-time
7. The control is grouped with other lighting/appearance settings

**Test scenarios**

Scenario 1: Default rim intensity
- Given the Schrödinger object is rendered with default settings
- When viewing the rim intensity control
- Then it displays value 1.0

Scenario 2: Zero rim intensity (disabled)
- Given the user sets rim intensity to 0.0
- When viewing the object
- Then no rim brightening is visible at edges

Scenario 3: Maximum rim intensity
- Given the user sets rim intensity to 3.0
- When viewing the object
- Then edges glow very brightly with dramatic halo effect

Scenario 4: Subtle rim intensity
- Given the user sets rim intensity to 0.3
- When viewing the object
- Then a gentle brightness lift is visible at edges

Scenario 5: Real-time adjustment
- Given the Schrödinger object is currently rendering
- When the user adjusts the rim intensity slider
- Then the rim brightness changes immediately

---

## User Story 3: Rim Color Control

**User story:** As a user, I want to control the color of the rim effect so that I can create complementary or contrasting halos for artistic effect.

**Acceptance criteria**
1. A "Rim Color" control is available when rim lighting is active
2. Default rim color matches the object's base color
3. The user can select any color for the rim
4. A "Color Temperature Shift" option allows warmer or cooler rim relative to base
5. The rim color blends naturally with the underlying surface color
6. A "Match Base Color" toggle returns to default behavior

**Test scenarios**

Scenario 1: Default rim color
- Given rim lighting is enabled with default settings
- When viewing the rim effect
- Then the rim color matches the object's base color

Scenario 2: Custom rim color (contrasting)
- Given the user sets rim color to cyan while base color is orange
- When viewing the object
- Then the rim appears cyan, creating a contrasting halo

Scenario 3: Warm temperature shift
- Given the user sets rim color temperature to +0.5 (warmer)
- When viewing the object
- Then the rim appears warmer (more orange/yellow) than the base color

Scenario 4: Cool temperature shift
- Given the user sets rim color temperature to -0.5 (cooler)
- When viewing the object
- Then the rim appears cooler (more blue/white) than the base color

Scenario 5: Match base color toggle
- Given the user has set a custom rim color
- When the user enables "Match Base Color"
- Then the rim color returns to matching the base color

---

## User Story 4: Rim Falloff Control

**User story:** As a user, I want to control how sharply the rim effect transitions from edge to interior so that I can have soft halos or sharp outlines.

**Acceptance criteria**
1. A "Rim Falloff" or "Rim Sharpness" control is available when rim lighting is active
2. The control accepts values from 1.0 to 10.0 (exponent)
3. Value 3.0 is the default providing a natural falloff
4. Lower values (1.0-2.0) create wide, soft halos extending far into the interior
5. Higher values (6.0-10.0) create sharp, narrow rim effects concentrated at the edge
6. Changes update the rendering in real-time

**Test scenarios**

Scenario 1: Default rim falloff
- Given rim lighting is enabled with default settings
- When viewing the rim falloff control
- Then it displays value 3.0

Scenario 2: Soft falloff
- Given the user sets rim falloff to 1.5
- When viewing the object
- Then the rim brightness extends gradually far into the interior

Scenario 3: Sharp falloff
- Given the user sets rim falloff to 8.0
- When viewing the object
- Then the rim is concentrated in a narrow band at the silhouette edge

Scenario 4: Visual comparison
- Given the user toggles between falloff values 2.0 and 8.0
- When comparing the two appearances
- Then the difference between soft and sharp rim is clearly visible

---

## User Story 5: Volumetric Rim Integration with Transmittance

**User story:** As a user, I want the rim effect to be stronger in thin regions and weaker in opaque regions so that the effect is physically motivated.

**Acceptance criteria**
1. Rim brightness is scaled by local transmittance (how much light passes through)
2. Thin/transparent regions show stronger rim effect than dense/opaque regions
3. This creates natural variation in rim brightness across the object
4. The transmittance weighting can be adjusted or disabled
5. Default behavior includes transmittance weighting

**Test scenarios**

Scenario 1: Thin region rim brightness
- Given the Schrödinger object has thin, wispy regions
- When rim lighting is enabled
- Then thin regions show brighter rim effect than dense central regions

Scenario 2: Dense region rim attenuation
- Given the Schrödinger object has dense, opaque regions
- When rim lighting is enabled
- Then dense regions show attenuated rim effect

Scenario 3: Uniform rim option
- Given the user disables transmittance weighting for rim
- When viewing the object
- Then rim brightness is uniform regardless of local density/transmittance

Scenario 4: Natural variation
- Given transmittance weighting is enabled (default)
- When viewing the object
- Then rim brightness varies naturally across the surface, brighter in thin areas

---

## Specification Summary

**Feature**: Volumetric Fresnel / Rim Lighting
**User Stories (Jira Tickets)**: 5
**Acceptance Criteria**: 27
**Test Scenarios**: 22

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Volumetric Rim Lighting | User/Viewer | ~1 day | None |
| 2 | Rim Intensity Control | User | ~0.5 days | Story 1 |
| 3 | Rim Color Control | User | ~0.5 days | Story 1 |
| 4 | Rim Falloff Control | User | ~0.5 days | Story 1 |
| 5 | Transmittance Integration | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 13
- Error handling: 0
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should rim lighting interact with scene lights or be view-dependent only?
- Should there be a "hologram" preset that maximizes rim for sci-fi effect?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 being completed first
- Stories 2-5 are independent of each other

### Ready for Development: YES
