# Schrödinger Upgrade 05: Detail Noise Erosion

## Overview

**Feature**: Edge Detail Enhancement via 3D Noise Erosion
**Priority**: Medium
**Performance Impact**: Moderate (~10-15% overhead)
**Tier**: 3 (Moderate - Quality option)

## Problem Statement

The current Schrödinger density field produces mathematically smooth surfaces based on Hermite polynomial Gaussians. While mathematically beautiful, this creates a "CGI smooth blob" appearance that lacks the organic, turbulent detail of natural phenomena like clouds, smoke, or nebulae. Real volumetric media have detailed, wispy edges due to turbulence.

## Expected Outcome

Volume edges should exhibit organic, cloud-like detail with wisps, tendrils, and turbulent structure. This breaks up the smooth silhouette while preserving the core quantum probability structure. The technique is proven in AAA volumetric cloud rendering (Horizon Zero Dawn).

---

## User Story 1: Enable Edge Noise Erosion

**User story:** As a user viewing the Schrödinger object, I want volume edges to have detailed, organic structure so that the object appears more natural and visually interesting.

**Acceptance criteria**
1. Volume silhouettes show turbulent, irregular detail instead of smooth curves
2. The erosion creates wisps, tendrils, and cloud-like structures at edges
3. The core dense regions maintain their quantum probability structure
4. Erosion intensity is strongest at low-density edges, minimal in dense cores
5. The noise pattern tiles seamlessly without visible repetition
6. The detail adds visual interest without overwhelming the base shape
7. Different viewing angles show consistent (not random per-frame) detail

**Test scenarios**

Scenario 1: Edge detail visibility
- Given the Schrödinger object is rendered with edge noise erosion enabled
- When the user views the object silhouette
- Then edges show irregular, detailed structure instead of smooth mathematical curves

Scenario 2: Core preservation
- Given edge noise erosion is enabled
- When viewing the dense central regions of the object
- Then the core shape is largely preserved with minimal noise distortion

Scenario 3: Wisp formation
- Given edge noise erosion is enabled with appropriate settings
- When viewing thin regions of the object
- Then wispy, tendril-like structures are visible extending from the main body

Scenario 4: Temporal consistency
- Given the camera is stationary and animation is paused
- When viewing the object with edge noise erosion
- Then the detail pattern remains stable (not flickering or changing randomly)

Scenario 5: Seamless tiling
- Given a large Schrödinger object that spans multiple noise tile periods
- When viewing the object
- Then no visible repetition or seam artifacts are present in the noise pattern

---

## User Story 2: Erosion Strength Control

**User story:** As a user, I want to control how much noise erosion affects the edges so that I can achieve appearances from subtle detail to dramatic turbulence.

**Acceptance criteria**
1. An "Edge Detail" or "Erosion Strength" control is available in Schrödinger settings
2. The control accepts values from 0.0 to 1.0
3. Value 0.0 completely disables erosion (smooth mathematical edges)
4. Value 0.3 is the default providing subtle detail
5. Value 1.0 creates heavily eroded, very turbulent edges
6. Changes update the rendering in real-time
7. The control is grouped with other appearance settings

**Test scenarios**

Scenario 1: Default erosion strength
- Given the Schrödinger object is rendered with default settings
- When viewing the erosion strength control
- Then it displays value 0.3

Scenario 2: Zero erosion (disabled)
- Given the user sets erosion strength to 0.0
- When viewing the object
- Then edges appear smooth as in the original mathematical form

Scenario 3: Maximum erosion
- Given the user sets erosion strength to 1.0
- When viewing the object
- Then edges are heavily broken up with dramatic turbulent structure

Scenario 4: Subtle erosion
- Given the user sets erosion strength to 0.15
- When viewing the object
- Then edges show gentle detail without significantly changing the overall shape

---

## User Story 3: Detail Scale Control

**User story:** As a user, I want to control the scale of edge detail so that I can have fine wisps or larger turbulent structures.

**Acceptance criteria**
1. A "Detail Scale" control is available when edge erosion is active
2. The control accepts values from 0.25 to 4.0 (relative scale)
3. Value 1.0 is the default scale
4. Values below 1.0 create finer, more detailed turbulence
5. Values above 1.0 create larger, chunkier turbulent structures
6. Scale affects the spatial frequency of the noise pattern
7. Changes update the rendering in real-time

