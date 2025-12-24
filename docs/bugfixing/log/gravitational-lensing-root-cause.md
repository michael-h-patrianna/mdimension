# Gravitational Lensing Root Cause Analysis

**Date:** 2024-12-24
**Status:** 🔴 PARTIALLY FIXED - Wall lensing still broken
**Issue:** No gravitational lensing visible on skybox or walls around black hole

## Current State (2024-12-24 Session 2)

### What Works
- ✅ Skybox lensing via raymarcher envMap sampling
- ✅ Wall is visible
- ✅ scene.background export enabled

### What's Broken
- 🔴 Wall is NOT lensed - large elliptical dead zone around black hole
- 🔴 SSL disabled its cubemap auto-detection (to fix wall visibility)
- 🔴 Inner radius exclusion (2.5x-3.5x) creates visible "no lensing" band

### The Conflict
1. SSL auto-detecting scene.background → Wall pixels replaced with cubemap samples (wall invisible)
2. SSL NOT using scene.background → No hybrid sky sampling, wall not lensed

---

## Fixes Applied (Mipmap Issue)

The root cause of BLACK SCREEN was **mipmap generation causing WebGL binding conflicts**. When `generateMipmaps: true` was set on WebGLCubeRenderTarget, THREE.js bound the texture in a way that caused `INVALID_OPERATION` when the same texture was later used as `scene.background`.

**Fixes applied:**
1. `CubemapCapturePass.ts`: Set `generateMipmaps: false` and `minFilter: LinearFilter`
2. `DebugOverlayPass.ts`: Clear `scene.background` before rendering to prevent WebGLBackground issues
3. Re-enabled `scene.background` export in CubemapCapturePass
4. `ScreenSpaceLensingPass.ts`: Disabled auto-detection of scene.background (fixes wall visibility but breaks wall lensing)

---

## The Real Problem: SSL Depth Classification

**File:** `src/rendering/shaders/postprocessing/screenSpaceLensing.glsl.ts:173-177`

```glsl
if (uDepthAvailable) {
  depth = texture(tDepth, vUv).r;
  linearDepth = linearizeDepth(depth, uNear, uFar);
  isSky = depth > 0.99;  // <-- PROBLEM: Wall depth << 0.99, so wall is NOT sky
}
```

The shader correctly identifies wall as NOT sky (`isSky = false`). But then at line 195:

```glsl
if (uHybridSkyEnabled && uSkyCubemapAvailable && isSky) {
  // Sample cubemap with bent rays
} else {
  // Screen-space UV distortion only
}
```

**For wall pixels:**
- `isSky = false` → Enters the ELSE branch
- Uses screen-space UV distortion only
- BUT inner radius exclusion (lines 229-232) DISABLES even this distortion near the center

**Result:** Wall near black hole has NO lensing effect at all.

---

## Failed Approaches (DO NOT RETRY)

| Approach | Why It Failed |
|----------|---------------|
| SSL auto-detect scene.background | Wall pixels classified as "sky" and replaced with cubemap samples - wall disappears |
| Inner radius exclusion only | Creates visible "no lensing" band around black hole |
| Depth-based source check | Depth buffer doesn't align with visual horizon |
| Brightness check | Would break dark skybox areas |
| UV clamping outside horizon | Breaks Einstein ring formation |

---

## Potential Solutions (NOT YET TRIED)

### Option 1: Fix SSL Depth Classification for Wall Lensing
- Wall should be lensed via screen-space UV distortion (NOT cubemap sampling)
- Remove or reduce inner radius exclusion for wall pixels
- Keep cubemap sampling ONLY for actual sky pixels (depth > 0.99)

### Option 2: Remove SSL Entirely (Original Plan)
- The raymarcher already lenses the skybox correctly
- Wall lensing may not be physically accurate anyway (wall is close, lensing is for distant light)
- Simplest solution, removes ~600 lines of code

### Option 3: Capture Wall in Cubemap
- CubemapCapturePass captures SKYBOX layer only
- Could add ENVIRONMENT layer to capture
- Problem: Wall would be captured from wrong perspective (center of scene, not camera)

---

## Executive Summary

The black hole does not display gravitational lensing on the skybox or walls because **`scene.background` is never set to a CubeTexture**, and the captured cubemap from `CubemapCapturePass` is never passed to the Screen Space Lensing (SSL) pass or the black hole shader.

