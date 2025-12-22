- [x] **Refactor `MainObjectMRTPass` for Performance**
    - [x] Modify `src/rendering/graph/passes/MainObjectMRTPass.ts` to optimize scene traversal.
        - Add a check `!obj.layers.test(this.cameraLayers)` to skip irrelevant objects immediately.
        - Add a check `if (mat.transparent === false && mat.depthWrite === true && mat.blending === THREE.NoBlending) return;` to skip mutation if not needed.
        - Wrap the render call in `try { ... } finally { ... }` to ensure material state is restored even if rendering throws.

- [x] **Integrate `TemporalCloudManager` into Render Graph**
    - [x] Update `src/rendering/environment/PostProcessingV2.tsx` to define temporal cloud resources in the graph:
        - `cloudColor`, `cloudNormal`, `cloudPosition` (quarter res MRT).
        - `accumulation0`, `accumulation1` (full res MRT, ping-pong).
        - `reprojectionBuffer` (full res).
    - [x] Rewrite `src/rendering/graph/passes/TemporalCloudPass.ts`:
        - Remove dependency on `TemporalCloudManager`.
        - Accept resource IDs in constructor.
        - Implement the Bayer matrix logic and reprojection logic directly (port from `CloudTemporalPass.ts` and `TemporalCloudManager.ts`).
        - Use `ctx.getWriteTarget()` and `ctx.getReadTexture()` to manage resources via the graph.
    - [x] Delete `src/rendering/core/TemporalCloudManager.ts`.
    - [x] Delete `src/rendering/passes/CloudTemporalPass.ts` (legacy wrapper).
    - [x] Update `src/rendering/core/ResourceRecovery.ts` to remove the `TemporalCloudManager` registration.

- [x] **Refactor `TemporalDepthManager` into Render Graph**
    - [x] Update `src/rendering/environment/PostProcessingV2.tsx` to define temporal depth resources:
        - `prevDepthBuffer` (ping-pong).
    - [x] Update `src/rendering/graph/passes/TemporalDepthCapturePass.ts` to use graph resources instead of the singleton.
    - [x] Delete `src/rendering/core/TemporalDepthManager.ts` (Gutted to state holder, not deleted to preserve uniform access).

- [x] **Fix `useQualityTracking` Hook Violation**
    - [x] Modify `src/rendering/renderers/base/useQualityTracking.ts` to separate the `useShallow` selector creation from the `usePerformanceStore` call, ensuring React 19 compliance.

- [x] **Implement GPU Timing Instrumentation** (Optional/Optimization)
    - [x] Modify `src/rendering/graph/GPUTimer.ts` to implement WebGL2 `EXT_disjoint_timer_query_webgl2` support.
    - [x] Update `RenderGraph.ts` to record queries around pass execution.
