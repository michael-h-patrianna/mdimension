# N-Dimensional Pseudo-Kleinian PRD

## Overview

**Pseudo-Kleinian** fractals are a family of escape-time fractals that combine box folds, sphere inversions, and translations to produce otherworldly organic structures—alien tentacles, caverns, coral formations, and impossible architectures. They are related to true Kleinian group limit sets but use simplified operations that are easier to compute and more parameter-rich.

Pseudo-Kleinian is ideal for our N-dimensional visualizer because **all operations are dimension-agnostic conformal transformations**, producing the same scalar distance estimate formula across all dimensions from 3D to 11D.

## What is Pseudo-Kleinian?

### Core Concept

Pseudo-Kleinian fractals iterate a combination of:

1. **Box fold**: Conditional reflections at coordinate boundaries (same as Mandelbox)
2. **Sphere inversion**: Inversion through a sphere (Möbius transformation)
3. **Translation by CSize**: A constant vector added each iteration

The key insight is that the `CSize` translation vector provides rich parameter space for creating varied organic structures, unlike the Mandelbox which uses `c` (the starting point).

### Mathematical Definition

#### Box Fold (per component)

Same as Mandelbox:
```glsl
z[i] = clamp(z[i], -foldLimit, foldLimit) * 2.0 - z[i];
```

#### Sphere Inversion

Inversion through a sphere of radius `R` centered at origin:
```glsl
float r2 = dot(z, z);
if (r2 < minR2) {
    // Inside inner sphere: scale up
    float t = R2 / minR2;
    z *= t;
    dr *= t;
} else if (r2 < R2) {
    // Between spheres: invert
    float t = R2 / r2;
    z *= t;
    dr *= t;
}
```

#### CSize Translation

The distinguishing feature—add a constant N-dimensional vector:
```glsl
z = z * scale + CSize;
dr = dr * abs(scale) + 1.0;
```

Unlike Mandelbox (which adds `c`, the starting point), Pseudo-Kleinian adds a **fixed vector** `CSize` that shapes the overall structure.

#### Complete Iteration

```glsl
for (int i = 0; i < maxIterations; i++) {
    // Box fold (all dimensions)
    for (int j = 0; j < D; j++) {
        z[j] = clamp(z[j], -foldLimit, foldLimit) * 2.0 - z[j];
    }
    
    // Sphere inversion
    float r2 = 0.0;
    for (int j = 0; j < D; j++) r2 += z[j] * z[j];
    
    if (r2 < minR2) {
        float t = fixedR2 / minR2;
        for (int j = 0; j < D; j++) z[j] *= t;
        dr *= t;
    } else if (r2 < fixedR2) {
        float t = fixedR2 / r2;
        for (int j = 0; j < D; j++) z[j] *= t;
        dr *= t;
    }
    
    // Scale and translate by CSize (NOT by c)
    for (int j = 0; j < D; j++) {
        z[j] = z[j] * scale + CSize[j];
    }
    dr = dr * abs(scale) + 1.0;
    
    // Bailout
    if (r2 > escapeRadius2) break;
}
```

### Difference from Mandelbox

| Aspect | Mandelbox | Pseudo-Kleinian |
|--------|-----------|-----------------|
| Translation | `z = scale * z + c` (varies per point) | `z = scale * z + CSize` (constant) |
| Character | Self-similar at all locations | Global structure varies with CSize |
| Parameter sensitivity | Moderate | High (CSize creates dramatic changes) |
| Visual style | Boxy, spongy | Organic, tentacular, alien |

## Why Pseudo-Kleinian for N-Dimensions?

### 1. Operations Are Dimension-Agnostic

All operations use only:
- **Per-component operations**: `clamp`, conditional assignment (box fold)
- **Dot product**: `z·z` for squared magnitude (sphere inversion)
- **Scalar multiplication**: `z *= scalar` (sphere inversion)
- **Vector addition**: `z + CSize` (translation)

None require coordinate system changes between dimensions.

### 2. Conformal Transformations Preserve DE

Box fold, sphere inversion, and uniform scaling are all **conformal transformations**:
- **Box fold**: Reflection (orthogonal transformation)
- **Sphere inversion**: `z' = z * R²/|z|²` has Jacobian = scalar × orthogonal
- **Scaling**: Uniform scaling

The distance estimate remains a simple scalar:
```glsl
DE = length(z) / abs(dr);
```

