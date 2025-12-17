# Schrödinger Upgrade 12: Dynamic Cosine Gradient Palettes

## Overview

**Feature**: Advanced Color Mapping via Cosine Gradient Palettes
**Priority**: High
**Performance Impact**: Minimal (~1% overhead)
**Tier**: 1 (Free improvements - do first)

## Problem Statement

The current Schrödinger volumetric rendering uses simple HSL color manipulation for mapping density to color. While functional, this produces limited color variety and doesn't allow for the rich, artistic color palettes seen in professional shader art. Cosine gradient palettes (popularized by Inigo Quilez) offer significantly more expressive color control with minimal computational cost.

## Expected Outcome

Users should be able to apply rich, multi-color gradient palettes to the Schrödinger object, enabling appearances like "nebula sunset", "aurora borealis", "deep ocean", etc. The palette system should include both presets and customization options, dramatically expanding the artistic possibilities.

---

## User Story 1: Enable Cosine Palette Color Mode

**User story:** As a user viewing the Schrödinger object, I want a rich cosine gradient palette color mode so that I can achieve professional, artistic color schemes beyond simple HSL manipulation.

**Acceptance criteria**
1. A new color mode "Palette" is available alongside Density, Phase, and Mixed
2. Palette mode maps density values to a multi-color gradient
3. The gradient transitions smoothly through multiple hues
4. Colors are mathematically defined by cosine functions (not just linear interpolation)
5. The result is visually richer than single-hue HSL manipulation
6. The mode works with all other visual effects (emission, rim, etc.)
7. Default palette creates an appealing "nebula" appearance

**Test scenarios**

Scenario 1: Palette mode selection
- Given the user is in Schrödinger color settings
- When the user selects "Palette" color mode
- Then the object color changes to the default multi-color gradient

Scenario 2: Smooth gradient transitions
- Given Palette mode is active
- When viewing regions of varying density
- Then colors transition smoothly through multiple hues (not banded)

Scenario 3: Visual richness comparison
- Given the user compares Palette mode to Density mode
- When viewing the same object
- Then Palette mode shows clearly more color variety

Scenario 4: Effect compatibility
- Given Palette mode is active and HDR emission is enabled
- When viewing the object
- Then emission glow uses the palette colors appropriately

---

## User Story 2: Palette Preset Library

**User story:** As a user, I want a library of preset palettes so that I can quickly try different color schemes without manual configuration.

**Acceptance criteria**
1. A palette preset selector is available when Palette mode is active
2. At least 12 preset palettes are available covering diverse styles
3. Presets include: Nebula, Sunset, Aurora, Ocean, Fire, Ice, Forest, Plasma, Galaxy, Synthwave, Earth, Rainbow
4. Each preset has a visual thumbnail or color bar preview
5. Clicking a preset immediately applies it to the object
6. Presets are organized by category or mood

**Test scenarios**

Scenario 1: Preset count and variety
- Given Palette mode is active
- When viewing the preset selector
- Then at least 12 distinct presets are available

Scenario 2: Preset application
- Given the user selects the "Sunset" preset
- When the preset is applied
- Then the object shows warm orange-red-purple gradient colors

Scenario 3: Preset preview
- Given the user is browsing palette presets
- When viewing the preset list
- Then each preset shows a visual color preview

Scenario 4: Different preset appearances
- Given the user tries "Ocean" and "Fire" presets sequentially
- When comparing the two appearances
- Then they show clearly distinct color schemes

---

## User Story 3: Custom Palette Editor

**User story:** As a user, I want to create and edit custom palettes so that I can achieve exactly the color scheme I envision.

**Acceptance criteria**
1. A "Custom Palette" option allows editing palette parameters
2. The cosine palette formula uses four vec3 parameters: a, b, c, d
3. Each parameter (a, b, c, d) can be edited via color pickers or sliders
4. A live preview updates as parameters are adjusted
5. The formula preview shows: color(t) = a + b × cos(2π × (c × t + d))
6. Custom palettes can be saved and named
7. An "Advanced" toggle shows the raw parameter values for precise control

**Test scenarios**

Scenario 1: Custom palette access
- Given Palette mode is active
- When the user selects "Custom" option
- Then the palette editor controls become visible

Scenario 2: Parameter adjustment
- Given the custom palette editor is open
- When the user adjusts the "a" (base color) parameter
- Then the palette preview and object update in real-time

