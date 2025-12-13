# N-Dimensional Menger Sponge PRD

## Overview

The **Menger Sponge** is a classic fractal cube created by Karl Menger in 1926. It is constructed by recursively removing cross-shaped sections from a cube. Unlike escape-time fractals (Mandelbrot, Mandelbox), the Menger sponge is a purely geometric object defined by **Iterated Function Systems (IFS)** or equivalently by **modular arithmetic on coordinates**.

This makes the Menger sponge an excellent candidate for our N-dimensional visualizer because **the construction rules generalize trivially to any dimension** using the same coordinate-based logic.

## What is the Menger Sponge?

### Core Concept

The Menger sponge is constructed by:

1. Start with a cube
2. Divide it into 27 smaller cubes (3×3×3 grid)
3. Remove the center cube and the 6 face-center cubes (7 total)
4. Repeat recursively on the remaining 20 cubes

The key insight: a point is **removed** if **two or more coordinates** are in the "middle third" of any subdivision level.

### Mathematical Definition

A point `(x, y, z)` in [0,1]³ is in the Menger sponge if and only if, at every scale level `k`:

```
NOT (two or more of {x, y, z} have digit 1 in base-3 position k)
```

Equivalently, for any scale level, if we look at the base-3 representation:
- If a coordinate's k-th digit is 1, that coordinate is in the "middle third"
- If 2+ coordinates are simultaneously in the middle third → point is removed

### N-Dimensional Generalization

In N dimensions, the **Menger N-cube** (also called **Sierpiński N-cube**) follows the same rule:

> A point is removed if **two or more coordinates** are in the middle third at any scale level.

This means:
- **3D**: Remove if 2+ of {x, y, z} are middle → classic Menger sponge
- **4D**: Remove if 2+ of {x, y, z, w} are middle → 4D Menger hypersponge
- **ND**: Remove if 2+ of {x₁, x₂, ..., xₙ} are middle

The number of sub-cubes kept at each level:
- 3D: 20 out of 27 (keeping rate: 20/27 ≈ 0.741)
- 4D: 40 out of 81 (keeping rate: 40/81 ≈ 0.494)
- ND: `(3ⁿ - (n choose 2) × 2ⁿ⁻² × ... )` — becomes sparser in higher dimensions

## Why Menger Sponge for N-Dimensions?

### 1. Identical Logic in All Dimensions

The membership test is the same regardless of dimension:

```glsl
bool isRemoved = false;
for (int level = 0; level < maxLevels; level++) {
    int middleCount = 0;
    for (int i = 0; i < D; i++) {
        int digit = int(floor(z[i] * 3.0)) % 3;
        if (digit == 1) middleCount++;
    }
    if (middleCount >= 2) {
        isRemoved = true;
        break;
    }
    z = fract(z * 3.0);  // Zoom into next level
}
```

### 2. Exact SDF via Fold Operations

The Menger sponge has an elegant SDF using **Kaleidoscopic IFS (KIFS)** fold operations:

```glsl
float mengerSDF(vec3 p) {
    float d = sdBox(p, vec3(1.0));  // Start with unit cube
    float s = 1.0;

    for (int i = 0; i < iterations; i++) {
        // Fold into positive octant
        p = abs(p);

        // Fold across diagonal planes (creates 3×3×3 symmetry)
        if (p.x < p.y) p.xy = p.yx;
        if (p.x < p.z) p.xz = p.zx;
        if (p.y < p.z) p.yz = p.zy;

        // Scale and translate
        s *= 3.0;
        p = p * 3.0 - vec3(2.0);

        // Fold back negative parts
        p.z = max(p.z, -1.0);

        // Update distance
        d = max(d, sdCross(p) / s);
    }
    return d;
}
```

### 3. Bounded Volume

The Menger sponge is always contained within a unit cube (or any bounding box you choose). No projection extremes, no unbounded growth.

### 4. Consistent Visual Character

Unlike escape-time fractals where different parameter regions look wildly different, the Menger sponge has a **consistent, recognizable structure** at all scales and in all dimensions—always a porous, lattice-like object.

## Raymarching Implementation

### N-Dimensional SDF

