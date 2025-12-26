/**
 * PBR Uniform Source
 *
 * Provides PBR material uniforms for specific object types:
 * - pbr-face: Main objects (polytope faces, mandelbulb, julia, etc.)
 * - pbr-edge: TubeWireframe (edges with thickness > 1)
 * - pbr-ground: Ground plane and walls
 *
 * Features:
 * - Version tracking from pbrStore.pbrVersion
 * - Cached color conversions (sRGB -> linear)
 * - Automatic store access - no manual updateFromStore() calls needed
 *
 * @module rendering/uniforms/sources/PBRSource
 */

import { Color } from 'three'

import { usePBRStore, type PBRTarget } from '@/stores/pbrStore'
import { BaseUniformSource, type IUniform, type UniformUpdateState } from '../UniformSource'

/**
 * PBR uniforms provided by this source.
 */
interface PBRUniforms {
  uRoughness: { value: number }
  uMetallic: { value: number }
  uSpecularIntensity: { value: number }
  uSpecularColor: { value: Color }
}

/**
 * PBR uniform source for a specific object type.
 *
 * This source manages PBR-related uniforms for one target:
 * - roughness
 * - metallic
 * - specularIntensity
 * - specularColor
 *
 * @example
 * ```typescript
 * // In init.ts - register three sources
 * UniformManager.register(new PBRSource('face'));
 * UniformManager.register(new PBRSource('edge'));
 * UniformManager.register(new PBRSource('ground'));
 *
 * // In renderer - use appropriate source
 * const uniforms = {
 *   ...UniformManager.getCombinedUniforms(['lighting', 'pbr-face']),
 * };
 * ```
 */
export class PBRSource extends BaseUniformSource {
  readonly id: string
  private target: PBRTarget

  private pbrUniforms: PBRUniforms
  private lastStoreVersion = -1

  // Cached values for change detection
  private cachedRoughness = 0
  private cachedMetallic = 0
  private cachedSpecularIntensity = 0
  private cachedSpecularColor = ''

  constructor(target: PBRTarget) {
    super()
    this.target = target
    this.id = `pbr-${target}`

    // Initialize with default values
    this.pbrUniforms = {
      uRoughness: { value: 0.3 },
      uMetallic: { value: 0.0 },
      uSpecularIntensity: { value: 0.8 },
      uSpecularColor: { value: new Color('#ffffff') },
    }
  }

  /**
   * Get all PBR uniforms.
   * @returns Record of PBR uniforms
   */
  getUniforms(): Record<string, IUniform> {
    return this.pbrUniforms as unknown as Record<string, IUniform>
  }

  /**
   * Frame update - automatically pulls from pbrStore.
   *
   * This method accesses the store directly to update PBR uniforms,
   * eliminating the need for renderers to manually call updateFromStore().
   * Only updates when the store version changes (efficient change detection).
   * @param _state
   */
  update(_state: UniformUpdateState): void {
    const pbrState = usePBRStore.getState()

    // Check if store version changed
    if (pbrState.pbrVersion === this.lastStoreVersion) {
      return // No changes
    }

    this.lastStoreVersion = pbrState.pbrVersion

    // Get the PBR config for our target
    const config = pbrState[this.target]

    let changed = false

    // Update roughness
    if (this.cachedRoughness !== config.roughness) {
      this.pbrUniforms.uRoughness.value = config.roughness
      this.cachedRoughness = config.roughness
      changed = true
    }

    // Update metallic
    if (this.cachedMetallic !== config.metallic) {
      this.pbrUniforms.uMetallic.value = config.metallic
      this.cachedMetallic = config.metallic
      changed = true
    }

    // Update specular intensity
    if (this.cachedSpecularIntensity !== config.specularIntensity) {
      this.pbrUniforms.uSpecularIntensity.value = config.specularIntensity
      this.cachedSpecularIntensity = config.specularIntensity
      changed = true
    }

    // Update specular color (convert sRGB to linear)
    if (this.cachedSpecularColor !== config.specularColor) {
      this.pbrUniforms.uSpecularColor.value.set(config.specularColor).convertSRGBToLinear()
      this.cachedSpecularColor = config.specularColor
      changed = true
    }

    // Increment version if anything changed
    if (changed) {
      this.incrementVersion()
    }
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.lastStoreVersion = -1
    this._version = 0
    this.cachedRoughness = 0
    this.cachedMetallic = 0
    this.cachedSpecularIntensity = 0
    this.cachedSpecularColor = ''
  }
}

// Export factory functions for convenience
export const createFacePBRSource = (): PBRSource => new PBRSource('face')
export const createEdgePBRSource = (): PBRSource => new PBRSource('edge')
export const createGroundPBRSource = (): PBRSource => new PBRSource('ground')
