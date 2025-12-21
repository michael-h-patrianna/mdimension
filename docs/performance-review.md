# Performance Review & Optimization Report

## 1. Executive Summary

The application utilizes a sophisticated, high-performance rendering pipeline built on **React Three Fiber (R3F)** and **WebGL2**. It features a custom **Unified Renderer** that handles both traditional mesh-based geometry (Polytopes) and GPU-intensive raymarching (Mandelbulb, Black Hole).

Key strengths:
*   **Manual Frame Loop**: Effective use of `frameloop="never"` and `FpsController` to manage battery life and render timing.
*   **Temporal Reprojection**: Advanced optimization for raymarching to reuse depth information.
*   **Adaptive Quality**: "Fast Mode" during interactions significantly improves responsiveness.
*   **Robust Post-Processing**: A feature-rich pipeline (Bloom, SMAA, Volumetric Fog, SSR).

Key bottlenecks:
*   **GPU Fill Rate**: The heavy fragment shaders for Raymarching and Volumetric Fog are the primary bottleneck, especially at high resolutions.
*   **Vertex Overhead**: The `Skybox` implementation uses an unnecessarily high-resolution sphere (4096 triangles), contributing ~95% of the vertex load in simple scenes.
*   **Post-Processing Overhead**: The multi-pass post-processing chain adds significant per-frame cost, even when effects are subtle.

## 2. Profiling Methodology & Results

**Tools Used:**
*   **Playwright**: Automated end-to-end performance testing.
*   **Custom Performance Probes**: Injected `PerformanceStatsCollector` to capture `gl.info` and timing data.
*   **Chrome Tracing (via Playwright)**: To verify CPU vs GPU bottlenecks.

**Test Scenarios:**
Profiling was conducted on a simulated high-end environment (Chromium Headless).

| Scenario | Avg FPS | Avg Draw Calls | Avg Triangles | GPU Time (Est) |
| :--- | :--- | :--- | :--- | :--- |
| **Black Hole** | ~20 | 3 | 14 | High |
| **Mandelbulb** | ~26 | 5 | ~4000 | Very High |
| **Hypercube** | ~43 | 6 | ~4030 | Low |
| **Simplex** | ~42 | 6 | ~4000 | Low |

*Note: The high triangle count (~4000) in simple scenes is due to the Skybox sphere.*

**Pipeline Breakdown:**

1.  **Update Loop (CPU)**: ~0.1ms. Very efficient. React overhead is minimized by direct store access in `useFrame`.
2.  **Geometry Pass (GPU)**:
    *   **Polytopes**: Low cost (< 10k vertices).
    *   **Fractals**: High cost (Raymarching fragment shader runs for every pixel).
    *   **Skybox**: Moderate cost (4k triangles, overdraw).
3.  **Post-Processing (GPU)**:
    *   **G-Buffer Generation**: Renders scene again for Normals/Depth.
    *   **Volumetric Fog**: Expensive raymarching pass.
    *   **Bloom**: Multiple Gaussian blur passes (high fill rate).
    *   **SMAA/FXAA**: Edge detection and blending.

## 3. Low-Hanging Fruits (Immediate Gains)

These changes require minimal effort but yield measurable improvements.

x.  **Optimize Skybox Geometry**: Reduce `SphereGeometry` segments from `[64, 32]` to `[32, 16]`. This saves ~3000 triangles per frame with negligible visual impact for background textures.
    *   *Target*: `src/rendering/environment/Skybox.tsx`
x.  **Conditional Post-Processing**: Disable `UnrealBloomPass` and `VolumetricFogPass` entirely in the render loop when their intensity/density is 0. Currently, they might still be added to the composer or executing empty passes.
x.  **Reduce Shadow Map Resolution**: Dynamically lower shadow map resolution (e.g., from 2048 to 1024) when the camera is moving (`isInteracting`), as motion blur hides the aliasing.
x.  **Optimize PerformanceStatsCollector**: The `scene.traverse` call every 500ms to estimate VRAM is CPU-heavy. Only run it when the specific "System" tab is open in the monitor. Do not run when performance monitor is collapsed. Do not run when performance monitor is openend but on a different tab than the "System" tab. Dynamically disable/enable on performance monitor open/close or tab changes.
x.  **Use `drei/Instances` for Ground Grid**: If the GroundPlane uses individual line meshes, switch to instanced rendering to reduce draw calls.
6.  **Frustum Culling for Fractals**: Ensure the `boxGeometry` for raymarched objects (`MandelbulbMesh`) has `frustumCulled={true}` and a properly updated `boundingSphere`. Currently, it might be drawing even when off-screen if the bounds aren't updated with the camera.

