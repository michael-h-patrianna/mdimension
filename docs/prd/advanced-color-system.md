# PRD: Advanced Color System

## Overview

This PRD specifies the replacement of the current discrete color mode system (Monochromatic, Analogous, Complementary, Triadic, Split Complementary) with a comprehensive, professional-grade color system featuring smooth gradient palettes, multiple coloring algorithms, distribution controls, and preset management.

### Problem Statement

The current color palette system uses color theory algorithms designed for website UI palettes. These algorithms create discrete color transitions that work well for buttons and cards but fail for continuous surfaces (fractals, polytope faces).

**Current Issues:**
1. Poor Color Distribution - Users see only 1-2 distinct hues instead of the promised 3+ colors
2. Visible Banding - Sharp hue transitions create posterization artifacts on smooth surfaces
3. Random Appearance - Colors appear arbitrary rather than revealing structure
4. Wrong Algorithm Type - Website color harmony systems don't translate to continuous gradient surfaces

### Solution Overview

Replace discrete color modes with:
1. **New "Faces" Sidebar Section** - Dedicated collapsible section for all face/surface color controls
2. **Cosine Gradient Palettes** - Smooth, cyclic color gradients (primary solution)
3. **Distribution Controls** - Power curve, cycles, and offset for value remapping
4. **Multiple Color Algorithms** - Normal-based, distance-field, LCH, multi-source
5. **Preset Management** - Save, load, export, import color configurations

### Scope

**Two Rendering Systems Affected:**
1. **Raymarched Fractals** (Mandelbulb 3D, Hyperbulb 4D-11D) - Uses orbit trap values (0-1)
2. **Face-Rendered Polytopes** (Tesseract, 600-cell, etc.) - Uses per-face depth values (0-1)

Both systems share the same palette generation code but differ in how they compute the variation parameter `t` that drives color selection.

**Note:** The color system only applies to faces and surfaces. Edge and vertex colors remain separate controls in the Visual section.

---

## Specification Summary

**Feature**: Advanced Color System
**User Stories (Jira Tickets)**: 15
**Acceptance Criteria**: 98
**Test Scenarios**: 61

### Stories Overview

| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Add Cosine Gradient Palette GLSL Functions | Developer | ~2 days | None |
| 2 | Add Cosine Palette Preset Definitions | Developer | ~1 day | Story 1 |
| 3 | Create Faces Sidebar Section | User | ~2 days | None |
| 4 | Add Algorithm Selector to Faces Section | User | ~2 days | Story 2, 3 |
| 5 | Add Distribution Controls to Faces Section | User | ~2 days | Story 1, 3 |
| 6 | Add Smooth Hue Interpolation to Legacy Modes | User | ~1 day | None |
| 7 | Add Normal-Based Coloring Algorithm | User | ~2 days | Story 1 |
| 8 | Add Distance-Field Gradient Algorithm | User | ~1.5 days | Story 1 |
| 9 | Add LCH/Oklab Color Space Option | User | ~2 days | Story 1 |
| 10 | Add Multi-Source Color Mapping | User | ~2 days | Story 1 |
| 11 | Add Algorithm Blending | User | ~2 days | Story 7, 8 |
| 12 | Add Preset Save/Load Functionality | User | ~2 days | Story 4, 5 |
| 13 | Add Preset Export/Import Functionality | User | ~1.5 days | Story 12 |
| 14 | Add Custom Palette Editor Modal | User | ~2 days | Story 2 |
| 15 | Add Gradient Preview Component | User | ~1 day | Story 2 |

### Coverage

- Happy paths: 30
- Error handling: 13
- Edge cases: 11
- Permission/access: 0
- System behavior: 7

### Placeholders Requiring Confirmation

- [PLACEHOLDER: Maximum number of user presets - suggested 50]
- [PLACEHOLDER: Custom palette coefficient ranges - suggested 0-2 for each]
- [PLACEHOLDER: Animation speed range for color offset - suggested 0-1]

### Open Questions

- Should histogram equalization be included (requires 2-pass rendering, significant complexity)?
- Should color presets sync across devices (requires backend)?

### Dependencies Between Stories

- Story 2 depends on Story 1 (needs GLSL functions for presets)
- Story 4 depends on Stories 2 and 3 (needs presets and section container)
- Story 5 depends on Stories 1 and 3 (needs shader functions and section container)
- Stories 7, 8, 9, 10 depend on Story 1 (use same shader architecture)
- Story 11 depends on Stories 7 and 8 (blends between algorithms)
- Story 12 depends on Stories 4 and 5 (saves those settings)
- Story 13 depends on Story 12 (extends preset management)
- Story 14 depends on Story 2 (edits palette coefficients)
- Story 15 depends on Story 2 (renders palette preview)

### Ready for Development: YES

---

## User Story 1: Add Cosine Gradient Palette GLSL Functions

**User story:** As a developer, I want to add cosine gradient palette functions to the shader system so that smooth, continuous color gradients can be generated.

**Acceptance criteria**

