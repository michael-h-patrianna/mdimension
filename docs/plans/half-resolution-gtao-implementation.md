# Half-Resolution GTAO Implementation Plan

**Status**: Planning  
**Author**: AI Agent  
**Created**: 2025-12-25  
**Estimated Performance Improvement**: 50-75% for GTAO pass  
**Risk of Visual Quality Loss**: Medium  
**Visual Impact**: Softer ambient occlusion, more noticeable in high-contrast areas with fine geometry

---

## Overview

This document outlines the full implementation plan for rendering Ground Truth Ambient Occlusion (GTAO) at half resolution with bilateral upsampling. This optimization follows the same pattern established by SSRPass and reuses the existing `BilateralUpsampleShader`.

---

## Architecture Analysis

### Current Implementation

**File**: `src/rendering/graph/passes/GTAOPass.ts`

The current GTAOPass:
1. Wraps Three.js's `GTAOPass` from `three/examples/jsm/postprocessing/GTAOPass.js`
2. Uses external G-buffer textures (normal + depth) from the render graph
3. Renders at full resolution via `ThreeGTAOPass.render()`
4. Copies results to output target

```typescript
// Current flow:
// 1. Copy color to readTarget (full-res)
// 2. Run GTAOPass.render() at full resolution
// 3. Copy result to output
```

### Reference Implementation: SSRPass

**File**: `src/rendering/graph/passes/SSRPass.ts`

SSRPass already implements half-resolution rendering:
- Creates a half-resolution render target
- Renders SSR at half-res
- Upsamples using `BilateralUpsampleShader`
- Provides runtime toggle via `setHalfResolution()`

---

## Implementation Strategy

### Approach: Wrapper with Half-Res Intermediates

Since Three.js GTAOPass doesn't natively support half-resolution, we will:
1. Create half-resolution render targets for GTAOPass input/output
2. Downsample the input color to half-resolution
3. Initialize GTAOPass at half resolution
4. Run GTAOPass at half resolution
5. Apply GTAO-specific bilateral upsampling to full resolution

### Key Difference from SSR

GTAO output is **ambient occlusion only** (grayscale intensity), not a reflection color. The bilateral upsample for GTAO should:
- Sample the half-res AO value
- Apply depth-aware upsampling
- Composite AO with the full-res scene color

---

## File Changes

### 1. New Shader: `GTAOBilateralUpsampleShader.ts`

**Location**: `src/rendering/shaders/postprocessing/GTAOBilateralUpsampleShader.ts`

A specialized bilateral upsample shader for GTAO that:
- Takes half-res AO texture
- Takes full-res color and depth
- Applies depth-aware upsampling
- Blends AO with scene color (multiplicative darkening)

```glsl
// Key difference from SSR:
// SSR: fragColor = sceneColor + result.rgb * result.a (additive reflection)
// GTAO: fragColor = sceneColor * mix(1.0, aoValue, aoIntensity) (multiplicative darkening)
```

### 2. Update: `GTAOPass.ts`

**Location**: `src/rendering/graph/passes/GTAOPass.ts`

Modifications:
1. Add `halfResolution` config option (default: true)
2. Add `bilateralDepthThreshold` config option
3. Create half-res render targets
4. Create upsample material and scene
5. Add `executeFullRes()` and `executeHalfRes()` methods
6. Add `ensureHalfResTarget()` for dynamic sizing
7. Add runtime setters: `setHalfResolution()`, `setBilateralDepthThreshold()`
8. Update `dispose()` to clean up half-res resources

### 3. Update: `GTAOPassConfig` Interface

Add new configuration options:
```typescript
interface GTAOPassConfig {
  // ... existing options ...
  
  /** Enable half-resolution rendering with bilateral upsampling. @default true */
  halfResolution?: boolean;
  
  /** Depth threshold for bilateral upsampling. @default 0.02 */
  bilateralDepthThreshold?: number;
}
```

### 4. Update: PostProcessingV2.tsx

**Location**: `src/rendering/environment/PostProcessingV2.tsx`

- Pass `halfResolution` and `bilateralDepthThreshold` to GTAOPass construction
- Optionally expose settings through postProcessing store

### 5. Optional: Store Updates

**Location**: `src/stores/slices/postProcessingSlice.ts`

Add settings for user control (optional, can be internal-only initially):
- `ssaoHalfResolution: boolean`
- `ssaoDepthThreshold: number`

### 6. New Tests: `GTAOPass.test.ts` Updates

**Location**: `src/tests/rendering/graph/passes/GTAOPass.test.ts`

Add tests for:
- Half-resolution toggle
- Bilateral depth threshold setter
- Resource disposal with half-res enabled
- Fallback to full-res behavior

---

## Detailed Implementation

### Phase 1: Create GTAO Bilateral Upsample Shader

