/**
 * Copy Pass
 *
 * Simple texture copy pass with minimal GPU overhead.
 * Used when no processing is needed, just copying from one target to another.
 *
 * This is more efficient than using FXAA as a passthrough since it doesn't
 * perform any edge detection or sampling calculations.
 *
 * @module rendering/graph/passes/CopyPass
 */

import * as THREE from 'three'

import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

/**
 * Configuration for CopyPass.
 */
export interface CopyPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string
}

/**
 * Simple copy shader - minimal overhead passthrough.
 */
const COPY_VERTEX_SHADER = /* glsl */ `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const COPY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

in vec2 vUv;
uniform sampler2D tDiffuse;
layout(location = 0) out vec4 fragColor;

void main() {
  fragColor = texture(tDiffuse, vUv);
}
`

/**
 * Simple texture copy pass.
 *
 * Copies input texture to output with no processing.
 * Used when AA is disabled to avoid wasteful FXAA calculations.
 *
 * @example
 * ```typescript
 * const copyPass = new CopyPass({
 *   id: 'copy',
 *   colorInput: 'sceneColor',
 *   outputResource: 'outputBuffer',
 * });
 * ```
 */
export class CopyPass extends BasePass {
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  private colorInputId: string
  private outputId: string

  constructor(config: CopyPassConfig) {
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

    // Create simple copy material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: COPY_VERTEX_SHADER,
      fragmentShader: COPY_FRAGMENT_SHADER,
      uniforms: {
        tDiffuse: { value: null },
      },
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
    const { renderer } = ctx

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!colorTex) {
      return
    }

    // Update uniforms
    this.material.uniforms['tDiffuse']!.value = colorTex

    // Render
    renderer.setRenderTarget(outputTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  dispose(): void {
    this.material.dispose()
    this.mesh.geometry.dispose()
    // Remove mesh from scene to ensure proper cleanup
    this.scene.remove(this.mesh)
  }
}
