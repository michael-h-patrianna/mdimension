# PRD: Improved Multi-Hue Color Modes

## Scope

This PRD covers color palette improvements for **two distinct rendering systems**:

1. **Raymarched Fractals** (Mandelbulb 3D, Hyperbulb 4D-11D)
   - Uses custom fragment shaders with orbit trap coloring
   - Files: `mandelbulb.frag`, `hyperbulb.frag`
   - Color variation driven by: orbit trap values (0-1)

2. **Face-Rendered Polytopes** (Tesseract, 600-cell, etc.)
   - Uses MeshPhongMaterial with shader injection
   - Files: `FaceRenderer.tsx`, `SurfaceMaterial.ts`
   - Color variation driven by: per-face depth values (0-1)

Both systems share the same palette generation code (`palette.glsl.ts`) but differ in how they compute the variation parameter `t` that drives color selection.

---

## Problem Statement

The current color palette system uses color theory algorithms designed for website UI palettes (complementary, triadic, split-complementary). These algorithms create discrete color transitions that work well for buttons and cards but fail for continuous surfaces (fractals, polytope faces).

### Current Issues

1. **Poor Color Distribution**: At best, users see only 1-2 distinct hues instead of the promised 3+ colors
2. **Visible Banding**: Sharp hue transitions create posterization artifacts on smooth fractal surfaces
3. **Random Appearance**: Colors appear arbitrary rather than revealing fractal structure
4. **Wrong Algorithm Type**: Website color harmony systems don't translate to continuous gradient surfaces

### Root Causes

**Value Distribution Problem**
```glsl
// Current orbit trap computation creates clustered values
trap = planeTrap * 0.3 + axisTrap * 0.2 + sphereTrap * 0.2 + iterTrap * 0.3;
// Each component uses exp(-distance * factor), concentrating values near 0
// After inversion (t = 1.0 - trap), most values are near 1.0
```

**Sharp Transition Problem**
```glsl
// Current triadic mode (example)
if (t < 0.333) {
    newH = hue1;
} else if (t < 0.667) {
    newH = hue2;
} else {
    newH = hue3;
}
// Creates THREE discrete bands with zero blending
```

**Lightness Dominance Problem**
- Lightness varies smoothly across full range (0.08 to 0.7+)
- Hue changes are discrete
- Human eye is more sensitive to lightness than hue
- Result: looks like "shaded monochrome" not "multi-color"

### Research Findings

Fractal visualization uses specialized techniques, **not** web design color systems:

- **Continuous smooth coloring** based on normalized iteration count
- **Histogram coloring** for even distribution
- **HSV/HSL cycling** with exponential mapping
- **LCH coloring** (perceptually uniform)
- **Cosine-based procedural palettes** (Inigo Quilez technique)
- **Distance estimation** methods
- **Orbit trap coloring** with smooth remapping

**Key Source**: [Wikipedia - Plotting algorithms for the Mandelbrot set](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set)

---

## Current Implementation: Two Rendering Systems

### System 1: Raymarched Fractals (Mandelbulb, Hyperbulb)

**Purpose**: Render 3D-11D fractals using ray marching distance estimation

**Files**:
- `src/components/canvas/renderers/Mandelbulb/mandelbulb.frag`
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`
- `src/lib/shaders/palette/palette.glsl.ts` (shared)

**Color Variation Parameter**:
```glsl
// Orbit trap values computed during ray marching
float trap = planeTrap * 0.3 + axisTrap * 0.2 + sphereTrap * 0.2 + iterTrap * 0.3;
float t = 1.0 - trap; // Inverted for better visual distribution

// Then pass to palette function
vec3 color = getPaletteColor(baseHSL, t, colorMode);
```

**Characteristics**:
- `t` values come from distance estimation during iterative fractal computation
- Each pixel independently computes its own trap value
- Values tend to cluster near 0 or 1 (exponential decay from orbit traps)
- Reveals fractal structure through geometric features (plane distance, axis distance, etc.)

**Problem Areas**:
- Orbit trap clustering creates uneven distribution
- Most pixels fall into 1-2 narrow value ranges
- Multi-hue modes show very few actual colors

---

### System 2: Face-Rendered Polytopes (4D+ Objects)

**Purpose**: Render filled faces of n-dimensional polytopes (tesseract, 600-cell, etc.)

**Files**:
- `src/components/canvas/renderers/FaceRenderer.tsx`
- `src/lib/shaders/materials/SurfaceMaterial.ts`
- `src/hooks/useFaceDepths.ts`
- `src/lib/shaders/palette/palette.glsl.ts` (shared)

**Color Variation Parameter**:
```typescript
// CPU-side: Calculate per-face depth values
function useFaceDepths(originalVertices, faces, dimension) {
  if (dimension > 3) {
    // Average of W+ coordinates (index 3+) of face vertices
    depth = average(vertex[3], vertex[4], ..., vertex[dimension-1]);
  } else {
    // Y-coordinate of face centroid
    depth = average(vertex[1]);
  }

  // Normalize to [0,1] range
  return (depth - minDepth) / (maxDepth - minDepth);
}
```

```glsl
// GPU-side: Shader injection via onBeforeCompile
attribute float faceDepth; // Per-vertex attribute (same for all verts in a face)
varying float vDepth;

// Vertex shader
vDepth = faceDepth;

