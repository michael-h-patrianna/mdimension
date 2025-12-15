# Quaternion Julia Sets Fractal Type

## Overview

**Feature**: Quaternion/Hypercomplex Julia Sets - A 4D+ fractal type that generalizes the classic Julia set `z = z² + c` from complex numbers to quaternions and higher hypercomplex algebras.

**Why it morphs well**: Quaternion multiplication mixes components strongly through non-commutative operations, so changing slice orientation yields genuinely different structures (bubbles, tubes, blobby organs) rather than just viewpoint changes.

**Reference**: See `docs/prd/extended-fractal-types.md` Section 1 for mathematical foundation.

---

## Specification Summary

**Feature**: Quaternion Julia Sets Fractal Renderer
**User Stories (Jira Tickets)**: 12
**Estimated Total Effort**: ~20 man-days

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Core Quaternion Julia Renderer | Developer | ~2 days | None |
| 2 | Julia Constant Parameter Controls | User | ~2 days | Story 1 |
| 3 | Power Variant Selection | User | ~1.5 days | Story 1 |
| 4 | D-Dimensional Rotation System | User | ~2 days | Story 1 |
| 5 | Lighting System Integration | User | ~2 days | Story 1 |
| 6 | Shadow System Integration | User | ~1.5 days | Story 5 |
| 7 | Color Algorithm System | User | ~2 days | Story 1 |
| 8 | Opacity/Transparency Modes | User | ~2 days | Story 1 |
| 9 | Animation System - Julia Constant Path | User | ~2 days | Story 2 |
| 10 | Animation System - Slice Origin Drift | User | ~1.5 days | Story 4 |
| 11 | Animation System - Power Morphing | User | ~1 day | Story 3 |
| 12 | Performance & Quality Controls | User | ~1.5 days | Story 1 |

---

## User Story 1: Core Quaternion Julia Renderer

**User story:** As a user, I want to view a Quaternion Julia Set fractal so that I can explore 4D hypercomplex mathematical structures in 3D.

**Acceptance criteria**
1. User can select "Quaternion Julia" from the fractal type selector in the geometry panel
2. When selected, the viewport displays a 3D slice through the 4D quaternion Julia set
3. The fractal is rendered using raymarching with smooth shading
4. Default Julia constant `c` is set to produce an interesting initial shape (e.g., `c = (0.3, 0.5, 0.4, 0.2)`)
5. The fractal responds to standard camera controls (orbit, pan, zoom)
6. Iteration count defaults to 64 with bailout radius of 4.0
7. The fractal maintains visual stability without flickering or banding artifacts
8. Normal vectors are computed for proper lighting via gradient estimation from the scalar potential field
9. Frame rate remains above 30fps on mid-range hardware at default quality settings

**Test scenarios**

Scenario 1: Select Quaternion Julia fractal type
- Given the user is viewing any fractal in the viewport
- When the user selects "Quaternion Julia" from the fractal type dropdown
- Then the viewport displays the Quaternion Julia set with default parameters and smooth shading

Scenario 2: Camera interaction with fractal
- Given the user is viewing the Quaternion Julia fractal
- When the user orbits, pans, or zooms the camera
- Then the fractal view updates smoothly in real-time without artifacts

Scenario 3: Default rendering quality
- Given the user has just selected Quaternion Julia fractal
- When the fractal renders at default settings
- Then the fractal displays without visible banding, with smooth iteration count coloring

Scenario 4: Empty/degenerate Julia constant
- Given the user sets Julia constant `c` to (0, 0, 0, 0)
- When the fractal renders
- Then the system displays a valid (though simple) fractal shape without crashing

---

## User Story 2: Julia Constant Parameter Controls

**User story:** As a user, I want to adjust the Julia constant `c` parameters so that I can explore different Julia set shapes.

**Acceptance criteria**
1. The Quaternion Julia controls panel displays four sliders for the Julia constant components: `c.x`, `c.y`, `c.z`, `c.w`
2. Each slider has range from -2.0 to 2.0 with step size 0.01
3. Default values are displayed next to each slider
4. Changes to any slider update the fractal in real-time
5. A "Randomize" button generates a random Julia constant within stable ranges
6. A preset dropdown offers curated Julia constants with descriptive names:
   - "Classic Bubble" (0.3, 0.5, 0.4, 0.2)
   - "Tentacles" (-0.2, 0.8, 0.0, -0.3)
   - "Coral" (0.1, -0.1, 0.2, 0.7)
   - "Sponge" (-0.4, -0.4, 0.4, 0.4)
   - "Whiskers" (0.5, 0.5, 0.5, -0.5)
