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
 */
export interface LightingSourceConfig {
  /** Light sources from the store */
  lights: LightSourceConfig[]
  /** Lighting slice version for change detection */
  storeVersion: number
  /** Ambient color (hex string) */
  ambientColor: string
  /** Ambient intensity */
  ambientIntensity: number
  /** Specular intensity */
  specularIntensity: number
  /** Specular color (hex string) */
  specularColor: string
  /** Shininess / specular power */
  shininess: number
}

/**
 * Extended uniform interface including material uniforms.
 */
interface LightingUniforms extends LightUniforms {
  uAmbientColor: { value: Color }
  uAmbientIntensity: { value: number }
  uSpecularIntensity: { value: number }
  uSpecularColor: { value: Color }
  uSpecularPower: { value: number }
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

  // Cached material values
  private cachedAmbientColor = new Color()
  private cachedSpecularColor = new Color()
  private cachedAmbientIntensity = 0
  private cachedSpecularIntensity = 0
  private cachedShininess = 0

  constructor() {
    super()

    // Initialize light uniforms from existing factory
    const baseLightUniforms = createLightUniforms()

    // Add material uniforms
    // Note: uDiffuseIntensity removed - energy conservation derives diffuse from (1-kS)*(1-metallic)
    this.lightUniforms = {
      ...baseLightUniforms,
      uAmbientColor: { value: new Color('#ffffff') },
      uAmbientIntensity: { value: 0.3 },
      uSpecularIntensity: { value: 0.5 },
      uSpecularColor: { value: new Color('#ffffff') },
      uSpecularPower: { value: 32 },
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
   */
  updateFromStore(config: LightingSourceConfig): void {
    // Check if store version changed
    if (config.storeVersion === this.lastStoreVersion) {
      return // No changes
    }

    this.lastStoreVersion = config.storeVersion

    // Update light array uniforms
    updateLightUniforms(this.lightUniforms, config.lights, this.colorCache)

    // Update material uniforms
    this.updateMaterialUniforms(config)

    // Increment version to signal change
    this.incrementVersion()
  }

  /**
   * Update material-related uniforms.
   */
  private updateMaterialUniforms(config: LightingSourceConfig): void {
    // Ambient color (convert sRGB to linear)
    if (this.cachedAmbientColor.getHexString() !== config.ambientColor.replace('#', '')) {
      this.lightUniforms.uAmbientColor.value.set(config.ambientColor).convertSRGBToLinear()
      this.cachedAmbientColor.copy(this.lightUniforms.uAmbientColor.value)
    }

    // Specular color (convert sRGB to linear)
    if (this.cachedSpecularColor.getHexString() !== config.specularColor.replace('#', '')) {
      this.lightUniforms.uSpecularColor.value.set(config.specularColor).convertSRGBToLinear()
      this.cachedSpecularColor.copy(this.lightUniforms.uSpecularColor.value)
    }

    // Numeric uniforms
    if (this.cachedAmbientIntensity !== config.ambientIntensity) {
      this.lightUniforms.uAmbientIntensity.value = config.ambientIntensity
      this.cachedAmbientIntensity = config.ambientIntensity
    }

    if (this.cachedSpecularIntensity !== config.specularIntensity) {
      this.lightUniforms.uSpecularIntensity.value = config.specularIntensity
      this.cachedSpecularIntensity = config.specularIntensity
    }

    if (this.cachedShininess !== config.shininess) {
      this.lightUniforms.uSpecularPower.value = config.shininess
      this.cachedShininess = config.shininess
    }
  }

  /**
   * Get all lighting uniforms.
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
   */
  update(_state: UniformUpdateState): void {
    // Access store directly - this is the standard pattern in the codebase
    const lightingState = useLightingStore.getState()

    // updateFromStore() already checks version and skips if unchanged
    this.updateFromStore({
      lights: lightingState.lights,
      storeVersion: lightingState.version,
      ambientColor: lightingState.ambientColor,
      ambientIntensity: lightingState.ambientIntensity,
      specularIntensity: lightingState.specularIntensity,
      specularColor: lightingState.specularColor,
      shininess: lightingState.shininess,
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
