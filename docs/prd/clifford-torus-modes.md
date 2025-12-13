# Clifford Torus Visualization Modes

## Product Overview

An enhancement to the existing Clifford Torus object type that introduces three distinct visualization modes, each offering different mathematical structures and visual characteristics. This feature transforms the Clifford torus from a single representation into a versatile tool for exploring different torus geometries in higher dimensions.

**Target Audience:** Mathematics enthusiasts, educators, students, and researchers interested in higher-dimensional topology, Hopf fibrations, and geometric structures.

**Core Value Proposition:** Provide users with multiple ways to visualize tori in n-dimensional space, ranging from the mathematically pure flat torus to the visually stunning Hopf fibration and the intuitively familiar nested tube structure.

---

## Background: Why Three Modes?

### The Problem

The current Clifford torus implementation (now called "Flat" mode) places points on independent circles in perpendicular planes. While mathematically correct, this creates a simple, grid-like pattern when projected to 3D—especially in higher dimensions where multiple independent circles produce repetitive, visually uninteresting results.

### The Solution

Three visualization modes that offer different trade-offs between mathematical purity and visual richness:

| Mode | Available Dimensions | Visual Character | Mathematical Structure |
|------|---------------------|------------------|----------------------|
| **Flat** | 2D–11D | Grid-like, regular | Independent circles in perpendicular 2-planes |
| **Nested (Hopf)** | 4D and 8D only | Flowing, interlinked | Hopf fibration with coupled angles |
| **Tube of Tube** | 3D–11D | Chunky, organic | Nested surfaces of revolution |

---

## Mathematical Reference

### Flat Torus (Current Implementation)

The flat k-torus Tᵏ is embedded in ℝ²ᵏ with k independent circular factors:

**Parametrization** (for k circles, each angle θₘ ∈ [0, 2π]):
```
For m = 1, 2, ..., k:
  x₍₂ₘ₋₁₎ = (R/√k) · cos(θₘ)
  x₍₂ₘ₎   = (R/√k) · sin(θₘ)
```

**Key Property:** All points lie on S^(2k-1) with radius R (sum of squared coordinates = R²).

**Why it looks simple:** Each angle θₘ controls its own circle independently. No coupling means no visual complexity when projected.

### Nested (Hopf) Torus

#### 4D Hopf Fibration (S³ → S²)

The Hopf fibration fills the 3-sphere S³ with circles (S¹ fibers) that are all pairwise linked. A Clifford torus is one member of the family of tori that foliate S³.

**Parametrization** (η ∈ [0, π/2] selects which torus; ξ₁, ξ₂ ∈ [0, 2π]):
```
x₀ = R · cos((ξ₁ + ξ₂)/2) · sin(η)
x₁ = R · sin((ξ₁ + ξ₂)/2) · sin(η)
x₂ = R · cos((ξ₂ - ξ₁)/2) · cos(η)
x₃ = R · sin((ξ₂ - ξ₁)/2) · cos(η)
```

**Key Property:** The angles ξ₁ and ξ₂ are *coupled* via (ξ₁+ξ₂)/2 and (ξ₂-ξ₁)/2. Moving along one circle causes rotation in the other—creating the characteristic "flowing" visual effect.

**Special cases:**
- η = π/4: The "main" Clifford torus where both circles have equal radius
- η → 0: Degenerates to a circle in the x₂x₃ plane
- η → π/2: Degenerates to a circle in the x₀x₁ plane

**Nested visualization:** By sampling multiple η values (e.g., η = π/8, π/4, 3π/8), the system displays nested tori—tori within tori—revealing the Hopf fibration structure.

#### 8D Quaternionic Hopf Fibration (S⁷ → S⁴)

The quaternionic Hopf fibration generalizes to 8 dimensions with S³ (3-sphere) fibers instead of circles.

**Structure:**
- Base space: S⁴ (4-sphere)
- Fiber: S³ (3-sphere)
- Total space: S⁷ (7-sphere)

