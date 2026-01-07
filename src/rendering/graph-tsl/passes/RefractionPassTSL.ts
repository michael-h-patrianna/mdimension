/**
 * Refraction Pass (TSL)
 *
 * Screen-space refraction effect using native TSL nodes.
 * Distorts the scene based on surface normals to simulate refraction.
 *
 * REWRITTEN: Now uses actual TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * @module rendering/graph-tsl/passes/RefractionPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  texture,
  uniform,
  screenUV,
  abs,
  length,
  cross,
  clamp,
  select,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for RefractionPassTSL.
 */
export interface RefractionPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Scene color input resource */
  colorInput: string
  /** Normal buffer input resource */
  normalInput: string
  /** Depth buffer input resource */
  depthInput: string
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth'
  /** Alternate depth input resource (optional) */
  alternateDepthInput?: string
  /** Alternate depth input attachment */
  alternateDepthInputAttachment?: number | 'depth'
  /** Optional selector for choosing depth input at runtime */
  depthInputSelector?: () => string
  /** Output resource */
  outputResource: string

  /** Index of refraction (1.0 = no refraction, 1.5 = glass) */
  ior?: number
  /** Refraction strength multiplier */
  strength?: number
  /** Chromatic aberration amount */
  chromaticAberration?: number
}

// =============================================================================
// TSL Helper Functions
// =============================================================================

/**
 * Get view-space position from UV and depth using inverse projection matrix
 */
const getViewPositionTSL = Fn(
  ([uv, depth, invProjMatrix]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    // Clip position
    const clipX = uv.x.mul(2).sub(1)
    const clipY = uv.y.mul(2).sub(1)
    const clipZ = depth.mul(2).sub(1)
    const clipPos = vec4(clipX, clipY, clipZ, float(1))

    // Manual matrix multiplication: invProjMatrix * clipPos
    const m = invProjMatrix
    const viewX = m.element(0).mul(clipPos.x).add(m.element(4).mul(clipPos.y))
      .add(m.element(8).mul(clipPos.z)).add(m.element(12).mul(clipPos.w))
    const viewY = m.element(1).mul(clipPos.x).add(m.element(5).mul(clipPos.y))
      .add(m.element(9).mul(clipPos.z)).add(m.element(13).mul(clipPos.w))
    const viewZ = m.element(2).mul(clipPos.x).add(m.element(6).mul(clipPos.y))
      .add(m.element(10).mul(clipPos.z)).add(m.element(14).mul(clipPos.w))
    const viewW = m.element(3).mul(clipPos.x).add(m.element(7).mul(clipPos.y))
      .add(m.element(11).mul(clipPos.z)).add(m.element(15).mul(clipPos.w))

    // Perspective divide with safe denominator
    const safeW = select(abs(viewW).lessThan(0.0001), float(0.0001), viewW)
    return vec3(viewX.div(safeW), viewY.div(safeW), viewZ.div(safeW))
  }
)

/**
 * Reconstruct normal from depth buffer using neighboring samples
 */
const reconstructNormalTSL = Fn(
  ([coord, depthTex, resolution, invProjMatrix]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof texture>,
    UniformNode<THREE.Vector2>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    const texel = vec2(float(1).div(resolution.x), float(1).div(resolution.y))

    // Sample depth at center and neighbors
    const depthC = depthTex.sample(coord).x
    const depthL = depthTex.sample(coord.sub(vec2(texel.x, float(0)))).x
    const depthR = depthTex.sample(coord.add(vec2(texel.x, float(0)))).x
    const depthB = depthTex.sample(coord.sub(vec2(float(0), texel.y))).x
    const depthT = depthTex.sample(coord.add(vec2(float(0), texel.y))).x

    // Get view positions
    const posC = getViewPositionTSL(coord, depthC, invProjMatrix)
    const posL = getViewPositionTSL(coord.sub(vec2(texel.x, float(0))), depthL, invProjMatrix)
    const posR = getViewPositionTSL(coord.add(vec2(texel.x, float(0))), depthR, invProjMatrix)
    const posB = getViewPositionTSL(coord.sub(vec2(float(0), texel.y)), depthB, invProjMatrix)
    const posT = getViewPositionTSL(coord.add(vec2(float(0), texel.y)), depthT, invProjMatrix)

    // Calculate tangent vectors using smaller difference
    const ddx = select(
      abs(posR.z.sub(posC.z)).lessThan(abs(posC.z.sub(posL.z))),
      posR.sub(posC),
      posC.sub(posL)
    )
    const ddy = select(
      abs(posT.z.sub(posC.z)).lessThan(abs(posC.z.sub(posB.z))),
      posT.sub(posC),
      posC.sub(posB)
    )

    // Cross product for normal
    const crossProd = cross(ddy, ddx)
    const crossLen = length(crossProd)
    const normal = select(
      crossLen.greaterThan(0.0001),
      crossProd.div(crossLen),
      vec3(0, 0, 1)
    )

    return normal
  }
)