```typescript
// src/rendering/shaders/postprocessing/GTAOBilateralUpsampleShader.ts

export const GTAOBilateralUpsampleShader = {
  uniforms: {
    tAO: { value: null },           // Half-res AO texture
    tColor: { value: null },         // Full-res scene color
    tDepth: { value: null },         // Full-res depth
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDepthThreshold: { value: 0.02 },
    uNearClip: { value: 0.1 },
    uFarClip: { value: 1000 },
    uAOIntensity: { value: 1.0 },    // GTAO-specific: blend intensity
  },
  
  vertexShader: /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  
  fragmentShader: /* glsl */ `
    precision highp float;
    
    uniform sampler2D tAO;
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uDepthThreshold;
    uniform float uNearClip;
    uniform float uFarClip;
    uniform float uAOIntensity;
    
    in vec2 vUv;
    layout(location = 0) out vec4 fragColor;
    
    float linearizeDepth(float rawDepth) {
      return (2.0 * uNearClip * uFarClip) / 
             (uFarClip + uNearClip - rawDepth * (uFarClip - uNearClip));
    }
    
    void main() {
      vec2 texelSize = 1.0 / uResolution;
      vec2 halfOffset = texelSize * 0.5;
      
      float centerDepth = linearizeDepth(texture(tDepth, vUv).r);
      
      // Sample 4 nearest half-res pixels
      vec2 offsets[4];
      offsets[0] = vec2(-halfOffset.x, -halfOffset.y);
      offsets[1] = vec2( halfOffset.x, -halfOffset.y);
      offsets[2] = vec2(-halfOffset.x,  halfOffset.y);
      offsets[3] = vec2( halfOffset.x,  halfOffset.y);
      
      float aoSum = 0.0;
      float totalWeight = 0.0;
      
      for (int i = 0; i < 4; i++) {
        vec2 sampleUv = vUv + offsets[i];
        float aoSample = texture(tAO, sampleUv).r;
        float sampleDepth = linearizeDepth(texture(tDepth, sampleUv).r);
        
        // Bilateral weight
        float depthDiff = abs(sampleDepth - centerDepth);
        float depthWeight = exp(-depthDiff / (uDepthThreshold * centerDepth));
        
        // Distance weight
        vec2 distToSample = abs(offsets[i]) / halfOffset;
        float distWeight = (1.0 - distToSample.x) * (1.0 - distToSample.y);
        
        float weight = depthWeight * distWeight;
        aoSum += aoSample * weight;
        totalWeight += weight;
      }
      
      // Normalize AO
      float ao = totalWeight > 0.001 ? aoSum / totalWeight : 1.0;
      
      // Apply AO to scene color (multiplicative)
      vec4 sceneColor = texture(tColor, vUv);
      float aoFactor = mix(1.0, ao, uAOIntensity);
      fragColor = vec4(sceneColor.rgb * aoFactor, sceneColor.a);
    }
  `,
};
```

### Phase 2: Update GTAOPass Class

Key modifications to `GTAOPass.ts`:

1. **New Properties**:
```typescript
// Half-resolution pipeline
private useHalfRes: boolean;
private halfResReadTarget: THREE.WebGLRenderTarget | null = null;
private halfResWriteTarget: THREE.WebGLRenderTarget | null = null;
private upsampleMaterial: THREE.ShaderMaterial | null = null;
private upsampleMesh: THREE.Mesh | null = null;
private upsampleScene: THREE.Scene | null = null;
private bilateralDepthThreshold: number;
```

2. **Constructor Updates**:
```typescript
this.useHalfRes = config.halfResolution ?? true;
this.bilateralDepthThreshold = config.bilateralDepthThreshold ?? 0.02;

if (this.useHalfRes) {
  this.initHalfResPipeline();
}
```

3. **New Methods**:
- `initHalfResPipeline()`: Create upsample material/mesh/scene
- `ensureHalfResTarget(width, height)`: Create/resize half-res targets
- `executeFullRes(ctx)`: Original rendering path
- `executeHalfRes(ctx)`: New half-res rendering path
- `setHalfResolution(enabled)`: Runtime toggle
- `setBilateralDepthThreshold(threshold)`: Runtime parameter

4. **Execute Method Changes**:
```typescript
execute(ctx: RenderContext): void {
  // ... validation ...
  
  if (this.useHalfRes && this.upsampleMaterial && this.upsampleScene) {
    this.executeHalfRes(ctx);
  } else {
    this.executeFullRes(ctx);
  }
}
```

