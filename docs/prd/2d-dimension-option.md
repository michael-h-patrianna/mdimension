# 2D Dimension Option

## Overview

Add a 2D dimension option to the visualizer, displayed as the first option in the dimension selector. 2D objects are projected onto the X-Z plane at Y=0, allowing users to view classic 2-dimensional representations of geometric objects.

---

## Specification Summary

**Feature**: 2D Dimension Option
**User Stories (Jira Tickets)**: 4
**Acceptance Criteria**: 24
**Test Scenarios**: 20

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | 2D Dimension Selection | User | ~1 day | None |
| 2 | 2D Geometry Generation | System | ~2 days | Story 1 |
| 3 | 2D Projection Rendering | System | ~1 day | Story 2 |
| 4 | Geometry Type Availability for 2D | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 8
- Error handling: 3
- Edge cases: 5
- Permission/access: 0
- System behavior: 4

### Dependencies Between Stories
- Story 2 and 3 depend on Story 1 (dimension option must exist)
- Story 4 depends on Story 1 (must be able to select 2D)

### Ready for Development: YES

---

## User Story 1: 2D Dimension Selection

**User story:** As a user, I want to select "2D" as a dimension option so that I can view 2-dimensional representations of geometric objects.

**Acceptance criteria**
1. The dimension selector displays "2D" as the first option, before "3D"
2. The dimension selector shows options in order: 2D, 3D, 4D, 5D, 6D, 7D, 8D, 9D, 10D, 11D
3. Clicking "2D" selects 2D as the current dimension
4. When 2D is selected, the dimension indicator shows "2D" as active
5. When 2D is selected, the rotation plane count displays "1" (since 2D has 1 rotation plane: X-Z)
6. The "2D" button has the same styling and behavior as other dimension buttons
7. Keyboard navigation includes the 2D option in the tab order

**Test scenarios**

Scenario 1: Select 2D dimension
- Given the user is viewing the dimension selector
- When the user clicks the "2D" button
- Then the "2D" button appears selected and the geometry updates to 2D

Scenario 2: 2D appears first in selector
- Given the user opens the application
- When the dimension selector loads
- Then "2D" appears as the leftmost option in the dimension selector

Scenario 3: Rotation plane count for 2D
- Given the user has selected 2D dimension
- When the user views the rotation plane indicator
- Then the count displays "1" rotation plane

Scenario 4: Keyboard navigation includes 2D
- Given the user has focused the dimension selector
- When the user presses Tab or Arrow keys to navigate
- Then the 2D option is included in the navigation order

---

## User Story 2: 2D Geometry Generation

**User story:** As the system, I want to generate correct 2D geometry for each supported object type so that users see mathematically accurate 2-dimensional shapes.

**Acceptance criteria**
1. **Hypercube (2D)**: System generates a square with 4 vertices at positions (±1, ±1) and 4 edges connecting adjacent vertices
2. **Hypersphere (2D)**: System generates a circle with points sampled around the circumference at the specified sample count
3. **Clifford Torus (2D)**: System generates an annulus (ring) with points sampled between inner radius and outer radius
4. **Mandelbrot (2D)**: System generates the classic 2D Mandelbrot set on the complex plane using the standard escape-time algorithm
5. **Simplex (2D)**: System generates an equilateral triangle with 3 vertices and 3 edges
6. **Cross-Polytope (2D)**: System generates a diamond shape (square rotated 45°) with 4 vertices at (±1, 0) and (0, ±1) and 4 edges
7. All 2D vertices are represented as 2-element arrays [x, z] internally before projection
8. Edge connectivity for 2D shapes follows the same indexing pattern as higher-dimensional equivalents

**Test scenarios**

Scenario 1: Generate 2D hypercube (square)
- Given 2D dimension is selected with Hypercube object type
- When the system generates geometry
- Then the geometry contains exactly 4 vertices at (1,1), (1,-1), (-1,1), (-1,-1) and 4 edges forming a square

Scenario 2: Generate 2D hypersphere (circle)
- Given 2D dimension is selected with Hypersphere object type and sample count of 100
- When the system generates geometry
- Then the geometry contains 100 points evenly distributed around a circle of radius 1

Scenario 3: Generate 2D Clifford torus (annulus)
- Given 2D dimension is selected with Clifford Torus object type
- When the system generates geometry
- Then the geometry contains points distributed in a ring shape between inner and outer radii

Scenario 4: Generate 2D Mandelbrot set
- Given 2D dimension is selected with Mandelbrot object type
- When the system generates geometry
- Then the geometry contains points representing the classic 2D Mandelbrot fractal boundary on the complex plane

Scenario 5: Generate 2D simplex (triangle)
- Given 2D dimension is selected with Simplex object type
- When the system generates geometry
- Then the geometry contains exactly 3 vertices forming an equilateral triangle and 3 edges

Scenario 6: Generate 2D cross-polytope (diamond)
- Given 2D dimension is selected with Cross-Polytope object type
- When the system generates geometry
- Then the geometry contains exactly 4 vertices at (1,0), (-1,0), (0,1), (0,-1) and 4 edges forming a diamond

