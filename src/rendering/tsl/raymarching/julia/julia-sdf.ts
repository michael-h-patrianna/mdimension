/**
 * TSL Quaternion Julia SDF
 *
 * Quaternion Julia set signed distance function with orbit traps.
 * A single SDF works for all dimensions (3D-11D) because quaternion
 * algebra is inherently 4-dimensional. Higher dimensions are handled
 * via basis vector transformations that select different 4D slices.
 *
 * Optimizations:
 * - OPT-C5: Defer orbit trap sqrt (minAxisSq)
 * - Fast paths for common integer powers (2-8)
 * - Pre-computed power outside loop
 *
 * @module rendering/tsl/raymarching/julia/julia-sdf
 */

import {
  abs,
  exp,
  float,
  Fn,
  If,
  int,
  log,
  Loop,
  max,
  min,
  pow,
  sqrt,
  vec3,
  vec4,
  Break,
} from 'three/tsl'

import type { UniformNode, Node } from 'three/tsl'
import type * as THREE from 'three'

import { quatSqr, quatPowFast } from './quaternion'

// Type aliases - FloatNode used via ReturnType<typeof float> inline
type Vec3Node = ReturnType<typeof vec3>
type Vec4Uniform = UniformNode<THREE.Vector4>

// Constants - MUST match WebGL constants.glsl.ts for parity
const EPS = 1e-6 // WebGL: #define EPS 1e-6
const MAX_ITER_HQ = 256 // WebGL: #define MAX_ITER_HQ 256

/**
 * Julia uniforms interface.
 * Uses quaternion-based iteration with N-D basis vectors.
 */
export interface JuliaUniforms {
  // Fractal parameters
  uPower: UniformNode<number>
  uIterations: UniformNode<number>
  uEscapeRadius: UniformNode<number>

  // Julia constant (vec4 quaternion)
  uJuliaConstant: Vec4Uniform

  // Current dimension (for conditional 4D component)
  uDimension: UniformNode<number>

  // N-dimensional basis vectors (packed as vec4)
  // For Julia, only the first 4 components are used for quaternion
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform

  // Power animation
  uPowerAnimationEnabled: UniformNode<boolean>
  uAnimatedPower: UniformNode<number>
}

/**
 * Helper to compute effective power with animation.
 */
const getEffectivePower = (uniforms: JuliaUniforms): Node => {
  const basePower = uniforms.uPowerAnimationEnabled.select(
    uniforms.uAnimatedPower,
    uniforms.uPower
  )
  return max(basePower, float(2))
}

/**
 * Create Quaternion Julia SDF with orbit traps.
 *
 * Unlike Mandelbulb, Julia uses:
 * - z = z^n + c (not z = z^n + z0)
 * - c is the Julia constant (fixed for all points)
 * - z0 is the sample position (varies per pixel)
 *
 * @param uniforms - Julia uniforms
 * @returns SDF function that returns vec3(dist, trap, 1)
 */
