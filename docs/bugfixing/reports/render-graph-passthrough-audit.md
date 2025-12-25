# Render Graph Passthrough Audit Report

**Date**: 2025-12-25  
**Status**: Completed  
**Author**: AI Code Review  

## Executive Summary

This audit examines the passthrough mechanism in the render graph system and identifies critical issues that could cause visual artifacts or data loss when passes are disabled. The primary finding is that **multi-input passes have broken passthrough behavior** - only the first input is copied, losing data from other inputs.

## 1. Current Passthrough Mechanism

### 1.1 Location

The passthrough logic is implemented in [`src/rendering/graph/RenderGraph.ts`](../../../src/rendering/graph/RenderGraph.ts), lines 764-795.

### 1.2 Current Behavior

When a pass is disabled:
1. The system attempts to maintain the resource chain by copying input → output
2. **Only the FIRST input is copied to the FIRST output**
3. All other inputs are ignored

```typescript
// Current implementation (simplified)
if (!enabled) {
  const inputs = pass.config.inputs ?? []
  const outputs = pass.config.outputs ?? []

  if (inputs.length >= 1 && outputs.length >= 1) {
    const inputId = inputs[0]!.resourceId  // ONLY FIRST INPUT
    const outputId = outputs[0]!.resourceId

    // Skip if output already written by enabled pass
    if (writtenByEnabledPass.has(outputId)) {
      continue
    }

    const inputTexture = context.getReadTexture(inputId)
    const outputTarget = context.getWriteTarget(outputId)

    if (inputTexture && outputTarget) {
      this.executePassthrough(renderer, inputTexture, outputTarget)
    }
  }
}
```

### 1.3 Design Intent

The passthrough mechanism was designed to maintain linear effect chains where:
- Pass A writes to Resource X
- Pass B reads X, writes to Y
- Pass C reads Y, writes to Z

If Pass B is disabled, passthrough copies X → Y so Pass C still gets valid data.

This works well for **single-input passes** but fails for **multi-input compositing passes**.

## 2. Complete Pass Audit

### 2.1 Legend

- **Safe**: Passthrough works correctly (single input)
- **N/A**: Pass has no inputs, so passthrough doesn't apply
- **BROKEN**: Passthrough loses critical data
- **PARTIAL**: Passthrough works for color chain but loses auxiliary data (acceptable)

### 2.2 Pass Analysis Table

| Pass ID | Inputs | Outputs | Status | Notes |
|---------|--------|---------|--------|-------|
| `cubemapCapture` | 0 | cubemap | N/A | No inputs, no passthrough needed |
| `scene` | 0 | SCENE_COLOR | N/A | ScenePass renders scene, no inputs |
| `environmentScene` | 0 | ENVIRONMENT_COLOR | N/A | ScenePass renders environment, no inputs |
| `mainObjectScene` | 0 | MAIN_OBJECT_COLOR | N/A | ScenePass renders main object, no inputs |
| `gravityLensing` | 1 (ENVIRONMENT_COLOR) | LENSED_ENVIRONMENT | Safe | Single input |
| `gravityComposite` | 2 (LENSED_ENVIRONMENT, MAIN_OBJECT_COLOR) | SCENE_COLOR | **BROKEN** | Multi-input: would lose main object |
| `objectDepth` | 0 | OBJECT_DEPTH | N/A | DepthPass renders depth, no inputs |
| `temporalDepthCapture` | 1 (OBJECT_DEPTH) | TEMPORAL_DEPTH_OUTPUT | Safe | Single input |
| `temporalCloud` | 0 | Multiple MRTs | N/A | Complex temporal pass, no simple inputs |
| `normalEnv` | 0 | NORMAL_ENV | N/A | NormalPass renders normals, no inputs |
| `mainObjectMrt` | 0 | MAIN_OBJECT_MRT (3 attachments) | N/A | MRT pass, no inputs |
| `normalComposite` | 2 (NORMAL_ENV, MAIN_OBJECT_MRT[1]) | NORMAL_BUFFER | **BROKEN** | **CRITICAL**: Only NORMAL_ENV copied, main object normals lost |
| `cloudComposite` | 1 (SCENE_COLOR) | SCENE_COMPOSITE | Safe | Single input |
| `gtao` | 3 (SCENE_COMPOSITE, NORMAL_BUFFER, SCENE_COLOR depth) | GTAO_OUTPUT | PARTIAL | Color chain maintained |
| `bloom` | 1 (GTAO_OUTPUT) | BLOOM_OUTPUT | Safe | Single input |
| `bokeh` | 2 (BLOOM_OUTPUT, depth) | BOKEH_OUTPUT | PARTIAL | Color chain maintained |
| `ssr` | 3 (BOKEH_OUTPUT, NORMAL_BUFFER, depth) | SSR_OUTPUT | PARTIAL | Color chain maintained |
| `refraction` | 3 (SSR_OUTPUT, NORMAL_BUFFER, depth) | REFRACTION_OUTPUT | PARTIAL | Color chain maintained |
| `lensing` | 2 (REFRACTION_OUTPUT, depth) | LENSING_OUTPUT | PARTIAL | Color chain maintained |
| `cinematic` | 1 (LENSING_OUTPUT) | CINEMATIC_OUTPUT | Safe | Single input |
| `filmGrain` | 1 (CINEMATIC_OUTPUT) | GRAIN_OUTPUT | Safe | Single input |
| `fxaa` | 1 (GRAIN_OUTPUT) | AA_OUTPUT | Safe | Single input |
| `smaa` | 1 (GRAIN_OUTPUT) | AA_OUTPUT | Safe | Single input |
| `aaPassthrough` | 1 (GRAIN_OUTPUT) | AA_OUTPUT | Safe | Single input (copy pass) |
| `bufferPreview` | 1+ (configurable) | PREVIEW_OUTPUT | Safe | Primary input used for passthrough |
| `previewToScreen` | 1 (PREVIEW_OUTPUT) | Screen (null) | Safe | Single input |
| `finalToScreen` | 1 (AA_OUTPUT) | Screen (null) | Safe | Single input |
| `debugOverlay` | 0 | Screen (null) | N/A | No inputs |

