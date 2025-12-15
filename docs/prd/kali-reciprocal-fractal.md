# Kali / Reciprocal-Abs Fractals

## Overview

**Feature**: Kali/Reciprocal-Abs Fractals - An N-dimensional fractal family using componentwise absolute value and reciprocal feedback. The reciprocal step creates intense nonlinear folding that produces fluid, cellular, and "alive" structures.

**Core formula**: `z = abs(z) / dot(z,z) + c` (with variants)

**Why it morphs well**: The reciprocal inversion creates extreme nonlinearity where small changes in slice orientation produce dramatically different cellular/organic patterns.

**Reference**: See `docs/prd/extended-fractal-types.md` Section 2 for mathematical foundation.

---

## Specification Summary

**Feature**: Kali Fractal Renderer
**User Stories (Jira Tickets)**: 14
**Estimated Total Effort**: ~22 man-days

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Core Kali Fractal Renderer | Developer | ~2 days | None |
| 2 | Kali Constant (c) Parameter Controls | User | ~1.5 days | Story 1 |
| 3 | Reciprocal Gain Control | User | ~1 day | Story 1 |
| 4 | Axis Weights Configuration | User | ~1.5 days | Story 1 |
| 5 | Symmetry Breaking Matrix | User | ~2 days | Story 1 |
| 6 | D-Dimensional Rotation System | User | ~2 days | Story 1 |
| 7 | Lighting System Integration | User | ~2 days | Story 1 |
| 8 | Shadow System Integration | User | ~1.5 days | Story 7 |
| 9 | Color Algorithm System | User | ~2 days | Story 1 |
| 10 | Opacity/Transparency Modes | User | ~2 days | Story 1 |
| 11 | Animation System - Constant Path | User | ~1.5 days | Story 2 |
| 12 | Animation System - Reciprocal Gain | User | ~1 day | Story 3 |
| 13 | Animation System - Axis Weights | User | ~1.5 days | Story 4 |
| 14 | Performance & Quality Controls | User | ~1.5 days | Story 1 |

---

## User Story 1: Core Kali Fractal Renderer

**User story:** As a user, I want to view a Kali fractal so that I can explore organic cellular structures created by reciprocal folding.

**Acceptance criteria**
1. User can select "Kali" from the fractal type selector in the geometry panel
2. When selected, the viewport displays a 3D slice through the N-dimensional Kali fractal
3. The fractal is rendered using raymarching with a scalar potential field (accumulated min distance to traps or smooth escape)
4. Default Kali constant `c` is set to produce an interesting initial shape (e.g., `c = (0.5, 0.5, 0.5, ...0.5)` for current dimension)
5. Dimension selector allows choosing 3D through 11D (default: 4D)
6. Iteration count defaults to 20 with a low bailout (e.g., 4.0) due to fast divergence
7. Epsilon value (0.001) prevents singularity at origin in `dot(z,z) + eps`
8. The fractal responds to standard camera controls (orbit, pan, zoom)
9. Frame rate remains above 30fps on mid-range hardware at default quality settings

**Test scenarios**

Scenario 1: Select Kali fractal type
- Given the user is viewing any fractal in the viewport
- When the user selects "Kali" from the fractal type dropdown
- Then the viewport displays the Kali fractal with cellular/organic structures

Scenario 2: Change dimension
- Given the user is viewing a 4D Kali fractal
- When the user changes dimension to 6D
- Then the fractal updates to show 6D Kali structure (more complex folding patterns)

Scenario 3: Singularity protection
- Given the raymarcher samples a point very close to the origin
- When the Kali formula evaluates `dot(z,z)`
- Then epsilon prevents division by zero and rendering remains stable

Scenario 4: Default rendering quality
- Given the user has just selected Kali fractal
- When the fractal renders at default settings
- Then cellular structures display clearly without excessive noise

---

## User Story 2: Kali Constant (c) Parameter Controls

**User story:** As a user, I want to adjust the Kali constant `c` so that I can explore different cellular structures.

**Acceptance criteria**
1. The Kali controls panel displays sliders for each component of `c` (number matches current dimension)
2. Each slider has range from -1.0 to 1.0 with step size 0.01
3. Changes to any slider update the fractal in real-time
4. A "Lock Components" toggle synchronizes all c components to the same value
5. A "Randomize" button generates a random constant within stable ranges (-0.5 to 0.5)
6. Preset dropdown offers curated constants:
   - "Coral Cells" (0.5, 0.5, 0.5, 0.5)
   - "Sponge" (0.3, 0.3, 0.3, 0.3)
   - "Tubes" (0.7, 0.2, 0.7, 0.2)
   - "Membrane" (0.1, 0.1, 0.1, 0.1)
   - "Chaos" (0.8, -0.3, 0.5, -0.7)