**Parametrization:** Uses quaternion multiplication. For unit quaternions q₁, q₂:
```
Point on S⁷ = (q₁ · cos(η), q₂ · sin(η))

where q₁, q₂ are unit quaternions parametrized by:
  q = cos(α) + i·sin(α)cos(β) + j·sin(α)sin(β)cos(γ) + k·sin(α)sin(β)sin(γ)
```

**Why only 4D and 8D:** Hopf fibrations exist only where division algebras exist:
- Real numbers → trivial (1D)
- Complex numbers → S³ → S² (4D)
- Quaternions → S⁷ → S⁴ (8D)
- Octonions → S¹⁵ → S⁸ (16D, beyond our dimension range)

### Tube of Tube (Nested Revolution)

The familiar 3D torus is created by revolving a circle around an axis. This construction generalizes to higher dimensions by iteratively revolving the previous shape.

#### 3D Standard Torus

**Parametrization** (u, v ∈ [0, 2π]):
```
x = (R₁ + R₂·cos(v)) · cos(u)
y = (R₁ + R₂·cos(v)) · sin(u)
z = R₂ · sin(v)
```
- R₁ = major radius (center of torus to center of tube)
- R₂ = minor radius (tube thickness)

#### 4D Torus of Torus

**Parametrization** (u, v, w ∈ [0, 2π]):
```
Let ρ = R₁ + R₂·cos(v)  // radius of intermediate 3D torus cross-section

x = (R₀ + ρ·cos(u)) · cos(w)
y = ρ · sin(u)
z = R₂ · sin(v)
w = (R₀ + ρ·cos(u)) · sin(w)
```
- R₀ = outermost radius (4D revolution distance)
- R₁ = major radius of inner torus
- R₂ = minor radius (smallest tube)

#### General n-D Formula

For dimension n with n-1 angular parameters θ₁, θ₂, ..., θₙ₋₁ and radii R₁ > R₂ > ... > Rₙ₋₁:

The construction is recursive:
1. Start with a circle of radius Rₙ₋₁ in 2D
2. Revolve around an axis at distance Rₙ₋₂ → 3D torus
3. Revolve that torus around a new axis at distance Rₙ₋₃ → 4D hypertorus
4. Continue for each additional dimension

**Radius constraints:** Each Rᵢ must be greater than the sum of all smaller radii to prevent self-intersection. A safe default ratio is Rᵢ = 2·Rᵢ₊₁.

---

## User Story 1: Select Visualization Mode

**User story:** As a user, I want to select a visualization mode for the Clifford torus so that I can explore different geometric representations of tori.

**Acceptance criteria**
1. When Clifford Torus is the selected object type, a "Visualization Mode" selector appears in the configuration panel
2. The selector offers three options: "Flat", "Nested (Hopf)", and "Tube of Tube"
3. Default selection is "Flat" to maintain backward compatibility with existing behavior
4. Selecting a different mode regenerates the torus geometry within 500ms
5. The currently selected mode is visually highlighted in the selector
6. Mode selection persists in URL state for sharing
7. Mode selection is preserved when switching away from Clifford Torus and back
8. Each mode option displays a brief description on hover or as subtitle text

**Test scenarios**

Scenario 1: View mode selector for Clifford torus
- Given the user has Clifford Torus selected as the object type in dimension 4
- When the user views the configuration panel
- Then a "Visualization Mode" selector is visible with "Flat" selected by default

Scenario 2: Switch visualization mode
- Given the user has a Flat mode Clifford torus displayed
- When the user selects "Tube of Tube" from the mode selector
- Then the visualization updates to show the tube-of-tube structure within 500ms

Scenario 3: Mode persists across object type changes
- Given the user has selected "Tube of Tube" mode for Clifford torus
- When the user switches to Hypercube and then back to Clifford Torus
- Then "Tube of Tube" mode is still selected

Scenario 4: Share URL includes mode
- Given the user has Clifford torus in "Nested (Hopf)" mode at dimension 4
- When the user copies the share URL and opens it in a new window
- Then the Clifford torus appears in "Nested (Hopf)" mode

---

## User Story 2: Mode Availability Based on Dimension

**User story:** As a user, I want to see which visualization modes are available for the current dimension so that I understand my options and constraints.

