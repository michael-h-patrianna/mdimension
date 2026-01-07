/**
 * FXAA Pass (TSL)
 *
 * Render graph pass for Fast Approximate Anti-Aliasing.
 * Provides edge smoothing with minimal performance cost.
 *
 * Uses FXAA 3.11 algorithm (Nvidia) with TSL nodes.
 * Based on Timothy Lottes' original implementation.
 *
 * REWRITTEN: Now uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture nodes once with placeholder and updates .value at runtime.
 *
 * @module rendering/graph-tsl/passes/FXAAPassTSL
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
  abs,
  max,
  min,
  clamp,
  dot,
  select,
  type UniformNode,
} from 'three/tsl'
import type { Node } from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for FXAAPassTSL.
 */
export interface FXAAPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input color resource */
  colorInput: string
  /** Output resource */
  outputResource: string
}

// FXAA quality settings
const EDGE_THRESHOLD_MIN = 0.0312
const EDGE_THRESHOLD_MAX = 0.125
const SUBPIXEL_QUALITY = 0.75

/**
 * RGB to luma conversion (Rec. 601)
 */
const rgb2luma = Fn(([rgb]: [Node]) => {
  return dot(rgb, vec3(0.299, 0.587, 0.114))
})

/**
 * Simplified FXAA TSL node.
 *
 * This is a simplified version optimized for TSL that:
 * 1. Detects high-contrast edges
 * 2. Blends along edge direction
 * 3. Applies subpixel anti-aliasing
 */
const createFXAANode = (
  texNode: ReturnType<typeof texture>,
  resolution: UniformNode<THREE.Vector2>
) => {
  return Fn(() => {
    const currentUv = screenUV
    const colorCenter = texNode.sample(currentUv)
    const lumaCenter = rgb2luma(colorCenter.xyz)

    // Sample 4 direct neighbors
    const lumaDown = rgb2luma(texNode.sample(currentUv.add(vec2(0, resolution.y.negate()))).xyz)
    const lumaUp = rgb2luma(texNode.sample(currentUv.add(vec2(0, resolution.y))).xyz)
    const lumaLeft = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x.negate(), 0))).xyz)
    const lumaRight = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x, 0))).xyz)

    // Find luma range
    const lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)))
    const lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)))
    const lumaRange = lumaMax.sub(lumaMin)

    // Early exit threshold
    const threshold = max(float(EDGE_THRESHOLD_MIN), lumaMax.mul(EDGE_THRESHOLD_MAX))

    // If low contrast, return original color
    const isLowContrast = lumaRange.lessThan(threshold)

    // Sample corner neighbors
    const lumaDownLeft = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x.negate(), resolution.y.negate()))).xyz)
    const lumaUpRight = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x, resolution.y))).xyz)
    const lumaUpLeft = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x.negate(), resolution.y))).xyz)
    const lumaDownRight = rgb2luma(texNode.sample(currentUv.add(vec2(resolution.x, resolution.y.negate()))).xyz)

    // Compute edge direction
    const lumaDownUp = lumaDown.add(lumaUp)
    const lumaLeftRight = lumaLeft.add(lumaRight)
    const lumaLeftCorners = lumaDownLeft.add(lumaUpLeft)
    const lumaDownCorners = lumaDownLeft.add(lumaDownRight)
    const lumaRightCorners = lumaDownRight.add(lumaUpRight)
    const lumaUpCorners = lumaUpRight.add(lumaUpLeft)

    const edgeHorizontal = abs(lumaLeft.mul(-2).add(lumaLeftCorners))
      .add(abs(lumaCenter.mul(-2).add(lumaDownUp)).mul(2))
      .add(abs(lumaRight.mul(-2).add(lumaRightCorners)))

    const edgeVertical = abs(lumaUp.mul(-2).add(lumaUpCorners))
      .add(abs(lumaCenter.mul(-2).add(lumaLeftRight)).mul(2))
      .add(abs(lumaDown.mul(-2).add(lumaDownCorners)))

    const isHorizontal = edgeHorizontal.greaterThanEqual(edgeVertical)

    // Calculate step length based on edge orientation
    const stepLength = select(isHorizontal, resolution.y, resolution.x)

    // Select neighbors perpendicular to edge
    const luma1 = select(isHorizontal, lumaDown, lumaLeft)
    const luma2 = select(isHorizontal, lumaUp, lumaRight)
    const gradient1 = luma1.sub(lumaCenter)
    const gradient2 = luma2.sub(lumaCenter)

    // Determine steeper gradient
    const is1Steepest = abs(gradient1).greaterThanEqual(abs(gradient2))
    // gradientScaled used in full FXAA for edge endpoint detection
    const lumaLocalAverage = select(
      is1Steepest,
      luma1.add(lumaCenter).mul(0.5),
      luma2.add(lumaCenter).mul(0.5)
    )

    // Calculate step direction
    const stepDir = select(is1Steepest, stepLength.negate(), stepLength)

    // Apply offset
    const offsetUv = select(
      isHorizontal,
      currentUv.add(vec2(0, stepDir.mul(0.5))),
      currentUv.add(vec2(stepDir.mul(0.5), 0))
    )

    // Simple edge search (2 iterations for performance)
    const searchOffset = select(isHorizontal, vec2(resolution.x, 0), vec2(0, resolution.y))
    const uv1 = offsetUv.sub(searchOffset)
    const uv2 = offsetUv.add(searchOffset)

    // Edge endpoint detection (simplified - full FXAA uses iterative search)
    // These values could be used for more accurate edge detection but simplified version
    // uses distance-based blending directly
    const _lumaEnd1 = rgb2luma(texNode.sample(uv1).xyz).sub(lumaLocalAverage)
    const _lumaEnd2 = rgb2luma(texNode.sample(uv2).xyz).sub(lumaLocalAverage)
    void _lumaEnd1 // Mark as intentionally unused in simplified version
    void _lumaEnd2

    // Calculate blend
    const distance1 = select(isHorizontal, currentUv.x.sub(uv1.x), currentUv.y.sub(uv1.y))
    const distance2 = select(isHorizontal, uv2.x.sub(currentUv.x), uv2.y.sub(currentUv.y))

    const _isDirection1 = distance1.lessThan(distance2)
    void _isDirection1 // Mark as intentionally unused in simplified version
    const distanceFinal = min(distance1, distance2)
    const edgeThickness = distance1.add(distance2)

    // Final offset - guard against division by zero
    const safeThickness = max(edgeThickness, float(0.0001))
    const pixelOffset = distanceFinal.negate().div(safeThickness).add(0.5)

    // Subpixel anti-aliasing - guard against division by zero
    const safeLumaRange = max(lumaRange, float(0.0001))
    const lumaAverage = lumaDownUp.add(lumaLeftRight).mul(2).add(lumaLeftCorners).add(lumaRightCorners).mul(1.0 / 12.0)
    const subPixelOffset1 = clamp(abs(lumaAverage.sub(lumaCenter)).div(safeLumaRange), float(0), float(1))
    const subPixelOffset2 = subPixelOffset1.mul(-2).add(3).mul(subPixelOffset1).mul(subPixelOffset1)
    const subPixelOffsetFinal = subPixelOffset2.mul(subPixelOffset2).mul(SUBPIXEL_QUALITY)

    const finalOffset = max(pixelOffset, subPixelOffsetFinal)

    // Apply final offset
    const finalUv = select(
      isHorizontal,
      currentUv.add(vec2(0, finalOffset.mul(stepDir))),
      currentUv.add(vec2(finalOffset.mul(stepDir), 0))
    )

    const fxaaColor = texNode.sample(finalUv)

    // Return original if low contrast, else FXAA result
    return select(isLowContrast, colorCenter, fxaaColor)
  })()
}

