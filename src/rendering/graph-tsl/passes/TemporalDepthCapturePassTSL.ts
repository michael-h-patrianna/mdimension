/**
 * Temporal Position Capture Pass (TSL)
 *
 * Captures gPosition buffer (world position + model-space ray distance) into a
 * temporal buffer for raymarching acceleration. Uses position-based reprojection
 * instead of depth-only to correctly handle camera rotation.
 *
 * Key improvement over depth-only approach:
 * - gPosition.xyz = actual world position (for accurate reprojection)
 * - gPosition.w = model-space ray distance (for direct use in raymarcher)
 *
 * REWRITTEN: Now uses native TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * @module rendering/graph-tsl/passes/TemporalDepthCapturePassTSL
 */

import { usePerformanceStore } from '@/stores/performanceStore'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, texture, screenUV } from 'three/tsl'
import { BasePassTSL } from '../BasePassTSL'
import type { RenderGraphTSL } from '../RenderGraphTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

// =============================================================================
// Temporal Depth Uniforms Interface
// =============================================================================

export interface TemporalDepthUniformsTSL {
  /** Previous frame's depth texture (legacy, kept for compatibility) */
  uPrevDepthTexture: THREE.Texture | null
  /** Previous frame's position texture (xyz=world pos, w=model-space ray distance) */
  uPrevPositionTexture: THREE.Texture | null
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: THREE.Matrix4
  /** Previous frame's inverse view-projection matrix */
  uPrevInverseViewProjectionMatrix: THREE.Matrix4
  /** Whether temporal reprojection is enabled and valid */
  uTemporalEnabled: boolean
  /** Buffer resolution for UV calculation */
  uDepthBufferResolution: THREE.Vector2
}

// =============================================================================
// Pass Configuration
// =============================================================================

export interface TemporalDepthCapturePassTSLConfig
  extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Position input resource ID (MRT with gPosition) */
  positionInput: string
  /**
   * Which attachment to read from the position input resource.
   * Should be 2 for gPosition (attachment index in MRT: 0=gColor, 1=gNormal, 2=gPosition)
   */
  positionAttachment: number
  /** Output resource ID (PingPong) */
  outputResource: string
  /** Force capture even when temporal reprojection is disabled */
  forceCapture?: () => boolean
}


// =============================================================================
// Global Registry for Invalidation
// =============================================================================

/** Registry of all active TemporalDepthCapturePassTSL instances for global invalidation */
const instanceRegistry = new Set<TemporalDepthCapturePassTSL>()

/**
 * Invalidate all registered TemporalDepthCapturePassTSL instances.
 */
export function invalidateAllTemporalDepthTSL(): void {
  instanceRegistry.forEach((instance) => {
    instance.invalidate()
  })
}

// =============================================================================
// Pass Implementation
// =============================================================================

/**
 * Captures gPosition into a temporal buffer for raymarching acceleration.
 *
 * Self-contained state management:
 * - Tracks previous frame's camera matrices internally
 * - Exposes getTemporalUniforms() for shader uniform binding
 * - Graph handles ping-pong buffer swap automatically
 */
export class TemporalDepthCapturePassTSL extends BasePassTSL {
  private positionInputId: string
  private positionAttachment: number
  private outputResourceId: string
  private forceCapture?: () => boolean

  // Rendering resources (lazy initialized)
  private material: MeshBasicNodeMaterial | null = null
  private fsQuad: THREE.Mesh | null = null
  private fsScene: THREE.Scene | null = null
  private fsCamera: THREE.OrthographicCamera

  // Texture node (stable reference for TSL)
  private positionTexNode: ReturnType<typeof texture> | null = null

  // Internal state
  private hasValidHistory = false
  private prevViewProjectionMatrix = new THREE.Matrix4()
  private prevInverseViewProjectionMatrix = new THREE.Matrix4()
  private resolution = new THREE.Vector2(1, 1)

  // Temp matrices
  private tempViewProjMatrix = new THREE.Matrix4()

  constructor(config: TemporalDepthCapturePassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'Temporal Position Capture Pass (TSL)',
      inputs: [
        { resourceId: config.positionInput, access: 'read', attachment: config.positionAttachment },
        { resourceId: config.outputResource, access: 'read' },
      ],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.positionInputId = config.positionInput
    this.positionAttachment = config.positionAttachment
    this.outputResourceId = config.outputResource
    this.forceCapture = config.forceCapture

    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Register for global invalidation
    instanceRegistry.add(this)
  }

