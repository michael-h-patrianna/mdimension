# Hyperbulb Particle Rendering Modes

## Overview

This feature adds three distinct rendering modes for hyperbulb fractals: the existing solid surface rendering plus two new particle-based modes. Users can choose between a solid surface, a shell of particles near the surface, or GPU-instanced particles projected onto the SDF surface. Users access these settings through the Faces section > Material tab in the sidebar.

---

## User Story 1: Render Mode Selection

**User story:** As a user viewing a hyperbulb fractal, I want to select between different rendering styles so that I can visualize the fractal as a solid surface or as a particle system.

**Acceptance criteria**
1. User sees a "Render Style" dropdown in the Material tab when viewing a hyperbulb fractal
2. Dropdown contains three options: "Surface" (default), "Shell Particles", "Instanced Projection"
3. Selecting a mode immediately updates the fractal rendering in the viewport
4. Selected mode persists when switching between dimensions (3D-11D)
5. Mode selection is saved when sharing via URL
6. When switching from hyperbulb to a polytope object type, the Render Style dropdown is hidden
7. Each mode has a distinct visual icon in the dropdown for quick recognition
8. Tooltip describes each mode on hover

**Test scenarios**

Scenario 1: Default mode on first load
- Given the user loads the application with a hyperbulb fractal selected
- When the user opens Faces section > Material tab
- Then the user sees "Render Style" dropdown with "Surface" selected

Scenario 2: Change render style
- Given the user is viewing a 4D hyperbulb with "Surface" mode selected
- When the user selects "Shell Particles" from the dropdown
- Then the fractal immediately re-renders as a cloud of particles near the surface

Scenario 3: Mode persists across dimension changes
- Given the user has selected "Instanced Projection" mode
- When the user changes dimension from 4D to 7D
- Then the "Instanced Projection" mode remains selected and applied

Scenario 4: Mode hidden for non-hyperbulb objects
- Given the user has selected "Shell Particles" mode for a hyperbulb
- When the user switches to a polytope object type (e.g., 24-cell)
- Then the "Render Style" dropdown is not visible in the Material tab

Scenario 5: Mode tooltips
- Given the user hovers over the "Shell Particles" option in the dropdown
- When the tooltip appears
- Then it reads "Particles scattered in a shell around the fractal surface"

---

## User Story 2: Surface Mode (Current Behavior)

**User story:** As a user, I want to render the hyperbulb as a solid raymarched surface so that I can see the precise mathematical form of the fractal.

**Acceptance criteria**
1. When "Surface" mode is selected, the fractal renders as the current solid raymarched surface
2. All existing material controls (opacity modes, shadows, lighting) work normally
3. No additional particle-specific controls appear when Surface mode is selected
4. Surface mode has the highest geometric precision of all modes
5. This mode is the default for all new sessions
6. Performance matches current implementation

**Test scenarios**

Scenario 1: Surface mode renders current behavior
- Given the user has "Surface" mode selected
- When the user views the hyperbulb
- Then the fractal appears as a solid raymarched surface identical to current behavior

Scenario 2: Material controls work in Surface mode
- Given the user is in Surface mode
- When the user adjusts opacity, shadows, or lighting
- Then all effects apply correctly to the solid surface

Scenario 3: Default mode
- Given the user opens the application for the first time
- When the user views a hyperbulb
- Then "Surface" mode is active by default

---

## User Story 3: Shell Particles Mode

**User story:** As a user, I want to render the hyperbulb as scattered particles forming a shell around the surface so that I can create a dust-like or debris effect visualization.

**Acceptance criteria**
1. When "Shell Particles" mode is selected, particles appear scattered near the fractal surface
2. User sees a "Shell Thickness" slider (0.01 to 0.5, default 0.1) controlling how far from surface particles can appear
3. User sees a "Particle Density" slider (0.1 to 1.0, default 0.5) controlling how many particles are visible
4. User sees a "Particle Size" slider (1 to 10, default 3) controlling individual particle size in pixels
5. Particles are distributed using deterministic noise (same view = same particles)
6. Particles closer to the surface appear more opaque than those at shell edge
7. Particle colors are derived from the selected color algorithm in Colors tab
8. Double-click any slider to reset to default value

**Test scenarios**

Scenario 1: Enable Shell Particles mode
- Given the user has "Surface" mode selected
- When the user selects "Shell Particles" from the dropdown
- Then the fractal renders as a cloud of particles forming a shell
- And Shell Thickness, Particle Density, and Particle Size controls appear

Scenario 2: Adjust shell thickness
- Given the user is in Shell Particles mode with thickness at 0.1
- When the user increases Shell Thickness to 0.4
- Then particles appear in a thicker shell around the surface, creating a fuzzier appearance

