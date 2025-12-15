# Temporal Reprojection Implementation Plan

## Overview

Temporal reprojection is a raymarching acceleration technique that uses the previous frame's depth information to skip empty space traversal. This document outlines the implementation plan to complete the partially-implemented temporal reprojection system.

## Current State

### What Exists
- `useTemporalDepth` hook with ping-pong buffer management (`src/hooks/useTemporalDepth.ts`)
- `createTemporalDepthUniforms()` and `updateTemporalDepthUniforms()` helper functions
- Shader code for `getTemporalDepth()` in fractal fragment shaders
- Temporal uniforms created in mesh components

### What's Broken
1. `useTemporalDepth()` hook is never instantiated by any component
2. `updateTemporalDepthUniforms()` is never called - uniforms stay at defaults
3. No depth capture pass - nothing writes to the temporal buffers
4. `uTemporalEnabled` always `false` - shader early-exits
5. Reprojection math samples at same UV (incorrect for camera movement)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frame N                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Read previous depth from temporal buffer (frame N-1)         │
│                         ↓                                        │
│  2. Raymarch with temporal hint (skip empty space)               │
│                         ↓                                        │
│  3. Output: gColor, gNormal.xyz, gNormal.w = depth               │
│                         ↓                                        │
│  4. Depth capture pass: copy gNormal.w → temporal buffer         │
│                         ↓                                        │
│  5. Swap ping-pong buffers                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

---

### Phase 1: Shader Depth Output

**Goal**: Output raymarched depth to G-buffer for capture

**Files**:
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`
- `src/components/canvas/renderers/Mandelbox/mandelbox.frag`
- `src/components/canvas/renderers/Menger/menger.frag`

**Changes**:
```glsl
// In main() after raymarching completes, before final output:
// Store raymarched distance in gNormal.w for temporal reprojection
float normalizedDepth = d / maxDist;  // Normalize to [0,1] range
gNormal = vec4(normal, normalizedDepth);
```

**Tasks**:
- [ ] Add depth output to hyperbulb.frag main()
- [ ] Add depth output to mandelbox.frag main()
- [ ] Add depth output to menger.frag main()
- [ ] Ensure depth is normalized consistently across all shaders

---

### Phase 2: Depth Capture Pass

**Goal**: Create a post-process pass that copies depth from G-buffer to temporal buffer

**New Files**:
- `src/shaders/depthCapture.vert` - Fullscreen quad vertex shader
- `src/shaders/depthCapture.frag` - Simple texture sample shader
- `src/components/canvas/effects/DepthCapturePass.tsx` - React component

**depthCapture.frag**:
```glsl
#version 300 es
precision highp float;

uniform sampler2D uNormalTexture;  // G-buffer normal+depth
in vec2 vUv;
out float fragDepth;

void main() {
    fragDepth = texture(uNormalTexture, vUv).w;
}
```

**DepthCapturePass.tsx**:
```typescript
interface DepthCapturePassProps {
  normalTexture: THREE.Texture;
  temporalTarget: THREE.WebGLRenderTarget | null;
  enabled: boolean;
}

export function DepthCapturePass({
  normalTexture,
  temporalTarget,
  enabled
}: DepthCapturePassProps) {
  // Render fullscreen quad to temporalTarget
  // Sample normalTexture.w, output to temporalTarget
}
```

**Tasks**:
- [ ] Create depthCapture.vert (fullscreen quad)
- [ ] Create depthCapture.frag (sample and output)
- [ ] Create DepthCapturePass.tsx component
- [ ] Integrate into post-processing pipeline
- [ ] Add unit tests for depth capture

---

### Phase 3: Hook Integration

**Goal**: Wire up the temporal depth hook to mesh components

**Files**:
- `src/components/canvas/renderers/Hyperbulb/HyperbulbMesh.tsx`
- `src/components/canvas/renderers/Mandelbox/MandelboxMesh.tsx`
- `src/components/canvas/renderers/Menger/MengerMesh.tsx`

**Changes**:
```typescript
// In each mesh component:
import { useTemporalDepth, updateTemporalDepthUniforms } from '@/hooks';

