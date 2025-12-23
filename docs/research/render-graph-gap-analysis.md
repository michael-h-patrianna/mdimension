# Render Graph Gap Analysis: MDimension vs Industry Standards

> Comprehensive analysis comparing our render graph engine against Unreal RDG, Frostbite FrameGraph, and Unity SRP Render Graph.

## Executive Summary

Our render graph has solid foundations (topological sort, ping-pong detection, MRT awareness) but suffers from a **fundamental architectural difference** compared to industry engines: **It doesn't own all rendering state.**

Industry engines own everything - all render targets, all state transitions, all barriers. Our graph owns *some* render targets but critical state like `scene.background` and `scene.environment` is modified by 16+ different components outside the graph's control.

**Result: Structural race conditions are possible by design.**

---

## The Core Problem Illustrated

```
Black Hole Shader                     CubemapCapturePass                    React/Skybox.tsx
       │                                     │                                    │
       │ reads scene.background              │                                    │
       ├────────────────────────────────────►│ writes scene.background            │
       │                                     │ (takes 2 frames!)                  │
       │                                     │                                    │
       │                                     │◄───────────────────────────────────┤
       │                                     │     React updates skyboxTexture    │
       │ sees INCONSISTENT state!            │     (can happen ANY time)          │
       │                                     │                                    │
       ▼                                     ▼                                    ▼
    GL ERRORS                          Wrong output                        No coordination
```

The render graph can't prevent this because it doesn't control `scene.background`.

---

## Gap Analysis by Category

### 1. Resource Lifecycle & State Management

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Resource States | Explicit: Undefined → RenderTarget → ShaderRead → Present | None - just "allocated" or not | **Critical** |
| State Transitions | Automatic via barriers computed at compile | Patched via MRTStateManager | Reactive, not declarative |
| External Mutation | Forbidden during execute phase | 16+ files modify scene.background anytime | **Critical** |
| Resource Types | Transient, External, Temporal (versioned) | Only pingPong flag | **Critical** |

**Evidence:**
- `MRTStateManager.ts:168-227` - Patches `setRenderTarget` to manage drawBuffers
- `useBlackHoleUniformUpdates.ts:98-104` - Manual `lastValidEnvMapRef` caching as workaround

### 2. Dependency Resolution

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Declaration | Explicit pass parameter structs | Inferred from read/write | Partial |
| External Deps | RegisterExternal() with import/export | None - implicit via scene.* | **Critical** |
| Validation | All outputs consumed, no dead ends | Only cycle detection | Missing external validation |
| Output Targets | Always graph resources | CubemapCapturePass writes to scene.background! | **Critical** |

**Evidence:**
- `CubemapCapturePass.ts:242` - `scene.background = this.cubeRenderTarget.texture` (bypasses graph!)
- `Skybox.tsx:633` - Comment admits CubemapCapturePass handles scene.background

### 3. Multi-Frame / Temporal Resources

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Declaration | `RegisterTemporal("History", N)` | None | **Critical** |
| History Access | `getRead(frameOffset)` / `getWrite()` | Manual frameCount hacks | **Critical** |
| Versioning | Automatic per-frame versioning | Manual tracking | Missing |

**Evidence:**
- `CubemapCapturePass.ts:68-70`:
  ```typescript
  private needsCapture = true;
  private frameCount = 0;
  private static readonly CAPTURE_FRAMES = 2; // HACK!
  ```

### 4. MRT / Draw Buffer Management

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Configuration | Declarative in resource config | Patch-based (MRTStateManager) | Architectural |
| Validation | Shader/target compatibility at compile | Runtime GL_INVALID_OPERATION | Missing |
| Approach | First-class MRT concept | Special-case handling | Inconsistent |

**Evidence:**
- `ScenePass.ts:115-122`:
  ```typescript
  // MRT SAFETY ENFORCEMENT:
  // Three.js's internal skybox/environment shaders only output to location 0.
  // ...
  // Solution: Automatically disable background for MRT targets.
  ```
  This is a **workaround**, not a solution.

### 5. Setup vs Execute Timeline Separation

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Timeline Model | Setup → Compile → Execute (immutable) | Mixed, no clear separation | **Critical** |
| State Freezing | All state frozen before execute | React can update anytime | **Critical** |
| External Reads | Captured once at frame start | Read from stores during render | Race conditions |

**Evidence from Unreal RDG:**
> "The graph is built during the setup timeline. This is where resource creation and render pipeline configuration branching is done. All RHI commands are deferred into pass lambdas, which are called on the execute timeline."
> — [Unreal Engine RDG Documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/render-dependency-graph-in-unreal-engine)