Scenario 3: Formula display
- Given the custom palette editor is in Advanced mode
- When viewing the editor
- Then the cosine formula and current parameter values are displayed

Scenario 4: Save custom palette
- Given the user has created a custom palette
- When the user saves it with name "My Nebula"
- Then it appears in the preset list for future use

---

## User Story 4: Palette Animation via Phase

**User story:** As a user, I want the palette to optionally animate based on wavefunction phase so that colors flow and cycle over time.

**Acceptance criteria**
1. A "Palette Animation" toggle is available when Palette mode is active
2. When enabled, the palette offset cycles over time
3. Animation speed is linked to the global time scale
4. The effect creates colors that flow through the object
5. Different density regions reach different colors at different times
6. A "Cycle Speed" control adjusts how fast colors cycle
7. Animation can be disabled for static appearance

**Test scenarios**

Scenario 1: Enable palette animation
- Given Palette mode is active
- When the user enables "Palette Animation"
- Then colors visibly cycle/flow through the object over time

Scenario 2: Animation speed control
- Given palette animation is enabled
- When the user increases the Cycle Speed
- Then colors cycle more rapidly

Scenario 3: Time scale linkage
- Given palette animation is enabled
- When the user adjusts the global time scale
- Then the palette animation speed changes proportionally

Scenario 4: Disable animation
- Given palette animation is enabled
- When the user disables it
- Then colors become static (no cycling)

---

## User Story 5: Palette Density Mapping Control

**User story:** As a user, I want to control how density values map to palette positions so that I can emphasize different density ranges.

**Acceptance criteria**
1. A "Density Mapping" control is available when Palette mode is active
2. Options include: Linear (default), Logarithmic, Exponential, Custom Curve
3. Linear maps density directly to palette position
4. Logarithmic compresses high densities, expands low densities
5. Exponential expands high densities, compresses low densities
6. Custom Curve allows defining a transfer function
7. Each mapping changes how colors distribute across the volume

**Test scenarios**

Scenario 1: Linear mapping (default)
- Given Palette mode is active with default settings
- When viewing the density mapping control
- Then "Linear" is selected

Scenario 2: Logarithmic mapping effect
- Given the user selects Logarithmic mapping
- When viewing the object
- Then color transitions occur more in low-density regions

Scenario 3: Exponential mapping effect
- Given the user selects Exponential mapping
- When viewing the object
- Then color transitions occur more in high-density regions

Scenario 4: Mapping comparison
- Given the user toggles between Linear and Logarithmic
- When comparing the two appearances
- Then the color distribution is clearly different

---

## User Story 6: Palette Contrast and Saturation

**User story:** As a user, I want to adjust the overall contrast and saturation of the palette so that I can fine-tune the final appearance.

**Acceptance criteria**
1. A "Palette Contrast" control adjusts how spread colors are (0.5 to 2.0)
2. A "Palette Saturation" control adjusts color intensity (0.0 to 1.5)
3. Default values are 1.0 for both (no adjustment)
4. Higher contrast spreads colors further apart
5. Lower contrast brings colors closer together
6. Saturation affects color purity without changing hues
7. These controls affect all palettes (presets and custom)

**Test scenarios**

Scenario 1: Default contrast and saturation
- Given Palette mode is active with default settings
- When viewing the contrast and saturation controls
- Then both display value 1.0

Scenario 2: High contrast effect
- Given the user sets contrast to 1.8
- When viewing the object
- Then colors are more spread/differentiated across the gradient

Scenario 3: Low saturation effect
- Given the user sets saturation to 0.3
- When viewing the object
- Then colors appear more muted/desaturated

Scenario 4: Combined adjustment
- Given the user sets contrast to 1.5 and saturation to 0.7
- When viewing the object
- Then colors are spread but muted

---

## Specification Summary

**Feature**: Dynamic Cosine Gradient Palettes
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 37
**Test Scenarios**: 24

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Cosine Palette Color Mode | User/Viewer | ~1 day | None |
| 2 | Palette Preset Library | User | ~1 day | Story 1 |
| 3 | Custom Palette Editor | User | ~1.5 days | Story 1 |
| 4 | Palette Animation via Phase | User | ~0.5 days | Story 1 |
| 5 | Palette Density Mapping Control | User | ~0.5 days | Story 1 |
| 6 | Palette Contrast and Saturation | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 15
- Error handling: 0
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- Specific preset palettes to include (12 suggested above)

### Open Questions
- Should palettes be exportable/importable for sharing?
- Should there be community palette sharing functionality?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