5. **Half-Res Execution Flow**:
```typescript
private executeHalfRes(ctx: RenderContext): void {
  const { renderer, size, scene, camera } = ctx;
  
  // 1. Ensure half-res targets exist
  this.ensureHalfResTarget(size.width, size.height);
  
  // 2. Get half-res dimensions
  const halfWidth = Math.floor(size.width / 2);
  const halfHeight = Math.floor(size.height / 2);
  
  // 3. Ensure GTAOPass is initialized at half resolution
  this.ensureInitialized(halfWidth, halfHeight, scene, camera);
  
  // 4. Copy input color to half-res read buffer (downsampled)
  this.copyMaterial.uniforms['tDiffuse'].value = colorTex;
  renderer.setRenderTarget(this.halfResReadTarget);
  renderer.render(this.copyScene, this.copyCamera);
  
  // 5. Run GTAOPass at half resolution
  this.gtaoPass.render(
    renderer,
    this.halfResWriteTarget,
    this.halfResReadTarget,
    0,
    false
  );
  
  // 6. Bilateral upsample to full resolution
  const upsampleUniforms = this.upsampleMaterial.uniforms;
  upsampleUniforms.tAO.value = this.halfResWriteTarget.texture;
  upsampleUniforms.tColor.value = colorTex;
  upsampleUniforms.tDepth.value = depthTex;
  upsampleUniforms.uResolution.value.set(size.width, size.height);
  upsampleUniforms.uNearClip.value = camera.near;
  upsampleUniforms.uFarClip.value = camera.far;
  
  renderer.setRenderTarget(outputTarget);
  renderer.render(this.upsampleScene, this.copyCamera);
  renderer.setRenderTarget(null);
}
```

### Phase 3: Integration Testing

1. **Unit Tests**: Extend `GTAOPass.test.ts`
2. **Playwright Tests**: Visual regression for AO quality
3. **Performance Benchmarks**: Measure frame time reduction

---

## Risk Mitigation

### Visual Quality Concerns

**Problem**: Half-res AO can appear softer and may miss fine details.

**Mitigations**:
1. **Tunable depth threshold**: Lower values = sharper edges but may show artifacts
2. **Runtime toggle**: Users can switch to full-res if quality is priority
3. **Intensity compensation**: Slightly increase AO intensity at half-res to maintain visual impact

### Edge Cases

1. **Odd resolutions**: Use `Math.floor(size / 2)` and handle minimum size of 1
2. **Camera changes**: GTAOPass gets camera near/far for linearization
3. **Scene changes**: GTAOPass is re-initialized when scene/camera refs change

### Performance Validation

Measure:
- GPU time for GTAO pass (before/after)
- Memory usage (additional half-res targets)
- Visual quality comparison screenshots

---

## Implementation Checklist

### Phase 1: Shader Creation
- [ ] Create `GTAOBilateralUpsampleShader.ts`
- [ ] Add uniform types export
- [ ] Test shader compilation

### Phase 2: GTAOPass Updates
- [ ] Add config interface options
- [ ] Add private properties for half-res pipeline
- [ ] Implement `initHalfResPipeline()`
- [ ] Implement `ensureHalfResTarget()`
- [ ] Implement `executeFullRes()` (extract from current `execute()`)
- [ ] Implement `executeHalfRes()`
- [ ] Add runtime setters
- [ ] Update `dispose()` for cleanup
- [ ] Update JSDoc documentation

### Phase 3: Integration
- [ ] Update PostProcessingV2.tsx to pass new config
- [ ] (Optional) Add store settings for user control
- [ ] Update index.ts exports

### Phase 4: Testing
- [ ] Update GTAOPass.test.ts with new test cases
- [ ] Create Playwright visual regression test
- [ ] Performance benchmark comparison

### Phase 5: Documentation
- [ ] Update rendering-pipeline.md
- [ ] Add inline code comments
- [ ] Document tuning parameters

---

## Performance Expectations

| Metric | Full Resolution | Half Resolution | Improvement |
|--------|-----------------|-----------------|-------------|
| Pixel count | 1920×1080 = 2.07M | 960×540 = 0.52M | **4x fewer pixels** |
| GTAO pass time | ~4ms (estimated) | ~1.5ms (estimated) | **~60% reduction** |
| Upsample overhead | 0ms | ~0.3ms | +0.3ms |
| **Net improvement** | - | - | **~50-60%** |

---

## Future Considerations

1. **Adaptive resolution**: Could implement quarter-resolution for mobile/low-end
2. **Temporal stability**: Consider temporal reprojection to reduce flickering
3. **Quality presets**: Add "High/Medium/Low" AO quality settings
4. **Normal-aware upsampling**: Include normal buffer in bilateral filter for better edge detection

---

## References

- SSRPass implementation: `src/rendering/graph/passes/SSRPass.ts`
- BilateralUpsampleShader: `src/rendering/shaders/postprocessing/BilateralUpsampleShader.ts`
- Three.js GTAOPass: `three/examples/jsm/postprocessing/GTAOPass.js`
- AMD FidelityFX CACAO: [GPUOpen reference](https://gpuopen.com/manuals/fidelityfx_sdk/fidelityfx_sdk-page_techniques_combined-adaptive-compute-ambient-occlusion/)

