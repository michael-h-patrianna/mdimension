/**
 * TSL 8D Mandelbulb SDF
 *
 * 8D Hyperbulb signed distance function with orbit traps.
 * Uses 7 hyperspherical angles with tail-subtraction approach
 * matching WebGL sdf8d.glsl.ts exactly.
 *
 * OPT-C1: inversesqrt in tail loop (adapted for TSL)
 * OPT-C3: Use optimizedPow for r^pwr and r^(pwr-1)
 * OPT-C5: Defer orbit trap sqrt (minASq)
 * OPT-M3: Cache z01_sq for r and minA calculations
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf8d
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

// Helper: inverseSqrt not exported from three/tsl, use 1/sqrt(x) equivalent
const inverseSqrt = (x: ReturnType<typeof float>) => float(1).div(sqrt(x))

import type { Mandelbulb5D8DUniforms } from './types'
import { EPS, MAX_ITER_HQ } from './types'
import { getEffectivePower, optimizedPow, type PowerUniforms } from './power'

type Vec3Node = ReturnType<typeof vec3>

/**
 * Create 8D Mandelbulb SDF with orbit traps.
 *
 * Uses tail-subtraction approach for hyperspherical coordinate conversion,
 * matching WebGL sdf8D exactly:
 * - z[0] is the primary axis (polar angle t[0] from z[0])
 * - Reconstruction: z[0] = rp*cos(t0), z[1] = rp*sin(t0)*cos(t1), etc.
 */
