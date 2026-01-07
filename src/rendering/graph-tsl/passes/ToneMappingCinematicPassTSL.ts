/**
 * Combined Tone Mapping + Cinematic Pass (TSL)
 *
 * OPTIMIZATION: Merges ToneMappingPass and CinematicPass into a single pass.
 * Eliminates one render target switch and redundant texture fetch.
 *
 * Operations (in order):
 * 1. Chromatic aberration (samples R/G/B at offset UVs)
 * 2. Tone mapping (HDR → LDR conversion)
 * 3. Vignette
 * 4. Film grain
 *
 * Pipeline position: After all HDR effects, before paper texture and AA.
 *
 * Now using actual TSL nodes for WebGPU compatibility.
 *
 * @module rendering/graph-tsl/passes/ToneMappingCinematicPassTSL
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
  clamp,
  max,
  min,
  pow,
  log2,
  dot,
  length,
  smoothstep,
  fract,
  floor,
  mix,
  If,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for ToneMappingCinematicPassTSL.
 */
export interface ToneMappingCinematicPassTSLConfig
  extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input HDR color resource */
  colorInput: string
  /** Output LDR color resource */
  outputResource: string

  // Tone mapping settings
  /** Initial tone mapping mode (Three.js constant) */
  toneMapping?: number
  /** Initial exposure value */
  exposure?: number

  // Cinematic settings
  /** Chromatic aberration distortion amount */
  aberration?: number
  /** Vignette darkness (0 = none, 2 = strong) */
  vignette?: number
  /** Film grain intensity */
  grain?: number
}

// =============================================================================
// TSL Tone Mapping Implementations
// =============================================================================

/**
 * Saturate helper (clamp 0-1)
 */
const saturate = (x: ReturnType<typeof vec3>) => clamp(x, vec3(0, 0, 0), vec3(1, 1, 1))

/**
 * Matrix-vector multiplication helper for 3x3 matrices
 * Takes row vectors [r0, r1, r2] and multiplies with column vector v
 * result = M * v where M is constructed from row vectors
 */
const mat3MulVec3 = Fn(
  ([r0, r1, r2, v]: [
    ReturnType<typeof vec3>,
    ReturnType<typeof vec3>,
    ReturnType<typeof vec3>,
    ReturnType<typeof vec3>,
  ]) => {
    return vec3(dot(r0, v), dot(r1, v), dot(r2, v))
  }
)

/**
 * Reinhard Tone Mapping
 */
const reinhardToneMapping = Fn(
  ([color, exposure]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    const c = color.mul(exposure)
    return saturate(c.div(vec3(1, 1, 1).add(c)))
  }
)

/**
 * Cineon Tone Mapping
 */
const cineonToneMapping = Fn(
  ([color, exposure]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    const c = max(vec3(0, 0, 0), color.mul(exposure).sub(0.004))
    const numerator = c.mul(c.mul(6.2).add(0.5))
    const denominator = c.mul(c.mul(6.2).add(1.7)).add(0.06)
    const safeDenom = max(denominator, vec3(0.0001, 0.0001, 0.0001))
    return pow(numerator.div(safeDenom), vec3(2.2, 2.2, 2.2))
  }
)

/**
 * ACES RRT and ODT fit helper
 */
const rrtAndOdtFit = Fn(([v]: [ReturnType<typeof vec3>]) => {
  const a = v.mul(v.add(0.0245786)).sub(0.000090537)
  const b = v.mul(v.mul(0.983729).add(0.4329510)).add(0.238081)
  return a.div(max(b, vec3(0.0001, 0.0001, 0.0001)))
})

/**
 * ACES Filmic Tone Mapping
 */
const acesFilmicToneMapping = Fn(
  ([color, exposure]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    // ACES input matrix rows
    const acesIn0 = vec3(0.59719, 0.35458, 0.04823)
    const acesIn1 = vec3(0.07600, 0.90834, 0.01566)
    const acesIn2 = vec3(0.02840, 0.13383, 0.83777)
    // ACES output matrix rows
    const acesOut0 = vec3(1.60475, -0.53108, -0.07367)
    const acesOut1 = vec3(-0.10208, 1.10813, -0.00605)
    const acesOut2 = vec3(-0.00327, -0.07276, 1.07602)

    const c = color.mul(exposure.div(0.6))
    const c1 = mat3MulVec3(acesIn0, acesIn1, acesIn2, c)
    const c2 = rrtAndOdtFit(c1)
    const c3 = mat3MulVec3(acesOut0, acesOut1, acesOut2, c2)
    return saturate(c3)
  }
)

/**
 * AgX contrast approximation
 */
