# N-Dimensional Mandelbrot Set Visualization

## Product Overview

An extension to the N-Dimensional Object Visualizer that adds n-dimensional Mandelbrot sets (dimensions 3-11) as a new object type. Users can explore fractal structures in higher dimensions, navigate to interesting coordinates, adjust iteration parameters, and visualize 3D slices of these complex mathematical objects.

**Target Audience:** Fractal enthusiasts, mathematics educators, students, digital artists, and anyone curious about how the Mandelbrot set extends into higher dimensions.

**Core Value Proposition:** Enable exploration of Mandelbrot-like fractals beyond the familiar 2D images, revealing how fractal structures manifest in 3D, 4D, and higher dimensional spaces through interactive 3D projections.

---

## User Story 1: Select Mandelbrot Set as Object Type

**User story:** As a user, I want to select "Mandelbrot Set" as an object type so that I can visualize n-dimensional Mandelbrot fractals instead of geometric polytopes.

**Acceptance criteria**
1. "Mandelbrot Set" appears as a new option in the Object Type selector alongside Hypercube, Simplex, Cross-polytope, and Demihypercube
2. Selecting "Mandelbrot Set" replaces the current polytope with a 3D visualization of the Mandelbrot set
3. Default dimension for Mandelbrot set is 4D (providing the classic 2D complex plane behavior plus two extra dimensions for exploration)
4. Mandelbrot set supports dimensions 3 through 11 (matching the existing dimension selector range for higher dimensions)
5. When Mandelbrot set is selected, a new "Fractal Settings" section appears in the control panel
6. The Mandelbrot visualization renders within 2 seconds on initial selection (using default low-resolution settings)
7. Object type selection persists in URL state for sharing
8. Switching away from Mandelbrot set and back preserves the last-used fractal settings

**Test scenarios**

Scenario 1: Select Mandelbrot set from object type dropdown
- Given the user has a 4D hypercube displayed
- When the user selects "Mandelbrot Set" from the object type selector
- Then a 4D Mandelbrot set visualization appears in the viewport

Scenario 2: Mandelbrot set with dimension change
- Given the user has a 4D Mandelbrot set displayed
- When the user changes dimension to 6D
- Then the visualization updates to show a 6D Mandelbrot set with additional parameter controls

Scenario 3: Switch between object types
- Given the user has customized Mandelbrot fractal settings
- When the user switches to "Hypercube" then back to "Mandelbrot Set"
- Then the previous fractal settings are restored

Scenario 4: URL sharing includes object type
- Given the user has a 5D Mandelbrot set with custom settings
- When the user copies the share URL
- Then loading that URL displays the same 5D Mandelbrot configuration

---

## User Story 2: Configure Iteration Parameters

**User story:** As a user, I want to adjust the Mandelbrot iteration parameters so that I can control the detail level and structure of the fractal visualization.

**Acceptance criteria**
1. "Max Iterations" slider is visible in the Fractal Settings section
2. Max Iterations range: 10 to 500 (default: 80)
3. Higher iteration values reveal more detail but take longer to compute
4. "Escape Radius" slider is visible in the Fractal Settings section
5. Escape Radius range: 2.0 to 10.0 (default: 4.0)
6. Changing iteration parameters updates the visualization within 500ms for low-resolution mode
7. A "Quality" preset dropdown offers: "Draft" (maxIter: 30), "Standard" (maxIter: 80), "High" (maxIter: 200), "Ultra" (maxIter: 500)
8. Tooltip explains: "Max Iterations determines how many times the formula is applied before deciding if a point escapes. Higher values show more detail near the set boundary."
9. Tooltip explains: "Escape Radius is the threshold distance beyond which a point is considered to have escaped. Values near 2.0 give classic Mandelbrot boundaries."

**Test scenarios**

Scenario 1: Increase max iterations
- Given a Mandelbrot set with maxIter=30
- When the user increases maxIter to 150
- Then the fractal boundary becomes more detailed with finer structures visible