1. A new GLSL function `cosinePalette(t, a, b, c, d)` is added to `palette.glsl.ts`
2. The function accepts a variation value `t` (0-1) and four vec3 coefficient vectors (a, b, c, d)
3. The function returns a vec3 RGB color computed as: `a + b * cos(6.28318 * (c * t + d))`
4. The function produces smooth, continuous color output with no visible banding
5. The function handles edge cases where `t` is exactly 0 or 1 without artifacts
6. The function is compatible with both raymarching shaders and face rendering shader injection
7. A new GLSL function `remapTrap(trap, power, cycles, offset)` is added for value distribution control
8. The remap function applies: `fract(pow(trap, power) * cycles + offset)`
9. New shader uniform declarations are added for palette coefficients: `uPaletteA`, `uPaletteB`, `uPaletteC`, `uPaletteD`
10. New shader uniform declarations are added for distribution: `uTrapPower`, `uTrapCycles`, `uTrapOffset`
11. A new color algorithm uniform `uColorAlgorithm` is added (integer, 0-9)
12. The `getPaletteColor` function is updated to support the new cosine algorithm when `uColorAlgorithm == 1`

**Test scenarios**

Scenario 1: Cosine palette generates smooth rainbow gradient
- Given the cosine palette function with rainbow preset coefficients (a=[0.5,0.5,0.5], b=[0.5,0.5,0.5], c=[1,1,1], d=[0,0.33,0.67])
- When t varies from 0.0 to 1.0 in 0.01 increments
- Then each adjacent color pair has a maximum RGB channel difference of less than 0.05

Scenario 2: Cosine palette handles boundary values
- Given the cosine palette function with any valid coefficients
- When t equals exactly 0.0 or exactly 1.0
- Then the function returns a valid RGB color with all components in range [0, 1]

Scenario 3: Trap remapping applies power curve correctly
- Given the remapTrap function with power=0.5, cycles=1, offset=0
- When input trap value is 0.25
- Then output is 0.5 (square root of 0.25)

Scenario 4: Trap remapping applies cycles correctly
- Given the remapTrap function with power=1, cycles=3, offset=0
- When input trap value is 0.5
- Then output is 0.5 (fract of 1.5)

---

## User Story 2: Add Cosine Palette Preset Definitions

**User story:** As a developer, I want to define cosine palette preset coefficients so that users can select from curated color schemes.

**Acceptance criteria**

1. A new TypeScript file `src/lib/shaders/palette/presets.ts` contains preset definitions
2. At minimum 10 presets are defined: Rainbow, Fire, Ocean, Sunset, Forest, Candy, Neon, Pastel, Monochrome, Earth
3. Each preset includes: name (string), a (vec3), b (vec3), c (vec3), d (vec3) coefficients
4. A `COSINE_PALETTE_PRESETS` constant exports all presets as a Record keyed by preset ID
5. A `CosinePalettePreset` TypeScript interface defines the preset structure
6. The Rainbow preset produces a full-spectrum color cycle across t=0 to t=1
7. The Monochrome preset produces grayscale output only (no hue variation)
8. The Fire preset produces warm colors ranging from dark red through orange to yellow
9. The Ocean preset produces cool colors ranging from deep blue through cyan to white
10. Each preset has been visually verified to produce aesthetically pleasing results

**Test scenarios**

Scenario 1: All presets have valid structure
- Given the COSINE_PALETTE_PRESETS constant
- When iterating through all preset entries
- Then each preset has name, a, b, c, d properties with correct types

Scenario 2: Rainbow preset produces full spectrum
- Given the Rainbow preset coefficients applied to cosinePalette
- When sampling colors at t=0, t=0.33, t=0.67
- Then visually distinct colors (red-ish, green-ish, blue-ish) are produced

Scenario 3: Monochrome preset produces grayscale
- Given the Monochrome preset coefficients applied to cosinePalette
- When sampling colors at any t value
- Then R, G, B components are equal (within 0.01 tolerance)

Scenario 4: Preset count meets minimum
- Given the COSINE_PALETTE_PRESETS constant
- When counting the number of presets
- Then at least 10 presets exist

---

## User Story 3: Create Faces Sidebar Section

**User story:** As a user, I want a dedicated "Faces" section in the sidebar so that I can easily find and control all face/surface color settings in one place.

**Acceptance criteria**

1. A new collapsible "Faces" section appears in the sidebar between Animation and Projection sections
2. The section has a header titled "Faces" with a collapse/expand toggle
3. The section is only visible when faces are enabled (facesVisible = true in the store)
4. When faces are disabled, the entire Faces section is hidden from the sidebar
5. The section contains: Surface Color picker, Face Opacity slider, Fresnel Rim toggle, and Fresnel Intensity slider (moved from ShaderSettings)
6. All existing face-related controls are removed from the Visual section's ShaderSettings component
7. The section defaults to collapsed state (defaultOpen = false)
8. Expanding/collapsing the section is animated smoothly
9. The section persists its collapsed/expanded state during the session
10. The section uses the same styling conventions as other sidebar sections (GeometrySection, AnimationSection, etc.)

**Test scenarios**

Scenario 1: Faces section appears when faces enabled
- Given the user has enabled the Faces toggle in Render Mode
- When viewing the sidebar
- Then the "Faces" section appears between Animation and Projection sections

Scenario 2: Faces section hidden when faces disabled
- Given the user has disabled the Faces toggle in Render Mode
- When viewing the sidebar
- Then the "Faces" section is not visible

Scenario 3: Surface Color control in Faces section
- Given the Faces section is visible and expanded
- When viewing the section contents
- Then a Surface Color picker is visible with the current face color

Scenario 4: Face Opacity control in Faces section
- Given the Faces section is visible and expanded
- When viewing the section contents
- Then a Face Opacity slider (0-1) is visible

Scenario 5: Section collapse/expand works
- Given the Faces section is collapsed
- When the user clicks the section header
- Then the section expands to reveal all controls with smooth animation

---