**Acceptance criteria**
1. "Flat" mode is available for all dimensions (2D–11D)
2. "Nested (Hopf)" mode is available only when dimension equals 4 or 8
3. "Nested (Hopf)" mode is disabled with tooltip "Hopf fibration requires 4D or 8D" for other dimensions
4. "Tube of Tube" mode is available for dimensions 3–11
5. "Tube of Tube" mode is disabled with tooltip "Tube of Tube requires 3D or higher" for dimension 2
6. Disabled modes appear visually distinct (grayed out) from available modes
7. Hovering over a disabled mode shows the explanatory tooltip

**Test scenarios**

Scenario 1: All modes available in 4D
- Given the user has dimension set to 4
- When the user views the mode selector
- Then all three modes (Flat, Nested, Tube of Tube) are enabled and selectable

Scenario 2: Nested mode disabled in 5D
- Given the user has dimension set to 5
- When the user views the mode selector
- Then "Nested (Hopf)" is disabled and shows tooltip "Hopf fibration requires 4D or 8D"

Scenario 3: Nested mode available in 8D
- Given the user has dimension set to 8
- When the user views the mode selector
- Then "Nested (Hopf)" is enabled and selectable

Scenario 4: Tube of Tube disabled in 2D
- Given the user has dimension set to 2
- When the user views the mode selector
- Then "Tube of Tube" is disabled and shows tooltip "Tube of Tube requires 3D or higher"

Scenario 5: Only Flat available in 2D
- Given the user has dimension set to 2
- When the user views the mode selector
- Then only "Flat" mode is enabled; both other modes are disabled

---

## User Story 3: Automatic Mode Switching on Dimension Change

**User story:** As a user, I want the system to handle mode changes gracefully when I change dimensions so that I always see a valid visualization.

**Acceptance criteria**
1. If user is in "Nested (Hopf)" mode at 4D and changes dimension to anything except 8, mode auto-switches to "Flat"
2. If user is in "Nested (Hopf)" mode at 8D and changes dimension to anything except 4, mode auto-switches to "Flat"
3. If user is in "Tube of Tube" mode and changes dimension to 2D, mode auto-switches to "Flat"
4. When auto-switch occurs, a notification appears: "Switched to Flat mode (previous mode not available in [N]D)"
5. Auto-switch notification disappears after 4 seconds
6. If dimension changes to another dimension where the current mode is valid, no switch occurs
7. The auto-switch notification includes the reason for the switch

**Test scenarios**

Scenario 1: Nested to Flat on dimension increase
- Given the user has "Nested (Hopf)" mode selected at 4D
- When the user changes dimension to 5D
- Then the mode switches to "Flat" and notification "Switched to Flat mode (Hopf requires 4D or 8D)" appears

Scenario 2: Nested preserved between 4D and 8D
- Given the user has "Nested (Hopf)" mode selected at 4D
- When the user changes dimension to 8D
- Then "Nested (Hopf)" mode remains selected with no notification

Scenario 3: Tube of Tube to Flat on 2D
- Given the user has "Tube of Tube" mode selected at 3D
- When the user changes dimension to 2D
- Then the mode switches to "Flat" and notification "Switched to Flat mode (Tube of Tube requires 3D+)" appears

Scenario 4: Tube of Tube preserved in higher dimensions
- Given the user has "Tube of Tube" mode selected at 5D
- When the user changes dimension to 9D
- Then "Tube of Tube" mode remains selected with no notification

Scenario 5: Flat mode never triggers auto-switch
- Given the user has "Flat" mode selected at 4D
- When the user changes dimension to any value (2–11)
- Then "Flat" mode remains selected with no notification

---

## User Story 4: Flat Mode Configuration

**User story:** As a user, I want to configure the Flat mode torus parameters so that I can control the visualization detail and structure.

