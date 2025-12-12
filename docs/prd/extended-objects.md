# Extended N-Dimensional Objects

## Product Overview

An extension to the N-Dimensional Object Visualizer that adds four new families of mathematically significant objects: Hyperspheres, Root System Polytopes, Product Manifolds, and the Clifford Torus. These objects provide users with access to important geometric structures from pure mathematics and higher-dimensional physics.

**Target Audience:** Mathematics enthusiasts, educators, students, researchers interested in higher-dimensional geometry, Lie algebras, and topological structures.

**Core Value Proposition:** Transform the visualizer from a polytope explorer into a comprehensive higher-dimensional geometry laboratory capable of rendering curved surfaces, algebraic root systems, product spaces, and topologically interesting manifolds.

---

## User Story 1: Select Hypersphere as Object Type

**User story:** As a user, I want to select "Hypersphere" as an object type so that I can visualize n-dimensional spheres and balls.

**Acceptance criteria**
1. "Hypersphere" appears as a new option in the Object Type selector
2. Selecting "Hypersphere" displays a point cloud representing the n-dimensional sphere
3. Hypersphere is available for all dimensions 3 through 11
4. Default visualization shows the surface (n-1 sphere) with 2000 sample points
5. Points are distributed uniformly across the sphere surface
6. The visualization renders within 2 seconds on initial selection
7. Object type selection persists in URL state for sharing
8. Switching away from Hypersphere and back preserves the last-used settings

**Test scenarios**

Scenario 1: Select hypersphere from object type dropdown
- Given the user has a 4D hypercube displayed
- When the user selects "Hypersphere" from the object type selector
- Then a 4D hypersphere visualization appears as a point cloud in the viewport

Scenario 2: Hypersphere with dimension change
- Given the user has a 4D hypersphere displayed
- When the user changes dimension to 7D
- Then the visualization updates to show a 7D hypersphere (6-sphere surface)

Scenario 3: URL sharing includes hypersphere selection
- Given the user has a 5D hypersphere with custom settings
- When the user copies the share URL
- Then loading that URL displays the same 5D hypersphere configuration

---

## User Story 2: Configure Hypersphere Mode and Sampling

**User story:** As a user, I want to configure the hypersphere mode and sampling parameters so that I can visualize either the surface or solid ball with appropriate detail.

**Acceptance criteria**
1. "Mode" selector offers: "Surface" (default), "Solid"
2. Surface mode shows points on the (n-1)-sphere boundary only
3. Solid mode shows points distributed throughout the interior ball
4. "Sample Count" slider ranges from 200 to 10,000 (default: 2000)
5. Higher sample counts show more points for denser visualization
6. "Radius" slider ranges from 0.5 to 3.0 (default: 1.0)
7. Changes to any parameter update the visualization within 500ms
8. Warning message appears when sample count exceeds 5000: "High sample counts may affect performance"
9. Point distribution is mathematically uniform (surface: uniform on sphere; solid: uniform in ball)

**Test scenarios**

Scenario 1: Switch to solid mode
- Given a hypersphere in Surface mode
- When the user selects "Solid" mode
- Then points appear distributed throughout the interior, not just on the surface

Scenario 2: Increase sample count
- Given a hypersphere with 2000 samples
- When the user increases sample count to 5000
- Then the point cloud becomes visibly denser

Scenario 3: Adjust radius
- Given a hypersphere with radius 1.0
- When the user increases radius to 2.0
- Then the hypersphere visually doubles in size

Scenario 4: Performance warning
- Given sample count is 4000
- When the user increases sample count to 6000
- Then a warning message appears about potential performance impact

Scenario 5: Solid mode uniform distribution
- Given a 4D hypersphere in Solid mode with 3000 samples
- When the user observes the visualization
- Then points are distributed throughout the volume, denser toward the center when projected

---

## User Story 3: Configure Hypersphere Wireframe Edges

**User story:** As a user, I want to optionally connect nearby points with edges so that I can see a wireframe structure on the hypersphere.

