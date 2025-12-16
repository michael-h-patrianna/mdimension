# Mandelbulb Opacity Modes

## Overview

This feature adds four distinct opacity/transparency rendering modes for mandelbulb fractals, allowing users to visualize the fractal structure with varying degrees of transparency. Users access these settings through the Faces section > Material tab in the sidebar, reusing the existing opacity slider infrastructure used by polytopes.

---

## User Story 1: Opacity Mode Selection

**User story:** As a user viewing a mandelbulb fractal, I want to select between different opacity rendering modes so that I can visualize the fractal with varying transparency effects.

**Acceptance criteria**
1. User sees an "Opacity Mode" dropdown in the Material tab when viewing a mandelbulb fractal (Mandelbulb 3D+)
2. Dropdown contains four options: "Solid" (default), "Simple Alpha", "Layered Surfaces", "Volumetric Density"
3. Selecting a mode immediately updates the fractal rendering in the viewport
4. Selected mode persists when switching between dimensions (3D-11D)
5. Mode selection is saved when sharing via URL
6. When switching from mandelbulb to a polytope object type, the opacity mode dropdown is hidden
7. When switching back to mandelbulb, the previously selected mode is restored

**Test scenarios**

Scenario 1: Default mode on first load
- Given the user loads the application with a mandelbulb fractal selected
- When the user opens Faces section > Material tab
- Then the user sees "Opacity Mode" dropdown with "Solid" selected

Scenario 2: Change opacity mode
- Given the user is viewing a 4D mandelbulb with "Solid" mode selected
- When the user selects "Simple Alpha" from the dropdown
- Then the fractal immediately re-renders with alpha transparency applied

Scenario 3: Mode persists across dimension changes
- Given the user has selected "Layered Surfaces" mode
- When the user changes dimension from 4D to 7D
- Then the "Layered Surfaces" mode remains selected and applied

Scenario 4: Mode hidden for non-mandelbulb objects
- Given the user has selected "Volumetric Density" mode for a mandelbulb
- When the user switches to a polytope object type (e.g., Tesseract)
- Then the "Opacity Mode" dropdown is not visible in the Material tab

---

## User Story 2: Solid Mode (No Transparency)

**User story:** As a user, I want to view the mandelbulb as a fully opaque solid surface so that I can see the exterior form clearly without any transparency effects.

**Acceptance criteria**
1. When "Solid" mode is selected, the fractal renders as completely opaque (alpha = 1.0)
2. No additional controls appear when Solid mode is selected
3. The existing Face Opacity slider is hidden in Solid mode (not applicable)
4. Solid mode is the default for all new sessions
5. Solid mode has the fastest rendering performance of all modes
6. All lighting, shadows, and material effects work normally in Solid mode

**Test scenarios**

Scenario 1: Solid mode renders opaque surface
- Given the user has "Solid" mode selected
- When the user views the mandelbulb from any angle
- Then the fractal surface appears fully opaque with no see-through areas

Scenario 2: Opacity slider hidden in Solid mode
- Given the user is in the Material tab with "Solid" mode selected
- When the user looks for the Face Opacity slider
- Then the slider is not visible

Scenario 3: Solid mode performance
- Given the user is rotating a 7D mandelbulb in "Solid" mode
- When the user interacts with the viewport
- Then the frame rate remains smooth (comparable to current behavior)

---

## User Story 3: Simple Alpha Mode

**User story:** As a user, I want to apply uniform transparency to the mandelbulb surface so that I can see a faded version of the fractal that reveals objects behind it.

**Acceptance criteria**
1. When "Simple Alpha" mode is selected, the Face Opacity slider becomes visible
2. Slider range is 0.0 (fully transparent) to 1.0 (fully opaque), step 0.05
3. Default opacity value is 0.7 when first entering Simple Alpha mode
4. Changes to the slider immediately update the fractal transparency
5. At opacity 0.0, the fractal is invisible but still casts shadows (if shadows enabled)
6. At opacity 1.0, the fractal appears identical to Solid mode
7. The fractal blends correctly with the background/environment
8. Double-clicking the slider resets to 0.7 default

**Test scenarios**

Scenario 1: Enable Simple Alpha mode
- Given the user has "Solid" mode selected
- When the user selects "Simple Alpha" from the dropdown
- Then the Face Opacity slider appears and the fractal renders with 70% opacity

Scenario 2: Adjust opacity via slider
- Given the user is in Simple Alpha mode with opacity at 0.7
- When the user drags the slider to 0.3
- Then the fractal becomes more transparent, showing more of the background through it

Scenario 3: Full transparency
- Given the user is in Simple Alpha mode
- When the user sets opacity to 0.0
- Then the fractal becomes invisible but the viewport remains interactive

Scenario 4: Reset opacity
- Given the user has adjusted opacity to 0.2
- When the user double-clicks the opacity slider
- Then the opacity resets to 0.7

Scenario 5: Background blending
- Given the user has a colored environment/ground plane visible
- When the user sets opacity to 0.5 in Simple Alpha mode
- Then the fractal color blends with the background color where they overlap

---

## User Story 4: Layered Surfaces Mode

**User story:** As a user, I want to see multiple transparent layers of the mandelbulb surface so that I can visualize the internal structure and depth of the fractal.

**Acceptance criteria**
1. When "Layered Surfaces" mode is selected, the fractal renders 2-4 nested surfaces
2. User sees a "Layer Count" control: dropdown or slider with values 2, 3, 4
3. User sees a "Layer Opacity" slider (0.1 to 0.9, default 0.5) controlling transparency per layer
4. Outer layers are rendered first, inner layers show through based on opacity
5. Each layer reveals progressively deeper structure of the fractal
6. Layers are visually distinguishable by depth (darker/lighter gradation)
7. Default layer count is 2 for performance reasons
8. Tooltip explains: "Shows multiple depth layers of the fractal surface"