## User Story 4: Add Algorithm Selector to Faces Section

**User story:** As a user, I want to select a color algorithm from the Faces section so that I can choose how colors are generated on the surface.

**Acceptance criteria**

1. A "Color Algorithm" dropdown appears in the Faces section below the Surface Color picker
2. The dropdown displays algorithm options: Solid Color, Cosine Gradients, LCH Cycle, Normal-Based, Distance-Field, Multi-Source
3. "Cosine Gradients" is marked as "(Recommended)" in the dropdown
4. Selecting an algorithm updates the `uColorAlgorithm` shader uniform
5. When "Cosine Gradients" is selected, a nested "Palette" dropdown appears below
6. The Palette dropdown lists all cosine palette presets (Rainbow, Fire, Ocean, etc.)
7. Selecting a palette preset updates the shader uniform coefficients (uPaletteA, uPaletteB, uPaletteC, uPaletteD)
8. When "Solid Color" is selected, no palette/distribution controls are shown
9. When "Solid Color" is selected, a message appears: "Using solid color - no palette variation applied"
10. The selected algorithm and palette persist across page refreshes (stored in visualStore)
11. Legacy color modes (Analogous, Complementary, Triadic, Split-Complementary) are moved to a "Legacy" submenu
12. Visual changes apply in real-time as user changes selections

**Test scenarios**

Scenario 1: Algorithm selector shows all options
- Given the user is viewing the Faces section with faces visible
- When the user clicks the Color Algorithm dropdown
- Then options for Solid Color, Cosine Gradients (Recommended), LCH Cycle, Normal-Based, Distance-Field, and Multi-Source are visible

Scenario 2: Selecting Cosine Gradients shows palette dropdown
- Given the user has the Color Algorithm dropdown open
- When the user selects "Cosine Gradients"
- Then a "Palette" dropdown appears with preset options (Rainbow, Fire, Ocean, etc.)

Scenario 3: Palette selection updates rendered object
- Given the user has selected "Cosine Gradients" algorithm
- When the user changes the palette from "Rainbow" to "Fire"
- Then the rendered polytope/fractal colors change to warm fire tones within 100ms

Scenario 4: Solid Color hides variation controls
- Given the user is viewing the Faces section
- When the user selects "Solid Color" algorithm
- Then the Palette dropdown and Distribution Controls are hidden, and message "Using solid color - no palette variation applied" appears

Scenario 5: Settings persist after refresh
- Given the user has selected "Cosine Gradients" algorithm with "Ocean" palette
- When the user refreshes the browser page
- Then the algorithm is still "Cosine Gradients" and palette is still "Ocean"

---

## User Story 5: Add Distribution Controls to Faces Section

**User story:** As a user, I want to adjust distribution controls in the Faces section so that I can fine-tune how colors are spread across the surface.

**Acceptance criteria**

1. A collapsible "Distribution" subsection appears within the Faces section below the palette selector
2. The subsection contains three sliders: Power Curve, Palette Cycles, Color Offset
3. Power Curve slider ranges from 0.2 to 2.0 with step 0.1, default 1.0
4. Palette Cycles slider ranges from 1 to 10 with step 1, default 1
5. Color Offset slider ranges from 0.0 to 1.0 with step 0.01, default 0
6. Each slider has a reset button that returns it to default value
7. Each slider shows its current numeric value
8. Changing any slider updates the corresponding shader uniform in real-time
9. Power Curve affects `uTrapPower` uniform - lower values spread dark colors, higher values compress them
10. Palette Cycles affects `uTrapCycles` uniform - higher values repeat the palette more times
11. Color Offset affects `uTrapOffset` uniform - shifts the starting point of the palette
12. Distribution controls are hidden when "Solid Color" algorithm is selected
13. A tooltip on each slider explains its effect in plain language

**Test scenarios**

Scenario 1: Power Curve slider affects color distribution
- Given the user has Cosine Gradients algorithm with Rainbow palette selected
- When the user drags Power Curve from 1.0 to 0.5
- Then dark areas of the rendered object become more prominent and spread further

Scenario 2: Palette Cycles creates color repetition
- Given the user has Cosine Gradients algorithm selected
- When the user increases Palette Cycles from 1 to 3
- Then the rainbow color pattern repeats 3 times across the surface

Scenario 3: Color Offset shifts palette
- Given the user has Cosine Gradients algorithm with Rainbow palette selected
- When the user changes Color Offset from 0.0 to 0.33
- Then colors that were red become green, green becomes blue, blue becomes red (hue rotation)

Scenario 4: Reset button restores default
- Given the user has modified Power Curve to 0.3
- When the user clicks the reset button next to Power Curve
- Then Power Curve returns to 1.0

Scenario 5: Distribution controls hidden for Solid Color
- Given the user is viewing the Faces section
- When the user selects "Solid Color" algorithm
- Then the Distribution subsection is not visible

---

## User Story 6: Add Smooth Hue Interpolation to Legacy Modes

**User story:** As a user, I want legacy color modes (Complementary, Triadic, Split-Complementary) to have smooth transitions so that visible color banding is eliminated.

**Acceptance criteria**