## 3. Critical Issues

### 3.1 Issue #1: normalComposite Passthrough Data Loss

**Severity**: CRITICAL  
**Impact**: Would cause black/missing normals for main object  
**Currently Exposed**: No (pass is always enabled when needed)

**Description**: 
The `normalComposite` pass reads from two sources:
1. `NORMAL_ENV` - Environment layer normals
2. `MAIN_OBJECT_MRT[1]` - Main object normals (attachment 1)

If disabled, passthrough copies only `NORMAL_ENV` → `NORMAL_BUFFER`, completely losing main object normals. This would break:
- Screen Space Reflections (SSR)
- Refraction effects
- SSAO (GTAO)
- Normal buffer preview

**Mitigation**: 
- Current code keeps normalComposite enabled when any consumer needs it
- The `shouldRenderNormals` helper function gates both normalComposite AND its consumers

**Recommendation**:
- Do NOT add `enabled:` callback that could disable normalComposite independently
- If optimization needed, use resource aliasing instead of passthrough

### 3.2 Issue #2: gravityComposite Passthrough Data Loss

**Severity**: HIGH  
**Impact**: Would lose main object in gravity-enabled scene  
**Currently Exposed**: No (protected by mutual exclusion)

**Description**:
When gravity is enabled, `gravityComposite` combines:
1. `LENSED_ENVIRONMENT` - Gravitationally lensed background
2. `MAIN_OBJECT_COLOR` - Main object without lensing

If disabled with passthrough, only lensed environment would appear.

**Mitigation**:
- `scene` pass and `gravityComposite` are mutually exclusive
- When gravity disabled, `scene` writes directly to `SCENE_COLOR`
- When gravity enabled, `gravityComposite` writes to `SCENE_COLOR`
- The `writtenByEnabledPass` check prevents passthrough overwriting

**Recommendation**:
- Current mutual exclusion is correct
- No changes needed

### 3.3 Issue #3: Effect Chain Redundancy

**Severity**: LOW (performance only)  
**Impact**: Up to 8 unnecessary texture copies per frame  
**Currently Exposed**: Yes, in every frame with disabled effects

**Description**:
When all post-processing effects are disabled, the following passthrough chain executes:
```
SCENE_COMPOSITE → GTAO_OUTPUT → BLOOM_OUTPUT → BOKEH_OUTPUT → SSR_OUTPUT → REFRACTION_OUTPUT → LENSING_OUTPUT → CINEMATIC_OUTPUT → GRAIN_OUTPUT
```

Each copy involves:
- 1 draw call
- 2 triangles (fullscreen quad)
- 6 vertices
- Texture fetch + write

**Measured Impact** (from user report):
- 18 total draw calls (vs 2 for geometry)
- 56 total triangles (vs 24 for geometry rendered twice)
- 168 total vertices (vs 72 for geometry)

**Recommendation**:
- Implement resource aliasing to eliminate redundant copies
- When a pass is disabled, alias its output to its input
- Downstream passes read from the aliased source directly

## 4. Recommendations

### 4.1 Short-term (Safe)

1. **Add `enabled:` callback to `cloudComposite`**
   - Safe because it has single input
   - Passthrough correctly copies SCENE_COLOR → SCENE_COMPOSITE
   - Saves 1 draw call when temporal clouds not active

2. **Do NOT add `enabled:` to `normalComposite`**
   - Passthrough would break normals
   - Current behavior is correct

### 4.2 Medium-term (Resource Aliasing)

1. **Implement runtime resource aliasing**
   - When pass disabled, register alias: outputId → inputId
   - Downstream passes resolve alias chain to find actual texture
   - Eliminates all passthrough copies

