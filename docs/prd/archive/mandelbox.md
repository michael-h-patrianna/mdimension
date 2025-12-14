# N-Dimensional Mandelbox PRD

## Overview

The **Mandelbox** is a box-like fractal discovered by Tom Lowe in 2010. Unlike the Mandelbulb (which uses hyperspherical coordinate transformations), the Mandelbox uses simple geometric operations—conditional reflections and sphere inversions—that generalize naturally to any dimension.

This makes the Mandelbox an ideal candidate for our N-dimensional visualizer, as **the exact same operations work identically from 3D to 11D** without coordinate system changes.

## What is the Mandelbox?

### Core Concept

The Mandelbox is an escape-time fractal defined by iterating:

```
z_{n+1} = scale * sphereFold(boxFold(z_n)) + c
```

Where:
- **boxFold**: Conditionally reflects each coordinate at ±1 boundaries
- **sphereFold**: Conditionally inverts through inner/outer spheres
- **scale**: A constant (typically -2.0 to 3.0, with -1.5 producing the classic look)
- **c**: The starting point (Julia mode) or added each iteration (Mandelbrot mode)

### Mathematical Definition

#### Box Fold (per component)

For each dimension `i`:
```
if (z[i] > 1.0)  z[i] = 2.0 - z[i]     // Reflect at +1
if (z[i] < -1.0) z[i] = -2.0 - z[i]    // Reflect at -1
```

Equivalent compact form:
```glsl
z[i] = clamp(z[i], -1.0, 1.0) * 2.0 - z[i];
```

#### Sphere Fold

Using the squared magnitude `r² = z·z`:
```
if (r² < minRadius²)
    z *= (fixedRadius / minRadius)²    // Inner sphere: scale up
else if (r² < fixedRadius²)
    z *= fixedRadius² / r²             // Outer sphere: invert
// else: no change
```

Standard parameters: `minRadius = 0.5`, `fixedRadius = 1.0`

#### Complete Iteration

```glsl
// Box fold
for (int i = 0; i < D; i++) {
    z[i] = clamp(z[i], -foldingLimit, foldingLimit) * 2.0 - z[i];
}

// Sphere fold
float r2 = dot(z, z);
if (r2 < minRadius2) {
    float t = fixedRadius2 / minRadius2;
    z *= t;
    dr *= t;
} else if (r2 < fixedRadius2) {
    float t = fixedRadius2 / r2;
    z *= t;
    dr *= t;
}

// Scale and translate
z = scale * z + c;
dr = dr * abs(scale) + 1.0;
```

## Why Mandelbox for N-Dimensions?

### 1. Operations Are Dimension-Agnostic

All operations use only:
- **Per-component operations**: `clamp`, conditional assignment
- **Dot product**: `z·z` for squared magnitude
- **Scalar multiplication**: `z *= scalar`

None of these require coordinate system changes or trigonometric functions that behave differently in higher dimensions.

### 2. Conformal Transformations Preserve DE

The box fold, sphere fold, and uniform scaling are all **conformal transformations** (preserve angles locally). Their Jacobians are always `scalar × orthogonal matrix`, meaning the distance estimate remains a simple scalar:

```glsl
DE = length(z) / abs(dr);
```

This is the exact same formula regardless of dimension.

### 3. Bounded Volume

The Mandelbox is inherently bounded. With standard parameters and `|scale| ≤ 3`, the fractal is contained within approximately `|z[i]| < 4` for all dimensions.

### 4. Rich Visual Variety

Different parameter combinations produce:
- Box-like structures (high positive scale)
- Sponge-like patterns (scale ≈ -2)
- Organic/flowery shapes (scale ≈ -1.5)
- Abstract geometric patterns (scale ≈ 1)

## Raymarching Implementation

### Signed Distance Function (SDF)

