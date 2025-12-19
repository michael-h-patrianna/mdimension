---
description: Fix physical fog white screen bug with bloom.
---

=== IMMUTABLE QUALITY GATES (MUST PASS BEFORE CLAIMING SUCCESS) ===

**GATE 1**: Scene IS rendered (< 90% black pixels, avg brightness > 10, has variance)
**GATE 2**: Screen is NOT predominantly white (< 85% white pixels)
**GATE 3**: Average brightness is reasonable (< 250/255)
**GATE 4**: No WebGL/GLSL shader compilation errors in console

You CANNOT claim success without running the automated test and passing ALL gates.

**Test Command**: `node scripts/playwright/physical-fog-white-screen.spec.mjs`

**NEVER** delete learnings and documentation of prior fix attempts from the log file. Append, do not overwrite or delete.

=== END IMMUTABLE GATES ===

=== IMMUTABLE DOCUMENTATION MANDATE ===

**Continuously Document Findings**: After every observation, failed fix, or insight, add it to the log file.
**NEVER** delete prior entries. Append only. Correct insights only if proven false.
**Update Log While Working**: Write to log immediately upon new learnings.

=== END IMMUTABLE DOCUMENTATION MANDATE ===

## Bug Description

When "Physical" fog type is enabled with bloom, the screen turns white over ~1 second and animation freezes. No console errors are shown.

**Symptoms**:
- Screen gradually becomes white when physical fog + bloom are both enabled
- Animation/scene updates freeze
- No JavaScript errors in console (shader compilation fails silently)

**Likely Root Causes**:
1. **GLSL Version Mismatch**: Mixing WebGL2-only constructs (`sampler3D`) with WebGL1 syntax (`gl_FragColor`, `varying`, `texture2D`)
2. **Unbounded HDR Values**: Light scattering accumulation exceeds 1.0, bloom amplifies to infinity
3. **Depth Texture Not Bound**: Shader receives null depth, produces garbage/NaN values

**Key Files**:
| File | Issue |
|------|-------|
| `src/rendering/passes/VolumetricFogPass.ts` | Missing `glslVersion: THREE.GLSL3`, WebGL1 shader syntax |
| `src/rendering/shaders/postprocessing/VolumetricFogShader.ts` | Uses `gl_FragColor`, no HDR clamping |
| `src/rendering/environment/PostProcessing.tsx` | Depth texture binding |

## Success Criteria

Run the automated test:
```bash
node scripts/playwright/physical-fog-white-screen.spec.mjs
```

Test must:
1. Enable fog with "Physical" type
2. Wait 2 seconds with bloom enabled
3. Verify screen is NOT white
4. Verify no shader errors

## Mandatory Workflow

Execute steps IN ORDER. Do not skip steps.

### Step 0: Initialize

Create or read log file: `docs/prd/bugfixing/log/physical-fog-white-screen.md`

### Step 1: Run Baseline Test

```bash
npm run dev &
sleep 5
node scripts/playwright/physical-fog-white-screen.spec.mjs
```

Record the failure state:
- White pixel ratio
- Average brightness
- Any console errors
- Screenshot location

### Step 2: Investigate Shaders

Check these specific issues:

**VolumetricFogPass.ts**:
```typescript
// Line ~100 and ~146: Missing glslVersion
this.material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,  // MUST be present for WebGL2
    ...
});

// Vertex shaders: Must use "out" not "varying"
const vertexShader = `
out vec2 vUv;  // NOT "varying vec2 vUv"
...
`;

// Fragment shader composite: Must use "in" and "layout out"
const fragmentShader = `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;  // NOT "gl_FragColor"
...
// Use texture() not texture2D()
`;
```

**VolumetricFogShader.ts**:
```glsl
// Must have output declaration
layout(location = 0) out vec4 fragColor;

// Must clamp HDR values to prevent bloom blowout
#define MAX_SCATTERING 2.0
#define MAX_ACCUMULATED_COLOR 4.0

// In raymarch loop:
scattering = min(scattering, vec3(MAX_SCATTERING));

// Final output:
finalFog = min(finalFog, vec3(MAX_ACCUMULATED_COLOR));
fragColor = vec4(finalFog, 1.0 - transmittance);
```

### Step 3: Check Style Guide

Read `docs/meta/styleguide.md` for WebGL2/GLSL ES 3.00 requirements:
- All shaders MUST use `glslVersion: THREE.GLSL3`
- Use `in`/`out` not `attribute`/`varying`
- Use `layout(location = N) out vec4 varName` not `gl_FragColor`
- Use `texture()` not `texture2D()`

### Step 4: Apply Fix

Make targeted changes following the style guide. Key fixes:

1. Add `glslVersion: THREE.GLSL3` to both ShaderMaterial constructors
2. Update vertex shaders: `varying` → `out`
3. Update fragment shaders: `varying` → `in`, add `layout(location = 0) out vec4 fragColor`
4. Replace `gl_FragColor = x` → `fragColor = x`
5. Replace `texture2D()` → `texture()`
6. Add HDR clamping constants and clamp operations

### Step 5: Run Test

```bash
node scripts/playwright/physical-fog-white-screen.spec.mjs
```

If test fails, record in log file:
- What fix was attempted
- What the result was
- Any new observations

### Step 6: Gate Check

Only claim success when ALL gates pass:

```
GATE 1 (Scene rendered):
  Black pixel ratio: X% (must be < 90%)
  Average brightness: X/255 (must be > 10)
  Brightness range: X (must be > 5 for variance)
  Result: PASS/FAIL
  → If FAIL: Scene not rendering at all. Check shader compilation.

GATE 2 (Screen not white):
  White pixel ratio: X% (must be < 85%)
  Result: PASS/FAIL
  → If FAIL: HDR values exploding through bloom. Add clamping.

GATE 3 (Brightness reasonable):
  Average brightness: X/255 (must be < 250)
  Result: PASS/FAIL
  → If FAIL: Similar to Gate 2, bloom amplifying too-bright values.

GATE 4 (No WebGL errors):
  Shader errors found: YES/NO
  Result: PASS/FAIL
  → If FAIL: Check GLSL syntax, version compatibility.
```

### Step 7: Document

Update log file with:
- Root cause found
- Fix applied (file:line - what changed)
- All gate results
- Any insights for future

## Reference: Correct GLSL ES 3.00 Patterns

**Vertex Shader**:
```glsl
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Fragment Shader**:
```glsl
precision highp float;

in vec2 vUv;
layout(location = 0) out vec4 fragColor;

uniform sampler2D tTexture;

void main() {
    vec4 color = texture(tTexture, vUv);
    fragColor = color;
}
```

**ShaderMaterial**:
```typescript
new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: { ... }
});
```

## Constraints

- Do NOT disable physical fog or bloom
- Do NOT remove the volumetric fog feature
- Do NOT break other fog types (linear, volumetric)
- If stuck after 5 iterations, summarize findings and ask for guidance

## Success Declaration Format

Only after ALL gates pass:

```
=== BUG FIXED ===
Root cause: [one sentence]
Fix applied: [file:line - what changed]

Test Results:
  GATE 1 (Scene rendered): PASS - X% black, avg brightness X/255, range X
  GATE 2 (Screen not white): PASS - X% white pixels
  GATE 3 (Brightness reasonable): PASS - avg brightness X/255
  GATE 4 (No WebGL errors): PASS - no shader errors

Screenshot: screenshots/physical-fog-test.png
===
```
