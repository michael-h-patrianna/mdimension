# Enhanced Visuals & Rendering Pipeline

## Specification Summary

**Feature**: Enhanced Visuals & Rendering Pipeline
**User Stories (Jira Tickets)**: 8
**Acceptance Criteria**: 47
**Test Scenarios**: 31

### Stories Overview
| # | Story | Role | Est. Size | Dependencies |
|---|-------|------|-----------|--------------|
| 1 | Shader Selection System | User | ~2 days | None |
| 2 | Surface Shader with Lighting | User | ~2 days | Story 1 |
| 3 | Bloom Post-Processing | User | ~1.5 days | None |
| 4 | Light Source Controls | User | ~1 day | Story 2 |
| 5 | Vertex Ball Visibility | User | ~0.5 days | None |
| 6 | Color & Palette Configuration | User | ~1.5 days | None |
| 7 | Per-Shader Settings | User | ~1 day | Stories 1, 2 |
| 8 | Depth-Based Visual Differentiation | System | ~1.5 days | Story 2 |

### Coverage
- Happy paths: 12
- Error handling: 4
- Edge cases: 8
- Permission/access: 0
- System behavior: 7

### Open Questions
None - all uncertainties have been resolved through research.

### Design Decisions (Researched)

**Visual Differentiation Strategy:**
To ensure edges and faces can be differentiated (not all flat same color), the system uses:
1. **Depth-based color attenuation**: Objects further from camera render progressively dimmer/more transparent
2. **Fresnel rim lighting**: Edges facing away from camera get subtle highlight
3. **Per-dimension color coding**: Optional mode where each dimension's edges use distinct hue
4. **Specular highlights**: Faces reflect light differently based on orientation

**Physical Realism Approach:**
To make objects feel like real physical objects:
1. **Phong lighting model**: Ambient + diffuse + specular components
2. **Depth cueing**: Atmospheric fade with distance
3. **Surface normals**: Calculated per-face for proper light interaction
4. **Material properties**: Configurable shininess/specular power

### Dependencies Between Stories
- Story 2 (Surface Shader) depends on Story 1 (Shader Selection) for shader switching infrastructure
- Story 4 (Light Source) depends on Story 2 (Surface Shader) for lighting to have visible effect
- Story 7 (Per-Shader Settings) depends on Stories 1 and 2 for the shaders to exist

### Ready for Development: YES

---

## User Story 1: Shader Selection System

**User story:** As a user, I want to select different visual shaders for the polytope so that I can choose the rendering style that best suits my needs.

**Acceptance criteria**
1. User sees a "Shader" dropdown in the Visuals section of the control panel
2. Dropdown displays the following shader options:
   - "Wireframe" (default) - edges only, no face fill
   - "Neon Glow" - edges with glow/bloom effect
   - "Gradient Fill" - edges with gradient coloring
   - "Dual Outline" - double-line edge effect
   - "Surface" - filled faces with lighting
3. Selecting a shader immediately updates the polytope visualization
4. The selected shader persists across dimension changes
5. The selected shader persists across object type changes (hypercube, simplex, cross-polytope)
6. Shader selection is included in URL state for sharing

**Test scenarios**

Scenario 1: Change shader from wireframe to surface
- Given the user has a 4D hypercube displayed with "Wireframe" shader
- When the user selects "Surface" from the shader dropdown
- Then the polytope displays with filled faces and lighting applied

Scenario 2: Shader persists across dimension change
- Given the user has selected "Neon Glow" shader
- When the user changes dimension from 4D to 6D
- Then the polytope continues to render with "Neon Glow" shader

Scenario 3: Shader included in shared URL
- Given the user has selected "Gradient Fill" shader
- When the user copies the share URL
- Then the URL contains the shader parameter and loading that URL shows "Gradient Fill" selected

---

## User Story 2: Surface Shader with Lighting

**User story:** As a user, I want a surface shader that fills polytope faces with proper lighting so that I can visualize the object as a solid 3D form.

