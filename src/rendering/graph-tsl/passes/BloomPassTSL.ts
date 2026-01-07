/**
 * Bloom Pass (TSL)
 *
 * Multi-pass HDR bloom effect implemented in TSL.
 * Uses luminance thresholding, multi-resolution gaussian blur,
 * and additive compositing for the bloom glow effect.
 *
 * HDR-Aware: Normalizes luminance by hdrPeak before thresholding,
 * making threshold and smoothing parameters intuitive with HDR content.
 *
 * TSL port of the WebGL BloomPass with identical visual behavior.
 *
 * Architecture:
 * 1. ThresholdPass: Extracts bright areas based on luminance
 * 2. BlurPasses: Multi-resolution gaussian blur (5 levels)
 * 3. CompositePass: Additively blends blur levels with original
 *
 * @module rendering/graph-tsl/passes/BloomPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  texture,
  uniform,
  screenUV,
  vec2,
  vec3,
  vec4,
  dot,
  smoothstep,
} from 'three/tsl'
import type { UniformNode } from 'three/tsl'

import type { RenderPassConfig } from '@/rendering/graph/types'
import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Configuration for BloomPassTSL.
 */
export interface BloomPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input resource to apply bloom to */
  inputResource: string
  /** Output resource */
  outputResource: string
  /** Bloom strength (default: 0.5) */
  strength?: number
  /** Bloom radius - affects blur spread (default: 0.4) */
  radius?: number
  /** Luminance threshold for bloom, normalized 0-1 (default: 0.8) */
  threshold?: number
  /** Luminance smoothing - softens threshold transition (default: 0.1) */
  smoothing?: number
  /** Number of blur levels to use 1-5 (default: 5) */
  levels?: number
  /** HDR peak luminance for normalization (default: 5.0) */
  hdrPeak?: number
}

/**
 * Renderer interface for type safety.
 */
interface RendererWithMethods {
  autoClear: boolean
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
  getClearColor(target: THREE.Color): THREE.Color
  getClearAlpha(): number
  setClearColor(color: THREE.Color, alpha: number): void
  clear(color?: boolean, depth?: boolean, stencil?: boolean): void
}

// Number of MIP levels for blur
const NUM_MIPS = 5

// Gaussian blur kernel weights (13-tap)
const BLUR_KERNEL_WEIGHTS = [
  0.0044299121, 0.0162674, 0.0395223, 0.0697106, 0.0893189, 0.0957076, 0.0893189, 0.0697106,
  0.0395223, 0.0162674, 0.0044299121,
]

/**
 * Create threshold extraction node.
 * Extracts pixels above luminance threshold.
 */
const createThresholdNode = (
  texNode: ReturnType<typeof texture>,
  uThreshold: UniformNode<number>,
  uSmoothing: UniformNode<number>,
  uHdrPeak: UniformNode<number>
) => {
  return Fn(() => {
    const uv = screenUV
    const color = texNode.sample(uv)

    // Calculate luminance (Rec. 709)
    const luminance = dot(color.xyz, vec3(0.2126, 0.7152, 0.0722))

    // Normalize by HDR peak for intuitive thresholding
    const normalizedLum = luminance.div(uHdrPeak)

    // Smooth threshold with smoothstep
    const alpha = smoothstep(uThreshold, uThreshold.add(uSmoothing), normalizedLum)

    // Output: original color modulated by threshold alpha
    return vec4(color.xyz.mul(alpha), alpha)
  })()
}

/**
 * Create horizontal gaussian blur node.
 */
const createHorizontalBlurNode = (
  texNode: ReturnType<typeof texture>,
  uResolution: UniformNode<THREE.Vector2>,
  uRadius: UniformNode<number>
) => {
  return Fn(() => {
    const uv = screenUV
    const pixelSize = vec2(uResolution.x.mul(uRadius), float(0))

    // Accumulate weighted samples
    let result = texNode.sample(uv).mul(BLUR_KERNEL_WEIGHTS[5]!)

    for (let i = 1; i <= 5; i++) {
      const offset = pixelSize.mul(float(i))
      const weight = BLUR_KERNEL_WEIGHTS[5 + i]!
      result = result.add(texNode.sample(uv.add(offset)).mul(weight))
      result = result.add(texNode.sample(uv.sub(offset)).mul(weight))
    }

    return result
  })()
}

/**
 * Create vertical gaussian blur node.
 */
