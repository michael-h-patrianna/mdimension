# PRD: Fractal Shader Modularization & Variant Compilation

## Problem Statement

The raymarched fractal shaders are large monolithic "uber-shaders" with significant code duplication:

| Shader | Location | Lines | Description |
|--------|----------|-------|-------------|
| Mandelbulb | `src/rendering/renderers/Mandelbulb/mandelbulb.frag` | 1746 | 3D-11D Mandelbulb/Hyperbulb |
| Quaternion Julia | `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag` | 914 | 3D-11D Julia sets |
| Schroedinger | `src/rendering/renderers/Schroedinger/schroedinger.frag` | ~1700 | Quantum wavefunction visualization |

These shaders share **~60% identical code**:
- Color utilities (HSL, Oklab/LCH, cosine palettes): ~110 lines duplicated
- Multi-light system: ~55 lines duplicated
- Shadow calculation: ~40 lines duplicated
- Ambient occlusion: ~20 lines duplicated
- Temporal reprojection: ~75 lines duplicated
- Raymarching core structure: ~70 lines duplicated
- Opacity mode handling: ~50 lines duplicated

**Total duplication: ~420 lines × 3 shaders = ~840 lines of redundant code**

Additional problems:

1. **Performance overhead**: Dead code paths (unused dimensions, disabled features) still consume registers and cause branch divergence
2. **Maintainability nightmare**: Bug fixes must be applied to 3 files; they frequently drift out of sync
3. **Mandelbulb-specific**: Contains all 9 dimension SDF implementations with runtime branching

## Goal

Split all fractal shaders into composable modules with a **shared library** for common functionality, and generate **specialized shader variants** at runtime based on user configuration. Each compiled shader contains only the code needed for the current fractal type, dimension, and enabled features.

**Expected outcomes**:
- 5-15% per-frame performance improvement for heavy raymarching workloads
- Single source of truth for shared code (color, lighting, shadows, etc.)
- Significantly improved code maintainability
- Easier to add new fractal types in the future

## Architecture Overview

### Current Flow

```
mandelbulb.frag (1746 lines)     quaternion-julia.frag (914 lines)     schroedinger.frag (~1700 lines)
         ↓                                  ↓                                    ↓
    GPU compile                        GPU compile                          GPU compile
         ↓                                  ↓                                    ↓
    Runtime branching              Runtime branching                    Runtime branching
```

### Target Flow

```
src/rendering/shaders/
├── shared/           ←── Common modules (color, lighting, raymarch, etc.)
├── mandelbulb/       ←── Mandelbulb-specific (SDF functions, compose)
├── julia/            ←── Julia-specific (quaternion ops, SDF, compose)
└── schroedinger/     ←── Schroedinger-specific (wavefunction, compose)

        ↓
compose(fractalType, config) → generates minimal shader string (~300-600 lines)
        ↓
    GPU compile (smaller shader, no dead code)
        ↓
    No runtime branching for dimension/features
```

## Module Structure

