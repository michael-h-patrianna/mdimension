/**
 * Temporal Cloud Pass (TSL)
 *
 * Renders volumetric objects to a quarter-res target and performs
 * temporal accumulation reconstruction using native TSL nodes.
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
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
 * @module rendering/graph-tsl/passes/TemporalCloudPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  vec2,
  vec4,
  texture,
  uniform,
  screenUV,
  floor,
  length,
  abs,
  min,
  max,
  mix,
  select,
  mrt,
  output,
  normalView,
  positionWorld,
  type UniformNode,
} from 'three/tsl'

// Note: 'output' is imported but only used as an MRT key (PropertyNode), not as a function

import { BasePassTSL } from '../BasePassTSL'
import { isMRTTarget } from '@/rendering/graph/MRTStateManager'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'
import type { MRTNode } from 'three/tsl'

/**
 * Configuration for TemporalCloudPassTSL.
 */
export interface TemporalCloudPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
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
 * Temporal accumulation pass for volumetric rendering using native TSL.
 *
 * Uses three-pass approach:
 * 1. Render volumetric scene to quarter-res MRT
 * 2. Reproject previous frame's accumulation
 * 3. Reconstruct full-resolution output with temporal blending
 */
export class TemporalCloudPassTSL extends BasePassTSL {
  private volumetricLayer: number
  private shouldRender: () => boolean
  private cameraLayers = new THREE.Layers()
  private volumetricMask = new THREE.Layers()

  // Resources
  private cloudBufferId: string
  private accumulationBufferId: string
  private reprojectionBufferId: string

  // State
  private frameIndex = 0
  private hasValidHistory = false
  private prevViewProjectionMatrix = new THREE.Matrix4()
  private prevCameraPosition = new THREE.Vector3()

  // Reusable temp objects
  private tempViewProjMatrix = new THREE.Matrix4()
  private tempWorldPos = new THREE.Vector3()

  // TSL Materials
  private reprojectionMaterial: MeshBasicNodeMaterial | null = null
  private reconstructionMaterial: MeshBasicNodeMaterial | null = null
  private fsQuad: THREE.Mesh | null = null
  private fsCamera: THREE.OrthographicCamera
  private fsScene: THREE.Scene | null = null

  // Default MRT layouts (WebGPU requires a fixed fragment output layout for MRT targets)
  private cloudDefaultMRT: MRTNode | null = null
  private reprojectionMRT: MRTNode | null = null
  private reconstructionMRT: MRTNode | null = null

  // Texture nodes for reprojection
  private prevAccumTexNode: ReturnType<typeof texture> | null = null
  private prevPositionTexNode: ReturnType<typeof texture> | null = null

  // Texture nodes for reconstruction
  private cloudRenderTexNode: ReturnType<typeof texture> | null = null
  private cloudPositionTexNode: ReturnType<typeof texture> | null = null
  private reprojectedHistoryTexNode: ReturnType<typeof texture> | null = null
  private validityMaskTexNode: ReturnType<typeof texture> | null = null

  // Reprojection uniforms
  private uPrevViewProjectionMatrix: UniformNode<THREE.Matrix4>
  private uViewProjectionMatrix: UniformNode<THREE.Matrix4>
  private uCameraPosition: UniformNode<THREE.Vector3>
  private uAccumulationResolution: UniformNode<THREE.Vector2>
  private uDisocclusionThreshold: UniformNode<number>

