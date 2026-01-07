# Bug: WebGPU Mode - No Object Renders (Black Screen)

**Date**: 2026-01-05
**Status**: ✅ POLYTOPES FULLY WORKING - Fractals still need work
**Severity**: Critical → Medium (Polytopes fully working, fractals need work)
**Branch**: webgpu-migration

## Quick Summary

**Root Cause**: WebGPU bind groups are fixed at material compilation time. Multiple bugs caused black screen and animation issues:
1. Passthrough material caching - reused wrong texture binding
2. `skipPassthrough` not forwarded - passes did copies instead of aliases
3. Mesh ref checks on uniform updates - prevented face animation

**Current State**:
- ✅ Polytopes render with full shading (edges + faces + colors + lighting)
- ✅ Polytope animation working (rotation, all transforms)
- ❌ Mandelbulb/Julia don't render (raymarcher issue)
- ❌ Schrödinger crashes app

---

## Bug Description

When using WebGPU renderer, the polytope object does not render. The screen shows a black canvas while WebGL mode works correctly and shows the expected geometry.

**Observed Behavior**:
- WebGPU mode: Complete black screen at 60 FPS (nothing renders - not even background)
- WebGL mode: Works correctly at 60 FPS

**Previous Issues (RESOLVED)**:
- 1 FPS issue: Caused by debug fetch calls (removed)
- Material recreation loop: Fixed deps array in PolytopeSceneTSL.tsx

---

## Reproduction Steps

1. Start the application: `npm run dev`
2. Navigate to `http://localhost:3002/` (WebGPU mode)
3. **Observed**: Black screen, no polytope visible
4. Navigate to `http://localhost:3002/?forceWebGL=true`
5. **Expected (when working)**: Green cube/polytope visible

---

## Technical Background

### Renderer Architecture

The application supports dual rendering backends:
- **WebGL**: Uses GLSL shaders via `ShaderMaterial`
- **WebGPU**: Uses TSL (Three Shading Language) via `MeshBasicNodeMaterial`

Key routing logic in `UnifiedRenderer.tsx`:
```typescript
// Routes to TSL or GLSL implementations based on renderer
if (isWebGPURenderer()) {
  return <PolytopeSceneTSL {...props} />
} else {
  return <PolytopeScene {...props} />
}
```

### TSL Material Pattern

WebGPU materials use TSL nodes for shader composition:
```typescript
const mat = new MeshBasicNodeMaterial({
  side: THREE.DoubleSide,
  transparent: false,
  depthWrite: true,
})

// N-D to 3D transformation
mat.positionNode = createNDTransformNode(uniforms.ndTransform)

// Color output
mat.colorNode = vec3(1, 0, 0) // solid red for debugging
```

### Render Graph (PostProcessingV2TSL)

WebGPU uses a TSL-based render graph with these passes:
1. `ScenePassTSL` - Renders scene to SCENE_COLOR target
2. Various effect passes (clouds, composite, etc.)
3. `ToScreenPassTSL` - Final output to screen

---

## Relevant Code Locations

| File | Purpose |
|------|---------|
| `src/rendering/Scene.tsx` | Main scene, routes to TSL or GLSL post-processing |
| `src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx` | TSL polytope renderer |
| `src/rendering/environment/PostProcessingV2TSL.tsx` | TSL render graph |
| `src/rendering/graph-tsl/passes/ScenePassTSL.ts` | Scene rendering pass |
| `src/rendering/graph-tsl/passes/ToScreenPassTSL.ts` | Final screen output |
| `src/rendering/tsl/transforms/ndTransformTSL.ts` | N-D to 3D vertex transformation |
| `src/rendering/materials/useTrackedTSLMaterial.ts` | Material compilation tracking |

---

## Investigation Timeline

### Phase 1: Initial Analysis

**Hypothesis**: Layer mismatch between mesh and camera

- Checked `RENDER_LAYERS.MAIN_OBJECT = 1`
- Verified mesh is assigned to layer 1
- Verified `ScenePassTSL` enables layers [0, 1, 2]
- **Result**: Layer configuration is correct

### Phase 2: Render Graph Verification

**Hypothesis**: Render graph passes not connected correctly

- Added debug logging to `ScenePassTSL.execute()`
- Logged `sceneChildCount`, `cameraLayerMask`, `hasTarget`
- **Result**: Render graph passes appear connected correctly

### Phase 3: positionNode Test

**Hypothesis**: N-D transform `positionNode` not producing valid coordinates

- Disabled `positionNode` in material - still black
- **Result**: Issue not isolated to positionNode

### Phase 4: Bypass Render Graph Test

**Hypothesis**: Issue in render graph, not material

- Bypassed `PostProcessingV2TSL` entirely
- **Result**: Still black AND page dropped to ~1 FPS
- This suggests the issue is NOT in the render graph specifically

### Phase 5: Standard Material Test

**Hypothesis**: Issue with TSL `MeshBasicNodeMaterial`

- Replaced TSL material with standard `THREE.MeshBasicMaterial`:
```typescript
const faceMaterial = useMemo(() => {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  })
  return mat
}, [])
```

- **Result**: Still black, still ~1 FPS
- **IMPORTANT**: Standard material doesn't use `positionNode`, so vertices use raw attribute positions (first 3 dimensions of N-D vertices)

### Phase 6: Compilation State Check

**Key Discovery**: Console logs revealed:
```
[PolytopeSceneTSL] Render conditions: {
  "facesVisible": true,
  "hasFaceGeometry": true,
  "faceVertexCount": 36,
  "isCompiling": true,  // <-- Stuck in compiling state
  "hasFaceMaterial": true
}
```

The `isCompiling` flag eventually becomes `false`, but FPS remains at 1.

### Phase 7: Reference Cube Test

**Hypothesis**: Basic WebGPU rendering is broken

- Added a simple reference cube to Scene.tsx:
```tsx
<mesh position={[0, 0, 0]} layers={0}>
  <boxGeometry args={[1, 1, 1]} />
  <meshBasicMaterial color={0x00ff00} />
</mesh>
```

- **Result**: Screenshot timed out due to slow page (1 FPS)

### Phase 8: WebGL Comparison

**Critical Discovery**: WebGL mode ALSO runs at ~1 FPS!

```javascript
// Measured frame times in WebGL mode:
frameTimes: [146.44, 999.96, 1008.66, 1000.52, 1008.99, ...]
avgFrameTime: "918.41"
fps: "1.1"
```

**This changes everything**: The 1 FPS issue is NOT WebGPU-specific. There's a fundamental performance issue affecting both renderers.

---

## Key Insights

### 1. The 1 FPS Issue is App-Wide
Both WebGL and WebGPU modes exhibit ~1000ms frame times. This points to something in the app's render loop or a blocking operation, not renderer-specific code.

### 2. Compilation Eventually Completes
The TSL material compilation (`isCompiling`) does transition from `true` to `false`, but performance doesn't improve.

### 3. Frame Time is Suspiciously Close to 1 Second
The ~1000ms frame time is suspiciously close to 1 second. Could indicate:
- A `setTimeout` or polling at 1-second intervals
- A synchronous GPU operation (readPixels, fence wait)
- A blocking network request

### 4. Debug Reference Cube Layer
The reference cube was added to layer 0 (ENVIRONMENT), which should be rendered by ScenePassTSL. Need to verify if it appears.

### 5. Standard Material Missing positionNode
When testing with `THREE.MeshBasicMaterial`, vertices don't get the N-D transformation. The mesh would render at raw vertex positions (which might be off-screen or at incorrect scale).

---

## Console Diagnostic Summary

```
[App] Renderer initialized with WebGPU
[GPUTimerTSL] Initialized for WebGPU (CPU timing only)
[MRTStateManager] Skipping for WebGPU renderer
[App] Canvas created with WebGPU backend

[PolytopeSceneTSL] Render conditions: {
  facesVisible: true,
  hasFaceGeometry: true,
  faceVertexCount: 36,
  isCompiling: false,  // Eventually completes
  hasFaceMaterial: true
}

=== PROD/DEV DIAGNOSTICS ===
Mode: development
Renderer: WebGPU
Programs/Geometries/Textures: 0 / 8 / 18
Avg Render Calls/Frame: 8.89
Avg Frame Time: 1003.81ms (1.0 FPS)  // <-- Critical issue
```

---

## Files Modified During Investigation

1. **`src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx`**
   - Added debug logging for render conditions
   - Temporarily replaced TSL material with standard material (reverted)
   - Added hypothesis logging via fetch to debug server

2. **`src/rendering/Scene.tsx`**
   - Added reference cube for basic rendering test
   - Added THREE import

3. **`src/rendering/graph-tsl/passes/ScenePassTSL.ts`**
   - Added debug logging for pass execution

---

## Current Debug State

**Active Debug Code**:
- Reference cube in Scene.tsx (green box at origin, layer 0)
- Debug logging in PolytopeSceneTSL (render conditions)
- Debug logging in ScenePassTSL (pass execution)

**TSL Material**: Restored to original TSL implementation with `positionNode`

