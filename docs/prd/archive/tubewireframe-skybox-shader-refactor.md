# PRD: TubeWireframe & Skybox Shader Modularization

## Problem Statement

### TubeWireframe Shader (388 lines)

The TubeWireframe shader (`src/rendering/renderers/TubeWireframe/`) contains ~50 lines of multi-light helper code duplicated from the shared modules:

| Duplicated Code | Lines | Location |
|-----------------|-------|----------|
| `getLightDirection()` | ~15 | `tubeWireframe.frag` |
| `getSpotAttenuation()` | ~5 | `tubeWireframe.frag` |
| `getDistanceAttenuation()` | ~15 | `tubeWireframe.frag` |
| Light uniform declarations | ~15 | `tubeWireframe.frag` |

### Skybox Shader (1209 lines)

The Skybox shader (`src/rendering/materials/skybox/skybox.frag`) is a monolithic uber-shader containing 9 procedural modes, all compiled regardless of which mode is active:

| Mode | Function | Lines | When Used |
|------|----------|-------|-----------|
| Classic | Texture sampling + parallax | ~110 | Mode 0 |
| Aurora | `getAurora()` | ~95 | Mode 1 |
| Nebula | `getNebula()` | ~74 | Mode 2 |
| Void | `getVoid()` | ~87 | Mode 3 |
| Crystalline | `getCrystalline()` | ~45 | Mode 4 |
| Horizon | `getHorizonGradient()` | ~93 | Mode 5 |
| Ocean | `getDeepOcean()` | ~164 | Mode 6 |
| Twilight | `getTwilight()` | ~66 | Mode 7 |
| Starfield | `getStarfield()` | ~139 | Mode 8 |

**When user selects one mode, ~700+ lines of other modes are dead code.**

Additionally, post-processing effects (atmosphere, sun, vignette, grain, aberration) are always compiled even when disabled.

## Goals

### TubeWireframe
- Import multi-light helpers from `src/rendering/shaders/shared/`
- Eliminate ~50 lines of duplicated code
- Single source of truth for light calculations

### Skybox
- Split into composable modules per procedural mode
- Generate specialized shader variants containing only the active mode
- Conditionally include post-effects based on configuration
- **Expected reduction: 70-77% smaller compiled shaders per mode**

## Architecture Overview

### Current Flow

```
tubeWireframe.frag (388 lines, duplicated light code)
skybox.frag (1209 lines, all 9 modes compiled)
       ↓
   GPU compile (large shaders with dead code)
```

### Target Flow

```
src/rendering/shaders/
├── shared/                    # Light helpers, noise, color
├── tubewireframe/             # PBR-specific code only
└── skybox/                    # Mode modules + compose

compose(config) → generates minimal shader
       ↓
GPU compile (small shader, no dead code)
```

## Module Structure

### TubeWireframe

```
src/rendering/shaders/tubewireframe/
├── uniforms.glsl.ts           # TubeWireframe-specific uniforms (roughness, etc.)
├── pbr.glsl.ts                # GGX, geometry Smith, Fresnel-Schlick (PBR-specific)
├── main.glsl.ts               # main() function
└── compose.ts                 # Assembles shader from shared + tubewireframe modules
```

**Imports from shared:**
- `shared/lighting/multi-light.glsl.ts` - getLightDirection, getSpotAttenuation, getDistanceAttenuation
- `shared/core/uniforms.glsl.ts` - Light uniform declarations

**Keeps locally (PBR-specific, not shared with other shaders):**
- `distributionGGX()` - Normal distribution function
- `geometrySchlickGGX()` - Geometry function
- `geometrySmith()` - Smith's method
- `fresnelSchlick()` - PBR version (vec3 F0, different from shared float version)

### Skybox