7. User can save current Julia constant as a custom preset with a name
8. Tooltip explains that the Julia constant defines the fractal's fundamental shape

**Test scenarios**

Scenario 1: Adjust single Julia constant component
- Given the user is viewing the Quaternion Julia controls panel
- When the user moves the `c.x` slider from 0.3 to 0.8
- Then the fractal shape updates in real-time to reflect the new Julia constant

Scenario 2: Load Julia constant preset
- Given the user is on the Quaternion Julia controls panel
- When the user selects "Tentacles" from the preset dropdown
- Then all four sliders update to (-0.2, 0.8, 0.0, -0.3) and the fractal displays the tentacles shape

Scenario 3: Randomize Julia constant
- Given the user is viewing any Quaternion Julia shape
- When the user clicks the "Randomize" button
- Then a new random Julia constant is generated within stable ranges (-1.0 to 1.0) and the fractal updates

Scenario 4: Save custom preset
- Given the user has adjusted sliders to create a Julia constant they like
- When the user clicks "Save Preset" and enters the name "My Shape"
- Then "My Shape" appears in the preset dropdown with the saved values

---

## User Story 3: Power Variant Selection

**User story:** As a user, I want to change the iteration power so that I can explore quadratic, cubic, and higher-power Julia variations.

**Acceptance criteria**
1. A "Power" dropdown or slider is available in the Quaternion Julia controls
2. Supported power values are: 2 (quadratic), 3 (cubic), 4 (quartic), 5, 6, 7, 8
3. Default power is 2 (standard quadratic Julia)
4. Higher powers produce more complex, spiky structures
5. Changing power updates the fractal in real-time
6. Tooltip explains: "Higher powers create more complex folding patterns"
7. For powers > 2, the system uses generalized quaternion power formula

**Test scenarios**

Scenario 1: Change to cubic power
- Given the user is viewing a quadratic (power=2) Quaternion Julia
- When the user changes power to 3
- Then the fractal updates to show a more complex structure with additional symmetry

Scenario 2: Maximum power stability
- Given the user is viewing any Quaternion Julia
- When the user selects power 8
- Then the fractal renders stably without NaN artifacts or visual corruption

Scenario 3: Return to default power
- Given the user has power set to 5
- When the user selects power 2
- Then the fractal returns to the simpler quadratic form

---

## User Story 4: D-Dimensional Rotation System

**User story:** As a user, I want to rotate the 4D slice orientation so that I can explore different cross-sections of the quaternion Julia set.

**Acceptance criteria**
1. The rotation controls panel displays rotation sliders for all 4D rotation planes: XY, XZ, YZ, XW, YW, ZW
2. Each rotation slider has range 0° to 360° with continuous wrapping
3. Rotating in XW, YW, or ZW planes morphs the 3D shape dramatically (cross-dimensional slicing)
4. Rotation changes update the fractal smoothly in real-time
5. A "Reset Rotations" button returns all rotations to 0°
6. Rotation values persist when switching quality settings
7. The basis vectors (uBasisX, uBasisY, uBasisZ, uOrigin) are computed from rotations and sent to the shader

**Test scenarios**

Scenario 1: Rotate in 4D plane
- Given the user is viewing the Quaternion Julia with all rotations at 0°
- When the user rotates the XW plane by 45°
- Then the fractal shape morphs smoothly, revealing a different 3D cross-section

Scenario 2: Combined 4D rotations
- Given the user has XW rotation at 30°
- When the user also rotates YW by 60°
- Then both rotations combine correctly and the fractal displays the compound slice

Scenario 3: Reset all rotations
- Given the user has various rotations applied (XW=45°, YW=30°, ZW=15°)
- When the user clicks "Reset Rotations"
- Then all rotation values return to 0° and the fractal returns to the default slice orientation

Scenario 4: Rotation animation continuity
- Given autorotation is enabled on the XW plane
- When the rotation passes from 359° to 0°
- Then the fractal morphs continuously without any visual discontinuity

---

## User Story 5: Lighting System Integration

**User story:** As a user, I want to control lighting on the Quaternion Julia fractal so that I can achieve desired visual aesthetics.

