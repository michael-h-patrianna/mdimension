# Color Modes and Palette System

## Overview

The Mandelbulb and Hyperbulb fractals use a sophisticated color palette system that generates an entire color scheme from a single user-selected **surface color**. This system is based on color theory principles and provides multiple **palette modes** (algorithms) that create different color harmonies while maintaining visual consistency with the user's chosen base color.

---

## User Configuration

### Where Users Configure Colors

Users configure colors through the Visual Store settings, accessible from the UI controls:

1. **Surface Color** (`faceColor` in `visualStore`)
   - A single hex color (e.g., `#33cc9e`)
   - This is the **base color** from which all palette colors are derived
   - Default: `#33cc9e` (teal)

2. **Color Mode** (`colorMode` in `visualStore`)
   - Determines which color theory algorithm to use
   - Options:
     - **Monochromatic**: Same hue, varying lightness only
     - **Analogous**: Hue varies ±30° from base color
     - **Complementary**: Base hue and its complement (180° opposite)
     - **Triadic**: Three colors 120° apart on the color wheel
     - **Split Complementary**: Base + two colors flanking the complement

### For Point Cloud Rendering (2D Mandelbrot)

Additional configuration is available in `extendedObjectStore` for point cloud visualizations:

- **Palette Type** (`palette`): `'monochrome' | 'complement' | 'triadic' | 'analogous' | 'shifted'`
- **Palette Cycles** (`paletteCycles`): Number of times the palette repeats (1-20)
- **Invert Colors** (`invertColors`): Reverses the color mapping
- **Interior Color** (`interiorColor`): Color for points inside the set (default: dark version of base color)

---

## Palette Generation Architecture

### TypeScript (CPU-side) - Point Cloud Rendering

For 2D Mandelbrot point clouds, colors are generated on the CPU using TypeScript utilities in [`src/lib/geometry/extended/mandelbrot/colors.ts`](../src/lib/geometry/extended/mandelbrot/colors.ts).

#### Key Functions

1. **`generatePalette(palette, baseColor, steps = 256)`**
   - Creates an array of 256 hex color strings
   - Uses the base color as the foundation
   - Implements different palette algorithms:

   **Monochrome**:
   ```
   Dark (10% lightness) → Base Color → Bright (95% lightness)
   ```

   **Complement**:
   ```
   Base Color → White → Complementary Color (180° hue shift)
   ```

   **Triadic**:
   ```
   Base Color → +120° hue → +240° hue → Base Color (loop)
   ```

   **Analogous**:
   ```
   -60° hue → Base Color → +60° hue
   ```

   **Shifted**:
   ```
   Darkened Base → Base Color → +90° hue shift
   ```

2. **`mapEscapeToColor(normalizedValue, palette, cycles, invertColors, interiorColor)`**
   - Maps a normalized escape time value (0-1) to a color from the palette
   - 0 = escaped immediately (boundary of set)
   - 1 = bounded (interior of set, gets `interiorColor`)
   - Supports palette cycling and inversion

3. **`generatePointColors(normalizedEscapeValues, config, baseColor)`**
   - Main entry point for coloring point clouds
   - Generates the palette, then maps each point's escape value to a color

#### Color Space Utilities

The module includes comprehensive color manipulation functions:

- **Conversions**: `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hexToHsl`, `hslToHex`
- **Manipulations**: `interpolateColor`, `shiftHue`, `darkenColor`, `lightenColor`, `getComplementaryColor`

### GLSL (GPU-side) - Raymarching Shaders

For 3D Mandelbulb and 4D-11D Hyperbulb raymarching, colors are generated **per-fragment** in the GPU shader.

#### Shader Architecture

The GLSL palette functions are defined in [`src/lib/shaders/palette/palette.glsl.ts`](../src/lib/shaders/palette/palette.glsl.ts) as a string constant that gets concatenated into the fragment shaders:

- **Mandelbulb**: [`src/components/canvas/renderers/Mandelbulb/mandelbulb.frag`](../src/components/canvas/renderers/Mandelbulb/mandelbulb.frag)
- **Hyperbulb**: [`src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`](../src/components/canvas/renderers/Hyperbulb/hyperbulb.frag)

