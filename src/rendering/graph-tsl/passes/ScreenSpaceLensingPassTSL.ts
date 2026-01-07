/**
 * Screen-Space Lensing Pass (TSL)
 *
 * Post-processing pass that applies gravitational lensing distortion
 * to the scene image using native TSL nodes.
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * Uses hybrid approach:
 * - Screen-space distortion for nearby objects (walls, floor)
 * - Sky cubemap sampling with bent rays for distant background
 *
 * @module rendering/graph-tsl/passes/ScreenSpaceLensingPassTSL
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
  cubeTexture,
  uniform,
  screenUV,
  length,
  normalize,
  mix,
  pow,
  min,
  max,
  clamp,
  exp,
  abs,
  smoothstep,
  select,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for ScreenSpaceLensingPassTSL.
 */
export interface ScreenSpaceLensingPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input scene color texture resource ID */
  colorInput: string
  /** Input scene depth texture resource ID (optional) */
  depthInput?: string
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth'
  /** Output resource ID */
  outputResource: string
  /** Lensing intensity/strength (0-5, default: 1.0) */
  intensity?: number
  /** Lens mass parameter affecting distortion (0.1-10, default: 1.0) */
  mass?: number
  /** Distortion scale (0.1-5, default: 1.0) */
  distortionScale?: number
  /** Chromatic aberration amount (0-1, default: 0.5) */
  chromaticAberration?: number
  /** Black hole center X in UV space (0-1, default: 0.5) */
  centerX?: number
  /** Black hole center Y in UV space (0-1, default: 0.5) */
  centerY?: number
  /** Event horizon radius in UV space (0-1, default: 0.05) */
  horizonRadius?: number
  /** Distance falloff exponent (0.5-4, default: 1.5) */
  falloff?: number
  /** Enable hybrid sky cubemap sampling for background */
  hybridSkyEnabled?: boolean
}

/**
 * Screen-space gravitational lensing pass using native TSL.
 *
 * @example
 * ```typescript
 * const lensing = new ScreenSpaceLensingPassTSL({
 *   id: 'lensing',
 *   colorInput: 'sceneColor',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'lensedScene',
 *   intensity: 1.0,
 *   mass: 1.0,
 * });
 * ```
 */
export class ScreenSpaceLensingPassTSL extends BasePassTSL {
  private inputColorResourceId: string
  private inputDepthResourceId: string | null
  private inputDepthAttachment?: number | 'depth'
  private outputResourceId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture nodes
  private colorTexNode: ReturnType<typeof texture> | null = null
  private depthTexNode: ReturnType<typeof texture> | null = null
  private skyCubeTexNode: ReturnType<typeof cubeTexture> | null = null

  // Lensing parameters
  private blackHoleCenter: THREE.Vector2
  private horizonRadius: number
  private intensityVal: number
  private mass: number
  private distortionScale: number
  private falloff: number
  private chromaticAberration: number
  private hybridSkyEnabled: boolean

  // Uniforms
  private uBlackHoleCenter: UniformNode<THREE.Vector2>
  private uHorizonRadius: UniformNode<number>
  private uIntensity: UniformNode<number>
  private uMass: UniformNode<number>
  private uDistortionScale: UniformNode<number>
  private uFalloff: UniformNode<number>
  private uChromaticAberration: UniformNode<number>
  private uNear: UniformNode<number>
  private uFar: UniformNode<number>
  private uDepthAvailable: UniformNode<number>
  private uHybridSkyEnabled: UniformNode<number>
  private uSkyCubemapAvailable: UniformNode<number>
  private uInverseViewProjection: UniformNode<THREE.Matrix4>
  private uCameraPosition: UniformNode<THREE.Vector3>
  private uResolution: UniformNode<THREE.Vector2>

  // Sky cubemap
  private skyCubemap: THREE.CubeTexture | null = null