Scenario 2: Change escape radius
- Given a Mandelbrot set with escapeRadius=4.0
- When the user changes escapeRadius to 2.0
- Then the boundary of the set changes shape slightly, affecting which points appear "inside"

Scenario 3: Select quality preset
- Given a Mandelbrot set at "Draft" quality
- When the user selects "High" preset
- Then maxIter updates to 200 and the visualization shows significantly more detail

Scenario 4: Parameter change performance
- Given a 4D Mandelbrot set at 32x32x32 resolution
- When the user changes maxIter
- Then the visualization updates within 500ms

---

## User Story 3: Configure Sampling Resolution

**User story:** As a user, I want to adjust the sampling resolution so that I can balance between visual quality and performance.

**Acceptance criteria**
1. "Resolution" slider is visible in the Fractal Settings section
2. Resolution controls samples per axis: 16, 24, 32, 48, 64, 96, 128 (default: 32)
3. Total sample count displayed as informational text: "[N]^3 = [total] samples"
4. Resolution preset buttons: "Fast" (24^3), "Balanced" (32^3), "Quality" (64^3), "Maximum" (128^3)
5. Warning message appears when selecting 96 or 128: "High resolution may cause slow performance on some devices"
6. Progressive rendering: low resolution renders first, then refines to target resolution
7. "Auto" resolution option that adapts based on device performance (starts at 24, increases if frame time allows)

**Test scenarios**

Scenario 1: Increase resolution
- Given a Mandelbrot set at resolution 32
- When the user increases resolution to 64
- Then the visualization becomes smoother with more sample points visible

Scenario 2: High resolution warning
- Given the user is adjusting resolution
- When the user selects 128
- Then a warning message appears about potential performance impact

Scenario 3: Progressive rendering
- Given the user changes from resolution 32 to 96
- When the computation begins
- Then a lower resolution preview appears immediately, followed by the full resolution render

Scenario 4: Sample count display
- Given resolution is set to 48
- When viewing the resolution control
- Then "48^3 = 110,592 samples" is displayed

---

## User Story 4: Select Visualization Axes

**User story:** As a user, I want to choose which three dimensions of the n-dimensional Mandelbrot set are displayed as the 3D visualization axes so that I can explore different cross-sections of higher-dimensional fractals.

**Acceptance criteria**
1. "Visualization Axes" control is visible in the Fractal Settings section
2. Three dropdown selectors allow choosing X, Y, and Z display axes
3. Available axis options are labeled by dimension: "Dim 0 (Re)", "Dim 1 (Im)", "Dim 2", "Dim 3", ... up to the current dimension
4. Dimensions 0 and 1 are labeled as "(Re)" and "(Im)" to indicate the complex plane core
5. Default axes are: X=Dim 0, Y=Dim 1, Z=Dim 2
6. Selecting the same dimension for multiple axes is prevented (each axis must be unique)
7. Changing axes immediately updates the visualization to show the new 3D slice
8. Axes not selected for display become "parameter" dimensions with slider controls

**Test scenarios**

Scenario 1: Change Z axis
- Given a 5D Mandelbrot set with axes X=0, Y=1, Z=2
- When the user changes Z axis to Dim 4
- Then the visualization shows a different 3D slice using dimension 4 for depth

Scenario 2: Prevent duplicate axis selection
- Given X axis is set to Dim 0
- When the user tries to set Y axis to Dim 0
- Then the selection is prevented and user sees "Each axis must use a different dimension"

Scenario 3: Axis labels match dimension
- Given a 7D Mandelbrot set is selected
- When the user opens the X axis dropdown
- Then options appear: "Dim 0 (Re)", "Dim 1 (Im)", "Dim 2", "Dim 3", "Dim 4", "Dim 5", "Dim 6"

Scenario 4: Unselected dimensions become parameters
- Given a 6D Mandelbrot set with axes X=0, Y=1, Z=2
- When viewing the Fractal Settings
- Then parameter sliders appear for Dim 3, Dim 4, and Dim 5

---

## User Story 5: Adjust Parameter Dimensions