/**
 * Get normal from G-buffer or reconstruct from depth
 */
const getNormalTSL = Fn(
  ([coord, normalTex, depthTex, resolution, invProjMatrix]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof texture>,
    ReturnType<typeof texture>,
    UniformNode<THREE.Vector2>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    const normalData = normalTex.sample(coord)
    const normalRgbLen = length(normalData.rgb)

    // Decode normal if valid
    const decoded = normalData.rgb.mul(2).sub(1)
    const decodedLen = length(decoded)
    const decodedNormal = select(
      decodedLen.greaterThan(0.0001),
      decoded.div(decodedLen),
      vec3(0, 0, 1)
    )

    // Use G-buffer normal if valid, otherwise reconstruct
    const reconstructed = reconstructNormalTSL(coord, depthTex, resolution, invProjMatrix)
    return select(normalRgbLen.greaterThan(0.01), decodedNormal, reconstructed)
  }
)

/**
 * Screen-space refraction pass using native TSL.
 *
 * @example
 * ```typescript
 * const refractionPass = new RefractionPassTSL({
 *   id: 'refraction',
 *   colorInput: 'sceneColor',
 *   normalInput: 'normalBuffer',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'refractedOutput',
 *   ior: 1.3,
 *   strength: 0.5,
 * });
 * ```
 */
export class RefractionPassTSL extends BasePassTSL {
  private colorInputId: string
  private normalInputId: string
  private depthInputId: string
  private depthInputAttachment?: number | 'depth'
  private alternateDepthInputId?: string
  private alternateDepthInputAttachment?: number | 'depth'
  private depthInputSelector?: () => string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Copy material for passthrough
  private copyMaterial: MeshBasicNodeMaterial | null = null
  private copyMesh: THREE.Mesh | null = null
  private copyScene: THREE.Scene | null = null
  private copyTexNode: ReturnType<typeof texture> | null = null

  // Texture nodes (stable references)
  private colorTexNode: ReturnType<typeof texture> | null = null
  private normalTexNode: ReturnType<typeof texture> | null = null
  private depthTexNode: ReturnType<typeof texture> | null = null

  // Uniforms
  private uIOR: UniformNode<number>
  private uStrength: UniformNode<number>
  private uChromaticAberration: UniformNode<number>
  private uResolution: UniformNode<THREE.Vector2>
  private uInvProjMatrix: UniformNode<THREE.Matrix4>

