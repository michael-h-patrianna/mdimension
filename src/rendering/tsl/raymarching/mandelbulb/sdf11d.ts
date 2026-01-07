/**
 * TSL 11D Mandelbulb SDF
 *
 * 11D Hyperbulb signed distance function with orbit traps.
 * Uses 10 hyperspherical angles. Maximum dimension supported.
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf11d
 */

import {
  abs, acos, atan, clamp, cos, exp, float, Fn, If, int, log, Loop, max, min, sin, sqrt, vec3, Break,
} from 'three/tsl'

import type { Mandelbulb9D11DUniforms } from './types'
import { EPS, MAX_ITER_HQ } from './types'
import { getEffectivePower, optimizedPow, type PowerUniforms } from './power'

type Vec3Node = ReturnType<typeof vec3>

export const createMandelbulb11DSDF = (uniforms: Mandelbulb9D11DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0, by0 = uniforms.uBasisY0, bz0 = uniforms.uBasisZ0, o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1, by1 = uniforms.uBasisY1, bz1 = uniforms.uBasisZ1, o1 = uniforms.uOrigin1
    const bx2 = uniforms.uBasisX2, by2 = uniforms.uBasisY2, bz2 = uniforms.uBasisZ2, o2 = uniforms.uOrigin2

    // 11 components
    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x)).toVar('cx')
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y)).toVar('cy')
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z)).toVar('cz')
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w)).toVar('c3')
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x)).toVar('c4')
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y)).toVar('c5')
    const c6 = o1.z.add(pos.x.mul(bx1.z)).add(pos.y.mul(by1.z)).add(pos.z.mul(bz1.z)).toVar('c6')
    const c7 = o1.w.add(pos.x.mul(bx1.w)).add(pos.y.mul(by1.w)).add(pos.z.mul(bz1.w)).toVar('c7')
    const c8 = o2.x.add(pos.x.mul(bx2.x)).add(pos.y.mul(by2.x)).add(pos.z.mul(bz2.x)).toVar('c8')
    const c9 = o2.y.add(pos.x.mul(bx2.y)).add(pos.y.mul(by2.y)).add(pos.z.mul(bz2.y)).toVar('c9')
    const c10 = o2.z.add(pos.x.mul(bx2.z)).add(pos.y.mul(by2.z)).add(pos.z.mul(bz2.z)).toVar('c10')

    const zx = float(cx).toVar(), zy = float(cy).toVar(), zz = float(cz).toVar()
    const z3 = float(c3).toVar(), z4 = float(c4).toVar(), z5 = float(c5).toVar()
    const z6 = float(c6).toVar(), z7 = float(c7).toVar(), z8 = float(c8).toVar()
    const z9 = float(c9).toVar(), z10 = float(c10).toVar()

    const dr = float(1).toVar(), r = float(0).toVar()
    const minP = float(1000).toVar(), minASq = float(1000000).toVar(), minS = float(1000).toVar()
    const escIt = int(0).toVar()

    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0)).toVar()
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0)).toVar()

    // Get effective power (with animation and alternate blending)
    const powerUniforms: PowerUniforms = {
      uPower: uniforms.uPower,
      uPowerAnimationEnabled: uniforms.uPowerAnimationEnabled,
      uAnimatedPower: uniforms.uAnimatedPower,
      uAlternatePowerEnabled: uniforms.uAlternatePowerEnabled,
      uAlternatePowerValue: uniforms.uAlternatePowerValue,
      uAlternatePowerBlend: uniforms.uAlternatePowerBlend,
    }
    const pwr = float(getEffectivePower(powerUniforms)).toVar()

    const bail = float(uniforms.uEscapeRadius).toVar(), maxIt = int(uniforms.uIterations).toVar()

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      const zxzy_sq = zx.mul(zx).add(zy.mul(zy)).toVar()
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))))
      If(r.greaterThan(bail), () => { escIt.assign(i); Break() })

      minP.assign(min(minP, abs(zy))); minASq.assign(min(minASq, zxzy_sq)); minS.assign(min(minS, abs(r.sub(0.8))))

      const powResult = optimizedPow(r, pwr); const rp = powResult.x.toVar(); dr.assign(powResult.y.mul(pwr).mul(dr).add(1))

      // 11D: 10 angles
      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1))).toVar()
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t1 = r1.greaterThan(EPS).select(acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t2 = r2.greaterThan(EPS).select(acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r3 = sqrt(z3.mul(z3).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t3 = r3.greaterThan(EPS).select(acos(clamp(z3.div(max(r3, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r4 = sqrt(z4.mul(z4).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t4 = r4.greaterThan(EPS).select(acos(clamp(z4.div(max(r4, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r5 = sqrt(z5.mul(z5).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t5 = r5.greaterThan(EPS).select(acos(clamp(z5.div(max(r5, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r6 = sqrt(z6.mul(z6).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t6 = r6.greaterThan(EPS).select(acos(clamp(z6.div(max(r6, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r7 = sqrt(z7.mul(z7).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t7 = r7.greaterThan(EPS).select(acos(clamp(z7.div(max(r7, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const r8 = sqrt(z8.mul(z8).add(z9.mul(z9)).add(z10.mul(z10))).toVar()
      const t8 = r8.greaterThan(EPS).select(acos(clamp(z8.div(max(r8, float(EPS))), float(-1), float(1))), float(0)).toVar()
      const t9 = atan(z10, z9).toVar()

      const s0 = sin(t0.add(phaseT).mul(pwr)), c0 = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)), c1 = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)), c2 = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr)), c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)), c4_ = cos(t4.mul(pwr))
      const s5 = sin(t5.mul(pwr)), c5_ = cos(t5.mul(pwr))
      const s6 = sin(t6.mul(pwr)), c6_ = cos(t6.mul(pwr))
      const s7 = sin(t7.mul(pwr)), c7_ = cos(t7.mul(pwr))
      const s8 = sin(t8.mul(pwr)), c8_ = cos(t8.mul(pwr))
      const s9 = sin(t9.mul(pwr)), c9_ = cos(t9.mul(pwr))

      const p0 = rp, p1 = p0.mul(s0), p2 = p1.mul(s1), p3 = p2.mul(s2), p4 = p3.mul(s3)
      const p5 = p4.mul(s4), p6 = p5.mul(s5), p7 = p6.mul(s6), p8 = p7.mul(s7), p9 = p8.mul(s8)

      zz.assign(p0.mul(c0).add(cz)); zx.assign(p1.mul(c1).add(cx)); zy.assign(p2.mul(c2).add(cy))
      z3.assign(p3.mul(c3_).add(c3)); z4.assign(p4.mul(c4_).add(c4)); z5.assign(p5.mul(c5_).add(c5))
      z6.assign(p6.mul(c6_).add(c6)); z7.assign(p7.mul(c7_).add(c7)); z8.assign(p8.mul(c8_).add(c8))
      z9.assign(p9.mul(c9_).add(c9)); z10.assign(p9.mul(s9).add(c10))
      escIt.assign(i)
    })

    const minA = sqrt(minASq)
    const trap = exp(minP.negate().mul(5)).mul(0.3).add(exp(minA.negate().mul(3)).mul(0.2)).add(exp(minS.negate().mul(8)).mul(0.2)).add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))
    const dist = max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
    return vec3(dist, trap, float(1))
  })
}

export const createMandelbulb11DSDFSimple = (uniforms: Mandelbulb9D11DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0, by0 = uniforms.uBasisY0, bz0 = uniforms.uBasisZ0, o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1, by1 = uniforms.uBasisY1, bz1 = uniforms.uBasisZ1, o1 = uniforms.uOrigin1
    const bx2 = uniforms.uBasisX2, by2 = uniforms.uBasisY2, bz2 = uniforms.uBasisZ2, o2 = uniforms.uOrigin2

    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x))
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y))
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z))
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w))
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x))
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y))
    const c6 = o1.z.add(pos.x.mul(bx1.z)).add(pos.y.mul(by1.z)).add(pos.z.mul(bz1.z))
    const c7 = o1.w.add(pos.x.mul(bx1.w)).add(pos.y.mul(by1.w)).add(pos.z.mul(bz1.w))
    const c8 = o2.x.add(pos.x.mul(bx2.x)).add(pos.y.mul(by2.x)).add(pos.z.mul(bz2.x))
    const c9 = o2.y.add(pos.x.mul(bx2.y)).add(pos.y.mul(by2.y)).add(pos.z.mul(bz2.y))
    const c10 = o2.z.add(pos.x.mul(bx2.z)).add(pos.y.mul(by2.z)).add(pos.z.mul(bz2.z))

    const zx = float(cx).toVar(), zy = float(cy).toVar(), zz = float(cz).toVar()
    const z3 = float(c3).toVar(), z4 = float(c4).toVar(), z5 = float(c5).toVar()
    const z6 = float(c6).toVar(), z7 = float(c7).toVar(), z8 = float(c8).toVar()
    const z9 = float(c9).toVar(), z10 = float(c10).toVar()
    const dr = float(1).toVar(), r = float(0).toVar()

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
    const bail = float(uniforms.uEscapeRadius), maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())
      r.assign(sqrt(zx.mul(zx).add(zy.mul(zy)).add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10))))
      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr); dr.assign(powResult.y.mul(pwr).mul(dr).add(1)); const rp = powResult.x

      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1)))
      const zxzy_sq = zx.mul(zx).add(zy.mul(zy))
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t1 = r1.greaterThan(EPS).select(acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))), float(0))
      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t2 = r2.greaterThan(EPS).select(acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))), float(0))
      const r3 = sqrt(z3.mul(z3).add(z4.mul(z4)).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t3 = r3.greaterThan(EPS).select(acos(clamp(z3.div(max(r3, float(EPS))), float(-1), float(1))), float(0))
      const r4 = sqrt(z4.mul(z4).add(z5.mul(z5)).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t4 = r4.greaterThan(EPS).select(acos(clamp(z4.div(max(r4, float(EPS))), float(-1), float(1))), float(0))
      const r5 = sqrt(z5.mul(z5).add(z6.mul(z6)).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t5 = r5.greaterThan(EPS).select(acos(clamp(z5.div(max(r5, float(EPS))), float(-1), float(1))), float(0))
      const r6 = sqrt(z6.mul(z6).add(z7.mul(z7)).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t6 = r6.greaterThan(EPS).select(acos(clamp(z6.div(max(r6, float(EPS))), float(-1), float(1))), float(0))
      const r7 = sqrt(z7.mul(z7).add(z8.mul(z8)).add(z9.mul(z9)).add(z10.mul(z10)))
      const t7 = r7.greaterThan(EPS).select(acos(clamp(z7.div(max(r7, float(EPS))), float(-1), float(1))), float(0))
      const r8 = sqrt(z8.mul(z8).add(z9.mul(z9)).add(z10.mul(z10)))
      const t8 = r8.greaterThan(EPS).select(acos(clamp(z8.div(max(r8, float(EPS))), float(-1), float(1))), float(0))
      const t9 = atan(z10, z9)

      const s0 = sin(t0.add(phaseT).mul(pwr)), c0 = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)), c1 = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)), c2 = cos(t2.mul(pwr)), s3 = sin(t3.mul(pwr)), c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)), c4_ = cos(t4.mul(pwr)), s5 = sin(t5.mul(pwr)), c5_ = cos(t5.mul(pwr))
      const s6 = sin(t6.mul(pwr)), c6_ = cos(t6.mul(pwr)), s7 = sin(t7.mul(pwr)), c7_ = cos(t7.mul(pwr))
      const s8 = sin(t8.mul(pwr)), c8_ = cos(t8.mul(pwr)), s9 = sin(t9.mul(pwr)), c9_ = cos(t9.mul(pwr))

      const p0 = rp, p1 = p0.mul(s0), p2 = p1.mul(s1), p3 = p2.mul(s2), p4 = p3.mul(s3), p5 = p4.mul(s4), p6 = p5.mul(s5), p7 = p6.mul(s6), p8 = p7.mul(s7), p9 = p8.mul(s8)
      zz.assign(p0.mul(c0).add(cz)); zx.assign(p1.mul(c1).add(cx)); zy.assign(p2.mul(c2).add(cy))
      z3.assign(p3.mul(c3_).add(c3)); z4.assign(p4.mul(c4_).add(c4)); z5.assign(p5.mul(c5_).add(c5))
      z6.assign(p6.mul(c6_).add(c6)); z7.assign(p7.mul(c7_).add(c7)); z8.assign(p8.mul(c8_).add(c8))
      z9.assign(p9.mul(c9_).add(c9)); z10.assign(p9.mul(s9).add(c10))
    })
    return max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
  })
}