**Test scenarios**

Scenario 1: Default detail scale
- Given edge erosion is enabled with default settings
- When viewing the detail scale control
- Then it displays value 1.0

Scenario 2: Fine detail scale
- Given the user sets detail scale to 0.5
- When viewing the object edges
- Then turbulent detail appears finer and more intricate

Scenario 3: Large detail scale
- Given the user sets detail scale to 3.0
- When viewing the object edges
- Then turbulent structures are larger and more sweeping

Scenario 4: Scale independence from erosion strength
- Given the user adjusts detail scale while erosion strength remains constant
- When viewing the object
- Then the amount of erosion stays similar but the pattern scale changes

---

## User Story 4: Curl Noise Distortion

**User story:** As a user, I want the detail noise to be distorted by curl noise so that wisps have swirling, turbulent motion rather than static patterns.

**Acceptance criteria**
1. A "Turbulence" or "Swirl" control is available when edge erosion is active
2. The control accepts values from 0.0 to 1.0
3. Value 0.0 applies noise directly without distortion
4. Value 0.5 is the default providing gentle swirling patterns
5. Value 1.0 creates highly distorted, chaotic swirling structures
6. Curl noise creates non-divergent (physically plausible) distortion patterns
7. The swirl pattern can optionally animate over time

**Test scenarios**

Scenario 1: Default turbulence
- Given edge erosion is enabled with default settings
- When viewing the turbulence control
- Then it displays value 0.5

Scenario 2: No turbulence (direct noise)
- Given the user sets turbulence to 0.0
- When viewing the object edges
- Then detail pattern appears more regular/grid-aligned

Scenario 3: High turbulence
- Given the user sets turbulence to 1.0
- When viewing the object edges
- Then detail patterns appear highly swirled and chaotic

Scenario 4: Animated swirl (optional)
- Given turbulence is enabled and animation is active
- When viewing the object over time
- Then swirl patterns slowly evolve, creating flowing turbulence effect

---

## User Story 5: Noise Type Selection

**User story:** As a user, I want to choose between different noise types so that I can achieve different edge styles (cloudy, crystalline, organic).

**Acceptance criteria**
1. A "Noise Type" selector is available when edge erosion is active
2. Available types include: Worley (default), Perlin, Perlin-Worley hybrid, Simplex
3. Worley produces "puffy" cloud-like detail (billowy, rounded)
4. Perlin produces smoother, flowing detail (smoke-like)
5. Perlin-Worley produces connected billows (classic cloud look)
6. Simplex produces organic, natural turbulence
7. Changing noise type updates the rendering in real-time

**Test scenarios**

Scenario 1: Default noise type
- Given edge erosion is enabled with default settings
- When viewing the noise type selector
- Then "Worley" is selected

Scenario 2: Perlin noise appearance
- Given the user selects Perlin noise type
- When viewing the object edges
- Then detail appears smoother and more flowing than Worley

Scenario 3: Perlin-Worley hybrid appearance
- Given the user selects Perlin-Worley hybrid noise type
- When viewing the object edges
- Then detail shows connected, billowy structures

Scenario 4: Noise type switching
- Given the user changes noise type while viewing the object
- When the change is applied
- Then the edge detail pattern changes to reflect the new noise type

---

## Specification Summary

**Feature**: Detail Noise Erosion at Volume Edges
**User Stories (Jira Tickets)**: 5
**Acceptance Criteria**: 30
**Test Scenarios**: 20

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Edge Noise Erosion | User/Viewer | ~1.5 days | None |
| 2 | Erosion Strength Control | User | ~0.5 days | Story 1 |
| 3 | Detail Scale Control | User | ~0.5 days | Story 1 |
| 4 | Curl Noise Distortion | User | ~1 day | Story 1 |
| 5 | Noise Type Selection | User | ~1 day | Story 1 |

### Coverage
- Happy paths: 12
- Error handling: 0
- Edge cases: 4
- Permission/access: 0
- System behavior: 4

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should noise textures be generated at runtime or pre-baked as assets?
- Should there be "inverted Worley at base" option for wispy bottom edges (per HZD)?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 being completed first
- Stories 2-5 are independent of each other

### Ready for Development: YES
