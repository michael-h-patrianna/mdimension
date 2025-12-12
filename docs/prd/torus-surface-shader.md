# Torus Surface Shader Support

## User Story 1: Enable Surface Rendering for Clifford Torus

**User story:** As a user, I want to render the Clifford Torus as a filled surface so that I can visualize it as a solid 3D shape rather than just a wireframe.

**Acceptance criteria**

1. When Clifford Torus is selected as the object type, the "Faces" toggle button in the sidebar is enabled (clickable)
2. Clicking the "Faces" toggle when Clifford Torus is selected turns surface rendering on
3. When Faces is ON, the torus displays as a filled, continuous surface covering the entire donut shape
4. The surface is rendered as a triangulated mesh (smooth appearance, no gaps)
5. The surface wraps seamlessly around both the major circle (around the donut) and minor circle (around the tube) with no visible seams or holes at the connection points
6. The torus surface respects the existing "Surface Color" setting in the sidebar
7. The torus surface respects the existing "Opacity" slider setting
8. The torus surface respects the existing "Lighting" toggle (when enabled, surface shows shading based on light direction)
9. When Faces is OFF (but was previously ON), the surface disappears and only vertices/edges remain visible (based on their toggle states)
10. User can have Vertices, Edges, and Faces all visible simultaneously for the torus
11. User can have only Faces visible (Vertices OFF, Edges OFF, Faces ON) showing a clean solid surface
12. At least one render mode must always be active - if user tries to turn off the last active mode, it remains on

**Test scenarios**

Scenario 1: Enable faces for Clifford Torus
- Given the user has selected Clifford Torus as the object type
- When the user clicks the "Faces" toggle button
- Then the torus renders as a filled surface and the Faces toggle shows as active/pressed

Scenario 2: Faces toggle is enabled for Clifford Torus
- Given the user is viewing the render mode toggles in the sidebar
- When the user selects Clifford Torus from the object dropdown
- Then the "Faces" toggle button is enabled (not grayed out, clickable)

Scenario 3: Surface color applies to torus
- Given the user has Clifford Torus selected with Faces enabled
- When the user changes the Surface Color setting to red
- Then the torus surface displays in red

Scenario 4: Opacity applies to torus surface
- Given the user has Clifford Torus selected with Faces enabled
- When the user adjusts the Opacity slider to 50%
- Then the torus surface appears semi-transparent

Scenario 5: Lighting applies to torus surface
- Given the user has Clifford Torus selected with Faces enabled
- When the user enables the Lighting toggle
- Then the torus surface shows realistic shading with highlights and shadows based on surface curvature

Scenario 6: Disable faces returns to wireframe
- Given the user has Clifford Torus with Faces enabled showing a solid surface
- When the user clicks the "Faces" toggle to turn it off
- Then the solid surface disappears and only the wireframe (edges) and/or vertices remain visible

Scenario 7: All render modes combined
- Given the user has Clifford Torus selected
- When the user enables Vertices, Edges, and Faces simultaneously
- Then the torus shows vertex points, edge lines, and filled surface all at once

Scenario 8: Faces-only mode shows clean surface
- Given the user has Clifford Torus selected with Faces enabled
- When the user disables Vertices and Edges (leaving only Faces on)
- Then the torus displays as a clean solid surface without visible points or wireframe lines

Scenario 9: Surface has no seams at wrap-around points
- Given the user has Clifford Torus with Faces enabled
- When the user rotates the view to inspect the entire surface
- Then the surface appears continuous with no gaps or visible seams where the torus wraps around to meet itself

Scenario 10: Switching from incompatible object to torus
- Given the user had previously enabled Faces for a hypercube
- When the user switches to Hypersphere (faces not supported) and then to Clifford Torus
- Then the Faces toggle is enabled for Clifford Torus (regardless of the intervening hypersphere selection)

---

## User Story 2: Surface Resolution Matches Geometry Resolution

**User story:** As a user, I want the torus surface detail to match my resolution settings so that higher resolution produces smoother surfaces.

**Acceptance criteria**

1. The surface mesh resolution is determined by the existing Resolution U and Resolution V settings
2. Higher Resolution U produces more triangles around the major circle (the donut's outer path)
3. Higher Resolution V produces more triangles around the minor circle (the tube's cross-section)
4. Low resolution (e.g., U=8, V=8) produces a visibly faceted surface
5. High resolution (e.g., U=64, V=64) produces a smooth, round surface
6. Changing resolution while Faces is enabled updates the surface smoothness in real-time
7. The number of surface triangles equals approximately 2 x Resolution U x Resolution V (two triangles per grid cell)

**Test scenarios**

Scenario 1: Low resolution shows faceted surface
- Given the user has Clifford Torus with Faces enabled
- When Resolution U and Resolution V are both set to 8
- Then the torus surface appears noticeably angular/faceted (like a low-poly 3D model)

Scenario 2: High resolution shows smooth surface
- Given the user has Clifford Torus with Faces enabled
- When Resolution U and Resolution V are both set to 64
- Then the torus surface appears smooth and round

Scenario 3: Changing resolution updates surface
- Given the user has Clifford Torus with Faces enabled at low resolution
- When the user increases Resolution U from 8 to 32
- Then the surface immediately becomes smoother around the major circle direction

Scenario 4: Resolution V affects tube smoothness
- Given the user has Clifford Torus with Faces enabled
- When the user increases Resolution V while keeping Resolution U constant
- Then the tube cross-section becomes rounder (smoother around the tube)

---

## Specification Summary

**Feature**: Torus Surface Shader Support
**User Stories (Jira Tickets)**: 2
**Acceptance Criteria**: 19
**Test Scenarios**: 14

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Surface Rendering for Clifford Torus | User | ~1.5 days | None |
| 2 | Surface Resolution Matches Geometry Resolution | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 6
- Render mode combinations: 4
- Visual settings integration: 4
- Edge cases (seams, switching): 2
- Resolution behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- None (all behavior confirmed via codebase analysis)

### Dependencies Between Stories
- Story 2 depends on Story 1 (surface must exist before resolution affects it)

### Ready for Development: YES
