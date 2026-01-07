/**
 * GTAO Pass (TSL)
 *
 * Ground Truth Ambient Occlusion using native Three.js TSL GTAONode.
 * WebGPU-compatible implementation that replaces the WebGL-only wrapper.
 *
 * Uses the TSL ao() function from Three.js for high-quality AO computation.
 * Supports configurable radius, intensity, and resolution scaling.
 *
 * @module rendering/graph-tsl/passes/GTAOPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { texture, vec4 } from 'three/tsl'
import { ao, type GTAONode } from 'three/addons/tsl/display/GTAONode.js'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for GTAOPassTSL.
 */
export interface GTAOPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Input normal resource (world-space normals) */
  normalInput: string
  /** Input depth resource */
  depthInput: string
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth'
  /** Output resource */
  outputResource: string
  /**
   * Enable half-resolution rendering for performance.
   * Uses GTAONode's native resolutionScale property.
   * @default true
   */
  halfResolution?: boolean
  /**
   * AO radius - larger values = wider AO spread.
   * @default 0.25
   */
  radius?: number
  /**
   * AO intensity/scale multiplier.
   * @default 1.0
   */
  intensity?: number
}

/**
 * GTAO (Ground Truth Ambient Occlusion) pass using native TSL.
 *
 * This implementation uses Three.js's GTAONode which is fully WebGPU-compatible.
 * It replaces the previous WebGL-only wrapper approach.
 *
 * @example
 * ```typescript
 * const gtaoPass = new GTAOPassTSL({
 *   id: 'gtao',
 *   colorInput: 'sceneColor',
 *   normalInput: 'sceneNormals',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'aoOutput',
 *   halfResolution: true,
 *   radius: 0.25,
 *   intensity: 1.0,
 * });
 * ```
 */
export class GTAOPassTSL extends BasePassTSL {
  private colorInputId: string
  private normalInputId: string
  private depthInputId: string
  private depthInputAttachment?: number | 'depth'
  private outputId: string

  // GTAONode instance
  private gtaoNode: GTAONode | null = null

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture nodes for inputs (stable references)
  private colorTexNode: ReturnType<typeof texture> | null = null
  private normalTexNode: ReturnType<typeof texture> | null = null
  private depthTexNode: ReturnType<typeof texture> | null = null

  // Cached settings
  private useHalfRes: boolean
  private currentRadius: number
  private currentIntensity: number

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  // Camera reference for GTAONode
  private sceneCamera: THREE.Camera | null = null