**Acceptance criteria**
1. Flat mode uses the existing Clifford torus configuration options (backward compatible)
2. "Radius" slider ranges from 0.5 to 6.0 (default: 3.0)
3. "Resolution U" slider ranges from 8 to 128 (default: 32)
4. "Resolution V" slider ranges from 8 to 128 (default: 32)
5. For generalized k-torus (dimension > 4), "Torus Dimension (k)" selector is available (1 to floor(dim/2))
6. "Edge Mode" selector offers "Grid" (default) and "None"
7. Total points = Resolution U × Resolution V (or stepsPerCircle^k for generalized)
8. Warning appears when total points exceed 4096: "High resolution may affect performance"
9. All existing behavior is preserved exactly (this is the current implementation)

**Test scenarios**

Scenario 1: Default Flat mode configuration
- Given the user selects Clifford Torus in Flat mode at 4D
- When the user views the configuration panel
- Then default values are: Radius 3.0, Resolution U 32, Resolution V 32, Edge Mode "Grid"

Scenario 2: Adjust resolution
- Given the user has Flat mode torus displayed
- When the user increases Resolution U to 64 and Resolution V to 64
- Then the point cloud becomes denser with 4096 points

Scenario 3: High resolution warning
- Given Resolution U is 64 and Resolution V is 64
- When the user increases Resolution U to 80
- Then a warning appears about performance (5120 points)

Scenario 4: Generalized k-torus selector appears in 6D
- Given the user has Flat mode selected at dimension 6
- When the user views the configuration panel
- Then a "Torus Dimension (k)" selector appears with options 1, 2, 3

Scenario 5: Backward compatibility check
- Given the user has an existing Clifford torus configuration from before this feature
- When the configuration loads
- Then the torus renders identically to the previous behavior (Flat mode is the default)

---

## User Story 5: Nested (Hopf) Mode Configuration - 4D

**User story:** As a user, I want to configure the 4D Nested (Hopf) mode so that I can explore the Hopf fibration structure.

**Acceptance criteria**
1. Nested mode in 4D shows configuration options specific to the Hopf fibration
2. "Radius" slider ranges from 0.5 to 6.0 (default: 3.0)
3. "Torus Position (η)" slider ranges from 0.05 to 1.52 radians (π/64 to ~π/2 - π/64), default: π/4 (0.785)
4. Slider shows approximate value in both radians and as fraction of π (e.g., "π/4")
5. "Resolution ξ₁" slider ranges from 8 to 128 (default: 48)
6. "Resolution ξ₂" slider ranges from 8 to 128 (default: 48)
7. "Show Nested Tori" toggle (default: OFF) enables display of multiple tori at different η values
8. When "Show Nested Tori" is ON, "Number of Tori" selector appears (range: 2–5, default: 3)
9. "Edge Mode" selector offers "Grid" (default) and "None"
10. Points generated = Resolution ξ₁ × Resolution ξ₂ × (Number of Tori if enabled, else 1)
11. Properties panel shows: "Hopf Fibration Torus (4D)", η value, fiber description

**Test scenarios**

Scenario 1: Default Nested mode in 4D
- Given the user selects "Nested (Hopf)" mode at dimension 4
- When the user views the configuration panel
- Then default values are: Radius 3.0, η = π/4, Resolution ξ₁ = 48, Resolution ξ₂ = 48

Scenario 2: Adjust torus position
- Given the user has Nested mode torus displayed at η = π/4
- When the user moves the η slider to π/8
- Then the torus changes shape (one circle larger than the other)

Scenario 3: Enable nested tori display
- Given the user has a single Hopf torus displayed
- When the user enables "Show Nested Tori" with 3 tori
- Then three concentric tori appear at different η values

Scenario 4: η at extreme values
- Given the user has Nested mode selected
- When the user moves η slider to minimum (near 0)
- Then the torus appears as nearly a single circle (highly eccentric)

Scenario 5: Visual difference from Flat mode
- Given the user has dimension 4 and views a Flat mode torus, then switches to Nested mode
- When comparing the two visualizations during rotation
- Then Nested mode shows characteristic flowing/linked circle behavior distinct from the grid pattern of Flat mode

---

## User Story 6: Nested (Hopf) Mode Configuration - 8D

**User story:** As a user, I want to configure the 8D Nested (Hopf) mode so that I can explore the quaternionic Hopf fibration.

