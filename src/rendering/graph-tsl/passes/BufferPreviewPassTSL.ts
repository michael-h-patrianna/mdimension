/**
 * Buffer Preview Pass (TSL)
 *
 * Debug visualization pass for viewing various G-buffer contents using native TSL nodes:
 * - Depth buffer (raw, linear, focus zones)
 * - Normal buffer
 * - Temporal depth buffer
 * - Generic texture copy
 *
 * REWRITTEN: Now uses actual TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * @module rendering/graph-tsl/passes/BufferPreviewPassTSL
 */

import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  Fn,
  float,
  vec3,
  vec4,
  texture,
  uniform,
  screenUV,
  abs,
  length,
  step,
  clamp,
  select,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Buffer types that can be previewed.
 */
export type BufferType = 'copy' | 'depth' | 'normal' | 'temporalDepth'

/**
 * Depth visualization modes.
 */
export type DepthMode = 'raw' | 'linear' | 'focusZones'

/**
 * Configuration for BufferPreviewPassTSL.
 */
export interface BufferPreviewPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input resource to preview */
  bufferInput: string
  /** Additional input resources (for dynamic switching without recompiling) */
  additionalInputs?: string[]
  /** Output resource */
  outputResource: string
  /** Type of buffer being previewed */
  bufferType?: BufferType
  /** Depth visualization mode (for depth buffers) */
  depthMode?: DepthMode
  /** Camera near plane (for depth linearization) */
  nearClip?: number
  /** Camera far plane (for depth linearization) */
  farClip?: number
  /** Focus distance (for focus zones visualization) */
  focus?: number
  /** Focus range (for focus zones visualization) */
  focusRange?: number
}

// =============================================================================
// TSL Helper Functions
// =============================================================================

/**
 * Convert perspective depth to view Z
 */
const perspectiveDepthToViewZTSL = Fn(
  ([depth, near, far]: [
    ReturnType<typeof float>,
    UniformNode<number>,
    UniformNode<number>,
  ]) => {
    return near.mul(far).div(far.sub(near).mul(depth).sub(far))
  }
)

/**
 * Buffer preview pass for render graph using native TSL.
 *
 * Provides debug visualization of various G-buffer contents.
 * Useful for debugging depth, normals, and other intermediate buffers.
 *
 * @example
 * ```typescript
 * const depthPreview = new BufferPreviewPassTSL({
 *   id: 'depthPreview',
 *   bufferInput: 'sceneDepth',
 *   outputResource: 'previewOutput',
 *   bufferType: 'depth',
 *   depthMode: 'linear',
 *   nearClip: 0.1,
 *   farClip: 1000.0,
 * });
 * ```
 */
export class BufferPreviewPassTSL extends BasePassTSL {
  private bufferInputId: string
  private outputId: string
  private externalTexture: THREE.Texture | null = null

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Texture node (stable reference)
  private inputTexNode: ReturnType<typeof texture> | null = null

  // Uniforms
  private uType: UniformNode<number>
  private uDepthMode: UniformNode<number>
  private uNearClip: UniformNode<number>
  private uFarClip: UniformNode<number>
  private uFocus: UniformNode<number>
  private uFocusRange: UniformNode<number>

  // Size tracking
  private lastWidth = 0
  private lastHeight = 0

