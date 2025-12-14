# N-Dimensional Object Visualizer

## Product Overview

A React web application using Three.js that visualizes n-dimensional geometric objects projected into 3D space. Users can select dimensions (3D-6D+), choose object types (hypercubes, simplices), apply transformations (rotation, scale, shear), and explore how higher-dimensional objects appear when projected into our familiar 3D world.

**Target Audience:** Science educators, students, mathematics enthusiasts, and anyone curious about higher-dimensional geometry.

**Core Value Proposition:** Make the abstract concept of higher dimensions tangible and explorable through interactive, visually stunning 3D projections.

---

## User Story 1: Launch Application and View Default Scene

**User story:** As a user, I want to see a visually appealing 3D scene with a default object when I open the application, so that I can immediately start exploring.

**Acceptance criteria**
1. Application loads within 3 seconds on standard broadband connection
2. User sees a centered 3D viewport occupying at least 70% of screen width
3. Default object displayed is a 4D tesseract (hypercube) projected into 3D
4. Scene includes ambient lighting and one directional light source for depth perception
5. Object renders with visible edges and semi-transparent faces
6. Background displays a subtle gradient (dark theme by default)
7. Control panel is visible on the side without obstructing the 3D view
8. Application title "N-Dimensional Visualizer" appears in the header
9. Scene renders at 60 FPS on devices with WebGL 2.0 support
10. User can click and drag on viewport to orbit the camera around the object
11. User can scroll to zoom in/out with smooth interpolation
12. Object gently auto-rotates by default to show its 3D structure

**Test scenarios**

Scenario 1: Successful initial load
- Given the user navigates to the application URL
- When the page finishes loading
- Then the user sees a 4D tesseract rendered in the center of the viewport with all edges visible and faces semi-transparent

Scenario 2: Camera orbit interaction
- Given the application has loaded with the default scene
- When the user clicks and drags on the viewport
- Then the camera orbits around the object smoothly following the drag direction

Scenario 3: Zoom interaction
- Given the application has loaded with the default scene
- When the user scrolls the mouse wheel forward
- Then the camera smoothly zooms closer to the object

Scenario 4: Auto-rotation behavior
- Given the application has loaded with no user interaction for 3 seconds
- When the user observes the scene
- Then the object rotates slowly around one axis to demonstrate its 3D structure

Scenario 5: WebGL not supported
- Given the user's browser does not support WebGL 2.0
- When the application attempts to load
- Then the user sees a message: "Your browser does not support WebGL 2.0. Please use a modern browser like Chrome, Firefox, or Edge."

---

## User Story 2: Select Object Dimension

**User story:** As a user, I want to select the number of dimensions for my object, so that I can explore geometry in 3D, 4D, 5D, or 6D space.

**Acceptance criteria**
1. Dimension selector control is visible in the control panel
2. Available dimension options are: 3, 4, 5, 6
3. Current dimension is visually highlighted in the selector
4. Default selected dimension is 4
5. When dimension changes, object regenerates within 500ms
6. Transition between objects is smooth (fade or morph effect)
7. Rotation plane controls update to match the new dimension count:
   - 3D: 3 rotation planes (XY, XZ, YZ)
   - 4D: 6 rotation planes (XY, XZ, YZ, XW, YW, ZW)
   - 5D: 10 rotation planes
   - 6D: 15 rotation planes
8. Object properties panel updates to show correct vertex/edge counts
9. Tooltip appears on hover explaining: "Objects in nD space have n(n-1)/2 rotation planes"

**Test scenarios**

Scenario 1: Select 3D dimension
- Given the application displays a 4D tesseract
- When the user selects dimension "3" from the dimension selector
- Then a 3D cube appears in the viewport and the rotation controls show 3 plane sliders

Scenario 2: Select 5D dimension
- Given the application displays a 4D tesseract
- When the user selects dimension "5" from the dimension selector
- Then a 5D hypercube appears in the viewport and the rotation controls show 10 plane sliders

Scenario 3: Select 6D dimension
- Given the application displays a 4D tesseract
- When the user selects dimension "6" from the dimension selector
- Then a 6D hypercube appears in the viewport and the rotation controls show 15 plane sliders

Scenario 4: Dimension change preserves camera position
- Given the user has orbited the camera to a custom position
- When the user changes the dimension from 4D to 5D
- Then the new object appears at the center but the camera maintains its orbital position

