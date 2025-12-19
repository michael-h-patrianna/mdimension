# PRD: Soft Depth Intersection

## 1. Overview
Implement Z-feathering to soften the intersection between the volumetric object and the scene geometry (walls, floor).

## 2. Mathematical Concept
Fade opacity to 0 as the distance between the ray depth (`t`) and the scene depth buffer (`gl_FragCoord.z` converted to linear depth) approaches zero.

## 3. Implementation Details

### Shader: `src/rendering/shaders/schroedinger/main.glsl.ts`

Requires access to the Scene Depth Texture (already standard in deferred/forward+ pipelines, but need to ensure it's bound).

```glsl
uniform sampler2D tDepth; // Scene depth

// Inside main()
float sceneDepth = linearizeDepth(texture(tDepth, screenUV).r);
float rayDepth = tNear; // Current ray depth

// Inside Raymarch Loop
float depthDiff = sceneDepth - t;
if (depthDiff < 0.0) break; // Hit scene geometry

// Soft particle fade
float softFade = saturate(depthDiff / uSoftIntersectionDistance);
alpha *= softFade;
```

## 4. Uniforms Required
- `uSoftIntersectionDistance` (float): Distance to fade (e.g., 0.5 units).

## 5. Performance Impact
🟢 **Low Cost**: Single texture fetch at pixel start (or per step if strictly correct, but per-pixel is usually fine for the fade factor).