const agxDefaultContrastApprox = Fn(([x]: [ReturnType<typeof vec3>]) => {
  const x2 = x.mul(x)
  const x4 = x2.mul(x2)
  return x4.mul(x2).mul(15.5)
    .sub(x4.mul(x).mul(40.14))
    .add(x4.mul(31.96))
    .sub(x2.mul(x).mul(6.868))
    .add(x2.mul(0.4298))
    .add(x.mul(0.1191))
    .sub(0.00232)
})

/**
 * AgX Tone Mapping
 */
const agxToneMapping = Fn(
  ([color, exposure]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    // Color space matrices (row vectors)
    const srgbToRec0 = vec3(0.6274, 0.3293, 0.0433)
    const srgbToRec1 = vec3(0.0691, 0.9195, 0.0113)
    const srgbToRec2 = vec3(0.0164, 0.0880, 0.8956)

    const recToSrgb0 = vec3(1.6605, -0.5876, -0.0728)
    const recToSrgb1 = vec3(-0.1246, 1.1329, -0.0083)
    const recToSrgb2 = vec3(-0.0182, -0.1006, 1.1187)

    const agxIn0 = vec3(0.856627153315983, 0.0951212405381588, 0.0482516061458583)
    const agxIn1 = vec3(0.137318972929847, 0.761241990602591, 0.101439036467562)
    const agxIn2 = vec3(0.11189821299995, 0.0767994186031903, 0.811302368396859)

    const agxOut0 = vec3(1.1271005818144368, -0.11060664309660323, -0.016493938717834573)
    const agxOut1 = vec3(-0.1413297634984383, 1.157823702216272, -0.016493938717834257)
    const agxOut2 = vec3(-0.14132976349843826, -0.11060664309660294, 1.2519364065950405)

    const agxMinEv = float(-12.47393)
    const agxMaxEv = float(4.026069)

    const c = color.mul(exposure).toVar('agxColor')
    c.assign(mat3MulVec3(srgbToRec0, srgbToRec1, srgbToRec2, c))
    c.assign(mat3MulVec3(agxIn0, agxIn1, agxIn2, c))

    c.assign(max(c, vec3(1e-10, 1e-10, 1e-10)))
    c.assign(log2(c))
    c.assign(c.sub(agxMinEv).div(agxMaxEv.sub(agxMinEv)))
    c.assign(clamp(c, vec3(0, 0, 0), vec3(1, 1, 1)))

    c.assign(agxDefaultContrastApprox(c))

    c.assign(mat3MulVec3(agxOut0, agxOut1, agxOut2, c))
    c.assign(pow(max(c, vec3(0, 0, 0)), vec3(2.2, 2.2, 2.2)))
    c.assign(mat3MulVec3(recToSrgb0, recToSrgb1, recToSrgb2, c))

    return clamp(c, vec3(0, 0, 0), vec3(1, 1, 1))
  }
)

/**
 * Neutral Tone Mapping
 */