const createVerticalBlurNode = (
  texNode: ReturnType<typeof texture>,
  uResolution: UniformNode<THREE.Vector2>,
  uRadius: UniformNode<number>
) => {
  return Fn(() => {
    const uv = screenUV
    const pixelSize = vec2(float(0), uResolution.y.mul(uRadius))

    // Accumulate weighted samples
    let result = texNode.sample(uv).mul(BLUR_KERNEL_WEIGHTS[5]!)

    for (let i = 1; i <= 5; i++) {
      const offset = pixelSize.mul(float(i))
      const weight = BLUR_KERNEL_WEIGHTS[5 + i]!
      result = result.add(texNode.sample(uv.add(offset)).mul(weight))
      result = result.add(texNode.sample(uv.sub(offset)).mul(weight))
    }

    return result
  })()
}

/**
 * Create bloom composite node.
 * Combines original image with blurred bloom levels.
 */
const createCompositeNode = (
  originalTex: ReturnType<typeof texture>,
  bloomTextures: ReturnType<typeof texture>[],
  uStrength: UniformNode<number>,
  uBloomFactors: UniformNode<THREE.Vector4>,
  uBloomFactor5: UniformNode<number>
) => {
  return Fn(() => {
    const uv = screenUV
    const original = originalTex.sample(uv)

    // Accumulate bloom from all levels with respective factors
    let bloom = vec3(0, 0, 0)

    if (bloomTextures.length >= 1) {
      bloom = bloom.add(bloomTextures[0]!.sample(uv).xyz.mul(uBloomFactors.x))
    }
    if (bloomTextures.length >= 2) {
      bloom = bloom.add(bloomTextures[1]!.sample(uv).xyz.mul(uBloomFactors.y))
    }
    if (bloomTextures.length >= 3) {
      bloom = bloom.add(bloomTextures[2]!.sample(uv).xyz.mul(uBloomFactors.z))
    }
    if (bloomTextures.length >= 4) {
      bloom = bloom.add(bloomTextures[3]!.sample(uv).xyz.mul(uBloomFactors.w))
    }
    if (bloomTextures.length >= 5) {
      bloom = bloom.add(bloomTextures[4]!.sample(uv).xyz.mul(uBloomFactor5))
    }

    // Apply bloom strength and add to original
    const finalColor = original.xyz.add(bloom.mul(uStrength))

    return vec4(finalColor.x, finalColor.y, finalColor.z, original.w)
  })()
}

/**
 * HDR-aware bloom effect pass.
 *
 * Implements multi-resolution gaussian bloom with luminance thresholding.
 * Uses 5 MIP levels for wide bloom spread while maintaining detail.
 *
 * @example
 * ```typescript
 * const bloom = new BloomPassTSL({
 *   id: 'bloom',
 *   inputResource: 'sceneColor',
 *   outputResource: 'bloomedColor',
 *   strength: 1.5,
 *   radius: 0.4,
 *   threshold: 0.8,
 * });
 *
 * graph.addPass(bloom);
 * ```
 */
export class BloomPassTSL extends BasePassTSL {
  private inputResourceId: string
  private outputResourceId: string

  // Bloom parameters
  private strength: number
  private radius: number
  private threshold: number
  private smoothing: number
  private levels: number
  private hdrPeak: number

  // TSL uniforms
  private uThreshold: UniformNode<number>
  private uSmoothing: UniformNode<number>
  private uHdrPeak: UniformNode<number>
  private uStrength: UniformNode<number>
  private uRadius: UniformNode<number>
  private uResolutions: UniformNode<THREE.Vector2>[] = []
  private uBloomFactors: UniformNode<THREE.Vector4>
  private uBloomFactor5: UniformNode<number>

  // Internal render targets for multi-pass
  private thresholdTarget: THREE.WebGLRenderTarget | null = null
  private blurTargetsH: THREE.WebGLRenderTarget[] = []
  private blurTargetsV: THREE.WebGLRenderTarget[] = []

  // Materials and rendering resources
  private thresholdMaterial: MeshBasicNodeMaterial | null = null
  private blurMaterialsH: MeshBasicNodeMaterial[] = []
  private blurMaterialsV: MeshBasicNodeMaterial[] = []
  private compositeMaterial: MeshBasicNodeMaterial | null = null

  // Rendering resources
  private quadMesh: THREE.Mesh
  private renderScene: THREE.Scene
  private renderCamera: THREE.OrthographicCamera

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  // Stable TextureNodes for WebGPU compatibility (MKB-002)
  // CRITICAL: Create once with placeholder, update .value at runtime
  private inputTexNode: ReturnType<typeof texture> | null = null
  private blurTexNodesH: ReturnType<typeof texture>[] = []
  private blurTexNodesV: ReturnType<typeof texture>[] = []
  private compositeOriginalTexNode: ReturnType<typeof texture> | null = null
  private compositeBloomTexNodes: ReturnType<typeof texture>[] = []
  private placeholderTexture: THREE.DataTexture | null = null

