/**
 * Environment Composite Pass (TSL)
 *
 * Composites the lensed environment layer behind the main object layer.
 * Uses alpha blending to show the environment through transparent objects.
 *
 * This is the TSL port of EnvironmentCompositePass, using TSL nodes instead of GLSL.
 *
 * REWRITTEN: Now uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture nodes once with placeholders and updates .value at runtime.
 *
 * @module rendering/graph-tsl/passes/EnvironmentCompositePassTSL
 */

import * as THREE from 'three'
import { texture, uniform } from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import { createEnvironmentCompositeNode } from '@/rendering/tsl/postprocessing/compositeTSL'
import type { RenderPassConfig } from '@/rendering/graph/types'
import { FullscreenPassTSL } from './FullscreenPassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Shell glow configuration for screen-space edge detection.
 */
export interface ShellGlowConfig {
  enabled: boolean
  color: THREE.Color
  strength: number
}

/**
 * Configuration for EnvironmentCompositePassTSL.
 */
export interface EnvironmentCompositePassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Lensed environment color texture resource ID */
  lensedEnvironmentInput: string

  /** Main object color texture resource ID */
  mainObjectInput: string

  /** Main object depth texture resource ID */
  mainObjectDepthInput: string

  /** Main object depth input attachment (for depth textures on render targets) */
  mainObjectDepthInputAttachment?: number | 'depth'

  /** Output resource ID */
  outputResource: string
}

/**
 * Composites lensed environment behind the main object.
 *
 * @example
 * ```typescript
 * const composite = new EnvironmentCompositePassTSL({
 *   id: 'envComposite',
 *   lensedEnvironmentInput: 'lensedEnvironment',
 *   mainObjectInput: 'mainObjectColor',
 *   mainObjectDepthInput: 'mainObjectMRT',
 *   mainObjectDepthInputAttachment: 'depth',
 *   outputResource: 'compositedScene',
 * });
 *
 * graph.addPass(composite);
 * ```
 */
export class EnvironmentCompositePassTSL extends FullscreenPassTSL {
  private lensedEnvResourceId: string
  private mainObjectResourceId: string
  private mainObjectDepthResourceId: string
  private mainObjectDepthInputAttachment?: number | 'depth'
  private outputResourceId: string

  // Shell glow configuration
  private shellConfig: ShellGlowConfig = {
    enabled: false,
    color: new THREE.Color(1, 1, 1),
    strength: 0,
  }

  // TSL uniforms
  private uResolution: UniformNode<THREE.Vector2>
  private uShellEnabled: UniformNode<number>
  private uShellGlowColor: UniformNode<THREE.Vector3>
  private uShellGlowStrength: UniformNode<number>

  // Placeholder textures for stable TextureNode pattern (WebGPU compatibility)
  // CRITICAL: Must create texture nodes ONCE with placeholders and update .value at runtime
  private placeholderLensedEnv: THREE.DataTexture
  private placeholderMainObj: THREE.DataTexture
  private placeholderMainObjDepth: THREE.DataTexture

  // Stable TextureNode references - created once, value updated at runtime
  private lensedEnvTexNode: ReturnType<typeof texture> | null = null
  private mainObjTexNode: ReturnType<typeof texture> | null = null
  private mainObjDepthTexNode: ReturnType<typeof texture> | null = null

