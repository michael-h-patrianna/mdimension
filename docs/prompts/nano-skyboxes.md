# Skybox Prompts for Nano Banana (Gemini Image Generation)

## Overview

These prompts generate equirectangular projections suitable for cubemap conversion. Each prompt is optimized for Google Nano Banana and designed to complement the mdimension N-Dimensional Visualizer.

### Technical Requirements

- **Output Format**: Equirectangular projection (360° panoramic)
- **Aspect Ratio**: 2:1 (e.g., 2048×1024 or 4096×2048)
- **Post-Processing**: Convert to 6-face cubemap using web converter or ImageMagick, then process to `.ktx2`

### Design Philosophy

The skybox serves as backdrop to n-dimensional mathematical objects. These environments:
- Remain darker and lower contrast than the primary visualization
- Avoid competing with the geometry for visual attention
- Provide subtle depth cues without overwhelming detail
- Support the "infinite mathematical space" aesthetic

---

## Prompt A: Quantum Void
```
**Output Format**: Equirectangular projection (360° panoramic)
**Aspect Ratio**: 2:1 (e.g., 2048×1024 or 4096×2048)

**Concept**: A deep, dark void with subtle flowing energy currents and mathematical dust. No distinct horizon lines—perfect for n-dimensional spaces where orientation is abstract.

A seamless equirectangular 360-degree panoramic view of an infinite quantum void stretches in all directions. Deep indigo (#1E1B4B) gradients blend into absolute black (#0A0A0F), forming a boundless expanse without horizon or reference point. Faint wisps of nebulous energy drift through the space in soft cyan (#22D3EE) and muted magenta (#A855F7), their edges dissolving into the darkness like mathematical functions approaching zero. Microscopic particles of luminescent dust scatter throughout, each point a dim blue-white (#E0F2FE) spark suspended in the emptiness.
- No stars, no suns, no planetary bodies
- Energy currents flow in gentle sine-wave patterns, barely perceptible
- Depth suggested through subtle color temperature shifts from warm blacks to cool indigos
- Occasional geometric interference patterns fade in and out at the threshold of visibility
The atmosphere conveys infinite mathematical space, sterile yet alive with potential energy. Ultra-wide dynamic range, 4K resolution, seamless tileable edges, subtle film grain texture, HDR lighting with extremely low key exposure.
```

### Prompt Analysis
- **Subject**: Abstract infinite void environment
- **Style**: Minimalist cosmic, mathematical aesthetic
- **Key Enhancements**: Specific hex colors for brand consistency, no competing light sources, seamless 360° specification
- **Quality Modifiers**: 4K resolution, HDR, ultra-wide dynamic range, seamless tileable

---

## Prompt B: Cyber-Grid Horizon

**Concept**: A digital landscape with an infinite perspective grid fading into data-fog. Grids provide scale reference that makes n-dimensional rotations easier to perceive.

```
A seamless equirectangular 360-degree panoramic view of a vast digital void featuring an infinite perspective grid plane extending to all horizons. The grid lines glow in dimmed neon cyan (#0E7490) against a deep charcoal (#18181B) surface, each line thin and precise, spacing uniform as they recede toward infinity in perfect one-point perspective. Above and around, dense data-fog in smoky purple-gray (#374151) obscures distant features, its opacity increasing with distance.
- Grid squares measure consistent units, creating mathematical regularity
- Faint digital mountains or data-structures rise at extreme distances, barely visible through the atmospheric haze
- Grid intersection points pulse with subtle brightness variations (#67E8F9), suggesting data flow
- The horizon line sits low, emphasizing the vastness above
- Secondary grid plane on the ceiling mirrors the floor, rotated 180 degrees
Retro-futuristic aesthetic reminiscent of 1980s vector graphics reimagined with modern rendering. The environment feels computational rather than natural, a space where mathematics becomes visible. Highly detailed, clean geometric precision, 4K resolution, subtle bloom effect on grid lines, professional visualization quality.
```

### Prompt Analysis
- **Subject**: Infinite digital grid environment
- **Style**: Retro-futuristic, Tron-inspired, mathematical visualization
- **Key Enhancements**: Dual grid planes (floor/ceiling) for full coverage, data-fog for depth, dimmed neon to avoid overpowering the main object
- **Quality Modifiers**: Highly detailed, 4K resolution, professional visualization quality, clean geometric precision

---

## Prompt C: Studio Laboratory

**Concept**: A high-end abstract rendering studio environment. Clean, professional, and scientific—ideal for geometry inspection and serious visualization work.

```
A seamless equirectangular 360-degree panoramic view of an abstract high-end 3D rendering studio environment. Smooth gradients transition from warm medium gray (#6B7280) at the horizon to cool silver-white (#F3F4F6) at the zenith, creating soft omnidirectional illumination without harsh shadows. The space suggests infinite scale through subtle atmospheric perspective, colors desaturating and lightening toward the edges of perception.
- Large rectangular softbox reflections float in the upper hemisphere, their edges diffused to soft cream (#FFFBEB) glows
- A subtle gradient floor plane in neutral gray (#9CA3AF) grounds the scene without hard edges
- Faint rim-light suggestions in pale blue (#DBEAFE) hint at studio lighting rigs positioned just out of frame
- No walls, no ceiling structure—just endless clean gradient space
- Occasional chrome-like reflective patches (#E5E7EB) suggest the presence of professional equipment
The aesthetic is sterile, expensive, and scientific—a space designed for examining objects with clinical precision. Clean minimalism, professional product photography environment, soft volumetric lighting, 4K resolution, neutral color calibration suitable for accurate material visualization, studio-grade color accuracy.
```

### Prompt Analysis
- **Subject**: Abstract professional studio environment
- **Style**: Clean minimalist, product photography aesthetic, scientific visualization
- **Key Enhancements**: Neutral grays for accurate object color representation, softbox reflections for realistic lighting, no competing visual elements
- **Quality Modifiers**: 4K resolution, professional product photography environment, studio-grade color accuracy, soft volumetric lighting

---

## Post-Processing Workflow

After generating the equirectangular image:

1. **Verify dimensions**: Ensure 2:1 aspect ratio (width = 2× height)
2. **Convert to cubemap**: Use a tool like:
   - Web: [360toolkit.co](https://360toolkit.co/convert-spherical-equirectangular-to-cubemap)
   - CLI: `magick convert equirect.png -resize 4096x2048 -define cube:face-size=1024 cube_%d.png`
3. **Export faces**: Right, Left, Top, Bottom, Front, Back
4. **Compress to KTX2**: Use `toktx` or similar for GPU-optimized format

## Usage Notes

- These prompts prioritize **dark environments** to ensure the primary n-dimensional object remains the visual focus
- All three designs avoid **bright light sources** (suns, stars, lamps) that could create unwanted reflections on metallic/glossy materials
- The **Quantum Void** works best for abstract/artistic presentations
- The **Cyber-Grid** excels at demonstrating rotation and spatial transformation
- The **Studio Laboratory** is optimal for technical/scientific demonstrations where color accuracy matters