// Fragment shader
vec3 color = getPaletteColor(baseHSL, vDepth, uPaletteMode);
diffuseColor.rgb *= color;
```

**Characteristics**:
- `t` (depth) values computed once per face based on nD spatial position
- All vertices in a face share the same depth value
- Values distributed by geometric position in higher dimensions
- Natural gradual variation across polytope surface (closer faces have similar depths)
- Uses MeshPhongMaterial with custom shader injection (not full custom shader)

**Shader Injection Technique**:
```typescript
material.onBeforeCompile = (shader) => {
  // 1. Add custom attributes/uniforms before vertex shader
  shader.vertexShader = `
    attribute float faceDepth;
    varying float vDepth;
    ${shader.vertexShader}
  `;

  // 2. Pass depth to fragment shader
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>\nvDepth = faceDepth;`
  );

  // 3. Apply palette color in fragment shader
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
    vec3 paletteColor = getPaletteColor(baseHSL, vDepth, uPaletteMode);
    diffuseColor.rgb *= paletteColor;`
  );
};
```

**Problem Areas**:
- Generally better distribution than raymarching (spatial depth varies smoothly)
- But still suffers from discrete hue jumps in multi-hue modes
- Banding appears as distinct colored "layers" of faces
- Color jumps don't correlate with geometric features (arbitrary thresholds)

---

### Shared Palette System

Both systems use the same `getPaletteColor()` GLSL function:

```glsl
vec3 getPaletteColor(vec3 baseHSL, float t, int mode) {
  float h = baseHSL.x;
  float s = baseHSL.y;
  float l = baseHSL.z;

  // Mode 0: Monochromatic - varies lightness only
  if (mode == 0) {
    return hsl2rgb(vec3(h, s, mix(0.2, 0.8, t)));
  }

  // Mode 1: Analogous - small hue shifts (±30°)
  if (mode == 1) {
    float hueShift = (t - 0.5) * 0.167; // ±30° = ±0.0833 * 2
    return hsl2rgb(vec3(fract(h + hueShift), s, l));
  }

  // Mode 2: Complementary - two opposite hues
  // Mode 3: Triadic - three evenly spaced hues
  // Mode 4: Split Complementary - base + two flanking hues
  // ... (discrete if/else logic with sharp thresholds)
}
```

**Key Insight**: Both rendering paths suffer from the same core issue - discrete hue jumps don't work for continuous surfaces. The difference is:
- **Raymarching**: Poor value distribution + discrete jumps = **very few colors visible**
- **Face rendering**: Good value distribution + discrete jumps = **visible color banding**

### Comparison Summary

| Aspect | Raymarching | Face Rendering |
|--------|-------------|----------------|
| **Objects** | Mandelbulb, Hyperbulb | Tesseract, 600-cell, etc. |
| **Shader Type** | Full custom fragment shader | MeshPhongMaterial + injection |
| **Color Driver** | Orbit trap values | Per-face depth values |
| **Value Source** | Runtime ray march computation | Pre-computed on CPU |
| **Distribution** | ❌ Poor (clustered near 0/1) | ✅ Good (spatial variation) |
| **Primary Problem** | Poor distribution + discrete jumps | Discrete jumps only |
| **Visual Symptom** | Only 1-2 colors visible | Visible color bands/layers |
| **Files** | `mandelbulb.frag`, `hyperbulb.frag` | `FaceRenderer.tsx`, `SurfaceMaterial.ts` |
| **Shared Code** | `palette.glsl.ts` | `palette.glsl.ts` |

**Implication**: Solutions must address BOTH value distribution (raymarching) AND discrete transitions (both systems).

---

## Proposed Solutions

### Solution 1: Cosine Gradient Palettes 🌟 RECOMMENDED

**Description**: Replace discrete hue jumps with smooth, cyclic color gradients based on cosine functions.

**Applicability**: ✅ Both raymarching AND face rendering

**Algorithm**:
```glsl
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

// Example palette coefficients
// Rainbow: a=(0.5,0.5,0.5), b=(0.5,0.5,0.5), c=(1,1,1), d=(0,0.33,0.67)
// Fire: a=(0.5,0.5,0.5), b=(0.5,0.5,0.5), c=(1,1,0.5), d=(0.8,0.9,0.3)
```

**Pros**:
- Smooth, continuous color transitions - no banding
- Naturally cyclic - guarantees all colors appear
- Highly customizable with 4 coefficient vectors (a, b, c, d)
- Industry standard technique (Inigo Quilez, Shadertoy)
- Works beautifully with any input distribution (orbit traps OR spatial depth)
- Compact shader code
- **Universal**: Same solution works for both rendering systems

**Cons**:
- Requires pre-computing coefficient vectors for desired palettes
- Less intuitive for users than named color modes
- Need to create UI for selecting palette types

**Implementation Complexity**: Low
- Add `cosinePalette()` function to shader
- Define 5-10 preset coefficient sets
- Add palette selector to UI

**Visual Impact**: ⭐⭐⭐⭐⭐ (Very High)

**New Color Modes**:
- "Rainbow Cycle" - full spectrum smooth cycling
- "Warm Gradient" - oranges/reds/yellows
- "Cool Gradient" - blues/greens/cyans
- "Fire" - black→red→orange→yellow
- "Ocean" - deep blue→cyan→white
- "Sunset" - purple→orange→pink
- "Forest" - dark green→lime→yellow
- "Candy" - pink→purple→blue

**Best For**: Replacing triadic, split-complementary, and any multi-hue modes

---

### Solution 2: Histogram Equalization

**Description**: Remap trap values to ensure even distribution across [0,1] before applying colors.

**Applicability**: ⚠️ Primarily raymarching (orbit traps have poor distribution). Face rendering already has good distribution.

**Algorithm**:
```glsl
// Pass 1: Collect histogram
atomicAdd(histogram[int(trap * 255.0)], 1);

// Pass 2: Build cumulative distribution function (CDF)
for (int i = 1; i < 256; i++) {
    cdf[i] = cdf[i-1] + histogram[i];
}

// Pass 3: Remap values
float equalizedTrap = cdf[int(trap * 255.0)] / float(totalPixels);
```

**Pros**:
- Guarantees all hue bands get equal screen space
- Mathematically optimal distribution
- Works with existing discrete palette modes
- Standard image processing technique

**Cons**:
- Requires two-pass rendering (collect histogram, then render)
- Complex GPU implementation (atomic operations, compute shaders)
- Static histograms don't adapt to camera movement/zoom
- Performance overhead

**Implementation Complexity**: High
- Requires compute shader or SSBO
- Two-pass rendering architecture
- May need fallback for older hardware

**Visual Impact**: ⭐⭐⭐⭐ (High)

**Best For**: Ensuring all colors appear in discrete triadic/complementary modes

---

### Solution 3: Multi-Source Color Mapping

**Description**: Use different geometric features to control different color properties.

**Applicability**:
- ✅ Raymarching: Rich feature set (orbit traps, normals, AO, depth)
- ⚠️ Face rendering: Limited features (only faceDepth available), would need to compute normals/curvature

**Algorithm**:
```glsl
// Map different features to color channels
vec3 worldNormal = normalize((uModelMatrix * vec4(normal, 0.0)).xyz);
float normalAngle = atan(worldNormal.y, worldNormal.x) / (2.0 * PI); // 0-1

float hue = fract(normalAngle + 0.5);  // Normal direction → Hue
float saturation = trap;                // Orbit trap → Saturation
float lightness = ao * (1.0 - depth);   // AO + depth → Lightness

