/**
 * TSL Post-Processing Nodes Index
 *
 * Exports all TSL-based post-processing effect nodes for WebGPU/WebGL compatibility.
 * These are ports of the WebGL post-processing shaders to Three.js Shading Language (TSL).
 *
 * @module rendering/tsl/postprocessing
 */

// =============================================================================
// Bilateral Upsampling
// =============================================================================

// Generic bilateral upsample - depth-aware upsampling for half-resolution effects
export {
  createBilateralUpsampleNode,
  createBilateralUpsampleNodeSimple,
} from './bilateralUpsampleTSL'

// GTAO-specific bilateral upsample - optimized for ambient occlusion
export {
  createGTAOBilateralUpsampleNode,
  createGTAOBilateralUpsampleNodeSimple,
} from './gtaoBilateralUpsampleTSL'

// =============================================================================
// Distortion Effects
// =============================================================================

// Screen-space refraction with optional chromatic aberration
export {
  createRefractionNode,
  createRefractionNodeSimple,
  createNormalDistortionNode,
} from './refractionTSL'

// Screen-space gravitational lensing with Einstein ring
export {
  createScreenSpaceLensingNode,
  createScreenSpaceLensingNodeSimple,
} from './screenSpaceLensingTSL'

// =============================================================================
// Compositing
// =============================================================================

// Cloud, environment, normal, and frame compositing
export {
  createCloudCompositeNode,
  createNormalCompositeNode,
  createEnvironmentCompositeNode,
  createFrameBlendingNode,
} from './compositeTSL'

// =============================================================================
// Depth Processing
// =============================================================================

// Depth capture for temporal reprojection
export {
  createDepthCaptureNode,
  createDepthCaptureNodeSimple,
} from './depthCaptureTSL'

// =============================================================================
// Buffer Preview (Debug Visualization)
// =============================================================================

// Buffer preview for performance monitor debug view
export {
  createBufferPreviewNode,
  createDepthPreviewNode,
  createNormalPreviewNode,
  createTemporalDepthPreviewNode,
  createFocusZonesPreviewNode,
  type BufferPreviewType,
} from './bufferPreviewTSL'

// =============================================================================
// Temporal Cloud Accumulation (Horizon-style)
// =============================================================================

// Re-export from schroedinger temporal module for post-processing access
export {
  // Types
  type ReprojectionUniforms,
  type ReconstructionUniforms,
  type TemporalAccumulationMainUniforms,
  // Reprojection pass
  createReprojectionNode,
  createReprojectionValidityNode,
  createReprojectionMaterial,
  // Reconstruction pass
  createReconstructionColorNode,
  createReconstructionPositionNode,
  createReconstructionMaterial,
} from '../raymarching/schroedinger/temporal'

