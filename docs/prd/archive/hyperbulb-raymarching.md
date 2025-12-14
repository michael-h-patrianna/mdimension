# Hyperbulb Raymarching for 4D-11D Dimensions

## Specification Summary

**Feature**: GPU-accelerated raymarching surface rendering for 4D-11D Hyperbulb fractals
**User Stories (Jira Tickets)**: 4
**Acceptance Criteria**: 32
**Test Scenarios**: 24

### Stories Overview

| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Hyperbulb Surface Rendering (4D-11D) | User | ~2 days | None |
| 2 | Slice Parameter Visualization | User | ~1.5 days | Story 1 |
| 3 | Performance-Aware Quality Settings | User | ~1 day | Story 1 |
| 4 | Visual Settings Integration | User | ~1 day | Story 1 |

### Coverage
- Happy paths: 8
- Error handling: 4
- Edge cases: 6
- Performance: 4
- Visual settings: 2

### Placeholders Requiring Confirmation
- None - all behaviors derived from existing 3D implementation patterns

### Open Questions
- None - behavior mirrors existing 3D Mandelbulb raymarching

### Dependencies Between Stories
- Stories 2, 3, and 4 depend on Story 1 (core rendering)
- Stories 2, 3, and 4 are independent of each other

### Ready for Development: YES

---

## Background

The application currently supports two rendering modes for Mandelbrot-like fractals:

1. **Vertices Mode (Point Cloud)**: Works for all dimensions 2D-11D. Samples a grid of points, computes escape time for each, renders colored points.

2. **Faces Mode (Raymarching)**: Currently only works for 3D Mandelbulb. Uses GPU raymarching through a signed distance function (SDF) to render a solid surface with lighting, shading, and color palettes.

This PRD extends the raymarching capability to dimensions 4D through 11D, rendering "Hyperbulb" fractals - the higher-dimensional generalization of the Mandelbulb using hyperspherical coordinates.

### Key Constraint

The existing 3D Mandelbulb raymarching shader is preserved unchanged. A new shader handles dimensions 4D-11D exclusively.

---

## User Story 1: Hyperbulb Surface Rendering (4D-11D)

**User story:** As a user exploring higher-dimensional fractals, I want to view 4D-11D Hyperbulb fractals as solid raymarched surfaces so that I can see smooth, lit geometry instead of point clouds.

**Acceptance criteria**

1. When dimension is 4-11 and "Surface" toggle is ON, the system displays a raymarched Hyperbulb surface
2. When dimension is 4-11 and "Surface" toggle is OFF, the system displays a point cloud (existing behavior)
3. The raymarched surface and point cloud are never displayed simultaneously for the same fractal
4. The raymarched surface shows a 3D slice of the D-dimensional Hyperbulb, where D is the current dimension
5. The 3D slice uses the first three coordinates (dimensions 0, 1, 2) as the visible X, Y, Z axes
6. Dimensions beyond the first three use fixed "slice values" (default: 0.0 for each)
7. The surface renders using the same mathematical formula as the point cloud: `z_{n+1} = powMap(z_n, power) + c` using hyperspherical coordinates
8. The "Power" setting (2-16) controls the Hyperbulb shape, matching point cloud behavior
9. The "Max Iterations" setting (10-500) controls fractal detail level
10. The "Escape Radius" setting (2-16) controls the bailout threshold, with 8.0 recommended for 4D+
11. The surface displays within the same bounding region as the point cloud (approximately [-1.5, 1.5] per visible axis)
12. The ground plane (when enabled) positions correctly beneath the raymarched Hyperbulb surface

**Test scenarios**

Scenario 1: Enable surface rendering for 4D Hyperbulb
- Given the user has selected Mandelbrot object type and dimension is set to 4
- When the user turns ON the "Surface" toggle
- Then the system displays a raymarched 4D Hyperbulb surface with smooth shading and the point cloud disappears

Scenario 2: Disable surface rendering returns to point cloud
- Given the user is viewing a raymarched 5D Hyperbulb surface
- When the user turns OFF the "Surface" toggle
- Then the system displays the point cloud and the raymarched surface disappears

Scenario 3: Change dimension while surface is enabled
- Given the user is viewing a raymarched 4D Hyperbulb with "Surface" toggle ON
- When the user changes dimension to 7D
- Then the system displays a raymarched 7D Hyperbulb surface (not point cloud)

Scenario 4: Power setting affects surface shape
- Given the user is viewing a raymarched 6D Hyperbulb with power=8
- When the user changes power to 3
- Then the surface shape visibly changes to a more "flower-like" form

