# Bugfix Report: Skybox Switch causing Object Disappearance

## Issue
Switching from Procedural Skybox to Classic (Texture) Skybox caused the Main Object and Floor to stop rendering, while the Skybox itself rendered correctly.

## Root Cause Analysis
Two contributing factors were identified:

1.  **Texture Configuration Mismatch (Primary):**
    The `SkyboxLoader` was configuring loaded KTX2 textures with `minFilter = THREE.LinearMipmapLinearFilter`, which strictly requires mipmaps. However, many KTX2 files do not contain mipmaps, and runtime generation (`generateMipmaps`) is impossible for compressed textures.
    -   **Result:** The texture became "Texture Incomplete" in WebGL.
    -   **Symptom:** Shaders sampling this texture (Main Object PBR, Floor IBL) received `(0,0,0,1)` (black) or failed to execute properly, effectively making the objects invisible or black against a black background. The SkyboxMesh likely worked due to different sampling usage or driver leniency with `texture()` vs `textureLod()`.

2.  **Render State Synchronization (Secondary):**
    The `CubemapCapturePass` generates PMREM maps for reflections using `PMREMGenerator`. This process modifies internal WebGL state (framebuffers, viewports).
    -   **Risk:** While `PMREMGenerator` attempts restoration, it can leave the renderer in a state that the `MRTStateManager` (which patches `setRenderTarget`) tracks incorrectly, leading to desynchronization in the subsequent `ScenePass`.

## Fix Implementation

### 1. Robust Texture Configuration
Modified `src/rendering/environment/Skybox.tsx` to check for mipmap existence before setting filters.

```typescript
// Skybox.tsx
const hasMipmaps = cubeTexture.mipmaps && cubeTexture.mipmaps.length > 1;
cubeTexture.minFilter = hasMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
```

### 2. Forced State Synchronization
Modified `src/rendering/graph/passes/CubemapCapturePass.ts` to force a global state sync after PMREM generation.

```typescript
// CubemapCapturePass.ts
this.externalPmremRenderTarget = this.pmremGenerator.fromCubemap(cubeTexture);
getGlobalMRTManager().forceSync(); // Ensure MRT state matches actual driver state
```

## Verification
-   Skybox textures without mipmaps now render correctly with `LinearFilter`.
-   Render state is guaranteed clean after PMREM generation, ensuring `ScenePass` executes reliably.
