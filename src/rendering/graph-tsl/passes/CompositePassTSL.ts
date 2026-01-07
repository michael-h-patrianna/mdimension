/**
 * Composite Pass (TSL)
 *
 * Blends multiple input textures with configurable blend modes.
 * Useful for combining render layers, adding effects, etc.
 *
 * TSL port of the WebGL CompositePass with identical behavior.
 *
 * @module rendering/graph-tsl/passes/CompositePassTSL
 */

import * as THREE from 'three'
import {
  Fn,
  float,
  texture,
  uniform,
  screenUV,
  vec3,
  vec4,
  min,
  mix,
  select,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import type { RenderPassConfig } from '@/rendering/graph/types'
import { FullscreenPassTSL } from './FullscreenPassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Blend modes for compositing.
 */
export type BlendMode = 'add' | 'multiply' | 'screen' | 'alpha' | 'overlay'

/**
 * Input configuration for compositing.
 */
export interface CompositeInput {
  /** Resource ID for the input texture */
  resourceId: string
  /** Blend mode for this input */
  blendMode: BlendMode
  /** Blend weight (0-1) */
  weight?: number
}

/**
 * Configuration for CompositePassTSL.
 */
export interface CompositePassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input textures to composite */
  compositeInputs: CompositeInput[]
  /** Output resource ID */
  outputResource: string
  /** Background color for the output (default: transparent black) */
  backgroundColor?: THREE.ColorRepresentation
}

// Blend mode constants
const BLEND_ADD = 0
const BLEND_MULTIPLY = 1
const BLEND_SCREEN = 2
const BLEND_ALPHA = 3
const BLEND_OVERLAY = 4

/**
 * Blend functions in TSL
 */

/** Additive blending */
const blendAdd = Fn(([base, blend, weight]: [Node, Node, Node]) => {
  return base.add(blend.mul(weight))
})

/** Multiplicative blending */
const blendMultiply = Fn(([base, blend, weight]: [Node, Node, Node]) => {
  return mix(base, base.mul(blend), weight)
})

/** Screen blending */
const blendScreen = Fn(([base, blend, weight]: [Node, Node, Node]) => {
  const one = vec3(1, 1, 1)
  const screenResult = one.sub(one.sub(base).mul(one.sub(blend)))
  return mix(base, screenResult, weight)
})

/** Alpha blending */
const blendAlphaFn = Fn(([base, blend, alpha, weight]: [Node, Node, Node, Node]) => {
  return mix(base, blend, alpha.mul(weight))
})

/** Overlay blending - component-wise */
const blendOverlayComponent = Fn(([baseC, blendC]: [Node, Node]) => {
  // if (base < 0.5) { 2 * base * blend } else { 1 - 2 * (1 - base) * (1 - blend) }
  const isLight = baseC.greaterThanEqual(float(0.5))
  const dark = baseC.mul(blendC).mul(2)
  const light = float(1).sub(float(1).sub(baseC).mul(float(1).sub(blendC)).mul(2))
  return select(isLight, light, dark)
})

/** Overlay blending - full RGB */
const blendOverlay = Fn(([base, blend, weight]: [Node, Node, Node]) => {
  const r = blendOverlayComponent(base.x, blend.x)
  const g = blendOverlayComponent(base.y, blend.y)
  const b = blendOverlayComponent(base.z, blend.z)
  return mix(base, vec3(r, g, b), weight)
})

/**
 * Apply blend based on mode (integer uniform)
 */
const applyBlend = Fn(([base, inputRgb, inputAlpha, blendMode, weight]: [Node, Node, Node, Node, Node]) => {
  // Mode 0: add
  const result0 = blendAdd(base, inputRgb, weight)
  // Mode 1: multiply
  const result1 = blendMultiply(base, inputRgb, weight)
  // Mode 2: screen
  const result2 = blendScreen(base, inputRgb, weight)
  // Mode 3: alpha
  const result3 = blendAlphaFn(base, inputRgb, inputAlpha, weight)
  // Mode 4: overlay
  const result4 = blendOverlay(base, inputRgb, weight)

  // Nested select to choose blend mode
  return select(
    blendMode.equal(float(BLEND_ADD)),
    result0,
    select(
      blendMode.equal(float(BLEND_MULTIPLY)),
      result1,
      select(
        blendMode.equal(float(BLEND_SCREEN)),
        result2,
        select(
          blendMode.equal(float(BLEND_ALPHA)),
          result3,
          select(blendMode.equal(float(BLEND_OVERLAY)), result4, base)
        )
      )
    )
  )
})

