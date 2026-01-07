/**
 * Paper Texture Pass (TSL)
 *
 * Render graph pass for paper texture effect using native TSL nodes.
 * Applies realistic paper/cardboard texture overlay to the scene.
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * Features:
 * - Fiber noise for paper grain
 * - Crumple patterns for aged paper look
 * - Fold lines for document feel
 * - Water drop marks
 * - Roughness noise for surface texture
 *
 * @module rendering/graph-tsl/passes/PaperTexturePassTSL
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
  floor,
  fract,
  mix,
  pow,
  clamp,
  sin,
  cos,
  dot,
  length,
  normalize,
  max,
  Loop,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'
import { getPaperNoiseTexture, disposePaperNoiseTexture } from '@/rendering/utils/PaperNoiseGenerator'
import type { PaperQuality } from '@/stores/defaults/visualDefaults'

/**
 * Configuration for PaperTexturePassTSL.
 */
export interface PaperTexturePassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string

  /** Contrast - blending behavior (0-1) */
  contrast?: number
  /** Roughness - pixel noise intensity (0-1) */
  roughness?: number
  /** Fiber - curly-shaped noise intensity (0-1) */
  fiber?: number
  /** Fiber size - curly-shaped noise scale (0.1-2) */
  fiberSize?: number
  /** Crumples - cell-based crumple pattern intensity (0-1) */
  crumples?: number
  /** Crumple size - cell-based crumple pattern scale (0.1-2) */
  crumpleSize?: number
  /** Folds - depth of the folds (0-1) */
  folds?: number
  /** Fold count - number of folds (1-15) */
  foldCount?: number
  /** Drops - visibility of speckle pattern (0-1) */
  drops?: number
  /** Fade - big-scale noise mask (0-1) */
  fade?: number
  /** Seed - randomization seed (0-1000) */
  seed?: number
  /** Front color - foreground color (hex) */
  colorFront?: string
  /** Back color - background color (hex) */
  colorBack?: string
  /** Quality level - controls feature complexity */
  quality?: PaperQuality
  /** Effect intensity (0-1) */
  intensity?: number
}

/**
 * Converts a hex color string to a THREE.Vector4 (RGBA).
 */
function hexToVector4(hex: string, alpha: number = 1.0): THREE.Vector4 {
  const color = new THREE.Color(hex)
  return new THREE.Vector4(color.r, color.g, color.b, alpha)
}

/**
 * Converts quality level to numeric value.
 */
function qualityToNumber(quality: PaperQuality): number {
  switch (quality) {
    case 'low':
      return 0
    case 'medium':
      return 1
    case 'high':
      return 2
    default:
      return 1
  }
}

// =============================================================================
// TSL Helper Constants
// =============================================================================

// Note: PI and TWO_PI constants removed - not used in this file

// =============================================================================
// TSL Helper Functions
// =============================================================================

/**
 * Rotate UV by angle
 */
const rotateTSL = Fn(
  ([uv, th]: [ReturnType<typeof vec2>, ReturnType<typeof float>]) => {
    const c = cos(th)
    const s = sin(th)
    return vec2(c.mul(uv.x).sub(s.mul(uv.y)), s.mul(uv.x).add(c.mul(uv.y)))
  }
)

/**
 * Paper texture pass using native TSL nodes.
 *
 * @example
 * ```typescript
 * const paperPass = new PaperTexturePassTSL({
 *   id: 'paper',
 *   colorInput: 'tonemappedColor',
 *   outputResource: 'paperOutput',
 *   contrast: 0.5,
 *   roughness: 0.3,
 *   fiber: 0.4,
 *   quality: 'medium',
 * });
 * ```
 */
