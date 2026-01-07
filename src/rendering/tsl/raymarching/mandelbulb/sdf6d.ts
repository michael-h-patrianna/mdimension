/**
 * TSL 6D Mandelbulb SDF
 *
 * 6D Hyperbulb signed distance function with orbit traps.
 * Uses 5 hyperspherical angles.
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf6d
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

type Vec3Node = ReturnType<typeof vec3>

export const createMandelbulb6DSDF = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0, by0 = uniforms.uBasisY0, bz0 = uniforms.uBasisZ0, o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1, by1 = uniforms.uBasisY1, bz1 = uniforms.uBasisZ1, o1 = uniforms.uOrigin1

    // 6 components
    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x)).toVar('cx')
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y)).toVar('cy')
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z)).toVar('cz')
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w)).toVar('c3')
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x)).toVar('c4')
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y)).toVar('c5')

    const zx = float(cx).toVar('zx')
    const zy = float(cy).toVar('zy')
    const zz = float(cz).toVar('zz')
    const z3 = float(c3).toVar('z3')
    const z4 = float(c4).toVar('z4')
    const z5 = float(c5).toVar('z5')

    const dr = float(1).toVar('dr')
    const r = float(0).toVar('r')
    const minP = float(1000).toVar('minP')
    const minASq = float(1000000).toVar('minASq')
    const minS = float(1000).toVar('minS')
    const escIt = int(0).toVar('escIt')

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

      const zxzy_sq = zx.mul(zx).add(zy.mul(zy)).toVar('zxzy_sq')
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5))))

      If(r.greaterThan(bail), () => { escIt.assign(i); Break() })

      minP.assign(min(minP, abs(zy)))
      minASq.assign(min(minASq, zxzy_sq))
      minS.assign(min(minS, abs(r.sub(0.8))))

      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x.toVar('rp')
      const rpMinus1 = powResult.y.toVar('rpMinus1')
      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      // 6D: 5 angles
      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1))).toVar('t0')
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5))).toVar('r1')
      const t1 = r1.greaterThan(EPS).select(acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))), float(0)).toVar('t1')
      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5))).toVar('r2')
      const t2 = r2.greaterThan(EPS).select(acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))), float(0)).toVar('t2')
      const r3 = sqrt(z3.mul(z3).add(z4.mul(z4)).add(z5.mul(z5))).toVar('r3')
      const t3 = r3.greaterThan(EPS).select(acos(clamp(z3.div(max(r3, float(EPS))), float(-1), float(1))), float(0)).toVar('t3')
      const t4 = atan(z5, z4).toVar('t4')

      const s0 = sin(t0.add(phaseT).mul(pwr)), c0 = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)), c1 = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)), c2 = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr)), c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)), c4_ = cos(t4.mul(pwr))

      const p1 = rp.mul(s0)
      const p2 = p1.mul(s1)
      const p3 = p2.mul(s2)
      const p4 = p3.mul(s3)

      zz.assign(rp.mul(c0).add(cz))
      zx.assign(p1.mul(c1).add(cx))
      zy.assign(p2.mul(c2).add(cy))
      z3.assign(p3.mul(c3_).add(c3))
      z4.assign(p4.mul(c4_).add(c4))
      z5.assign(p4.mul(s4).add(c5))

      escIt.assign(i)
    })

    const minA = sqrt(minASq)
    const trap = exp(minP.negate().mul(5)).mul(0.3)
      .add(exp(minA.negate().mul(3)).mul(0.2))
      .add(exp(minS.negate().mul(8)).mul(0.2))
      .add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))

    const dist = max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
    return vec3(dist, trap, float(1))
  })
}

export const createMandelbulb6DSDFSimple = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0, by0 = uniforms.uBasisY0, bz0 = uniforms.uBasisZ0, o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1, by1 = uniforms.uBasisY1, bz1 = uniforms.uBasisZ1, o1 = uniforms.uOrigin1

    const cx = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x))
    const cy = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y))
    const cz = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z))
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w))
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x))
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y))

    const zx = float(cx).toVar(), zy = float(cy).toVar(), zz = float(cz).toVar()
    const z3 = float(c3).toVar(), z4 = float(c4).toVar(), z5 = float(c5).toVar()
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
    const bail = float(uniforms.uEscapeRadius)
    const maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())
      const zxzy_sq = zx.mul(zx).add(zy.mul(zy))
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5))))
      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr)
      dr.assign(powResult.y.mul(pwr).mul(dr).add(1))
      const rp = powResult.x

      const t0 = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1)))
      const r1 = sqrt(zxzy_sq.add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)))
      const t1 = r1.greaterThan(EPS).select(acos(clamp(zx.div(max(r1, float(EPS))), float(-1), float(1))), float(0))
      const r2 = sqrt(zy.mul(zy).add(z3.mul(z3)).add(z4.mul(z4)).add(z5.mul(z5)))
      const t2 = r2.greaterThan(EPS).select(acos(clamp(zy.div(max(r2, float(EPS))), float(-1), float(1))), float(0))
      const r3 = sqrt(z3.mul(z3).add(z4.mul(z4)).add(z5.mul(z5)))
      const t3 = r3.greaterThan(EPS).select(acos(clamp(z3.div(max(r3, float(EPS))), float(-1), float(1))), float(0))
      const t4 = atan(z5, z4)

      const s0 = sin(t0.add(phaseT).mul(pwr)), c0 = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)), c1 = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)), c2 = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr)), c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)), c4_ = cos(t4.mul(pwr))

      const p1 = rp.mul(s0), p2 = p1.mul(s1), p3 = p2.mul(s2), p4 = p3.mul(s3)

      zz.assign(rp.mul(c0).add(cz))
      zx.assign(p1.mul(c1).add(cx))
      zy.assign(p2.mul(c2).add(cy))
      z3.assign(p3.mul(c3_).add(c3))
      z4.assign(p4.mul(c4_).add(c4))
      z5.assign(p4.mul(s4).add(c5))
    })

    return max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
  })
}