1. The `getPaletteColor` function in GLSL is updated for modes 2, 3, 4 (Complementary, Triadic, Split-Complementary)
2. Sharp if/else hue transitions are replaced with smoothstep blending zones
3. Complementary mode blends between base hue and complement over t range 0.4-0.6
4. Triadic mode blends between three hues with 0.15-width blend zones at t=0.33 and t=0.67
5. Split-Complementary mode blends between three hues with 0.15-width blend zones
6. Blending uses `smoothstep()` for natural, non-linear transitions
7. Colors are blended in RGB space after HSL conversion (not by interpolating hue directly)
8. Visual result shows no hard edges between color regions on smooth surfaces
9. Legacy modes remain accessible in a "Legacy Modes" submenu in the algorithm dropdown within the Faces section
10. Existing saved presets using legacy modes continue to work

**Test scenarios**

Scenario 1: Triadic mode shows smooth transitions
- Given the user selects "Triadic" from Legacy Modes in the Faces section
- When rendering a smooth surface (e.g., Mandelbulb fractal)
- Then no visible hard edges appear between the three color regions

Scenario 2: Complementary blend zone is correct width
- Given the complementary mode is selected
- When t varies from 0.39 to 0.61
- Then colors smoothly transition from base hue to complement

Scenario 3: Legacy modes still accessible
- Given the user opens the Color Algorithm dropdown in the Faces section
- When the user expands the "Legacy" submenu
- Then Monochromatic, Analogous, Complementary, Triadic, and Split-Complementary are available

Scenario 4: Backward compatibility maintained
- Given a user had previously saved settings with "triadic" colorMode
- When the application loads those settings
- Then the triadic mode is applied correctly (mapped to legacy mode)

---

## User Story 7: Add Normal-Based Coloring Algorithm

**User story:** As a user, I want to color surfaces based on their normal direction so that I can visualize surface orientation.

**Acceptance criteria**

1. A "Normal-Based" option appears in the Color Algorithm dropdown in the Faces section
2. When selected, surface colors are derived from the surface normal vector direction
3. For raymarching shaders, the computed surface normal is used
4. For face rendering, the face normal is used
5. Normal direction is converted to hue using: `hue = atan(normal.y, normal.x) / (2 * PI)`
6. Normal tilt from vertical affects saturation: horizontal surfaces are more saturated
7. A "Base Hue Shift" control appears in the Faces section when Normal-Based is selected
8. The effect works in both view-space (colors change with camera) and world-space (colors fixed) modes
9. A toggle allows switching between view-space and world-space normal mapping
10. Distribution controls (Power Curve, Cycles, Offset) still apply to the normalized normal value

**Test scenarios**

Scenario 1: Normal-based coloring shows direction
- Given the user selects "Normal-Based" algorithm in the Faces section
- When viewing a polytope from the front
- Then faces pointing different directions show different hues

Scenario 2: View-space mode changes with camera
- Given Normal-Based algorithm is selected in view-space mode
- When the user rotates the camera around the object
- Then face colors change as their orientation relative to camera changes

Scenario 3: World-space mode stays constant
- Given Normal-Based algorithm is selected in world-space mode
- When the user rotates the camera around the object
- Then face colors remain constant (same face = same color)

Scenario 4: Base hue shift rotates palette
- Given Normal-Based algorithm is selected
- When the user adjusts "Base Hue Shift" by 0.33 (120 degrees)
- Then all colors rotate by approximately 120 degrees on the color wheel

---

## User Story 8: Add Distance-Field Gradient Algorithm

**User story:** As a user, I want to color surfaces based on distance from camera so that I can create depth-based color effects.

**Acceptance criteria**

1. A "Distance-Field" option appears in the Color Algorithm dropdown in the Faces section
2. When selected, colors are derived from the distance between surface point and camera
3. The algorithm is only available for raymarched objects (Mandelbulb, Hyperbulb)
4. For face-rendered polytopes, selecting this algorithm shows message: "Distance-Field coloring is only available for raymarched objects (Mandelbulb, Hyperbulb)"
5. Distance is normalized to 0-1 range based on the current view frustum
6. Hue cycles based on distance: `hue = fract(normalizedDistance * uTrapCycles)`
7. The effect creates smooth color bands radiating outward from the camera
8. A "Distance Scale" slider appears in the Faces section when Distance-Field is selected (0.1 to 5.0)
9. Distribution controls apply to the distance value before color lookup

**Test scenarios**

Scenario 1: Distance coloring creates depth bands
- Given the user selects "Distance-Field" algorithm while viewing Mandelbulb
- When Palette Cycles is set to 3
- Then three distinct color cycles are visible moving from near to far

Scenario 2: Not available for polytopes
- Given the user is viewing a Tesseract (face-rendered polytope)
- When the user selects "Distance-Field" algorithm in the Faces section
- Then message "Distance-Field coloring is only available for raymarched objects" appears

Scenario 3: Distance Scale affects band width
- Given Distance-Field algorithm is selected on Mandelbulb
- When Distance Scale is increased from 1.0 to 3.0
- Then color bands become narrower (cycle faster with distance)

---

## User Story 9: Add LCH/Oklab Color Space Option

**User story:** As a user, I want to generate colors in perceptually uniform color spaces so that color transitions appear visually smooth and even.

**Acceptance criteria**

1. An "LCH Cycle" option appears in the Color Algorithm dropdown in the Faces section
2. When selected, colors are generated using LCH (Lightness, Chroma, Hue) color space
3. GLSL conversion functions `lch2rgb()` and `rgb2lch()` are added to palette.glsl.ts
4. Hue cycles through the full 360-degree range as t varies from 0 to 1
5. Lightness varies with a secondary parameter (can use t or a geometric feature)
6. Chroma is maintained at a consistent perceptual level
7. Out-of-gamut colors are clamped to sRGB gamut before display
8. An "Advanced Options" collapsible subsection in the Faces section reveals a color space selector: sRGB, LCH, Oklab
9. When Oklab is selected, Oklab conversion functions are used instead of LCH
10. The visual result shows perceptually equal steps between hue values