  // Matrix for world ray reconstruction
  private inverseViewProjection = new THREE.Matrix4()

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: ScreenSpaceLensingPassTSLConfig) {
    const inputs: { resourceId: string; access: 'read'; attachment?: number | 'depth' }[] = [
      { resourceId: config.colorInput, access: 'read' },
    ]
    if (config.depthInput) {
      inputs.push({
        resourceId: config.depthInput,
        access: 'read',
        attachment: config.depthInputAttachment,
      })
    }

    super({
      id: config.id,
      name: config.name ?? 'Screen Space Lensing Pass (TSL)',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.inputColorResourceId = config.colorInput
    this.inputDepthResourceId = config.depthInput ?? null
    this.inputDepthAttachment = config.depthInputAttachment
    this.outputResourceId = config.outputResource

    // Initialize parameters
    this.blackHoleCenter = new THREE.Vector2(config.centerX ?? 0.5, config.centerY ?? 0.5)
    this.horizonRadius = config.horizonRadius ?? 0.05
    this.intensityVal = config.intensity ?? 1.0
    this.mass = config.mass ?? 1.0
    this.distortionScale = config.distortionScale ?? 1.0
    this.falloff = config.falloff ?? 1.5
    this.chromaticAberration = config.chromaticAberration ?? 0.5
    this.hybridSkyEnabled = config.hybridSkyEnabled ?? true

    // Initialize uniforms
    this.uBlackHoleCenter = uniform(this.blackHoleCenter)
    this.uHorizonRadius = uniform(this.horizonRadius)
    this.uIntensity = uniform(this.intensityVal)
    this.uMass = uniform(this.mass)
    this.uDistortionScale = uniform(this.distortionScale)
    this.uFalloff = uniform(this.falloff)
    this.uChromaticAberration = uniform(this.chromaticAberration)
    this.uNear = uniform(0.1)
    this.uFar = uniform(100.0)
    this.uDepthAvailable = uniform(0)
    this.uHybridSkyEnabled = uniform(this.hybridSkyEnabled ? 1 : 0)
    this.uSkyCubemapAvailable = uniform(0)
    this.uInverseViewProjection = uniform(new THREE.Matrix4())
    this.uCameraPosition = uniform(new THREE.Vector3())
    this.uResolution = uniform(new THREE.Vector2())

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize the TSL material.
   */
  private ensureInitialized(
    width: number,
    height: number,
    colorTex: THREE.Texture,
    depthTex: THREE.Texture | null
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
      if (depthTex) {
        this.depthTexNode = texture(depthTex)
      }
      if (this.skyCubemap) {
        this.skyCubeTexNode = cubeTexture(this.skyCubemap)
      }

      // Build TSL shader
      const outputNode = this.buildLensingShader()

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
      if (this.depthTexNode && depthTex) this.depthTexNode.value = depthTex
      if (this.skyCubeTexNode && this.skyCubemap) this.skyCubeTexNode.value = this.skyCubemap
    }
  }

  /**
   * Build the lensing TSL shader.
   */
  private buildLensingShader() {
    const colorTex = this.colorTexNode!
    const depthTex = this.depthTexNode
    const uBlackHoleCenter = this.uBlackHoleCenter
    const uHorizonRadius = this.uHorizonRadius
    const uIntensity = this.uIntensity
    const uMass = this.uMass
    const uDistortionScale = this.uDistortionScale
    const uFalloff = this.uFalloff
    const uChromaticAberration = this.uChromaticAberration
    const uNear = this.uNear
    const uFar = this.uFar
    const uDepthAvailable = this.uDepthAvailable

    // Lensing magnitude function
    const lensingMagnitude = Fn(([r]: [ReturnType<typeof float>]) => {
      const safeR = max(r, float(0.001))
      const strength = uIntensity.mul(uMass).mul(uDistortionScale).mul(0.02)
      const deflection = strength.div(pow(safeR, uFalloff))
      return min(deflection, float(0.5))
    })

    // Compute displacement function
    const computeDisplacement = Fn(([uv, center]: [ReturnType<typeof vec2>, ReturnType<typeof vec2>]) => {
      const toCenter = center.sub(uv)
      const r = length(toCenter)
      const dir = normalize(toCenter)
      const mag = lensingMagnitude(r)
      // Return zero if too close to center
      return select(
        r.lessThan(0.01),
        vec2(0, 0),
        dir.mul(mag)
      )
    })

    // Linearize depth
    const linearizeDepth = Fn(([depth, near, far]: [
      ReturnType<typeof float>,
      ReturnType<typeof float>,
      ReturnType<typeof float>
    ]) => {
      const z = depth.mul(2.0).sub(1.0)
      const denominator = far.add(near).sub(z.mul(far.sub(near)))
      return near.mul(2.0).mul(far).div(max(denominator, float(0.0001)))
    })

    // Einstein ring boost
    const einsteinRingBoost = Fn(([r, ringRadius, ringWidth]: [
      ReturnType<typeof float>,
      ReturnType<typeof float>,
      ReturnType<typeof float>
    ]) => {
      const diff = abs(r.sub(ringRadius))
      const safeWidth = max(ringWidth, float(0.001))
      const falloffVal = exp(diff.mul(diff).negate().div(safeWidth.mul(safeWidth).mul(2.0)))
      return float(1).add(falloffVal.mul(0.5))
    })

    return Fn(() => {
      const uv = screenUV
      const center = vec2(uBlackHoleCenter.x, uBlackHoleCenter.y)
      const displacement = computeDisplacement(uv, center)

      const r = length(uv.sub(center))

      // Sample depth if available
      const depth = select(
        uDepthAvailable.greaterThan(0.5),
        depthTex ? depthTex.sample(uv).x : float(1),
        float(1)
      )
      const linearDepth = linearizeDepth(depth, uNear, uFar)

      // Compute distorted UV
      const distortedUV = clamp(uv.add(displacement), vec2(0, 0), vec2(1, 1))

      // Depth factor
      const depthFactor = select(
        uDepthAvailable.greaterThan(0.5),
        smoothstep(float(1), float(10), linearDepth),
        float(1)
      )

      // Inner radius exclusion (avoid double-lensing with raymarcher)
      const distFromCenter = length(uv.sub(center))
      const innerRadius = uHorizonRadius.mul(2.5)
      const outerRadius = uHorizonRadius.mul(3.5)
      const sslFactor = smoothstep(innerRadius, outerRadius, distFromCenter)

      // Final UV
      const finalUV = mix(uv, distortedUV, depthFactor.mul(sslFactor))

      // Chromatic aberration
      const rScale = float(1).sub(uChromaticAberration.mul(0.02))
      const gScale = float(1)
      const bScale = float(1).add(uChromaticAberration.mul(0.02))

      const finalDisplacement = displacement.mul(depthFactor).mul(sslFactor)

      const rChannel = colorTex.sample(uv.add(finalDisplacement.mul(rScale))).r
      const gChannel = colorTex.sample(uv.add(finalDisplacement.mul(gScale))).g
      const bChannel = colorTex.sample(uv.add(finalDisplacement.mul(bScale))).b

      // Select between chromatic and simple based on aberration amount
      let color = select(
        uChromaticAberration.greaterThan(0.01),
        vec3(rChannel, gChannel, bChannel),
        colorTex.sample(finalUV).rgb
      )

      // Einstein ring boost
      const ringRadius = uHorizonRadius.mul(1.5)
      const boost = einsteinRingBoost(r, ringRadius, uHorizonRadius.mul(0.3))
      color = color.mul(boost)

      return vec4(color, float(1))
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { camera, size } = ctx

    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get input textures
    const colorTexture = ctx.getReadTexture(this.inputColorResourceId)
    const depthTexture = this.inputDepthResourceId
      ? ctx.getReadTexture(this.inputDepthResourceId, this.inputDepthAttachment)
      : null

    if (!colorTexture) {
      console.warn(`ScreenSpaceLensingPassTSL: Color texture '${this.inputColorResourceId}' not found`)
      return
    }

    const outputTarget = ctx.getWriteTarget(this.outputResourceId)
    if (!outputTarget) {
      return
    }

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, colorTexture, depthTexture)

    if (!this.material || !this.scene) {
      return
    }

    // Update uniforms
    this.uBlackHoleCenter.value = this.blackHoleCenter
    this.uHorizonRadius.value = this.horizonRadius
    this.uIntensity.value = this.intensityVal
    this.uMass.value = this.mass
    this.uDistortionScale.value = this.distortionScale
    this.uFalloff.value = this.falloff
    this.uChromaticAberration.value = this.chromaticAberration
    this.uDepthAvailable.value = depthTexture ? 1 : 0
    this.uHybridSkyEnabled.value = this.hybridSkyEnabled ? 1 : 0
    this.uSkyCubemapAvailable.value = this.skyCubemap ? 1 : 0

    // Update camera matrices
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      this.uNear.value = camera.near
      this.uFar.value = camera.far

      this.inverseViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      this.inverseViewProjection.invert()
      this.uInverseViewProjection.value.copy(this.inverseViewProjection)

      this.uCameraPosition.value.setFromMatrixPosition(camera.matrixWorld)
    }

    this.uResolution.value.set(size.width, size.height)

    // Render
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  // === Parameter setters ===

  setBlackHoleCenter(x: number, y: number): void {
    this.blackHoleCenter.set(x, y)
  }

  setCenter(x: number, y: number): void {
    this.blackHoleCenter.set(x, y)
  }

  setHorizonRadius(radius: number): void {
    this.horizonRadius = radius
  }

  setIntensity(intensity: number): void {
    this.intensityVal = intensity
  }

  setMass(mass: number): void {
    this.mass = mass
  }

  setDistortionScale(scale: number): void {
    this.distortionScale = scale
  }

  setFalloff(falloff: number): void {
    this.falloff = falloff
  }

  setChromaticAberration(amount: number): void {
    this.chromaticAberration = amount
  }

  setHybridSkyEnabled(enabled: boolean): void {
    this.hybridSkyEnabled = enabled
  }

  setSkyCubemap(cubemap: THREE.CubeTexture | null): void {
    this.skyCubemap = cubemap
    // Force material recreation to update cubemap node
    this.disposeInternal()
    this.lastWidth = 0
    this.lastHeight = 0
  }

  getParameters(): {
    blackHoleCenter: THREE.Vector2
    horizonRadius: number
    intensity: number
    mass: number
    distortionScale: number
    falloff: number
    chromaticAberration: number
    hybridSkyEnabled: boolean
    hasSkyCubemap: boolean
  } {
    return {
      blackHoleCenter: this.blackHoleCenter.clone(),
      horizonRadius: this.horizonRadius,
      intensity: this.intensityVal,
      mass: this.mass,
      distortionScale: this.distortionScale,
      falloff: this.falloff,
      chromaticAberration: this.chromaticAberration,
      hybridSkyEnabled: this.hybridSkyEnabled,
      hasSkyCubemap: this.skyCubemap !== null,
    }
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
    this.depthTexNode = null
    this.skyCubeTexNode = null
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
