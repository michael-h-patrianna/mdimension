/**
 * Normal Pass (TSL)
 *
 * Renders world-space normals to a render target for G-buffer effects.
 * Useful for SSAO, edge detection, and other screen-space effects.
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * **IMPORTANT: Standard Geometry Only**
 *
 * This pass uses `scene.overrideMaterial` to replace all materials with a
 * simple normal shader that reads vertex normals from geometry attributes.
 * This approach ONLY works for standard geometry (boxes, spheres, meshes).
 *
 * For raymarched objects (Mandelbulb, Julia, Schrödinger, BlackHole), normals
 * are computed via SDF gradient evaluation in fragment shaders. These objects
 * should use {@link MainObjectMRTPassTSL} instead, which preserves the original
 * shaders and their MRT (Multiple Render Target) normal outputs.
 *
 * **Architecture:**
 * - NormalPassTSL: Environment layer objects (walls, grid, gizmos) - standard geometry
 * - MainObjectMRTPassTSL: Main object layer (raymarched fractals) - shader MRT outputs
 * - normalComposite: Combines both sources into final normal buffer
 *
 * @see MainObjectMRTPassTSL for raymarched object normals
 * @module rendering/graph-tsl/passes/NormalPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  vec3,
  vec4,
  normalWorld,
  positionWorld,
  output,
  mrt,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import { isMRTTarget } from '@/rendering/graph/MRTStateManager'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for NormalPassTSL.
 */
export interface NormalPassTSLConfig extends Omit<RenderPassConfig, 'inputs'> {
  /** Layers to render (null = all layers) */
  layers?: number[]
  /** Whether to render scene background */
  renderBackground?: boolean
}

/**
 * Renders world-space normals to a render target for standard geometry.
 *
 * This pass overrides all scene materials with a normal material
 * to capture surface orientation from vertex normal attributes.
 * The normals are stored in the RGB channels, remapped from [-1, 1] to [0, 1].
 *
 * **Limitation:** Does not work with raymarched objects that compute
 * normals in fragment shaders. Use layer filtering to exclude such objects
 * and handle them separately via MRT passes.
 *
 * @example
 * ```typescript
 * // Render normals for environment layer only (standard geometry)
 * const normalPass = new NormalPassTSL({
 *   id: 'normalEnv',
 *   outputs: [{ resourceId: 'envNormals', access: 'write' }],
 *   layers: [RENDER_LAYERS.ENVIRONMENT], // Exclude raymarched objects
 * });
 *
 * graph.addPass(normalPass);
 * ```
 */
export class NormalPassTSL extends BasePassTSL {
  private normalMaterial: MeshBasicNodeMaterial | null = null
  private normalMaterialMRT: MeshBasicNodeMaterial | null = null
  private layers: number[] | null
  private cameraLayers = new THREE.Layers()
  private renderBackground: boolean

  constructor(config: NormalPassTSLConfig) {
    super({
      ...config,
      inputs: [], // NormalPass has no inputs
    })

    this.layers = config.layers ?? null
    this.renderBackground = config.renderBackground ?? false

    // Initialize materials lazily to avoid early TSL compilation issues
  }

  /**
   * Ensure normal materials are created.
   */
  private ensureInitialized(): void {
    if (this.normalMaterial && this.normalMaterialMRT) {
      return
    }

    // Build the normal output node
    // Encode world normal from [-1, 1] to [0, 1] range
    const normalOutputNode = Fn(() => {
      const wNormal = normalWorld.normalize()
      const encoded = wNormal.mul(0.5).add(0.5)
      return vec4(encoded, float(1))
    })()

    // Create single-output material for non-MRT targets
    this.normalMaterial = new MeshBasicNodeMaterial()
    this.normalMaterial.outputNode = normalOutputNode

    // Create MRT material for multi-render-target rendering
    // Outputs to gColor (0), gNormal (1), and gPosition (2)
    const mrtOutputNode = Fn(() => {
      const wNormal = normalWorld.normalize()
      const wPos = positionWorld
      const encodedNormal = wNormal.mul(0.5).add(0.5)

      // MRT outputs: color, normal, position
      return mrt({
        gColor: vec4(encodedNormal, float(1)),
        gNormal: vec4(encodedNormal, float(0)),
        gPosition: vec4(wPos, float(1)),
      })
    })()

    this.normalMaterialMRT = new MeshBasicNodeMaterial()
    // MRT shader: The Fn() returns mrt({...}) which should be assigned directly to outputNode
    // The mrt() node handles writing to multiple render target attachments
    this.normalMaterialMRT.outputNode = mrtOutputNode
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { scene, camera } = ctx

    // Get output target
    const outputConfig = this.config.outputs[0]
    if (!outputConfig) {
      console.warn('NormalPassTSL: No output configured')
      return
    }

    const target = ctx.getWriteTarget(outputConfig.resourceId)
    if (!target) {
      return
    }

    // Ensure materials are initialized
    this.ensureInitialized()

    if (!this.normalMaterial || !this.normalMaterialMRT) {
      return
    }

    // Save scene state
    const savedOverrideMaterial = scene.overrideMaterial

    // MRT SAFETY: Always disable background when rendering to MRT targets.
    // Three.js's internal skybox shader only outputs to location 0.
    const isMRT = isMRTTarget(target as THREE.WebGLRenderTarget)
    const shouldDisableBackground = !this.renderBackground || isMRT
    const savedBackground = shouldDisableBackground ? scene.background : null

    // Save camera layers if filtering
    if (this.layers !== null) {
      this.cameraLayers.mask = camera.layers.mask
    }

    // Configure layers
    if (this.layers !== null) {
      camera.layers.disableAll()
      for (const layer of this.layers) {
        camera.layers.enable(layer)
      }
    }

    // Override with normal material (use MRT version if target supports it)
    scene.overrideMaterial = (isMRT ? this.normalMaterialMRT : this.normalMaterial) as unknown as THREE.Material

    // Disable background for MRT safety or if explicitly requested
    if (shouldDisableBackground) {
      scene.background = null
    }

    // Render normals
    renderer.setRenderTarget(target as unknown as THREE.WebGLRenderTarget | null)
    renderer.clear()
    renderer.render(scene, camera)

    // Restore state
    scene.overrideMaterial = savedOverrideMaterial

    if (shouldDisableBackground && savedBackground !== null) {
      scene.background = savedBackground
    }

    if (this.layers !== null) {
      camera.layers.mask = this.cameraLayers.mask
    }

    renderer.setRenderTarget(null)
  }

  /**
   * Set which layers to render.
   * @param layers
   */
  setLayers(layers: number[] | null): void {
    this.layers = layers
  }

  /**
   * Enable/disable background rendering.
   * @param enabled
   */
  setRenderBackground(enabled: boolean): void {
    this.renderBackground = enabled
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.normalMaterial?.dispose()
    this.normalMaterial = null
    this.normalMaterialMRT?.dispose()
    this.normalMaterialMRT = null
  }

  dispose(): void {
    this.normalMaterial?.dispose()
    this.normalMaterial = null
    this.normalMaterialMRT?.dispose()
    this.normalMaterialMRT = null
  }
}