export const createMandelbulb8DSDF = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0,
      by0 = uniforms.uBasisY0,
      bz0 = uniforms.uBasisZ0,
      o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1,
      by1 = uniforms.uBasisY1,
      bz1 = uniforms.uBasisZ1,
      o1 = uniforms.uOrigin1

    // 8 components: c[0..7] and z[0..7]
    // WebGL: c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j]
    const c0 = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x)).toVar('c0')
    const c1 = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y)).toVar('c1')
    const c2 = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z)).toVar('c2')
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w)).toVar('c3')
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x)).toVar('c4')
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y)).toVar('c5')
    const c6 = o1.z.add(pos.x.mul(bx1.z)).add(pos.y.mul(by1.z)).add(pos.z.mul(bz1.z)).toVar('c6')
    const c7 = o1.w.add(pos.x.mul(bx1.w)).add(pos.y.mul(by1.w)).add(pos.z.mul(bz1.w)).toVar('c7')

    // z starts at c (Mandelbulb mode)
    const z0 = float(c0).toVar('z0'),
      z1 = float(c1).toVar('z1'),
      z2 = float(c2).toVar('z2')
    const z3 = float(c3).toVar('z3'),
      z4 = float(c4).toVar('z4'),
      z5 = float(c5).toVar('z5')
    const z6 = float(c6).toVar('z6'),
      z7 = float(c7).toVar('z7')

    const dr = float(1).toVar('dr'),
      r = float(0).toVar('r')

    // Orbit traps - OPT-C5: minASq instead of minA
    const minP = float(1000).toVar('minP'),
      minASq = float(1000000).toVar('minASq'),
      minS = float(1000).toVar('minS')
    const escIt = int(0).toVar('escIt')

    // Phase shifts for angular twisting
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
    const bail = float(uniforms.uEscapeRadius).toVar('bail'),
      maxIt = int(uniforms.uIterations).toVar('maxIt')

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      // OPT-M3: Cache z01_sq for both r and minASq calculations
      const z01_sq = z0.mul(z0).add(z1.mul(z1)).toVar('z01_sq')
      r.assign(
        sqrt(
          z01_sq
            .add(z2.mul(z2))
            .add(z3.mul(z3))
            .add(z4.mul(z4))
            .add(z5.mul(z5))
            .add(z6.mul(z6))
            .add(z7.mul(z7))
        )
      )
      If(r.greaterThan(bail), () => {
        escIt.assign(i)
        Break()
      })

      // Orbit traps - WebGL: minP=z[1], minASq=z[0]^2+z[1]^2
      minP.assign(min(minP, abs(z1)))
      minASq.assign(min(minASq, z01_sq))
      minS.assign(min(minS, abs(r.sub(0.8))))

      // OPT-C3: Use optimizedPow
      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x.toVar('rp')
      dr.assign(powResult.y.mul(pwr).mul(dr).add(1))

      // 8D: 7 angles using tail-subtraction approach (matching WebGL exactly)
      // OPT-C1: Use inversesqrt
      const tailSq = r.mul(r).toVar('tailSq')

      // t[0] = acos(z[0] / sqrt(tailSq))
      const invTail0 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t0 = acos(clamp(z0.mul(invTail0), float(-1), float(1))).toVar('t0')
      tailSq.assign(max(tailSq.sub(z0.mul(z0)), float(0)))

      // t[1] = acos(z[1] / sqrt(tailSq))
      const invTail1 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t1 = acos(clamp(z1.mul(invTail1), float(-1), float(1))).toVar('t1')
      tailSq.assign(max(tailSq.sub(z1.mul(z1)), float(0)))

      // t[2] = acos(z[2] / sqrt(tailSq))
      const invTail2 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t2 = acos(clamp(z2.mul(invTail2), float(-1), float(1))).toVar('t2')
      tailSq.assign(max(tailSq.sub(z2.mul(z2)), float(0)))

      // t[3] = acos(z[3] / sqrt(tailSq))
      const invTail3 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t3 = acos(clamp(z3.mul(invTail3), float(-1), float(1))).toVar('t3')
      tailSq.assign(max(tailSq.sub(z3.mul(z3)), float(0)))

      // t[4] = acos(z[4] / sqrt(tailSq))
      const invTail4 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t4 = acos(clamp(z4.mul(invTail4), float(-1), float(1))).toVar('t4')
      tailSq.assign(max(tailSq.sub(z4.mul(z4)), float(0)))

      // t[5] = acos(z[5] / sqrt(tailSq))
      const invTail5 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t5 = acos(clamp(z5.mul(invTail5), float(-1), float(1))).toVar('t5')
      // No need to update tailSq for last angle

      // t[6] = atan(z[7], z[6])
      const t6 = atan(z7, z6).toVar('t6')

      // Apply phase shifts to first two angles (theta, phi)
      const s0 = sin(t0.add(phaseT).mul(pwr)),
        c0_ = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)),
        c1_ = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)),
        c2_ = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr)),
        c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)),
        c4_ = cos(t4.mul(pwr))
      const s5 = sin(t5.mul(pwr)),
        c5_ = cos(t5.mul(pwr))
      const s6 = sin(t6.mul(pwr)),
        c6_ = cos(t6.mul(pwr))

      // Reconstruction (matching WebGL exactly):
      // z[0] = rp * cos(t0)
      // z[1] = rp * sin(t0) * cos(t1)
      // z[k] = sp * cos(tk) for k=2..5
      // z[6] = sp * cos(t6), z[7] = sp * sin(t6)
      z0.assign(rp.mul(c0_).add(c0))
      const sp = rp.mul(s0).toVar('sp')
      z1.assign(sp.mul(c1_).add(c1))
      sp.assign(sp.mul(s1))
      z2.assign(sp.mul(c2_).add(c2))
      sp.assign(sp.mul(s2))
      z3.assign(sp.mul(c3_).add(c3))
      sp.assign(sp.mul(s3))
      z4.assign(sp.mul(c4_).add(c4))
      sp.assign(sp.mul(s4))
      z5.assign(sp.mul(c5_).add(c5))
      sp.assign(sp.mul(s5))
      z6.assign(sp.mul(c6_).add(c6))
      z7.assign(sp.mul(s6).add(c7))

      escIt.assign(i)
    })

    // OPT-C5: Single sqrt after loop for final trap value
    const minA = sqrt(minASq)
    const trap = exp(minP.negate().mul(5))
      .mul(0.3)
      .add(exp(minA.negate().mul(3)).mul(0.2))
      .add(exp(minS.negate().mul(8)).mul(0.2))
      .add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))
    const dist = max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
    return vec3(dist, trap, float(1))
  })
}

/**
 * Create simplified 8D Mandelbulb SDF (no orbit traps).
 *
 * Used for normal calculation and shadow rays.
 */
