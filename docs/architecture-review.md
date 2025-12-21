# Rendering Pipeline Architecture Review

## Executive Summary

This document presents a comprehensive review of the mDimension rendering pipeline architecture. After extensive analysis of all rendering-related files, shaders, stores, and component interactions, several critical architectural issues have been identified that explain why "it has become a mess to make this work."

**Key Findings:**
1. **PostProcessing.tsx is a God Component** - 1670+ lines doing everything
2. **No Render Graph Abstraction** - Pass ordering is implicit and fragile
3. **Black Hole Lensing Cannot Work** - Missing environment capture pipeline
4. **Massive Code Duplication** - Each renderer duplicates ~1000 lines of boilerplate
5. **Implicit Dependencies** - Layers, passes, and uniforms are loosely coupled

**Recommendation:** Implement a proper Render Graph architecture with:
- Declarative pass definitions
- Automatic resource management
- Explicit dependencies between passes
- Shared uniform systems
- Environment capture for lensing effects

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Component Inventory](#2-component-inventory)
3. [Rendering Pipeline Flow](#3-rendering-pipeline-flow)
4. [Identified Issues](#4-identified-issues)
5. [Black Hole Lensing Problem Analysis](#5-black-hole-lensing-problem-analysis)
6. [Proposed Architecture](#6-proposed-architecture)
7. [Migration Strategy](#7-migration-strategy)
8. [Deep Dive: System Analysis](#8-deep-dive-system-analysis)
   - [8.1 useFrame Ordering and Priorities](#81-useframe-ordering-and-priorities)
   - [8.2 Shadow Systems (Dual Approach)](#82-shadow-systems-dual-approach)
   - [8.3 Temporal Systems](#83-temporal-systems)
   - [8.4 Performance / Adaptive Quality System](#84-performance--adaptive-quality-system)
   - [8.5 Shader Composition Architecture](#85-shader-composition-architecture)
   - [8.6 Opacity Modes](#86-opacity-modes)
   - [8.7 TrackedShaderMaterial System](#87-trackedshadermaterial-system)
   - [8.8 Store Architecture and Data Flow](#88-store-architecture-and-data-flow)
   - [8.9 WebGL Context Loss/Restore](#89-webgl-context-lossrestore)
9. [Additional Architectural Issues Found](#9-additional-architectural-issues-found)
10. [Appendix: File Inventory](#appendix-file-inventory)

---

## 1. Current Architecture Overview

### 1.1 High-Level Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          Scene.tsx                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Skybox.tsx │  │SceneLighting│  │ GroundPlane │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                     UnifiedRenderer.tsx                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BlackHole │ Mandelbulb │ QuaternionJulia │ Schroedinger │...││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                     PostProcessing.tsx                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Bloom │ Bokeh │ SSR │ Fog │ GTAO │ CloudTemporal │ Film │...││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Layer System

| Layer ID | Name | Purpose |
|----------|------|---------|
| 0 | ENVIRONMENT | Base environment (walls, floor) |
| 1 | MAIN_OBJECT | Primary rendered object |
| 2 | SKYBOX | Background skybox mesh |
| 3 | VOLUMETRIC | Separate volumetric rendering |

**Issue:** Layer assignments are scattered across components without central management.

### 1.3 Render Target Flow

```
Current Flow (Simplified):
┌─────────────────────────────────────────────────────────────────┐
│ 1. objectDepthTarget    ← Object-only depth (SSR, bokeh)        │
│ 2. cloudRenderTarget    ← Quarter-res volumetric (if enabled)   │
│ 3. sceneTarget          ← Full scene (ENV + MAIN + SKYBOX)      │
│ 4. normalTarget         ← G-buffer normals                       │
│ 5. mainObjectMRT        ← MRT for main object                   │
│ 6. EffectComposer       ← Post-processing chain                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Inventory

### 2.1 Renderers (src/rendering/renderers/)

| Renderer | Lines | Purpose | Special Features |
|----------|-------|---------|------------------|
| BlackHoleMesh.tsx | ~560 | Black hole visualization | Volumetric raymarching, lensing, accretion disk |
| MandelbulbMesh.tsx | ~1040 | Mandelbulb fractal | D-dimensional, zoom autopilot |
| QuaternionJuliaMesh.tsx | ~830 | Julia set | 4D quaternion math |
| SchroedingerMesh.tsx | ~965 | Quantum wavefunction | Volumetric, temporal accumulation |
| Polytope/* | ~multiple | N-dimensional polytopes | Face/edge rendering |
| TubeWireframe/* | ~multiple | Wireframe tubes | Line rendering |

**Pattern:** Every raymarched renderer duplicates:
- Working arrays for rotation calculations (~80 lines)
- Rotation matrix composition (~30 lines)
- Light uniform updates (~50 lines)
- Temporal uniform updates (~40 lines)
- Opacity mode handling (~50 lines)
- Quality/performance handling (~60 lines)

### 2.2 Shader Composition (src/rendering/shaders/)

```
shaders/
├── blackhole/
│   ├── compose.ts          # Black hole shader composer
│   ├── main.glsl.ts         # Main raymarch loop (500+ lines)
│   ├── uniforms.glsl.ts     # Black hole-specific uniforms
│   ├── gravity/             # Lensing, horizon, shell, manifold, doppler
│   └── effects/
│       ├── jets.glsl.ts
│       ├── motion-blur.glsl.ts
│       └── deferred-lensing.glsl.ts  ← NOT INTEGRATED!
├── mandelbulb/
│   ├── compose.ts
│   └── ...
├── schroedinger/
│   ├── compose.ts
│   └── temporal/            # Reprojection, reconstruction shaders
├── skybox/
│   ├── compose.ts
│   ├── modes/              # aurora, nebula, void, crystalline, etc.
│   └── effects/            # atmosphere, vignette, grain, sun
└── shared/
    ├── core/               # precision, constants, uniforms
    ├── color/              # palette, HSL, OKLab
    ├── lighting/           # multi-light, GGX, SSS
    ├── features/           # temporal, fog, opacity, shadows
    └── raymarch/           # core, normal, sphere-intersect
```

### 2.3 Post-Processing Effects

| Effect | Implementation | Status |
|--------|---------------|--------|
| Bloom | postprocessing lib | Working |
| Bokeh/DoF | Custom passes | Working |
| SSR | Custom SSRPass | Working |
| Refraction | Custom RefractionPass | Working |
| FXAA/SMAA | postprocessing lib | Working |
| Cinematic | Custom shader | Working |
| Volumetric Fog | Custom VolumetricFogPass | Working |
| GTAO | postprocessing lib | Working |
| Cloud Temporal | CloudTemporalPass | Working |
| **Deferred Lensing** | **deferred-lensing.glsl.ts** | **NOT INTEGRATED** |

### 2.4 Temporal Systems

| System | File | Purpose |
|--------|------|---------|
| TemporalDepthManager | core/TemporalDepthManager.ts | Depth reprojection for SDF objects |
| TemporalCloudManager | core/TemporalCloudManager.ts | Horizon-style quarter-res accumulation |

### 2.5 State Stores (src/stores/)

| Store | Purpose | Subscribers |
|-------|---------|-------------|
| animationStore | Animation timing | All renderers |
| appearanceStore | Colors, materials | All renderers |
| extendedObjectStore | Object-specific params | Per-object |
| geometryStore | Dimension, object type | All |
| lightingStore | Light configuration | All renderers |
| performanceStore | Quality settings | All |
| postProcessingStore | Effect settings | PostProcessing |
| rotationStore | D-dimensional rotations | All renderers |
| uiStore | Opacity settings | All renderers |
| environmentStore | Skybox config | Skybox |
| fogSlice (in uiStore) | Fog settings | PostProcessing |

---

## 3. Rendering Pipeline Flow

### 3.1 Current Pass Order (PostProcessing.tsx)

```typescript
// Reconstructed from PostProcessing.tsx analysis
1. OBJECT DEPTH PASS
   - Set camera to MAIN_OBJECT layer only
   - Render to objectDepthTarget (depth only)
   - Used for: SSR, bokeh, refraction, temporal

2. TEMPORAL CLOUD ACCUMULATION (if volumetric + temporal)
   - Set camera to VOLUMETRIC layer
   - Render to cloudRenderTarget (quarter-res MRT)
   - Run reprojection pass
   - Run reconstruction pass to accumulation buffer

3. FULL SCENE RENDER
   - Set camera to all layers (ENV + MAIN + SKYBOX)
   - Render to sceneTarget
   - Includes: skybox, walls, main object

4. CLOUD COMPOSITING (if volumetric)
   - Blend accumulated cloud over scene

5. NORMAL PASS
   - Environment only to normalTarget
   - Main object MRT (color + normal + optional position)
   - Volumetric compositor if needed

6. GTAO PASS (if enabled)
   - Screen-space ambient occlusion

7. EFFECT COMPOSER CHAIN
   - TexturePass (input from scene)
   - FXAA or SMAA
   - VolumetricFogPass
   - Bloom (UnrealBloomPass or SelectiveBloomPass)
   - BokehPass (if enabled)
   - SSRPass (if enabled)
   - RefractionPass (if enabled)
   - BufferPreviewPass (debug)
   - CinematicPass
   - FilmPass (grain)
   - OutputPass

8. TEMPORAL DEPTH SWAP
   - Swap read/write depth buffers for next frame
```

### 3.2 Problems with Current Flow

1. **Implicit Ordering**: Pass order is procedural code, not declarative
2. **Hardcoded Dependencies**: Each pass manually fetches what it needs
3. **No Resource Sharing**: Render targets created ad-hoc
4. **Layer Switching Overhead**: Camera layers toggled per pass
5. **Missing Passes**: No environment-only capture for lensing

---

## 4. Identified Issues

### 4.1 God Component Anti-Pattern

**PostProcessing.tsx** (~1670 lines) does EVERYTHING:
- Creates 5+ render targets
- Manages 15+ passes
- Handles layer orchestration
- Temporal accumulation (two systems)
- G-buffer management (MRT)
- Context loss/restore handling
- Performance metrics collection
- Buffer preview debugging

**Impact:**
- Impossible to reason about pass dependencies
- Can't easily add/remove passes
- Brittle to changes

### 4.2 Renderer Code Duplication

Each renderer (~900-1100 lines) duplicates:

```typescript
// In EVERY renderer:
function applyRotationInPlace(matrix, vec, out, dimension) { ... }
function createWorkingArrays() { ... }

// In EVERY useFrame():
const { rotations, version } = useRotationStore.getState();
cachedRotationMatrixRef.current = composeRotations(dimension, rotations);
updateLightUniforms(material.uniforms, lights, lightColorCache);
material.uniforms.uTime.value = accumulatedTime;
material.uniforms.uResolution.value.set(size.width, size.height);
// ... 50+ more uniform updates
```

**Lines duplicated per renderer:** ~400
**Total duplicated lines:** ~2000+ across 5 renderers

### 4.3 Scattered Layer Management

Layer assignments in 5+ different files:
- `MandelbulbMesh.tsx:148`: `meshRef.current.layers.set(RENDER_LAYERS.MAIN_OBJECT)`
- `SchroedingerMesh.tsx:415-420`: Conditional VOLUMETRIC vs MAIN_OBJECT
- `GroundPlane.tsx:289`: Grid sets SKYBOX layer
- `Skybox.tsx`: Uses default ENVIRONMENT
- `PostProcessing.tsx`: Camera layer toggling

### 4.4 Missing Abstractions

| Missing | Impact |
|---------|--------|
| Render Graph | No declarative pass management |
| Uniform Manager | Every renderer manages its own |
| Resource Pool | Render targets created ad-hoc |
| Pass Dependencies | Implicit in code order |
| Environment Capture | Can't do proper lensing |

### 4.5 Hacks and Workarounds Found

```typescript
// PostProcessing.tsx - Saving/restoring depthWrite for transparent materials
const savedDepthWrites = new Map<THREE.Material, boolean>();
// ... manual state management

// SchroedingerMesh.tsx - useLayoutEffect for layer assignment
// "CRITICAL: Use useLayoutEffect to ensure layer is set BEFORE first render"

// BlackHoleMesh.tsx - TODO comment for missing feature
// "TODO: Deferred Lensing Integration"
// "The deferred lensing shader is currently not integrated into the render pipeline"

// PostProcessing.tsx - Manual cache invalidation
// Volumetric mesh caching with invalidation logic

// TemporalCloudManager.ts - Context restore handling
// restoreCount tracking for WebGL context loss
```

---

## 5. Black Hole Lensing Problem Analysis

### 5.1 What Lensing Needs

For realistic gravitational lensing, the black hole shader must:

1. **Sample the Environment**: Read what's "behind" the black hole
2. **Apply Distortion**: Bend sampled rays based on gravity
3. **Handle Walls/Objects**: Include scene geometry in sampling
4. **Support Procedural Skybox**: Can't just sample a cubemap

### 5.2 Current Implementation Gap

**What Exists:**
- `deferred-lensing.glsl.ts` - Shader code for screen-space lensing
- `sampleBackground()` in `main.glsl.ts` - Samples envMap if available
- `uEnvMapReady` uniform - Flag for valid environment map

**What's Missing:**
1. **No Environment Cubemap Capture**
   - Skybox renders to screen, not cubemap
   - No way for black hole to sample procedural sky

2. **No Pre-Lensing Scene Render**
   - Walls/environment not rendered to texture first
   - Black hole can't distort background objects

3. **Deferred Lensing Not Integrated**
   - Shader exists but no pass uses it
   - Not in EffectComposer chain

### 5.3 Why It's Hard to Fix

Current architecture assumes:
- Single forward render pass
- Post-processing after all objects rendered
- No inter-object dependencies

Black hole lensing requires:
- Multi-pass with specific ordering
- Environment captured BEFORE black hole
- Black hole samples environment DURING render
- Or: Deferred lensing pass AFTER scene

**Neither approach fits the current architecture.**

---

## 6. Proposed Architecture

### 6.1 Render Graph System

Replace procedural pass management with a declarative render graph:

```typescript
// Proposed: RenderGraph.ts
interface RenderPass {
  id: string;
  inputs: string[];        // Resource names this pass reads
  outputs: string[];       // Resource names this pass writes
  execute: (ctx: RenderContext) => void;
  enabled: () => boolean;  // Dynamic enable/disable
}

interface RenderResource {
  id: string;
  type: 'texture' | 'cubemap' | 'buffer';
  config: TextureConfig | CubemapConfig;
}

class RenderGraph {
  private passes: Map<string, RenderPass>;
  private resources: Map<string, RenderResource>;

  addPass(pass: RenderPass): void;
  addResource(resource: RenderResource): void;

  // Automatically sort passes by dependencies
  compile(): CompiledGraph;

  // Execute all enabled passes in correct order
  execute(renderer: WebGLRenderer, scene: Scene, camera: Camera): void;
}
```

### 6.2 Standard Passes

```typescript
// Environment Capture Pass
{
  id: 'environment-capture',
  inputs: [],
  outputs: ['environment-cubemap'],
  execute: (ctx) => {
    // Render skybox + walls to cubemap
    ctx.renderToCubemap('environment-cubemap', (face) => {
      ctx.setLayers([ENVIRONMENT, SKYBOX]);
      ctx.render();
    });
  }
}

// Main Object Pass
{
  id: 'main-object',
  inputs: ['environment-cubemap'],  // Black hole needs this
  outputs: ['scene-color', 'scene-depth', 'scene-normal'],
  execute: (ctx) => {
    ctx.setLayers([MAIN_OBJECT]);
    ctx.render();
  }
}

// Deferred Lensing Pass
{
  id: 'deferred-lensing',
  inputs: ['scene-color', 'black-hole-position'],
  outputs: ['lensed-scene'],
  execute: (ctx) => {
    ctx.runShaderPass(deferredLensingShader, {
      sceneTexture: ctx.getTexture('scene-color'),
      blackHoleCenter: ctx.getUniform('black-hole-position')
    });
  },
  enabled: () => geometryStore.getState().objectType === 'blackhole'
}
```

### 6.3 Unified Uniform Manager

```typescript
// UniformManager.ts
interface UniformSource {
  id: string;
  getUniforms(): Record<string, THREE.IUniform>;
  getVersion(): number;  // For change detection
}

class UniformManager {
  private sources: Map<string, UniformSource>;
  private cache: Map<string, { version: number; uniforms: any }>;

  // Common uniforms shared by all shaders
  registerSource(source: UniformSource): void;

  // Update material with relevant uniforms
  updateMaterial(material: ShaderMaterial, sources: string[]): void;

  // Sources:
  // - 'time': uTime, uResolution
  // - 'camera': uCameraPosition, uViewMatrix, uProjectionMatrix
  // - 'lighting': uLights[], uAmbient*
  // - 'temporal': uPrevDepthTexture, uPrevViewProjection*
  // - 'appearance': uColor, uColorAlgorithm, uCosine*
}
```

### 6.4 Base Renderer Class

```typescript
// BaseRaymarchRenderer.tsx
abstract class BaseRaymarchRenderer {
  protected workingArrays: WorkingArrays;
  protected cachedRotation: MatrixND | null;
  protected uniformCache: UniformCache;

  // Shared implementations
  protected updateRotationMatrix(): void { /* 80 lines, ONE place */ }
  protected updateBaseUniforms(material: ShaderMaterial): void { /* 50 lines, ONE place */ }
  protected setupLayerAssignment(): void { /* 20 lines, ONE place */ }

  // Abstract - each renderer implements
  abstract composeShader(): { fragment: string; features: string[] };
  abstract getSpecificUniforms(): Record<string, THREE.IUniform>;
  abstract updateSpecificUniforms(material: ShaderMaterial): void;
}

// MandelbulbRenderer extends BaseRaymarchRenderer
// BlackHoleRenderer extends BaseRaymarchRenderer
// etc.
```

### 6.5 Proposed Directory Structure

```
src/rendering/
├── graph/
│   ├── RenderGraph.ts           # Core render graph
│   ├── RenderPass.ts            # Pass base class
│   ├── RenderResource.ts        # Resource management
│   └── passes/
│       ├── EnvironmentCapturePass.ts
│       ├── MainObjectPass.ts
│       ├── DeferredLensingPass.ts
│       ├── CloudTemporalPass.ts
│       └── PostProcessPass.ts
├── uniforms/
│   ├── UniformManager.ts
│   ├── sources/
│   │   ├── TimeSource.ts
│   │   ├── CameraSource.ts
│   │   ├── LightingSource.ts
│   │   └── TemporalSource.ts
│   └── UniformCache.ts
├── renderers/
│   ├── base/
│   │   ├── BaseRaymarchRenderer.tsx
│   │   └── BasePolytopeRenderer.tsx
│   ├── BlackHole/
│   │   └── BlackHoleRenderer.tsx    # Extends BaseRaymarchRenderer
│   └── ... (other renderers)
└── layers/
    ├── LayerManager.ts              # Central layer assignment
    └── layers.ts                    # Layer constants
```

### 6.6 For Black Hole Lensing Specifically

```
New Pass Order:
┌────────────────────────────────────────────────────────────────┐
│ 1. ENVIRONMENT CUBEMAP CAPTURE                                  │
│    - Render procedural skybox to 6 faces                       │
│    - Render walls to same cubemap                              │
│    - Output: environment-cubemap                               │
├────────────────────────────────────────────────────────────────┤
│ 2. BLACK HOLE OBJECT PASS (with env sampling)                  │
│    - Input: environment-cubemap                                │
│    - Black hole shader samples cubemap for lensed background   │
│    - Output: scene-color (black hole only)                     │
├────────────────────────────────────────────────────────────────┤
│ 3. COMPOSITE PASS                                               │
│    - Combine black hole with any other scene elements          │
├────────────────────────────────────────────────────────────────┤
│ 4. POST-PROCESSING CHAIN                                       │
│    - Bloom, bokeh, etc.                                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Migration Strategy

### Phase 1: Foundation (Low Risk)
1. Create UniformManager and uniform sources
2. Create BaseRaymarchRenderer
3. Migrate one renderer (e.g., MandelbulbMesh) to new base class
4. Verify no regressions

### Phase 2: Render Graph Core (Medium Risk)
1. Implement RenderGraph class
2. Create standard passes
3. Migrate PostProcessing passes to graph
4. Keep old PostProcessing as fallback

### Phase 3: Environment Capture (Medium Risk)
1. Implement EnvironmentCapturePass
2. Add cubemap resource to graph
3. Update black hole shader to use captured cubemap
4. Test lensing with procedural skybox

### Phase 4: Deferred Lensing (Low Risk)
1. Create DeferredLensingPass from existing shader
2. Add to render graph
3. Enable for black hole object type

### Phase 5: Cleanup (Low Risk)
1. Remove duplicated code from renderers
2. Centralize layer management
3. Remove old PostProcessing fallback
4. Update documentation

### Estimated Impact

| Metric | Before | After (Est.) |
|--------|--------|--------------|
| PostProcessing.tsx | 1670 lines | ~200 lines (orchestration only) |
| Renderer boilerplate | ~400 lines each | ~50 lines each |
| Pass dependencies | Implicit | Explicit in graph |
| Adding new pass | Dangerous | Simple |
| Black hole lensing | Broken | Working |

---

## Appendix: File Inventory

### A.1 Rendering Files (src/rendering/)

```
Scene.tsx                           - Main scene composition
UnifiedRenderer.tsx                 - Object type switching

renderers/
├── BlackHole/
│   ├── BlackHoleMesh.tsx          - 560 lines
│   ├── useBlackHoleUniforms.ts    - Uniform definitions
│   └── useBlackHoleUniformUpdates.ts
├── Mandelbulb/
│   ├── MandelbulbMesh.tsx         - 1040 lines
│   └── mandelbulb.vert            - Vertex shader
├── QuaternionJulia/
│   └── QuaternionJuliaMesh.tsx    - 830 lines
├── Schroedinger/
│   ├── SchroedingerMesh.tsx       - 965 lines
│   └── schroedinger.vert
├── Polytope/                       - Multiple files
└── TubeWireframe/                  - Multiple files

environment/
├── Skybox.tsx                      - Procedural skybox
├── GroundPlane.tsx                 - Walls/floor
├── SceneLighting.tsx               - Multi-light system
└── PostProcessing.tsx              - 1670 lines GOD COMPONENT

core/
├── layers.ts                       - Layer constants
├── TemporalCloudManager.ts         - Cloud temporal accumulation
├── TemporalDepthManager.ts         - Depth reprojection
├── VisibilityHandler.ts
├── ContextEventHandler.ts
└── webglCleanup.ts

passes/
├── CloudTemporalPass.ts            - Temporal cloud reconstruction
└── (others via postprocessing lib)

materials/
└── TrackedShaderMaterial.tsx       - Shader compilation tracking
```

### A.2 Shader Files (src/rendering/shaders/)

```
Total shader blocks: 70+
Total GLSL lines: ~8000+

blackhole/
├── compose.ts
├── main.glsl.ts                    - 500+ lines
├── uniforms.glsl.ts
├── gravity/
│   ├── lensing.glsl.ts
│   ├── horizon.glsl.ts
│   ├── shell.glsl.ts
│   ├── manifold.glsl.ts
│   ├── doppler.glsl.ts
│   ├── colors.glsl.ts
│   ├── disk-sdf.glsl.ts
│   └── disk-volumetric.glsl.ts
└── effects/
    ├── jets.glsl.ts
    ├── motion-blur.glsl.ts
    └── deferred-lensing.glsl.ts   ← NOT INTEGRATED

skybox/
├── compose.ts
├── main.glsl.ts
├── core/                           - precision, uniforms, varyings, constants
├── utils/                          - noise, color, rotation
├── modes/                          - 9 procedural modes
│   ├── aurora.glsl.ts
│   ├── nebula.glsl.ts
│   ├── void.glsl.ts
│   ├── crystalline.glsl.ts
│   ├── horizon.glsl.ts
│   ├── ocean.glsl.ts
│   ├── twilight.glsl.ts
│   ├── starfield.glsl.ts
│   └── classic.glsl.ts
└── effects/                        - atmosphere, vignette, grain, sun, aberration

shared/
├── core/
│   ├── precision.glsl.ts
│   ├── constants.glsl.ts
│   └── uniforms.glsl.ts
├── color/
│   ├── selector.glsl.ts
│   ├── cosine-palette.glsl.ts
│   ├── hsl.glsl.ts
│   └── oklab.glsl.ts
├── lighting/
│   ├── multi-light.glsl.ts
│   ├── ggx.glsl.ts
│   └── sss.glsl.ts
├── features/
│   ├── temporal.glsl.ts
│   ├── fog.glsl.ts
│   ├── opacity.glsl.ts
│   ├── shadows.glsl.ts
│   └── shadowMaps.glsl.ts
├── depth/
│   └── customDepth.glsl.ts
├── raymarch/
│   ├── core.glsl.ts
│   ├── normal.glsl.ts
│   └── sphere-intersect.glsl.ts
└── fractal/
    └── main.glsl.ts
```

### A.3 Store Files (src/stores/)

```
animationStore.ts                   - Animation timing
appearanceStore.ts                  - Colors, materials
cameraStore.ts                      - Camera state
environmentStore.ts                 - Skybox config
exportStore.ts                      - Export state
extendedObjectStore.ts              - Per-object params
geometryStore.ts                    - Dimension, object type
layoutStore.ts                      - UI layout
lightingStore.ts                    - Light config
msgBoxStore.ts                      - Message dialogs
performanceMetricsStore.ts          - Performance tracking
performanceStore.ts                 - Quality settings
postProcessingStore.ts              - Effect settings
presetManagerStore.ts               - Presets
rotationStore.ts                    - D-dimensional rotations
themeStore.ts                       - UI theme
transformStore.ts                   - Transform state
uiStore.ts                          - UI state + fog
webglContextStore.ts                - WebGL context

slices/
├── geometry/
│   ├── blackholeSlice.ts
│   ├── mandelbulbSlice.ts
│   ├── schroedingerSlice.ts
│   ├── quaternionJuliaSlice.ts
│   └── ...
├── visual/
│   ├── colorSlice.ts
│   ├── materialSlice.ts
│   └── renderSlice.ts
├── fogSlice.ts
├── skyboxSlice.ts
├── lightingSlice.ts
└── postProcessingSlice.ts
```

---

## 8. Deep Dive: System Analysis

### 8.1 useFrame Ordering and Priorities

**Critical Finding: All 16 useFrame calls use default priority 0 - no explicit ordering!**

This creates potential race conditions where uniform updates may occur in unpredictable order.

| File | Line | Purpose | Priority |
|------|------|---------|----------|
| PostProcessing.tsx | 925 | Accumulated time for animations | default (0) |
| Skybox.tsx | 566 | Procedural sky animation | default (0) |
| MandelbulbMesh.tsx | 449 | Uniform updates | default (0) |
| SchroedingerMesh.tsx | 428 | Uniform updates | default (0) |
| QuaternionJuliaMesh.tsx | 327 | Uniform updates | default (0) |
| BlackHoleMesh (via hook) | 186 | Uniform updates | default (0) |
| PolytopeScene.tsx | 924 | Instance matrix updates | default (0) |
| TubeWireframe.tsx | 612 | Instance updates | default (0) |
| CameraController.tsx | 162 | Camera animation | default (0) |
| PerformanceStatsCollector.tsx | 120 | Metrics collection | default (0) |

**Recommended Fix:** Implement explicit priorities:
```typescript
// Priority system (higher = runs first)
const FRAME_PRIORITY = {
  CAMERA: 100,        // Camera updates first
  ANIMATION: 90,      // Global time/animation
  RENDERERS: 50,      // Object uniform updates
  POST_EFFECTS: 10,   // Post-processing passes
  STATS: 0,           // Metrics collection last
};
```

### 8.2 Shadow Systems (Dual Approach)

The codebase implements TWO different shadow systems:

#### 8.2.1 SDF Soft Shadows (for Raymarched Objects)
**File:** `src/rendering/shaders/shared/features/shadows.glsl.ts`

Uses Inigo Quilez's improved soft shadow technique:
```glsl
// Quality-aware: 8/16/24/32 steps based on quality level
int maxSteps = 8 + quality * 8;

// Softness parameter controls penumbra size
// softness=0 → k=64 (hard shadows)
// softness=2 → k=4 (very soft shadows)
float k = mix(64.0, 4.0, softness * 0.5);
```

#### 8.2.2 Shadow Maps (for Polytope Objects)
**File:** `src/rendering/shadows/uniforms.ts`

Traditional Three.js shadow mapping with:
- **Point lights:** Packed 2D cube faces (4:2 aspect ratio, avoids WebGL multi-target binding error)
- **Directional/Spot:** Standard 2D shadow maps
- **PCF filtering:** 0=hard, 1=3x3, 2=5x5 kernel
- **Quality levels:** 512 (low) → 1024 (medium) → 2048 (high) → 4096 (ultra)

**Performance optimization:**
```typescript
// Shadow data caching to avoid per-frame scene traversal
export function collectShadowDataCached(
  scene: THREE.Scene,
  storeLights: LightSource[],
  forceRefresh = false
): ShadowLightData[] {
  const currentHash = computeLightsHash(storeLights);
  if (!forceRefresh && shadowDataCache?.lightsHash === currentHash) {
    return shadowDataCache.data; // Return cached
  }
  // ... expensive scene traversal only on change
}
```

### 8.3 Temporal Systems

#### 8.3.1 TemporalCloudManager (Horizon ZD-Style)
**File:** `src/rendering/core/TemporalCloudManager.ts`

Industry-proven quarter-resolution accumulation for volumetric clouds:

```
Frame Cycle (Bayer Pattern):
┌───┬───┐   Frame 0: (0,0) Top-left
│ 0 │ 2 │   Frame 1: (1,1) Bottom-right (diagonal for better coverage)
├───┼───┤   Frame 2: (1,0) Top-right
│ 3 │ 1 │   Frame 3: (0,1) Bottom-left
└───┴───┘
```

**MRT Configuration:**
- Attachment 0: Accumulated color (RGBA, FloatType for HDR)
- Attachment 1: Accumulated world positions (xyz = pos, w = alpha weight)
- Attachment 2: View-space normals (for SSR/SSAO)

**Motion-adaptive history weight:**
```typescript
// Reduce history weight during fast camera motion to prevent smearing
const rotationFactor = Math.max(0, 1 - rotationDelta * 10);
const positionFactor = Math.max(0, 1 - positionDelta * 0.5);
this.historyWeight = this.baseHistoryWeight * Math.min(rotationFactor, positionFactor);
```

#### 8.3.2 Temporal Depth Reprojection
**File:** `src/rendering/shaders/shared/features/temporal.glsl.ts`

Simple reprojection for SDF objects:
```glsl
// Disocclusion detection via neighbor depth comparison
float maxNeighborDiff = max(
    max(abs(rayDistance - depthLeft), abs(rayDistance - depthRight)),
    max(abs(rayDistance - depthUp), abs(rayDistance - depthDown))
);
if (maxNeighborDiff > 0.2) {
    return -1.0;  // Depth discontinuity - temporal data unreliable
}
```

### 8.4 Performance / Adaptive Quality System
**File:** `src/stores/performanceStore.ts`

#### 8.4.1 Progressive Refinement Stages

| Stage | Multiplier | Timing (ms after interaction stops) |
|-------|------------|-------------------------------------|
| low | 0.25 | 0 (immediate) |
| medium | 0.50 | 100 |
| high | 0.75 | 300 |
| final | 1.00 | 500 |

#### 8.4.2 Quality Interpolation

The system provides functions to compute effective quality based on multiplier:
```typescript
// Example: SSR with target='high' and multiplier=0.5 → returns 'medium'
export function getEffectiveSSRQuality(
  targetQuality: SSRQualityLevel,
  qualityMultiplier: number
): SSRQualityLevel {
  return computeEffectiveQuality(SSR_QUALITY_ORDER, targetQuality, qualityMultiplier);
}
```

#### 8.4.3 Volumetric Fog Fast Mode
**File:** `src/rendering/passes/VolumetricFogPass.ts`

```typescript
// During interaction: 25% resolution, fewer steps
const scale = this.currentFastMode ? 0.25 : 0.33;
const activeSteps = uFogFastMode ? 16 : 32;
const shadowFreq = uFogFastMode ? 4 : 2; // Sample shadows every Nth step
```

### 8.5 Shader Composition Architecture
**File:** `src/rendering/shaders/shared/fractal/compose-helpers.ts`

Block-based shader assembly with conditional inclusion:

```typescript
interface ShaderBlock {
  name: string;
  content: string;
  condition?: boolean;  // false = excluded entirely
}

// Feature flag processing generates #defines
export function processFeatureFlags(config: ShaderConfig): FeatureFlags {
  const defines: string[] = [];
  const features: string[] = [];

  if (useShadows && !overrides.includes('Shadows')) {
    defines.push('#define USE_SHADOWS');
    features.push('Shadows');
  }
  // ... for each feature
  return { defines, features, useShadows, useTemporal, useAO, useSss, useFresnel, useFog };
}
```

**Override system for debugging:**
```typescript
// toggleShaderModule('Shadows') → removes shadow block from shader
// Useful for isolating rendering issues
```

### 8.6 Opacity Modes
**File:** `src/rendering/shaders/shared/features/opacity.glsl.ts`

| Mode | Calculation | Use Case |
|------|-------------|----------|
| Solid | `return 1.0` | Default opaque rendering |
| Simple Alpha | `return uSimpleAlpha` | Uniform transparency |
| Layered | Depth-based layer visibility | X-ray style visualization |
| Volumetric | Beer-Lambert absorption | Cloud-like accumulation |

**Quality-aware volumetric density:**
```glsl
if (uSampleQuality == 0) {
    densityMultiplier = 0.6;  // Low: less dense, fewer samples
} else if (uSampleQuality == 2) {
    densityMultiplier = 1.5;  // High: more dense, more samples
}
// Beer-Lambert: alpha = 1 - exp(-density * distance)
```

### 8.7 TrackedShaderMaterial System
**File:** `src/rendering/materials/TrackedShaderMaterial.tsx`

Solves the "white flash" problem when shaders compile:

1. **Double RAF Pattern:** Ensures overlay appears before GPU blocks
   ```typescript
   requestAnimationFrame(() => {
     requestAnimationFrame(() => {
       setReadyToRender(true);  // Browser has painted overlay, safe to block
     });
   });
   ```

2. **MRT-aware Placeholder:**
   ```glsl
   // When rendering to G-Buffer (2-3 targets), placeholder must output to all locations
   layout(location = 0) out vec4 gColor;
   layout(location = 1) out vec4 gNormal;
   layout(location = 2) out vec4 gPosition;
   void main() {
     gColor = vec4(0.0);
     gNormal = vec4(0.0);
     gPosition = vec4(0.0);
     discard;  // Prevent rasterization
   }
   ```

3. **Multiple simultaneous compilations:** Uses a Set to track all compiling shaders

### 8.8 Store Architecture and Data Flow
**File:** `src/stores/index.ts`

15+ Zustand stores with slices pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│ CORE STORES:                                                     │
│   geometryStore     → Object type, dimension                     │
│   animationStore    → isPlaying, speed, direction, planes        │
│   rotationStore     → N-dimensional rotation matrices            │
│   transformStore    → Scale, position offsets                    │
│   cameraStore       → Camera state                               │
│                                                                  │
│ VISUAL STORES:                                                   │
│   appearanceStore   → Colors, materials                          │
│   lightingStore     → Light configs (up to 4 lights)             │
│   environmentStore  → Skybox, fog settings                       │
│   postProcessingStore → Effect toggles and settings              │
│                                                                  │
│ SYSTEM STORES:                                                   │
│   performanceStore  → Quality, interaction state, shader compile │
│   webglContextStore → Context loss/restore lifecycle             │
│   layoutStore       → UI layout                                  │
│   uiStore           → UI state                                   │
│                                                                  │
│ OBJECT-SPECIFIC SLICES:                                          │
│   mandelbulbSlice, blackholeSlice, schroedingerSlice, ...       │
└─────────────────────────────────────────────────────────────────┘
```

**Performance patterns used:**
- `getState()` in useFrame loops (avoids subscription overhead)
- `useShallow` recommended but inconsistently applied
- Subscriptions for temporal system state caching

### 8.9 WebGL Context Loss/Restore
**File:** `src/stores/slices/webglContextSlice.ts`

Full lifecycle management with exponential backoff:

```typescript
interface RecoveryConfig {
  initialTimeout: 3000,     // First attempt: 3s
  maxTimeout: 30000,        // Max wait: 30s
  backoffMultiplier: 2,     // Double each time
  maxAttempts: 5,           // Total before giving up
  rapidFailureWindow: 10000, // Detect rapid failures in 10s window
  rapidFailureThreshold: 3   // 3 failures in window = back off more
}
```

**ResourceRecovery coordinator:**
```typescript
// All GPU resources register with recovery coordinator
resourceRecovery.register({
  name: 'TemporalCloudManager',
  priority: RECOVERY_PRIORITY.TEMPORAL_CLOUD,
  invalidate: () => TemporalCloudManager.invalidateForContextLoss(),
  reinitialize: (gl) => TemporalCloudManager.reinitialize(gl),
});
```

---

## 9. Additional Architectural Issues Found

### 9.1 Inconsistent Pattern Usage

| Pattern | Used In | Missing In |
|---------|---------|------------|
| useShallow | Some components | Most renderer useFrame |
| Explicit useFrame priority | None | All 16 useFrame calls |
| TrackedShaderMaterial | Fractals | Polytope faces |
| Shadow data caching | VolumetricFogPass | Other passes |

### 9.2 Potential Race Conditions

1. **Animation store time vs renderer uniform updates:** Both run at priority 0
2. **Camera controller vs post-processing:** No guaranteed order
3. **Multiple renderers updating temporal uniforms:** Shared resources, no locks

### 9.3 Memory/Performance Concerns

1. **VolumetricFogPass:** Creates new Matrix4 per frame (`this.viewProjMatrix.multiplyMatrices`)
2. **CloudTemporalPass:** Creates new Matrix4 in updateCamera (`new THREE.Matrix4()`)
3. **Shadow data collection:** Allocates arrays even when cached

---

## Conclusion

The current rendering pipeline has grown organically to support many features, but has reached a complexity threshold where fundamental changes (like black hole lensing) become extremely difficult. The proposed Render Graph architecture addresses the root causes:

1. **Declarative pass management** replaces implicit ordering
2. **Resource abstraction** enables environment capture
3. **Shared uniform system** eliminates duplication
4. **Explicit dependencies** make the pipeline understandable
5. **Prioritized useFrame loops** prevent race conditions
6. **Unified shadow system** consolidates SDF and shadow map approaches

The migration can be done incrementally, starting with low-risk refactoring and building up to the new architecture while maintaining backward compatibility.

---

*Document generated: 2025-12-21*
*Analysis scope: Full rendering pipeline review*
*Total files analyzed: 100+*
*Total lines of code reviewed: 20,000+*
*Deep dive systems: useFrame, shadows, temporal, quality, stores, context, shaders, opacity*