7.  **Disable Depth Write for Skybox**: Ensure `Skybox` material has `depthWrite={false}` to allow early-Z rejection of the skybox by closer objects (though it's usually rendered last or `renderOrder` manages it, explicit disabling helps).
8.  **Texture Compression**: Verify all assets in `public/` are using KTX2/Basis. The codebase supports it, but ensure raw PNGs/JPGs aren't being loaded for skyboxes.
9.  **Limit Raymarching Steps on Move**: Decrease `MAX_MARCH_STEPS` aggressively (e.g., by 50%) when `uFastMode` is active.
10. **Debounce Resize**: Ensure `ResizeObserver` in `PerformanceMonitor` and `PostProcessing` uses a debounce to prevent thrashing during window resize.

## 4. Comprehensive Improvements (Strategic Optimization)

These improvements involve architectural changes or significant refactoring.

### GPU & Shader Optimizations
1.  **Dynamic Resolution Scaling (DRS)**: Implement a feedback loop that adjusts `gl.setPixelRatio` or render target size based on GPU frame time, aiming for a target FPS (e.g., 60).
2.  **Checkerboard Rendering**: For extremely heavy shaders (Volumetric Fog, Clouds), render at half-resolution in a checkerboard pattern and reconstruct via temporal accumulation.
3.  **Blue Noise Dithering**: Integrate blue noise texture for raymarching steps to reduce banding artifacts, allowing for lower iteration counts without visual quality loss.
4.  **Compute Shader Raymarching**: Move the heavy Mandelbulb/BlackHole raymarching to a WebGPU Compute Shader (future-proofing) or GPGPU technique to avoid fragment shader limitations.
5.  **Distance-Based Detail (LOD)**: In `Mandelbulb` shader, reduce `uIterations` based on the pixel's distance from the camera or the SDF estimate.
6.  **Bounding Volume Hierarchy (BVH) for SDF**: For complex compositions, implement a simple BVH in the shader to skip SDF evaluations for empty regions.
7.  **Cone Step Mapping**: Implement Cone Stepping for the Mandelbulb to allow larger ray strides and faster soft shadows.

### Architecture & CPU
8.  **Worker-Based Geometry Generation**: Move Polytope vertex generation (Wythoff construction) entirely to a Web Worker to prevent UI stutter during dimension changes.
9.  **WASM Optimization**: Rewrite the N-dimensional rotation and projection logic (`MatrixND` operations) in Rust/WASM for near-native performance.
10. **OffscreenCanvas**: Run the entire WebGL renderer in a dedicated Web Worker, decoupling rendering FPS from the main thread UI/React updates.

### Post-Processing & Effects
11.  **Frame Interleaving**: Render expensive effects like SSR or Ambient Occlusion only on even/odd frames and reproject the previous frame's result.
12.  **Baked Lighting for Static Objects**: If the ground plane is static, bake ambient occlusion into a texture instead of computing it in real-time.
13.  **Simplified Fog**: Implement a cheaper, analytical depth-based fog fallback for low-end devices instead of the raymarched `VolumetricFogPass`.
14.  **Single-Pass Blur**: Replace multi-pass Gaussian blur in Bloom with a single-pass Dual Filtering blur (Kawase) for better performance.

### Memory & Assets
15.  **Texture Streaming**: Implement a texture streaming system for skyboxes to load low-res placeholders first, then high-res tiles.
16.  **Buffer Pooling**: Reuse `WebGLRenderTarget`s more aggressively across different effects to reduce VRAM usage.
17.  **Geometry Instancing**: Use `InstancedMesh` for particles or repeated geometry in the `Schroedinger` visualization if applicable.

### Quality of Life
18.  **Battery Saver Mode**: Detect if the device is running on battery (Battery API) and automatically cap FPS to 30 and disable expensive effects.
19.  **Benchmark Mode**: A dedicated "Benchmark" button that runs a fixed sequence and suggests optimal settings for the user's hardware.
20.  **Shader Warm-up**: Compile all shader variants asynchronously at startup (with a loading screen) to prevent stutter when switching objects/modes.