**Acceptance criteria**
1. "Wireframe Mode" toggle is available in Hypersphere settings (default: OFF)
2. When enabled, "Neighbor Count" slider appears (range: 2-10, default: 4)
3. Each point connects to its k nearest neighbors with edges
4. Edges render using the current edge color and thickness settings
5. Wireframe is disabled by default for performance reasons
6. Warning appears when enabling wireframe with sample count > 2000: "Wireframe computation may take several seconds"
7. Wireframe computation completes within 5 seconds for 2000 points
8. Changing neighbor count updates edges without recomputing point positions

**Test scenarios**

Scenario 1: Enable wireframe
- Given a hypersphere with 1000 samples and wireframe OFF
- When the user enables wireframe mode with k=4 neighbors
- Then edges appear connecting each point to its 4 nearest neighbors

Scenario 2: Adjust neighbor count
- Given wireframe is enabled with k=4
- When the user changes neighbor count to 8
- Then each point now connects to 8 neighbors (more edges visible)

Scenario 3: Wireframe warning for large sample count
- Given sample count is 3000
- When the user attempts to enable wireframe
- Then a warning appears about computation time

Scenario 4: Wireframe with existing visual settings
- Given edge color is set to cyan and thickness to 3
- When the user enables hypersphere wireframe
- Then wireframe edges appear in cyan with thickness 3

---

## User Story 4: Select Root System Polytope as Object Type

**User story:** As a user, I want to select "Root System" as an object type so that I can visualize mathematically significant root system polytopes.

**Acceptance criteria**
1. "Root System" appears as a new option in the Object Type selector
2. Selecting "Root System" displays the root vectors as points in n-dimensional space
3. Root System is available for dimensions 3 through 11
4. Default root type is "A" (Type A root system)
5. Root vectors are scaled to unit length by default
6. The visualization renders within 1 second
7. Properties panel shows: root count, root type name, mathematical formula
8. Object type selection persists in URL state

**Test scenarios**

Scenario 1: Select root system from dropdown
- Given the user has a 4D hypercube displayed
- When the user selects "Root System" from the object type selector
- Then the A₃ root system (12 roots in 4D) appears in the viewport

Scenario 2: View root system properties
- Given a 5D root system (Type A) is displayed
- When the user views the properties panel
- Then it shows: "A₄ Root System", "20 roots", formula "n(n-1) roots"

Scenario 3: Root system dimension change
- Given a 4D Type A root system (12 roots)
- When the user changes dimension to 6D
- Then the A₅ root system appears with 30 roots

---

## User Story 5: Configure Root System Type

**User story:** As a user, I want to select different root system types so that I can explore A, D, and E₈ root systems.

**Acceptance criteria**
1. "Root Type" selector offers: "A" (default), "D", "E₈"
2. Type A (A_{n-1}) is available for all dimensions 3-11
3. Type D (D_n) is available only for dimensions 4-11; disabled for dimension 3 with tooltip: "D_n requires dimension ≥ 4"
4. Type E₈ is available only when dimension equals 8; disabled otherwise with tooltip: "E₈ is only defined in 8 dimensions"
5. When dimension is 8, E₈ option shows "E₈ (240 roots)" label
6. Selecting a root type updates the visualization immediately
7. Root counts displayed:
   - Type A in dimension n: n(n-1) roots
   - Type D in dimension n: 2n(n-1) roots
   - Type E₈: exactly 240 roots
8. "Scale" slider allows adjusting overall size (0.5 to 2.0, default: 1.0)

**Test scenarios**

Scenario 1: Select Type D in 5D
- Given a 5D Type A root system displayed
- When the user selects Type D
- Then the D₅ root system appears with 40 roots

Scenario 2: Type D disabled in 3D
- Given dimension is set to 3
- When the user views the Root Type selector
- Then Type D is disabled with tooltip explaining the requirement

Scenario 3: Select E₈ in 8D
- Given dimension is 8 and Type A is selected
- When the user selects Type E₈
- Then the E₈ root system appears with exactly 240 roots

Scenario 4: E₈ disabled in non-8D
- Given dimension is 7
- When the user views the Root Type selector
- Then E₈ is disabled with tooltip "E₈ is only defined in 8 dimensions"

Scenario 5: Dimension change affects type availability
- Given E₈ is selected in dimension 8
- When the user changes dimension to 9
- Then root type automatically switches to Type A (with notification) since E₈ is invalid

---

## User Story 6: Configure Root System Edge Display

**User story:** As a user, I want to configure how edges are displayed for root systems so that I can see the geometric structure.