```
src/rendering/shaders/skybox/
├── core/
│   ├── uniforms.glsl.ts       # All uniform declarations (~65 lines)
│   ├── varyings.glsl.ts       # vWorldDirection, vScreenUV, vWorldPosition
│   └── constants.glsl.ts      # PI, TAU, MODE_* constants
├── utils/
│   ├── noise.glsl.ts          # hash(), noise(), fbm() (~40 lines)
│   ├── color.glsl.ts          # rgb2hsv(), hsv2rgb(), cosinePalette() (~25 lines)
│   └── rotation.glsl.ts       # rotateY() matrix (~10 lines)
├── modes/
│   ├── classic.glsl.ts        # Texture sampling, parallax, aberration (~110 lines)
│   ├── aurora.glsl.ts         # getAurora() (~95 lines)
│   ├── nebula.glsl.ts         # getNebula() (~74 lines)
│   ├── void.glsl.ts           # getVoid() (~87 lines)
│   ├── crystalline.glsl.ts    # getCrystalline() (~45 lines)
│   ├── horizon.glsl.ts        # getHorizonGradient() (~93 lines)
│   ├── ocean.glsl.ts          # getDeepOcean() (~164 lines)
│   ├── twilight.glsl.ts       # getTwilight() (~66 lines)
│   └── starfield.glsl.ts      # getStarfield() (~139 lines)
├── effects/
│   ├── atmosphere.glsl.ts     # applyHorizon() (~15 lines)
│   ├── sun.glsl.ts            # Sun glow calculation (~10 lines)
│   ├── vignette.glsl.ts       # Vignette effect (~8 lines)
│   ├── grain.glsl.ts          # Film grain (~6 lines)
│   └── aberration.glsl.ts     # Chromatic aberration (~12 lines)
├── compose.ts                 # Builds shader from mode + effects config
├── cache.ts                   # Shader variant cache
└── index.ts                   # Exports
```

## Composition API

### TubeWireframe

```typescript
// Simple - no variants needed, just imports shared modules
export function composeTubeWireframeVertexShader(): string;
export function composeTubeWireframeFragmentShader(): string;
```

### Skybox

```typescript
type SkyboxMode =
  | 'classic'
  | 'aurora'
  | 'nebula'
  | 'void'
  | 'crystalline'
  | 'horizon'
  | 'ocean'
  | 'twilight'
  | 'starfield';

interface SkyboxShaderConfig {
  mode: SkyboxMode;
  effects: {
    atmosphere: boolean;  // Horizon glow
    sun: boolean;         // Directional sun glow
    vignette: boolean;    // Screen edge darkening
    grain: boolean;       // Film grain
    aberration: boolean;  // Chromatic aberration
  };
  // Classic mode only
  parallax?: boolean;
}

export function composeSkyboxFragmentShader(config: SkyboxShaderConfig): string;
export function composeSkyboxVertexShader(): string; // No variants needed
```

### Cache Key Generation

```typescript
// TubeWireframe: No cache needed (single variant)

// Skybox examples:
"skybox-aurora-atmo1-sun0-vig0-grain0-aber0"
"skybox-classic-atmo1-sun1-vig1-grain0-aber0-parallax1"
"skybox-starfield-atmo0-sun1-vig0-grain1-aber0"
```

## Shader Size Comparison

### TubeWireframe

| | Before | After | Change |
|--|--------|-------|--------|
| Fragment | 243 | ~195 | -20% |
| Vertex | 146 | 146 | 0% |

### Skybox (Fragment Shader)

| Mode | Before | After | Reduction |
|------|--------|-------|-----------|
| Classic + all effects | 1209 | ~350 | **71%** |
| Aurora + atmosphere only | 1209 | ~280 | **77%** |
| Nebula + sun + vignette | 1209 | ~300 | **75%** |
| Starfield + grain | 1209 | ~320 | **74%** |
| Ocean + all effects | 1209 | ~400 | **67%** |

## Shader Cache Management

### TubeWireframe
No caching needed - single shader variant always used.

### Skybox

1. **In-memory cache** of compiled WebGL programs keyed by config hash
2. **Pre-warm on app load**:
   - Classic mode with default effects
   - Aurora, Nebula, Starfield with default effects
3. **Lazy compilation** for other mode/effect combinations
4. **Cache invalidation** on app version change

### Pre-warm Strategy

