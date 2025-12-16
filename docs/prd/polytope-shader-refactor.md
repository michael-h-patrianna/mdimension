# PRD: Polytope Shader Refactor to Use Shared Modules

## Problem Statement

The polytope shaders (`src/rendering/renderers/Polytope/*.glsl.ts`) contain ~210 lines of code duplicated from the shared shader modules:

| Duplicated Code | Lines | Location in Polytope |
|-----------------|-------|---------------------|
| Cosine palette functions | ~20 | `faceFragment.glsl.ts` |
| Oklab/LCH color space | ~25 | `faceFragment.glsl.ts` |
| HSL functions | ~30 | `faceFragment.glsl.ts` |
| `getColorByAlgorithm()` | ~40 | `faceFragment.glsl.ts` |
| Multi-light system | ~80 | `faceFragment.glsl.ts` |
| Fresnel calculation | ~15 | `faceFragment.glsl.ts` |

This duplication means:
- Bug fixes to color/lighting must be applied in two places
- Polytope misses improvements made to the shared modules
- Risk of drift between polytope and fractal shader behavior

## Goal

Refactor polytope shaders to import from `src/rendering/shaders/shared/` instead of duplicating code.

**Expected outcome**:
- ~210 lines removed from polytope shaders
- Single source of truth for color algorithms and lighting
- Polytope automatically benefits from shared module improvements

## Current Polytope Shader Structure

```
src/rendering/renderers/Polytope/
├── edgeVertex.glsl.ts      # 136 lines - N-D transform (no lighting)
├── edgeFragment.glsl.ts    #  31 lines - Simple color output
├── faceVertex.glsl.ts      # 158 lines - N-D transform + varyings
├── faceFragment.glsl.ts    # 390 lines - Lighting + colors (HAS DUPLICATION)
├── constants.ts            #   3 lines - MAX_EXTRA_DIMS
└── index.ts                #  exports
```

## Target Structure

```
src/rendering/shaders/polytope/
├── transform-nd.glsl.ts    # transformND() - extracted from vertex shaders
├── modulation.glsl.ts      # modulateVertex() - animation/breathing
├── compose.ts              # Assembles shaders from shared + polytope modules
└── index.ts                # exports

src/rendering/renderers/Polytope/
├── PolytopeScene.tsx       # unchanged
├── constants.ts            # unchanged
└── index.ts                # updated to import from shaders/polytope/
```

## Shared Modules to Import

From `src/rendering/shaders/shared/`:

| Module | Functions Used by Polytope |
|--------|---------------------------|
| `color/hsl.glsl.ts` | `rgb2hsl`, `hsl2rgb` |
| `color/cosine-palette.glsl.ts` | `cosinePalette`, `applyDistribution`, `getCosinePaletteColor` |
| `color/oklab.glsl.ts` | `oklabToLinearSrgb`, `lchColor` |
| `color/selector.glsl.ts` | `getColorByAlgorithm` |
| `lighting/fresnel.glsl.ts` | `fresnelSchlick` (if used) |
| `lighting/multi-light.glsl.ts` | `getLightDirection`, `getSpotAttenuation`, `getDistanceAttenuation`, `calculateMultiLighting` |
| `core/uniforms.glsl.ts` | Light uniforms, color uniforms |

## Polytope-Specific Code to Keep

These functions are unique to polytope and should remain in polytope modules:

| Function | Purpose | Keep In |
|----------|---------|---------|
| `transformND()` | N-dimensional vertex transformation | `transform-nd.glsl.ts` |
| `modulateVertex()` | Radial breathing animation | `modulation.glsl.ts` |
| Screen-space normal calculation | Uses `dFdx`/`dFdy` derivatives | `compose.ts` (inline in main) |

## Composition API

```typescript
// src/rendering/shaders/polytope/compose.ts

interface PolytopeShaderConfig {
  type: 'edge' | 'face';
  // No dimension variants needed - transformND handles all dimensions
  // No feature toggles needed - simpler than fractal shaders
}

export function composeEdgeVertexShader(): string;
export function composeEdgeFragmentShader(): string;
export function composeFaceVertexShader(): string;
export function composeFaceFragmentShader(): string;
```

## Migration Tasks

### Phase 1: Create Polytope Shader Module

1. Create `src/rendering/shaders/polytope/` directory
2. Extract `transformND()` into `transform-nd.glsl.ts`
3. Extract `modulateVertex()` into `modulation.glsl.ts`
4. Create `compose.ts` with four compose functions
5. **Do not modify existing Polytope renderer yet**