vec3 color = hsl2rgb(vec3(hue, saturation, lightness));
```

**Variations**:
- Curvature → Hue, Depth → Saturation, Trap → Lightness
- X-coordinate → Red, Y-coordinate → Green, Z-coordinate → Blue
- Primary trap → Hue1, Secondary trap → Hue2, blend by Tertiary trap

**Pros**:
- Rich, detailed coloring with clear semantic meaning
- Different features naturally vary at different scales
- Visually stunning, complex results
- No banding issues (smooth features)
- Reveals fractal structure in multiple ways

**Cons**:
- Can be visually busy/chaotic
- May obscure core fractal structure
- Requires careful tuning per fractal type
- Hard to predict results

**Implementation Complexity**: Medium
- Add normal calculation in world space
- Compute additional geometric features
- Combine features with appropriate weights

**Visual Impact**: ⭐⭐⭐⭐⭐ (Very High)

**Best For**: "Artistic" or "Complex" color modes, showcasing intricate fractal detail

---

### Solution 4: Smooth Hue Interpolation with Blending Zones

**Description**: Replace sharp if/else thresholds with smooth blending between hue regions.

**Applicability**: ✅ Both raymarching AND face rendering

**Algorithm**:
```glsl
// BEFORE (current - sharp transitions):
if (t < 0.333) {
    newH = hue1;
} else if (t < 0.667) {
    newH = hue2;
} else {
    newH = hue3;
}

// AFTER (smooth blending):
float blend1 = smoothstep(0.25, 0.45, t);  // Blend from hue1→hue2
float blend2 = smoothstep(0.55, 0.75, t);  // Blend from hue2→hue3

vec3 color1 = hsl2rgb(vec3(hue1, s, newL));
vec3 color2 = hsl2rgb(vec3(hue2, s, newL));
vec3 color3 = hsl2rgb(vec3(hue3, s, newL));

vec3 col = mix(color1, color2, blend1);
col = mix(col, color3, blend2);
```

**Pros**:
- Very easy to implement
- Minimal changes to existing code
- Eliminates visible banding
- Keeps existing palette structure
- No performance impact

**Cons**:
- Still has value distribution problems (doesn't fix clustering)
- Blending zones may create "muddy" intermediate colors
- Doesn't add new hues, just smooths existing transitions
- Band width determined by threshold positions

**Implementation Complexity**: ⭐ (Very Low)
- Replace if/else with mix() + smoothstep()
- 5-10 lines of shader code changes

**Visual Impact**: ⭐⭐⭐ (Medium)

**Best For**: Quick fix for existing triadic/complementary/split-complementary modes

---

### Solution 5: Exponentially Mapped Cyclic Iterations

**Applicability**: ⚠️ Primarily point clouds (2D Mandelbrot). Limited benefit for raymarching/face rendering.

**Description**: Transform iteration count non-linearly to spread colors across zoom levels (from Mandelbrot literature).

**Algorithm**:
```glsl
// For point cloud / escape-time rendering
float S = 1.5;  // Exponent for non-linear mapping
int N = 256;    // Palette size
float v = pow((iters / float(maxIters)) * float(paletteCycles), S);
v = fract(v);  // Modulo 1.0 for cycling

vec3 color = palette[int(v * 255.0)];
```

**Mathematical Basis**:
```
v = ((i/max_i)^S * N)^1.5 mod N

where:
- i = iteration count after bailout
- max_i = iteration limit
- S = scaling exponent
- N = palette size
```

**Pros**:
- Proven technique from Mandelbrot visualization literature
- Creates color banding that scales proportionally with zoom
- Palette cycles become more frequent at deeper zooms
- Brings out detail at different magnifications

**Cons**:
- Best suited for escape-time algorithms (point clouds), not orbit traps
- May not help Mandelbulb/Hyperbulb raymarching specifically
- Still requires good base palette (doesn't fix palette itself)
- Limited applicability to our use case

**Implementation Complexity**: Low (for point clouds), High (for raymarching)

**Visual Impact**: ⭐⭐⭐ (Medium for point clouds), ⭐ (Low for raymarching)

**Best For**: 2D Mandelbrot point cloud rendering, not 3D/4D raymarching

---

### Solution 6: Perceptually Uniform Color Spaces (LCH/Oklab)

**Description**: Convert to LCH or Oklab color space where hue transitions appear visually smooth and even.

**Applicability**: ✅ Both raymarching AND face rendering

**Algorithm (LCH)**:
```glsl
// LCH = Cylindrical Lab space (Lightness, Chroma, Hue)
vec3 getLCHColor(float t, vec3 baseHSL) {
    float h = baseHSL.x;
    float s = baseHSL.y;
    float l = baseHSL.z;

    // Use cosine for smooth value variation
    float v = 0.5 + 0.5 * cos(PI * t);

    // LCH coordinates
    float L = 75.0 - (75.0 * v);           // Lightness: 0-75
    float C = 28.0 + (75.0 - 75.0 * v);    // Chroma (decreases as L increases)
    float H = fract(h + t) * 360.0;         // Hue cycling

    // Convert LCH → Lab → RGB
    vec3 rgb = lch2rgb(vec3(L, C, H));
    return rgb;
}

// Requires LCH↔RGB conversion functions
```

**Oklab Alternative**:
- More modern, better perceptual uniformity
- Simpler math than LCH
- Better gamut handling
- Requires Oklab↔RGB conversion

**Pros**:
- Perceptually uniform hue transitions (no unexpected "muddy" zones)
- No out-of-gamut issues with proper chroma limiting
- Professional color science approach
- Hue steps appear equal to human eye
- Better than HSL/RGB for smooth gradients

**Cons**:
- Requires LCH↔RGB or Oklab↔RGB conversion (additional shader code)
- More complex to tune/understand
- May still have distribution issues (doesn't fix trap clustering)
- Conversion functions are moderately expensive

**Implementation Complexity**: ⭐⭐⭐ (Medium)
- Add color space conversion functions (~50-100 lines)
- Modify palette generation logic
- Test for out-of-gamut colors

**Visual Impact**: ⭐⭐⭐⭐ (Medium-High)

**Best For**: Professional-quality rendering, matching user color expectations

---

### Solution 7: Distance-Field Gradient Coloring

**Applicability**: ⚠️ Raymarching only (requires distance field). Not applicable to face rendering.

**Description**: Color based on distance from camera or SDF distance values, creating smooth, predictable variation.

**Algorithm**:
```glsl
// Distance from camera
float dist = length(hitPoint - uCameraPosition);
float hue = fract(dist * 0.3 + uTime * 0.05);  // Cycling with distance + optional animation

// Or: Distance field value
float sdfDist = GetDist(hitPoint);
float hue = fract(sdfDist * 2.0);

// Or: Radial distance from origin
float radial = length(hitPoint);
float hue = fract(radial * 0.5);

