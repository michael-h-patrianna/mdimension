# GL_INVALID_OPERATION Bug Investigation Log

## Bug Description
GL_INVALID_OPERATION error appears in browser console when loading any page (e.g., http://localhost:3000/?t=hypercube).
- Only appears on initial page load
- Does NOT reproduce when switching object types after page has loaded
- All object types affected
- Requires 3 MRT attachments for temporal reprojection

## Technical Context
- Uses MRT (Multiple Render Targets) with 3 attachments for temporal reprojection
- Setting attachments to 2 is NOT a valid solution
- Bug is initialization-related, not object-type specific

---

## Investigation Session: 2025-12-23

### Initial Observations

**Error Message:**
```
GL_INVALID_OPERATION: glDrawElements: Active draw buffers with missing fragment shader outputs.
```

**Error Timing:**
- First error at: ~640ms after page load
- Errors continue for entire 5 second observation period (66-68 errors total)
- Error 1282 (GL_INVALID_OPERATION) appears BEFORE the render graph's first pass ("scene") executes

**Key Finding:**
The error is already in the WebGL error queue when the render graph starts. This means it's generated either:
1. During a previous frame
2. During useFrame callbacks with priorities < 10 (POST_EFFECTS)

### Features Ruled Out (Bug persists with all disabled)

- **Walls**: Disabled - bug still occurs
- **Post-processing effects**: Disabled - bug still occurs
- **Shadows**: Disabled - bug still occurs
- **Fog**: Disabled - bug still occurs
- **Skybox**: Classic mode (not procedural) - bug still occurs
- **Performance Monitor**: Disabled - bug still occurs
- **Scene lights**: No lights added - bug still occurs

### Debug Output Analysis

**MainObjectMRTPass logging shows:**
- First few frames: `hasShaderMaterial: false, materials: Array(0)` - pass skips render (safe)
- After ~5 frames: `hasShaderMaterial: true, materials: Array(1)` - 1 ShaderMaterial on MAIN_OBJECT layer

**MRT Creation:**
- `[PostProcessingV2] Creating MAIN_OBJECT_MRT with 3 attachments` - created twice (React StrictMode?)

### Hypotheses

1. **Something renders BEFORE the render graph** - The error is present before the first pass runs
2. **Leftover drawBuffers state** - Previous frame's MRT target may leave drawBuffers configured
3. **drei Environment component** - May do internal cubemap rendering with incompatible shaders
4. **React StrictMode double-mount** - MRT created twice, possible state inconsistency

### Code Areas Investigated

1. **MainObjectMRTPass** (`src/rendering/graph/passes/MainObjectMRTPass.ts`)
   - Has logic to skip render when no ShaderMaterial found
   - When ShaderMaterial found, only 1 material on layer - should be safe

2. **ProceduralSkyboxCapture** (`src/rendering/environment/ProceduralSkyboxWithEnvironment.tsx`)
   - Runs at priority -20 (before render graph)
   - Uses cubeCamera.update() which renders SKYBOX layer
   - Skybox shader outputs to 3 MRT locations - should be safe
   - NOT active for classic skybox mode (default)

3. **ScenePass** (`src/rendering/graph/passes/ScenePass.ts`)
   - Renders MAIN_OBJECT, ENVIRONMENT, SKYBOX to single attachment (SCENE_COLOR)
   - Comment says "main objects only render here now" but layers include MAIN_OBJECT

4. **PerformanceStatsCollector** (`src/rendering/controllers/PerformanceStatsCollector.tsx`)
   - Just wraps gl.render for timing - doesn't do any rendering itself

### Fix Attempts

1. **Disabled performance monitor** - No change, error persists
2. (More attempts to follow)

### Next Steps

1. Add GL error check at the very start of FpsController.tick() to see if error is from previous frame
2. Check if drei's Environment component does any hidden rendering
3. Investigate what happens between frame n and frame n+1 that could leave MRT state
4. Consider clearing GL error queue at frame start to isolate per-frame errors

