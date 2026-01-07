/**
 * Copy Pass (TSL)
 *
 * Simple texture copy pass with minimal GPU overhead.
 * Used when no processing is needed, just copying from one target to another.
 *
 * This is more efficient than using FXAA as a passthrough since it doesn't
 * perform any edge detection or sampling calculations.
 *
 * REWRITTEN: Now uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture node once with placeholder and updates .value at runtime.
 *
 * @module rendering/graph-tsl/passes/CopyPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { texture, screenUV, Fn } from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for CopyPassTSL.
 */
export interface CopyPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string
}

/**
 * Simple texture copy pass.
 *
 * Copies input texture to output with no processing.
 * Uses stable TextureNode pattern for WebGPU compatibility.
 *
 * @example
 * ```typescript
 * const copyPass = new CopyPassTSL({
 *   id: 'copy',
 *   colorInput: 'sceneColor',
 *   outputResource: 'outputBuffer',
 * });
 * ```
 */
export class CopyPassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Stable texture node for WebGPU compatibility
  private placeholderTexture: THREE.DataTexture
  private colorTexNode: ReturnType<typeof texture> | null = null

  constructor(config: CopyPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Copy Pass',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Create placeholder texture for stable binding (WebGPU requirement)
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderTexture.needsUpdate = true

    // Create orthographic camera for fullscreen rendering
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Create material with the ACTUAL input texture.
   * CRITICAL FOR WEBGPU: Texture must be set BEFORE material compilation!
   */
  private createMaterial(inputTex: THREE.Texture): void {
    // Create texture node with REAL input texture (not placeholder)
    this.colorTexNode = texture(inputTex)

    // Build simple copy shader
    const outputNode = Fn(() => {
      return this.colorTexNode!.sample(screenUV)
    })()

    // Create material
    this.material = new MeshBasicNodeMaterial()
    this.material.outputNode = outputNode
    ;(this.material as unknown as { depthTest: boolean }).depthTest = false
    this.material.depthWrite = false

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
    this.mesh.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    // DEBUG: Commented out to reduce console noise during shadow debugging
    // if (import.meta.env.DEV) {
    //   console.log(`[CopyPassTSL:${this.id}] Created material with REAL texture`)
    // }
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer

    // Get input texture FIRST - needed for material creation
    const colorTex = ctx.getReadTexture(this.colorInputId)
    if (!colorTex) {
      console.warn(`CopyPassTSL: Input '${this.colorInputId}' not found`)
      return
    }

    const outputTarget = ctx.getWriteTarget(this.outputId)

    // DEBUG: Log execution
    if (import.meta.env.DEV) {
      // console.log(`[CopyPassTSL:${this.id}] Execute - input: ${colorTex ? `${(colorTex.image as { width?: number })?.width}x${(colorTex.image as { height?: number })?.height}` : 'NULL'}, output: ${outputTarget ? `${outputTarget.width}x${outputTarget.height}` : 'NULL'}`)
    }

    // Create material with REAL texture if not exists
    if (!this.material) {
      this.createMaterial(colorTex)
    }

    if (!this.material || !this.scene || !this.mesh) {
      return
    }

    // Update texture value for subsequent frames
    if (this.colorTexNode) {
      ;(this.colorTexNode as unknown as { value: THREE.Texture }).value = colorTex
    }

    // Render
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    // Keep material for quick re-enable, just mark for update
    // This avoids shader recompilation on re-enable
  }

  dispose(): void {
    this.material?.dispose()
    this.material = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }

    this.scene = null
    this.placeholderTexture.dispose()
    this.colorTexNode = null
  }
}
