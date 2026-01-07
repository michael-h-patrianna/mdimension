/**
 * To Screen Pass (TSL)
 *
 * Copies a texture to the screen (null render target).
 * Typically the final pass in a render graph.
 *
 * Features:
 * - Simple copy (no modifications)
 * - Gamma correction option
 * - Tone mapping option
 *
 * @module rendering/graph-tsl/passes/ToScreenPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial, NodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  texture,
  uniform,
  screenUV,
  vec3,
  vec4,
  pow,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import type { RenderPassConfig } from '@/rendering/graph/types'
import { FullscreenPassTSL } from './FullscreenPassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Configuration for ToScreenPassTSL.
 */
export interface ToScreenPassTSLConfig extends Omit<RenderPassConfig, 'outputs'> {
  /** Apply gamma correction (sRGB output) */
  gammaCorrection?: boolean

  /** Apply simple tone mapping */
  toneMapping?: boolean

  /** Exposure for tone mapping */
  exposure?: number
}

/**
 * Simple Reinhard tone mapping TSL node.
 */
const reinhardToneMap = Fn(([color, exposure]: [Node, Node]) => {
  const exposed = color.mul(exposure)
  return exposed.div(float(1).add(exposed))
})

/**
 * Linear to sRGB gamma correction TSL node.
 */
const linearToSRGB = Fn(([color]: [Node]) => {
  const gamma = float(1).div(2.2)
  // Only apply to RGB, not alpha
  return pow(color.max(0.0001), gamma)
})

/**
 * Copies a texture to the screen.
 *
 * @example
 * ```typescript
 * const toScreen = new ToScreenPassTSL({
 *   id: 'toScreen',
 *   inputs: [{ resourceId: 'finalColor', access: 'read' }],
 *   gammaCorrection: true,
 * });
 *
 * graph.addPass(toScreen);
 * ```
 */
export class ToScreenPassTSL extends FullscreenPassTSL {
  private inputResourceId: string
  private gammaCorrection: boolean
  private toneMapping: boolean

  // TSL uniforms
  private uExposure: UniformNode<number>

  // Stable TextureNode for WebGPU compatibility
  // CRITICAL: Must reuse the same TextureNode and update .value instead of
  // creating new texture() nodes, which would change bind group layout
  private texNode: ReturnType<typeof texture> | null = null
  private placeholderTexture: THREE.DataTexture | null = null

  constructor(config: ToScreenPassTSLConfig) {
    // ToScreen always outputs to screen (null target)
    // We use a synthetic output that doesn't require allocation
    const inputAccess = config.inputs?.[0]
    if (!inputAccess) {
      throw new Error('ToScreenPassTSL: Must have at least one input')
    }

    super({
      id: config.id,
      name: config.name,
      inputs: config.inputs,
      outputs: [], // No outputs - renders to screen
      enabled: config.enabled,
      priority: config.priority,
    })

    this.inputResourceId = inputAccess.resourceId
    this.gammaCorrection = config.gammaCorrection ?? false
    this.toneMapping = config.toneMapping ?? false

    // Initialize uniforms
    this.uExposure = uniform(config.exposure ?? 1.0)
  }

  /**
   * Create the TSL output node for screen copy.
   *
   * CRITICAL for WebGPU: Creates a stable TextureNode ONCE and reuses it.
   * The texture value is updated at runtime via texNode.value instead of
   * creating new texture() nodes.
   */
  protected createOutputNode(ctx: RenderContextTSL): Node {
    // Create placeholder texture if needed (for stable texture node creation)
    if (!this.placeholderTexture) {
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
      this.placeholderTexture.wrapS = THREE.ClampToEdgeWrapping
      this.placeholderTexture.wrapT = THREE.ClampToEdgeWrapping
      this.placeholderTexture.needsUpdate = true
    }

    // Get input texture (or use placeholder if not available yet)
    const inputTexture = ctx.getReadTexture(this.inputResourceId)

    // Create stable texture node ONCE with placeholder
    if (!this.texNode) {
      this.texNode = texture(this.placeholderTexture)
    }

    // Update texture value if available (NOT the node itself)
    if (inputTexture) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = inputTexture
    }

    // Build output node chain using the stable texture node
    const texNodeRef = this.texNode