### Phase 2: Compose Face Fragment Shader

1. Import shared color modules:
   ```typescript
   import { hslFunctions } from '../shared/color/hsl.glsl'
   import { cosinePalette } from '../shared/color/cosine-palette.glsl'
   import { oklabFunctions } from '../shared/color/oklab.glsl'
   import { colorSelector } from '../shared/color/selector.glsl'
   ```
2. Import shared lighting modules:
   ```typescript
   import { multiLightSystem } from '../shared/lighting/multi-light.glsl'
   import { fresnelFunction } from '../shared/lighting/fresnel.glsl'
   ```
3. Compose face fragment shader from imports + polytope-specific main()
4. **Verify**: Output identical to current `faceFragment.glsl.ts`

### Phase 3: Compose Vertex Shaders

1. Create `composeEdgeVertexShader()` using:
   - Shared uniforms (if any)
   - `transform-nd.glsl.ts`
   - `modulation.glsl.ts`
2. Create `composeFaceVertexShader()` similarly
3. **Verify**: Output identical to current vertex shaders

### Phase 4: Update Polytope Renderer

1. Update `src/rendering/renderers/Polytope/index.ts` to import from `shaders/polytope/compose.ts`
2. Remove old `*.glsl.ts` files from Polytope directory (except constants.ts)
3. Update any other imports
4. **Verify**: All polytope rendering works identically

### Phase 5: Delete Duplicated Code

1. Remove the old shader files:
   - `edgeVertex.glsl.ts`
   - `edgeFragment.glsl.ts`
   - `faceVertex.glsl.ts`
   - `faceFragment.glsl.ts`
2. Final verification

## Edge Cases & Pitfalls

### 1. Uniform Declaration Order

**Problem**: GLSL requires uniforms to be declared before use. Shared modules may assume certain uniform order.

**Solution**: Compose function must include uniforms in correct order:
1. Precision declarations
2. MRT outputs
3. Shared uniforms (lights, colors)
4. Polytope-specific uniforms (N-D transform, modulation)

### 2. Polytope Uses `vFaceDepth` for Color Algorithm

**Problem**: Polytope's `getColorByAlgorithm()` uses `vFaceDepth` varying, which is polytope-specific.

**Solution**:
- Shared `getColorByAlgorithm()` takes `t` as parameter
- Polytope calls it with `vFaceDepth` as the `t` value
- No change needed to shared module

### 3. Screen-Space Normal vs SDF Normal

**Problem**: Polytope computes normals from screen-space derivatives (`dFdx`/`dFdy`), fractals compute from SDF gradient.

**Solution**: Normal calculation stays in polytope-specific main() function, not shared. Shared lighting functions accept normal as parameter.

### 4. Legacy Single-Light Fallback

**Problem**: Polytope has fallback code for when `uNumLights == 0` but `uLightEnabled` is true.

**Solution**: Check if shared lighting module handles this case. If not, keep fallback in polytope main() or add to shared module.

### 5. MRT Output Compatibility

**Problem**: Polytope outputs to `gColor` and `gNormal` (MRT). Must match shared pattern.

**Solution**: Verify shared modules use same MRT output names. Polytope main() handles final output.

## Success Criteria

1. **Code reduction**: ~210 lines removed from polytope shaders
2. **No visual regression**: Polytope rendering identical before/after
3. **Shared module compatibility**: Polytope uses exact same color/lighting as fractals
4. **Clean separation**: Polytope-specific code clearly isolated in `shaders/polytope/`

## Non-Goals

- Variant compilation for polytope (not needed—single shader handles all dimensions)
- Shader caching for polytope (not needed—no dynamic variants)
- Performance optimization (polytope shaders are already lightweight)

## Testing

1. Visual comparison: Screenshot polytope before/after refactor
2. All existing polytope tests pass
3. Verify all 7 color algorithms work correctly
4. Verify multi-light system works with point, directional, spot lights
5. Verify Fresnel rim lighting works

## References

- Shared shader modules: `src/rendering/shaders/shared/`
- Current polytope shaders: `src/rendering/renderers/Polytope/*.glsl.ts`
- Polytope scene component: `src/rendering/renderers/Polytope/PolytopeScene.tsx`
- Fractal shader modularization PRD: `docs/prd/shader-split.md`
