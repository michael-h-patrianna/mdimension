# Mandelbulb Soft Shadows

## Overview

This feature adds soft shadow rendering for mandelbulb fractals with user-configurable quality and softness settings. The shadow system creates realistic penumbra effects where surfaces partially occlude light sources. Users access these settings through the Faces section > Material tab in the sidebar.

---

## User Story 1: Shadow Toggle

**User story:** As a user viewing a mandelbulb fractal, I want to enable or disable shadows so that I can choose between visual fidelity and rendering performance.

**Acceptance criteria**
1. User sees a "Shadows" toggle switch in the Material tab when viewing a mandelbulb fractal
2. Toggle is visible only when at least one light source is enabled
3. Toggle is OFF by default (shadows disabled for performance)
4. When toggled ON, shadows appear within 1 second
5. When toggled OFF, shadows disappear immediately
6. Shadow toggle state is saved when sharing via URL
7. Toggle is disabled (grayed out) when in Fast Mode during interaction
8. Tooltip on toggle: "Enable soft shadows (may reduce performance)"

**Test scenarios**

Scenario 1: Enable shadows
- Given the user is viewing a mandelbulb with one point light enabled
- When the user toggles Shadows to ON
- Then shadows appear on the fractal surface where light is occluded

Scenario 2: Disable shadows
- Given the user has shadows enabled
- When the user toggles Shadows to OFF
- Then shadows immediately disappear from the fractal

Scenario 3: Toggle hidden without lights
- Given all lights are disabled
- When the user opens the Material tab
- Then the Shadows toggle is not visible

Scenario 4: Toggle visible with lights
- Given the user enables a directional light
- When the user opens the Material tab
- Then the Shadows toggle becomes visible

Scenario 5: Fast mode interaction
- Given shadows are enabled
- When the user rotates the fractal (triggering Fast Mode)
- Then the Shadows toggle shows a disabled state with tooltip "Shadows paused during interaction"

---

## User Story 2: Shadow Quality Control

**User story:** As a user, I want to adjust shadow quality so that I can balance visual fidelity with rendering performance based on my device capabilities.

**Acceptance criteria**
1. User sees a "Shadow Quality" control when shadows are enabled
2. Quality options: "Low", "Medium" (default), "High", "Ultra"
3. Each quality level affects shadow sample count and accuracy
4. Lower quality renders faster but shows more banding/artifacts
5. Higher quality renders slower but shows smoother penumbra gradients
6. Quality setting only appears when Shadows toggle is ON
7. Changing quality immediately updates the shadow rendering
8. Current quality level displays visual indicator of performance impact

**Quality Descriptions:**
- **Low**: Fast rendering, visible stepping in shadow gradients, suitable for exploration
- **Medium**: Balanced quality and performance, minor artifacts visible on close inspection
- **High**: Smooth shadows with minimal artifacts, moderate performance impact
- **Ultra**: Highest quality shadows, significant performance impact, recommended for screenshots only

**Test scenarios**

Scenario 1: Default quality setting
- Given the user enables shadows for the first time
- When the user views the Shadow Quality control
- Then "Medium" is selected by default

Scenario 2: Low quality shadows
- Given shadows are enabled
- When the user selects "Low" quality
- Then shadow edges show visible banding/stepping artifacts
- And frame rate improves compared to higher qualities

Scenario 3: High quality shadows
- Given shadows are enabled
- When the user selects "High" quality
- Then shadows have smooth penumbra gradients
- And frame rate decreases compared to lower qualities

Scenario 4: Ultra quality warning
- Given the user selects "Ultra" quality
- When first selecting this option in a session
- Then a tooltip appears: "Ultra quality recommended for static renders only"

Scenario 5: Quality control visibility
- Given shadows are disabled (toggle OFF)
- When the user views the Material tab
- Then the Shadow Quality control is not visible

---

## User Story 3: Shadow Softness Control

**User story:** As a user, I want to adjust how soft or hard the shadow edges appear so that I can achieve my desired visual style.

**Acceptance criteria**
1. User sees a "Shadow Softness" slider when shadows are enabled
2. Slider range: 0.0 (hard shadows) to 2.0 (very soft shadows), step 0.1
3. Default value is 1.0 (natural soft shadows)
4. At softness 0.0, shadows have sharp, defined edges
5. At softness 2.0, shadows have wide, diffuse penumbra
6. Changes to softness immediately update the shadow rendering
7. Double-click slider to reset to 1.0 default
8. Slider shows current value numerically

**Test scenarios**

Scenario 1: Hard shadows
- Given shadows are enabled
- When the user sets Shadow Softness to 0.0
- Then shadow edges appear sharp and well-defined with minimal penumbra

Scenario 2: Default soft shadows
- Given shadows are enabled with default softness (1.0)
- When the user views the fractal with a point light
- Then shadows have a natural, gradual penumbra matching real-world soft shadows

Scenario 3: Very soft shadows
- Given shadows are enabled
- When the user sets Shadow Softness to 2.0
- Then shadows have wide, diffuse edges that blend gradually into lit areas

Scenario 4: Reset softness
- Given Shadow Softness is set to 0.5
- When the user double-clicks the softness slider
- Then the value resets to 1.0