  // Cached values
  private currentIOR: number
  private currentStrength: number
  private currentChromaticAberration: number

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: RefractionPassTSLConfig) {
    const inputs = [
      { resourceId: config.colorInput, access: 'read' as const },
      { resourceId: config.normalInput, access: 'read' as const },
      {
        resourceId: config.depthInput,
        access: 'read' as const,
        attachment: config.depthInputAttachment,
      },
    ]

    if (config.alternateDepthInput && config.alternateDepthInput !== config.depthInput) {
      inputs.push({
        resourceId: config.alternateDepthInput,
        access: 'read' as const,
        attachment: config.alternateDepthInputAttachment,
      })
    }

    super({
      id: config.id,
      name: config.name ?? 'Refraction Pass (TSL)',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.normalInputId = config.normalInput
    this.depthInputId = config.depthInput
    this.depthInputAttachment = config.depthInputAttachment
    this.alternateDepthInputId = config.alternateDepthInput
    this.alternateDepthInputAttachment = config.alternateDepthInputAttachment
    this.depthInputSelector = config.depthInputSelector
    this.outputId = config.outputResource

    // Initialize uniforms
    this.currentIOR = config.ior ?? 1.3
    this.currentStrength = config.strength ?? 0.5
    this.currentChromaticAberration = config.chromaticAberration ?? 0.02

    this.uIOR = uniform(this.currentIOR)
    this.uStrength = uniform(this.currentStrength)
    this.uChromaticAberration = uniform(this.currentChromaticAberration)
    this.uResolution = uniform(new THREE.Vector2(1, 1))
    this.uInvProjMatrix = uniform(new THREE.Matrix4())

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize the TSL material
   */
  private ensureInitialized(
    width: number,
    height: number,
    colorTex: THREE.Texture,
    normalTex: THREE.Texture,
    depthTex: THREE.Texture
  ): void {
    const needsRecreate =
      !this.material ||
      width !== this.lastWidth ||
      height !== this.lastHeight

    if (needsRecreate) {
      this.disposeInternal()

      this.lastWidth = width
      this.lastHeight = height

      // Create texture nodes
      this.colorTexNode = texture(colorTex)
      this.normalTexNode = texture(normalTex)
      this.depthTexNode = texture(depthTex)

      // Build TSL shader
      const outputNode = this.buildRefractionShader()

      // Create material
      this.material = new MeshBasicNodeMaterial()
      this.material.outputNode = outputNode
      ;(this.material as unknown as THREE.Material).depthTest = false
      ;(this.material as unknown as THREE.Material).depthWrite = false

      // Create fullscreen quad
      const geometry = new THREE.PlaneGeometry(2, 2)
      this.mesh = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
      this.mesh.frustumCulled = false

      this.scene = new THREE.Scene()
      this.scene.add(this.mesh)

      // Create copy material for passthrough
      this.copyTexNode = texture(colorTex)
      this.copyMaterial = new MeshBasicNodeMaterial()
      this.copyMaterial.outputNode = this.copyTexNode
      ;(this.copyMaterial as unknown as THREE.Material).depthTest = false
      ;(this.copyMaterial as unknown as THREE.Material).depthWrite = false

      this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial as unknown as THREE.Material)
      this.copyMesh.frustumCulled = false
      this.copyScene = new THREE.Scene()
      this.copyScene.add(this.copyMesh)
    } else {
      // Update texture values
      if (this.colorTexNode) this.colorTexNode.value = colorTex
      if (this.normalTexNode) this.normalTexNode.value = normalTex
      if (this.depthTexNode) this.depthTexNode.value = depthTex
    }
  }

  /**
   * Build the refraction TSL shader
   */
  private buildRefractionShader() {
    const colorTex = this.colorTexNode!
    const normalTex = this.normalTexNode!
    const depthTex = this.depthTexNode!
    const resolution = this.uResolution
    const invProjMatrix = this.uInvProjMatrix
    const ior = this.uIOR
    const strength = this.uStrength
    const chromaticAberration = this.uChromaticAberration

    return Fn(() => {
      const uv = screenUV

      // Check if background (depth >= 0.9999)
      const depth = depthTex.sample(uv).x
      const isBackground = depth.greaterThanEqual(0.9999)
      const sceneColor = colorTex.sample(uv)

      // Get normal
      const normal = getNormalTSL(uv, normalTex, depthTex, resolution, invProjMatrix)
      const normalXY = normal.xy

      // IOR effect
      const iorEffect = ior.sub(1).mul(2)

      // Base offset
      const baseOffset = normalXY.mul(strength).mul(iorEffect)

      // Adjust for aspect ratio
      const aspectRatio = resolution.y.div(resolution.x)
      const offset = vec2(baseOffset.x.mul(aspectRatio), baseOffset.y)

      // Chromatic aberration
      const caOffset = chromaticAberration.mul(0.3)

      const offsetR = offset.mul(float(1).sub(caOffset))
      const offsetG = offset
      const offsetB = offset.mul(float(1).add(caOffset))

      const uvR = clamp(uv.add(offsetR), float(0), float(1))
      const uvG = clamp(uv.add(offsetG), float(0), float(1))
      const uvB = clamp(uv.add(offsetB), float(0), float(1))

      // Sample with chromatic aberration
      const r = colorTex.sample(uvR).r
      const g = colorTex.sample(uvG).g
      const b = colorTex.sample(uvB).b
      const refractedColor = vec4(r, g, b, float(1))

      // Return scene color if background, otherwise refracted
      return select(isBackground, sceneColor, refractedColor)
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { camera, size } = ctx

    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!colorTex || !outputTarget) {
      return
    }

    // Passthrough if camera is not perspective
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      this.copyToOutput(renderer, colorTex, outputTarget as unknown as THREE.WebGLRenderTarget | null)
      return
    }

    const normalTex = ctx.getReadTexture(this.normalInputId)
    const depthResourceId = this.depthInputSelector ? this.depthInputSelector() : this.depthInputId
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment)

    if (!normalTex || !depthTex) {
      this.copyToOutput(renderer, colorTex, outputTarget as unknown as THREE.WebGLRenderTarget | null)
      return
    }

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, colorTex, normalTex, depthTex)

    if (!this.material || !this.scene) {
      return
    }

    // Update uniforms
    this.uResolution.value.set(size.width, size.height)
    this.uInvProjMatrix.value.copy(camera.projectionMatrixInverse)

    // Render
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Copy input texture directly to output (passthrough)
   */
  private copyToOutput(
    renderer: SupportedRenderer,
    inputTex: THREE.Texture | null,
    outputTarget: THREE.WebGLRenderTarget | null
  ): void {
    if (!inputTex || !outputTarget) return

    if (!this.copyMaterial || !this.copyScene) {
      // Lazy init copy material
      this.copyTexNode = texture(inputTex)
      this.copyMaterial = new MeshBasicNodeMaterial()
      this.copyMaterial.outputNode = this.copyTexNode
      ;(this.copyMaterial as unknown as THREE.Material).depthTest = false
      ;(this.copyMaterial as unknown as THREE.Material).depthWrite = false

      this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial as unknown as THREE.Material)
      this.copyMesh.frustumCulled = false
      this.copyScene = new THREE.Scene()
      this.copyScene.add(this.copyMesh)
    } else if (this.copyTexNode) {
      this.copyTexNode.value = inputTex
    }

    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.copyScene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set index of refraction
   */
  setIOR(value: number): void {
    this.currentIOR = value
    this.uIOR.value = value
  }

  /**
   * Set refraction strength
   */
  setStrength(value: number): void {
    this.currentStrength = value
    this.uStrength.value = value
  }

  /**
   * Set chromatic aberration
   */
  setChromaticAberration(value: number): void {
    this.currentChromaticAberration = value
    this.uChromaticAberration.value = value
  }

  /**
   * Dispose internal resources
   */
  private disposeInternal(): void {
    this.material?.dispose()
    this.material = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }
    this.scene = null

    this.copyMaterial?.dispose()
    this.copyMaterial = null

    if (this.copyMesh) {
      this.copyMesh.geometry.dispose()
      this.copyScene?.remove(this.copyMesh)
      this.copyMesh = null
    }
    this.copyScene = null

    this.colorTexNode = null
    this.normalTexNode = null
    this.depthTexNode = null
    this.copyTexNode = null
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.disposeInternal()
    this.lastWidth = 0
    this.lastHeight = 0
  }

  dispose(): void {
    this.disposeInternal()
  }
}