Scenario 3: Thin shell
- Given the user is in Shell Particles mode
- When the user sets Shell Thickness to 0.01
- Then particles form a tight shell very close to the mathematical surface

Scenario 4: Adjust particle density
- Given the user is in Shell Particles mode with density at 0.5
- When the user increases Particle Density to 1.0
- Then more particles become visible, creating a denser cloud

Scenario 5: Low particle density
- Given the user is in Shell Particles mode
- When the user sets Particle Density to 0.1
- Then only sparse particles are visible, creating a sparse dust effect

Scenario 6: Adjust particle size
- Given the user is in Shell Particles mode with size at 3
- When the user increases Particle Size to 8
- Then individual particles appear larger in the viewport

Scenario 7: Deterministic particle positions
- Given the user is in Shell Particles mode viewing a specific angle
- When the user rotates away and returns to the same view
- Then particles appear in the same positions as before

Scenario 8: Particle color follows color algorithm
- Given the user has "Cosine Palette" color algorithm selected
- When the user enables Shell Particles mode
- Then particles are colored according to the cosine palette gradient

---

## User Story 4: Instanced Projection Mode

**User story:** As a user, I want to render the hyperbulb as particles precisely projected onto the surface so that I can visualize the fractal form with individual particles that could potentially animate or interact.

**Acceptance criteria**
1. When "Instanced Projection" mode is selected, particles are placed precisely on the fractal surface
2. User sees a "Particle Count" dropdown: 1K, 5K, 10K, 25K, 50K (default 10K)
3. User sees a "Particle Size" slider (1 to 10, default 2) controlling particle size in pixels
4. User sees an "Explosion Factor" slider (0.0 to 2.0, default 0.0) that displaces particles outward from surface
5. At Explosion Factor 0.0, particles sit exactly on the surface
6. At Explosion Factor > 0, particles move outward along surface normal, creating "exploded" view
7. Particles are distributed evenly across the visible surface area
8. Particles correctly project onto higher-dimensional fractal surfaces (4D-11D)

**Test scenarios**

Scenario 1: Enable Instanced Projection mode
- Given the user has "Surface" mode selected
- When the user selects "Instanced Projection" from the dropdown
- Then the fractal renders as particles covering the surface
- And Particle Count, Particle Size, and Explosion Factor controls appear

Scenario 2: Adjust particle count
- Given the user is in Instanced Projection mode with 10K particles
- When the user selects 50K from Particle Count dropdown
- Then the surface appears more densely covered with finer particles

Scenario 3: Low particle count
- Given the user is in Instanced Projection mode
- When the user selects 1K from Particle Count dropdown
- Then the surface is sparsely covered, showing individual particles clearly

Scenario 4: Zero explosion factor
- Given the user is in Instanced Projection mode with Explosion Factor at 0.0
- When the user views the fractal
- Then particles sit precisely on the fractal surface, forming a point-cloud representation

Scenario 5: Apply explosion factor
- Given the user is in Instanced Projection mode with Explosion Factor at 0.0
- When the user increases Explosion Factor to 1.0
- Then particles move outward from the surface along their normals, creating an "exploded" view

Scenario 6: Maximum explosion
- Given the user is in Instanced Projection mode
- When the user sets Explosion Factor to 2.0
- Then particles are significantly displaced from the surface, revealing the fractal structure as a dispersed cloud

Scenario 7: Explosion animation (if animated)
- Given the user increases Explosion Factor from 0.0 to 1.0
- When dragging the slider
- Then particles smoothly animate outward (not instant pop)

Scenario 8: High-dimensional projection
- Given the user is viewing an 8D hyperbulb in Instanced Projection mode
- When the user rotates through higher dimensions
- Then particles remain correctly projected onto the 3D slice of the 8D surface

---

## User Story 5: Particle Mode Lighting Integration

**User story:** As a user, I want particles to respond to lighting so that the particle visualization maintains visual consistency with other render modes.