#### Key GLSL Functions

1. **`rgb2hsl(vec3 c) -> vec3`**
   - Converts RGB color to HSL color space
   - Returns `vec3(hue, saturation, lightness)` where:
     - Hue: [0, 1] (normalized from 0-360°)
     - Saturation: [0, 1]
     - Lightness: [0, 1]

2. **`hsl2rgb(vec3 hsl) -> vec3`**
   - Converts HSL back to RGB
   - Uses `hue2rgb()` helper function for component calculation

3. **`getLightnessRange(float baseL) -> vec2`**
   - Calculates the lightness range for palette generation
   - Provides wide dynamic range with bias toward darkness
   - Returns `vec2(minL, maxL)`:
     - Dark base colors: [0, 0.7] - mostly dark with bright highlights
     - Light base colors: [0.2, 1.0] - some shadow, mostly bright
     - Mid base colors: [0.05, 0.85] - full range
   - Ensures minimum is always quite dark (`min(baseL * 0.15, 0.08)`) for contrast

4. **`getPaletteColor(vec3 baseHSL, float t, int mode) -> vec3`**
   - **Main palette generation function**
   - Inputs:
     - `baseHSL`: User's surface color in HSL space
     - `t`: Variation value [0, 1] controlling position in the palette
     - `mode`: Palette mode integer (0-4)
   - Returns: RGB color for this variation value

   **Special Handling for Achromatic Colors**:
   - If saturation < 0.1 (black, white, gray), adds:
     - Default hue: 0.0 (red)
     - Moderate saturation: 0.4
   - This makes palette modes meaningful even for grayscale base colors

   **Palette Mode Implementations**:

   - **PALETTE_MONOCHROMATIC (0)**:
     ```glsl
     // Same hue, vary lightness
     newL = mix(minL, maxL, t)
     return hsl2rgb(vec3(h, originalSaturation, newL))
     ```

   - **PALETTE_ANALOGOUS (1)**:
     ```glsl
     // Hue varies ±30° from base (±0.167 normalized)
     hueShift = (t - 0.5) * 0.167
     newH = fract(h + hueShift)
     newL = mix(minL, maxL, t)
     return hsl2rgb(vec3(newH, s, newL))
     ```

   - **PALETTE_COMPLEMENTARY (2)**:
     ```glsl
     // Two colors: base and complement (180° apart)
     complement = fract(h + 0.5)
     newH = (t < 0.5) ? h : complement  // Sharp transition
     newL = mix(minL, maxL, t)
     return hsl2rgb(vec3(newH, s, newL))
     ```

   - **PALETTE_TRIADIC (3)**:
     ```glsl
     // Three colors 120° apart
     hue1 = h
     hue2 = fract(h + 0.333)
     hue3 = fract(h + 0.667)
     newH = (t < 0.333) ? hue1 : ((t < 0.667) ? hue2 : hue3)
     newL = mix(minL, maxL, t)
     return hsl2rgb(vec3(newH, s, newL))
     ```

   - **PALETTE_SPLIT_COMPLEMENTARY (4)**:
     ```glsl
     // Base + two colors flanking complement
     split1 = fract(h + 0.5 - 0.083)  // 150° from base
     split2 = fract(h + 0.5 + 0.083)  // 210° from base
     newH = (t < 0.333) ? h : ((t < 0.667) ? split1 : split2)
     newL = mix(minL, maxL, t)
     return hsl2rgb(vec3(newH, s, newL))
     ```

---

## How Colors Are Applied in Shaders

### Mandelbulb (3D) Shader

File: [`src/components/canvas/renderers/Mandelbulb/mandelbulb.frag`](../src/components/canvas/renderers/Mandelbulb/mandelbulb.frag)

#### Uniforms

```glsl
uniform vec3 uColor;          // Base surface color from visualStore.faceColor
uniform int uPaletteMode;     // Palette mode integer (0-4)
```

#### Color Application Process

