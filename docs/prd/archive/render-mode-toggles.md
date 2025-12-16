# Render Mode Toggles

## Overview

This feature replaces the current shader selection system with three simple toggle buttons at the top of the sidebar: **Vertices**, **Edges**, and **Faces**. These toggles provide direct control over what geometry elements are rendered, simplifying the user experience and removing the need for explicit shader selection.

---

## Specification Summary

**Feature**: Render Mode Toggles
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 34
**Test Scenarios**: 24

### Stories Overview

| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Toggle Button Row Display | User | ~1 day | None |
| 2 | Vertices Toggle Behavior | User | ~1 day | Story 1 |
| 3 | Edges Toggle Behavior | User | ~1 day | Story 1 |
| 4 | Faces Toggle Behavior | User | ~2 days | Story 1 |
| 5 | Object Compatibility for Faces | System | ~1 day | Story 4 |
| 6 | Remove Obsolete Components | Developer | ~1 day | Stories 1-5 |

### Coverage

- Happy paths: 8
- Error handling: 2
- Edge cases: 8
- Permission/access: 0
- System behavior: 6

### Placeholders Requiring Confirmation

- None

### Open Questions

- None

### Dependencies Between Stories

- Stories 2, 3, 4 depend on Story 1 (toggle button row must exist)
- Story 5 depends on Story 4 (faces toggle must exist before disabling it)
- Story 6 depends on Stories 1-5 (all new functionality must work before removing old)

### Ready for Development: YES

---

## User Story 1: Toggle Button Row Display

**User story:** As a user, I want to see a row of three toggle buttons at the top of the sidebar so that I can quickly control what geometry elements are rendered.

**Acceptance criteria**

1. A row containing three toggle buttons appears at the top of the sidebar, above all collapsible sections
2. The three buttons are labeled "Vertices", "Edges", and "Faces" in that order from left to right
3. Each button has two visual states: active (on) and inactive (off)
4. Active buttons are visually distinct from inactive buttons (e.g., highlighted/filled vs. outlined)
5. The button row remains visible and fixed at the top when scrolling the sidebar content
6. The button row spans the full width of the sidebar with equal spacing between buttons
7. Default state on application load: Vertices ON, Edges ON, Faces OFF

**Test scenarios**

Scenario 1: Initial display of toggle buttons
- Given the user opens the application
- When the sidebar is visible
- Then the user sees a row of three toggle buttons labeled "Vertices", "Edges", "Faces" at the top of the sidebar

Scenario 2: Default toggle states on load
- Given the user opens the application for the first time (no saved state)
- When the sidebar is visible
- Then "Vertices" and "Edges" buttons appear active, and "Faces" button appears inactive

Scenario 3: Toggle row remains visible when scrolling
- Given the user has expanded multiple sidebar sections causing overflow
- When the user scrolls down within the sidebar
- Then the toggle button row remains fixed at the top and visible

Scenario 4: Toggle button interaction
- Given the user sees the toggle button row
- When the user clicks on any toggle button
- Then the button's visual state changes (active becomes inactive, or vice versa)

---

## User Story 2: Vertices Toggle Behavior

**User story:** As a user, I want to toggle vertex visibility using the Vertices button so that I can show or hide vertices on all rendered objects.

**Acceptance criteria**

1. When "Vertices" is active (ON), vertices are rendered for all objects that have vertices
2. When "Vertices" is inactive (OFF), no vertices are rendered for any object
3. Clicking the "Vertices" button toggles between ON and OFF states
4. The toggle state applies immediately without requiring any additional action
5. The toggle state persists when switching between different object types
6. Vertex-related settings (vertex size, vertex color) remain available in Visual controls regardless of toggle state

**Test scenarios**

Scenario 1: Enable vertices
- Given "Vertices" toggle is OFF and a hypercube is displayed
- When the user clicks the "Vertices" button
- Then vertices appear at each corner of the hypercube

Scenario 2: Disable vertices
- Given "Vertices" toggle is ON and vertices are visible on a simplex
- When the user clicks the "Vertices" button
- Then all vertices disappear from the simplex