---

## Next Steps to Investigate

### 1. Profile the Render Loop
Use Chrome DevTools Performance tab to identify what's taking 1000ms per frame:
- Is it CPU-bound? (JavaScript execution)
- Is it GPU-bound? (Shader compilation, texture upload)
- Is it a synchronous wait? (Promise, fence)

### 2. Check for Blocking Operations
Search codebase for:
- `await` inside render loop
- `readPixels` or similar synchronous GPU operations
- Network requests in `useFrame`

### 3. Test with Empty Scene
Remove all objects and passes to find minimum reproduction:
- Does empty scene run at 60 FPS?
- Add passes one by one to find the slow one

### 4. Check ProdDevDiagnostics
The diagnostics component runs every second - could it be blocking?

### 5. Verify WebGPU with Minimal Three.js
Create a standalone test with just Three.js WebGPU renderer to isolate app issues from Three.js issues.

---

## Potential Root Causes

### Hypothesis A: ProdDevDiagnostics Blocking
The diagnostics component logs every second and may be causing synchronous work.

### Hypothesis B: GPU Fence/Sync Stall
WebGPU might be waiting for GPU synchronization each frame.

### Hypothesis C: Texture Upload Every Frame
A texture might be re-uploaded or recreated every frame.

### Hypothesis D: Shader Recompilation
A shader might be recompiled every frame due to changing uniforms/defines.

### Hypothesis E: External Issue
Something outside the render loop (HMR, Vite, React DevTools) causing delays.

---

## CRITICAL DISCOVERY: Debug Fetch Calls Causing 1 FPS

### Root Cause Identified

The 1 FPS issue was caused by **debug `fetch()` calls** running on every frame/tick. These calls were added during previous debugging sessions and were blocking the render loop.

**Pattern Found**:
```typescript
// #region agent log
try {
  fetch('http://127.0.0.1:7242/ingest/...', {
    method: 'POST',
    body: JSON.stringify(logPayload),
    ...
  })
} catch {}
// #endregion
```

### Files Affected

The following 9 files contained debug fetch blocks that were removed:

1. `src/rendering/renderers/UnifiedRenderer.tsx`
2. `src/rendering/controllers/FpsController.tsx`
3. `src/App.tsx`
4. `src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx`
5. `src/rendering/environment/PostProcessingV2TSL.tsx`
6. `src/rendering/graph-tsl/passes/ScenePassTSL.ts`
7. `src/rendering/graph-tsl/passes/MainObjectMRTPassTSL.ts`
8. `src/rendering/graph-tsl/passes/ToScreenPassTSL.ts`
9. `src/rendering/graph-tsl/RenderGraphTSL.ts`

### Fix Applied

All debug fetch blocks were removed using:
```bash
for file in <affected files>; do
  sed -i '' '/\/\/ #region agent log/,/\/\/ #endregion/d' "$file"
done
```

### Additional Debug Code Removed

1. **`src/rendering/core/rendererUtils.ts`**
   - Disabled console.log in `isWebGPUBackend()` that was logging on every call

2. **`src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx`**
   - Removed debug `useEffect` with `console.error`

3. **`src/rendering/Scene.tsx`**
   - Removed debug reference cube

---

## FPS Measurement Clarification

**Important Note**: The 1 FPS measurement via `requestAnimationFrame` may show throttled FPS, not actual capability.

The app has intentional FPS throttling:
- **Animations OFF**: 10 FPS throttle
- **Animations ON**: maxFPS (60 desktop, 30 mobile)

The measurement showing 1 FPS was affected by:
1. Debug fetch calls blocking the render loop (the actual bug)
2. FPS throttling when animations are disabled

---

## Updated Status

**1 FPS Issue**:
- Debug fetch calls: RESOLVED (removed)
- Material recreation loop: RESOLVED (fixed deps array in PolytopeSceneTSL.tsx)

**WebGPU Rendering**: Requires user verification - automation environment shows 1 FPS on BOTH main and webgpu-migration branches, indicating the issue is not code-related but environmental (likely Chrome DevTools MCP throttling).

---

## Additional Fix: TSL Material Recreation Loop

### Root Cause

The `useTrackedTSLMaterial` hook uses JSON.stringify to compare dependencies. When dependencies contain TSL nodes (which have circular references), JSON.stringify throws an error and falls back to creating a unique key using `Date.now()`:

```typescript
// useTrackedTSLMaterial.ts line 86-99
try {
  depsKey = JSON.stringify(deps, ...)
} catch {
  // Circular reference - use timestamp (UNIQUE EVERY TIME!)
  depsKey = `unstringifiable-${Date.now()}`
}
```

### Problem

In `PolytopeSceneTSL.tsx`, the deps array included `uniforms` and `faceDepthVarying` which are TSL node objects with circular references:

```typescript
// BEFORE (broken):
[shaderConfig, uniforms, faceDepthVarying, opacity]
```

This caused:
1. JSON.stringify to fail every render
2. A new unique depsKey every render
3. Material recreation every render
4. "Building shader" overlay never completing
5. ~1000ms frame time due to continuous recreation

### Fix Applied

Removed non-serializable objects from deps:

```typescript
// AFTER (fixed):
[shaderConfig, opacity]
```

The `uniforms` and `faceDepthVarying` are:
- Stable (memoized with empty deps `[]`)
- Captured in the factory function closure
- Don't need to trigger recreation

### File Modified

`src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx` - line 455-461

---

## Verification Note

The Chrome DevTools MCP automation shows 1 FPS on both main branch and webgpu-migration branch. This is NOT indicative of actual performance - the automation environment appears to throttle page rendering.

**User must manually verify** that:
1. WebGPU mode renders objects correctly
2. FPS is back to normal (10 FPS idle, 60 FPS when animating)
3. "Building shader" overlay completes and disappears

---

## Session 2: Complete Black Screen Investigation (2026-01-05 continued)

### User Confirmation

User manually verified:
- ✅ **FPS is 60** - Performance is fine, no throttling issue
- ✅ **Shader overlay disappears** - Material compilation completes successfully
- ❌ **NOTHING renders** - Complete black screen, not even background color

**Critical insight**: The issue is NOT polytope-specific. Even environment elements (Skybox, GroundPlane) don't render.

### Render Graph Pass Chain Analysis

Traced the full render pipeline in `PostProcessingV2TSL.tsx`:

```
1. scenePass → SCENE_COLOR (layers: MAIN_OBJECT, ENVIRONMENT, SKYBOX)
2. cloudComposite (CopyPassTSL) → SCENE_COMPOSITE (always enabled)
3. gtao → GTAO_OUTPUT (skipPassthrough: true when disabled)
4. bloom → BLOOM_OUTPUT (skipPassthrough: true)
5. bokeh → BOKEH_OUTPUT (skipPassthrough: true)
6. ssr → SSR_OUTPUT (skipPassthrough: true)
7. refraction → REFRACTION_OUTPUT (skipPassthrough: true)
8. lensing → LENSING_OUTPUT (skipPassthrough: true, ALWAYS disabled)
9. toneMappingCinematic → TONEMAPPED_OUTPUT (skipPassthrough: true)
10. frameBlending → FRAME_BLENDING_OUTPUT (skipPassthrough: true)
11. paper → PAPER_OUTPUT (skipPassthrough: true)
12. AA pass (fxaa/smaa) → AA_OUTPUT
13. finalToScreen → screen (reads AA_OUTPUT)
```

### Resource Aliasing Chain (When Effects Disabled)

When passes are disabled with `skipPassthrough: true`, they create resource aliases instead of passthrough copies:

```
AA_OUTPUT → PAPER_OUTPUT → FRAME_BLENDING_OUTPUT → TONEMAPPED_OUTPUT →
LENSING_OUTPUT → REFRACTION_OUTPUT → SSR_OUTPUT → BOKEH_OUTPUT →
BLOOM_OUTPUT → GTAO_OUTPUT → SCENE_COMPOSITE
```

The `resolveAlias()` method in `RenderGraphTSL.ts:131-145` follows this chain.

### Key Files Analyzed

| File | Key Finding |
|------|-------------|
| `PostProcessingV2TSL.tsx` | Pass chain setup, `scenePass` has `renderBackground: false` |
| `RenderGraphTSL.ts` | Execute loop at line 571+, size check at 578-582 may cause early return |
| `ScenePassTSL.ts` | Renders scene to target, restores state properly |
| `ToScreenPassTSL.ts` | Uses stable TextureNode pattern, renders to null target |
| `CopyPassTSL.ts` | Simple texture copy with stable TextureNode |
| `Skybox.tsx` | Line 709-711: Uses `SkyboxTextureMeshTSL` for WebGPU, `SkyboxMesh` for WebGL |

### Potential Causes Identified

1. **RenderGraphTSL Size Check** (`RenderGraphTSL.ts:578-582`):
   ```typescript
   if (this.width < 1 || this.height < 1) {
     return  // Early exit - entire graph skipped!
   }
   ```
   If `setSize()` is never called or called with invalid values, the graph never executes.