```glsl
float mandelboxSDF(vec3 pos, int D, float scale, int maxIter, out float trap) {
    // Map 3D position to D-dimensional point via basis vectors
    float z[11];
    float c[11];
    for (int i = 0; i < D; i++) {
        c[i] = uOrigin[i] + pos.x * uBasisX[i] + pos.y * uBasisY[i] + pos.z * uBasisZ[i];
        z[i] = c[i];
    }

    float dr = 1.0;
    float minDist = 1000.0;  // Orbit trap

    for (int iter = 0; iter < maxIter; iter++) {
        // Box fold (all dimensions)
        for (int i = 0; i < D; i++) {
            z[i] = clamp(z[i], -uFoldingLimit, uFoldingLimit) * 2.0 - z[i];
        }

        // Sphere fold
        float r2 = 0.0;
        for (int i = 0; i < D; i++) r2 += z[i] * z[i];

        if (r2 < uMinRadius2) {
            float t = uFixedRadius2 / uMinRadius2;
            for (int i = 0; i < D; i++) z[i] *= t;
            dr *= t;
        } else if (r2 < uFixedRadius2) {
            float t = uFixedRadius2 / r2;
            for (int i = 0; i < D; i++) z[i] *= t;
            dr *= t;
        }

        // Scale and translate
        for (int i = 0; i < D; i++) {
            z[i] = scale * z[i] + c[i];
        }
        dr = dr * abs(scale) + 1.0;

        // Update orbit trap
        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        // Bailout
        if (r2 > uEscapeRadius * uEscapeRadius) break;
    }

    float r = 0.0;
    for (int i = 0; i < D; i++) r += z[i] * z[i];
    r = sqrt(r);

    trap = minDist;
    return r / abs(dr);
}
```

### Performance Note

For GLSL, we would create unrolled versions for each dimension (4D, 5D, ... 11D) similar to the Hyperbulb shader, avoiding dynamic loops and array indexing in the hot path.

## N-Dimensional Animation System

### Rotation Planes

The Mandelbox uses the **same rotation system as polytopes**. In N dimensions, there are `N(N-1)/2` independent rotation planes:

| Dimension | Rotation Planes | Plane Names |
|-----------|-----------------|-------------|
| 3D | 3 | XY, XZ, YZ |
| 4D | 6 | XY, XZ, YZ, XW, YW, ZW |
| 5D | 10 | XY, XZ, YZ, XW, YW, ZW, XV, YV, ZV, WV |
| 6D | 15 | + XU, YU, ZU, WU, VU |
| 7D | 21 | + XA6, YA6, ZA6, WA6, VA6, UA6 |
| ... | ... | ... |
| 11D | 55 | All pairs of 11 axes |

### How Rotation Works

We use a **3D slice through N-dimensional space**, defined by:

```
c = origin + x·basisX + y·basisY + z·basisZ
```

Where:
- `origin`: N-dimensional vector, position of slice center
- `basisX`, `basisY`, `basisZ`: N-dimensional unit vectors defining the slice orientation
- `(x, y, z)`: 3D raymarching coordinates

### Rotation Transformation

When the user rotates in a plane (e.g., XW), we:

1. **Build the N-dimensional rotation matrix** using `composeRotations(dimension, angles)`
2. **Rotate the basis vectors** through N-dimensional space:
   ```typescript
   rotatedBasisX = rotationMatrix × [1, 0, 0, 0, ...]
   rotatedBasisY = rotationMatrix × [0, 1, 0, 0, ...]
   rotatedBasisZ = rotationMatrix × [0, 0, 1, 0, ...]
   rotatedOrigin = rotationMatrix × origin
   ```
3. **Pass rotated basis to shader** as uniforms

### Mathematical Detail: Rotation Matrix

A rotation in plane (i, j) by angle θ modifies only 4 elements of the identity matrix:

```
R[i][i] = cos(θ)
R[j][j] = cos(θ)
R[i][j] = -sin(θ)
R[j][i] = sin(θ)
```

Multiple rotations are composed by matrix multiplication. The order matters—different orders produce different orientations.

### Why This Creates Smooth Morphing

When rotating in an "extra-dimensional" plane (e.g., XW in 4D):

1. The X basis vector smoothly rotates toward the W dimension
2. The 3D slice "tilts" through the 4th dimension
3. Different cross-sections of the N-dimensional fractal become visible
4. The fractal appears to morph organically

**No jumpcuts occur** because:
- Rotation matrices are continuous in angle
- The fractal's SDF is continuous in space
- Basis vector changes are infinitesimal per frame

### Animation Parameters

Following the existing animation system from `animationStore.ts`:

```typescript
interface MandelboxAnimation {
  // Inherited from existing system
  isPlaying: boolean;
  speed: number;           // 0.1 to 3.0
  direction: 1 | -1;
  animatingPlanes: Set<string>;  // e.g., {"XW", "YZ"}

  // Mandelbox-specific
  parameterAnimation?: {
    scale: { from: number; to: number; duration: number };
    foldingLimit: { from: number; to: number; duration: number };
  };
}
```

## Store Integration

### Extended Object Store Configuration

```typescript
interface MandelboxConfig {
  // Core parameters
  scale: number;           // -3.0 to 3.0, default -1.5
  foldingLimit: number;    // 0.5 to 2.0, default 1.0
  minRadius: number;       // 0.1 to 1.0, default 0.5
  fixedRadius: number;     // 0.5 to 2.0, default 1.0

  // Iteration control
  maxIterations: number;   // 10 to 100, default 50
  escapeRadius: number;    // 4.0 to 100.0, default 10.0

  // Slice position (for dimensions 4+)
  parameterValues: number[]; // Values for dimensions beyond 3D

  // Zoom (for deep exploration)
  zoomLevel: number;       // 0.001 to 10.0, default 1.0
  zoomCenter: [number, number, number]; // 3D center of zoom
}
```

### Geometry Store

No changes needed—dimension selection works identically to hypercube/hyperbulb.

### Rotation Store

No changes needed—rotation planes are computed the same way for all N-dimensional objects.

## UI Controls

### Parameter Panel

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Scale | -3.0 to 3.0 | -1.5 | Shape character (negative = folded/organic) |
| Folding Limit | 0.5 to 2.0 | 1.0 | Box fold boundary |
| Min Radius | 0.1 to 1.0 | 0.5 | Inner sphere threshold |
| Fixed Radius | 0.5 to 2.0 | 1.0 | Outer sphere threshold |
| Iterations | 10 to 100 | 50 | Detail level |
| Zoom | 0.001 to 10.0 | 1.0 | Deep exploration |

### Animation Controls

Same as existing animation panel:
- Play/Pause toggle
- Speed slider (0.1× to 3×)
- Direction toggle
- Plane selection checkboxes (XY, XZ, YZ, XW, YW, ZW, ...)

## Shader Uniforms

```glsl
// Mandelbox parameters
uniform float uScale;          // Iteration scale factor
uniform float uFoldingLimit;   // Box fold boundary
uniform float uMinRadius2;     // Inner sphere radius squared
uniform float uFixedRadius2;   // Outer sphere radius squared
uniform float uEscapeRadius;   // Bailout radius
uniform int uMaxIterations;    // Iteration count

// N-dimensional slice (same as Hyperbulb)
uniform int uDimension;
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];

// Zoom
uniform float uZoomLevel;
uniform vec3 uZoomCenter;
```

## Implementation Phases

### Phase 1: Core 3D Mandelbox
- [ ] Basic shader with box fold + sphere fold
- [ ] Standard raymarching loop
- [ ] Distance estimate: `r / abs(dr)`
- [ ] Parameter UI controls

### Phase 2: N-Dimensional Extension
- [ ] Unrolled SDF functions for 4D-11D
- [ ] Basis vector rotation system (reuse from Hyperbulb)
- [ ] Dimension-aware UI

### Phase 3: Animation Integration
- [ ] Connect to existing rotation store
- [ ] Per-plane animation toggles
- [ ] Parameter animation (scale morphing)

### Phase 4: Advanced Features
- [ ] Zoom controls
- [ ] Color algorithms (reuse from Hyperbulb)
- [ ] Performance optimization (adaptive quality)

## Visual Examples by Scale

| Scale | Character |
|-------|-----------|
| -1.5 | Classic folded/organic look |
| -2.0 | More sponge-like |
| -1.0 | Soft, flower-like |
| 1.0 | Abstract geometric |
| 2.0 | Boxy, structured |
| 3.0 | Very boxy, less detail |

## References

- [Tom Lowe's Original Mandelbox](http://www.fractalforums.com/3d-fractal-generation/amazing-fractal/)
- [Distance Estimated 3D Fractals (Syntopia)](http://blog.hvidtfeldts.net/index.php/2011/06/distance-estimated-3d-fractals-part-i/)
- [Inigo Quilez - Mandelbox SDF](https://iquilezles.org/articles/mandelbox/)