```glsl
float mengerSDF_ND(vec3 pos, int D, int maxIter) {
    // Map 3D position to D-dimensional point via basis vectors
    float z[11];
    for (int i = 0; i < D; i++) {
        z[i] = uOrigin[i] + pos.x * uBasisX[i] + pos.y * uBasisY[i] + pos.z * uBasisZ[i];
    }

    // Start with D-dimensional box distance
    float d = sdBoxND(z, D, 1.0);
    float s = 1.0;

    for (int iter = 0; iter < maxIter; iter++) {
        // Fold into positive orthant
        for (int i = 0; i < D; i++) {
            z[i] = abs(z[i]);
        }

        // Sort coordinates (bubble sort for small D)
        // This creates the N-dimensional kaleidoscopic symmetry
        for (int i = 0; i < D - 1; i++) {
            for (int j = i + 1; j < D; j++) {
                if (z[i] < z[j]) {
                    float tmp = z[i];
                    z[i] = z[j];
                    z[j] = tmp;
                }
            }
        }

        // Scale and translate
        s *= 3.0;
        for (int i = 0; i < D; i++) {
            z[i] = z[i] * 3.0 - 2.0;
        }

        // Fold back: keep the largest coordinates positive
        // This is the N-D generalization of p.z = max(p.z, -1.0)
        for (int i = 2; i < D; i++) {
            z[i] = max(z[i], -1.0);
        }

        // Update distance with cross distance
        d = max(d, sdCrossND(z, D) / s);
    }

    return d;
}

// N-dimensional box SDF
float sdBoxND(float z[11], int D, float size) {
    float maxDist = 0.0;
    for (int i = 0; i < D; i++) {
        maxDist = max(maxDist, abs(z[i]) - size);
    }
    return maxDist;
}

// N-dimensional cross SDF (union of axis-aligned beams)
// A cross removes points where 2+ coordinates are in [-1, 1]
float sdCrossND(float z[11], int D) {
    // For Menger: the cross is the region where 2+ coords are in middle
    // We compute the second-smallest absolute value
    // (if it's < 1, the point is in the cross)

    // Find two smallest |z[i]| values
    float smallest = 1e10;
    float secondSmallest = 1e10;
    for (int i = 0; i < D; i++) {
        float v = abs(z[i]);
        if (v < smallest) {
            secondSmallest = smallest;
            smallest = v;
        } else if (v < secondSmallest) {
            secondSmallest = v;
        }
    }

    return secondSmallest - 1.0;  // Negative inside cross
}
```

### Distance Estimate

Unlike escape-time fractals, the Menger sponge has a **true geometric SDF**:

```glsl
// No running derivative needed - it's a real distance
return d;  // Already a proper distance estimate
```

The fold operations preserve distance (reflections are isometries), and the scaling is tracked explicitly via `s`.

## N-Dimensional Animation System

### Rotation Planes

The Menger sponge uses the **same rotation system as all other N-dimensional objects**. In N dimensions, there are `N(N-1)/2` independent rotation planes:

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
- `basisX`, `basisY`, `basisZ`: N-dimensional unit vectors defining the slice orientation
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

### Mathematical Detail: Rotation Matrix

A rotation in plane (i, j) by angle θ modifies only 4 elements of the identity matrix:

```
R[i][i] = cos(θ)
R[j][j] = cos(θ)
R[i][j] = -sin(θ)
R[j][i] = sin(θ)
```

Multiple rotations are composed by matrix multiplication.

### Why This Creates Smooth Morphing

When rotating in an "extra-dimensional" plane (e.g., XW in 4D):

1. The X basis vector smoothly rotates toward the W dimension
2. The 3D slice "tilts" through the 4th dimension
3. Different cross-sections of the N-dimensional Menger hypersponge become visible
4. The holes and structure shift and reconnect smoothly

**No jumpcuts occur** because:
- Rotation matrices are continuous in angle
- The Menger SDF is continuous in space
- All operations (fold, sort, max) are continuous

### Animation Parameters

Following the existing animation system:

```typescript
interface MengerAnimation {
  // Inherited from existing system
  isPlaying: boolean;
  speed: number;           // 0.1 to 3.0
  direction: 1 | -1;
  animatingPlanes: Set<string>;  // e.g., {"XW", "YZ"}

  // Menger-specific (minimal - it's mostly parameter-free)
  iterationAnimation?: {
    iterations: { from: number; to: number; duration: number };
  };
}
```

## Store Integration

