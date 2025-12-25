/**
 * Screen-Space Lensing Pass
 *
 * Post-processing pass that applies gravitational lensing distortion
 * to the scene image. Uses hybrid approach:
 * - Screen-space distortion for nearby objects (walls, floor)
 * - Sky cubemap sampling with bent rays for distant background
 *
 * This pass is specifically designed for black hole visualization.
 * When a sky cubemap is provided, the shader reconstructs 3D ray directions
 * for background pixels and samples the cubemap with gravitationally bent rays.
 *
 * @module rendering/graph/passes/ScreenSpaceLensingPass
 */

import * as THREE from 'three'

import {
  screenSpaceLensingFragmentShader,
  screenSpaceLensingVertexShader,
} from '@/rendering/shaders/postprocessing/screenSpaceLensing.glsl'
import { BasePass } from '../BasePass'
import type { RenderContext, RenderPassConfig } from '../types'

/**
 * Configuration for ScreenSpaceLensingPass.
 */
export interface ScreenSpaceLensingPassConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input scene color texture resource ID */
  colorInput: string

  /** Input scene depth texture resource ID (optional - lensing works without depth) */
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
 * Screen-space gravitational lensing pass.
 *
 * Applies gravitational lensing distortion based on distance from
 * the black hole center. Uses depth buffer to distinguish between
 * nearby objects and distant sky.
 *
 * @example
 * ```typescript
 * const lensing = new ScreenSpaceLensingPass({
 *   id: 'lensing',
 *   colorInput: 'sceneColor',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'lensedScene',
 *   intensity: 1.0,
 *   mass: 1.0,
 *   distortionScale: 1.0,
 *   falloff: 1.5,
 *   chromaticAberration: 0.5,
 * });
 *
 * graph.addPass(lensing);
 * ```
 */
export class ScreenSpaceLensingPass extends BasePass {
  private inputColorResourceId: string
  private inputDepthResourceId: string | null
  private inputDepthAttachment?: number | 'depth'
  private outputResourceId: string

  // Lensing parameters
  private blackHoleCenter: THREE.Vector2
  private horizonRadius: number
  private intensity: number
  private mass: number
  private distortionScale: number
  private falloff: number
  private chromaticAberration: number
  private hybridSkyEnabled: boolean

  // Sky cubemap for hybrid mode
  private skyCubemap: THREE.CubeTexture | null = null

  // Matrix for world ray reconstruction
  private inverseViewProjection = new THREE.Matrix4()

  // Rendering resources
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  constructor(config: ScreenSpaceLensingPassConfig) {
    // Build inputs list - depth is optional
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
      name: config.name,
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
    this.intensity = config.intensity ?? 1.0
    this.mass = config.mass ?? 1.0
    this.distortionScale = config.distortionScale ?? 1.0
    this.falloff = config.falloff ?? 1.5
    this.chromaticAberration = config.chromaticAberration ?? 0.5
    this.hybridSkyEnabled = config.hybridSkyEnabled ?? true

    // Create lensing material
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        tSkyCubemap: { value: null },
        uBlackHoleCenter: { value: this.blackHoleCenter },
        uHorizonRadius: { value: this.horizonRadius },
        uIntensity: { value: this.intensity },
        uMass: { value: this.mass },
        uDistortionScale: { value: this.distortionScale },
        uFalloff: { value: this.falloff },
        uChromaticAberration: { value: this.chromaticAberration },
        uNear: { value: 0.1 },
        uFar: { value: 100.0 },
        uDepthAvailable: { value: false },
        uHybridSkyEnabled: { value: this.hybridSkyEnabled },
        uSkyCubemapAvailable: { value: false },
        uInverseViewProjection: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uResolution: { value: new THREE.Vector2() },
      },
      vertexShader: screenSpaceLensingVertexShader,
      fragmentShader: screenSpaceLensingFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  execute(ctx: RenderContext): void {
    const { renderer, camera, scene } = ctx

    // Get input textures
    const colorTexture = ctx.getReadTexture(this.inputColorResourceId)
    const depthTexture = this.inputDepthResourceId
      ? ctx.getReadTexture(this.inputDepthResourceId, this.inputDepthAttachment)
      : null

    if (!colorTexture) {
      console.warn(`ScreenSpaceLensingPass: Color texture '${this.inputColorResourceId}' not found`)
      return
    }

    // Get output target
    const outputTarget = ctx.getWriteTarget(this.outputResourceId)

    // Update uniforms
    this.material.uniforms['tColor']!.value = colorTexture
    this.material.uniforms['tDepth']!.value = depthTexture
    this.material.uniforms['uDepthAvailable']!.value = depthTexture !== null
    this.material.uniforms['uBlackHoleCenter']!.value = this.blackHoleCenter
    this.material.uniforms['uHorizonRadius']!.value = this.horizonRadius
    this.material.uniforms['uIntensity']!.value = this.intensity
    this.material.uniforms['uMass']!.value = this.mass
    this.material.uniforms['uDistortionScale']!.value = this.distortionScale
    this.material.uniforms['uFalloff']!.value = this.falloff
    this.material.uniforms['uChromaticAberration']!.value = this.chromaticAberration
    this.material.uniforms['uHybridSkyEnabled']!.value = this.hybridSkyEnabled
    // NOTE: We intentionally do NOT auto-detect scene.background for sky cubemap.
    // scene.background is now used by the black hole raymarcher for gravitational lensing
    // via envMap sampling. If SSL auto-detected it, wall pixels would be incorrectly
    // classified as "background" and replaced with cubemap samples, making walls invisible.
    // Use setSkyCubemap() to explicitly enable hybrid sky mode if needed.
    this.material.uniforms['tSkyCubemap']!.value = this.skyCubemap
    this.material.uniforms['uSkyCubemapAvailable']!.value = this.skyCubemap !== null

    // Update camera matrices for world ray reconstruction
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      this.material.uniforms['uNear']!.value = camera.near
      this.material.uniforms['uFar']!.value = camera.far

      // Compute inverse view-projection matrix
      this.inverseViewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
      this.inverseViewProjection.invert()
      this.material.uniforms['uInverseViewProjection']!.value.copy(this.inverseViewProjection)

      // Camera position in world space
      this.material.uniforms['uCameraPosition']!.value.setFromMatrixPosition(camera.matrixWorld)
    }