Scenario 3: Vertices toggle persists across object changes
- Given "Vertices" toggle is OFF on a hypercube
- When the user switches to a cross-polytope
- Then the cross-polytope renders without vertices

Scenario 4: Vertices toggle works for extended objects
- Given "Vertices" toggle is ON and a hypersphere (point cloud) is displayed
- When the user toggles "Vertices" OFF
- Then the hypersphere points disappear (as they are rendered as vertices)

---

## User Story 3: Edges Toggle Behavior

**User story:** As a user, I want to toggle edge visibility using the Edges button so that I can show or hide edges/wireframe on all rendered objects.

**Acceptance criteria**

1. When "Edges" is active (ON), edges are rendered for all objects that have edges
2. When "Edges" is inactive (OFF), no edges are rendered for any object
3. Clicking the "Edges" button toggles between ON and OFF states
4. The toggle state applies immediately without requiring any additional action
5. The toggle state persists when switching between different object types
6. Edge-related settings (edge thickness, edge color) remain available in Visual controls regardless of toggle state
7. The "Edges" toggle controls the wireframe/mesh overlay for all shaders

**Test scenarios**

Scenario 1: Enable edges
- Given "Edges" toggle is OFF and a hypercube is displayed with faces visible
- When the user clicks the "Edges" button
- Then wireframe edges appear along all edges of the hypercube

Scenario 2: Disable edges
- Given "Edges" toggle is ON and edges are visible on a simplex
- When the user clicks the "Edges" button
- Then all edges disappear from the simplex

Scenario 3: Edges toggle persists across object changes
- Given "Edges" toggle is OFF on a hypercube
- When the user switches to a clifford torus
- Then the clifford torus renders without edges

Scenario 4: Edges combined with faces
- Given "Edges" is ON and "Faces" is ON
- When viewing a cross-polytope
- Then both the filled faces and wireframe edges are visible simultaneously

---

## User Story 4: Faces Toggle Behavior

**User story:** As a user, I want to toggle face rendering using the Faces button so that I can switch between wireframe and surface rendering modes automatically.

**Acceptance criteria**

1. When "Faces" is active (ON), filled faces are rendered for compatible objects
2. When "Faces" is inactive (OFF), no filled faces are rendered
3. Clicking the "Faces" button toggles between ON and OFF states
4. When "Faces" is toggled ON, the system automatically uses surface rendering (equivalent to selecting Surface shader)
5. When "Faces" is toggled OFF, the system automatically uses wireframe rendering (equivalent to selecting Wireframe shader)
6. Face-related settings (face opacity, face color) remain available in Visual controls when "Faces" is ON
7. Face-related settings are hidden or disabled in Visual controls when "Faces" is OFF
8. The toggle state persists when switching between compatible object types

**Test scenarios**

Scenario 1: Enable faces
- Given "Faces" toggle is OFF and a hypercube displays as wireframe only
- When the user clicks the "Faces" button
- Then the hypercube renders with filled, shaded faces

Scenario 2: Disable faces
- Given "Faces" toggle is ON and a simplex has filled faces visible
- When the user clicks the "Faces" button
- Then the simplex renders as wireframe only (faces disappear)

Scenario 3: Face settings visibility when faces ON
- Given "Faces" toggle is ON
- When the user opens Visual controls
- Then face opacity and face color settings are visible and adjustable

Scenario 4: Face settings visibility when faces OFF
- Given "Faces" toggle is OFF
- When the user opens Visual controls
- Then face opacity and face color settings are hidden or disabled

Scenario 5: Faces toggle persists across object changes
- Given "Faces" toggle is ON with a hypercube showing surfaces
- When the user switches to a simplex
- Then the simplex also renders with filled faces

---

## User Story 5: Object Compatibility for Faces Toggle

**User story:** As the system, I want to disable the Faces toggle for objects that cannot render faces so that users understand which objects support surface rendering.

**Acceptance criteria**

