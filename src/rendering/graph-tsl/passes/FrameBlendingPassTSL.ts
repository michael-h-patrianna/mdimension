/**
 * Frame Blending Pass (TSL)
 *
 * Blends current frame with previous frame for smoother motion at low frame rates.
 * Uses an internal ping-pong buffer to store frame history.
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * Note: The previous WebGL2 glBlitFramebuffer optimization is replaced with
 * TSL-based copy which works on both WebGL and WebGPU renderers.
 *
 * @module rendering/graph-tsl/passes/FrameBlendingPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  vec4,
  texture,
  uniform,
  screenUV,
  mix,
  clamp,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for FrameBlendingPassTSL.
 */
export interface FrameBlendingPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource (current frame) */
  colorInput: string
  /** Output resource (blended frame) */
  outputResource: string
  /** Blend factor (0 = current only, 1 = previous only) */
  blendFactor?: number
}

/**
 * Frame blending pass for temporal smoothing using native TSL.
 *
 * Maintains an internal history buffer and blends the current frame
 * with the previous frame based on the blend factor.
 *
 * @example
 * ```typescript
 * const frameBlendingPass = new FrameBlendingPassTSL({
 *   id: 'frameBlending',
 *   colorInput: 'tonemappedOutput',
 *   outputResource: 'frameBlendingOutput',
 *   blendFactor: 0.3,
 * });
 * ```
 */
