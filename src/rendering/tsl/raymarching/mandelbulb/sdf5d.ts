/**
 * TSL 5D Mandelbulb SDF
 *
 * 5D Hyperbulb signed distance function with orbit traps.
 * Uses 4 hyperspherical angles (t0, t1, t2, t3).
 *
 * Optimizations:
 * - OPT-C2/C3: Use optimizedPow for r^pwr and r^(pwr-1)
 * - OPT-C5: Defer orbit trap sqrt (minASq instead of minA)
 * - OPT-M2: Cache zxzy_sq for minA and r1 calculations
 * - Unrolled 5-component basis vector transformations
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf5d
 */

import {
  abs,
  acos,
  atan,
  clamp,
  cos,
  exp,
  float,
  Fn,
  If,
  int,
  log,
  Loop,
  max,
  min,
  sin,
  sqrt,
  vec3,
  Break,
} from 'three/tsl'

import type { Mandelbulb5D8DUniforms } from './types'
import { EPS, MAX_ITER_HQ } from './types'
import { getEffectivePower, optimizedPow, type PowerUniforms } from './power'

// Type aliases
type Vec3Node = ReturnType<typeof vec3>

/**
 * Create 5D Mandelbulb SDF with orbit traps.
 *
 * Uses z-axis primary with 4 hyperspherical angles.
 *
 * @param uniforms - Mandelbulb 5D uniforms
 * @returns SDF function that returns vec3(dist, trap, 1)
 */
export const createMandelbulb5DSDF = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    // Transform 3D position to 5D using basis vectors (UNROLLED)
    const bx0 = uniforms.uBasisX0
    const by0 = uniforms.uBasisY0
    const bz0 = uniforms.uBasisZ0
    const o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1
    const by1 = uniforms.uBasisY1
    const bz1 = uniforms.uBasisZ1
    const o1 = uniforms.uOrigin1

    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ (5 components)
    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x)).toVar('cx')
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y)).toVar('cy')
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z)).toVar('cz')
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w)).toVar('c3')
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x)).toVar('c4')

    // Iteration variables (5 components)
    const zx = float(cx).toVar('zx')
    const zy = float(cy).toVar('zy')
    const zz = float(cz).toVar('zz')
    const z3 = float(c3).toVar('z3')
    const z4 = float(c4).toVar('z4')

    const dr = float(1).toVar('dr')
    const r = float(0).toVar('r')

    // Orbit traps - OPT-C5: Track squared values
    const minP = float(1000).toVar('minP')
    const minASq = float(1000000).toVar('minASq')
    const minS = float(1000).toVar('minS')
    const escIt = int(0).toVar('escIt')

    // Pre-compute phase offsets
    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0)).toVar('phaseT')
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0)).toVar('phaseP')

    // Get effective power (with animation and alternate blending)
    const powerUniforms: PowerUniforms = {
      uPower: uniforms.uPower,
      uPowerAnimationEnabled: uniforms.uPowerAnimationEnabled,
      uAnimatedPower: uniforms.uAnimatedPower,
      uAlternatePowerEnabled: uniforms.uAlternatePowerEnabled,
      uAlternatePowerValue: uniforms.uAlternatePowerValue,
      uAlternatePowerBlend: uniforms.uAlternatePowerBlend,
    }
    const pwr = float(getEffectivePower(powerUniforms)).toVar('pwr')

    const bail = float(uniforms.uEscapeRadius).toVar('bail')
    const maxIt = int(uniforms.uIterations).toVar('maxIt')

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      // OPT-M2: Cache zxzy_sq for minASq and r1 calculations
      const zxzy_sq = zx.mul(zx).add(zy.mul(zy)).toVar('zxzy_sq')
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4))))

      If(r.greaterThan(bail), () => {
        escIt.assign(i)
        Break()
      })

      // Orbit traps
      minP.assign(min(minP, abs(zy)))
      minASq.assign(min(minASq, zxzy_sq)) // OPT-C5: Track squared
      minS.assign(min(minS, abs(r.sub(0.8))))

      // OPT-C2/C3: Use optimizedPow
      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x.toVar('rp')
      const rpMinus1 = powResult.y.toVar('rpMinus1')

      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      // 5D: 4 angles, z-axis primary
      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1))).toVar('t0')
      
      // OPT-M2: Reuse zxzy_sq in r1 calculation
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4))).toVar('r1')
      const t1 = r1.greaterThan(EPS).select(
        acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))),
        float(0)
      ).toVar('t1')

      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4))).toVar('r2')
      const t2 = r2.greaterThan(EPS).select(
        acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))),
        float(0)
      ).toVar('t2')

      const t3 = atan(z4, z3).toVar('t3')

      // Apply phase shift and power
      const s0 = sin(t0.add(phaseT).mul(pwr)).toVar('s0')
      const c0 = cos(t0.add(phaseT).mul(pwr)).toVar('c0')
      const s1 = sin(t1.add(phaseP).mul(pwr)).toVar('s1')
      const c1 = cos(t1.add(phaseP).mul(pwr)).toVar('c1')
      const s2 = sin(t2.mul(pwr)).toVar('s2')
      const c2 = cos(t2.mul(pwr)).toVar('c2')
      const s3 = sin(t3.mul(pwr)).toVar('s3')
      const c3_ = cos(t3.mul(pwr)).toVar('c3_')

      // Product of sines for nested coordinates
      const sp = rp.mul(s0).mul(s1).mul(s2).toVar('sp')

      // Update z components
      zz.assign(rp.mul(c0).add(cz))
      zx.assign(rp.mul(s0).mul(c1).add(cx))
      zy.assign(rp.mul(s0).mul(s1).mul(c2).add(cy))
      z3.assign(sp.mul(c3_).add(c3))
      z4.assign(sp.mul(s3).add(c4))

      escIt.assign(i)
    })

    // OPT-C5: Single sqrt after loop
    const minA = sqrt(minASq)

    // Compute trap value
    const trap = exp(minP.negate().mul(5)).mul(0.3)
      .add(exp(minA.negate().mul(3)).mul(0.2))
      .add(exp(minS.negate().mul(8)).mul(0.2))
      .add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))

    // Compute signed distance
    const dist = max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )

    return vec3(dist, trap, float(1))
  })
}