  constructor(config: BloomPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Bloom Pass',
      inputs: [{ resourceId: config.inputResource, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.inputResourceId = config.inputResource
    this.outputResourceId = config.outputResource
    this.strength = config.strength ?? 0.5
    this.radius = config.radius ?? 0.4
    this.threshold = config.threshold ?? 0.8
    this.smoothing = config.smoothing ?? 0.1
    this.levels = config.levels ?? 5
    this.hdrPeak = config.hdrPeak ?? 5.0

    // Initialize uniforms
    this.uThreshold = uniform(this.threshold)
    this.uSmoothing = uniform(this.smoothing)
    this.uHdrPeak = uniform(this.hdrPeak)
    this.uStrength = uniform(this.strength)
    this.uRadius = uniform(this.radius)
    this.uBloomFactors = uniform(new THREE.Vector4(1.0, 0.8, 0.6, 0.4))
    this.uBloomFactor5 = uniform(0.2)

    // Create resolution uniforms for each MIP level
    for (let i = 0; i < NUM_MIPS; i++) {
      this.uResolutions.push(uniform(new THREE.Vector2(1 / 1920, 1 / 1080)))
    }

    // Create placeholder texture for stable TextureNode binding (WebGPU compatibility)
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderTexture.minFilter = THREE.LinearFilter
    this.placeholderTexture.magFilter = THREE.LinearFilter
    this.placeholderTexture.needsUpdate = true

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.quadMesh = new THREE.Mesh(geometry)
    this.quadMesh.frustumCulled = false

    this.renderScene = new THREE.Scene()
    this.renderScene.add(this.quadMesh)

    this.renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Ensure render targets are initialized with correct size.
   */
  private ensureTargets(width: number, height: number): void {
    if (width === this.lastWidth && height === this.lastHeight) {
      return
    }

    // Dispose old targets
    this.disposeTargets()

    // Create threshold target at full resolution
    this.thresholdTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    })

    // Create blur targets at progressively smaller resolutions
    let mipWidth = Math.floor(width / 2)
    let mipHeight = Math.floor(height / 2)

    for (let i = 0; i < NUM_MIPS; i++) {
      const targetH = new THREE.WebGLRenderTarget(mipWidth, mipHeight, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      })
      this.blurTargetsH.push(targetH)

      const targetV = new THREE.WebGLRenderTarget(mipWidth, mipHeight, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      })
      this.blurTargetsV.push(targetV)

      // Update resolution uniform for this MIP level
      this.uResolutions[i]!.value.set(1 / mipWidth, 1 / mipHeight)

      mipWidth = Math.max(1, Math.floor(mipWidth / 2))
      mipHeight = Math.max(1, Math.floor(mipHeight / 2))
    }

    this.lastWidth = width
    this.lastHeight = height