2. **ScenePassTSL Output Target**:
   - `ctx.getWriteTarget(outputConfig.resourceId)` might return null
   - If ResourcePool hasn't allocated the target, render goes nowhere

3. **WebGPU-specific Skybox** (`Skybox.tsx:709-711`):
   ```tsx
   isWebGPU ? <SkyboxTextureMeshTSL texture={texture} /> : <SkyboxMesh texture={texture} />
   ```
   The TSL skybox mesh might not be rendering correctly.

4. **ToScreenPassTSL Input Texture**:
   - `ctx.getReadTexture(this.inputResourceId)` might return null
   - If alias chain is broken, no texture to copy to screen

5. **Render Target Not Being Created**:
   - `ResourcePool.ensureAllocated()` might fail for WebGPU
   - WebGPU render targets have different requirements

### Things That Are NOT The Problem

- ✅ Material compilation (overlay disappears)
- ✅ FPS/performance (60 FPS achieved)
- ✅ Material recreation loop (fixed in previous session)
- ✅ Debug fetch calls (removed in previous session)

### Next Steps for Future Agents

1. **Add debug logging to trace execution**:
   - Log in `RenderGraphTSL.execute()` to verify it's being called
   - Log `this.width`, `this.height` to verify size is set
   - Log in `ToScreenPassTSL.execute()` to verify it runs and has valid input

2. **Check ResourcePool allocation**:
   - Log `ctx.getWriteTarget()` results in ScenePassTSL
   - Verify render targets are created for WebGPU

3. **Verify WebGPU renderer output**:
   - Add a simple test: render a solid color to screen without the render graph
   - Bypass PostProcessingV2TSL entirely to test basic WebGPU rendering

4. **Check SkyboxTextureMeshTSL**:
   - Verify the TSL skybox material is valid
   - Check if it's being added to correct layer

5. **Inspect browser console for WebGPU errors**:
   - Pipeline layout errors
   - Bind group errors
   - Validation errors

### Debug Code Suggestions

Add to `RenderGraphTSL.execute()` at start:
```typescript
if (import.meta.env.DEV) {
  console.log('[RenderGraphTSL] Execute called, size:', this.width, 'x', this.height)
}
```

Add to `ToScreenPassTSL.execute()`:
```typescript
if (import.meta.env.DEV) {
  const inputTex = ctx.getReadTexture(this.inputResourceId)
  console.log('[ToScreenPassTSL] Input texture:', inputTex ? 'valid' : 'NULL')
}
```

Add to `ScenePassTSL.execute()`:
```typescript
if (import.meta.env.DEV) {
  console.log('[ScenePassTSL] Target:', target ? 'valid' : 'NULL', 'Scene children:', scene.children.length)
}
```

---

## Session 3: Detailed Pass Chain Tracing (2026-01-05 continued)

### Debug Instrumentation Added

Added debug logging to trace the full render pipeline:

1. **`RenderGraphTSL.ts`** - Execute() entry and pass enable states
2. **`ScenePassTSL.ts`** - Execute with target size and scene children count
3. **`ToScreenPassTSL.ts`** - Execute with input texture dimensions
4. **`CopyPassTSL.ts`** - Execute with input/output dimensions
5. **`ToneMappingCinematicPassTSL.ts`** - Execute with input/output resource IDs and dimensions

### Playwright Test Created

Created `scripts/playwright/webgpu-black-screen.spec.ts` that:
- Navigates to the app
- Waits 5 seconds for shader compilation
- Captures console logs filtered for render graph passes
- Analyzes canvas pixels to detect non-black content
- Fails if canvas is completely black (0 non-black pixels)

### Critical Debug Output Analysis

Running the test revealed the **entire pass chain IS executing correctly**:

```
[RenderGraphTSL] Execute frame 0, size: 960x540, scene children: 5
[RenderGraphTSL] Compiled passes: 27, frozenFrameContext: valid
[RenderGraphTSL] Pass 'scene' enabled: true
[RenderGraphTSL] Pass 'cloudComposite' enabled: true
[RenderGraphTSL] Pass 'toneMappingCinematic' enabled: true
[RenderGraphTSL] Pass 'finalToScreen' enabled: true

[ScenePassTSL:scene] Execute - target: 960x540, scene children: 5, layers: 1,0,2
[CopyPassTSL:cloudComposite] Execute - input: 960x540, output: 960x540
[ToneMappingCinematicPassTSL:toneMappingCinematic] Execute - input: lensingOutput 960x540, output: tonemappedOutput 960x540
[ToScreenPassTSL:finalToScreen] Execute - inputTexture: 960x540
```

**Key Observations**:
1. ✅ RenderGraphTSL.execute() IS being called with valid size (960x540)
2. ✅ All enabled passes ARE executing
3. ✅ All render targets have valid dimensions (960x540)
4. ✅ All input textures have valid dimensions
5. ✅ ToScreenPassTSL receives a valid input texture
6. ❌ **Canvas is still 100% black (0 non-black pixels, 0 average brightness)**

### What This Tells Us

The passes are executing, targets are allocated, textures are passed between passes - yet **nothing appears on screen**. This narrows the issue to one of:

1. **ToScreenPassTSL material not outputting to canvas** - The fullscreen quad renders but produces black output
2. **WebGPU present/swap chain issue** - The renderer isn't presenting to the canvas correctly
3. **Fragment shader not outputting color** - The MeshBasicNodeMaterial outputNode isn't producing valid color

### WebGPU Pipeline Error Discovered

Running the Mandelbulb tests revealed a critical WebGPU validation error:

```
THREE.Color target has no corresponding fragment stage output but writeMask
(ColorWriteMask::(Red|Green|Blue|Alpha)) is not zero.
 - While validating targets[0] framebuffer output.
 - While validating fragment state.
 - While calling [Device].CreateRenderPipeline([RenderPipelineDescriptor "renderPipeline_MeshBasicNodeMaterial_39"])
```

**This is a WebGPU validation error** indicating the fragment shader isn't properly configured to write to the color attachment. The error suggests:
- The render pipeline is being created
- The framebuffer has color targets
- But the fragment shader has no corresponding output for those targets

### Hypothesis: Fragment Output Node Issue

The MeshBasicNodeMaterial used by fullscreen passes (ToScreenPassTSL, CopyPassTSL, ToneMappingCinematicPassTSL) uses `outputNode` to define fragment output:

```typescript
const nodeMaterial = new MeshBasicNodeMaterial()
nodeMaterial.outputNode = outputNode  // This defines what the fragment shader outputs
```

If `outputNode` is not properly connected to the framebuffer color attachment, WebGPU will fail silently (or with the error above).

### Things That Are NOT The Problem

- ✅ Size not being set (it is: 960x540)
- ✅ Passes not executing (they are, all logging)
- ✅ Render targets not allocated (they are, valid dimensions)
- ✅ Input textures not passed (they are, valid dimensions)
- ✅ Graph compilation (27 passes compiled)
- ✅ Pass enable conditions (correct passes enabled)

### Next Steps to Investigate

1. **Check ToScreenPassTSL's outputNode creation**:
   - Is `createOutputNode()` returning a valid TSL node?
   - Is the texture sampling working correctly?

2. **Test with a simpler output**:
   - Replace outputNode with `vec4(1, 0, 0, 1)` (solid red) to verify material renders

3. **Check Three.js WebGPU output binding**:
   - WebGPU requires explicit output bindings
   - MeshBasicNodeMaterial might need different configuration for WebGPU

4. **Search Three.js examples for WebGPU post-processing**:
   - How do official examples render fullscreen quads to screen?
   - Is there a different pattern for WebGPU vs WebGL?

### Files Modified This Session

1. `src/rendering/graph-tsl/RenderGraphTSL.ts` - Added execute() debug logging
2. `src/rendering/graph-tsl/passes/ScenePassTSL.ts` - Added execute() debug logging
3. `src/rendering/graph-tsl/passes/ToScreenPassTSL.ts` - Added execute() debug logging
4. `src/rendering/graph-tsl/passes/CopyPassTSL.ts` - Added execute() debug logging
5. `src/rendering/graph-tsl/passes/ToneMappingCinematicPassTSL.ts` - Added execute() debug logging
6. `scripts/playwright/webgpu-black-screen.spec.ts` - New test file for pixel analysis

### Relevant Web Search Results

