# Black Hole Implementation Code Review

**Date:** 2025-12-20
**Reviewer:** Codex
**Implementation Plan:** docs/plans/cinematic-black-hole-implementation.md

## Executive Summary
Overall implementation is **~55% complete**. Core types, store slice, and a basic renderer/shader pipeline exist, but several plan-critical capabilities are **missing or only partially wired** (N‑D embedding, temporal accumulation outputs, fast mode/progressive refinement, deferred lensing/motion blur, and black‑hole color algorithms). A few **blocking issues** (shader uniform redefinition risk, missing control loader, mismatch between registry animation keys and config) will prevent correct rendering/UI behavior or smooth workflows. The store slice is comprehensive and well‑clamped, but many config parameters are not used in the shader or not wired to uniforms.

## Feature-by-Feature Analysis

### Phase 1: Core Type Definitions
- **1.1 ExtendedObjectType union / type guard:** **Implemented** in `src/lib/geometry/types.ts`.
- **1.2 BlackHoleConfig + defaults + presets:** **Implemented** in `src/lib/geometry/extended/types.ts`.
- **1.3 Color algorithms (palette/types):** **Partially implemented.** Types + options + mappings exist in `src/rendering/shaders/palette/types.ts`, **but UI filtering for black-hole-only algorithms is missing** (see ColorAlgorithmSelector). `src/components/sections/Faces/ColorAlgorithmSelector.tsx:29-35` only filters quantum algorithms.
- **1.4 BlackHole slice types:** **Implemented** in `src/stores/slices/geometry/types.ts`.

### Phase 2: Shader Architecture
- **2.1 Folder structure:** **Partially implemented.** Core folders exist, but `effects/motion-blur`, `effects/deferred-lensing`, `background/starfield`, `color/blackhole-palettes`, and `nd/embedding` are **missing** (empty dirs).
- **2.2 Uniforms block:** **Implemented**, but **does not match plan** (no precomputed `uEpsilon`, `uPhotonShellRadius`, `uDiskInnerRadius`, `uDiskOuterRadius`, `uRadialSoftness`, `uThicknessScale`, `uManifoldAxisU/V`, `uDeferredLensing*`, `uSceneObjectLensing*`, or fastMode/progressive refinement uniforms). See `src/rendering/shaders/blackhole/uniforms.glsl.ts`.
- **2.3 Lensing module:** **Implemented** but **formula and bending mode differ from spec** (see Mathematical Correctness).
- **2.4 Horizon module:** **Implemented.**
- **2.5 Photon shell module:** **Implemented** but **Rp formula differs** from spec (linear bias vs log(N)).
- **2.6 Manifold module:** **Implemented** but **not N‑D plane/axis aware** and does not use manifold axis vectors.
- **2.7 Doppler module:** **Implemented** but **not HSL‑based** as specified; uses RGB heuristics.
- **2.8 Jets module:** **Implemented** (3D Z‑axis cone only; no rotation‑axis alignment).
- **2.9 Motion blur:** **Missing.**
- **2.10 Deferred lensing:** **Missing.**
- **2.11 Blackhole color palettes:** **Missing.**
- **2.12 Main shader:** **Implemented** but uses 3D-only ray/pos, lacks N‑D embedding, and outputs incomplete MRT data.
- **2.13 MRT outputs:** **Partially implemented.** `precisionBlock` defines outputs, but `gNormal`/`gPosition` are not correctly written (see Buffer Output Analysis).
- **2.14 compose.ts:** **Implemented**, but omits many planned blocks and adds a **second `uParamValues` uniform** (potential redefinition) and omits color/lighting/fog blocks from plan.

### Phase 3: Store Slice
- **blackholeSlice.ts:** **Implemented** with good clamping coverage for most fields.
- **Gaps:** missing `applyBlackHoleQualityPreset()` API (plan requires), and `setBlackHoleConfig()` validates only a subset of numeric fields (e.g., `shellStepMul`, `photonShellRadiusDimBias`, `radialSoftnessMul`, `thicknessPerDimMax`, `highDimWScale`, `noiseScale`, `stepMax`, `stepAdaptR`, `transmittanceCutoff`, etc. are not validated). `src/stores/slices/geometry/blackholeSlice.ts:669-758`.
- **Type import issue:** `setBlackHoleConfig` uses `BlackHoleConfig` without importing it (type error). `src/stores/slices/geometry/blackholeSlice.ts:672`.