**Acceptance criteria**
1. When "Surface" shader is selected, polytope faces are filled (not just wireframe)
2. Face colors respond to light direction (brighter on lit side, darker on shadowed side)
3. Specular highlights appear on faces facing the light source
4. Faces have proper normals calculated from their vertices
5. Face opacity is controllable (0% = wireframe only, 100% = fully opaque faces)
6. Edges remain visible on top of filled faces when face opacity < 100%
7. Backface culling is disabled (both sides of faces are rendered for n-dimensional objects)
8. Lighting follows the Phong model: ambient + diffuse + specular components

**Test scenarios**

Scenario 1: Surface shader shows filled faces
- Given the user selects "Surface" shader
- When viewing a 4D hypercube
- Then the cube faces appear filled with color, not just wireframe edges

Scenario 2: Light affects face brightness
- Given the user has "Surface" shader selected with light source enabled
- When the polytope rotates
- Then faces change brightness as they rotate toward or away from the light

Scenario 3: Specular highlight visible
- Given the user has "Surface" shader with specular enabled
- When a face is oriented to reflect light toward the camera
- Then a bright specular highlight appears on that face

Scenario 4: Face opacity control
- Given the user has "Surface" shader selected
- When the user sets face opacity to 50%
- Then faces appear semi-transparent with edges visible through them

---

## User Story 3: Bloom Post-Processing

**User story:** As a user, I want to enable bloom post-processing so that bright parts of the visualization have a glowing effect.

**Acceptance criteria**
1. User sees a "Bloom" toggle in the Visuals section
2. When bloom is enabled, bright areas of the polytope emit a soft glow
3. User can adjust bloom intensity from 0% to 200%
4. User can adjust bloom threshold (0.0 to 1.0) - determines minimum brightness to bloom
5. Bloom effect uses multi-pass blur for smooth, high-quality glow
6. Bloom is applied as a post-processing effect (affects entire scene)
7. Bloom works with all shaders (wireframe, neon glow, surface, etc.)
8. Default bloom settings: intensity 100%, threshold 0.8

**Test scenarios**

Scenario 1: Enable bloom
- Given bloom is disabled
- When the user enables the bloom toggle
- Then bright edges and vertices emit a soft glow effect

Scenario 2: Adjust bloom intensity
- Given bloom is enabled at 100% intensity
- When the user increases intensity to 150%
- Then the glow effect becomes visibly stronger/larger

Scenario 3: Bloom threshold affects which areas glow
- Given bloom is enabled with threshold 0.8
- When the user lowers threshold to 0.4
- Then more of the polytope emits glow (not just the brightest parts)

Scenario 4: Bloom with surface shader
- Given "Surface" shader is selected with bloom enabled
- When viewing a lit polytope
- Then specular highlights and bright faces emit bloom glow

---

## User Story 4: Light Source Controls

**User story:** As a user, I want to control the light source so that I can adjust how the polytope is illuminated.

**Acceptance criteria**
1. User sees a "Lighting" subsection in the Visuals panel (visible when Surface shader selected)
2. User can toggle the light source on/off
3. User can set the light color using a color picker
4. User can adjust light direction using two sliders: horizontal angle (0-360°) and vertical angle (-90° to 90°)
5. User can adjust ambient light intensity (0% to 100%)
6. User can adjust specular intensity (0% to 200%)
7. User can adjust specular power/shininess (1 to 128)
8. When light is off, only ambient lighting is applied
9. Light direction is visualized with a small indicator in the scene (optional, can be toggled)
10. Default light: white color, 45° horizontal, 30° vertical, 20% ambient

**Test scenarios**

Scenario 1: Toggle light off
- Given the light source is on with Surface shader
- When the user toggles the light off
- Then the polytope is lit only by ambient light (flat, no directional shading)

Scenario 2: Change light color
- Given the light is white
- When the user changes light color to orange
- Then lit faces take on an orange tint

Scenario 3: Adjust light direction
- Given the light is at 45° horizontal
- When the user changes horizontal angle to 180°
- Then the lit side of the polytope shifts to the opposite face