```typescript
const PREWARM_CONFIGS: SkyboxShaderConfig[] = [
  { mode: 'classic', effects: { atmosphere: true, sun: false, vignette: true, grain: false, aberration: false }, parallax: false },
  { mode: 'aurora', effects: { atmosphere: true, sun: false, vignette: false, grain: false, aberration: false } },
  { mode: 'nebula', effects: { atmosphere: true, sun: false, vignette: false, grain: false, aberration: false } },
  { mode: 'starfield', effects: { atmosphere: false, sun: true, vignette: false, grain: true, aberration: false } },
];
```

## Migration Tasks

### Phase 1: TubeWireframe - Import Shared Modules

1. Create `src/rendering/shaders/tubewireframe/` directory
2. Extract PBR functions into `pbr.glsl.ts` (GGX, geometry, Fresnel)
3. Create `compose.ts` that imports:
   - `shared/lighting/multi-light.glsl.ts`
   - `shared/core/uniforms.glsl.ts` (light uniforms subset)
4. Create `main.glsl.ts` with TubeWireframe main() function
5. Update `TubeWireframe/` renderer to import from compose
6. **Verify**: Rendering identical, ~50 lines removed

### Phase 2: Skybox - Extract Core & Utils

1. Create `src/rendering/shaders/skybox/` directory structure
2. Extract into `core/`:
   - `uniforms.glsl.ts` - All uniform declarations
   - `varyings.glsl.ts` - Shared varyings
   - `constants.glsl.ts` - PI, TAU, mode constants
3. Extract into `utils/`:
   - `noise.glsl.ts` - hash, noise, fbm
   - `color.glsl.ts` - rgb2hsv, hsv2rgb, cosinePalette
   - `rotation.glsl.ts` - rotateY
4. **Verify**: Modules compile independently

### Phase 3: Skybox - Extract Procedural Modes

1. Extract each mode function into `modes/`:
   - `classic.glsl.ts` - Texture sampling, parallax logic
   - `aurora.glsl.ts` - getAurora()
   - `nebula.glsl.ts` - getNebula()
   - `void.glsl.ts` - getVoid()
   - `crystalline.glsl.ts` - getCrystalline()
   - `horizon.glsl.ts` - getHorizonGradient()
   - `ocean.glsl.ts` - getDeepOcean()
   - `twilight.glsl.ts` - getTwilight()
   - `starfield.glsl.ts` - getStarfield()
2. Each module exports a single function
3. **Verify**: Each mode works when composed individually

### Phase 4: Skybox - Extract Effects

1. Extract into `effects/`:
   - `atmosphere.glsl.ts` - applyHorizon()
   - `sun.glsl.ts` - Sun glow code
   - `vignette.glsl.ts` - Vignette calculation
   - `grain.glsl.ts` - Film grain
   - `aberration.glsl.ts` - Chromatic aberration
2. **Verify**: Effects can be toggled independently

### Phase 5: Skybox - Implement Compose Function

1. Create `compose.ts`:
   ```typescript
   export function composeSkyboxFragmentShader(config: SkyboxShaderConfig): string {
     return `
       ${uniforms}
       ${varyings}
       ${constants}
       ${noiseUtils}
       ${colorUtils}
       ${getModeFunction(config.mode)}
       ${config.effects.atmosphere ? atmosphereEffect : ''}
       ${config.effects.sun ? sunEffect : ''}
       ${config.effects.vignette ? vignetteEffect : ''}
       ${config.effects.grain ? grainEffect : ''}
       ${config.effects.aberration ? aberrationEffect : ''}
       ${generateMain(config)}
     `;
   }
   ```
2. Generate `main()` that only calls the selected mode
3. **Verify**: All mode/effect combinations compile correctly

### Phase 6: Skybox - Cache & Integration

1. Create `cache.ts` for compiled shader cache
2. Update `Skybox.tsx` to:
   - Get mode from `useSkyboxStore`
   - Get effect settings from store
   - Call `composeSkyboxFragmentShader(config)`
   - Lookup or compile shader variant
3. Implement pre-warm on component mount
4. **Verify**: Mode switching works, no visual regression

### Phase 7: Delete Original Files

1. Remove `tubeWireframe.frag` (replaced by compose)
2. Remove `skybox.frag` (replaced by compose)
3. Update all imports
4. Final verification

