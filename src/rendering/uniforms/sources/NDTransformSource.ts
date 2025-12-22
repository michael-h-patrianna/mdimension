/**
 * N-Dimensional Transform Uniform Source
 *
 * Manages N-D rotation matrix computation and GPU uniform application
 * for vertex-based renderers (Polytope, TubeWireframe). Follows the render
 * graph pattern of lazy evaluation + version-tracked application.
 *
 * Analogous to:
 * - Unreal: FPrimitiveSceneProxy transform management
 * - Unity: MaterialPropertyBlock with transform override
 * - Frostbite: Frame-scoped transform buffer
 *
 * Key features:
 * - Lazy evaluation: Only recomputes when rotation/dimension changes
 * - Pre-allocated GPU data: Avoids per-frame allocation
 * - Version tracking: Efficient change detection for renderers
 *
 * @module rendering/uniforms/sources/NDTransformSource
 */

import { Matrix4 } from 'three'

import { composeRotations } from '@/lib/math/rotation'
import {
  EXTRA_DIMS_SIZE,
  matrixToGPUUniforms,
  MAX_GPU_DIMENSION,
  type NDTransformGPUData,
} from '@/rendering/shaders/transforms/ndTransform'
import { BaseUniformSource, type IUniform, type UniformUpdateState } from '../UniformSource'

/**
 * Configuration for NDTransformSource updates.
 */
export interface NDTransformConfig {
  /** Current dimension (3-11) */
  dimension: number

  /** Rotation angles from store (plane key → angle in radians) */
  rotations: Map<string, number>

  /** Store version for change detection */
  rotationVersion: number

  /** Per-axis scale factors (optional, defaults to uniform 1.0) */
  scales?: number[]

  /** Uniform scale multiplier (optional, defaults to 1.0) */
  uniformScale?: number

  /** Projection distance for N-D → 3D (optional, defaults to 10.0) */
  projectionDistance?: number
}

/**
 * Uniform definitions for N-D transform shader material.
 */
interface NDTransformUniforms {
  uRotationMatrix4D: IUniform<Matrix4>
  uExtraRotationCols: IUniform<Float32Array>
  uDepthRowSums: IUniform<Float32Array>
  uDimension: IUniform<number>
  uScale4D: IUniform<number[]>
  uExtraScales: IUniform<Float32Array>
  uProjectionDistance: IUniform<number>
}

/**
 * Default projection distance for N-D → 3D projection.
 */
const DEFAULT_PROJECTION_DISTANCE = 10.0

/**
 * N-Dimensional Transform Uniform Source.
 *
 * Manages N-D rotation matrix computation and GPU uniform application
 * for vertex-based renderers. Implements lazy evaluation with version
 * tracking for efficient change detection.
 *
 * @example
 * ```typescript
 * const ndTransformSource = new NDTransformSource();
 *
 * // In useFrame:
 * ndTransformSource.updateFromStore({
 *   dimension,
 *   rotations: rotationStore.rotations,
 *   rotationVersion: rotationStore.version,
 *   scales: perAxisScale,
 *   projectionDistance,
 * });
 *
 * if (uniformManager.hasChanges(material, ['ndTransform'])) {
 *   uniformManager.applyToMaterial(material, ['ndTransform']);
 * }
 * ```
 */
export class NDTransformSource extends BaseUniformSource {
  readonly id = 'ndTransform'

  // Pre-allocated GPU data (avoids per-frame allocation)
  private gpuData: NDTransformGPUData

  // Uniforms struct for material application
  private uniforms: NDTransformUniforms

  // Change detection cache
  private cachedDimension = 0
  private cachedRotationVersion = -1
  private cachedScales: number[] = []
  private cachedUniformScale = 1.0
  private cachedProjectionDistance = DEFAULT_PROJECTION_DISTANCE

  constructor() {
    super()

    // Pre-allocate GPU data structure
    this.gpuData = {
      rotationMatrix4D: new Matrix4(),
      extraRotationData: new Float32Array(
        Math.max((MAX_GPU_DIMENSION - 4) * MAX_GPU_DIMENSION * 2, 1)
      ),
      extraRotationCols: new Float32Array(EXTRA_DIMS_SIZE * 4),
      depthRowSums: new Float32Array(MAX_GPU_DIMENSION),
      dimension: 4,
    }

    // Initialize uniforms
    this.uniforms = {
      uRotationMatrix4D: { value: new Matrix4() },
      uExtraRotationCols: { value: new Float32Array(EXTRA_DIMS_SIZE * 4) },
      uDepthRowSums: { value: new Float32Array(MAX_GPU_DIMENSION) },
      uDimension: { value: 4 },
      uScale4D: { value: [1, 1, 1, 1] },
      uExtraScales: { value: new Float32Array(EXTRA_DIMS_SIZE).fill(1) },
      uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
    }
  }