---

## Root Causes

### 1. scene.background Export is DISABLED

**File:** `src/rendering/graph/passes/CubemapCapturePass.ts:324-327`

```typescript
// Note: scene.background export is disabled to avoid rendering issues.
// The black hole shader reads from getLastFrameExternal('sceneBackground')
// which captures the React-managed scene.background at frame start.
// TODO: Investigate why exporting captured cubemap to scene.background causes black screen.
```

**Commit:** `a89911a` ("fix ibl reflections")

**Known Issue from `docs/bugfixing/log/ibl.md:74-76`:**
> `scene.background` export disabled - Exporting the captured cubemap to `scene.background` causes black screen. This doesn't affect IBL (uses `scene.environment`), but **may affect black hole gravitational lensing with procedural skyboxes**.

The issue was identified but marked as TODO and never resolved.

---

### 2. Black Hole Shader Receives No EnvMap

**File:** `src/rendering/renderers/BlackHole/useBlackHoleUniformUpdates.ts:478-491`

```typescript
const bg = getLastFrameExternal('sceneBackground') as THREE.Texture | null
const isCubeCompatible =
  bg &&
  ((bg as THREE.CubeTexture).isCubeTexture ||
    bg.mapping === THREE.CubeReflectionMapping ||
    bg.mapping === THREE.CubeRefractionMapping)

if (isCubeCompatible) {
  setUniform(u, 'envMap', bg)
  setUniform(u, 'uEnvMapReady', 1.0)
} else {
  // EnvMap not ready or skybox disabled - shader renders black background
  setUniform(u, 'uEnvMapReady', 0.0)  // <-- ALWAYS THIS PATH
}
```

**Result:** Since `scene.background` is never a CubeTexture, `uEnvMapReady` is ALWAYS 0.0. The black hole shader renders a black background instead of sampling the skybox with gravitationally bent rays.

---

### 3. SSL's setSkyCubemap() is Never Called

**File:** `src/rendering/graph/passes/ScreenSpaceLensingPass.ts:334-336`

```typescript
setSkyCubemap(cubemap: THREE.CubeTexture | null): void {
  this.skyCubemap = cubemap
}
```

**Evidence:** A grep search shows only 2 references to `setSkyCubemap`:
1. Definition in `ScreenSpaceLensingPass.ts:334`
2. Test call in `ScreenSpaceLensingPass.test.ts:276`

It is **never called in production code**.

**SSL's Fallback Logic (lines 227-231):**
```typescript
const backgroundCubemap =
  scene.background && (scene.background as THREE.CubeTexture).isCubeTexture
    ? (scene.background as THREE.CubeTexture)
    : null
const activeCubemap = backgroundCubemap ?? this.skyCubemap
```

**Result:** Both `scene.background` (null) and `this.skyCubemap` (null) fail. SSL cannot perform hybrid sky sampling with bent rays.

---

### 4. Skybox Component Doesn't Set scene.background

**File:** `src/rendering/environment/Skybox.tsx:636-637`

```typescript
// NOTE: scene.background and scene.environment are now handled by CubemapCapturePass
// in the render graph. This component only handles texture loading.
```

The Skybox component:
- Renders `SkyboxMesh` on the SKYBOX layer (visual rendering only)
- Loads KTX2 texture and stores in `environmentStore.classicCubeTexture`
- Does **NOT** set `scene.background`

The comment claims CubemapCapturePass handles scene.background, but that export is disabled.

---

### 5. Inner Radius Exclusion Workaround (Commit 8b04d2e)

**File:** `src/rendering/shaders/postprocessing/screenSpaceLensing.glsl.ts:211-237`

```glsl
// CRITICAL: Do NOT apply SSL distortion to the inner black hole region!
// The raymarcher already handles gravitational lensing correctly for the
// disk and horizon area. Applying SSL here causes:
//
// 1. BLACK BAND ARTIFACT: SSL samples horizon blackness and smears it
//    onto the accretion disk, creating an ugly dark band.
//
// 2. DOUBLE LENSING: The raymarcher bends light correctly. SSL on top
//    creates unrealistic "double vision" layering effects.
//
// 3. DESTROYS MOVIE LOOK: The "Interstellar" black hole aesthetic requires
//    clean Einstein rings and smooth disk gradients.

float distFromCenter = length(vUv - uBlackHoleCenter);
float innerRadius = uHorizonRadius * 2.5;  // No SSL inside this radius
float outerRadius = uHorizonRadius * 3.5;  // Full SSL outside this radius
float sslFactor = smoothstep(innerRadius, outerRadius, distFromCenter);
```