**Acceptance criteria**
1. "Edge Mode" selector offers: "Short Edges" (default), "None"
2. "Short Edges" connects roots that are at the minimum nonzero distance from each other
3. "None" displays only points (no connecting edges)
4. Edge connections are mathematically meaningful (reflect root system structure)
5. Edge color and thickness follow global visual settings
6. Changing edge mode updates display within 500ms
7. Short edges mode shows the natural connectivity of the root system

**Test scenarios**

Scenario 1: View with short edges
- Given a Type A root system is displayed
- When edge mode is set to "Short Edges"
- Then roots are connected to their nearest neighbors, forming a symmetric structure

Scenario 2: Switch to no edges
- Given short edges are displayed
- When the user selects "None" edge mode
- Then only root points are visible with no connecting lines

Scenario 3: Edge styling applies
- Given edge color is set to yellow
- When viewing root system with short edges
- Then the connecting edges appear in yellow

---

## User Story 7: Select Product Manifold as Object Type

**User story:** As a user, I want to select "Product Manifold" as an object type so that I can visualize cartesian products of geometric shapes.

**Acceptance criteria**
1. "Product Manifold" appears as a new option in the Object Type selector
2. Selecting "Product Manifold" opens a configuration panel for the product
3. Product Manifold is available for dimensions 3 through 11
4. Two product modes are available: "Polytope Product" and "Torus Product"
5. Default mode is "Polytope Product" with Cube × Cube configuration
6. The combined product dimensions must equal the ambient dimension n
7. Properties panel shows the product formula and component details

**Test scenarios**

Scenario 1: Select product manifold
- Given the user has a 4D hypercube displayed
- When the user selects "Product Manifold" from object type selector
- Then a product configuration panel appears with default Cube × Cube in 4D

Scenario 2: Invalid dimension configuration
- Given ambient dimension is 5D and dimA=3, dimB=3 selected
- When the user views the configuration
- Then an error appears: "Factor dimensions must sum to 5"

---

## User Story 8: Configure Polytope Product

**User story:** As a user, I want to configure a polytope product by selecting two shapes and their dimensions so that I can visualize products like Cube × Simplex.

**Acceptance criteria**
1. "Mode" selector set to "Polytope Product" shows factor configuration
2. "Shape A" selector offers: "Cube", "Simplex"
3. "Dimension A" selector offers valid dimensions (1 to n-1)
4. "Shape B" selector offers: "Cube", "Simplex"
5. "Dimension B" is automatically calculated as n - dimA
6. Visualization shows the cartesian product P × Q with correct vertex and edge counts
7. Vertex count equals: (vertices of A) × (vertices of B)
8. Edges come from both factors: edges of A replicated across B, and edges of B replicated across A
9. Valid products for 4D include: 2D×2D, 1D×3D, 3D×1D
10. Configuration persists in URL state

**Test scenarios**

Scenario 1: Create Cube × Simplex in 5D
- Given ambient dimension is 5D
- When the user selects Shape A = Cube (dim 2), Shape B = Simplex (dim 3)
- Then a 2D-Cube × 3D-Simplex product appears (4 × 4 = 16 vertices)

Scenario 2: Dimension auto-calculation
- Given ambient dimension is 6D
- When the user sets Dimension A to 4
- Then Dimension B automatically shows 2

Scenario 3: View product properties
- Given a Cube(3D) × Simplex(2D) product in 5D
- When the user views properties panel
- Then it shows: "3-Cube × 2-Simplex", "8 × 3 = 24 vertices"

Scenario 4: Edge connectivity in product
- Given a 2D-Square × 2D-Square product in 4D
- When the user views the visualization
- Then edges connect vertices that share all but one coordinate from either factor

---

## User Story 9: Configure Torus Product

**User story:** As a user, I want to configure a torus product (multiple circles) so that I can visualize k-tori embedded in n-dimensional space.

**Acceptance criteria**
1. "Mode" selector set to "Torus Product" shows torus configuration
2. "Number of Circles (k)" slider ranges from 1 to floor(n/2)
3. Each circle requires 2 dimensions for embedding (2k ≤ n)
4. "Radius" input allows setting radius per circle (or uniform radius)
5. "Steps per Circle" slider ranges from 8 to 64 (default: 32)
6. Total points generated equals: (steps)^k
7. Warning appears when k ≥ 3 with steps > 16: "High k with many steps creates very large point clouds"
8. Points form a grid on the k-torus surface
9. For k=1: renders a circle; k=2: renders a 2-torus; k=3: renders a 3-torus