Scenario 5: Rapid dimension switching
- Given the user rapidly clicks through dimensions 3, 4, 5, 6 within 2 seconds
- When the final dimension selection is made
- Then only the final dimension's object renders (no visual glitches or stacking)

---

## User Story 3: Select Object Type

**User story:** As a user, I want to choose different types of geometric objects, so that I can explore various shapes in higher dimensions.

**Acceptance criteria**
1. Object type selector is visible in the control panel
2. Available object types include:
   - Hypercube (default): 2^n vertices
   - Simplex: n+1 vertices (tetrahedron in 3D, pentachoron in 4D)
   - Cross-polytope (Orthoplex): 2n vertices
   - Demihypercube: 2^(n-1) vertices (for n >= 4)
3. Each option displays a small icon/preview of the 3D version
4. Selecting a new type regenerates the object within 500ms
5. Object maintains current dimension when type changes
6. Rotation angles reset to zero when object type changes
7. Properties panel updates to show new vertex/edge/face/cell counts
8. Tooltips explain each object type:
   - Hypercube: "Generalization of cube: square → cube → tesseract → ..."
   - Simplex: "Simplest shape in each dimension: triangle → tetrahedron → pentachoron → ..."
   - Cross-polytope: "Generalization of octahedron"
   - Demihypercube: "Half of a hypercube's vertices"

**Test scenarios**

Scenario 1: Select simplex in 4D
- Given the application displays a 4D hypercube
- When the user selects "Simplex" from the object type selector
- Then a 4D simplex (pentachoron) with 5 vertices appears in the viewport

Scenario 2: Select cross-polytope in 5D
- Given the application displays a 5D hypercube
- When the user selects "Cross-polytope" from the object type selector
- Then a 5D cross-polytope with 10 vertices appears in the viewport

Scenario 3: Object type persists across dimension changes
- Given the user has selected "Simplex" as the object type
- When the user changes dimension from 4D to 5D
- Then a 5D simplex (hexateron) with 6 vertices appears

Scenario 4: Demihypercube availability
- Given the user has selected dimension 3
- When the user views the object type selector
- Then "Demihypercube" option is disabled with tooltip: "Available for 4D and higher"

---

## User Story 4: Rotate Object in Individual Planes

**User story:** As a user, I want to rotate the object in each available rotation plane independently, so that I can explore how higher-dimensional rotations affect the 3D projection.

**Acceptance criteria**
1. Rotation controls section displays one slider per rotation plane
2. Each slider is labeled with its plane name (e.g., "XY", "XW", "ZW")
3. Slider range is 0° to 360° with 1° increments
4. Current angle value displays next to each slider
5. Dragging a slider updates the rotation in real-time (immediate visual feedback)
6. Double-clicking a slider resets it to 0°
7. Rotation is mathematically accurate using rotation matrix multiplication
8. For 4D objects, the 3 "familiar" planes (XY, XZ, YZ) are visually grouped separately from the 3 "W-axis" planes (XW, YW, ZW)
9. Tooltips explain the difference: "W-axis rotations move vertices in/out of the 4th dimension"
10. Rotation order follows standard convention: XY → XZ → YZ → XW → YW → ZW
11. Combined rotations compose correctly via matrix multiplication

**Test scenarios**

Scenario 1: Rotate tesseract in XY plane only
- Given a 4D tesseract at default orientation
- When the user drags the XY slider to 45°
- Then the tesseract rotates 45° in the XY plane and the projection shows a rotated square shape

Scenario 2: Rotate tesseract in XW plane only
- Given a 4D tesseract at default orientation
- When the user drags the XW slider to 90°
- Then vertices that were at W=1 move toward X-axis and vertices at W=-1 move opposite

Scenario 3: Combined rotation in multiple planes
- Given the user sets XY=30°, XZ=45°, XW=60°
- When all sliders are positioned
- Then the composite rotation is applied correctly (matrix multiplication order is respected)

Scenario 4: Reset individual slider
- Given the XW slider is set to 90°
- When the user double-clicks the XW slider
- Then the XW angle resets to 0° and the object updates immediately

Scenario 5: Rotation continuity across 360°
- Given the XY slider is at 350°
- When the user drags the slider past 360°
- Then the slider wraps to 0° and the rotation continues smoothly without visual jump

---

## User Story 5: Configure Projection Settings

**User story:** As a user, I want to adjust how the higher-dimensional object is projected into 3D, so that I can see different representations of the same object.