vec3 color = hsv2rgb(vec3(hue, 0.8, 0.9));
```

**Variations**:
- **Depth bands**: Color by distance from camera (depth fog effect)
- **Isosurfaces**: Color by SDF value (contour lines)
- **Radial waves**: Color by distance from origin (concentric circles)
- **Animated**: Add time component for flowing colors

**Pros**:
- Extremely smooth (distance is continuous)
- Predictable, intuitive results
- Easy to understand ("color by depth")
- No dependency on fractal iteration details
- No banding possible
- Very cheap to compute

**Cons**:
- Ignores fractal mathematical properties completely
- May look generic (not fractal-specific)
- Less connection to the underlying mathematics
- Doesn't reveal iteration structure

**Implementation Complexity**: ⭐ (Very Low)
- 1-3 lines of shader code
- Just compute distance and map to hue

**Visual Impact**: ⭐⭐⭐ (Medium)

**Best For**: Simple, aesthetically pleasing modes; "Depth" or "Distance" color mode

---

### Solution 8: Orbit Trap Remapping Functions

**Applicability**: ⚠️ Raymarching only (orbit traps). Face rendering already has good distribution.

**Description**: Transform orbit trap values to improve distribution before color lookup.

**Algorithm**:
```glsl
// CURRENT (poor distribution):
float t = 1.0 - trap;  // Most values near 1.0

// OPTION A: Power curve (spread low values)
float t = pow(trap, 0.5);  // Square root
float t = pow(trap, 0.33); // Cube root (more aggressive)

// OPTION B: Smoothstep (compress edges, expand middle)
float t = smoothstep(0.1, 0.9, trap);

// OPTION C: Cyclic repetition (force multiple bands)
float t = fract(trap * 3.0);  // 3 cycles of the palette

// OPTION D: Exponential (compress high values)
float t = 1.0 - exp(-trap * 2.0);

// OPTION E: Sine wave (smooth cycling)
float t = 0.5 + 0.5 * sin(trap * PI * 2.0);
```

**Parameter Tuning**:
```glsl
uniform float trapPower;      // Power curve exponent (0.3-2.0)
uniform float trapCycles;     // Number of palette cycles (1-10)
uniform float trapOffset;     // Shift the pattern (0-1)

float t = pow(trap, trapPower);
t = fract(t * trapCycles + trapOffset);
```

**Pros**:
- VERY easy to implement (1 line change)
- Can dramatically improve value distribution
- Tunable with simple parameters
- Works with existing palette code
- No performance cost
- Can be animated (trapOffset)

**Cons**:
- Trial-and-error tuning required
- May need different curves per fractal type/zoom level
- Doesn't fundamentally change color algorithm
- Band positions change (may need adjustment)

**Implementation Complexity**: ⭐ (Very Low)
- Literally add 1 line before color lookup
- Optional: add uniform for user control

**Visual Impact**: ⭐⭐⭐⭐ (Medium-High)

**Best For**: Quick, immediate improvement to existing system; user-tunable "Trap Power" slider

---

### Solution 9: Normal-Based Coloring (Matcap Style)

**Applicability**: ✅ Both raymarching AND face rendering (normals available in both)

**Description**: Map surface normal direction to hue, similar to environment mapping or matcap materials.

**Algorithm**:
```glsl
// Transform normal to view space
vec3 viewNormal = normalize((uViewMatrix * vec4(worldNormal, 0.0)).xyz);

// Map normal direction to hue (0-360°)
float hue = atan(viewNormal.y, viewNormal.x) / (2.0 * PI);  // -0.5 to 0.5
hue = fract(hue + 0.5);  // 0 to 1

// Saturation from normal tilt (vertical=0, horizontal=1)
float sat = length(viewNormal.xy);

// Or: use normal components directly
vec3 color = abs(viewNormal);  // RGB = XYZ
```

**Variations**:
- **Matcap lookup**: Use normal to sample a 2D texture (artistic control)
- **World-space normal**: Independent of camera (colors don't change with view)
- **Normal + trap**: Blend normal-based color with trap-based color
- **Curvature**: Color by surface curvature (second derivative of normal)

**Pros**:
- Always smooth (normals vary continuously)
- Visually striking, shows surface structure clearly
- No banding possible
- Independent of iteration count
- Reveals geometric complexity
- Works well with lighting

**Cons**:
- Colors change with camera rotation (view-space)
- May not feel "fractal-like" (geometric, not mathematical)
- Can hide iteration-based structure
- World-space variant has no variation from single view

**Implementation Complexity**: ⭐⭐ (Low)
- Already have normals computed
- Add atan2() for hue, or abs() for RGB
- Optional: add matcap texture lookup

**Visual Impact**: ⭐⭐⭐⭐ (High)

**Best For**: Interactive exploration, "sculptural" or "geometric" appearance modes

---

### Solution 10: Hybrid Multi-Algorithm System

**Applicability**: ✅ Universal - framework for all rendering systems

**Description**: Implement multiple color algorithms and let users switch between them or blend them together.

**Architecture**:
```glsl
// Enum for color algorithms
#define COLOR_COSINE_PALETTE 0
#define COLOR_HSV_CYCLE 1
#define COLOR_MULTI_SOURCE 2
#define COLOR_NORMAL_BASED 3
#define COLOR_DISTANCE_FIELD 4
#define COLOR_CUSTOM 5

uniform int uColorAlgorithm;
uniform float uAlgorithmBlend;  // Blend between two algorithms

vec3 getColor(float trap, vec3 normal, vec3 hitPoint, float ao, float depth) {
    vec3 color1, color2;

    switch(uColorAlgorithm) {
        case COLOR_COSINE_PALETTE:
            color1 = cosinePalette(trap, uPaletteA, uPaletteB, uPaletteC, uPaletteD);
            break;
        case COLOR_HSV_CYCLE:
            color1 = hsv2rgb(vec3(fract(trap * uCycles), 0.8, 0.9));
            break;
        case COLOR_MULTI_SOURCE:
            color1 = multiSourceColor(trap, normal, hitPoint, ao, depth);
            break;
        case COLOR_NORMAL_BASED:
            color1 = normalBasedColor(normal);
            break;
        case COLOR_DISTANCE_FIELD:
            color1 = distanceFieldColor(hitPoint);
            break;
    }

    // Optional: blend with secondary algorithm
    if (uAlgorithmBlend > 0.0) {
        color2 = getSecondaryColor(...);
        color1 = mix(color1, color2, uAlgorithmBlend);
    }

    return color1;
}
```

**UI Design**:
```
Color Mode: [Dropdown]
  - Cosine Palette (Rainbow, Fire, Ocean, Sunset, etc.)
  - HSV Cycle
  - Multi-Source (Normal + Trap + Depth)
  - Normal-Based (Matcap style)
  - Distance Field
  - Custom

Advanced:
  [x] Enable Algorithm Blending
  Secondary Algorithm: [Dropdown]
  Blend Amount: [Slider 0-100%]
