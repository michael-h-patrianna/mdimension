# Bug: Polytope Double Shadow with Point Lights

## Session: DEBUG-20241219-SHADOW-001
**Date:** 2025-12-19
**Status:** ✅ FIXED - All light types work together (point, directional, spot)

---

## Bug Summary

**Primary Symptom:** When a point light casts shadows on a polytope, two shadows appear on the ground plane instead of one. The shadows are mirror images of each other and move in opposite directions when the light is moved.

**Secondary Issue:** Wythoff polytope creates no shadow at all with point lights.

**Reproduction Steps:**
1. Select "Polytope" as object type
2. Enable a ground plane (floor wall)
3. Add a point light with shadows enabled
4. Observe: Two shadows appear on the floor
5. Move the point light - shadows move in opposite directions

**Expected Behavior:** Single shadow that matches the polytope's silhouette from the light's perspective.

**Actual Behavior:** Two shadows, mirrored, moving in opposite directions as the light moves.

---

## Technical Context

### Three.js Shadow System for Custom Materials

Three.js uses different materials for different light types:

| Light Type | Material Used | Shadow Map Type |
|------------|---------------|-----------------|
| Directional | `customDepthMaterial` | 2D orthographic |
| Spot | `customDepthMaterial` | 2D perspective |
| Point | `customDistanceMaterial` | Packed 2D cube map (6 faces) |

For objects with n-dimensional animation, we need custom shadow materials that apply the same vertex transformations used in the main render pass. Without custom materials, shadows remain static while the object animates.

### Three.js Material Selection Logic

From Three.js source code (`WebGLShadowMap.js`):
```javascript
const customMaterial = ( light.isPointLight === true ) ?
    object.customDistanceMaterial :
    object.customDepthMaterial;
```

This means:
- Point lights should ONLY use `customDistanceMaterial`
- Directional/Spot lights should ONLY use `customDepthMaterial`

### Key Files

- `src/rendering/renderers/Polytope/PolytopeScene.tsx` - Main polytope renderer, sets up shadow materials
- `src/rendering/shaders/shared/depth/customDepth.glsl.ts` - Vertex/fragment shaders for shadow rendering
- `src/rendering/shaders/shared/features/shadowMaps.glsl.ts` - Shadow map sampling in main shaders

### Custom Material Setup (Before Fix)

```typescript
// Both materials were set - THIS CAUSED THE BUG
mesh.customDepthMaterial = customDepthMaterial;
mesh.customDistanceMaterial = customDistanceMaterial;

mesh.onBeforeShadow = (_renderer, _object, _camera, shadowCamera, _geometry, depthMaterial) => {
  if (depthMaterial === customDistanceMaterial) {
    const uniforms = customDistanceMaterial.uniforms;
    const perspCamera = shadowCamera as THREE.PerspectiveCamera;
    uniforms.referencePosition!.value.copy(shadowCamera.position);
    uniforms.nearDistance!.value = perspCamera.near;
    uniforms.farDistance!.value = perspCamera.far;
  }
};
```

---

## Investigation Timeline

### Experiment 1: Debug Logging in onBeforeShadow
**Hypothesis:** Multiple lights or shadow passes causing double render.

**Action:** Added console logging to count shadow passes and unique light positions.

**Result:** `"3 calls, 1 unique positions"` - Only one light, called 3 times (normal for 6 cube faces, optimized).

**Conclusion:** Not a multiple-light issue.

---

### Experiment 2: Disable Custom Materials
**Hypothesis:** Bug is in our custom shadow materials.

**Action:** Commented out both `customDepthMaterial` and `customDistanceMaterial` assignments.