7. Tooltip: "The constant c biases the reciprocal fold, controlling cell size and structure"

**Test scenarios**

Scenario 1: Adjust single constant component
- Given the user is viewing the Kali controls panel
- When the user moves the `c[0]` slider from 0.5 to 0.8
- Then the fractal structure updates in real-time

Scenario 2: Lock components mode
- Given "Lock Components" is enabled
- When the user moves any c slider to 0.3
- Then all c components update to 0.3 simultaneously

Scenario 3: Load preset
- Given the user is on the Kali controls panel
- When the user selects "Tubes" from the preset dropdown
- Then sliders update to (0.7, 0.2, 0.7, 0.2) and the fractal displays tube-like structures

Scenario 4: Dimension change updates slider count
- Given dimension is 4D with 4 c sliders visible
- When the user changes dimension to 6D
- Then 6 c sliders become visible with default values for new dimensions

---

## User Story 3: Reciprocal Gain Control

**User story:** As a user, I want to adjust the reciprocal gain so that I can control the intensity of the folding effect.

**Acceptance criteria**
1. Reciprocal gain slider available in Kali controls (range: 0.5-2.0, default: 1.0)
2. Formula becomes: `z = abs(z) / (dot(z,z) * gain) + c`
3. Lower gain (0.5) produces softer, more rounded structures
4. Higher gain (2.0) produces sharper, more crystalline structures
5. Changes update fractal in real-time
6. Tooltip: "Controls folding intensity. Higher values create sharper structures."

**Test scenarios**

Scenario 1: Decrease reciprocal gain
- Given reciprocal gain is at 1.0
- When the user decreases gain to 0.5
- Then fractal structures become softer and more rounded

Scenario 2: Increase reciprocal gain
- Given reciprocal gain is at 1.0
- When the user increases gain to 2.0
- Then fractal structures become sharper and more angular

Scenario 3: Extreme gain stability
- Given the user sets gain to maximum (2.0)
- When the fractal renders
- Then no NaN artifacts or visual corruption occurs

---

## User Story 4: Axis Weights Configuration

**User story:** As a user, I want to weight axes differently so that I can break symmetry and create elongated or compressed structures.

**Acceptance criteria**
1. Axis weights section displays one slider per dimension (W[0], W[1], ..., W[n])
2. Each weight slider range: 0.5-2.0, default: 1.0
3. Formula incorporates weights: `abs(z * w)` where w is the weight vector
4. Unequal weights break the default crystalline symmetry
5. A "Reset Weights" button returns all weights to 1.0
6. A "Randomize Weights" button generates random weights between 0.7 and 1.3
7. Tooltip: "Axis weights stretch/compress the fractal along each dimension"

**Test scenarios**

Scenario 1: Apply unequal weights
- Given all axis weights are 1.0 (symmetric)
- When the user sets W[0] to 1.5 and W[1] to 0.5
- Then the fractal becomes elongated along axis 0 and compressed along axis 1

Scenario 2: Reset weights
- Given weights are (1.5, 0.7, 1.2, 0.9)
- When the user clicks "Reset Weights"
- Then all weights return to 1.0 and fractal becomes symmetric again

Scenario 3: Randomize weights
- Given all weights are at default 1.0
- When the user clicks "Randomize Weights"
- Then weights vary randomly between 0.7-1.3 and fractal symmetry is broken

---

## User Story 5: Symmetry Breaking Matrix

**User story:** As a user, I want to apply a symmetry-breaking transformation matrix so that I can create more organic, less crystalline structures.

**Acceptance criteria**
1. Symmetry matrix toggle (default: off)
2. When enabled, a small rotation/shear matrix `M` is applied each iteration: `z = M * z`
3. Matrix controls include:
   - Shear strength slider (0.0-0.3, default: 0.05)
   - Rotation amount slider (0.0-15°, default: 2°)
4. Preset matrices:
   - "Subtle Twist" (slight rotation)
   - "Organic Shear" (asymmetric shear)
   - "Spiral" (combined rotation + shear)
5. Changes update fractal in real-time
6. Tooltip: "Breaks crystalline symmetry with per-iteration transform"

**Test scenarios**

Scenario 1: Enable symmetry breaking
- Given symmetry matrix is disabled (pure abs produces crystalline symmetry)
- When the user enables symmetry matrix with "Subtle Twist" preset
- Then the fractal becomes less regular with organic asymmetry

Scenario 2: Adjust shear strength
- Given symmetry matrix is enabled with shear 0.05
- When the user increases shear to 0.2
- Then structures become more twisted and distorted

