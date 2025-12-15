# Coupled-Map Fractals (Small ND Dynamical Systems)

## Overview

**Feature**: Coupled-Map Fractals - A "fractal-ish" approach using coupled nonlinear maps in N dimensions, producing extremely organic procedural dynamical sculptures. Iterate a coupled map system and render isosurfaces of orbit density or potential.

**Core concept**: Each dimension influences others through a coupling matrix: `z_{n+1} = f(A * z_n + b)` where f is nonlinear (tanh, sin, logistic-like). The resulting field creates flowing, organic structures.

**Why it morphs well**: The coupling matrix creates strong inter-dimensional dependencies, so rotating the slice changes how dimensions interact and produces dramatic visual evolution.

**Reference**: See `docs/prd/extended-fractal-types.md` Section 7 for mathematical foundation.

---

## Specification Summary

**Feature**: Coupled-Map Fractal Renderer
**User Stories (Jira Tickets)**: 15
**Estimated Total Effort**: ~26 man-days

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Core Coupled-Map Renderer | Developer | ~2.5 days | None |
| 2 | Coupling Matrix Configuration | User | ~2 days | Story 1 |
| 3 | Nonlinearity Function Selection | User | ~1.5 days | Story 1 |
| 4 | Bias Vector Configuration | User | ~1 day | Story 1 |
| 5 | Orbit Accumulation Modes | User | ~2 days | Story 1 |
| 6 | Isosurface Threshold Control | User | ~1 day | Story 1 |
| 7 | D-Dimensional Rotation System | User | ~2 days | Story 1 |
| 8 | Lighting System Integration | User | ~2 days | Story 1 |
| 9 | Shadow System Integration | User | ~1.5 days | Story 8 |
| 10 | Color Algorithm System | User | ~2 days | Story 1, 5 |
| 11 | Opacity/Transparency Modes | User | ~2 days | Story 1 |
| 12 | Animation System - Coupling Strength | User | ~1.5 days | Story 2 |
| 13 | Animation System - Bias Path | User | ~1.5 days | Story 4 |
| 14 | Animation System - Nonlinearity Gain | User | ~1.5 days | Story 3 |
| 15 | Performance & Quality Controls | User | ~1.5 days | Story 1 |

---

## User Story 1: Core Coupled-Map Renderer

**User story:** As a user, I want to view a Coupled-Map fractal so that I can explore organic dynamical system sculptures.

**Acceptance criteria**
1. User can select "Coupled Map" from the fractal type selector
2. When selected, the viewport displays a 3D slice through the N-dimensional coupled-map field
3. Field computation: iterate coupled map, accumulate orbit density or potential
4. Default formula: `z = tanh(A * z + b)` where A is coupling matrix, b is bias
5. Iteration count defaults to 30
6. Dimension selector: 3D-11D (default: 4D)
7. Accumulation mode defaults to "Exponential density": `acc += exp(-k * dot(z,z))`
8. Isosurface rendering of accumulated field
9. Raymarch with safety factor (0.5) since field is not true SDF
10. Frame rate remains above 30fps at default quality

**Test scenarios**

Scenario 1: Select Coupled-Map fractal type
- Given the user is viewing any fractal
- When the user selects "Coupled Map" from dropdown
- Then the viewport displays flowing organic structures

Scenario 2: Default configuration
- Given default settings (tanh nonlinearity, identity-like coupling)
- When the fractal renders
- Then smooth, organic blob-like structures appear

Scenario 3: Change dimension
- Given 4D Coupled-Map fractal
- When the user changes dimension to 6D
- Then additional dimensional coupling creates more complex structures

Scenario 4: Rendering stability
- Given raymarching the field
- When samples are taken
- Then field values are bounded and rendering is stable

---

## User Story 2: Coupling Matrix Configuration

**User story:** As a user, I want to configure the coupling matrix so that I can control how dimensions interact.

**Acceptance criteria**
1. Coupling matrix panel displays the N×N matrix A
2. Two configuration modes:
   - "Simple": Global coupling strength slider (0.0-2.0, default: 0.7) + structure presets
   - "Advanced": Individual matrix element sliders
3. Structure presets (Simple mode):
   - "Identity": Minimal coupling (near-independent dimensions)
   - "Full": All dimensions equally coupled
   - "Nearest-Neighbor": Each dimension couples only to adjacent dimensions
   - "Ring": Circular coupling pattern
   - "Random": Randomized coupling with controlled density
4. For Advanced mode:
   - Matrix displayed as grid of sliders
   - Each element range: -1.5 to 1.5
   - "Symmetrize" toggle: Forces A = Aᵀ
   - "Normalize" toggle: Scales matrix to prevent explosion
5. Matrix visualization: Small heatmap showing coupling strength
6. Tooltip: "The coupling matrix controls how each dimension influences others during iteration"

