# Enhanced Lighting System

## Overview

This PRD specifies improvements to the lighting system to address user-reported issues with "rough" lighting and faces glowing white when facing the light source. The changes affect all three shader systems (SurfaceMaterial for polytopes, Mandelbulb, and Hyperbulb) and introduce new user-controllable settings.

**Problem Statement:** Current lighting implementation uses additive accumulation without energy conservation, lacks Fresnel attenuation on specular highlights, uses pure white specular color, and has no output tone mapping—causing harsh white blow-out on surfaces facing the light.

---

## User Story 1: Energy-Conserving Diffuse Lighting

**User story:** As a user, I want lighting to look natural without faces becoming overly bright when facing the light source.

**Acceptance criteria**
1. Combined ambient and diffuse light contribution never exceeds the surface color's natural brightness
2. When ambient intensity is set to 0.3, diffuse contributes a maximum of 0.7 (they sum to 1.0)
3. Surfaces facing the light appear properly lit, not washed out or blown out
4. Surfaces facing away from the light show only ambient illumination
5. The lighting model is consistent across all three shader systems (SurfaceMaterial, Mandelbulb, Hyperbulb)
6. Existing scenes automatically benefit from improved lighting without user intervention

**Test scenarios**

Scenario 1: Surface directly facing light source
- Given a polytope face with normal pointing directly at the light
- When ambient intensity is 0.3 and light is enabled
- Then the face appears at full brightness (ambient 0.3 + diffuse 0.7 = 1.0) without white blow-out

Scenario 2: Surface facing away from light
- Given a polytope face with normal pointing opposite to the light direction
- When ambient intensity is 0.3 and light is enabled
- Then the face appears at ambient brightness only (0.3), creating natural shadow

Scenario 3: Ambient at maximum
- Given ambient intensity is set to 1.0
- When viewing any surface with light enabled
- Then diffuse contribution is zero and all surfaces appear uniformly lit at full brightness

Scenario 4: Ambient at zero
- Given ambient intensity is set to 0.0
- When viewing surfaces facing away from the light
- Then those surfaces appear completely dark (pure black)

Scenario 5: Consistency across shader systems
- Given identical lighting settings applied to a polytope, Mandelbulb, and Hyperbulb
- When viewing all three objects under the same conditions
- Then all three exhibit the same lighting behavior and intensity response

---

## User Story 2: Fresnel-Attenuated Specular Highlights

**User story:** As a user, I want specular highlights to look realistic without harsh white spots when viewing surfaces head-on.

**Acceptance criteria**
1. Specular intensity varies based on viewing angle using Fresnel effect
2. Surfaces viewed head-on (perpendicular to view) show reduced specular reflection
3. Surfaces viewed at grazing angles show increased specular reflection
4. Default Fresnel base reflectivity (F0) is 0.04, appropriate for non-metallic surfaces
5. Specular highlights appear on the specular hot-spot area, not across entire lit surfaces
6. The Fresnel effect applies to all three shader systems

**Test scenarios**

Scenario 1: Head-on specular viewing
- Given a surface with the specular hot-spot directly facing the camera
- When specular intensity is set to 1.0
- Then the highlight appears subdued (approximately 4% of full intensity due to F0=0.04)

Scenario 2: Grazing angle specular viewing
- Given a surface with specular highlight visible at a shallow grazing angle
- When specular intensity is set to 1.0
- Then the highlight appears bright (approaching full intensity as angle approaches 90°)

Scenario 3: Specular disabled
- Given specular intensity is set to 0.0
- When viewing any surface at any angle
- Then no specular highlights appear regardless of viewing angle

Scenario 4: High specular power (sharp highlights)
- Given specular power is set to 128 (maximum)
- When viewing a surface with specular highlight
- Then the highlight is small and concentrated, with Fresnel still applied

Scenario 5: Low specular power (broad highlights)
- Given specular power is set to 1 (minimum)
- When viewing a surface with specular highlight
- Then the highlight is large and diffuse, with Fresnel still applied

---

## User Story 3: Specular Color Control

**User story:** As a user, I want to control the color of specular highlights so I can create materials like gold, copper, or tinted reflections.