    // NOTE: Do NOT dispose materials on resize - use stable TextureNodes
    // The texture .value will be updated in updateTextureBindings()
    // This is critical for WebGPU pipeline stability
  }

  /**
   * Dispose render targets.
   */
  private disposeTargets(): void {
    this.thresholdTarget?.dispose()
    this.thresholdTarget = null

    for (const target of this.blurTargetsH) {
      target.dispose()
    }
    this.blurTargetsH = []

    for (const target of this.blurTargetsV) {
      target.dispose()
    }
    this.blurTargetsV = []
  }

  /**
   * Dispose materials.
   */
  private disposeMaterials(): void {
    this.thresholdMaterial?.dispose()
    this.thresholdMaterial = null

    for (const mat of this.blurMaterialsH) {
      mat.dispose()
    }
    this.blurMaterialsH = []

    for (const mat of this.blurMaterialsV) {
      mat.dispose()
    }
    this.blurMaterialsV = []

    this.compositeMaterial?.dispose()
    this.compositeMaterial = null

    // Also clear texture node references (they need to be recreated with materials)
    this.inputTexNode = null
    this.blurTexNodesH = []
    this.blurTexNodesV = []
    this.compositeOriginalTexNode = null
    this.compositeBloomTexNodes = []
  }

  /**
   * Create or update materials.
   *
   * CRITICAL for WebGPU: Uses stable TextureNodes created ONCE with placeholder.
   * Updates texture .value at runtime instead of recreating nodes.
   * Pattern matches SSRPassTSL for WebGPU compatibility.
   */
  private ensureMaterials(): void {
    if (!this.placeholderTexture) return

    // Create threshold material with stable TextureNode
    if (!this.thresholdMaterial) {
      // Create stable TextureNode ONCE with placeholder
      this.inputTexNode = texture(this.placeholderTexture)

      const outputNode = createThresholdNode(
        this.inputTexNode,
        this.uThreshold,
        this.uSmoothing,
        this.uHdrPeak
      )

      this.thresholdMaterial = new MeshBasicNodeMaterial()
      this.thresholdMaterial.outputNode = outputNode
      ;(this.thresholdMaterial as unknown as { depthTest: boolean }).depthTest = false
      this.thresholdMaterial.depthWrite = false
    }

    // Create blur materials for each MIP level with stable TextureNodes
    if (this.blurMaterialsH.length === 0) {
      for (let i = 0; i < NUM_MIPS; i++) {
        // Horizontal blur - create stable TextureNode
        const texNodeH = texture(this.placeholderTexture)
        this.blurTexNodesH.push(texNodeH)
        const blurNodeH = createHorizontalBlurNode(texNodeH, this.uResolutions[i]!, this.uRadius)

        const matH = new MeshBasicNodeMaterial()
        matH.outputNode = blurNodeH
        ;(matH as unknown as { depthTest: boolean }).depthTest = false
        matH.depthWrite = false
        this.blurMaterialsH.push(matH)

        // Vertical blur - create stable TextureNode
        const texNodeV = texture(this.placeholderTexture)
        this.blurTexNodesV.push(texNodeV)
        const blurNodeV = createVerticalBlurNode(texNodeV, this.uResolutions[i]!, this.uRadius)

        const matV = new MeshBasicNodeMaterial()
        matV.outputNode = blurNodeV
        ;(matV as unknown as { depthTest: boolean }).depthTest = false
        matV.depthWrite = false
        this.blurMaterialsV.push(matV)
      }
    }

    // Create composite material with stable TextureNodes
    if (!this.compositeMaterial) {
      // Create stable TextureNode for original
      this.compositeOriginalTexNode = texture(this.placeholderTexture)

      // Create stable TextureNodes for each bloom level
      this.compositeBloomTexNodes = []
      for (let i = 0; i < NUM_MIPS; i++) {
        this.compositeBloomTexNodes.push(texture(this.placeholderTexture))
      }

      const outputNode = createCompositeNode(
        this.compositeOriginalTexNode,
        this.compositeBloomTexNodes,
        this.uStrength,
        this.uBloomFactors,
        this.uBloomFactor5
      )

      this.compositeMaterial = new MeshBasicNodeMaterial()
      this.compositeMaterial.outputNode = outputNode
      ;(this.compositeMaterial as unknown as { depthTest: boolean }).depthTest = false
      this.compositeMaterial.depthWrite = false
    }
  }

  /**
   * Update texture node values with actual textures.
   * Called each frame to bind the correct textures.
   */
  private updateTextureBindings(inputTexture: THREE.Texture): void {
    // Update input texture node for threshold pass
    if (this.inputTexNode) {
      ;(this.inputTexNode as unknown as { value: THREE.Texture }).value = inputTexture
    }

    // Update blur texture nodes for horizontal blur (source is threshold or previous V blur)
    for (let i = 0; i < NUM_MIPS; i++) {
      if (this.blurTexNodesH[i]) {
        const sourceTex =
          i === 0
            ? this.thresholdTarget?.texture
            : this.blurTargetsV[i - 1]?.texture
        if (sourceTex) {
          ;(this.blurTexNodesH[i] as unknown as { value: THREE.Texture }).value = sourceTex
        }
      }

      // Update blur texture nodes for vertical blur (source is horizontal blur output)
      if (this.blurTexNodesV[i] && this.blurTargetsH[i]) {
        ;(this.blurTexNodesV[i] as unknown as { value: THREE.Texture }).value =
          this.blurTargetsH[i]!.texture
      }
    }

    // Update composite texture nodes
    if (this.compositeOriginalTexNode) {
      ;(this.compositeOriginalTexNode as unknown as { value: THREE.Texture }).value = inputTexture
    }

    // Update bloom texture nodes for composite
    for (let i = 0; i < NUM_MIPS; i++) {
      if (this.compositeBloomTexNodes[i] && this.blurTargetsV[i]) {
        ;(this.compositeBloomTexNodes[i] as unknown as { value: THREE.Texture }).value =
          this.blurTargetsV[i]!.texture
      }
    }
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as unknown as RendererWithMethods
    const { size } = ctx

    // Skip if size is invalid
    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get input texture
    const inputTexture = ctx.getReadTexture(this.inputResourceId)
    if (!inputTexture) {
      console.warn(`BloomPassTSL: Input texture '${this.inputResourceId}' not found`)
      return
    }

    // Get output target
    const outputTarget = ctx.getWriteTarget(this.outputResourceId)

    // Ensure render targets exist
    this.ensureTargets(size.width, size.height)

    // Ensure materials exist (creates stable TextureNodes once)
    this.ensureMaterials()

    // Update texture bindings (critical for WebGPU - updates .value not nodes)
    this.updateTextureBindings(inputTexture)

    // Update uniforms
    this.uThreshold.value = this.threshold
    this.uSmoothing.value = this.smoothing
    this.uHdrPeak.value = this.hdrPeak
    this.uStrength.value = this.strength
    this.uRadius.value = this.radius

    // Update bloom factors based on levels
    const levelScale = this.levels / 5
    const factors = [1.0, 0.8, 0.6, 0.4, 0.2].map((f, i) => {
      const mipScale = i < this.levels ? 1.0 : 0.0
      return f * mipScale * (i === 0 ? 1.0 : levelScale)
    })
    this.uBloomFactors.value.set(factors[0]!, factors[1]!, factors[2]!, factors[3]!)
    this.uBloomFactor5.value = factors[4]!

    // Save renderer state
    const savedAutoClear = renderer.autoClear
    renderer.autoClear = false

    // 1. Threshold pass - extract bright areas
    this.quadMesh.material = this.thresholdMaterial! as unknown as THREE.Material
    renderer.setRenderTarget(this.thresholdTarget!)
    renderer.clear(true, true, false)
    renderer.render(this.renderScene, this.renderCamera)

    // 2. Multi-resolution blur passes
    for (let i = 0; i < NUM_MIPS; i++) {
      // Horizontal blur
      this.quadMesh.material = this.blurMaterialsH[i]! as unknown as THREE.Material
      renderer.setRenderTarget(this.blurTargetsH[i]!)
      renderer.clear(true, true, false)
      renderer.render(this.renderScene, this.renderCamera)

      // Vertical blur
      this.quadMesh.material = this.blurMaterialsV[i]! as unknown as THREE.Material
      renderer.setRenderTarget(this.blurTargetsV[i]!)
      renderer.clear(true, true, false)
      renderer.render(this.renderScene, this.renderCamera)
    }

    // 3. Composite pass - combine original with bloom
    this.quadMesh.material = this.compositeMaterial! as unknown as THREE.Material
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.clear(true, true, false)
    renderer.render(this.renderScene, this.renderCamera)

    // Restore renderer state
    renderer.autoClear = savedAutoClear
    renderer.setRenderTarget(null)
  }

  /**
   * Set bloom strength.
   */
  setStrength(strength: number): void {
    this.strength = strength
  }

  /**
   * Set bloom radius.
   */
  setRadius(radius: number): void {
    this.radius = radius
  }

  /**
   * Set luminance threshold.
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold
  }

  /**
   * Set luminance smoothing.
   */
  setSmoothing(smoothing: number): void {
    this.smoothing = smoothing
  }

  /**
   * Set number of blur levels (1-5).
   */
  setLevels(levels: number): void {
    this.levels = Math.max(1, Math.min(5, Math.round(levels)))
  }

  /**
   * Set HDR peak luminance.
   */
  setHdrPeak(hdrPeak: number): void {
    this.hdrPeak = Math.max(1.0, hdrPeak)
  }

  /**
   * Get current bloom parameters.
   */
  getParameters(): {
    strength: number
    radius: number
    threshold: number
    smoothing: number
    levels: number
    hdrPeak: number
  } {
    return {
      strength: this.strength,
      radius: this.radius,
      threshold: this.threshold,
      smoothing: this.smoothing,
      levels: this.levels,
      hdrPeak: this.hdrPeak,
    }
  }

  /**
   * Release internal GPU resources.
   */
  releaseInternalResources(): void {
    this.disposeTargets()
    this.disposeMaterials()
    this.lastWidth = 0
    this.lastHeight = 0
  }

  dispose(): void {
    this.disposeTargets()
    this.disposeMaterials()
    this.quadMesh.geometry.dispose()
    this.renderScene.remove(this.quadMesh)

    // Dispose placeholder texture
    if (this.placeholderTexture) {
      this.placeholderTexture.dispose()
      this.placeholderTexture = null
    }
  }
}
