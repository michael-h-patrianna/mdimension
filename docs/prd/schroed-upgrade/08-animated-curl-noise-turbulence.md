# Schrödinger Upgrade 08: Animated Curl Noise Turbulence

## Overview

**Feature**: Dynamic Flow Field Animation via Curl Noise
**Priority**: Medium
**Performance Impact**: Moderate (~15-20% overhead)
**Tier**: 3 (Moderate - Quality option)

## Problem Statement

While the Schrödinger wavefunction already animates via phase evolution, the visual motion is subtle and mathematical. The object lacks the dynamic, "living" quality of real volumetric phenomena where visible flow and turbulence create mesmerizing motion. Adding animated turbulence would significantly enhance viewer engagement.

## Expected Outcome

The volume should exhibit visible flow patterns that make it appear as if energy or gas is flowing through and around the quantum probability structure. Using curl noise (which produces divergence-free, physically plausible flow) ensures the motion looks natural rather than chaotic. This transforms a static visualization into a living, breathing entity.

---

## User Story 1: Enable Animated Flow Field

**User story:** As a user viewing the Schrödinger object, I want the volume to exhibit visible flowing motion so that it appears alive and dynamic like a nebula or energy cloud.

**Acceptance criteria**
1. When flow animation is enabled, visible swirling/streaming patterns move through the volume
2. The flow creates appearance of energy or gas moving through the object
3. Flow patterns are smooth and continuous, not random jittering
4. The flow distorts the density field creating dynamic shape changes at edges
5. The base quantum structure remains recognizable despite flow distortion
6. Flow animation is independent of and combines with wavefunction phase animation
7. The motion creates an engaging, mesmerizing visual experience

**Test scenarios**

Scenario 1: Visible flow motion
- Given flow animation is enabled
- When the user views the object over several seconds
- Then visible streaming/swirling patterns move through the volume

Scenario 2: Smooth flow continuity
- Given flow animation is enabled
- When observing the flow patterns
- Then motion is smooth and continuous, not jerky or random

Scenario 3: Edge distortion
- Given flow animation is enabled with moderate strength
- When viewing the object edges/silhouette
- Then edges visibly shift and flow over time

Scenario 4: Core preservation
- Given flow animation is enabled
- When viewing the dense central regions
- Then the core quantum structure remains recognizable

Scenario 5: Phase animation combination
- Given both flow animation and wavefunction phase animation are active
- When viewing the object
- Then both effects combine (flow distortion + phase color evolution)

---

## User Story 2: Flow Speed Control

**User story:** As a user, I want to control how fast the flow animation moves so that I can achieve effects from gentle drifting to rapid streaming.

**Acceptance criteria**
1. A "Flow Speed" control is available when flow animation is enabled
2. The control accepts values from 0.1 to 5.0 (multiplier)
3. Value 1.0 is the default providing moderate, visible flow
4. Lower values (0.1-0.5) create slow, dreamy drifting motion
5. Higher values (2.0-5.0) create rapid, energetic streaming
6. Changes update the animation speed in real-time
7. Flow speed can be linked to or independent of global time scale

**Test scenarios**

Scenario 1: Default flow speed
- Given flow animation is enabled with default settings
- When viewing the flow speed control
- Then it displays value 1.0

Scenario 2: Slow flow
- Given the user sets flow speed to 0.2
- When viewing the object
- Then flow patterns move slowly, creating a dreamy, gentle effect

Scenario 3: Fast flow
- Given the user sets flow speed to 4.0
- When viewing the object
- Then flow patterns move rapidly, creating an energetic, dynamic effect

Scenario 4: Real-time speed change
- Given flow animation is playing
- When the user adjusts the flow speed slider
- Then the animation speed changes immediately without restart

---

## User Story 3: Flow Strength Control

**User story:** As a user, I want to control how much the flow distorts the volume so that I can achieve subtle shimmer or dramatic turbulent motion.

**Acceptance criteria**
1. A "Flow Strength" or "Turbulence Intensity" control is available
2. The control accepts values from 0.0 to 1.0
3. Value 0.0 disables flow distortion (animation still runs but invisible)
4. Value 0.3 is the default providing visible but not overwhelming turbulence
5. Value 1.0 creates dramatic, highly turbulent distortion
6. Flow strength affects how much the density sampling coordinates are displaced
7. Higher strength creates more dramatic edge deformation

**Test scenarios**

Scenario 1: Default flow strength
- Given flow animation is enabled with default settings
- When viewing the flow strength control
- Then it displays value 0.3

Scenario 2: Zero flow strength
- Given the user sets flow strength to 0.0
- When viewing the object
- Then no visible distortion occurs (object appears static)

Scenario 3: Maximum flow strength
- Given the user sets flow strength to 1.0
- When viewing the object
- Then dramatic turbulent distortion creates rapidly changing shape