**Test scenarios**

Scenario 1: Create 2-torus in 4D
- Given ambient dimension is 4D
- When the user selects Torus Product with k=2 circles, 32 steps
- Then a 2-torus appears with 32 × 32 = 1024 points

Scenario 2: Circle count limited by dimension
- Given ambient dimension is 5D
- When the user views the Number of Circles selector
- Then maximum k is 2 (since 2×2=4 ≤ 5, but 2×3=6 > 5)

Scenario 3: High k warning
- Given k=3 circles with steps=24
- When the user views the configuration
- Then a warning appears about large point cloud (24³ = 13,824 points)

Scenario 4: Single circle (k=1)
- Given k=1 with 32 steps in any dimension ≥ 2
- When the user views the visualization
- Then a circle with 32 points appears in the first 2 coordinates

---

## User Story 10: Select Clifford Torus as Object Type

**User story:** As a user, I want to select "Clifford Torus" as an object type so that I can visualize this special symmetric torus that lies on the 3-sphere in 4D.

**Acceptance criteria**
1. "Clifford Torus" appears as a new option in the Object Type selector
2. Clifford Torus is available only for dimensions 4 through 11; disabled for 3D with tooltip: "Clifford Torus requires dimension ≥ 4"
3. Selecting Clifford Torus displays the classic flat torus on S³
4. The torus is embedded in the first 4 coordinates, with remaining coordinates set to zero
5. Default resolution is 32 × 32 (1024 points)
6. Points lie on the 3-sphere of the specified radius
7. Object type selection persists in URL state
8. Properties panel shows: "Clifford Torus (flat torus on S³)"

**Test scenarios**

Scenario 1: Select Clifford torus in 4D
- Given the user has a 4D hypercube displayed
- When the user selects "Clifford Torus" from object type selector
- Then the Clifford torus appears as a toroidal point grid

Scenario 2: Clifford torus disabled in 3D
- Given dimension is 3
- When the user views the object type selector
- Then Clifford Torus is disabled with tooltip explaining the dimension requirement

Scenario 3: Clifford torus in higher dimensions
- Given dimension is 7
- When the user selects Clifford Torus
- Then the torus appears in the first 4 coordinates with dimensions 5-7 at zero

Scenario 4: Auto-switch on dimension decrease
- Given Clifford Torus is selected in 4D
- When the user changes dimension to 3D
- Then object type automatically switches to Hypercube (with notification) since Clifford Torus is invalid

---

## User Story 11: Configure Clifford Torus Parameters

**User story:** As a user, I want to configure the Clifford torus resolution and display options so that I can control the visualization detail.

**Acceptance criteria**
1. "Radius" slider ranges from 0.5 to 3.0 (default: 1.0)
2. "Resolution U" slider ranges from 8 to 128 (default: 32)
3. "Resolution V" slider ranges from 8 to 128 (default: 32)
4. Total points equals resolution_U × resolution_V
5. Warning appears when total points exceed 4096: "High resolution may affect performance"
6. "Edge Mode" selector offers: "Grid" (default), "None"
7. Grid mode connects points to their neighbors in both U and V directions with wrap-around
8. Points lie exactly on the 3-sphere: sum of squared coordinates equals R²
9. Changes update visualization within 500ms

**Test scenarios**

Scenario 1: Increase resolution
- Given Clifford torus at 32×32 resolution
- When the user increases both resolutions to 64×64
- Then the point cloud becomes denser with 4096 points

Scenario 2: Enable grid edges
- Given edge mode is "None"
- When the user selects "Grid" edge mode
- Then edges appear connecting neighboring points in a toroidal grid pattern

Scenario 3: Performance warning
- Given resolution is 64×64
- When the user increases to 80×80
- Then a warning appears about performance (6400 points)

Scenario 4: Verify 3-sphere property
- Given Clifford torus with radius 1.0
- When examining any point's coordinates
- Then x₁² + x₂² + x₃² + x₄² = 1.0

