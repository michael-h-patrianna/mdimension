# Three.js TSL (Three Shading Language) - Modern Patterns Guide

> **Version**: Three.js r182+ (2025)
> **Purpose**: Prevent AI agents from using outdated training data patterns

This document captures critical TSL patterns that have changed significantly since 2023-2024. AI models trained on older code will produce non-functional shaders. Always follow these modern patterns.

---

## Critical Pattern Changes

### 1. Varying Creation - MUST Be Outside Fn()

**The #1 cause of WebGPU pipeline errors.**

The `varying()` function creates shader varyings for passing data between vertex and fragment stages. It MUST be called OUTSIDE of `Fn()`, with only `setInterpolation()` called inside.

```typescript
// WRONG - Causes "Invalid PipelineLayout" WebGPU error
const createShader = () => Fn(() => {
  const myVarying = varying(someNode, 'vMyValue')  // WRONG LOCATION!
  myVarying.setInterpolation('flat', 'first')
  return myVarying
})

// CORRECT - Per Three.js webgpu_centroid_sampling example
const myVarying = varying(someNode, 'vMyValue')  // OUTSIDE Fn()

const createShader = () => Fn(() => {
  myVarying.setInterpolation('flat', 'first')    // Configure INSIDE
  return texture(tex, myVarying).rgb
})
```