  /**
   * Initialize TSL material lazily to avoid early compilation issues.
   */
  private ensureInitialized(positionTex: THREE.Texture): void {
    if (!this.material) {
      // Create stable texture node reference
      this.positionTexNode = texture(positionTex)

      // Build simple copy shader using TSL
      const copyOutput = Fn(() => {
        return this.positionTexNode!.sample(screenUV)
      })()

      // Create TSL material
      this.material = new MeshBasicNodeMaterial()
      this.material.outputNode = copyOutput
      // Set depth settings (type cast for TSL material)
      ;(this.material as unknown as { depthTest: boolean }).depthTest = false
      this.material.depthWrite = false

      // Create fullscreen quad
      const geometry = new THREE.PlaneGeometry(2, 2)
      this.fsQuad = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
      this.fsQuad.frustumCulled = false

      this.fsScene = new THREE.Scene()
      this.fsScene.add(this.fsQuad)
    } else {
      // Update texture value for existing node
      if (this.positionTexNode) {
        this.positionTexNode.value = positionTex
      }
    }
  }

  /**
   * Check if temporal reprojection is enabled in settings.
   */
  isEnabled(): boolean {
    return usePerformanceStore.getState().temporalReprojectionEnabled
  }

  /**
   * Get the output resource ID for this pass.
   */
  getOutputResourceId(): string {
    return this.outputResourceId
  }

  /**
   * Get temporal uniforms for shader binding.
   */
  getTemporalUniforms(graph: RenderGraphTSL, forceTexture = false): TemporalDepthUniformsTSL {
    const enabled = this.isEnabled() && this.hasValidHistory
    const texture = graph.getReadTexture(this.outputResourceId)
    const hasTexture = (enabled || forceTexture) && texture !== null

    return {
      uPrevDepthTexture: hasTexture ? texture : null,
      uPrevPositionTexture: hasTexture ? texture : null,
      uPrevViewProjectionMatrix: this.prevViewProjectionMatrix,
      uPrevInverseViewProjectionMatrix: this.prevInverseViewProjectionMatrix,
      uTemporalEnabled: enabled && texture !== null,
      uDepthBufferResolution: this.resolution,
    }
  }

  /**
   * Invalidate temporal data.
   */
  invalidate(): void {
    this.hasValidHistory = false
    this.prevViewProjectionMatrix.identity()
    this.prevInverseViewProjectionMatrix.identity()
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { camera } = ctx
    const positionTex = ctx.getReadTexture(this.positionInputId, this.positionAttachment)
    const writeTarget = ctx.getWriteTarget(this.outputResourceId)

    if (!positionTex || !writeTarget) {
      return
    }

    const force = this.forceCapture ? this.forceCapture() : false

    // Skip if disabled (unless forced)
    if (!force && !this.isEnabled()) {
      this.hasValidHistory = false
      return
    }

    // Update resolution from source texture
    const image = positionTex.image as { width?: number; height?: number } | undefined
    if (image && image.width !== undefined && image.height !== undefined) {
      this.resolution.set(image.width, image.height)
    }

    // Ensure TSL material is initialized
    this.ensureInitialized(positionTex)

    if (!this.material || !this.fsQuad || !this.fsScene) {
      return
    }

    // Render position copy
    renderer.setRenderTarget(writeTarget as THREE.WebGLRenderTarget)
    renderer.clear()
    renderer.render(this.fsScene, this.fsCamera)
    renderer.setRenderTarget(null)

    // Update internal state for next frame
    this.tempViewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.prevViewProjectionMatrix.copy(this.tempViewProjMatrix)
    this.prevInverseViewProjectionMatrix.copy(this.tempViewProjMatrix).invert()

    this.hasValidHistory = true
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    this.material?.dispose()
    this.material = null

    if (this.fsQuad) {
      this.fsQuad.geometry.dispose()
      this.fsScene?.remove(this.fsQuad)
      this.fsQuad = null
    }
    this.fsScene = null
    this.positionTexNode = null
    this.hasValidHistory = false
  }

  dispose(): void {
    this.releaseInternalResources()
    instanceRegistry.delete(this)
  }
}