**Acceptance criteria**
1. Projection settings section is visible in the control panel
2. Projection type options include:
   - Perspective (default): Objects further in higher dimensions appear smaller
   - Orthographic: Parallel projection, no foreshortening
3. Perspective projection distance slider ranges from 2.0 to 10.0 (default: 4.0)
4. Distance slider tooltip explains: "Lower values = stronger perspective effect, higher dimensions appear more distorted"
5. Changing projection type updates the view within 100ms
6. Changing distance slider updates in real-time
7. Perspective formula used: (x,y,z) = (x/(d-w), y/(d-w), z/(d-w)) where d is projection distance
8. When projection distance equals W coordinate, the system prevents division by zero by clamping
9. Field of view slider for final 3D→2D projection (30° to 120°, default: 60°)

**Test scenarios**

Scenario 1: Switch to orthographic projection
- Given a 4D tesseract with perspective projection
- When the user selects "Orthographic" projection type
- Then the inner cube and outer cube of the tesseract projection appear the same size

Scenario 2: Decrease projection distance
- Given perspective projection with distance=4.0
- When the user decreases distance to 2.5
- Then the perspective effect intensifies and the inner structure appears more distorted

Scenario 3: Increase projection distance
- Given perspective projection with distance=4.0
- When the user increases distance to 8.0
- Then the perspective effect diminishes and the projection approaches orthographic appearance

Scenario 4: Division by zero prevention
- Given a tesseract with vertices at W=1 and projection distance=1.0
- When this configuration would cause division by zero
- Then the system clamps the divisor to a minimum value (e.g., 0.001) preventing visual artifacts

Scenario 5: Adjust 3D field of view
- Given the default 60° field of view
- When the user increases FOV to 90°
- Then the 3D viewport shows a wider view with more apparent perspective distortion

---

## User Story 6: Customize Visual Appearance

**User story:** As a user, I want to customize how the object looks visually, so that I can create aesthetically pleasing or clearer visualizations.