```

**Pros**:
- Maximum flexibility for users
- Users can find what works best for their use case
- Educational - demonstrates different techniques
- Future-proof architecture (easy to add new algorithms)
- Professional-grade control
- Enables complex hybrid effects

**Cons**:
- Increased UI complexity (can overwhelm users)
- Larger shader code (multiple algorithms)
- Maintenance burden (more code to test)
- Need good defaults for each algorithm
- Performance hit if blending multiple expensive algorithms

**Implementation Complexity**: ⭐⭐⭐⭐ (Medium-High)
- Implement 5-8 different algorithms
- Create UI for selection and parameters
- Add blending system
- Test all combinations

**Visual Impact**: Variable (⭐⭐⭐ to ⭐⭐⭐⭐⭐ depending on algorithm)

**Best For**: Power users, exploration, professional applications, educational use

---

## Implementation Recommendations

### Phase 1: Quick Wins (Immediate Improvement)

**Week 1-2**: Implement Solutions 8 + 4
1. Add trap remapping with power curve: `trap = pow(trap, 0.5)`
2. Replace sharp if/else with smooth mix/smoothstep
3. Add "Trap Power" slider to UI (0.2-2.0)
4. Test and tune

**Expected Result**: Existing modes look significantly better with minimal effort

---

### Phase 2: Core Replacement (Best Quality)

**Week 3-4**: Implement Solution 1 (Cosine Gradients)

**Files to modify**:
- Raymarching: `mandelbulb.frag`, `hyperbulb.frag`
- Face rendering: `SurfaceMaterial.ts` (shader injection code)
- Shared: `palette.glsl.ts` (add cosinePalette function)

**Steps**:
1. Add `cosinePalette()` function to shared palette.glsl.ts
2. Update both raymarching shaders to use cosine palettes
3. Update SurfaceMaterial.ts shader injection for face rendering
4. Define 8-10 preset palettes with coefficient vectors:
   - Rainbow Cycle
   - Fire
   - Ocean
   - Sunset
   - Forest
   - Candy
   - Monochrome (grayscale)
   - Custom (user-editable)
5. Create UI dropdown to replace "Color Mode"
6. Test on both Mandelbulb (raymarched) and Tesseract (face-rendered)
7. Deprecate old discrete modes (or keep for compatibility)

**Expected Result**: Smooth, beautiful gradients that work with any value distribution - both raymarching and face rendering

---

### Phase 3: Advanced Features (Polish)

**Week 5-6**: Add Solutions 6 + 9 as optional modes
1. Implement LCH color space conversion
2. Add "Normal-Based" mode for geometric coloring
3. Create "Advanced Color Options" panel with:
   - Algorithm selector (Cosine / LCH / Normal / Distance)
   - Trap remapping controls
   - Palette cycle count
   - Animation speed (optional)

**Expected Result**: Professional-grade color options rivaling commercial fractal software

---

### Phase 4: Power User Features (Optional)

**Week 7+**: Implement Solutions 3 + 10
1. Multi-source color mapping system
2. Algorithm blending
3. Custom palette editor (edit cosine coefficients visually)
4. Preset library (save/load color schemes)

**Expected Result**: Maximum flexibility, suitable for artistic production use

---

## Success Metrics

### Visual Quality
- ✅ All hues in palette are visible on rendered fractal
- ✅ No visible color banding on smooth surfaces
- ✅ Colors reveal fractal structure (not random)
- ✅ Colors look intentional/professional

### User Experience
- ✅ Color modes have clear, understandable names
- ✅ Preview or description helps users choose modes
- ✅ Defaults look good without tweaking
- ✅ Advanced users can fine-tune

### Technical Performance
- ✅ No frame rate impact (<5% overhead)
- ✅ Works on all supported GPUs
- ✅ Shader compile time reasonable (<1 second)

---

## Technical Specifications

### Shader Changes

#### Raymarching Shaders

**Files**:
- `src/components/canvas/renderers/Mandelbulb/mandelbulb.frag`
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`

**Required Additions**:
```glsl
// Cosine palette function
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

// Trap remapping
float remapTrap(float trap, float power, float cycles, float offset) {
    trap = pow(trap, power);
    trap = fract(trap * cycles + offset);
    return trap;
}

// Optional: LCH conversion
vec3 lch2rgb(vec3 lch) { /* ... */ }
vec3 rgb2lch(vec3 rgb) { /* ... */ }
```

**Uniforms to Add**:
```glsl
// Palette coefficients (for cosine mode)
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;

// Trap remapping controls
uniform float uTrapPower;    // 0.2-2.0, default 0.5
uniform float uTrapCycles;   // 1-10, default 1
uniform float uTrapOffset;   // 0-1, default 0

// Color algorithm selector
uniform int uColorAlgorithm;  // 0=cosine, 1=LCH, 2=normal, 3=distance
```

---

#### Face Rendering Shaders

**Files**:
- `src/lib/shaders/materials/SurfaceMaterial.ts` (shader injection via onBeforeCompile)
- `src/lib/shaders/palette/palette.glsl.ts` (shared functions)

**Implementation**: MeshPhongMaterial with custom shader injection

**Current Injection Points**:
```typescript
// 1. Add custom attributes/uniforms (before #define PHONG)
shader.vertexShader = `
  attribute float faceDepth;
  varying float vDepth;
  ${PHONG_CUSTOM_UNIFORMS_GLSL}
  ${shader.vertexShader}
`;

// 2. Pass faceDepth to fragment shader (after #include <begin_vertex>)
shader.vertexShader = shader.vertexShader.replace(
  '#include <begin_vertex>',
  `#include <begin_vertex>\nvDepth = faceDepth;`
);

// 3. Apply palette color (after #include <color_fragment>)
shader.fragmentShader = shader.fragmentShader.replace(
  '#include <color_fragment>',
  `#include <color_fragment>
  ${PALETTE_FUNCTIONS_GLSL}
  vec3 paletteColor = getPaletteColor(uBaseHSL, vDepth, uPaletteMode);
  diffuseColor.rgb *= paletteColor;`
);
```

**Required Changes for Cosine Palettes**:
```typescript
// Update PHONG_CUSTOM_UNIFORMS_GLSL constant
const PHONG_CUSTOM_UNIFORMS_GLSL = `
  uniform vec3 uBaseHSL;
  uniform int uPaletteMode;
  uniform vec3 uRimColor;
  uniform float uFresnelIntensity;
  // NEW: Cosine palette coefficients
  uniform vec3 uPaletteA;
  uniform vec3 uPaletteB;
  uniform vec3 uPaletteC;
  uniform vec3 uPaletteD;
  uniform int uColorAlgorithm;
`;