Scenario 3: Disable symmetry matrix
- Given symmetry matrix is enabled producing organic shapes
- When the user disables the matrix
- Then fractal returns to crystalline symmetric appearance

---

## User Story 6: D-Dimensional Rotation System

**User story:** As a user, I want to rotate the N-dimensional slice orientation so that I can explore different cross-sections of the Kali fractal.

**Acceptance criteria**
1. Rotation controls display sliders for all rotation planes based on current dimension:
   - 3D: XY, XZ, YZ (3 planes)
   - 4D: XY, XZ, YZ, XW, YW, ZW (6 planes)
   - 5D: 10 planes
   - Higher: n(n-1)/2 planes
2. Each rotation slider has range 0° to 360° with continuous wrapping
3. Rotating in higher-dimensional planes (XW, YW, etc.) morphs cellular structure dramatically
4. A "Reset Rotations" button returns all rotations to 0°
5. Rotation values persist across quality setting changes
6. Basis vectors computed from rotations and sent to shader

**Test scenarios**

Scenario 1: Rotate in 4D plane
- Given 4D Kali fractal with all rotations at 0°
- When the user rotates XW plane by 45°
- Then the cellular structure morphs to reveal a different 3D cross-section

Scenario 2: High-dimensional rotation
- Given 6D Kali fractal
- When the user rotates multiple higher-dimensional planes
- Then the fractal shows significantly different structural patterns

Scenario 3: Reset all rotations
- Given various rotations are applied
- When the user clicks "Reset Rotations"
- Then all rotation values return to 0° and fractal returns to default slice

---

## User Story 7: Lighting System Integration

**User story:** As a user, I want to control lighting on the Kali fractal so that cellular structures are well-defined and aesthetically pleasing.

**Acceptance criteria**
1. All standard lighting parameters available (same as Hyperbulb):
   - Light enabled toggle, color picker, direction angles
   - Ambient intensity/color (0.0-3.0, default: 0.3)
   - Diffuse intensity (0.0-2.0, default: 1.0)
   - Specular intensity/color/shininess
2. Multi-light system supports up to 4 lights
3. Light types: point, directional, spot (with cone angle, penumbra)
4. Tone mapping with algorithm selection
5. Exposure control (0.1-3.0)
6. Fresnel rim lighting toggle with intensity control
7. Normals computed via gradient of scalar potential field

**Test scenarios**

Scenario 1: Adjust ambient for cellular visibility
- Given default ambient intensity 0.3
- When the user increases ambient to 0.8
- Then interior cellular structures become more visible in shadows

Scenario 2: Add rim lighting
- Given Fresnel rim lighting is disabled
- When the user enables Fresnel with intensity 1.0
- Then cell boundaries glow with edge highlighting

Scenario 3: Multiple lights for complex shading
- Given single directional light
- When the user adds a second point light with different color
- Then cellular structures show multi-colored shading

---

## User Story 8: Shadow System Integration

**User story:** As a user, I want shadows on the Kali fractal so that cellular depth is enhanced.

**Acceptance criteria**
1. Shadow controls (same as Hyperbulb):
   - Shadow enabled toggle (default: off)
   - Quality: Low, Medium, High, Ultra
   - Softness slider (0.0-2.0)
   - Animation mode: Pause, Low, Full
2. Shadows cast correctly through cellular openings
3. Soft shadows emphasize the organic nature of Kali structures

**Test scenarios**

Scenario 1: Enable shadows for depth
- Given shadows are disabled
- When the user enables Medium quality shadows
- Then cellular structures cast shadows showing depth relationships

Scenario 2: Soft shadows for organic look
- Given shadows are enabled with softness 0.5
- When the user increases softness to 1.5
- Then shadows become diffuse, enhancing the organic appearance

---

## User Story 9: Color Algorithm System

**User story:** As a user, I want color controls for the Kali fractal so that I can visualize cellular structures with different color mappings.

**Acceptance criteria**
1. All 8 color algorithms available (same as Hyperbulb):
   - Monochromatic (0), Analogous (1), Cosine Gradient (2)
   - Normal-based (3), Distance-field (4), LCH Perceptual (5)
   - Multi-source (6), Radial (7)
2. Orbit trap coloring option (distance to traps during iteration)
3. Cosine gradient coefficients with presets
4. Distribution controls: power, cycles, offset
5. Kali-specific preset: "Cellular Glow" optimized for cell visualization

**Test scenarios**

Scenario 1: Apply orbit trap coloring
- Given distance-field coloring is active
- When the user enables orbit trap coloring
- Then colors reflect how close iteration orbits came to trap surfaces