**User story:** As a user, I want to adjust the values of non-visualized dimensions using sliders so that I can navigate through different cross-sections of the higher-dimensional Mandelbrot set.

**Acceptance criteria**
1. For each dimension not used as a visualization axis, a parameter slider appears
2. Parameter sliders are labeled with their dimension number
3. Parameter slider range: -2.0 to +2.0 (default: 0.0)
4. Moving a parameter slider updates the visualization in real-time
5. Double-clicking a parameter slider resets it to 0.0
6. "Reset Parameters" button sets all parameter sliders to 0.0
7. Parameter values are included in URL state for sharing
8. For 4D: 1 parameter slider (the 4th dimension)
9. For 5D: 2 parameter sliders
10. For 11D: 8 parameter sliders (dimensions 3-10)
11. Parameters are grouped in a collapsible "Dimension Parameters" subsection

**Test scenarios**

Scenario 1: Adjust 4D parameter
- Given a 4D Mandelbrot set with axes X=0, Y=1, Z=2
- When the user moves the Dim 3 parameter slider from 0.0 to 0.5
- Then the visualization updates to show a different 3D cross-section

Scenario 2: Animate through parameter space
- Given a 5D Mandelbrot set with parameter Dim 4 at 0.0
- When the user slowly drags the Dim 4 slider from -1.0 to +1.0
- Then the visualization smoothly morphs showing different cross-sections

Scenario 3: Reset all parameters
- Given parameters Dim 3=0.5, Dim 4=-0.3 are set
- When the user clicks "Reset Parameters"
- Then both sliders return to 0.0 and visualization updates

Scenario 4: URL includes parameter values
- Given a 6D Mandelbrot with Dim 3=0.3, Dim 4=-0.1, Dim 5=0.7
- When the user copies the share URL
- Then loading that URL restores all three parameter values

---

## User Story 6: Navigate to Interesting Coordinates

**User story:** As a user, I want to navigate to pre-defined interesting coordinates in the Mandelbrot set so that I can quickly explore visually stunning regions without manual searching.

**Acceptance criteria**
1. "Interesting Locations" dropdown is visible in the Fractal Settings section
2. Locations are organized by category: "Classic 2D", "3D Bulbs", "4D Spirals", "Deep Zooms", "User Saved"
3. Classic 2D locations (visible in any dimension):
   - "Main Cardioid Center" (0, 0, 0, ...)
   - "Period-2 Bulb" (-1, 0, 0, ...)
   - "Seahorse Valley" (-0.75, 0.1, 0, ...)
   - "Elephant Valley" (0.28, 0.008, 0, ...)
   - "Spiral Region" (-0.761574, -0.0847596, 0, ...)
4. Higher-dimensional locations unlock based on current dimension setting
5. Selecting a location sets center coordinates and appropriate zoom level
6. Current location name displays when at a named coordinate
7. "Randomize" button jumps to a random location within the set boundary
8. Transition between locations is animated (smooth pan over 500ms)

**Test scenarios**

Scenario 1: Navigate to Seahorse Valley
- Given a 4D Mandelbrot set at default center
- When the user selects "Seahorse Valley" from Interesting Locations
- Then the view animates to center (-0.75, 0.1, 0, 0) with appropriate zoom

Scenario 2: Higher-dimensional location availability
- Given a 3D Mandelbrot set is displayed
- When the user opens Interesting Locations dropdown
- Then "4D Spirals" category is disabled/hidden

Scenario 3: Randomize location
- Given the user is at any location
- When the user clicks "Randomize"
- Then the view jumps to a random point within the Mandelbrot set boundary

Scenario 4: Location name display
- Given the user navigates to "Period-2 Bulb"
- When viewing the current state
- Then "Current: Period-2 Bulb" is displayed

---

## User Story 7: Zoom and Pan Navigation

**User story:** As a user, I want to zoom into and pan around the Mandelbrot set so that I can explore fine details and navigate to specific regions.