export const createJuliaSDF = (uniforms: JuliaUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    // Transform 3D position to quaternion using basis vectors
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    // Map to quaternion (x, y, z, w)
    // For 3D, w=0; for 4D+, w comes from the 4th basis component
    const px = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x)).toVar('px')
    const py = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y)).toVar('py')
    const pz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z)).toVar('pz')

    // For dimension >= 4, include w component; otherwise w=0
    const dim = int(uniforms.uDimension)
    const pw = dim.greaterThanEqual(4).select(
      o.w.add(pos.x.mul(bx.w)).add(pos.y.mul(by.w)).add(pos.z.mul(bz.w)),
      float(0)
    ).toVar('pw')

    // z starts at sample position (NOT the constant, unlike the comment)
    const zx = float(px).toVar('zx')
    const zy = float(py).toVar('zy')
    const zz = float(pz).toVar('zz')
    const zw = float(pw).toVar('zw')

    // c is the fixed Julia constant (already a vec4 uniform node)
    const c = uniforms.uJuliaConstant

    const dr = float(1).toVar('dr')
    const r = float(0).toVar('r')

    // Orbit traps - OPT-C5: Track squared values
    const minPlane = float(1000).toVar('minPlane')
    const minAxisSq = float(1000000).toVar('minAxisSq')
    const minSphere = float(1000).toVar('minSphere')
    const escIt = int(0).toVar('escIt')

    // Get effective power (with animation support)
    const pwr = float(getEffectivePower(uniforms)).toVar('pwr')
    // WebGL: float bail = max(uEscapeRadius, 2.0);
    const bail = max(float(uniforms.uEscapeRadius), float(2.0)).toVar('bail')
    const maxIt = int(uniforms.uIterations).toVar('maxIt')

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      // Calculate radius
      r.assign(sqrt(zx.mul(zx).add(zy.mul(zy)).add(zz.mul(zz)).add(zw.mul(zw))))

      If(r.greaterThan(bail), () => {
        escIt.assign(i)
        Break()
      })

      // Orbit traps - OPT-C5: Track squared for minAxis
      const zxy_sq = zx.mul(zx).add(zy.mul(zy)).toVar('zxy_sq')
      minPlane.assign(min(minPlane, abs(zy)))
      minAxisSq.assign(min(minAxisSq, zxy_sq))
      minSphere.assign(min(minSphere, abs(r.sub(0.8))))

      // WebGL: dr = pwr * pow(max(r, EPS), pwr - 1.0) * dr;
      // Derivative update for Julia: dr = n * r^(n-1) * dr
      // Note: No +1 term since c is constant (unlike Mandelbulb)
      dr.assign(pwr.mul(pow(max(r, float(EPS)), pwr.sub(1))).mul(dr))

      // Julia iteration: z = z^n + c
      const z = vec4(zx, zy, zz, zw).toVar('z')

      // WebGL: if (int(pwr) == 2) - uses integer comparison for robustness
      const isPower2 = int(pwr).equal(2)
      If(isPower2, () => {
        const zSquared = quatSqr(z)
        zx.assign(zSquared.x.add(c.x))
        zy.assign(zSquared.y.add(c.y))
        zz.assign(zSquared.z.add(c.z))
        zw.assign(zSquared.w.add(c.w))
      })
      // General power (when not power 2)
      If(isPower2.not(), () => {
        const zPow = quatPowFast(z, pwr)
        zx.assign(zPow.x.add(c.x))
        zy.assign(zPow.y.add(c.y))
        zz.assign(zPow.z.add(c.z))
        zw.assign(zPow.w.add(c.w))
      })

      escIt.assign(i)
    })

    // OPT-C5: Single sqrt after loop
    const minAxis = sqrt(minAxisSq)

    // Compute trap value
    const trap = exp(minPlane.negate().mul(5)).mul(0.3)
      .add(exp(minAxis.negate().mul(3)).mul(0.2))
      .add(exp(minSphere.negate().mul(8)).mul(0.2))
      .add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))

    // Compute signed distance using distance estimator
    const dist = max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )

    return vec3(dist, trap, float(1))
  })
}

/**
 * Create simplified Quaternion Julia SDF (no orbit traps).
 *
 * Used for normal calculation and shadow rays.
 *
 * @param uniforms - Julia uniforms
 * @returns SDF function that returns distance only
 */
export const createJuliaSDFSimple = (uniforms: JuliaUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    const px = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x))
    const py = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y))
    const pz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z))

    const dim = int(uniforms.uDimension)
    const pw = dim.greaterThanEqual(4).select(
      o.w.add(pos.x.mul(bx.w)).add(pos.y.mul(by.w)).add(pos.z.mul(bz.w)),
      float(0)
    )

    const zx = float(px).toVar()
    const zy = float(py).toVar()
    const zz = float(pz).toVar()
    const zw = float(pw).toVar()

    // c is already a vec4 uniform node
    const c = uniforms.uJuliaConstant

    const dr = float(1).toVar()
    const r = float(0).toVar()

    const pwr = float(getEffectivePower(uniforms))
    // WebGL: float bail = max(uEscapeRadius, 2.0);
    const bail = max(float(uniforms.uEscapeRadius), float(2.0))
    const maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      r.assign(sqrt(zx.mul(zx).add(zy.mul(zy)).add(zz.mul(zz)).add(zw.mul(zw))))
      If(r.greaterThan(bail), () => Break())

      // WebGL: dr = pwr * pow(max(r, EPS), pwr - 1.0) * dr;
      dr.assign(pwr.mul(pow(max(r, float(EPS)), pwr.sub(1))).mul(dr))

      const z = vec4(zx, zy, zz, zw)
      // WebGL: if (int(pwr) == 2) - uses integer comparison
      const isPower2 = int(pwr).equal(2)

      If(isPower2, () => {
        const zSquared = quatSqr(z)
        zx.assign(zSquared.x.add(c.x))
        zy.assign(zSquared.y.add(c.y))
        zz.assign(zSquared.z.add(c.z))
        zw.assign(zSquared.w.add(c.w))
      })
      If(isPower2.not(), () => {
        const zPow = quatPowFast(z, pwr)
        zx.assign(zPow.x.add(c.x))
        zy.assign(zPow.y.add(c.y))
        zz.assign(zPow.z.add(c.z))
        zw.assign(zPow.w.add(c.w))
      })
    })

    return max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )
  })
}