Scenario 4: Adjust specular
- Given specular intensity is at 50%
- When the user increases specular to 150%
- Then specular highlights become brighter and more pronounced

---

## User Story 5: Vertex Ball Visibility

**User story:** As a user, I want to control whether vertex "balls" (spheres at polytope vertices) are displayed so that I can customize the visual style.

**Acceptance criteria**
1. User sees a "Show Vertices" toggle in the Visuals section
2. When enabled, small spheres are rendered at each vertex position
3. When disabled, no vertex spheres are shown
4. Vertex visibility works with all shaders
5. Default: vertices visible
6. Vertex size is controllable (1-10 scale)
7. Vertex color is independently controllable from edge color

**Test scenarios**

Scenario 1: Hide vertices
- Given vertices are visible
- When the user disables "Show Vertices"
- Then vertex spheres disappear, leaving only edges (and faces if surface shader)

Scenario 2: Vertex size adjustment
- Given vertices are visible at size 4
- When the user increases vertex size to 8
- Then vertex spheres become visibly larger

Scenario 3: Vertices with surface shader
- Given "Surface" shader is selected with vertices visible
- When viewing the polytope
- Then vertex spheres appear on top of/in front of filled faces

---

## User Story 6: Color & Palette Configuration

**User story:** As a user, I want to configure colors and color palettes so that I can customize the visual appearance of the polytope.

**Acceptance criteria**
1. User can set edge color using a color picker
2. User can set vertex color using a color picker
3. User can set face color using a color picker (for surface shader)
4. User can select from predefined color palettes:
   - "Neon" (cyan edges, magenta vertices, dark background)
   - "Blueprint" (blue edges, light blue vertices, navy background)
   - "Hologram" (cyan monochrome)
   - "Scientific" (white edges, red vertices, dark gray background)
   - "Synthwave" (pink/purple gradient)
   - "Custom" (user-defined colors)
5. Selecting a palette updates all colors to match
6. After selecting a palette, user can further customize individual colors
7. Background color is independently controllable
8. Color settings persist across dimension and object type changes

**Test scenarios**

Scenario 1: Apply color palette
- Given the user has custom colors set
- When the user selects "Synthwave" palette
- Then all colors update to the synthwave color scheme

Scenario 2: Customize after palette
- Given the user has "Neon" palette applied
- When the user changes edge color to yellow
- Then edges become yellow while other colors remain from Neon palette

Scenario 3: Background color independent
- Given the user selects "Blueprint" palette
- When the user changes background to black
- Then background becomes black while polytope colors remain Blueprint

Scenario 4: Colors persist across changes
- Given the user has custom pink edges
- When the user changes from 4D to 7D
- Then the polytope continues to display with pink edges

---

## User Story 7: Per-Shader Settings

**User story:** As a user, I want to access shader-specific settings so that I can fine-tune the appearance of each shader.

**Acceptance criteria**
1. When a shader is selected, its specific settings appear in a collapsible subsection
2. Wireframe shader settings:
   - Line thickness (1-5 pixels)
3. Neon Glow shader settings:
   - Glow intensity (0-200%)
   - Glow color (separate from edge color)
4. Gradient Fill shader settings:
   - Gradient start color
   - Gradient end color
   - Gradient direction (along edge / radial from center)
5. Surface shader settings:
   - Face opacity (0-100%)
   - Specular intensity (0-200%)
   - Specular power (1-128)
   - Enable/disable fresnel rim lighting
6. Settings update the visualization in real-time as values change
7. Shader settings are included in URL state for sharing

**Test scenarios**

Scenario 1: Surface shader settings visible
- Given the user selects "Surface" shader
- When viewing the Visuals panel
- Then Surface-specific settings appear (face opacity, specular, etc.)

Scenario 2: Change shader hides irrelevant settings
- Given the user has "Surface" shader with specular settings visible
- When the user switches to "Wireframe" shader
- Then specular settings disappear and line thickness appears

