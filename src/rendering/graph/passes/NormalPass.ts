/**
 * Normal Pass
 *
 * Renders world-space normals to a render target for G-buffer effects.
 * Useful for SSAO, edge detection, and other screen-space effects.
 *
 * **IMPORTANT: Standard Geometry Only**
 *
 * This pass uses `scene.overrideMaterial` to replace all materials with a
 * simple normal shader that reads vertex normals from geometry attributes.
 * This approach ONLY works for standard geometry (boxes, spheres, meshes).
 *
 * For raymarched objects (Mandelbulb, Julia, Schrödinger, BlackHole), normals
 * are computed via SDF gradient evaluation in fragment shaders. These objects
 * should use {@link MainObjectMRTPass} instead, which preserves the original
 * shaders and their MRT (Multiple Render Target) normal outputs.
 *
 * **Architecture:**
 * - NormalPass: Environment layer objects (walls, grid, gizmos) - standard geometry
 * - MainObjectMRTPass: Main object layer (raymarched fractals) - shader MRT outputs
 * - normalComposite: Combines both sources into final normal buffer
 *
 * @see MainObjectMRTPass for raymarched object normals
 * @see normalCompositeFragmentShader for normal buffer compositing
 * @module rendering/graph/passes/NormalPass
 */

import * as THREE from 'three'

import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

/**
 * Configuration for NormalPass.
 */
export interface NormalPassConfig extends Omit<RenderPassConfig, 'inputs'> {
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
 * const normalPass = new NormalPass({
 *   id: 'normalEnv',
 *   outputs: [{ resourceId: 'envNormals', access: 'write' }],
 *   layers: [RENDER_LAYERS.ENVIRONMENT], // Exclude raymarched objects
 * });
 *
 * graph.addPass(normalPass);
 * ```
 */
export class NormalPass extends BasePass {
  private normalMaterial: THREE.ShaderMaterial
  private layers: number[] | null
  private cameraLayers = new THREE.Layers()
  private renderBackground: boolean

  constructor(config: NormalPassConfig) {
    super({
      ...config,
      inputs: [], // NormalPass has no inputs
    })

    this.layers = config.layers ?? null
    this.renderBackground = config.renderBackground ?? false

    // Create normal material for override rendering
    // Uses world-space normals, encoded to [0, 1] range
    this.normalMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        out vec3 vWorldNormal;

        void main() {
          // Transform normal to world space
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        in vec3 vWorldNormal;
        layout(location = 0) out vec4 fragColor;

        void main() {
          // Normalize and remap from [-1, 1] to [0, 1]
          vec3 normal = normalize(vWorldNormal);
          fragColor = vec4(normal * 0.5 + 0.5, 1.0);
        }
      `,
    })
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene, camera } = ctx

    // Get output target
    const outputConfig = this.config.outputs[0]
    if (!outputConfig) {
      console.warn('NormalPass: No output configured')
      return
    }

    const target = ctx.getWriteTarget(outputConfig.resourceId)

    // Save scene state
    const savedOverrideMaterial = scene.overrideMaterial
    const savedBackground = !this.renderBackground ? scene.background : null

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

    // Override with normal material
    scene.overrideMaterial = this.normalMaterial

    // Disable background if requested
    if (!this.renderBackground) {
      scene.background = null
    }

    // Render normals
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, camera)

    // Restore state
    scene.overrideMaterial = savedOverrideMaterial

    if (!this.renderBackground && savedBackground !== null) {
      scene.background = savedBackground
    }

    if (this.layers !== null) {
      camera.layers.mask = this.cameraLayers.mask
    }

    renderer.setRenderTarget(null)
  }

  /**
   * Set which layers to render.
   */
  setLayers(layers: number[] | null): void {
    this.layers = layers
  }

  /**
   * Enable/disable background rendering.
   */
  setRenderBackground(enabled: boolean): void {
    this.renderBackground = enabled
  }

  dispose(): void {
    this.normalMaterial.dispose()
  }
}
