---
description: Autonomous WebGL-to-WebGPU/TSL port parity investigation and fix session
---

# WebGL-to-WebGPU/TSL Port - Modern Patterns (r182+)

=== CONSTITUTIONAL PRINCIPLES (IMMUTABLE) ===

1. **100% PARITY:** Exact line-by-line WebGL-to-TSL porting - WebGL is the spec
2. **MODERN TSL ONLY:** Three.js r182+ patterns - reject all pre-2025 training data
3. **NO ABSTRACTIONS:** If it doesn't exist in WebGL, don't create it
4. **NO SHORTCUTS:** No hacks, stubs, TODOs, "temporary" solutions, or "good enough"
5. **BEST-OF-CLASS ONLY:** Production-ready, 2025/2026 patterns, senior-engineer quality
6. **THOROUGH:** Line-by-line comparison - no lazy scans

**FORBIDDEN:** "Let me simplify" / "pragmatic approach" / "for now" / "quick fix"

=== END CONSTITUTIONAL PRINCIPLES ===

**Purpose:** Autonomously investigate and fix issues in the WebGL-to-WebGPU/TSL port, ensuring exact parity with the proven WebGL implementation while using ONLY modern TSL patterns.

**Important:** This command runs autonomously until user stops it or investigation completes.

---

## CRITICAL: Modern TSL Patterns (r182+ - January 2025+)

=== MANDATORY TSL KNOWLEDGE BLOCK (MKB-001) ===

**AI training data is OUTDATED.** Most TSL examples online and in training data use deprecated patterns that cause WebGPU pipeline errors. You MUST follow these rules:

### 1. Varying Creation - MUST Be OUTSIDE Fn()

**The #1 cause of "Invalid PipelineLayout" WebGPU errors.**

```typescript
// WRONG - Causes WebGPU pipeline error
const createShader = () => Fn(() => {
  const myVarying = varying(someNode, 'vMyValue')  // WRONG LOCATION!
  return myVarying
})

// CORRECT - varying() OUTSIDE, setInterpolation() INSIDE
const myVarying = varying(someNode, 'vMyValue')  // OUTSIDE Fn()

const createShader = () => Fn(() => {
  myVarying.setInterpolation('flat', 'first')    // Configure INSIDE
  return texture(tex, myVarying).rgb
})
```

### 2. Complex Node Compositions - MUST Be OUTSIDE Fn()

Shadow samplers, texture nodes, multi-light nodes, IBL nodes - ALL created OUTSIDE `Fn()`.

```typescript
// WRONG - Causes "Invalid PipelineLayout" WebGPU error
const createShading = Fn(() => {
  const shadowSampler = sampleDirectionalSpotShadow(uniforms)  // WRONG!
  return litColor
})

// CORRECT - Complex nodes created OUTSIDE Fn(), referenced via closure
const shadowSampler = sampleDirectionalSpotShadow(uniforms)      // OUTSIDE Fn()
const multiLightNode = createMultiLightNode(lightUniforms, ...)  // OUTSIDE Fn()
const iblNode = computeIBL(iblUniforms)                          // OUTSIDE Fn()

const createShading = Fn(() => {
  const lightResult = multiLightNode(pos, normal, view, ...)     // USE via closure
  return litColor
})
```

**What MUST be OUTSIDE Fn():**
- `texture()` nodes for shadow maps, IBL, environment maps
- `varying()` declarations
- Shadow sampler Fn() nodes
- Multi-light Fn() nodes
- IBL Fn() nodes
- SSS Fn() nodes
- Any complex node composition

**What is OK INSIDE Fn():**
- Simple uniform references (`uniform.value`, `uniformArray.element()`)
- Math operations (`vec3()`, `float()`, `normalize()`, etc.)
- `setInterpolation()` calls on varyings
- Conditional branches (`If()`, `select()`)
- `.toVar()` declarations

### 3. GPU Branch Evaluation - BOTH Branches ALWAYS Execute

**The #2 cause of WebGPU rendering bugs.** Unlike JavaScript, TSL's `If()` and `select()` execute ALL branches due to GPU SIMD architecture.