- [Three.js GitHub Issue #31658](https://github.com/mrdoob/three.js/issues/31658) - RenderTarget + WebGPU Backend reading issues
- [Three.js GitHub Issue #30567](https://github.com/mrdoob/three.js/issues/30567) - MRT render targets clearing differently in WebGL vs WebGPU
- [Three.js GitHub Issue #28957](https://github.com/mrdoob/three.js/issues/28957) - WebGPURenderer documentation state

---

## Session 4: Comprehensive Architecture Analysis (2026-01-05 continued)

### WebGL vs TSL Architecture Comparison

After thoroughly reading the entire WebGL RenderGraph implementation, here's the comparison:

#### Core Components

| Component | WebGL | TSL/WebGPU |
|-----------|-------|------------|
| RenderGraph | `src/rendering/graph/RenderGraph.ts` | `src/rendering/graph-tsl/RenderGraphTSL.ts` |
| ResourcePool | Shared | Shared (same file) |
| GraphCompiler | Shared | Shared (same file) |
| MRTStateManager | Active (patches setRenderTarget) | **SKIPPED** for WebGPU |
| ToScreenPass | GLSL ShaderMaterial | TSL MeshBasicNodeMaterial |

#### MRT Handling (CRITICAL DIFFERENCE)

**WebGL**:
- `MRTStateManager` patches `renderer.setRenderTarget()` to auto-configure `gl.drawBuffers()`
- Uses GLSL ES 3.00 with `layout(location = N) out vec4` for each attachment
- Passthrough materials have different variants for 1-4 attachment counts

**WebGPU/TSL**:
- `MRTStateManager` is **explicitly SKIPPED** for WebGPU (line 247-250):
  ```typescript
  if (!this.isWebGPU) {
    initializeGlobalMRT(renderer as THREE.WebGLRenderer)
  }
  ```
- Comment says: "MRT handled differently" but **no implementation exists**
- WebGPU MRT requires `renderer.setMRT()` API (not implemented in our code)

#### Material Pattern Comparison

**WebGL ToScreenPass**:
```typescript
this.material = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,  // With layout(location = 0) out vec4
  uniforms: { uInput: { value: null } },
})
renderer.setRenderTarget(null)
renderer.render(this.scene, this.camera)
```

**TSL ToScreenPassTSL**:
```typescript
const nodeMaterial = new MeshBasicNodeMaterial()
nodeMaterial.fragmentNode = outputNode  // TSL node for fragment output
renderer.setRenderTarget(null)
renderer.render(this.scene, this.camera)
```

**TSL Passthrough (in RenderGraphTSL)**:
```typescript
const nodeMaterial = new MeshBasicNodeMaterial()
nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)  // Uses outputNode, not fragmentNode
renderer.setRenderTarget(outputTarget)
renderer.render(this.passthroughScene, this.passthroughCamera)
```

#### Key Observations

1. **outputNode vs fragmentNode**:
   - `outputNode` - for MRT outputs and advanced configurations
   - `fragmentNode` - completely replaces fragment shader
   - Passthrough uses `outputNode`, ToScreenPassTSL uses `fragmentNode` (after our change)

2. **Screen rendering (null target)**:
   - Both WebGL and TSL use `renderer.setRenderTarget(null)` + `renderer.render(scene, camera)`
   - But WebGPU might handle null target differently

3. **MRT is NOT implemented for WebGPU**:
   - The code explicitly skips MRT initialization for WebGPU
   - But passes still output to MRT targets
   - This could cause silent failures!

### Hypothesis: Missing WebGPU MRT Configuration

The scene pass and other passes render to MRT targets (multiple textures per render target). In WebGL, `MRTStateManager` configures `gl.drawBuffers()` to enable writing to all attachments.

In WebGPU, this is **NOT configured**. WebGPU requires `renderer.setMRT()` to enable MRT, but our code doesn't call it.

**Possible failure mode**:
1. ScenePassTSL renders to MRT target
2. WebGPU only writes to first attachment (no MRT config)
3. Subsequent passes read from attachments that were never written
4. Or worse, the entire render fails silently

### MRT is NOT the Issue!

After checking the resource configuration, **SCENE_COLOR is NOT an MRT target** - it's a single texture with depth:

```typescript
g.addResource({
  id: RESOURCES.SCENE_COLOR,
  type: 'renderTarget',
  size: { mode: 'screen' },
  format: THREE.RGBAFormat,
  dataType: THREE.HalfFloatType,
  depthBuffer: true,
  depthTexture: true,
  // NO count: 2 or multiple textures
})
```

So the black screen is NOT caused by missing MRT configuration.

### Solid Red Test Failed

Modified ToScreenPassTSL to output solid red:
```typescript
return Fn(() => {
  if (import.meta.env.DEV) {
    return vec4(float(1.0), float(0.0), float(0.0), float(1.0)) // SOLID RED
  }
  ...
})()
```

**Result**: Still black! This proves the issue is NOT in texture sampling but in the fundamental material/render pipeline.

### Material Node Property Investigation

Tried both:
- `nodeMaterial.outputNode = outputNode` (original)
- `nodeMaterial.fragmentNode = outputNode` (changed)

Neither produces visible output.

### R3F Canvas Configuration

The Canvas uses `frameloop="never"`:
```tsx
<Canvas
  frameloop="never"
  gl={createRenderer}
  ...
/>
```

This means R3F doesn't automatically render frames. Something else drives the frame loop.

**Need to investigate**: How does frame advance work with `frameloop="never"`?

### Renderer Creation

WebGPU renderer is created correctly:
```typescript
const renderer = new WebGPURenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
})
await renderer.init()
```

### useFrame Drives Render Loop

In PostProcessingV2TSL.tsx, `useFrame` callback calls `graphInstance.execute()`:
```typescript
useFrame((_, delta) => {
  graphInstance.execute(gl, scene, camera, delta, 0)
}, FRAME_PRIORITY.POST_EFFECTS)
```

### Next Investigation Areas

1. **Frame advance mechanism**: How does `frameloop="never"` interact with `useFrame`? Is frame presentation happening?
2. **WebGPU canvas presentation**: Does WebGPU need explicit frame presentation?
3. **Material compilation**: Are TSL materials being compiled before render?

---

## Session 5: ROOT CAUSE FOUND - frameloop="always" Required for WebGPU (2026-01-05 continued)

### ⚠️ Screenshot FPS Counter Warning

**IGNORE FPS values in Playwright screenshots!** The FPS counter is a snapshot at screenshot time and is misleading:
- It depends on WHEN the screenshot is taken
- It does NOT represent actual performance
- The actual app runs at 120 FPS once fixed

### ROOT CAUSE IDENTIFIED

The WebGPU renderer requires `frameloop="always"` for proper frame presentation. The `frameloop="never"` + `advance()` pattern that works for WebGL does NOT work for WebGPU.

**The Problem**:
- R3F with `frameloop="never"` + `advance()` triggers useFrame callbacks but doesn't properly present WebGPU frames
- WebGPU frame presentation requires the internal animation loop mechanism
- With `frameloop="never"`, WebGPU renders to the canvas but the frame is never presented to the screen

**The Fix** (App.tsx):
```typescript
// BEFORE (broken for WebGPU):
frameloop="never"

// AFTER (works for WebGPU):
frameloop={isWebGPUAvailable ? 'always' : 'never'}
```

### Why This Was Confusing

1. The render call count WAS increasing (renderer.info.render.calls++)
2. Debug logs showed all passes executing with valid textures
3. Even simple THREE.MeshBasicMaterial didn't render (ruled out TSL issues)
4. The canvas was present but black

All this pointed to a frame presentation issue, not a rendering issue.

### Verification

With `frameloop="always"`:
- ✅ Canvas shows solid red (from debug MeshBasicMaterial)
- ✅ Runs at 120 FPS
- ✅ useFrame callbacks execute properly

### Files Modified

1. **`src/App.tsx`** - Changed `frameloop="never"` to conditional `frameloop={isWebGPUAvailable ? 'always' : 'never'}`

### TODO: Remaining Work

1. ~~Remove debug solid red material from ToScreenPassTSL~~
2. ~~Restore proper TSL outputNode in ToScreenPassTSL~~
3. Implement FPS limiting for WebGPU mode (since we can't use `frameloop="never"` + `advance()`)
4. Verify actual scene renders (not just solid red)

### Technical Details

According to [R3F documentation](https://r3f.docs.pmnd.rs/api/canvas) and [community discussions](https://github.com/pmndrs/react-three-fiber/discussions/1339):
- WebGPURenderer requires async initialization: `await renderer.init()`
- WebGPU frame presentation works differently than WebGL
- The recommended pattern for WebGPU is `frameloop="always"` with priority-based render control

---

## Session 5 Continued: TSL Material Restoration

### Changes Made

1. **Restored TSL MeshBasicNodeMaterial** in ToScreenPassTSL (was using debug THREE.MeshBasicMaterial)
2. **Cleaned up unused imports** (removed unused `vec3`)
3. **Added debug logging** to verify pass execution

### Debug Output Confirms Render Pipeline Works

```
[ToScreenPassTSL:finalToScreen] Execute - inputTexture: 960x540
```

All passes execute correctly with valid textures:
- ScenePassTSL → 960x540
- CopyPassTSL → 960x540
- ToneMappingCinematicPassTSL → 960x540
- ToScreenPassTSL → 960x540 input

### Playwright Test Limitation

The Playwright test shows 0 non-black pixels, but this is a **known limitation** of headless WebGPU:
- SwiftShader (Playwright's software WebGPU) doesn't support `drawImage` from WebGPU canvas
- The screenshot shows a gray canvas (rendering IS happening)
- But programmatic pixel readback returns black

**Verification must be done in real browser, not Playwright.**

### Current Status

- **frameloop fix**: ✅ Complete (`frameloop="always"` for WebGPU)
- **TSL simple nodes**: ✅ Work (vec4, vec3 produce visible output)
- **TSL texture sampling**: ❌ BROKEN (black output)
- **Render pipeline**: ✅ Passes execute correctly with valid textures

---

## Session 6: TSL Texture Sampling Investigation

### What Works vs What Doesn't

| Material Type | Output | Result |
|--------------|--------|--------|
| `THREE.MeshBasicMaterial({ color: 0xff0000 })` | Solid red | ✅ RED canvas |
| `MeshBasicNodeMaterial` + `outputNode = vec4(0,0,1,1)` | Solid blue | ✅ BLUE canvas |
| `MeshBasicNodeMaterial` + `outputNode = texture(tex).sample(screenUV)` | Texture | ❌ BLACK |
| `MeshBasicNodeMaterial` + `colorNode = texture(tex)` | Texture | ❌ BLACK |

### Key Observations

1. **Simple TSL nodes work** - `vec4(r,g,b,a)` renders correctly
2. **Texture nodes don't render** - Any texture sampling produces black
3. **Input texture IS valid** - Logs show 960x540 texture available
4. **Material IS created** - MeshBasicNodeMaterial created successfully
5. **Mesh IS visible** - scene.children=1, mesh.visible=true
6. **Render call happens** - renderer.render() is called

### Hypothesis

The TSL `texture()` node may not be working correctly with WebGPU render targets in this context. Possible causes:

1. **Render target texture format mismatch** - The input texture from render graph may not be compatible with TSL texture sampling
2. **Texture binding issue** - WebGPU bind groups may not be configured correctly for the texture
3. **UV coordinate issue** - `screenUV` may not work correctly for fullscreen passes in WebGPU
4. **Texture not ready** - The texture may not be uploaded to GPU when material is created

### Next Steps

1. Check if other TSL passes (CopyPassTSL, ToneMappingCinematicPassTSL) use texture sampling successfully
2. Verify the input texture is a valid WebGPU texture (not WebGL)
3. Try using `uv` attribute instead of `screenUV`
4. Check Three.js WebGPU examples for correct fullscreen texture sampling pattern

---

## Session 7: Isolated WebGPU Test - CRITICAL FINDINGS

### Isolated Test Created

Created `public/webgpu-test.html` - a standalone page that tests WebGPU rendering **without** R3F or our render graph.

### Test Results

| Test | Description | Expected | Actual |
|------|-------------|----------|--------|
| 1 | `MeshBasicMaterial({ color: red })` | RED | ✅ PASS |
| 2 | `MeshBasicNodeMaterial` + `outputNode = vec4(0,1,0,1)` | GREEN | ✅ PASS |
| 3 | `NodeMaterial` + `fragmentNode = vec4(0,0,1,1)` | BLUE | ✅ PASS |
| 4 | Sample from `DataTexture` with `uv()` | GRAY | ✅ PASS |
| 5 | Sample `RenderTarget.texture` with `uv()` | CYAN | ✅ PASS |
| 6 | Sample `RenderTarget.texture` with `screenUV` | YELLOW | ✅ PASS |

**Screenshot showed YELLOW** - All 6 tests PASSED!

### Critical Insight

The isolated WebGPU test proves that:

1. ✅ **Basic WebGPU → screen rendering works**
2. ✅ **TSL `NodeMaterial` with `fragmentNode` works**
3. ✅ **TSL `MeshBasicNodeMaterial` with `outputNode` works**
4. ✅ **TSL `texture()` sampling works**
5. ✅ **`screenUV` coordinate system works**
6. ✅ **RenderTarget → screen pipeline works**

### What This Eliminates

The bug is **NOT** in:
- Three.js WebGPU renderer
- TSL material system
- Texture sampling with `screenUV`
- RenderTarget texture readback
- Basic fullscreen quad rendering

### What This Implicates

The bug **IS** somewhere in:
- **R3F integration** - How R3F wraps/manages the WebGPU renderer
- **Our render graph execution context**
- **Frame presentation timing** (possibly R3F auto-render overwriting our output)

### Pixel Analysis Limitation

Note: The Playwright `ctx.drawImage(canvas)` pixel analysis returns 0 for WebGPU canvases. This is a **testing limitation**, not a rendering bug. The screenshot visually shows correct rendering.

### Hypothesis: R3F Auto-Render Overwrite

With `frameloop="always"`, R3F runs:
1. All `useFrame` callbacks in priority order
2. Then R3F's default `renderer.render(scene, camera)` call

If R3F renders its main scene AFTER our PostProcessingV2TSL renders to screen, it would overwrite our output with whatever is in R3F's scene (possibly empty or different objects).

**Evidence supporting this**:
- Isolated test (no R3F) works perfectly
- App with R3F shows black screen
- Our PostProcessingV2TSL runs at priority 10 (POST_EFFECTS)
- R3F's auto-render has no priority (runs after all useFrame)

### Next Investigation Steps

1. **Verify R3F auto-render hypothesis** - Check if R3F renders after our useFrame
2. **Test with frameloop="demand"** - Only renders on invalidate(), might prevent auto-render
3. **Add render callback return value** - R3F useFrame can return `true` to prevent default render
4. **Minimal R3F test** - Create test with R3F + WebGPU + simple ToScreen pass

---

## Session 7 Continued: Structured Minimal Test Approach

### Strategy: Start Minimal, Add Components One by One

To avoid "multiple buggy components" masking each other, we'll test:

1. **Level 0**: R3F + WebGPU + solid color mesh → screen (no render graph)
2. **Level 1**: R3F + WebGPU + single fullscreen pass with solid color
3. **Level 2**: R3F + WebGPU + fullscreen pass with texture sampling
4. **Level 3**: R3F + WebGPU + ScenePass → ToScreenPass (2-pass chain)
5. **Level 4**: Full render graph

Each level must pass before moving to the next.

---

## Session 8: Systematic Level Testing - ROOT CAUSE NARROWED

### Critical Fixes Applied This Session

1. **WebGPU Depth Buffer Size Mismatch** (PostProcessingV2TSL.tsx:1292-1298)
   - Added explicit `renderer.setSize()` call for WebGPU
   - R3F's automatic resize doesn't update WebGPURenderer's internal depth buffer
   - This was causing validation errors: "depth stencil attachment size does not match"

### Level Test Results

| Level | Test | Expected | Result |
|-------|------|----------|--------|
| 0 | R3F + WebGPU + MeshBasicMaterial (bypass render graph) | RED | ✅ **RED** |
| 1 | ToScreenPassTSL + NodeMaterial + fragmentNode (solid color) | BLUE | ✅ **BLUE** |
| 2 | ToScreenPassTSL + texture sampling | Texture content | ❌ **Pending** |

### Level 0: R3F + WebGPU Basic Rendering ✅ PASSES

**Test**: Added debug code in PostProcessingV2TSL to render a simple red quad using `THREE.MeshBasicMaterial` directly to screen, bypassing the entire render graph.

```typescript
// Debug code added to useFrame
const DEBUG_SIMPLE_RENDER = true
if (DEBUG_SIMPLE_RENDER) {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  )
  scene.add(mesh)
  gl.setRenderTarget(null)
  gl.render(scene, camera)
}
```

**Result**: Screenshot shows RED canvas. **R3F + WebGPU basic rendering WORKS.**

### Level 1: ToScreenPassTSL Solid Color ✅ PASSES

**Test**: Modified ToScreenPassTSL to output solid blue color instead of texture sampling:

```typescript
const DEBUG_SOLID_COLOR = true
const fragmentNode = DEBUG_SOLID_COLOR
  ? vec4(float(0), float(0), float(1), float(1)) // Solid blue
  : Fn(() => texNodeRef.sample(screenUV))()
```

**Result**: Screenshot shows BLUE canvas. **NodeMaterial + fragmentNode + render to screen WORKS.**

### What This Proves

The issue is **NOT** in:
- ✅ R3F + WebGPU integration
- ✅ `frameloop="always"` behavior
- ✅ Our render graph execution flow
- ✅ NodeMaterial with fragmentNode
- ✅ Rendering to null target (screen)
- ✅ Our useFrame priority (10) disabling R3F auto-render

The issue **IS** specifically in:
- ❌ **TSL texture sampling** - `texture().sample(screenUV)` produces black output

### R3F Auto-Render Hypothesis: DISPROVEN

The earlier hypothesis that R3F was overwriting our output is **WRONG**.

According to [R3F docs](https://r3f.docs.pmnd.rs/api/hooks): passing a numerical renderPriority to useFrame disables automatic rendering. Our `FRAME_PRIORITY.POST_EFFECTS = 10` correctly disables R3F's default render.

The proof: Level 1 (solid blue through ToScreenPassTSL) renders correctly, meaning our render graph IS the only thing rendering to screen.

### Next Step: Level 2 - Texture Sampling

The bug is isolated to TSL texture sampling. Need to test:
1. Is the texture actually bound correctly?
2. Is `screenUV` providing correct coordinates?
3. Is there a format mismatch between RenderTarget and texture sampler?

### Debug Code Locations

- `src/rendering/environment/PostProcessingV2TSL.tsx:1340` - DEBUG_SIMPLE_RENDER flag
- `src/rendering/graph-tsl/passes/ToScreenPassTSL.ts:236` - DEBUG_SOLID_COLOR flag

---

## Session 8 Continued: ROOT CAUSE IDENTIFIED

### Root Cause: WebGPU Bind Groups Fixed at Material Compile Time

**The Problem**: TSL passes create texture nodes with placeholder textures, then update `.value` at runtime:

```typescript
// BROKEN PATTERN (common in many passes):
ensureMaterial() {
  this.texNode = texture(this.placeholderTexture) // Bind group fixed here!
  this.material = new NodeMaterial()
  this.material.fragmentNode = this.texNode
}

execute() {
  this.texNode.value = actualTexture // Too late! Bind group already compiled
}
```

**Why it fails**: WebGPU bind groups (texture bindings) are fixed at material compilation time. Unlike WebGL uniforms, updating `.value` after material creation does NOT update what texture is sampled.

### The Fix

Create texture node with the REAL texture BEFORE material compilation:

```typescript
// CORRECT PATTERN:
execute() {
  const inputTex = ctx.getReadTexture(resourceId)
  if (!this.material) {
    this.texNode = texture(inputTex) // Real texture!
    this.material = new NodeMaterial()
    this.material.fragmentNode = this.texNode
  }
  // Subsequent frames: update .value (may or may not work, but first frame is critical)
  if (this.texNode) this.texNode.value = inputTex
}
```

### Passes Fixed So Far

| Pass | Status |
|------|--------|
| ToScreenPassTSL | ✅ Fixed |
| CopyPassTSL | ✅ Fixed |
| ToneMappingCinematicPassTSL | ✅ Fixed |
| FXAAPassTSL | ❌ Has issue |
| SMAAPassTSL | ❌ Unknown |
| BloomPassTSL | ❌ Has issue |
| CompositePassTSL | ❌ Has issue |
| GravitationalLensingPassTSL | ❌ Has issue |
| ToneMappingPassTSL | ❌ Has issue |

### Key Finding: Hypercube Renders Direct but Not Through Graph

- ✅ **Direct scene → screen**: Hypercube visible (green wireframe)
- ❌ **Scene → ScenePassTSL → chain → ToScreenPassTSL**: Black

This confirms the issue is in texture sampling between passes, NOT in scene rendering itself.

### Active Pass Chain (from console logs)

1. **ScenePassTSL** → SCENE_COLOR (writes scene to target)
2. **CopyPassTSL** → SCENE_COMPOSITE (copies, FIXED)
3. **ToneMappingCinematicPassTSL** → TONEMAPPED_OUTPUT (reads lensingOutput, FIXED)
4. **ToScreenPassTSL** → screen (reads AA_OUTPUT, FIXED)

Missing link: lensingOutput is aliased from multiple disabled passes. The aliasing chain:
- SSR (disabled) → skipPassthrough → alias
- Refraction (disabled) → skipPassthrough → alias
- Lensing (disabled) → skipPassthrough → alias

### Current Hypothesis

The resource aliasing mechanism works, but somewhere in the chain a pass is using the old placeholder texture pattern. Need to trace the EXACT texture that ToScreenPassTSL receives.

---

## Session 8 Final: MINIMAL TEST SUCCESS

### Breakthrough: Minimal Pipeline Works!

Created a minimal test that bypasses all render graph complexity:

```typescript
// In PostProcessingV2TSL.tsx useFrame
if (DEBUG_MINIMAL_GRAPH) {
  // Step 1: Render scene to temp target
  const tempTarget = new THREE.WebGLRenderTarget(960, 540, {
    type: THREE.UnsignedByteType,
  })
  gl.setRenderTarget(tempTarget)
  gl.render(scene, camera)

  // Step 2: Sample temp target to screen with NodeMaterial
  const texNode = texture(tempTarget.texture)
  const material = new NodeMaterial()
  material.fragmentNode = texNode

  const debugMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  gl.setRenderTarget(null)
  gl.render(debugScene, debugCamera)
}
```

**Result**: ✅ **HYPERCUBE EDGES RENDER!** (screenshot shows green wireframe tesseract)

### What This Proves

| Test | Result | Conclusion |
|------|--------|------------|
| Direct scene → screen | ✅ Works | R3F + WebGPU basic rendering OK |
| Minimal: scene → target → texture sample → screen | ✅ Works | Texture sampling from RenderTarget OK |
| Full render graph | ❌ Black | Issue in resource aliasing chain |

### Root Cause Narrowed

The issue is **NOT** in:
- WebGPU texture sampling fundamentals
- NodeMaterial + fragmentNode pattern
- RenderTarget texture binding

The issue **IS** in:
- Resource aliasing chain in the render graph
- Multiple disabled passes with `skipPassthrough: true` create alias chains
- Somewhere in: SCENE_COLOR → SCENE_COMPOSITE → (aliases) → lensingOutput → (aliases) → AA_OUTPUT

### Active Pass Chain (console logs)

```
ScenePassTSL:scene → SCENE_COLOR (960x540)
CopyPassTSL:cloudComposite → SCENE_COMPOSITE (fixed)
[... aliased passes ...]
ToneMappingCinematicPassTSL → reads lensingOutput, writes tonemappedOutput (fixed)
[... aliased passes ...]
ToScreenPassTSL → reads AA_OUTPUT (fixed)
```

### Passes with Placeholder Texture Issue (need fixing)

From `grep -l "placeholderTexture"`:
- BloomPassTSL.ts
- CompositePassTSL.ts
- CopyPassTSL.ts ✅ Fixed
- FXAAPassTSL.ts
- GravitationalLensingPassTSL.ts
- ToScreenPassTSL.ts ✅ Fixed
- ToneMappingCinematicPassTSL.ts ✅ Fixed
- ToneMappingPassTSL.ts

### Next Steps

1. ~~Trace the exact alias chain from SCENE_COLOR to AA_OUTPUT~~
2. ~~Check if passthrough copy (when skipPassthrough=false) has the same texture binding issue~~
3. ~~Fix remaining passes OR fix the central passthrough mechanism~~

---

## Session 9: BLACK SCREEN BUG FIXED ✅

### Two Critical Bugs Found and Fixed

#### Bug 1: Passthrough Material Caching (RenderGraphTSL.ts)

**The Problem**: The passthrough mechanism cached a single material and tried to update `texNode.value` at runtime:

```typescript
// BROKEN - getPassthroughMaterial()
let material = this.passthroughMaterials.get(attachmentCount)
if (!material) {
  texNode = texture(inputTexture) // First texture bound here
  material = new MeshBasicNodeMaterial()
  material.outputNode = vec4(texNode.rgb, texNode.a)
  this.passthroughMaterials.set(attachmentCount, material)
}
texNode.value = inputTexture // Too late for WebGPU!
```

**Why It Failed**: WebGPU bind groups are fixed at material compilation time. The first passthrough bound its input texture, then ALL subsequent passthroughs sampled that same (wrong!) texture.

**The Fix**: Create a NEW material for each passthrough copy:

```typescript
// FIXED - createPassthroughMaterial()
private createPassthroughMaterial(inputTexture: THREE.Texture): THREE.Material {
  const texNode = texture(inputTexture, uv()) // Fresh material with exact texture
  const nodeMaterial = new MeshBasicNodeMaterial()
  nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)
  return nodeMaterial
}
```

#### Bug 2: skipPassthrough Not Forwarded in Pass Constructors

**The Problem**: Several passes didn't forward `skipPassthrough` to the parent constructor:

```typescript
// BROKEN - BloomPassTSL, ToneMappingPassTSL, etc.
super({
  id: config.id,
  inputs: [...],
  outputs: [...],
  enabled: config.enabled,
  // MISSING: skipPassthrough: config.skipPassthrough
})
```

**Why It Failed**: When these passes were disabled, `skipPassthrough` defaulted to undefined/false, triggering passthrough COPIES instead of zero-cost ALIASES. Combined with Bug 1, this caused the wrong texture to be sampled.

**Passes Fixed**:
- BloomPassTSL.ts (line 285)
- ToneMappingPassTSL.ts (line 161)
- GravitationalLensingPassTSL.ts (line 82)
- CompositePassTSL.ts (line 244)

### Before vs After (Debug Logs)

**BEFORE** (Bloom using passthrough copy):
```
[RenderGraphTSL:passthrough] Aliasing sceneComposite → gtaoOutput
[RenderGraphTSL:passthrough] Passthrough gtaoOutput → bloomOutput  ⚠️ WRONG!
```

**AFTER** (Bloom using alias):
```
[RenderGraphTSL:passthrough] Aliasing sceneComposite → gtaoOutput
[RenderGraphTSL:passthrough] Aliasing gtaoOutput → bloomOutput  ✅ CORRECT!
```

### Verification

After fixes:
- ✅ Hypercube renders with edges
- ✅ Hypercube renders with faces (red debug color)
- ✅ Render graph passes execute correctly
- ✅ Alias chains resolve properly

### Files Modified

| File | Change |
|------|--------|
| `RenderGraphTSL.ts` | Replaced cached passthrough material with fresh material per copy |
| `BloomPassTSL.ts` | Added `skipPassthrough: config.skipPassthrough` to super() |
| `ToneMappingPassTSL.ts` | Added `skipPassthrough: config.skipPassthrough` to super() |
| `GravitationalLensingPassTSL.ts` | Added `skipPassthrough: config.skipPassthrough` to super() |
| `CompositePassTSL.ts` | Added `skipPassthrough: config.skipPassthrough` to super() |

### Key Insight: WebGPU Bind Group Behavior

**CRITICAL FOR WEBGPU**: Unlike WebGL uniforms, WebGPU bind groups (including texture bindings) are fixed at material/pipeline compilation time. You CANNOT:
- Create a material with a placeholder texture and update `.value` later
- Cache materials and reuse them with different textures

You MUST:
- Create texture nodes with the ACTUAL runtime texture BEFORE material compilation
- Create fresh materials when the bound texture changes

---

## Session 10: Remaining WebGPU Issues

### Current Status After Black Screen Fix

| Object Type | Edges | Faces | Notes |
|-------------|-------|-------|-------|
| Polytopes (Cube, etc.) | ✅ Render | ⚠️ Red (debug) | Need to remove debug color |
| Mandelbulb | ❌ Black | ❌ Black | Raymarcher not rendering |
| Quaternion Julia | ❌ Black | ❌ Black | Raymarcher not rendering |
| Schrödinger | 💥 Crash | 💥 Crash | App crashes on switch |

### Debug Code Still Active

**PolytopeSceneTSL.tsx (line 443)**:
```typescript
mat.colorNode = vec3(1, 0, 0) // solid red - DEBUG CODE
```

This needs to be replaced with proper color implementation.

### Next Investigation Areas

1. **Polytope Colors**: Remove debug red, implement proper colorNode
2. **Mandelbulb/Julia**: Check raymarcher TSL materials for same bind group issue
3. **Schrödinger Crash**: Investigate crash cause (likely material or geometry issue)

---

## Session 11: Polytope Full Shading Fixed ✅

### Bug: Face Animation Not Working

**Symptom**: Edges animated correctly during rotation, but faces stayed static (didn't animate).

**Root Cause**: The uniform update code was guarded by mesh ref checks:

```typescript
// BROKEN - mesh ref could be null during compilation or remount
if (faceMeshRef.current) {
  updateNDTransformUniforms(uniforms.ndTransform, ...)
}
```

In WebGPU, uniform buffers must be updated every frame regardless of mesh state. The mesh ref check was preventing face uniform updates.

**Fix Applied** (PolytopeSceneTSL.tsx):

```typescript
// FIXED - Always update uniforms for WebGPU animation to work
updateNDTransformUniforms(
  uniforms.ndTransform,
  gpuData,
  dimension,
  visualScale,
  projectionDistance
)
```

### Full Shading Composition Enabled

Removed debug `vec3(1, 0, 0)` solid red and enabled `composePolytopeTSLShading()` which provides:

- ✅ Color algorithms (monochromatic, cosine palette, LCH, etc.)
- ✅ Multi-light shading (up to 4 lights)
- ✅ Ambient lighting
- ✅ Screen-space normals
- ✅ PBR parameters (roughness, metallic)
- ✅ Optional: Fresnel rim lighting
- ✅ Optional: Subsurface scattering (SSS)
- ✅ Optional: Image-based lighting (IBL)
- ✅ Optional: Shadow mapping

### Updated Status

| Object Type | Edges | Faces | Notes |
|-------------|-------|-------|-------|
| Polytopes (Cube, etc.) | ✅ Render | ✅ Render | Full shading working! |
| Mandelbulb | ❌ Black | ❌ Black | Raymarcher not rendering |
| Quaternion Julia | ❌ Black | ❌ Black | Raymarcher not rendering |
| Schrödinger | 💥 Crash | 💥 Crash | App crashes on switch |

### Files Modified

| File | Change |
|------|--------|
| `PolytopeSceneTSL.tsx` | Removed mesh ref checks from uniform updates |
| `PolytopeSceneTSL.tsx` | Enabled `composePolytopeTSLShading()` for full coloring |

### Key WebGPU Insight

**CRITICAL**: In WebGPU/TSL, always update uniforms every frame without conditional checks. Unlike WebGL where uniforms can be lazily updated, WebGPU uniform buffers need consistent updates for animation to work correctly.

---

## Session 12: TSL Shadow System Investigation

### Problem

When shadows are enabled (`DEFAULT_SHADOW_ENABLED = true`), WebGPU throws "Invalid PipelineLayout" errors:

```
THREE.[Invalid PipelineLayout (unlabeled)] is invalid.
 - While calling [Device].CreateRenderPipeline([RenderPipelineDescriptor "renderPipeline_MeshBasicNodeMaterial_58"]).
```

Polytope faces do NOT render when this error occurs.

### What Works vs What Fails

| Scenario | Result |
|----------|--------|
| Shadows disabled | ✅ Faces render correctly |
| Shadows enabled | ❌ Invalid PipelineLayout error, faces don't render |

### Root Cause Analysis

The TSL shadow sampling functions in `src/rendering/tsl/shadows/` have **nested Fn() calls** which create pipeline layout issues:

```typescript
// shadow-sampling.ts - Structure causes pipeline issues
export const sampleDirectionalSpotShadow = (uniforms) =>
  Fn(([lightIndex, worldPos]) => {
    const hardShadow = sampleShadowHard(uniforms)   // Returns Fn()
    const pcfShadow = sampleShadowPCF(uniforms)     // Returns Fn()

    return select(usePCF,
      pcfShadow(lightIndex, worldPos),   // Calls nested Fn()
      hardShadow(lightIndex, worldPos)   // Calls nested Fn()
    )
  })

// sampleShadowHard also calls:
// - sampleShadowMapByIndex(uniforms) → returns Fn()
// - getShadowCoordByIndex(uniforms)  → returns Fn()
```

This creates a chain of 3-4 nested Fn() calls with texture sampling, which causes WebGPU pipeline layout compilation to fail.

### Approaches Tried

1. **Inline shadow sampling in multiLightNode** - Still failed because the texture nodes were passed through function parameters instead of being directly captured in closure.

2. **Follow GroundPlaneMaterialTSL pattern** (shadow samplers OUTSIDE Fn) - Still failed because the underlying shadow sampling functions have nested Fn() calls internally.

3. **Create shadow samplers at material creation time** - The `sampleDirectionalSpotShadow` and `samplePointShadow` functions themselves have nested Fn() which breaks WebGPU.

### Why GroundPlaneMaterialTSL Might Also Be Affected

Both `PolytopeSceneTSL` and `GroundPlaneMaterialTSL` use the same shadow sampling functions from `src/rendering/tsl/shadows/`. The "MeshBasicNodeMaterial_58" in the error could be either material.

### Required Fix

The shadow sampling system needs a **fundamental restructure** to avoid nested Fn() calls:

1. **Flatten the sampling chain** - Instead of:
   - `sampleDirectionalSpotShadow` → `sampleShadowHard` → `sampleShadowMapByIndex`

   Create a single flat Fn() that does all shadow sampling inline.

2. **Pre-sample all textures at top level** - Sample all 4 shadow maps ONCE at the start of the shader, then use select() on the pre-computed float values (not texture nodes).

3. **No texture sampling inside nested Fn()** - Texture nodes must be sampled at the TOP level of the composing Fn(), not passed through callbacks or nested function calls.

### Temporary Resolution

Shadows are disabled until the shadow system is restructured:

```typescript
// src/rendering/shadows/constants.ts
export const DEFAULT_SHADOW_ENABLED = false // TSL shadow samplers cause Invalid PipelineLayout
```

### Files Involved

| File | Role |
|------|------|
| `src/rendering/tsl/shadows/shadow-sampling.ts` | Dir/Spot shadow sampling - has nested Fn() |
| `src/rendering/tsl/shadows/point-shadow.ts` | Point shadow sampling - has nested Fn() |
| `src/rendering/tsl/shadows/shadow-precompute.ts` | Pre-computed shadow approach (attempted fix) |
| `src/rendering/tsl/compose/polytope/polytope-compose.ts` | Polytope shader composition |
| `src/rendering/tsl/lighting/mesh-lighting.ts` | Multi-light node with shadow callback |

### Key Insight: TSL Fn() Scoping

**CRITICAL**: In TSL/WebGPU, texture sampling nodes created inside nested Fn() calls are bound to the WRONG pipeline layout scope. All texture sampling must happen at the TOP level of the shader graph, with results stored in variables that can be passed to sub-functions.

The pattern that works:
```typescript
// Top level Fn() - textures sampled here
const shadingFn = Fn(() => {
  const shadow0 = shadowMap0.sample(uv)  // Direct sampling at top level
  const shadow1 = shadowMap1.sample(uv)
  // ... use shadow0, shadow1 as floats
})
```

The pattern that FAILS:
```typescript
// Nested Fn() structure - texture sampling in wrong scope
const getShadow = Fn(() => {
  return shadowMap.sample(uv)  // Texture in nested Fn() = BROKEN
})

const shadingFn = Fn(() => {
  const shadow = getShadow()  // Calling nested Fn()
})
```

---

## Session 13: Shadow System Fix Attempt - FAILED

### Problem Recap

When shadows enabled (`DEFAULT_SHADOW_ENABLED = true`), polytope faces don't render due to "Invalid PipelineLayout" WebGPU errors.

### Attempted Fix (WRONG)

Tried using `createMultiLightNodeWithShadows` which does "inline" shadow sampling inside its Fn() body.

### Why It Failed - CRITICAL INSIGHT

**The fix was based on a MISUNDERSTANDING of "inline".**

The structure is STILL nested Fn() calls:

```
composePolytopeTSLShading returns:
Fn(() => {                                    // LEVEL 1 (outermost)
  ...
  const lightResult = multiLightNode(...)     // CALLS Level 2
})

multiLightNode = createMultiLightNodeWithShadows(...) returns:
Fn(() => {                                    // LEVEL 2 (NESTED!)
  shadowMap0.sample(uv)                       // Texture sampling in NESTED Fn() = BROKEN
  shadowMap1.sample(uv)
  ...
})
```

**The "inline" sampling is inside createMultiLightNodeWithShadows's Fn() body, but that Fn() is INVOKED from inside composePolytopeTSLShading's Fn() body. This is STILL nested Fn() with texture sampling!**

### WebGPU Pipeline Layout Rule (MUST REMEMBER)

**ALL texture sampling must happen in the OUTERMOST Fn() body - the one that becomes material.colorNode or material.fragmentNode.**

Any Fn() that is CALLED from inside another Fn() is nested. Texture sampling in nested Fn() breaks WebGPU pipeline layout.

### Two Functions in mesh-lighting.ts

1. **`createMultiLightNode`** (lines 346-551):
   - Takes `precomputedShadows` as 7th PARAMETER to its Fn()
   - Uses `select()` on the passed-in vec4 floats
   - Does NOT sample textures inside
   - **THIS IS THE CORRECT ONE TO USE**

2. **`createMultiLightNodeWithShadows`** (lines 586-812):
   - Samples textures INSIDE its Fn() body
   - When called from another Fn(), creates nested texture sampling
   - **THIS IS BROKEN FOR NESTED USE**

### Correct Fix (NOT YET IMPLEMENTED)

```typescript
// In composePolytopeTSLShading:
return Fn(() => {
  // STEP 1: Sample ALL shadow textures HERE at TOP level (OUTERMOST Fn)
  let precomputedShadows: Vec4Node
  if (shadowUniforms) {
    const s0 = shadowUniforms.uShadowMap0.sample(computeUV0)
    const s1 = shadowUniforms.uShadowMap1.sample(computeUV1)
    const s2 = shadowUniforms.uShadowMap2.sample(computeUV2)
    const s3 = shadowUniforms.uShadowMap3.sample(computeUV3)
    precomputedShadows = vec4(s0, s1, s2, s3)
  } else {
    precomputedShadows = vec4(1, 1, 1, 1)
  }

  // STEP 2: Use createMultiLightNode (not WithShadows) with 7 parameters
  const lightResult = multiLightNode(
    positionWorld, faceNormal, viewDir, surfaceColor, roughness, metallic,
    precomputedShadows  // 7th parameter - pre-sampled floats, NO textures!
  )
})
```

### Why Playwright Test Passed But User Reports Failure

The test likely checks if ANY pixels render (edges render fine with different material). The faces with complex shading fail silently - the "Invalid PipelineLayout" error prevents face material from compiling, but edges still render.

### Files That Need Fixing

| File | Current State | Required Fix |
|------|---------------|--------------|
| `polytope-compose.ts` | Uses `createMultiLightNodeWithShadows` (WRONG) | Sample shadows in OUTERMOST Fn(), use `createMultiLightNode` with 7 params |
| `GroundPlaneMaterialTSL.tsx` | Uses `createMultiLightNodeWithShadows` (WRONG) | Same pattern |

### Key Rule to Remember

```
┌─────────────────────────────────────────────────────────────────┐
│ TEXTURE SAMPLING SCOPE RULE FOR WEBGPU/TSL:                    │
│                                                                 │
│ Texture.sample() calls MUST be in the OUTERMOST Fn() body     │
│ that becomes material.colorNode/fragmentNode.                   │
│                                                                 │
│ Any Fn() that is CALLED from inside another Fn() is NESTED.   │
│ Texture sampling in nested Fn() = "Invalid PipelineLayout"    │
│                                                                 │
│ Pass sampled VALUES (floats, vec3, vec4) to nested functions.  │
│ Nested functions must ONLY do math on passed-in values.        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session 14: uniformArray.element() ROOT CAUSE FIXED ✅

### Problem

When shadows enabled (`DEFAULT_SHADOW_ENABLED = true`), WebGPU throws "Invalid PipelineLayout" errors:

```
THREE.[Invalid PipelineLayout (unlabeled)] is invalid.
 - While calling [Device].CreateRenderPipeline([RenderPipelineDescriptor "renderPipeline_MeshBasicNodeMaterial_58"]).
```

### Root Cause Identified: uniformArray.element() BROKEN in WebGPU

Through systematic isolation testing, we discovered that **`uniformArray.element()` causes "Invalid PipelineLayout" WebGPU errors**.

**Isolation Test Method**:
1. Disabled all shadow texture sampling → Still failed
2. Disabled shadow matrix transforms → Still failed
3. Disabled `uniformArray.element()` access, returned `vec4(1,1,1,1)` → **WORKED!**

**Conclusion**: The `uniformArray.element(index)` TSL function is incompatible with WebGPU pipeline layout compilation.

### The Fix

Replace `uniformArray` with `vec4` uniform and access via `.x/.y/.z/.w` components:

**BEFORE (BROKEN)**:
```typescript
// shadow-uniforms.ts
uLightCastsShadow: UniformArrayNode<number>
const uLightCastsShadow = uniformArray([0, 0, 0, 0])

// Access via element()
const castsShadow = uniforms.uLightCastsShadow.element(lightIndex).greaterThan(0.5)
```

**AFTER (WORKING)**:
```typescript
// shadow-uniforms.ts
uLightCastsShadow: UniformNode<Vector4>
const uLightCastsShadow = uniform(new Vector4(0, 0, 0, 0))

// Access via vec4 components with select chain
const castsShadowValue = select(
  lightIndex.equal(0),
  uniforms.uLightCastsShadow.x,
  select(
    lightIndex.equal(1),
    uniforms.uLightCastsShadow.y,
    select(
      lightIndex.equal(2),
      uniforms.uLightCastsShadow.z,
      uniforms.uLightCastsShadow.w
    )
  )
)
const castsShadow = castsShadowValue.greaterThan(0.5)
```

### Files Modified

| File | Change |
|------|--------|
| `src/rendering/tsl/shadows/shadow-uniforms.ts` | Changed `uniformArray` to `uniform(new Vector4())`, updated type and update function |
| `src/rendering/tsl/shadows/index.ts` | Changed `.element()` to select chain with vec4 components |
| `src/rendering/tsl/shadows/shadow-flat.ts` | Same pattern |
| `src/rendering/tsl/compose/polytope/polytope-compose.ts` | Same pattern |
| `src/rendering/tsl/lighting/mesh-lighting.ts` | Same pattern |
| `src/rendering/tsl/materials/GroundPlaneMaterialTSL.tsx` | Same pattern |

### Key Insight: uniformArray.element() WebGPU Incompatibility

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CRITICAL TSL/WEBGPU RULE:                                                   │
│                                                                             │
│ uniformArray.element(index) is BROKEN in WebGPU!                            │
│                                                                             │
│ It causes "Invalid PipelineLayout" errors during CreateRenderPipeline.     │
│                                                                             │
│ WORKAROUND: For small arrays (≤4 elements), use vec4 uniform and access    │
│ via .x/.y/.z/.w with select() chains for dynamic indexing.                  │
│                                                                             │
│ For larger arrays, consider:                                                │
│ - Pre-computing values outside shader                                       │
│ - Using texture lookup instead of array                                     │
│ - Splitting into multiple vec4 uniforms                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification

After applying the fix:
- ✅ Polytope faces render with shadows enabled
- ✅ No "Invalid PipelineLayout" errors
- ✅ Shadow system compiles correctly

---

## Related Documentation

- `docs/tsl.md` - TSL patterns and WebGPU migration guide (see uniformArray section)
- `docs/architecture.md` - Rendering architecture overview
- Three.js WebGPU examples and documentation
- WebGPU best practices for frame timing
