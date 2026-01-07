/**
 * Bokeh Pass (TSL)
 *
 * Render graph pass for depth-of-field blur effect.
 * Uses depth buffer to blur out-of-focus areas.
 *
 * REWRITTEN: Now uses actual TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * Features:
 * - Disc blur: 17 samples in circular pattern
 * - Jittered blur: Randomized samples for smoother result
 * - Separable blur: Horizontal + vertical Gaussian (efficient)
 * - Hexagonal blur: Cinematic bokeh with ring-based sampling
 *
 * @module rendering/graph-tsl/passes/BokehPassTSL
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
  abs,
  max,
  clamp,
  cos,
  sin,
  fract,
  dot,
  Loop,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer, SupportedRenderTarget } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for BokehPassTSL.
 */
export interface BokehPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Scene color input resource */
  colorInput: string
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

  /** Focus distance in world units */
  focus?: number
  /** Focus range (depth of focus area) */
  focusRange?: number
  /** Aperture size (affects blur intensity) */
  aperture?: number
  /** Maximum blur amount */
  maxBlur?: number
  /** Blur method: 0=disc, 1=jittered, 2=separable, 3=hexagonal */
  blurMethod?: number
}

// =============================================================================
// TSL Bokeh Blur Functions
// =============================================================================

/**
 * Simple hash function for pseudo-random values
 */
const hashTSL = Fn(([co]: [ReturnType<typeof vec2>]) => {
  return fract(sin(dot(co, vec2(12.9898, 78.233))).mul(43758.5453))
})

/**
 * Convert perspective depth to linear view Z
 * Equivalent to perspectiveDepthToViewZ from Three.js packing
 */
const perspectiveDepthToViewZ = Fn(
  ([depth, near, far]: [ReturnType<typeof float>, ReturnType<typeof float>, ReturnType<typeof float>]) => {
    // viewZ = near * far / (far - depth * (far - near))
    const denom = far.sub(depth.mul(far.sub(near)))
    const safeDenom = max(denom, float(0.0001))
    return near.mul(far).div(safeDenom).negate()
  }
)

/**
 * Disc blur - 17 samples in circular pattern (unrolled for performance)
 */
const discBlurTSL = Fn(
  ([tex, uv, blur]: [
    ReturnType<typeof texture>,
    ReturnType<typeof vec2>,
    ReturnType<typeof vec2>,
  ]) => {
    const col = vec4(0, 0, 0, 0).toVar('discCol')

    // Center
    col.addAssign(tex.sample(uv))
    // Ring samples - pre-computed positions
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.0, 0.4)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.15, 0.37)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.29, 0.29)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.37, 0.15)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.4, 0.0)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.37, -0.15)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.29, -0.29)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.15, -0.37)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.0, -0.4)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.15, 0.37)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.29, 0.29)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.37, 0.15)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.4, 0.0)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.37, -0.15)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(-0.29, -0.29)))))
    col.addAssign(tex.sample(uv.add(blur.mul(vec2(0.15, -0.37)))))

    return col.div(17.0)
  }
)

/**
 * Jittered blur - 25 samples with random offset (5x5 grid)
 */
const jitteredBlurTSL = Fn(
  ([tex, uv, blur, time]: [
    ReturnType<typeof texture>,
    ReturnType<typeof vec2>,
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
  ]) => {
    const col = vec4(0, 0, 0, 0).toVar('jitCol')
    const total = float(0).toVar('jitTotal')

    // 5x5 grid (-2 to 2)
    Loop(5, ({ i }) => {
      const x = float(i).sub(2)
      Loop(5, ({ i: j }) => {
        const y = float(j).sub(2)
        const offset = vec2(x, y).div(2.0).toVar('jitOffset')

        // Add jitter based on position
        const jitterSeed = uv.add(vec2(x, y))
        const jitterX = hashTSL(jitterSeed).mul(0.5).sub(0.25)
        const jitterY = hashTSL(jitterSeed.add(time)).mul(0.5).sub(0.25)
        offset.addAssign(vec2(jitterX, jitterY))

        // Gaussian-like weight
        const len = float(x.mul(x).add(y.mul(y))).sqrt()
        const weight = max(float(1).sub(len.mul(0.3)), float(0))

        col.addAssign(tex.sample(uv.add(blur.mul(offset))).mul(weight))
        total.addAssign(weight)
      })
    })

    return col.div(max(total, float(0.0001)))
  }
)

/**
 * Separable blur - 9-tap Gaussian (horizontal + vertical)
 */