---

## User Story 3: 2D Projection Rendering

**User story:** As the system, I want to project 2D geometry onto the X-Z plane at Y=0 so that 2D objects render correctly in the 3D viewport.

**Acceptance criteria**
1. 2D geometry is projected onto the X-Z plane with Y coordinate fixed at 0
2. A 2D point [x, z] renders at 3D position (x, 0, z) in the viewport
3. The camera view remains functional for 2D objects (orbit, zoom, pan work correctly)
4. 2D objects appear flat when viewed from the side (along X or Z axis)
5. 2D objects appear in full view when viewed from above (along Y axis)
6. Both perspective and orthographic projection modes work with 2D geometry
7. The projection distance slider has no visible effect on 2D objects (since there are no higher dimensions to project from)

**Test scenarios**

Scenario 1: 2D projection maps to X-Z plane
- Given 2D dimension is selected
- When a 2D point [1.0, 0.5] is rendered
- Then the point appears at 3D position (1.0, 0.0, 0.5) in the viewport

Scenario 2: Camera orbit works with 2D objects
- Given 2D dimension is selected and a 2D object is displayed
- When the user orbits the camera around the object
- Then the object rotates in view correctly and appears flat from side angles

Scenario 3: Zoom works with 2D objects
- Given 2D dimension is selected and a 2D object is displayed
- When the user zooms in or out
- Then the object scales correctly in the viewport

Scenario 4: View from above shows full 2D shape
- Given 2D dimension is selected and a square (2D hypercube) is displayed
- When the camera is positioned directly above (looking down Y axis)
- Then the square is visible with all 4 vertices and 4 edges clearly displayed

---

## User Story 4: Geometry Type Availability for 2D

**User story:** As a user, I want geometry types that don't have meaningful 2D equivalents to be disabled when 2D is selected so that I only see valid options.

**Acceptance criteria**
1. When 2D is selected, the following object types are enabled: Hypercube, Hypersphere, Clifford Torus, Mandelbrot, Simplex, Cross-Polytope
2. When 2D is selected, the Root System object type is disabled
3. Disabled object types appear visually grayed out in the object type selector
4. Disabled object types cannot be clicked or selected
5. Hovering over a disabled object type shows a tooltip: "Not available in 2D"
6. If a user has Root System selected and switches to 2D, the system automatically switches to Hypercube
7. When switching from 2D to 3D or higher, all object types become enabled again

**Test scenarios**

Scenario 1: Root System disabled in 2D
- Given 2D dimension is selected
- When the user views the object type selector
- Then the Root System option appears disabled and cannot be selected

Scenario 2: Supported types enabled in 2D
- Given 2D dimension is selected
- When the user views the object type selector
- Then Hypercube, Hypersphere, Clifford Torus, Mandelbrot, Simplex, and Cross-Polytope are all enabled

Scenario 3: Auto-switch from disabled type when selecting 2D
- Given the user has Root System selected with 4D dimension
- When the user selects 2D dimension
- Then the object type automatically switches to Hypercube

Scenario 4: Tooltip on disabled type
- Given 2D dimension is selected
- When the user hovers over the disabled Root System option
- Then a tooltip displays "Not available in 2D"

Scenario 5: All types enabled when leaving 2D
- Given the user is viewing in 2D with some types disabled
- When the user selects 3D dimension
- Then all object types become enabled again

Scenario 6: Clifford Torus remains available in 2D
- Given 2D dimension is selected
- When the user views the object type selector
- Then Clifford Torus is enabled (renders as annulus in 2D)

---

## Technical Notes (For Implementation Reference)

### 2D Geometry Specifications

| Object Type | 2D Name | Vertices | Edges | Description |
|-------------|---------|----------|-------|-------------|
| Hypercube | Square | 4 | 4 | Unit square with corners at (±1, ±1) |
| Simplex | Triangle | 3 | 3 | Equilateral triangle |
| Cross-Polytope | Diamond | 4 | 4 | Square rotated 45°, vertices at (±1, 0), (0, ±1) |
| Hypersphere | Circle | n (sampled) | n | Points on circumference, radius = 1 |
| Clifford Torus | Annulus | n (sampled) | n×2 | Ring between inner and outer circles |
| Mandelbrot | Mandelbrot | n (sampled) | optional grid | Classic 2D fractal on complex plane |
| Root System | N/A | - | - | Disabled in 2D |

### Projection Mapping

2D coordinates [x, z] map to 3D coordinates (x, 0, z):
- First 2D coordinate → X axis
- Second 2D coordinate → Z axis
- Y axis fixed at 0

### Dimension Constant Update

Current: `MIN_DIMENSION = 3`
Required: `MIN_DIMENSION = 2`

### Object Type Constraints by Dimension

| Dimension | Disabled Types |
|-----------|----------------|
| 2D | Root System |
| 3D | None |
| 4D+ | None |

Note: Clifford Torus currently requires 4D minimum but will render as annulus in 2D as a special case.