**Test scenarios**

Scenario 1: Enable Layered Surfaces mode
- Given the user has "Solid" mode selected
- When the user selects "Layered Surfaces" from the dropdown
- Then the user sees both "Layer Count" and "Layer Opacity" controls appear
- And the fractal renders with 2 visible layers at 50% opacity each

Scenario 2: Increase layer count
- Given the user is in Layered Surfaces mode with 2 layers
- When the user changes layer count to 4
- Then the fractal shows 4 distinct nested surfaces revealing more internal detail

Scenario 3: Adjust layer opacity
- Given the user is in Layered Surfaces mode with layer opacity at 0.5
- When the user decreases layer opacity to 0.2
- Then all layers become more transparent, showing deeper layers more clearly

Scenario 4: High layer opacity
- Given the user is in Layered Surfaces mode
- When the user sets layer opacity to 0.9
- Then only the outermost layer is clearly visible (inner layers mostly occluded)

Scenario 5: Low layer opacity
- Given the user is in Layered Surfaces mode with 4 layers
- When the user sets layer opacity to 0.2
- Then all 4 layers are visible simultaneously, creating a ghostly depth effect

---

## User Story 5: Volumetric Density Mode

**User story:** As a user, I want to render the mandelbulb as a volumetric cloud-like structure so that I can see the fractal's density distribution throughout its volume.

**Acceptance criteria**
1. When "Volumetric Density" mode is selected, the fractal renders as a semi-transparent volume
2. User sees a "Density" slider (0.1 to 2.0, default 1.0) controlling overall volume opacity
3. User sees a "Sample Quality" control: Low, Medium, High (default: Medium)
4. Areas near the fractal surface appear denser/more opaque
5. Areas away from the surface appear lighter/more transparent
6. The volumetric effect reveals internal cavities and structures
7. Color is derived from the same color algorithm selected in the Colors tab
8. Warning message appears: "Volumetric mode may reduce performance" when first enabled
9. Performance warning only shows once per session

**Test scenarios**

Scenario 1: Enable Volumetric mode
- Given the user has "Solid" mode selected
- When the user selects "Volumetric Density" from the dropdown
- Then the user sees a performance warning message
- And "Density" and "Sample Quality" controls appear
- And the fractal renders as a cloud-like volume

Scenario 2: Adjust density
- Given the user is in Volumetric mode with density at 1.0
- When the user increases density to 1.8
- Then the volume appears more opaque and solid-like

Scenario 3: Low density setting
- Given the user is in Volumetric mode
- When the user sets density to 0.2
- Then the volume appears wispy and cloud-like with visible internal structure

Scenario 4: Sample quality affects performance
- Given the user is in Volumetric mode with Sample Quality at "High"
- When the user rotates the fractal
- Then the frame rate is noticeably lower than in "Low" quality

Scenario 5: Sample quality affects visual fidelity
- Given the user is in Volumetric mode with Sample Quality at "Low"
- When the user compares to "High" quality (static view)
- Then "High" shows smoother gradients and less banding artifacts

Scenario 6: Warning only shows once
- Given the user has already seen the Volumetric performance warning
- When the user switches to Solid mode and back to Volumetric mode
- Then the warning does not appear again

---

## User Story 6: Opacity Mode URL Serialization

**User story:** As a user, I want my opacity mode settings to be saved in the share URL so that I can share my exact visualization configuration with others.

**Acceptance criteria**
1. Opacity mode is encoded in the share URL when not default (Solid)
2. Layer count and layer opacity are encoded when in Layered Surfaces mode
3. Density and sample quality are encoded when in Volumetric mode
4. Simple Alpha opacity value is encoded when in Simple Alpha mode
5. Loading a URL with opacity settings applies them immediately
6. Invalid or missing opacity parameters default to Solid mode
7. URL parameters use compact encoding to minimize URL length

**Test scenarios**

Scenario 1: Share URL with Simple Alpha mode
- Given the user has Simple Alpha mode with opacity 0.4
- When the user copies the share URL and opens it in a new tab
- Then the new tab shows the mandelbulb in Simple Alpha mode with opacity 0.4

Scenario 2: Share URL with Layered Surfaces mode
- Given the user has Layered Surfaces mode with 3 layers at 0.6 opacity
- When the user shares the URL
- Then the recipient sees the exact same layer configuration

Scenario 3: Share URL with Volumetric mode
- Given the user has Volumetric mode with density 1.5 and High quality
- When the URL is loaded in a new browser
- Then the same volumetric settings are applied

Scenario 4: Invalid URL parameter
- Given a URL contains an invalid opacity mode value
- When the user loads the URL
- Then Solid mode is applied as fallback

---

## Specification Summary

**Feature**: Mandelbulb Opacity Modes
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 42
**Test Scenarios**: 26

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Opacity Mode Selection | User | ~1 day | None |
| 2 | Solid Mode | User | ~0.5 days | Story 1 |
| 3 | Simple Alpha Mode | User | ~1 day | Story 1 |
| 4 | Layered Surfaces Mode | User | ~2 days | Story 1 |
| 5 | Volumetric Density Mode | User | ~2 days | Story 1 |
| 6 | URL Serialization | User | ~0.5 days | Stories 1-5 |

### Coverage
- Happy paths: 12
- Error handling: 2
- Edge cases: 6
- Permission/access: 0
- System behavior: 6

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should Volumetric mode be disabled during rotation for performance, then render on interaction end?
- Should layer count affect the colors (different hue per layer) or just transparency?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 (mode selection infrastructure)
- Story 6 depends on Stories 1-5 (must serialize all mode settings)

### Ready for Development: YES