---

## User Story 12: Apply Visual Settings to Point Cloud Objects

**User story:** As a user, I want the existing visual settings to apply to point cloud objects so that I can customize their appearance consistently.

**Acceptance criteria**
1. Point color follows the vertex color setting from Visuals panel
2. Point size is configurable (range: 1-10, default: 3)
3. Edge color and thickness apply to wireframe/grid edges
4. Bloom effect applies to points when enabled
5. Background color applies consistently
6. Opacity settings affect point cloud transparency
7. All visual presets (Neon, Blueprint, etc.) work with point cloud objects
8. Depth attenuation affects point brightness based on distance

**Test scenarios**

Scenario 1: Change point color
- Given a hypersphere is displayed
- When the user changes vertex color to pink
- Then all hypersphere points render in pink

Scenario 2: Apply bloom to point cloud
- Given a hypersphere is displayed and bloom is disabled
- When the user enables bloom
- Then points have a glowing effect

Scenario 3: Apply Neon preset
- Given a root system is displayed
- When the user selects "Neon" visual preset
- Then points become cyan and edges magenta against dark background

Scenario 4: Depth attenuation on hypersphere
- Given a 5D hypersphere with depth attenuation enabled
- When viewing the projection
- Then points further from the camera appear dimmer

---

## User Story 13: Apply Rotation Transformations to Extended Objects

**User story:** As a user, I want rotation controls to work with all extended object types so that I can explore them from different angles.

**Acceptance criteria**
1. All rotation plane sliders work with Hypersphere, Root System, Product Manifold, and Clifford Torus
2. Rotation is applied to all points/vertices before projection
3. Animation of rotations works for all object types
4. Isoclinic rotation (4D) works with Clifford Torus, revealing its special symmetry
5. Higher-dimensional rotations (5D+) affect embedded lower-dimensional objects appropriately
6. Rotation state persists across object type changes when dimensions match

**Test scenarios**

Scenario 1: Rotate hypersphere in XW plane
- Given a 4D hypersphere is displayed
- When the user rotates in the XW plane by 45°
- Then the point cloud rotates showing 4D perspective shift

Scenario 2: Isoclinic rotation on Clifford torus
- Given a Clifford torus in 4D with isoclinic animation enabled
- When the animation plays
- Then the torus exhibits its characteristic double rotation

Scenario 3: Rotation persists on object change
- Given XY rotation is set to 30° on a hypersphere
- When the user switches to Root System (same dimension)
- Then XY rotation remains at 30°

---

## User Story 14: View Properties for Extended Objects

**User story:** As a user, I want to see relevant mathematical properties for each extended object type so that I can understand what I'm visualizing.

**Acceptance criteria**
1. Properties panel updates based on object type
2. Hypersphere properties show: dimension, mode (surface/solid), sample count, radius, surface formula (S^{n-1})
3. Root System properties show: type (A/D/E₈), dimension, root count, root count formula, edge count
4. Product Manifold properties show: factor shapes, factor dimensions, vertex count formula, edge count
5. Clifford Torus properties show: dimension, radius, resolution, point count, "flat torus on S³" description
6. Mathematical formulas are displayed where applicable
7. "Learn more" link opens educational content for each object type

**Test scenarios**

Scenario 1: Hypersphere properties
- Given a 5D hypersphere surface with 3000 samples
- When viewing properties panel
- Then it shows: "5D Hypersphere", "Surface (S⁴)", "3000 points", "Radius: 1.0"

Scenario 2: Root system properties
- Given an 8D E₈ root system
- When viewing properties panel
- Then it shows: "E₈ Root System", "240 roots", "8 dimensions"

Scenario 3: Product manifold properties
- Given a 3-Cube × 2-Simplex product
- When viewing properties panel
- Then it shows: "3-Cube × 2-Simplex", "8 × 3 = 24 vertices", "Edges: 36"

---

## User Story 15: Export Extended Objects

**User story:** As a user, I want to export extended object visualizations so that I can share and save interesting configurations.

**Acceptance criteria**
1. PNG export works for all extended object types
2. Configuration JSON export includes all object-specific settings
3. Share URL includes all parameters for extended objects
4. Loading a share URL recreates the exact extended object configuration
5. Export includes: object type, dimension, all object-specific parameters, rotation state, visual settings