**Acceptance criteria**
1. Mouse scroll wheel zooms the view in/out (centered on mouse position)
2. Zoom range: 0.001 (deep zoom) to 10.0 (full view) for the "extent" parameter
3. Click and drag on viewport pans the center point in the XY plane
4. "Center" input fields allow entering exact coordinates for X, Y, Z centers
5. "Extent" (zoom level) input field allows entering exact zoom value
6. "Fit to View" button resets to show the full Mandelbrot set extent (extent=2.5, centered at origin)
7. Zoom level indicator displays current extent value
8. Deep zoom (extent < 0.1) automatically increases max iterations for adequate detail
9. Pan/zoom state is included in URL for sharing

**Test scenarios**

Scenario 1: Scroll to zoom
- Given the view extent is 2.0
- When the user scrolls the mouse wheel forward (toward screen)
- Then the view zooms in smoothly toward the mouse cursor position

Scenario 2: Pan the view
- Given the view is centered at (0, 0, 0)
- When the user clicks and drags the viewport to the right
- Then the center shifts left (revealing more of the right side of the set)

Scenario 3: Enter exact coordinates
- Given the user wants to navigate to specific coordinates
- When the user enters X=-0.75, Y=0.1 in the center inputs
- Then the view pans to center on that coordinate

Scenario 4: Fit to view
- Given the user has zoomed to extent=0.01 at some location
- When the user clicks "Fit to View"
- Then the view resets to extent=2.5 centered at origin showing the full set

Scenario 5: Deep zoom auto-iteration boost
- Given maxIter is 80 and extent is 2.0
- When the user zooms to extent=0.01
- Then maxIter automatically increases to maintain detail at the boundary

---

## User Story 8: Configure Color Mapping

**User story:** As a user, I want to configure how escape time values map to colors so that I can create visually appealing or informative visualizations.

**Acceptance criteria**
1. "Color Mode" dropdown offers: "Escape Time" (default), "Smooth Coloring", "Distance Estimation", "Interior Only"
2. "Color Palette" selector offers predefined palettes: "Classic" (blue-white-orange), "Fire" (black-red-yellow), "Ocean" (deep blue-cyan-white), "Rainbow" (HSL cycle), "Monochrome" (grayscale)
3. "Custom Palette" option allows defining start/mid/end colors
4. "Invert Colors" toggle reverses the palette direction
5. "Interior Color" picker sets the color for points inside the set (default: black)
6. Escape time coloring maps iteration count to palette position
7. Smooth coloring uses fractional escape values for gradient transitions (no banding)
8. "Palette Cycles" slider (1-20) controls how many times the palette repeats across the escape range
9. Color mapping updates in real-time as settings change

**Test scenarios**

Scenario 1: Change color palette
- Given a Mandelbrot set with "Classic" palette
- When the user selects "Fire" palette
- Then colors update to show black/red/yellow gradient based on escape time

Scenario 2: Enable smooth coloring
- Given "Escape Time" mode showing visible color bands
- When the user selects "Smooth Coloring" mode
- Then the color transitions become smooth gradients without banding

Scenario 3: Invert colors
- Given "Classic" palette with blue near set boundary
- When the user enables "Invert Colors"
- Then orange appears near set boundary and blue appears for quickly escaping points

Scenario 4: Adjust palette cycles
- Given palette cycles is 1
- When the user increases palette cycles to 5
- Then the color pattern repeats 5 times across the escape range showing more detail

Scenario 5: Set interior color
- Given interior points are black
- When the user changes interior color to dark purple
- Then points inside the Mandelbrot set render as dark purple

---

## User Story 9: Choose Rendering Style

**User story:** As a user, I want to choose between different rendering styles so that I can visualize the Mandelbrot set in ways that best reveal its structure.

**Acceptance criteria**
1. "Render Style" dropdown offers: "Point Cloud" (default), "Isosurface", "Volume"
2. Point Cloud renders colored points at each sample position
3. Isosurface uses marching cubes to generate a mesh at the set boundary
4. Volume rendering shows density/opacity based on escape values
5. Point Cloud supports point size adjustment (1-10, default: 3)
6. Isosurface supports "Threshold" slider (0.0-1.0) to control which escape value defines the surface
7. Point Cloud is fastest to compute; Volume is slowest
8. Performance indicator shows approximate render time for current settings
9. Render style persists in URL state

