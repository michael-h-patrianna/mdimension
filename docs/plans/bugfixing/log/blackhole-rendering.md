# Black Hole Rendering Bug - Debug Log

## Session Started: 2025-12-20

---

## Initial State

**Test Output:**
- White pixels: 100.0%
- Black pixels: 0.0%
- Brightness range: 2 (253-255)
- Gate 1: FAIL (scene is all white)
- Gate 2: SKIPPED (depends on Gate 1)

**Console Errors:** None shader-related (only performance warnings)

**Symptom:** The screen is completely white (~RGB 254,254,254), indicating unbounded color accumulation or shader returning white.

---

## Investigation Log

### Attempt 1: Investigate Architecture

**Files to examine:**
1. `src/rendering/renderers/BlackHole/BlackHoleMesh.tsx` - Main mesh component
2. `src/rendering/shaders/blackhole/main.glsl.ts` - Fragment shader
3. `src/rendering/renderers/BlackHole/useBlackHoleUniforms.ts` - Uniforms
4. `src/rendering/renderers/BlackHole/useBlackHoleUniformUpdates.ts` - Updates

**Hypothesis:** Based on "all white" symptom, likely causes:
- Unbounded color accumulation in raymarch loop
- Bloom boost too high
- Early shader return with white color
- Transmittance not cutting off properly

---

### Attempt 2: Compare with Working Mandelbulb

**Comparison of vertex shaders:**

**Mandelbulb (WORKING) - `mandelbulb.vert`:**
```glsl
void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = worldPosition.xyz;  // World-space position
    gl_Position = projectionMatrix * viewMatrix * worldPosition;  // Standard MVP
}
```

**BlackHole (BROKEN) - `generateBlackHoleVertexShader()` in `compose.ts`:**
```glsl
void main() {
    vPosition = position;  // Local position - NOT world space!
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);  // Direct NDC - IGNORES CAMERA!
}
```

**ROOT CAUSE IDENTIFIED:**
The black hole vertex shader is incorrect. It:
1. Outputs `vPosition` in local space instead of world space
2. Uses direct NDC coordinates (`position.xy`) instead of camera transforms

This causes:
- `vPosition` values are always in [-2, 2] range (local box coords)
- The camera position has no effect on rendering
- The rayDirection calculation in fragment shader gives wrong results
- The entire box renders as if viewed from the same angle, resulting in uniform white output

**Fix:** Update `generateBlackHoleVertexShader()` to match Mandelbulb pattern.