```
src/rendering/shaders/
├── shared/                        # SHARED ACROSS ALL FRACTAL SHADERS
│   ├── core/
│   │   ├── uniforms.glsl.ts       # Common uniform declarations
│   │   ├── constants.glsl.ts      # #defines, EPS, BOUND_R, MAX_ITER, etc.
│   │   └── precision.glsl.ts      # precision declarations, MRT outputs
│   ├── color/
│   │   ├── hsl.glsl.ts            # rgb2hsl, hsl2rgb, hue2rgb
│   │   ├── cosine-palette.glsl.ts # cosinePalette, applyDistribution
│   │   ├── oklab.glsl.ts          # oklabToLinearSrgb, lchColor
│   │   └── selector.glsl.ts       # getColorByAlgorithm (8 algorithms)
│   ├── lighting/
│   │   ├── fresnel.glsl.ts        # fresnelSchlick
│   │   ├── multi-light.glsl.ts    # Multi-light system helpers
│   │   └── ao.glsl.ts             # calcAO (ambient occlusion)
│   ├── features/
│   │   ├── shadows.glsl.ts        # calcSoftShadow
│   │   ├── temporal.glsl.ts       # getTemporalDepth, reprojection
│   │   └── opacity.glsl.ts        # Solid vs volumetric modes
│   └── raymarch/
│       ├── normal.glsl.ts         # GetNormal, GetNormalFast
│       ├── sphere-intersect.glsl.ts # sphereIntersect bounding
│       └── core.glsl.ts           # raymarch loop structure (template)
│
├── mandelbulb/                    # MANDELBULB-SPECIFIC
│   ├── uniforms.glsl.ts           # Mandelbulb-specific uniforms (uBasisX/Y/Z, etc.)
│   ├── power.glsl.ts              # getEffectivePower, fastPow8, optimizedPow
│   ├── sdf/
│   │   ├── sdf3d.glsl.ts          # sdf3D, sdf3D_simple (existing)
│   │   ├── sdf4d.glsl.ts          # sdf4D, sdf4D_simple (existing)
│   │   ├── sdf5d.glsl.ts          # sdf5D, sdf5D_simple (existing)
│   │   ├── sdf6d.glsl.ts          # sdf6D, sdf6D_simple (existing)
│   │   ├── sdf7d.glsl.ts          # sdf7D, sdf7D_simple (existing)
│   │   ├── sdf8d.glsl.ts          # sdf8D, sdf8D_simple (existing)
│   │   ├── sdf9d.glsl.ts          # sdf9D, sdf9D_simple (NEW: unroll from sdfHighD)
│   │   ├── sdf10d.glsl.ts         # sdf10D, sdf10D_simple (NEW: unroll from sdfHighD)
│   │   └── sdf11d.glsl.ts         # sdf11D, sdf11D_simple (NEW: unroll from sdfHighD)
│   ├── main.glsl.ts               # main() with Mandelbulb-specific coloring
│   └── compose.ts                 # Assembles Mandelbulb shader from config
│
├── julia/                         # QUATERNION JULIA-SPECIFIC
│   ├── uniforms.glsl.ts           # Julia-specific uniforms (uJuliaConstant, etc.)
│   ├── power.glsl.ts              # getEffectivePower (Julia version)
│   ├── quaternion.glsl.ts         # quatMul, quatSqr, quatPow (quaternion math)
│   ├── sdf/
│   │   ├── sdf3d.glsl.ts          # sdfJulia3D, sdfJulia3D_simple
│   │   ├── sdf4d.glsl.ts          # (if Julia supports 4D+)
│   │   └── ...
│   ├── main.glsl.ts               # main() with Julia-specific coloring
│   └── compose.ts                 # Assembles Julia shader from config
│
├── schroedinger/                  # SCHROEDINGER-SPECIFIC
│   ├── uniforms.glsl.ts           # Schroedinger-specific uniforms
│   ├── wavefunction.glsl.ts       # Quantum wavefunction evaluation
│   ├── sdf/
│   │   └── ...
│   ├── main.glsl.ts
│   └── compose.ts
│
└── cache.ts                       # Unified shader program cache for all fractals
```

### Shared Code Breakdown

| Module | Lines | Used By |
|--------|-------|---------|
| `shared/color/*` | ~110 | Mandelbulb, Julia, Schroedinger |
| `shared/lighting/*` | ~75 | Mandelbulb, Julia, Schroedinger |
| `shared/features/shadows.glsl.ts` | ~40 | Mandelbulb, Julia, Schroedinger |
| `shared/features/temporal.glsl.ts` | ~75 | Mandelbulb, Julia, Schroedinger |
| `shared/features/opacity.glsl.ts` | ~50 | Mandelbulb, Julia, Schroedinger |
| `shared/raymarch/*` | ~70 | Mandelbulb, Julia, Schroedinger |
| **Total shared** | **~420** | All 3 shaders |

## SDF Unrolling for 9D-11D

### Current State

The Mandelbulb shader currently has:
- **3D-8D**: Fully unrolled, dimension-specific SDF functions using named scalar variables
- **9D-11D**: Generic `sdfHighD()` using arrays and loops

```glsl
// Current: 9D-11D use array-based approach
float sdfHighD(vec3 pos, int D, float pwr, float bail, int maxIt, out float trap) {
    float c[11], z[11];  // Arrays instead of scalars
    for(int j=0; j<11; j++) { ... }  // Loop-based initialization
    for(int i=0; i<MAX_ITER_HQ; i++) {
        // Loop-based angle computation
        for(int k=0; k<D-2; k++) { ... }
    }
}
```

### Performance Impact of Arrays vs Scalars

| Approach | Register Usage | Loop Overhead | Branch Divergence |
|----------|---------------|---------------|-------------------|
| **Unrolled scalars** | Compiler optimizes | None | None |
| **Array + loops** | Array indexing penalty | ~10 cycles/iteration | Dynamic bounds |

**Estimated improvement from unrolling 9D-11D: 10-15% per SDF evaluation**