### Phase 4: Registry Configuration
- **OBJECT_TYPE_REGISTRY entry:** **Implemented** but diverges from plan (category `fractal` vs `extended`; recommended dim 4 vs 3). `src/lib/geometry/registry/registry.ts:820-940`.
- **Animation keys mismatch:** Registry references `sliceAnimationEnabled`, `sliceSpeed`, `sliceAmplitude` which are not defined in `BlackHoleConfig` or slice actions. `src/lib/geometry/registry/registry.ts:898-920`.
- **Controls loader missing:** `components.ts` lacks `BlackHoleControls` loader, so registry key cannot resolve component. `src/lib/geometry/registry/components.ts:30-69`.
- **determineRenderMode:** **Implemented** (`raymarch-blackhole`).

### Phase 5: Renderer Implementation
- **BlackHoleMesh.tsx:** **Implemented** but missing several plan items:
  - **No N‑D manifold axis computation** (plan required u/v axes).
  - **No precomputed uniforms** (epsilon, photon shell radius, disk radii) – shader recomputes from multipliers only.
  - **No FastMode / Progressive Refinement** logic or uniforms.
  - **Temporal accumulation wiring incomplete** (no density‑weighted gPosition, no TemporalCloudManager accumulation textures).
- **blackhole.vert:** **Implemented.**
- **index.ts:** **Implemented.**

### Phase 6: UI Components
- **BlackHoleControls.tsx:** **Implemented** but includes many visual params; does not match plan’s geometry/visual split; also missing some advanced controls (e.g., `bendMaxPerStep`, `epsilonMul`, `lensingClamp`, `radialSoftnessMul`, etc.).
- **BlackHoleAdvanced:** **Partially implemented** inside `AdvancedObjectControls.tsx` rather than its own file; lacks many plan parameters (edge glow, doppler, jets visuals, quality presets, temporal accumulation toggle, background controls). `src/components/sections/Advanced/AdvancedObjectControls.tsx:527-760`.
- **ColorAlgorithmSelector:** **Missing blackhole filtering** (still only filters quantum). `src/components/sections/Faces/ColorAlgorithmSelector.tsx:29-35`.
- **BlackHoleAnimationDrawer:** **Implemented** (includes swirl/pulse/jets).

### Phase 7: Extended Object Integration
- **generateExtendedObject case:** **Implemented** in `src/lib/geometry/extended/index.ts`.

### Phase 8: Tests
- **Implemented:** `blackholeSlice` tests + `compose` shader tests exist.
- **Missing:** Renderer/UI tests and Playwright visual tests specified in plan.