    return Fn(() => {
      // Sample input texture
      const color = texNodeRef.sample(screenUV)

      // Start with RGB
      let rgb = color.xyz

      // Apply tone mapping if enabled
      if (this.toneMapping) {
        rgb = reinhardToneMap(rgb, this.uExposure)
      }

      // Apply gamma correction if enabled
      if (this.gammaCorrection) {
        rgb = linearToSRGB(rgb)
      }

      return vec4(rgb.x, rgb.y, rgb.z, color.w)
    })()
  }

  /**
   * Update uniforms from context.
   *
   * CRITICAL for WebGPU: Update texture value directly instead of invalidating material.
   * Invalidating triggers material rebuild which can cause "Invalid PipelineLayout".
   */
  protected updateUniforms(ctx: RenderContextTSL): void {
    // Update texture value directly (NOT invalidate material)
    const currentTexture = ctx.getReadTexture(this.inputResourceId)
    if (currentTexture && this.texNode) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = currentTexture
    }
  }

  /**
   * Override execute to render to screen (null target).
   */
  execute(ctx: RenderContextTSL): void {
    // Get input texture FIRST - needed for material creation
    const inputTexture = ctx.getReadTexture(this.inputResourceId)

    // Debug: verify this pass is executing (commented to reduce noise)
    // if (import.meta.env.DEV) {
    //   const materialType = this.material?.constructor?.name ?? 'none'
    //   console.log(
    //     `[ToScreenPassTSL:${this.id}] Execute - inputTexture:`,
    //     inputTexture ? `${inputTexture.image?.width ?? 'no-width'}x${inputTexture.image?.height ?? 'no-height'}` : 'NULL',
    //     `material: ${materialType}`
    //   )
    // }

    // Ensure geometry and scene resources
    if (!this.geometry) {
      this.geometry = new THREE.PlaneGeometry(2, 2)
    }
    if (!this.camera) {
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    }
    if (!this.scene) {
      this.scene = new THREE.Scene()
    }

    // Create TSL material with the ACTUAL input texture
    // CRITICAL FOR WEBGPU: Texture must be set BEFORE material compilation!
    // WebGPU bind groups are fixed at material compile time - updating .value later doesn't work
    if (!this.material) {
      if (!inputTexture) {
        console.warn('[ToScreenPassTSL] No input texture available for material creation, deferring')
        return // Wait until we have a real texture
      }

      // Create texture node with the REAL input texture (not placeholder)
      this.texNode = texture(inputTexture)
      // console.log('[ToScreenPassTSL] Creating material with REAL texture:', inputTexture.image?.width, 'x', inputTexture.image?.height)

      // Use NodeMaterial with fragmentNode - the correct WebGPU pattern
      this.material = new NodeMaterial() as unknown as THREE.ShaderMaterial
      ;(this.material as unknown as { depthWrite: boolean }).depthWrite = false
      ;(this.material as unknown as { depthTest: boolean }).depthTest = false
      ;(this.material as unknown as { fragmentNode: Node }).fragmentNode = this.texNode
      this.material.needsUpdate = true

      // console.log('[ToScreenPassTSL] Created NodeMaterial with fragmentNode (WebGPU pattern)')
    }

    // Update texture value at runtime for subsequent frames
    if (inputTexture && this.texNode) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = inputTexture
    }

    // Create mesh if needed
    if (!this.mesh && this.geometry && this.material) {
      this.mesh = new THREE.Mesh(this.geometry, this.material as unknown as THREE.Material)
      this.mesh.frustumCulled = false
      this.scene.add(this.mesh)
    }

    if (!this.mesh || !this.scene || !this.camera) {
      console.warn('[ToScreenPassTSL] Resources not ready')
      return
    }

    // Render to screen (null target)
    const renderer = ctx.renderer as unknown as {
      setRenderTarget(target: THREE.WebGLRenderTarget | null): void
      render(scene: THREE.Scene, camera: THREE.Camera): void
    }

    // DEBUG: Commented out to reduce console noise during shadow debugging
    // if (import.meta.env.DEV) {
    //   console.log(`[ToScreenPassTSL] Rendering: scene children=${this.scene.children.length}, mesh visible=${this.mesh.visible}`)
    // }

    renderer.setRenderTarget(null)
    renderer.render(this.scene, this.camera)
  }

  /**
   * Set exposure for tone mapping.
   */
  setExposure(exposure: number): void {
    this.uExposure.value = exposure
  }

  /**
   * Cleanup resources when pass is disposed.
   */
  protected onDispose(): void {
    if (this.placeholderTexture) {
      this.placeholderTexture.dispose()
      this.placeholderTexture = null
    }
    this.texNode = null
  }
}
