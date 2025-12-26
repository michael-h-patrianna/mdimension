/**
 * Lighting Uniform Source
 *
 * Provides centralized light uniform management with version tracking.
 * Wraps the existing multi-light uniform utilities from @/rendering/lights/uniforms.
 *
 * Features:
 * - Version tracking from lightingSlice.version
 * - Cached light color conversions via LightColorCache
 * - Shadow data caching to avoid per-frame scene traversal
 * - Automatic store access - no manual updateFromStore() calls needed
 *
 * @module rendering/uniforms/sources/LightingSource
 */

import { Color } from 'three'

import { createLightColorCache, type LightColorCache } from '@/rendering/colors/linearCache'
import type { LightSource as LightSourceConfig } from '@/rendering/lights/types'
import {
  createLightUniforms,
  type LightUniforms,
  updateLightUniforms,
} from '@/rendering/lights/uniforms'
import { useLightingStore } from '@/stores/lightingStore'
import { BaseUniformSource, type IUniform, type UniformUpdateState } from '../UniformSource'

/**
 * Configuration for LightingSource.
 * NOTE: specularIntensity and specularColor have been moved to PBRSource.
 */
export interface LightingSourceConfig {
  /** Light sources from the store */
  lights: LightSourceConfig[]
  /** Lighting slice version for change detection */
  storeVersion: number
  /** Whether ambient light is enabled */
  ambientEnabled: boolean
  /** Ambient color (hex string) */
  ambientColor: string
  /** Ambient intensity */
  ambientIntensity: number
}

/**
 * Extended uniform interface including ambient uniforms.
 * NOTE: Specular uniforms (uSpecularIntensity, uSpecularColor) are now in PBRSource.
 */
interface LightingUniforms extends LightUniforms {
  uAmbientEnabled: { value: number } // 0.0 or 1.0 for GLSL compatibility
  uAmbientColor: { value: Color }
  uAmbientIntensity: { value: number }
}

/**
 * Lighting uniform source with caching and version tracking.
 *
 * This source manages all lighting-related uniforms including:
 * - Multi-light array uniforms (positions, colors, types, etc.)
 * - Ambient/diffuse/specular material properties
 *
 * @example
 * ```typescript
 * const lightingSource = new LightingSource();
 *
 * // Update with current lighting state
 * lightingSource.updateFromStore({
 *   lights: lightingStore.lights,
 *   storeVersion: lightingStore.version,
 *   ambientColor: lightingStore.ambientColor,
 *   // ...
 * });
 *
 * // Check if changed and apply
 * if (lightingSource.version !== lastVersion) {
 *   lightingSource.applyToMaterial(material);
 * }
 * ```
 */
export class LightingSource extends BaseUniformSource {
  readonly id = 'lighting'

  private lightUniforms: LightingUniforms
  private colorCache: LightColorCache
  private lastStoreVersion = -1

  // Cached ambient values
  private cachedAmbientEnabled = true
  private cachedAmbientColor = new Color()
  private cachedAmbientIntensity = 0

  constructor() {
    super()

    // Initialize light uniforms from existing factory
    const baseLightUniforms = createLightUniforms()

    // Add ambient uniforms (specular now in PBRSource)
    this.lightUniforms = {
      ...baseLightUniforms,
      uAmbientEnabled: { value: 1.0 }, // 1.0 = enabled, 0.0 = disabled
      uAmbientColor: { value: new Color('#ffffff') },
      uAmbientIntensity: { value: 0.3 },
    }

    // Initialize color cache for sRGB->linear conversion
    this.colorCache = createLightColorCache()
  }

  /**
   * Update from lighting store state.
   *
   * This is the primary update method that should be called when
   * lighting state changes. It uses the store version for efficient
   * change detection.
   * @param config
   */
  updateFromStore(config: LightingSourceConfig): void {
    // Check if store version changed
    if (config.storeVersion === this.lastStoreVersion) {
      return // No changes
    }

    this.lastStoreVersion = config.storeVersion

    // Update light array uniforms
    updateLightUniforms(this.lightUniforms, config.lights, this.colorCache)

    // Update ambient uniforms (specular now in PBRSource)
    this.updateAmbientUniforms(config)

    // Increment version to signal change
    this.incrementVersion()
  }

  /**
   * Update ambient uniforms.
   * NOTE: Specular uniforms are now handled by PBRSource.
   * @param config
   */
  private updateAmbientUniforms(config: LightingSourceConfig): void {
    // Ambient enabled (convert boolean to float for GLSL)
    if (this.cachedAmbientEnabled !== config.ambientEnabled) {
      this.lightUniforms.uAmbientEnabled.value = config.ambientEnabled ? 1.0 : 0.0
      this.cachedAmbientEnabled = config.ambientEnabled
    }

    // Ambient color (convert sRGB to linear)
    if (this.cachedAmbientColor.getHexString() !== config.ambientColor.replace('#', '')) {
      this.lightUniforms.uAmbientColor.value.set(config.ambientColor).convertSRGBToLinear()
      this.cachedAmbientColor.copy(this.lightUniforms.uAmbientColor.value)
    }

    // Ambient intensity
    if (this.cachedAmbientIntensity !== config.ambientIntensity) {
      this.lightUniforms.uAmbientIntensity.value = config.ambientIntensity
      this.cachedAmbientIntensity = config.ambientIntensity
    }
  }

  /**
   * Get all lighting uniforms.
   * @returns Record of lighting uniforms
   */
  getUniforms(): Record<string, IUniform> {
    return this.lightUniforms as unknown as Record<string, IUniform>
  }

  /**
   * Frame update - automatically pulls from lightingStore.
   *
   * This method accesses the store directly to update lighting uniforms,
   * eliminating the need for renderers to manually call updateFromStore().
   * Only updates when the store version changes (efficient change detection).
   *
   * NOTE: Specular uniforms are now handled by PBRSource (pbr-face, pbr-edge, pbr-ground).
   * @param _state
   */
  update(_state: UniformUpdateState): void {
    // Access store directly - this is the standard pattern in the codebase
    const lightingState = useLightingStore.getState()

    // updateFromStore() already checks version and skips if unchanged
    this.updateFromStore({
      lights: lightingState.lights,
      storeVersion: lightingState.version,
      ambientEnabled: lightingState.ambientEnabled,
      ambientColor: lightingState.ambientColor,
      ambientIntensity: lightingState.ambientIntensity,
    })
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.lastStoreVersion = -1
    this._version = 0
  }
}
