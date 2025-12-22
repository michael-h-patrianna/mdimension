/**
 * Shared base module for raymarched renderers.
 *
 * This module provides common types, utilities, and hooks used across
 * MandelbulbMesh, SchroedingerMesh, QuaternionJuliaMesh, and other
 * N-dimensional renderers to eliminate code duplication.
 *
 * @module rendering/renderers/base
 *
 * @example
 * ```tsx
 * import {
 *   MAX_DIMENSION,
 *   useQualityTracking,
 *   useRotationUpdates,
 *   useLayerAssignment,
 *   useFramePriority,
 * } from '@/rendering/renderers/base';
 *
 * const MyRenderer = () => {
 *   const meshRef = useRef<THREE.Mesh>(null);
 *
 *   // Quality tracking with adaptive fast mode
 *   const { effectiveFastMode, qualityMultiplier, rotationsChanged } = useQualityTracking();
 *
 *   // Rotation and basis vector updates with caching
 *   const { getBasisVectors, getOrigin } = useRotationUpdates({
 *     dimension,
 *     parameterValues,
 *   });
 *
 *   // Layer assignment for depth-based effects
 *   useLayerAssignment(meshRef);
 *
 *   // Frame callback with enforced priority
 *   useFramePriority('RENDERER_UNIFORMS', (state, delta) => {
 *     const { basisX, basisY, basisZ, changed } = getBasisVectors(rotationsChanged);
 *     // Update uniforms...
 *   });
 *
 *   return <mesh ref={meshRef}>...</mesh>;
 * };
 * ```
 */

// Types and utilities
export {
  MAX_DIMENSION,
  QUALITY_RESTORE_DELAY_MS,
  applyRotationInPlace,
  createWorkingArrays,
  type QualityState,
  type RotationState,
  type WorkingArrays,
} from './types'

// Hooks
export {
  useQualityTracking,
  type UseQualityTrackingOptions,
  type UseQualityTrackingResult,
} from './useQualityTracking'

export {
  useRotationUpdates,
  type BasisVectorsResult,
  type OriginResult,
  type UseRotationUpdatesOptions,
  type UseRotationUpdatesResult,
} from './useRotationUpdates'

export {
  useLayerAssignment,
  useVolumetricLayerAssignment,
  type UseLayerAssignmentOptions,
} from './useLayerAssignment'

export {
  useNDTransformUpdates,
  type UseNDTransformUpdatesOptions,
  type UseNDTransformUpdatesResult,
} from './useNDTransformUpdates'

export {
  getFramePriorityOrder,
  getFramePriorityValue,
  isFramePriorityKey,
  useFramePriority,
  useFramePriorityValue,
  type FrameCallback,
  type FramePriorityKey,
  type UseFramePriorityOptions,
} from './useFramePriority'
