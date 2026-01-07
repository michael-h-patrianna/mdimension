/**
 * Fullscreen Pass (TSL)
 *
 * Base class for fullscreen post-processing passes using TSL node materials.
 * Provides common setup for rendering fullscreen quads with TSL shaders.
 *
 * @module rendering/graph-tsl/passes/FullscreenPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/tsl'

import type { RenderPassConfig } from '@/rendering/graph/types'
import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Internal interface for renderer methods.
 */
interface RendererWithMethods {
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
}

/**
 * Configuration for FullscreenPassTSL.
 */
export interface FullscreenPassTSLConfig extends RenderPassConfig {
  /** Optional: Create material lazily (default: false) */
  lazyMaterial?: boolean
}

/**
 * Abstract base class for fullscreen TSL post-processing passes.
 *
 * Subclasses must implement:
 * - `createOutputNode(ctx)`: Returns the TSL node for the output color
 *
 * Optionally override:
 * - `updateUniforms(ctx)`: Update uniform values before rendering
 * - `onDispose()`: Cleanup custom resources
 *
 * @example
 * ```typescript
 * class MyEffectPass extends FullscreenPassTSL {
 *   private intensity = uniform(1.0);
 *
 *   protected createOutputNode(ctx: RenderContextTSL): Node {
 *     const input = ctx.getReadTexture('input');
 *     return createMyEffectNode(input, this.intensity);
 *   }
 *
 *   protected updateUniforms(ctx: RenderContextTSL): void {
 *     this.intensity.value = ctx.frame?.stores.postProcessing.myIntensity ?? 1.0;
 *   }
 * }
 * ```
 */
export abstract class FullscreenPassTSL extends BasePassTSL {
  protected material: MeshBasicNodeMaterial | null = null
  protected mesh: THREE.Mesh | null = null
  protected scene: THREE.Scene | null = null
  protected camera: THREE.OrthographicCamera | null = null
  protected geometry: THREE.PlaneGeometry | null = null

  private materialsNeedUpdate = true

  constructor(config: FullscreenPassTSLConfig) {
    super(config)
    // Note: lazyMaterial option is reserved for future use
  }

  /**
   * Create the output TSL node for this pass.
   * Subclasses must implement this to define the shader effect.
   *
   * @param ctx - Render context for accessing textures and state
   * @returns TSL node representing the output color
   */
  protected abstract createOutputNode(ctx: RenderContextTSL): Node

  /**
   * Update uniforms before rendering.
   * Override this to update uniform values from frame context.
   *
   * @param ctx - Render context
   */
  protected updateUniforms(_ctx: RenderContextTSL): void {
    // Default: no-op. Override to update uniforms.
  }

  /**
   * Called when the pass is disposed.
   * Override to cleanup custom resources.
   */
  protected onDispose(): void {
    // Default: no-op. Override to cleanup.
  }

  /**
   * Force material recreation on next execute.
   * Call this when shader parameters change that require recompilation.
   */
  protected invalidateMaterial(): void {
    this.materialsNeedUpdate = true
  }

  /**
   * Ensure fullscreen rendering resources exist.
   */
  private ensureResources(): void {
    if (this.scene) return

    this.geometry = new THREE.PlaneGeometry(2, 2)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()

    // Mesh will be created when material is ready
  }

  /**
   * Create or update the material with the output node.
   */
  private ensureMaterial(ctx: RenderContextTSL): void {
    if (!this.materialsNeedUpdate && this.material) return

    // Get the output node from subclass
    const outputNode = this.createOutputNode(ctx)
    if (!outputNode) {
      console.warn(`${this.id}: createOutputNode returned null/undefined`)
      return
    }

    // Create or update material
    if (!this.material) {
      this.material = new MeshBasicNodeMaterial()
      this.material.depthWrite = false
      // depthTest exists at runtime
      ;(this.material as unknown as { depthTest: boolean }).depthTest = false

      // DEBUG: Commented out to reduce console noise during shadow debugging
      // if (import.meta.env.DEV) {
      //   console.log('[FullscreenPassTSL] Created material for pass:', this.id, 'uuid:', (this.material as unknown as { uuid: string }).uuid)
      // }
    }

    // Set the output node
    this.material.outputNode = outputNode
    this.material.needsUpdate = true

    // Create mesh if needed
    if (!this.mesh && this.geometry) {
      // Cast to THREE.Material for Mesh constructor (MeshBasicNodeMaterial extends Material at runtime)
      this.mesh = new THREE.Mesh(this.geometry, this.material as unknown as THREE.Material)
      this.mesh.frustumCulled = false
      this.scene?.add(this.mesh)
    } else if (this.mesh) {
      this.mesh.material = this.material as unknown as THREE.Material
    }

    this.materialsNeedUpdate = false
  }

  /**
   * Execute the fullscreen pass.
   */
  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as unknown as RendererWithMethods

    // Get output target
    const outputConfig = this.config.outputs[0]
    if (!outputConfig) {
      console.warn(`${this.id}: No output configured`)
      return
    }

    const outputTarget = ctx.getWriteTarget(outputConfig.resourceId)

    // Ensure resources
    this.ensureResources()

    // Update uniforms before material creation (some uniforms may affect shader)
    this.updateUniforms(ctx)

    // Ensure material
    this.ensureMaterial(ctx)

    if (!this.mesh || !this.scene || !this.camera) {
      console.warn(`${this.id}: Rendering resources not ready`)
      return
    }

    // Render
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Release internal resources when pass is disabled.
   */
  releaseInternalResources(): void {
    // Keep material for quick re-enable, but mark for update
    this.materialsNeedUpdate = true
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.onDispose()

    if (this.material) {
      this.material.dispose()
      this.material = null
    }

    if (this.geometry) {
      this.geometry.dispose()
      this.geometry = null
    }

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh)
      this.mesh = null
    }

    this.scene = null
    this.camera = null
  }
}