  /**
   * Update from store state (lazy evaluation).
   * Only recomputes rotation matrix when version changes.
   *
   * @param config - Configuration with current state
   */
  updateFromStore(config: NDTransformConfig): void {
    const {
      dimension,
      rotations,
      rotationVersion,
      scales = [],
      uniformScale = 1.0,
      projectionDistance = DEFAULT_PROJECTION_DISTANCE,
    } = config

    // Check if rotation changed
    const rotationChanged =
      dimension !== this.cachedDimension || rotationVersion !== this.cachedRotationVersion

    // Check if scales changed
    const scalesChanged =
      uniformScale !== this.cachedUniformScale ||
      scales.length !== this.cachedScales.length ||
      scales.some((s, i) => s !== this.cachedScales[i])

    // Check if projection distance changed
    const projectionChanged = projectionDistance !== this.cachedProjectionDistance

    // Early exit if nothing changed
    if (!rotationChanged && !scalesChanged && !projectionChanged) {
      return
    }

    // Recompute rotation matrix if needed
    if (rotationChanged) {
      const rotationMatrix = composeRotations(dimension, rotations)
      matrixToGPUUniforms(rotationMatrix, dimension, this.gpuData)

      // Copy to uniforms
      this.uniforms.uRotationMatrix4D.value.copy(this.gpuData.rotationMatrix4D)
      this.uniforms.uExtraRotationCols.value.set(this.gpuData.extraRotationCols)
      this.uniforms.uDepthRowSums.value.set(this.gpuData.depthRowSums)
      this.uniforms.uDimension.value = dimension

      // Update cache
      this.cachedDimension = dimension
      this.cachedRotationVersion = rotationVersion
    }

    // Update scales if changed
    if (scalesChanged) {
      // Build scale array with uniform scale as default
      const scale4D = this.uniforms.uScale4D.value
      for (let i = 0; i < 4; i++) {
        scale4D[i] = scales[i] ?? uniformScale
      }

      const extraScales = this.uniforms.uExtraScales.value
      for (let i = 0; i < EXTRA_DIMS_SIZE; i++) {
        extraScales[i] = scales[i + 4] ?? uniformScale
      }

      // Update cache
      this.cachedScales = [...scales]
      this.cachedUniformScale = uniformScale
    }

    // Update projection distance if changed
    if (projectionChanged) {
      this.uniforms.uProjectionDistance.value = projectionDistance
      this.cachedProjectionDistance = projectionDistance
    }

    // Increment version to signal change
    this.incrementVersion()
  }

  /**
   * Get all transform uniforms for material initialization.
   *
   * @returns Record of uniform names to uniform objects
   */
  getUniforms(): Record<string, IUniform> {
    return this.uniforms as unknown as Record<string, IUniform>
  }

  /**
   * Frame update - typically called from useFrame.
   * For NDTransform, updates are driven by store changes via updateFromStore().
   *
   * @param _state - Frame state (unused)
   */
  update(_state: UniformUpdateState): void {
    // NDTransform updates are driven by store changes, not per-frame
    // This method is a no-op for NDTransform
  }

  /**
   * Reset to initial state.
   * Useful for testing or when resetting the renderer.
   */
  reset(): void {
    this.cachedDimension = 0
    this.cachedRotationVersion = -1
    this.cachedScales = []
    this.cachedUniformScale = 1.0
    this.cachedProjectionDistance = DEFAULT_PROJECTION_DISTANCE
    this._version = 0

    // Reset GPU data
    this.gpuData.rotationMatrix4D.identity()
    this.gpuData.extraRotationCols.fill(0)
    this.gpuData.depthRowSums.fill(0)
    this.gpuData.dimension = 4

    // Reset uniforms
    this.uniforms.uRotationMatrix4D.value.identity()
    this.uniforms.uExtraRotationCols.value.fill(0)
    this.uniforms.uDepthRowSums.value.fill(0)
    this.uniforms.uDimension.value = 4
    this.uniforms.uScale4D.value = [1, 1, 1, 1]
    this.uniforms.uExtraScales.value.fill(1)
    this.uniforms.uProjectionDistance.value = DEFAULT_PROJECTION_DISTANCE
  }

  /**
   * Get the cached GPU data for direct access (advanced use).
   * Prefer using applyToMaterial() instead.
   *
   * @returns The cached GPU transform data
   */
  getGPUData(): NDTransformGPUData {
    return this.gpuData
  }
}