**Test scenarios**

Scenario 1: LCH produces perceptually uniform hues
- Given LCH Cycle algorithm is selected in the Faces section
- When viewing a smooth surface with t varying from 0 to 1
- Then hue transitions appear perceptually even (no "bright spots" or "muddy zones")

Scenario 2: Gamut clamping prevents invalid colors
- Given LCH Cycle with high chroma is selected
- When viewing any rendered object
- Then no pixels show invalid/clipped colors (all RGB values in 0-1)

Scenario 3: Color space selector changes algorithm
- Given the user has LCH Cycle selected
- When the user changes Color Space from LCH to Oklab in Advanced Options
- Then colors are generated using Oklab math instead of LCH

---

## User Story 10: Add Multi-Source Color Mapping

**User story:** As a user, I want to map different surface properties to different color channels so that I can create complex, information-rich visualizations.

**Acceptance criteria**

1. A "Multi-Source" option appears in the Color Algorithm dropdown in the Faces section
2. When selected, a "Multi-Source Mapping" panel appears within the Faces section with three dropdowns
3. "Hue Source" dropdown with options: Orbit Trap/Face Depth (default), Normal Direction, World Position, Distance from Camera, Curvature
4. "Saturation Source" dropdown with same options
5. "Lightness Source" dropdown with options: same as above plus Ambient Occlusion
6. Each source dropdown has a "Scale" slider (0.0 to 2.0, default 1.0)
7. Selecting a source maps that geometric property to the corresponding HSL channel
8. For raymarching, all sources are available
9. For face rendering, only Face Depth, Normal Direction, and World Position are available (others show as disabled with tooltip "Only available for raymarched objects")
10. The resulting HSL color is converted to RGB for display
11. Distribution controls affect the primary source (Hue Source) only

**Test scenarios**

Scenario 1: Multi-source shows panel
- Given the user selects "Multi-Source" algorithm in the Faces section
- When the selection is confirmed
- Then the Multi-Source Mapping panel appears within the Faces section with Hue, Saturation, Lightness source dropdowns

Scenario 2: Different sources produce different visuals
- Given Multi-Source is selected with Hue=Normal Direction, Saturation=Face Depth, Lightness=Face Depth
- When viewing a polytope
- Then face colors vary by both orientation (hue) and depth (saturation/lightness)

Scenario 3: Unavailable sources disabled for polytopes
- Given the user is viewing a face-rendered polytope with Multi-Source selected
- When the user opens the Hue Source dropdown
- Then "Distance from Camera", "Curvature", and "Ambient Occlusion" appear grayed out with tooltip

Scenario 4: Scale multiplies source value
- Given Multi-Source with Hue Source=Normal Direction, Scale=2.0
- When viewing the object
- Then hue variation is doubled (colors cycle twice across the same normal range)

---

## User Story 11: Add Algorithm Blending

**User story:** As a user, I want to blend two color algorithms together so that I can create hybrid visual effects.

**Acceptance criteria**

1. An "Advanced Options" collapsible subsection appears in the Faces section
2. The subsection contains a "Blending Mode" dropdown: None, Blend Two Algorithms
3. When "Blend Two Algorithms" is selected, a "Secondary Algorithm" dropdown appears
4. Secondary Algorithm dropdown contains the same options as primary (excluding current primary selection)
5. A "Blend Amount" slider appears (0% to 100%, default 50%)
6. At 0% blend, only primary algorithm colors are shown
7. At 100% blend, only secondary algorithm colors are shown
8. At 50% blend, colors are averaged between primary and secondary
9. Blending is performed in RGB space using linear interpolation
10. Both algorithms receive the same t/variation value
11. Performance impact is less than 10% frame rate reduction when blending is enabled

**Test scenarios**

Scenario 1: Blend mode UI appears correctly
- Given the user expands Advanced Options in the Faces section
- When the user selects "Blend Two Algorithms" from Blending Mode
- Then Secondary Algorithm dropdown and Blend Amount slider appear

Scenario 2: 0% blend shows primary only
- Given Cosine Gradients (Rainbow) as primary, Normal-Based as secondary, Blend=0%
- When viewing the rendered object
- Then colors match pure Cosine Gradients Rainbow (no normal-based coloring visible)

Scenario 3: 100% blend shows secondary only
- Given Cosine Gradients (Rainbow) as primary, Normal-Based as secondary, Blend=100%
- When viewing the rendered object
- Then colors match pure Normal-Based coloring (no rainbow cycling visible)

Scenario 4: 50% blend creates hybrid
- Given Cosine Gradients (Fire) as primary, LCH Cycle as secondary, Blend=50%
- When viewing the rendered object
- Then colors appear as a mix of fire tones and LCH cycling

---

## User Story 12: Add Preset Save/Load Functionality

**User story:** As a user, I want to save and load color presets so that I can reuse my favorite color configurations.

**Acceptance criteria**

