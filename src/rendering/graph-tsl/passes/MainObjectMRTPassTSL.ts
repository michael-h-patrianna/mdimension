/**
 * Main Object MRT Pass (TSL)
 *
 * Renders the main object layer into an MRT render target so shaders
 * can output both color and normal buffers in a single pass.
 *
 * This pass forces materials to be opaque for correct normal output
 * and writes depth for depth-aware compositing.
 *
 * CRITICAL WebGPU/TSL Pattern:
 * Unlike WebGL which uses gl.drawBuffers(), WebGPU requires the render
 * pipeline's fragment outputs to match the render pass color attachments.
 * This is achieved by calling renderer.setMRT() BEFORE rendering to an
 * MRT target. Materials with their own mrtNode will override specific outputs.
 *
 * Performance: Material cache is built lazily on first render and
 * reused for subsequent frames. Call invalidateCache() when the scene
 * structure changes (e.g., object type change, geometry recreation).
 *
 * @module rendering/graph-tsl/passes/MainObjectMRTPassTSL
 */

import * as THREE from 'three'
import { float, mrt, normalView, output, positionWorld, vec4 } from 'three/tsl'
import type { MRTNode } from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import { isMRTTarget } from '@/rendering/graph/MRTStateManager'
import { isWebGLRenderer } from '@/rendering/core/rendererUtils'
import type { RenderContextTSL } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Extended renderer interface for WebGPU MRT support.
 */
interface RendererWithMRT {
  setMRT(mrt: MRTNode | null): void
  getMRT(): MRTNode | null
}

/**
 * Cached material entry with original properties for restoration.
 */
interface CachedMaterialEntry {
  material: THREE.Material
  transparent: boolean
  depthWrite: boolean
  blending: THREE.Blending
}

/**
 * Configuration for MainObjectMRTPassTSL.
 */
export interface MainObjectMRTPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Output MRT resource ID */
  outputResource: string
  /** Layers to render (null = all layers) */
  layers?: number[]
  /** Clear color (default: black) */
  clearColor?: THREE.ColorRepresentation
  /** Clear alpha (default: 0) */
  clearAlpha?: number
  /** Whether to clear before rendering */
  clear?: boolean
  /** Whether to render scene background */
  renderBackground?: boolean
  /** Force materials to be opaque for MRT output */
  forceOpaque?: boolean
}

/**
 * Renderer interface for type safety.
 */
interface RendererWithMethods {
  autoClear: boolean
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
  getClearColor(target: THREE.Color): THREE.Color
  getClearAlpha(): number
  setClearColor(color: THREE.Color, alpha: number): void
  clear(color?: boolean, depth?: boolean, stencil?: boolean): void
}

/**
 * Renders the main object layer into an MRT target.
 *
 * IMPORTANT for WebGPU: The materials rendered by this pass MUST have their own
 * `mrtNode` configured to output to all render target attachments. The render
 * target texture names must match the mrt() output names.
 *
 * For raymarched objects (BlackHole, Schrödinger), the mrtNode outputs:
 * - 'output': Color from raymarching
 * - 'normal': View-space normal computed from SDF gradients
 * - 'position': World position for temporal reprojection
 */
export class MainObjectMRTPassTSL extends BasePassTSL {
  private outputId: string
  private layers: number[] | null
  private clearColor: THREE.Color
  private clearAlpha: number
  private clear: boolean
  private renderBackground: boolean
  private forceOpaque: boolean
  private cameraLayers = new THREE.Layers()

  /**
   * Cached materials that need opacity forcing.
   * Built lazily on first render, invalidated via invalidateCache().
   * null means cache needs to be rebuilt.
   */
  private materialCache: CachedMaterialEntry[] | null = null

  /**
   * Default MRT configuration for WebGPU.
   *
   * CRITICAL: This provides default outputs for materials that don't have their own mrtNode.
   * Materials WITH mrtNode (BlackHole, Schrödinger) will OVERRIDE these with their own values.
   *
   * Uses safe defaults:
   * - output: Built-in output node (material's colorNode)
   * - normal: Black (raymarched objects override with computed normals)
   * - position: Black (raymarched objects override with computed positions)
   */
  private defaultMRT: MRTNode | null = null