2. **Add `skipPassthrough` flag for safety**
   - For multi-input passes where passthrough is wrong
   - Prevents accidental data loss

### 4.3 Long-term (Architecture)

1. **Consider lazy resource allocation**
   - Don't allocate intermediate buffers if pass chain is disabled
   - Reduces VRAM usage

2. **Consider pass fusion**
   - Combine consecutive fullscreen passes into single shader
   - Reduces draw calls and texture bandwidth

## 5. Testing Requirements

Any changes to passthrough logic require:

1. **Unit tests** for resource aliasing
2. **Visual regression tests** for:
   - SSR with various object types
   - SSAO with environment geometry
   - Buffer preview modes
   - All post-processing effects
3. **Performance tests** verifying draw call reduction

## Appendix: Resource Flow Diagram

```
                                   ┌──────────────────┐
                                   │  cubemapCapture  │
                                   └────────┬─────────┘
                                            │ (exports to scene.background)
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCENE RENDERING PHASE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Gravity OFF]                        [Gravity ON]                       │
│                                                                          │
│  ┌─────────┐                    ┌──────────────────┐                    │
│  │  scene  │──SCENE_COLOR       │ environmentScene │──ENVIRONMENT_COLOR │
│  └─────────┘                    └──────────────────┘         │          │
│                                          │                    ▼          │
│                                          │         ┌─────────────────┐  │
│                                          │         │ gravityLensing  │  │
│                                          │         └────────┬────────┘  │
│                                          │                  │           │
│                                 ┌────────────────┐   LENSED_ENVIRONMENT │
│                                 │ mainObjectScene│          │           │
│                                 └───────┬────────┘          │           │
│                                         │                   │           │
│                                  MAIN_OBJECT_COLOR          │           │
│                                         │                   │           │
│                                         ▼                   ▼           │
│                                 ┌───────────────────────────┐           │
│                                 │    gravityComposite       │           │
│                                 └───────────┬───────────────┘           │
│                                             │                           │
│                                       SCENE_COLOR                       │
└─────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         G-BUFFER GENERATION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐                    ┌───────────────┐                    │
│  │ objectDepth│──OBJECT_DEPTH      │ mainObjectMrt │──MAIN_OBJECT_MRT   │
│  └────────────┘                    └───────────────┘    (color+normal)  │
│                                                              │          │
│  ┌───────────┐                                               │          │
│  │ normalEnv │──NORMAL_ENV ─────────────────┐                │          │
│  └───────────┘                              │                │          │
│                                             ▼                ▼          │
│                                    ┌────────────────────────────┐       │
│                                    │     normalComposite        │       │
│                                    │  (NORMAL_ENV + MRT[1])     │       │
│                                    └────────────┬───────────────┘       │
│                                                 │                       │
│                                           NORMAL_BUFFER                 │
└─────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      VOLUMETRIC COMPOSITING                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SCENE_COLOR ───────────────┐                                           │
│                             ▼                                           │
│                    ┌────────────────┐                                   │
│                    │ cloudComposite │                                   │
│                    └───────┬────────┘                                   │
│                            │                                            │
│                      SCENE_COMPOSITE                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      POST-PROCESSING CHAIN                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SCENE_COMPOSITE ──┐                                                    │
│  NORMAL_BUFFER ────┼──▶ [gtao] ──GTAO_OUTPUT──▶ [bloom] ──BLOOM_OUTPUT  │
│  depth ────────────┘                                          │         │
│                                                               ▼         │
│                                  ┌──────────────────────────────┐       │
│  NORMAL_BUFFER ─────────────────▶│          [bokeh]             │       │
│  depth ─────────────────────────▶│                              │       │
│                                  └─────────────┬────────────────┘       │
│                                                │                        │
│                                          BOKEH_OUTPUT                   │
│                                                │                        │
│  NORMAL_BUFFER ─────────────────────┐          ▼                        │
│  depth ─────────────────────────────┼──▶ [ssr] ──SSR_OUTPUT             │
│                                     │          │                        │
│                                     │          ▼                        │
│                                     └──▶ [refraction] ──REFRACTION_OUT  │
│                                                │                        │
│                                                ▼                        │
│                                         [lensing] (disabled)            │
│                                                │                        │
│                                          LENSING_OUTPUT                 │
│                                                │                        │
│                                                ▼                        │
│                                         [cinematic]                     │
│                                                │                        │
│                                         CINEMATIC_OUTPUT                │
│                                                │                        │
│                                                ▼                        │
│                                          [filmGrain]                    │
│                                                │                        │
│                                          GRAIN_OUTPUT                   │
│                                                │                        │
│                                                ▼                        │
│                                     [fxaa/smaa/passthrough]             │
│                                                │                        │
│                                           AA_OUTPUT                     │
└─────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ finalToScreen │
                                     └──────────────┘
```

