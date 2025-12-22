/**
 * Temporal Cloud Pass
 *
 * Renders volumetric objects to a quarter-res target and performs
 * temporal accumulation reconstruction.
 *
 * ## MRT (Multiple Render Target) Attachment Layout
 *
 * This pass uses three MRT buffers for temporal reconstruction:
 *
 * ### Cloud Buffer (Quarter Resolution)
 * Rendered by volumetric scene, contains Schrödinger object data.
 * | Attachment | Content                | Format       |
 * |------------|------------------------|--------------|
 * | 0          | Color (RGBA)           | HalfFloat    |
 * | 1          | Normal (XYZ)           | HalfFloat    |
 * | 2          | World Position (XYZ)   | HalfFloat    |
 *
 * ### Accumulation Buffer (Full Resolution, PingPong)
 * Stores accumulated temporal data across frames.
 * | Attachment | Content                | Format       |
 * |------------|------------------------|--------------|
 * | 0          | Accumulated Color      | HalfFloat    |
 * | 1          | World Position         | HalfFloat    |
 *
 * ### Reprojection Buffer (Full Resolution)
 * Output from reprojection pass for reconstruction.
 * | Attachment | Content                | Format       |
 * |------------|------------------------|--------------|
 * | 0          | Reprojected Color      | HalfFloat    |
 * | 1          | Validity Mask (R=valid)| HalfFloat    |
 *
 * @module rendering/graph/passes/TemporalCloudPass
 */

import {
  reconstructionFragmentShader,
  reconstructionVertexShader,
  reprojectionFragmentShader,
  reprojectionVertexShader,
} from '@/rendering/shaders/schroedinger/temporal'
import * as THREE from 'three'
import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

export interface TemporalCloudPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Layer to render for volumetric objects */
  volumetricLayer: number
  /** Predicate to determine if temporal cloud should render */
  shouldRender: () => boolean
  /** Resource ID for quarter-res cloud buffer (MRT: Color, Normal, Position) */
  cloudBuffer: string
  /** Resource ID for accumulation buffer (MRT: Color, Position) - PingPong */
  accumulationBuffer: string
  /** Resource ID for reprojection buffer (MRT: Reprojected, Validity) */
  reprojectionBuffer: string
}

/** Bayer pattern offsets for 4-frame cycle */
const BAYER_OFFSETS: [number, number][] = [
  [0.0, 0.0],
  [1.0, 1.0],
  [1.0, 0.0],
  [0.0, 1.0],
]

/**
 * Temporal accumulation pass for volumetric rendering.
 */
export class TemporalCloudPass extends BasePass {
  private volumetricLayer: number
  private shouldRender: () => boolean
  private cameraLayers = new THREE.Layers()

  // Resources
  private cloudBufferId: string
  private accumulationBufferId: string
  private reprojectionBufferId: string

  // State
  private frameIndex = 0
  private hasValidHistory = false
  private prevViewProjectionMatrix = new THREE.Matrix4()
  private prevCameraPosition = new THREE.Vector3()

  // Materials
  private reprojectionMaterial: THREE.ShaderMaterial
  private reconstructionMaterial: THREE.ShaderMaterial
  private fsQuad: THREE.Mesh
  private fsCamera: THREE.OrthographicCamera
  private fsScene: THREE.Scene

