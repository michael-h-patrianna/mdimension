/**
 * Scene Pass (TSL)
 *
 * Renders the Three.js scene to a render target.
 * This is typically the first pass in a render graph.
 *
 * Features:
 * - Optional layer filtering (critical for gravity lensing pipeline)
 * - Clear color configuration
 * - Background rendering control
 * - Material opacity forcing for separate layer compositing
 *
 * ## Gravity Lensing Pipeline
 * This pass is used 3 times for gravitational lensing:
 * 1. `scene` - All layers when gravity disabled
 * 2. `environmentScene` - ENVIRONMENT + SKYBOX layers only
 * 3. `mainObjectScene` - MAIN_OBJECT layer only
 *
 * @module rendering/graph-tsl/passes/ScenePassTSL
 */

import * as THREE from 'three'

import { isMRTTarget } from '@/rendering/graph/MRTStateManager'
import type { RenderPassConfig } from '@/rendering/graph/types'
import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Internal interface for renderer methods common to both WebGL and WebGPU.
 * Used for type-safe access without complex union type handling.
 */
interface RendererWithClearMethods {
  getClearColor(target: THREE.Color): THREE.Color
  getClearAlpha(): number
  setClearColor(color: THREE.Color, alpha: number): void
  autoClear: boolean
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
  info: {
    render: {
      calls: number
      triangles: number
      points: number
      lines: number
    }
  }
}

// NOTE: forceOpaque is NOT supported in TSL/WebGPU due to fixed pipeline layouts.
// WebGPU cannot change material.transparent or material.blending at runtime without
// pipeline recreation, which causes "Invalid PipelineLayout" errors.
// Instead, use PREMULTIPLIED ALPHA in materials and composite shaders.
// See: compositeTSL.ts createEnvironmentCompositeNode()

/**
 * Render stats captured after scene render.
 */
export interface SceneRenderStats {
  /** Number of draw calls */
  calls: number
  /** Number of triangles rendered */
  triangles: number
  /** Number of points rendered */
  points: number
  /** Number of lines rendered */
  lines: number
}

/**
 * Configuration for ScenePassTSL.
 */
export interface ScenePassTSLConfig extends Omit<RenderPassConfig, 'inputs'> {
  /** Layers to render (null = all layers) */
  layers?: number[]

  /** Clear color (null = use renderer's clear color) */
  clearColor?: THREE.ColorRepresentation | null

  /** Clear alpha */
  clearAlpha?: number

  /** Whether to clear before rendering */
  autoClear?: boolean

  /** Whether to render background */
  renderBackground?: boolean

  // NOTE: forceOpaque is NOT supported in TSL/WebGPU - use premultiplied alpha instead
  // See comment above CachedMaterialEntry for details

  /** Optional callback to receive render stats after scene render (for performance monitoring) */
  onRenderStats?: (stats: SceneRenderStats) => void
}

/**
 * Renders the scene to a render target.
 *
 * Works with both WebGLRenderer and WebGPURenderer.
 *
 * @example
 * ```typescript
 * const scenePass = new ScenePassTSL({
 *   id: 'scene',
 *   outputs: [{ resourceId: 'sceneColor', access: 'write' }],
 *   clearColor: 0x000000,
 *   autoClear: true,
 * });
 *
 * graph.registerPass(scenePass);
 * ```
 */
export class ScenePassTSL extends BasePassTSL {
  private layers: number[] | null
  private clearColor: THREE.Color | null
  private clearAlpha: number
  private autoClear: boolean
  private renderBackground: boolean
  private onRenderStats: ((stats: SceneRenderStats) => void) | null

  // Saved state for restoration
  private savedClearColor = new THREE.Color()
  private savedClearAlpha = 1
  private savedAutoClear = true
  private cameraLayers = new THREE.Layers()

  constructor(config: ScenePassTSLConfig) {
    super({
      ...config,
      inputs: [], // ScenePass has no inputs
    })

    this.layers = config.layers ?? null
    this.clearColor =
      config.clearColor !== undefined && config.clearColor !== null
        ? new THREE.Color(config.clearColor)
        : null
    this.clearAlpha = config.clearAlpha ?? 1
    this.autoClear = config.autoClear ?? true
    this.renderBackground = config.renderBackground ?? true
    this.onRenderStats = config.onRenderStats ?? null
    
  }