**Acceptance criteria**
1. Lighting controls panel displays all standard lighting parameters:
   - Light enabled toggle (default: on)
   - Light color picker (default: #FFFFFF)
   - Light horizontal angle slider (0-360°)
   - Light vertical angle slider (-90° to 90°)
   - Ambient intensity slider (0.0-3.0, default: 0.2)
   - Ambient color picker (default: #FFFFFF)
   - Diffuse intensity slider (0.0-2.0, default: 1.0)
   - Specular intensity slider (0.0-2.0, default: 1.0)
   - Specular color picker (default: #FFFFFF)
   - Shininess slider (1-128, default: 32)
2. Multi-light system supports up to 4 lights with individual controls
3. Each additional light can be: point, directional, or spot type
4. Spot lights include cone angle (0-180°) and penumbra (0.0-1.0) controls
5. Point lights include range (1.0-100.0) and decay (0.0-3.0) controls
6. Tone mapping toggle with algorithm selection (Reinhard, Filmic, ACES, etc.)
7. Exposure control (0.1-3.0, default: 1.0)
8. Fresnel rim lighting toggle with intensity control (0.0-2.0, default: 0.5)

**Test scenarios**

Scenario 1: Adjust primary light direction
- Given the user is viewing a lit Quaternion Julia fractal
- When the user changes light horizontal angle from 0° to 180°
- Then the lighting direction changes and shadows/highlights shift to the opposite side

Scenario 2: Add secondary point light
- Given only the primary directional light is active
- When the user clicks "Add Light" and selects "Point Light"
- Then a new point light appears in the light list with default parameters and illuminates the fractal

Scenario 3: Enable Fresnel rim lighting
- Given Fresnel rim lighting is disabled
- When the user enables Fresnel and sets intensity to 1.5
- Then the fractal edges glow with rim lighting effect

Scenario 4: Change tone mapping algorithm
- Given tone mapping is set to Reinhard
- When the user selects Filmic tone mapping
- Then the overall color response changes to the filmic curve with slightly increased contrast

---

## User Story 6: Shadow System Integration

**User story:** As a user, I want to enable and configure shadows so that the Quaternion Julia fractal has depth and dimensionality.

**Acceptance criteria**
1. Shadow controls panel includes:
   - Shadow enabled toggle (default: off for performance)
   - Shadow quality dropdown: Low, Medium, High, Ultra
   - Shadow softness slider (0.0-2.0, default: 1.0)
   - Shadow animation mode: Pause, Low, Full
2. Shadow quality maps to raymarch steps for shadow rays:
   - Low: 16 steps
   - Medium: 32 steps
   - High: 64 steps
   - Ultra: 128 steps
3. Shadow softness controls penumbra width for soft shadow edges
4. Animation mode "Pause" freezes shadow calculation during rotation for performance
5. Animation mode "Low" uses reduced shadow quality during animation
6. Animation mode "Full" maintains selected quality during animation
7. Shadows cast correctly based on light positions and fractal geometry

**Test scenarios**

Scenario 1: Enable shadows
- Given shadows are disabled
- When the user toggles shadows on with Medium quality
- Then the fractal displays soft shadows that respond to the light direction

Scenario 2: Increase shadow quality
- Given shadows are enabled at Low quality
- When the user changes to Ultra quality
- Then shadows become sharper and more detailed (with potential frame rate decrease)

Scenario 3: Shadow animation mode pause
- Given shadows are enabled with animation mode "Pause"
- When the user rotates the fractal
- Then shadows freeze during rotation and update when rotation stops

Scenario 4: Adjust shadow softness
- Given shadows are enabled with softness 0.5
- When the user increases softness to 2.0
- Then shadow edges become significantly softer and more diffuse

---

## User Story 7: Color Algorithm System

**User story:** As a user, I want to choose and configure coloring algorithms so that I can achieve diverse visual styles for the Quaternion Julia fractal.

**Acceptance criteria**
1. Color algorithm dropdown offers these options:
   - Monochromatic (0): Single hue with varying lightness based on iteration
   - Analogous (1): Hue varies ±30° based on iteration
   - Cosine Gradient (2): Inigo Quilez cosine palette with 4 coefficient vectors
   - Normal-based (3): Color derived from surface normal direction
   - Distance-field (4): Color based on distance estimate value
   - LCH Perceptual (5): Perceptually uniform color space mapping
   - Multi-source (6): Weighted blend of depth, orbit trap, and normal
   - Radial (7): Color based on 3D distance from origin
2. Base face color picker for Monochromatic and Analogous modes
3. Cosine Gradient mode displays 4 coefficient editors (a, b, c, d), each with RGB sliders (0.0-2.0)
4. Distribution controls for all modes:
   - Power (0.25-4.0): Controls color mapping curve
   - Cycles (0.5-5.0): Number of color cycles across iteration range
   - Offset (0.0-1.0): Phase shift in color cycle
5. LCH mode includes:
   - Lightness slider (0.1-1.0, default: 0.7)
   - Chroma slider (0.0-0.4, default: 0.15)
6. Multi-source mode includes weight sliders:
   - Depth weight (0.0-1.0, default: 0.5)
   - Orbit trap weight (0.0-1.0, default: 0.3)
   - Normal weight (0.0-1.0, default: 0.2)
7. Preset palettes for Cosine Gradient mode (Rainbow, Sunset, Ocean, Fire, etc.)

**Test scenarios**

Scenario 1: Switch color algorithm
- Given the fractal is displaying with Monochromatic coloring
- When the user selects "Cosine Gradient" from the dropdown
- Then the fractal updates to show the cosine palette coloring

Scenario 2: Adjust cosine gradient coefficients
- Given Cosine Gradient mode is active with default coefficients
- When the user changes coefficient `d` to [0.0, 0.5, 0.8]
- Then the color palette shifts to emphasize cyan-blue tones

Scenario 3: Load palette preset
- Given Cosine Gradient mode is active
- When the user selects the "Sunset" preset
- Then coefficients update to produce warm orange-red-purple gradient

Scenario 4: Adjust distribution power
- Given any color algorithm is active with power 1.0
- When the user changes power to 2.0
- Then colors concentrate more toward the outer edges of the fractal

---

## User Story 8: Opacity/Transparency Modes

**User story:** As a user, I want to control the opacity and transparency of the Quaternion Julia fractal so that I can see internal structures or achieve ethereal effects.

**Acceptance criteria**
1. Opacity mode dropdown offers:
   - Solid (0): Fully opaque rendering
   - Simple Alpha (1): Uniform transparency across surface
   - Layered Surfaces (2): Multiple transparent nested isosurfaces
   - Volumetric Density (3): Cloud-like volumetric rendering
2. Solid mode has no additional parameters
3. Simple Alpha mode includes opacity slider (0.0-1.0, default: 0.7)
4. Layered Surfaces mode includes:
   - Layer count dropdown: 2, 3, 4 (default: 2)
   - Layer opacity slider (0.1-0.9, default: 0.5)
5. Volumetric Density mode includes:
   - Density slider (0.1-2.0, default: 1.0)
   - Sample quality dropdown: Low, Medium, High (default: Medium)
   - Animation quality: Reduce, Full (default: Reduce)
6. Transparency modes correctly composite with background
7. Internal structures become visible in non-solid modes

**Test scenarios**

Scenario 1: Enable simple alpha transparency
- Given the fractal is rendering in Solid mode
- When the user selects Simple Alpha mode with opacity 0.5
- Then the fractal becomes 50% transparent and background is visible through it

Scenario 2: Configure layered surfaces
- Given the user selects Layered Surfaces mode
- When the user sets layer count to 3 and layer opacity to 0.4
- Then three nested transparent surfaces render, revealing internal structure

Scenario 3: Enable volumetric rendering
- Given the fractal is in Solid mode
- When the user selects Volumetric Density mode with density 1.5
- Then the fractal renders as a semi-transparent volumetric cloud

Scenario 4: Volumetric animation quality
- Given Volumetric mode is active with Animation quality "Full"
- When the user rotates the fractal
- Then volumetric rendering maintains full quality (potential frame rate decrease)

---

## User Story 9: Animation System - Julia Constant Path

**User story:** As a user, I want to animate the Julia constant along a path so that the fractal shape morphs organically over time.

**Acceptance criteria**
1. Julia constant animation toggle in the animation controls (default: off)
2. When enabled, the Julia constant `c` evolves along a 4D path defined by:
   - `c.x = amplitude.x * sin(frequency.x * t + phase.x)`
   - `c.y = amplitude.y * cos(frequency.y * t + phase.y)`
   - `c.z = amplitude.z * sin(frequency.z * t + phase.z)`
   - `c.w = amplitude.w * cos(frequency.w * t + phase.w)`
3. Amplitude controls (0.0-1.0 per axis, default: 0.3)
4. Frequency controls (0.01-0.5 Hz per axis, default: 0.05)
5. Phase offset controls (0.0-2π per axis, default: staggered)
6. Path preset dropdown:
   - "Gentle Drift": Low amplitude, slow frequency
   - "Active Morph": Medium amplitude, varied frequencies
   - "Chaotic Dance": High amplitude, fast frequencies
7. Animation respects global playback state (play/pause)
8. Animation speed multiplied by global animation speed control

**Test scenarios**

Scenario 1: Enable Julia constant animation
- Given Julia constant animation is disabled
- When the user toggles animation on and presses play
- Then the Julia constant values change over time and the fractal morphs continuously

Scenario 2: Load animation preset
- Given Julia constant animation is enabled
- When the user selects "Chaotic Dance" preset
- Then amplitude and frequency values update and the fractal morphs more dramatically

Scenario 3: Pause animation
- Given Julia constant animation is playing
- When the user clicks the global pause button
- Then the Julia constant stops changing and the fractal freezes in current state

Scenario 4: Adjust animation speed
- Given Julia constant animation is enabled at default speed
- When the user increases global animation speed to 2.0x
- Then the Julia constant evolves twice as fast

---

## User Story 10: Animation System - Slice Origin Drift

**User story:** As a user, I want to animate the 4D slice origin position so that the fractal reveals different cross-sections over time.

**Acceptance criteria**
1. Origin drift animation toggle (default: off)
2. Drift amplitude control (0.01-0.5, default: 0.03)
3. Base frequency control (0.01-0.5 Hz, default: 0.04)
4. Frequency spread control (0.0-1.0, default: 0.2) - adds per-dimension frequency variation
5. Drift affects the W component of slice origin primarily
6. Multi-frequency Perlin-like motion for organic feel
7. Drift combines with manual rotation (additive)
8. Animation respects global playback state

**Test scenarios**

Scenario 1: Enable origin drift
- Given origin drift is disabled
- When the user enables drift with amplitude 0.1
- Then the fractal slowly shifts through different 4D cross-sections

Scenario 2: Increase drift amplitude
- Given origin drift is enabled with amplitude 0.03
- When the user increases amplitude to 0.3
- Then the cross-section changes more dramatically over time

Scenario 3: Adjust frequency spread
- Given origin drift is enabled with frequency spread 0.0
- When the user increases spread to 0.5
- Then the drift motion becomes more varied and less periodic

---

## User Story 11: Animation System - Power Morphing

**User story:** As a user, I want to animate the iteration power so that the fractal smoothly transitions between power variants.

**Acceptance criteria**
1. Power animation toggle (default: off)
2. Power minimum slider (2.0-10.0, default: 2.0)
3. Power maximum slider (2.0-16.0, default: 8.0)
4. Power oscillation speed (0.01-0.2 Hz, default: 0.03)
5. Power interpolates smoothly using sine wave between min and max
6. Fractional powers are supported for smooth transitions
7. Animation respects global playback state

**Test scenarios**

Scenario 1: Enable power animation
- Given power is fixed at 2
- When the user enables power animation with range 2-8
- Then the power oscillates smoothly and the fractal structure evolves

Scenario 2: Narrow power range
- Given power animation is enabled with range 2-8
- When the user changes range to 3-4
- Then the fractal morphs within a narrower, more subtle range

---

## User Story 12: Performance & Quality Controls

**User story:** As a user, I want to adjust quality settings so that I can balance visual fidelity with frame rate.

**Acceptance criteria**
1. Quality preset dropdown: Draft, Standard, High, Ultra
2. Quality settings map to:
   - Max iterations: 32/64/128/256
   - Surface distance threshold: 0.004/0.002/0.001/0.0005
   - Max raymarch steps: 64/128/256/512
3. Quality multiplier slider (0.25-1.0) for fine-tuning
4. Adaptive quality toggle: automatically reduces quality during camera movement
5. Frame rate display in performance panel
6. Memory usage estimate display
7. Settings persist across sessions
8. Bailout radius slider (2.0-16.0, default: 4.0) for controlling iteration escape

**Test scenarios**

Scenario 1: Change quality preset
- Given quality is set to Standard
- When the user selects Ultra quality
- Then the fractal renders with more detail (higher iterations, finer surface) at lower frame rate

Scenario 2: Enable adaptive quality
- Given adaptive quality is disabled and frame rate is low
- When the user enables adaptive quality and rotates the camera
- Then quality automatically reduces during rotation and restores when camera stops

Scenario 3: Adjust bailout radius
- Given bailout radius is 4.0
- When the user increases bailout to 16.0
- Then more of the fractal structure is captured but iterations may increase

---

## Placeholders Requiring Confirmation
- Exact Julia constant preset values need visual testing
- Optimal default frequency values for animations
- Performance thresholds for adaptive quality triggers
- Memory budget limits

## Open Questions
- Should Julia constant animation support custom Bezier paths in addition to sinusoidal?
- Should orbit trap coloring data be captured for Quaternion Julia specifically?
- Should there be a "locked ratio" mode for Julia constant components?

## Dependencies Between Stories
- Stories 2, 3, 4, 5, 7, 8 can be developed in parallel after Story 1
- Story 6 depends on Story 5 (lighting must exist for shadows)
- Stories 9, 10, 11 can be developed in parallel after their respective parameter stories

## Ready for Development: YES