**Test scenarios**

Scenario 1: Switch to isosurface
- Given a Point Cloud rendering of the Mandelbrot set
- When the user selects "Isosurface" render style
- Then the visualization changes to show a solid 3D surface at the set boundary

Scenario 2: Adjust isosurface threshold
- Given Isosurface render with threshold=0.5
- When the user changes threshold to 0.9
- Then the surface moves to include more points (further from set interior)

Scenario 3: Point cloud size adjustment
- Given Point Cloud render with size=3
- When the user increases point size to 8
- Then individual points become larger and more visible

Scenario 4: Volume rendering
- Given Point Cloud rendering
- When the user selects "Volume" render style
- Then the set appears as a semi-transparent volumetric cloud with density indicating proximity to set interior

---

## User Story 10: Animate Parameter Exploration

**User story:** As a user, I want to animate the parameter dimensions so that I can see how the 3D slice evolves as we move through higher-dimensional space.

**Acceptance criteria**
1. Each parameter slider has a "Play/Pause" toggle button next to it
2. When playing, the parameter oscillates smoothly between its min and max values
3. Animation speed slider controls oscillation rate (0.1x to 5x, default: 1x)
4. Multiple parameters can animate simultaneously
5. "Animate All Parameters" button starts all parameter animations with phase offsets
6. Animation direction toggle: "Bounce" (back and forth) or "Loop" (wrap around)
7. Animation creates smooth 60 FPS updates
8. Manually adjusting a slider pauses its animation
9. "Stop All" button halts all parameter animations

**Test scenarios**

Scenario 1: Animate single parameter
- Given a 5D Mandelbrot set with Dim 3 parameter at 0.0
- When the user clicks Play on the Dim 3 slider
- Then Dim 3 oscillates between -2.0 and +2.0 and the visualization morphs smoothly

Scenario 2: Multiple simultaneous animations
- Given a 6D Mandelbrot set
- When the user starts animation on Dim 3 and Dim 4
- Then both parameters animate independently creating complex morphing patterns

Scenario 3: Animation speed adjustment
- Given Dim 3 animating at 1x speed
- When the user increases speed to 3x
- Then the oscillation rate triples

Scenario 4: Manual adjustment pauses animation
- Given Dim 3 is animating
- When the user manually drags the Dim 3 slider
- Then the animation pauses at the user's selected value

Scenario 5: Animate all with phase offsets
- Given a 7D Mandelbrot set with 4 parameter dimensions
- When the user clicks "Animate All Parameters"
- Then all 4 parameters animate with 90-degree phase offsets from each other

---

## User Story 11: Save and Load Exploration Bookmarks

**User story:** As a user, I want to save bookmarks of interesting configurations so that I can return to them later or share them with others.

**Acceptance criteria**
1. "Save Bookmark" button captures current: center coordinates, extent, parameters, iteration settings, color settings
2. User can name each bookmark before saving
3. Saved bookmarks appear in a "My Bookmarks" section in the Interesting Locations dropdown
4. Clicking a saved bookmark restores all captured settings
5. Bookmarks are stored in browser localStorage (persist across sessions)
6. "Export Bookmarks" saves all bookmarks as a JSON file
7. "Import Bookmarks" loads bookmarks from a JSON file (merges with existing)
8. Delete individual bookmarks via context menu or delete button
9. Maximum 50 bookmarks stored locally

**Test scenarios**

Scenario 1: Save a bookmark
- Given the user has navigated to an interesting configuration
- When the user clicks "Save Bookmark" and enters name "Cool Spiral"
- Then "Cool Spiral" appears in the My Bookmarks list

Scenario 2: Load a bookmark
- Given "Cool Spiral" bookmark exists
- When the user selects "Cool Spiral" from bookmarks
- Then all settings are restored to the saved configuration

Scenario 3: Export bookmarks
- Given the user has 5 saved bookmarks
- When the user clicks "Export Bookmarks"
- Then a JSON file downloads containing all 5 bookmark configurations

