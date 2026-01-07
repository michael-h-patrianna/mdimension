/**
 * Cinematic Pass (TSL)
 *
 * Render graph pass for cinematic effects using native TSL nodes.
 * Applies chromatic aberration, vignette, and film grain.
 *
 * REWRITTEN: Now uses actual TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * @module rendering/graph-tsl/passes/CinematicPassTSL
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
  fract,
  floor,
  dot,
  length,
  smoothstep,
  mix,
  max,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for CinematicPassTSL.
 */
export interface CinematicPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string

  /** Chromatic aberration distortion amount */
  aberration?: number
  /** Vignette darkness (0 = none, 2 = strong) */
  vignette?: number
  /** Film grain intensity */
  grain?: number
}

// =============================================================================
// TSL Helper Functions
// =============================================================================

/**
 * High-quality hash function for film grain
 */
const hashTSL = Fn(([p]: [ReturnType<typeof vec2>]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031))
  const p3Shifted = p3.add(dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33)))
  return fract(p3Shifted.x.add(p3Shifted.y).mul(p3Shifted.z))
})

/**
 * Cinematic effects pass using native TSL.
 *
 * @example
 * ```typescript
 * const cinematicPass = new CinematicPassTSL({
 *   id: 'cinematic',
 *   colorInput: 'sceneColor',
 *   outputResource: 'cinematicOutput',
 *   aberration: 0.005,
 *   vignette: 1.2,
 *   grain: 0.05,
 * });
 * ```
 */
export class CinematicPassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture node (stable reference)
  private colorTexNode: ReturnType<typeof texture> | null = null

  // Uniforms
  private uDistortion: UniformNode<number>
  private uVignetteDarkness: UniformNode<number>
  private uVignetteOffset: UniformNode<number>
  private uNoiseIntensity: UniformNode<number>
  private uTime: UniformNode<number>
  private uResolution: UniformNode<THREE.Vector2>

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: CinematicPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Cinematic Pass (TSL)',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Initialize uniforms
    this.uDistortion = uniform(config.aberration ?? 0.005)
    this.uVignetteDarkness = uniform(config.vignette ?? 1.2)
    this.uVignetteOffset = uniform(1.0)
    this.uNoiseIntensity = uniform(config.grain ?? 0.05)
    this.uTime = uniform(0)
    this.uResolution = uniform(new THREE.Vector2(1, 1))

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize the TSL material
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

      // Create texture node
      this.colorTexNode = texture(colorTex)

      // Build TSL shader
      const outputNode = this.buildCinematicShader()

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
      // Update texture value
      if (this.colorTexNode) this.colorTexNode.value = colorTex
    }
  }

  /**
   * Build the cinematic TSL shader
   */
  private buildCinematicShader() {
    const colorTex = this.colorTexNode!
    const distortion = this.uDistortion
    const vignetteDarkness = this.uVignetteDarkness
    const vignetteOffset = this.uVignetteOffset
    const noiseIntensity = this.uNoiseIntensity
    const time = this.uTime
    const resolution = this.uResolution

    return Fn(() => {
      const uv = screenUV

      // -- Chromatic Aberration --
      // Calculate distance from center (0.5, 0.5)
      const dist = uv.sub(0.5)

      // Distort UVs for each channel
      const offset = dist.mul(distortion)

      const r = colorTex.sample(uv.sub(offset)).r
      const g = colorTex.sample(uv).g
      const b = colorTex.sample(uv.add(offset)).b

      let color = vec3(r, g, b)

      // -- Vignette --
      const d = length(dist)
      const vignette = smoothstep(
        vignetteOffset,
        vignetteOffset.sub(0.6),
        d.mul(vignetteDarkness)
      )
      color = mix(color, color.mul(vignette), float(1))

      // -- Film Grain --
      // Temporal noise that changes each frame
      const t = fract(time.mul(10))
      const p = floor(uv.mul(resolution))
      const noise = hashTSL(p.add(t.mul(100))).sub(0.5)
      color = color.add(noise.mul(noiseIntensity))

      // Prevent negative values (preserve HDR for tone mapping)
      color = max(color, vec3(0, 0, 0))

      return vec4(color, float(1))
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

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, colorTex)

    if (!this.material || !this.scene) {
      return
    }

    // Update uniforms
    this.uTime.value = time
    this.uResolution.value.set(size.width, size.height)

    // Render
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set chromatic aberration
   */
  setAberration(value: number): void {
    this.uDistortion.value = value
  }

  /**
   * Set vignette darkness
   */
  setVignette(value: number): void {
    this.uVignetteDarkness.value = value
  }

  /**
   * Set film grain intensity
   */
  setGrain(value: number): void {
    this.uNoiseIntensity.value = value
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
    this.colorTexNode = null
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
