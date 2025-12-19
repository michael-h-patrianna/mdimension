# Physical Fog Fixes

## Issues Resolved
1. **Flickering**: The original shader used a world-space hash for dithering (`hash12(worldPos.xz)`). As the camera moved, the discrete rasterization of the depth buffer caused the world position to jump slightly, leading to visible popping in the dither pattern.
   - **Fix**: Switched to `interleavedGradientNoise(gl_FragCoord.xy)`, which is stable in screen space. This is a standard technique for temporal stability in raymarching.

2. **Turbulence Overlay**: The noise contrast was too high (`smoothstep(0.2, 0.8)`), making the fog look like a 2D texture overlay.
   - **Fix**: Softened the smoothstep to `(0.1, 0.9)` and adjusted ambient contribution to blend it better.

3. **Lack of Depth / Sky Cutoff**: The shader explicitly returned early for `depth >= 0.9999`, preventing fog from rendering against the skybox. This made the fog look like a local box rather than an atmosphere.
   - **Fix**: Removed the early return.

4. **Performance**: Raymarching the sky (infinite depth) with fixed steps is expensive and unnecessary.
   - **Fix**: Added a ray-plane intersection test against `uFogHeight`. Rays above the fog layer or looking up from within are clamped to the fog ceiling, significantly reducing the number of steps for sky pixels.

## Verification
- Ran `scripts/playwright/physical-fog-white-screen.spec.mjs`.
- Result: **PASS** (No GPU stalls, correct brightness/contrast).