```typescript
// WRONG - Division by zero happens even when condition is false!
const result = vec3(0, 1, 0).toVar('result')
If(len.greaterThan(0.0001), () => {
  result.assign(vec.div(len))  // EXECUTES EVEN WHEN len <= 0.0001!
})

// CORRECT - Guard BEFORE the If() block
const safeLen = max(len, float(0.0001))  // Guard here
If(len.greaterThan(0.0001), () => {
  result.assign(vec.div(safeLen))        // Safe: safeLen always >= 0.0001
})
```

**Operations requiring guards:**
| Operation | Risk | Guard Pattern |
|-----------|------|---------------|
| `div(a, b)` | Division by zero | `max(b, float(0.0001))` |
| `sqrt(x)` | Negative input | `max(x, float(0.0))` |
| `log(x)` | Zero/negative | `max(x, float(1e-8))` |
| `pow(x, y)` | Negative base | `max(x, float(0.0))` |
| `inverseSqrt(x)` | Zero | `max(x, float(1e-8))` |
| `normalize(v)` | Zero vector | Check `dot(v, v) > threshold` |

### 4. Function Renames (r170-r182) - USE NEW NAMES ONLY

| DEPRECATED (NEVER USE) | CORRECT (USE THIS) |
|-----------------------|-------------------|
| `varying()` | `toVarying()` |
| `vertexStage()` | `toVertexStage()` |
| `atan2(y, x)` | `atan(y, x)` |
| `PI2` | `TWO_PI` |
| `equals(x, y)` | `equal(x, y)` |
| `modInt(a, b)` | `mod(a, b)` |
| `cache(node)` | `isolate(node)` |
| `append()` | `Stack` |
| `label()` | `setName()` |
| `transformedNormalView` | `normalView` |
| `transformedNormalWorld` | `normalWorld` |
| `densityFog(color, density)` | `fog(color, densityFogFactor(density))` |
| `rangeFog(color, near, far)` | `fog(color, rangeFogFactor(near, far))` |
| `burn()` | `blendBurn()` |
| `dodge()` | `blendDodge()` |
| `screen()` | `blendScreen()` |
| `overlay()` | `blendOverlay()` |
| `uniforms()` | `uniformArray()` |
| `viewportTopLeft` | `viewportUV` |
| `passNode.setResolution()` | `passNode.setResolutionScale()` |

### 5. Mathematical Operators - Method Chaining Only

```typescript
// WRONG - JavaScript operators don't work on nodes
const result = a * 2 + b

// CORRECT - TSL methods
const result = a.mul(2).add(b)
// or
const result = add(mul(a, 2), b)

// WRONG - Math.sin() returns NaN
const wave = Math.sin(time)

// CORRECT - TSL function
const wave = sin(time)
// or
const wave = time.sin()
```

### 6. Import Paths (r170+)

```typescript
// WebGPU renderer and node materials
import {
  WebGPURenderer,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  MeshPhysicalNodeMaterial,
  PostProcessing
} from 'three/webgpu'

// TSL functions and nodes
import {
  Fn, If, Loop, Break, Continue, Return, Discard,
  float, int, vec2, vec3, vec4, mat3, mat4,
  uniform, uniformArray, attribute, varying,
  texture, cubeTexture,
  positionWorld, positionLocal, positionView,
  normalWorld, normalLocal, normalView,
  cameraPosition, time, deltaTime,
  // ... etc
} from 'three/tsl'
```

### 7. Material Property Rules for WebGPU

**NEVER change `transparent` or call `needsUpdate = true` at runtime:**

```typescript
// WRONG - Causes pipeline recreation -> "Invalid PipelineLayout"
useFrame(() => {
  material.transparent = opacity < 1      // PIPELINE RECREATION!
  material.needsUpdate = true             // FORCES RECOMPILATION!
})

// CORRECT - Create with transparent: true, only change depthWrite
const material = useMemo(() => {
  return new MeshBasicNodeMaterial({
    transparent: true,  // Always true from start
    depthWrite: opacity >= 1,
  })
}, [])

useFrame(() => {
  material.depthWrite = opacity >= 1  // OK - no pipeline recreation
  // NO needsUpdate!
})
```

### 8. Texture Handling - Stable TextureNodes