1. A "Presets" subsection appears at the bottom of the Faces section
2. A preset dropdown shows currently selected preset name (or "Custom" if modified)
3. Built-in presets appear first: "Default (Rainbow)", "Fire & Brimstone", "Ocean Depths", "Neon Glow"
4. User-saved presets appear below built-in presets, separated by a divider
5. A "Save" button saves current settings as a new preset (prompts for name)
6. Preset names must be 1-50 characters, alphanumeric plus spaces
7. Duplicate preset names are rejected with message "A preset with this name already exists"
8. A "Rename" option appears in preset dropdown menu for user presets
9. A "Delete" option appears in preset dropdown menu for user presets (with confirmation)
10. Built-in presets show a lock icon and cannot be renamed or deleted
11. Maximum of [PLACEHOLDER: 50] user presets can be saved
12. Presets are stored in browser localStorage under key `mdimension_color_presets`
13. When exceeding maximum, user sees "Maximum presets reached. Delete some presets to save new ones."
14. Selecting a preset applies all its settings immediately

**Test scenarios**

Scenario 1: Save preset flow
- Given the user has configured custom color settings in the Faces section
- When the user clicks "Save" and enters name "My Fire Theme"
- Then a new preset "My Fire Theme" appears in the user presets section

Scenario 2: Load preset applies settings
- Given the user has saved a preset with Fire palette and Power Curve 0.7
- When the user selects that preset from the dropdown
- Then palette changes to Fire and Power Curve slider shows 0.7

Scenario 3: Delete preset with confirmation
- Given the user has a saved preset "Test Preset"
- When the user clicks Delete on "Test Preset" and confirms
- Then "Test Preset" is removed from the preset list

Scenario 4: Cannot delete built-in presets
- Given the user is viewing the preset dropdown
- When hovering over "Default (Rainbow)" built-in preset
- Then no Delete option is shown, and a lock icon indicates it's built-in

Scenario 5: Duplicate name rejected
- Given a preset named "Ocean Theme" already exists
- When the user tries to save a new preset with name "Ocean Theme"
- Then error message "A preset with this name already exists" appears

---

## User Story 13: Add Preset Export/Import Functionality

**User story:** As a user, I want to export and import color presets as files so that I can share them with others or back them up.

**Acceptance criteria**

1. An "Export" button appears in the Presets subsection of the Faces section
2. Clicking Export downloads the currently selected preset as a JSON file
3. The filename format is `preset-{name}.json` (spaces replaced with hyphens)
4. The JSON file contains: name, version, created date, algorithm, and all settings
5. An "Import" button appears in the Presets subsection
6. Clicking Import opens a file picker for .json files
7. Imported preset JSON is validated against expected schema
8. Invalid JSON files show error: "Invalid preset file format"
9. Successfully imported presets are added to user presets
10. If imported preset has same name as existing, user is prompted: "Replace existing preset?" with Yes/No
11. Version checking warns if importing preset from newer app version: "This preset was created with a newer version. Some features may not work correctly."
12. A "Reset to Default" button restores factory default settings

**Test scenarios**

Scenario 1: Export creates valid JSON file
- Given the user has selected preset "My Fire Theme"
- When the user clicks Export
- Then a file "preset-my-fire-theme.json" downloads with correct JSON structure

Scenario 2: Import valid preset succeeds
- Given the user has a valid preset JSON file
- When the user clicks Import and selects the file
- Then the preset appears in user presets and can be selected

Scenario 3: Import invalid file shows error
- Given the user has a malformed JSON file
- When the user clicks Import and selects the file
- Then error "Invalid preset file format" appears and no preset is added

Scenario 4: Import duplicate prompts for replace
- Given preset "Ocean Theme" exists and user imports a file also named "Ocean Theme"
- When the import is processed
- Then prompt "Replace existing preset?" appears with Yes/No options

Scenario 5: Reset to Default restores factory settings
- Given the user has modified many color settings
- When the user clicks "Reset to Default"
- Then all settings return to factory defaults (Cosine Gradients, Rainbow, Power=1, Cycles=1, Offset=0)

---

## User Story 14: Add Custom Palette Editor Modal

**User story:** As a user, I want to visually edit cosine palette coefficients so that I can create unique color schemes.

**Acceptance criteria**

1. When "Custom" is selected in the Palette dropdown in the Faces section, a "Edit Custom Palette" button appears
2. Clicking the button opens a modal dialog
3. The modal displays four coefficient editors: A (Base), B (Amplitude), C (Frequency), D (Phase)
4. Each coefficient editor shows three sliders for R, G, B channels
5. All sliders range from 0.0 to 2.0 with step 0.01
6. A live gradient preview at the top of the modal shows the current palette
7. Changes to any slider update the preview in real-time
8. A "Randomize" button generates random coefficients
9. A "Copy from Preset" dropdown allows starting from an existing preset's coefficients
10. "Apply" button closes modal and applies the custom palette
11. "Cancel" button closes modal without applying changes
12. Applied custom palette is stored and persists across sessions
13. The custom palette can be saved as a user preset

**Test scenarios**

Scenario 1: Edit button opens modal
- Given the user has selected "Custom" in the Palette dropdown in the Faces section
- When the user clicks "Edit Custom Palette"
- Then a modal opens with coefficient editors and live preview

Scenario 2: Slider changes update preview
- Given the custom palette editor modal is open
- When the user drags any coefficient slider
- Then the gradient preview updates within 50ms

Scenario 3: Copy from preset initializes coefficients
- Given the custom palette editor modal is open
- When the user selects "Fire" from "Copy from Preset" dropdown
- Then all coefficient sliders update to match Fire preset values

Scenario 4: Cancel discards changes
- Given the user has modified coefficients in the modal
- When the user clicks "Cancel"
- Then the modal closes and rendered colors remain unchanged from before modal opened