**Test scenarios**

Scenario 1: Adjust global coupling strength
- Given Simple mode with strength 0.7
- When the user increases strength to 1.2
- Then structures become more interconnected and complex

Scenario 2: Load structure preset
- Given Identity structure (minimal coupling)
- When the user selects "Ring" preset
- Then coupling changes and structures show circular dependency patterns

Scenario 3: Advanced matrix editing
- Given Advanced mode enabled
- When the user sets A[0][1] = 0.8 and A[1][0] = -0.8
- Then dimensions 0 and 1 have asymmetric coupling creating spiral structures

Scenario 4: Random coupling
- Given any coupling configuration
- When the user selects "Random" preset
- Then matrix elements randomize within stable range

Scenario 5: Normalize for stability
- Given matrix with large elements
- When the user enables "Normalize"
- Then matrix scales to prevent iteration explosion

---

## User Story 3: Nonlinearity Function Selection

**User story:** As a user, I want to choose and configure the nonlinear function so that I can control the character of the dynamics.

**Acceptance criteria**
1. Nonlinearity function dropdown:
   - "Tanh (Soft Saturation)": z = tanh(gain * y), smooth bounded
   - "Sin (Periodic)": z = sin(gain * y), oscillatory patterns
   - "Cubic (Soft)": z = y - y³, smooth with soft saturation
   - "Logistic": z = 4 * y * (1 - y), classic chaos map
   - "ReLU-like": z = max(0, y) with optional leak
2. Gain/intensity slider (0.5-3.0, default: 1.0)
3. For "ReLU-like": Leak factor slider (0.0-0.3, default: 0.1)
4. Per-component gain toggle (advanced): Different gain per dimension
5. Tooltip: "The nonlinearity determines how values saturate and fold"

**Test scenarios**

Scenario 1: Switch to sin function
- Given tanh nonlinearity
- When the user selects "Sin (Periodic)"
- Then structures become more wave-like and periodic

Scenario 2: Increase gain
- Given gain is 1.0
- When the user increases gain to 2.0
- Then structures become sharper with more contrast

Scenario 3: Cubic soft dynamics
- Given any nonlinearity
- When the user selects "Cubic (Soft)"
- Then structures become very smooth and flowing

Scenario 4: Per-component gain
- Given uniform gain 1.0
- When the user enables per-component gain and sets dimension 0 to 2.0
- Then structures elongate along dimension 0

---

## User Story 4: Bias Vector Configuration

**User story:** As a user, I want to configure the bias vector so that I can shift and offset the dynamics.

**Acceptance criteria**
1. Bias vector panel displays sliders for each dimension
2. Each bias component range: -1.0 to 1.0 (default: 0.0)
3. "Lock Components" toggle: All bias values move together
4. "Randomize" button: Generates random bias within stable range
5. Bias presets:
   - "Center": All zeros (symmetric dynamics)
   - "Offset": Small uniform positive bias
   - "Asymmetric": Random per-dimension bias
6. Tooltip: "Bias shifts the equilibrium point of the dynamics"

**Test scenarios**

Scenario 1: Add uniform bias
- Given all bias components at 0
- When the user selects "Offset" preset (all = 0.2)
- Then structures shift off-center

Scenario 2: Per-dimension bias
- Given uniform bias
- When the user sets b[0] = 0.5, b[1] = -0.3, others = 0
- Then asymmetric structures appear

Scenario 3: Lock components
- Given "Lock Components" enabled
- When the user moves any bias slider to 0.3
- Then all bias components update to 0.3

---

## User Story 5: Orbit Accumulation Modes

**User story:** As a user, I want to choose how orbit information is accumulated so that I can create different field characteristics.

**Acceptance criteria**
1. Accumulation mode dropdown:
   - "Exponential Density": acc += exp(-k * dot(z,z)), density near origin
   - "Distance Minimum": acc = min(acc, length(z - trap)), closest approach to trap
   - "Orbit Average": acc = average of |z| over iterations
   - "Lyapunov": acc based on trajectory divergence rate
   - "Recurrence": acc based on how often orbit returns near starting point
2. For "Exponential Density":
   - Decay rate k slider (1.0-10.0, default: 3.0)
3. For "Distance Minimum":
   - Trap position sliders (N-dimensional)
4. For "Orbit Average":
   - Weighting: Uniform, Early-weighted, Late-weighted
5. Accumulation preview: Shows field slice for tuning
6. Tooltip explains what each mode measures

**Test scenarios**

Scenario 1: Exponential density mode
- Given any accumulation mode
- When the user selects "Exponential Density" with k=3.0
- Then structures appear where orbits spend time near origin

Scenario 2: Distance minimum to trap
- Given "Distance Minimum" mode
- When the user positions trap at (0.5, 0, 0, 0)
- Then structures appear where orbit passes close to the trap point

