# Schrödinger Upgrade 14: GGX Specular Highlights

## Overview

**Feature**: Physically-Based GGX Specular Distribution
**Priority**: Medium
**Performance Impact**: Low (~10-15% overhead in lighting calculation)
**Tier**: 2 (Cheap improvements)

## Problem Statement

The current Schrödinger volumetric rendering uses Blinn-Phong specular highlights, which produce soft, dated-looking highlights. Modern real-time rendering uses physically-based distributions like GGX (Trowbridge-Reitz) that produce sharper, more realistic specular highlights with proper energy conservation. Upgrading to GGX would make the volume appear more professional and better integrate with modern post-processing.

## Expected Outcome

Specular highlights on the Schrödinger volume should appear sharper, more defined, and more realistic. The highlights should have the characteristic "hot spot with long tail" shape of GGX and interact better with HDR/bloom post-processing for dramatic light reflections.

---

## User Story 1: Enable GGX Specular Distribution

**User story:** As a user viewing the Schrödinger object, I want specular highlights to use modern GGX distribution so that reflections appear sharper and more physically accurate.

**Acceptance criteria**
1. Specular highlights use GGX/Trowbridge-Reitz distribution instead of Blinn-Phong
2. Highlights appear sharper with a bright center and gradual falloff
3. The characteristic GGX "hot spot with tail" shape is visible
4. Highlights are energy-conserving (don't add excess brightness)
5. The effect works with all light types (directional, point, spot)
6. Highlights interact properly with HDR bloom
7. The upgrade is backward-compatible with existing specular settings

**Test scenarios**

Scenario 1: GGX highlight shape
- Given GGX specular is enabled
- When viewing the object with a bright light source
- Then specular highlights show sharp center with gradual tail falloff

Scenario 2: Comparison with Blinn-Phong
- Given the user can toggle between GGX and Blinn-Phong modes
- When comparing the two
- Then GGX highlights appear sharper and more defined

Scenario 3: Multiple light sources
- Given multiple lights illuminate the object
- When GGX specular is enabled
- Then each light produces properly shaped GGX highlights

Scenario 4: Bloom interaction
- Given bloom post-processing is enabled
- When bright GGX highlights occur
- Then bloom picks up the highlights naturally

Scenario 5: Energy conservation
- Given GGX specular is enabled with high intensity
- When viewing the total light contribution
- Then overall brightness remains reasonable (not over-bright)

---

## User Story 2: Roughness Control

**User story:** As a user, I want to control the roughness of specular highlights so that I can achieve appearances from sharp mirror-like to soft matte.

**Acceptance criteria**
1. A "Roughness" control is available in specular settings
2. The control accepts values from 0.0 to 1.0
3. Value 0.0 creates very sharp, focused highlights (mirror-like)
4. Value 1.0 creates very broad, diffuse highlights (matte-like)
5. Value 0.3 is the default providing moderate sharpness
6. Roughness replaces or augments the existing "Specular Power" control
7. Changes update the rendering in real-time

**Test scenarios**

Scenario 1: Default roughness
- Given GGX specular is enabled with default settings
- When viewing the roughness control
- Then it displays value 0.3

Scenario 2: Low roughness (sharp highlights)
- Given the user sets roughness to 0.05
- When viewing the object
- Then specular highlights are very tight and focused

Scenario 3: High roughness (broad highlights)
- Given the user sets roughness to 0.8
- When viewing the object
- Then specular highlights are very broad and soft

Scenario 4: Real-time adjustment
- Given the object is displaying specular highlights
- When the user adjusts the roughness slider
- Then highlight sharpness changes immediately

---

## User Story 3: Fresnel Effect for Specular

**User story:** As a user, I want specular intensity to vary with viewing angle (Fresnel effect) so that reflections are stronger at grazing angles.

**Acceptance criteria**
1. Specular intensity increases at grazing viewing angles (Fresnel)
2. The Fresnel effect uses physically-motivated Schlick approximation
3. A "Fresnel Strength" control adjusts the effect intensity
4. Default Fresnel provides visible but not overwhelming edge reflections
5. Fresnel can be disabled for uniform specular if desired
6. The effect combines naturally with volumetric rim lighting (if enabled)

**Test scenarios**

Scenario 1: Fresnel at grazing angles
- Given GGX specular with Fresnel is enabled
- When viewing the object at grazing angles (edges)
- Then specular reflections are stronger than at direct angles

Scenario 2: Direct angle reflections
- Given GGX specular with Fresnel is enabled
- When viewing the object directly (perpendicular)
- Then specular reflections are based primarily on roughness/intensity

Scenario 3: Fresnel strength adjustment
- Given the user increases Fresnel strength
- When viewing edge regions
- Then edge reflections become more prominent

Scenario 4: Disable Fresnel
- Given the user sets Fresnel strength to 0.0
- When viewing the object
- Then specular intensity is uniform regardless of viewing angle

---

## User Story 4: Specular Color Control

**User story:** As a user, I want to control the color of specular highlights so that I can create different material appearances.

**Acceptance criteria**
1. A "Specular Color" control is available in specular settings
2. Default specular color is white (neutral reflections)
3. The user can set any color for tinted reflections
4. Colored specular simulates metallic or tinted surfaces
5. Specular color is multiplied with light color
6. A "Match Light Color" option uses only light colors for specular

**Test scenarios**

Scenario 1: Default specular color (white)
- Given GGX specular is enabled with default settings
- When viewing specular highlights
- Then they appear as the light's color (neutral white reflection)

Scenario 2: Tinted specular color
- Given the user sets specular color to gold (#FFD700)
- When viewing specular highlights
- Then reflections have a golden tint

Scenario 3: Specular with colored light
- Given specular color is white and light is blue
- When viewing specular highlights
- Then reflections appear blue (light color)

Scenario 4: Combined specular and light color
- Given specular color is gold and light is blue
- When viewing specular highlights
- Then reflections appear as a blend (greenish)

---

## User Story 5: Specular Mode Toggle

**User story:** As a user, I want to choose between GGX and classic Blinn-Phong specular so that I can use whichever style I prefer.

**Acceptance criteria**
1. A "Specular Mode" selector offers: GGX (default), Blinn-Phong, Off
2. GGX provides modern physically-based specular
3. Blinn-Phong provides classic soft specular (backward compatible)
4. Off disables specular completely
5. Switching modes immediately updates the appearance
6. Some controls (like Roughness) are specific to GGX mode

**Test scenarios**

Scenario 1: Default specular mode
- Given specular settings are at defaults
- When viewing the specular mode selector
- Then "GGX" is selected

Scenario 2: Switch to Blinn-Phong
- Given the user selects Blinn-Phong mode
- When viewing specular highlights
- Then they appear softer/rounder than GGX

Scenario 3: Switch to Off
- Given the user selects Off mode
- When viewing the object
- Then no specular highlights appear

Scenario 4: Mode-specific controls
- Given GGX mode is selected
- When viewing specular controls
- Then Roughness control is available
- Given Blinn-Phong mode is selected
- When viewing specular controls
- Then Specular Power control is available instead

---

## User Story 6: Anisotropic Specular Option

**User story:** As a user, I want an optional anisotropic specular mode so that highlights can be stretched in a particular direction for unique effects.

**Acceptance criteria**
1. An "Anisotropic" toggle is available when GGX mode is selected
2. When enabled, an "Anisotropy" control adjusts stretch amount (0.0 to 1.0)
3. An "Anisotropy Direction" control sets the stretch axis
4. Anisotropic highlights appear elliptical instead of circular
5. The direction can be linked to wavefunction orientation (optional)
6. Default anisotropy is 0.0 (circular/isotropic highlights)

**Test scenarios**

Scenario 1: Enable anisotropic specular
- Given GGX specular is enabled
- When the user enables Anisotropic mode with anisotropy 0.5
- Then specular highlights appear stretched/elliptical

Scenario 2: Anisotropy direction
- Given anisotropic mode is enabled
- When the user sets direction to horizontal
- Then highlights are stretched horizontally

Scenario 3: High anisotropy
- Given the user sets anisotropy to 0.9
- When viewing specular highlights
- Then highlights appear highly elongated

Scenario 4: Zero anisotropy
- Given anisotropic mode is enabled but anisotropy is 0.0
- When viewing specular highlights
- Then highlights appear circular (same as non-anisotropic)

---

## Specification Summary

**Feature**: GGX Physically-Based Specular Highlights
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 36
**Test Scenarios**: 25

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable GGX Specular Distribution | User/Viewer | ~1 day | None |
| 2 | Roughness Control | User | ~0.5 days | Story 1 |
| 3 | Fresnel Effect for Specular | User | ~0.5 days | Story 1 |
| 4 | Specular Color Control | User | ~0.5 days | Story 1 |
| 5 | Specular Mode Toggle | User | ~0.5 days | Story 1 |
| 6 | Anisotropic Specular Option | User | ~1 day | Story 1 |

### Coverage
- Happy paths: 16
- Error handling: 0
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should roughness vary across the volume based on density?
- Should there be metallic/dielectric presets?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
