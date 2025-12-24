# Fractal GPU Performance Optimizations

Implementation plan for OPT-FR-1 and OPT-FR-6.

---

## OPT-FR-1: Reduce Normal Calculation SDF Calls

### Overview
Replace the 6-sample central differences normal calculation with a 4-sample tetrahedron method that provides equivalent quality. This reduces SDF evaluations by 33% for high-quality normal calculation.

### Current State
- `GetNormal`: 6 SDF evaluations (central differences) - highest quality
- `GetNormalFast`: 4 SDF evaluations (forward differences) - lower quality, artifacts at sharp edges

### The Tetrahedron Method
The tetrahedron method samples at 4 points arranged as tetrahedron vertices around the sample point. This provides:
- **4 SDF evaluations** (same as forward differences)
- **Quality comparable to central differences** (symmetric sampling)
- **Better stability** at sharp features than forward differences

Tetrahedron vertices (normalized to unit vectors):
```
k0 = ( 1, -1, -1)
k1 = (-1, -1,  1)
k2 = (-1,  1, -1)
k3 = ( 1,  1,  1)
```

Formula:
```glsl
normal = normalize(
    k0 * SDF(p + h * k0) +
    k1 * SDF(p + h * k1) +
    k2 * SDF(p + h * k2) +
    k3 * SDF(p + h * k3)
)
```

### Files to Modify

1. **[`src/rendering/shaders/shared/raymarch/normal.glsl.ts`](src/rendering/shaders/shared/raymarch/normal.glsl.ts)**
   - Add `GetNormalTetra` function using tetrahedron method
   - Keep existing `GetNormal` for cases where 6-sample is explicitly needed
   - Rename `GetNormalFast` to `GetNormalForward` for clarity

2. **[`src/rendering/shaders/shared/fractal/main.glsl.ts`](src/rendering/shaders/shared/fractal/main.glsl.ts)**
   - Update normal selection logic to use tetrahedron method as default
   - Use `GetNormalTetra` for both fast mode and normal mode
   - Reserve `GetNormal` (6-sample) for ultra-high quality mode only

### Implementation Details

**Step 1: Add tetrahedron normal function**

```glsl
// normal.glsl.ts - add new function

// Tetrahedron normal calculation (4 SDF evaluations)
// Quality comparable to central differences but 33% fewer samples
// Uses symmetric tetrahedron vertices for balanced gradient estimation
// Reference: Inigo Quilez - https://iquilezles.org/articles/normalsSDF/
vec3 GetNormalTetra(vec3 p) {
    // Tetrahedron vertices (pre-normalized)
    const vec3 k0 = vec3( 1.0, -1.0, -1.0);
    const vec3 k1 = vec3(-1.0, -1.0,  1.0);
    const vec3 k2 = vec3(-1.0,  1.0, -1.0);
    const vec3 k3 = vec3( 1.0,  1.0,  1.0);
    
    float h = 0.0005;
    
    vec3 n = k0 * GetDist(p + h * k0) +
             k1 * GetDist(p + h * k1) +
             k2 * GetDist(p + h * k2) +
             k3 * GetDist(p + h * k3);
    
    // Guard against zero-length normal
    float len = length(n);
    return len > 0.0001 ? n / len : vec3(0.0, 1.0, 0.0);
}
```

**Step 2: Update main.glsl.ts**

```glsl
// Change from:
vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);

// To:
vec3 n = GetNormalTetra(p);  // Tetrahedron method: 4 samples, high quality
```

### Estimated Impact
- **Performance:** 33% reduction in normal calculation cost (6 → 4 SDF evals)
- **Visual Quality:** Virtually identical to central differences
- **Memory:** No change

---

## OPT-FR-6: Quaternion Power Fast Paths

### Overview
Add algebraic fast paths for quaternion powers n=5, 6, 7, 8 to avoid expensive transcendental functions (acos, cos, sin, pow) used in the general hyperspherical method.

### Current State
- `quatPow` has fast paths for n=2, 3, 4
- General case for n>4 uses: `acos`, `cos`, `sin`, `pow` (~20+ ALU ops)

### Integer Power Decomposition
Integer powers can be computed using repeated squaring and multiplication:

| Power | Decomposition | Operations |
|-------|---------------|------------|
| n=2 | `quatSqr(q)` | 1 sqr |
| n=3 | `quatMul(quatSqr(q), q)` | 1 sqr, 1 mul |
| n=4 | `quatSqr(quatSqr(q))` | 2 sqr |
| n=5 | `quatMul(quatSqr(quatSqr(q)), q)` | 2 sqr, 1 mul |
| n=6 | `quatMul(quatSqr(quatSqr(q)), quatSqr(q))` | 3 sqr, 1 mul |
| n=7 | `quatMul(quatMul(quatSqr(quatSqr(q)), quatSqr(q)), q)` | 3 sqr, 2 mul |
| n=8 | `quatSqr(quatSqr(quatSqr(q)))` | 3 sqr |

Each `quatSqr` is ~12 ALU ops, each `quatMul` is ~28 ALU ops.
General case with transcendentals is ~50+ ALU ops.

**n=8 is especially important** as it's the classic Mandelbulb power.

### Files to Modify

1. **[`src/rendering/shaders/julia/quaternion.glsl.ts`](src/rendering/shaders/julia/quaternion.glsl.ts)**
   - Add fast paths for n=5, 6, 7, 8

### Implementation Details

**Update quatPow function:**

```glsl
vec4 quatPow(vec4 q, float n) {
    // Fast path for n=2 (most common Julia set)
    if (abs(n - 2.0) < 0.01) {
        return quatSqr(q);
    }

    // Fast path for n=3 (cubic Julia)
    if (abs(n - 3.0) < 0.01) {
        return quatMul(quatSqr(q), q);
    }

    // Fast path for n=4 (quartic Julia)
    if (abs(n - 4.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        return quatSqr(q2);
    }

    // PERF (OPT-FR-6): Fast path for n=5
    if (abs(n - 5.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        vec4 q4 = quatSqr(q2);
        return quatMul(q4, q);
    }

    // PERF (OPT-FR-6): Fast path for n=6
    if (abs(n - 6.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        vec4 q4 = quatSqr(q2);
        return quatMul(q4, q2);
    }

    // PERF (OPT-FR-6): Fast path for n=7
    if (abs(n - 7.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        vec4 q4 = quatSqr(q2);
        vec4 q6 = quatMul(q4, q2);
        return quatMul(q6, q);
    }

    // PERF (OPT-FR-6): Fast path for n=8 (classic Mandelbulb power)
    if (abs(n - 8.0) < 0.01) {
        vec4 q2 = quatSqr(q);
        vec4 q4 = quatSqr(q2);
        return quatSqr(q4);
    }

    // General case: hyperspherical coordinates (expensive)
    float r = length(q);
    if (r < EPS) return vec4(0.0);
    // ... rest of existing general case ...
}
```

### Estimated Impact
- **Performance:** ~20+ ALU ops saved per quatPow call for powers 5-8
- **Julia n=8:** Each iteration saves ~20 ops × ~20 iterations = ~400 ALU ops per pixel
- **Visual Quality:** Identical (mathematically equivalent)
- **Memory:** No change

---

## Implementation Order

| Order | Optimization | Effort | Impact |
|-------|-------------|--------|--------|
| 1 | OPT-FR-6 (Quaternion Fast Paths) | Low | Medium - Simple additions to existing function |
| 2 | OPT-FR-1 (Tetrahedron Normals) | Low | Medium - New function + update call site |

---

## Testing Strategy

1. **Visual Regression:** Capture screenshots of Mandelbulb and Julia at powers 2, 5, 8
2. **Performance Metrics:** Measure frame times with GPU profiler
3. **Unit Tests:** Verify normal calculation produces valid normalized vectors
4. **Playwright Tests:** Verify fractal objects render correctly at different power values

---

## TODOs

```
- [ ] fr-6-quatpow: Add fast paths for n=5,6,7,8 in quatPow function
- [ ] fr-1-tetra: Add GetNormalTetra function using tetrahedron method
- [ ] fr-1-main: Update fractal main.glsl.ts to use tetrahedron normals
- [ ] fr-tests: Add unit tests for normal calculation and quatPow
```