  constructor(config: BufferPreviewPassTSLConfig) {
    const inputIds = [config.bufferInput, ...(config.additionalInputs ?? [])]
    const uniqueInputs = Array.from(new Set(inputIds))

    super({
      id: config.id,
      name: config.name ?? 'Buffer Preview Pass (TSL)',
      inputs: uniqueInputs.map((resourceId) => ({ resourceId, access: 'read' as const })),
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.bufferInputId = config.bufferInput
    this.outputId = config.outputResource

    // Map buffer type to int
    const typeMap: Record<BufferType, number> = {
      copy: 0,
      depth: 1,
      normal: 2,
      temporalDepth: 3,
    }

    // Map depth mode to int
    const depthModeMap: Record<DepthMode, number> = {
      raw: 0,
      linear: 1,
      focusZones: 2,
    }

    // Initialize uniforms
    this.uType = uniform(typeMap[config.bufferType ?? 'copy'])
    this.uDepthMode = uniform(depthModeMap[config.depthMode ?? 'raw'])
    this.uNearClip = uniform(config.nearClip ?? 0.1)
    this.uFarClip = uniform(config.farClip ?? 1000.0)
    this.uFocus = uniform(config.focus ?? 10.0)
    this.uFocusRange = uniform(config.focusRange ?? 5.0)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Initialize the TSL material
   */
  private ensureInitialized(
    width: number,
    height: number,
    inputTex: THREE.Texture
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
      this.inputTexNode = texture(inputTex)

      // Build TSL shader
      const outputNode = this.buildPreviewShader()

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
      if (this.inputTexNode) this.inputTexNode.value = inputTex
    }
  }

  /**
   * Build the buffer preview TSL shader
   */
  private buildPreviewShader() {
    const inputTex = this.inputTexNode!
    const type = this.uType
    const depthMode = this.uDepthMode
    const nearClip = this.uNearClip
    const farClip = this.uFarClip
    const focus = this.uFocus
    const focusRange = this.uFocusRange

    return Fn(() => {
      const uv = screenUV
      const texel = inputTex.sample(uv)

      // Type 1: Depth Buffer
      const depth = texel.x

      // Mode 0: Raw Depth (Inverted: near=white, far=black)
      const rawDepthColor = vec4(vec3(float(1).sub(depth)), float(1))

      // Get view Z for linear and focus modes
      const viewZ = perspectiveDepthToViewZTSL(depth, nearClip, farClip).negate()

      // Mode 1: Linear Depth (normalized)
      const normalized = viewZ.sub(nearClip).div(farClip.sub(nearClip))
      const linearDepthColor = vec4(vec3(clamp(normalized, float(0), float(1))), float(1))

      // Mode 2: Focus Zones
      const diff = viewZ.sub(focus)
      const absDiff = abs(diff)
      const safeFocusRange = focusRange.max(0.0001)

      const inFocus = float(1).sub(clamp(absDiff.div(safeFocusRange), float(0), float(1)))
      const behind = clamp(diff.div(safeFocusRange.mul(3)), float(0), float(1))
      const infront = clamp(diff.negate().div(safeFocusRange.mul(3)), float(0), float(1))
      const focusZonesColor = vec4(behind, inFocus, infront, float(1))

      // Select depth mode result
      const depthResult = select(
        depthMode.equal(0),
        rawDepthColor,
        select(
          depthMode.equal(1),
          linearDepthColor,
          focusZonesColor
        )
      )

      // Type 2: Normal Buffer
      const normalRgb = texel.rgb
      const hasNormal = step(float(0.01), length(normalRgb))
      const displayNormal = normalRgb.mul(0.5).add(0.5)
      const emptyNormalColor = vec4(0.05, 0.05, 0.1, 1)
      const normalResult = select(
        hasNormal.lessThan(0.5),
        emptyNormalColor,
        vec4(displayNormal, float(1))
      )

      // Type 3: Temporal Depth
      const temporalDepth = texel.w  // Use .w (ray distance)
      const temporalNormalized = temporalDepth.sub(nearClip).div(farClip.sub(nearClip))
      const temporalColor = vec3(float(1).sub(clamp(temporalNormalized, float(0), float(1))))
      const temporalInvalid = vec4(float(0), float(0), float(0), float(1))
      const temporalValid = vec4(temporalColor, float(1))
      const temporalResult = select(
        temporalDepth.lessThan(0.0001),
        temporalInvalid,
        temporalValid
      )

      // Type 0: Copy (default)
      const copyResult = texel

      // Select final result based on type
      return select(
        type.equal(1),
        depthResult,
        select(
          type.equal(2),
          normalResult,
          select(
            type.equal(3),
            temporalResult,
            copyResult
          )
        )
      )
    })()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { camera, size } = ctx

    if (size.width < 1 || size.height < 1) {
      return
    }

    // Get textures
    const inputTex = this.externalTexture ?? ctx.getReadTexture(this.bufferInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    if (!inputTex || !outputTarget) {
      return
    }

    // Update camera clip planes if using depth visualization
    const perspCam = camera as THREE.PerspectiveCamera
    if (perspCam.near !== undefined) {
      this.uNearClip.value = perspCam.near
      this.uFarClip.value = perspCam.far
    }

    // Ensure material is initialized
    this.ensureInitialized(size.width, size.height, inputTex)

    if (!this.material || !this.scene) {
      return
    }

    // Render
    renderer.setRenderTarget(outputTarget as unknown as THREE.WebGLRenderTarget | null)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set buffer type to preview
   */
  setBufferType(type: BufferType): void {
    const typeMap: Record<BufferType, number> = {
      copy: 0,
      depth: 1,
      normal: 2,
      temporalDepth: 3,
    }
    this.uType.value = typeMap[type]
  }

  /**
   * Set which resource ID to preview
   */
  setBufferInput(resourceId: string): void {
    this.bufferInputId = resourceId
  }

  /**
   * Provide an external texture (bypasses resource lookup)
   */
  setExternalTexture(texture: THREE.Texture | null): void {
    this.externalTexture = texture
  }

  /**
   * Set depth visualization mode
   */
  setDepthMode(mode: DepthMode): void {
    const modeMap: Record<DepthMode, number> = {
      raw: 0,
      linear: 1,
      focusZones: 2,
    }
    this.uDepthMode.value = modeMap[mode]
  }

  /**
   * Set focus parameters for focus zones visualization
   */
  setFocusParams(focus: number, focusRange: number): void {
    this.uFocus.value = focus
    this.uFocusRange.value = focusRange
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
    this.inputTexNode = null
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