**Acceptance criteria**
1. In Shell Particles mode, particles are shaded based on their position relative to lights
2. In Instanced Projection mode, particles are shaded based on surface normal at their location
3. Ambient light affects particle base brightness
4. Point/directional/spot lights create shading variation across particle field
5. Specular highlights appear on particles (subtle, based on particle size)
6. Light color affects particle tint
7. When all lights are disabled, particles are rendered with flat coloring (no shading)
8. Shadow toggle does NOT affect particles (particles don't cast/receive shadows for performance)

**Test scenarios**

Scenario 1: Point light shading on Shell Particles
- Given the user is in Shell Particles mode with one point light
- When the user positions the light to one side
- Then particles on the lit side appear brighter than those on the dark side

Scenario 2: Directional light on Instanced Projection
- Given the user is in Instanced Projection mode with a directional light
- When the user adjusts light direction
- Then particles shade according to their surface normal relative to light direction

Scenario 3: No lights = flat shading
- Given the user disables all lights
- When viewing particles in either particle mode
- Then particles appear with uniform brightness (flat color, no shading)

Scenario 4: Colored light tinting
- Given the user has a red point light enabled
- When viewing Shell Particles mode
- Then particles on the lit side take on a red tint

Scenario 5: Shadows don't affect particles
- Given shadows are enabled
- When the user switches to Shell Particles mode
- Then no shadows appear (particles have flat shading from lights only)

---

## User Story 6: Particle Mode Performance Scaling

**User story:** As a user, I want particle modes to automatically adjust quality during interaction so that the application remains responsive.

**Acceptance criteria**
1. During camera rotation/zoom, particle count is temporarily reduced
2. Particle size increases slightly during interaction to compensate for reduced count
3. When interaction stops, full particle count is restored after 150ms delay
4. User sees smooth transition between interaction and static quality
5. In Instanced Projection mode, higher dimension (8D+) automatically suggests lower particle count
6. Performance warning appears when selecting 50K particles on a 9D+ fractal

**Test scenarios**

Scenario 1: Particles reduce during rotation
- Given the user is in Instanced Projection mode with 50K particles
- When the user starts rotating the fractal
- Then particle count visibly reduces and frame rate remains smooth

Scenario 2: Particles restore after interaction
- Given the user was rotating (reduced particles)
- When the user stops rotating and waits 150ms
- Then particle count gradually restores to selected value

Scenario 3: High-dimension warning
- Given the user is viewing a 10D hyperbulb
- When the user selects 50K particles in Instanced Projection mode
- Then a warning appears: "High particle count may reduce performance in higher dimensions"

Scenario 4: Dimension-based suggestion
- Given the user switches to 11D with 50K particles selected
- When the mode loads
- Then a suggestion appears: "Consider reducing particle count for better performance"

---

## User Story 7: Particle Mode URL Serialization

**User story:** As a user, I want my particle mode settings to be saved in the share URL so that I can share my exact visualization configuration with others.

**Acceptance criteria**
1. Render style is encoded in the share URL when not default (Surface)
2. Shell Particles settings (thickness, density, size) are encoded when in that mode
3. Instanced Projection settings (count, size, explosion) are encoded when in that mode
4. Loading a URL with particle settings applies them immediately
5. Invalid or missing parameters default to Surface mode
6. URL parameters use compact encoding to minimize URL length

**Test scenarios**

Scenario 1: Share URL with Shell Particles mode
- Given the user has Shell Particles mode with thickness 0.2, density 0.8, size 5
- When the user copies the share URL and opens it in a new tab
- Then Shell Particles mode is active with the same settings

Scenario 2: Share URL with Instanced Projection mode
- Given the user has Instanced Projection mode with 25K particles, explosion 0.5
- When the URL is loaded in a new browser
- Then the same instanced projection settings are applied

Scenario 3: Invalid URL parameter
- Given a URL contains an invalid render style value
- When the user loads the URL
- Then Surface mode is applied as fallback

---

## Specification Summary

**Feature**: Hyperbulb Particle Rendering Modes
**User Stories (Jira Tickets)**: 7
**Acceptance Criteria**: 55
**Test Scenarios**: 36

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Render Mode Selection | User | ~1 day | None |
| 2 | Surface Mode | User | ~0.5 days | Story 1 |
| 3 | Shell Particles Mode | User | ~2 days | Story 1 |
| 4 | Instanced Projection Mode | User | ~2 days | Story 1 |
| 5 | Particle Lighting Integration | User | ~1 day | Stories 3, 4 |
| 6 | Performance Scaling | System | ~1 day | Stories 3, 4 |
| 7 | URL Serialization | User | ~0.5 days | Stories 1-4 |

### Coverage
- Happy paths: 18
- Error handling: 2
- Edge cases: 6
- Performance: 6
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should particle animation (e.g., subtle drift, turbulence) be a future addition?
- Should particles support custom shapes (sprites) in a future version?
- For Instanced Projection, should particles have optional velocity for physics-based effects?

### Dependencies Between Stories
- Stories 2-4 depend on Story 1 (mode selection infrastructure)
- Story 5 depends on Stories 3 and 4 (lighting applies to particle modes)
- Story 6 depends on Stories 3 and 4 (performance for particle modes)
- Story 7 depends on Stories 1-4 (must serialize all mode settings)

### Ready for Development: YES