1. **Raymarching with Orbit Trap**
   ```glsl
   float RayMarch(vec3 ro, vec3 rd, out float trap)
   ```
   - Marches a ray through the Mandelbulb SDF
   - Computes an **orbit trap** value during iteration
   - Orbit trap combines multiple geometric primitives:
     - Y-plane distance: `abs(z.y)`
     - Y-axis distance: `length(z.xz)`
     - Sphere shell: `abs(length(z) - 0.8)`
     - Iteration count: normalized iteration value
   - Final trap: weighted combination creating complex patterns

2. **Convert Base Color to HSL**
   ```glsl
   vec3 baseHSL = rgb2hsl(uColor);
   ```

3. **Normalize Trap Value**
   ```glsl
   float t = 1.0 - trap;  // Invert: peaks bright, valleys dark
   ```

4. **Generate Surface Color**
   ```glsl
   vec3 surfaceColor = getPaletteColor(baseHSL, t, uPaletteMode);
   ```

5. **Apply Ambient Occlusion**
   ```glsl
   surfaceColor *= (0.3 + 0.7 * ao);  // Darken crevices
   ```

6. **Apply Lighting**
   ```glsl
   // Ambient
   vec3 col = surfaceColor * uAmbientIntensity;

   // Diffuse (Lambert)
   float NdotL = max(dot(normal, lightDir), 0.0);
   col += surfaceColor * uLightColor * NdotL * uDiffuseIntensity;

   // Specular (Blinn-Phong)
   vec3 halfDir = normalize(lightDir + viewDir);
   float NdotH = max(dot(normal, halfDir), 0.0);
   float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity;
   col += uSpecularColor * spec;

   // Fresnel rim lighting (optional)
   if (uFresnelEnabled) {
     float fresnel = fresnelSchlick(VdotN, 0.04);
     col += uRimColor * fresnel * uFresnelIntensity;
   }
   ```

7. **Tone Mapping (optional)**
   ```glsl
   col = applyToneMapping(col, uToneMappingAlgorithm, uExposure);
   ```

### Hyperbulb (4D-11D) Shader

File: [`src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`](../src/components/canvas/renderers/Hyperbulb/hyperbulb.frag)

The Hyperbulb shader uses the **same color application process** as Mandelbulb, with key differences:

#### Additional Uniforms

```glsl
uniform int uDimension;         // 4-11
uniform float uBasisX[11];      // D-dimensional basis vectors
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];
```

#### D-Dimensional SDF

The SDF computation happens in D-dimensional space using hyperspherical coordinates:

```glsl
// Example for dimension D
float r = sqrt(sum of all D coordinates squared);
if (r > escapeRadius) break;

// Compute D-1 angular coordinates (hyperspherical)
theta[0] = acos(z[D-1] / r);
theta[1] = acos(z[D-2] / r1);
// ... etc
```

The orbit trap tracks minimum distances in the D-dimensional iteration, then the color application follows the same pattern as Mandelbulb.

#### Performance Optimizations

- **Fast mode during rotation**: Reduces quality (`MAX_ITER_LQ`, `SURF_DIST_LQ`)
- **Dimension-specific unrolled loops**: Avoids dynamic loops for each dimension (4D, 5D, 6D, 7D, 8D, 9D, 10D, 11D)
- **No soft shadows**: Too expensive for D-dimensional SDF

---

## Data Flow Summary

### Point Cloud (2D Mandelbrot)

```
User selects surface color (#33cc9e)
           ↓
generatePalette('analogous', '#33cc9e', 256)
           ↓
Array of 256 hex colors
           ↓
For each point's escape value (0-1):
  mapEscapeToColor(value, palette, cycles, invert, interior)
           ↓
Point cloud geometry with per-vertex colors
           ↓
PointCloudRenderer renders colored points
```

### Raymarching (3D Mandelbulb, 4D-11D Hyperbulb)

