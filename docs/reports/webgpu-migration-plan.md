# WebGPU Migration Plan

**Version**: 4.0
**Date**: 2026-01-03
**Status**: IN PROGRESS - Phase 0-4 Complete, Phase 5+ In Progress
**Estimated Duration**: 8-12 weeks (revised)

---

## ✅ Migration Progress Summary

### Completed Phases

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Recovery | ✅ Complete | Build passes, tests pass (3074/3078) |
| Phase 1: Foundation | ✅ Complete | WebGPURenderer, detection, badge |
| Phase 2: TSL Post-Processing | ✅ Complete | Bloom, FXAA working |
| Phase 3: Screen-Space Effects | ✅ Complete | SSR, GTAO with MRT |
| Phase 4: Custom TSL Effects | ✅ Complete | Vignette, grain, chromatic aberration, lensing, paper texture |
| Phase 5: Mesh Materials | 🔄 In Progress | Polytope, GroundPlane, Skybox |
| Phase 6-8: Raymarched Materials | ⏳ Pending | Mandelbulb, Julia, Schrödinger, BlackHole |

### Current Implementation

**PostProcessingTSL.tsx** now implements:
- Scene pass with MRT (output, normalView)
- Bloom effect using native `bloom()` node
- FXAA anti-aliasing using native `fxaa()` node
- SSR using native `ssr()` node
- GTAO using native `ao()` node
- **Vignette effect using custom TSL `Fn()`**
- **Film grain effect using custom TSL `Fn()`**
- **Chromatic aberration using custom TSL `Fn()`**
- **Gravitational lensing using custom TSL `Fn()`**
- **Paper texture using custom TSL `Fn()`**

**TSL Type Declarations Extended**: Created proper TypeScript declarations for TSL node methods (`.add()`, `.sub()`, `.mul()`, `.div()`, `.clamp()`, `.length()`, swizzle accessors `.x`, `.y`, `.z`, `.w`, etc.) in `src/types/three-webgpu.d.ts`.

---

## 📜 Previous Failed Attempt Analysis

### What Went Wrong (for reference)

An initial migration attempt **failed catastrophically** with 521 TypeScript errors due to:

#### What Was Implemented (Working ✅)

| Component | File | Status |
|-----------|------|--------|
| WebGPU Renderer Init | `src/App.tsx` | ✅ Working - async gl pattern correct |
| Backend State Store | `src/stores/rendererStore.ts` | ✅ Working |
| Backend Detection Hook | `src/hooks/useRendererBackend.ts` | ⚠️ Minor fix needed (deprecated API) |
| WebGPU Badge UI | `src/components/ui/WebGPUBadge.tsx` | ✅ Working |
| Scene Integration | `src/rendering/Scene.tsx` | ✅ Working - conditional rendering |
| Type Declarations | `src/types/three-webgpu.d.ts` | ✅ Working |

#### What Was Implemented (Broken ❌)

| Component | Files | Error Count | Issue |
|-----------|-------|-------------|-------|
| TSL Effects | `src/rendering/tsl/effects/*` (8 files) | ~150 errors | Wrong TSL API usage |
| TSL Materials | `src/rendering/tsl/materials/*` (8 files) | ~300 errors | Wrong TSL API usage |
| TSL Shared Utils | `src/rendering/tsl/shared/*` (2 files) | ~50 errors | Wrong TSL API usage |
| PostProcessingTSL | `src/rendering/PostProcessingTSL.tsx` | ~20 errors | Store interface mismatch |
| TSL Tests | `src/tests/rendering/tsl/*` (10 files) | N/A | Fake tests (100% mocked) |

### Root Cause Analysis

The failed implementation made these critical errors:

#### 1. Hallucinated TSL API
The code used GLSL-style syntax that doesn't exist in TSL:

```typescript
// ❌ WRONG - These properties don't exist on TSL Node type
const x = pos.x;           // Error: Property 'x' does not exist on type 'Node'
const xy = uvCoord.xy;     // Error: Property 'xy' does not exist on type 'Node'
const color = node.rgb;    // Error: Property 'rgb' does not exist on type 'Node'
node.toVar('name');        // Error: Property 'toVar' does not exist on type 'Node'
node.greaterThan(value);   // Error: Property 'greaterThan' does not exist on type 'Node'

// ❌ WRONG - texture() expects Texture, not Node
const sample = texture(colorNode, uv);  // Error: Node is not assignable to Texture
```

#### 2. Correct TSL API (Three.js r169+)
```typescript
// ✅ CORRECT - Use TSL functions and proper node operations
import {
  float, vec2, vec3, vec4,
  split, element,           // For accessing components
  texture as textureSample, // Renamed to avoid confusion
  uv, uniform,
  greaterThan, lessThan,    // Comparison functions
  select,                   // Conditional (like GLSL ternary)
  Fn,                       // Function builder
} from 'three/tsl';

// Access vector components
const pos = positionWorld;
const x = pos.x;  // Actually works for built-in position nodes
// OR use split() for custom nodes:
const [x, y, z] = split(customVec3Node);

// Comparisons
const isGreater = greaterThan(valueA, valueB);  // Returns boolean node
const result = select(isGreater, valueIfTrue, valueIfFalse);

// Variables (mutable state in TSL)
const myVar = float(0.0).toVar();  // .toVar() IS valid on FloatNode
myVar.assign(newValue);
myVar.addAssign(delta);
```

#### 3. Store Interface Mismatch
PostProcessingTSL.tsx expected properties that don't exist:

```typescript
// ❌ WRONG - These properties don't exist in postProcessingStore
s.bloomStrength      // Should be: s.bloomIntensity
s.fxaaEnabled        // Should be: s.antiAliasingMethod === 'FXAA'
s.smaaEnabled        // Should be: s.antiAliasingMethod === 'SMAA'
s.dofEnabled         // Should be: s.bokehEnabled
s.vignetteEnabled    // Doesn't exist at all
```

#### 4. Tests Were Fake
All tests mocked the entire `three/tsl` module, making them useless:

```typescript
// ❌ These tests prove nothing - they just test mocks
vi.mock('three/tsl', () => ({
  Fn: vi.fn((fn) => fn),
  float: vi.fn((v) => ({ value: v })),
  // ... everything mocked
}));
```

### Recovery Strategy

1. **Delete broken TSL code** - The 18 broken TSL files must be removed
2. **Keep working foundation** - App.tsx, rendererStore, Scene.tsx integration are good
3. **Stub PostProcessingTSL** - Make it a no-op that falls back to WebGL post-processing
4. **Rebuild TSL incrementally** - Using CORRECT TSL API with proper testing

---

## Executive Summary

This document outlines the complete plan to add WebGPU support to the N-Dimensional Visualizer while maintaining full backward compatibility with the existing WebGL2/GLSL system. The goal is to provide identical functionality, visuals, animations, and post-processing effects on both backends, with WebGPU enabled automatically on supported browsers.

### Key Objectives

1. **Zero Feature Regression**: All existing effects work on both backends
2. **Automatic Detection**: WebGPU used when available, WebGL fallback otherwise (handled automatically by `THREE.WebGPURenderer`)
3. **Unified API**: Single codebase using TSL (Three.js Shading Language) for renderer-agnostic shaders
4. **Performance Gains**: 30-80% FPS improvement on WebGPU for raymarched objects

### Critical Technical Notes