  /**
   * Dynamically set the clear color.
   * @param color - The new clear color (hex, string, or THREE.Color)
   */
  setClearColor(color: THREE.ColorRepresentation): void {
    if (this.clearColor === null) {
      this.clearColor = new THREE.Color(color)
    } else {
      this.clearColor.set(color)
    }
  }

  /**
   * Execute the scene pass.
   *
   * This method works identically for WebGL and WebGPU renderers since
   * both implement the same render() API.
   */
  execute(ctx: RenderContextTSL): void {
    const { scene, camera } = ctx
    // Cast renderer to our internal interface for type-safe access
    // Both WebGL and WebGPU renderers implement these methods
    const renderer = ctx.renderer as unknown as RendererWithClearMethods

    // Get output target
    const outputConfig = this.config.outputs[0]
    if (!outputConfig) {
      console.warn('ScenePassTSL: No output configured')
      return
    }

    const target = ctx.getWriteTarget(outputConfig.resourceId)

    // DEBUG: Log execution
    if (import.meta.env.DEV) {
      // console.log(`[ScenePassTSL:${this.config.id}] Execute - target: ${target ? `${target.width}x${target.height}` : 'NULL'}, scene children: ${scene.children.length}, layers: ${this.layers?.join(',') ?? 'all'}`)
    }

    // Save renderer state (only things we actually modify)
    this.savedClearColor.copy(renderer.getClearColor(this.savedClearColor))
    this.savedClearAlpha = renderer.getClearAlpha()
    this.savedAutoClear = renderer.autoClear

    // Save camera layers
    if (this.layers !== null) {
      this.cameraLayers.mask = camera.layers.mask
    }

    // MRT SAFETY ENFORCEMENT:
    // Three.js's internal skybox/environment shaders only output to location 0.
    // When rendering to MRT targets (multiple attachments), this causes issues.
    //
    // For WebGL: GL_INVALID_OPERATION: Active draw buffers with missing fragment shader outputs
    // For WebGPU: Similar issues with pipeline output configuration
    //
    // Solution: Automatically disable background for MRT targets.
    const isMRT = isMRTTarget(target as THREE.WebGLRenderTarget | null)
    const shouldDisableBackground = !this.renderBackground || isMRT

    // Handle background: only modify if renderBackground is false OR target is MRT
    const originalBackground = shouldDisableBackground ? scene.background : null

    try {
      // Configure renderer
      if (this.clearColor !== null) {
        renderer.setClearColor(this.clearColor, this.clearAlpha)
      }
      renderer.autoClear = this.autoClear

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

      // NOTE: forceOpaque removed - WebGPU uses premultiplied alpha for compositing
      // Materials output: vec4(color * opacity, opacity)
      // Composite shader: result = obj.rgb + env.rgb * (1 - obj.a)

      // Set render target
      // Both WebGL and WebGPU renderers accept WebGLRenderTarget here
      renderer.setRenderTarget(target as THREE.WebGLRenderTarget)
      

      // Render the scene
      renderer.render(scene, camera)


      // Capture render stats after scene render (for performance monitoring)
      // This captures stats BEFORE post-processing passes inflate the numbers
      if (this.onRenderStats) {
        this.onRenderStats({
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          points: renderer.info.render.points,
          lines: renderer.info.render.lines,
        })
      }
    } finally {
      // Restore renderer state - always runs even if render throws
      renderer.setClearColor(this.savedClearColor, this.savedClearAlpha)
      renderer.autoClear = this.savedAutoClear

      // Only restore background if we explicitly disabled it
      if (shouldDisableBackground && originalBackground !== null) {
        scene.background = originalBackground
      }

      if (this.layers !== null) {
        camera.layers.mask = this.cameraLayers.mask
      }

      // Reset render target (caller will handle final target)
      renderer.setRenderTarget(null)
    }
  }
}
