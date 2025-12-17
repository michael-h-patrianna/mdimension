# Schrödinger Upgrade 13: Atmospheric Depth Integration

## Overview

**Feature**: Scene Fog Integration for Volumetric Objects
**Priority**: Medium
**Performance Impact**: Minimal (~1% overhead)
**Tier**: 1 (Free improvements - do first)

## Problem Statement

The current Schrödinger volumetric rendering doesn't integrate with the scene's atmospheric fog system. When fog is enabled in the scene, solid objects naturally fade into the fog at distance, but the Schrödinger volume may appear disconnected from this atmosphere. Proper atmospheric integration creates sense of scale and grounds the object in the scene.

## Expected Outcome

The Schrödinger object should naturally blend into scene fog at distance, matching how other scene elements interact with atmosphere. This creates depth cues for large objects and ensures visual consistency with the scene environment.

---

## User Story 1: Enable Scene Fog Integration

**User story:** As a user viewing the Schrödinger object in a foggy scene, I want the object to fade into the fog at distance so that it appears naturally integrated with the environment.

**Acceptance criteria**
1. When scene fog is enabled, the Schrödinger object fades into fog at distance
2. The fog integration uses the scene's fog color and density settings
3. Distant parts of the volume are more affected by fog than near parts
4. The effect creates consistent atmosphere with other scene objects
5. The fog blends with the volume's own color and alpha
6. Large objects show visible depth fog variation across their extent
7. The integration is automatic when scene fog is active

**Test scenarios**

Scenario 1: Basic fog integration
- Given scene fog is enabled with visible density
- When viewing the Schrödinger object at moderate distance
- Then the object shows fog blending, especially in distant regions

Scenario 2: Fog color matching
- Given scene fog is set to a blue-gray color
- When viewing the fogged Schrödinger object
- Then the fog tinting matches the scene fog color

Scenario 3: Distance-based fog gradient
- Given a large Schrödinger object that spans significant depth
- When viewing the object
- Then the far side is more fogged than the near side

Scenario 4: No fog scene comparison
- Given scene fog is disabled
- When viewing the Schrödinger object
- Then no atmospheric fog effect is applied

Scenario 5: Consistency with solid objects
- Given scene fog is enabled and there are both the Schrödinger object and solid meshes
- When viewing the scene
- Then fog affects both similarly at comparable distances

---

## User Story 2: Fog Contribution Control

**User story:** As a user, I want to control how much scene fog affects the Schrödinger object so that I can balance integration with visibility.

**Acceptance criteria**
1. A "Fog Contribution" or "Atmospheric Density" control is available
2. The control accepts values from 0.0 to 2.0
3. Value 0.0 completely ignores scene fog (object is unaffected)
4. Value 1.0 applies fog identically to other scene objects (default)
5. Values above 1.0 exaggerate fog effect for artistic purposes
6. Changes update the rendering in real-time
7. The control is in the environment/atmosphere section of settings

**Test scenarios**

Scenario 1: Default fog contribution
- Given scene fog is enabled
- When viewing the fog contribution control
- Then it displays value 1.0

Scenario 2: Zero fog contribution
- Given the user sets fog contribution to 0.0
- When viewing the object in a foggy scene
- Then the object appears without fog (stands out from environment)

Scenario 3: Exaggerated fog contribution
- Given the user sets fog contribution to 1.5
- When viewing the object in a foggy scene
- Then the object is more affected by fog than other objects

Scenario 4: Subtle fog contribution
- Given the user sets fog contribution to 0.3
- When viewing the object in a foggy scene
- Then mild fog integration is visible but object remains mostly clear

---

## User Story 3: Per-Sample vs. Post-Composite Fog

**User story:** As a user, I want to choose between fog applied during raymarching or after compositing so that I can balance quality with performance.

**Acceptance criteria**
1. A "Fog Mode" selector offers: Per-Sample, Post-Composite
2. Per-Sample: Fog is applied at each raymarch sample (higher quality, depth-accurate)
3. Post-Composite: Fog is applied to final composited color (faster, less accurate)
4. Per-Sample creates proper fog inside the volume (not just at surface)
5. Post-Composite may show artifacts with very large volumes
6. Default is Post-Composite for performance
7. Tooltip explains the quality/performance tradeoff