```typescript
// WRONG - Creates new texture node each call
private getPassthroughMaterial(inputTexture: THREE.Texture): THREE.Material {
  const texNode = texture(inputTexture, uv())  // NEW node each call!
  nodeMaterial.outputNode = vec4(texNode.rgb, texNode.a)
  nodeMaterial.needsUpdate = true  // Forces recompilation!
  return material
}

// CORRECT - Stable texture node, update value only
private passthroughTextureNode: ReturnType<typeof texture> | null = null

private getPassthroughMaterial(inputTexture: THREE.Texture): THREE.Material {
  if (!this.passthroughTextureNode) {
    // Create placeholder ONCE
    const placeholder = new THREE.DataTexture(new Uint8Array(64), 4, 4)
    this.passthroughTextureNode = texture(placeholder, uv())
    nodeMaterial.outputNode = vec4(this.passthroughTextureNode.rgb, ...)
  }

  // Update VALUE at runtime (NOT the node)
  (this.passthroughTextureNode as any).value = inputTexture
  // NO needsUpdate!
  return material
}
```

### 9. Render Graph Size Initialization

**Default is 1x1 pixel - ALWAYS call setSize():**

```typescript
// WRONG - All render targets are 1x1 pixels, output is garbage
const graph = new RenderGraphTSL()
graph.compile()

// CORRECT - setSize with DPR-adjusted dimensions
const graph = new RenderGraphTSL()
graph.compile()

useEffect(() => {
  const dpr = viewport.dpr
  const nativeWidth = Math.floor(size.width * dpr)
  const nativeHeight = Math.floor(size.height * dpr)
  graph.setSize(nativeWidth, nativeHeight)
}, [size.width, size.height, viewport.dpr])
```

### 10. Premultiplied Alpha for Compositing

**Industry standard - use premultiplied alpha, NOT forceOpaque:**

```typescript
// Material outputs premultiplied color
mat.outputNode = vec4(
  shadingColor.x.mul(opacityNode),
  shadingColor.y.mul(opacityNode),
  shadingColor.z.mul(opacityNode),
  opacityNode
)

// Composite shader uses premultiplied blend
const blendedColor = objColor.xyz.add(envColor.xyz.mul(float(1).sub(objColor.w)))
```

### 11. Compute Shaders (WebGPU Only)

```typescript
// Storage buffer
const buffer = instancedArray(COUNT, 'vec3')

// Compute shader
const computeNode = wgslFn(`
  fn compute(buffer: ptr<storage, array<vec3f>, read_write>, index: u32) {
    buffer[index] = vec3f(1.0, 2.0, 3.0);
  }
`)

// Dispatch
const computeCall = computeNode({ buffer, index: instanceIndex }).compute(COUNT)

// Execute
gl.computeAsync(computeCall)
// or
gl.compute(computeCall)
```

### 12. Post-Processing Setup

```typescript
import { PostProcessing } from 'three/webgpu'
import { pass } from 'three/tsl'

const postProcessing = new PostProcessing(renderer)
const scenePass = pass(scene, camera)
const diffuseTexture = scenePass.getTextureNode('output')
const depthTexture = scenePass.getTextureNode('depth')

postProcessing.outputNode = yourEffectNode(diffuseTexture)

// In useFrame with priority 1 to take over render loop
useFrame(() => {
  postProcessing.render()
}, 1)
```

=== END MKB-001 ===

---

## Phase 0: Initialize Session

**MANDATORY: Set up before starting autonomous loop.**

1. **Read mandatory context documents:**
   - `docs/tsl.md` - TSL modern patterns (CRITICAL - read first!)
   - `docs/architecture.md` - Project architecture

2. **Create TodoWrite session tracker:**
   - Session ID: WEBGPU-PORT-[timestamp]
   - Files compared counter
   - Issues found/fixed counter
   - Modern pattern violations found/fixed counter

3. **Build mental map of codebase pairs:**
   - WebGL shaders: `src/rendering/shaders/**/*.glsl.ts`
   - TSL implementations: `src/rendering/tsl/**/*.ts`
   - Renderer components: Compare WebGL vs TSL versions in `src/rendering/renderers/`

---

## Phase 1: Systematic Comparison Investigation

=== CRITICAL INSTRUCTION BLOCK [CIB-A1] ===