const separableBlurTSL = Fn(
  ([tex, uv, blur]: [
    ReturnType<typeof texture>,
    ReturnType<typeof vec2>,
    ReturnType<typeof vec2>,
  ]) => {
    const col = vec4(0, 0, 0, 0).toVar('sepCol')
    const total = float(0).toVar('sepTotal')

    // Gaussian weights
    const w0 = float(0.227027)
    const w1 = float(0.1945946)
    const w2 = float(0.1216216)
    const w3 = float(0.054054)
    const w4 = float(0.016216)

    // Horizontal samples (unrolled for stability)
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(-1.0), 0))).mul(w4))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(-0.75), 0))).mul(w3))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(-0.5), 0))).mul(w2))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(-0.25), 0))).mul(w1))
    col.addAssign(tex.sample(uv).mul(w0))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(0.25), 0))).mul(w1))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(0.5), 0))).mul(w2))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(0.75), 0))).mul(w3))
    col.addAssign(tex.sample(uv.add(vec2(blur.x.mul(1.0), 0))).mul(w4))
    total.addAssign(w0.add(w1.mul(2)).add(w2.mul(2)).add(w3.mul(2)).add(w4.mul(2)))

    // Vertical samples
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(-1.0)))).mul(w4))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(-0.75)))).mul(w3))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(-0.5)))).mul(w2))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(-0.25)))).mul(w1))
    col.addAssign(tex.sample(uv).mul(w0))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(0.25)))).mul(w1))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(0.5)))).mul(w2))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(0.75)))).mul(w3))
    col.addAssign(tex.sample(uv.add(vec2(0, blur.y.mul(1.0)))).mul(w4))
    total.addAssign(w0.add(w1.mul(2)).add(w2.mul(2)).add(w3.mul(2)).add(w4.mul(2)))

    return col.div(max(total, float(0.0001)))
  }
)

/**
 * Hexagonal blur - cinematic bokeh with ring-based sampling
 */
const hexagonalBlurTSL = Fn(
  ([tex, uv, blur]: [
    ReturnType<typeof texture>,
    ReturnType<typeof vec2>,
    ReturnType<typeof vec2>,
  ]) => {
    const col = vec4(0, 0, 0, 0).toVar('hexCol')
    const total = float(0).toVar('hexTotal')

    // Ring 0: center (weight 1.0)
    col.addAssign(tex.sample(uv).mul(1.0))
    total.addAssign(1.0)

    // Ring 1: 6 samples at r=0.33 (weight 0.9)
    const r1 = float(0.33)
    Loop(6, ({ i }) => {
      const angle = float(i).mul(1.0472) // 60 degrees = PI/3
      const offset = vec2(cos(angle), sin(angle)).mul(r1)
      col.addAssign(tex.sample(uv.add(blur.mul(offset))).mul(0.9))
      total.addAssign(0.9)
    })

    // Ring 2: 12 samples at r=0.67 (weight 0.7)
    const r2 = float(0.67)
    Loop(12, ({ i }) => {
      const angle = float(i).mul(0.5236) // 30 degrees = PI/6
      const offset = vec2(cos(angle), sin(angle)).mul(r2)
      col.addAssign(tex.sample(uv.add(blur.mul(offset))).mul(0.7))
      total.addAssign(0.7)
    })

    // Ring 3: 18 samples at r=1.0 (weight 0.5)
    const r3 = float(1.0)
    Loop(18, ({ i }) => {
      const angle = float(i).mul(0.349) // ~20 degrees
      const offset = vec2(cos(angle), sin(angle)).mul(r3)
      col.addAssign(tex.sample(uv.add(blur.mul(offset))).mul(0.5))
      total.addAssign(0.5)
    })

    return col.div(max(total, float(0.0001)))
  }
)

// =============================================================================
// Main Pass Implementation
// =============================================================================

/**
 * Depth of field pass using bokeh blur.
 *
 * @example
 * ```typescript
 * const bokehPass = new BokehPassTSL({
 *   id: 'bokeh',
 *   colorInput: 'sceneColor',
 *   depthInput: 'objectDepth',
 *   outputResource: 'bokehOutput',
 *   focus: 5,
 *   focusRange: 3,
 *   aperture: 0.025,
 * });
 * ```
 */
export class BokehPassTSL extends BasePassTSL {
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  // Copy material for passthrough
  private copyMaterial: MeshBasicNodeMaterial | null = null
  private copyMesh: THREE.Mesh
  private copyScene: THREE.Scene