**Source**: [webgpu_centroid_sampling.html](https://github.com/mrdoob/three.js/blob/r182/examples/webgpu_centroid_sampling.html)

### 2. setInterpolation() API

For flat shading (no interpolation across triangle, first vertex wins):

```typescript
import { varying, attribute } from 'three/tsl'
import * as THREE from 'three'

// Create varying OUTSIDE Fn()
const faceDepthVarying = varying(attribute('aFaceDepth', 'float'), 'vFaceDepth')

// Configure interpolation INSIDE Fn()
Fn(() => {
  faceDepthVarying.setInterpolation(
    THREE.InterpolationSamplingType.FLAT,   // 'flat' | 'linear' | 'perspective'
    THREE.InterpolationSamplingMode.FIRST   // 'first' | 'either' | 'centroid' | 'sample' | 'normal'
  )
  // ... shader code
})
```

**Note**: GLSL only supports `'flat'` - the `'first'` and `'either'` modes are WebGPU/WGSL specific.

### 3. ES Module Imports Only - NO require()

**Never use CommonJS `require()` in modern TypeScript/ES module code.**

```typescript
// WRONG - CommonJS in ES modules
const { varying } = require('three/tsl')

// CORRECT - ES module imports
import { varying, Fn, float, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
```

### 4. Fn() is Required for Stack Operations

`Fn()` creates a controlled environment that enables:
- `If()` / `ElseIf()` / `Else()` conditionals
- `assign()` operations
- `Discard()` statements
- Loop constructs

```typescript
// WRONG - Error: "Cannot read properties of null (reading 'If')"
const myShader = () => {
  If(condition, () => { /* ... */ })  // FAILS!
}

// CORRECT - Fn() provides the stack context
const myShader = Fn(() => {
  If(condition, () => { /* ... */ })  // WORKS
})
```

### 5. Complex Node Compositions - MUST Be Outside Fn()

**Critical for WebGPU pipeline layouts.** Shadow samplers, texture nodes, and other complex compositions must be created OUTSIDE `Fn()` at material creation scope. Creating them inside `Fn()` causes "Invalid PipelineLayout" WebGPU errors.

```typescript
// WRONG - Causes "Invalid PipelineLayout" WebGPU error
const createShading = Fn(() => {
  const shadowSampler = sampleDirectionalSpotShadow(uniforms)  // WRONG!
  const lightResult = multiLightNode(pos, normal, view, ...)
  return litColor
})

// CORRECT - Complex nodes created OUTSIDE Fn(), referenced via closure
const shadowSampler = sampleDirectionalSpotShadow(uniforms)      // OUTSIDE Fn()
const multiLightNode = createMultiLightNode(lightUniforms, ...)  // OUTSIDE Fn()
const iblNode = computeIBL(iblUniforms)                          // OUTSIDE Fn()

const createShading = Fn(() => {
  // Use pre-created nodes via closure
  const lightResult = multiLightNode(pos, normal, view, ...)
  const iblContrib = iblNode(normal, view, F0, roughness, ...)
  return litColor
})
```

**Why this matters:**
- TSL `Fn()` builds a shader graph when called
- WebGPU bind group layouts are determined at pipeline creation based on referenced resources
- Texture nodes created inside `Fn()` end up in wrong scope for bind group registration
- Pattern confirmed working in `GroundPlaneMaterialTSL.tsx` and `MandelbulbMeshTSL.tsx`

**What to create OUTSIDE Fn():**
- `texture()` nodes for shadow maps, IBL, etc.
- Shadow sampler Fn() nodes (e.g., `sampleDirectionalSpotShadow()`)
- Multi-light Fn() nodes (e.g., `createMultiLightNode()`)
- IBL Fn() nodes (e.g., `computeIBL()`)
- SSS Fn() nodes (e.g., `createPolytopeSSSNode()`)

**What is OK INSIDE Fn():**
- Simple uniform references (`uniform.value`, `uniformArray.element()`)
- Math operations (`vec3()`, `float()`, `normalize()`, etc.)
- setInterpolation() calls on varyings
- Conditional branches (`If()`, `select()`)

### 6. NDC Depth Range - WebGL vs WebGPU

**Critical difference in clip-space Z coordinates:**

| API | NDC Z Range | Depth Buffer |
|-----|-------------|--------------|
| **WebGL** | -1 to +1 | 0 to 1 |
| **WebGPU** | 0 to 1 | 0 to 1 |

**Impact on custom depth calculations:**

```typescript
// WRONG for WebGPU - uses WebGL conversion
const depth = clipPos.z.div(clipW).mul(0.5).add(0.5)

// CORRECT for WebGPU - z/w is already in [0,1]
const depth = clamp(clipPos.z.div(clipW), float(0), float(1))
```

**Impact on shadow map sampling:**

Shadow map comparison also uses clip-space Z. The XY coordinates still need conversion (NDC XY is [-1,1] in both APIs), but Z does NOT:

```typescript
// WRONG for WebGPU - applies 0.5+0.5 to all xyz including Z
const projCoord = shadowCoord.xyz.div(w)
const texCoord = projCoord.mul(0.5).add(0.5)  // Z gets corrupted!
const currentDepth = texCoord.z

// CORRECT for WebGPU - convert XY only, keep Z as-is
const projCoord = shadowCoord.xyz.div(w)
const texCoordXY = projCoord.xy.mul(0.5).add(0.5)  // XY: NDC to texture
const currentDepth = clamp(projCoord.z, float(0), float(1))  // Z: already [0,1]
```

**When this matters:**
- Custom `depthNode` for raymarched materials
- Manual `gl_FragDepth` equivalent calculations
- Shadow map depth comparison (`currentDepth.greaterThan(closestDepth)`)
- Any clip-space Z manipulation

**When it does NOT matter:**
- XY clip-to-texture coordinate conversion (both APIs use [-1,1] for XY)
- Normal encoding (`normal * 0.5 + 0.5` is still correct)
- Three.js built-in depth handling (handled internally)

### 7. Variable Declaration with `toVar()` - Naming Conflicts

**Critical for WebGPU when `Fn()` functions are called multiple times** (e.g., per-light loops, multiple material instances).

Named `toVar('name')` causes TSL warnings: `Declaration name 'X' already in use. Renamed to 'X_1'`. These warnings indicate shader recompilation overhead.

**Best Practice Hierarchy** (prefer higher options):

| Priority | Pattern | When to Use |
|----------|---------|-------------|
| **1. Best** | No `toVar()` | Value is never reassigned |
| **2. Better** | `select()` | Simple conditional assignment |
| **3. Good** | Unnamed `toVar()` | Loop accumulators, complex mutations |
| **4. Avoid** | Named `toVar('x')` | Never in reusable `Fn()` |

```typescript
// 1. BEST - No toVar() when value isn't mutated
const halfVec = V.add(L).normalize()  // Just an expression

// 2. BETTER - select() instead of If/toVar/assign
// ✗ BAD: Creates mutable variable, causes naming conflicts
const result = vec3(0, 1, 0).toVar('result')
If(condition, () => { result.assign(otherValue) })

// ✓ GOOD: Single expression, no variable declaration
return condition.select(otherValue, vec3(0, 1, 0))

// 3. GOOD - Unnamed toVar() for loop accumulators (mutation required)
const accumulator = float(0).toVar()  // TSL auto-generates unique name
Loop(steps, () => {
  accumulator.addAssign(sample)
})

// 4. AVOID - Named toVar() in Fn() called multiple times
// ✗ Causes "Declaration name 't' already in use" warnings
const t = float(0).toVar('t')
```

**Why this matters:**
- Each `Fn()` call inlines into the final shader
- Named variables from multiple calls collide (same name, different instances)
- TSL auto-renames to avoid errors, but logs warnings and may trigger recompilation
- Unnamed `toVar()` lets TSL generate unique names automatically

---

## Function Renames (r170-r182)

| Old Name (Deprecated) | New Name | Since |
|-----------------------|----------|-------|
| `varying(node, name)` | `node.toVarying(name)` | r173 |
| `vertexStage(node)` | `node.toVertexStage()` | r173 |
| `atan2(y, x)` | `atan(y, x)` | r172 |
| `PI2` | `TWO_PI` | r175 |
| `equals(x, y)` | `equal(x, y)` | r175 |
| `modInt(a, b)` | `mod(a, b)` | r175 |
| `cache(node)` | `isolate(node)` | r176 |
| `append()` | `Stack` | r176 |
| `label()` | `setName()` | r178 |
| `transformedNormalView` | `normalView` | r178 |
| `transformedNormalWorld` | `normalWorld` | r178 |
| `transformedClearcoatNormalView` | `clearcoatNormalView` | r178 |
| `densityFog(color, density)` | `fog(color, densityFogFactor(density))` | r171 |
| `rangeFog(color, near, far)` | `fog(color, rangeFogFactor(near, far))` | r171 |
| `burn()` | `blendBurn()` | r171 |
| `dodge()` | `blendDodge()` | r171 |
| `screen()` | `blendScreen()` | r171 |
| `overlay()` | `blendOverlay()` | r171 |
| `storageObject()` | `storage().setPBO(true)` | r170 |
| `uniforms()` | `uniformArray()` | r170 |
| `viewportTopLeft` | `viewportUV` | r170 |
| `materialAOMap` | `materialAO` | r171 |
| `shadowWorldPosition` | `shadowPositionWorld` | r171 |
| `gaussianBlurPremultipliedAlpha()` | `gaussianBlur({ premultipliedAlpha: true })` | r180 |

---

## Property Renames

| Old | New | Since |
|-----|-----|-------|
| `passNode.setResolution()` | `passNode.setResolutionScale()` | r181 |
| `passNode.getResolution()` | `passNode.getResolutionScale()` | r181 |
| `resolution` (Vector2 on passes) | `resolutionScale` (scalar) | r180 |

---

## Import Paths (r170+)

```typescript
// WebGPU renderer and node materials
import {
  WebGPURenderer,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  MeshPhysicalNodeMaterial,
  LineBasicNodeMaterial,
  PostProcessing
} from 'three/webgpu'

// TSL functions and nodes
import {
  Fn, If, Loop, Break, Continue, Return, Discard,
  float, int, vec2, vec3, vec4, mat3, mat4,
  uniform, uniformArray, attribute, varying, vertexStage,
  texture, cubeTexture,
  positionWorld, positionLocal, positionView,
  normalWorld, normalLocal, normalView,
  cameraPosition, time, deltaTime,
  add, sub, mul, div, mod, pow, sqrt, abs,
  sin, cos, tan, asin, acos, atan,
  min, max, clamp, mix, step, smoothstep,
  dot, cross, normalize, length, distance, reflect, refract,
  dFdx, dFdy, fwidth,
  screenUV, viewportUV, resolution,
  type Node, type UniformNode
} from 'three/tsl'
```

---

## Common Mistakes & Fixes

### 1. Mathematical Operators

TSL uses method chaining, not JavaScript operators.

```typescript
// WRONG - JavaScript operators don't work on nodes
const result = a * 2 + b

// CORRECT - Use TSL methods
const result = a.mul(2).add(b)

// CORRECT - Or use function form
const result = add(mul(a, 2), b)
```

### 2. Using Math.sin() Instead of TSL sin()

```typescript
// WRONG - Returns NaN or black screen
const wave = Math.sin(time)

// CORRECT - TSL function
const wave = sin(time)
// or
const wave = time.sin()
```

### 3. Texture Sampling

```typescript
// OLD (deprecated)
const color = textureNode.uv(uvCoords)

// CORRECT (r172+)
const color = textureNode.sample(uvCoords)
// or
const color = texture(myTexture, uvCoords)
```

### 4. Variable Declaration

```typescript
// For immutable values
const myConst = Const(value, 'myConst')

// For mutable values (can use .assign())
const myVar = value.toVar('myVar')
myVar.assign(newValue)  // Update value
myVar.addAssign(delta)  // myVar += delta
```

### 5. Depth Buffer Assignment

```typescript
// WRONG - Direct assignment doesn't work
material.depthNode = depth

// CORRECT - Use depthBase for fragment depth output
material.fragmentNode = Fn(() => {
  // ... your fragment code
  return depthBase(customDepth)  // Set fragment depth
})
```

---

## Material Node Properties

### MeshBasicNodeMaterial
```typescript
material.colorNode      // vec3 - Final color output
material.opacityNode    // float - Opacity
material.positionNode   // vec3 - Vertex displacement
material.outputNode     // vec4 - Override final output
material.fragmentNode   // Custom fragment shader
```

### MeshStandardNodeMaterial / MeshPhysicalNodeMaterial
```typescript
// All of MeshBasicNodeMaterial plus:
material.normalNode           // vec3 - Normal modification
material.emissiveNode         // vec3 - Emission color
material.roughnessNode        // float - PBR roughness
material.metalnessNode        // float - PBR metalness

// MeshPhysicalNodeMaterial additional:
material.clearcoatNode        // float
material.clearcoatRoughnessNode
material.transmissionNode     // float - Glass/transmission
material.thicknessNode
material.sheenNode
material.iridescenceNode
```

---

## Screen Space Properties

```typescript
screenUV           // vec2 - Normalized [0,1] screen coordinates
screenCoordinate   // vec2 - Physical pixel coordinates
screenSize         // vec2 - Screen resolution in pixels
screenDPR          // float - Device pixel ratio

viewportUV         // vec2 - Normalized viewport coordinates
viewportCoordinate // vec2 - Viewport pixel coordinates
viewportSize       // vec2 - Viewport resolution
```

---

## Depth Conversion Utilities

```typescript
// Convert depth buffer value to view-space Z
const viewZ = perspectiveDepthToViewZ(depthValue, cameraNear, cameraFar)

// Convert view-space Z back to depth buffer value
const depth = viewZToPerspectiveDepth(viewZ, cameraNear, cameraFar)

// For orthographic cameras
const viewZ = orthographicDepthToViewZ(depthValue, cameraNear, cameraFar)
```

---

## Control Flow

```typescript
const myShader = Fn(() => {
  const result = vec3(0).toVar('result')

  // Conditionals
  If(condition, () => {
    result.assign(vec3(1, 0, 0))
  }).ElseIf(otherCondition, () => {
    result.assign(vec3(0, 1, 0))
  }).Else(() => {
    result.assign(vec3(0, 0, 1))
  })

  // Loops
  Loop(10, ({ i }) => {
    result.addAssign(vec3(0.1))
    If(i.greaterThan(5), () => {
      Break()
    })
  })

  // Discard fragment
  If(result.x.lessThan(0.1), () => {
    Discard()
  })

  return result
})
```

---

## GPU Branch Evaluation - CRITICAL DIFFERENCE FROM CPU

**The #2 cause of WebGPU rendering bugs after varying placement.**

### TSL `If()` Evaluates ALL Branches

Unlike JavaScript `if` statements, TSL's `If()` compiles to GPU code where **both branches are always executed** due to GPU SIMD (Single Instruction Multiple Data) architecture. The GPU uses thread masking to select which result to keep, but all code paths run.

This means operations like `sqrt()`, `div()`, or `log()` that can produce `NaN`/`Inf` with invalid inputs **will execute even inside a "false" branch**.

```typescript
// WRONG - Division by zero happens even when condition is false
const result = vec3(0, 1, 0).toVar('result')
If(len.greaterThan(0.0001), () => {
  result.assign(vec.div(len))  // EXECUTES EVEN WHEN len <= 0.0001!
})

// CORRECT - Guard the divisor BEFORE the If() block
const safeLen = max(len, float(0.0001))
const result = vec3(0, 1, 0).toVar('result')
If(len.greaterThan(0.0001), () => {
  result.assign(vec.div(safeLen))  // Safe: safeLen is always >= 0.0001
})
```

### WGSL `select()` Also Evaluates Both Arguments

The underlying WGSL `select(falseValue, trueValue, condition)` function is **branchless** - both `falseValue` and `trueValue` are computed before selection occurs.

```wgsl
// In WGSL, this evaluates BOTH expressions:
let result = select(fallback, x / y, y > 0.0);
// Even when y > 0.0 is false, x / y is still computed!
```

### Operations Requiring Guards

Always guard these operations when used inside conditionals:

| Operation | Risk | Guard Pattern |
|-----------|------|---------------|
| `div(a, b)` | Division by zero → Inf/NaN | `max(b, float(0.0001))` |
| `sqrt(x)` | Negative input → NaN | `max(x, float(0.0))` |
| `log(x)` | Zero/negative → -Inf/NaN | `max(x, float(1e-8))` |
| `pow(x, y)` | Negative base with fractional exp → NaN | `max(x, float(0.0))` |
| `inverseSqrt(x)` | Zero → Inf | `max(x, float(1e-8))` |
| `normalize(v)` | Zero vector → NaN | Check `dot(v, v) > threshold` |

### Practical Example - Normal Calculation

```typescript
// From our raymarching normals.ts:
const lenSq = dot(n, n)
const result = vec3(0, 1, 0).toVar('normalResult')

// CRITICAL: Guard sqrt BEFORE the If() because TSL evaluates all branches
const safeLenSq = max(lenSq, float(1e-8))

If(lenSq.greaterThan(1e-8), () => {
  // Safe: safeLenSq is always >= 1e-8, so sqrt never gets near-zero input
  result.assign(n.div(sqrt(safeLenSq)))
})
```

**Source**: [WGSL Specification - select()](https://www.w3.org/TR/WGSL/#select-builtin), [GPU Branch Divergence](https://aschrein.github.io/jekyll/update/2019/06/13/whatsup-with-my-branches-on-gpu.html)

---

## Render Graph Size Initialization

**Critical for custom render pipelines using RenderGraphTSL or similar patterns.**

### Default 1x1 Pixel Render Targets

Many render graph implementations default to 1×1 pixel dimensions. If you don't call `setSize()`, all your render targets will be 1×1 pixels, and the single rendered pixel gets stretched to fill the screen.

**Symptoms**:
- Solid color output that changes with camera movement
- "Flickering" as the single pixel's color varies
- Appears like the entire scene is one flat color

```typescript
// WRONG - Missing setSize() call
const graph = new RenderGraphTSL()
graph.addResource({ id: 'color', type: 'renderTarget', ... })
graph.compile()
// Render targets are 1×1 pixels! Output is garbage.

// CORRECT - Always call setSize() after creation
const graph = new RenderGraphTSL()
graph.addResource({ id: 'color', type: 'renderTarget', ... })
graph.compile()

// In useEffect, update size with DPR-adjusted dimensions:
const dpr = viewport.dpr
const nativeWidth = Math.floor(size.width * dpr)
const nativeHeight = Math.floor(size.height * dpr)
graph.setSize(nativeWidth, nativeHeight)
```

### DPR (Device Pixel Ratio) Handling

React Three Fiber's `useThree().size` returns **CSS pixels**, but the canvas renders at **CSS × DPR physical pixels**. High-DPI displays (MacBook Pro, 4K monitors) have DPR of 2 or higher.

```typescript
// WRONG - CSS pixels only, blurry on high-DPI displays
graph.setSize(size.width, size.height)

// CORRECT - Native resolution for sharp rendering
const dpr = viewport.dpr  // or gl.getPixelRatio()
const nativeWidth = Math.floor(size.width * dpr)
const nativeHeight = Math.floor(size.height * dpr)
graph.setSize(nativeWidth, nativeHeight)
```

### React Integration Pattern

```typescript
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

function MyPostProcessing() {
  const { size, viewport } = useThree()
  const graphRef = useRef<RenderGraphTSL | null>(null)

  // Create graph in useMemo...

  // CRITICAL: Update size when dimensions change
  useEffect(() => {
    if (!graphRef.current) return

    const dpr = viewport.dpr
    const nativeWidth = Math.floor(size.width * dpr)
    const nativeHeight = Math.floor(size.height * dpr)

    graphRef.current.setSize(nativeWidth, nativeHeight)
  }, [size.width, size.height, viewport.dpr])
}
```

---

## Fog (Modern Pattern)

```typescript
// OLD (deprecated r171)
scene.fog = densityFog(color, density)

// CORRECT (r171+)
scene.fogNode = fog(vec3(fogColor), densityFogFactor(density))

// Range fog
scene.fogNode = fog(vec3(fogColor), rangeFogFactor(near, far))
```

---

## Post-Processing

```typescript
import { PostProcessing } from 'three/webgpu'
import { pass, fxaa, bloom } from 'three/tsl'

const postProcessing = new PostProcessing(renderer)

// Create scene pass
const scenePass = pass(scene, camera)

// Chain effects (functional style, not method chaining)
const withFXAA = fxaa(scenePass)
const withBloom = bloom(withFXAA, 1.0, 0.4, 0.85)

postProcessing.outputNode = withBloom
```

---

## Performance Tips

1. **Use `toVertexStage()` for heavy computations** - Move expensive calculations from fragment to vertex shader:
   ```typescript
   const expensiveCalc = someHeavyMath(input).toVertexStage()
   ```

2. **Use `toVar()` for repeated expressions**:
   ```typescript
   const expensive = complexCalculation().toVar('cached')
   // Use 'expensive' multiple times without recomputation
   ```

3. **Share uniforms across materials**:
   ```typescript
   const sharedTime = uniform(0)
   materialA.colorNode = sin(sharedTime)
   materialB.colorNode = cos(sharedTime)
   // Update once: sharedTime.value = elapsedTime
   ```

---

## Debugging

```typescript
// Log node value during shader compilation
debug(myNode, (value) => console.log('Node value:', value))

// Inspect node in dev tools
inspector(myNode, 'myNodeName')
```

---

## Sources

- [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
- [Three.js Shading Language Wiki](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [TSL Official Documentation](https://threejs.org/docs/pages/TSL.html)
- [VaryingNode Documentation](https://threejs.org/docs/pages/VaryingNode.html)
- [PR #30582 - VaryingNode setInterpolation](https://github.com/mrdoob/three.js/pull/30582)
- [Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- [Wawa Sensei TSL Course](https://wawasensei.dev/courses/react-three-fiber/lessons/webgpu-tsl)
- [Nik Lever TSL Guide](https://niklever.com/getting-to-grips-with-threejs-shading-language-tsl/)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-04 | 1.0 | Initial document for r182 |
| 2026-01-04 | 1.7 | Migrated all `atan2` calls to `atan` across 14 TSL files (sdf3d-11d.ts, psi.ts, hydrogenPsi.ts, disk.ts, manifold.ts, colors.ts, common.ts, mandelbulb-sdf.ts) - eliminated deprecation warnings |
| 2026-01-04 | 1.1 | Added GPU Branch Evaluation section (If/select both-branch evaluation), Render Graph Size Initialization (1x1 default, DPR handling) |
| 2026-01-04 | 1.2 | Added codebase-specific bug fixes: rgb2hsl, rgb2hsv, screen-space-normals div-by-zero guards |
| 2026-01-04 | 1.3 | Added "Invalid PipelineLayout" WebGPU error documentation and texture binding patterns |
| 2026-01-04 | 1.4 | Added Fix 4 "Use Stable TextureNodes" pattern - the most important fix for render graph passthrough materials |
| 2026-01-04 | 1.5 | Added Fix 5 "Never Change transparent or needsUpdate at Runtime" - critical fix for polytope/material pipeline errors |
| 2026-01-04 | 1.6 | Added Fix 6 "Use Premultiplied Alpha for Compositing" - industry-standard solution for gravity lensing pipeline |
| 2026-01-04 | 1.8 | Added CRITICAL Architecture Audit section - post-processing passes using GLSL instead of TSL |
| 2026-01-04 | 1.9 | Rewrote ToneMappingCinematicPassTSL and BokehPassTSL to use actual TSL nodes |
| 2026-01-04 | 2.0 | Added GLSL to TSL Transpiler Tool documentation and Function Renames table |
| 2026-01-06 | 2.1 | Added WebGPU MRT Texture Naming section - render targets need texture.name = 'output' |

---

## Post-Processing Architecture Status (Updated January 2026)

> **STATUS: ✅ RESOLVED** - All major post-processing passes have been converted to TSL.

### Current State

All critical post-processing passes in `src/rendering/graph-tsl/passes/` now use proper TSL nodes with `MeshBasicNodeMaterial`. The previous GLSL-based implementations have been rewritten.

#### Files Using Actual TSL (WebGPU Compatible)

| File | Status | Notes |
|------|--------|-------|
| `BokehPassTSL.ts` | ✅ TSL | Disc, jittered, separable, and hexagonal blur modes |
| `BloomPassTSL.ts` | ✅ TSL | Multi-pass bloom with TSL nodes |
| `SSRPassTSL.ts` | ✅ TSL | Screen-space reflections with half-resolution support |
| `ToneMappingCinematicPassTSL.ts` | ✅ TSL | Combined tone mapping + vignette + film grain + chromatic aberration |
| `GTAOPassTSL.ts` | ✅ TSL | Ground truth ambient occlusion |
| `BufferPreviewPassTSL.ts` | ✅ TSL | Debug buffer visualization |
| `NormalPassTSL.ts` | ✅ TSL | Normal buffer output |
| `FrameBlendingPassTSL.ts` | ✅ TSL | Temporal frame blending |

#### TSL Pattern Reference

All passes now follow this correct pattern:

```typescript
// This IS actual TSL
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, texture, screenUV, vec4 } from 'three/tsl'

// Create texture nodes OUTSIDE Fn() per MKB-001
const colorTexNode = texture(null)

// Create the shader function
const blurShader = Fn(() => {
  const color = colorTexNode.sample(screenUV)
  // ... TSL operations ...
  return vec4(color.rgb, color.a)
})

// Apply to material
this.material = new MeshBasicNodeMaterial()
this.material.colorNode = blurShader()
```

### Key Patterns Used

1. **Texture nodes created OUTSIDE Fn()** - Prevents WebGPU pipeline layout errors
2. **Placeholder textures with correct format** - Ensures stable bind group layouts
3. **Uniform nodes for runtime updates** - Update via `.value` not `needsUpdate`
4. **MeshBasicNodeMaterial** - Base material for all post-processing passes

### Historical Context (Pre-Conversion)

Previously, many passes used `THREE.ShaderMaterial` with GLSL strings. This was identified and fixed. Example of the old WRONG pattern:

```typescript
// WRONG - This was the old GLSL pattern
this.material = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    in vec2 vUv;
    out vec4 fragColor;
    void main() {
      vec4 color = texture(tDiffuse, vUv);
      fragColor = color;
    }
  `
})
```

This pattern was replaced with TSL nodes as shown in the "TSL Pattern Reference" section above.

---

## uniformArray.element() BROKEN in WebGPU - CRITICAL

**Discovered**: 2026-01-05 during shadow system debugging

### The Problem

`uniformArray.element(index)` causes **"Invalid PipelineLayout"** WebGPU errors during `CreateRenderPipeline`. This is a fundamental incompatibility with WebGPU's pipeline layout system.

**Error Message**:
```
THREE.[Invalid PipelineLayout (unlabeled)] is invalid.
 - While calling [Device].CreateRenderPipeline([RenderPipelineDescriptor "renderPipeline_MeshBasicNodeMaterial_58"]).
```

### Root Cause

WebGPU bind group layouts require static resource declarations at pipeline creation time. The `uniformArray.element(index)` pattern creates dynamic buffer indexing that WebGPU's pipeline layout system cannot handle.

**Isolation Test Proof**:
1. Disabled all texture sampling → Still failed
2. Disabled all matrix operations → Still failed
3. Disabled `uniformArray.element()` access → **WORKED!**

### The Fix: Use vec4 Instead of uniformArray

For small arrays (≤4 elements), use `vec4` uniform and access via `.x/.y/.z/.w`:

```typescript
// ❌ BROKEN - Causes "Invalid PipelineLayout" in WebGPU
import { uniformArray, int } from 'three/tsl'

const uLightCastsShadow = uniformArray([0, 0, 0, 0])

// Inside Fn():
const castsShadow = uLightCastsShadow.element(int(lightIndex)).greaterThan(0.5)
```

```typescript
// ✅ WORKING - Use vec4 with select chain
import { uniform, select, int } from 'three/tsl'
import { Vector4 } from 'three'

const uLightCastsShadow = uniform(new Vector4(0, 0, 0, 0))

// Inside Fn() - use select chain for dynamic indexing:
const castsShadowValue = select(
  lightIndex.equal(0),
  uLightCastsShadow.x,
  select(
    lightIndex.equal(1),
    uLightCastsShadow.y,
    select(
      lightIndex.equal(2),
      uLightCastsShadow.z,
      uLightCastsShadow.w
    )
  )
)
const castsShadow = castsShadowValue.greaterThan(0.5)
```

### Updating vec4 at Runtime

```typescript
// Update all 4 values at once
uLightCastsShadow.value.set(v0, v1, v2, v3)

// Or update individual components
uLightCastsShadow.value.setComponent(index, value)  // index: 0-3
```

### For Larger Arrays (>4 elements)

When you need more than 4 elements, consider:

1. **Multiple vec4 uniforms**: Split into groups of 4
   ```typescript
   const uArray0to3 = uniform(new Vector4())
   const uArray4to7 = uniform(new Vector4())
   ```

2. **Texture lookup**: Store array data in a texture
   ```typescript
   const dataTexture = new DataTexture(arrayData, width, 1, RGBAFormat)
   const dataNode = texture(dataTexture)
   const value = dataNode.sample(vec2(index.div(width), 0.5))
   ```

3. **Pre-compute outside shader**: Calculate the needed value on CPU and pass as single uniform

### When .element() Works vs Breaks

| Pattern | Example | Result |
|---------|---------|--------|
| Constant JS index | `matrix.element(0)` | ✅ Works |
| JS loop variable | `for (let i = 0; i < 4; i++) { arr.element(i) }` | ✅ Works (unrolled) |
| TSL node index | `arr.element(lightIndex)` where `lightIndex` is IntNode | ❌ Breaks |
| TSL expression | `arr.element(base.add(offset))` | ❌ Breaks |

**Rule**: `.element()` works with JavaScript constants, breaks with TSL node indices.

---

## Invalid PipelineLayout WebGPU Error - CRITICAL

**Error Message**:
```
THREE.[Invalid PipelineLayout (unlabeled)] is invalid.
- While calling [Device].CreateRenderPipeline([RenderPipelineDescriptor "renderPipeline_MeshBasicNodeMaterial_23"])
```

### Root Cause

WebGPU requires consistent **bind group layouts** that are determined at pipeline creation time. Unlike WebGL where texture uniforms can be freely updated, WebGPU bind group layouts are fixed once the material is compiled.

The error occurs when:
1. **Texture format mismatch**: A TextureNode created with a placeholder texture (e.g., 1x1 DataTexture) is later updated to a texture with significantly different properties (e.g., 256x256 PMREM cubemap)
2. **Incompatible texture mapping**: Placeholder uses `UVMapping` but runtime texture uses `CubeUVReflectionMapping`
3. **Node graph modifications**: Changing the node graph structure after material compilation

### Problem Patterns in This Codebase

**Pattern 1: Placeholder Texture Format Mismatch (ibl.ts:68-79)**
```typescript
// PROBLEM: 1x1 RGBA placeholder
function getPlaceholderTexture(): DataTexture {
  const data = new Uint8Array([128, 128, 128, 255])
  cachedPlaceholderTexture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType)
  // Missing: mapping = CubeUVReflectionMapping
}

// Later updated to PMREM environment map with CubeUVReflectionMapping
// This causes bind group layout incompatibility
```

**Pattern 2: Texture Value Updates (MandelbulbMeshTSL.tsx:341)**
```typescript
// The texture format changes at runtime
uniforms.ibl.uEnvMap.value = env  // env is PMREM, placeholder was 1x1 DataTexture
```

### Fixes

**Fix 1: Match Placeholder Format to Runtime Format**
```typescript
// For PMREM environment maps - placeholder MUST match expected format
function createPMREMPlaceholder(): DataTexture {
  // Use reasonable size (not 1x1)
  const size = 16  // Minimum reasonable size
  const data = new Uint8Array(size * size * 4).fill(128)
  const placeholder = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)

  // CRITICAL: Match the mapping type of the expected texture
  placeholder.mapping = CubeUVReflectionMapping
  placeholder.minFilter = LinearFilter
  placeholder.magFilter = LinearFilter
  placeholder.wrapS = ClampToEdgeWrapping
  placeholder.wrapT = ClampToEdgeWrapping
  placeholder.needsUpdate = true

  return placeholder
}
```

**Fix 2: Recreate Material When Format Changes**
```typescript
// Instead of updating texture value:
// uniforms.ibl.uEnvMap.value = env;

// Recreate the material when IBL becomes available:
const materialRef = useRef<MeshBasicNodeMaterial | null>(null)

useEffect(() => {
  if (env && envFormatDiffers) {
    // Dispose old material
    materialRef.current?.dispose()
    // Create new with correct texture from start
    const newMaterial = composeMandelbulbTSL({
      ...config,
      envMap: env  // Correct texture from the beginning
    })
    materialRef.current = newMaterial
  }
}, [env])
```

**Fix 3: Disable Problematic Features Entirely**
```typescript
// For IBL - don't include nodes when disabled
const colorOutput = iblEnabled
  ? applyIBL(baseColor, uniforms.ibl)
  : baseColor  // No IBL nodes = no texture binding issues
```

**Fix 4: Use Stable TextureNodes (MOST IMPORTANT)**

This is the most common cause of "Invalid PipelineLayout" in render graphs and post-processing passes. When a material needs to render different textures (e.g., passthrough copy, ToScreen pass), you MUST:

1. Create the TextureNode ONCE with a placeholder texture
2. Update `textureNode.value` at runtime instead of creating new `texture()` calls

```typescript
// WRONG - Creates new texture node each frame, changes bind group layout
private getPassthroughMaterial(inputTexture: THREE.Texture | null): THREE.Material {
  const texNode = texture(inputTexture, uv())  // NEW node each call!
  nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)
  nodeMaterial.needsUpdate = true  // Forces recompilation!
  return material
}

// CORRECT - Stable texture node, update value only
private passthroughTextureNodes: Map<number, ReturnType<typeof texture>> = new Map()
private passthroughPlaceholder: THREE.DataTexture | null = null

private getPassthroughMaterial(inputTexture: THREE.Texture | null): THREE.Material {
  // Create placeholder once
  if (!this.passthroughPlaceholder) {
    const size = 4  // Use 4x4 for WebGPU compatibility
    const data = new Uint8Array(size * size * 4).fill(128)
    this.passthroughPlaceholder = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.passthroughPlaceholder.needsUpdate = true
  }

  // Create stable TextureNode ONCE
  let texNode = this.passthroughTextureNodes.get(1)
  if (!texNode) {
    texNode = texture(this.passthroughPlaceholder, uv())
    this.passthroughTextureNodes.set(1, texNode)

    // Set output node ONCE
    nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)
  }

  // Update texture VALUE at runtime (NOT the node)
  if (inputTexture) {
    (texNode as unknown as { value: THREE.Texture }).value = inputTexture
  }

  // NO needsUpdate = true after initial creation!
  return material
}
```

**Key Pattern**: The TypeScript type for `texture()` doesn't expose `.value`, but at runtime it exists. Use type assertion: `(texNode as unknown as { value: THREE.Texture }).value = newTexture`

**Files Fixed With This Pattern**:
- `src/rendering/graph-tsl/RenderGraphTSL.ts` - Passthrough materials
- `src/rendering/graph-tsl/passes/ToScreenPassTSL.ts` - Screen output pass

**Fix 5: Never Change `transparent` or Call `needsUpdate` at Runtime**

In WebGPU, changing `material.transparent` or calling `material.needsUpdate = true` after initial compilation triggers **full pipeline recreation**, causing "Invalid PipelineLayout" errors. This is the most common cause of pipeline errors for materials that animate opacity.

**Why This Happens**:
- WebGPU pipelines include blend state (determined by `transparent`)
- Changing `transparent` requires a different pipeline with different blend configuration
- `needsUpdate = true` forces material recompilation, creating a new pipeline
- The new pipeline may have different bind group layout expectations

```typescript
// WRONG - Changing transparent triggers pipeline recreation
useFrame(() => {
  const isTransparent = opacity < 1
  if (material.transparent !== isTransparent) {
    material.transparent = isTransparent      // CAUSES PIPELINE RECREATION!
    material.depthWrite = !isTransparent
    material.needsUpdate = true               // FORCES RECOMPILATION!
  }
})

// CORRECT - Create with transparent: true, only change depthWrite
const material = useMemo(() => {
  return new MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: true,  // Always true for WebGPU pipeline stability
    depthWrite: opacity >= 1,
  })
}, [])

useFrame(() => {
  // Only update depthWrite - doesn't require pipeline recreation
  const isOpaque = opacity >= 1
  if (material.depthWrite !== isOpaque) {
    material.depthWrite = isOpaque
    // Do NOT call needsUpdate - WebGPU pipelines are fixed at creation time
  }
})
```

**Key Rules**:
1. Create materials with `transparent: true` from the start
2. Control opacity via uniform node (e.g., `material.opacityNode`)
3. Only change `depthWrite` at runtime - it doesn't require pipeline recreation
4. NEVER call `material.needsUpdate = true` after initial compilation

**Files Fixed With This Pattern**:
- `src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx` - Face material
- `src/rendering/tsl/materials/polytope/PolytopeMaterialTSL.tsx` - Face material hook
- `src/rendering/tsl/materials/tubewireframe/TubeWireframeTSL.tsx` - Tube wireframe

**Note**: `GroundPlaneMaterialTSL.tsx` is always opaque (opacity=1) so it doesn't need this fix.

**Fix 6: Use Premultiplied Alpha for Compositing (Industry Standard)**

When rendering objects separately for compositing (e.g., gravity lensing pipeline), use **premultiplied alpha** instead of `forceOpaque`. This is the industry standard used by game engines (Unity, Unreal), film compositing (Nuke), and all modern graphics APIs.

**Why Premultiplied Alpha is Better**:
- No runtime material property changes (WebGPU compatible)
- One less multiply per pixel in composite shader
- Correct filtering/mipmapping (no dark halos)
- Single blend mode works for all cases

**Implementation**:

1. **Material outputs premultiplied color**:
```typescript
// TSL material - multiply color by opacity in outputNode
const shadingColor = createShadingFn()
const opacityNode = uniforms.uOpacity
mat.outputNode = vec4(
  shadingColor.x.mul(opacityNode),
  shadingColor.y.mul(opacityNode),
  shadingColor.z.mul(opacityNode),
  opacityNode
)
```

2. **Composite shader uses premultiplied blend**:
```typescript
// BEFORE (straight alpha - requires forceOpaque hack)
const blendedColor = objColor.xyz.mul(objColor.w).add(envColor.xyz.mul(float(1).sub(objColor.w)))

// AFTER (premultiplied alpha - WebGPU compatible)
const blendedColor = objColor.xyz.add(envColor.xyz.mul(float(1).sub(objColor.w)))
```

3. **Remove forceOpaque from scene passes** - no longer needed.

**Files Fixed With This Pattern**:
- `src/rendering/renderers/Polytope/PolytopeSceneTSL.tsx` - Premultiplied output
- `src/rendering/tsl/postprocessing/compositeTSL.ts` - Premultiplied blend
- `src/rendering/graph-tsl/passes/ScenePassTSL.ts` - forceOpaque removed
- `src/rendering/environment/PostProcessingV2TSL.tsx` - forceOpaque removed

### Verification

After applying fixes, verify:
1. No WebGPU console errors during initial render
2. No errors when switching between objects
3. No errors when environment map loads

---

## WebGPU MRT Texture Naming - CRITICAL

**Error**: `THREE.Color target has no corresponding fragment stage output but writeMask (ColorWriteMask::(Red|Green|Blue|Alpha)) is not zero`

### Rule

When creating `WebGLRenderTarget` (single texture, not MRT), **always set `target.texture.name = 'output'`**.

### Why

Materials with `mrtNode` use `mrt({ output: ... })` which expects a texture named `'output'` at location 0. Without this name, WebGPU cannot map the MRT output to the framebuffer's color attachment.

### Pattern

```typescript
// ✅ CORRECT - Set texture name
const target = new THREE.WebGLRenderTarget(width, height, options)
target.texture.name = 'output'

// ❌ WRONG - Missing texture name
const target = new THREE.WebGLRenderTarget(width, height, options)
// Material with mrtNode will fail to render
```

### When This Applies

- Creating single-texture render targets in `ResourcePool`
- Creating render targets for passes that render raymarched objects (Mandelbulb, Julia, BlackHole, Schroedinger)
- Any render target where materials use `material.mrtNode`

### Files Using This Pattern

- `src/rendering/graph/ResourcePool.ts` - All single render targets

---

## Texture Uniforms - Never Use null - CRITICAL

**Error**: `THREE.TSL: Error: Uniform "null" not implemented.`

### The Problem

TSL's `uniform()` function does not accept `null` values. This causes WebGPU compilation to fail and can lead to high CPU usage as the system repeatedly attempts to compile the invalid shader.

### Wrong Pattern

```typescript
// WRONG - Causes "Uniform 'null' not implemented" error
const uniforms = {
  uMyTexture: uniform(null as unknown as THREE.Texture),
}
```

### Correct Pattern

Use `texture()` with a placeholder `DataTexture`:

```typescript
import { texture, uniform } from 'three/tsl'
import * as THREE from 'three'

// Cached placeholder to avoid recreating
let cachedPlaceholder: THREE.DataTexture | null = null

function getPlaceholder(): THREE.DataTexture {
  if (!cachedPlaceholder) {
    const size = 4  // Use 4x4 for WebGPU bind group compatibility
    const data = new Uint8Array(size * size * 4).fill(0)
    cachedPlaceholder = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    cachedPlaceholder.minFilter = THREE.LinearFilter
    cachedPlaceholder.magFilter = THREE.LinearFilter
    cachedPlaceholder.wrapS = THREE.ClampToEdgeWrapping
    cachedPlaceholder.wrapT = THREE.ClampToEdgeWrapping
    cachedPlaceholder.needsUpdate = true
  }
  return cachedPlaceholder
}

// CORRECT - Use texture() with placeholder
const placeholder = getPlaceholder()
const uniforms = {
  uMyTexture: texture(placeholder),
}

// Update at runtime via .value property
(uniforms.uMyTexture as unknown as { value: THREE.Texture }).value = actualTexture
```

### Files Fixed With This Pattern

- `src/rendering/tsl/raymarching/schroedinger/temporal/reprojection.ts`
- `src/rendering/tsl/raymarching/schroedinger/temporal/reconstruction.ts`
- `src/rendering/tsl/compose/feature-blocks/temporal.ts`

---

## Codebase-Specific Fixes Applied

### Color Conversion Division Guards (color/conversions.ts, SkyboxUtilsTSL.ts)

**Problem**: RGB-to-HSL and RGB-to-HSV conversions divide by `delta` (max - min color channel difference). When all RGB channels are equal (grayscale), `delta = 0` causing division by zero.

The `isGray` condition using `select()` does NOT prevent the division from executing due to GPU branch evaluation.

**Files Fixed**:
- `src/rendering/tsl/color/conversions.ts` - rgb2hsl()
- `src/rendering/tsl/materials/skybox/SkyboxUtilsTSL.ts` - rgb2hsv()

**Pattern**:
```typescript
// WRONG - Division executes even when isGray selects fallback
const hR = c.g.sub(c.b).div(d).add(select(gLtB, float(6), float(0)))
return select(isGray, vec3(0, 0, l), vec3(h, s, l))

// CORRECT - Guard BEFORE division
const safeD = max(d, float(0.0001))
const hR = c.g.sub(c.b).div(safeD).add(select(gLtB, float(6), float(0)))
return select(isGray, vec3(0, 0, l), vec3(h, s, l))
```

### Screen-Space Normal Division Guards (screen-space-normals.ts)

**Problem**: Screen-space normal calculation divides by `length(cross(dPdx, dPdy))`. At degenerate triangles or edges, this length can be zero.

**Pattern**:
```typescript
// WRONG - normalLen could be 0
const safeNormal = rawNormal.div(normalLen)
return select(normalLen.greaterThan(1e-10), safeNormal, fallback)

// CORRECT - Guard the length
const safeLen = normalLen.max(float(1e-10))
const safeNormal = rawNormal.div(safeLen)
return select(normalLen.greaterThan(1e-10), safeNormal, fallback)
```

---

## GLSL to TSL Transpiler Tool

Three.js includes a **built-in GLSL to TSL transpiler** that can automatically convert GLSL shaders to TSL code. This is useful for porting existing post-processing passes or complex shaders.

### Location

The transpiler modules are in `node_modules/three/examples/jsm/transpiler/`:
- `GLSLDecoder.js` - Parses GLSL input
- `TSLEncoder.js` - Generates TSL output
- `Transpiler.js` - Orchestrates the conversion
- `WGSLEncoder.js` - Alternative: generate WGSL directly

### Online Tool

Use the interactive web transpiler at: https://threejs.org/examples/webgpu_tsl_transpiler.html

### Programmatic Usage (Node.js)

```javascript
// scripts/tools/transpile-glsl-to-tsl.mjs
import Transpiler from 'three/examples/jsm/transpiler/Transpiler.js';
import GLSLDecoder from 'three/examples/jsm/transpiler/GLSLDecoder.js';
import TSLEncoder from 'three/examples/jsm/transpiler/TSLEncoder.js';

const glslCode = `
precision highp float;
uniform sampler2D tDiffuse;
in vec2 vUv;
layout(location = 0) out vec4 fragColor;

void main() {
  vec4 color = texture(tDiffuse, vUv);
  fragColor = color;
}
`;

const decoder = new GLSLDecoder();
const encoder = new TSLEncoder();
const transpiler = new Transpiler(decoder, encoder);

const tslCode = transpiler.parse(glslCode);
console.log(tslCode);
```

### Example Output

**Input GLSL**:
```glsl
vec4 discBlur(vec2 uv, vec2 blur) {
  vec4 col = vec4(0.0);
  col += texture(tDiffuse, uv);
  col += texture(tDiffuse, uv + blur * vec2(0.15, 0.37));
  return col / 2.0;
}
```

**Output TSL**:
```typescript
export const discBlur = /*@__PURE__*/ Fn(([uv, blur]) => {
  const col = vec4(0.0);
  col.addAssign(tDiffuse.sample(uv));
  col.addAssign(tDiffuse.sample(uv.add(blur.mul(vec2(0.15, 0.37)))));
  return col.div(2.0);
}, { uv: 'vec2', blur: 'vec2', return: 'vec4' });
```

### Key Transformations

| GLSL | TSL |
|------|-----|
| `texture(tex, uv)` | `tex.sample(uv)` |
| `col += value` | `col.addAssign(value)` |
| `col *= value` | `col.mulAssign(value)` |
| `a + b * c` | `a.add(b.mul(c))` |
| `for (int i = 0; i < 10; i++)` | `Loop({ start: 0, end: 10 }, ({ i }) => {...})` |
| `if (cond) {...} else {...}` | `If(cond, () => {...}).Else(() => {...})` |
| `uniform float x` | `const x = uniform('float')` |

### Limitations

1. **Requires manual cleanup**: The transpiler output needs adaptation for:
   - Texture uniform definitions (add actual THREE.Texture references)
   - Import statements (need proper `from 'three/tsl'`)
   - GLSL3 `in`/`out` declarations (remove or adapt)

2. **Complex constructs**: Some GLSL patterns may need manual adjustment:
   - Preprocessor directives (`#define`, `#ifdef`)
   - Struct definitions
   - Array indexing in some cases

3. **Context requirements**: The transpiler doesn't know your scene setup, so:
   - `uniform sampler2D` → needs actual `texture(myTexture)` call
   - `uniform float` → needs `uniform(initialValue)`

### Run Script

```bash
node scripts/tools/transpile-glsl-to-tsl.mjs
```

---

## Function Renames (Migration)

| Old (Deprecated) | New (r176+) | Since |
|-----------------|-------------|-------|
| `atan2(y, x)` | `atan(y, x)` | r172 |
| `varying(node, name)` | `node.toVarying(name)` | r173 |
| `vertexStage(node)` | `node.toVertexStage()` | r173 |
| `PI2` | `TWO_PI` | r180 |
| `label(node, name)` | `node.setName(name)` | r181 |
| `renderAsync()` | Deprecated, use `renderer.render()` | r182 |