Scenario 3: Real-time specular update
- Given "Surface" shader is selected with specular at 50%
- When the user drags specular slider to 150%
- Then the polytope's specular highlights update smoothly as the slider moves

Scenario 4: Neon glow intensity
- Given "Neon Glow" shader is selected with intensity at 100%
- When the user increases glow intensity to 180%
- Then the glow effect around edges becomes stronger

---

## User Story 8: Depth-Based Visual Differentiation

**User story:** As the system, I want to automatically differentiate edges and faces by depth and orientation so that users can perceive the 3D structure clearly.

**Acceptance criteria**
1. Edges further from the camera render with reduced opacity (depth attenuation)
2. Depth attenuation range is 0% to 50% opacity reduction at maximum distance
3. User can enable/disable depth attenuation via toggle
4. Fresnel rim lighting highlights edges at glancing angles (makes silhouettes visible)
5. Fresnel effect intensity is controllable (0-100%)
6. Optional: Per-dimension color coding mode where each dimension's edges use distinct hue
7. Depth differentiation works with all shaders
8. Default: depth attenuation enabled at 30%, fresnel at 50%

**Test scenarios**

Scenario 1: Depth attenuation effect
- Given depth attenuation is enabled at 30%
- When viewing a rotating 4D hypercube
- Then edges at the back appear dimmer than edges at the front

Scenario 2: Disable depth attenuation
- Given depth attenuation is enabled
- When the user disables depth attenuation
- Then all edges render at full opacity regardless of distance

Scenario 3: Fresnel rim lighting
- Given fresnel is enabled at 50%
- When viewing a 4D hypercube with Surface shader
- Then edges at the silhouette (perpendicular to view) have a subtle bright rim

Scenario 4: Per-dimension color coding
- Given per-dimension coloring is enabled
- When viewing a 5D object
- Then edges in the XY plane are one color, XW plane another color, etc.

Scenario 5: Depth with wireframe shader
- Given "Wireframe" shader with depth attenuation enabled
- When rotating the polytope
- Then back edges are visibly dimmer than front edges

---

## Appendix: Available Shaders from MultiScoper

The following shaders can be adapted from the MultiScoper codebase:

### 2D Shaders (Edge-based)
| Shader | Description | Key Parameters |
|--------|-------------|----------------|
| Basic | Simple solid color lines | color, opacity, lineWidth |
| Neon Glow | Lines with glow effect | color, glowIntensity, lineWidth |
| Gradient Fill | Gradient-colored lines | startColor, endColor, direction |
| Dual Outline | Double-line effect | innerColor, outerColor, gap |
| Plasma Sine | Animated color waves | speed, frequency, colors |
| Digital Glitch | Glitchy/distorted effect | intensity, blockSize |

### 3D Shaders (Mesh-based)
| Shader | Description | Key Parameters |
|--------|-------------|----------------|
| Wireframe Mesh | 3D wireframe with depth | color, glow, depthFade |
| Vector Flow | Flowing line patterns | flowSpeed, density |
| String Theory | String-like visualization | tension, vibration |
| Electric Flower | Electric arc patterns | arcCount, chaos |
| Electric Filigree | Detailed electric patterns | detail, brightness |
| Volumetric Ribbon | 3D ribbon surfaces | thickness, twist |

### Material Shaders (Surface-based)
| Shader | Description | Key Parameters |
|--------|-------------|----------------|
| Glass Refraction | Transparent glass-like | refractiveIndex, tint |
| Liquid Chrome | Reflective metallic | reflectivity, roughness |
| Crystalline | Crystal/diamond look | facets, sparkle |

### Post-Processing Effects
| Effect | Description | Key Parameters |
|--------|-------------|----------------|
| Bloom | Glow on bright areas | intensity, threshold, spread |
| Chromatic Aberration | RGB color separation | intensity |
| Film Grain | Noise overlay | intensity, speed |
| Vignette | Edge darkening | intensity, softness |
| Scanlines | CRT-style lines | density, intensity |
| Color Grade | Color correction | brightness, contrast, saturation |