const neutralToneMapping = Fn(
  ([color, exposure]: [ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    const startCompression = float(0.8 - 0.04)
    const desaturation = float(0.15)

    const c = color.mul(exposure).toVar('neutralColor')

    const x = min(c.x, min(c.y, c.z))
    const offset = x.lessThan(0.08).select(
      x.sub(x.mul(x).mul(6.25)),
      float(0.04)
    )
    c.assign(c.sub(offset))

    const peak = max(c.x, max(c.y, c.z)).toVar('peak')

    // Early return equivalent using select
    const d = float(1).sub(startCompression)
    const denominator = peak.add(d).sub(startCompression)
    const safeDenom = max(denominator, float(0.0001))
    const newPeak = float(1).sub(d.mul(d).div(safeDenom))
    const safePeak = max(peak, float(0.0001))
    const scaledColor = c.mul(newPeak.div(safePeak))

    const g = float(1).sub(float(1).div(desaturation.mul(peak.sub(newPeak)).add(1)))
    const finalColor = mix(scaledColor, vec3(newPeak, newPeak, newPeak), g)

    return peak.lessThan(startCompression).select(c, finalColor)
  }
)

// =============================================================================
// Main Pass Implementation
// =============================================================================

/**
 * Combined tone mapping and cinematic effects pass.
 *
 * OPTIMIZATION: Single pass instead of two separate passes.
 * Saves ~2-3ms per frame by eliminating render target switch and texture fetch overhead.
 *
 * @example
 * ```typescript
 * const pass = new ToneMappingCinematicPassTSL({
 *   id: 'toneMappingCinematic',
 *   colorInput: 'hdrColor',
 *   outputResource: 'ldrColor',
 *   toneMapping: THREE.ACESFilmicToneMapping,
 *   exposure: 1.0,
 *   aberration: 0.005,
 *   vignette: 1.2,
 *   grain: 0.05,
 * });
 * ```
 */
export class ToneMappingCinematicPassTSL extends BasePassTSL {
  private inputResourceId: string
  private outputResourceId: string

  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  // TSL Uniforms
  private uToneMapping: UniformNode<number>
  private uExposure: UniformNode<number>
  private uTime: UniformNode<number>
  private uResolution: UniformNode<THREE.Vector2>
  private uDistortion: UniformNode<number>
  private uVignetteDarkness: UniformNode<number>
  private uVignetteOffset: UniformNode<number>
  private uNoiseIntensity: UniformNode<number>

  // Placeholder texture for stable binding
  private placeholderTexture: THREE.DataTexture
  private inputTextureNode: ReturnType<typeof texture> | null = null

  // Current settings
  private _toneMapping: number
  private _exposure: number
  private _aberration: number
  private _vignette: number
  private _grain: number

  constructor(config: ToneMappingCinematicPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'ToneMapping + Cinematic Pass',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.inputResourceId = config.colorInput
    this.outputResourceId = config.outputResource

    // Store settings
    this._toneMapping = config.toneMapping ?? THREE.NoToneMapping
    this._exposure = config.exposure ?? 1.0
    this._aberration = config.aberration ?? 0.005
    this._vignette = config.vignette ?? 1.2
    this._grain = config.grain ?? 0.05

    // Create TSL uniforms
    this.uToneMapping = uniform(this._toneMapping)
    this.uExposure = uniform(this._exposure)
    this.uTime = uniform(0)
    this.uResolution = uniform(new THREE.Vector2(1, 1))
    this.uDistortion = uniform(this._aberration)
    this.uVignetteDarkness = uniform(this._vignette)
    this.uVignetteOffset = uniform(1.0)
    this.uNoiseIntensity = uniform(this._grain)

    // Create placeholder texture for stable binding (WebGPU requirement)
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderTexture.needsUpdate = true

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry)
    this.mesh.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Ensure material is created with proper TSL nodes.
   * CRITICAL FOR WEBGPU: Must pass the REAL input texture, not placeholder!
   */
  private ensureMaterial(inputTex: THREE.Texture): void {
    if (this.material) return

    // Create texture node with REAL input texture (WebGPU bind groups are fixed at compile time)
    this.inputTextureNode = texture(inputTex)
    // DEBUG: Commented out to reduce console noise during shadow debugging
    // if (import.meta.env.DEV) {
    //   console.log(`[ToneMappingCinematicPassTSL] Creating material with REAL texture: ${(inputTex.image as { width?: number })?.width}x${(inputTex.image as { height?: number })?.height}`)
    // }

    // Build the TSL shader graph
    const outputNode = this.createOutputNode()

    this.material = new MeshBasicNodeMaterial()
    this.material.outputNode = outputNode
    ;(this.material as unknown as { depthTest: boolean }).depthTest = false
    this.material.depthWrite = false

    // Cast needed due to Three.js types not fully recognizing NodeMaterial as Material
    this.mesh.material = this.material as unknown as THREE.Material
  }

  /**
   * Create the main output node combining all effects.
   */
  private createOutputNode() {
    const texNode = this.inputTextureNode!
    const uToneMapping = this.uToneMapping
    const uExposure = this.uExposure
    const uTime = this.uTime
    const uResolution = this.uResolution
    const uDistortion = this.uDistortion
    const uVignetteDarkness = this.uVignetteDarkness
    const uVignetteOffset = this.uVignetteOffset
    const uNoiseIntensity = this.uNoiseIntensity

    return Fn(() => {
      const uv = screenUV

      // Step 1: Chromatic Aberration
      const dist = uv.sub(vec2(0.5, 0.5))
      const offset = dist.mul(uDistortion)

      // Sample R/G/B at different offsets for chromatic aberration
      const rSample = texNode.sample(uv.sub(offset)).r
      const gSample = texNode.sample(uv).g
      const bSample = texNode.sample(uv.add(offset)).b

      // Use chromatic aberration if distortion > 0.001, otherwise regular sample
      const regularColor = texNode.sample(uv).rgb
      const aberratedColor = vec3(rSample, gSample, bSample)
      const color = uDistortion.greaterThan(0.001).select(aberratedColor, regularColor).toVar('color')

      // Step 2: Tone Mapping
      // Apply based on mode
      const toneMapResult = color.toVar('toneMapResult')

      // Mode 0: No tone mapping
      If(uToneMapping.equal(0), () => {
        toneMapResult.assign(color)
      })
      // Mode 1: Linear
      If(uToneMapping.equal(1), () => {
        toneMapResult.assign(saturate(color.mul(uExposure)))
      })
      // Mode 2: Reinhard
      If(uToneMapping.equal(2), () => {
        toneMapResult.assign(reinhardToneMapping(color, uExposure))
      })
      // Mode 3: Cineon
      If(uToneMapping.equal(3), () => {
        toneMapResult.assign(cineonToneMapping(color, uExposure))
      })
      // Mode 4: ACES Filmic
      If(uToneMapping.equal(4), () => {
        toneMapResult.assign(acesFilmicToneMapping(color, uExposure))
      })
      // Mode 6: AgX
      If(uToneMapping.equal(6), () => {
        toneMapResult.assign(agxToneMapping(color, uExposure))
      })
      // Mode 7: Neutral
      If(uToneMapping.equal(7), () => {
        toneMapResult.assign(neutralToneMapping(color, uExposure))
      })

      color.assign(toneMapResult)

      // Step 3: Vignette
      const d = length(dist)
      const vignette = smoothstep(uVignetteOffset, uVignetteOffset.sub(0.6), d.mul(uVignetteDarkness))
      color.assign(color.mul(vignette))

      // Step 4: Film Grain
      If(uNoiseIntensity.greaterThan(0.001), () => {
        const t = fract(uTime.mul(10))
        const p = floor(uv.mul(uResolution))

        // Simple hash function for grain
        const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031))
        const p3d = dot(p3, p3.add(vec3(33.33, 33.33, 33.33)))
        const hash = fract(p3.x.add(p3.y).mul(p3d.add(t.mul(100))))

        const noise = hash.sub(0.5)
        color.assign(color.add(noise.mul(uNoiseIntensity)))
      })

      // Clamp to valid range
      color.assign(max(color, vec3(0, 0, 0)))

      return vec4(color.x, color.y, color.z, float(1))
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer
    const { time, size } = ctx

    // Get input texture FIRST - needed for material creation (WebGPU requirement)
    const inputTexture = ctx.getReadTexture(this.inputResourceId)
    if (!inputTexture) {
      console.warn(`ToneMappingCinematicPassTSL: Input '${this.inputResourceId}' not found`)
      return
    }

    // Create material with REAL texture (must be before material compilation for WebGPU)
    this.ensureMaterial(inputTexture)

    const outputTarget = ctx.getWriteTarget(this.outputResourceId)

    // DEBUG: Log execution
    if (import.meta.env.DEV) {
      // console.log(`[ToneMappingCinematicPassTSL:${this.id}] Execute - input: ${this.inputResourceId} ${inputTexture ? `${(inputTexture.image as { width?: number })?.width}x${(inputTexture.image as { height?: number })?.height}` : 'NULL'}, output: ${this.outputResourceId} ${outputTarget ? `${outputTarget.width}x${outputTarget.height}` : 'NULL'}`)
    }

    // Update texture value (not the node - keeps binding stable)
    if (this.inputTextureNode) {
      ;(this.inputTextureNode as unknown as { value: THREE.Texture }).value = inputTexture
    }

    // Update uniforms
    this.uTime.value = time
    this.uResolution.value.set(size.width, size.height)

    // WebGLRenderTarget works with both WebGL and WebGPU renderers
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set tone mapping algorithm (Three.js constant).
   */
  setToneMapping(mode: number): void {
    this._toneMapping = mode
    this.uToneMapping.value = mode
  }

  /**
   * Set exposure value.
   */
  setExposure(exposure: number): void {
    this._exposure = exposure
    this.uExposure.value = exposure
  }

  /**
   * Set chromatic aberration intensity.
   */
  setAberration(value: number): void {
    this._aberration = value
    this.uDistortion.value = value
  }

  /**
   * Set vignette darkness.
   */
  setVignette(value: number): void {
    this._vignette = value
    this.uVignetteDarkness.value = value
  }

  /**
   * Set film grain intensity.
   */
  setGrain(value: number): void {
    this._grain = value
    this.uNoiseIntensity.value = value
  }

  /**
   * Get current tone mapping settings.
   */
  getToneMappingSettings(): { toneMapping: number; exposure: number } {
    return {
      toneMapping: this._toneMapping,
      exposure: this._exposure,
    }
  }

  dispose(): void {
    this.material?.dispose()
    this.mesh.geometry.dispose()
    this.placeholderTexture.dispose()
    this.scene.remove(this.mesh)
  }
}