**Result:** Single correct shadow (but static, doesn't animate with object).

**Conclusion:** Bug confirmed to be in custom material setup.

---

### Experiment 3: Disable nD Transformation in Shader
**Hypothesis:** n-dimensional transformation in vertex shader causing duplicate geometry.

**Action:** Modified vertex shader to use raw `position` instead of transformed position.

**Result:** Double shadow persisted.

**Conclusion:** nD transformation is NOT the cause.

---

### Experiment 4: Fix GLSL Version Mismatch
**Hypothesis:** Mixed GLSL 1.0 and 3.0 syntax causing undefined behavior.

**Observation:** Vertex shaders used `in`/`out` (GLSL 3.0) but fragment shaders used `gl_FragColor` (GLSL 1.0).

**Action:**
1. Changed fragment shaders to use `out vec4 fragColor` instead of `gl_FragColor`
2. Added `glslVersion: THREE.GLSL3` to material options

**Fragment Shader Fix:**
```glsl
// Before (GLSL 1.0 style)
void main() {
  ...
  gl_FragColor = packDepthToRGBA(dist);
}

// After (GLSL 3.0 style)
out vec4 fragColor;
void main() {
  ...
  fragColor = packDepthToRGBA(dist);
}
```

**Result:** Double shadow persisted.

**Conclusion:** GLSL version was not the cause (though the fix was correct and should remain).

---

### Experiment 5: Change DoubleSide to FrontSide
**Hypothesis:** `DoubleSide` rendering causing front and back faces to cast separate shadows.

**Action:** Changed `side: DoubleSide` to `side: FrontSide` on custom materials.

**Result:** Double shadow persisted.

**Conclusion:** Face culling is NOT the cause.

---

### Experiment 6: Verify Ground Plane Type
**Hypothesis:** Ground plane type (`two-sided` vs `plane`) affecting shadow reception.

**Action:** Tested with both ground plane types.

**Result:** Double shadow appeared on both plane types.

**Conclusion:** Ground plane configuration is NOT the cause.

---

### Experiment 7: Remove customDepthMaterial (THE WORKAROUND)
**Hypothesis:** Setting both `customDepthMaterial` AND `customDistanceMaterial` causes interference.

**Action:** Commented out only the `customDepthMaterial` assignment:
```typescript
// mesh.customDepthMaterial = customDepthMaterial;  // REMOVED
mesh.customDistanceMaterial = customDistanceMaterial;  // KEPT
```

**Result:** Single correct shadow that animates properly with the object!

**Conclusion:** Setting `customDepthMaterial` interferes with point light shadows even though it should only be used for directional/spot lights.

---

## Session 2: Attempting to Support All Light Types

**Goal:** Enable animated shadows for point lights, directional lights, AND spot lights simultaneously.

---

### Experiment 8: uDiscard Approach
**Hypothesis:** We can set both materials but use a `uDiscard` uniform to prevent `customDepthMaterial` from rendering during point light passes.

**Action:**
1. Added `uDiscard` uniform to `customDepthMaterial`
2. Added `uDiscard` check in fragment shader: `if (uDiscard > 0.5) discard;`
3. Detect point light pass by checking if render target is `WebGLCubeRenderTarget`
4. Set `uDiscard = 1.0` during point light passes

**Code:**
```typescript
mesh.onBeforeShadow = (renderer, ..., depthMaterial) => {
  const renderTarget = renderer.getRenderTarget();
  const isPointLightShadow = renderTarget?.isWebGLCubeRenderTarget === true;

  if (depthMaterial === customDepthMaterial) {
    customDepthMaterial.uniforms.uDiscard.value = isPointLightShadow ? 1.0 : 0.0;
  }
};
```

**Result:** THREE shadows appeared instead of two! Made the problem worse.

**Conclusion:** `isWebGLCubeRenderTarget` check is WRONG - Three.js uses packed 2D textures for point light shadows, not cube render targets.

---

### Experiment 9: Light Type Detection via FOV
**Hypothesis:** Detect point light passes by checking shadow camera FOV (point lights use fov=90 for cube faces).

**Action:**
1. Check if `shadowCamera.isPerspectiveCamera` and `fov === 90`
2. Point lights: PerspectiveCamera with fov=90
3. Spot lights: PerspectiveCamera with variable fov
4. Directional lights: OrthographicCamera

**Debug Output:**
```
[SHADOW] mat=DEPTH, isPersp=true, isOrtho=undefined, fov=60.0
```

**Key Finding:** Initially only saw `mat=DEPTH` with `fov=60` - this indicated a spot light was in the scene, NOT a point light. Later testing with actual point light showed:
```
[SHADOW] mat=DISTANCE, lightType=PerspectiveCamera, isPersp=true, isOrtho=false, fov=90.0
```

**Conclusion:** FOV detection works - point lights DO use fov=90. But double shadow still persisted.

---

### Experiment 10: Adding isMeshDistanceMaterial Flag
**Hypothesis:** Three.js might need `isMeshDistanceMaterial = true` flag to properly select and use our custom distance material.

**Action:**
```typescript
(material as any).isMeshDistanceMaterial = true;
```

**Result:** Runtime error!
```
Uncaught TypeError: Cannot set properties of undefined (setting 'value')
```

**Root Cause Found:** When `isMeshDistanceMaterial = true` is set, Three.js tries to update uniforms DIRECTLY on the material:
```javascript
// Three.js internal code:
material.referencePosition.copy(lightPositionWorld);
material.nearDistance = shadowCameraNear;
material.farDistance = shadowCameraFar;
```

But our `ShaderMaterial` uses `material.uniforms.referencePosition.value` instead!

**Conclusion:** Cannot use `isMeshDistanceMaterial` flag with custom ShaderMaterial. Must update uniforms manually in `onBeforeShadow`.

---

### Experiment 11: Remove Flags, Keep Manual Updates
**Hypothesis:** Remove `isMeshDistanceMaterial` and `isMeshDepthMaterial` flags, rely solely on manual uniform updates.

**Action:** Removed both flags, kept onBeforeShadow uniform updates.

**Result:** Double shadow still persisted with different shape - "more on a line" and disappearing when moving light.

**Conclusion:** The flags were not the cause of the double shadow.

---

### Final Reversion: Back to Workaround
**Action:** Reverted to only setting `customDistanceMaterial`, removed `customDepthMaterial` entirely.

**Result:** Single correct animated shadow for point lights.

**Current State:** Workaround remains in place.

---

## Key Findings

### What We Learned

1. **Three.js Material Selection Works Correctly**
   - Three.js properly selects `customDistanceMaterial` for point lights (`light.isPointLight === true`)
   - Three.js properly selects `customDepthMaterial` for spot/directional lights
   - The selection logic is NOT the bug

2. **isMeshDistanceMaterial Flag is Incompatible with ShaderMaterial**
   - When set, Three.js tries to set `material.referencePosition` directly
   - ShaderMaterial uses `material.uniforms.referencePosition.value`
   - This causes "Cannot set properties of undefined" error

3. **Point Light Shadow Camera Uses fov=90**
   - Each of the 6 cube faces uses a PerspectiveCamera with fov=90
   - Spot lights use variable fov based on cone angle
   - This can be used for light type detection

4. **The Double Shadow Bug is NOT Caused By:**
   - GLSL version mismatch
   - DoubleSide face culling
   - Ground plane configuration
   - nD transformation in shader
   - Wrong render target detection
   - Missing material type flags

5. **The Double Shadow Bug IS Caused By:**
   - Setting both `customDepthMaterial` AND `customDistanceMaterial` on the same mesh
   - Root cause mechanism still unknown
   - Even with uDiscard logic, the bug persists (or gets worse - 3 shadows!)

---

## Current Code (Workaround Applied)

```typescript
if (mesh && shadowEnabled) {
  // Only set customDistanceMaterial for point light shadows
  // Setting customDepthMaterial causes double shadow bug with point lights
  mesh.customDistanceMaterial = customDistanceMaterial;

  mesh.onBeforeShadow = (_renderer, _object, _camera, shadowCamera, _geometry, depthMaterial) => {
    // Update point light shadow uniforms
    if (depthMaterial === customDistanceMaterial && customDistanceMaterial?.uniforms) {
      const uniforms = customDistanceMaterial.uniforms;
      const perspCamera = shadowCamera as THREE.PerspectiveCamera;
      if (uniforms.referencePosition) uniforms.referencePosition.value.copy(shadowCamera.position);
      if (uniforms.nearDistance) uniforms.nearDistance.value = perspCamera.near;
      if (uniforms.farDistance) uniforms.farDistance.value = perspCamera.far;
    }
  };
}
```

---

## Implications of Workaround

The application supports up to 4 light sources of different types:
- Point lights
- Spot lights
- Directional lights

**Current State:**
| Light Type | Shadow Animation | Issue |
|------------|------------------|-------|
| Point | Works correctly | None |
| Spot | STATIC | No customDepthMaterial = no animated shadows |
| Directional | STATIC | No customDepthMaterial = no animated shadows |

**Impact:** Spot and directional lights will cast shadows that don't animate with the polytope's rotation. This is noticeable when the polytope is rotating - its shadow stays in one position instead of rotating with it.

---

## Open Questions for Root Cause Investigation

1. **Why does setting `customDepthMaterial` affect point light shadow rendering?**
   - Point lights should only use `customDistanceMaterial`
   - Three.js source confirms material selection is based on `light.isPointLight`
   - Yet having both materials set causes double rendering

2. **Why does uDiscard make it WORSE (3 shadows)?**
   - Even when customDepthMaterial fragments are discarded, extra shadows appear
   - Suggests the issue isn't about fragments being rendered

3. **Is there shared state between the materials?**
   - Both materials share the same ND transformation uniforms
   - Could updating one material affect the other?

4. **Is the geometry being submitted twice?**
   - Maybe the mesh itself is being processed multiple times
   - Need to investigate Three.js shadow render loop

5. **Could this be a Three.js bug?**
   - The behavior contradicts Three.js documentation
   - Should search Three.js issues for similar reports

---

## Session 3: Dynamic Material Swapping (IMPLEMENTED)

**Date:** 2025-12-19
**Status:** SOLUTION IMPLEMENTED

---

### Solution: Dynamic Material Swapping

**Hypothesis:** Only set the custom material(s) needed for the currently active light types.

**Implementation:**
1. Subscribe to the lights store to know which light types are active
2. Compute `hasPointLightShadows` and `hasDepthShadows` based on enabled lights
3. Dynamically assign only the required material(s):
   - Only point lights → set `customDistanceMaterial` only
   - Only directional/spot → set `customDepthMaterial` only
   - Mixed light types → set both (known limitation: may trigger double shadow for point lights)
   - No shadows → clear both materials
4. Added a useEffect to update materials when light configuration changes at runtime

**Files Modified:**
- `src/rendering/renderers/Polytope/PolytopeScene.tsx`
- `src/rendering/renderers/TubeWireframe/TubeWireframe.tsx`

**Code Example (PolytopeScene.tsx):**
```typescript
// Compute which shadow material types are needed based on active lights
const { hasPointLightShadows, hasDepthShadows } = useMemo(() => {
  if (!shadowEnabled) {
    return { hasPointLightShadows: false, hasDepthShadows: false };
  }
  let hasPoint = false;
  let hasDepth = false;
  for (const light of lights) {
    if (light.enabled) {
      if (light.type === 'point') {
        hasPoint = true;
      } else {
        hasDepth = true;
      }
    }
  }
  return { hasPointLightShadows: hasPoint, hasDepthShadows: hasDepth };
}, [shadowEnabled, lights]);

// Dynamic material assignment
if (hasPointLightShadows && !hasDepthShadows) {
  mesh.customDistanceMaterial = customDistanceMaterial;
  mesh.customDepthMaterial = undefined;
} else if (hasDepthShadows && !hasPointLightShadows) {
  mesh.customDepthMaterial = customDepthMaterial;
  mesh.customDistanceMaterial = undefined;
} else if (hasPointLightShadows && hasDepthShadows) {
  // Mixed: set both (known limitation)
  mesh.customDistanceMaterial = customDistanceMaterial;
  mesh.customDepthMaterial = customDepthMaterial;
}
```

**Expected Behavior:**
| Light Configuration | Point Light Shadows | Dir/Spot Shadows | Notes |
|---------------------|---------------------|------------------|-------|
| Only Point Lights | ✅ Work correctly | N/A | No double shadow bug |
| Only Dir/Spot Lights | N/A | ✅ Work correctly | Animated shadows |
| Mixed Light Types | ⚠️ May double shadow | ✅ Work correctly | Known limitation |
| No Shadow Lights | N/A | N/A | Materials cleared |

---

## Potential Future Solutions

1. ~~**Dynamic Material Swapping**~~ ⚠️ WORKAROUND (see Session 3) - Had limitations with mixed light types

2. ~~**Unified Material Approach**~~ ❌ NOT NEEDED - Patched built-in materials work better

3. ~~**Report Issue to Three.js**~~ ❌ NOT A BUG - We were using ShaderMaterial incorrectly

4. ✅ **Patched Built-in Materials** - THE CORRECT SOLUTION (see Session 4)
   - Use `MeshDepthMaterial` and `MeshDistanceMaterial`
   - Inject custom vertex transformation via `onBeforeCompile`
   - Preserves Three.js's internal shadow handling
   - All light types work together

---

## Secondary Issue: Wythoff Polytope No Shadow

**Symptom:** Wythoff polytopes (a specific polytope generation algorithm) create no shadow at all with point lights.

**Status:** Not yet investigated.

**Possible Causes:**
- Different geometry structure
- Face winding issues
- Shadow material not being applied correctly to Wythoff meshes
- Geometry might have degenerate faces

**Next Steps:**
1. Compare Wythoff mesh structure to regular polytopes
2. Check if `customDistanceMaterial` is being assigned
3. Verify vertex positions are within shadow camera frustum

---

## Files Changed

1. `src/rendering/renderers/Polytope/PolytopeScene.tsx`
   - Removed `customDepthMaterial` assignment
   - Added explanatory comments about the workaround
   - Fixed GLSL version and face culling (kept despite not fixing the issue)
   - Added/removed debug logging during investigation
   - Tried and reverted uDiscard approach
   - Tried and reverted isMeshDistanceMaterial flag

2. `src/rendering/shaders/shared/depth/customDepth.glsl.ts`
   - Fixed GLSL 3.0 syntax (`out vec4 fragColor`)
   - Added `uDiscard` uniform (kept for potential future use)
   - Added `glslVersion: THREE.GLSL3` to material options

---

## Lessons Learned

1. **Custom shadow materials are tricky** - The interaction between `customDepthMaterial` and `customDistanceMaterial` is not well documented.

2. **Debug incrementally** - Disabling features one by one (custom materials, nD transform) quickly narrowed down the cause.

3. **Observe carefully** - The "opposite direction" movement clue was key to understanding the mirroring behavior.

4. **Document workarounds** - Even when root cause is unknown, documenting what works and what doesn't helps future debugging.

5. **Check Three.js internals** - The `isMeshDistanceMaterial` flag behavior was only discoverable by reading Three.js source code.

6. **FOV can identify light types** - Point lights use fov=90, which is a reliable detection method.

7. **ShaderMaterial has different uniform access** - Three.js built-in materials use direct property access, ShaderMaterial uses `.uniforms.X.value`.

---

## References

- [Three.js Shadow Mapping](https://threejs.org/docs/#api/en/lights/shadows/LightShadow)
- [Three.js Custom Depth Material](https://threejs.org/docs/#api/en/objects/Mesh.customDepthMaterial)
- [Three.js Custom Distance Material](https://threejs.org/docs/#api/en/objects/Mesh.customDistanceMaterial)
- [Three.js WebGLShadowMap Source](https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgl/WebGLShadowMap.js)
- [Three.js MeshDistanceMaterial PR #11791](https://github.com/mrdoob/three.js/pull/11791/files)
- [LearnOpenGL Shadow Mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping)

---

## Session 4: ROOT CAUSE FOUND AND FIXED

**Date:** 2025-12-19
**Status:** ✅ SOLUTION IMPLEMENTED AND VERIFIED

---

### Root Cause Analysis

An expert review identified the actual root cause:

**The Problem:** Using raw `ShaderMaterial` for shadow materials breaks Three.js's internal shadow pipeline invariants.

Three.js has special handling for `MeshDistanceMaterial` that raw `ShaderMaterial` cannot satisfy:
1. Three.js automatically updates `referencePosition`, `nearDistance`, and `farDistance` properties on MeshDistanceMaterial
2. These are set as direct properties on the material (not via `.uniforms.X.value`)
3. Raw ShaderMaterial doesn't expose these as direct properties
4. The `onBeforeShadow` callback we used was a workaround that didn't fully replicate Three.js's internal behavior

When both `customDepthMaterial` and `customDistanceMaterial` are raw ShaderMaterials, the internal shadow pipeline gets confused, causing the double shadow.

---

### The Solution: Patched Built-in Materials

Instead of raw ShaderMaterial, we now use Three.js's built-in `MeshDepthMaterial` and `MeshDistanceMaterial` and inject our nD vertex transformation via `onBeforeCompile`.

**Key Insight:** `onBeforeCompile` lets us modify the shader code while keeping Three.js's internal property handling intact. This means:
- Three.js automatically manages `referencePosition`, `nearDistance`, `farDistance` for point lights
- No `onBeforeShadow` callback needed
- Both materials can be set simultaneously without conflict
- All light types work together (point, directional, spot)

---

### Implementation

**PolytopeScene.tsx:**

```typescript
/**
 * GLSL code for nD transformation, injected into built-in shadow materials.
 */
const ND_TRANSFORM_GLSL = `
#define MAX_EXTRA_DIMS 7

uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Vertex modulation uniforms
uniform float uAnimTime;
uniform float uModAmplitude;
uniform float uModFrequency;
uniform float uModWave;
uniform float uModBias;

// Extra dimension attributes
attribute vec4 aExtraDims0_3;
attribute vec3 aExtraDims4_6;

vec3 ndTransformVertex(vec3 pos) {
  // ... nD transformation logic ...
  return projected;
}
`;

/**
 * Create patched shadow materials using Three.js built-in materials
 * with our nD transformation injected via onBeforeCompile.
 */
function createPatchedShadowMaterials(uniforms: Record<string, { value: unknown }>): {
  depthMaterial: THREE.MeshDepthMaterial;
  distanceMaterial: THREE.MeshDistanceMaterial;
} {
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });

  const distanceMaterial = new THREE.MeshDistanceMaterial();

  const patchMaterial = (mat: THREE.Material) => {
    mat.onBeforeCompile = (shader) => {
      // Merge our nD uniforms with Three.js's built-in uniforms
      Object.assign(shader.uniforms, uniforms);

      // Inject GLSL helpers after #include <common>
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${ND_TRANSFORM_GLSL}`
      );

      // Apply transformation after #include <begin_vertex>
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed = ndTransformVertex(transformed);`
      );
    };
    mat.needsUpdate = true;
  };

  patchMaterial(depthMaterial);
  patchMaterial(distanceMaterial);

  return { depthMaterial, distanceMaterial };
}
```

**Usage:**

```typescript
// Create shared uniforms (updated per-frame)
const shadowUniforms = useMemo(() => createNDUniforms(), []);

// Create patched materials
const { depthMaterial, distanceMaterial } = useMemo(
  () => createPatchedShadowMaterials(shadowUniforms),
  [shadowUniforms]
);

// Assign both materials - works with all light types!
mesh.customDepthMaterial = depthMaterial;
mesh.customDistanceMaterial = distanceMaterial;

// No onBeforeShadow needed - Three.js handles everything automatically
```

---

### Why This Works

1. **MeshDistanceMaterial gets special treatment:** Three.js's internal `WebGLShadowMap` code checks `material.isMeshDistanceMaterial` and directly sets `material.referencePosition`, `material.nearDistance`, and `material.farDistance`. Our patched material retains this flag and behavior.

2. **onBeforeCompile preserves internal behavior:** Unlike creating a raw ShaderMaterial, patching via `onBeforeCompile` keeps all of Three.js's internal setup intact. We only add our vertex transformation.

3. **Shared uniforms:** Both materials share the same uniform object reference. Updating `shadowUniforms` in useFrame automatically updates both compiled shaders.

4. **No material interference:** Since we're using the correct material types, Three.js properly routes point lights to MeshDistanceMaterial and directional/spot to MeshDepthMaterial without any cross-interference.

---

### Files Modified

1. **`src/rendering/renderers/Polytope/PolytopeScene.tsx`**
   - Added `ND_TRANSFORM_GLSL` constant with nD transformation code
   - Added `createPatchedShadowMaterials()` function
   - Replaced raw ShaderMaterial shadow materials with patched built-in materials
   - Removed `onBeforeShadow` callback (no longer needed)
   - Simplified shadow material assignment (always set both)
   - Updated useFrame to update shared `shadowUniforms`

2. **`src/rendering/renderers/TubeWireframe/TubeWireframe.tsx`**
   - Added `TUBE_ND_TRANSFORM_GLSL` for tube-specific vertex transformation
   - Added `createTubeShadowUniforms()` and `createPatchedTubeShadowMaterials()`
   - Same patching approach as PolytopeScene
   - Removed dynamic material swapping logic

---

### Result

| Light Configuration | Point Shadows | Directional Shadows | Spot Shadows |
|---------------------|---------------|---------------------|--------------|
| Any combination     | ✅ Works      | ✅ Works            | ✅ Works     |

All light types now work correctly together without the double shadow bug.

---

## Key Takeaways for Future Developers

### DO: Use Patched Built-in Materials for Custom Shadow Rendering

```typescript
// ✅ CORRECT: Patch built-in materials
const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depthMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, myUniforms);
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed = myTransform(transformed);'
  );
};

const distanceMaterial = new THREE.MeshDistanceMaterial();
distanceMaterial.onBeforeCompile = (shader) => { /* same pattern */ };

mesh.customDepthMaterial = depthMaterial;
mesh.customDistanceMaterial = distanceMaterial;
```

### DON'T: Use Raw ShaderMaterial for Shadow Materials

```typescript
// ❌ WRONG: Raw ShaderMaterial breaks Three.js shadow invariants
const distanceMaterial = new ShaderMaterial({
  uniforms: {
    referencePosition: { value: new Vector3() },
    nearDistance: { value: 1.0 },
    farDistance: { value: 1000.0 },
    // ...
  },
  vertexShader: myDistanceVertexShader,
  fragmentShader: myDistanceFragmentShader,
});

// This causes the double shadow bug!
mesh.customDistanceMaterial = distanceMaterial;
```

### Why Raw ShaderMaterial Fails

Three.js's shadow system expects specific behaviors from `MeshDistanceMaterial`:
1. Direct property access: `material.referencePosition = lightPosition` (not `.uniforms.referencePosition.value`)
2. Internal flags: `isMeshDistanceMaterial = true` triggers special handling
3. Automatic uniform updates in the shadow render loop

Raw ShaderMaterial can't satisfy these requirements, leading to undefined behavior like double shadows.

---

## The Investigation Was Valuable

While the early experiments (GLSL version, DoubleSide, uDiscard, etc.) didn't fix the bug directly, they:
1. Eliminated many potential causes
2. Documented the exact behavior of Three.js's shadow system
3. Revealed the `isMeshDistanceMaterial` flag behavior
4. Led to understanding the root cause

The workaround (dynamic material swapping) was functional but had limitations. The final solution using patched built-in materials is the correct approach.
