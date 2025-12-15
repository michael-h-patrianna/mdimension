# N-Dimensional Fractal Opportunities Analysis

## Executive Summary

This document analyzes fractal types that meet our strict constraints:
1. **Single geometry/renderer for ALL dimensions 3D-11D**
2. **GPU raymarching with SDF**
3. **Bounded volume** (no projection extremes)
4. **Smooth organic morphing** during N-D rotation (no jumpcuts)

## Already Documented

| Fractal | PRD | Key Characteristic |
|---------|-----|-------------------|
| Hyperbulb | Implemented | Hyperspherical power map |
| Mandelbox | `mandelbox.md` | Box fold + sphere fold |
| Menger Sponge | `menger-sponge.md` | Kaleidoscopic IFS |

---

## New Opportunities

### 1. Kaleidoscopic IFS (KIFS) - Platonic Solid Family

**What it is**: Recursive fold operations based on symmetry planes of Platonic solids, producing stunning crystalline and organic forms.

**Why it works in N-D**:
- Folds are hyperplane reflections: `z -= 2.0 * min(0.0, dot(z, n)) * n`
- This formula works identically in ANY dimension
- N-dimensional regular polytopes (simplex, cross-polytope, hypercube) provide fold planes
- Conformal transformations → scalar DE

**Core operations**:
```glsl
// Hyperplane fold (works in any dimension)
void fold(inout float z[11], float n[11], int D) {
    float d = 0.0;
    for (int i = 0; i < D; i++) d += z[i] * n[i];
    if (d < 0.0) {
        for (int i = 0; i < D; i++) z[i] -= 2.0 * d * n[i];
    }
}
```

**N-D Fold planes**:
- **Simplex symmetry**: N+1 vertices in N-D, generates N(N+1)/2 reflection planes
- **Cross-polytope symmetry**: 2N vertices, coordinate plane reflections
- **Hypercube symmetry**: Diagonal fold planes

**Animation potential**: ⭐⭐⭐⭐⭐
- Rotating fold plane normals creates organic morphing
- Adding rotation between folds creates infinite variety
- "Opening flower" effects, crystalline growth patterns

**Complexity**: Medium
**Visual character**: Crystalline, geometric, can become organic with rotation

---

### 2. Apollonian Gasket (Sphere Inversion Fractal)

**What it is**: Recursive sphere packing using sphere inversions (Möbius transformations).

**Why it works in N-D**:
- Sphere inversion: `z' = z / |z|²` — works identically in any dimension
- Descartes' theorem generalizes to N-dimensional hypersphere packing
- The gasket is the limit set of a Kleinian group

**Core operation**:
```glsl
// Sphere inversion (conformal in any dimension)
void sphereInvert(inout float z[11], float center[11], float radius2, int D) {
    float d2 = 0.0;
    for (int i = 0; i < D; i++) {
        float diff = z[i] - center[i];
        d2 += diff * diff;
    }
    float scale = radius2 / d2;
    for (int i = 0; i < D; i++) {
        z[i] = center[i] + (z[i] - center[i]) * scale;
    }
    dr *= scale;  // Running derivative
}
```

**SDF approach**:
- Build distance field from packed hyperspheres
- Use recursive inversion to generate packing
- DE: `return r / abs(dr)` (same as Mandelbox)

**Animation potential**: ⭐⭐⭐⭐
- Inversion center positions can be animated
- Inversion radii create "breathing" effects
- Rotating the entire configuration through N-D

**Complexity**: Medium-High
**Visual character**: Bubbly, organic, intricate filigree

---

### 3. Hybrid Fractals (Operation Mixing)

**What it is**: Combining operations from different fractals in sequence, potentially alternating between them.

**Why it works in N-D**:
- All constituent operations are dimension-agnostic
- Conformal operations compose conformally
- DE tracking remains scalar

**Example combinations**:
```glsl
for (int i = 0; i < maxIter; i++) {
    if (i % 2 == 0) {
        // Even iterations: Mandelbox-style
        boxFold(z, D);
        sphereFold(z, dr, D);
        z = scale1 * z + c;
    } else {
        // Odd iterations: KIFS-style
        for (int f = 0; f < numFolds; f++) {
            hyperplaneFold(z, foldNormal[f], D);
        }
        z = scale2 * z - offset;
    }
    dr = dr * max(abs(scale1), abs(scale2)) + 1.0;
}
```

**Hybrid ideas**:
| Name | Combination | Character |
|------|-------------|-----------|
| Menger-Mandelbox | Menger folds + sphere fold | Sponge with organic details |
| KIFS-Apollonian | Platonic folds + sphere inversions | Crystalline bubbles |
| Bulb-Box Hybrid | Hyperspherical power + box fold | Organic bulbs with sharp edges |

**Animation potential**: ⭐⭐⭐⭐⭐
- Morph between constituent fractals by blending parameters
- Animate operation mixing ratio
- Each component adds rotation planes

**Complexity**: High (many parameters to tune)
**Visual character**: Depends on mix — can be anything

---

### 5. N-Dimensional Sierpiński Pyramid (Simplex Fractal)

**What it is**: Generalization of the Sierpiński triangle/tetrahedron to N dimensions using the N-simplex.

**Why it works in N-D**:
- N-simplex has N+1 vertices in N-D
- Same subdivision rule: remove center, keep corner sub-simplices
- Fold operations use simplex face normals