**Why This Was Added:**
Without a valid cubemap for hybrid sky sampling, SSL could only distort screen-space UVs. This caused it to sample the BLACK horizon pixels and smear them onto the accretion disk. The "fix" was to disable SSL entirely inside `2.5x` horizon radius.

This is a **workaround for the missing cubemap**, not a proper solution.

---

## Data Flow Diagram

### Current State (Broken)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SKYBOX RENDERING                            │
├─────────────────────────────────────────────────────────────────────┤
│ SkyboxMesh renders on SKYBOX layer (visual only)                    │
│ - Does NOT set scene.background                                     │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      CUBEMAP CAPTURE PASS                           │
├─────────────────────────────────────────────────────────────────────┤
│ CubemapCapturePass captures SKYBOX layer → WebGLCubeRenderTarget    │
│                              ↓                                      │
│ Exports:                                                            │
│   ✓ scene.environment (PMREM for IBL reflections on walls)          │
│   ✗ scene.background  (DISABLED - causes black screen)              │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      BLACK HOLE SHADER                              │
├─────────────────────────────────────────────────────────────────────┤
│ Reads: getLastFrameExternal('sceneBackground') → NULL               │
│ Result: uEnvMapReady = 0.0 → BLACK BACKGROUND (no lensed skybox)    │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                 SCREEN SPACE LENSING (SSL) PASS                     │
├─────────────────────────────────────────────────────────────────────┤
│ Checks: scene.background?.isCubeTexture → false (null)              │
│ Fallback: this.skyCubemap → null (setSkyCubemap never called)       │
│ Result: No hybrid sky sampling, UV distortion only                  │
│         Inner radius exclusion (2.5x-3.5x) to avoid artifacts       │
└─────────────────────────────────────────────────────────────────────┘
```

### Expected State (Working)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SKYBOX RENDERING                            │
├─────────────────────────────────────────────────────────────────────┤
│ SkyboxMesh renders on SKYBOX layer                                  │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      CUBEMAP CAPTURE PASS                           │
├─────────────────────────────────────────────────────────────────────┤
│ CubemapCapturePass captures SKYBOX layer → WebGLCubeRenderTarget    │
│                              ↓                                      │
│ Exports:                                                            │
│   ✓ scene.environment (PMREM for IBL reflections)                   │
│   ✓ scene.background  (CubeTexture for lensing)                     │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      BLACK HOLE SHADER                              │
├─────────────────────────────────────────────────────────────────────┤
│ Reads: getLastFrameExternal('sceneBackground') → CubeTexture        │
│ Result: uEnvMapReady = 1.0 → LENSED SKYBOX via bent rays            │
│                              ↓                                      │
├─────────────────────────────────────────────────────────────────────┤
│                 SCREEN SPACE LENSING (SSL) PASS                     │
├─────────────────────────────────────────────────────────────────────┤
│ Checks: scene.background?.isCubeTexture → true                      │
│ Result: Hybrid sky sampling with gravitationally bent rays          │
│         Proper Einstein ring effect on background                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Missing Connections

### What Exists But Isn't Connected

| Component | Has | Needs |
|-----------|-----|-------|
| CubemapCapturePass | `getCubemapTexture()` method | Someone to call it |
| ScreenSpaceLensingPass | `setSkyCubemap()` method | Someone to pass cubemap |
| Black hole shader | `envMap` uniform | CubeTexture from scene.background |
| PostProcessingV2 | References to both passes | Code to connect them |

### Why They're Not Connected

1. **CubemapCapturePass** was designed to export to `scene.background`, but that export was disabled due to "black screen" issues
2. **No fallback path** was implemented when the export was disabled
3. **SSL's `setSkyCubemap()`** was added as an alternative but never wired up
4. **Black hole shader** only reads from frozen frame context, which captures a null `scene.background`

---

## Potential Solutions

### Option A: Fix scene.background Export

**Approach:** Investigate WHY exporting the captured cubemap to `scene.background` causes black screen.

**Likely Causes:**
1. Render order issue - export happens too late in frame
2. Texture type mismatch - WebGLCubeRenderTarget.texture vs CubeTexture
3. Mapping configuration issue
4. Frame timing with frozen context capture

**Pros:**
- Fixes both black hole shader AND SSL automatically
- Uses existing infrastructure
- Minimal code changes if root cause is simple

**Cons:**
- Root cause unknown, may be complex
- Previous attempt failed

### Option B: Direct Cubemap Passing

**Approach:** Bypass `scene.background` entirely. Pass cubemap directly to consumers.

**Implementation:**
1. In `PostProcessingV2.tsx` useFrame, get cubemap from `CubemapCapturePass.getCubemapTexture()`
2. Pass to SSL via `setSkyCubemap(cubemap)`
3. Add new mechanism for black hole shader (either new uniform pathway or different frozen context field)

**Pros:**
- Avoids the scene.background black screen issue
- More explicit data flow
- Can be tested incrementally

**Cons:**
- More invasive changes
- Requires new mechanism for black hole shader
- Duplicates what scene.background should do

### Option C: Hybrid Approach

**Approach:** Use Option B for SSL, investigate Option A for black hole shader separately.

**Rationale:**
- SSL's `setSkyCubemap()` already exists, just needs to be called
- Black hole shader's frozen context reading is more complex
- Can deliver partial fix quickly while investigating full solution

---

## Files Involved

| File | Role |
|------|------|
| `src/rendering/graph/passes/CubemapCapturePass.ts` | Captures skybox, has disabled scene.background export |
| `src/rendering/graph/passes/ScreenSpaceLensingPass.ts` | Has unused `setSkyCubemap()` method |
| `src/rendering/renderers/BlackHole/useBlackHoleUniformUpdates.ts` | Reads null scene.background |
| `src/rendering/environment/PostProcessingV2.tsx` | Could connect the passes |
| `src/rendering/environment/Skybox.tsx` | Visual only, doesn't set scene.background |
| `src/rendering/graph/FrameContext.ts` | Captures scene.background (null) at frame start |
| `src/rendering/shaders/postprocessing/screenSpaceLensing.glsl.ts` | Has inner radius workaround |

---

## Next Steps

1. **DO NOT** make code changes until approach is approved
2. Test scene.background export in isolation to understand black screen cause
3. Decide between Option A, B, or C based on findings
4. Implement chosen solution with incremental testing
5. Remove inner radius exclusion workaround once proper lensing works

---

## Deep Research: Why scene.background Export Causes Black Screen

**Date:** 2024-12-24
**Status:** ✅ CONFIRMED AND FIXED

### Overview

When scene.background export is enabled, the **ENTIRE 3D view goes black** (not just the skybox). This includes the hypercube and all objects. This suggests WebGL state corruption affecting all rendering.

### Evidence from Screenshots

| Screenshot | Description |
|-----------|-------------|
| `ibl-debug-with-bg-export.png` | ENTIRE 3D view BLACK - hypercube invisible |
| `ibl-no-background-export.png` | Hypercube renders correctly (green cube visible) |

---

### Verified Architecture (NOT the Problem)

These components work correctly:

1. **Temporal Ping-Pong Buffer**: Uses 2 buffers, read and write targets are always different
2. **MRT Safety**: ScenePass auto-disables scene.background for MRT targets
3. **Capture Feedback Prevention**: CubemapCapturePass clears scene.background during capture
4. **Texture Type**: WebGLCubeRenderTarget.texture IS a valid CubeTexture with `isCubeTexture=true`
5. **Export Timing**: Exports applied at frame end via executeExports()

---

### Likely Root Causes (Investigation Results)

#### 1. MIPMAP GENERATION CONFLICT (High Probability)

**File:** `src/rendering/graph/passes/CubemapCapturePass.ts:346-360`

```typescript
const target = new THREE.WebGLCubeRenderTarget(resolution, {
  format: THREE.RGBAFormat,
  generateMipmaps: true,  // <-- PROBLEMATIC
  minFilter: THREE.LinearMipmapLinearFilter,  // <-- REQUIRES MIPMAPS
  magFilter: THREE.LinearFilter,
});
```

**Related THREE.js Issue:** [GitHub #29628](https://github.com/mrdoob/three.js/issues/29628)

> "INVALID_OPERATION: bindTexture: textures can not be used with multiple targets"

When mipmaps are generated after rendering to a WebGLCubeRenderTarget:
1. THREE.js binds the texture for mipmap generation
2. If this texture is later used as scene.background, stale framebuffer associations may persist
3. WebGLBackground tries to sample the texture but WebGL state is corrupted

**Test:** Disable `generateMipmaps` or use `LinearFilter` instead of `LinearMipmapLinearFilter`

---

#### 2. DebugOverlayPass Triggering WebGLBackground (Medium Probability)

**File:** `src/rendering/graph/passes/DebugOverlayPass.ts:82-88`

```typescript
renderer.setRenderTarget(null);  // Renders to screen
renderer.autoClear = false;
renderer.render(scene, camera);  // Uses MAIN scene!
```

DebugOverlayPass:
- Runs LAST in the render graph (priority 10000)
- Renders the MAIN scene to screen
- If scene.background is set to WebGLCubeRenderTarget.texture, WebGLBackground attempts to render it
- This could corrupt WebGL state for subsequent frames

**Test:** Disable DebugOverlayPass when testing scene.background export

---

#### 3. THREE.js Internal Texture State Caching (Medium Probability)

THREE.js modules that might cache texture state incorrectly:
- `WebGLTextures` - tracks texture bindings
- `WebGLBackground` - caches background geometry/material
- `WebGLState` - manages WebGL state machine

When a render target texture is used as scene.background:
1. THREE.js may not properly clear framebuffer associations
2. Subsequent binding attempts fail or produce undefined behavior
3. State corruption cascades to all draw calls

---

#### 4. Render Order Between Export and Next Frame (Low Probability)

Timeline:
```
Frame N End:
  executeExports() → scene.background = readTarget.texture