  constructor(config: TemporalCloudPassConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Temporal Cloud Pass',
      inputs: [
        { resourceId: config.accumulationBuffer, access: 'read' }, // Previous frame
      ],
      outputs: [
        { resourceId: config.cloudBuffer, access: 'write' },
        { resourceId: config.reprojectionBuffer, access: 'write' },
        { resourceId: config.accumulationBuffer, access: 'write' }, // Current frame
      ],
      enabled: config.enabled,
      priority: config.priority,
    })

    this.volumetricLayer = config.volumetricLayer
    this.shouldRender = config.shouldRender
    this.cloudBufferId = config.cloudBuffer
    this.accumulationBufferId = config.accumulationBuffer
    this.reprojectionBufferId = config.reprojectionBuffer

    // Reprojection Material
    this.reprojectionMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uPrevAccumulation: { value: null },
        uPrevPositionBuffer: { value: null },
        uPrevViewProjectionMatrix: { value: new THREE.Matrix4() },
        uViewProjectionMatrix: { value: new THREE.Matrix4() },
        uInverseViewProjectionMatrix: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uAccumulationResolution: { value: new THREE.Vector2() },
        uDisocclusionThreshold: { value: 0.15 },
      },
      vertexShader: reprojectionVertexShader,
      fragmentShader: reprojectionFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    // Reconstruction Material
    this.reconstructionMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uCloudRender: { value: null },
        uCloudPosition: { value: null },
        uReprojectedHistory: { value: null },
        uReprojectedPositionHistory: { value: null },
        uValidityMask: { value: null },
        uBayerOffset: { value: new THREE.Vector2() },
        uFrameIndex: { value: 0 },
        uCloudResolution: { value: new THREE.Vector2() },
        uAccumulationResolution: { value: new THREE.Vector2() },
        uHistoryWeight: { value: 0.85 },
        uHasValidHistory: { value: false },
      },
      vertexShader: reconstructionVertexShader,
      fragmentShader: reconstructionFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    // Fullscreen Quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.fsQuad = new THREE.Mesh(geometry, this.reprojectionMaterial)
    this.fsQuad.frustumCulled = false
    this.fsScene = new THREE.Scene()
    this.fsScene.add(this.fsQuad)
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  execute(ctx: RenderContext): void {
    const { renderer, scene, camera, size } = ctx

    if (!this.shouldRender()) {
      // If disabled, reset validity
      this.hasValidHistory = false
      this.frameIndex = 0
      return
    }

    const cloudTarget = ctx.getWriteTarget(this.cloudBufferId)
    const accumWrite = ctx.getWriteTarget(this.accumulationBufferId)
    const accumRead = ctx.getReadTarget(this.accumulationBufferId) // Previous frame
    const reprojTarget = ctx.getWriteTarget(this.reprojectionBufferId)

    if (!cloudTarget || !accumWrite || !reprojTarget) {
      return
    }

    // 1. Render Volumetric Scene to Cloud Buffer (Quarter Res)
    this.renderScene(renderer, scene, camera, cloudTarget)

    // 2. Reprojection Pass (Full Res)
    if (this.hasValidHistory && accumRead) {
      this.renderReprojection(renderer, camera, accumRead, reprojTarget, size)
    }

    // 3. Reconstruction Pass (Full Res)
    this.renderReconstruction(renderer, cloudTarget, reprojTarget, accumWrite, accumRead, size)

    // Update state for next frame
    this.updateCameraState(camera)
    this.frameIndex = (this.frameIndex + 1) % 4
    this.hasValidHistory = true
  }

  private renderScene(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget
  ): void {
    const volumetricMeshes: THREE.Mesh[] = []
    const mask = this.getVolumetricMask()
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.layers.test(mask)) {
        volumetricMeshes.push(obj as THREE.Mesh)
      }
    })

    if (volumetricMeshes.length === 0) return

    this.cameraLayers.mask = camera.layers.mask
    camera.layers.disableAll()
    camera.layers.enable(this.volumetricLayer)

    // Update uniforms on meshes
    const bayerOffset = BAYER_OFFSETS[this.frameIndex] ?? [0, 0]
    for (const mesh of volumetricMeshes) {
      const u = (mesh.material as THREE.ShaderMaterial).uniforms
      if (u) {
        if (u['uResolution']) u['uResolution'].value.set(target.width, target.height)
        if (u['uBayerOffset']) u['uBayerOffset'].value.set(bayerOffset[0], bayerOffset[1])
        if (u['uFrameIndex']) u['uFrameIndex'].value = this.frameIndex
        // Full resolution = half-res target * 2 (inverse of 0.5 scale factor)
        if (u['uFullResolution'])
          u['uFullResolution'].value.set(target.width * 2, target.height * 2)
      }
    }

    const oldTarget = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, true) // Clear color, depth, stencil
    renderer.render(scene, camera)
    renderer.setRenderTarget(oldTarget)

    camera.layers.mask = this.cameraLayers.mask
  }

  private renderReprojection(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    accumRead: THREE.WebGLRenderTarget,
    reprojTarget: THREE.WebGLRenderTarget,
    size: { width: number; height: number }
  ): void {
    const u = this.reprojectionMaterial.uniforms

    // ACCUMULATION buffer MRT layout (full-res, no normals stored):
    // [0] = Accumulated Color, [1] = World Position
    // NOTE: This differs from Cloud buffer which has Position at [2]
    if (u['uPrevAccumulation']) u['uPrevAccumulation'].value = accumRead.textures[0]
    if (u['uPrevPositionBuffer']) u['uPrevPositionBuffer'].value = accumRead.textures[1]

    if (u['uPrevViewProjectionMatrix'])
      u['uPrevViewProjectionMatrix'].value.copy(this.prevViewProjectionMatrix)

    const viewProj = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    if (u['uViewProjectionMatrix']) u['uViewProjectionMatrix'].value.copy(viewProj)
    if (u['uInverseViewProjectionMatrix'])
      u['uInverseViewProjectionMatrix'].value.copy(viewProj.clone().invert())

    const worldPos = new THREE.Vector3()
    camera.getWorldPosition(worldPos)
    if (u['uCameraPosition']) u['uCameraPosition'].value.copy(worldPos)

    if (u['uAccumulationResolution'])
      u['uAccumulationResolution'].value.set(size.width, size.height)

    this.fsQuad.material = this.reprojectionMaterial
    renderer.setRenderTarget(reprojTarget)
    renderer.render(this.fsScene, this.fsCamera)
    renderer.setRenderTarget(null)
  }

  private renderReconstruction(
    renderer: THREE.WebGLRenderer,
    cloudTarget: THREE.WebGLRenderTarget,
    reprojTarget: THREE.WebGLRenderTarget,
    accumWrite: THREE.WebGLRenderTarget,
    accumRead: THREE.WebGLRenderTarget | null,
    size: { width: number; height: number }
  ): void {
    const u = this.reconstructionMaterial.uniforms

    // CLOUD buffer MRT layout (quarter-res, includes normals):
    // [0] = Color, [1] = Normal, [2] = World Position
    // NOTE: This differs from Accumulation buffer which has Position at [1]
    if (u['uCloudRender']) u['uCloudRender'].value = cloudTarget.textures[0]
    if (u['uCloudPosition']) u['uCloudPosition'].value = cloudTarget.textures[2]

    if (this.hasValidHistory) {
      // Reprojection buffer MRT: [0] = Reprojected Color, [1] = Validity
      if (u['uReprojectedHistory']) u['uReprojectedHistory'].value = reprojTarget.textures[0]
      if (u['uValidityMask']) u['uValidityMask'].value = reprojTarget.textures[1]
      // Previous position needed for consistency? No, reconstruction uses reprojected data.
      // But shader might need uReprojectedPositionHistory (prev positions)
      // Passed as uPrevPositionBuffer from accumRead
      if (u['uReprojectedPositionHistory'])
        u['uReprojectedPositionHistory'].value = accumRead?.textures[1] ?? null
    } else {
      if (u['uReprojectedHistory']) u['uReprojectedHistory'].value = null
      if (u['uValidityMask']) u['uValidityMask'].value = null
    }

    const bayerOffset = BAYER_OFFSETS[this.frameIndex] ?? [0, 0]
    if (u['uBayerOffset']) u['uBayerOffset'].value.set(bayerOffset[0], bayerOffset[1])
    if (u['uFrameIndex']) u['uFrameIndex'].value = this.frameIndex
    if (u['uCloudResolution'])
      u['uCloudResolution'].value.set(cloudTarget.width, cloudTarget.height)
    if (u['uAccumulationResolution'])
      u['uAccumulationResolution'].value.set(size.width, size.height)
    if (u['uHasValidHistory']) u['uHasValidHistory'].value = this.hasValidHistory

    this.fsQuad.material = this.reconstructionMaterial
    renderer.setRenderTarget(accumWrite)
    renderer.render(this.fsScene, this.fsCamera)
    renderer.setRenderTarget(null)
  }

  private updateCameraState(camera: THREE.Camera): void {
    this.prevViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    camera.getWorldPosition(this.prevCameraPosition)
  }

  private getVolumetricMask(): THREE.Layers {
    const layers = new THREE.Layers()
    layers.set(this.volumetricLayer)
    return layers
  }

  dispose(): void {
    this.reprojectionMaterial.dispose()
    this.reconstructionMaterial.dispose()
    this.fsQuad.geometry.dispose()
  }
}