Our implementation: `useFrame` callbacks interleave with render graph execution, and React can update stores mid-frame.

### 6. Validation & Error Prevention

| Aspect | Industry Standard | Our Implementation | Gap |
|--------|------------------|-------------------|-----|
| Cycle Detection | ✓ | ✓ | OK |
| Read-Before-Write | Warnings | Warnings | OK |
| External Resources | Validated at import | Not tracked | Missing |
| Shader Compatibility | Compile-time | Runtime GL errors | Missing |
| Debug Mode | Immediate execution (`r.RDG.ImmediateMode=1`) | None | Missing |

---

## Root Cause Analysis

### Why "All Is Blowing Up"

1. **Black hole needs skybox** → reads `scene.background`
2. **Skybox cubemap needs 2 frames** → CubemapCapturePass writes to `scene.background` over 2 frames
3. **React can update anytime** → `Skybox.tsx` useEffect can change texture mid-capture
4. **No synchronization** → Graph doesn't know about `scene.background`

### The Fundamental Mismatch

```
┌─────────────────────────────────────────────────────────────────────┐
│                      INDUSTRY RENDER GRAPH                          │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   SETUP     │───►│   COMPILE   │───►│   EXECUTE   │            │
│  │ (declare)   │    │ (validate)  │    │ (immutable) │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
│  Graph OWNS: All render targets, all state, all barriers           │
│  External: Imported explicitly, frozen during execute              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      YOUR RENDER GRAPH                              │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐                                │
│  │   SETUP     │───►│   EXECUTE   │◄─── React can modify anytime! │
│  │ (declare)   │    │ (mutable!)  │                                │
│  └─────────────┘    └─────────────┘                                │
│                           ▲                                         │
│                           │                                         │
│  ┌────────────────────────┴────────────────────────┐               │
│  │ scene.background, scene.environment, stores     │               │
│  │        (16+ components can modify)              │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
│  Graph OWNS: Some render targets                                   │
│  External: Implicitly accessed, can change mid-frame               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Fixes

### Tier 1: Immediate Stability (Low effort, high impact)

#### 1.1 External Resource Registry
Create explicit registration for external resources:

```typescript
interface ExternalResource<T> {
  id: string;
  getter: () => T;
  capturedValue: T | null;
}

class RenderGraph {
  private externalResources = new Map<string, ExternalResource<unknown>>();

  registerExternal<T>(id: string, getter: () => T): void {
    this.externalResources.set(id, { id, getter, capturedValue: null });
  }

  // Called ONCE at frame start, before any passes
  captureExternalResources(): void {
    for (const resource of this.externalResources.values()) {
      resource.capturedValue = resource.getter();
    }
  }

  // Passes use this, NOT direct scene.background access
  getExternal<T>(id: string): T | null {
    return this.externalResources.get(id)?.capturedValue as T ?? null;
  }
}
```

#### 1.2 Temporal Resource Wrapper
Replace manual frameCount with proper temporal resources:

```typescript
class TemporalResource<T> {
  private history: T[] = [];
  private writeIndex = 0;

  constructor(
    private frameCount: number,
    private factory: () => T
  ) {
    for (let i = 0; i < frameCount; i++) {
      this.history.push(factory());
    }
  }

  getRead(frameOffset: number = 1): T {
    const idx = (this.writeIndex - frameOffset + this.frameCount) % this.frameCount;
    return this.history[idx]!;
  }

  getWrite(): T {
    return this.history[this.writeIndex]!;
  }

  advanceFrame(): void {
    this.writeIndex = (this.writeIndex + 1) % this.frameCount;
  }
}
```

#### 1.3 Frame Context Capture
Freeze all external state at frame start:

```typescript
interface FrameContext {
  // Captured once at frame start
  readonly skyboxTexture: THREE.CubeTexture | null;
  readonly environmentTexture: THREE.Texture | null;
  readonly stores: {
    readonly appearance: AppearanceState;
    readonly lighting: LightingState;
    // ... other stores, frozen
  };
}

// In execute():
const frameContext = this.captureFrameContext();
for (const pass of this.compiled.passes) {
  pass.execute(context, frameContext); // Pass ONLY reads from frozen context
}
```

### Tier 2: Architectural Refactoring (Medium effort)

#### 2.1 Resource State Machine
Add explicit states and validate transitions:

```typescript
enum ResourceState {
  Created,
  WriteTarget,
  ShaderRead,
  Destroyed
}

interface TrackedResource {
  state: ResourceState;
  lastWriter: string | null;
  readers: string[];
}
```

#### 2.2 Pass Parameter Structs
Replace string-based access with typed handles:

```typescript
interface ScenePassParams {
  outputs: {
    color: ResourceHandle<'renderTarget'>;
    depth: ResourceHandle<'depthTexture'>;
  };
}