Scenario 3: Adjust decay rate
- Given Exponential Density with k=3.0
- When the user increases k to 8.0
- Then structures become tighter/sharper around attracting regions

Scenario 4: Lyapunov mode
- Given any mode
- When the user selects "Lyapunov"
- Then chaotic regions appear brighter (more divergent)

---

## User Story 6: Isosurface Threshold Control

**User story:** As a user, I want to adjust the isosurface threshold so that I can control how the accumulated field becomes a surface.

**Acceptance criteria**
1. Isosurface threshold slider (0.01-2.0, default: 0.3)
2. Lower threshold: More of the field becomes surface (thicker structures)
3. Higher threshold: Less becomes surface (thinner, more selective)
4. "Auto-threshold" toggle: Adjusts based on field statistics
5. Invert toggle: Render where field is BELOW threshold instead of above
6. Tooltip: "Threshold determines where the accumulated field becomes a visible surface"

**Test scenarios**

Scenario 1: Lower threshold for thicker structures
- Given threshold 0.3
- When the user decreases to 0.1
- Then more volume renders as surface, structures become thicker

Scenario 2: Higher threshold for delicate structures
- Given threshold 0.3
- When the user increases to 0.8
- Then only high-accumulation regions render, creating delicate wisps

Scenario 3: Invert rendering
- Given normal rendering (above threshold)
- When the user enables "Invert"
- Then the complement is rendered (voids become solid, solids become void)

---

## User Story 7: D-Dimensional Rotation System

**User story:** As a user, I want to rotate the N-dimensional slice so that I can explore different cross-sections of the coupled dynamics.

**Acceptance criteria**
1. Rotation controls for all planes based on dimension
2. Each rotation slider: 0° to 360°
3. Rotation changes which dimensional couplings are visible in 3D
4. "Reset Rotations" button
5. Basis vectors sent to shader

**Test scenarios**

Scenario 1: Rotate to see different coupling
- Given 4D coupled-map with XW rotation at 0°
- When the user rotates XW by 45°
- Then the visible structure changes as different coupling becomes dominant

Scenario 2: High-dimensional rotation
- Given 6D coupled-map
- When multiple high-D planes are rotated
- Then complex interplay of couplings becomes visible

---

## User Story 8: Lighting System Integration

**User story:** As a user, I want lighting controls so that the organic coupled-map structures are well-illuminated.

**Acceptance criteria**
1. All standard lighting parameters
2. Coupled-map specific: Higher ambient (0.35) for soft organic feel
3. Multi-light system (up to 4 lights)
4. Tone mapping and Fresnel rim lighting
5. Normals via numerical gradient of accumulated field

**Test scenarios**

Scenario 1: Soft ambient for organic look
- Given default lighting
- When ambient is increased to 0.5
- Then soft organic structures appear more natural

Scenario 2: Rim lighting for edges
- Given flowing organic structures
- When Fresnel rim is enabled at 0.8
- Then structure edges glow subtly

---

## User Story 9: Shadow System Integration

**User story:** As a user, I want shadows so that the layered organic structures show depth.

**Acceptance criteria**
1. Shadow controls (same as Hyperbulb)
2. Soft shadows particularly suited to organic coupled-map structures
3. Shadows help define depth in flowing structures

**Test scenarios**

Scenario 1: Soft shadows for organic depth
- Given shadows disabled
- When the user enables shadows with softness 1.5
- Then organic structures gain depth without harsh edges

---

## User Story 10: Color Algorithm System

**User story:** As a user, I want coloring that emphasizes the dynamical nature of coupled-map structures.

**Acceptance criteria**
1. All 8 standard color algorithms
2. Coupled-map specific coloring modes:
   - "Orbit Energy": Color based on accumulated energy/density
   - "Divergence": Color based on local trajectory divergence
   - "Component Dominance": Color based on which dimension dominates
3. Cosine gradient presets:
   - "Plasma Flow" (orange-purple gradient)
   - "Deep Ocean" (blue-green with highlights)
   - "Aurora" (green-purple-pink)
   - "Thermal" (heat-map style)
4. Smooth color transitions for organic appearance

**Test scenarios**

Scenario 1: Orbit energy coloring
- Given any coloring mode
- When the user selects "Orbit Energy"
- Then high-density regions show warmer/brighter colors

Scenario 2: Component dominance coloring
- Given 4D coupled-map
- When the user selects "Component Dominance"
- Then different regions show which dimension (x, y, z, w) has largest magnitude

Scenario 3: Plasma flow preset
- Given cosine gradient mode
- When the user selects "Plasma Flow"
- Then flowing structures show dynamic orange-purple coloring

---

## User Story 11: Opacity/Transparency Modes

**User story:** As a user, I want transparency so that I can see the layered nature of coupled-map structures.