Since 11D is heavily used, this optimization is worth the additional ~360 lines of code (6 new functions: `sdf9D`, `sdf9D_simple`, `sdf10D`, `sdf10D_simple`, `sdf11D`, `sdf11D_simple`).

### Unrolling Pattern

Each unrolled SDF follows the same pattern as existing 3D-8D. For example, 9D:

```glsl
// Target: sdf9D with 9 named scalars, 8 named angles
float sdf9D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // 9 scalar coordinates (no arrays)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];
    float c7 = uOrigin[7] + pos.x*uBasisX[7] + pos.y*uBasisY[7] + pos.z*uBasisZ[7];
    float c8 = uOrigin[8] + pos.x*uBasisX[8] + pos.y*uBasisY[8] + pos.z*uBasisZ[8];
    float zx=cx, zy=cy, zz=cz, z3=c3, z4=c4, z5=c5, z6=c6, z7=c7, z8=c8;

    // 8 named angles (D-1 angles for D dimensions)
    float t0, t1, t2, t3, t4, t5, t6, t7;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Unrolled magnitude calculation
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6 + z7*z7 + z8*z8);
        if (r > bail) { escIt = i; break; }

        // Unrolled angle calculations (no loops)
        t0 = acos(clamp(zx / max(r, EPS), -1.0, 1.0));
        float r1 = sqrt(zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6 + z7*z7 + z8*z8);
        t1 = r1 > EPS ? acos(clamp(zy / max(r1, EPS), -1.0, 1.0)) : 0.0;
        // ... continue for t2-t6
        t7 = atan(z8, z7);

        // Unrolled reconstruction
        float rp = pow(r, pwr);
        // ... (power mapping and reconstruction)
    }
}
```

### Unrolling Checklist

For each dimension (9D, 10D, 11D), create both `sdfXD()` and `sdfXD_simple()`:

| Dimension | Coordinates | Angles | Lines (est.) |
|-----------|-------------|--------|--------------|
| 9D | 9 scalars (zx, zy, zz, z3-z8) | 8 (t0-t7) | ~60 |
| 10D | 10 scalars (zx, zy, zz, z3-z9) | 9 (t0-t8) | ~65 |
| 11D | 11 scalars (zx, zy, zz, z3-z10) | 10 (t0-t9) | ~70 |

**Total new code: ~390 lines** (6 functions × ~65 lines average)

### Verification

After unrolling, verify:
1. Visual output matches `sdfHighD()` for same parameters
2. Performance improvement measurable (profile 11D specifically)
3. Orbit trap values (`trap` output) are identical

## Composition API

### ShaderConfig Interface

```typescript
type FractalType = 'mandelbulb' | 'julia' | 'schroedinger';

interface FractalShaderConfig {
  fractalType: FractalType;
  dimension: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  shadows: boolean;
  temporal: boolean;
  ambientOcclusion: boolean;
  opacityMode: 'solid' | 'volumetric';
}

// Fractal-specific configs extend the base
interface MandelbulbShaderConfig extends FractalShaderConfig {
  fractalType: 'mandelbulb';
}

interface JuliaShaderConfig extends FractalShaderConfig {
  fractalType: 'julia';
  // Julia currently only supports 3D (w=0 slice of 4D quaternion space)
  // Future: could extend to higher dimensions
}
```

### Compose Function

Each fractal type has its own `compose()` function that:

1. Imports shared modules from `shared/`
2. Imports fractal-specific modules (uniforms, SDF, quaternion ops, etc.)
3. Returns a complete GLSL shader string containing only required code

```typescript
// mandelbulb/compose.ts
export function composeMandelbulbShader(config: MandelbulbShaderConfig): string;

// julia/compose.ts
export function composeJuliaShader(config: JuliaShaderConfig): string;

// schroedinger/compose.ts
export function composeSchroedingerShader(config: SchroedingerShaderConfig): string;
```

The compose function must:

1. Include shared core (precision, constants) - always
2. Include shared + fractal-specific uniforms
3. Include shared color utilities - always
4. Include only the SDF function for the specified dimension
5. Generate a non-branching `GetDist()` / `sdf()` that directly calls the single SDF
6. Include feature modules (shadows, temporal, AO) only if enabled
7. Include shared lighting system
8. Include fractal-specific `main()` function

### Cache Key Generation

Cache key = deterministic hash of full config:

```typescript
// Examples:
"mandelbulb-dim4-shadow1-temporal0-ao1-solid"
"julia-dim3-shadow0-temporal1-ao0-solid"
"schroedinger-dim5-shadow1-temporal1-ao1-volumetric"
```

