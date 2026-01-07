/**
 * SSR Pass (TSL)
 *
 * Render graph pass for screen-space reflections.
 * Uses ray marching in screen space to find reflections.
 *
 * OPTIMIZATION: Supports half-resolution rendering with bilateral upsampling
 * for 50-75% performance improvement with minimal visual quality loss.
 *
 * REWRITTEN: Now uses actual TSL nodes instead of GLSL ShaderMaterial.
 * This enables WebGPU compatibility while maintaining identical behavior.
 *
 * @module rendering/graph-tsl/passes/SSRPassTSL
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
  abs,
  max,
  dot,
  cross,
  normalize,
  reflect,
  length,
  smoothstep,
  mix,
  select,
  If,
  Loop,
  Break,
  Continue,
  type UniformNode,
} from 'three/tsl'

import { BasePassTSL } from '../BasePassTSL'
import type { RenderContextTSL, SupportedRenderer, SupportedRenderTarget } from '../types'
import type { RenderPassConfig } from '@/rendering/graph/types'

/**
 * Configuration for SSRPassTSL.
 */
export interface SSRPassTSLConfig extends Omit<RenderPassConfig, 'inputs' | 'outputs'> {
  /** Scene color input resource */
  colorInput: string
  /** Normal buffer input resource */
  normalInput: string
  /** Depth buffer input resource */
  depthInput: string
  /** Depth input attachment (for depth textures on render targets) */
  depthInputAttachment?: number | 'depth'
  /** Alternate depth input resource (optional) */
  alternateDepthInput?: string
  /** Alternate depth input attachment */
  alternateDepthInputAttachment?: number | 'depth'
  /** Optional selector for choosing depth input at runtime */
  depthInputSelector?: () => string
  /** Output resource */
  outputResource: string

  /** Reflection intensity (0-1) */
  intensity?: number
  /** Max ray distance */
  maxDistance?: number
  /** Depth thickness for hit detection */
  thickness?: number
  /** Fade start distance */
  fadeStart?: number
  /** Fade end distance */
  fadeEnd?: number
  /** Max ray march steps */
  maxSteps?: number
  /**
   * Enable half-resolution rendering with bilateral upsampling.
   * OPTIMIZATION: Reduces SSR cost by 50-75% with minimal quality loss.
   * @default true
   */
  halfResolution?: boolean
  /**
   * Depth threshold for bilateral upsampling.
   * Lower values = sharper edges but potential artifacts.
   * @default 0.01
   */
  bilateralDepthThreshold?: number
}

// =============================================================================
// TSL SSR Helper Functions
// =============================================================================

/**
 * Get view-space position from UV and depth
 */
const getViewPositionTSL = Fn(
  ([
    uv,
    depth,
    invProjMatrix,
  ]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    // Clip position
    const clipX = uv.x.mul(2).sub(1)
    const clipY = uv.y.mul(2).sub(1)
    const clipZ = depth.mul(2).sub(1)
    const clipPos = vec4(clipX, clipY, clipZ, float(1))

    // Apply inverse projection - manual matrix multiplication
    // viewPos = invProjMatrix * clipPos
    // Since TSL doesn't have direct mat4 * vec4, we compute element-by-element
    // This is a simplified approach - we rely on the uniform being a mat4
    const m = invProjMatrix

    // Matrix multiplication: each row of matrix dot with clipPos
    const viewX = m.element(0).mul(clipPos.x).add(m.element(4).mul(clipPos.y)).add(m.element(8).mul(clipPos.z)).add(m.element(12).mul(clipPos.w))
    const viewY = m.element(1).mul(clipPos.x).add(m.element(5).mul(clipPos.y)).add(m.element(9).mul(clipPos.z)).add(m.element(13).mul(clipPos.w))
    const viewZ = m.element(2).mul(clipPos.x).add(m.element(6).mul(clipPos.y)).add(m.element(10).mul(clipPos.z)).add(m.element(14).mul(clipPos.w))
    const viewW = m.element(3).mul(clipPos.x).add(m.element(7).mul(clipPos.y)).add(m.element(11).mul(clipPos.z)).add(m.element(15).mul(clipPos.w))

    // Perspective divide with safe denominator
    const safeW = select(abs(viewW).lessThan(0.0001), float(0.0001), viewW)

    return vec3(viewX.div(safeW), viewY.div(safeW), viewZ.div(safeW))
  }
)

/**
 * Project view-space position to screen UV
 */