// Compiler validates all outputs are consumed
```

#### 2.3 External Resource Import/Export
Formal import at frame start, export at frame end:

```typescript
graph.importExternal('skyboxTexture', store.classicCubeTexture);
// ... execute passes ...
const result = graph.exportExternal('finalOutput');
```

### Tier 3: Full Industry Alignment (High effort)

#### 3.1 Two-Timeline Architecture
Complete separation of setup and execute:

```typescript
// SETUP TIMELINE (before frame)
graph.beginSetup();
graph.addPass(...);
graph.addResource(...);
graph.endSetup(); // Graph is now IMMUTABLE

// COMPILE (once, or when graph changes)
graph.compile();

// EXECUTE TIMELINE (per frame)
graph.beginExecute(renderer);
graph.execute(); // NO modifications allowed
graph.endExecute();
```

#### 3.2 Automatic Barrier Insertion
Compute barriers from resource state transitions:

```typescript
// Compile phase computes:
// - When each resource transitions from Write → Read
// - Insert synchronization barriers automatically
// - Enable async compute where safe
```

#### 3.3 Memory Aliasing
Resources with non-overlapping lifetimes share memory:

```typescript
// Compile phase discovers:
// - Resource A is dead by pass 5
// - Resource B is created at pass 7
// - A and B can alias in same GPU memory
```

---

## Specific Bug Fixes

### Black Hole + Skybox Race Condition

**Current flow (broken):**
1. Skybox.tsx useEffect loads texture
2. setClassicCubeTexture(texture) updates store
3. CubemapCapturePass reads from store
4. Writes to scene.background (takes 2 frames)
5. Black hole reads scene.background
6. Race: React can update store between steps 3-5

**Fixed flow:**
1. Skybox.tsx useEffect loads texture
2. setClassicCubeTexture(texture) updates store
3. **Frame start: captureExternalResources()** - freezes skyboxTexture
4. CubemapCapturePass reads from frozen context
5. Writes to **graph-owned temporal resource**
6. Black hole reads from **same temporal resource** (graph-managed)
7. **Frame end: export scene.background** from temporal resource

### CubemapCapturePass Multi-Frame Dependency

**Current (hack):**
```typescript
private needsCapture = true;
private frameCount = 0;
private static readonly CAPTURE_FRAMES = 2;

// Manual tracking, error-prone
if (this.frameCount < CubemapCapturePass.CAPTURE_FRAMES) {
  // capture...
  this.frameCount++;
}
```

**Fixed (proper temporal resource):**
```typescript
private cubemapHistory = new TemporalResource<THREE.WebGLCubeRenderTarget>(
  2, // 2 frames of history
  () => new THREE.WebGLCubeRenderTarget(this.resolution)
);

execute(ctx) {
  const writeTarget = this.cubemapHistory.getWrite();
  this.cubeCamera.update(ctx.renderer, ctx.scene);

  // Consumers read from previous frame
  const readTarget = this.cubemapHistory.getRead(1);
  ctx.setExternal('skyboxCubemap', readTarget.texture);
}

// Called automatically at frame end
postFrame() {
  this.cubemapHistory.advanceFrame();
}
```

---

## Sources

- [Unreal Engine RDG Documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/render-dependency-graph-in-unreal-engine)
- [Frostbite FrameGraph GDC 2017 (Yuriy O'Donnell)](https://gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in)
- [Frostbite FrameGraph PDF Slides](https://media.gdcvault.com/gdc2017/Presentations/ODonnell_Yuriy_FrameGraph.pdf)
- [Unity SRP Render Graph System](https://docs.unity3d.com/Packages/com.unity.render-pipelines.core@17.0/manual/render-graph-system.html)
- [Render Graphs Deep Dive (Riccardo Loggini)](https://logins.github.io/graphics/2021/05/31/RenderGraphs.html)
- [Render Graphs and Vulkan (Maister)](https://themaister.net/blog/2017/08/15/render-graphs-and-vulkan-a-deep-dive/)

---

## Conclusion

The render graph isn't "bad code" - it's solving the wrong problem. It schedules passes but doesn't own state. Industry engines own everything.

**The fix isn't more patches. The fix is:**
1. **Short-term:** Capture external state at frame start, freeze during execute
2. **Medium-term:** Add temporal resource support, resource state machine
3. **Long-term:** Full two-timeline architecture with explicit import/export

The MRTStateManager is clever, but it's fighting a losing battle. You can't patch your way to stability when external systems can mutate state the render graph depends on.