/**
 * Blend alpha values based on blend mode
 */
const blendAlphaValue = Fn(([baseAlpha, inputAlpha, blendMode, weight]: [Node, Node, Node, Node]) => {
  // Mode 0: add - accumulate
  const result0 = min(baseAlpha.add(inputAlpha.mul(weight)), float(1))

  // Mode 1: multiply
  const result1 = mix(baseAlpha, baseAlpha.mul(inputAlpha), weight)

  // Mode 2: screen
  const screenResult = float(1).sub(float(1).sub(baseAlpha).mul(float(1).sub(inputAlpha)))
  const result2 = mix(baseAlpha, screenResult, weight)

  // Mode 3: alpha (Porter-Duff over)
  const srcA = inputAlpha.mul(weight)
  const result3 = srcA.add(baseAlpha.mul(float(1).sub(srcA)))

  // Mode 4: overlay
  const result4 = mix(baseAlpha, inputAlpha, weight)

  // Nested select
  return select(
    blendMode.equal(float(BLEND_ADD)),
    result0,
    select(
      blendMode.equal(float(BLEND_MULTIPLY)),
      result1,
      select(
        blendMode.equal(float(BLEND_SCREEN)),
        result2,
        select(
          blendMode.equal(float(BLEND_ALPHA)),
          result3,
          select(blendMode.equal(float(BLEND_OVERLAY)), result4, baseAlpha)
        )
      )
    )
  )
})

/**
 * Composites multiple input textures.
 *
 * Supports various blend modes for combining textures:
 * - add: Additive blending (good for glow, lights)
 * - multiply: Multiplicative blending (shadows, masks)
 * - screen: Screen blending (lightening)
 * - alpha: Standard alpha blending
 * - overlay: Overlay blending (contrast enhancement)
 *
 * @example
 * ```typescript
 * const composite = new CompositePassTSL({
 *   id: 'composite',
 *   compositeInputs: [
 *     { resourceId: 'sceneColor', blendMode: 'alpha', weight: 1.0 },
 *     { resourceId: 'bloom', blendMode: 'add', weight: 0.5 },
 *   ],
 *   outputResource: 'final',
 * });
 *
 * graph.addPass(composite);
 * ```
 */
export class CompositePassTSL extends FullscreenPassTSL {
  private compositeInputs: CompositeInput[]
  private backgroundColor: THREE.Color

  // TSL uniforms
  private uWeights: UniformNode<THREE.Vector4>
  private uBlendModes: UniformNode<THREE.Vector4>
  private uInputCount: UniformNode<number>
  private uBackgroundColor: UniformNode<THREE.Color>

  /**
   * Stable TextureNode references for WebGPU compatibility.
   * CRITICAL: Must reuse TextureNodes and update .value instead of
   * creating new texture() nodes, which would change the bind group layout
   * and cause "Invalid PipelineLayout" errors.
   */
  private texNodes: ReturnType<typeof texture>[] = []
  private placeholderTextures: THREE.DataTexture[] = []
  private textureNodesCreated = false