const projectToScreenTSL = Fn(
  ([viewPos, projMatrix]: [ReturnType<typeof vec3>, UniformNode<THREE.Matrix4>]) => {
    const m = projMatrix

    // Matrix multiplication: projMatrix * vec4(viewPos, 1.0)
    const clipX = m.element(0).mul(viewPos.x).add(m.element(4).mul(viewPos.y)).add(m.element(8).mul(viewPos.z)).add(m.element(12))
    const clipY = m.element(1).mul(viewPos.x).add(m.element(5).mul(viewPos.y)).add(m.element(9).mul(viewPos.z)).add(m.element(13))
    const clipW = m.element(3).mul(viewPos.x).add(m.element(7).mul(viewPos.y)).add(m.element(11).mul(viewPos.z)).add(m.element(15))

    // Perspective divide with safe denominator
    const safeW = select(abs(clipW).lessThan(0.0001), float(0.0001), clipW)

    // NDC to UV
    return vec2(clipX.div(safeW).mul(0.5).add(0.5), clipY.div(safeW).mul(0.5).add(0.5))
  }
)

/**
 * Reconstruct normal from depth buffer using neighboring samples
 */
const reconstructNormalTSL = Fn(
  ([
    coord,
    depthTex,
    resolution,
    invProjMatrix,
  ]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof texture>,
    UniformNode<THREE.Vector2>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    const texel = vec2(float(1).div(resolution.x), float(1).div(resolution.y))

    // Sample depth at center and neighbors
    const depthC = depthTex.sample(coord).x
    const depthL = depthTex.sample(coord.sub(vec2(texel.x, float(0)))).x
    const depthR = depthTex.sample(coord.add(vec2(texel.x, float(0)))).x
    const depthB = depthTex.sample(coord.sub(vec2(float(0), texel.y))).x
    const depthT = depthTex.sample(coord.add(vec2(float(0), texel.y))).x

    // Get view positions
    const posC = getViewPositionTSL(coord, depthC, invProjMatrix)
    const posL = getViewPositionTSL(coord.sub(vec2(texel.x, float(0))), depthL, invProjMatrix)
    const posR = getViewPositionTSL(coord.add(vec2(texel.x, float(0))), depthR, invProjMatrix)
    const posB = getViewPositionTSL(coord.sub(vec2(float(0), texel.y)), depthB, invProjMatrix)
    const posT = getViewPositionTSL(coord.add(vec2(float(0), texel.y)), depthT, invProjMatrix)

    // Calculate tangent vectors - use smaller difference to avoid artifacts
    const ddx = select(
      abs(posR.z.sub(posC.z)).lessThan(abs(posC.z.sub(posL.z))),
      posR.sub(posC),
      posC.sub(posL)
    )
    const ddy = select(
      abs(posT.z.sub(posC.z)).lessThan(abs(posC.z.sub(posB.z))),
      posT.sub(posC),
      posC.sub(posB)
    )

    // Cross product for normal
    const crossProd = cross(ddy, ddx)
    const crossLen = length(crossProd)

    // Normalize with fallback
    return select(
      crossLen.greaterThan(0.0001),
      crossProd.div(crossLen),
      vec3(0, 0, 1)
    )
  }
)

/**
 * Get normal from G-buffer (with fallback to depth reconstruction)
 */
const getNormalTSL = Fn(
  ([
    coord,
    normalTex,
    depthTex,
    resolution,
    invProjMatrix,
  ]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof texture>,
    ReturnType<typeof texture>,
    UniformNode<THREE.Vector2>,
    UniformNode<THREE.Matrix4>,
  ]) => {
    const normalData = normalTex.sample(coord)
    const normalLen = length(normalData.xyz)

    // Decode from [0,1] to [-1,1] if valid normal data
    const decoded = normalData.xyz.mul(2).sub(1)
    const decodedLen = length(decoded)
    const validNormal = select(
      decodedLen.greaterThan(0.0001),
      decoded.div(decodedLen),
      vec3(0, 0, 1)
    )

    // Use normal from buffer if valid, otherwise reconstruct from depth
    return select(
      normalLen.greaterThan(0.01),
      validNormal,
      reconstructNormalTSL(coord, depthTex, resolution, invProjMatrix)
    )
  }
)

/**
 * Get reflectivity from G-buffer alpha
 */
const getReflectivityTSL = Fn(([coord, normalTex]: [ReturnType<typeof vec2>, ReturnType<typeof texture>]) => {
  const normalData = normalTex.sample(coord)
  return select(normalData.a.greaterThan(0), normalData.a, float(1))
})

/**
 * Schlick Fresnel approximation
 */
const fresnelTSL = Fn(
  ([viewDir, normal, f0]: [ReturnType<typeof vec3>, ReturnType<typeof vec3>, ReturnType<typeof float>]) => {
    const cosTheta = max(dot(viewDir, normal), float(0))
    const t = float(1).sub(cosTheta)
    const t2 = t.mul(t)
    return f0.add(float(1).sub(f0).mul(t2).mul(t2).mul(t))
  }
)

// =============================================================================
// TSL Bilateral Upsample Functions
// =============================================================================

/**
 * Linearize depth for bilateral comparison
 */
const linearizeDepthTSL = Fn(
  ([rawDepth, near, far]: [ReturnType<typeof float>, ReturnType<typeof float>, ReturnType<typeof float>]) => {
    const denom = far.add(near).sub(rawDepth.mul(far.sub(near)))
    const safeDenom = max(denom, float(0.0001))
    return float(2).mul(near).mul(far).div(safeDenom)
  }
)