  constructor(config: GTAOPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'GTAO Pass (TSL)',
      inputs: [
        { resourceId: config.colorInput, access: 'read' },
        { resourceId: config.normalInput, access: 'read' },
        {
          resourceId: config.depthInput,
          access: 'read',
          attachment: config.depthInputAttachment,
        },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.normalInputId = config.normalInput
    this.depthInputId = config.depthInput
    this.depthInputAttachment = config.depthInputAttachment
    this.outputId = config.outputResource

    this.useHalfRes = config.halfResolution ?? true
    this.currentRadius = config.radius ?? 0.25
    this.currentIntensity = config.intensity ?? 1.0

    // Orthographic camera for fullscreen rendering
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize or update the GTAONode and material.
   */
  private ensureInitialized(
    width: number,
    height: number,
    camera: THREE.Camera,
    colorTex: THREE.Texture,
    normalTex: THREE.Texture,
    depthTex: THREE.Texture
  ): void {
    const needsRecreate =
      !this.gtaoNode ||
      !this.material ||
      width !== this.lastWidth ||
      height !== this.lastHeight ||
      camera !== this.sceneCamera

    if (needsRecreate) {
      // Dispose old resources
      this.disposeInternal()

      this.sceneCamera = camera
      this.lastWidth = width
      this.lastHeight = height

      // Create stable texture nodes
      // MKB-002: Create once with placeholder, update .value at runtime
      this.colorTexNode = texture(colorTex)
      this.normalTexNode = texture(normalTex)
      this.depthTexNode = texture(depthTex)

      // Create GTAONode with depth and normal nodes
      // The ao() function creates a GTAONode that computes AO from these inputs
      this.gtaoNode = ao(this.depthTexNode, this.normalTexNode, camera)

      // Configure GTAONode properties
      this.gtaoNode.radius.value = this.currentRadius
      this.gtaoNode.scale.value = this.currentIntensity
      this.gtaoNode.resolutionScale = this.useHalfRes ? 0.5 : 1.0

      // Set initial size
      this.gtaoNode.setSize(width, height)

      // Create output node that composites AO with scene color
      // Per Three.js docs: AO is in .r channel only
      // Formula: sceneColor.rgb * aoValue
      // Note: GTAONode TypeScript types don't expose .r, but it exists at runtime
      // Cast to unknown first, then to Node-compatible type
      const aoValue = (this.gtaoNode as unknown as { r: ReturnType<typeof vec4>['x'] }).r
      const outputNode = vec4(
        this.colorTexNode.rgb.mul(aoValue),
        this.colorTexNode.a
      )

      // Create material with TSL output
      // Use outputNode for consistency with other TSL passes (not fragmentNode)
      this.material = new MeshBasicNodeMaterial()
      this.material.outputNode = outputNode
      ;(this.material as unknown as THREE.Material).depthTest = false
      ;(this.material as unknown as THREE.Material).depthWrite = false

      // Create fullscreen quad
      const geometry = new THREE.PlaneGeometry(2, 2)
      this.mesh = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
      this.mesh.frustumCulled = false

      this.scene = new THREE.Scene()
      this.scene.add(this.mesh)
    } else {
      // Update texture references
      if (this.colorTexNode) this.colorTexNode.value = colorTex
      if (this.normalTexNode) this.normalTexNode.value = normalTex
      if (this.depthTexNode) this.depthTexNode.value = depthTex
    }
  }

  execute(ctx: RenderContextTSL): void {
    const { size, camera } = ctx
    const renderer = ctx.renderer as SupportedRenderer

    // Skip if size is invalid
    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get input textures and output target
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const normalTex = ctx.getReadTexture(this.normalInputId)
    const depthTex = ctx.getReadTexture(this.depthInputId, this.depthInputAttachment)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!colorTex || !normalTex || !depthTex || !outputTarget) {
      console.warn('GTAOPassTSL: Missing input textures or output target')
      return
    }

    // Ensure GTAONode and material are initialized
    this.ensureInitialized(size.width, size.height, camera, colorTex, normalTex, depthTex)

    if (!this.gtaoNode || !this.material || !this.scene) {
      console.warn('GTAOPassTSL: Failed to initialize')
      return
    }

    // Update GTAONode size if needed
    this.gtaoNode.setSize(size.width, size.height)

    // Render to output
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set the AO radius.
   * @param radius - AO radius (larger = wider spread)
   */
  setRadius(radius: number): void {
    this.currentRadius = radius
    if (this.gtaoNode) {
      this.gtaoNode.radius.value = radius
    }
  }

  /**
   * Set the AO intensity.
   * @param intensity - AO intensity/scale (0-2 typical range)
   */
  setIntensity(intensity: number): void {
    this.currentIntensity = intensity
    if (this.gtaoNode) {
      this.gtaoNode.scale.value = intensity
    }
  }

  /**
   * Enable or disable half-resolution rendering.
   * @param enabled - True for half-res (better performance)
   */
  setHalfResolution(enabled: boolean): void {
    if (this.useHalfRes === enabled) return

    this.useHalfRes = enabled
    if (this.gtaoNode) {
      this.gtaoNode.resolutionScale = enabled ? 0.5 : 1.0
    }
  }

  /**
   * Check if half-resolution mode is enabled.
   */
  isHalfResolution(): boolean {
    return this.useHalfRes
  }

  /**
   * Set the number of samples for quality control.
   * @param samples - Number of samples (higher = better quality, slower)
   */
  setSamples(samples: number): void {
    if (this.gtaoNode) {
      this.gtaoNode.samples.value = samples
    }
  }

  /**
   * Set the distance fall-off.
   * @param falloff - Distance fall-off [0,1] - lower = larger AO effect
   */
  setDistanceFallOff(falloff: number): void {
    if (this.gtaoNode) {
      this.gtaoNode.distanceFallOff.value = Math.max(0, Math.min(1, falloff))
    }
  }

  /**
   * Dispose internal resources.
   */
  private disposeInternal(): void {
    this.gtaoNode?.dispose()
    this.gtaoNode = null

    this.material?.dispose()
    this.material = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }

    this.scene = null
    this.colorTexNode = null
    this.normalTexNode = null
    this.depthTexNode = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.disposeInternal()
    this.lastWidth = 0
    this.lastHeight = 0
    this.sceneCamera = null
  }

  dispose(): void {
    this.disposeInternal()
  }
}