export const createMandelbulb8DSDFSimple = (uniforms: Mandelbulb5D8DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    const bx0 = uniforms.uBasisX0,
      by0 = uniforms.uBasisY0,
      bz0 = uniforms.uBasisZ0,
      o0 = uniforms.uOrigin0
    const bx1 = uniforms.uBasisX1,
      by1 = uniforms.uBasisY1,
      bz1 = uniforms.uBasisZ1,
      o1 = uniforms.uOrigin1

    // 8 components
    const c0 = o0.x.add(pos.x.mul(bx0.x)).add(pos.y.mul(by0.x)).add(pos.z.mul(bz0.x))
    const c1 = o0.y.add(pos.x.mul(bx0.y)).add(pos.y.mul(by0.y)).add(pos.z.mul(bz0.y))
    const c2 = o0.z.add(pos.x.mul(bx0.z)).add(pos.y.mul(by0.z)).add(pos.z.mul(bz0.z))
    const c3 = o0.w.add(pos.x.mul(bx0.w)).add(pos.y.mul(by0.w)).add(pos.z.mul(bz0.w))
    const c4 = o1.x.add(pos.x.mul(bx1.x)).add(pos.y.mul(by1.x)).add(pos.z.mul(bz1.x))
    const c5 = o1.y.add(pos.x.mul(bx1.y)).add(pos.y.mul(by1.y)).add(pos.z.mul(bz1.y))
    const c6 = o1.z.add(pos.x.mul(bx1.z)).add(pos.y.mul(by1.z)).add(pos.z.mul(bz1.z))
    const c7 = o1.w.add(pos.x.mul(bx1.w)).add(pos.y.mul(by1.w)).add(pos.z.mul(bz1.w))

    const z0 = float(c0).toVar(),
      z1 = float(c1).toVar(),
      z2 = float(c2).toVar()
    const z3 = float(c3).toVar(),
      z4 = float(c4).toVar(),
      z5 = float(c5).toVar()
    const z6 = float(c6).toVar(),
      z7 = float(c7).toVar()
    const dr = float(1).toVar(),
      r = float(0).toVar()

    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0))
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0))

    // Get effective power
    const powerUniforms: PowerUniforms = {
      uPower: uniforms.uPower,
      uPowerAnimationEnabled: uniforms.uPowerAnimationEnabled,
      uAnimatedPower: uniforms.uAnimatedPower,
      uAlternatePowerEnabled: uniforms.uAlternatePowerEnabled,
      uAlternatePowerValue: uniforms.uAlternatePowerValue,
      uAlternatePowerBlend: uniforms.uAlternatePowerBlend,
    }
    const pwr = float(getEffectivePower(powerUniforms))
    const bail = float(uniforms.uEscapeRadius),
      maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())
      r.assign(
        sqrt(
          z0
            .mul(z0)
            .add(z1.mul(z1))
            .add(z2.mul(z2))
            .add(z3.mul(z3))
            .add(z4.mul(z4))
            .add(z5.mul(z5))
            .add(z6.mul(z6))
            .add(z7.mul(z7))
        )
      )
      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr)
      dr.assign(powResult.y.mul(pwr).mul(dr).add(1))
      const rp = powResult.x

      // Tail-subtraction approach (matching WebGL)
      const tailSq = r.mul(r).toVar()

      const invTail0 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t0 = acos(clamp(z0.mul(invTail0), float(-1), float(1)))
      tailSq.assign(max(tailSq.sub(z0.mul(z0)), float(0)))

      const invTail1 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t1 = acos(clamp(z1.mul(invTail1), float(-1), float(1)))
      tailSq.assign(max(tailSq.sub(z1.mul(z1)), float(0)))

      const invTail2 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t2 = acos(clamp(z2.mul(invTail2), float(-1), float(1)))
      tailSq.assign(max(tailSq.sub(z2.mul(z2)), float(0)))

      const invTail3 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t3 = acos(clamp(z3.mul(invTail3), float(-1), float(1)))
      tailSq.assign(max(tailSq.sub(z3.mul(z3)), float(0)))

      const invTail4 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t4 = acos(clamp(z4.mul(invTail4), float(-1), float(1)))
      tailSq.assign(max(tailSq.sub(z4.mul(z4)), float(0)))

      const invTail5 = inverseSqrt(max(tailSq, float(EPS * EPS)))
      const t5 = acos(clamp(z5.mul(invTail5), float(-1), float(1)))

      const t6 = atan(z7, z6)

      // Apply phase shifts
      const s0 = sin(t0.add(phaseT).mul(pwr)),
        c0_ = cos(t0.add(phaseT).mul(pwr))
      const s1 = sin(t1.add(phaseP).mul(pwr)),
        c1_ = cos(t1.add(phaseP).mul(pwr))
      const s2 = sin(t2.mul(pwr)),
        c2_ = cos(t2.mul(pwr))
      const s3 = sin(t3.mul(pwr)),
        c3_ = cos(t3.mul(pwr))
      const s4 = sin(t4.mul(pwr)),
        c4_ = cos(t4.mul(pwr))
      const s5 = sin(t5.mul(pwr)),
        c5_ = cos(t5.mul(pwr))
      const s6 = sin(t6.mul(pwr)),
        c6_ = cos(t6.mul(pwr))

      // Reconstruction
      z0.assign(rp.mul(c0_).add(c0))
      const sp = rp.mul(s0).toVar()
      z1.assign(sp.mul(c1_).add(c1))
      sp.assign(sp.mul(s1))
      z2.assign(sp.mul(c2_).add(c2))
      sp.assign(sp.mul(s2))
      z3.assign(sp.mul(c3_).add(c3))
      sp.assign(sp.mul(s3))
      z4.assign(sp.mul(c4_).add(c4))
      sp.assign(sp.mul(s4))
      z5.assign(sp.mul(c5_).add(c5))
      sp.assign(sp.mul(s5))
      z6.assign(sp.mul(c6_).add(c6))
      z7.assign(sp.mul(s6).add(c7))
    })

    return max(float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))), float(EPS))
  })
}