// =============================================================================
// Main Pass Implementation
// =============================================================================

/**
 * Screen-space reflections pass.
 *
 * @example
 * ```typescript
 * const ssrPass = new SSRPassTSL({
 *   id: 'ssr',
 *   colorInput: 'sceneColor',
 *   normalInput: 'normalBuffer',
 *   depthInput: 'sceneDepth',
 *   outputResource: 'ssrOutput',
 *   intensity: 0.8,
 *   maxSteps: 64,
 *   halfResolution: true, // Enable half-res optimization
 * });
 * ```
 */
export class SSRPassTSL extends BasePassTSL {
  private material: MeshBasicNodeMaterial | null = null
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera

  // Copy material for passthrough
  private copyMaterial: MeshBasicNodeMaterial | null = null
  private copyMesh: THREE.Mesh
  private copyScene: THREE.Scene

  // Half-resolution pipeline
  private useHalfRes: boolean
  private halfResTarget: THREE.WebGLRenderTarget | null = null
  private upsampleMaterial: MeshBasicNodeMaterial | null = null
  private upsampleMesh: THREE.Mesh | null = null
  private upsampleScene: THREE.Scene | null = null

  private colorInputId: string
  private normalInputId: string
  private depthInputId: string
  private depthInputAttachment?: number | 'depth'
  private alternateDepthInputId?: string
  private alternateDepthInputAttachment?: number | 'depth'
  private depthInputSelector?: () => string
  private outputId: string

  // TSL Uniforms
  private uResolution: UniformNode<THREE.Vector2>
  private uProjMatrix: UniformNode<THREE.Matrix4>
  private uInvProjMatrix: UniformNode<THREE.Matrix4>
  private uIntensity: UniformNode<number>
  private uMaxDistance: UniformNode<number>
  private uThickness: UniformNode<number>
  private uFadeStart: UniformNode<number>
  private uFadeEnd: UniformNode<number>
  private uMaxSteps: UniformNode<number>
  private uNearClip: UniformNode<number>
  private uFarClip: UniformNode<number>
  private uOutputMode: UniformNode<number>

  // Bilateral upsample uniforms
  private uFullResolution: UniformNode<THREE.Vector2>
  private uDepthThreshold: UniformNode<number>

  // Placeholder textures for stable binding
  private placeholderColor: THREE.DataTexture
  private placeholderNormal: THREE.DataTexture
  private placeholderDepth: THREE.DataTexture
  private placeholderHalfRes: THREE.DataTexture

  // Texture nodes for stable binding
  private colorTextureNode: ReturnType<typeof texture> | null = null
  private normalTextureNode: ReturnType<typeof texture> | null = null
  private depthTextureNode: ReturnType<typeof texture> | null = null
  private copyTextureNode: ReturnType<typeof texture> | null = null
  private halfResTextureNode: ReturnType<typeof texture> | null = null
  private halfResDepthTextureNode: ReturnType<typeof texture> | null = null
  private halfResColorTextureNode: ReturnType<typeof texture> | null = null

  // Current parameters
  private _intensity: number
  private _maxDistance: number
  private _thickness: number
  private _fadeStart: number
  private _fadeEnd: number
  private _maxSteps: number