  constructor(config: MainObjectMRTPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Main Object MRT Pass',
      inputs: [],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      // CRITICAL: MRT targets require skipPassthrough to use aliasing instead of copy
      // Passthrough only copies first attachment, breaking MRT state
      skipPassthrough: true,
    })

    this.outputId = config.outputResource
    this.layers = config.layers ?? null
    this.clearColor = new THREE.Color(config.clearColor ?? 0x000000)
    this.clearAlpha = config.clearAlpha ?? 0
    this.clear = config.clear ?? true
    this.renderBackground = config.renderBackground ?? false
    this.forceOpaque = config.forceOpaque ?? true
  }

  /**
   * Create the default MRT configuration lazily.
   *
   * Uses TSL built-in nodes that work for mesh materials:
   * - output: The built-in output node (material's colorNode)
   * - normal: View-space normal from geometry (encoded [0,1])
   * - position: World-space position
   *
   * Materials with their own mrtNode (BlackHole, Schrödinger, Mandelbulb, Julia)
   * will OVERRIDE these with their raymarched-specific values.
   */
  private ensureDefaultMRT(): MRTNode {
    if (!this.defaultMRT) {
      // Create default MRT using TSL built-ins for mesh materials
      // Raymarched materials override these with their computed values
      this.defaultMRT = mrt({
        output: output,
        // View-space normal encoded from [-1,1] to [0,1]
        // Alpha = 1.0 (mesh always has valid surface)
        normal: vec4(normalView.mul(0.5).add(0.5), float(1.0)),
        // World position for temporal reprojection
        // Alpha = 1.0 (mesh always has valid surface)
        position: vec4(positionWorld, float(1.0)),
      })
    }
    return this.defaultMRT
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as unknown as RendererWithMethods
    const { scene, camera } = ctx

    const target = ctx.getWriteTarget(this.outputId)
    if (!target) {
      console.warn('MainObjectMRTPassTSL: Output target not found')
      return
    }

    const savedAutoClear = renderer.autoClear
    const savedClearColor = renderer.getClearColor(new THREE.Color())
    const savedClearAlpha = renderer.getClearAlpha()

    // Save camera layers if filtering
    if (this.layers !== null) {
      this.cameraLayers.mask = camera.layers.mask
    }

    // MRT SAFETY: Always disable background when rendering to MRT targets.
    // Three.js's internal skybox shader only outputs to location 0, causing
    // GL_INVALID_OPERATION when drawBuffers expects multiple outputs.
    const isMRT = isMRTTarget(target as THREE.WebGLRenderTarget)
    const shouldDisableBackground = !this.renderBackground || isMRT
    const savedBackground = shouldDisableBackground ? scene.background : null
    if (shouldDisableBackground) {
      scene.background = null
    }

    // Configure layers
    if (this.layers !== null) {
      camera.layers.disableAll()
      for (const layer of this.layers) {
        camera.layers.enable(layer)
      }
    }

    // For WebGPU: Set default MRT configuration before rendering to MRT target.
    // This tells the renderer what outputs to generate for materials WITHOUT mrtNode.
    // Materials that have their own mrtNode (BlackHole, Schrödinger) will OVERRIDE this.
    // Skip for WebGL - it uses MRTStateManager for gl.drawBuffers() instead.
    const isWebGPU = !isWebGLRenderer(ctx.renderer)
    let savedMRT: MRTNode | null = null
    if (isWebGPU && isMRT) {
      const webgpuRenderer = renderer as unknown as RendererWithMRT
      savedMRT = webgpuRenderer.getMRT()
      webgpuRenderer.setMRT(this.ensureDefaultMRT())
    }

    // CRITICAL (WebGPU): NEVER toggle material.transparent at runtime.
    // It forces pipeline recreation and can crash/freeze WebGPU ("Invalid PipelineLayout").
    // Opaque forcing is only safe on the WebGL renderer path.
    const canForceOpaque = this.forceOpaque && !isWebGPU

    try {
      // Force materials to be opaque for MRT outputs
      if (canForceOpaque) {
        // Always rebuild cache because:
        // 1. Mesh layers may be set AFTER first render (via ref callbacks)
        // 2. Materials may change at runtime
        // 3. Transparency state may change dynamically
        // The traversal is O(N) but N is typically small for main objects
        this.rebuildMaterialCache(scene, camera)

        // Save CURRENT material state before forcing opaque
        for (const entry of this.materialCache!) {
          entry.transparent = entry.material.transparent
          entry.depthWrite = entry.material.depthWrite
          entry.blending = entry.material.blending
        }

        // Apply opacity forcing
        for (const entry of this.materialCache!) {
          entry.material.transparent = false
          entry.material.depthWrite = true
          entry.material.blending = THREE.NoBlending
        }
      }

      // Render
      renderer.setRenderTarget(target as THREE.WebGLRenderTarget)

      if (this.clear) {
        renderer.autoClear = false
        renderer.setClearColor(this.clearColor, this.clearAlpha)
        renderer.clear(true, true, false)
      }
      

      renderer.render(scene, camera)
      
    } finally {
      // Restore WebGPU MRT configuration
      if (isWebGPU && isMRT) {
        const webgpuRenderer = renderer as unknown as RendererWithMRT
        webgpuRenderer.setMRT(savedMRT)
      }

      // Restore material props to their state before this pass - O(M)
      if (canForceOpaque && this.materialCache) {
        for (const entry of this.materialCache) {
          entry.material.transparent = entry.transparent
          entry.material.depthWrite = entry.depthWrite
          entry.material.blending = entry.blending
        }
      }

      // Restore background (only if we disabled it)
      if (shouldDisableBackground && savedBackground !== null) {
        scene.background = savedBackground
      }

      // Restore camera layers
      if (this.layers !== null) {
        camera.layers.mask = this.cameraLayers.mask
      }

      renderer.autoClear = savedAutoClear
      renderer.setClearColor(savedClearColor, savedClearAlpha)
      renderer.setRenderTarget(null)
    }
  }

  /**
   * Rebuild the material cache by traversing the scene.
   * Only called on first render or after invalidateCache().
   *
   * Caches ALL materials on the target layers so we can force them opaque
   * during MRT rendering, even if they become transparent at runtime
   * (e.g., when opacity is changed from 1.0 to < 1.0).
   *
   * @param scene - The scene to traverse
   * @param camera - The camera with layer mask to test against
   */
  private rebuildMaterialCache(scene: THREE.Scene, camera: THREE.Camera): void {
    this.materialCache = []

    scene.traverse((obj) => {
      // Check if object is on the target layers
      // Note: We check against camera.layers which has already been configured
      // to only have the target layers enabled
      if (this.layers !== null && !obj.layers.test(camera.layers)) {
        return
      }

      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.Material

        // Cache ALL materials so we can force opaque even if they become
        // transparent at runtime (e.g., opacity slider changed)
        this.materialCache!.push({
          material: mat,
          transparent: mat.transparent,
          depthWrite: mat.depthWrite,
          blending: mat.blending,
        })
      }
    })
  }

  /**
   * Invalidate the material cache.
   * Call this when scene structure changes (object type change, geometry recreation).
   * The cache will be rebuilt on the next execute() call.
   *
   * @returns Nothing
   */
  invalidateCache(): void {
    this.materialCache = null
  }

  /**
   * Update which layers are rendered.
   * Also invalidates the material cache since layer filtering affects cached materials.
   *
   * @param layers - The layers to render (null for all layers)
   */
  setLayers(layers: number[] | null): void {
    this.layers = layers
    this.invalidateCache()
  }

  dispose(): void {
    this.materialCache = null
  }
}