Frame N+1 Start:
  externalRegistry.captureAll() → captures scene.background

Frame N+1 Execution:
  CubemapCapturePass clears scene.background temporarily
  ScenePass saves, nulls, and restores scene.background
  → During restoration, scene.background = readTarget.texture
```

Between restoration and frame end, scene.background points to a texture that was previously a render target. If any code path triggers WebGLBackground incorrectly during this window, state corruption could occur.

---

### Recommended Tests

| Test | Purpose | How |
|------|---------|-----|
| 1. Disable mipmaps | Rule out mipmap binding conflict | Set `generateMipmaps: false` in CubemapCapturePass |
| 2. Use LinearFilter | Alternative to disabling mipmaps | Set `minFilter: THREE.LinearFilter` |
| 3. Disable DebugOverlayPass | Rule out final pass corruption | Comment out DebugOverlayPass in PostProcessingV2 |
| 4. Add explicit unbind | Force clear framebuffer association | Call `gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)` after capture |
| 5. Check WebGL errors | Find exact failure point | Enable WebGL error checking in browser devtools |

---

### Related THREE.js Issues

| Issue | Description | Relevance |
|-------|-------------|-----------|
| [#29628](https://github.com/mrdoob/three.js/issues/29628) | Mipmaps not generated for WebGLArrayRenderTarget | Similar binding conflict issue |
| [#29678](https://github.com/mrdoob/three.js/pull/29678) | Fix for array render target mipmaps | Shows how binding conflicts are resolved |
| [three-ts-types #33](https://github.com/three-types/three-ts-types/pull/33) | scene.background no longer accepts WebGLCubeRenderTarget | Type definitions updated for this pattern |

---

### External Sources

- [Three.js Forum: WebGLCubeRenderTarget BG Issue](https://discourse.threejs.org/t/react-three-fiber-webglcuberendertarget-not-rendering-in-bg/45620)
- [Three.js Forum: Feedback Loop Warning](https://discourse.threejs.org/t/feedback-loop-formed-between-framebuffer-and-active-texture/54472)

---

## Related Documentation

- `docs/bugfixing/log/ibl.md` - IBL fix that disabled scene.background export
- Commit `a89911a` - "fix ibl reflections" (disabled export)
- Commit `8b04d2e` - "deactivate ssl on object itself" (inner radius workaround)
