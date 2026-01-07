/**
 * Tone Mapping Pass (TSL)
 *
 * Converts HDR color values to LDR for display.
 * Implements common tone mapping algorithms in TSL.
 *
 * Pipeline position: After all HDR effects, before film grain and AA.
 * This ensures HDR effects work in linear space, while AA/grain work on LDR.
 *
 * Algorithms:
 * - None (0): Pass-through
 * - Linear (1): Simple exposure clamp
 * - Reinhard (2): Classic HDR operator
 * - ACES Filmic (4): Industry standard
 *
 * REWRITTEN: Now uses stable TextureNode pattern for WebGPU compatibility.
 * Creates texture node once with placeholder and updates .value at runtime.
 *
 * @module rendering/graph-tsl/passes/ToneMappingPassTSL
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
  pow,
  clamp,
  max,
  select,
} from 'three/tsl'
import type { Node, UniformNode } from 'three/tsl'

import type { RenderPassConfig } from '@/rendering/graph/types'
import { FullscreenPassTSL } from './FullscreenPassTSL'
import type { RenderContextTSL } from '../types'

/**
 * Configuration for ToneMappingPassTSL.
 */
export interface ToneMappingPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Input HDR color resource */
  colorInput: string
  /** Output LDR color resource */
  outputResource: string
  /** Initial tone mapping mode (Three.js constant) */
  toneMapping?: number
  /** Initial exposure value */
  exposure?: number
}

// =============================================================================
// TSL Tone Mapping Implementations
// =============================================================================

/**
 * Saturate helper - clamp to [0, 1]
 */
const saturate = Fn(([color]: [Node]) => {
  return clamp(color, float(0.0), float(1.0))
})

/**
 * Reinhard tone mapping
 */
const reinhardToneMapping = Fn(([color, exposure]: [Node, Node]) => {
  const c = color.mul(exposure)
  return saturate(c.div(vec3(1.0, 1.0, 1.0).add(c)))
})

/**
 * Cineon tone mapping
 */
const cineonToneMapping = Fn(([color, exposure]: [Node, Node]) => {
  const c = max(vec3(0.0, 0.0, 0.0), color.mul(exposure).sub(float(0.004)))
  const numerator = c.mul(c.mul(float(6.2)).add(float(0.5)))
  const denominator = c.mul(c.mul(float(6.2)).add(float(1.7))).add(float(0.06))
  return pow(numerator.div(max(denominator, vec3(0.0001, 0.0001, 0.0001))), vec3(2.2, 2.2, 2.2))
})

/**
 * ACES RRT and ODT fit helper
 */
const rrtAndOdtFit = Fn(([v]: [Node]) => {
  const a = v.mul(v.add(float(0.0245786))).sub(float(0.000090537))
  const b = v.mul(v.mul(float(0.983729)).add(float(0.4329510))).add(float(0.238081))
  return a.div(max(b, vec3(0.0001, 0.0001, 0.0001)))
})

/**
 * Simplified ACES Filmic tone mapping (without matrix transforms for TSL compatibility)
 * Uses approximated transform that matches visually
 */
const acesFilmicToneMapping = Fn(([color, exposure]: [Node, Node]) => {
  // Simplified ACES without matrix transforms
  // Uses the RRT+ODT fit directly on exposed color
  let c = color.mul(exposure.div(float(0.6)))

  // Apply ACES input matrix transform manually
  // ACESInputMat * color
  const r = c.x.mul(float(0.59719)).add(c.y.mul(float(0.35458))).add(c.z.mul(float(0.04823)))
  const g = c.x.mul(float(0.07600)).add(c.y.mul(float(0.90834))).add(c.z.mul(float(0.01566)))
  const b = c.x.mul(float(0.02840)).add(c.y.mul(float(0.13383))).add(c.z.mul(float(0.83777)))
  c = vec3(r, g, b)

  // RRT + ODT fit
  c = rrtAndOdtFit(c)

  // Apply ACES output matrix transform manually
  // ACESOutputMat * color
  const ro = c.x.mul(float(1.60475)).add(c.y.mul(float(-0.53108))).add(c.z.mul(float(-0.07367)))
  const go = c.x.mul(float(-0.10208)).add(c.y.mul(float(1.10813))).add(c.z.mul(float(-0.00605)))
  const bo = c.x.mul(float(-0.00327)).add(c.y.mul(float(-0.07276))).add(c.z.mul(float(1.07602)))

  return saturate(vec3(ro, go, bo))
})

/**
 * Applies tone mapping to convert HDR to LDR.
 *
 * Uses uniform-based algorithm selection for efficiency (no shader recompilation).
 * Matches Three.js tone mapping constants for compatibility.
 *
 * @example
 * ```typescript
 * const toneMapping = new ToneMappingPassTSL({
 *   id: 'toneMapping',
 *   colorInput: 'hdrColor',
 *   outputResource: 'ldrColor',
 *   toneMapping: THREE.ACESFilmicToneMapping,
 *   exposure: 1.0,
 * });
 * ```
 */
