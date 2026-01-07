/**
 * TSL Subsurface Scattering for Mesh Objects
 *
 * 100% port of WebGL sss.glsl.ts for mesh-based rendering.
 * Uses wrap lighting approximation with screen-space jitter.
 *
 * For meshes, we cannot use SDF-based thickness estimation,
 * so we rely on the uniform uSssThickness parameter.
 *
 * @module rendering/tsl/features/mesh-sss
 */

import { Color } from 'three'
import {
  clamp,
  dot,
  exp,
  float,
  Fn,
  fract,
  length,
  max,
  pow,
  select,
  sin,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'

import type { UniformNode } from 'three/tsl'

// Type aliases
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = ReturnType<typeof vec3>

/**
 * Mesh SSS uniforms interface
 * Matches WebGL SSS uniforms
 */
export interface MeshSSSUniforms {
  /** SSS enabled flag */
  uSssEnabled: UniformNode<boolean>
  /** SSS intensity (0-1) */
  uSssIntensity: UniformNode<number>
  /** SSS color tint */
  uSssColor: UniformNode<Color>
  /** SSS thickness/penetration depth */
  uSssThickness: UniformNode<number>
  /** SSS distortion amount */
  uSssDistortion: UniformNode<number>
  /** SSS power (controls sharpness) */
  uSssPower: UniformNode<number>
  /** SSS jitter for noise (0-1) */
  uSssJitter: UniformNode<number>
}

/**
 * Screen-space hash for SSS jitter
 * Exact port of WebGL sssHash()
 */
export const sssHash = Fn(([p]: [Vec2Node]) => {
  const seedVec = vec2(127.1, 311.7)
  const scale = float(43758.5453)
  return fract(sin(dot(p, seedVec)).mul(scale))
})

/**
 * Compute SSS contribution using wrap lighting approximation
 * Exact port of WebGL computeSSS()
 *
 * @param uniforms - SSS uniforms
 * @returns TSL Fn that computes SSS contribution (vec3)
 */
export const createMeshSSSNode = (uniforms: MeshSSSUniforms) =>
  Fn(
    ([lightDir, viewDir, normal, fragCoord]: [
      Vec3Node,
      Vec3Node,
      Vec3Node,
      Vec2Node
    ]) => {
      // Apply jitter: perturb distortion with screen-space noise
      const noise = sssHash(fragCoord.mul(0.1)).mul(2).sub(1) // -1 to 1
      const jitteredDistortion = uniforms.uSssDistortion.mul(
        float(1).add(noise.mul(uniforms.uSssJitter))
      )

      // Half-vector with distortion
      const halfSum = lightDir.add(normal.mul(jitteredDistortion))
      const halfLen = length(halfSum)

      // Guard against zero-length vector
      const safeHalfVec = halfSum.div(max(halfLen, float(0.0001)))
      const halfVec = select(halfLen.greaterThan(0.0001), safeHalfVec, vec3(0, 1, 0))

      // Transmittance calculation
      const dotVal = clamp(dot(viewDir, halfVec.negate()), float(0), float(1))
      const safePower = max(uniforms.uSssPower, float(0.001))
      const trans = pow(max(dotVal, float(0.0001)), safePower)

      // Attenuate by thickness
      const result = vec3(trans, trans, trans).mul(exp(uniforms.uSssThickness.negate()))

      // Apply color and intensity
      const sssColor = vec3(uniforms.uSssColor)
      return result.mul(sssColor).mul(uniforms.uSssIntensity)
    }
  )

/**
 * SSS node for raymarching fractals
 * Re-exports from existing implementation
 * NOTE: createFastSSSNode and createSSSNodeSimple removed during WebGL parity work (not in WebGL)
 */
export { createSSSNode } from '../compose/feature-blocks/sss'

/**
 * Polytope-specific SSS node
 *
 * 100% match to WebGL polytope/tubewireframe SSS parameters from compose.ts:
 * ```glsl
 * vec3 sss = computeSSS(l, viewDir, normal, 0.5, uSssThickness * 4.0, 0.0, uSssJitter, gl_FragCoord.xy);
 * ```
 *
 * Key differences from generic mesh SSS:
 * - distortion = 0.5 (hardcoded, not uniform)
 * - power = thickness * 4.0 (thickness uniform used as power input!)
 * - thickness for exp() = 0.0 (no exp attenuation)
 *
 * The multiplication by uSssColor, lightColor, uSssIntensity, attenuation happens in the
 * caller (getSSSForLight callback in createPolytopeShadingFn).
 *
 * @param uniforms - SSS uniforms (uses uSssThickness as power, uSssJitter)
 * @returns TSL Fn that computes raw SSS contribution (before color/intensity)
 */
export const createPolytopeSSSNode = (uniforms: MeshSSSUniforms) =>
  Fn(
    ([lightDir, viewDir, normal, fragCoord]: [
      Vec3Node,
      Vec3Node,
      Vec3Node,
      Vec2Node
    ]) => {
      // WebGL: distortion = 0.5 (hardcoded)
      const distortion = float(0.5)

      // Apply jitter: perturb distortion with screen-space noise
      // WebGL: float jitteredDistortion = distortion * (1.0 + noise * jitter);
      const noise = sssHash(fragCoord.mul(0.1)).mul(2).sub(1) // -1 to 1
      const jitteredDistortion = distortion.mul(
        float(1).add(noise.mul(uniforms.uSssJitter))
      )

      // Half-vector with distortion
      // WebGL: vec3 halfSum = lightDir + normal * jitteredDistortion;
      const halfSum = lightDir.add(normal.mul(jitteredDistortion))
      const halfLen = length(halfSum)

      // Guard against zero-length vector
      const safeHalfVec = halfSum.div(max(halfLen, float(0.0001)))
      const halfVec = select(halfLen.greaterThan(0.0001), safeHalfVec, vec3(0, 1, 0))

      // Transmittance calculation
      // WebGL: float dotVal = clamp(dot(viewDir, -halfVec), 0.0, 1.0);
      const dotVal = clamp(dot(viewDir, halfVec.negate()), float(0), float(1))

      // WebGL: power = uSssThickness * 4.0
      // uSssThickness is used as power input, multiplied by 4.0
      const power = uniforms.uSssThickness.mul(4)
      const safePower = max(power, float(0.001))

      // WebGL: float trans = pow(max(dotVal, 0.0001), safePower);
      const trans = pow(max(dotVal, float(0.0001)), safePower)

      // WebGL: thickness = 0.0, so exp(-0) = 1.0 (no attenuation)
      // return vec3(trans) * exp(-thickness);  with thickness = 0
      // = vec3(trans) * 1.0 = vec3(trans)

      // Apply color and intensity (matching WebGL: sss * uSssColor * ... * uSssIntensity)
      const sssColor = vec3(uniforms.uSssColor)
      return vec3(trans, trans, trans).mul(sssColor).mul(uniforms.uSssIntensity)
    }
  )

/**
 * Create mesh SSS uniforms with defaults
 */
export function createMeshSSSUniforms(): MeshSSSUniforms {
  return {
    uSssEnabled: uniform(false),
    uSssIntensity: uniform(0.5),
    uSssColor: uniform(new Color(1.0, 0.8, 0.6)), // Warm skin-like default
    uSssThickness: uniform(0.5),
    uSssDistortion: uniform(0.2),
    uSssPower: uniform(2.0),
    uSssJitter: uniform(0.1),
  }
}

/**
 * Update mesh SSS uniforms from store state
 */
export function updateMeshSSSUniforms(
  uniforms: MeshSSSUniforms,
  state: {
    sssEnabled?: boolean
    sssIntensity?: number
    sssColor?: [number, number, number]
    sssThickness?: number
    sssDistortion?: number
    sssPower?: number
    sssJitter?: number
  }
): void {
  if (state.sssEnabled !== undefined) {
    uniforms.uSssEnabled.value = state.sssEnabled
  }
  if (state.sssIntensity !== undefined) {
    uniforms.uSssIntensity.value = state.sssIntensity
  }
  if (state.sssColor) {
    uniforms.uSssColor.value = new Color(...state.sssColor)
  }
  if (state.sssThickness !== undefined) {
    uniforms.uSssThickness.value = state.sssThickness
  }
  if (state.sssDistortion !== undefined) {
    uniforms.uSssDistortion.value = state.sssDistortion
  }
  if (state.sssPower !== undefined) {
    uniforms.uSssPower.value = state.sssPower
  }
  if (state.sssJitter !== undefined) {
    uniforms.uSssJitter.value = state.sssJitter
  }
}