### Extended Object Store Configuration

```typescript
interface MengerConfig {
  // Core parameters
  iterations: number;      // 3 to 8, default 5
  scale: number;           // Size of the bounding cube, default 1.0

  // Slice position (for dimensions 4+)
  parameterValues: number[]; // Values for dimensions beyond 3D
}
```

### Geometry Store

No changes needed—dimension selection works identically to all other N-dimensional objects.

### Rotation Store

No changes needed—rotation planes are computed the same way for all N-dimensional objects.

## UI Controls

### Parameter Panel

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Iterations | 3 to 8 | 5 | Detail level (more = finer holes) |
| Scale | 0.5 to 2.0 | 1.0 | Overall size |

The Menger sponge is notably **parameter-light** compared to escape-time fractals—its character comes from the geometry, not tunable parameters.

### Animation Controls

Same as existing animation panel:
- Play/Pause toggle
- Speed slider (0.1× to 3×)
- Direction toggle
- Plane selection checkboxes (XY, XZ, YZ, XW, YW, ZW, ...)

## Shader Uniforms

```glsl
// Menger parameters
uniform int uIterations;       // Recursion depth
uniform float uScale;          // Bounding box size

// N-dimensional slice (same as Hyperbulb/Mandelbox)
uniform int uDimension;
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];
```

## Dimensional Characteristics

### How the Menger Sponge Changes with Dimension

| Dimension | Kept Cubes | Visual Character |
|-----------|------------|------------------|
| 3D | 20/27 | Classic sponge with square holes |
| 4D | 40/81 | Sparser, more intricate tunnels |
| 5D | 80/243 | Very porous, lace-like |
| 6D+ | Increasingly sparse | Skeletal lattice structure |

As dimension increases, the "two or more middle" rule removes proportionally more volume, making the structure increasingly sparse and delicate.

### Hausdorff Dimension

The fractal dimension of the 3D Menger sponge is:
```
D = log(20) / log(3) ≈ 2.727
```

For N-dimensional Menger:
```
D_N = log(kept_cubes) / log(3)
```

Where `kept_cubes` follows the formula for N-dimensional cross removal.

## Implementation Phases

### Phase 1: Core 3D Menger Sponge
- [ ] Basic KIFS fold shader
- [ ] Box SDF + cross subtraction
- [ ] Standard raymarching with true distance

### Phase 2: N-Dimensional Extension
- [ ] Generalized fold operations for D dimensions
- [ ] N-dimensional cross SDF
- [ ] Basis vector rotation system (reuse from Hyperbulb)

### Phase 3: Animation Integration
- [ ] Connect to existing rotation store
- [ ] Per-plane animation toggles

### Phase 4: Visual Polish
- [ ] Color algorithms (reuse from Hyperbulb)
- [ ] Ambient occlusion (built into fold depth)
- [ ] Performance optimization

## Comparison with Other Fractals

| Aspect | Menger Sponge | Mandelbox | Hyperbulb |
|--------|---------------|-----------|-----------|
| Type | Geometric IFS | Escape-time | Escape-time |
| Parameters | 1 (iterations) | 4+ | 2+ |
| SDF | True distance | Approximate DE | Approximate DE |
| Character | Consistent lattice | Parameter-dependent | Power-dependent |
| Performance | Fast (no escape test) | Medium | Medium |
| N-D generalization | Trivial | Natural | Requires hyperspherical |

## Artistic Variations

### Possible Extensions

1. **Jerusalem Cube**: Different removal pattern (remove edges instead of center+faces)
2. **Sierpiński Carpet**: 2D version (good for 2D mode)
3. **Hybrid Menger-Mandelbox**: Apply Menger folds followed by Mandelbox iteration
4. **Smooth Menger**: Use smooth-min for the cross subtraction

These could be additional object types or parameter modes.

## References

- [Menger Sponge (Wikipedia)](https://en.wikipedia.org/wiki/Menger_sponge)
- [Kaleidoscopic IFS (Knighty)](http://www.fractalforums.com/ifs-iterated-function-systems/kaleidoscopic-(escape-time-ifs)/)
- [Inigo Quilez - Menger Sponge SDF](https://iquilezles.org/articles/menger/)
- [N-dimensional Sierpiński](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_carpet#Analogues_in_higher_dimensions)