**Test scenarios**

Scenario 1: Default fog mode
- Given scene fog is enabled
- When viewing the fog mode control
- Then "Post-Composite" is selected

Scenario 2: Per-sample fog quality
- Given the user selects Per-Sample fog mode
- When viewing a large volume with significant depth
- Then fog correctly varies through the interior of the volume

Scenario 3: Post-composite artifacts
- Given Post-Composite fog mode is used on a very large volume
- When viewing through the volume
- Then interior depth fog may be less accurate (acceptable tradeoff)

Scenario 4: Performance difference
- Given the user switches between Per-Sample and Post-Composite
- When monitoring frame rate
- Then Per-Sample shows slightly lower performance

---

## User Story 4: Object-Space Fog Effect

**User story:** As a user, I want an optional object-space fog effect so that the volume has internal depth fog independent of camera distance.

**Acceptance criteria**
1. An "Internal Fog" toggle is available separately from scene fog
2. When enabled, the volume's interior fades based on depth within the volume
3. This creates sense of scale for the volume itself
4. Internal fog color and density are independently configurable
5. The effect works regardless of scene fog settings
6. Useful for creating "mysterious depth" within the object

**Test scenarios**

Scenario 1: Enable internal fog
- Given internal fog is enabled
- When viewing the Schrödinger object
- Then the interior/far-side of the volume appears hazier than the near side

Scenario 2: Internal fog without scene fog
- Given scene fog is disabled but internal fog is enabled
- When viewing the object
- Then internal depth haze is visible within the volume

Scenario 3: Internal fog color
- Given internal fog is enabled with a purple tint
- When viewing the object interior
- Then the internal haze appears purple

Scenario 4: Combined internal and scene fog
- Given both scene fog and internal fog are enabled
- When viewing the object
- Then both effects combine (scene fog at distance + internal fog through volume)

---

## User Story 5: Fog Integration Toggle

**User story:** As a user, I want to easily enable/disable scene fog integration so that I can compare the object with and without atmospheric effects.

**Acceptance criteria**
1. Scene fog integration has an enable/disable toggle
2. The toggle is ON by default (integrate with scene fog when present)
3. When disabled, the object ignores scene fog completely
4. Other fog-related controls are hidden or grayed when disabled
5. The toggle is in the environment/atmosphere settings section
6. Tooltip: "When enabled, object fades into scene fog at distance"

**Test scenarios**

Scenario 1: Default state (enabled)
- Given scene fog is active
- When viewing the fog integration toggle
- Then it is enabled (ON)

Scenario 2: Disable fog integration
- Given fog integration is enabled and fog is visible
- When the user disables fog integration
- Then the object no longer fades into scene fog

Scenario 3: Controls visibility
- Given fog integration is disabled
- When viewing the settings
- Then fog-related controls (contribution, mode) are hidden or grayed

---

## Specification Summary

**Feature**: Atmospheric Depth Integration / Scene Fog
**User Stories (Jira Tickets)**: 5
**Acceptance Criteria**: 30
**Test Scenarios**: 19

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Enable Scene Fog Integration | User/Viewer | ~1 day | None |
| 2 | Fog Contribution Control | User | ~0.5 days | Story 1 |
| 3 | Per-Sample vs. Post-Composite Fog | User | ~0.5 days | Story 1 |
| 4 | Object-Space Fog Effect | User | ~1 day | None (independent) |
| 5 | Fog Integration Toggle | User | ~0.5 days | Story 1 |

### Coverage
- Happy paths: 12
- Error handling: 0
- Edge cases: 4
- Permission/access: 0
- System behavior: 3

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should fog integration read from existing SceneFog component automatically?
- Should internal fog support animated density (breathing/pulsing)?

### Dependencies Between Stories
- Stories 2, 3, 5 depend on Story 1
- Story 4 is independent (object-space fog)

### Ready for Development: YES