export class ToneMappingPassTSL extends FullscreenPassTSL {
  private inputResourceId: string

  // TSL uniforms
  private uToneMapping: UniformNode<number>
  private uExposure: UniformNode<number>

  // Placeholder texture for stable TextureNode pattern (WebGPU compatibility)
  // CRITICAL: Must create texture node ONCE with placeholder and update .value at runtime
  private placeholderTexture: THREE.DataTexture

  // Stable TextureNode reference - created once, value updated at runtime
  private texNode: ReturnType<typeof texture> | null = null

  constructor(config: ToneMappingPassTSLConfig) {
    super({
      id: config.id,
      name: config.name,
      inputs: [{ resourceId: config.colorInput, access: 'read' }],
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.inputResourceId = config.colorInput

    // Initialize uniforms
    this.uToneMapping = uniform(config.toneMapping ?? THREE.NoToneMapping)
    this.uExposure = uniform(config.exposure ?? 1.0)

    // Create placeholder texture for stable TextureNode creation
    // Use 4x4 for WebGPU compatibility as per docs/tsl.md
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(128)
    this.placeholderTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    this.placeholderTexture.minFilter = THREE.LinearFilter
    this.placeholderTexture.magFilter = THREE.LinearFilter
    this.placeholderTexture.needsUpdate = true
  }

  /**
   * Create the TSL output node for tone mapping.
   *
   * CRITICAL for WebGPU: Creates stable TextureNode ONCE with placeholder.
   * The texture value is updated at runtime via updateUniforms().
   */
  protected createOutputNode(ctx: RenderContextTSL): Node {
    // Create stable TextureNode ONCE with placeholder
    if (!this.texNode) {
      this.texNode = texture(this.placeholderTexture)
    }

    // Update texture value from context if available
    const inputTexture = ctx.getReadTexture(this.inputResourceId)
    if (inputTexture) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = inputTexture
    } else {
      console.warn(`ToneMappingPassTSL: Input '${this.inputResourceId}' not yet available, using placeholder`)
    }

    const texNodeRef = this.texNode
    const toneMapping = this.uToneMapping
    const exposure = this.uExposure

    // Build tone mapping node
    return Fn(() => {
      const color = texNodeRef.sample(screenUV)
      const rgb = color.xyz

      // Dispatch based on tone mapping mode
      // NoToneMapping = 0
      const result0 = rgb

      // Linear = 1
      const result1 = saturate(rgb.mul(exposure))

      // Reinhard = 2
      const result2 = reinhardToneMapping(rgb, exposure)

      // Cineon = 3
      const result3 = cineonToneMapping(rgb, exposure)

      // ACESFilmic = 4
      const result4 = acesFilmicToneMapping(rgb, exposure)

      // Select based on mode using nested selects
      const mapped = select(
        toneMapping.equal(float(0)),
        result0,
        select(
          toneMapping.equal(float(1)),
          result1,
          select(
            toneMapping.equal(float(2)),
            result2,
            select(
              toneMapping.equal(float(3)),
              result3,
              select(toneMapping.equal(float(4)), result4, result0)
            )
          )
        )
      )

      return vec4(mapped.x, mapped.y, mapped.z, color.w)
    })()
  }

  /**
   * Update uniforms from context.
   *
   * CRITICAL for WebGPU: Updates texture value directly instead of invalidating material.
   * This prevents pipeline recreation and avoids "Invalid PipelineLayout" errors.
   */
  protected updateUniforms(ctx: RenderContextTSL): void {
    // Update texture value directly (NOT invalidate material)
    const currentTexture = ctx.getReadTexture(this.inputResourceId)
    if (currentTexture && this.texNode) {
      ;(this.texNode as unknown as { value: THREE.Texture }).value = currentTexture
    }
  }

  /**
   * Set tone mapping algorithm (Three.js constant).
   * @param mode - The tone mapping mode constant
   */
  setToneMapping(mode: number): void {
    this.uToneMapping.value = mode
  }

  /**
   * Set exposure value.
   * @param exposure - The exposure value
   */
  setExposure(exposure: number): void {
    this.uExposure.value = exposure
  }

  /**
   * Get current settings.
   * @returns Object with tone mapping and exposure settings
   */
  getSettings(): { toneMapping: number; exposure: number } {
    return {
      toneMapping: this.uToneMapping.value,
      exposure: this.uExposure.value,
    }
  }

  /**
   * Cleanup resources when pass is disposed.
   */
  protected onDispose(): void {
    this.placeholderTexture.dispose()
    this.texNode = null
  }
}