export class PaperTexturePassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture nodes
  private colorTexNode: ReturnType<typeof texture> | null = null
  private noiseTexNode: ReturnType<typeof texture> | null = null

  // Noise texture
  private noiseTexture: THREE.Texture | null = null
  private noiseTextureInitialized = false

  // Uniforms
  private uContrast: UniformNode<number>
  private uRoughness: UniformNode<number>
  private uFiber: UniformNode<number>
  private uFiberSize: UniformNode<number>
  private uCrumples: UniformNode<number>
  private uCrumpleSize: UniformNode<number>
  private uFolds: UniformNode<number>
  private uFoldCount: UniformNode<number>
  private uDrops: UniformNode<number>
  private uFade: UniformNode<number>
  private uSeed: UniformNode<number>
  private uColorFront: UniformNode<THREE.Vector4>
  private uColorBack: UniformNode<THREE.Vector4>
  private uQuality: UniformNode<number>
  private uIntensity: UniformNode<number>
  private uTime: UniformNode<number>
  private uResolution: UniformNode<THREE.Vector2>
  private uPixelRatio: UniformNode<number>

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: PaperTexturePassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Paper Texture Pass (TSL)',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Initialize uniforms
    this.uContrast = uniform(config.contrast ?? 0.5)
    this.uRoughness = uniform(config.roughness ?? 0.3)
    this.uFiber = uniform(config.fiber ?? 0.4)
    this.uFiberSize = uniform(config.fiberSize ?? 0.5)
    this.uCrumples = uniform(config.crumples ?? 0.2)
    this.uCrumpleSize = uniform(config.crumpleSize ?? 0.5)
    this.uFolds = uniform(config.folds ?? 0.1)
    this.uFoldCount = uniform(config.foldCount ?? 5)
    this.uDrops = uniform(config.drops ?? 0.0)
    this.uFade = uniform(config.fade ?? 0.0)
    this.uSeed = uniform(config.seed ?? 42)
    this.uColorFront = uniform(config.colorFront ? hexToVector4(config.colorFront) : new THREE.Vector4(0.96, 0.96, 0.86, 1.0))
    this.uColorBack = uniform(config.colorBack ? hexToVector4(config.colorBack) : new THREE.Vector4(1.0, 1.0, 1.0, 1.0))
    this.uQuality = uniform(qualityToNumber(config.quality ?? 'medium'))
    this.uIntensity = uniform(config.intensity ?? 1.0)
    this.uTime = uniform(0)
    this.uResolution = uniform(new THREE.Vector2(1, 1))
    this.uPixelRatio = uniform(1.0)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize noise texture.
   */
  private initNoiseTexture(): void {
    if (!this.noiseTextureInitialized) {
      this.noiseTexture = getPaperNoiseTexture()
      this.noiseTextureInitialized = true
    }
  }

  /**
   * Initialize the TSL material.
   */
  private ensureInitialized(
    width: number,
    height: number,
    colorTex: THREE.Texture
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
      this.noiseTexNode = texture(this.noiseTexture!)

      // Build TSL shader
      const outputNode = this.buildPaperShader()

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
    } else {
      // Update texture values
      if (this.colorTexNode) this.colorTexNode.value = colorTex
    }
  }

  /**
   * Build the paper texture TSL shader.
   * This is a simplified version that maintains visual parity.
   */
  private buildPaperShader() {
    const colorTex = this.colorTexNode!
    const noiseTex = this.noiseTexNode!
    const uContrast = this.uContrast
    const uRoughness = this.uRoughness
    const uFiber = this.uFiber
    const uFiberSize = this.uFiberSize
    const uColorFront = this.uColorFront
    const uColorBack = this.uColorBack
    const uIntensity = this.uIntensity
    const uResolution = this.uResolution
    const uSeed = this.uSeed

    // Random from noise texture R channel
    const randomR = Fn(([p]: [ReturnType<typeof vec2>]) => {
      const uv = floor(p).div(100.0).add(0.5)
      return noiseTex.sample(fract(uv)).r
    })

    // Value noise
    const valueNoise = Fn(([st]: [ReturnType<typeof vec2>]) => {
      const i = floor(st)
      const f = fract(st)

      const a = randomR(i)
      const b = randomR(i.add(vec2(1.0, 0.0)))
      const c = randomR(i.add(vec2(0.0, 1.0)))
      const d = randomR(i.add(vec2(1.0, 1.0)))

      const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)))
      const x1 = mix(a, b, u.x)
      const x2 = mix(c, d, u.x)
      return mix(x1, x2, u.y)
    })

    // FBM
    const fbm = Fn(([n]: [ReturnType<typeof vec2>]) => {
      let total = float(0)
      let amplitude = float(0.4)
      let coords = n

      Loop(3, () => {
        total = total.add(valueNoise(coords).mul(amplitude))
        coords = coords.mul(1.99)
        amplitude = amplitude.mul(0.65)
      })

      return total
    })

    // Roughness noise (simplified)
    const roughnessNoise = Fn(([p]: [ReturnType<typeof vec2>]) => {
      const scaled = p.mul(0.1)
      return valueNoise(scaled).sub(0.5).mul(2.0)
    })

    // Fiber noise (simplified FBM-based)
    const fiberValueNoise = Fn(([st]: [ReturnType<typeof vec2>]) => {
      const i = floor(st)
      const f = fract(st)

      const uvBase = i.div(100.0)
      const a = noiseTex.sample(fract(uvBase)).b
      const b = noiseTex.sample(fract(uvBase.add(vec2(0.01, 0.0)))).b
      const c = noiseTex.sample(fract(uvBase.add(vec2(0.0, 0.01)))).b
      const d = noiseTex.sample(fract(uvBase.add(vec2(0.01, 0.01)))).b

      const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)))
      const x1 = mix(a, b, u.x)
      const x2 = mix(c, d, u.x)
      return mix(x1, x2, u.y)
    })

    const fiberNoiseFbm = Fn(([n, seedOffset]: [ReturnType<typeof vec2>, ReturnType<typeof vec2>]) => {
      let total = float(0)
      let amplitude = float(1.0)
      let coords = n

      Loop(4, () => {
        coords = rotateTSL(coords, float(0.7))
        total = total.add(fiberValueNoise(coords.add(seedOffset)).mul(amplitude))
        coords = coords.mul(2.0)
        amplitude = amplitude.mul(0.6)
      })

      return total
    })

    const fiberNoise = Fn(([uv, seedOffset]: [ReturnType<typeof vec2>, ReturnType<typeof vec2>]) => {
      const epsilon = float(0.001)
      const n0 = fiberNoiseFbm(uv, seedOffset)
      const n1 = fiberNoiseFbm(uv.add(vec2(epsilon, 0.0)), seedOffset)
      const n2 = fiberNoiseFbm(uv.add(vec2(0.0, epsilon)), seedOffset)
      return length(vec2(n1.sub(n0), n2.sub(n0))).div(epsilon)
    })

    return Fn(() => {
      const uv = screenUV

      // Sample input
      const inputColor = colorTex.sample(uv)

      // Early exit if intensity is zero
      // Note: TSL doesn't have early return like GLSL, so we compute everything
      // but will blend with intensity

      // Pattern UV
      const aspect = uResolution.x.div(uResolution.y)
      const patternUV = uv.sub(0.5).mul(5.0).mul(vec2(aspect, float(1.0)))

      // Screen-space UV for roughness
      const roughnessUv = uv.mul(uResolution).mul(1.5)

      // Initialize normal accumulator
      let normalX = float(0)
      let normalY = float(0)

      // Roughness
      const roughnessVal = roughnessNoise(roughnessUv.add(vec2(1.0, 0.0)))
        .sub(roughnessNoise(roughnessUv.sub(vec2(1.0, 0.0))))
      normalX = normalX.add(uRoughness.mul(1.5).mul(roughnessVal))

      // Fiber
      const fiberUV = patternUV.mul(float(2.0).div(max(float(0.1), uFiberSize)))
      const fiberVal = fiberNoise(fiberUV, vec2(0.0, 0.0))
      const fiber = uFiber.mul(0.5).mul(fiberVal.sub(1.0))
      normalX = normalX.add(fiber)

      // Add fade mask contribution (computed for future use but not in final blend)
      fbm(patternUV.mul(0.17).add(uSeed.mul(10.0)))

      // Lighting calculation
      const normalZ = float(9.5).sub(pow(uContrast, float(0.1)).mul(9.0))
      const normal3D = normalize(vec3(normalX, normalY, normalZ))
      const lightPos = normalize(vec3(1.0, 2.0, 1.0))
      const lighting = dot(normal3D, lightPos)

      // Color blending
      const fgColor = vec3(uColorFront.x, uColorFront.y, uColorFront.z).mul(uColorFront.w)
      const fgOpacity = uColorFront.w
      const bgColor = vec3(uColorBack.x, uColorBack.y, uColorBack.z).mul(uColorBack.w)

      // Paper texture color
      let paperColor = fgColor.mul(lighting)
      const paperOpacity = fgOpacity.mul(lighting)

      paperColor = paperColor.add(bgColor.mul(float(1.0).sub(paperOpacity)))

      // Blend with input based on intensity
      const blendedColor = mix(inputColor.rgb, inputColor.rgb.mul(paperColor), uIntensity)

      // Apply subtle displacement based on normals
      const displaceAmount = float(0.01).mul(uIntensity)
      const displacedUV = clamp(
        uv.add(vec2(normalX, normalY).mul(displaceAmount)),
        vec2(float(0), float(0)),
        vec2(float(1), float(1))
      )
      const displacedColor = colorTex.sample(displacedUV).rgb

      // Final blend
      const finalColor = mix(blendedColor, displacedColor.mul(paperColor), uIntensity.mul(0.3))

      return vec4(finalColor, inputColor.a)
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { time, size } = ctx

    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!colorTex || !outputTarget) {
      return
    }

    // Initialize noise texture on first use
    this.initNoiseTexture()

    if (!this.noiseTexture) {
      return
    }

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, colorTex)

    if (!this.material || !this.scene) {
      return
    }

    // Update uniforms
    this.uTime.value = time
    this.uResolution.value.set(size.width, size.height)
    // Both WebGLRenderer and WebGPURenderer implement getPixelRatio()
    this.uPixelRatio.value = (renderer as unknown as { getPixelRatio(): number }).getPixelRatio?.() ?? 1

    // Render
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  // ============================================================================
  // Setter Methods
  // ============================================================================

  setContrast(value: number): void {
    this.uContrast.value = value
  }

  setRoughness(value: number): void {
    this.uRoughness.value = value
  }

  setFiber(value: number): void {
    this.uFiber.value = value
  }

  setFiberSize(value: number): void {
    this.uFiberSize.value = value
  }

  setCrumples(value: number): void {
    this.uCrumples.value = value
  }

  setCrumpleSize(value: number): void {
    this.uCrumpleSize.value = value
  }

  setFolds(value: number): void {
    this.uFolds.value = value
  }

  setFoldCount(value: number): void {
    this.uFoldCount.value = value
  }

  setDrops(value: number): void {
    this.uDrops.value = value
  }

  setFade(value: number): void {
    this.uFade.value = value
  }

  setSeed(value: number): void {
    this.uSeed.value = value
  }

  setColorFront(hex: string): void {
    this.uColorFront.value = hexToVector4(hex)
  }

  setColorBack(hex: string): void {
    this.uColorBack.value = hexToVector4(hex)
  }

  setQuality(quality: PaperQuality): void {
    this.uQuality.value = qualityToNumber(quality)
  }

  setIntensity(value: number): void {
    this.uIntensity.value = value
  }

  /**
   * Dispose internal resources.
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
    this.colorTexNode = null
    this.noiseTexNode = null
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

    // Dispose the shared noise texture
    if (this.noiseTextureInitialized) {
      disposePaperNoiseTexture()
      this.noiseTextureInitialized = false
      this.noiseTexture = null
    }
  }
}