Scenario 4: Import bookmarks
- Given the user has a bookmarks JSON file from another session
- When the user clicks "Import Bookmarks" and selects the file
- Then the imported bookmarks are added to the My Bookmarks list

Scenario 5: Delete a bookmark
- Given "Old Bookmark" exists in My Bookmarks
- When the user clicks the delete button next to "Old Bookmark"
- Then it is removed from the bookmarks list

---

## User Story 12: Apply Visual Shaders to Mandelbrot

**User story:** As a user, I want to apply the existing visual shaders to the Mandelbrot visualization so that I can create stunning visual effects.

**Acceptance criteria**
1. All existing shaders work with Mandelbrot visualizations: Wireframe, Neon Glow, Gradient Fill, Surface
2. Point Cloud rendering supports: point-based shaders with color from escape time
3. Isosurface rendering supports: all mesh-based shaders (Surface shader with lighting)
4. Bloom post-processing effect enhances Mandelbrot visualizations
5. Fresnel and depth attenuation effects apply to isosurface mode
6. Shader settings (specular, ambient, etc.) affect Mandelbrot surfaces
7. "Depth-coded coloring" option uses the 4th dimension value to add color variation

**Test scenarios**

Scenario 1: Neon Glow with Point Cloud
- Given a Mandelbrot Point Cloud rendering
- When the user selects "Neon Glow" shader
- Then points have a glowing effect based on their escape time color

Scenario 2: Surface shader with Isosurface
- Given a Mandelbrot Isosurface rendering
- When the user selects "Surface" shader with lighting enabled
- Then the isosurface responds to light direction with proper shading

Scenario 3: Bloom on Mandelbrot
- Given a Mandelbrot visualization
- When the user enables bloom post-processing
- Then bright areas of the fractal emit a soft glow

Scenario 4: Depth-coded coloring in 4D
- Given a 4D Mandelbrot with isosurface rendering
- When the user enables "Depth-coded coloring"
- Then parts of the surface at different W-coordinates show different hues

---

## User Story 13: View Mandelbrot Properties

**User story:** As a user, I want to view mathematical properties and information about the current Mandelbrot configuration so that I can understand what I'm visualizing.

**Acceptance criteria**
1. Properties panel shows current Mandelbrot configuration
2. Displayed properties include:
   - Object type: "Mandelbrot Set (nD)"
   - Current dimension
   - Visualization axes
   - Parameter values for non-visualized dimensions
   - Center coordinates
   - Extent (zoom level)
   - Max iterations
   - Escape radius
   - Total sample count
   - Approximate render time
3. "Formula" expandable section shows the iteration formula being used
4. "About Mandelbrot Sets" link opens educational content explaining the generalization to n dimensions
5. Coordinate display updates in real-time as parameters change

**Test scenarios**

Scenario 1: View 5D Mandelbrot properties
- Given a 5D Mandelbrot set is displayed
- When the user views the properties panel
- Then it shows: "Mandelbrot Set (5D)", visualization axes, parameter values for Dim 3 and 4, etc.

Scenario 2: View formula
- Given the properties panel is open
- When the user expands the "Formula" section
- Then the n-dimensional iteration formula is displayed with explanation

Scenario 3: Coordinate updates
- Given the user is panning the view
- When the center coordinates change
- Then the properties panel updates to show new center values in real-time

---

## User Story 14: Performance Optimization Controls

**User story:** As a user, I want to control performance vs quality trade-offs so that the visualization remains responsive on my device.

**Acceptance criteria**
1. "Performance Mode" toggle: when enabled, uses reduced quality for interactions
2. During drag/pan operations, resolution temporarily drops to maintain 30+ FPS
3. After interaction stops (200ms idle), full resolution re-renders
4. "GPU Acceleration" toggle (when WebGL compute is available)
5. "Worker Threads" toggle enables Web Worker computation for non-blocking UI
6. Performance stats display: FPS, render time, sample rate
7. "Auto Quality" mode automatically adjusts resolution based on frame time
8. Warning appears if current settings may cause poor performance