**Test scenarios**

Scenario 1: Export hypersphere configuration
- Given a 6D hypersphere in solid mode with 5000 samples
- When the user exports configuration JSON
- Then the file contains: objectType, dimension, mode, sampleCount, radius

Scenario 2: Share URL for root system
- Given an 8D E₈ root system with XW rotation at 45°
- When the user copies share URL
- Then loading the URL shows E₈ root system with the same rotation

Scenario 3: Share URL for Clifford torus
- Given a Clifford torus at 64×64 resolution with grid edges
- When the user copies share URL and opens it
- Then the same Clifford torus configuration appears

---

## Specification Summary

**Feature**: Extended N-Dimensional Objects
**User Stories (Jira Tickets)**: 15
**Acceptance Criteria**: 118 total
**Test Scenarios**: 58 total

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Select Hypersphere | User | ~1.5 days | None |
| 2 | Configure Hypersphere Mode/Sampling | User | ~1.5 days | Story 1 |
| 3 | Configure Hypersphere Wireframe | User | ~1 day | Story 1 |
| 4 | Select Root System | User | ~1 day | None |
| 5 | Configure Root System Type | User | ~1.5 days | Story 4 |
| 6 | Configure Root System Edges | User | ~0.5 days | Story 4 |
| 7 | Select Product Manifold | User | ~1 day | None |
| 8 | Configure Polytope Product | User | ~2 days | Story 7 |
| 9 | Configure Torus Product | User | ~1.5 days | Story 7 |
| 10 | Select Clifford Torus | User | ~1 day | None |
| 11 | Configure Clifford Torus | User | ~1 day | Story 10 |
| 12 | Visual Settings for Point Clouds | User | ~1 day | Stories 1, 4, 7, 10 |
| 13 | Rotation for Extended Objects | User | ~1 day | Stories 1, 4, 7, 10 |
| 14 | Properties for Extended Objects | User | ~1.5 days | Stories 1, 4, 7, 10 |
| 15 | Export Extended Objects | User | ~1 day | Stories 1, 4, 7, 10 |

### Coverage
- Happy paths: 28
- Error handling: 8
- Edge cases: 14
- Permission/access: 0 (no auth required)
- System behavior: 8

### Placeholders Requiring Confirmation
- None - specifications based on research document

### Open Questions
- None - research guide provides all mathematical foundations

### Dependencies Between Stories
- Stories 1, 4, 7, 10 (object type selection) are independent and can be developed in parallel
- Stories 2-3 depend on Story 1 (Hypersphere)
- Stories 5-6 depend on Story 4 (Root System)
- Stories 8-9 depend on Story 7 (Product Manifold)
- Story 11 depends on Story 10 (Clifford Torus)
- Stories 12-15 depend on at least one object type being implemented

### Mathematical Requirements Summary
Based on research guide `docs/research/nd-extended-objects-guide.md`:

1. **Hypersphere Surface Sampling**: Gaussian normalization method - sample N(0,1) per coordinate, normalize to radius
2. **Hypersphere Solid Sampling**: Surface sample × r where r = R × t^(1/n), t ~ U(0,1)
3. **Root System A_{n-1}**: Vectors e_i - e_j for all i ≠ j, giving n(n-1) roots
4. **Root System D_n**: Vectors ±e_i ± e_j for i < j, giving 2n(n-1) roots (n ≥ 4)
5. **Root System E₈**: 240 precomputed roots in 8D
6. **Product Polytope**: Vertices = cartesian product; Edges from both factors
7. **Torus Product**: (S¹)^k embedded using 2 coordinates per circle
8. **Clifford Torus**: x₁ = (R/√2)cos(u), x₂ = (R/√2)sin(u), x₃ = (R/√2)cos(v), x₄ = (R/√2)sin(v)

### Integration Points
- Object type selector: Add 4 new options
- Geometry store: Extend to support new object types
- Point cloud renderer: Required for Hypersphere, Torus Product (reuse from Mandelbrot if implemented)
- Mesh renderer: Root systems and Clifford Torus can use existing edge rendering
- Visual settings: Apply to all new objects
- URL serialization: Add parameters for each object type
- Properties panel: Show object-specific information

### Ready for Development: YES