**Acceptance criteria**
1. Nested mode in 8D shows configuration options for the quaternionic Hopf fibration
2. "Radius" slider ranges from 0.5 to 6.0 (default: 3.0)
3. "Fiber Resolution" slider ranges from 4 to 32 (default: 12) — controls S³ fiber sampling
4. "Base Resolution" slider ranges from 4 to 32 (default: 12) — controls S⁴ base sampling
5. Total points = Fiber Resolution³ × Base Resolution² (can grow quickly)
6. Warning appears when total points exceed 8000: "8D Hopf generates many points. Consider reducing resolution."
7. "Edge Mode" selector offers "Grid" (default) and "None"
8. "Show Fiber Structure" toggle (default: ON) connects points along S³ fibers
9. Properties panel shows: "Quaternionic Hopf Fibration (8D)", "S³ fibers over S⁴ base"
10. Performance note displayed: "8D Hopf visualization is computationally intensive"

**Test scenarios**

Scenario 1: Default Nested mode in 8D
- Given the user selects "Nested (Hopf)" mode at dimension 8
- When the user views the configuration panel
- Then default values are: Radius 3.0, Fiber Resolution 12, Base Resolution 12

Scenario 2: High point count warning
- Given the user has Nested mode at 8D with default settings
- When the user increases Fiber Resolution to 20
- Then a warning appears about high point count (20³ × 12² = 1,152,000 points)

Scenario 3: Fiber structure visualization
- Given "Show Fiber Structure" is enabled
- When viewing the 8D Hopf torus
- Then edges connect points that belong to the same S³ fiber, revealing the fibration structure

Scenario 4: Reduce resolution for performance
- Given the warning about high point count is displayed
- When the user reduces Fiber Resolution to 8 and Base Resolution to 8
- Then the warning disappears (8³ × 8² = 32,768 points, under warning threshold with adjusted limit)

---

## User Story 7: Tube of Tube Mode Configuration

**User story:** As a user, I want to configure the Tube of Tube mode so that I can visualize nested revolution surfaces in any dimension.

**Acceptance criteria**
1. Tube of Tube mode shows configuration options for nested revolution torus
2. "Outer Radius" slider ranges from 1.0 to 6.0 (default: 4.0)
3. "Radius Ratio" slider ranges from 0.2 to 0.45 (default: 0.35) — ratio between successive radii
4. Actual radii are calculated as: R₁ = Outer Radius, R₂ = R₁ × Ratio, R₃ = R₂ × Ratio, etc.
5. "Steps per Level" slider ranges from 8 to 48 (default: 16) — angular resolution for each revolution
6. Total points = (Steps per Level)^(dimension - 1) for dimensions 3+
7. Warning appears when total points exceed 10,000: "High dimension with many steps creates large point clouds"
8. "Edge Mode" selector offers "Grid" (default) and "None"
9. In 3D, this produces the standard torus (donut shape)
10. In 4D+, visible nested tube structure at multiple scales
11. Properties panel shows: "Tube of Tube ([N]D)", calculated radii values, point count

**Test scenarios**

Scenario 1: Default Tube of Tube in 4D
- Given the user selects "Tube of Tube" mode at dimension 4
- When the user views the configuration panel
- Then default values are: Outer Radius 4.0, Radius Ratio 0.35, Steps per Level 16

Scenario 2: Standard torus in 3D
- Given the user selects "Tube of Tube" mode at dimension 3
- When viewing the visualization
- Then a familiar donut shape appears with visible tube structure

Scenario 3: Point count calculation
- Given dimension is 5 and Steps per Level is 16
- When the user views the properties panel
- Then point count shows 16⁴ = 65,536 points

Scenario 4: High dimension warning
- Given dimension is 6 and Steps per Level is 16
- When the user views the configuration
- Then a warning appears (16⁵ = 1,048,576 points exceeds threshold)

Scenario 5: Reduce steps for high dimensions
- Given dimension is 7 with default steps showing warning
- When the user reduces Steps per Level to 8
- Then the warning disappears or reduces (8⁶ = 262,144 points)