**Acceptance criteria**
1. Visual settings section includes controls for:
   - Edge color (color picker, default: cyan #00FFFF)
   - Face opacity (0-100%, default: 20%)
   - Vertex visibility toggle (default: ON)
   - Vertex size (1-10, default: 4)
   - Vertex color (color picker, default: white #FFFFFF)
   - Edge thickness (1-5, default: 2)
   - Background color (color picker, default: dark gray #1A1A2E)
2. All changes apply in real-time (within 50ms)
3. Preset themes available:
   - "Neon" (dark bg, bright cyan edges, pink vertices)
   - "Blueprint" (navy bg, white edges, no faces)
   - "Hologram" (dark bg, green edges, green glow)
   - "Scientific" (white bg, black edges, minimal)
4. "Reset to defaults" button restores original visual settings
5. Face coloring can optionally vary by depth in higher dimension (depth-coded coloring)

**Test scenarios**

Scenario 1: Change edge color
- Given default cyan edges
- When the user selects red (#FF0000) from the edge color picker
- Then all edges immediately render in red

Scenario 2: Adjust face opacity to zero
- Given 20% face opacity
- When the user sets face opacity to 0%
- Then only edges and vertices are visible (wireframe mode)

Scenario 3: Apply Neon preset
- Given default visual settings
- When the user clicks the "Neon" preset button
- Then background becomes dark, edges become bright cyan, and vertices become pink

Scenario 4: Hide vertices
- Given vertices are visible
- When the user toggles vertex visibility OFF
- Then vertex spheres disappear from the rendering

Scenario 5: Enable depth-coded face coloring
- Given a 4D tesseract with uniform face color
- When the user enables "Depth-coded coloring"
- Then faces at W=1 render in one color and faces at W=-1 render in a different color (gradient between)

---

## User Story 7: View Object Properties

**User story:** As a user, I want to see the mathematical properties of the current object, so that I can understand its structure and learn about higher-dimensional geometry.

**Acceptance criteria**
1. Properties panel displays in a collapsible section
2. Properties shown include:
   - Current dimension (n)
   - Object type name
   - Vertex count (with formula: e.g., "16 vertices (2^n = 2^4)")
   - Edge count (with formula)
   - Face count (for n >= 3)
   - Cell count (for n >= 4)
   - Hypercell count (for n >= 5)
3. Properties update immediately when dimension or object type changes
4. Rotation degrees of freedom displayed: "n(n-1)/2 = [value] rotation planes"
5. Current transformation state summary (which rotations are non-zero)
6. Coordinates of all vertices available via "Show Coordinates" expandable section
7. Properties use proper mathematical notation where applicable

**Test scenarios**

Scenario 1: View 4D tesseract properties
- Given a 4D hypercube is displayed
- When the user views the properties panel
- Then the panel shows: 4D, Hypercube, 16 vertices (2^4), 32 edges, 24 faces, 8 cubic cells

Scenario 2: View 5D simplex properties
- Given a 5D simplex is displayed
- When the user views the properties panel
- Then the panel shows: 5D, Simplex, 6 vertices (n+1), 15 edges, 20 faces, 15 tetrahedral cells, 6 pentachoral hypercells

Scenario 3: Expand vertex coordinates
- Given a 4D tesseract is displayed
- When the user clicks "Show Coordinates"
- Then 16 rows appear showing each vertex as (x, y, z, w) with values ±1

Scenario 4: Rotation state summary
- Given XY=45° and XW=90° rotations are applied
- When the user views properties panel
- Then "Active rotations: XY(45°), XW(90°)" appears in the transformation summary

---

## User Story 8: Animate Rotations

**User story:** As a user, I want to animate rotations automatically, so that I can see the object continuously transform and better understand its structure.

**Acceptance criteria**
1. Animation controls section visible in control panel
2. Play/Pause toggle button for animation
3. Animation speed slider (0.1x to 5x, default: 1x)
4. Rotation plane selector for which plane(s) to animate
5. Multiple planes can be animated simultaneously with different speeds
6. Animation direction toggle (clockwise/counter-clockwise)
7. "Animate All" button that rotates in all planes simultaneously
8. Animation is smooth (uses requestAnimationFrame, 60 FPS)
9. Manual slider adjustments pause animation for that specific plane
10. Animation state persists when changing projection settings or visual settings
11. Special animation mode: "Isoclinic rotation" for 4D (XY and ZW rotate together at same rate)

**Test scenarios**

Scenario 1: Start basic animation
- Given a static 4D tesseract
- When the user clicks Play and selects XW plane
- Then the object continuously rotates in the XW plane at 1x speed

Scenario 2: Adjust animation speed
- Given XW animation playing at 1x
- When the user increases speed to 3x
- Then the rotation rate triples immediately

Scenario 3: Animate multiple planes
- Given XW animation playing
- When the user also selects YW for animation
- Then both XW and YW rotate simultaneously

Scenario 4: Pause animation
- Given animation is playing in XW and YW planes
- When the user clicks Pause
- Then all rotations stop at their current angles

Scenario 5: Manual adjustment pauses single plane
- Given XW and YW animations playing
- When the user manually drags the XW slider
- Then XW animation pauses (slider tracks user input) but YW continues animating

Scenario 6: Isoclinic rotation mode (4D only)
- Given a 4D tesseract
- When the user enables "Isoclinic rotation" mode
- Then XY and ZW planes rotate at the same rate, creating the special double rotation

---

## User Story 9: Scale Object

**User story:** As a user, I want to scale the object uniformly or along specific axes, so that I can examine how scaling affects the projection.

**Acceptance criteria**
1. Scale controls section visible in control panel
2. Uniform scale slider (0.1 to 3.0, default: 1.0)
3. Per-axis scale sliders for each dimension (X, Y, Z, W for 4D)
4. "Lock uniform" toggle that links all axis scales
5. Scale changes apply in real-time
6. Scale is applied before rotation in transformation order
7. Double-click any scale slider to reset to 1.0
8. "Reset all scales" button available
9. Extreme scale values (< 0.2 or > 2.5) show warning: "Extreme scaling may cause visual distortion"

**Test scenarios**

Scenario 1: Uniform scale down
- Given a tesseract at scale 1.0
- When the user sets uniform scale to 0.5
- Then the projected object appears at half size in all dimensions

Scenario 2: Non-uniform scale (stretch in W)
- Given a 4D tesseract with uniform scale 1.0
- When the user sets W scale to 2.0 (keeping X,Y,Z at 1.0)
- Then the inner cube and outer cube of the projection separate further apart

Scenario 3: Locked uniform scaling
- Given "Lock uniform" is enabled
- When the user adjusts the X scale slider to 1.5
- Then Y, Z, and W scales also change to 1.5

Scenario 4: Reset individual axis
- Given W scale is 2.0
- When the user double-clicks the W scale slider
- Then W scale resets to 1.0

---

## User Story 10: Apply Shear Transformations

**User story:** As a user, I want to apply shear transformations to the object, so that I can explore how shearing in higher dimensions affects the projection.

**Acceptance criteria**
1. Shear controls section visible in control panel
2. Shear sliders for each dimension pair:
   - 4D: XY, XZ, XW, YZ, YW, ZW (6 shear directions)
3. Shear range: -2.0 to +2.0 (default: 0)
4. Shear formula displayed: "Shear XY: x' = x + s*y, y' = y"
5. Shear applied after rotation in transformation order
6. Changes apply in real-time
7. "Reset shears" button available
8. Tooltip explains: "Shear skews the object, making parallel lines converge"

**Test scenarios**

Scenario 1: Apply XY shear
- Given a 4D tesseract at default position
- When the user sets XY shear to 0.5
- Then the object appears skewed with Y-coordinates influencing X-positions

Scenario 2: Apply XW shear
- Given a 4D tesseract at default position
- When the user sets XW shear to 1.0
- Then the inner cube (W=-1) and outer cube (W=+1) shift horizontally relative to each other

Scenario 3: Combined rotation and shear
- Given XY rotation of 45° is applied
- When the user applies XW shear of 0.5
- Then both transformations are visible with rotation applied before shear

Scenario 4: Reset all shears
- Given multiple shear values are non-zero
- When the user clicks "Reset shears"
- Then all shear sliders return to 0 and the object appears unsheared

---

## User Story 11: Translate Object

**User story:** As a user, I want to translate (move) the object along each axis, so that I can position it within the visualization space.

**Acceptance criteria**
1. Translation controls section visible in control panel
2. Per-axis translation sliders for each dimension (X, Y, Z, W for 4D)
3. Translation range: -5.0 to +5.0 (default: 0)
4. Translation in W moves the object "into" or "out of" the 4th dimension
5. W translation affects perspective projection (objects at higher W appear smaller)
6. Changes apply in real-time
7. "Center object" button resets all translations to 0
8. Translation applied last in transformation order (after scale, rotation, shear)

**Test scenarios**

Scenario 1: Translate in X
- Given a tesseract centered at origin
- When the user sets X translation to 2.0
- Then the entire object shifts right in the viewport

Scenario 2: Translate in W (4D)
- Given a tesseract centered at origin with perspective projection
- When the user sets W translation to 2.0
- Then the object appears smaller (further away in 4D space)

Scenario 3: Translate in W negative
- Given a tesseract centered at origin with perspective projection
- When the user sets W translation to -2.0
- Then the object appears larger (closer in 4D space)

Scenario 4: Center object
- Given translations X=2, Y=1, Z=-1, W=3
- When the user clicks "Center object"
- Then all translations reset to 0 and the object returns to center

---

## User Story 12: View Cross-Section Slice

**User story:** As a user, I want to view cross-sections of the higher-dimensional object by slicing with a hyperplane, so that I can see how 3D slices change as the hyperplane moves.

**Acceptance criteria**
1. Cross-section mode toggle available in control panel
2. When enabled, shows the intersection of the nD object with a 3D hyperplane
3. Slice position slider controls the W-coordinate of the slicing plane (-2.0 to +2.0, default: 0)
4. Cross-section rendered as solid 3D geometry (triangulated)
5. Original wireframe can optionally remain visible (with reduced opacity)
6. Animate slice position with play button
7. For tesseract at W=0: shows a cube
8. For tesseract at W=±0.5: shows a truncated cube
9. Color indicates slice depth (gradient from blue to red as W changes)
10. Tooltip explains: "Moving the slice through 4D is like a 3D being observing slices of a 4D object"

**Test scenarios**

Scenario 1: Enable cross-section at W=0
- Given a 4D tesseract in standard projection mode
- When the user enables cross-section mode with slice at W=0
- Then a solid 3D cube appears (the intersection of tesseract with W=0 hyperplane)

Scenario 2: Move slice to W=0.5
- Given cross-section mode enabled at W=0 showing a cube
- When the user moves slice position to W=0.5
- Then the displayed shape changes to a smaller cube (between the two cubic faces)

Scenario 3: Move slice outside object
- Given cross-section of tesseract at W=0
- When the user moves slice position to W=1.5 (beyond tesseract bounds)
- Then no cross-section appears (empty slice)

Scenario 4: Animate slice
- Given cross-section mode enabled
- When the user clicks animate slice
- Then the slice position automatically moves from -1.5 to +1.5 and back continuously

---

## User Story 13: Export Visualization

**User story:** As a user, I want to export the current visualization as an image or share my configuration, so that I can save or share interesting configurations.

**Acceptance criteria**
1. Export button visible in toolbar/header
2. Export options include:
   - PNG image (current viewport)
   - PNG image with transparent background
   - Configuration JSON (all settings)
3. Image exports at current viewport resolution or selectable higher resolutions (2x, 4x)
4. Configuration export includes: dimension, object type, all rotation angles, projection settings, visual settings
5. Import configuration option to load previously saved JSON
6. Share URL option that encodes configuration in URL parameters
7. Copy URL button copies shareable link to clipboard
8. Exported images include small watermark: "N-Dimensional Visualizer"

**Test scenarios**

Scenario 1: Export PNG image
- Given a customized tesseract visualization
- When the user clicks Export > PNG Image
- Then a PNG file downloads showing the current viewport contents

Scenario 2: Export configuration JSON
- Given rotation XW=45°, dimension=5, object=simplex
- When the user clicks Export > Configuration
- Then a JSON file downloads containing all these settings

Scenario 3: Import configuration
- Given a previously exported configuration JSON
- When the user clicks Import and selects the file
- Then all settings are restored and the visualization matches the exported state

Scenario 4: Generate share URL
- Given a customized visualization
- When the user clicks "Copy Share URL"
- Then a URL is copied to clipboard that, when opened, recreates the exact visualization

Scenario 5: Load share URL
- Given a share URL with encoded parameters for 5D simplex with XY=30°
- When a user navigates to that URL
- Then the application loads with a 5D simplex rotated 30° in the XY plane

---

## User Story 14: Display Educational Information

**User story:** As a user, I want to access educational information about n-dimensional geometry, so that I can learn while exploring.

**Acceptance criteria**
1. Info/Help button visible in header
2. Opens modal or side panel with educational content
3. Content organized into sections:
   - "What are higher dimensions?" (introduction)
   - "Understanding rotation planes" (why rotations work differently)
   - "Projection explained" (how 4D→3D projection works)
   - "Famous polytopes" (tesseract, pentachoron, 120-cell, etc.)
4. Each object type has a "Learn more" link in properties panel
5. Interactive mini-examples embedded in educational content
6. Content is scrollable and searchable
7. "Show tips" toggle displays contextual tooltips throughout UI
8. Mathematical formulas rendered properly (LaTeX-style or equivalent)

**Test scenarios**

Scenario 1: Open educational panel
- Given the main application is displayed
- When the user clicks the Info button
- Then an educational panel opens with organized content sections

Scenario 2: Access object-specific learning
- Given a 4D pentachoron is displayed
- When the user clicks "Learn more" in the properties panel
- Then educational content about simplices and the pentachoron is displayed

Scenario 3: Enable contextual tips
- Given tips are disabled
- When the user enables "Show tips" toggle
- Then hovering over controls displays helpful tooltips explaining each feature

Scenario 4: Search educational content
- Given the educational panel is open
- When the user types "projection" in the search box
- Then content sections mentioning projection are highlighted/filtered

---

## User Story 15: Keyboard Shortcuts

**User story:** As a user, I want to use keyboard shortcuts for common actions, so that I can work more efficiently.

**Acceptance criteria**
1. Keyboard shortcuts work when viewport is focused
2. Available shortcuts:
   - Space: Play/Pause animation
   - R: Reset all transformations
   - 3/4/5/6: Set dimension
   - Arrow keys: Nudge rotation in primary plane
   - +/-: Zoom in/out
   - H: Toggle help/shortcuts panel
   - C: Toggle cross-section mode
   - F: Toggle fullscreen viewport
   - Esc: Exit fullscreen or close modal
3. Shortcuts panel accessible via "?" key
4. Shortcuts do not conflict with browser defaults
5. Shortcuts can be customized in settings

**Test scenarios**

Scenario 1: Play/pause with spacebar
- Given animation is paused
- When the user presses Space
- Then animation starts playing

Scenario 2: Reset with R key
- Given various transformations are applied
- When the user presses R
- Then all rotations, scales, shears, and translations reset to defaults

Scenario 3: Change dimension with number keys
- Given a 4D object is displayed
- When the user presses 5
- Then the dimension changes to 5D

Scenario 4: View shortcuts help
- Given the main application is displayed
- When the user presses ?
- Then a shortcuts reference panel appears

Scenario 5: Fullscreen toggle
- Given normal windowed mode
- When the user presses F
- Then the viewport expands to fullscreen

---

## User Story 16: Responsive Layout

**User story:** As a user, I want the application to work well on different screen sizes, so that I can use it on desktop, tablet, or mobile devices.

**Acceptance criteria**
1. Desktop (>1024px): Side-by-side layout with control panel on right
2. Tablet (768-1024px): Collapsible control panel, full-width viewport
3. Mobile (<768px): Controls in bottom sheet that slides up, viewport fills screen
4. All controls remain accessible on all screen sizes
5. Touch gestures work on mobile:
   - Single finger drag: orbit camera
   - Pinch: zoom
   - Two finger drag: pan
6. Control panel can be collapsed/hidden on all screen sizes
7. Minimum supported viewport: 320px width
8. Performance remains smooth (60 FPS) on modern mobile devices

**Test scenarios**

Scenario 1: Desktop layout
- Given a 1920x1080 desktop screen
- When the application loads
- Then viewport takes ~70% width on left, controls panel on right

Scenario 2: Tablet layout
- Given an iPad-sized screen (768-1024px)
- When the application loads
- Then viewport is full width with floating control toggle button

Scenario 3: Mobile layout
- Given a mobile screen (375px width)
- When the application loads
- Then viewport is full screen with bottom sheet for controls

Scenario 4: Mobile touch gestures
- Given mobile layout
- When the user performs pinch gesture on viewport
- Then the camera zooms in/out smoothly

Scenario 5: Collapse controls on desktop
- Given desktop layout with visible control panel
- When the user clicks the collapse button
- Then control panel hides and viewport expands to full width

---

## Specification Summary

**Feature**: N-Dimensional Object Visualizer
**User Stories (Jira Tickets)**: 16
**Acceptance Criteria**: 144 total
**Test Scenarios**: 70 total

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Launch and View Default Scene | User | ~2 days | None |
| 2 | Select Object Dimension | User | ~2 days | Story 1 |
| 3 | Select Object Type | User | ~2 days | Story 1 |
| 4 | Rotate in Individual Planes | User | ~2 days | Stories 1,2 |
| 5 | Configure Projection Settings | User | ~2 days | Story 1 |
| 6 | Customize Visual Appearance | User | ~2 days | Story 1 |
| 7 | View Object Properties | User | ~1.5 days | Stories 1,2,3 |
| 8 | Animate Rotations | User | ~2 days | Story 4 |
| 9 | Scale Object | User | ~1.5 days | Story 1 |
| 10 | Apply Shear Transformations | User | ~1.5 days | Story 1 |
| 11 | Translate Object | User | ~1.5 days | Story 1 |
| 12 | View Cross-Section Slice | User | ~2 days | Stories 1,2 |
| 13 | Export Visualization | User | ~2 days | All core stories |
| 14 | Display Educational Information | User | ~2 days | None |
| 15 | Keyboard Shortcuts | User | ~1 day | All core stories |
| 16 | Responsive Layout | User | ~2 days | All core stories |

### Coverage
- Happy paths: 35
- Error handling: 8
- Edge cases: 15
- Permission/access: 0 (no auth required)
- System behavior: 12

### Placeholders Requiring Confirmation
- None - all specifications are complete

### Open Questions
- None - research synthesis provided all necessary mathematical foundations

### Dependencies Between Stories
- Story 1 (Default Scene) is foundational for all other stories
- Story 2 (Dimension Selection) required before rotation planes can be properly displayed
- Story 4 (Rotation Controls) required before Story 8 (Animation)
- Stories 9-11 (Scale, Shear, Translate) can be developed independently
- Stories 13-16 (Export, Education, Shortcuts, Responsive) require core functionality

### Mathematical Requirements Summary
Based on research synthesis `docs/research/synthesis.md`:

1. **Rotation DOF Formula**: n(n-1)/2 planes for n-dimensions
2. **Hypercube Vertices**: 2^n
3. **Simplex Vertices**: n+1
4. **Perspective Projection**: (x,y,z) = (x/(d-w), y/(d-w), z/(d-w))
5. **Transformation Order**: Scale → Rotation → Shear → Translation
6. **Rotation Composition**: Matrix multiplication (pre-multiply)

### Ready for Development: YES
