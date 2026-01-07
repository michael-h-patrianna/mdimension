/**
 * SMAA Pass (TSL)
 *
 * Subpixel Morphological Anti-Aliasing using native Three.js TSL SMAANode.
 * WebGPU-compatible implementation that replaces the WebGL-only wrapper.
 *
 * Uses the TSL smaa() function from Three.js for high-quality edge smoothing.
 *
 * @module rendering/graph-tsl/passes/SMAAPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { texture } from 'three/tsl'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for SMAAPassTSL.
 */
export interface SMAAPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string
}

/**
 * Subpixel Morphological Anti-Aliasing pass using native TSL.
 *
 * This implementation uses Three.js's SMAANode which is fully WebGPU-compatible.
 * It replaces the previous WebGL-only wrapper approach.
 *
 * @example
 * ```typescript
 * const smaaPass = new SMAAPassTSL({
 *   id: 'smaa',
 *   colorInput: 'sceneColor',
 *   outputResource: 'antialiasedOutput',
 * });
 * ```
 */
export class SMAAPassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture node for input (stable reference)
  private colorTexNode: ReturnType<typeof texture> | null = null

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: SMAAPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'SMAA Pass (TSL)',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Orthographic camera for fullscreen rendering
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize or update the SMAA material.
   */
  private ensureInitialized(
    width: number,
    height: number,
    colorTex: THREE.Texture
  ): void {
    const needsRecreate =
      !this.material ||
      width !== this.lastWidth ||
      height !== this.lastHeight

    if (needsRecreate) {
      // Dispose old resources
      this.disposeInternal()

      this.lastWidth = width
      this.lastHeight = height

      // Create stable texture node
      // MKB-002: Create once with placeholder, update .value at runtime
      this.colorTexNode = texture(colorTex)

      // Create SMAA node - takes input color node and returns antialiased result
      const smaaOutput = smaa(this.colorTexNode)

      // Create material with TSL output
      this.material = new MeshBasicNodeMaterial()
      this.material.outputNode = smaaOutput
      ;(this.material as unknown as THREE.Material).depthTest = false
      ;(this.material as unknown as THREE.Material).depthWrite = false

      // Create fullscreen quad
      const geometry = new THREE.PlaneGeometry(2, 2)
      this.mesh = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
      this.mesh.frustumCulled = false

      this.scene = new THREE.Scene()
      this.scene.add(this.mesh)
    } else {
      // Update texture reference
      if (this.colorTexNode) this.colorTexNode.value = colorTex
    }
  }

  execute(ctx: RenderContextTSL): void {
    const { size } = ctx
    const renderer = ctx.renderer as SupportedRenderer

    // Skip if size is invalid
    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get input texture and output target
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!colorTex || !outputTarget) {
      console.warn('SMAAPassTSL: Missing input texture or output target')
      return
    }

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, colorTex)

    if (!this.material || !this.scene) {
      console.warn('SMAAPassTSL: Failed to initialize')
      return
    }

    // Render to output
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Dispose internal resources.
   */
  private disposeInternal(): void {
    this.material?.dispose()
    this.material = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }

    this.scene = null
    this.colorTexNode = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.disposeInternal()
    this.lastWidth = 0
    this.lastHeight = 0
  }

  dispose(): void {
    this.disposeInternal()
  }
}
