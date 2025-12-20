# Temporal Cloud Accumulation Plan

## Overview

Replace the current depth-based ray skip optimization with proper temporal accumulation (Horizon Zero Dawn style). Instead of trying to skip parts of each ray, render fewer pixels per frame and reconstruct the full image using temporal reprojection.

## Why This Approach

| Current Approach (Depth Skip) | New Approach (Temporal Accumulation) |
|------------------------------|--------------------------------------|
| Render all pixels, skip ray start | Render 1/4 pixels, full ray each |
| Problematic for soft volumes | Industry-proven for clouds |
| Artifacts from starting too late | No ray-start artifacts possible |
| Depth feedback loop issues | Clean frame-to-frame blending |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frame N                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Pass 1: Render   │    │ Previous Frame   │                   │
│  │ (1/4 resolution) │    │ Accumulation     │                   │
│  │                  │    │ Buffer           │                   │
│  │ - Bayer offset   │    │                  │                   │
│  │ - Full raymarch  │    │                  │                   │
│  │ - Weighted pos   │    │                  │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                    │
│  │ Pass 2: Reprojection                    │                    │
│  │                                         │                    │
│  │ - Reproject prev frame to current view  │                    │
│  │ - Detect disocclusion                   │                    │
│  │ - Generate validity mask                │                    │
│  └────────────────────┬────────────────────┘                    │
│                       │                                          │
│                       ▼                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │ Pass 3: Reconstruction                  │                    │
│  │                                         │                    │
│  │ - Upsample new quarter-res pixels       │                    │
│  │ - Blend with valid reprojected data     │                    │
│  │ - Spatial interpolation for invalid     │                    │
│  └────────────────────┬────────────────────┘                    │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────┐                   │
│  │ Output: Full Resolution Cloud Layer      │                   │
│  │ (Also stored as history for Frame N+1)   │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Bayer Pattern (4-Frame Cycle)

Each frame renders a different pixel in each 2×2 block:

```
Frame 0: ■ □    Frame 1: □ □    Frame 2: □ ■    Frame 3: □ □
         □ □             □ ■             □ □             ■ □

Offsets:
Frame 0: (0.0, 0.0)  - Top-left
Frame 1: (1.0, 1.0)  - Bottom-right
Frame 2: (1.0, 0.0)  - Top-right
Frame 3: (0.0, 1.0)  - Bottom-left
```

After 4 frames, every pixel has been rendered at least once.

## New Files

### 1. `src/rendering/core/TemporalCloudManager.ts`

```typescript
/**
 * Manages temporal accumulation for volumetric cloud rendering.
 *
 * Unlike TemporalDepthManager (which stores depth for ray-start optimization),
 * this stores accumulated COLOR and handles the Bayer pattern cycling.
 */
class TemporalCloudManager {
  // Ping-pong accumulation buffers (full resolution)
  private accumulationBuffers: [WebGLRenderTarget, WebGLRenderTarget];

  // Quarter-resolution render target for volumetric pass
  private cloudRenderTarget: WebGLRenderTarget;

  // Weighted position buffer for motion vectors
  private positionBuffer: WebGLRenderTarget;

  // Frame counter (0-3)
  private frameIndex: number = 0;

  // Bayer offsets for each frame
  private static BAYER_OFFSETS = [
    [0.0, 0.0],  // Frame 0
    [1.0, 1.0],  // Frame 1
    [1.0, 0.0],  // Frame 2
    [0.0, 1.0],  // Frame 3
  ];

  // Camera matrices for reprojection
  private prevViewProjectionMatrix: Matrix4;
  private prevInverseViewProjectionMatrix: Matrix4;

  initialize(width: number, height: number): void;
  getCloudRenderTarget(): WebGLRenderTarget;
  getBayerOffset(): [number, number];
  getAccumulationUniforms(): TemporalCloudUniforms;
  advanceFrame(): void;
  swap(): void;
}
```

### 2. `src/rendering/shaders/schroedinger/temporal/reprojection.glsl.ts`