Scenario 5: Apply persists changes
- Given the user has created a custom palette in the modal
- When the user clicks "Apply" and then refreshes the page
- Then the custom palette is still applied

---

## User Story 15: Add Gradient Preview Component

**User story:** As a user, I want to see a live preview of the current color palette so that I can understand what colors will be applied.

**Acceptance criteria**

1. A gradient preview bar appears in the Faces section below the Palette dropdown when Cosine Gradients is selected
2. The preview is a horizontal bar showing the palette gradient from t=0 (left) to t=1 (right)
3. The preview width spans the full section width (minus padding)
4. The preview height is 24 pixels
5. The preview updates in real-time when palette preset changes
6. The preview updates in real-time when distribution controls change
7. Labels "0.0" and "1.0" appear below the left and right edges
8. Hovering over the preview shows a tooltip with the RGB values at that position
9. The preview is rendered using Canvas 2D (not WebGL) for performance
10. The preview shows the same colors that will appear on the rendered object

**Test scenarios**

Scenario 1: Preview shows correct gradient
- Given the user has selected "Rainbow" palette with default distribution in the Faces section
- When viewing the gradient preview
- Then colors progress from red (left) through green (middle) to blue (right)

Scenario 2: Preview updates with palette change
- Given the user has Rainbow palette selected
- When the user changes to Fire palette
- Then preview immediately changes to show warm fire colors

Scenario 3: Preview updates with distribution change
- Given the user has Cycles=1
- When the user changes Cycles to 3
- Then preview shows the palette repeated 3 times across the bar

Scenario 4: Hover tooltip shows RGB
- Given the user is viewing the gradient preview
- When the user hovers at the center of the preview
- Then a tooltip appears showing approximate RGB values like "RGB: 128, 255, 64"

---

## Technical Specifications

### New TypeScript Types

```typescript
// src/lib/shaders/palette/types.ts

export type ColorAlgorithm =
  | 'solid'
  | 'cosine'
  | 'lch'
  | 'normal'
  | 'distance'
  | 'multiSource'
  // Legacy modes
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'splitComplementary'

export interface CosinePalettePreset {
  name: string
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
  d: [number, number, number]
}

export type ColorSource =
  | 'trap'      // Orbit trap / face depth
  | 'normal'    // Surface normal direction
  | 'position'  // World position
  | 'distance'  // Distance from camera
  | 'curvature' // Surface curvature
  | 'ao'        // Ambient occlusion

export interface ColorSettings {
  algorithm: ColorAlgorithm
  cosinePalette: {
    preset: string  // Preset ID or 'custom'
    coefficients: {
      a: [number, number, number]
      b: [number, number, number]
      c: [number, number, number]
      d: [number, number, number]
    }
  }
  distribution: {
    powerCurve: number      // 0.2-2.0
    paletteCycles: number   // 1-10
    colorOffset: number     // 0-1
  }
  normalBased: {
    spaceMode: 'view' | 'world'
    baseHueShift: number    // 0-1
  }
  distanceField: {
    distanceScale: number   // 0.1-5.0
  }
  multiSource: {
    hueSource: ColorSource
    saturationSource: ColorSource
    lightnessSource: ColorSource
    hueScale: number
    saturationScale: number
    lightnessScale: number
  }
  blending: {
    enabled: boolean
    secondaryAlgorithm: ColorAlgorithm
    blendAmount: number     // 0-100
  }
  colorSpace: 'srgb' | 'lch' | 'oklab'
}

export interface ColorPreset {
  name: string
  version: string
  created: string  // ISO date
  isBuiltIn?: boolean
  settings: ColorSettings
}
```

### New Store Fields

```typescript
// Addition to visualStore.ts

interface VisualState {
  // ... existing fields ...

  // New color system fields
  colorAlgorithm: ColorAlgorithm
  cosinePalettePreset: string
  customPaletteCoefficients: {
    a: [number, number, number]
    b: [number, number, number]
    c: [number, number, number]
    d: [number, number, number]
  }
  distributionPower: number
  distributionCycles: number
  distributionOffset: number
  normalSpaceMode: 'view' | 'world'
  normalBaseHueShift: number
  distanceScale: number
  multiSourceHue: ColorSource
  multiSourceSaturation: ColorSource
  multiSourceLightness: ColorSource
  multiSourceHueScale: number
  multiSourceSaturationScale: number
  multiSourceLightnessScale: number
  blendingEnabled: boolean
  secondaryAlgorithm: ColorAlgorithm
  blendAmount: number
  colorSpace: 'srgb' | 'lch' | 'oklab'

  // Preset management
  currentPresetName: string | null
  userPresets: ColorPreset[]
  hasUnsavedChanges: boolean
}
```

### New Shader Uniforms