### 3. CSize Provides N-Dimensional Parameter Space

The `CSize` vector has one component per dimension:
- 3D: 3 parameters (CSize.x, CSize.y, CSize.z)
- 4D: 4 parameters (CSize.x, CSize.y, CSize.z, CSize.w)
- 11D: 11 parameters

This provides a rich, dimension-scaled parameter space for creating varied structures.

### 4. Bounded Volume

With appropriate parameters (`|scale| < 2`, bounded CSize), the fractal remains within a predictable bounding region.

## Raymarching Implementation

### N-Dimensional SDF

```glsl
float pseudoKleinianSDF(vec3 pos, int D, int maxIter, out float trap) {
    // Map 3D position to D-dimensional point via basis vectors
    float z[11];
    for (int i = 0; i < D; i++) {
        z[i] = uOrigin[i] + pos.x * uBasisX[i] + pos.y * uBasisY[i] + pos.z * uBasisZ[i];
    }
    
    float dr = 1.0;
    float minDist = 1000.0;  // Orbit trap
    
    for (int iter = 0; iter < maxIter; iter++) {
        // Box fold (all dimensions)
        for (int j = 0; j < D; j++) {
            z[j] = clamp(z[j], -uFoldLimit, uFoldLimit) * 2.0 - z[j];
        }
        
        // Sphere inversion
        float r2 = 0.0;
        for (int j = 0; j < D; j++) r2 += z[j] * z[j];
        
        if (r2 < uMinRadius2) {
            float t = uFixedRadius2 / uMinRadius2;
            for (int j = 0; j < D; j++) z[j] *= t;
            dr *= t;
        } else if (r2 < uFixedRadius2) {
            float t = uFixedRadius2 / r2;
            for (int j = 0; j < D; j++) z[j] *= t;
            dr *= t;
        }
        
        // Scale and translate by CSize
        for (int j = 0; j < D; j++) {
            z[j] = z[j] * uScale + uCSize[j];
        }
        dr = dr * abs(uScale) + 1.0;
        
        // Orbit trap
        minDist = min(minDist, sqrt(r2));
        
        // Bailout
        if (r2 > uEscapeRadius * uEscapeRadius) break;
    }
    
    float r = 0.0;
    for (int j = 0; j < D; j++) r += z[j] * z[j];
    r = sqrt(r);
    
    trap = minDist;
    return r / abs(dr);
}
```

### Performance Note

For GLSL, we would create unrolled versions for each dimension (4D, 5D, ... 11D) similar to the Hyperbulb shader, avoiding dynamic loops in the hot path.

## N-Dimensional Animation System

### Rotation Planes

Pseudo-Kleinian uses the **same rotation system as all N-dimensional objects**. In N dimensions, there are `N(N-1)/2` independent rotation planes:

| Dimension | Rotation Planes | Plane Names |
|-----------|-----------------|-------------|
| 3D | 3 | XY, XZ, YZ |
| 4D | 6 | XY, XZ, YZ, XW, YW, ZW |
| 5D | 10 | XY, XZ, YZ, XW, YW, ZW, XV, YV, ZV, WV |
| 6D | 15 | + XU, YU, ZU, WU, VU |
| ... | ... | ... |
| 11D | 55 | All pairs of 11 axes |

### How Rotation Works

We use a **3D slice through N-dimensional space**, defined by:

```
c = origin + x·basisX + y·basisY + z·basisZ
```

Where:
- `origin`: N-dimensional vector, position of slice center
- `basisX`, `basisY`, `basisZ`: N-dimensional unit vectors defining slice orientation
- `(x, y, z)`: 3D raymarching coordinates

### Rotation Transformation

When the user rotates in a plane (e.g., XW in 4D), we:

1. **Build the N-dimensional rotation matrix** using `composeRotations(dimension, angles)`
2. **Rotate the basis vectors** through N-dimensional space:
   ```typescript
   rotatedBasisX = rotationMatrix × [1, 0, 0, 0, ...]
   rotatedBasisY = rotationMatrix × [0, 1, 0, 0, ...]
   rotatedBasisZ = rotationMatrix × [0, 0, 1, 0, ...]
   rotatedOrigin = rotationMatrix × origin
   ```
3. **Pass rotated basis to shader** as uniforms

### Pseudo-Kleinian-Specific Animation: CSize Morphing

Beyond the standard N-D slice rotation, Pseudo-Kleinian offers unique animation through its `CSize` vector:

```typescript
interface PseudoKleinianAnimation {
    // Standard N-D rotation (slice orientation)
    sliceRotation: Map<string, number>;  // Per rotation plane
    
    // Pseudo-Kleinian-specific: animate CSize components
    csizeMorph: {
        enabled: boolean;
        mode: 'oscillate' | 'drift' | 'orbit';
        speed: number;
        amplitude: number;
        // Which dimensions to animate
        animatedComponents: number[];
    };
    
    // Parameter cycling
    parameterCycle: {
        enabled: boolean;
        scale: { min: number; max: number; speed: number };
        foldLimit: { min: number; max: number; speed: number };
    };
}
```

### Why This Creates Smooth Morphing

Pseudo-Kleinian morphs smoothly because:

1. **Box fold is continuous at boundaries**: The clamp operation creates smooth transitions
2. **Sphere inversion is continuous**: The `1/r²` scaling varies smoothly
3. **CSize translation is linear**: Adding a smoothly changing vector produces smooth changes
4. **N-D rotation is continuous**: Basis vector changes are infinitesimal per frame

**No jumpcuts** because all operations are continuous functions of their parameters.

### CSize Animation Effects

| Animation Mode | Effect |
|----------------|--------|
| Oscillate | Breathing, pulsing structures |
| Drift | Slowly evolving alien landscapes |
| Orbit | CSize traces a path in N-D space, cycling through forms |

Animating different CSize components produces dramatically different effects:
- **X component**: Horizontal stretching/compression
- **Higher dimensions**: Reveals hidden structure, creates "unwrapping" effects

## Store Integration

### Extended Object Store Configuration

```typescript
interface PseudoKleinianConfig {
    // Core parameters
    scale: number;           // -3.0 to 3.0, default 1.0
    foldLimit: number;       // 0.5 to 2.0, default 1.0
    minRadius: number;       // 0.1 to 1.0, default 0.5
    fixedRadius: number;     // 0.5 to 2.0, default 1.0
    
    // The key parameter: CSize vector (one component per dimension)
    csize: number[];         // D-dimensional vector, e.g., [0.5, 0.5, 0.5, 0.5]
    
    // Iteration control
    maxIterations: number;   // 10 to 100, default 50
    escapeRadius: number;    // 4.0 to 100.0, default 10.0
    
    // Slice position (for dimensions 4+)
    parameterValues: number[];
    
    // CSize animation
    csizeAnimation: {
        enabled: boolean;
        mode: 'oscillate' | 'drift' | 'orbit';
        speed: number;
        amplitude: number;
    };
}
```

### Geometry Store

No changes needed—dimension selection works identically to all N-dimensional objects.

### Rotation Store

No changes needed—rotation planes computed the same way.

## UI Controls

### Parameter Panel

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Scale | -3.0 to 3.0 | 1.0 | Overall structure density |
| Fold Limit | 0.5 to 2.0 | 1.0 | Box fold boundaries |
| Min Radius | 0.1 to 1.0 | 0.5 | Inner sphere for inversion |
| Fixed Radius | 0.5 to 2.0 | 1.0 | Outer sphere for inversion |
| CSize X | -2.0 to 2.0 | 0.5 | X-axis structure |
| CSize Y | -2.0 to 2.0 | 0.5 | Y-axis structure |
| CSize Z | -2.0 to 2.0 | 0.5 | Z-axis structure |
| CSize W+ | -2.0 to 2.0 | 0.5 | Higher dimension structure |
| Iterations | 10 to 100 | 50 | Detail level |

### Animation Controls

Same as existing animation panel:
- Play/Pause toggle
- Speed slider (0.1× to 3×)
- Direction toggle
- Plane selection checkboxes (XY, XZ, YZ, XW, ...)

Plus Pseudo-Kleinian-specific:
- CSize animation toggle
- Animation mode selector (oscillate/drift/orbit)
- Amplitude and speed sliders

## Shader Uniforms

```glsl
// Pseudo-Kleinian parameters
uniform float uScale;
uniform float uFoldLimit;
uniform float uMinRadius2;      // Squared
uniform float uFixedRadius2;    // Squared
uniform float uEscapeRadius;
uniform int uMaxIterations;

// CSize vector (the key parameter)
uniform float uCSize[11];

// N-dimensional slice (same as Hyperbulb)
uniform int uDimension;
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];
```

## Visual Variations

### By CSize Values