```
User selects surface color (#33cc9e) + colorMode ('analogous')
           ↓
Passed to shader as uniforms:
  uColor = Color(#33cc9e)
  uPaletteMode = 1  (analogous)
           ↓
For each pixel:
  1. Raymarch to find surface intersection
  2. Compute orbit trap value (0-1)
  3. Convert uColor to HSL
  4. getPaletteColor(baseHSL, trap, paletteMode)
  5. Apply lighting (ambient, diffuse, specular, fresnel)
  6. Apply tone mapping
           ↓
Final pixel color
```

---

## Implementation Files

### Core Color Logic

- **TypeScript Utilities**: [`src/lib/geometry/extended/mandelbrot/colors.ts`](../src/lib/geometry/extended/mandelbrot/colors.ts)
  - CPU-side palette generation for point clouds
  - Color space conversions and manipulations

- **GLSL Palette Functions**: [`src/lib/shaders/palette/palette.glsl.ts`](../src/lib/shaders/palette/palette.glsl.ts)
  - Shared GLSL code for shader palette generation
  - Exported as TypeScript string for concatenation

- **Palette Types**: [`src/lib/shaders/palette/types.ts`](../src/lib/shaders/palette/types.ts)
  - `ColorMode` type definition
  - `COLOR_MODE_TO_INT` mapping for shader uniforms
  - UI options for dropdown

### Shaders

- **Mandelbulb Fragment Shader**: [`src/components/canvas/renderers/Mandelbulb/mandelbulb.frag`](../src/components/canvas/renderers/Mandelbulb/mandelbulb.frag)
  - 3D Mandelbulb raymarching
  - Orbit trap computation
  - Per-fragment color generation

- **Hyperbulb Fragment Shader**: [`src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`](../src/components/canvas/renderers/Hyperbulb/hyperbulb.frag)
  - 4D-11D Hyperbulb raymarching
  - D-dimensional SDF with hyperspherical coordinates
  - Same color system as Mandelbulb

### React Components

- **MandelbulbMesh**: [`src/components/canvas/renderers/Mandelbulb/MandelbulbMesh.tsx`](../src/components/canvas/renderers/Mandelbulb/MandelbulbMesh.tsx)
  - Manages shader uniforms
  - Passes `faceColor` and `colorMode` to shader

- **HyperbulbMesh**: [`src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx`](../src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx)
  - Same as Mandelbulb + D-dimensional basis vectors

### State Management

- **Visual Store**: [`src/stores/visualStore.ts`](../src/stores/visualStore.ts)
  - `faceColor`: User's base surface color
  - `colorMode`: Palette algorithm selection
  - Lighting parameters

- **Extended Object Store**: [`src/stores/extendedObjectStore.ts`](../src/stores/extendedObjectStore.ts)
  - `mandelbrot.palette`: Palette type for point clouds
  - `mandelbrot.paletteCycles`: Number of palette repetitions
  - `mandelbrot.invertColors`: Color inversion toggle

---

## Color Theory Principles

The palette system is based on **Adobe Color** theory principles:

- **Monochromatic**: Creates depth through lightness variation while maintaining hue purity
- **Analogous**: Provides smooth color transitions that are visually harmonious
- **Complementary**: Creates high contrast and visual tension with opposing hues
- **Triadic**: Balanced, vibrant color scheme with even hue spacing
- **Split Complementary**: Softer than complementary while maintaining contrast

All algorithms ensure:
- **Visual consistency**: The user's base color is always the foundation
- **Dynamic range**: Wide lightness variation (near-black to bright highlights)
- **Contrast**: Minimum lightness is capped at 8% for depth
- **Achromatic handling**: Grayscale base colors get subtle saturation injection to make palette modes meaningful

---

## Future Enhancements

Potential improvements to the color system:

1. **Custom palette editor**: Allow users to define their own color stops
2. **Palette preview**: Show a gradient preview of the current palette
3. **Color scheme presets**: Save/load favorite color configurations
4. **Gradient mapping**: Apply gradients to specific geometric features (e.g., curvature-based coloring)
5. **Animation**: Smoothly transition between palette modes
6. **Perceptual uniformity**: Use CIELAB or Oklab color space for more perceptually uniform gradients