Scenario 6: Adjust radius ratio
- Given the user has Tube of Tube displayed in 4D
- When the user increases Radius Ratio from 0.35 to 0.45
- Then the inner tubes become proportionally larger relative to outer structure

Scenario 7: Visual comparison to Flat mode
- Given the user has dimension 4 and compares Flat mode to Tube of Tube mode
- When viewing both visualizations
- Then Tube of Tube shows visible "donut inside donut" structure while Flat appears as a grid on a surface

---

## User Story 8: Performance Optimization for High Point Counts

**User story:** As a user, I want the system to handle high point counts gracefully so that I can explore complex tori without crashing the application.

**Acceptance criteria**
1. When calculated point count exceeds 50,000, a confirmation dialog appears before generating
2. Confirmation shows: "This will generate [N] points. Large point clouds may cause slow performance. Continue?"
3. User can choose "Continue" or "Cancel"
4. If user cancels, previous visualization remains unchanged
5. "Don't ask again this session" checkbox suppresses future confirmations for the session
6. If point count exceeds 500,000, generation is blocked with message: "Point count exceeds maximum ([N] > 500,000). Please reduce resolution."
7. During generation of large point clouds, a progress indicator appears
8. Animation automatically pauses during generation of clouds exceeding 20,000 points, then resumes

**Test scenarios**

Scenario 1: Confirmation for large point cloud
- Given the user configures settings that would generate 75,000 points
- When the user changes a parameter triggering regeneration
- Then a confirmation dialog appears showing the point count

Scenario 2: Cancel large generation
- Given the confirmation dialog is displayed
- When the user clicks "Cancel"
- Then the previous visualization remains and settings revert to previous values

Scenario 3: Block excessive point count
- Given the user attempts to configure settings generating 600,000 points
- When the configuration would apply
- Then an error message appears and the generation is blocked

Scenario 4: Progress indicator for large clouds
- Given the user confirms generation of 80,000 points
- When generation begins
- Then a progress indicator appears until generation completes

Scenario 5: Suppress confirmation
- Given the user has checked "Don't ask again this session"
- When configuring another 60,000 point cloud
- Then no confirmation appears and generation proceeds automatically

---

## User Story 9: Visual Properties for Different Modes

**User story:** As a user, I want each visualization mode to display appropriate mathematical properties so that I can understand what I'm seeing.

**Acceptance criteria**
1. Properties panel title reflects the current mode and dimension
2. Flat mode shows: "Flat Torus (k-torus in [2k]D)", "k = [value]", "Points lie on S^(2k-1)"
3. Nested (4D) shows: "Hopf Fibration Torus", "η = [value]", "Linked circles on S³"
4. Nested (8D) shows: "Quaternionic Hopf Torus", "S³ fibers over S⁴", "Points on S⁷"
5. Tube of Tube shows: "Nested Revolution Torus", "Radii: R₁=[val], R₂=[val], ...", "Levels: [n-1]"
6. All modes show: point count, edge count (if edges enabled), current dimension
7. "Learn more" link opens educational tooltip or documentation for each mode
8. Properties update immediately when mode or parameters change

**Test scenarios**

Scenario 1: Flat mode properties
- Given the user has Flat mode selected at dimension 6 with k=3
- When viewing the properties panel
- Then it shows "Flat Torus (3-torus in 6D)", "k = 3", "Points lie on S⁵"

Scenario 2: Nested 4D properties
- Given the user has Nested mode at 4D with η = π/4
- When viewing the properties panel
- Then it shows "Hopf Fibration Torus", "η = π/4 (0.785 rad)", "Linked circles on S³"

Scenario 3: Tube of Tube properties
- Given the user has Tube of Tube mode at dimension 5 with radii 4.0, 1.4, 0.49
- When viewing the properties panel
- Then it shows "Nested Revolution Torus", "Radii: 4.0, 1.4, 0.49", "Levels: 4"

Scenario 4: Properties update on parameter change
- Given the user is viewing properties for a Nested mode torus
- When the user changes η from π/4 to π/3
- Then the properties panel immediately updates to show new η value

---