// Update createPhongPaletteMaterial() to include new uniforms
material.userData.shader.uniforms = {
  ...material.userData.shader.uniforms,
  uPaletteA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
  uPaletteB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
  uPaletteC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
  uPaletteD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
  uColorAlgorithm: { value: 0 },
};

// Update updatePhongPaletteMaterial() to sync new settings
```

**Key Difference**: Face rendering shares same palette GLSL functions as raymarching, but:
- Uses `faceDepth` attribute instead of orbit trap computation
- Injection via `onBeforeCompile` maintains Three.js Phong lighting
- Must update both vertex and fragment shaders separately

---

### TypeScript Changes

**Palette Types**: `src/lib/shaders/palette/types.ts`
```typescript
export type ColorMode =
  | 'monochromatic'
  | 'cosinePalette'  // NEW
  | 'lchCycle'       // NEW
  | 'normalBased'    // NEW
  | 'distanceField'  // NEW
  | 'multiSource'    // NEW
  // Keep old modes for backwards compatibility
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'splitComplementary'

export interface CosinePalettePreset {
  name: string
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
  d: [number, number, number]
}

export const COSINE_PALETTE_PRESETS: Record<string, CosinePalettePreset> = {
  rainbow: {
    name: 'Rainbow Cycle',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67]
  },
  fire: {
    name: 'Fire',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 0.5],
    d: [0.8, 0.9, 0.3]
  },
  // ... more presets
}
```

**Visual Store**: `src/stores/visualStore.ts`
```typescript
interface VisualState {
  // ... existing fields

  // New fields
  cosinePalettePreset: string
  trapPower: number
  trapCycles: number
  trapOffset: number
  colorAlgorithm: 'cosine' | 'lch' | 'normal' | 'distance' | 'multiSource'
}

// New actions
setCosinePalettePreset: (preset: string) => void
setTrapPower: (power: number) => void
setTrapCycles: (cycles: number) => void
setTrapOffset: (offset: number) => void
setColorAlgorithm: (algorithm: string) => void
```

### UI Changes

**New Control Panel**: `src/components/controls/ColorModeControls.tsx`
```tsx
<ControlSection title="Color Palette">
  <Dropdown
    label="Palette Mode"
    value={cosinePalettePreset}
    onChange={setCosinePalettePreset}
    options={[
      { value: 'rainbow', label: 'Rainbow Cycle' },
      { value: 'fire', label: 'Fire' },
      { value: 'ocean', label: 'Ocean' },
      { value: 'sunset', label: 'Sunset' },
      { value: 'forest', label: 'Forest' },
      { value: 'candy', label: 'Candy' },
      { value: 'monochrome', label: 'Monochrome' },
      { value: 'custom', label: 'Custom...' },
    ]}
  />

  <CollapsibleSection title="Advanced">
    <Slider
      label="Trap Power"
      min={0.2}
      max={2.0}
      step={0.1}
      value={trapPower}
      onChange={setTrapPower}
    />

    <Slider
      label="Palette Cycles"
      min={1}
      max={10}
      step={1}
      value={trapCycles}
      onChange={setTrapCycles}
    />

    <Slider
      label="Color Offset"
      min={0}
      max={1}
      step={0.01}
      value={trapOffset}
      onChange={setTrapOffset}
    />
  </CollapsibleSection>
</ControlSection>
```

---

## Complete UI Specification (All Solutions Implemented)

If ALL 10 solutions are implemented as user-selectable options, the UI would transform from a simple dropdown into a comprehensive color control system.

### Current UI (Before)

```
┌─ Surface Color ────────────────┐
│ 🎨 [Color Picker]              │
└────────────────────────────────┘

┌─ Color Mode ───────────────────┐
│ Dropdown: ▼                    │
│   • Monochromatic              │
│   • Analogous                  │
│   • Complementary              │
│   • Triadic                    │
│   • Split Complementary        │
└────────────────────────────────┘
```

### Proposed UI (After - All Solutions)

```
┌─ Color System ─────────────────────────────────┐
│                                                 │
│ ┌─ Algorithm ─────────────────────────────┐    │
│ │ Primary: [Cosine Gradients        ▼]    │    │
│ │   • Cosine Gradients (Recommended) ★     │    │
│ │   • LCH/Oklab Color Space                │    │
│ │   • Normal-Based (MatCap)                │    │
│ │   • Distance-Field Gradient              │    │
│ │   • Multi-Source Mapping                 │    │
│ │   • Legacy Modes (Classic)               │    │
│ │   • Hybrid/Custom Blend                  │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ ┌─ Palette ───────────────────────────────┐    │
│ │ (shown when Cosine Gradients selected)   │    │
│ │                                          │    │
│ │ Preset: [Rainbow Cycle          ▼]      │    │
│ │   • Rainbow Cycle                        │    │
│ │   • Fire                                 │    │
│ │   • Ocean                                │    │
│ │   • Sunset                               │    │
│ │   • Forest                               │    │
│ │   • Candy                                │    │
│ │   • Neon                                 │    │
│ │   • Pastel                               │    │
│ │   • Monochrome                           │    │
│ │   • Custom... (opens editor)             │    │
│ │                                          │    │
│ │ Base Hue: 🎨 [Color Picker]             │    │
│ │ (shifts entire palette)                  │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ ┌─ Distribution Control ──────────────────┐    │
│ │ (affects value mapping, not colors)      │    │
│ │                                          │    │
│ │ ☑ Enable Histogram Equalization         │    │
│ │   (raymarching only, auto-disabled for   │    │
│ │    face rendering)                       │    │
│ │                                          │    │
│ │ Power Curve:  ━━━●━━━━  0.5             │    │
│ │               0.2 ──────── 2.0           │    │
│ │   (redistributes values)                 │    │
│ │                                          │    │
│ │ Palette Cycles: ━●━━━━━━  1             │    │
│ │                 1 ──────── 10            │    │
│ │   (repeat colors multiple times)         │    │
│ │                                          │    │
│ │ Color Offset:  ━━━━━●━━  0.5            │    │
│ │                0.0 ──────── 1.0          │    │
│ │   (shift color pattern)                  │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ ┌─ Advanced Options ─────────────────────┐ ▼  │
│ │ (collapsible section)                   │    │
│ │                                         │    │
│ │ Color Space: [sRGB           ▼]        │    │
│ │   • sRGB (Standard)                     │    │
│ │   • LCH (Perceptual)                    │    │
│ │   • Oklab (Modern)                      │    │
│ │                                         │    │
│ │ Blending Mode: [None         ▼]        │    │
│ │   • None (Single Algorithm)             │    │
│ │   • Blend Two Algorithms                │    │
│ │   • Multi-Source Composite              │    │
│ │                                         │    │
│ │ (shown when Blend selected)             │    │
│ │ Secondary Algorithm: [Normal-Based ▼]   │    │
│ │ Blend Amount: ━━━●━━━━  50%            │    │
│ │               0% ──────── 100%          │    │
│ │                                         │    │
│ │ ☑ Smooth Interpolation                  │    │
│ │   (blend between color regions)         │    │
│ │                                         │    │
│ │ Blend Zone Width: ━━●━━━━  20%         │    │
│ │                   0% ─────── 50%        │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ ┌─ Multi-Source Mapping ──────────────────┐ ▼ │
│ │ (shown when Multi-Source selected)       │   │
│ │                                          │   │
│ │ Hue Source:    [Normal Direction  ▼]    │   │
│ │   • Orbit Trap / Face Depth (default)   │   │
│ │   • Normal Direction                     │   │
│ │   • World Position X/Y/Z                 │   │
│ │   • Distance from Camera                 │   │
│ │   • Curvature                            │   │
│ │                                          │   │
│ │ Saturation:    [Orbit Trap        ▼]    │   │
│ │ Lightness:     [Ambient Occlusion ▼]    │   │
│ │                                          │   │
│ │ Hue Scale:    ━━━━━●━━  1.0             │   │
│ │               0.0 ──────── 2.0           │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─ Legacy Modes ──────────────────────────┐ ▼ │
│ │ (shown when Legacy selected)             │   │
│ │                                          │   │
│ │ Classic Mode: [Complementary    ▼]      │   │
│ │   • Monochromatic                        │   │
│ │   • Analogous                            │   │
│ │   • Complementary                        │   │
│ │   • Triadic                              │   │
│ │   • Split Complementary                  │   │
│ │                                          │   │
│ │ ☑ Use Smooth Interpolation               │   │
│ │   (reduces banding in legacy modes)      │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─ Presets ───────────────────────────────┐   │
│ │ Save Current   Load Preset   Reset       │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Breakdown