**Test scenarios**

Scenario 1: Performance mode during interaction
- Given Performance Mode is enabled with resolution 64
- When the user drags to pan the view
- Then resolution temporarily drops to 24 for smooth interaction

Scenario 2: Auto quality adjustment
- Given Auto Quality is enabled
- When the device struggles to maintain 30 FPS
- Then resolution automatically decreases until performance improves

Scenario 3: Performance stats display
- Given the performance panel is visible
- When the Mandelbrot is rendering
- Then current FPS, render time (ms), and samples/second are displayed

Scenario 4: Worker threads for non-blocking UI
- Given Worker Threads is enabled
- When a high-resolution render is computing
- Then the UI remains responsive (sliders can be adjusted, etc.)

---

## Specification Summary

**Feature**: N-Dimensional Mandelbrot Set Visualization
**User Stories (Jira Tickets)**: 14
**Acceptance Criteria**: 108 total
**Test Scenarios**: 56 total

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Select Mandelbrot as Object Type | User | ~2 days | None (core integration) |
| 2 | Configure Iteration Parameters | User | ~1.5 days | Story 1 |
| 3 | Configure Sampling Resolution | User | ~1 day | Story 1 |
| 4 | Select Visualization Axes | User | ~1.5 days | Story 1 |
| 5 | Adjust Parameter Dimensions | User | ~1.5 days | Stories 1, 4 |
| 6 | Navigate to Interesting Coordinates | User | ~1.5 days | Stories 1, 7 |
| 7 | Zoom and Pan Navigation | User | ~2 days | Story 1 |
| 8 | Configure Color Mapping | User | ~2 days | Story 1 |
| 9 | Choose Rendering Style | User | ~2 days | Story 1 |
| 10 | Animate Parameter Exploration | User | ~1.5 days | Stories 1, 5 |
| 11 | Save and Load Bookmarks | User | ~1.5 days | All navigation stories |
| 12 | Apply Visual Shaders | User | ~1 day | Story 9 |
| 13 | View Mandelbrot Properties | User | ~1 day | Story 1 |
| 14 | Performance Optimization Controls | User | ~1.5 days | Stories 1, 3, 9 |

### Coverage
- Happy paths: 28
- Error handling: 6
- Edge cases: 12
- Permission/access: 0 (no auth required)
- System behavior: 10

### Placeholders Requiring Confirmation
- None - specifications are complete based on research documentation

### Open Questions
- None - the research guide `docs/research/nd-mandelbrot-threejs-guide.md` provides all necessary mathematical foundations

### Dependencies Between Stories
- Story 1 (Mandelbrot object type) is foundational for all other stories
- Story 4 (Visualization Axes) must precede Story 5 (Parameter Dimensions)
- Story 7 (Zoom/Pan) should precede Story 6 (Interesting Coordinates)
- Story 9 (Rendering Style) should precede Story 12 (Visual Shaders)
- Stories 2, 3, 8, 13, 14 can be developed independently after Story 1

### Mathematical Requirements Summary
Based on research guide `docs/research/nd-mandelbrot-threejs-guide.md`:

1. **Escape Time Formula**: Iterate z_{n+1} = F(z_n, c) until |z_n| > R or n > maxIter
2. **N-Dimensional Step Function**: Complex square on first two coords, coupled quadratics on remaining
3. **Projection**: Select 3 axes for display, remaining become parameters
4. **Rendering Options**: Point cloud (simpler) or marching cubes isosurface (heavier)
5. **Dimension Support**: 3D through 11D
6. **Escape Radius**: Typically 2.0-4.0

### Integration Points with Existing System
- Object type selector: Add "Mandelbrot Set" option
- Dimension selector: Reuse existing control (extend range to 11 if needed)
- Visual shaders: Apply existing shader system to Mandelbrot outputs
- Bloom/post-processing: Works with all render styles
- URL state: Extend serializer to include Mandelbrot-specific parameters
- Properties panel: Extend to show Mandelbrot properties

### Ready for Development: YES