```glsl
// Reproject previous frame's accumulated cloud color to current view

uniform sampler2D uPrevAccumulation;      // Previous frame's cloud color
uniform sampler2D uPrevPositionBuffer;    // Previous frame's world positions
uniform sampler2D uCurrentDepth;          // Current frame's depth (for occlusion)
uniform mat4 uPrevViewProjectionMatrix;
uniform mat4 uInvViewProjectionMatrix;

out vec4 fragColor;
out float fragValidity;  // 0 = invalid, 1 = valid

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    // Get current world position from depth
    float depth = texture(uCurrentDepth, uv).r;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 worldPos = uInvViewProjectionMatrix * clipPos;
    worldPos /= worldPos.w;

    // Reproject to previous frame
    vec4 prevClipPos = uPrevViewProjectionMatrix * worldPos;
    vec2 prevUV = (prevClipPos.xy / prevClipPos.w) * 0.5 + 0.5;

    // Check if on-screen in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        fragColor = vec4(0.0);
        fragValidity = 0.0;
        return;
    }

    // Sample previous frame
    vec4 prevColor = texture(uPrevAccumulation, prevUV);

    // Disocclusion detection via neighbor depth variance
    // ... (similar to existing temporal.glsl.ts)

    fragColor = prevColor;
    fragValidity = 1.0;
}
```

### 3. `src/rendering/shaders/schroedinger/temporal/reconstruction.glsl.ts`

```glsl
// Reconstruct full-resolution cloud image from:
// - New quarter-res render (this frame's Bayer pixel)
// - Reprojected history (other pixels)

uniform sampler2D uNewCloudRender;        // Quarter-res, this frame
uniform sampler2D uReprojectedHistory;    // Full-res, reprojected
uniform sampler2D uValidityMask;          // Full-res, validity
uniform vec2 uBayerOffset;                // Which pixel we rendered
uniform int uFrameIndex;                  // 0-3

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    ivec2 pixelCoord = ivec2(gl_FragCoord.xy);

    // Check if this pixel was rendered this frame
    ivec2 blockPos = pixelCoord % 2;
    bool renderedThisFrame = (blockPos == ivec2(uBayerOffset));

    if (renderedThisFrame) {
        // Use freshly rendered data
        vec2 quarterUV = floor(gl_FragCoord.xy / 2.0) / (uResolution / 2.0);
        fragColor = texture(uNewCloudRender, quarterUV);
    } else {
        // Use reprojected history or spatial interpolation
        float validity = texture(uValidityMask, uv).r;

        if (validity > 0.5) {
            // Valid reprojection - blend with slight bias toward new data
            vec4 reprojected = texture(uReprojectedHistory, uv);
            fragColor = reprojected;
        } else {
            // Invalid - use spatial interpolation from neighbors
            fragColor = bilinearFromNeighbors(uNewCloudRender, uv);
        }
    }
}
```

### 4. `src/rendering/passes/CloudTemporalPass.ts`

```typescript
/**
 * Post-processing pass that handles temporal cloud reconstruction.
 * Integrates with EffectComposer.
 */
class CloudTemporalPass extends Pass {
  private reprojectionMaterial: ShaderMaterial;
  private reconstructionMaterial: ShaderMaterial;
  private temporalManager: TemporalCloudManager;

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget
  ): void;
}
```

## Modifications to Existing Files

### 1. `SchroedingerMesh.tsx`

```typescript
// Add temporal uniforms
const uniforms = {
  // ... existing uniforms ...
  uTemporalEnabled: { value: true },
  uBayerOffset: { value: new Vector2(0, 0) },
  uFrameIndex: { value: 0 },
};

// In useFrame:
if (temporalCloudEnabled) {
  const offset = TemporalCloudManager.getBayerOffset();
  material.uniforms.uBayerOffset.value.set(offset[0], offset[1]);
  material.uniforms.uFrameIndex.value = TemporalCloudManager.getFrameIndex();
}
```

### 2. `main.glsl.ts` (Volumetric)

```glsl
// Modify ray generation to apply Bayer jitter
uniform vec2 uBayerOffset;

void main() {
    // Apply sub-pixel jitter for temporal accumulation
    vec2 jitteredCoord = gl_FragCoord.xy;

    #ifdef USE_TEMPORAL_ACCUMULATION
    // For quarter-res rendering, each pixel covers a 2x2 block
    // Offset determines which sub-pixel within the block we're sampling
    jitteredCoord = floor(gl_FragCoord.xy) * 2.0 + uBayerOffset + 0.5;
    #endif

    vec2 screenUV = jitteredCoord / uResolution;
    // ... rest of ray setup using screenUV ...
}

// Track weighted absorption position for motion vectors
// Output to separate render target
vec3 weightedPosition = vec3(0.0);
float totalWeight = 0.0;

// In raymarch loop:
if (alpha > 0.001) {
    vec3 worldPos = (uModelMatrix * vec4(pos, 1.0)).xyz;
    float weight = alpha * transmittance;
    weightedPosition += worldPos * weight;
    totalWeight += weight;
}

// After loop:
gWeightedPosition = totalWeight > 0.0 ? weightedPosition / totalWeight : vec3(0.0);
```

