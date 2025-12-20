# AAA-Grade Volumetric Ground Fog Implementation Plan

This document outlines the implementation plan for a "Best-in-Class" AAA-grade volumetric ground fog system for the `mdimension` engine. This system replaces standard distance-based fog with a physical simulation of atmospheric scattering, fully integrated with the existing lighting, depth, and post-processing architecture.

## 1. Architecture Overview

The core shift is from **Material-Based Fog** (calculated per-pixel on objects) to **Deferred Volumetric Fog** (calculated in a post-process pass using the depth buffer).

**Key Architectural Decisions:**
*   **Deferred Rendering:** Fog is calculated in screen space using the linear depth buffer (`objectDepthTarget` / `sceneTarget.depthTexture`), decoupling it from object geometry (Meshes, SDF Fractals, Points).
*   **Shadow Integration:** The system will sample the engine's shadow maps to create dynamic volumetric shadows ("God Rays") where light is occluded by geometry.
*   **Atmospheric Physics:** Implements height-based density falloff (exp) and Henyey-Greenstein phase functions for realistic light scattering.
*   **Performance:** Uses half-resolution rendering with Blue Noise dithering and Temporal Accumulation (TAA) to achieve high quality at >60 FPS.

## 2. Implementation Steps

### Phase 1: State & Configuration
Expand the `fogSlice` to support physical parameters instead of just "color" and "distance".

**File:** `src/stores/slices/fogSlice.ts`
*   **New Fog Type:** Add `'physical'` to `FogType`.
*   **New Parameters:**
    *   `fogHeight`: Maximum height of the base fog layer (World Space Y).
    *   `fogFalloff`: Vertical decay rate (how quickly it fades up).
    *   `fogNoiseScale`: Scale of the 3D turbulence.
    *   `fogNoiseSpeed`: Velocity of the wind drift vector.
    *   `fogScattering`: Anisotropy factor (g) for phase function (-1 to 1).
    *   `volumetricShadows`: Boolean toggle (performance heavy).

### Phase 2: Asset Generation (3D Noise)
Procedural fog requires a volumetric noise texture. Loading this as a 3D texture is inefficient over the web; generating it on the GPU at startup is "best-in-class."

**File:** `src/rendering/utils/NoiseGenerator.ts`
*   **Function:** `generateNoiseTexture3D(size: number, gl: WebGL2RenderingContext)`
*   **Logic:**
    *   Create a `WebGL3DTexture`.
    *   Fill it with **Perlin-Worley noise** (a mix of low-frequency Perlin and high-frequency Worley noise).
    *   This provides the "swirly" and "wispy" look characteristic of Gothic/Horror fog.

### Phase 3: The Volumetric Shader
The core raymarching logic.

**File:** `src/rendering/shaders/postprocessing/VolumetricFogShader.ts`
*   **Inputs:**
    *   `tDepth`: Scene depth buffer.
    *   `tNoise`: The 3D noise texture.
    *   `uCameraPosition`, `uInverseViewProj`: For World Position reconstruction.
    *   `uShadowMaps[...]`: Shadow maps from `SceneLighting`.
    *   `uLightData[...]`: Light positions, colors, and shadow matrices.
*   **Fragment Shader Logic:**
    1.  **Ray Setup:** Compute Ray Origin (Camera) and Direction (Pixel World Pos - Camera).
    2.  **Raymarch Loop:** Step `N` times (e.g., 32-64) from Near Plane to `min(FarPlane, SceneDepth)`.
    3.  **Density Sample:**
        *   `HeightFactor = exp(-height * falloff)`
        *   `NoiseFactor = texture(tNoise, pos * scale + time)`
        *   `Density = baseDensity * HeightFactor * NoiseFactor`
    4.  **Lighting Calculation:**
        *   **Shadow Check:** Project sample position into Shadow Map. If occluded, contribution is 0.
        *   **Scattering:** Apply Henyey-Greenstein phase function based on angle to light.
    5.  **Accumulation:** Integrate transmittance and color (Beer-Lambert Law).

### Phase 4: The Render Pass
A custom Three.js `Pass` to manage the rendering.

**File:** `src/rendering/passes/VolumetricFogPass.ts`
*   **Inheritance:** Extends `Pass`.
*   **Responsibilities:**
    *   Manage `VolumetricFogShader` material.
    *   Bind Depth Buffer and Shadow Maps.
    *   **Optimization (Half-Res):** Render to an internal `WebGLRenderTarget` scaled to 0.5x screen size.
    *   **Dithering:** Apply Blue Noise offset to ray start position.

### Phase 5: Integration & Compositing
Wire the pass into the post-processing pipeline.

**File:** `src/rendering/environment/PostProcessing.tsx`
1.  **Instantiate:** Initialize `VolumetricFogPass`.
2.  **Pipeline Placement:** Insert *after* opaque render (`sceneTarget`) but *before* transparency/bloom.
3.  **Compositing:**
    *   Blend the fog output (RGBA) over the scene.
    *   **Bilateral Upsample:** If using half-res, use a bilateral blur shader during the copy to prevent fog bleeding across sharp depth edges.

## 3. Performance Considerations

*   **Resolution:** 50% resolution is standard for volumetric effects.
*   **Step Count:** Limited to 32-64 steps.
*   **Blue Noise + TAA:** Low sample counts create banding. We trade banding for noise using Blue Noise dithering, then clean up the noise using the engine's existing Temporal Accumulation (or `CloudTemporalPass`) strategies.
*   **Shadow Map Access:** Only the main directional light needs to cast volumetric shadows for the primary effect; secondary lights can be additive color only to save texture lookups.

## 4. Summary of Tasks
1.  **State:** Update `fogSlice.ts` with physical parameters.
2.  **Utils:** Create `NoiseGenerator.ts` for 3D textures.
3.  **Shader:** Write `VolumetricFogShader.ts` (Raymarch + Shadows).
4.  **Pass:** Create `VolumetricFogPass.ts` (Half-Res Render).
5.  **Integration:** Update `PostProcessing.tsx`.
