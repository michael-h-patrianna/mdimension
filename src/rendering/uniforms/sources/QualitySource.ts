/**
 * Quality Uniform Source
 *
 * Provides quality-related uniforms for adaptive rendering.
 * Tracks fast mode (during rotation) and quality multiplier.
 *
 * @module rendering/uniforms/sources/QualitySource
 */

import { QUALITY_RESTORE_DELAY_MS } from '@/rendering/renderers/base/types';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useRotationStore } from '@/stores/rotationStore';
import { BaseUniformSource, type IUniform, type UniformUpdateState } from '../UniformSource';

/**
 * Configuration for QualitySource.
 */
export interface QualitySourceConfig {
  /** Quality multiplier from performance store (0-1) */
  qualityMultiplier: number;
  /** Whether fast mode is active (during rotation) */
  fastMode: boolean;
}

/**
 * Quality uniform source for adaptive rendering.
 *
 * Manages quality-related uniforms:
 * - uQualityMultiplier: Progressive refinement quality (0-1)
 * - uFastMode: Whether to use reduced quality during interaction
 *
 * @example
 * ```typescript
 * const qualitySource = new QualitySource();
 *
 * // Update from performance state
 * qualitySource.updateFromStore({
 *   qualityMultiplier: 0.75,
 *   fastMode: false,
 * });
 *
 * // Apply to material
 * if (qualitySource.version !== lastVersion) {
 *   qualitySource.applyToMaterial(material);
 * }
 * ```
 */
export class QualitySource extends BaseUniformSource {
  readonly id = 'quality';

  private qualityUniforms = {
    uQualityMultiplier: { value: 1.0 },
    uFastMode: { value: false },
  };

  // Cached values for change detection
  private cachedQualityMultiplier = 1.0;
  private cachedFastMode = false;

  // Rotation tracking for fast mode
  private lastRotationVersion = -1;
  private rotationStopTimestamp = 0;

  /**
   * Update from store state.
   *
   * @param config - Quality configuration from store
   */
  updateFromStore(config: QualitySourceConfig): void {
    let changed = false;

    if (this.cachedQualityMultiplier !== config.qualityMultiplier) {
      this.qualityUniforms.uQualityMultiplier.value = config.qualityMultiplier;
      this.cachedQualityMultiplier = config.qualityMultiplier;
      changed = true;
    }

    if (this.cachedFastMode !== config.fastMode) {
      this.qualityUniforms.uFastMode.value = config.fastMode;
      this.cachedFastMode = config.fastMode;
      changed = true;
    }

    if (changed) {
      this.incrementVersion();
    }
  }

  /**
   * Get all quality uniforms.
   */
  getUniforms(): Record<string, IUniform> {
    return this.qualityUniforms as unknown as Record<string, IUniform>;
  }

  /**
   * Frame update - automatically pulls from stores and handles fast mode logic.
   */
  update(_state: UniformUpdateState): void {
    const perfState = usePerformanceStore.getState();
    const rotationState = useRotationStore.getState();

    // Check rotation status
    const isRotating = rotationState.version !== this.lastRotationVersion;
    if (isRotating) {
      this.lastRotationVersion = rotationState.version;
      this.rotationStopTimestamp = performance.now();
    }

    // Determine fast mode based on rotation and delay
    // Note: This duplicates logic from useQualityTracking but centralizes it for uniforms
    let fastMode = false;
    if (perfState.fractalAnimationLowQuality) {
      if (isRotating) {
        fastMode = true;
      } else {
        const timeSinceStop = performance.now() - this.rotationStopTimestamp;
        if (timeSinceStop < QUALITY_RESTORE_DELAY_MS) {
          fastMode = true;
        }
      }
    }

    this.updateFromStore({
      qualityMultiplier: perfState.qualityMultiplier,
      fastMode: fastMode,
    });
  }

  /**
   * Get current quality multiplier.
   */
  getQualityMultiplier(): number {
    return this.cachedQualityMultiplier;
  }

  /**
   * Get current fast mode state.
   */
  isFastMode(): boolean {
    return this.cachedFastMode;
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.qualityUniforms.uQualityMultiplier.value = 1.0;
    this.qualityUniforms.uFastMode.value = false;
    this.cachedQualityMultiplier = 1.0;
    this.cachedFastMode = false;
    this._version = 0;
    this.lastRotationVersion = -1;
    this.rotationStopTimestamp = 0;
  }
}