Scenario 2: Cellular Glow preset
- Given any coloring is active
- When the user selects "Cellular Glow" preset
- Then colors optimize for cell boundary visibility

---

## User Story 10: Opacity/Transparency Modes

**User story:** As a user, I want transparency controls so that I can see through cellular structures to internal layers.

**Acceptance criteria**
1. All 4 opacity modes available (same as Hyperbulb):
   - Solid, Simple Alpha, Layered Surfaces, Volumetric Density
2. Layered surfaces particularly effective for revealing nested cells
3. Volumetric density creates fog-like cellular appearance

**Test scenarios**

Scenario 1: Layered surfaces for nested cells
- Given Solid mode is active
- When the user selects Layered Surfaces with 3 layers
- Then nested cellular structures become visible through transparent outer layers

Scenario 2: Volumetric cellular fog
- Given any mode is active
- When the user selects Volumetric Density with density 0.8
- Then the fractal appears as translucent cellular foam

---

## User Story 11: Animation System - Constant Path

**User story:** As a user, I want to animate the Kali constant so that cellular structures morph organically.

**Acceptance criteria**
1. Constant animation toggle (default: off)
2. Small amplitude recommended (0.0-0.3) as Kali is sensitive
3. Frequency controls per dimension (0.01-0.2 Hz, default: 0.02)
4. Phase offsets for multi-frequency organic motion
5. Animation presets:
   - "Breathing Cells" (synchronized slow pulse)
   - "Flowing Membrane" (wave-like motion)
   - "Chaos Drift" (multi-frequency independent motion)

**Test scenarios**

Scenario 1: Enable constant animation
- Given constant animation is disabled
- When the user enables "Breathing Cells" preset
- Then cellular structures pulsate rhythmically as constant oscillates

Scenario 2: Multi-frequency animation
- Given constant animation is enabled with uniform frequency
- When the user applies varied frequencies per dimension
- Then motion becomes more complex and organic

---

## User Story 12: Animation System - Reciprocal Gain

**User story:** As a user, I want to animate the reciprocal gain so that structure sharpness varies over time.

**Acceptance criteria**
1. Gain animation toggle (default: off)
2. Gain minimum slider (0.5-1.5, default: 0.7)
3. Gain maximum slider (0.8-2.0, default: 1.3)
4. Oscillation speed (0.01-0.1 Hz, default: 0.02)
5. Smooth sine interpolation between min and max

**Test scenarios**

Scenario 1: Enable gain animation
- Given gain animation is disabled
- When the user enables with range 0.7-1.3
- Then structures oscillate between soft and sharp appearances

---

## User Story 13: Animation System - Axis Weights

**User story:** As a user, I want to animate axis weights so that the fractal breathes and stretches organically.

**Acceptance criteria**
1. Axis weight animation toggle (default: off)
2. Weight variation amplitude (0.0-0.5, default: 0.2)
3. Per-axis frequency controls (0.01-0.1 Hz)
4. Phase offsets create traveling wave effect
5. Preset: "Breathing" (synchronized), "Wave" (phased), "Random" (independent)

**Test scenarios**

Scenario 1: Breathing animation
- Given weight animation is disabled
- When the user enables "Breathing" preset
- Then all dimensions expand/contract together rhythmically

Scenario 2: Wave animation
- Given weight animation is enabled
- When the user selects "Wave" preset
- Then expansion travels through dimensions creating wave-like distortion

---

## User Story 14: Performance & Quality Controls

**User story:** As a user, I want quality controls so that I can balance detail with performance.

**Acceptance criteria**
1. Quality presets: Draft, Standard, High, Ultra
2. Settings map to iterations, surface distance, raymarch steps
3. Kali-specific: lower default iterations (20) due to fast divergence
4. Quality multiplier slider (0.25-1.0)
5. Adaptive quality toggle
6. Frame rate and memory display

**Test scenarios**

Scenario 1: Adjust quality preset
- Given Standard quality is selected
- When the user selects High quality
- Then cellular detail increases with potential frame rate decrease

Scenario 2: Adaptive quality during rotation
- Given adaptive quality is enabled
- When the user rotates the camera
- Then quality reduces during movement and restores when stopped

---

## Placeholders Requiring Confirmation
- Optimal default constant values for each preset
- Recommended iteration counts for different dimensions
- Epsilon value for singularity protection

## Open Questions
- Should orbit trap distances be visualized as a separate debug mode?
- Should there be a "cell size" abstraction that controls multiple parameters together?

## Dependencies Between Stories
- Stories 2-6, 7, 9, 10 can be developed in parallel after Story 1
- Story 8 depends on Story 7
- Stories 11-13 can be developed after their respective parameter stories

## Ready for Development: YES