  private colorInputId: string
  private depthInputId: string
  private depthInputAttachment?: number | 'depth'
  private alternateDepthInputId?: string
  private alternateDepthInputAttachment?: number | 'depth'
  private depthInputSelector?: () => string
  private outputId: string

  // TSL Uniforms
  private uFocus: UniformNode<number>
  private uFocusRange: UniformNode<number>
  private uAperture: UniformNode<number>
  private uMaxBlur: UniformNode<number>
  private uNearClip: UniformNode<number>
  private uFarClip: UniformNode<number>
  private uAspect: UniformNode<number>
  private uBlurMethod: UniformNode<number>
  private uTime: UniformNode<number>

  // Placeholder textures for stable binding
  private placeholderColor: THREE.DataTexture
  private placeholderDepth: THREE.DataTexture
  private colorTextureNode: ReturnType<typeof texture> | null = null
  private depthTextureNode: ReturnType<typeof texture> | null = null

  // Current parameters
  private _focus: number
  private _focusRange: number
  private _aperture: number
  private _maxBlur: number
  private _blurMethod: number

  constructor(config: BokehPassTSLConfig) {
    const inputs = [
      { resourceId: config.colorInput, access: 'read' as const },
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
      name: config.name ?? 'Bokeh Pass (TSL)',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.depthInputId = config.depthInput
    this.depthInputAttachment = config.depthInputAttachment
    this.alternateDepthInputId = config.alternateDepthInput
    this.alternateDepthInputAttachment = config.alternateDepthInputAttachment
    this.depthInputSelector = config.depthInputSelector
    this.outputId = config.outputResource

    // Store parameters
    this._focus = config.focus ?? 5
    this._focusRange = config.focusRange ?? 3
    this._aperture = config.aperture ?? 0.025
    this._maxBlur = config.maxBlur ?? 0.02
    this._blurMethod = config.blurMethod ?? 3

    // Create TSL uniforms
    this.uFocus = uniform(this._focus)
    this.uFocusRange = uniform(this._focusRange)
    this.uAperture = uniform(this._aperture)
    this.uMaxBlur = uniform(this._maxBlur)
    this.uNearClip = uniform(0.1)
    this.uFarClip = uniform(1000)
    this.uAspect = uniform(1)
    this.uBlurMethod = uniform(this._blurMethod)
    this.uTime = uniform(0)

    // Create placeholder textures for stable binding
    const size = 4
    const colorData = new Uint8Array(size * size * 4).fill(128)
    this.placeholderColor = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderColor.needsUpdate = true

    const depthData = new Uint8Array(size * size * 4).fill(255)
    this.placeholderDepth = new THREE.DataTexture(depthData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderDepth.needsUpdate = true

    // Create geometry
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Main mesh
    this.mesh = new THREE.Mesh(geometry)
    this.mesh.frustumCulled = false
    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    // Copy mesh
    this.copyMesh = new THREE.Mesh(geometry.clone())
    this.copyMesh.frustumCulled = false
    this.copyScene = new THREE.Scene()
    this.copyScene.add(this.copyMesh)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Ensure main material is created
   */
  private ensureMaterial(): void {
    if (this.material) return

    // Create stable texture nodes
    this.colorTextureNode = texture(this.placeholderColor)
    this.depthTextureNode = texture(this.placeholderDepth)

    const colorTex = this.colorTextureNode
    const depthTex = this.depthTextureNode
    const uFocus = this.uFocus
    const uFocusRange = this.uFocusRange
    const uAperture = this.uAperture
    const uMaxBlur = this.uMaxBlur
    const uNearClip = this.uNearClip
    const uFarClip = this.uFarClip
    const uAspect = this.uAspect
    const uBlurMethod = this.uBlurMethod
    const uTime = this.uTime

    const outputNode = Fn(() => {
      const uv = screenUV

      // Sample depth and convert to view Z
      const depth = depthTex.sample(uv).x
      const viewZ = perspectiveDepthToViewZ(depth, uNearClip, uFarClip).negate()

      // Calculate blur factor with focus range dead zone
      const diff = viewZ.sub(uFocus)
      const absDiff = abs(diff)
      const blurFactor = clamp(
        max(float(0), absDiff.sub(uFocusRange)).mul(uAperture),
        float(0),
        uMaxBlur
      ).toVar('blurFactor')

      // Create blur vector with aspect correction
      const dofblur = vec2(blurFactor, blurFactor.mul(uAspect))

      // Select blur method based on mode
      const result = uBlurMethod.lessThan(0.5).select(
        discBlurTSL(colorTex, uv, dofblur),
        // Method 1: Jittered
        uBlurMethod.lessThan(1.5).select(
          jitteredBlurTSL(colorTex, uv, dofblur, uTime),
          // Method 2: Separable
          uBlurMethod.lessThan(2.5).select(
            separableBlurTSL(colorTex, uv, dofblur),
            // Method 3: Hexagonal (default)
            hexagonalBlurTSL(colorTex, uv, dofblur)
          )
        )
      )

      // Force alpha to 1
      return vec4(result.x, result.y, result.z, float(1))
    })()

    this.material = new MeshBasicNodeMaterial()
    this.material.outputNode = outputNode
    ;(this.material as unknown as { depthTest: boolean }).depthTest = false
    this.material.depthWrite = false
    this.mesh.material = this.material as unknown as THREE.Material
  }

  /**
   * Ensure copy material is created
   */
  private ensureCopyMaterial(): void {
    if (this.copyMaterial) return

    // Store reference for later texture updates
    this.copyTextureNode = texture(this.placeholderColor)
    const colorTex = this.copyTextureNode

    const outputNode = Fn(() => {
      return colorTex.sample(screenUV)
    })()

    this.copyMaterial = new MeshBasicNodeMaterial()
    this.copyMaterial.outputNode = outputNode
    ;(this.copyMaterial as unknown as { depthTest: boolean }).depthTest = false
    this.copyMaterial.depthWrite = false
    this.copyMesh.material = this.copyMaterial as unknown as THREE.Material
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer
    const { camera, size } = ctx

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    // Passthrough if camera is not perspective or required inputs missing
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      this.copyToOutput(renderer, colorTex, outputTarget)
      return
    }

    const depthResourceId = this.depthInputSelector
      ? this.depthInputSelector()
      : this.depthInputId
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment)

    // Passthrough if required inputs missing
    if (!colorTex || !depthTex) {
      this.copyToOutput(renderer, colorTex, outputTarget)
      return
    }

    // Ensure material
    this.ensureMaterial()

    // Update texture values (not nodes - keeps binding stable)
    if (this.colorTextureNode) {
      ;(this.colorTextureNode as unknown as { value: THREE.Texture }).value = colorTex
    }
    if (this.depthTextureNode) {
      ;(this.depthTextureNode as unknown as { value: THREE.Texture }).value = depthTex
    }

    // Update uniforms
    this.uNearClip.value = camera.near
    this.uFarClip.value = camera.far
    this.uAspect.value = size.height / size.width
    this.uTime.value = ctx.time

    // Render (WebGLRenderTarget works with both WebGL and WebGPU)
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  // Store copy texture node reference for updates
  private copyTextureNode: ReturnType<typeof texture> | null = null

  /**
   * Copy input texture directly to output (passthrough)
   *
   * NOTE: WebGLRenderTarget is the correct type for both WebGL and WebGPU.
   * Three.js uses WebGLRenderTarget as the universal render target class.
   */
  private copyToOutput(
    renderer: SupportedRenderer,
    inputTex: THREE.Texture | null,
    outputTarget: SupportedRenderTarget | null
  ): void {
    if (!inputTex) return

    this.ensureCopyMaterial()

    // Update the copy texture value
    if (this.copyTextureNode) {
      ;(this.copyTextureNode as unknown as { value: THREE.Texture }).value = inputTex
    }

    // WebGLRenderTarget works with both WebGL and WebGPU renderers
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.copyScene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set focus distance
   */
  setFocus(value: number): void {
    this._focus = value
    this.uFocus.value = value
  }

  /**
   * Set focus range
   */
  setFocusRange(value: number): void {
    this._focusRange = value
    this.uFocusRange.value = value
  }

  /**
   * Set aperture
   */
  setAperture(value: number): void {
    this._aperture = value
    this.uAperture.value = value
  }

  /**
   * Set max blur
   */
  setMaxBlur(value: number): void {
    this._maxBlur = value
    this.uMaxBlur.value = value
  }

  /**
   * Set blur method
   */
  setBlurMethod(value: number): void {
    this._blurMethod = value
    this.uBlurMethod.value = value
  }

  dispose(): void {
    this.material?.dispose()
    this.copyMaterial?.dispose()
    this.mesh.geometry.dispose()
    this.copyMesh.geometry.dispose()
    this.placeholderColor.dispose()
    this.placeholderDepth.dispose()
    this.scene.remove(this.mesh)
    this.copyScene.remove(this.copyMesh)
  }
}