export class FrameBlendingPassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Blend material and rendering
  private blendMaterial: MeshBasicNodeMaterial | null = null
  private copyMaterial: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture nodes (stable references)
  private currentTexNode: ReturnType<typeof texture> | null = null
  private previousTexNode: ReturnType<typeof texture> | null = null
  private copyTexNode: ReturnType<typeof texture> | null = null

  // Uniforms
  private uBlendFactor: UniformNode<number>

  // Internal history buffer
  private historyBuffer: THREE.WebGLRenderTarget | null = null
  private historyInitialized = false
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: FrameBlendingPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Frame Blending Pass (TSL)',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Initialize uniforms
    this.uBlendFactor = uniform(config.blendFactor ?? 0.3)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Create or resize the internal history buffer.
   */
  private ensureHistoryBuffer(width: number, height: number): void {
    if (this.historyBuffer && this.lastWidth === width && this.lastHeight === height) {
      return
    }

    // Dispose old buffer
    if (this.historyBuffer) {
      this.historyBuffer.dispose()
    }

    // Create new buffer matching output size
    this.historyBuffer = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    })

    this.lastWidth = width
    this.lastHeight = height
    this.historyInitialized = false

    // Force material recreation to update texture nodes
    this.disposeInternal()
  }

  /**
   * Initialize the TSL materials.
   */
  private ensureInitialized(
    currentTex: THREE.Texture,
    previousTex: THREE.Texture
  ): void {
    if (!this.blendMaterial || !this.copyMaterial) {
      // Create texture nodes
      this.currentTexNode = texture(currentTex)
      this.previousTexNode = texture(previousTex)
      this.copyTexNode = texture(currentTex)

      // Build blend shader
      const blendOutput = this.buildBlendShader()

      // Create blend material
      this.blendMaterial = new MeshBasicNodeMaterial()
      this.blendMaterial.outputNode = blendOutput
      ;(this.blendMaterial as unknown as THREE.Material).depthTest = false
      ;(this.blendMaterial as unknown as THREE.Material).depthWrite = false

      // Build copy shader (simple passthrough)
      const copyOutput = Fn(() => {
        return this.copyTexNode!.sample(screenUV)
      })()

      // Create copy material
      this.copyMaterial = new MeshBasicNodeMaterial()
      this.copyMaterial.outputNode = copyOutput
      ;(this.copyMaterial as unknown as THREE.Material).depthTest = false
      ;(this.copyMaterial as unknown as THREE.Material).depthWrite = false

      // Create fullscreen quad
      const geometry = new THREE.PlaneGeometry(2, 2)
      this.mesh = new THREE.Mesh(geometry, this.blendMaterial as unknown as THREE.Material)
      this.mesh.frustumCulled = false

      this.scene = new THREE.Scene()
      this.scene.add(this.mesh)
    } else {
      // Update texture values
      if (this.currentTexNode) this.currentTexNode.value = currentTex
      if (this.previousTexNode) this.previousTexNode.value = previousTex
    }
  }

  /**
   * Build the frame blending TSL shader.
   */
  private buildBlendShader() {
    const currentTex = this.currentTexNode!
    const previousTex = this.previousTexNode!
    const blendFactor = this.uBlendFactor

    return Fn(() => {
      const uv = screenUV
      const current = currentTex.sample(uv)
      const previous = previousTex.sample(uv)

      // Linear blend between current and previous frame
      // blendFactor 0 = fully current, 1 = fully previous
      // Defensive clamp to ensure valid range
      const blended = mix(current, previous, clamp(blendFactor, float(0), float(1)))

      return vec4(blended.rgb, float(1))
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { size } = ctx

    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get current frame texture
    const currentTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!currentTex || !outputTarget) {
      return
    }

    // Ensure history buffer exists at correct size
    this.ensureHistoryBuffer(size.width, size.height)

    if (!this.historyBuffer) {
      return
    }

    // Ensure materials are initialized
    this.ensureInitialized(currentTex, this.historyBuffer.texture)

    if (!this.blendMaterial || !this.copyMaterial || !this.mesh || !this.scene) {
      return
    }

    // If first frame, just copy current to output and initialize history
    if (!this.historyInitialized) {
      // Copy current frame to output
      if (this.copyTexNode) this.copyTexNode.value = currentTex
      this.mesh.material = this.copyMaterial as unknown as THREE.Material
      renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
      renderer.render(this.scene, this.camera)

      // Copy output to history for next frame
      if (this.copyTexNode) this.copyTexNode.value = outputTarget.texture
      renderer.setRenderTarget(this.historyBuffer)
      renderer.render(this.scene, this.camera)

      this.mesh.material = this.blendMaterial as unknown as THREE.Material
      this.historyInitialized = true
      renderer.setRenderTarget(null)
      return
    }

    // Update texture nodes for blending
    if (this.currentTexNode) this.currentTexNode.value = currentTex
    if (this.previousTexNode) this.previousTexNode.value = this.historyBuffer.texture
    this.mesh.material = this.blendMaterial as unknown as THREE.Material

    // Render blended result to output
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)

    // Copy blended result to history for next frame
    if (this.copyTexNode) this.copyTexNode.value = outputTarget.texture
    this.mesh.material = this.copyMaterial as unknown as THREE.Material
    renderer.setRenderTarget(this.historyBuffer)
    renderer.render(this.scene, this.camera)

    this.mesh.material = this.blendMaterial as unknown as THREE.Material
    renderer.setRenderTarget(null)
  }

  /**
   * Set blend factor.
   * @param value Blend factor (0 = current only, 1 = previous only)
   */
  setBlendFactor(value: number): void {
    this.uBlendFactor.value = value
  }

  /**
   * Reset history buffer (e.g., on camera teleport or scene change).
   */
  resetHistory(): void {
    this.historyInitialized = false
  }

  /**
   * Check if pass was previously enabled (for detecting re-enable).
   * Call this to reset history when the pass is re-enabled after being disabled.
   */
  onEnabled(): void {
    // Reset history when pass is re-enabled to avoid stale frame blending
    this.historyInitialized = false
  }

  /**
   * Dispose internal materials (not history buffer).
   */
  private disposeInternal(): void {
    this.blendMaterial?.dispose()
    this.blendMaterial = null

    this.copyMaterial?.dispose()
    this.copyMaterial = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }
    this.scene = null
    this.currentTexNode = null
    this.previousTexNode = null
    this.copyTexNode = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.disposeInternal()
    if (this.historyBuffer) {
      this.historyBuffer.dispose()
      this.historyBuffer = null
    }
    this.lastWidth = 0
    this.lastHeight = 0
    this.historyInitialized = false
  }

  dispose(): void {
    this.disposeInternal()
    if (this.historyBuffer) {
      this.historyBuffer.dispose()
      this.historyBuffer = null
    }
  }
}