### 3. `PostProcessing.tsx`

```typescript
// Add temporal cloud reconstruction to the pipeline
// After volumetric render, before tone mapping

if (schroedingerEnabled && temporalCloudEnabled) {
  // Render volumetric to quarter-res target
  TemporalCloudManager.beginFrame(camera);
  renderSchroedinger(gl, TemporalCloudManager.getCloudRenderTarget());

  // Run reconstruction passes
  cloudTemporalPass.render(gl, writeBuffer, readBuffer);

  // Composite cloud layer with scene
  compositePass.render(gl, ...);

  TemporalCloudManager.endFrame();
}
```

## Implementation Phases

### Phase 1: Infrastructure (2-3 hours)
- [ ] Create `TemporalCloudManager.ts`
- [ ] Set up render targets (accumulation, quarter-res, position)
- [ ] Implement frame counter and Bayer offset logic
- [ ] Add enable/disable configuration

### Phase 2: Modified Volumetric Render (2-3 hours)
- [ ] Add Bayer jitter to ray generation in `main.glsl.ts`
- [ ] Modify `SchroedingerMesh.tsx` to render to offscreen target
- [ ] Add weighted position output (MRT or separate pass)
- [ ] Test quarter-res rendering works correctly

### Phase 3: Reprojection Pass (2-3 hours)
- [ ] Create `reprojection.glsl.ts` shader
- [ ] Implement camera-based UV reprojection
- [ ] Add disocclusion detection
- [ ] Output validity mask

### Phase 4: Reconstruction Pass (2-3 hours)
- [ ] Create `reconstruction.glsl.ts` shader
- [ ] Implement new-pixel vs reprojected blending
- [ ] Add spatial interpolation fallback
- [ ] Handle screen edges

### Phase 5: Integration & Polish (2-3 hours)
- [ ] Create `CloudTemporalPass.ts`
- [ ] Integrate into `PostProcessing.tsx` pipeline
- [ ] Handle resize events
- [ ] Add quality settings (4-frame vs 16-frame)
- [ ] Performance profiling

### Phase 6: Testing & Tuning (2-3 hours)
- [ ] Test static camera (should be sharp)
- [ ] Test slow camera motion (minimal ghosting)
- [ ] Test fast camera motion (graceful degradation)
- [ ] Test with different cloud configurations
- [ ] Tune blend weights and rejection thresholds

## Configuration Options

```typescript
interface TemporalCloudConfig {
  enabled: boolean;

  // Reconstruction quality
  cycleLength: 4 | 16;           // 4-frame (1/4 res) or 16-frame (1/16 res)

  // Reprojection tuning
  historyWeight: number;          // 0.0-1.0, default 0.9
  disocclusionThreshold: number;  // Depth difference for rejection

  // Fallback behavior
  fallbackToSpatial: boolean;     // Use neighbor interpolation when invalid
  maxInvalidFrames: number;       // Force full render after N invalid frames
}
```

## Performance Expectations

| Metric | Current | With Temporal |
|--------|---------|---------------|
| Volumetric samples/frame | 100% | 25% |
| Additional passes | 0 | 2 fullscreen |
| Memory | Base | +3 fullscreen RGBA16F |
| Net speedup | - | ~2-3× for dense clouds |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Ghosting on fast motion | Aggressive history rejection, reduce weight |
| Flickering | Ensure stable Bayer cycling, proper blending |
| First-frame artifacts | Render full res for first 4 frames |
| Edge bleeding | Clamp UVs, handle borders specially |

## Rollback Plan

Keep existing depth-skip code behind a feature flag. If temporal accumulation has issues, can fall back to conservative depth-skip (current implementation with 40% max skip).

```typescript
enum TemporalMode {
  DISABLED,           // No temporal optimization
  DEPTH_SKIP,         // Current conservative approach
  ACCUMULATION,       // New Horizon-style approach
}
```