## Shader Cache Management

### Requirements

1. **In-memory cache** of compiled WebGL programs keyed by config hash
2. **Eager pre-compilation** of common variants (3D, 4D, 5D with default features) on app load
3. **Lazy compilation** of rare variants (9D-11D, exotic feature combos) on first use
4. **Cache invalidation** only on app version change (shader source change)

### Pre-warm Strategy

On application startup, before any fractal is rendered:

1. Compile most common variants for each fractal type:
   - Mandelbulb: 3D, 4D, 5D, 11D with default features
   - Julia: 3D with default features
   - Schroedinger: 3D, 4D, 5D with default features
2. Use `requestIdleCallback` or frame gaps to avoid blocking
3. Show loading indicator only if user requests uncached variant

## Migration Tasks

### Phase 1: Extract Shared Modules

1. Create `src/rendering/shaders/shared/` directory structure
2. Extract identical code from all 3 shaders into shared modules:
   - Color utilities (HSL, Oklab, cosine palette, selector)
   - Lighting (Fresnel, multi-light, AO)
   - Features (shadows, temporal, opacity)
   - Raymarch helpers (normal calculation, sphere intersection)
3. Create placeholder `index.ts` that re-exports all shared modules
4. **Do not modify existing `.frag` files yet**
5. **Verify**: Shared modules compile independently (unit tests)

### Phase 2: Extract Mandelbulb Modules (No Behavioral Change)

1. Create `src/rendering/shaders/mandelbulb/` directory structure
2. Extract Mandelbulb-specific code:
   - Uniforms (uBasisX/Y/Z, uOrigin, phase uniforms)
   - Power functions (getEffectivePower, fastPow8, optimizedPow)
   - Existing SDF functions (sdf3D through sdf8D)
   - Keep sdfHighD temporarily for 9D-11D
3. Create `compose.ts` that concatenates shared + mandelbulb modules
4. Update `MandelbulbMesh.tsx` to import from `compose.ts`
5. **Verify**: Shader behavior is identical, all Mandelbulb tests pass

### Phase 3: Unroll 9D-11D SDF Functions

1. Create `sdf9d.glsl.ts` with fully unrolled `sdf9D()` and `sdf9D_simple()`:
   - 9 scalar coordinates (zx, zy, zz, z3-z8)
   - 8 scalar angles (t0-t7)
   - No arrays, no loops in inner iteration
   - Follow exact pattern of sdf8D
2. Create `sdf10d.glsl.ts` with `sdf10D()` and `sdf10D_simple()`:
   - 10 scalar coordinates
   - 9 scalar angles
3. Create `sdf11d.glsl.ts` with `sdf11D()` and `sdf11D_simple()`:
   - 11 scalar coordinates
   - 10 scalar angles
4. Update dispatch to use unrolled versions instead of sdfHighD
5. Remove sdfHighD (no longer needed)
6. **Verify**:
   - Visual output identical to sdfHighD for all test cases
   - Performance improvement measurable (benchmark 9D, 10D, 11D)
   - Orbit trap values match exactly

### Phase 4: Extract Julia Modules

1. Create `src/rendering/shaders/julia/` directory structure
2. Extract Julia-specific code:
   - Uniforms (uJuliaConstant)
   - Quaternion operations (quatMul, quatSqr, quatPow)
   - Julia SDF functions
3. Create `compose.ts` for Julia
4. Update `QuaternionJuliaMesh.tsx` to import from `compose.ts`
5. **Verify**: Shader behavior is identical, all Julia tests pass

### Phase 5: Extract Schroedinger Modules

1. Create `src/rendering/shaders/schroedinger/` directory structure
2. Extract Schroedinger-specific code
3. Create `compose.ts` for Schroedinger
4. Update mesh component to import from `compose.ts`
5. **Verify**: Shader behavior is identical

### Phase 6: Implement Variant Composition

1. Modify each `compose()` to accept config parameter
2. Generate dimension-specific `GetDist()` / `sdf()` (no if-chain)
3. Conditionally include feature modules based on config
4. Add unified `cache.ts` for all fractal shaders
5. **Verify**: Can compile and switch between variants for all fractals

### Phase 7: Integrate with React/Three.js

1. Hook into geometry store for fractal type and dimension changes
2. Hook into feature toggles (shadows, temporal, etc.)
3. On config change: lookup or compile shader, swap material program
4. Add loading state for uncached variants
5. **Verify**: Smooth transitions, no visual glitches across all fractals

### Phase 8: Pre-compilation & Warmup