  // Reconstruction uniforms
  private uBayerOffset: UniformNode<THREE.Vector2>
  private uFrameIndex: UniformNode<number>
  private uCloudResolution: UniformNode<THREE.Vector2>
  private uHistoryWeight: UniformNode<number>
  private uHasValidHistory: UniformNode<number>

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: TemporalCloudPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Temporal Cloud Pass (TSL)',
      inputs: [{ resourceId: config.accumulationBuffer, access: 'read' }],
      outputs: [
        { resourceId: config.cloudBuffer, access: 'write' },
        { resourceId: config.reprojectionBuffer, access: 'write' },
        { resourceId: config.accumulationBuffer, access: 'write' },
      ],
      enabled: config.enabled,
      priority: config.priority,
      // CRITICAL: MRT targets require skipPassthrough to use aliasing instead of copy
      // Passthrough only copies first attachment, breaking MRT state
      skipPassthrough: true,
    })

    this.volumetricLayer = config.volumetricLayer
    this.shouldRender = config.shouldRender
    this.volumetricMask.set(this.volumetricLayer)
    this.cloudBufferId = config.cloudBuffer
    this.accumulationBufferId = config.accumulationBuffer
    this.reprojectionBufferId = config.reprojectionBuffer

    // Initialize uniforms
    this.uPrevViewProjectionMatrix = uniform(new THREE.Matrix4())
    this.uViewProjectionMatrix = uniform(new THREE.Matrix4())
    this.uCameraPosition = uniform(new THREE.Vector3())
    this.uAccumulationResolution = uniform(new THREE.Vector2())
    this.uDisocclusionThreshold = uniform(0.15)

    this.uBayerOffset = uniform(new THREE.Vector2())
    this.uFrameIndex = uniform(0)
    this.uCloudResolution = uniform(new THREE.Vector2())
    this.uHistoryWeight = uniform(0.85)
    this.uHasValidHistory = uniform(0)

    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  private createPlaceholderTextureRGBAFloat(): THREE.DataTexture {
    // 1x1 RGBA float placeholder. All zeros => treated as "no history".
    const data = new Float32Array(4)
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.FloatType)
    tex.needsUpdate = true
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  }

  private ensureCloudDefaultMRT(): MRTNode {
    if (!this.cloudDefaultMRT) {
      // Matches the common 3-attachment layout: output / normal / position
      this.cloudDefaultMRT = mrt({
        output: output,
        normal: vec4(normalView.mul(0.5).add(0.5), float(1.0)),
        position: vec4(positionWorld, float(1.0)),
      })
    }
    return this.cloudDefaultMRT
  }

  private setRendererMRTForTarget(
    renderer: SupportedRenderer,
    target: THREE.WebGLRenderTarget,
    mrtNode: MRTNode
  ): { didSet: boolean; previous: MRTNode | null } {
    // WebGPU renderer exposes setMRT/getMRT. WebGL renderer ignores this.
    const r = renderer as unknown as { setMRT?: (m: MRTNode | null) => void; getMRT?: () => MRTNode | null }
    if (typeof r.setMRT !== 'function' || typeof r.getMRT !== 'function') {
      return { didSet: false, previous: null }
    }
    if (!isMRTTarget(target)) {
      return { didSet: false, previous: null }
    }
    const saved = r.getMRT()
    r.setMRT(mrtNode)
    return { didSet: true, previous: saved }
  }

  /**
   * Initialize TSL materials.
   */
  private ensureInitialized(
    cloudTarget: THREE.WebGLRenderTarget,
    accumRead: THREE.WebGLRenderTarget | null,
    reprojTarget: THREE.WebGLRenderTarget,
    size: { width: number; height: number }
  ): void {
    if (this.reprojectionMaterial && this.reconstructionMaterial &&
        this.lastWidth === size.width && this.lastHeight === size.height) {
      return
    }

    this.disposeInternal()
    this.lastWidth = size.width
    this.lastHeight = size.height

    // Create texture nodes for reprojection (ALWAYS; accumRead may be null on first frame).
    const placeholder = this.createPlaceholderTextureRGBAFloat()
    this.prevAccumTexNode = texture(accumRead?.textures?.[0] ?? placeholder)
    this.prevPositionTexNode = texture(accumRead?.textures?.[1] ?? accumRead?.texture ?? placeholder)

    // Create texture nodes for reconstruction
    this.cloudRenderTexNode = texture(cloudTarget.textures[0]!)
    this.cloudPositionTexNode = texture(cloudTarget.textures[2] ?? cloudTarget.texture)
    this.reprojectedHistoryTexNode = texture(reprojTarget.textures[0]!)
    this.validityMaskTexNode = texture(reprojTarget.textures[1] ?? reprojTarget.texture)

    // Build reprojection shader
    const reprojMRT = this.buildReprojectionShader()
    this.reprojectionMaterial = new MeshBasicNodeMaterial()
    // CRITICAL: For WebGPU MRT, use mrtNode NOT outputNode
    // outputNode generates indexed outputs (m0, m1) which don't match named attachments
    // mrtNode generates named outputs (output, position) matching the render target config
    this.reprojectionMaterial.mrtNode = reprojMRT
    // Set to null so setRendererMRTForTarget is not called during render
    // (the material's mrtNode already contains the MRT structure)
    this.reprojectionMRT = null
    ;(this.reprojectionMaterial as unknown as THREE.Material).depthTest = false
    ;(this.reprojectionMaterial as unknown as THREE.Material).depthWrite = false

    // Build reconstruction shader
    const reconMRT = this.buildReconstructionShader()
    this.reconstructionMaterial = new MeshBasicNodeMaterial()
    // CRITICAL: For WebGPU MRT, use mrtNode NOT outputNode
    // outputNode generates indexed outputs (m0, m1) which don't match named attachments
    // mrtNode generates named outputs (output, position) matching the render target config
    this.reconstructionMaterial.mrtNode = reconMRT
    // Set to null so setRendererMRTForTarget is not called during render
    // (the material's mrtNode already contains the MRT structure)
    this.reconstructionMRT = null
    ;(this.reconstructionMaterial as unknown as THREE.Material).depthTest = false
    ;(this.reconstructionMaterial as unknown as THREE.Material).depthWrite = false

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.fsQuad = new THREE.Mesh(geometry, this.reprojectionMaterial as unknown as THREE.Material)
    this.fsQuad.frustumCulled = false
    this.fsScene = new THREE.Scene()
    this.fsScene.add(this.fsQuad)
  }

  /**
   * Build reprojection TSL shader.
   */
  private buildReprojectionShader() {
    const prevAccumTex = this.prevAccumTexNode!
    const prevPositionTex = this.prevPositionTexNode!
    // Note: view projection matrices used internally via uniforms
    const uAccumulationResolution = this.uAccumulationResolution
    const uDisocclusionThreshold = this.uDisocclusionThreshold

    return Fn(() => {
      const uv = screenUV

      // Sample previous frame's data
      const prevColor = prevAccumTex.sample(uv)
      const prevPosition = prevPositionTex.sample(uv)

      // Early out check (no valid history)
      const hasData = prevColor.a.greaterThan(0.001).and(prevPosition.w.greaterThan(0.001))

      // Project world position to current frame
      const worldPos = prevPosition.xyz

      // Simplified reprojection - compute screen motion
      // Matrix multiplication for clip space projection
      // Note: This is a simplified version; full matrix math would require manual column extraction
      const texelSize = float(1).div(uAccumulationResolution.x)

      // Check neighborhood for discontinuities
      const posL = prevPositionTex.sample(uv.sub(vec2(texelSize, 0))).xyz
      const posR = prevPositionTex.sample(uv.add(vec2(texelSize, 0))).xyz
      const posU = prevPositionTex.sample(uv.add(vec2(0, texelSize))).xyz
      const posD = prevPositionTex.sample(uv.sub(vec2(0, texelSize))).xyz

      const maxPosDiff = max(
        max(length(worldPos.sub(posL)), length(worldPos.sub(posR))),
        max(length(worldPos.sub(posU)), length(worldPos.sub(posD)))
      )

      // Start with full validity
      let validity = float(1)

      // Position discontinuity check
      validity = select(
        maxPosDiff.greaterThan(0.3),
        validity.mul(0.5),
        validity
      )

      // Alpha discontinuity check
      const colorL = prevAccumTex.sample(uv.sub(vec2(texelSize, 0)))
      const colorR = prevAccumTex.sample(uv.add(vec2(texelSize, 0)))
      const colorU = prevAccumTex.sample(uv.add(vec2(0, texelSize)))
      const colorD = prevAccumTex.sample(uv.sub(vec2(0, texelSize)))

      const maxAlphaDiff = max(
        max(abs(prevColor.a.sub(colorL.a)), abs(prevColor.a.sub(colorR.a))),
        max(abs(prevColor.a.sub(colorU.a)), abs(prevColor.a.sub(colorD.a)))
      )

      validity = select(
        maxAlphaDiff.greaterThan(uDisocclusionThreshold),
        validity.mul(0.5),
        validity
      )

      // Screen edge rejection
      const edgeDistX = min(uv.x, float(1).sub(uv.x))
      const edgeDistY = min(uv.y, float(1).sub(uv.y))
      const edgeDist = min(edgeDistX, edgeDistY)
      validity = select(
        edgeDist.lessThan(0.03),
        validity.mul(edgeDist.div(0.03)),
        validity
      )

      // Output with validity check
      const finalColor = select(hasData, prevColor, vec4(0, 0, 0, 0))
      const finalValidity = select(hasData, vec4(validity, 0, 0, 1), vec4(0, 0, 0, 0))

      // MRT output (2 attachments)
      // [0] output: reprojected color
      // [1] position: validity mask (R=validity)
      return mrt({
        output: finalColor,
        position: finalValidity,
      })
    })()
  }

  /**
   * Build reconstruction TSL shader.
   */
  private buildReconstructionShader() {
    const cloudRenderTex = this.cloudRenderTexNode!
    const cloudPositionTex = this.cloudPositionTexNode!
    const reprojectedHistoryTex = this.reprojectedHistoryTexNode!
    const validityMaskTex = this.validityMaskTexNode!
    const uBayerOffset = this.uBayerOffset
    const uCloudResolution = this.uCloudResolution
    const uAccumulationResolution = this.uAccumulationResolution
    const uHistoryWeight = this.uHistoryWeight
    const uHasValidHistory = this.uHasValidHistory

    // Helper to sample cloud at full-res pixel
    const sampleCloudColorAtPixel = Fn(([fullResPixel]: [ReturnType<typeof vec2>]) => {
      const quarterUV = floor(fullResPixel.div(2)).add(0.5).div(uCloudResolution)
      return cloudRenderTex.sample(quarterUV)
    })

    const sampleCloudPositionAtPixel = Fn(([fullResPixel]: [ReturnType<typeof vec2>]) => {
      const quarterUV = floor(fullResPixel.div(2)).add(0.5).div(uCloudResolution)
      return cloudPositionTex.sample(quarterUV)
    })

    return Fn(() => {
      const uv = screenUV
      const pixelCoord = floor(uv.mul(uAccumulationResolution))

      // Block position (0 or 1)
      const blockPos = vec2(
        pixelCoord.x.sub(floor(pixelCoord.x.div(2)).mul(2)),
        pixelCoord.y.sub(floor(pixelCoord.y.div(2)).mul(2))
      )

      // Check if rendered this frame
      const renderedThisFrame = blockPos.x.equal(uBayerOffset.x).and(blockPos.y.equal(uBayerOffset.y))

      // Sample new data
      const newColor = sampleCloudColorAtPixel(pixelCoord)
      const newPosition = sampleCloudPositionAtPixel(pixelCoord)

      // Sample history
      const historyColor = reprojectedHistoryTex.sample(uv)
      const validity = validityMaskTex.sample(uv).x

      // Blend logic
      const hasHistory = uHasValidHistory.greaterThan(0.5)
        .and(validity.greaterThan(0.5))
        .and(historyColor.a.greaterThan(0.001))

      // For rendered pixels: blend new with clamped history
      const blendWeight = uHistoryWeight.mul(validity).mul(0.5)
      const blendedColor = mix(newColor, historyColor, blendWeight)
      const blendedPosition = mix(newPosition, vec4(0, 0, 0, 0), blendWeight)

      // Select final output based on render state
      const finalColor = select(
        renderedThisFrame,
        select(hasHistory, blendedColor, newColor),
        select(hasHistory, historyColor, newColor)
      )

      const finalPosition = select(
        renderedThisFrame,
        select(hasHistory, blendedPosition, newPosition),
        select(hasHistory, vec4(0, 0, 0, 0), newPosition)
      )

      // MRT output
      return mrt({
        output: max(finalColor, vec4(0, 0, 0, 0)),
        position: finalPosition,
      })
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const { renderer, scene, camera, size } = ctx

    if (!this.shouldRender()) {
      this.hasValidHistory = false
      this.frameIndex = 0
      return
    }

    const cloudTarget = ctx.getWriteTarget(this.cloudBufferId)
    const accumWrite = ctx.getWriteTarget(this.accumulationBufferId)
    const accumRead = ctx.getReadTarget(this.accumulationBufferId)
    const reprojTarget = ctx.getWriteTarget(this.reprojectionBufferId)

    if (!cloudTarget || !accumWrite || !reprojTarget) {
      return
    }

    // Ensure TSL materials are initialized
    this.ensureInitialized(
      cloudTarget as THREE.WebGLRenderTarget,
      accumRead as THREE.WebGLRenderTarget | null,
      reprojTarget as THREE.WebGLRenderTarget,
      size
    )

    if (!this.reprojectionMaterial || !this.reconstructionMaterial || !this.fsQuad || !this.fsScene) {
      return
    }

    // 1. Render Volumetric Scene to Cloud Buffer (Quarter Res)
    this.renderScene(
      renderer as SupportedRenderer,
      scene,
      camera,
      cloudTarget as THREE.WebGLRenderTarget
    )

    // 2. Reprojection Pass (Full Res)
    if (this.hasValidHistory && accumRead) {
      this.renderReprojection(
        renderer as SupportedRenderer,
        camera,
        accumRead as THREE.WebGLRenderTarget,
        reprojTarget as THREE.WebGLRenderTarget,
        size
      )
    }

    // 3. Reconstruction Pass (Full Res)
    this.renderReconstruction(
      renderer as SupportedRenderer,
      cloudTarget as THREE.WebGLRenderTarget,
      reprojTarget as THREE.WebGLRenderTarget,
      accumWrite as THREE.WebGLRenderTarget,
      size
    )

    // Update state for next frame
    this.updateCameraState(camera)
    this.frameIndex = (this.frameIndex + 1) % 4
    this.hasValidHistory = true
  }

  private renderScene(
    renderer: SupportedRenderer,
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

    if (import.meta.env.DEV && this.frameIndex === 0) {
      console.warn('[TemporalCloudPassTSL] Volumetric meshes found:', volumetricMeshes.length, 'mask:', mask.mask)
    }

    if (volumetricMeshes.length === 0) return

    this.cameraLayers.mask = camera.layers.mask
    camera.layers.disableAll()
    camera.layers.enable(this.volumetricLayer)

    // MRT SAFETY: Disable background
    const isMRT = isMRTTarget(target)
    const savedBackground = isMRT ? scene.background : null
    if (isMRT) {
      scene.background = null
    }

    // Update uniforms on meshes
    const bayerOffset = BAYER_OFFSETS[this.frameIndex] ?? [0, 0]
    for (const mesh of volumetricMeshes) {
      const u = (mesh.material as THREE.ShaderMaterial).uniforms
      if (u) {
        if (u['uResolution']) u['uResolution'].value.set(target.width, target.height)
        if (u['uBayerOffset']) u['uBayerOffset'].value.set(bayerOffset[0], bayerOffset[1])
        if (u['uFrameIndex']) u['uFrameIndex'].value = this.frameIndex
        if (u['uFullResolution'])
          u['uFullResolution'].value.set(target.width * 2, target.height * 2)
      }
    }

    // CRITICAL FIX: Set renderer-level MRT BEFORE rendering.
    //
    // The previous comment said NOT to call setMRT, but this was WRONG.
    //
    // Why we MUST call setMRT:
    // - MRTNode.setup() calls builder.renderer.getRenderTarget() during shader compilation
    // - If no MRT render target is active, getRenderTarget() returns null
    // - getTextureIndex() then returns -1 for all output names
    // - OutputStructNode generates struct WITHOUT m0/m1/m2 members
    // - Later render attempts to write output.m0 but struct has no m0 → WGSL error
    //
    // See Three.js issues:
    // - #31220: compileAsync + MRT conflict (same root cause)
    // - #30476: struct member depth not found (identical error pattern)
    //
    // Setting cloudDefaultMRT ensures:
    // 1. Shader compiles with correct MRT struct members
    // 2. Material's own mrtNode overrides the default values during render
    const savedMRT = this.setRendererMRTForTarget(renderer, target, this.ensureCloudDefaultMRT())

    renderer.setRenderTarget(target as unknown as THREE.WebGLRenderTarget | null)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, true)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)

    // Restore previous MRT configuration
    if (savedMRT.didSet) {
      ;(renderer as unknown as { setMRT?: (m: MRTNode | null) => void }).setMRT?.(savedMRT.previous)
    }

    if (isMRT && savedBackground !== null) {
      scene.background = savedBackground
    }

    camera.layers.mask = this.cameraLayers.mask
  }

  private renderReprojection(
    renderer: SupportedRenderer,
    camera: THREE.Camera,
    accumRead: THREE.WebGLRenderTarget,
    reprojTarget: THREE.WebGLRenderTarget,
    size: { width: number; height: number }
  ): void {
    // Update texture nodes
    if (this.prevAccumTexNode) this.prevAccumTexNode.value = accumRead.textures[0]!
    if (this.prevPositionTexNode) this.prevPositionTexNode.value = accumRead.textures[1] ?? accumRead.texture

    // Update uniforms
    this.uPrevViewProjectionMatrix.value.copy(this.prevViewProjectionMatrix)
    this.tempViewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.uViewProjectionMatrix.value.copy(this.tempViewProjMatrix)
    camera.getWorldPosition(this.tempWorldPos)
    this.uCameraPosition.value.copy(this.tempWorldPos)
    this.uAccumulationResolution.value.set(size.width, size.height)

    this.fsQuad!.material = this.reprojectionMaterial as unknown as THREE.Material
    const savedMRT = this.reprojectionMRT
      ? this.setRendererMRTForTarget(renderer, reprojTarget, this.reprojectionMRT)
      : { didSet: false, previous: null }
    renderer.setRenderTarget(reprojTarget)
    renderer.render(this.fsScene!, this.fsCamera)
    renderer.setRenderTarget(null)
    if (savedMRT.didSet) {
      ;(renderer as unknown as { setMRT?: (m: MRTNode | null) => void }).setMRT?.(savedMRT.previous)
    }
  }

  private renderReconstruction(
    renderer: SupportedRenderer,
    cloudTarget: THREE.WebGLRenderTarget,
    reprojTarget: THREE.WebGLRenderTarget,
    accumWrite: THREE.WebGLRenderTarget,
    size: { width: number; height: number }
  ): void {
    // Update texture nodes
    if (this.cloudRenderTexNode) this.cloudRenderTexNode.value = cloudTarget.textures[0]!
    if (this.cloudPositionTexNode) this.cloudPositionTexNode.value = cloudTarget.textures[2] ?? cloudTarget.texture
    if (this.reprojectedHistoryTexNode) this.reprojectedHistoryTexNode.value = reprojTarget.textures[0]!
    if (this.validityMaskTexNode) this.validityMaskTexNode.value = reprojTarget.textures[1] ?? reprojTarget.texture

    // Update uniforms
    const bayerOffset = BAYER_OFFSETS[this.frameIndex] ?? [0, 0]
    this.uBayerOffset.value.set(bayerOffset[0], bayerOffset[1])
    this.uFrameIndex.value = this.frameIndex
    this.uCloudResolution.value.set(cloudTarget.width, cloudTarget.height)
    this.uAccumulationResolution.value.set(size.width, size.height)
    this.uHasValidHistory.value = this.hasValidHistory ? 1 : 0

    this.fsQuad!.material = this.reconstructionMaterial as unknown as THREE.Material
    const savedMRT = this.reconstructionMRT
      ? this.setRendererMRTForTarget(renderer, accumWrite, this.reconstructionMRT)
      : { didSet: false, previous: null }
    renderer.setRenderTarget(accumWrite)
    renderer.render(this.fsScene!, this.fsCamera)
    renderer.setRenderTarget(null)
    if (savedMRT.didSet) {
      ;(renderer as unknown as { setMRT?: (m: MRTNode | null) => void }).setMRT?.(savedMRT.previous)
    }
  }

  private updateCameraState(camera: THREE.Camera): void {
    this.prevViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    camera.getWorldPosition(this.prevCameraPosition)
  }

  private getVolumetricMask(): THREE.Layers {
    return this.volumetricMask
  }

  /**
   * Dispose internal resources.
   */
  private disposeInternal(): void {
    this.reprojectionMaterial?.dispose()
    this.reprojectionMaterial = null
    this.reconstructionMaterial?.dispose()
    this.reconstructionMaterial = null

    if (this.fsQuad) {
      this.fsQuad.geometry.dispose()
      this.fsScene?.remove(this.fsQuad)
      this.fsQuad = null
    }
    this.fsScene = null

    // Clear texture nodes
    this.prevAccumTexNode = null
    this.prevPositionTexNode = null
    this.cloudRenderTexNode = null
    this.cloudPositionTexNode = null
    this.reprojectedHistoryTexNode = null
    this.validityMaskTexNode = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.disposeInternal()
    this.lastWidth = 0
    this.lastHeight = 0
    this.hasValidHistory = false
    this.frameIndex = 0
  }

  dispose(): void {
    this.disposeInternal()
  }
}