/**
 * Fast Approximate Anti-Aliasing pass.
 *
 * Uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture node once with placeholder and updates .value at runtime.
 *
 * @example
 * ```typescript
 * const fxaaPass = new FXAAPassTSL({
 *   id: 'fxaa',
 *   colorInput: 'sceneColor',
 *   outputResource: 'antialiasedOutput',
 * });
 * ```
 */
export class FXAAPassTSL extends BasePassTSL {
  private colorInputId: string
  private outputId: string

  // Material and rendering
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera

  // Stable texture node for WebGPU compatibility
  private placeholderTexture: THREE.DataTexture
  private colorTexNode: ReturnType<typeof texture> | null = null

  // TSL uniforms
  private uResolution: UniformNode<THREE.Vector2>

  constructor(config: FXAAPassTSLConfig) {
    super({
      id: config.id,
      name: config.name ?? 'FXAA Pass',
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.outputId = config.outputResource

    // Initialize uniforms
    this.uResolution = uniform(new THREE.Vector2(1 / 1920, 1 / 1080))

    // Create placeholder texture for stable binding (WebGPU requirement)
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderTexture.needsUpdate = true

    // Create orthographic camera for fullscreen rendering
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  /**
   * Ensure material is created with stable texture node.
   */
  private ensureMaterial(): void {
    if (this.material) return

    // Create stable texture node with placeholder
    this.colorTexNode = texture(this.placeholderTexture)

    // Build the FXAA shader graph
    const outputNode = createFXAANode(this.colorTexNode, this.uResolution)

    // Create material
    this.material = new MeshBasicNodeMaterial()
    this.material.outputNode = outputNode
    ;(this.material as unknown as { depthTest: boolean }).depthTest = false
    this.material.depthWrite = false

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry, this.material as unknown as THREE.Material)
    this.mesh.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer as SupportedRenderer
    const { size } = ctx

    // Get input texture
    const colorTex = ctx.getReadTexture(this.colorInputId)
    if (!colorTex) {
      console.warn(`FXAAPassTSL: Input '${this.colorInputId}' not found`)
      return
    }

    const outputTarget = ctx.getWriteTarget(this.outputId)

    // Ensure material is initialized
    this.ensureMaterial()

    if (!this.material || !this.scene || !this.mesh) {
      return
    }

    // Update texture value (not the node - keeps WebGPU binding stable)
    if (this.colorTexNode) {
      ;(this.colorTexNode as unknown as { value: THREE.Texture }).value = colorTex
    }

    // Update resolution uniform
    if (size.width > 0 && size.height > 0) {
      this.uResolution.value.set(1 / size.width, 1 / size.height)
    }

    // Render
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Release internal GPU resources when pass is disabled.
   */
  releaseInternalResources(): void {
    // Keep material for quick re-enable, just mark for update
    // This avoids shader recompilation on re-enable
  }

  dispose(): void {
    this.material?.dispose()
    this.material = null

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.scene?.remove(this.mesh)
      this.mesh = null
    }

    this.scene = null
    this.placeholderTexture.dispose()
    this.colorTexNode = null
  }
}