**INVESTIGATION DEPTH REQUIREMENT:**
- This is NOT a quick scan
- This is a THOROUGH, IN-DEPTH, LINE-BY-LINE comparison
- You MUST compare every function, every uniform, every default value
- You MUST trace the complete logic flow in both implementations
- You MUST check for BOTH parity issues AND modern TSL pattern violations
- You MUST document EVERY discrepancy, no matter how small

=== END CIB-A1 ===

**For each comparison round:**

### Step A: Select Comparison Target

Choose next WebGL/TSL pair to compare. Priority order:
1. Renderer-level implementations (BlackHole, Mandelbulb, Julia, Schroedinger, Polytope)
2. Shared utilities (lighting, shadows, colors, normals)
3. Feature implementations (SSS, Fresnel, AO, IBL)
4. Raymarching core logic
5. Post-processing effects

### Step B: Deep WebGL Analysis

**Read the WebGL implementation FIRST.** Document:

```json
{
  "file": "path/to/webgl/file.glsl.ts",
  "functions": [
    {
      "name": "functionName",
      "purpose": "what it does",
      "inputs": ["param1: type", "param2: type"],
      "outputs": "return type",
      "logic_summary": "step-by-step logic",
      "uniforms_used": ["uniform1", "uniform2"],
      "helper_functions_called": ["helper1", "helper2"],
      "inline_calculations": "yes/no - describe if inline"
    }
  ],
  "uniforms": [
    {
      "name": "uniformName",
      "type": "float/vec3/etc",
      "default_value": "exact default",
      "purpose": "what it controls"
    }
  ],
  "constants": ["CONST_NAME = value"],
  "code_structure": "describe overall organization"
}
```

### Step C: Deep TSL Analysis with Modern Pattern Check

**Read the TSL implementation.** Document using same structure PLUS:

```json
{
  "modern_pattern_violations": [
    {
      "violation_type": "varying_inside_fn|complex_node_inside_fn|deprecated_function|unguarded_division|runtime_transparent_change|unstable_texture_node|missing_setSize|wrong_import_path",
      "location": "line number",
      "code_snippet": "exact violating code",
      "fix": "correct modern pattern"
    }
  ],
  "deprecated_functions_used": ["atan2", "PI2", "equals", "..."],
  "gpu_branch_risks": ["unguarded sqrt/div/log operations in If/select blocks"]
}
```

### Step D: Line-by-Line Comparison

=== RECALL CIB-A1 ===
Apply thorough investigation requirement.
=== END RECALL ===

Compare and document TWO types of issues:

#### 1. Parity Discrepancies

```json
{
  "discrepancies": [
    {
      "type": "missing_feature|added_feature|modified_logic|renamed_variable|different_default|structural_change|new_abstraction",
      "severity": "critical|high|medium|low",
      "webgl_code": "exact code snippet from WebGL",
      "tsl_code": "exact code snippet from TSL (or 'MISSING')",
      "location": {
        "webgl_line": "line number",
        "tsl_line": "line number"
      },
      "description": "detailed explanation",
      "violation": "which constitutional principle this violates",
      "fix_approach": "how to restore parity"
    }
  ]
}
```

#### 2. Modern Pattern Violations

```json
{
  "modern_violations": [
    {
      "type": "varying_inside_fn|complex_node_inside_fn|deprecated_function|unguarded_gpu_branch|runtime_material_change|unstable_texture|missing_size_init",
      "severity": "critical|high|medium|low",
      "current_code": "violating code",
      "correct_code": "modern pattern fix",
      "reference": "MKB-001 section number"
    }
  ]
}
```

**Types of Violations to Detect:**

**Parity Issues:**
1. Missing Features: WebGL has it, TSL doesn't
2. Added Features: TSL has something WebGL doesn't (VIOLATION - remove it)
3. Modified Logic: Same feature, different implementation
4. Renamed Variables: Uniform/variable names don't match
5. Different Defaults: Same uniform, different default value
6. Structural Changes: Inline vs. function, loop structure changes
7. New Abstractions: TSL creates helpers/utilities that WebGL does inline