  constructor(config: EnvironmentCompositePassTSLConfig) {
    super({
      id: config.id,
      name: config.name,
      inputs: [
        { resourceId: config.lensedEnvironmentInput, access: 'read' },
        { resourceId: config.mainObjectInput, access: 'read' },
        { resourceId: config.mainObjectDepthInput, access: 'read', attachment: config.mainObjectDepthInputAttachment },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      // Multi-input compositing - skip passthrough to avoid data loss
      skipPassthrough: true,
    })

    this.lensedEnvResourceId = config.lensedEnvironmentInput
    this.mainObjectResourceId = config.mainObjectInput
    this.mainObjectDepthResourceId = config.mainObjectDepthInput
    this.mainObjectDepthInputAttachment = config.mainObjectDepthInputAttachment
    this.outputResourceId = config.outputResource

    // Initialize TSL uniforms
    this.uResolution = uniform(new THREE.Vector2(1, 1))
    this.uShellEnabled = uniform(0.0)
    this.uShellGlowColor = uniform(new THREE.Vector3(1, 1, 1))
    this.uShellGlowStrength = uniform(0.0)

    // Create placeholder textures for stable TextureNode creation
    // Use 4x4 for WebGPU compatibility as per docs/tsl.md
    const size = 4
    const colorData = new Uint8Array(size * size * 4).fill(128)
    const depthData = new Uint8Array(size * size * 4).fill(255)

    this.placeholderLensedEnv = new THREE.DataTexture(
      colorData.slice(),
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderLensedEnv.minFilter = THREE.LinearFilter
    this.placeholderLensedEnv.magFilter = THREE.LinearFilter
    this.placeholderLensedEnv.needsUpdate = true

    this.placeholderMainObj = new THREE.DataTexture(
      colorData.slice(),
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderMainObj.minFilter = THREE.LinearFilter
    this.placeholderMainObj.magFilter = THREE.LinearFilter
    this.placeholderMainObj.needsUpdate = true

    this.placeholderMainObjDepth = new THREE.DataTexture(
      depthData,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderMainObjDepth.minFilter = THREE.LinearFilter
    this.placeholderMainObjDepth.magFilter = THREE.LinearFilter
    this.placeholderMainObjDepth.needsUpdate = true
  }

  /**
   * Create the TSL output node for environment compositing.
   *
   * CRITICAL for WebGPU: Creates stable TextureNodes ONCE with placeholders.
   * The texture values are updated at runtime via updateUniforms().
   */
  protected createOutputNode(ctx: RenderContextTSL): Node {
    // Create stable TextureNodes ONCE with placeholders
    // These will have their .value updated at runtime
    if (!this.lensedEnvTexNode) {
      this.lensedEnvTexNode = texture(this.placeholderLensedEnv)
    }
    if (!this.mainObjTexNode) {
      this.mainObjTexNode = texture(this.placeholderMainObj)
    }
    if (!this.mainObjDepthTexNode) {
      this.mainObjDepthTexNode = texture(this.placeholderMainObjDepth)
    }

    // Update texture values from context if available
    const lensedEnvTexture = ctx.getReadTexture(this.lensedEnvResourceId)
    const mainObjectTexture = ctx.getReadTexture(this.mainObjectResourceId)
    const mainObjectDepthTexture = ctx.getReadTexture(
      this.mainObjectDepthResourceId,
      this.mainObjectDepthInputAttachment
    )

    if (lensedEnvTexture) {
      ;(this.lensedEnvTexNode as unknown as { value: THREE.Texture }).value = lensedEnvTexture
    }
    if (mainObjectTexture) {
      ;(this.mainObjTexNode as unknown as { value: THREE.Texture }).value = mainObjectTexture
    }
    if (mainObjectDepthTexture) {
      ;(this.mainObjDepthTexNode as unknown as { value: THREE.Texture }).value = mainObjectDepthTexture
    }

    // Warn if textures are missing (but still create output with placeholders)
    if (!lensedEnvTexture || !mainObjectTexture || !mainObjectDepthTexture) {
      console.warn('EnvironmentCompositePassTSL: Some input textures not yet available, using placeholders')
    }

    // Create composite node using stable texture node references
    return createEnvironmentCompositeNode(
      this.lensedEnvTexNode,
      this.mainObjTexNode,
      this.mainObjDepthTexNode,
      this.uResolution,
      this.uShellEnabled,
      this.uShellGlowColor,
      this.uShellGlowStrength
    )
  }

  /**
   * Update uniforms from context.
   *
   * CRITICAL for WebGPU: Updates texture values directly instead of invalidating material.
   * This prevents pipeline recreation and avoids "Invalid PipelineLayout" errors.
   */
  protected updateUniforms(ctx: RenderContextTSL): void {
    // Update resolution
    const outputTarget = ctx.getWriteTarget(this.outputResourceId)
    if (outputTarget) {
      this.uResolution.value.set(outputTarget.width, outputTarget.height)
    } else {
      this.uResolution.value.set(ctx.size.width, ctx.size.height)
    }

    // Update shell glow uniforms
    this.uShellEnabled.value = this.shellConfig.enabled ? 1.0 : 0.0
    this.uShellGlowColor.value.set(
      this.shellConfig.color.r,
      this.shellConfig.color.g,
      this.shellConfig.color.b
    )
    this.uShellGlowStrength.value = this.shellConfig.strength

    // Update texture values directly (NOT invalidate material)
    // This is the key WebGPU optimization - no pipeline recreation
    const lensedEnvTexture = ctx.getReadTexture(this.lensedEnvResourceId)
    const mainObjectTexture = ctx.getReadTexture(this.mainObjectResourceId)
    const mainObjectDepthTexture = ctx.getReadTexture(
      this.mainObjectDepthResourceId,
      this.mainObjectDepthInputAttachment
    )

    if (lensedEnvTexture && this.lensedEnvTexNode) {
      ;(this.lensedEnvTexNode as unknown as { value: THREE.Texture }).value = lensedEnvTexture
    }
    if (mainObjectTexture && this.mainObjTexNode) {
      ;(this.mainObjTexNode as unknown as { value: THREE.Texture }).value = mainObjectTexture
    }
    if (mainObjectDepthTexture && this.mainObjDepthTexNode) {
      ;(this.mainObjDepthTexNode as unknown as { value: THREE.Texture }).value = mainObjectDepthTexture
    }
  }

  /**
   * Update shell glow configuration.
   * Call this before rendering to control the photon shell appearance.
   */
  setShellConfig(config: Partial<ShellGlowConfig>): void {
    if (config.enabled !== undefined) {
      this.shellConfig.enabled = config.enabled
    }
    if (config.color !== undefined) {
      this.shellConfig.color.copy(config.color)
    }
    if (config.strength !== undefined) {
      this.shellConfig.strength = config.strength
    }
  }

  /**
   * Get current shell glow configuration.
   */
  getShellConfig(): ShellGlowConfig {
    return {
      enabled: this.shellConfig.enabled,
      color: this.shellConfig.color.clone(),
      strength: this.shellConfig.strength,
    }
  }

  /**
   * Cleanup resources when pass is disposed.
   */
  protected onDispose(): void {
    this.placeholderLensedEnv.dispose()
    this.placeholderMainObj.dispose()
    this.placeholderMainObjDepth.dispose()
    this.lensedEnvTexNode = null
    this.mainObjTexNode = null
    this.mainObjDepthTexNode = null
  }
}