/**
 * Create simplified 5D Mandelbulb SDF (no orbit traps).
 */
export const createMandelbulb5DSDFSimple = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0
    const by0 = uniforms.uBasisY0
    const bz0 = uniforms.uBasisZ0
    const o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1
    const by1 = uniforms.uBasisY1
    const bz1 = uniforms.uBasisZ1
    const o1 = uniforms.uOrigin1

    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x))
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y))
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z))
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w))
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x))

    const zx = float(cx).toVar()
    const zy = float(cy).toVar()
    const zz = float(cz).toVar()
    const z3 = float(c3).toVar()
    const z4 = float(c4).toVar()

    const dr = float(1).toVar()
    const r = float(0).toVar()

    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0))
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0))

    // Get effective power (with animation and alternate blending)
    const powerUniforms: PowerUniforms = {
      uPower: uniforms.uPower,
      uPowerAnimationEnabled: uniforms.uPowerAnimationEnabled,
      uAnimatedPower: uniforms.uAnimatedPower,
      uAlternatePowerEnabled: uniforms.uAlternatePowerEnabled,
      uAlternatePowerValue: uniforms.uAlternatePowerValue,
      uAlternatePowerBlend: uniforms.uAlternatePowerBlend,
    }
    const pwr = float(getEffectivePower(powerUniforms))

    const bail = float(uniforms.uEscapeRadius)
    const maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      const zxzy_sq = zx.mul(zx).add(zy.mul(zy))
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4))))

      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x
      const rpMinus1 = powResult.y

      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1)))
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4)))
      const t1 = r1.greaterThan(EPS).select(
        acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))),
        float(0)
      )
      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4)))
      const t2 = r2.greaterThan(EPS).select(
        acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))),
        float(0)
      )
      const t3 = atan(z4, z3)

      const s0 = sin(t0.add(phaseT).mul(pwr))
      const c0 = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr))
      const c1 = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr))
      const c2 = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr))
      const c3_ = cos(t3.mul(pwr))

      const sp = rp.mul(s0).mul(s1).mul(s2)

      zz.assign(rp.mul(c0).add(cz))
      zx.assign(rp.mul(s0).mul(c1).add(cx))
      zy.assign(rp.mul(s0).mul(s1).mul(c2).add(cy))
      z3.assign(sp.mul(c3_).add(c3))
      z4.assign(sp.mul(s3).add(c4))
    })

    return max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )
  })
}