    // Update resolution
    if (outputTarget) {
      this.material.uniforms['uResolution']!.value.set(outputTarget.width, outputTarget.height)
    }

    // Render
    renderer.setRenderTarget(outputTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  // === Parameter setters ===

  /**
   * Set black hole center in UV space (0 to 1, where 0.5, 0.5 is screen center).
   */
  setBlackHoleCenter(x: number, y: number): void {
    this.blackHoleCenter.set(x, y)
  }

  /**
   * Set black hole center (alias for setBlackHoleCenter).
   */
  setCenter(x: number, y: number): void {
    this.blackHoleCenter.set(x, y)
  }

  /**
   * Set event horizon radius in UV space.
   */
  setHorizonRadius(radius: number): void {
    this.horizonRadius = radius
  }

  /**
   * Set lensing intensity (0-5).
   */
  setIntensity(intensity: number): void {
    this.intensity = intensity
  }

  /**
   * Set lens mass parameter (0.1-10).
   */
  setMass(mass: number): void {
    this.mass = mass
  }

  /**
   * Set distortion scale (0.1-5).
   */
  setDistortionScale(scale: number): void {
    this.distortionScale = scale
  }

  /**
   * Set distance falloff exponent.
   */
  setFalloff(falloff: number): void {
    this.falloff = falloff
  }

  /**
   * Set chromatic aberration amount (0-1).
   */
  setChromaticAberration(amount: number): void {
    this.chromaticAberration = amount
  }

  /**
   * Enable/disable hybrid sky cubemap sampling.
   */
  setHybridSkyEnabled(enabled: boolean): void {
    this.hybridSkyEnabled = enabled
  }

  /**
   * Set the sky cubemap for hybrid mode.
   * When set, background pixels will sample this cubemap with bent rays
   * instead of using screen-space UV distortion.
   */
  setSkyCubemap(cubemap: THREE.CubeTexture | null): void {
    this.skyCubemap = cubemap
  }

  /**
   * Get current lensing parameters.
   */
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
      intensity: this.intensity,
      mass: this.mass,
      distortionScale: this.distortionScale,
      falloff: this.falloff,
      chromaticAberration: this.chromaticAberration,
      hybridSkyEnabled: this.hybridSkyEnabled,
      hasSkyCubemap: this.skyCubemap !== null,
    }
  }

  dispose(): void {
    this.material.dispose()
    this.mesh.geometry.dispose()
    // Remove mesh from scene to ensure proper cleanup
    this.scene.remove(this.mesh)
  }
}