### Phase 9: Performance Optimization
- **Temporal accumulation:** **Partially integrated** (Bayer offset + inverse VP). Missing density‑weighted position output and TemporalCloudManager MRT plumbing.
- **Quality adaptation (fast mode / progressive refinement):** **Missing.**
- **Shader compilation flags / dimension unrolling:** **Partial** (#define DIMENSION exists; no unrolled loops or fast-mode paths).

## Mathematical Correctness

### Gravitational Lensing Formula
- **Spec:** `G(r,N) = k * N^alpha / (r + epsilon)^beta` (rotation-based bending).
- **Implementation:** `computeDeflectionAngle()` uses `k * R_h / r^2` and then divides by `r^(beta - 2)`; uses `uEpsilonMul` instead of `epsilon`; clamp is applied to `theta` rather than `G`. Bending rotates toward `toCenter` (spiral) by default. `src/rendering/shaders/blackhole/gravity/lensing.glsl.ts:48-115`.
- **Result:** **Not aligned with spec.** Missing explicit `+epsilon` term and uses horizon radius factor not in formula; rotation mode is not strictly tangential by default.

### Photon Shell Formula
- **Spec:** `R_p = R_h * (radiusMul + radiusDimBias * log(N))`.
- **Implementation:** `R_p = R_h * (radiusMul + radiusDimBias * (N - 3))`. `src/rendering/shaders/blackhole/gravity/shell.glsl.ts:20-22`.
- **Result:** **Incorrect dimension scaling** (linear bias instead of log).

### Shell Mask
- **Spec (corrected):** `1.0 - smoothstep(0.0, delta, abs(r - R_p))`.
- **Implementation:** **Matches** corrected formula. `src/rendering/shaders/blackhole/gravity/shell.glsl.ts:31-36`.

### Ray Bending Approach
- **Spec:** rotation-based tangential bending (orbital arcs).
- **Implementation:** default spiral mode rotates toward center; orbital mode exists but not surfaced. `src/rendering/shaders/blackhole/gravity/lensing.glsl.ts:104-115`.

### Manifold Density (Dimension-aware)
- **Spec:** N‑D plane projection using manifold axes; thickness scales with dimension.
- **Implementation:** Uses XY disk plane in 3D; “extra dimensions” only add to height via `uParamValues` (no manifold axes). `src/rendering/shaders/blackhole/gravity/manifold.glsl.ts:71-139`.
- **Result:** **Not dimension‑aware per spec.**

### Doppler Effect
- **Spec:** HSL‑based hue shift and brightness modulation.
- **Implementation:** RGB heuristic with simple hue bias. `src/rendering/shaders/blackhole/gravity/doppler.glsl.ts:42-90`.
- **Result:** **Not spec‑compliant.**

## UI Parameter Wiring Audit
Legend: **Setter** = store action exists + clamp; **Uniform** = uniform defined + updated in `BlackHoleMesh` useFrame; **Shader** = used in shader.

### Basic
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| horizonRadius | ✅ (0.05–20) | ✅ `uHorizonRadius` | ✅ | OK |
| gravityStrength | ✅ (0–10) | ✅ `uGravityStrength` | ✅ | OK |
| manifoldIntensity | ✅ (0–20) | ✅ `uManifoldIntensity` | ✅ | OK |
| manifoldThickness | ✅ (0–2) | ✅ `uManifoldThickness` | ✅ | OK |
| photonShellWidth | ✅ (0–0.3) | ✅ `uPhotonShellWidth` | ✅ | OK |
| timeScale | ✅ (0–5) | ✅ `uTimeScale` | ✅ | OK |
| baseColor | ✅ (no clamp) | ✅ `uBaseColor` | ✅ | OK |
| paletteMode | ✅ | ✅ `uPaletteMode` | ✅ | OK |
| bloomBoost | ✅ (0–5) | ✅ `uBloomBoost` | ✅ | OK |

### Lensing
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| dimensionEmphasis | ✅ (0–2) | ✅ `uDimensionEmphasis` | ✅ | OK |
| distanceFalloff | ✅ (0.5–4) | ✅ `uDistanceFalloff` | ✅ | OK |
| epsilonMul | ✅ (1e‑5–0.5) | ✅ `uEpsilonMul` | ✅ | Used as `max(r, uEpsilonMul)` rather than `r+epsilon` |
| bendScale | ✅ (0–5) | ✅ `uBendScale` | ✅ | OK |
| bendMaxPerStep | ✅ (0–0.8) | ✅ `uBendMaxPerStep` | ✅ | OK |
| lensingClamp | ✅ (0–100) | ✅ `uLensingClamp` | ✅ | OK |

### Photon Shell
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| photonShellRadiusMul | ✅ (1–2) | ✅ `uPhotonShellRadiusMul` | ✅ | OK |
| photonShellRadiusDimBias | ✅ (0–0.5) | ✅ `uPhotonShellRadiusDimBias` | ✅ | Uses linear `(N-3)` not `log(N)` |
| shellGlowStrength | ✅ (0–20) | ✅ `uShellGlowStrength` | ✅ | OK |
| shellGlowColor | ✅ | ✅ `uShellGlowColor` | ✅ | OK |
| shellStepMul | ✅ (0.05–1) | ✅ `uShellStepMul` | ✅ | OK |
| shellContrastBoost | ✅ (0–3) | ✅ `uShellContrastBoost` | ✅ | OK |

### Manifold / Accretion
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| manifoldType | ✅ | ✅ `uManifoldType` | ✅ | OK |
| densityFalloff | ✅ (0–40) | ✅ `uDensityFalloff` | ✅ | OK |
| diskInnerRadiusMul | ✅ (0–10) | ✅ `uDiskInnerRadiusMul` | ✅ | OK |
| diskOuterRadiusMul | ✅ (0.1–200) | ✅ `uDiskOuterRadiusMul` | ✅ | OK |
| radialSoftnessMul | ✅ (0–2) | ✅ `uRadialSoftnessMul` | ✅ | OK |
| thicknessPerDimMax | ✅ (1–10) | ✅ `uThicknessPerDimMax` | ✅ | OK |
| highDimWScale | ✅ (1–10) | ✅ `uHighDimWScale` | ✅ | OK |
| swirlAmount | ✅ (0–2) | ✅ `uSwirlAmount` | ✅ | OK |
| noiseScale | ✅ (0.1–10) | ✅ `uNoiseScale` | ✅ | OK |
| noiseAmount | ✅ (0–1) | ✅ `uNoiseAmount` | ✅ | OK |
| multiIntersectionGain | ✅ (0–3) | ✅ `uMultiIntersectionGain` | ❌ | **Not used** in shader |

### Rotation Damping
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| dampInnerMul | ✅ (1–2) | ✅ `uDampInnerMul` | ❌ | Unused |
| dampOuterMul | ✅ (1.2–8) | ✅ `uDampOuterMul` | ❌ | Unused |

### Rendering Quality
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| raymarchQuality | ✅ (preset) | ❌ | ❌ | Only adjusts store values, not shader quality multiplier |
| maxSteps | ✅ (16–512) | ✅ `uMaxSteps` | ✅ | OK |
| stepBase | ✅ (0.001–1) | ✅ `uStepBase` | ✅ | OK |
| stepMin | ✅ (0.0001–0.5) | ✅ `uStepMin` | ✅ | OK |
| stepMax | ✅ (0.001–5) | ✅ `uStepMax` | ✅ | OK |
| stepAdaptG | ✅ (0–5) | ✅ `uStepAdaptG` | ✅ | OK |
| stepAdaptR | ✅ (0–2) | ✅ `uStepAdaptR` | ✅ | OK |
| enableAbsorption | ✅ | ✅ `uEnableAbsorption` | ✅ | OK |
| absorption | ✅ (0–10) | ✅ `uAbsorption` | ✅ | OK |
| transmittanceCutoff | ✅ (0–0.2) | ✅ `uTransmittanceCutoff` | ✅ | OK |
| farRadius | ✅ (1–100) | ✅ `uFarRadius` | ✅ | OK |

### Lighting (Optional)
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| lightingMode | ✅ | ✅ `uLightingMode` | ❌ | Not used in shader |
| roughness | ✅ (0–1) | ✅ `uRoughness` | ❌ | Not used |
| specular | ✅ (0–1) | ✅ `uSpecular` | ❌ | Not used |
| ambientTint | ✅ (0–1) | ✅ `uAmbientTint` | ❌ | Not used |

### Horizon / Edge Glow
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| edgeGlowEnabled | ✅ | ✅ `uEdgeGlowEnabled` | ✅ | OK |
| edgeGlowWidth | ✅ (0–1) | ✅ `uEdgeGlowWidth` | ✅ | OK |
| edgeGlowColor | ✅ | ✅ `uEdgeGlowColor` | ✅ | OK |
| edgeGlowIntensity | ✅ (0–5) | ✅ `uEdgeGlowIntensity` | ✅ | OK |

### Background
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| backgroundMode | ✅ | ✅ `uBackgroundMode` | ✅ | OK |
| starfieldDensity | ✅ (0–5) | ✅ `uStarfieldDensity` | ✅ | OK |
| starfieldBrightness | ✅ (0–3) | ✅ `uStarfieldBrightness` | ✅ | OK |

### Temporal
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| temporalAccumulationEnabled | ✅ | ✅ (controls `USE_TEMPORAL_ACCUMULATION`) | ✅ | Output data incorrect for reprojection (see MRT section) |

### Doppler
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| dopplerEnabled | ✅ | ✅ `uDopplerEnabled` | ✅ | OK |
| dopplerStrength | ✅ (0–2) | ✅ `uDopplerStrength` | ✅ | OK |
| dopplerHueShift | ✅ (0–0.3) | ✅ `uDopplerHueShift` | ✅ | OK |

### Visual Preset
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| visualPreset | ✅ | ❌ | ❌ | Applied only via store/UI |

### Cross‑Section
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| parameterValues | ✅ (‑2 to 2) | ✅ `uParamValues` | ✅ | Used as simple extra height, not N‑D embedding |

### Polar Jets
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| jetsEnabled | ✅ | ✅ `uJetsEnabled` | ✅ | OK |
| jetsHeight | ✅ (0–50) | ✅ `uJetsHeight` | ✅ | OK |
| jetsWidth | ✅ (0–5) | ✅ `uJetsWidth` | ✅ | OK |
| jetsIntensity | ✅ (0–10) | ✅ `uJetsIntensity` | ✅ | OK |
| jetsColor | ✅ | ✅ `uJetsColor` | ✅ | OK |
| jetsFalloff | ✅ (0–10) | ✅ `uJetsFalloff` | ✅ | OK |
| jetsNoiseAmount | ✅ (0–1) | ✅ `uJetsNoiseAmount` | ✅ | OK |
| jetsPulsation | ✅ (0–2) | ✅ `uJetsPulsation` | ✅ | OK |

### Motion Blur
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| motionBlurEnabled | ✅ | ❌ | ❌ | Uniform declared but not wired or used |
| motionBlurStrength | ✅ (0–2) | ❌ | ❌ | Missing wiring/shader |
| motionBlurSamples | ✅ (1–8) | ❌ | ❌ | Missing wiring/shader |
| motionBlurRadialFalloff | ✅ (0–5) | ❌ | ❌ | Missing wiring/shader |

### Deferred Lensing / Scene Lensing
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| deferredLensingEnabled | ✅ | ❌ | ❌ | Missing uniforms + shader pass |
| deferredLensingStrength | ✅ (0–2) | ❌ | ❌ | Missing |
| deferredLensingRadius | ✅ (0–10) | ❌ | ❌ | Missing |
| sceneObjectLensingEnabled | ✅ | ❌ | ❌ | Missing |
| sceneObjectLensingStrength | ✅ (0–2) | ❌ | ❌ | Missing |

### Animation
| Parameter | Setter (Clamp) | Uniform + useFrame | Shader Usage | Notes |
| --- | --- | --- | --- | --- |
| swirlAnimationEnabled | ✅ | ✅ `uSwirlAnimationEnabled` | ❌ | Uniform not used in shader |
| swirlAnimationSpeed | ✅ (0–2) | ✅ `uSwirlAnimationSpeed` | ❌ | Not used |
| pulseEnabled | ✅ | ✅ `uPulseEnabled` | ❌ | Not used |
| pulseSpeed | ✅ (0–2) | ✅ `uPulseSpeed` | ❌ | Not used |
| pulseAmount | ✅ (0–1) | ✅ `uPulseAmount` | ❌ | Not used |

## Buffer Output Analysis
- **MRT layout:** Declared via `precisionBlock` with explicit `layout(location = N)` (correct). `src/rendering/shaders/shared/core/precision.glsl.ts:8-18`.
- **gColor:** Written correctly (`gColor = result`). `src/rendering/shaders/blackhole/main.glsl.ts:208-209`.
- **gNormal:** **Not written** when temporal accumulation is disabled; **not view‑space** when enabled (uses `normalize(vPosition)` rather than view normal). `src/rendering/shaders/blackhole/main.glsl.ts:211-214`.
- **gPosition:** **Incorrect** for temporal accumulation (writes `vPosition` instead of density‑weighted world position). `src/rendering/shaders/blackhole/main.glsl.ts:213-214`.
- **Density‑weighted center:** Not implemented; no accumulation of density-weighted positions in raymarch loop.

## Temporal Accumulation
- **Bayer offset:** Applied, but assumes quarter‑res render only (no detection of full‑res path like Schrödinger). `src/rendering/shaders/blackhole/main.glsl.ts:176-195`.
- **Ray reconstruction:** Uses inverse VP matrix correctly.
- **TemporalCloudManager integration:** Only `uBayerOffset` + `uFullResolution` are wired; no outputs for position/accumulation buffer expected by TemporalCloudManager. `src/rendering/renderers/BlackHole/BlackHoleMesh.tsx:520-538`.

## Missing/Incomplete Features
- Motion blur effects (`effects/motion-blur.glsl.ts` + wiring) – **missing**.
- Deferred lensing pass – **missing**.
- Scene object lensing – **missing**.
- FastMode quality reduction – **missing**.
- Progressive refinement integration – **missing**.
- Visual presets application in renderer (preset values do not influence shader unless used by UI/Store) – **partial**.
- Black-hole color algorithms (accretionGradient, gravitationalRedshift, lensingIntensity, jetsEmission) – **types only**, no shader or UI integration.
- N‑D embedding module and manifold axes – **missing**.

## Critical Issues
1. **Potential shader compile failure from duplicate `uParamValues` definitions.** `compose.ts` injects a dimension‑sized `uParamValues` uniform while `blackHoleUniformsBlock` also declares `uParamValues[8]`. This risks GLSL redefinition/size mismatch.
   - Reference: `src/rendering/shaders/blackhole/compose.ts:101-115` + `src/rendering/shaders/blackhole/uniforms.glsl.ts:118-123`.
   - Impact: Shader compilation failure or undefined behavior in WebGL2.
   - Fix: Remove the extra `paramValuesStr` block OR remove `uParamValues` from `blackHoleUniformsBlock` and rely on the dimension‑specific declaration.

2. **Temporal accumulation outputs incorrect gPosition/gNormal.** `gNormal`/`gPosition` are only written in temporal mode, and `gPosition` uses `vPosition` (NDC), not density‑weighted world position.
   - Reference: `src/rendering/shaders/blackhole/main.glsl.ts:211-214`.
   - Impact: Temporal reprojection smears or fails; reprojection assumes world space.
   - Fix: Accumulate density‑weighted world position in raymarch and output `gPosition = vec4(weightedCenter, transmittance)` as in plan; always write gNormal (view‑space pseudo normal).

## High Issues
1. **N‑D embedding and manifold axes not implemented.** Raymarching uses 3D `vec3` positions only; manifold is fixed to XY plane.
   - Reference: `src/rendering/shaders/blackhole/gravity/manifold.glsl.ts:71-139` and `src/rendering/shaders/blackhole/gravity/lensing.glsl.ts:11-30`.
   - Impact: Higher‑dimensional behavior is incorrect; cross‑section parameters do not produce expected N‑D geometry.
   - Fix: Implement N‑D embedding (basis + origin) and manifold axis vectors; use N‑D arrays per plan.

2. **Photon shell radius formula deviates from spec.** Uses linear `(N - 3)` bias instead of `log(N)`.
   - Reference: `src/rendering/shaders/blackhole/gravity/shell.glsl.ts:20-22`.
   - Impact: Shell scaling is off at higher dimensions.
   - Fix: Use `log(float(DIMENSION))` as per plan.

3. **Gravitational lensing formula and bending mode not spec‑compliant.** Uses `k * R_h / r^2` and rotates toward center by default; spec requires `k * N^α / (r+ε)^β` with rotation‑based tangential deflection.
   - Reference: `src/rendering/shaders/blackhole/gravity/lensing.glsl.ts:48-115`.
   - Impact: Lensing strength and orbit arcs diverge from intended look/physics.
   - Fix: Implement `G(r,N)` formula and always use tangential rotation (or expose mode + default to orbital).

4. **BlackHoleControls loader missing in registry components.** Registry points to `BlackHoleControls` but loader does not exist.
   - Reference: `src/lib/geometry/registry/components.ts:30-69` and `src/lib/geometry/registry/registry.ts:937-939`.
   - Impact: Geometry UI fails to load (null component, warning).
   - Fix: Add loader mapping for `BlackHoleControls`.

5. **Registry animation keys not present in config.** `sliceAnimationEnabled`, `sliceSpeed`, `sliceAmplitude` are referenced but not implemented in `BlackHoleConfig`/slice.
   - Reference: `src/lib/geometry/registry/registry.ts:898-920`.
   - Impact: Timeline controls will read/write undefined state.
   - Fix: Add fields + setters or remove registry entries.

6. **Black-hole color algorithms not integrated into UI or shader.** UI filtering does not include blackhole-only algorithms.
   - Reference: `src/components/sections/Faces/ColorAlgorithmSelector.tsx:29-35`.
   - Impact: Black hole-specific algorithms show for non‑blackhole or are not applied at all.
   - Fix: Apply blackhole filtering and implement shader palette logic.

## Medium Issues
1. **`setBlackHoleConfig` does not validate several numeric fields and lacks type import.**
   - Reference: `src/stores/slices/geometry/blackholeSlice.ts:672-758`.
   - Impact: Inconsistent state validation; potential TS error.
   - Fix: Import `BlackHoleConfig` and validate all numeric fields.

2. **Many config parameters are wired but unused in shader.** (e.g., `multiIntersectionGain`, `dampInnerMul`, lighting params, animation toggles).
   - Reference: `src/rendering/shaders/blackhole/gravity/manifold.glsl.ts:113-158` (no use of `uMultiIntersectionGain`), `src/rendering/shaders/blackhole/uniforms.glsl.ts:35-116` vs `main.glsl.ts` usage.
   - Impact: UI knobs have no effect, causing confusion and tech debt.
   - Fix: Either implement usage or remove from UI until ready.

3. **Temporal accumulation ray jitter assumes quarter‑res only.** No detection of full‑res context like Schrödinger.
   - Reference: `src/rendering/shaders/blackhole/main.glsl.ts:176-195`.
   - Impact: Incorrect jitter during full‑res depth pass; potential artifacts.
   - Fix: Mirror Schrödinger’s “isQuarterRes” detection logic.

4. **BlackHoleAdvanced is partial and co-located in AdvancedObjectControls.** Missing many plan parameters (edge glow, doppler, jets visuals, background controls, quality presets).
   - Reference: `src/components/sections/Advanced/AdvancedObjectControls.tsx:527-760`.
   - Impact: Users cannot reach many config fields.
   - Fix: Expand controls or create dedicated component per plan.

## Low Issues
1. **Category/label mismatch with plan** (`fractal` vs `extended`, name “Black Hole” vs “Cinematic Black Hole”).
   - Reference: `src/lib/geometry/registry/registry.ts:828-844`.
   - Impact: UX consistency only.

2. **Some UI ranges differ from plan** (e.g., horizon radius max 5 in controls vs plan’s 20).
   - Reference: `src/components/sections/Geometry/BlackHoleControls.tsx:117-165`.
   - Impact: Limits artistic range.

## Recommendations
1. **Fix shader correctness first:** implement spec‑correct formulas, N‑D embedding (basis + origin), and shell radius formula. Add manifold axis support.
2. **Repair MRT/temporal outputs:** write gNormal always, compute density‑weighted gPosition, integrate with TemporalCloudManager’s accumulation textures.
3. **Resolve compile hazards:** remove duplicate `uParamValues` uniform declarations.
4. **Complete missing effects:** motion blur, deferred lensing, scene object lensing; wire uniforms and UI controls.
5. **Finish performance features:** fast‑mode and progressive refinement quality scaling.
6. **UI + registry cleanup:** add controls loader; align animation keys with config; add blackhole algorithm filtering.
7. **Expand tests:** add mesh/uniform tests and at least one visual Playwright test to catch regressions.

## Positive Practices
- **Comprehensive store slice with clamping** for most parameters (`blackholeSlice.ts`) provides good safety against invalid values.
- **Color caching and light uniform caching** in `BlackHoleMesh.tsx` mirror proven patterns from other renderers.
- **Shader modularization** (lensing/horizon/shell/manifold/jets) is clean and maintainable.

<SUMMARY>
Top issues: (1) duplicate `uParamValues` uniform declarations risk shader compile failure; (2) temporal accumulation outputs (`gNormal`, `gPosition`) are incorrect/partial; (3) N‑D embedding + lensing/shell formulas diverge from spec; (4) missing loader + registry animation key mismatches break UI. Fixes: remove duplicate uniform, implement density‑weighted gPosition + proper normals, align lensing/shell/manifold math to spec with N‑D axes, add `BlackHoleControls` loader and align animation keys. Positives: strong store validation, reuse of caching patterns, modular shader blocks.
</SUMMARY>