Scenario 5: Transition from 3D to 4D preserves surface mode
- Given the user is viewing the 3D Mandelbulb raymarched surface with "Surface" toggle ON
- When the user changes dimension from 3 to 4
- Then the system displays a raymarched 4D Hyperbulb surface (surface mode remains active)

Scenario 6: High escape radius for stability
- Given the user is viewing an 8D Hyperbulb with escape radius set to 4.0
- When the fractal appears fragmented or unstable
- Then increasing escape radius to 8.0 or higher produces a more stable, complete surface

---

## User Story 2: Slice Parameter Visualization

**User story:** As a user exploring higher-dimensional Hyperbulbs, I want to adjust slice parameters for dimensions beyond X/Y/Z so that I can explore different cross-sections of the D-dimensional fractal.

**Acceptance criteria**

1. For dimension D, the system provides D-3 slice parameter controls (e.g., 4D has 1 slice param, 11D has 8 slice params)
2. Each slice parameter has range [-2.0, 2.0] with default value 0.0
3. Slice parameters are labeled by their dimension index (e.g., "Dim 3", "Dim 4", ... "Dim 10")
4. Changing a slice parameter value immediately updates the raymarched surface
5. A "Reset Slices" action sets all slice parameters back to 0.0
6. Slice parameters are preserved when switching between dimensions (values outside the valid range for lower dimensions are ignored)
7. Slice parameter controls appear in the Mandelbrot Controls panel when dimension >= 4 and "Surface" toggle is ON
8. Slice parameter controls are hidden when "Surface" toggle is OFF (point cloud mode uses the same slice values but doesn't need prominent UI)

**Test scenarios**

Scenario 1: Adjust slice parameter changes surface
- Given the user is viewing a raymarched 5D Hyperbulb with Dim 3 slice = 0.0
- When the user changes Dim 3 slice to 0.5
- Then the raymarched surface visibly changes shape as a different cross-section is displayed

Scenario 2: Reset slices returns to origin
- Given the user has modified Dim 3 = 0.8 and Dim 4 = -0.3 for a 6D Hyperbulb
- When the user clicks "Reset Slices"
- Then all slice parameters return to 0.0 and the surface updates accordingly

Scenario 3: Correct number of slice controls per dimension
- Given the user selects dimension 7 with "Surface" toggle ON
- When the Mandelbrot Controls panel is visible
- Then the panel shows 4 slice parameter sliders (Dim 3, Dim 4, Dim 5, Dim 6)

Scenario 4: Slice controls hidden in point cloud mode
- Given the user is viewing a 6D Hyperbulb point cloud with "Surface" toggle OFF
- When the user views the Mandelbrot Controls panel
- Then slice parameter sliders are not prominently displayed (point cloud uses same values internally)

Scenario 5: Dimension change preserves applicable slice values
- Given the user has set Dim 3 = 0.5 for a 5D Hyperbulb
- When the user changes dimension to 4D
- Then Dim 3 slice value remains 0.5

Scenario 6: Higher dimension adds new slice controls at default
- Given the user has set Dim 3 = 0.5 for a 4D Hyperbulb
- When the user changes dimension to 6D
- Then Dim 3 remains 0.5, and new Dim 4, Dim 5 sliders appear with default value 0.0

---

## User Story 3: Performance-Aware Quality Settings

**User story:** As a user, I want the raymarching quality to adapt based on dimension so that I maintain acceptable frame rates when viewing higher-dimensional Hyperbulbs.

**Acceptance criteria**

1. The system maintains interactive frame rates (target: 30+ FPS) for raymarched Hyperbulbs across all supported dimensions
2. Higher dimensions (8D-11D) use reduced raymarching quality settings compared to lower dimensions (4D-7D)
3. The info panel displays "Rendering: GPU Ray Marching" when surface mode is active (existing behavior)
4. When raymarching performance is degraded (below 20 FPS for more than 2 seconds), the system displays a warning message
5. The warning suggests reducing "Max Iterations" or switching to point cloud mode
6. The "Max Iterations" slider affects raymarching performance: lower values = faster rendering, less detail
7. For dimensions 8D-11D, the default "Max Iterations" is capped at a lower value than 4D-7D to maintain performance
8. Reducing browser window size improves raymarching performance (fewer pixels to compute)

**Test scenarios**

Scenario 1: 4D renders at interactive frame rate
- Given the user enables surface rendering for a 4D Hyperbulb with default settings
- When the surface is displayed
- Then the frame rate remains above 30 FPS during camera rotation

Scenario 2: 11D displays performance warning when needed
- Given the user enables surface rendering for an 11D Hyperbulb with max iterations = 200
- When the frame rate drops below 20 FPS for 2+ seconds
- Then a warning message appears suggesting to reduce iterations or use point cloud mode

Scenario 3: Reducing iterations improves performance
- Given the user is experiencing slow frame rates with a 9D Hyperbulb at 100 iterations
- When the user reduces max iterations to 30
- Then frame rate visibly improves

Scenario 4: Higher dimensions use conservative defaults
- Given the user switches to dimension 10D with Mandelbrot object type
- When the system initializes the Hyperbulb configuration
- Then max iterations is set to a conservative default (lower than 4D default)

Scenario 5: Window resize affects performance
- Given the user is viewing an 8D Hyperbulb with moderate frame rate
- When the user reduces the browser window size by 50%
- Then the frame rate improves noticeably

---

## User Story 4: Visual Settings Integration

**User story:** As a user, I want the raymarched Hyperbulb surface to respect all visual settings (lighting, colors, palettes) so that it matches the appearance of the 3D Mandelbulb and other objects.

**Acceptance criteria**

1. The "Surface Color" setting controls the base color of the raymarched Hyperbulb surface
2. The "Color Palette" setting (Monochromatic, Analogous, Complementary, Triadic, Split-Complementary) affects surface coloring based on orbit trap values
3. The raymarched surface uses orbit trap coloring: surface features (valleys, ridges) have varying colors based on the palette
4. The "Light" toggle enables/disables directional lighting on the Hyperbulb surface
5. When light is enabled, "Light Direction" (horizontal/vertical angles) controls the light source position
6. When light is enabled, "Light Color" tints the illuminated portions of the surface
7. "Ambient Intensity" controls the base illumination level (visible even in shadow areas)
8. "Specular Intensity" controls the brightness of shiny highlights on the surface
9. "Specular Power" controls the sharpness/focus of specular highlights
10. All lighting settings produce the same visual effect as the 3D Mandelbulb raymarching
11. The raymarched Hyperbulb casts/receives shadows on the ground plane (when ground plane is enabled)
12. Surface color changes take effect immediately without re-rendering the entire scene

**Test scenarios**

Scenario 1: Surface color affects Hyperbulb appearance
- Given the user is viewing a raymarched 5D Hyperbulb with surface color set to blue
- When the user changes surface color to red
- Then the Hyperbulb surface immediately displays with red-based coloring

Scenario 2: Palette mode changes color variation
- Given the user is viewing a raymarched 6D Hyperbulb with Monochromatic palette
- When the user changes to Triadic palette
- Then the surface displays three distinct color hues (120 degrees apart) based on surface features

Scenario 3: Directional light affects shading
- Given the user is viewing a raymarched 4D Hyperbulb with light enabled
- When the user changes light horizontal angle from 0 to 180 degrees
- Then the lit and shadowed areas of the surface visibly swap sides

Scenario 4: Specular highlights visible on surface
- Given the user is viewing a raymarched 7D Hyperbulb with specular intensity = 1.0
- When viewing the surface from an angle where light reflects toward the camera
- Then bright specular highlights are visible on curved surface areas

Scenario 5: Ambient intensity prevents pure black shadows
- Given the user is viewing a raymarched 5D Hyperbulb with light enabled and ambient = 0.3
- When viewing shadow areas of the surface
- Then shadowed areas are dimmed but not pure black (30% base illumination)

Scenario 6: Disabling light shows flat ambient lighting
- Given the user is viewing a raymarched 8D Hyperbulb with light enabled
- When the user turns OFF the "Light" toggle
- Then the surface displays with uniform ambient lighting only (no directional shading or specular)

---

## Technical Notes (For Implementation Reference Only)

These notes are provided for developer context but are not part of the testable requirements.

### Mathematical Foundation

The Hyperbulb uses the same iteration formula as the point cloud:
- `z_{n+1} = powMap(z_n, power) + c`
- `powMap` converts to hyperspherical coordinates, applies `r^power` and `theta[i] * power`, converts back
- For dimension D, there are D-1 angular coordinates

### Rendering Approach

The raymarched surface is a 3D slice through D-dimensional parameter space:
- Visible axes (X, Y, Z) map to dimensions 0, 1, 2
- Slice parameters fix the values for dimensions 3 through D-1
- The signed distance function (SDF) is evaluated for each ray sample

### Existing Shader Preservation

The 3D Mandelbulb shader (`mandelbulb.frag`) remains unchanged. A new shader handles 4D-11D with the same visual output quality and settings support.

### Performance Characteristics

Raymarching cost scales with:
- Number of angles in hyperspherical conversion (D-1 angles)
- Max iterations per SDF evaluation
- Screen resolution (pixels to compute)
- Raymarch step count

Higher dimensions require more trigonometric operations per iteration, hence the need for conservative defaults.