| CSize Pattern | Visual Character |
|---------------|------------------|
| (0.5, 0.5, 0.5, ...) | Balanced, symmetric |
| (1.0, 0.2, 0.2, ...) | Elongated tentacles along X |
| (0.8, 0.8, 0.1, ...) | Flat, plate-like structures |
| Oscillating | Breathing, pulsing organic forms |

### By Scale

| Scale | Character |
|-------|-----------|
| -1.5 to -1.0 | Dense, folded organic |
| 1.0 to 1.5 | Open, airy structures |
| 1.5 to 2.0 | Sparse, skeletal |

### Famous Pseudo-Kleinian Presets

| Name | Parameters | Character |
|------|------------|-----------|
| Tentacles | scale=1.0, CSize=(0.5, 0.5, 0.2) | Octopus-like tendrils |
| Coral | scale=1.2, CSize=(0.8, 0.8, 0.8) | Brain coral formations |
| Alien Landscape | scale=0.8, CSize=(1.0, 0.5, 0.3) | Otherworldly terrain |
| Cathedral | scale=1.5, CSize=(0.6, 0.6, 1.0) | Gothic architectural forms |

## Implementation Phases

### Phase 1: Core 3D Pseudo-Kleinian
- [ ] Basic shader with box fold + sphere inversion + CSize
- [ ] Standard raymarching loop
- [ ] Distance estimate: `r / abs(dr)`
- [ ] Parameter UI controls

### Phase 2: N-Dimensional Extension
- [ ] Unrolled SDF functions for 4D-11D
- [ ] D-dimensional CSize vector
- [ ] Basis vector rotation system (reuse from Hyperbulb)

### Phase 3: Animation Integration
- [ ] Connect to existing rotation store
- [ ] Per-plane animation toggles
- [ ] CSize morphing animation
- [ ] Parameter cycling

### Phase 4: Advanced Features
- [ ] Preset library
- [ ] Color algorithms (reuse from Hyperbulb)
- [ ] Performance optimization (adaptive quality)

## Comparison with Related Fractals

| Aspect | Pseudo-Kleinian | Mandelbox | True Kleinian |
|--------|-----------------|-----------|---------------|
| Translation | Constant CSize | Varies with c | Group generators |
| Sphere op | Conditional inversion | Conditional inversion | Full Möbius |
| Box fold | Yes | Yes | No |
| Parameters | CSize (D values) | scale, radii | Group elements |
| Complexity | Medium | Medium | High |
| Character | Organic, alien | Boxy, spongy | Limit sets, gaskets |

## Mathematical Background

### Connection to Kleinian Groups

True Kleinian groups are discrete subgroups of Möbius transformations (PSL(2,ℂ)). Their limit sets produce intricate fractals like Apollonian gaskets.

Pseudo-Kleinian fractals approximate this by:
1. Using sphere inversion (a Möbius transformation)
2. Adding box folds (not true Möbius, but conformal)
3. Using a fixed translation (CSize) instead of group generators

This "pseudo" approach trades mathematical purity for:
- Easier computation
- Richer parameter space
- More varied visual output

### Why the Scalar DE Works

For conformal transformations, the Jacobian has the form:
```
J = s(z) · R(z)
```
Where `s(z)` is a scalar and `R(z)` is an orthogonal matrix.

Since orthogonal matrices preserve length, only the scalar part affects the distance estimate. Tracking the running product of scalars gives:
```
DE = |z_final| / |product of scalars| = r / |dr|
```

This holds for sphere inversion because:
```
z' = z · R² / |z|²
Jacobian = (R² / |z|²) · (I - 2·ẑẑᵀ)
```
The factor `(R² / |z|²)` is our scalar, and `(I - 2·ẑẑᵀ)` is orthogonal (a reflection).

## References

- [Pseudo-Kleinian Thread (Fractal Forums)](http://www.fractalforums.com/3d-fractal-generation/a-]pseudo-kleinian-formula/)
- [Distance Estimated 3D Fractals VI: The Mandelbox (Syntopia)](http://blog.hvidtfeldts.net/index.php/2011/11/distance-estimated-3d-fractals-vi-the-mandelbox/)
- [Kleinian Groups and Hyperbolic 3-Manifolds](https://en.wikipedia.org/wiki/Kleinian_group)
- [Möbius Transformations (Wikipedia)](https://en.wikipedia.org/wiki/M%C3%B6bius_transformation)