**1. Primary Algorithm Selector**
- Dropdown with 7 main categories
- Each selection shows/hides different control panels below
- Default: "Cosine Gradients" (recommended)
- Shows availability badge for raymarching-only options

**2. Palette Controls** (Cosine Gradients mode)
- Preset dropdown with 10+ presets
- Visual preview of gradient (horizontal color bar)
- Base hue color picker to shift entire palette
- "Edit Custom" button opens coefficient editor modal

**3. Distribution Control Panel**
- Always visible (affects all algorithms)
- Histogram equalization toggle (raymarching only - auto-disables for polytopes)
- Power curve slider (Solution 8)
- Palette cycles slider (repeat pattern)
- Color offset slider (phase shift)
- Each control shows real-time preview

**4. Advanced Options** (Collapsible)
- Color space selector (sRGB/LCH/Oklab)
- Blending mode for hybrid combinations
- Secondary algorithm selection (when blending)
- Smooth interpolation toggle (Solution 4)
- Blend zone width control

**5. Multi-Source Mapping Panel** (Conditional)
- Only shown when "Multi-Source Mapping" algorithm selected
- Three dropdowns: Hue source, Saturation source, Lightness source
- Each can pull from different geometric features
- Scale controls for each channel

**6. Legacy Modes Panel** (Conditional)
- Only shown when "Legacy Modes" selected
- Classic 5-mode dropdown (backward compatibility)
- Smooth interpolation toggle to improve legacy modes

**7. Preset System**
- Save button: stores current settings to local storage
- Load button: dropdown with saved presets
- Reset button: return to recommended defaults
- Each preset stores ALL settings (algorithm + parameters)

### Algorithm-Specific UI States

#### When "Cosine Gradients" Selected:
```
✓ Palette controls visible
✓ Distribution controls visible
✓ Advanced options available
✗ Multi-source panel hidden
✗ Legacy modes panel hidden
```

#### When "Normal-Based (MatCap)" Selected:
```
✓ Color space selector visible
✓ Distribution controls visible (limited)
✗ Palette presets hidden (uses normal direction)
✓ Base hue color picker (shifts the mapping)
```

#### When "Multi-Source Mapping" Selected:
```
✓ Multi-source panel visible
✓ Distribution controls visible
✓ Advanced blending options
✗ Simple palette presets hidden
```

#### When "Legacy Modes" Selected:
```
✓ Legacy modes panel visible
✓ Smooth interpolation toggle
✓ Distribution controls (power curve, cycles, offset)
✗ Modern algorithm controls hidden
```

### Visual Enhancements

**Real-Time Preview Bar**:
Every control panel includes a live gradient preview showing current settings:
```
Current Palette:
┌────────────────────────────────────────┐
│ ████▓▓▓▓▒▒▒▒░░░░▒▒▒▒▓▓▓▓████          │ ← Live gradient
└────────────────────────────────────────┘
  0.0                              1.0
```

**Algorithm Badges**:
```
• Cosine Gradients          ★ Recommended  🌍 Universal
• Histogram Equalization    ⚡ Raymarching Only
• Normal-Based (MatCap)     🌍 Universal
• Distance-Field Gradient   ⚡ Raymarching Only
```

**Tooltips** (hover for info):
- "Power Curve: Lower values spread out dark colors, higher values compress them"
- "Palette Cycles: Repeat the color pattern multiple times across the surface"
- "Histogram Equalization: Ensures even color distribution (2-pass rendering, slight performance cost)"

### Responsive Layout

**Desktop**: Full vertical panel (as shown above)
**Tablet**: Collapsible sections default to collapsed
**Mobile**: Single accordion, one section open at a time

### State Management Updates

```typescript
// New store structure
interface ColorSettings {
  // Primary algorithm
  algorithm: 'cosine' | 'lch' | 'normal' | 'distance' | 'multiSource' | 'legacy' | 'hybrid'

  // Cosine palette settings
  cosinePalette: {
    preset: 'rainbow' | 'fire' | 'ocean' | 'sunset' | 'forest' | 'candy' | 'monochrome' | 'custom'
    coefficients: { a: vec3, b: vec3, c: vec3, d: vec3 }
    baseHue: number
  }

  // Distribution controls
  distribution: {
    enableHistogramEq: boolean
    powerCurve: number        // 0.2-2.0
    paletteCycles: number     // 1-10
    colorOffset: number       // 0-1
  }

  // Advanced options
  advanced: {
    colorSpace: 'srgb' | 'lch' | 'oklab'
    blendMode: 'none' | 'two-algorithm' | 'multi-source'
    secondaryAlgorithm?: string
    blendAmount: number       // 0-100
    smoothInterpolation: boolean
    blendZoneWidth: number    // 0-50
  }

  // Multi-source mapping
  multiSource: {
    hueSource: 'trap' | 'normal' | 'position' | 'distance' | 'curvature'
    saturationSource: string
    lightnessSource: string
    hueScale: number
    saturationScale: number
    lightnessScale: number
  }

  // Legacy modes (backward compatibility)
  legacy: {
    mode: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'splitComplementary'
    smoothInterpolation: boolean
  }
}
```