```glsl
// Added to both raymarching and face rendering shaders

// Algorithm selection
uniform int uColorAlgorithm;      // 0-9

// Cosine palette coefficients
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;

// Distribution controls
uniform float uTrapPower;         // 0.2-2.0
uniform float uTrapCycles;        // 1-10
uniform float uTrapOffset;        // 0-1

// Normal-based settings
uniform int uNormalSpaceMode;     // 0=view, 1=world
uniform float uNormalHueShift;    // 0-1

// Distance-field settings
uniform float uDistanceScale;     // 0.1-5.0

// Multi-source settings
uniform int uHueSource;           // 0-5
uniform int uSaturationSource;
uniform int uLightnessSource;
uniform float uHueScale;
uniform float uSaturationScale;
uniform float uLightnessScale;

// Blending
uniform int uBlendingEnabled;     // 0 or 1
uniform int uSecondaryAlgorithm;
uniform float uBlendAmount;       // 0-1

// Color space
uniform int uColorSpace;          // 0=sRGB, 1=LCH, 2=Oklab
```

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/lib/shaders/palette/presets.ts` | Cosine palette preset definitions |
| `src/lib/shaders/palette/algorithms.glsl.ts` | New GLSL algorithm functions |
| `src/lib/shaders/palette/colorspace.glsl.ts` | LCH/Oklab conversion functions |
| `src/components/sidebar/Faces/FacesSection.tsx` | Main Faces section container |
| `src/components/sidebar/Faces/index.ts` | Barrel export for Faces section |
| `src/components/sidebar/Faces/SurfaceColorPicker.tsx` | Surface color picker control |
| `src/components/sidebar/Faces/AlgorithmSelector.tsx` | Color algorithm dropdown |
| `src/components/sidebar/Faces/PaletteSelector.tsx` | Cosine palette preset dropdown |
| `src/components/sidebar/Faces/DistributionControls.tsx` | Power/Cycles/Offset sliders |
| `src/components/sidebar/Faces/MultiSourcePanel.tsx` | Multi-source mapping UI |
| `src/components/sidebar/Faces/PresetManager.tsx` | Save/Load/Export/Import |
| `src/components/sidebar/Faces/GradientPreview.tsx` | Live palette preview |
| `src/components/sidebar/Faces/AdvancedOptions.tsx` | Blending, color space options |
| `src/components/modals/CustomPaletteEditor.tsx` | Coefficient editor modal |
| `src/lib/presets/colorPresetStorage.ts` | localStorage preset management |
| `src/lib/presets/presetValidator.ts` | JSON schema validation |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/lib/shaders/palette/palette.glsl.ts` | Add cosine palette, remap, new algorithms |
| `src/lib/shaders/palette/types.ts` | Add new types, expand ColorMode |
| `src/stores/visualStore.ts` | Add new color system state and actions |
| `src/components/sidebar/Sidebar.tsx` | Add FacesSection between Animation and Projection |
| `src/components/sidebar/Visual/ShaderSettings.tsx` | Remove face color controls (moved to Faces section) |
| `src/components/sidebar/Visual/VisualSection.tsx` | Remove face-related controls |
| `src/components/canvas/renderers/Mandelbulb/mandelbulb.frag` | Add new uniforms, use new algorithms |
| `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag` | Add new uniforms, use new algorithms |
| `src/lib/shaders/materials/SurfaceMaterial.ts` | Update shader injection for new uniforms |

### Sidebar Section Order

After implementation, the sidebar sections will be ordered as:

1. **Render Mode Toggles** (always visible at top)
2. **Geometry** (object type, dimension, etc.)
3. **Animation** (rotation controls)
4. **Faces** (NEW - all face/surface color controls) - *only visible when faces enabled*
5. **Projection** (projection type, camera settings)
6. **Visual** (edge/vertex colors, bloom, lighting - non-face visuals)
7. **Environment** (ground plane, background)
8. **Settings** (theme, etc.)
9. **Export** (screenshot, share)
10. **Documentation**
11. **Shortcuts**

---

## Appendix: Cosine Palette Preset Coefficients

### Built-in Presets

| Preset | A | B | C | D |
|--------|---|---|---|---|
| Rainbow | [0.5, 0.5, 0.5] | [0.5, 0.5, 0.5] | [1.0, 1.0, 1.0] | [0.0, 0.33, 0.67] |
| Fire | [0.5, 0.5, 0.5] | [0.5, 0.5, 0.5] | [1.0, 1.0, 0.5] | [0.8, 0.9, 0.3] |
| Sunset | [0.5, 0.5, 0.5] | [0.5, 0.5, 0.5] | [1.0, 0.7, 0.4] | [0.0, 0.15, 0.20] |
| Ocean | [0.2, 0.5, 0.8] | [0.2, 0.4, 0.2] | [2.0, 1.0, 1.0] | [0.0, 0.25, 0.25] |
| Ice | [0.4, 0.6, 0.8] | [0.3, 0.4, 0.5] | [1.0, 1.0, 1.0] | [0.5, 0.6, 0.7] |
| Forest | [0.2, 0.5, 0.2] | [0.3, 0.5, 0.3] | [1.0, 1.0, 0.5] | [0.2, 0.5, 0.3] |
| Candy | [0.8, 0.5, 0.4] | [0.2, 0.4, 0.2] | [2.0, 1.0, 1.0] | [0.0, 0.25, 0.25] |
| Neon | [0.5, 0.5, 0.5] | [0.5, 0.5, 0.5] | [2.0, 1.0, 0.0] | [0.5, 0.2, 0.25] |
| Earth | [0.4, 0.3, 0.2] | [0.3, 0.3, 0.2] | [1.0, 1.0, 0.5] | [0.0, 0.1, 0.2] |
| Monochrome | [0.5, 0.5, 0.5] | [0.5, 0.5, 0.5] | [0.0, 0.0, 0.0] | [0.0, 0.0, 0.0] |

---

## References

- [Inigo Quilez: Procedural Palettes](https://iquilezles.org/articles/palettes/)
- [Wikipedia: Plotting algorithms for the Mandelbrot set](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set)
- [Inigo Quilez: Orbit Traps](https://iquilezles.org/articles/orbittraps3d/)
- Research document: `docs/prd/new_color_modes.md`