**Modern Pattern Issues:**
1. Varying created inside Fn()
2. Complex nodes (texture, shadow, IBL) created inside Fn()
3. Deprecated function names used
4. Unguarded math operations in If/select blocks
5. Runtime changes to `transparent` or `needsUpdate`
6. Unstable texture nodes recreated each frame
7. Missing render graph setSize() calls
8. Wrong import paths (not from 'three/webgpu' or 'three/tsl')
9. JavaScript Math.* functions instead of TSL equivalents
10. JavaScript operators instead of method chaining

### Step E: Check Existing TSL Infrastructure

Before planning fixes, investigate `src/rendering/tsl/` for:
- Existing utilities that can be reused
- Patterns already established for similar ports
- Shared code that should be imported, not duplicated

### Step F: Update TodoWrite with Fix Plan

Add findings to TodoWrite with:
- Task: "[Severity] [File]: [Issue Type] - [Description]"
- Reference: WebGL source file and line OR MKB-001 section
- Fix approach: Exact porting steps OR modern pattern to apply
- Priority: Based on severity

**NEVER OMIT ANY ITEMS:** Fix ALL discrepancies AND ALL modern pattern violations.

---

## Phase 2: Execute Fixes

**PORTING RULES:**

1. Read WebGL first, then port - match structure, names, defaults exactly
2. If WebGL does it inline, TSL does it inline - no new abstractions
3. Reuse existing `src/rendering/tsl/` infrastructure - don't duplicate
4. No stubs, no TODOs, no "fix later" - production-ready only
5. **ALWAYS apply modern TSL patterns from MKB-001**

**For each fix task:**

### Step A: Verify WebGL Source

Re-read the exact WebGL implementation being ported. Quote the relevant code.

### Step B: Write Exact TSL Port with Modern Patterns

Port line-by-line:
- Same logic flow
- Same variable names (adapt for TSL syntax only)
- Same calculations
- Same order of operations

**WHILE applying modern patterns:**
- All varyings declared OUTSIDE Fn()
- All complex nodes created OUTSIDE Fn()
- All math operations guarded before If/select blocks
- All deprecated functions replaced with modern equivalents
- All imports from correct paths

### Step C: Verify Parity AND Modern Patterns

Side-by-side comparison of:
- Every function signature
- Every uniform name and type
- Every default value
- Every calculation step
- Every helper function call

**PLUS verify:**
- No varying() calls inside Fn()
- No texture()/shadow/IBL nodes inside Fn()
- No deprecated function names
- All math operations properly guarded
- No runtime material property changes
- Stable texture nodes

### Step D: Check for Regression

Ensure the fix:
- Doesn't break other TSL code that depends on this
- Maintains compatibility with existing TSL patterns
- Uses existing TSL infrastructure where appropriate

### Step E: Mark Complete

Only when 100% parity AND 100% modern pattern compliance verified:
- Update TodoWrite
- Document the fix for future reference

---

## Phase 3: Start Next Round

=== AUTONOMOUS CONTINUATION PROTOCOL ===

1. Mark current round complete
2. If discrepancies remain in TodoWrite, continue fixing
3. If no discrepancies remain, select next file pair (Step A of Phase 1)
4. **MANDATORY:** Continue autonomously
5. **NEVER STOP** to ask for feedback - user will stop when needed
6. **NEVER claim "good enough"** - only 100% parity AND modern patterns is acceptable

=== END AUTONOMOUS CONTINUATION PROTOCOL ===

---

## Drift Prevention Checkpoints

**Every 5 tasks, ask yourself:**

1. Am I adding abstractions or "improving" WebGL code? -> STOP
2. Am I taking shortcuts or leaving TODOs? -> STOP
3. Am I doing superficial comparisons? -> STOP
4. Am I using deprecated TSL functions? -> STOP
5. Am I creating varyings/complex nodes inside Fn()? -> STOP
6. Am I leaving math operations unguarded in If/select? -> STOP
7. Would this pass senior engineer review at top-tier company? -> If no, REDO

---

## File Mapping Reference

**Known WebGL-TSL Pairs:**