### File Changes

**New Files**:
- `src/components/controls/ColorSystemPanel.tsx` - Main container
- `src/components/controls/color/AlgorithmSelector.tsx`
- `src/components/controls/color/PaletteControls.tsx`
- `src/components/controls/color/DistributionControls.tsx`
- `src/components/controls/color/MultiSourcePanel.tsx`
- `src/components/controls/color/LegacyModePanel.tsx`
- `src/components/controls/color/PresetManager.tsx`
- `src/components/controls/color/CosinePaletteEditor.tsx` - Modal for custom coefficients
- `src/components/ui/GradientPreview.tsx` - Live preview bar

**Updated Files**:
- `src/stores/useVisualStore.ts` - Expand color settings
- `src/components/sidebar/VisualsPanel.tsx` - Replace old controls

### Progressive Disclosure Strategy

To avoid overwhelming users, implement progressive disclosure:

1. **Default View** (Beginner):
   - Algorithm dropdown
   - Palette preset dropdown
   - Basic sliders (2-3 most important)
   - "Show Advanced Options" button

2. **Advanced View** (Intermediate):
   - All algorithm options
   - Distribution controls
   - Multi-source mapping
   - "Show Expert Options" button

3. **Expert View** (Advanced):
   - Custom coefficient editor
   - Algorithm blending
   - Per-channel source selection
   - Raw parameter inputs

Controlled by Settings → Interface → Color Controls Complexity: [Beginner|Intermediate|Expert]

---

## Alternative Approaches Considered

### Approach A: Fix Existing Modes with Better Distribution Only
**Rejected Because**: Doesn't solve fundamental algorithm mismatch. Discrete hue jumps will always create banding on smooth surfaces.

### Approach B: Add More Discrete Color Bands
**Rejected Because**: More bands = smaller bands = more banding. Doesn't solve the core issue.

### Approach C: Use Pre-rendered Texture Lookup Tables
**Rejected Because**: Inflexible, requires texture memory, harder to customize, doesn't solve distribution problem.

### Approach D: Keep Existing Modes, Add New Ones Separately
**Accepted (Phase 2)**: Best of both worlds - maintain backwards compatibility while adding superior options.

---

## References

### Research Sources
- [Wikipedia: Plotting algorithms for the Mandelbrot set](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set)
- [Inigo Quilez: Procedural Palettes](https://iquilezles.org/articles/palettes/)
- [Inigo Quilez: Orbit Traps](https://iquilezles.org/articles/orbittraps3d/)
- Fractal Forums: Color theory discussions
- Shadertoy: Cosine palette examples

### Related Documentation
- [docs/color_modes.md](../color_modes.md) - Comprehensive color system documentation
- [docs/prd/enhanced-visuals-rendering-pipeline.md](enhanced-visuals-rendering-pipeline.md)
- [src/lib/shaders/palette/](../../src/lib/shaders/palette/) - Current palette implementation

### Related Code Files

**Raymarching (Fractals)**:
- `src/components/canvas/renderers/Mandelbulb/mandelbulb.frag` - 3D fractal shader
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag` - 4D-11D fractal shader
- `src/components/canvas/renderers/Mandelbulb/MandelbulbMesh.tsx` - React component
- `src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx` - React component

**Face Rendering (Polytopes)**:
- `src/components/canvas/renderers/FaceRenderer.tsx` - Face rendering component
- `src/lib/shaders/materials/SurfaceMaterial.ts` - Material with shader injection
- `src/hooks/useFaceDepths.ts` - Per-face depth calculation

**Shared**:
- `src/lib/shaders/palette/palette.glsl.ts` - GLSL palette functions
- `src/lib/shaders/palette/types.ts` - Type definitions
- `src/lib/geometry/extended/mandelbrot/colors.ts` - CPU-side palette generation

---

## Appendix: Cosine Palette Presets

### Preset Coefficient Library

```typescript
export const COSINE_PALETTE_LIBRARY = {
  // Vibrant multi-hue
  rainbow: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67]
  },

  // Warm tones
  fire: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 0.5],
    d: [0.8, 0.9, 0.3]
  },

  sunset: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.7, 0.4],
    d: [0.0, 0.15, 0.20]
  },

  // Cool tones
  ocean: {
    a: [0.2, 0.5, 0.8],
    b: [0.2, 0.4, 0.2],
    c: [2.0, 1.0, 1.0],
    d: [0.0, 0.25, 0.25]
  },

  ice: {
    a: [0.4, 0.6, 0.8],
    b: [0.3, 0.4, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.5, 0.6, 0.7]
  },

  // Nature
  forest: {
    a: [0.2, 0.5, 0.2],
    b: [0.3, 0.5, 0.3],
    c: [1.0, 1.0, 0.5],
    d: [0.2, 0.5, 0.3]
  },

  // Candy/Pastel
  candy: {
    a: [0.8, 0.5, 0.4],
    b: [0.2, 0.4, 0.2],
    c: [2.0, 1.0, 1.0],
    d: [0.0, 0.25, 0.25]
  },

  // Grayscale
  monochrome: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [0.0, 0.0, 0.0],
    d: [0.0, 0.0, 0.0]
  },

  // High contrast
  neon: {
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [2.0, 1.0, 0.0],
    d: [0.5, 0.2, 0.25]
  },

  // Earth tones
  earth: {
    a: [0.4, 0.3, 0.2],
    b: [0.3, 0.3, 0.2],
    c: [1.0, 1.0, 0.5],
    d: [0.0, 0.1, 0.2]
  }
}
```

### Interactive Palette Designer (Future Feature)

```tsx
// Visual editor for creating custom cosine palettes
<PaletteDesigner>
  <PreviewGradient palette={currentPalette} />

  <CoefficientEditor>
    <Vector3Slider label="A (Base)" value={a} onChange={setA} />
    <Vector3Slider label="B (Amplitude)" value={b} onChange={setB} />
    <Vector3Slider label="C (Frequency)" value={c} onChange={setC} />
    <Vector3Slider label="D (Phase)" value={d} onChange={setD} />
  </CoefficientEditor>

  <Button onClick={savePreset}>Save as Preset</Button>
  <Button onClick={exportJSON}>Export JSON</Button>
</PaletteDesigner>
```

---

**Status**: Draft - Ready for Review
**Next Steps**: Team review → Prioritize solutions → Begin Phase 1 implementation
**Owner**: Engineering Team
**Reviewers**: Design Team, Product Manager