Scenario 4: Subtle flow strength
- Given the user sets flow strength to 0.1
- When viewing the object
- Then a gentle shimmer/undulation is visible at edges

---

## User Story 4: Flow Scale Control

**User story:** As a user, I want to control the spatial scale of flow patterns so that I can have fine swirls or large sweeping currents.

**Acceptance criteria**
1. A "Flow Scale" control is available when flow animation is enabled
2. The control accepts values from 0.25 to 4.0 (relative scale)
3. Value 1.0 is the default providing medium-scale flow patterns
4. Lower values (0.25-0.5) create larger, sweeping flow currents
5. Higher values (2.0-4.0) create smaller, more detailed swirls
6. Scale affects the spatial frequency of the curl noise field
7. Changes update the appearance in real-time

**Test scenarios**

Scenario 1: Default flow scale
- Given flow animation is enabled with default settings
- When viewing the flow scale control
- Then it displays value 1.0

Scenario 2: Large-scale flow (low value)
- Given the user sets flow scale to 0.3
- When viewing the object
- Then flow patterns appear as large, sweeping currents

Scenario 3: Small-scale flow (high value)
- Given the user sets flow scale to 3.0
- When viewing the object
- Then flow patterns appear as fine, detailed swirls

Scenario 4: Scale visual comparison
- Given the user toggles between scale 0.5 and 3.0
- When comparing the two appearances
- Then the difference in pattern size is clearly visible

---

## User Story 5: Flow Direction Bias

**User story:** As a user, I want to optionally bias the flow in a particular direction so that I can create effects like upward rising energy or radial expansion.

**Acceptance criteria**
1. A "Flow Bias" control offers options: None (default), Upward, Outward, Inward, Custom
2. None: Pure curl noise with no directional preference (default)
3. Upward: Flow has upward drift like rising smoke/energy
4. Outward: Flow moves away from object center like expansion
5. Inward: Flow moves toward object center like implosion
6. Custom: User specifies a direction vector
7. Bias strength is adjustable (how strong the directional component is)

**Test scenarios**

Scenario 1: No flow bias (default)
- Given flow animation is enabled with default settings
- When viewing the flow bias control
- Then "None" is selected

Scenario 2: Upward bias appearance
- Given the user selects Upward flow bias
- When viewing the object
- Then flow patterns have a general upward drift direction

Scenario 3: Outward bias appearance
- Given the user selects Outward flow bias
- When viewing the object
- Then flow patterns move generally away from the object center

Scenario 4: Inward bias appearance
- Given the user selects Inward flow bias
- When viewing the object
- Then flow patterns move generally toward the object center

Scenario 5: Custom direction
- Given the user selects Custom bias and sets direction to (1, 0, 1)
- When viewing the object
- Then flow patterns drift along the XZ diagonal

---

## User Story 6: Flow Animation Toggle

**User story:** As a user, I want to easily enable/disable flow animation so that I can compare the dynamic vs. static appearance.

**Acceptance criteria**
1. Flow animation has an enable/disable toggle
2. The toggle is OFF by default
3. When disabled, all flow-related controls are hidden or grayed out
4. Settings are preserved when toggling off/on
5. Disabling flow immediately stops the animation and shows undistorted density
6. Performance returns to normal when disabled

**Test scenarios**

Scenario 1: Default state (disabled)
- Given a fresh session with default settings
- When viewing the flow animation toggle
- Then it is disabled (OFF)

Scenario 2: Controls hidden when disabled
- Given flow animation is disabled
- When viewing the Schrödinger settings panel
- Then flow-related controls (speed, strength, scale, bias) are hidden or grayed

Scenario 3: Settings preservation
- Given flow animation is enabled with speed 2.0 and strength 0.5
- When the user toggles flow off then back on
- Then speed and strength settings are preserved

Scenario 4: Immediate effect on disable
- Given flow animation is enabled and visible
- When the user disables flow animation
- Then the volume immediately appears undistorted

---

## Specification Summary

**Feature**: Animated Curl Noise Turbulence / Flow Field
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 35
**Test Scenarios**: 25

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Animated Flow Field | User/Viewer | ~1.5 days | None |
| 2 | Flow Speed Control | User | ~0.5 days | Story 1 |
| 3 | Flow Strength Control | User | ~0.5 days | Story 1 |
| 4 | Flow Scale Control | User | ~0.5 days | Story 1 |
| 5 | Flow Direction Bias | User | ~1 day | Story 1 |
| 6 | Flow Animation Toggle | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 15
- Error handling: 0
- Edge cases: 5
- Permission/access: 0
- System behavior: 5

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should flow interact with wavefunction energy (higher energy = faster local flow)?
- Should there be "flow presets" for common effects (e.g., "Nebula", "Plasma", "Energy")?

### Dependencies Between Stories
- Stories 2-6 depend on Story 1 being completed first
- Stories 2-6 are independent of each other

### Ready for Development: YES