**Acceptance criteria**
1. New "Specular Color" setting appears in Lighting Controls when light is enabled
2. Specular Color is displayed as a color picker with hex value display
3. Default specular color is white (#FFFFFF)
4. Specular highlights are tinted by the selected specular color
5. Specular color is multiplied with light color for final highlight color
6. Setting is persisted with scene/preset data
7. Setting applies to all three shader systems

**Test scenarios**

Scenario 1: Default white specular
- Given specular color is set to #FFFFFF (default)
- When viewing a surface with specular highlight under white light
- Then the highlight appears white

Scenario 2: Gold-tinted specular
- Given specular color is set to #FFD700 (gold)
- When viewing a surface with specular highlight under white light
- Then the highlight appears gold-tinted

Scenario 3: Specular color combined with light color
- Given specular color is set to #FF0000 (red) and light color is #00FF00 (green)
- When viewing a surface with specular highlight
- Then the highlight appears dark (red × green = minimal overlap)

Scenario 4: Specular color with colored light
- Given specular color is set to #FFFFFF (white) and light color is #FFA500 (orange)
- When viewing a surface with specular highlight
- Then the highlight appears orange (white passes through the light color)

Scenario 5: Specular color persistence
- Given user sets specular color to #00FFFF and saves the scene
- When the scene is reloaded
- Then specular color is restored to #00FFFF

---

## User Story 4: Tone Mapping Control

**User story:** As a user, I want tone mapping to prevent overly bright areas from blowing out to white, while having control over the algorithm used.

**Acceptance criteria**
1. New "Tone Mapping" toggle appears in Lighting Controls
2. When enabled, a dropdown appears with algorithm options: "Reinhard", "ACES Filmic", "Uncharted 2"
3. Default state is enabled with "Reinhard" algorithm selected
4. Tone mapping compresses high dynamic range values to displayable 0-1 range
5. Tone mapping is applied as the final step before output
6. Tone mapping applies to all three shader systems
7. Settings are persisted with scene/preset data

**Test scenarios**

Scenario 1: Tone mapping disabled (legacy behavior)
- Given tone mapping is disabled
- When combined lighting exceeds 1.0 (e.g., high ambient + diffuse + specular)
- Then values are clamped, resulting in potential white blow-out (matches previous behavior)

Scenario 2: Reinhard tone mapping
- Given tone mapping is enabled with "Reinhard" selected
- When combined lighting produces value of 2.0
- Then output is approximately 0.67 (2.0 / (2.0 + 1.0)), appearing bright but not blown out

Scenario 3: ACES Filmic tone mapping
- Given tone mapping is enabled with "ACES Filmic" selected
- When viewing a scene with high contrast lighting
- Then highlights are compressed with cinematic contrast curve, shadows remain rich

Scenario 4: Uncharted 2 tone mapping
- Given tone mapping is enabled with "Uncharted 2" selected
- When viewing a scene with bright highlights
- Then highlights roll off smoothly with filmic shoulder characteristic

Scenario 5: Tone mapping toggle persistence
- Given user enables tone mapping and selects "ACES Filmic"
- When the scene is saved and reloaded
- Then tone mapping is enabled with "ACES Filmic" selected

Scenario 6: Real-time algorithm switching
- Given a scene is displayed with tone mapping enabled
- When user changes algorithm from "Reinhard" to "ACES Filmic"
- Then the scene updates immediately to show the new tone mapping

---

## User Story 5: Exposure Control

**User story:** As a user, I want to adjust overall scene brightness using an exposure control that works with tone mapping.

**Acceptance criteria**
1. New "Exposure" slider appears in Lighting Controls when Tone Mapping is enabled
2. Exposure range is 0.1 to 3.0 with step of 0.1
3. Default exposure value is 1.0
4. Exposure multiplies all lighting values before tone mapping is applied
5. Exposure < 1.0 darkens the scene; exposure > 1.0 brightens the scene
6. Exposure control is hidden when tone mapping is disabled
7. Setting is persisted with scene/preset data
8. Setting applies to all three shader systems

**Test scenarios**

Scenario 1: Default exposure
- Given tone mapping is enabled and exposure is 1.0 (default)
- When viewing a normally lit scene
- Then the scene appears at standard brightness

Scenario 2: Increased exposure
- Given tone mapping is enabled and exposure is set to 2.0
- When viewing a scene
- Then the scene appears brighter overall, with tone mapping preventing blow-out

Scenario 3: Decreased exposure
- Given tone mapping is enabled and exposure is set to 0.5
- When viewing a scene
- Then the scene appears darker overall, like an underexposed photograph

Scenario 4: Exposure at minimum
- Given exposure is set to 0.1 (minimum)
- When viewing a scene
- Then the scene appears very dark, with only the brightest areas visible

Scenario 5: Exposure at maximum
- Given exposure is set to 3.0 (maximum)
- When viewing a scene
- Then the scene appears very bright, but tone mapping prevents complete white-out

Scenario 6: Exposure hidden without tone mapping
- Given tone mapping is disabled
- When viewing Lighting Controls
- Then the Exposure slider is not visible

Scenario 7: Exposure persistence
- Given user sets exposure to 1.5 with tone mapping enabled and saves scene
- When the scene is reloaded
- Then exposure is restored to 1.5

---

## User Story 6: Diffuse Intensity Control

**User story:** As a user, I want separate control over diffuse lighting intensity independent from ambient, for finer lighting adjustments.

**Acceptance criteria**
1. New "Diffuse Intensity" slider appears in Lighting Controls when light is enabled
2. Diffuse Intensity range is 0.0 to 2.0 with step of 0.1
3. Default diffuse intensity is 1.0
4. Diffuse intensity multiplies the diffuse lighting component
5. Values > 1.0 allow boosted diffuse for dramatic lighting
6. Energy conservation still applies: (ambient + diffuse × intensity) is clamped appropriately
7. Setting is persisted with scene/preset data
8. Setting applies to all three shader systems

**Test scenarios**

Scenario 1: Default diffuse intensity
- Given diffuse intensity is 1.0 (default)
- When viewing a lit surface
- Then diffuse lighting contributes normally based on surface angle to light

Scenario 2: Zero diffuse intensity
- Given diffuse intensity is set to 0.0
- When viewing a surface facing the light
- Then only ambient light is visible (no directional lighting effect)

Scenario 3: Boosted diffuse intensity
- Given diffuse intensity is set to 2.0
- When viewing a surface at 45° to the light
- Then diffuse contribution is doubled, creating more dramatic light/shadow contrast

Scenario 4: Diffuse with low ambient
- Given ambient intensity is 0.1 and diffuse intensity is 1.5
- When viewing a scene
- Then lit areas appear bright while shadows are very dark, creating high contrast

Scenario 5: Diffuse intensity persistence
- Given user sets diffuse intensity to 0.7 and saves scene
- When the scene is reloaded
- Then diffuse intensity is restored to 0.7

---

## User Story 7: Updated Lighting Controls UI Layout

**User story:** As a user, I want the lighting controls organized logically so I can easily find and adjust settings.

**Acceptance criteria**
1. Controls are organized into logical groups with visual separation
2. Group order: Light Source → Ambient/Diffuse → Specular → Fresnel → Tone Mapping
3. Light Source group contains: Light toggle, Light color, Horizontal angle, Vertical angle, Light indicator toggle
4. Ambient/Diffuse group contains: Ambient Intensity, Diffuse Intensity
5. Specular group contains: Specular Color, Specular Intensity, Specular Power (Shininess)
6. Fresnel group contains: Fresnel toggle, Fresnel Intensity (when enabled)
7. Tone Mapping group contains: Tone Mapping toggle, Algorithm dropdown (when enabled), Exposure slider (when enabled)
8. Conditional controls remain hidden until their parent toggle is enabled
9. All sliders show current value and have reset-to-default capability

**Test scenarios**

Scenario 1: Initial state with light enabled
- Given the Surface shader is active and light is enabled
- When viewing Lighting Controls
- Then all groups are visible with their respective controls in the specified order

Scenario 2: Light disabled hides dependent controls
- Given light is disabled
- When viewing Lighting Controls
- Then only Ambient Intensity remains visible; Light Source details, Diffuse, Specular, and their dependent controls are hidden

Scenario 3: Tone mapping disabled hides sub-controls
- Given tone mapping is disabled
- When viewing Lighting Controls
- Then Algorithm dropdown and Exposure slider are hidden; only Tone Mapping toggle is visible

Scenario 4: Fresnel disabled hides intensity
- Given fresnel toggle is off
- When viewing Lighting Controls
- Then Fresnel Intensity slider is hidden

Scenario 5: Reset functionality
- Given user has modified Specular Intensity to 1.8
- When user clicks the reset button on Specular Intensity
- Then the value returns to default (0.5)

---

## User Story 8: Automatic Scene Migration

**User story:** As a user with existing saved scenes, I want my scenes to automatically benefit from the improved lighting system.

**Acceptance criteria**
1. Existing scenes without new settings receive sensible defaults when loaded
2. Default values for new settings: Specular Color = #FFFFFF, Tone Mapping = enabled, Algorithm = Reinhard, Exposure = 1.0, Diffuse Intensity = 1.0
3. Shader improvements (energy conservation, Fresnel) are applied automatically to all scenes
4. Existing ambient/specular/light settings are preserved exactly as saved
5. User is not prompted or required to take action for migration
6. Scenes saved after update include all new settings

**Test scenarios**

Scenario 1: Load legacy scene
- Given a scene was saved before the lighting update (missing new settings)
- When the scene is loaded
- Then new settings use defaults and improved shaders are active

Scenario 2: Legacy scene visual improvement
- Given a legacy scene that previously showed white blow-out on bright surfaces
- When the scene is loaded after the update
- Then the same lighting settings produce improved visuals without blow-out

Scenario 3: Preserved settings
- Given a legacy scene with ambient=0.5, specularIntensity=1.2, specularPower=64
- When the scene is loaded
- Then those values are preserved exactly; new settings use defaults

Scenario 4: Save updated scene
- Given a legacy scene is loaded and user adjusts Specular Color to #FFD700
- When the scene is saved
- Then the saved data includes Specular Color = #FFD700 and all other new settings

Scenario 5: Round-trip preservation
- Given a scene is saved with all new settings customized
- When the scene is loaded
- Then all customized new settings are restored exactly

---

## User Story 9: Shader System Consistency

**User story:** As a user, I want consistent lighting behavior whether I'm viewing polytopes, Mandelbulb fractals, or Hyperbulb fractals.

**Acceptance criteria**
1. All lighting calculations use identical formulas across all three shader systems
2. Energy conservation formula is consistent: diffuseWeight = 1.0 - ambientIntensity
3. Fresnel calculation is consistent: Schlick approximation with F0 = 0.04
4. Tone mapping is applied identically using the same algorithm implementation
5. All new settings (Specular Color, Tone Mapping, Exposure, Diffuse Intensity) affect all three systems
6. Visual appearance is consistent when same settings are applied to different object types

**Test scenarios**

Scenario 1: Side-by-side comparison
- Given a polytope, Mandelbulb, and Hyperbulb are visible simultaneously
- When identical lighting settings are applied
- Then all three objects show the same lighting behavior (same brightness levels, same specular appearance)

Scenario 2: Specular color consistency
- Given Specular Color is set to #FF0000
- When viewing specular highlights on all three object types
- Then all highlights appear red-tinted

Scenario 3: Tone mapping consistency
- Given Tone Mapping is enabled with ACES Filmic and Exposure 1.5
- When viewing all three object types in a bright lighting setup
- Then all three show identical tone mapping response

Scenario 4: Switching between objects
- Given user is viewing a polytope with customized lighting
- When user switches to view a Mandelbulb
- Then the lighting appearance is consistent (not noticeably different in character)

---

## Specification Summary

**Feature**: Enhanced Lighting System
**User Stories (Jira Tickets)**: 9
**Acceptance Criteria**: 67
**Test Scenarios**: 47

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Energy-Conserving Diffuse | User | ~1 day | None |
| 2 | Fresnel-Attenuated Specular | User | ~1 day | None |
| 3 | Specular Color Control | User | ~1 day | Story 2 |
| 4 | Tone Mapping Control | User | ~1.5 days | None |
| 5 | Exposure Control | User | ~0.5 day | Story 4 |
| 6 | Diffuse Intensity Control | User | ~0.5 day | Story 1 |
| 7 | Lighting Controls UI Layout | User | ~1 day | Stories 3, 4, 5, 6 |
| 8 | Automatic Scene Migration | User | ~0.5 day | All shader stories |
| 9 | Shader System Consistency | User | ~1 day | Stories 1, 2 |

### Coverage
- Happy paths: 21
- Error handling: 0 (no error states in this feature)
- Edge cases: 14
- Permission/access: 0 (all users have access)
- System behavior: 12

### Placeholders Requiring Confirmation
- None (all requirements confirmed)

### Open Questions
- None

### Dependencies Between Stories
- Story 3 (Specular Color) depends on Story 2 (Fresnel) being implemented first
- Story 5 (Exposure) depends on Story 4 (Tone Mapping) being implemented first
- Story 6 (Diffuse Intensity) should be implemented alongside Story 1 (Energy Conservation)
- Story 7 (UI Layout) depends on Stories 3, 4, 5, 6 for the new controls
- Story 8 (Migration) should be implemented after all shader changes
- Story 9 (Consistency) should be verified after Stories 1 and 2

### Suggested Implementation Order
1. Stories 1 + 2 (Core shader fixes) - parallel
2. Stories 4 + 6 (Tone Mapping + Diffuse Intensity) - parallel
3. Stories 3 + 5 (Specular Color + Exposure) - parallel
4. Story 9 (Consistency verification)
5. Story 7 (UI Layout)
6. Story 8 (Migration)

### Ready for Development: YES
