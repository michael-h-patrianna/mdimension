/**
 * Gravitational Lensing Pass (TSL)
 *
 * Applies gravitational lensing distortion to the environment layer only.
 * The gravity well is assumed to be at world origin (0,0,0), projected to screen space.
 *
 * This is the TSL port of GravitationalLensingPass, using TSL nodes instead of GLSL.
 *
 * REWRITTEN: Now uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture node once with placeholder and updates .value at runtime.
 *
 * @module rendering/graph-tsl/passes/GravitationalLensingPassTSL
 */

import * as THREE from 'three'
import { texture, uniform } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import { createScreenSpaceLensingNodeSimple } from '@/rendering/tsl/postprocessing/screenSpaceLensingTSL'
import type { RenderPassConfig } from '@/rendering/graph/types'
import { FullscreenPassTSL } from './FullscreenPassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Configuration for GravitationalLensingPassTSL.
 */
export interface GravitationalLensingPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input environment color texture resource ID */
  environmentInput: string

  /** Output resource ID */
  outputResource: string
}

/**
 * Gravitational lensing pass for environment layer.
 *
 * Reads gravity settings from the frozen frame context and applies
 * gravitational distortion to the environment buffer.
 *
 * @example
 * ```typescript
 * const lensing = new GravitationalLensingPassTSL({
 *   id: 'envLensing',
 *   environmentInput: 'environmentColor',
 *   outputResource: 'lensedEnvironment',
 *   enabled: (frame) => frame?.stores.postProcessing.gravityEnabled ?? false,
 * });
 *
 * graph.addPass(lensing);
 * ```
 */
export class GravitationalLensingPassTSL extends FullscreenPassTSL {
  private inputResourceId: string

  // Gravity center in UV space (calculated from world origin projection)
  private gravityCenter = new THREE.Vector2(0.5, 0.5)
  private worldOrigin = new THREE.Vector3(0, 0, 0)

  // TSL uniforms
  private uGravityCenter: UniformNode<THREE.Vector2>
  private uStrength: UniformNode<number>
  private uDistortionScale: UniformNode<number>
  private uFalloff: UniformNode<number>
  private uChromaticAberration: UniformNode<number>

  // Placeholder texture for stable TextureNode pattern (WebGPU compatibility)
  // CRITICAL: Must create texture node ONCE with placeholder and update .value at runtime
  private placeholderTexture: THREE.DataTexture

  // Stable TextureNode reference - created once, value updated at runtime
  private texNode: ReturnType<typeof texture> | null = null

  constructor(config: GravitationalLensingPassTSLConfig) {
    super({
      id: config.id,
      name: config.name,
      inputs: [{ resourceId: config.environmentInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.inputResourceId = config.environmentInput

    // Initialize TSL uniforms with default values
    this.uGravityCenter = uniform(this.gravityCenter)
    this.uStrength = uniform(1.0)
    this.uDistortionScale = uniform(1.0)
    this.uFalloff = uniform(1.5)
    this.uChromaticAberration = uniform(0.0)

    // Create placeholder texture for stable TextureNode creation
    // Use 4x4 for WebGPU compatibility as per docs/tsl.md
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderTexture.minFilter = THREE.LinearFilter
    this.placeholderTexture.magFilter = THREE.LinearFilter
    this.placeholderTexture.needsUpdate = true
  }

  /**
   * Create the TSL output node for gravitational lensing.
   *
   * CRITICAL for WebGPU: Creates stable TextureNode ONCE with placeholder.
   * The texture value is updated at runtime via updateUniforms().
   */
  protected createOutputNode(ctx: RenderContextTSL): Node {
    // Create stable TextureNode ONCE with placeholder
    if (!this.texNode) {
      this.texNode = texture(this.placeholderTexture)
    }

    // Update texture value from context if available
    const environmentTexture = ctx.getReadTexture(this.inputResourceId)
    if (environmentTexture) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = environmentTexture
    } else {
      console.warn(`GravitationalLensingPassTSL: Environment texture '${this.inputResourceId}' not yet available, using placeholder`)
    }

    // Create lensing node using simplified version (environment has no depth)
    return createScreenSpaceLensingNodeSimple(
      this.texNode,
      this.uGravityCenter,
      this.uStrength,
      uniform(1.0), // mass = 1.0 (scaled into strength)
      this.uDistortionScale,
      this.uFalloff,
      this.uChromaticAberration
    )
  }

  /**
   * Update uniforms from frozen frame context.
   *
   * CRITICAL for WebGPU: Updates texture value directly instead of invalidating material.
   * This prevents pipeline recreation and avoids "Invalid PipelineLayout" errors.
   */
  protected updateUniforms(ctx: RenderContextTSL): void {
    const { camera } = ctx

    // Read gravity settings from frozen frame context
    const frame = ctx.frame
    const pp = frame?.stores.postProcessing
    const strength = pp?.gravityStrength ?? 1.0
    const distortionScale = pp?.gravityDistortionScale ?? 1.0
    const falloff = pp?.gravityFalloff ?? 1.5
    const chromaticAberration = pp?.gravityChromaticAberration ?? 0.0

    // Project world origin to screen space for gravity center
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      const projected = this.worldOrigin.clone().project(camera)
      // Convert from NDC (-1 to 1) to UV (0 to 1)
      this.gravityCenter.set(
        (projected.x + 1) * 0.5,
        (projected.y + 1) * 0.5
      )
    }

    // Update uniforms
    this.uGravityCenter.value.copy(this.gravityCenter)
    this.uStrength.value = strength
    this.uDistortionScale.value = distortionScale
    this.uFalloff.value = falloff
    this.uChromaticAberration.value = chromaticAberration

    // Update texture value directly (NOT invalidate material)
    const currentTexture = ctx.getReadTexture(this.inputResourceId)
    if (currentTexture && this.texNode) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = currentTexture
    }
  }

  /**
   * Manually set gravity center (for testing or special cases).
   * @param x - X coordinate (0-1)
   * @param y - Y coordinate (0-1)
   */
  setGravityCenter(x: number, y: number): void {
    this.gravityCenter.set(x, y)
    this.uGravityCenter.value.copy(this.gravityCenter)
  }

  /**
   * Cleanup resources when pass is disposed.
   */
  protected onDispose(): void {
    this.placeholderTexture.dispose()
    this.texNode = null
  }
}
