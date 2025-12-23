/**
 * Temporal Depth Capture Pass
 *
 * Captures depth information into a temporal buffer for raymarching acceleration.
 *
 * @module rendering/graph/passes/TemporalDepthCapturePass
 */

import type { TemporalDepthState } from '@/rendering/core/TemporalDepthState'
import { DepthCaptureShader } from '@/rendering/shaders/postprocessing/DepthCaptureShader'
import * as THREE from 'three'
import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

export interface TemporalDepthCapturePassConfig extends Omit<
  RenderPassConfig,
  'inputs' | 'outputs'
> {
  /** Depth input resource ID */
  depthInput: string
  /** Output resource ID (PingPong) */
  outputResource: string
  /** Force capture even when temporal reprojection is disabled */
  forceCapture?: () => boolean
  /** Temporal depth state instance (from context) */
  temporalDepthState: TemporalDepthState
}

/**
 * Captures depth into a temporal buffer.
 */
export class TemporalDepthCapturePass extends BasePass {
  private depthInputId: string
  private outputResourceId: string
  private forceCapture?: () => boolean
  private temporalDepthState: TemporalDepthState

  private material: THREE.ShaderMaterial
  private fsQuad: THREE.Mesh
  private fsScene: THREE.Scene
  private fsCamera: THREE.OrthographicCamera

  private currentInverseProjectionMatrix = new THREE.Matrix4()

  constructor(config: TemporalDepthCapturePassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Temporal Depth Capture Pass',
      // Include outputResource as input to force Ping-Pong buffering (Read-While-Write pattern)
      inputs: [
        { resourceId: config.depthInput, access: 'read' },
        { resourceId: config.outputResource, access: 'read' }
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
    })

    this.depthInputId = config.depthInput
    this.outputResourceId = config.outputResource
    this.forceCapture = config.forceCapture
    this.temporalDepthState = config.temporalDepthState

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null },
        nearClip: { value: 0.1 },
        farClip: { value: 1000.0 },
        sourceResolution: { value: new THREE.Vector2(1, 1) },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
      },
      vertexShader: DepthCaptureShader.vertexShader,
      fragmentShader: DepthCaptureShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    this.fsQuad = new THREE.Mesh(geometry, this.material)
    this.fsQuad.frustumCulled = false
    this.fsScene = new THREE.Scene()
    this.fsScene.add(this.fsQuad)
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  execute(ctx: RenderContext): void {
    const { renderer, camera } = ctx
    const depthTex = ctx.getReadTexture(this.depthInputId)
    const writeTarget = ctx.getWriteTarget(this.outputResourceId)

    if (!depthTex || !writeTarget) {
      return
    }

    const force = this.forceCapture ? this.forceCapture() : false

    // Skip if disabled (unless forced)
    // Note: We still update the manager state to invalid if disabled
    if (!force && !this.temporalDepthState.isEnabled()) {
      this.temporalDepthState.updateState(null, 1, 1)
      return
    }

    // Update camera matrices for conversion
    if (camera instanceof THREE.PerspectiveCamera) {
      if (this.material.uniforms['nearClip']) this.material.uniforms['nearClip'].value = camera.near
      if (this.material.uniforms['farClip']) this.material.uniforms['farClip'].value = camera.far
    }
    this.currentInverseProjectionMatrix.copy(camera.projectionMatrix).invert()
    if (this.material.uniforms['inverseProjectionMatrix']) {
      this.material.uniforms['inverseProjectionMatrix'].value.copy(
        this.currentInverseProjectionMatrix
      )
    }

    // Update source resolution
    const image = depthTex.image as { width?: number; height?: number } | undefined
    if (image && image.width !== undefined && image.height !== undefined) {
      if (this.material.uniforms['sourceResolution']) {
        this.material.uniforms['sourceResolution'].value.set(image.width, image.height)
      }
    }

    if (this.material.uniforms['tDepth']) this.material.uniforms['tDepth'].value = depthTex

    // Render with state restoration in finally block
    const savedAutoClear = renderer.autoClear
    try {
      renderer.autoClear = false
      renderer.setRenderTarget(writeTarget)
      // Explicitly clear to 0 (invalid depth)
      renderer.setClearColor(0, 0)
      renderer.clear(true, false, false)
      renderer.render(this.fsScene, this.fsCamera)
    } finally {
      renderer.setRenderTarget(null)
      renderer.autoClear = savedAutoClear
    }

    // Update Manager State with the NEW texture (which will be read next frame)
    // The graph swaps ping-pong buffers after execution, so 'writeTarget' becomes 'readTarget'
    this.temporalDepthState.updateState(writeTarget.texture, writeTarget.width, writeTarget.height)
  }

  dispose(): void {
    this.material.dispose()
    this.fsQuad.geometry.dispose()
    // Remove mesh from scene to ensure proper cleanup
    this.fsScene.remove(this.fsQuad)
  }
}