**Acceptance criteria**
1. All 4 opacity modes
2. Coupled-map specific: Volumetric rendering particularly effective
3. Layered surfaces show nested attractor structure
4. Volumetric creates flowing fog effect

**Test scenarios**

Scenario 1: Volumetric coupled-map
- Given Solid mode
- When the user selects Volumetric Density with density 0.7
- Then structures appear as flowing colored fog

Scenario 2: Layered attractor shells
- Given any mode
- When the user selects Layered Surfaces with 4 layers
- Then nested attractor structure is revealed

---

## User Story 12: Animation System - Coupling Strength

**User story:** As a user, I want to animate the coupling strength so that the dynamics vary over time.

**Acceptance criteria**
1. Coupling strength animation toggle (default: off)
2. Strength oscillation range (0.3-1.5 min, 0.5-2.0 max)
3. Oscillation speed (0.01-0.1 Hz, default: 0.02)
4. Per-element animation (advanced): Different matrix elements animate independently
5. Presets:
   - "Breathing": Global strength pulses
   - "Wave": Coupling varies in wave pattern across matrix
   - "Random Walk": Slow random variation

**Test scenarios**

Scenario 1: Enable strength animation
- Given coupling strength animation disabled
- When the user enables "Breathing" preset
- Then global coupling strength pulses and structures expand/contract

Scenario 2: Wave animation
- Given any animation
- When the user selects "Wave"
- Then coupling variations travel through the matrix creating flowing motion

---

## User Story 13: Animation System - Bias Path

**User story:** As a user, I want to animate the bias vector so that the dynamics shift through parameter space.

**Acceptance criteria**
1. Bias animation toggle (default: off)
2. Animation path options:
   - "Circular": Bias traces circle in ND
   - "Lissajous": Complex multi-frequency path
   - "Drift": Slow bounded random walk
3. Path amplitude (0.1-0.5, default: 0.2)
4. Path frequency (0.01-0.1 Hz, default: 0.02)
5. Per-dimension phase offsets

**Test scenarios**

Scenario 1: Circular bias path
- Given bias animation disabled
- When the user enables "Circular" with amplitude 0.3
- Then structures shift as equilibrium point moves in circle

Scenario 2: Lissajous complex path
- Given any bias animation
- When the user selects "Lissajous"
- Then bias traces complex path and structures morph intricately

---

## User Story 14: Animation System - Nonlinearity Gain

**User story:** As a user, I want to animate the nonlinearity gain so that structure sharpness varies.

**Acceptance criteria**
1. Gain animation toggle (default: off)
2. Gain oscillation range (0.5-1.5 min, 1.0-2.5 max)
3. Oscillation speed (0.01-0.1 Hz, default: 0.015)
4. Per-dimension gain animation (advanced)
5. Smooth interpolation

**Test scenarios**

Scenario 1: Enable gain animation
- Given gain animation disabled
- When the user enables with range 0.7-1.5
- Then structures oscillate between soft and sharp

Scenario 2: Per-dimension gain animation
- Given uniform gain animation
- When the user enables per-dimension with different phases
- Then different dimensions sharpen/soften at different times

---

## User Story 15: Performance & Quality Controls

**User story:** As a user, I want quality controls accounting for coupled-map field computation.

**Acceptance criteria**
1. Quality presets: Draft, Standard, High, Ultra
2. Iteration count slider (10-100, default: 30)
3. Field safety factor slider (0.3-0.8, default: 0.5)
4. Quality multiplier (0.25-1.0)
5. Adaptive quality toggle
6. Gradient computation: "Fast" (2-point) or "Accurate" (6-point)
7. Parameter sensitivity warning: Small parameter changes can dramatically affect performance

**Test scenarios**

Scenario 1: Adjust iteration count
- Given 30 iterations
- When the user increases to 60
- Then field detail increases with computation cost

Scenario 2: Adjust safety factor
- Given safety factor 0.5
- When the user increases to 0.7
- Then rendering is faster but may have more artifacts

Scenario 3: Adaptive quality during rotation
- Given adaptive quality enabled
- When the user rotates the camera
- Then quality reduces during motion

---

## Placeholders Requiring Confirmation
- Optimal default coupling matrix structure
- Recommended iteration counts for different nonlinearities
- Performance characteristics of different accumulation modes

## Open Questions
- Should there be a "chaos indicator" showing Lyapunov exponent in real-time?
- Should coupling matrix support complex values for richer dynamics?
- Should there be preset "attractor types" (Lorenz-like, Rossler-like)?

## Dependencies Between Stories
- Stories 2-6, 7, 8, 10, 11 can be developed in parallel after Story 1
- Story 9 depends on Story 8
- Story 10 partially depends on Story 5 for accumulation data
- Stories 12-14 depend on their respective parameter stories

## Ready for Development: YES