## Edge Cases & Pitfalls

### 1. Skybox Mode Transitions

**Problem**: User switches from Aurora to Nebula; new shader must compile.

**Solution**:
- Pre-warm common modes on app load
- Show brief loading indicator if switching to uncached mode
- Keep previous frame visible during compile (~100-300ms)

### 2. Effect Combinations Explosion

**Problem**: 9 modes × 32 effect combinations = 288 potential variants.

**Solution**:
- Most users don't toggle individual effects
- Pre-warm only common combinations (4-6 variants)
- Lazy-compile rare combinations
- Consider grouping effects into presets ("minimal", "cinematic", "performance")

### 3. Classic Mode Parallax Complexity

**Problem**: Classic mode has complex parallax logic that's independent of other modes.

**Solution**:
- Keep parallax as part of `classic.glsl.ts` module
- Add `parallax` flag to config for Classic mode only
- Generate simplified Classic shader when parallax disabled

### 4. Noise Functions Shared Across Modes

**Problem**: Multiple modes (Aurora, Nebula, Void, Ocean, Twilight, Starfield) use noise/fbm.

**Solution**:
- Extract noise to `utils/noise.glsl.ts`
- Compose function includes noise when mode needs it
- Could optimize: only include fbm if mode uses it (Nebula, Void need it; Aurora doesn't)

### 5. TubeWireframe Fresnel Signature Difference

**Problem**: TubeWireframe uses `vec3 fresnelSchlick(float cosTheta, vec3 F0)` for PBR. Shared module uses `float fresnelSchlick(float cosTheta, float F0)`.

**Solution**:
- Keep PBR Fresnel in `tubewireframe/pbr.glsl.ts` (different function)
- Or rename shared to `fresnelSchlickScalar`, TubeWireframe to `fresnelSchlickVec3`
- They serve different purposes; both can coexist

### 6. Skybox Uniform Compatibility

**Problem**: Different modes use different subsets of uniforms.

**Solution**:
- Declare all uniforms in `uniforms.glsl.ts` always
- GPU compiler eliminates unused uniforms
- Keeps Three.js material uniform structure consistent

### 7. Hot Module Replacement

**Problem**: Changing a mode module during development should trigger recompile.

**Solution**:
- Include module hashes in cache key during dev mode
- Or clear skybox shader cache on any shader module HMR

## Success Criteria

### TubeWireframe
1. **Code reduction**: ~50 lines of duplicated light code removed
2. **No visual regression**: PBR lighting identical
3. **Shared module usage**: Imports from `shared/lighting/`

### Skybox
1. **Code reduction**: 70%+ smaller compiled shaders per mode
2. **No visual regression**: All 9 modes render identically
3. **Compile time**: <300ms per variant on desktop
4. **Mode switching**: <500ms total (including compile) for uncached modes
5. **Pre-warm coverage**: Common modes compile on app load

## Non-Goals

- Merging TubeWireframe PBR with fractal/polytope lighting (different systems)
- WebGPU migration for skybox
- Adding new skybox modes (separate feature request)
- Dynamic effect intensity (effects are on/off, intensity controlled by uniforms)

## Testing

### TubeWireframe
1. Visual comparison screenshots before/after
2. Verify multi-light system works (point, directional, spot)
3. Verify PBR materials look correct (metallic, roughness variations)

### Skybox
1. Screenshot each of 9 modes before/after
2. Verify each post-effect works in isolation
3. Test mode transitions (no flicker, correct shader loads)
4. Performance benchmark: FPS with uber-shader vs composed shader
5. Measure compile times per variant

## References

- TubeWireframe shader: `src/rendering/renderers/TubeWireframe/tubeWireframe.{frag,vert}`
- Skybox shader: `src/rendering/materials/skybox/skybox.{frag,vert}`
- Skybox component: `src/rendering/environment/Skybox.tsx`
- Skybox store: `src/stores/slices/skyboxSlice.ts`
- Shared shader modules: `src/rendering/shaders/shared/`
- Main shader modularization PRD: `docs/prd/shader-split.md`
