/**
 * Environment Composite Pass
 *
 * Composites the lensed environment layer behind the main object layer.
 * Uses alpha blending to show the environment through transparent objects.
 *
 * @module rendering/graph/passes/EnvironmentCompositePass
 */

import * as THREE from 'three'

import {
  environmentCompositeFragmentShader,
  environmentCompositeVertexShader,
} from '@/rendering/shaders/postprocessing/environmentComposite.glsl'
import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

/**
 * Configuration for EnvironmentCompositePass.
 */
export interface EnvironmentCompositePassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Lensed environment color texture resource ID */
  lensedEnvironmentInput: string

  /** Main object color texture resource ID */
  mainObjectInput: string

  /** Main object depth texture resource ID */
  mainObjectDepthInput: string

  /** Main object depth input attachment (for depth textures on render targets) */
  mainObjectDepthInputAttachment?: number | 'depth'

  /** Output resource ID */
  outputResource: string
}

/**
 * Composites lensed environment behind the main object.
 *
 * @example
 * ```typescript
 * const composite = new EnvironmentCompositePass({
 *   id: 'envComposite',
 *   lensedEnvironmentInput: 'lensedEnvironment',
 *   mainObjectInput: 'mainObjectColor',
 *   mainObjectDepthInput: 'mainObjectDepth',
 *   outputResource: 'compositedScene',
 * });
 *
 * graph.addPass(composite);
 * ```
 */
export class EnvironmentCompositePass extends BasePass {
  private lensedEnvResourceId: string
  private mainObjectResourceId: string
  private mainObjectDepthResourceId: string
  private mainObjectDepthInputAttachment?: number | 'depth'
  private outputResourceId: string

  // Rendering resources
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  constructor(config: EnvironmentCompositePassConfig) {
    super({
      id: config.id,
      name: config.name,
      inputs: [
        { resourceId: config.lensedEnvironmentInput, access: 'read' },
        { resourceId: config.mainObjectInput, access: 'read' },
        { resourceId: config.mainObjectDepthInput, access: 'read', attachment: config.mainObjectDepthInputAttachment },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    })

    this.lensedEnvResourceId = config.lensedEnvironmentInput
    this.mainObjectResourceId = config.mainObjectInput
    this.mainObjectDepthResourceId = config.mainObjectDepthInput
    this.mainObjectDepthInputAttachment = config.mainObjectDepthInputAttachment
    this.outputResourceId = config.outputResource

    // Create composite material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tLensedEnvironment: { value: null },
        tMainObject: { value: null },
        tMainObjectDepth: { value: null },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
      },
      vertexShader: environmentCompositeVertexShader,
      fragmentShader: environmentCompositeFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  execute(ctx: RenderContext): void {
    const { renderer, camera } = ctx

    // Get input textures
    const lensedEnvTexture = ctx.getReadTexture(this.lensedEnvResourceId)
    const mainObjectTexture = ctx.getReadTexture(this.mainObjectResourceId)
    const mainObjectDepthTexture = ctx.getReadTexture(
      this.mainObjectDepthResourceId,
      this.mainObjectDepthInputAttachment
    )

    if (!lensedEnvTexture || !mainObjectTexture || !mainObjectDepthTexture) {
      console.warn('EnvironmentCompositePass: Missing input textures')
      return
    }

    // Get output target
    const outputTarget = ctx.getWriteTarget(this.outputResourceId)

    // Get camera near/far for depth linearization
    let near = 0.1
    let far = 100
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      near = camera.near
      far = camera.far
    }

    // Update uniforms
    this.material.uniforms['tLensedEnvironment']!.value = lensedEnvTexture
    this.material.uniforms['tMainObject']!.value = mainObjectTexture
    this.material.uniforms['tMainObjectDepth']!.value = mainObjectDepthTexture
    this.material.uniforms['uNear']!.value = near
    this.material.uniforms['uFar']!.value = far

    // Render
    renderer.setRenderTarget(outputTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  dispose(): void {
    this.material.dispose()
    this.mesh.geometry.dispose()
    this.scene.remove(this.mesh)
  }
}