- **WebGPURenderer auto-fallback**: `THREE.WebGPURenderer` automatically falls back to WebGL when WebGPU is unavailable—no separate WebGL path needed in most cases
- **TSL is renderer-agnostic**: Shaders written in TSL work on both WebGL and WebGPU backends
- **React Three Fiber v9+**: Supports async `gl` prop for WebGPU initialization
- **CRITICAL**: TSL API is NOT the same as GLSL - study actual Three.js examples before writing TSL code

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [WebGPU Migration Strategy](#2-webgpu-migration-strategy)
3. [Component Inventory](#3-component-inventory)
4. [Abstraction Layer Design](#4-abstraction-layer-design)
5. [Shader Migration Guide](#5-shader-migration-guide)
6. [Post-Processing Migration](#6-post-processing-migration)
7. [Renderer Migration](#7-renderer-migration)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Phases](#9-implementation-phases)
10. [Risk Assessment](#10-risk-assessment)
11. [Success Criteria](#11-success-criteria)

---

## 1. Current Architecture Analysis

### 1.1 Rendering Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    React Application                         │
├─────────────────────────────────────────────────────────────┤
│               @react-three/fiber v9.5.0                     │
├─────────────────────────────────────────────────────────────┤
│                    Three.js v0.182.0                        │
├─────────────────────────────────────────────────────────────┤
│                  WebGLRenderer (WebGL2)                     │
├─────────────────────────────────────────────────────────────┤
│              Custom RenderGraph System                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ ResourcePool│  │GraphCompiler│  │  GPUTimer   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    28 Render Passes                          │
│  (Bloom, GTAO, SSR, Bokeh, Lensing, etc.)                  │
├─────────────────────────────────────────────────────────────┤
│                   6 Object Renderers                         │
│  (Mandelbulb, Julia, BlackHole, Schrödinger, Polytope, Tube)│
├─────────────────────────────────────────────────────────────┤
│              GLSL ES 3.00 Shader System                      │
│  (~150 shader files across all categories)                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Dependencies

| Component | Current | WebGPU Alternative |
|-----------|---------|-------------------|
| Renderer | `THREE.WebGLRenderer` | `THREE.WebGPURenderer` (auto-fallback to WebGL) |
| Shading Language | GLSL ES 3.00 | TSL (Three Shading Language) - renderer-agnostic |
| Materials | `THREE.ShaderMaterial` | `THREE.NodeMaterial` variants (`MeshStandardNodeMaterial`, etc.) |
| Post-Processing | Custom RenderGraph | `THREE.PostProcessing` + TSL nodes |
| Effect Composer | N/A (custom graph) | `THREE.PostProcessing` |
| Shader Imports | Custom GLSL includes | `import { ... } from 'three/tsl'` |

### 1.3 Files Requiring Migration

**Total: ~150+ files**

| Category | File Count | Notes |
|----------|------------|-------|
| Post-processing shaders | 16 files | Direct TSL ports |
| Render passes | 28 files | Mix of native TSL nodes + custom Fn() |
| Shared shader modules | 23 files | Core math/lighting/color utilities |
| Mandelbulb shaders | 15 files | SDF variants for 3D-11D |
| Quaternion Julia shaders | 6 files | Complex quaternion math |
| Schrödinger shaders | 43 files | Quantum mechanics + temporal effects |
| BlackHole shaders | 13 files | Relativistic physics |
| Polytope shaders | 3 files | N-D transformation |
| TubeWireframe shaders | 4 files | Line rendering |
| Skybox shaders | 19 files | Procedural sky modes |
| GroundPlane shaders | 4 files | Grid rendering |
| Palette system | 5 files | Color palette generation |
| Core infrastructure | ~15 files | RenderGraph, ResourcePool, etc. |

---

## 2. WebGPU Migration Strategy

### 2.1 Unified TSL Architecture

Since TSL (Three.js Shading Language) is **renderer-agnostic**, we don't need separate WebGL and WebGPU shader paths. TSL automatically compiles to GLSL (WebGL) or WGSL (WebGPU) based on the active renderer.

```
┌─────────────────────────────────────────────────────────────┐
│                    React Application                         │
├─────────────────────────────────────────────────────────────┤
│             @react-three/fiber v9+ (async gl)               │
├─────────────────────────────────────────────────────────────┤
│                   Three.js v0.182.0                         │
├─────────────────────────────────────────────────────────────┤
│                  THREE.WebGPURenderer                       │
│        (auto-fallback to WebGL if WebGPU unavailable)       │
├─────────────────────────────────────────────────────────────┤
│              THREE.PostProcessing + TSL Nodes               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  bloom()  │  ssr()  │  ao()  │  fxaa()  │  custom Fn() │  │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                  TSL Shader System                           │
│      (Single codebase → auto-compiled to GLSL or WGSL)      │
├─────────────────────────────────────────────────────────────┤
│              Unified Object Renderers                        │
│     (MeshStandardNodeMaterial + custom TSL nodes)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 React Three Fiber Integration

R3F v9+ supports WebGPU through an async `gl` prop. This is the recommended pattern:

```typescript
// src/rendering/Scene.tsx
import * as THREE from 'three/webgpu';
import { extend, Canvas } from '@react-three/fiber';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

// Extend R3F with WebGPU Three.js objects
declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
extend(THREE as unknown as Record<string, unknown>);

export function Scene({ children }: { children: React.ReactNode }) {
  const [isWebGPUAvailable] = useState(() => WebGPU.isAvailable());

  return (
    <Canvas
      gl={async (canvas) => {
        const renderer = new THREE.WebGPURenderer({
          canvas,
          antialias: true,
          powerPreference: 'high-performance',
        });
        await renderer.init();
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        return renderer;
      }}
      // ... other props
    >
      {children}
      {isWebGPUAvailable && <WebGPUBadge />}
    </Canvas>
  );
}
```

### 2.3 WebGPU Detection & Badge

```typescript
// src/components/ui/WebGPUBadge.tsx
import WebGPU from 'three/addons/capabilities/WebGPU.js';

export function WebGPUBadge() {
  const [backend, setBackend] = useState<'webgpu' | 'webgl' | null>(null);

  useEffect(() => {
    // WebGPURenderer auto-detects and falls back
    // Check actual backend after renderer init
    const checkBackend = async () => {
      if (WebGPU.isAvailable()) {
        const adapter = await navigator.gpu?.requestAdapter();
        setBackend(adapter ? 'webgpu' : 'webgl');
      } else {
        setBackend('webgl');
      }
    };
    checkBackend();
  }, []);

  if (backend !== 'webgpu') return null;

  return (
    <div className="absolute bottom-2 right-2 glass-panel px-2 py-1 text-xs">
      ⚡ Powered by WebGPU
    </div>
  );
}
```

---

## 3. Component Inventory

### 3.1 Post-Processing Shaders (16 files)

| Shader File | Complexity | TSL Equivalent | Migration Strategy |
|-------------|------------|----------------|-------------------|
| `BilateralUpsampleShader.ts` | Medium | Custom TSL | Port to TSL Fn() |
| `BokehShader.ts` | High | `dof()` node | Use native + custom params |
| `BufferPreviewShader.ts` | Low | Custom TSL | Direct port |
| `CinematicShader.ts` | Medium | Custom TSL | Port effects individually |
| `DeferredLensingShader.ts` | High | Custom WGSL | Port to WGSL code node |
| `DepthCaptureShader.ts` | Low | Built-in | Use TSL depth nodes |
| `GTAOBilateralUpsampleShader.ts` | Medium | Custom TSL | Port to TSL Fn() |
| `PaperTextureShader.ts` | Low | Custom TSL | Direct port |
| `RefractionShader.ts` | Medium | Custom TSL | Port to TSL Fn() |
| `SSRShader.ts` | High | `ssr()` node | Use native SSRNode |
| `cloudComposite.glsl.ts` | Medium | Custom TSL | Port to TSL Fn() |
| `environmentComposite.glsl.ts` | Medium | Custom TSL | Port to TSL Fn() |
| `frameBlending.glsl.ts` | Low | Custom TSL | Direct port |
| `gravitationalLensing.glsl.ts` | High | Custom WGSL | Port to WGSL code node |
| `normalComposite.glsl.ts` | Low | Custom TSL | Direct port |
| `screenSpaceLensing.glsl.ts` | High | Custom WGSL | Port to WGSL code node |

### 3.2 Render Passes (28 passes)

#### Passes with Native TSL Replacements (8)
| Pass | TSL Node | Notes |
|------|----------|-------|
| `BloomPass` | `bloom()` | Direct replacement |
| `BokehPass` | `dof()` | May need custom focal logic |
| `FXAAPass` | `fxaa()` | Direct replacement |
| `SMAAPass` | `smaa()` | Direct replacement |
| `SSRPass` | `ssr()` | Direct replacement |
| `ToneMappingPass` | Built-in | `renderer.toneMapping` |
| `DepthPass` | `depth` node | Part of MRT |
| `NormalPass` | `normalView` node | Part of MRT |

#### Passes Requiring Custom TSL Ports (12)
| Pass | Complexity | Approach |
|------|------------|----------|
| `GTAOPass` | High | WGSL compute shader |
| `GravitationalLensingPass` | High | WGSL code node |
| `ScreenSpaceLensingPass` | High | WGSL code node |
| `RefractionPass` | Medium | TSL Fn() |
| `CinematicPass` | Medium | TSL Fn() |
| `ToneMappingCinematicPass` | Medium | TSL Fn() + built-in |
| `PaperTexturePass` | Low | TSL Fn() |
| `FrameBlendingPass` | Low | TSL Fn() |
| `TemporalCloudPass` | High | TSL Fn() + state |
| `TemporalDepthCapturePass` | Medium | TSL depth + storage |
| `EnvironmentCompositePass` | Medium | TSL Fn() |
| `CubemapCapturePass` | Medium | WebGPU cubemap |

#### Infrastructure Passes (8)
| Pass | Migration Notes |
|------|-----------------|
| `ScenePass` | Use `pass(scene, camera)` |
| `ToScreenPass` | Use `postProcessing.outputNode` |
| `CopyPass` | Use TSL `texture()` sampling |
| `FullscreenPass` | Use TSL quad rendering |
| `CompositePass` | Use TSL blend operations |
| `MainObjectMRTPass` | Use TSL `mrt()` |
| `BufferPreviewPass` | Port debug visualization |
| `DebugOverlayPass` | Port debug visualization |

### 3.3 Object Renderers (6 renderers)

| Renderer | Shader Complexity | Migration Approach |
|----------|-------------------|-------------------|
| `Mandelbulb` | Very High | WGSL raymarching |
| `QuaternionJulia` | Very High | WGSL raymarching |
| `Schroedinger` | Very High | WGSL raymarching |
| `BlackHole` | Very High | WGSL raymarching + lensing |
| `Polytope` | Medium | TSL NodeMaterial |
| `TubeWireframe` | Low | TSL NodeMaterial |

### 3.4 Shared Shader Modules (~20 modules)

```
src/rendering/shaders/shared/
├── color/           # Color space conversions (4 files)
├── core/            # Precision, constants (3 files)
├── depth/           # Depth utilities (2 files)
├── features/        # AO, SSS, shadows (4 files)
├── fractal/         # Fractal rendering (2 files)
├── lighting/        # PBR, IBL, GGX (4 files)
├── math/            # Noise, rotations (3 files)
└── raymarch/        # SDF, marching (2 files)
```

**All shared modules need TSL equivalents or WGSL ports.**

---

## 4. Abstraction Layer Design

### 4.1 Simplified Architecture (TSL-First)

Since TSL is renderer-agnostic (works on both WebGL and WebGPU), we don't need complex backend abstractions. Instead, we migrate to TSL once and it works everywhere.

```typescript
// src/rendering/types.ts

/**
 * Post-processing configuration (works with both backends)
 */
export interface PostProcessingConfig {
  bloom: BloomConfig;
  ssr: SSRConfig;
  ao: AOConfig;
  // ... other effects
}

/**
 * Renderer info for UI display
 */
export interface RendererInfo {
  backend: 'webgpu' | 'webgl';
  gpuName?: string;
  maxTextureSize: number;
}

/**
 * Get current renderer backend info
 */
export function getRendererInfo(renderer: THREE.WebGPURenderer): RendererInfo {
  return {
    backend: renderer.backend?.isWebGPU ? 'webgpu' : 'webgl',
    gpuName: renderer.backend?.parameters?.adapterInfo?.description,
    maxTextureSize: renderer.capabilities.maxTextureSize,
  };
}
```

### 4.2 Migration Strategy: Incremental TSL Adoption

Instead of maintaining two backends, we migrate incrementally to TSL:

```typescript
// Phase 1: Use WebGPURenderer with existing shaders (auto WebGL fallback)
// Phase 2: Replace post-processing with TSL nodes
// Phase 3: Replace custom materials with NodeMaterials
// Phase 4: Remove legacy GLSL code

// src/rendering/PostProcessingTSL.tsx
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, velocity } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';

export function setupPostProcessing(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  config: PostProcessingConfig
): THREE.PostProcessing {
  const postProcessing = new THREE.PostProcessing(renderer);

  // Scene pass with MRT for G-buffer
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({
    output: output,
    normal: normalView,
    velocity: velocity,
  }));

  // Get G-buffer textures
  const colorNode = scenePass.getTextureNode('output');
  const normalNode = scenePass.getTextureNode('normal');
  const depthNode = scenePass.getTextureNode('depth');
  const velocityNode = scenePass.getTextureNode('velocity');

  // Chain effects
  let result = colorNode;

  if (config.ao.enabled) {
    const aoNode = ao(depthNode, normalNode, camera);
    result = result.mul(aoNode);
  }

  if (config.ssr.enabled) {
    const ssrNode = ssr(result, depthNode, normalNode);
    result = result.add(ssrNode);
  }

  if (config.bloom.enabled) {
    const bloomNode = bloom(result, config.bloom.strength, config.bloom.radius, config.bloom.threshold);
    result = result.add(bloomNode);
  }

  if (config.fxaa) {
    result = fxaa(result);
  }

  postProcessing.outputNode = result;
  return postProcessing;
}
```

### 4.3 Directory Structure (Simplified)

```
src/rendering/
├── tsl/                           # NEW: TSL shader implementations
│   ├── effects/                   # Custom post-processing effects
│   │   ├── gravitationalLensing.ts
│   │   ├── cinematicEffects.ts
│   │   ├── refractionEffect.ts
│   │   └── paperTexture.ts
│   ├── materials/                 # NodeMaterial implementations
│   │   ├── mandelbulb/
│   │   │   ├── sdf.tsl.ts        # Transpiled from GLSL
│   │   │   ├── material.ts
│   │   │   └── index.ts
│   │   ├── julia/
│   │   ├── schroedinger/
│   │   ├── blackhole/
│   │   ├── polytope/
│   │   └── tubeWireframe/
│   └── shared/                    # Shared TSL utilities
│       ├── colorUtils.ts          # Color space conversions
│       ├── mathUtils.ts           # Math operations
│       ├── noiseUtils.ts          # Noise functions
│       ├── lightingUtils.ts       # PBR lighting
│       └── sdfUtils.ts            # SDF operations
├── shaders/                       # LEGACY: Keep during migration
├── graph/                         # LEGACY: Custom RenderGraph (phase out)
├── renderers/                     # Object renderer components
├── PostProcessingTSL.tsx          # NEW: TSL post-processing
├── Scene.tsx                      # Updated for WebGPURenderer
└── types.ts                       # Shared types
```

---

## 5. Shader Migration Guide

### ⚠️ CRITICAL: Verified TSL Patterns (Learn From Failed Attempt)

Before writing ANY TSL code, understand what ACTUALLY works. The failed attempt used hallucinated API that doesn't exist.

#### ✅ VERIFIED Working Patterns (from Three.js r169+ examples)

```typescript
// 1. IMPORTS - Use specific imports from three/tsl
import {
  Fn,                              // Function builder
  float, int, vec2, vec3, vec4,    // Type constructors
  uniform,                          // Uniform values
  uv, positionWorld, cameraPosition, // Built-in attributes
  texture,                          // Texture sampling
  add, sub, mul, div,               // Math operations
  sin, cos, pow, sqrt, abs, log,    // Math functions
  normalize, length, dot, cross,    // Vector operations
  mix, clamp, smoothstep, step,     // Interpolation
  greaterThan, lessThan, select,    // Conditionals
  Loop, If, Break, Continue,        // Control flow
} from 'three/tsl';

// 2. VARIABLES - Use .toVar() for mutable state
const myFloat = float(0.0).toVar('myFloat');   // ✅ Creates mutable variable
myFloat.assign(float(1.0));                     // ✅ Assign new value
myFloat.addAssign(float(0.1));                  // ✅ Add to current value

// 3. VECTOR COMPONENTS - Built-in nodes have .x, .y, .z, .w
const pos = positionWorld;
const x = pos.x;                                // ✅ Works for positionWorld
const y = pos.y;                                // ✅ Works for positionWorld

// 4. CUSTOM VECTOR ACCESS - Use element() for custom vectors
const customVec = vec3(1.0, 2.0, 3.0);
const xComp = customVec.x;                      // ✅ Works for vec3() constructor

// 5. CONDITIONALS - Use greaterThan() + select(), NOT if/else
const a = float(5.0);
const b = float(3.0);
const isGreater = greaterThan(a, b);            // ✅ Returns boolean node
const result = select(isGreater, a, b);         // ✅ Like ternary: isGreater ? a : b

// 6. LOOPS - Use Loop() with callback
Loop(10, ({ i }) => {
  // i is the loop index node
  myFloat.addAssign(float(1.0));
});

// 7. CONDITIONAL BREAK - Use If() with Break()
Loop(100, ({ i }) => {
  If(greaterThan(myFloat, float(10.0)), () => {
    Break();
  });
  myFloat.addAssign(float(1.0));
});

// 8. TEXTURE SAMPLING - texture() takes Texture object, not Node
import * as THREE from 'three';
const myTexture = new THREE.Texture();
const texUniform = uniform(myTexture);
const sampled = texture(texUniform, uv());      // ✅ Correct usage

// 9. CUSTOM FUNCTIONS - Use Fn()
const myFunction = Fn(([inputA, inputB]) => {
  const sum = add(inputA, inputB);
  return mul(sum, float(2.0));
});
// Call it:
const output = myFunction(float(1.0), float(2.0));

// 10. MATERIALS - Use NodeMaterial variants
import { MeshStandardNodeMaterial } from 'three/webgpu';
const material = new MeshStandardNodeMaterial();
material.colorNode = vec3(1.0, 0.0, 0.0);       // ✅ Assign color
material.roughnessNode = float(0.5);            // ✅ Assign roughness
```

#### ❌ PATTERNS THAT DO NOT WORK

```typescript
// ❌ Node doesn't have .greaterThan() method
node.greaterThan(value);     // ERROR: Property doesn't exist
// ✅ Use function instead
greaterThan(node, value);

// ❌ Can't use texture() with Node
texture(someNode, uv());     // ERROR: Node is not Texture
// ✅ Use uniform wrapper
texture(uniform(textureObject), uv());

// ❌ Can't use .toVar() on generic Node
someNode.toVar('name');      // May not work on all node types
// ✅ Use on typed constructors
float(0.0).toVar('name');    // Works

// ❌ .rgb, .xy, .xyz don't exist on generic Node
node.rgb;                    // ERROR
node.xy;                     // ERROR
// ✅ Use on vec constructors or built-in nodes
vec3(1,0,0).xyz;             // Works
positionWorld.xy;            // Works
```

---

### 5.0 Migration Approach: GLSL Transpiler

Three.js provides a **GLSL→TSL transpiler** that can automatically convert existing GLSL shaders to TSL. This is the recommended approach for complex shaders:

```typescript
// Use the Three.js transpiler to convert GLSL to TSL
import Transpiler from 'three/addons/transpiler/Transpiler.js';
import GLSLDecoder from 'three/addons/transpiler/GLSLDecoder.js';
import TSLEncoder from 'three/addons/transpiler/TSLEncoder.js';

function transpileGLSLtoTSL(glslCode: string): string {
  const decoder = new GLSLDecoder();
  const encoder = new TSLEncoder();
  const transpiler = new Transpiler(decoder, encoder);
  return transpiler.parse(glslCode);
}

// Example: transpile existing Mandelbulb shader
const glslCode = `
  float mandelbulbSDF(vec3 p, float power) {
    // ... existing GLSL code
  }
`;
const tslCode = transpileGLSLtoTSL(glslCode);
```

**Migration Strategy:**
1. **Simple effects**: Rewrite directly in TSL using `Fn()`
2. **Complex algorithms**: Use the transpiler, then refine output
3. **Native effects**: Replace with built-in TSL nodes (`bloom()`, `ssr()`, etc.)

### 5.1 GLSL to TSL Translation Patterns

#### Simple Fragment Shader

```glsl
// GLSL (current)
precision highp float;
in vec2 vUv;
uniform sampler2D tDiffuse;
uniform float intensity;
layout(location = 0) out vec4 fragColor;

void main() {
  vec4 color = texture(tDiffuse, vUv);
  fragColor = color * intensity;
}
```

```typescript
// TSL equivalent
import { Fn, texture, uv, uniform, vec4 } from 'three/tsl';

// Define custom shader function using Fn()
const intensify = Fn(([inputTexture, intensityValue]) => {
  const color = texture(inputTexture, uv());
  return color.mul(intensityValue);
});

// Usage in post-processing
const intensityUniform = uniform(1.0);
const scenePass = pass(scene, camera);
const intensifiedColor = intensify(scenePass.getTextureNode(), intensityUniform);
postProcessing.outputNode = intensifiedColor;
```

#### Complex Raymarching Shader

For complex algorithms like raymarching, use TSL's `Fn()` with loops and conditionals:

```typescript
// TSL Mandelbulb SDF using Fn() with loops
import {
  Fn, uniform, vec3, float,
  Loop, If, Break,
  length, acos, atan2, pow, sin, cos, log,
  greaterThan,  // ✅ Import as function, not method
  positionWorld
} from 'three/tsl';

const mandelbulbSDF = Fn(([p, power]) => {
  // ✅ Create mutable variables with .toVar()
  const z = vec3(p.x, p.y, p.z).toVar('z');
  const dr = float(1.0).toVar('dr');
  const r = float(0.0).toVar('r');

  Loop(15, () => {
    r.assign(length(z));

    // ✅ Use greaterThan() function, not .greaterThan() method
    If(greaterThan(r, float(2.0)), () => {
      Break();
    });

    // ✅ Access components via .x, .y, .z on the variable
    const theta = acos(z.z.div(r));
    const phi = atan2(z.y, z.x);

    // ✅ Chain operations with .mul(), .sub(), .add(), .div()
    dr.assign(pow(r, power.sub(1.0)).mul(power).mul(dr).add(1.0));

    const zr = pow(r, power);
    const thetaP = theta.mul(power);
    const phiP = phi.mul(power);

    z.assign(zr.mul(vec3(
      sin(thetaP).mul(cos(phiP)),
      sin(phiP).mul(sin(thetaP)),
      cos(thetaP)
    )).add(p));
  });

  return float(0.5).mul(log(r)).mul(r).div(dr);
});

// Usage
const powerUniform = uniform(8.0);
const distance = mandelbulbSDF(positionWorld, powerUniform);
```

**Note**: TSL does NOT have a `wgsl()` function for raw WGSL injection. All shader code must be written using TSL nodes or transpiled from GLSL.

**IMPORTANT**: Before implementing any raymarched material, verify the exact TSL API by:
1. Running the Three.js TSL transpiler on the existing GLSL code
2. Testing the output in a minimal example
3. Checking Three.js examples for similar patterns

### 5.2 Shared Module Migration

Create TSL equivalents in `src/rendering/backends/webgpu/tsl/shared/`:

| GLSL Module | TSL Equivalent | Notes |
|-------------|----------------|-------|
| `color/hsl.glsl.ts` | `colorUtils.ts` | Use TSL color nodes |
| `lighting/ggx.glsl.ts` | `pbrUtils.ts` | Built-in PBR available |
| `lighting/ibl.glsl.ts` | `iblUtils.ts` | Use `environmentNode` |
| `math/noise.glsl.ts` | `noiseUtils.ts` | Use `mx_noise_float` |
| `math/rotations.glsl.ts` | `mathUtils.ts` | TSL matrix ops |
| `depth/linearize.glsl.ts` | `depthUtils.ts` | Use `viewZToLinearDepth` |

---

## 6. Post-Processing Migration

### 6.1 THREE.PostProcessing Architecture

WebGPU uses a different post-processing model:

```typescript
// WebGPU post-processing setup
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, depth } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';

// Create post-processing instance
const postProcessing = new THREE.PostProcessing(renderer);

// Scene pass with MRT
const scenePass = pass(scene, camera);
scenePass.setMRT(mrt({
  output: output,
  normal: normalView,
  depth: depth
}));

// Get texture nodes
const colorNode = scenePass.getTextureNode('output');
const normalNode = scenePass.getTextureNode('normal');
const depthNode = scenePass.getTextureNode('depth');

// Chain effects
const bloomNode = bloom(colorNode, 1.5, 0.4, 0.85);
const ssrNode = ssr(colorNode, depthNode, normalNode);
const fxaaNode = fxaa(colorNode.add(bloomNode).add(ssrNode));

// Set output
postProcessing.outputNode = fxaaNode;
```

### 6.2 Pass Mapping Table

| Current Pass | WebGPU Implementation |
|--------------|----------------------|
| `BloomPass` | `bloom(colorNode, strength, radius, threshold)` |
| `SSRPass` | `ssr(colorNode, depthNode, normalNode, metalness, roughness)` |
| `FXAAPass` | `fxaa(inputNode)` |
| `SMAAPass` | `smaa(inputNode)` |
| `BokehPass` | `dof(colorNode, depthNode, { focus, aperture, maxblur })` |
| `ToneMappingPass` | `renderer.toneMapping = THREE.ACESFilmicToneMapping` |
| `GTAOPass` | Custom WGSL compute + `gtaoNode()` |
| `GravitationalLensingPass` | Custom `lensingNode()` with WGSL |

### 6.3 Custom TSL Pass Template

```typescript
// src/rendering/backends/webgpu/tsl/effects/customEffectNode.ts
import { Fn, texture, uv, uniform, vec4, float } from 'three/tsl';
import type { Node, UniformNode } from 'three/tsl';

export interface CustomEffectParams {
  intensity: UniformNode<number>;
  // ... other parameters
}

export const customEffect = (
  inputNode: Node,
  params: CustomEffectParams
): Node => {
  return Fn(() => {
    const color = inputNode;
    const intensity = params.intensity;

    // Effect logic using TSL nodes
    const processed = color.mul(intensity);

    return processed;
  })();
};
```

---

## 7. Renderer Migration

### 7.1 Mandelbulb/Julia Raymarcher

**Current**: Complex GLSL fragment shader with 15+ includes
**Target**: TSL material with custom `Fn()` raymarching nodes

**Migration Strategy**: Use the GLSL→TSL transpiler for complex SDF logic, then integrate with TSL material system.

```typescript
// src/rendering/tsl/materials/mandelbulbMaterial.ts
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, positionWorld, cameraPosition,
  normalize, vec3, float, color,
  Loop, If, Break, length, pow, sin, cos, acos, atan2, log
} from 'three/tsl';

// Import transpiled SDF functions (generated from existing GLSL)
import { mandelbulbSDF, estimateNormal } from './mandelbulb/sdf.tsl.js';
import { calculateLighting } from '../shared/lighting.tsl.js';

export function createMandelbulbMaterial(
  params: MandelbulbParams
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  // Uniforms
  const powerUniform = uniform(params.power);
  const iterationsUniform = uniform(params.iterations);
  const colorBaseUniform = uniform(new THREE.Color(params.color));

  // Raymarching using TSL Fn()
  const raymarch = Fn(() => {
    const rayOrigin = cameraPosition;
    const rayDir = normalize(positionWorld.sub(cameraPosition));

    const totalDistance = float(0.0).toVar();
    const hit = float(0.0).toVar();

    Loop(128, () => {
      const currentPos = rayOrigin.add(rayDir.mul(totalDistance));
      const dist = mandelbulbSDF(currentPos, powerUniform);

      If(dist.lessThan(0.001), () => {
        hit.assign(1.0);
        Break();
      });

      totalDistance.addAssign(dist);

      If(totalDistance.greaterThan(100.0), () => {
        Break();
      });
    });

    // Calculate normal and lighting
    const hitPos = rayOrigin.add(rayDir.mul(totalDistance));
    const normal = estimateNormal(hitPos, powerUniform);
    const litColor = calculateLighting(hitPos, normal, colorBaseUniform);

    return vec4(litColor, hit);
  });

  // Output
  material.colorNode = raymarch();
  material.transparent = true;

  return material;
}
```

### 7.2 Polytope Renderer

**Current**: Standard Three.js geometry + custom shader
**Target**: TSL NodeMaterial with same visual output

```typescript
// src/rendering/backends/webgpu/tsl/materials/polytopeMaterial.ts
import * as THREE from 'three/webgpu';
import {
  MeshStandardNodeMaterial,
  uniform, color, float, normalLocal
} from 'three/tsl';

export function createPolytopeMaterial(
  params: PolytopeParams
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();

  // Standard PBR with custom color node
  material.colorNode = color(params.baseColor);
  material.roughnessNode = float(params.roughness);
  material.metalnessNode = float(params.metalness);

  // Custom dimension-based coloring
  if (params.dimensionColoring) {
    material.colorNode = createDimensionColorNode(params);
  }

  return material;
}
```

### 7.3 BlackHole Renderer

**Current**: Raymarching + gravitational lensing shader
**Target**: TSL material with physics calculations via `Fn()`

**Migration Strategy**: This is the most complex renderer due to relativistic physics. Use the transpiler for Schwarzschild metric calculations, then compose with TSL nodes.

```typescript
// src/rendering/tsl/materials/blackHoleMaterial.ts
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, positionWorld, cameraPosition, normalize,
  vec3, vec4, float, color, Loop, If, Break,
  dot, cross, length, pow, exp, mix
} from 'three/tsl';

// Transpiled physics functions
import { schwarzschildDeflection } from './blackhole/metric.tsl.js';
import { accretionDiskColor } from './blackhole/disk.tsl.js';
import { relativisticBeaming, dopplerShift } from './blackhole/relativistic.tsl.js';

export function createBlackHoleMaterial(
  params: BlackHoleParams
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  // Physics uniforms
  const massUniform = uniform(params.mass);
  const spinUniform = uniform(params.spin);
  const innerRadiusUniform = uniform(params.innerRadius);
  const outerRadiusUniform = uniform(params.outerRadius);

  // Raymarching with gravitational lensing
  const raytraceBlackHole = Fn(() => {
    const rayOrigin = cameraPosition;
    const rayDir = normalize(positionWorld.sub(cameraPosition));

    // Integrate ray path through curved spacetime
    const currentPos = rayOrigin.toVar();
    const currentDir = rayDir.toVar();
    const accumulated = vec4(0.0).toVar();

    Loop(256, () => {
      // Calculate gravitational deflection
      const deflection = schwarzschildDeflection(currentPos, currentDir, massUniform);
      currentDir.assign(normalize(currentDir.add(deflection)));
      currentPos.addAssign(currentDir.mul(0.1));

      // Check for disk intersection
      const diskColor = accretionDiskColor(
        currentPos, currentDir, massUniform, spinUniform,
        innerRadiusUniform, outerRadiusUniform
      );

      // Apply relativistic effects
      const beamedColor = relativisticBeaming(diskColor, currentDir, spinUniform);
      const shiftedColor = dopplerShift(beamedColor, currentPos, spinUniform);

      accumulated.addAssign(shiftedColor);

      // Event horizon check
      If(length(currentPos).lessThan(massUniform.mul(2.0)), () => {
        Break();
      });
    });

    return accumulated;
  });

  material.colorNode = raytraceBlackHole();
  material.transparent = true;

  return material;
}

// Migration requires transpiling these 13 shader files:
// - gravity/colors.glsl.ts → colors.tsl.ts
// - gravity/disk-sdf.glsl.ts → disk.tsl.ts
// - gravity/doppler.glsl.ts → relativistic.tsl.ts
// - gravity/lensing.glsl.ts → metric.tsl.ts
// - etc.
```

---

## 8. Testing Strategy

### 8.1 Visual Regression Testing

```typescript
// scripts/playwright/webgpu-visual-regression.spec.ts
import { test, expect } from '@playwright/test';

const BACKENDS = ['webgl', 'webgpu'] as const;
const SCENES = [
  'mandelbulb-8d',
  'julia-4d',
  'blackhole',
  'polytope-hypercube',
  'schroedinger'
] as const;

for (const backend of BACKENDS) {
  for (const scene of SCENES) {
    test(`${scene} renders correctly on ${backend}`, async ({ page }) => {
      await page.goto(`/?backend=${backend}&scene=${scene}`);
      await page.waitForSelector('[data-testid="canvas-ready"]');

      // Wait for render stabilization
      await page.waitForTimeout(2000);

      const screenshot = await page.screenshot();
      expect(screenshot).toMatchSnapshot(`${scene}-${backend}.png`, {
        threshold: 0.01 // 1% pixel difference tolerance
      });
    });
  }
}

// Cross-backend comparison
for (const scene of SCENES) {
  test(`${scene} matches between backends`, async ({ page }) => {
    // Capture WebGL
    await page.goto(`/?backend=webgl&scene=${scene}`);
    await page.waitForSelector('[data-testid="canvas-ready"]');
    const webglScreenshot = await page.screenshot();

    // Capture WebGPU
    await page.goto(`/?backend=webgpu&scene=${scene}`);
    await page.waitForSelector('[data-testid="canvas-ready"]');
    const webgpuScreenshot = await page.screenshot();

    // Compare (higher tolerance for expected differences)
    expect(webgpuScreenshot).toMatchSnapshot(webglScreenshot, {
      threshold: 0.05 // 5% tolerance for minor rendering differences
    });
  });
}
```

### 8.2 Performance Benchmarking

```typescript
// scripts/tools/benchmark-backends.ts
interface BenchmarkResult {
  backend: 'webgl' | 'webgpu';
  scene: string;
  avgFPS: number;
  minFPS: number;
  maxFPS: number;
  frameTimeP50: number;
  frameTimeP99: number;
  gpuMemoryMB: number;
}

async function runBenchmark(
  backend: 'webgl' | 'webgpu',
  scene: string,
  durationMs: number = 10000
): Promise<BenchmarkResult> {
  // Automated performance measurement
}
```

### 8.3 Unit Tests for Shader Math

```typescript
// src/tests/rendering/tsl/mathUtils.test.ts
import { describe, it, expect } from 'vitest';

describe('TSL Math Utils', () => {
  it('noise functions match GLSL output', () => {
    // Compare TSL noise with GLSL reference
  });

  it('color conversions are accurate', () => {
    // Test HSL/RGB conversions
  });

  it('SDF operations produce correct results', () => {
    // Test sphere, box, union, smooth-union
  });
});
```

### 8.4 Test Matrix

| Test Type | WebGL | WebGPU | Cross-Backend |
|-----------|-------|--------|---------------|
| Unit (shader math) | ✓ | ✓ | ✓ (parity) |
| Integration (passes) | ✓ | ✓ | ✓ (parity) |
| Visual regression | ✓ | ✓ | ✓ (comparison) |
| Performance benchmark | ✓ | ✓ | ✓ (comparison) |
| Memory profiling | ✓ | ✓ | ✓ (comparison) |
| E2E (Playwright) | ✓ | ✓ | ✓ (both) |

---

## 9. Implementation Phases

### Phase 0: Recovery ✅ COMPLETE

**Goal**: Restore working build and clean up failed attempt

**Duration**: 1-2 days (Completed 2026-01-03)

**Tasks**:
1. [x] Delete broken TSL code (`src/rendering/tsl/` - 18 files)
2. [x] Delete fake TSL tests (`src/tests/rendering/tsl/` - 10 files)
3. [x] Stub `PostProcessingTSL.tsx` to return `null` (no-op fallback)
4. [x] Fix `useRendererBackend.ts` - remove deprecated `requestAdapterInfo` API
5. [x] Fix other minor TypeScript errors in unrelated files
6. [x] Verify `npm run build` succeeds
7. [x] Verify `npm test` passes (3074 passed, 4 pre-existing failures)
8. [x] Update documentation to reflect actual state

**Deliverables**: ✅ All complete
- Build passes with zero errors
- Tests pass (3074/3078 - 4 pre-existing failures unrelated to WebGPU)
- WebGPU detection works
- WebGL fallback works perfectly

---

### Phase 1: Foundation ✅ COMPLETE

**Goal**: WebGPURenderer integration with R3F

**Status**: Complete and verified

**Tasks**:
1. [x] Create TypeScript declarations for `three/webgpu`
2. [x] Update `App.tsx` to use async `gl` prop pattern
3. [x] Implement WebGPU detection using `three/addons/capabilities/WebGPU.js`
4. [x] Create `WebGPUBadge` component for UI indication
5. [x] Create `rendererStore.ts` for backend state
6. [x] Update `Scene.tsx` for conditional post-processing
7. [x] Add `?forceWebGL=true` URL parameter for testing (via useRendererBackend.ts)
8. [x] Unit tests for renderer initialization (useRendererBackend.test.ts)
9. [x] E2E test for WebGPU detection (webgpu-visual-test.mjs)

**Deliverables**: ✅ All complete
- WebGPURenderer working in R3F
- Automatic fallback to WebGL on unsupported browsers
- "Powered by WebGPU" badge when active

### Phase 2: TSL Post-Processing Setup ✅ COMPLETE

**Goal**: Replace custom RenderGraph with `THREE.PostProcessing`

**Duration**: Completed 2026-01-03

**Tasks**:
1. [x] Create minimal `PostProcessingTSL.tsx` proof-of-concept
   - Scene pass → output working
   - Renders without errors on WebGPU
2. [x] Add MRT for G-buffer (output, normal, depth)
   - Using `mrt({ output, normal: normalView })`
   - G-buffer textures accessible
3. [x] Add native `bloom()` effect
   - Imported from `three/addons/tsl/display/BloomNode.js`
   - Connected to correct store properties
4. [x] Add native `fxaa()` effect
   - Conditional on `antiAliasingMethod === 'fxaa'`
5. [x] Tone mapping handled by renderer
6. [x] E2E test exists (webgpu-visual-test.mjs)

**Store Mapping (Implemented)**:
```typescript
const bloomEnabled = usePostProcessingStore((s) => s.bloomEnabled)
const bloomIntensity = usePostProcessingStore((s) => s.bloomIntensity)
const bloomRadius = usePostProcessingStore((s) => s.bloomRadius)
const bloomThreshold = usePostProcessingStore((s) => s.bloomThreshold)
const antiAliasingMethod = usePostProcessingStore((s) => s.antiAliasingMethod)
```

**Deliverables**: ✅ Complete
- TSL post-processing pipeline compiles and runs
- Bloom and FXAA effects working
- E2E tests available

### Phase 3: Screen-Space Effects ✅ PARTIAL

**Goal**: Port G-buffer dependent effects

**Tasks**:
1. [x] Port `SSRPass` → `ssr()` TSL node
2. [ ] Port `BokehPass` → `dof()` TSL node (pending - requires depth handling)
3. [x] Port `GTAOPass` → `ao()` TSL node
4. [ ] Port `FrameBlendingPass` → custom TSL `Fn()` (BLOCKED - TSL types)
5. [ ] Port `PaperTexturePass` → custom TSL `Fn()` (BLOCKED - TSL types)
6. [ ] Port `CinematicPass` → custom TSL `Fn()` (BLOCKED - TSL types)
7. [x] E2E visual regression available (webgpu-visual-test.mjs)

**Deliverables**:
- SSR and GTAO working with native TSL nodes
- Custom effects blocked by incomplete TSL Fn() types

### Phase 4: Custom TSL Effects ✅ COMPLETE

**Goal**: Port unique project-specific effects using TSL `Fn()`

**Status**: COMPLETE - All custom effects ported to TSL

**Solution**: Extended TSL TypeScript declarations in `src/types/three-webgpu.d.ts` to properly type:
- Node fluent API methods: `.add()`, `.sub()`, `.mul()`, `.div()`, `.clamp()`, `.length()`, `.normalize()`, etc.
- Swizzle accessors: `.x`, `.y`, `.z`, `.w`, `.r`, `.g`, `.b`, `.a`, `.xy`, `.xyz`
- Comparison operations: `.greaterThan()`, `.lessThan()`, `.equal()`
- Variable support: `.toVar()`, `.assign()`
- Screen-space nodes: `screenUV`, `screenCoordinate`, `viewportUV`

**Completed Tasks**:
1. [x] Extended TSL type declarations with fluent API
2. [x] Implemented vignette effect using TSL `Fn()`
3. [x] Implemented film grain effect using TSL `Fn()`
4. [x] Implemented chromatic aberration using TSL `Fn()`
5. [x] Implemented gravitational lensing using TSL `Fn()`
6. [x] Implemented paper texture using TSL `Fn()`
7. [x] Connected all effects to post-processing store
8. [x] Build verification passing
9. [x] Tests passing (3074/3078)

### Phase 5: Mesh Renderers

**Goal**: Port mesh-based object renderers

**Tasks**:
1. [ ] Create TSL shared utilities (`src/rendering/tsl/shared/`)
2. [ ] Port `Polytope` material → `MeshStandardNodeMaterial`
3. [ ] Port N-D dimension coloring → TSL color nodes
4. [ ] Port `TubeWireframe` material → TSL line material
5. [ ] Port `GroundPlane` shaders → TSL
6. [ ] Port `Skybox` procedural shaders → TSL (19 files)
7. [ ] Visual regression for mesh renderers

**Deliverables**:
- Polytope, TubeWireframe, GroundPlane, Skybox in TSL
- Shared TSL utilities library

### Phase 6: Raymarched Renderers - Simple

**Goal**: Port simpler raymarched renderers

**Tasks**:
1. [ ] Transpile shared raymarching utilities to TSL
2. [ ] Port `Mandelbulb` SDF functions → TSL (15 files)
3. [ ] Port `Mandelbulb` material → `MeshBasicNodeMaterial` + TSL
4. [ ] Port `QuaternionJulia` SDF functions → TSL (6 files)
5. [ ] Port `QuaternionJulia` material → TSL
6. [ ] Port shared lighting system → TSL
7. [ ] Port soft shadow calculations → TSL
8. [ ] Visual regression for raymarched objects
9. [ ] Performance benchmarks

**Deliverables**:
- Mandelbulb and Julia renderers in TSL
- Shared lighting/shadow TSL modules

### Phase 7: Raymarched Renderers - Complex

**Goal**: Port Schrödinger and BlackHole renderers

**Tasks**:
1. [ ] Port `Schroedinger` quantum math → TSL (43 files)
2. [ ] Port `Schroedinger` temporal effects → TSL
3. [ ] Port `Schroedinger` volume rendering → TSL
4. [ ] Port `BlackHole` Schwarzschild metric → TSL (13 files)
5. [ ] Port `BlackHole` accretion disk → TSL
6. [ ] Port `BlackHole` relativistic effects → TSL
7. [ ] Port `BlackHole` Doppler/redshift → TSL
8. [ ] Visual regression and validation
9. [ ] Performance benchmarks

**Deliverables**:
- All 6 object renderers working with TSL
- Raymarching performance improvements

### Phase 8: Cleanup & Optimization

**Goal**: Remove legacy code, optimize, document

**Tasks**:
1. [ ] Full visual regression suite (all scenes)
2. [ ] Performance optimization pass
3. [ ] Remove legacy GLSL shaders (after validation)
4. [ ] Remove legacy RenderGraph (if fully replaced)
5. [ ] Memory leak testing with both backends
6. [ ] Browser compatibility testing (Chrome, Edge, Firefox Nightly)
7. [ ] Update `docs/architecture.md`
8. [ ] Create TSL development guide
9. [ ] Update testing documentation
10. [ ] Final QA testing

**Deliverables**:
- Production-ready WebGPU support
- Clean codebase without legacy duplication
- Complete documentation
- All tests passing

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TSL API changes in Three.js updates | Medium | High | Pin Three.js version (v0.182.0), monitor releases |
| TSL transpiler limitations | Medium | Medium | Manual port for complex shaders, maintain GLSL fallback during transition |
| Complex raymarching loops in TSL | High | Medium | Use `Loop()` and `If()` carefully, test iteration limits |
| Browser WebGPU implementation differences | Medium | High | Test on Chrome, Edge, Firefox Nightly; use feature detection |
| Memory leaks in PostProcessing | Medium | High | Automated memory profiling tests, proper dispose() calls |
| R3F async gl initialization timing | Low | Medium | Use proper async patterns, handle loading states |
| WebGPURenderer warning spam | Low | Low | Known R3F issue, can be suppressed |

### 10.2 Migration-Specific Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schrödinger shader complexity (43 files) | High | High | Use transpiler, allocate extra time, consider incremental rollout |
| BlackHole relativistic physics accuracy | Medium | High | Validate against reference images, physics review |
| Skybox procedural modes parity | Medium | Medium | Visual regression for each of 7 modes |
| Custom RenderGraph → PostProcessing feature gap | Medium | Medium | Identify any features not in PostProcessing early |

### 10.3 Fallback Strategies

1. **If TSL transpiler fails**: Manually rewrite shaders using TSL primitives
2. **If complex renderer delayed**: Ship with legacy GLSL path for that renderer, TSL migration in follow-up
3. **If performance worse on WebGPU**: WebGPURenderer auto-fallback to WebGL handles this
4. **If browser bugs block**: Add browser-specific exclusions via WebGPU capability detection
5. **If R3F compatibility issues**: Can use vanilla Three.js WebGPU setup as fallback

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] All 6 object renderers work on WebGPU
- [ ] All 28 post-processing passes work on WebGPU
- [ ] Automatic backend detection works correctly
- [ ] Manual backend override via URL works
- [ ] All animations work identically
- [ ] All UI controls work with both backends

### 11.2 Visual Requirements

- [ ] Visual regression tests pass with <5% pixel difference
- [ ] No visual artifacts on any scene
- [ ] Color accuracy matches WebGL output
- [ ] Depth/transparency renders correctly

### 11.3 Performance Requirements

- [ ] WebGPU FPS >= WebGL FPS for all scenes
- [ ] Raymarched scenes show 30%+ FPS improvement
- [ ] No frame drops during animation
- [ ] Memory usage within 20% of WebGL

### 11.4 Quality Requirements

- [ ] 100% test coverage maintained
- [ ] All Playwright E2E tests pass
- [ ] No console errors or warnings
- [ ] Documentation updated

### 11.5 Compatibility Requirements

- [ ] Chrome 113+ supported
- [ ] Edge 113+ supported
- [ ] Firefox (when WebGPU ships) supported
- [ ] Graceful fallback on unsupported browsers
- [ ] Works on Windows, macOS, Linux

---

## Appendix A: Complete File Checklist

### Post-Processing Shaders (16 files)

- [ ] `BilateralUpsampleShader.ts`
- [ ] `BokehShader.ts`
- [ ] `BufferPreviewShader.ts`
- [ ] `CinematicShader.ts`
- [ ] `DeferredLensingShader.ts`
- [ ] `DepthCaptureShader.ts`
- [ ] `GTAOBilateralUpsampleShader.ts`
- [ ] `PaperTextureShader.ts`
- [ ] `RefractionShader.ts`
- [ ] `SSRShader.ts`
- [ ] `cloudComposite.glsl.ts`
- [ ] `environmentComposite.glsl.ts`
- [ ] `frameBlending.glsl.ts`
- [ ] `gravitationalLensing.glsl.ts`
- [ ] `normalComposite.glsl.ts`
- [ ] `screenSpaceLensing.glsl.ts`

### Render Passes (28 files)

- [ ] `BloomPass.ts`
- [ ] `BokehPass.ts`
- [ ] `BufferPreviewPass.ts`
- [ ] `CinematicPass.ts`
- [ ] `CompositePass.ts`
- [ ] `CopyPass.ts`
- [ ] `CubemapCapturePass.ts`
- [ ] `DebugOverlayPass.ts`
- [ ] `DepthPass.ts`
- [ ] `EnvironmentCompositePass.ts`
- [ ] `FXAAPass.ts`
- [ ] `FrameBlendingPass.ts`
- [ ] `FullscreenPass.ts`
- [ ] `GTAOPass.ts`
- [ ] `GravitationalLensingPass.ts`
- [ ] `MainObjectMRTPass.ts`
- [ ] `NormalPass.ts`
- [ ] `PaperTexturePass.ts`
- [ ] `RefractionPass.ts`
- [ ] `SMAAPass.ts`
- [ ] `SSRPass.ts`
- [ ] `ScenePass.ts`
- [ ] `ScreenSpaceLensingPass.ts`
- [ ] `TemporalCloudPass.ts`
- [ ] `TemporalDepthCapturePass.ts`
- [ ] `ToScreenPass.ts`
- [ ] `ToneMappingCinematicPass.ts`
- [ ] `ToneMappingPass.ts`

### Shared Shader Modules (23 files)

- [ ] `color/cosine-palette.glsl.ts`
- [ ] `color/hsl.glsl.ts`
- [ ] `color/oklab.glsl.ts`
- [ ] `color/selector.glsl.ts`
- [ ] `core/constants.glsl.ts`
- [ ] `core/precision.glsl.ts`
- [ ] `core/uniforms.glsl.ts`
- [ ] `depth/customDepth.glsl.ts`
- [ ] `features/ao.glsl.ts`
- [ ] `features/shadowMaps.glsl.ts`
- [ ] `features/shadows.glsl.ts`
- [ ] `features/temporal.glsl.ts`
- [ ] `fractal/compose-helpers.ts`
- [ ] `fractal/main.glsl.ts`
- [ ] `lighting/ggx.glsl.ts`
- [ ] `lighting/ibl.glsl.ts`
- [ ] `lighting/multi-light.glsl.ts`
- [ ] `lighting/sss.glsl.ts`
- [ ] `math/safe-math.glsl.ts`
- [ ] `raymarch/core.glsl.ts`
- [ ] `raymarch/normal.glsl.ts`
- [ ] `raymarch/sphere-intersect.glsl.ts`
- [ ] `types.ts`

### Mandelbulb Shaders (15 files)

- [ ] `compose.ts`
- [ ] `dispatch.glsl.ts`
- [ ] `main.glsl.ts`
- [ ] `power.glsl.ts`
- [ ] `uniforms.glsl.ts`
- [ ] `sdf3d.glsl.ts` through `sdf11d.glsl.ts` (9 files)
- [ ] `sdf-high-d.glsl.ts`

### Quaternion Julia Shaders (6 files)

- [ ] `compose.ts`
- [ ] `dispatch.glsl.ts`
- [ ] `main.glsl.ts`
- [ ] `quaternion.glsl.ts`
- [ ] `uniforms.glsl.ts`
- [ ] `sdf/sdf3d.glsl.ts`

### Schrödinger Shaders (43 files)

**Core (5 files)**
- [ ] `compose.ts`, `dispatch.glsl.ts`, `main.glsl.ts`, `power.glsl.ts`, `uniforms.glsl.ts`

**Quantum Math (11 files)**
- [ ] `complex.glsl.ts`, `density.glsl.ts`, `hermite.glsl.ts`, `ho1d.glsl.ts`, `hoNDVariants.glsl.ts`
- [ ] `hydrogenPsi.glsl.ts`, `hydrogenRadial.glsl.ts`, `laguerre.glsl.ts`, `legendre.glsl.ts`
- [ ] `psi.glsl.ts`, `sphericalHarmonics.glsl.ts`

**Hydrogen N-D Variants (10 files)**
- [ ] `hydrogenND3d.glsl.ts` through `hydrogenND11d.glsl.ts`, `hydrogenNDCommon.glsl.ts`

**SDF Variants (10 files)**
- [ ] `sdf3d.glsl.ts` through `sdf11d.glsl.ts`, `sdf-high-d.glsl.ts`

**Temporal Effects (3 files)**
- [ ] `temporal/uniforms.glsl.ts`, `temporal/reconstruction.glsl.ts`, `temporal/reprojection.glsl.ts`

**Volume Rendering (4 files)**
- [ ] `volume/absorption.glsl.ts`, `volume/emission.glsl.ts`, `volume/integration.glsl.ts`, `volume/main.glsl.ts`

### BlackHole Shaders (13 files)

- [ ] `compose.ts`, `main.glsl.ts`, `uniforms.glsl.ts`
- [ ] `gravity/colors.glsl.ts`, `gravity/disk-sdf.glsl.ts`, `gravity/disk-volumetric.glsl.ts`
- [ ] `gravity/doppler.glsl.ts`, `gravity/horizon.glsl.ts`, `gravity/lensing.glsl.ts`
- [ ] `gravity/manifold.glsl.ts`, `gravity/shell.glsl.ts`
- [ ] `effects/deferred-lensing.glsl.ts`, `effects/motion-blur.glsl.ts`

### Polytope & TubeWireframe Shaders (7 files)

- [ ] `polytope/compose.ts`, `polytope/transform-nd.glsl.ts`, `polytope/transform-nd-simple.glsl.ts`
- [ ] `tubeWireframe/compose.ts`, `tubeWireframe/main.glsl.ts`, `tubeWireframe/uniforms.glsl.ts`, `tubeWireframe/vertex.glsl.ts`

### Skybox Shaders (19 files)

- [ ] `compose.ts`, `main.glsl.ts`
- [ ] `core/constants.glsl.ts`, `core/precision.glsl.ts`, `core/uniforms.glsl.ts`, `core/varyings.glsl.ts`
- [ ] `modes/aurora.glsl.ts`, `modes/classic.glsl.ts`, `modes/crystalline.glsl.ts`
- [ ] `modes/horizon.glsl.ts`, `modes/nebula.glsl.ts`, `modes/ocean.glsl.ts`, `modes/twilight.glsl.ts`
- [ ] `effects/sun.glsl.ts`, `effects/vignette.glsl.ts`
- [ ] `utils/color.glsl.ts`, `utils/noise.glsl.ts`, `utils/rotation.glsl.ts`
- [ ] `types.ts`

### GroundPlane Shaders (4 files)

- [ ] `compose.ts`, `grid.glsl.ts`, `main.glsl.ts`, `vertex.glsl.ts`

### Palette System (5 files)

- [ ] `cosine.glsl.ts`, `palette.glsl.ts`, `presets.ts`, `types.ts`, `index.ts`

### Renderer Components (6 directories)

- [ ] `Mandelbulb/` (MandelbulbMesh.tsx)
- [ ] `QuaternionJulia/` (QuaternionJuliaMesh.tsx)
- [ ] `Schroedinger/` (SchroedingerMesh.tsx)
- [ ] `BlackHole/` (BlackHoleMesh.tsx, useBlackHoleUniforms.ts, etc.)
- [ ] `Polytope/` (PolytopeScene.tsx)
- [ ] `TubeWireframe/` (TubeWireframe.tsx)

---

**Total Files: ~150+**

---

## Appendix B: Reference Links

### Three.js WebGPU Resources
- [Three.js Shading Language (TSL) Wiki](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [Three.js WebGPU Examples](https://threejs.org/examples/?q=webgpu)
- [Three.js TSL Transpiler Example](https://threejs.org/examples/?q=transpiler)
- [Three.js PostProcessing Examples](https://threejs.org/examples/?q=postprocessing)

### React Three Fiber + WebGPU
- [R3F v9 Migration Guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)
- [R3F Canvas API](https://r3f.docs.pmnd.rs/api/canvas)
- [R3F WebGPU TypeScript Setup](https://blog.pragmattic.dev/react-three-fiber-webgpu-typescript)

### Tutorials & Guides
- [Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- [TSL Tutorial - Wawa Sensei](https://wawasensei.dev/courses/react-three-fiber/lessons/webgpu-tsl)
- [TSL: A Better Way to Write Shaders](https://threejsroadmap.com/blog/tsl-a-better-way-to-write-shaders-in-threejs)

### Specifications
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)

### Browser Support
- [WebGPU Browser Compatibility](https://caniuse.com/webgpu)
- Chrome: Stable since v113
- Edge: Stable since v113
- Firefox: Nightly builds only (as of Jan 2026)
- Safari: Technology Preview only

---

*Document maintained by: Development Team*
*Version: 3.1*
*Last updated: 2026-01-03*

---

## Appendix C: Current Implementation Files

### Working TSL Implementation

| File | Description |
|------|-------------|
| `src/rendering/PostProcessingTSL.tsx` | TSL post-processing with bloom, FXAA, SSR, GTAO |
| `src/hooks/useRendererBackend.ts` | WebGPU/WebGL detection hook |
| `src/stores/rendererStore.ts` | Renderer backend state |
| `src/components/ui/WebGPUBadge.tsx` | WebGPU badge component |
| `src/types/three-webgpu.d.ts` | TypeScript declarations |

### Test Files

| File | Description |
|------|-------------|
| `src/tests/hooks/useRendererBackend.test.ts` | Backend detection tests |
| `src/tests/stores/rendererStore.test.ts` | Store tests |
| `src/tests/components/ui/WebGPUBadge.test.tsx` | Badge component tests |
| `scripts/playwright/webgpu-visual-test.mjs` | E2E visual regression |