1. Implement pre-warm on app load for common variants (all 3 fractals)
2. Measure and log compile times per variant
3. Pre-warm 11D specifically (heavily used)
4. **Verify**: No perceptible delay on dimension switch for pre-warmed variants

### Phase 9: Delete Original .frag Files

1. Remove `mandelbulb.frag`, `quaternion-julia.frag`, `schroedinger.frag`
2. Update any remaining imports
3. Final verification of all features

## Edge Cases & Pitfalls

### 1. Uniform Consistency

**Problem**: Different variants may have different uniforms, but Three.js material expects consistent uniform set.

**Solution**: Always declare all uniforms in `uniforms.glsl.ts`, even if unused in some variants. GPU compiler eliminates dead uniforms.

### 2. Shader Compilation Failure

**Problem**: Generated shader may have GLSL syntax errors from bad concatenation.

**Solution**:
- Each module must be self-contained (no dangling braces)
- Add integration tests that compile every dimension variant
- Log full shader source on compile error for debugging

### 3. Hot Module Replacement (HMR)

**Problem**: During development, changing a module should trigger recompile.

**Solution**: Include module content hashes in cache key during dev mode, or clear cache on HMR.

### 4. WebGL Context Loss

**Problem**: On context loss, all compiled programs are destroyed.

**Solution**: Cache stores source strings, not just programs. Recompile from cache on context restore.

### 5. Animation Transitions Between Dimensions

**Problem**: Current system may morph between dimensions. With separate shaders, you can't interpolate.

**Solution**:
- Check if dimension morphing exists in current implementation
- If yes: either keep uber-shader for transition frames, or implement dual-shader blending
- If no: not a concern

### 6. Race Conditions on Rapid Config Changes

**Problem**: User rapidly clicks through dimensions; multiple compiles queued.

**Solution**: Debounce config changes, or cancel pending compile if config changes again before completion.

### 7. Mobile GPU Compile Times

**Problem**: Mobile GPUs (Adreno, Mali) may take 500ms+ to compile even small shaders.

**Solution**:
- Always show loading indicator if compile takes >100ms
- Consider reducing variant count on mobile (detect via `navigator.userAgent` or `gl.getParameter`)

### 8. Shader Source in Bundle Size

**Problem**: Many modules across 3 fractals adds to JS bundle.

**Solution**:
- Template strings compress well with gzip
- Shared modules are only included once in bundle
- Consider code generation for repetitive SDF patterns
- Measure actual impact; shared code actually *reduces* total bundle size vs duplication

### 9. Keeping Shared Modules in Sync

**Problem**: A change to shared module must work for all 3 fractal types.

**Solution**:
- Integration tests compile all fractal types with all shared module combinations
- Type signatures enforce compatible interfaces
- CI gate prevents merging if any fractal fails to compile

### 10. Julia's Limited Dimension Support

**Problem**: Julia currently only implements 3D (w=0 slice of 4D quaternion space). Higher dimensions would require different math.

**Solution**:
- Julia config interface constrains dimension to 3 for now
- Document that Julia dimension extension is a separate feature request
- Shared modules don't assume dimension, so Julia can use them unchanged

## Success Criteria

1. **Performance**: Measurable FPS improvement (target 5%+) on 11D Mandelbulb at default settings
2. **Code reduction**: ~840 lines of duplicated code eliminated via shared modules
3. **Compile time**: <500ms for any single variant on desktop, <1000ms on mobile
4. **No regressions**: All existing visual features work identically for all 3 fractal types
5. **Maintainability**: Each module file <200 lines; shared code has single source of truth
6. **Test coverage**: Integration tests compile all dimension variants for all fractal types

## Non-Goals

- WebGPU migration (future project)
- Shader binary caching via `OES_get_program_binary` (browser support inconsistent)
- Dynamic shader generation UI (developers use config, not end users)

## References

- Current shaders:
  - `src/rendering/renderers/Mandelbulb/mandelbulb.frag` (1746 lines)
  - `src/rendering/renderers/QuaternionJulia/quaternion-julia.frag` (914 lines)
  - `src/rendering/renderers/Schroedinger/schroedinger.frag` (~1700 lines)
- Similar pattern in codebase: `src/rendering/renderers/Polytope/edgeVertex.glsl.ts`
- Three.js shader composition: `THREE.ShaderMaterial` onBeforeCompile hook
- Mesh components to update:
  - `src/rendering/renderers/Mandelbulb/MandelbulbMesh.tsx`
  - `src/rendering/renderers/QuaternionJulia/QuaternionJuliaMesh.tsx`