**SDF using folds**:
```glsl
float sierpinskiND(float z[11], int D, int maxIter) {
    // Simplex vertices (N+1 vertices for N-D simplex)
    // Use regular simplex centered at origin

    float scale = 2.0;
    float s = 1.0;

    for (int i = 0; i < maxIter; i++) {
        // Fold into fundamental domain using simplex symmetry planes
        // For N-D simplex, there are N+1 face normals
        for (int f = 0; f < D + 1; f++) {
            hyperplaneFold(z, simplexNormal[f], D);
        }

        // Scale toward corner vertex
        s *= scale;
        for (int j = 0; j < D; j++) {
            z[j] = z[j] * scale - cornerVertex[j] * (scale - 1.0);
        }
    }

    return sdSimplexND(z, D) / s;
}
```

**Animation potential**: ⭐⭐⭐⭐
- Rotating through N-D reveals different symmetry views
- Simplex has beautiful high-dimensional symmetry
- Less parameter variety than escape-time fractals

**Complexity**: Medium
**Visual character**: Crystalline, self-similar, lattice-like

---

### 6. N-Dimensional Cantor Dust / Cross-Polytope Fractal

**What it is**: Generalization of Cantor set to N dimensions using cross-polytope (hyperoctahedron) symmetry.

**Why it works in N-D**:
- Cross-polytope has 2N vertices at ±eᵢ positions
- Coordinate reflections are trivial: `z[i] = abs(z[i])`
- Very simple operations, very fast

**SDF**:
```glsl
float crossPolytopeFractal(float z[11], int D, int maxIter) {
    float s = 1.0;

    for (int i = 0; i < maxIter; i++) {
        // Fold into positive orthant
        for (int j = 0; j < D; j++) {
            z[j] = abs(z[j]);
        }

        // Sort coordinates (creates cross-polytope symmetry)
        sortDescending(z, D);

        // Scale and translate
        s *= 3.0;
        for (int j = 0; j < D; j++) {
            z[j] = z[j] * 3.0 - 2.0;
        }

        // Conditional fold back
        for (int j = 1; j < D; j++) {
            z[j] = max(z[j], -1.0);
        }
    }

    return sdCrossPolytopeND(z, D) / s;
}
```

**Animation potential**: ⭐⭐⭐
- Clean symmetry but limited parameter space
- Good for showcasing pure N-D rotation effects
- Fast rendering allows more iterations

**Complexity**: Low
**Visual character**: Sparse, skeletal, dust-like

---

## Comparison Matrix

| Fractal | N-D Ready | Parameters | Animation Variety | Performance | Visual Richness |
|---------|-----------|------------|-------------------|-------------|-----------------|
| **Hyperbulb** | ✅ | Power, iterations | ⭐⭐⭐ | Medium | ⭐⭐⭐⭐ |
| **Mandelbox** | ✅ | Scale, radii, fold | ⭐⭐⭐⭐⭐ | Medium | ⭐⭐⭐⭐⭐ |
| **Menger Sponge** | ✅ | Iterations only | ⭐⭐ | Fast | ⭐⭐⭐ |
| **KIFS Platonic** | ✅ | Fold angles, rotation | ⭐⭐⭐⭐⭐ | Fast | ⭐⭐⭐⭐⭐ |
| **Apollonian** | ✅ | Inversion centers/radii | ⭐⭐⭐⭐ | Medium | ⭐⭐⭐⭐ |
| **Hybrids** | ✅ | Mix ratios + all above | ⭐⭐⭐⭐⭐ | Slow | ⭐⭐⭐⭐⭐ |
| **Sierpiński N-D** | ✅ | Iterations only | ⭐⭐⭐ | Fast | ⭐⭐⭐ |

---

## Recommended Priority

### Tier 1: High Impact, Proven Feasibility
1. **KIFS Platonic** — Rich variety, fast, well-documented
2. **Apollonian Gasket** — Distinctive bubble aesthetics

### Tier 2: Unique Visual Character
3. **Hybrids** — Infinite combination possibilities
4. **Sierpiński N-D** — Classic fractal, educational value

### Tier 3: Completeness
5. **Cross-Polytope Fractal** — Fast, good for high iterations

---

## Key Mathematical Insight

All recommended fractals share one critical property:

> **Conformal transformations have Jacobians of the form `scalar × orthogonal matrix`**

This means:
1. The full Jacobian can be tracked as a single scalar `dr`
2. Distance estimate = `r / abs(dr)` works in ANY dimension
3. No coordinate system changes needed between dimensions

The conformal transformations available in N-D are:
- **Reflections**: `z -= 2 * dot(z, n) * n` (hyperplane folds)
- **Rotations**: Orthogonal matrices
- **Uniform scaling**: `z *= s`
- **Sphere inversions**: `z' = z / |z|²`
- **Translations**: `z += offset`

Any fractal built from these operations will generalize perfectly to N dimensions.

---

## Implementation Note

All new fractals would use the **same infrastructure** as Hyperbulb:
- Same rotation store and animation system
- Same basis vector transformation: `c = origin + x·basisX + y·basisY + z·basisZ`
- Same shader uniform structure
- Same UI pattern for dimension/plane selection

The only new code is the SDF function itself.