export function HyperbulbMesh(props: HyperbulbMeshProps) {
  const temporalDepth = useTemporalDepth({ enabled: true });

  // ... existing code ...

  useFrame((state) => {
    // Update temporal uniforms BEFORE render
    if (material.uniforms.uTemporalEnabled) {
      updateTemporalDepthUniforms(
        material.uniforms as TemporalDepthUniforms,
        temporalDepth,
        { width: size.width * 0.5, height: size.height * 0.5 }
      );
    }

    // ... existing uniform updates ...
  });

  // Expose temporalDepth for depth capture pass
  return (
    <>
      <mesh ref={meshRef} ... />
      <DepthCapturePass
        normalTexture={gBufferNormalTexture}
        temporalTarget={temporalDepth.getCurrentTarget()}
        enabled={temporalDepth.isValid}
        onCapture={temporalDepth.swap}
      />
    </>
  );
}
```

**Tasks**:
- [ ] Add useTemporalDepth() call to HyperbulbMesh
- [ ] Add useTemporalDepth() call to MandelboxMesh
- [ ] Add useTemporalDepth() call to MengerMesh
- [ ] Update useFrame to call updateTemporalDepthUniforms()
- [ ] Integrate DepthCapturePass into render flow
- [ ] Call swap() after depth capture

---

### Phase 4: Reprojection Math Fix

**Goal**: Correct the temporal depth lookup for camera movement

**Files**:
- `src/components/canvas/renderers/Hyperbulb/hyperbulb.frag`
- `src/components/canvas/renderers/Mandelbox/mandelbox.frag`
- `src/components/canvas/renderers/Menger/menger.frag`

**Current (broken)**:
```glsl
float getTemporalDepth(vec3 ro, vec3 rd, mat4 currentViewProj) {
    if (!uTemporalEnabled) return -1.0;
    // Samples at same UV - wrong for moving camera
    vec2 uv = gl_FragCoord.xy / uResolution;
    float temporalDepth = texture(uPrevDepthTexture, uv).r;
    return temporalDepth * maxDist;
}
```

**Fixed**:
```glsl
float getTemporalDepth(vec3 ro, vec3 rd, mat4 currentViewProj) {
    if (!uTemporalEnabled) return -1.0;

    // Estimate where ray would hit based on average expected depth
    // Use a reasonable estimate (e.g., bounding sphere intersection or fixed distance)
    float estimatedDepth = 2.0;  // Or use bounding sphere
    vec3 estimatedHitPoint = ro + rd * estimatedDepth;

    // Transform hit point to previous frame's clip space
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(estimatedHitPoint, 1.0);
    vec2 prevNDC = prevClipPos.xy / prevClipPos.w;
    vec2 prevUV = prevNDC * 0.5 + 0.5;

    // Check bounds
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        return -1.0;  // Off-screen in previous frame
    }

    // Sample previous depth
    float prevDepth = texture(uPrevDepthTexture, prevUV).r;

    // Convert from normalized to world distance
    return prevDepth * maxDist;
}
```

**Tasks**:
- [ ] Implement correct reprojection in hyperbulb.frag
- [ ] Implement correct reprojection in mandelbox.frag
- [ ] Implement correct reprojection in menger.frag
- [ ] Add uPrevViewProjectionMatrix uniform to shaders
- [ ] Add unit tests for reprojection math

---

### Phase 5: Disocclusion Handling

**Goal**: Detect and handle newly visible areas where temporal data is invalid

**Files**:
- Fractal fragment shaders (same as Phase 4)

**Changes**:
```glsl
float getTemporalDepth(vec3 ro, vec3 rd, mat4 currentViewProj) {
    // ... existing reprojection code ...

    float prevDepth = texture(uPrevDepthTexture, prevUV).r;

    // Disocclusion detection: check depth discontinuity
    vec2 texelSize = 1.0 / uDepthBufferResolution;
    float depthLeft = texture(uPrevDepthTexture, prevUV - vec2(texelSize.x, 0.0)).r;
    float depthRight = texture(uPrevDepthTexture, prevUV + vec2(texelSize.x, 0.0)).r;
    float depthUp = texture(uPrevDepthTexture, prevUV + vec2(0.0, texelSize.y)).r;
    float depthDown = texture(uPrevDepthTexture, prevUV - vec2(0.0, texelSize.y)).r;

    float maxNeighborDiff = max(
        max(abs(prevDepth - depthLeft), abs(prevDepth - depthRight)),
        max(abs(prevDepth - depthUp), abs(prevDepth - depthDown))
    );

    // If there's a large depth discontinuity, temporal data is unreliable
    if (maxNeighborDiff > 0.1) {  // Threshold tunable
        return -1.0;
    }

    return prevDepth * maxDist;
}
```

**Tasks**:
- [ ] Implement disocclusion detection in all shaders
- [ ] Add depth discontinuity threshold uniform for tuning
- [ ] Test with rapid camera movements

---

### Phase 6: Performance Toggle & Debug Visualization

**Goal**: Add controls and debugging aids

**Files**:
- `src/stores/performanceStore.ts` (already has `temporalReprojectionEnabled`)
- `src/components/ui/PerformancePanel.tsx` or similar
- New: `src/components/canvas/debug/TemporalDepthVisualizer.tsx`

**Debug Visualizer**:
```typescript
// Shows temporal depth buffer as grayscale overlay
export function TemporalDepthVisualizer({
  depthTexture,
  enabled
}: Props) {
  if (!enabled) return null;
  // Render fullscreen quad with depth texture
}
```

**Tasks**:
- [ ] Add UI toggle for temporal reprojection (if not exists)
- [ ] Create TemporalDepthVisualizer component
- [ ] Add keyboard shortcut for debug view (e.g., 'T' key)
- [ ] Add performance metrics display (steps saved, etc.)

---

### Phase 7: Testing & Validation

**Goal**: Ensure correctness and measure performance impact

**Test Files**:
- `src/tests/hooks/useTemporalDepth.test.ts`
- `src/tests/shaders/temporalReprojection.test.ts`
- `scripts/playwright/test-temporal-reprojection.mjs`

**Unit Tests**:
- Reprojection math correctness
- Ping-pong buffer swap logic
- Disocclusion detection thresholds
- Uniform update functions

**Integration Tests**:
- Temporal buffer captures correct depth
- Shader receives valid uniforms
- Performance toggle works

**Performance Benchmarks**:
- Measure average raymarch steps with/without temporal
- Measure frame time delta
- Test with various camera speeds

**Tasks**:
- [ ] Write unit tests for useTemporalDepth hook
- [ ] Write unit tests for reprojection math
- [ ] Create Playwright visual regression tests
- [ ] Create performance benchmark script
- [ ] Document expected speedup ranges

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `src/components/canvas/renderers/*/[name].frag` | Modify | 1, 4, 5 |
| `src/shaders/depthCapture.vert` | Create | 2 |
| `src/shaders/depthCapture.frag` | Create | 2 |
| `src/components/canvas/effects/DepthCapturePass.tsx` | Create | 2 |
| `src/components/canvas/renderers/*/[name]Mesh.tsx` | Modify | 3 |
| `src/hooks/useTemporalDepth.ts` | Minor updates | 3 |
| `src/components/canvas/debug/TemporalDepthVisualizer.tsx` | Create | 6 |
| `src/tests/hooks/useTemporalDepth.test.ts` | Create | 7 |
| `scripts/playwright/test-temporal-reprojection.mjs` | Create | 7 |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance regression | Feature toggle, benchmark before merge |
| Visual artifacts | Safety margin (0.95x), disocclusion detection |
| Memory overhead | Buffers already allocated, just unused |
| Shader complexity | Keep fallback path simple and fast |

## Success Criteria

1. **Functional**: Temporal reprojection reduces average raymarch steps by 10-30%
2. **Visual**: No visible artifacts during normal camera movement
3. **Performance**: Net frame time improvement (benefit > overhead)
4. **Robustness**: Graceful fallback for rapid movement/teleportation
5. **Testable**: All new code has unit test coverage

## Estimated Effort

- Phase 1: 1-2 hours (shader changes)
- Phase 2: 3-4 hours (new component)
- Phase 3: 2-3 hours (integration)
- Phase 4: 2-3 hours (math fix)
- Phase 5: 1-2 hours (disocclusion)
- Phase 6: 2-3 hours (debug tools)
- Phase 7: 3-4 hours (testing)

**Total: ~15-20 hours**