  constructor(config: CompositePassTSLConfig) {
    // Build inputs list from compositeInputs
    const inputs = config.compositeInputs.map((input) => ({
      resourceId: input.resourceId,
      access: 'read' as const,
    }))

    super({
      id: config.id,
      name: config.name ?? 'Composite Pass',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.compositeInputs = config.compositeInputs
    this.backgroundColor = new THREE.Color(config.backgroundColor ?? 0x000000)

    // Initialize uniforms
    this.uWeights = uniform(new THREE.Vector4(1, 1, 1, 1))
    this.uBlendModes = uniform(new THREE.Vector4(0, 0, 0, 0))
    this.uInputCount = uniform(0)
    this.uBackgroundColor = uniform(this.backgroundColor)

    // Create placeholder textures for stable TextureNode binding (WebGPU)
    const inputCount = Math.min(config.compositeInputs.length, 4)
    const size = 4
    for (let i = 0; i < inputCount; i++) {
      const data = new Uint8Array(size * size * 4).fill(128)
      const placeholder = new THREE.DataTexture(
        data,
        size,
        size,
        THREE.RGBAFormat,
        THREE.UnsignedByteType
      )
      placeholder.minFilter = THREE.LinearFilter
      placeholder.magFilter = THREE.LinearFilter
      placeholder.wrapS = THREE.ClampToEdgeWrapping
      placeholder.wrapT = THREE.ClampToEdgeWrapping
      placeholder.needsUpdate = true
      this.placeholderTextures.push(placeholder)
    }
  }

  /**
   * Ensure stable TextureNodes are created ONCE with placeholders.
   * Called once during first createOutputNode.
   */
  private ensureTextureNodes(): void {
    if (this.textureNodesCreated) return

    // Create stable TextureNodes with placeholder textures
    for (const placeholder of this.placeholderTextures) {
      this.texNodes.push(texture(placeholder))
    }

    this.textureNodesCreated = true
  }

  /**
   * Create the TSL output node for compositing.
   */
  protected createOutputNode(_ctx: RenderContextTSL): Node {
    // Ensure stable texture nodes exist
    this.ensureTextureNodes()

    // Get count of inputs (already limited to 4 in constructor)
    const inputCount = Math.min(this.compositeInputs.length, 4)

    // Update input count uniform
    this.uInputCount.value = inputCount

    // Set up weights and blend modes
    for (let i = 0; i < inputCount; i++) {
      const input = this.compositeInputs[i]!
      const weight = input.weight ?? 1.0
      const blendMode = this.blendModeToInt(input.blendMode)

      if (i === 0) {
        this.uWeights.value.x = weight
        this.uBlendModes.value.x = blendMode
      } else if (i === 1) {
        this.uWeights.value.y = weight
        this.uBlendModes.value.y = blendMode
      } else if (i === 2) {
        this.uWeights.value.z = weight
        this.uBlendModes.value.z = blendMode
      } else {
        this.uWeights.value.w = weight
        this.uBlendModes.value.w = blendMode
      }
    }

    // Capture stable texture node references for use in shader
    const texNodesCaptured = this.texNodes

    return Fn(() => {
      const uv = screenUV
      let result = vec3(
        this.uBackgroundColor.value.r,
        this.uBackgroundColor.value.g,
        this.uBackgroundColor.value.b
      )
      let alpha = float(0)

      const inputCountU = this.uInputCount
      const weights = this.uWeights
      const blendModes = this.uBlendModes

      // Process each input using stable TextureNodes
      if (texNodesCaptured.length >= 1) {
        const input0 = texNodesCaptured[0]!.sample(uv)
        const shouldProcess0 = inputCountU.greaterThanEqual(float(1))
        const newResult0 = applyBlend(result, input0.xyz, input0.w, blendModes.x, weights.x)
        const newAlpha0 = blendAlphaValue(alpha, input0.w, blendModes.x, weights.x)
        result = select(shouldProcess0, newResult0, result)
        alpha = select(shouldProcess0, newAlpha0, alpha)
      }

      if (texNodesCaptured.length >= 2) {
        const input1 = texNodesCaptured[1]!.sample(uv)
        const shouldProcess1 = inputCountU.greaterThanEqual(float(2))
        const newResult1 = applyBlend(result, input1.xyz, input1.w, blendModes.y, weights.y)
        const newAlpha1 = blendAlphaValue(alpha, input1.w, blendModes.y, weights.y)
        result = select(shouldProcess1, newResult1, result)
        alpha = select(shouldProcess1, newAlpha1, alpha)
      }

      if (texNodesCaptured.length >= 3) {
        const input2 = texNodesCaptured[2]!.sample(uv)
        const shouldProcess2 = inputCountU.greaterThanEqual(float(3))
        const newResult2 = applyBlend(result, input2.xyz, input2.w, blendModes.z, weights.z)
        const newAlpha2 = blendAlphaValue(alpha, input2.w, blendModes.z, weights.z)
        result = select(shouldProcess2, newResult2, result)
        alpha = select(shouldProcess2, newAlpha2, alpha)
      }

      if (texNodesCaptured.length >= 4) {
        const input3 = texNodesCaptured[3]!.sample(uv)
        const shouldProcess3 = inputCountU.greaterThanEqual(float(4))
        const newResult3 = applyBlend(result, input3.xyz, input3.w, blendModes.w, weights.w)
        const newAlpha3 = blendAlphaValue(alpha, input3.w, blendModes.w, weights.w)
        result = select(shouldProcess3, newResult3, result)
        alpha = select(shouldProcess3, newAlpha3, alpha)
      }

      return vec4(result.x, result.y, result.z, alpha)
    })()
  }

  /**
   * Update uniforms - update texture values at runtime.
   *
   * CRITICAL for WebGPU: Updates texture .value instead of invalidating material.
   * Invalidating material would trigger recompilation and cause pipeline errors.
   */
  protected updateUniforms(ctx: RenderContextTSL): void {
    // Update weights and blend modes each frame
    const inputCount = Math.min(this.compositeInputs.length, 4)

    for (let i = 0; i < inputCount; i++) {
      const input = this.compositeInputs[i]!
      const weight = input.weight ?? 1.0
      const blendMode = this.blendModeToInt(input.blendMode)

      if (i === 0) {
        this.uWeights.value.x = weight
        this.uBlendModes.value.x = blendMode
      } else if (i === 1) {
        this.uWeights.value.y = weight
        this.uBlendModes.value.y = blendMode
      } else if (i === 2) {
        this.uWeights.value.z = weight
        this.uBlendModes.value.z = blendMode
      } else {
        this.uWeights.value.w = weight
        this.uBlendModes.value.w = blendMode
      }
    }

    this.uInputCount.value = inputCount

    // Update texture values at runtime (NOT invalidate material)
    // This is the key fix for WebGPU compatibility
    for (let i = 0; i < inputCount; i++) {
      const input = this.compositeInputs[i]!
      const currentTexture = ctx.getReadTexture(input.resourceId)
      if (currentTexture && this.texNodes[i]) {
        ;(this.texNodes[i] as unknown as { value: THREE.Texture }).value = currentTexture
      }
    }
  }

  /**
   * Convert blend mode string to integer.
   */
  private blendModeToInt(mode: BlendMode): number {
    const modeMap: Record<BlendMode, number> = {
      add: BLEND_ADD,
      multiply: BLEND_MULTIPLY,
      screen: BLEND_SCREEN,
      alpha: BLEND_ALPHA,
      overlay: BLEND_OVERLAY,
    }
    return modeMap[mode]
  }

  /**
   * Update input weight.
   */
  setInputWeight(index: number, weight: number): void {
    const input = this.compositeInputs[index]
    if (input) {
      input.weight = weight
    }
  }

  /**
   * Update input blend mode.
   */
  setInputBlendMode(index: number, mode: BlendMode): void {
    const input = this.compositeInputs[index]
    if (input) {
      input.blendMode = mode
    }
  }

  /**
   * Set background color.
   */
  setBackgroundColor(color: THREE.ColorRepresentation): void {
    this.backgroundColor.set(color)
    this.uBackgroundColor.value.copy(this.backgroundColor)
  }

  /**
   * Dispose resources including placeholder textures.
   */
  protected onDispose(): void {
    for (const placeholder of this.placeholderTextures) {
      placeholder.dispose()
    }
    this.placeholderTextures = []
    this.texNodes = []
    this.textureNodesCreated = false
  }
}