## User Story 10: Rotation Behavior Per Mode

**User story:** As a user, I want rotation controls to reveal the unique characteristics of each visualization mode so that I can fully explore the geometry.

**Acceptance criteria**
1. All rotation plane sliders work with all three modes
2. Flat mode: rotation shows the grid structure, independent circles visible
3. Nested (Hopf) 4D: isoclinic rotation reveals the characteristic "double rotation" where both circles spin together
4. Nested (Hopf) 8D: rotation shows the S³ fiber structure sweeping through the space
5. Tube of Tube: rotation reveals the nested tube structure at different scales
6. Animation speed applies consistently across all modes
7. Each mode benefits from different default rotation planes being active
8. "Suggested rotations" preset button sets rotation planes that best showcase each mode's structure

**Test scenarios**

Scenario 1: Flat mode rotation
- Given a Flat mode torus in 4D with XW rotation animated
- When observing the animation
- Then the two circles rotate independently, maintaining their perpendicular relationship

Scenario 2: Hopf mode isoclinic rotation
- Given a Nested (Hopf) mode torus in 4D with isoclinic rotation enabled
- When observing the animation
- Then the linked circles flow through each other in a characteristic Hopf pattern

Scenario 3: Tube of Tube rotation
- Given a Tube of Tube mode torus in 4D with XW rotation
- When observing the animation
- Then the nested tube structure becomes visible as outer and inner donuts rotate

Scenario 4: Suggested rotations preset
- Given the user has Nested (Hopf) mode selected
- When the user clicks "Suggested rotations"
- Then rotation planes are set to values that best demonstrate the Hopf fibration (e.g., XY and ZW both animated)

---

## Specification Summary

**Feature**: Clifford Torus Visualization Modes
**User Stories (Jira Tickets)**: 10
**Acceptance Criteria**: 96 total
**Test Scenarios**: 47 total

### Stories Overview

| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Select Visualization Mode | User | ~1 day | None |
| 2 | Mode Availability Based on Dimension | User | ~0.5 days | Story 1 |
| 3 | Automatic Mode Switching | User | ~0.5 days | Story 2 |
| 4 | Flat Mode Configuration | User | ~0.5 days | Story 1 (existing implementation) |
| 5 | Nested (Hopf) Mode - 4D | User | ~1.5 days | Story 1 |
| 6 | Nested (Hopf) Mode - 8D | User | ~2 days | Story 1, Story 5 |
| 7 | Tube of Tube Mode Configuration | User | ~2 days | Story 1 |
| 8 | Performance Optimization | System | ~1 day | Stories 5, 6, 7 |
| 9 | Visual Properties Per Mode | User | ~0.5 days | Stories 4, 5, 6, 7 |
| 10 | Rotation Behavior Per Mode | User | ~0.5 days | Stories 4, 5, 6, 7 |

### Coverage

- Happy paths: 22
- Error handling: 5
- Edge cases: 12
- Permission/access: 0 (no auth required)
- System behavior: 8

### Placeholders Requiring Confirmation

- None - specifications based on mathematical definitions

### Open Questions

- None - mathematical foundations are well-established

### Dependencies Between Stories

- Story 1 (mode selector) is prerequisite for all other stories
- Stories 2-3 (availability logic) should follow Story 1
- Stories 5-7 (mode implementations) can be developed in parallel after Story 1
- Stories 8-10 depend on at least one mode implementation

### Implementation Notes

**File locations (based on existing architecture):**
- Types: `src/lib/geometry/extended/types.ts`
- Store: `src/stores/extendedObjectStore.ts`
- UI: `src/components/sidebar/` (appropriate panel)
- Generators:
  - `src/lib/geometry/extended/clifford-torus/nested.ts` (new)
  - `src/lib/geometry/extended/clifford-torus/tube-of-tube.ts` (new)
  - `src/lib/geometry/extended/clifford-torus/index.ts` (update dispatcher)

**Backward Compatibility:**
- "Flat" mode exactly preserves current behavior
- Default mode is "Flat"
- Existing configurations load as "Flat" mode

### Ready for Development: YES