Scenario 5: Softness affects all lights
- Given the user has two point lights enabled
- When the user adjusts Shadow Softness
- Then shadows from both lights are affected equally

---

## User Story 4: Shadow Interaction with Light Types

**User story:** As a user, I want shadows to work correctly with all light types so that I can create realistic lighting scenarios.

**Acceptance criteria**
1. Point lights cast shadows that emanate from the light position
2. Directional lights cast parallel shadows in the light direction
3. Spot lights cast shadows within their cone angle
4. Shadow intensity scales with light intensity
5. Each enabled light contributes to the shadow calculation
6. Shadows from multiple lights combine realistically
7. Colored lights create appropriately tinted shadow regions
8. Disabling a light removes its shadow contribution immediately

**Test scenarios**

Scenario 1: Point light shadows
- Given a point light is positioned above the fractal
- When shadows are enabled
- Then shadows appear below protruding fractal features, emanating from the light position

Scenario 2: Directional light shadows
- Given a directional light points at 45 degrees downward
- When shadows are enabled
- Then all shadows are cast in the same parallel direction

Scenario 3: Spot light shadows
- Given a spot light with a 30-degree cone is aimed at the fractal
- When shadows are enabled
- Then shadows only appear within the illuminated cone area

Scenario 4: Multiple light shadows
- Given two point lights are positioned on opposite sides of the fractal
- When shadows are enabled
- Then the fractal casts two distinct shadows, one toward each light

Scenario 5: Light intensity affects shadow
- Given shadows are enabled with one point light at 100% intensity
- When the user reduces light intensity to 30%
- Then shadow contrast decreases proportionally

Scenario 6: Disable light removes shadow
- Given two lights are casting shadows
- When the user disables one light
- Then only the shadow from the remaining light is visible

---

## User Story 5: Shadow Performance Optimization

**User story:** As a user, I want shadows to automatically adjust during interaction so that the application remains responsive while still showing shadows when the view is static.

**Acceptance criteria**
1. During camera rotation/zoom, shadows are paused or reduced to minimum quality
2. When interaction stops, shadows are restored after a brief delay (150ms)
3. User sees a subtle visual indicator when shadows are temporarily paused
4. Full-quality shadows render progressively after interaction stops
5. Shadow pausing during interaction is automatic and not user-configurable
6. Performance improvement during interaction is noticeable (smoother frame rate)
7. Shadow restoration is smooth, not jarring

**Test scenarios**

Scenario 1: Shadows pause during rotation
- Given shadows are enabled at High quality
- When the user starts rotating the fractal
- Then the application maintains smooth frame rate with reduced/paused shadows

Scenario 2: Shadows restore after interaction
- Given the user was rotating the fractal (shadows paused)
- When the user stops rotating and waits 150ms
- Then shadows progressively render back to the selected quality

Scenario 3: Quick interactions
- Given shadows are enabled
- When the user performs multiple quick rotation gestures
- Then shadows remain paused until interaction fully stops

Scenario 4: Smooth restoration
- Given shadows were paused during interaction
- When shadows restore
- Then the transition from no shadows to full shadows is gradual (not instant pop-in)

---

## User Story 6: Shadow URL Serialization

**User story:** As a user, I want my shadow settings to be saved in the share URL so that I can share my exact lighting configuration with others.

**Acceptance criteria**
1. Shadow enabled state is encoded in the share URL
2. Shadow quality setting is encoded when not default (Medium)
3. Shadow softness is encoded when not default (1.0)
4. Loading a URL with shadow settings applies them immediately
5. Invalid shadow parameters default to shadows OFF
6. URL encoding is compact to minimize URL length

**Test scenarios**

Scenario 1: Share URL with shadows enabled
- Given shadows are enabled with High quality and softness 1.5
- When the user copies the share URL and opens it in a new tab
- Then shadows are enabled with High quality and softness 1.5

Scenario 2: Share URL with shadows disabled
- Given shadows are disabled
- When the user shares the URL
- Then the recipient sees the fractal without shadows

Scenario 3: Invalid URL parameters
- Given a URL contains an invalid shadow quality value
- When the user loads the URL
- Then shadows are disabled as fallback

---

## Specification Summary

**Feature**: Mandelbulb Soft Shadows
**User Stories (Jira Tickets)**: 6
**Acceptance Criteria**: 44
**Test Scenarios**: 26

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Shadow Toggle | User | ~0.5 days | None |
| 2 | Shadow Quality Control | User | ~1 day | Story 1 |
| 3 | Shadow Softness Control | User | ~0.5 days | Story 1 |
| 4 | Light Type Interaction | User | ~1.5 days | Story 1 |
| 5 | Performance Optimization | System | ~1 day | Story 1 |
| 6 | URL Serialization | User | ~0.5 days | Stories 1-3 |

### Coverage
- Happy paths: 14
- Error handling: 2
- Edge cases: 4
- Performance: 6
- System behavior: 5

### Placeholders Requiring Confirmation
- None

### Open Questions
- Should shadow quality automatically reduce for dimensions 8D+ to maintain performance?
- Should there be a global "max shadow distance" setting to limit shadow calculation range?

### Dependencies Between Stories
- Stories 2-5 depend on Story 1 (shadow toggle infrastructure)
- Story 6 depends on Stories 1-3 (must serialize all shadow settings)

### Ready for Development: YES