1. The "Faces" toggle button is disabled (greyed out, non-clickable) when the current object does not support face rendering
2. Objects that support face rendering: Hypercube, Simplex, Cross-Polytope, Root System
3. Objects that do NOT support face rendering: Hypersphere, Clifford Torus, Mandelbulb Set
4. When switching to an incompatible object while "Faces" is ON, the "Faces" toggle automatically turns OFF
5. When switching back to a compatible object, the "Faces" toggle remains in its last manual state for compatible objects
6. A tooltip or visual indicator explains why the "Faces" button is disabled (e.g., "Faces not available for this object type")

**Test scenarios**

Scenario 1: Faces toggle disabled for hypersphere
- Given the user is viewing a hypercube with "Faces" available
- When the user switches to a hypersphere
- Then the "Faces" toggle button becomes disabled and appears greyed out

Scenario 2: Faces auto-off when switching to incompatible object
- Given "Faces" is ON while viewing a hypercube
- When the user switches to a clifford torus
- Then "Faces" automatically turns OFF and the button becomes disabled

Scenario 3: Faces toggle enabled for compatible objects
- Given the user is viewing a hypersphere (Faces disabled)
- When the user switches to a cross-polytope
- Then the "Faces" toggle button becomes enabled and clickable

Scenario 4: Tooltip on disabled faces button
- Given the user is viewing a mandelbulb set
- When the user hovers over the disabled "Faces" button
- Then a tooltip displays "Faces not available for this object type"

Scenario 5: Faces state restoration when returning to compatible object
- Given the user had "Faces" ON for a hypercube, then switched to hypersphere (Faces auto-OFF)
- When the user switches back to hypercube
- Then "Faces" restores to ON state

---

## User Story 6: Remove Obsolete Components

**User story:** As a developer, I want obsolete shader selection components removed from the codebase so that the UI is simplified and the codebase remains maintainable.

**Acceptance criteria**

1. The ShaderSelector component is removed from the sidebar
2. The Dual Outline (Double Line) shader option is removed from the codebase
3. All Dual Outline shader settings (inner color, outer color, line gap) are removed from Visual controls
4. The DualOutlineMaterial is removed from the shaders directory
5. The shaderType state in visualStore no longer includes 'dualOutline' as an option
6. Any UI elements that were specifically for selecting between wireframe/dualOutline/surface shaders are removed
7. Visual controls section is simplified to only show settings relevant to current toggle states
8. No console errors or warnings related to removed components appear in the application

**Test scenarios**

Scenario 1: ShaderSelector not present in sidebar
- Given the user opens the application
- When the user expands the Visual section in the sidebar
- Then there is no shader selection UI (no buttons/dropdown to choose wireframe/dual outline/surface)

Scenario 2: Dual Outline settings removed
- Given the user opens the application
- When the user explores all Visual control settings
- Then there are no settings for "inner color", "outer color", or "line gap" related to dual outline

Scenario 3: Application loads without shader-related errors
- Given the Dual Outline shader has been removed
- When the user loads the application
- Then no console errors appear related to missing shaders or undefined shader types

Scenario 4: URL state handling for legacy shader values
- Given a user has a saved URL with shaderType=dualOutline from before this change
- When the user loads that URL
- Then the application gracefully defaults to wireframe mode without errors

---

## Technical Notes (For Implementation Reference)

### Objects and Face Support

| Object Type | Vertices | Edges | Faces | Notes |
|-------------|----------|-------|-------|-------|
| Hypercube | Yes | Yes | Yes | Full polytope support |
| Simplex | Yes | Yes | Yes | Full polytope support |
| Cross-Polytope | Yes | Yes | Yes | Full polytope support |
| Root System | Yes | Yes | Yes | Root polytopes have faces |
| Hypersphere | Yes | No natural edges | No | Point cloud sampling |
| Clifford Torus | Yes | Yes | No | Parametric surface as wireframe |
| Mandelbulb Set | Yes | No | No | Fractal point cloud |

### State Changes Summary

**New State:**
- `verticesVisible`: boolean (default: true)
- `edgesVisible`: boolean (default: true)
- `facesVisible`: boolean (default: false)

**Removed State:**
- `shaderType`: 'wireframe' | 'dualOutline' | 'surface' (replaced by facesVisible)
- All dualOutline-specific settings

**Derived Behavior:**
- When `facesVisible` is true → render with surface material
- When `facesVisible` is false → render with wireframe material only