| WebGL Location | TSL Location | Renderer |
|----------------|--------------|----------|
| `shaders/blackhole/` | `tsl/raymarching/blackhole/` | BlackHole |
| `shaders/mandelbulb/` | `tsl/raymarching/mandelbulb/` | Mandelbulb |
| `shaders/julia/` | `tsl/raymarching/julia/` | QuaternionJulia |
| `shaders/schroedinger/` | `tsl/raymarching/schroedinger/` | Schroedinger |
| `shaders/polytope/` | `tsl/materials/polytope/`, `tsl/compose/polytope/` | Polytope |
| `shaders/groundplane/` | `tsl/materials/GroundPlaneMaterialTSL.tsx` | GroundPlane |
| `shaders/skybox/` | `tsl/materials/skybox/` | Skybox |
| `shaders/tubewireframe/` | `tsl/materials/tubewireframe/`, `tsl/compose/tubewireframe/` | Polytope |
| `shaders/transforms/` | `tsl/transforms/` | All |
| `shaders/shared/lighting/` | `tsl/lighting/` | All |
| `shaders/shared/color/`, `shaders/palette/` | `tsl/color/` | All |
| `shaders/shared/features/` | `tsl/features/`, `tsl/compose/feature-blocks/` | All |
| `shaders/shared/features/shadows.glsl.ts` | `tsl/shadows/` | All |
| `shaders/shared/raymarch/` | `tsl/raymarching/` (core files) | Raymarchers |
| `shaders/postprocessing/` | `tsl/postprocessing/` | PostProcessing |

---

## Quality Gates

**Before marking ANY task complete:**

- [ ] WebGL read completely, compared line-by-line
- [ ] Names, defaults, logic flow match exactly
- [ ] No abstractions, no "improvements", no stubs, no TODOs
- [ ] **No varying() inside Fn()**
- [ ] **No complex nodes (texture/shadow/IBL) inside Fn()**
- [ ] **No deprecated function names**
- [ ] **All math guarded before If/select blocks**
- [ ] **No runtime transparent/needsUpdate changes**
- [ ] **Stable texture nodes (not recreated each frame)**
- [ ] **Correct imports from 'three/webgpu' and 'three/tsl'**
- [ ] Production-ready, type-safe, handles edge cases
- [ ] Would pass senior engineer review at top-tier company

---

## Autonomous Decision Making

- Uncertainty -> Read more WebGL code, check git history, read docs/tsl.md
- Complex solution needed -> Implement the complex solution (no simplifying)
- Modern pattern unclear -> Re-read MKB-001 section above
- STOP and ask only if: WebGL appears buggy, or architectural question

## No Token or Time Limit

- Quality over speed - no rushing, no shortcuts
- Continue until 100% parity AND 100% modern patterns achieved or user stops

---

## Quick Reference: Common Modern Pattern Fixes

### Fix: Varying Inside Fn()
```typescript
// BEFORE (wrong)
const shader = Fn(() => {
  const vNormal = varying(normalLocal, 'vNormal')
  return vNormal
})

// AFTER (correct)
const vNormal = varying(normalLocal, 'vNormal')  // OUTSIDE
const shader = Fn(() => {
  return vNormal
})
```

### Fix: Texture Node Inside Fn()
```typescript
// BEFORE (wrong)
const shader = Fn(() => {
  const envMapNode = texture(envMap)  // WRONG
  return envMapNode.sample(uv())
})

// AFTER (correct)
const envMapNode = texture(envMap)  // OUTSIDE
const shader = Fn(() => {
  return envMapNode.sample(uv())
})
```

### Fix: Unguarded Division in If Block
```typescript
// BEFORE (wrong)
If(len.greaterThan(0.001), () => {
  result.assign(vec.div(len))  // Executes even when false!
})

// AFTER (correct)
const safeLen = max(len, float(0.001))  // Guard BEFORE
If(len.greaterThan(0.001), () => {
  result.assign(vec.div(safeLen))
})
```

### Fix: Deprecated Function
```typescript
// BEFORE (deprecated)
const angle = atan2(y, x)
const phase = time.mul(PI2)

// AFTER (modern)
const angle = atan(y, x)
const phase = time.mul(TWO_PI)
```

### Fix: JavaScript Operators
```typescript
// BEFORE (wrong)
const result = a * 2 + b
const wave = Math.sin(time.value)

// AFTER (correct)
const result = a.mul(2).add(b)
const wave = sin(time)
```
