# WebGPU MRT (Multiple Render Targets) Analysis Report

## Executive Summary

This report documents a comprehensive analysis of the Multiple Render Target (MRT) implementation in the MDimension WebGL-to-WebGPU/TSL migration. The investigation reveals **significant architectural inconsistencies** between how different object types handle MRT outputs, leading to potential rendering bugs and a maintenance burden.

**Key Findings:**
1. Only 2 of 5 raymarched object types (BlackHole, Schrodinger) have proper `material.mrtNode` configuration
2. Mandelbulb, Julia, and Polytope materials are missing `mrtNode` entirely
3. The `MainObjectMRTPassTSL` pass relies on a fallback default MRT with black outputs for normal/position, which means non-configured materials render incorrectly to G-buffer
4. WebGL and WebGPU use fundamentally different mechanisms (gl.drawBuffers vs renderer.setMRT) - only partially unified

---

## Table of Contents

1. [Background: MRT in WebGL vs WebGPU](#1-background-mrt-in-webgl-vs-webgpu)
2. [Current Implementation Audit](#2-current-implementation-audit)
3. [Per-Object Type MRT Status](#3-per-object-type-mrt-status)
4. [Render Graph MRT Handling](#4-render-graph-mrt-handling)
5. [Issues and Inconsistencies](#5-issues-and-inconsistencies)
6. [Best Practices from Research](#6-best-practices-from-research)
7. [Recommended Architecture](#7-recommended-architecture)
8. [Action Items](#8-action-items)

---

## 1. Background: MRT in WebGL vs WebGPU

### 1.1 WebGL MRT Mechanism

In WebGL2, MRT requires strict matching between three components:

```
┌─────────────────────────────┐
│   Fragment Shader Outputs   │
│   layout(location=0) gColor │
│   layout(location=1) gNormal│
│   layout(location=2) gPos   │
└─────────────┬───────────────┘
              │ must match
┌─────────────▼───────────────┐
│       gl.drawBuffers()      │
│   [COLOR_ATTACHMENT0,       │
│    COLOR_ATTACHMENT1,       │
│    COLOR_ATTACHMENT2]       │
└─────────────┬───────────────┘
              │ must match
┌─────────────▼───────────────┐
│    Framebuffer Attachments  │
│   glFramebufferTexture2D()  │
└─────────────────────────────┘
```

**Failure Mode:** If these don't match, WebGL throws:
```
GL_INVALID_OPERATION: Active draw buffers with missing fragment shader outputs
```

**Current Solution:** `MRTStateManager` (src/rendering/graph/MRTStateManager.ts) patches `renderer.setRenderTarget()` to automatically configure `gl.drawBuffers()` based on attachment count.

### 1.2 WebGPU MRT Mechanism

WebGPU handles MRT through pipeline configuration:

```
┌─────────────────────────────┐
│   Material mrtNode          │
│   mrt({ output, normal,     │
│         position })         │
└─────────────┬───────────────┘
              │ defines outputs
┌─────────────▼───────────────┐
│    renderer.setMRT()        │
│   (pass-level default)      │
└─────────────┬───────────────┘
              │ configures
┌─────────────▼───────────────┐
│ RenderTarget with count:N   │
│ textures[0] = 'output'      │
│ textures[1] = 'normal'      │
│ textures[2] = 'position'    │
└─────────────────────────────┘
```

**Key Difference:** WebGPU uses a declarative node-based approach (`mrt()` function) rather than imperative GL state management.

### 1.3 Three.js r182+ Patterns

Per Three.js documentation and [NodeMaterial docs](https://threejs.org/docs/pages/NodeMaterial.html):

| Approach | Scope | Purpose |
|----------|-------|---------|
| `renderer.setMRT()` | Global/Pass | Define default MRT outputs for all materials |
| `material.mrtNode` | Per-Material | Override MRT values for specific materials |

**Critical Pattern:** Materials can override the pass-level MRT via `material.mrtNode`. This enables:
- Pass-level defaults for standard materials
- Per-material overrides for special shaders (raymarching, custom effects)

---

## 2. Current Implementation Audit

### 2.1 WebGL Render Graph (src/rendering/graph/)

| File | MRT Handling |
|------|--------------|
| `MRTStateManager.ts` | Patches `setRenderTarget()` to configure `gl.drawBuffers()` |
| `ResourcePool.ts` | Creates MRT targets with `attachmentNames: ['output', 'normal', 'position']` |
| `passes/MainObjectMRTPass.ts` | WebGL MRT pass with `forceOpaque` material modification |
| `passes/ScenePass.ts` | Disables background for MRT (prevents GL_INVALID_OPERATION) |

### 2.2 TSL Render Graph (src/rendering/graph-tsl/)

| File | MRT Handling |
|------|--------------|
| `RenderGraphTSL.ts` | Orchestrates passes, no direct MRT handling |
| `passes/MainObjectMRTPassTSL.ts` | Uses `renderer.setMRT()` + material cache + fallback MRT |
| `passes/ScenePassTSL.ts` | Disables background for MRT targets |
| `passes/NormalPassTSL.ts` | Uses `mrt({ output, normal })` for normal buffer |

### 2.3 MRT Resource Configuration (PostProcessingV2TSL.tsx)

```typescript
g.addResource({
  id: RESOURCES.MAIN_OBJECT_MRT,
  type: 'mrt',
  attachmentCount: 3,
  attachmentFormats: [THREE.RGBAFormat, THREE.RGBAFormat, THREE.RGBAFormat],
  attachmentNames: ['output', 'normal', 'position'],  // CRITICAL: must match mrt() keys
  dataType: THREE.HalfFloatType,
  depthBuffer: true,
  depthTexture: true,
});
```

---

## 3. Per-Object Type MRT Status

### 3.1 Raymarched Objects

| Object Type | File | Has mrtNode | Outputs | Status |
|-------------|------|-------------|---------|--------|
| **BlackHole** | `tsl/raymarching/blackhole/composeBlackHoleTSL.ts:1012` | YES | output, normal, position | CORRECT |
| **Schrodinger** | `tsl/raymarching/schroedinger/composeSchroedingerTSL.ts:1044` | YES | output, normal, position | CORRECT |
| **Mandelbulb** | `tsl/raymarching/mandelbulb/composeMandelbulbTSL.ts` | NO | colorNode only | MISSING |
| **Julia** | `tsl/raymarching/julia/composeJuliaTSL.ts` | NO | colorNode only | MISSING |

### 3.2 Mesh-Based Objects

| Object Type | File | Has mrtNode | Outputs | Status |
|-------------|------|-------------|---------|--------|
| **Polytope** | `tsl/compose/polytope/composePolytopeTSL.ts` | NO | colorNode only | MISSING |
| **TubeWireframe** | `tsl/compose/tubewireframe/composeTubeWireframeTSL.ts` | NO | colorNode only | MISSING |
| **GroundPlane** | `materials/GroundPlaneMaterialTSL.tsx` | NO | colorNode only | N/A (environment layer) |

### 3.3 BlackHole MRT Implementation (Reference)

```typescript
// src/rendering/tsl/raymarching/blackhole/composeBlackHoleTSL.ts:1012
material.mrtNode = mrt({
  // 'output' uses the built-in output node which references colorNode
  output: output,
  // 'normal' uses our computed view-space normal, encoded to [0,1] range
  normal: vec4(
    mrtNormalView.mul(0.5).add(0.5),
    mrtHasHit  // Alpha stores hit flag
  ),
  // 'position' provides world position for temporal reprojection
  position: vec4(mrtWorldPos, mrtHasHit),
});

// Custom depth output for gl_FragDepth equivalent
material.depthNode = mrtClipDepth;
```

### 3.4 Mandelbulb/Julia: Missing MRT

These materials output only via `colorNode`, with depth handled by a manual calculation assigned to the TSL `depth` node. However, they **do not** provide `normal` or `position` outputs for the G-buffer.

```typescript
// src/rendering/tsl/raymarching/mandelbulb/composeMandelbulbTSL.ts:835-837
const material = new MeshBasicNodeMaterial()
material.side = THREE.BackSide
material.colorNode = raymarchShader()  // Only color output!
// NO material.mrtNode = mrt({...})
```

**Consequence:** When Mandelbulb/Julia are rendered to the MRT target, the `MainObjectMRTPassTSL` fallback MRT provides:
- `output`: material's colorNode (correct)
- `normal`: vec4(0, 0, 0, 0) (BLACK - incorrect)
- `position`: vec4(0, 0, 0, 0) (BLACK - incorrect)

---

## 4. Render Graph MRT Handling

### 4.1 MainObjectMRTPassTSL Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MainObjectMRTPassTSL.execute()               │
├─────────────────────────────────────────────────────────────────┤
│  1. Get MRT target from resource pool                           │
│  2. Save renderer state (autoClear, clearColor, layers)         │
│  3. Disable scene.background (MRT safety)                       │
│  4. Configure camera layers                                     │
│  5. IF WebGPU:                                                  │
│       - Save current MRT: renderer.getMRT()                     │
│       - Set default MRT: renderer.setMRT(defaultMRT)            │
│  6. Force materials opaque (transparent=false, depthWrite=true) │
│  7. renderer.setRenderTarget(mrtTarget)                         │
│  8. renderer.clear() + renderer.render()                        │
│  9. Restore: MRT, material props, background, layers            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Default MRT Fallback

```typescript
// src/rendering/graph-tsl/passes/MainObjectMRTPassTSL.ts:160
this.defaultMRT = mrt({
  output: output,           // Built-in output node
  normal: vec4(0, 0, 0, 0), // Black fallback
  position: vec4(0, 0, 0, 0), // Black fallback
});
```

**Problem:** This fallback produces black normal/position buffers for any material without its own `mrtNode`.

### 4.3 Material Override Mechanism

Per [Three.js NodeMaterial docs](https://threejs.org/docs/pages/NodeMaterial.html):
> `mrtNode` allows to overwrite what values are written into MRT targets on material level.

When `material.mrtNode` is set, it **completely replaces** the pass-level MRT for that material. This is why BlackHole and Schrodinger work correctly.

---

## 5. Issues and Inconsistencies

### 5.1 Critical: Missing mrtNode on 3 Object Types

**Affected:** Mandelbulb, Julia, Polytope

**Impact:**
- G-buffer `normal` texture is black for these objects
- G-buffer `position` texture is black for these objects
- Effects depending on normal/position (AO, SSR, depth compositing) fail silently
- Gravitational lensing composite may produce incorrect results

### 5.2 Moderate: forceOpaque Causes Pipeline Recreation

```typescript
// MainObjectMRTPassTSL.ts:237-240
entry.material.transparent = false
entry.material.depthWrite = true
entry.material.blending = THREE.NoBlending
```

**Issue:** WebGPU cannot change `transparent` at runtime without pipeline recreation. Per [MKB-001 Section 7](../tsl.md):
> NEVER change `transparent` or call `needsUpdate = true` at runtime: Causes pipeline recreation -> "Invalid PipelineLayout"

**Current Mitigation:** The codebase notes this is intentional for MRT rendering, but it's a performance concern.

### 5.3 Minor: Inconsistent Normal Encoding

| Object | Normal Encoding |
|--------|-----------------|
| BlackHole | `normalView.mul(0.5).add(0.5)` (0-1 range) |
| Schrodinger | `normalView.mul(0.5).add(0.5)` (0-1 range) |
| NormalPassTSL | `transformedNormalView` (likely -1 to 1) |

The NormalPassTSL uses a different encoding than the raymarched materials.

### 5.4 Minor: WebGL/WebGPU Code Duplication

The MRT handling logic is partially duplicated:
- `MRTStateManager` (WebGL only)
- `MainObjectMRTPassTSL` (WebGPU-specific branch)
- Pass-level checks for `isWebGLRenderer()` scattered throughout

---

## 6. Best Practices from Research

### 6.1 WebGPU MRT Best Practices (2025/2026)

Sources: [WebGPU Samples](https://webgpu.github.io/webgpu-samples/?sample=deferredRendering), [PlayCanvas MRT](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/multiple-render-targets/)

1. **All MRT attachments must have the same width/height**
2. **All attachments are cleared to the same value** (three.js [harmonized this in r174](https://github.com/mrdoob/three.js/issues/30567))
3. **Memory management is critical** - don't create more surfaces than needed
4. **Test early on target hardware** - MRT is demanding on low-end devices

### 6.2 Three.js r182+ MRT Patterns

Sources: [Three.js MRT Example](https://threejs.org/examples/webgpu_multiple_rendertargets.html), [NodeMaterial Docs](https://threejs.org/docs/pages/NodeMaterial.html)

**Standard Pattern:**
```typescript
// 1. Create RenderTarget with count
const renderTarget = new THREE.RenderTarget(width, height, {
  count: 3,  // Number of render targets
});
renderTarget.textures[0].name = 'output';
renderTarget.textures[1].name = 'normal';
renderTarget.textures[2].name = 'position';

// 2. Set pass-level MRT
renderer.setMRT(mrt({
  'output': output,
  'normal': normalWorld,
  'position': positionWorld,
}));

// 3. Override per-material where needed
specialMaterial.mrtNode = mrt({
  'output': customColorNode,
  'normal': customNormalNode,
  'position': customPositionNode,
});

// 4. Render
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);
```

### 6.3 Deferred Rendering G-Buffer Layout

Sources: [LearnOpenGL Deferred](https://learnopengl.com/Advanced-Lighting/Deferred-Shading), [GPU Gems 2](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-9-deferred-shading-stalker)

**Standard G-Buffer:**
| Attachment | Content | Format |
|------------|---------|--------|
| 0 | Diffuse Color + Alpha | RGBA16F |
| 1 | View-Space Normal | RGBA16F |
| 2 | World Position | RGBA16F |
| depth | Depth | Depth24+ |

**Optional Extensions:**
- Specular intensity in normal.a
- Metalness/roughness in position.a
- Motion vectors for TAA

---

## 7. Recommended Architecture

### 7.1 Unified MRT Configuration

All materials rendered to MRT should have explicit `mrtNode` configuration:

```typescript
// BEFORE: Only colorNode (WRONG for MRT)
material.colorNode = raymarchShader()

// AFTER: Full MRT configuration (CORRECT)
material.colorNode = colorOutput
material.mrtNode = mrt({
  output: output,
  normal: vec4(normalView.mul(0.5).add(0.5), hasHit),
  position: vec4(positionWorld, hasHit),
})
material.depthNode = customDepth
```

### 7.2 Shared MRT Output Helpers

Create reusable functions for MRT output:

```typescript
// src/rendering/tsl/mrt/createMRTOutputs.ts
export function createRaymarchedMRTOutputs(
  colorOutput: ReturnType<typeof vec4>,
  normalView: ReturnType<typeof vec3>,
  positionWorld: ReturnType<typeof vec3>,
  hasHit: ReturnType<typeof float>,
  clipDepth: ReturnType<typeof float>,
) {
  return {
    mrtNode: mrt({
      output: output,
      normal: vec4(normalView.mul(0.5).add(0.5), hasHit),
      position: vec4(positionWorld, hasHit),
    }),
    depthNode: clipDepth,
  }
}
```

### 7.3 Pass-Level Default MRT

The pass should only provide fallback for materials that genuinely don't need MRT:

```typescript
// MainObjectMRTPassTSL - only for fallback
this.defaultMRT = mrt({
  output: output,
  normal: vec4(normalWorld.mul(0.5).add(0.5), float(1)),  // Use built-in normals
  position: vec4(positionWorld, float(1)),  // Use built-in positions
})
```

This provides correct defaults for standard mesh materials (Polytope) that use Three.js built-in `normalWorld` and `positionWorld`.

### 7.4 Remove forceOpaque for WebGPU

Instead of runtime transparency modification, ensure materials are created with `transparent: false` when they'll be rendered to MRT:

```typescript
// At material creation time
const material = new MeshBasicNodeMaterial({
  transparent: false,  // Set at creation, never change
  depthWrite: true,
})
```

---

## 8. Action Items

### 8.1 Critical (P0) - Missing MRT Nodes

| Object | File | Action |
|--------|------|--------|
| Mandelbulb | composeMandelbulbTSL.ts | Add `material.mrtNode = mrt({...})` with normal/position from raymarching |
| Julia | composeJuliaTSL.ts | Add `material.mrtNode = mrt({...})` with normal/position from raymarching |
| Polytope | composePolytopeTSL.ts | Add `material.mrtNode = mrt({...})` using TSL built-ins `normalWorld`, `positionWorld` |

### 8.2 High (P1) - Architecture Improvements

1. **Create shared MRT helper functions** in `src/rendering/tsl/mrt/`
2. **Unify normal encoding** (all should use 0-1 range via `n.mul(0.5).add(0.5)`)
3. **Update MainObjectMRTPassTSL fallback** to use built-in normals/positions
4. **Add validation** that warns if material without mrtNode is rendered to MRT target

### 8.3 Medium (P2) - Code Quality

1. **Remove forceOpaque runtime modification** for WebGPU (causes pipeline recreation)
2. **Document MRT contract** in CLAUDE.md or architecture.md
3. **Add tests** verifying MRT outputs for all object types

### 8.4 Low (P3) - Future Optimization

1. **Consider render bundles** for MRT rendering ([PR #31906](https://github.com/mrdoob/three.js/pull/31906))
2. **Evaluate tile-based deferred rendering** optimizations for mobile
3. **Add MRT preview pass** for debugging normal/position buffers

---

## References

### Three.js Documentation
- [NodeMaterial.mrtNode](https://threejs.org/docs/pages/NodeMaterial.html)
- [Three.js MRT Example](https://threejs.org/examples/webgpu_multiple_rendertargets.html)
- [TSL Documentation](https://threejs.org/docs/pages/TSL.html)

### GitHub Issues/PRs
- [MRT Clear Differences (r174 fix)](https://github.com/mrdoob/three.js/issues/30567)
- [Render Bundle + MRT Support](https://github.com/mrdoob/three.js/pull/31906)

### General Resources
- [WebGPU Deferred Rendering Sample](https://webgpu.github.io/webgpu-samples/?sample=deferredRendering)
- [LearnOpenGL: Deferred Shading](https://learnopengl.com/Advanced-Lighting/Deferred-Shading)
- [PlayCanvas MRT Guide](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/multiple-render-targets/)

---

*Report generated: 2026-01-04*
*Author: Claude Code (Autonomous WebGPU Port Investigation)*