  constructor(config: SSRPassTSLConfig) {
    const inputs = [
      { resourceId: config.colorInput, access: 'read' as const },
      { resourceId: config.normalInput, access: 'read' as const },
      {
        resourceId: config.depthInput,
        access: 'read' as const,
        attachment: config.depthInputAttachment,
      },
    ]

    if (config.alternateDepthInput && config.alternateDepthInput !== config.depthInput) {
      inputs.push({
        resourceId: config.alternateDepthInput,
        access: 'read' as const,
        attachment: config.alternateDepthInputAttachment,
      })
    }

    super({
      id: config.id,
      name: config.name ?? 'SSR Pass (TSL)',
      inputs,
      outputs: [{ resourceId: config.outputResource, access: 'write' }],
      enabled: config.enabled,
      priority: config.priority,
      skipPassthrough: config.skipPassthrough,
    })

    this.colorInputId = config.colorInput
    this.normalInputId = config.normalInput
    this.depthInputId = config.depthInput
    this.depthInputAttachment = config.depthInputAttachment
    this.alternateDepthInputId = config.alternateDepthInput
    this.alternateDepthInputAttachment = config.alternateDepthInputAttachment
    this.depthInputSelector = config.depthInputSelector
    this.outputId = config.outputResource

    // Store parameters
    this._intensity = config.intensity ?? 0.8
    this._maxDistance = config.maxDistance ?? 10
    this._thickness = config.thickness ?? 0.5
    this._fadeStart = config.fadeStart ?? 0.3
    this._fadeEnd = config.fadeEnd ?? 0.8
    this._maxSteps = config.maxSteps ?? 64

    // Create TSL uniforms
    this.uResolution = uniform(new THREE.Vector2(1, 1))
    this.uProjMatrix = uniform(new THREE.Matrix4())
    this.uInvProjMatrix = uniform(new THREE.Matrix4())
    this.uIntensity = uniform(this._intensity)
    this.uMaxDistance = uniform(this._maxDistance)
    this.uThickness = uniform(this._thickness)
    this.uFadeStart = uniform(this._fadeStart)
    this.uFadeEnd = uniform(this._fadeEnd)
    this.uMaxSteps = uniform(this._maxSteps)
    this.uNearClip = uniform(0.1)
    this.uFarClip = uniform(1000)
    this.uOutputMode = uniform(0)

    // Bilateral upsample uniforms
    this.uFullResolution = uniform(new THREE.Vector2(1, 1))
    this.uDepthThreshold = uniform(config.bilateralDepthThreshold ?? 0.01)

    // Half-resolution pipeline setup
    this.useHalfRes = config.halfResolution ?? true

    // Create placeholder textures for stable binding
    const size = 4
    const colorData = new Uint8Array(size * size * 4).fill(128)
    this.placeholderColor = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderColor.needsUpdate = true

    const normalData = new Uint8Array(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      normalData[i * 4] = 128 // R: 0.5 (normal X)
      normalData[i * 4 + 1] = 128 // G: 0.5 (normal Y)
      normalData[i * 4 + 2] = 255 // B: 1.0 (normal Z)
      normalData[i * 4 + 3] = 255 // A: reflectivity
    }
    this.placeholderNormal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderNormal.needsUpdate = true

    const depthData = new Uint8Array(size * size * 4).fill(255)
    this.placeholderDepth = new THREE.DataTexture(depthData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderDepth.needsUpdate = true

    const halfResData = new Uint8Array(size * size * 4).fill(0)
    this.placeholderHalfRes = new THREE.DataTexture(halfResData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.placeholderHalfRes.needsUpdate = true

    // Create geometry
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Main mesh
    this.mesh = new THREE.Mesh(geometry)
    this.mesh.frustumCulled = false
    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)

    // Copy mesh
    this.copyMesh = new THREE.Mesh(geometry.clone())
    this.copyMesh.frustumCulled = false
    this.copyScene = new THREE.Scene()
    this.copyScene.add(this.copyMesh)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Initialize half-res pipeline if enabled
    if (this.useHalfRes) {
      this.initHalfResPipeline()
    }
  }

  /**
   * Initialize the half-resolution rendering pipeline.
   */
  private initHalfResPipeline(): void {
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.upsampleMesh = new THREE.Mesh(geometry)
    this.upsampleMesh.frustumCulled = false
    this.upsampleScene = new THREE.Scene()
    this.upsampleScene.add(this.upsampleMesh)
  }

  /**
   * Ensure half-res target matches current size.
   */
  private ensureHalfResTarget(width: number, height: number): void {
    const halfWidth = Math.max(1, Math.floor(width / 2))
    const halfHeight = Math.max(1, Math.floor(height / 2))

    if (
      this.halfResTarget &&
      this.halfResTarget.width === halfWidth &&
      this.halfResTarget.height === halfHeight
    ) {
      return
    }

    // Dispose old target
    if (this.halfResTarget) {
      this.halfResTarget.dispose()
    }

    // Create new half-res target
    // WebGLRenderTarget works with both WebGL and WebGPU renderers
    this.halfResTarget = new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    })
  }

  /**
   * Ensure main SSR material is created
   */
  private ensureMaterial(): void {
    if (this.material) return

    // Create stable texture nodes
    this.colorTextureNode = texture(this.placeholderColor)
    this.normalTextureNode = texture(this.placeholderNormal)
    this.depthTextureNode = texture(this.placeholderDepth)

    const colorTex = this.colorTextureNode
    const normalTex = this.normalTextureNode
    const depthTex = this.depthTextureNode

    const uResolution = this.uResolution
    const uProjMatrix = this.uProjMatrix
    const uInvProjMatrix = this.uInvProjMatrix
    const uIntensity = this.uIntensity
    const uMaxDistance = this.uMaxDistance
    const uThickness = this.uThickness
    const uFadeStart = this.uFadeStart
    const uFadeEnd = this.uFadeEnd
    const uMaxSteps = this.uMaxSteps
    const uNearClip = this.uNearClip
    const uOutputMode = this.uOutputMode

    const outputNode = Fn(() => {
      const uv = screenUV

      // Sample scene color
      const sceneColor = colorTex.sample(uv)

      // No reflection output based on mode
      const noReflectionOutput = select(
        uOutputMode.equal(1),
        vec4(0, 0, 0, 0),
        sceneColor
      )

      // Sample depth
      const depth = depthTex.sample(uv).x

      // Get normal and reflectivity
      const normal = getNormalTSL(uv, normalTex, depthTex, uResolution, uInvProjMatrix)
      const reflectivity = getReflectivityTSL(uv, normalTex)

      // Check if we should skip this pixel (early exit conditions)
      // Using select() for branchless computation - GPU-friendly
      const shouldSkip = uIntensity.lessThanEqual(0)
        .or(depth.greaterThanEqual(0.9999))
        .or(reflectivity.lessThanEqual(0))

      // Get view-space position and direction
      const viewPos = getViewPositionTSL(uv, depth, uInvProjMatrix)
      const viewDir = normalize(viewPos.negate())

      // Calculate reflection direction
      const reflectDir = reflect(viewDir.negate(), normal)

      // Fresnel factor
      const fresnelFactor = fresnelTSL(viewDir, normal, float(0.5))

      // Ray march setup
      const rayOrigin = viewPos
      const rayDir = reflectDir
      const safeMaxSteps = max(uMaxSteps, float(1))
      const stepSize = uMaxDistance.div(safeMaxSteps)

      // Ray march result
      const hitUV = vec2(-1, -1).toVar('hitUV')
      const hitDist = float(0).toVar('hitDist')

      // Ray march loop (max 64 iterations for WebGPU stability)
      Loop(64, ({ i }) => {
        const stepNum = float(i).add(1)

        // Early exit if beyond max steps
        If(stepNum.greaterThan(safeMaxSteps), () => {
          Break()
        })

        // Step along ray
        const rayPos = rayOrigin.add(rayDir.mul(stepSize.mul(stepNum))).toVar('rayPos')

        // Check if ray goes behind camera
        If(rayPos.z.greaterThan(uNearClip.negate()), () => {
          Break()
        })

        // Project to screen
        const sampleUV = projectToScreenTSL(rayPos, uProjMatrix)

        // Check bounds - skip if out of screen
        If(
          sampleUV.x.lessThan(0).or(sampleUV.x.greaterThan(1)).or(sampleUV.y.lessThan(0)).or(sampleUV.y.greaterThan(1)),
          () => {
            Continue()
          }
        )

        // Sample depth at position
        const sampleDepth = depthTex.sample(sampleUV).x
        const sampleViewPos = getViewPositionTSL(sampleUV, sampleDepth, uInvProjMatrix)

        // Check for intersection
        const depthDiff = rayPos.z.sub(sampleViewPos.z)

        If(depthDiff.greaterThan(0).and(depthDiff.lessThan(uThickness)), () => {
          hitUV.assign(sampleUV)
          hitDist.assign(length(rayPos.sub(rayOrigin)))
          Break()
        })
      })

      // Calculate reflection if hit was found
      const reflectionColor = colorTex.sample(hitUV)

      // Distance fade
      const distFade = float(1).sub(
        smoothstep(uFadeStart.mul(uMaxDistance), uFadeEnd.mul(uMaxDistance), hitDist)
      )

      // Edge fade
      const edgeDist = abs(hitUV.sub(0.5)).mul(2)
      const edgeFadeVal = float(1).sub(max(edgeDist.x, edgeDist.y))
      const edgeFade = smoothstep(float(0), float(0.2), edgeFadeVal)

      // Combine factors
      const reflectionStrength = uIntensity.mul(reflectivity).mul(fresnelFactor).mul(distFade).mul(edgeFade)

      // Final output - use select() for branchless conditionals
      // When hit found (hitUV.x >= 0):
      //   - Mode 1 (half-res): output reflection with alpha = strength
      //   - Mode 0 (full-res): output blended result
      // When no hit or skip:
      //   - Output noReflectionOutput
      const hitFound = hitUV.x.greaterThanEqual(0)
      const blended = mix(sceneColor.xyz, reflectionColor.xyz, reflectionStrength)

      const hitOutput = select(
        uOutputMode.equal(1),
        vec4(reflectionColor.x, reflectionColor.y, reflectionColor.z, reflectionStrength),
        vec4(blended.x, blended.y, blended.z, sceneColor.w)
      )

      // Final result: skip -> noReflectionOutput, no hit -> noReflectionOutput, hit -> hitOutput
      return select(
        shouldSkip.or(hitFound.not()),
        noReflectionOutput,
        hitOutput
      )
    })()

    this.material = new MeshBasicNodeMaterial()
    this.material.outputNode = outputNode
    ;(this.material as unknown as { depthTest: boolean }).depthTest = false
    this.material.depthWrite = false
    this.mesh.material = this.material as unknown as THREE.Material
  }

  /**
   * Ensure bilateral upsample material is created
   */
  private ensureUpsampleMaterial(): void {
    if (this.upsampleMaterial || !this.upsampleMesh) return

    // Create stable texture nodes for upsampling
    this.halfResTextureNode = texture(this.placeholderHalfRes)
    this.halfResDepthTextureNode = texture(this.placeholderDepth)
    this.halfResColorTextureNode = texture(this.placeholderColor)

    const inputTex = this.halfResTextureNode
    const depthTex = this.halfResDepthTextureNode
    const colorTex = this.halfResColorTextureNode

    const uFullResolution = this.uFullResolution
    const uDepthThreshold = this.uDepthThreshold
    const uNearClip = this.uNearClip
    const uFarClip = this.uFarClip

    const outputNode = Fn(() => {
      const uv = screenUV
      const texelSize = vec2(float(1).div(uFullResolution.x), float(1).div(uFullResolution.y))
      const halfResTexelSize = texelSize.mul(2)

      // Sample full-res depth at current pixel
      const centerDepth = linearizeDepthTSL(depthTex.sample(uv).x, uNearClip, uFarClip)

      // Calculate position within 2x2 half-res cell
      const cellPos = vec2(
        uv.x.div(halfResTexelSize.x).sub(uv.x.div(halfResTexelSize.x).floor()),
        uv.y.div(halfResTexelSize.y).sub(uv.y.div(halfResTexelSize.y).floor())
      )

      // Base UV aligned to half-res grid
      const baseUv = vec2(
        uv.x.div(halfResTexelSize.x).floor().mul(halfResTexelSize.x).add(halfResTexelSize.x.mul(0.5)),
        uv.y.div(halfResTexelSize.y).floor().mul(halfResTexelSize.y).add(halfResTexelSize.y.mul(0.5))
      )

      // Bilinear weights
      const wx0 = float(1).sub(cellPos.x)
      const wx1 = cellPos.x
      const wy0 = float(1).sub(cellPos.y)
      const wy1 = cellPos.y

      // Sample 4 corners with bilateral weighting
      const result = vec4(0, 0, 0, 0).toVar('upsampleResult')
      const totalWeight = float(0).toVar('upsampleWeight')

      // Corner 0: (0, 0)
      const sampleUv0 = baseUv.sub(halfResTexelSize.mul(0.5))
      const sample0 = inputTex.sample(sampleUv0)
      const depth0 = linearizeDepthTSL(depthTex.sample(sampleUv0).x, uNearClip, uFarClip)
      const depthDiff0 = abs(depth0.sub(centerDepth))
      const depthWeight0 = depthDiff0.div(uDepthThreshold.mul(max(centerDepth, float(0.001)))).negate().exp()
      const weight0 = wx0.mul(wy0).mul(depthWeight0)
      result.addAssign(sample0.mul(weight0))
      totalWeight.addAssign(weight0)

      // Corner 1: (1, 0)
      const sampleUv1 = baseUv.sub(halfResTexelSize.mul(0.5)).add(vec2(halfResTexelSize.x, float(0)))
      const sample1 = inputTex.sample(sampleUv1)
      const depth1 = linearizeDepthTSL(depthTex.sample(sampleUv1).x, uNearClip, uFarClip)
      const depthDiff1 = abs(depth1.sub(centerDepth))
      const depthWeight1 = depthDiff1.div(uDepthThreshold.mul(max(centerDepth, float(0.001)))).negate().exp()
      const weight1 = wx1.mul(wy0).mul(depthWeight1)
      result.addAssign(sample1.mul(weight1))
      totalWeight.addAssign(weight1)

      // Corner 2: (0, 1)
      const sampleUv2 = baseUv.sub(halfResTexelSize.mul(0.5)).add(vec2(float(0), halfResTexelSize.y))
      const sample2 = inputTex.sample(sampleUv2)
      const depth2 = linearizeDepthTSL(depthTex.sample(sampleUv2).x, uNearClip, uFarClip)
      const depthDiff2 = abs(depth2.sub(centerDepth))
      const depthWeight2 = depthDiff2.div(uDepthThreshold.mul(max(centerDepth, float(0.001)))).negate().exp()
      const weight2 = wx0.mul(wy1).mul(depthWeight2)
      result.addAssign(sample2.mul(weight2))
      totalWeight.addAssign(weight2)

      // Corner 3: (1, 1)
      const sampleUv3 = baseUv.sub(halfResTexelSize.mul(0.5)).add(halfResTexelSize)
      const sample3 = inputTex.sample(sampleUv3)
      const depth3 = linearizeDepthTSL(depthTex.sample(sampleUv3).x, uNearClip, uFarClip)
      const depthDiff3 = abs(depth3.sub(centerDepth))
      const depthWeight3 = depthDiff3.div(uDepthThreshold.mul(max(centerDepth, float(0.001)))).negate().exp()
      const weight3 = wx1.mul(wy1).mul(depthWeight3)
      result.addAssign(sample3.mul(weight3))
      totalWeight.addAssign(weight3)

      // Normalize and composite
      const sceneColor = colorTex.sample(uv)

      // Safe division - guard against zero totalWeight
      const safeTotalWeight = max(totalWeight, float(0.001))
      const normalized = result.div(safeTotalWeight)

      // Composite: mix(sceneColor, reflectionColor, alpha)
      const blended = mix(sceneColor.xyz, normalized.xyz, normalized.w)
      const blendedResult = vec4(blended.x, blended.y, blended.z, sceneColor.w)

      // Return scene color if weight is too low, otherwise blended result
      return select(
        totalWeight.greaterThan(0.001),
        blendedResult,
        sceneColor
      )
    })()

    this.upsampleMaterial = new MeshBasicNodeMaterial()
    this.upsampleMaterial.outputNode = outputNode
    ;(this.upsampleMaterial as unknown as { depthTest: boolean }).depthTest = false
    this.upsampleMaterial.depthWrite = false
    this.upsampleMesh.material = this.upsampleMaterial as unknown as THREE.Material
  }

  /**
   * Ensure copy material is created
   */
  private ensureCopyMaterial(): void {
    if (this.copyMaterial) return

    this.copyTextureNode = texture(this.placeholderColor)
    const colorTex = this.copyTextureNode

    const outputNode = Fn(() => {
      return colorTex.sample(screenUV)
    })()

    this.copyMaterial = new MeshBasicNodeMaterial()
    this.copyMaterial.outputNode = outputNode
    ;(this.copyMaterial as unknown as { depthTest: boolean }).depthTest = false
    this.copyMaterial.depthWrite = false
    this.copyMesh.material = this.copyMaterial as unknown as THREE.Material
  }

  execute(ctx: RenderContextTSL): void {
    const renderer = ctx.renderer
    const { camera, size } = ctx

    // Get textures
    const colorTex = ctx.getReadTexture(this.colorInputId)
    const outputTarget = ctx.getWriteTarget(this.outputId)

    // Passthrough if camera is not perspective or required inputs missing
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      this.copyToOutput(renderer, colorTex, outputTarget)
      return
    }

    const normalTex = ctx.getReadTexture(this.normalInputId)
    const depthResourceId = this.depthInputSelector ? this.depthInputSelector() : this.depthInputId
    const depthAttachment =
      depthResourceId === this.depthInputId
        ? this.depthInputAttachment
        : depthResourceId === this.alternateDepthInputId
          ? this.alternateDepthInputAttachment
          : undefined
    const depthTex = ctx.getReadTexture(depthResourceId, depthAttachment)

    // Passthrough if required inputs missing
    if (!colorTex || !normalTex || !depthTex) {
      this.copyToOutput(renderer, colorTex, outputTarget)
      return
    }

    // Use half-resolution pipeline if enabled
    if (this.useHalfRes && this.upsampleScene) {
      this.executeHalfRes(
        ctx,
        colorTex,
        normalTex,
        depthTex,
        camera,
        outputTarget
      )
      return
    }

    // Full-resolution path
    this.executeFullRes(colorTex, normalTex, depthTex, camera, size, renderer, outputTarget)
  }

  /**
   * Execute SSR at full resolution (original behavior).
   */
  private executeFullRes(
    colorTex: THREE.Texture,
    normalTex: THREE.Texture,
    depthTex: THREE.Texture,
    camera: THREE.PerspectiveCamera,
    size: { width: number; height: number },
    renderer: SupportedRenderer,
    outputTarget: SupportedRenderTarget | null
  ): void {
    this.ensureMaterial()

    // Update texture values
    if (this.colorTextureNode) {
      ;(this.colorTextureNode as unknown as { value: THREE.Texture }).value = colorTex
    }
    if (this.normalTextureNode) {
      ;(this.normalTextureNode as unknown as { value: THREE.Texture }).value = normalTex
    }
    if (this.depthTextureNode) {
      ;(this.depthTextureNode as unknown as { value: THREE.Texture }).value = depthTex
    }

    // Update uniforms
    this.uResolution.value.set(size.width, size.height)
    this.uProjMatrix.value.copy(camera.projectionMatrix)
    this.uInvProjMatrix.value.copy(camera.projectionMatrixInverse)
    this.uNearClip.value = camera.near
    this.uFarClip.value = camera.far
    this.uOutputMode.value = 0 // Full-res composited mode

    // Render (WebGLRenderTarget works with both WebGL and WebGPU)
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Execute SSR at half resolution with bilateral upsampling.
   * OPTIMIZATION: Reduces SSR cost by 50-75% (4x fewer pixels).
   */
  private executeHalfRes(
    ctx: RenderContextTSL,
    colorTex: THREE.Texture,
    normalTex: THREE.Texture,
    depthTex: THREE.Texture,
    camera: THREE.PerspectiveCamera,
    outputTarget: SupportedRenderTarget | null
  ): void {
    const renderer = ctx.renderer
    const { size } = ctx

    // Ensure half-res target is correct size
    this.ensureHalfResTarget(size.width, size.height)

    if (!this.halfResTarget || !this.upsampleScene) {
      // Fallback to full-res
      this.executeFullRes(colorTex, normalTex, depthTex, camera, size, renderer, outputTarget)
      return
    }

    const halfWidth = this.halfResTarget.width
    const halfHeight = this.halfResTarget.height

    // Step 1: Render SSR at half resolution
    this.ensureMaterial()

    // Update texture values
    if (this.colorTextureNode) {
      ;(this.colorTextureNode as unknown as { value: THREE.Texture }).value = colorTex
    }
    if (this.normalTextureNode) {
      ;(this.normalTextureNode as unknown as { value: THREE.Texture }).value = normalTex
    }
    if (this.depthTextureNode) {
      ;(this.depthTextureNode as unknown as { value: THREE.Texture }).value = depthTex
    }

    // Update uniforms for half-res
    this.uResolution.value.set(halfWidth, halfHeight)
    this.uProjMatrix.value.copy(camera.projectionMatrix)
    this.uInvProjMatrix.value.copy(camera.projectionMatrixInverse)
    this.uNearClip.value = camera.near
    this.uFarClip.value = camera.far
    this.uOutputMode.value = 1 // Half-res reflection-only mode

    // Set viewport for half-res target
    this.halfResTarget.viewport.set(0, 0, halfWidth, halfHeight)
    renderer.setRenderTarget(this.halfResTarget)
    renderer.render(this.scene, this.camera)

    // Step 2: Bilateral upsample to full resolution
    this.ensureUpsampleMaterial()

    // Update upsample texture values
    if (this.halfResTextureNode) {
      ;(this.halfResTextureNode as unknown as { value: THREE.Texture }).value = this.halfResTarget.texture
    }
    if (this.halfResDepthTextureNode) {
      ;(this.halfResDepthTextureNode as unknown as { value: THREE.Texture }).value = depthTex
    }
    if (this.halfResColorTextureNode) {
      ;(this.halfResColorTextureNode as unknown as { value: THREE.Texture }).value = colorTex
    }

    // Update upsample uniforms
    this.uFullResolution.value.set(size.width, size.height)

    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.upsampleScene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Set SSR intensity
   */
  setIntensity(value: number): void {
    this._intensity = value
    this.uIntensity.value = value
  }

  /**
   * Set max ray distance
   */
  setMaxDistance(value: number): void {
    this._maxDistance = value
    this.uMaxDistance.value = value
  }

  /**
   * Set depth thickness
   */
  setThickness(value: number): void {
    this._thickness = value
    this.uThickness.value = value
  }

  /**
   * Set max ray march steps
   */
  setMaxSteps(value: number): void {
    this._maxSteps = value
    this.uMaxSteps.value = value
  }

  /**
   * Enable or disable half-resolution rendering at runtime.
   */
  setHalfResolution(enabled: boolean): void {
    if (this.useHalfRes === enabled) return

    this.useHalfRes = enabled

    if (enabled && !this.upsampleScene) {
      this.initHalfResPipeline()
    }
  }

  /**
   * Set bilateral depth threshold for upsampling.
   */
  setBilateralDepthThreshold(threshold: number): void {
    this.uDepthThreshold.value = threshold
  }

  /**
   * Copy input texture directly to output (passthrough)
   */
  private copyToOutput(
    renderer: SupportedRenderer,
    inputTex: THREE.Texture | null,
    outputTarget: SupportedRenderTarget | null
  ): void {
    if (!inputTex) return

    this.ensureCopyMaterial()

    // Update the copy texture value
    if (this.copyTextureNode) {
      ;(this.copyTextureNode as unknown as { value: THREE.Texture }).value = inputTex
    }

    // WebGLRenderTarget works with both WebGL and WebGPU renderers
    renderer.setRenderTarget(outputTarget as THREE.WebGLRenderTarget)
    renderer.render(this.copyScene, this.camera)
    renderer.setRenderTarget(null)
  }

  /**
   * Release internal GPU resources when pass is disabled.
   *
   * Called by RenderGraph when this pass has been disabled for the grace period.
   * Disposes of the half-resolution render target, but keeps materials and
   * geometry to avoid shader recompilation on re-enable.
   */
  releaseInternalResources(): void {
    // Dispose half-res target (the only significant internal resource)
    if (this.halfResTarget) {
      this.halfResTarget.dispose()
      this.halfResTarget = null
    }

    // Keep material, mesh, upsampleMaterial, upsampleMesh - they're cheap
    // and keeping them avoids shader recompilation on re-enable
  }

  dispose(): void {
    this.material?.dispose()
    this.copyMaterial?.dispose()
    this.upsampleMaterial?.dispose()
    this.mesh.geometry.dispose()
    this.copyMesh.geometry.dispose()
    this.placeholderColor.dispose()
    this.placeholderNormal.dispose()
    this.placeholderDepth.dispose()
    this.placeholderHalfRes.dispose()
    this.scene.remove(this.mesh)
    this.copyScene.remove(this.copyMesh)

    // Dispose half-res resources
    if (this.halfResTarget) {
      this.halfResTarget.dispose()
      this.halfResTarget = null
    }
    if (this.upsampleMesh && this.upsampleScene) {
      this.upsampleScene.remove(this.upsampleMesh)
      this.upsampleMesh.geometry.dispose()
      this.upsampleMesh = null
      this.upsampleScene = null
    }
  }
}
