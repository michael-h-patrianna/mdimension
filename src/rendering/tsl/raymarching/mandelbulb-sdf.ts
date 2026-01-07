/**
 * TSL Mandelbulb SDF
 *
 * 4D Mandelbulb signed distance function with orbit traps.
 * Uses N-dimensional rotated basis vectors for higher dimensional slicing.
 *
 * Note: Uses vec4 packed uniforms for basis vectors (like TubeWireframeTSL)
 * rather than Float32Array uniforms which have limited TSL support.
 *
 * @module rendering/tsl/raymarching/mandelbulb-sdf
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

import { getEffectivePower, optimizedPow, type PowerUniforms } from './mandelbulb/power'
import type { Mandelbulb3D4DUniforms } from './mandelbulb/types'
import { EPS, MAX_ITER_HQ } from './mandelbulb/types'

// Type alias for return type of TSL nodes
type Vec3Node = ReturnType<typeof vec3>

/** Mandelbulb uniforms interface - uses vec4 packed basis vectors */
export type MandelbulbUniforms = Mandelbulb3D4DUniforms

/**
 * Create 4D Mandelbulb SDF with orbit traps
 *
 * @param uniforms - Mandelbulb uniforms
 * @returns SDF function that returns vec3(dist, trap, 1)
 */
export const createMandelbulb4DSDF = (uniforms: MandelbulbUniforms) => {
  /**
   * 4D Mandelbulb SDF
   *
   * @param pos - 3D position to evaluate
   * @returns vec3 with x=dist (signed distance), y=trap (orbit trap), z=1 (valid)
   */
  return Fn(([pos]: [Vec3Node]) => {
    // Transform 3D position to 4D using basis vectors (from vec4 uniforms)
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    const cx = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x)).toVar('cx')
    const cy = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y)).toVar('cy')
    const cz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z)).toVar('cz')
    const cw = o.w.add(pos.x.mul(bx.w)).add(pos.y.mul(by.w)).add(pos.z.mul(bz.w)).toVar('cw')

    // Iteration variables
    const zx = float(cx).toVar('zx')
    const zy = float(cy).toVar('zy')
    const zz = float(cz).toVar('zz')
    const zw = float(cw).toVar('zw')

    const dr = float(1).toVar('dr')
    const r = float(0).toVar('r')

    // Orbit traps
    const minPlane = float(1000).toVar('minPlane')
    const minAxisSq = float(1000000).toVar('minAxisSq')
    const minSphere = float(1000).toVar('minSphere')
    const escIt = int(0).toVar('escIt')

    // Pre-compute phase offsets
    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0)).toVar('phaseT')
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0)).toVar('phaseP')

    // Get effective power (with animation and alternate blending)
    // WebGL: float pwr = getEffectivePower();
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

    // Main iteration loop - use simple count-based loop
    Loop(MAX_ITER_HQ, ({ i }) => {
      // Early exit if past max iterations
      If(i.greaterThanEqual(maxIt), () => {
        Break()
      })

      // Calculate radius
      const zxzy_sq = zx.mul(zx).add(zy.mul(zy)).toVar('zxzy_sq')
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(zw.mul(zw))))

      // Escape check
      If(r.greaterThan(bail), () => {
        escIt.assign(i)
        Break()
      })

      // Orbit traps
      minPlane.assign(min(minPlane, abs(zy)))
      minAxisSq.assign(min(minAxisSq, zxzy_sq))
      minSphere.assign(min(minSphere, abs(r.sub(0.8))))

      // Optimized power calculation
      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x.toVar('rp')
      const rpMinus1 = powResult.y.toVar('rpMinus1')

      // Update derivative
      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      // Convert to hyperspherical (z-axis primary)
      const theta = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1))).toVar('theta')

      // rxyw = sqrt(zx^2 + zy^2 + zw^2)
      const rxyw = sqrt(max(float(0), zxzy_sq.add(zw.mul(zw)))).toVar('rxyw')

      const phi = rxyw.greaterThan(EPS).select(
        acos(clamp(zx.div(max(rxyw, float(EPS))), float(-1), float(1))),
        float(0)
      ).toVar('phi')

      const psi = atan(zw, zy).toVar('psi')

      // Power map with phase shift
      const thetaN = theta.add(phaseT).mul(pwr).toVar('thetaN')
      const phiN = phi.add(phaseP).mul(pwr).toVar('phiN')
      const psiN = psi.mul(pwr).toVar('psiN')

      // Convert back from hyperspherical
      const cTheta = cos(thetaN).toVar('cTheta')
      const sTheta = sin(thetaN).toVar('sTheta')
      const cPhi = cos(phiN).toVar('cPhi')
      const sPhi = sin(phiN).toVar('sPhi')
      const cPsi = cos(psiN).toVar('cPsi')
      const sPsi = sin(psiN).toVar('sPsi')

      const rSinTheta = rp.mul(sTheta).toVar('rSinTheta')
      const rSinThetaSinPhi = rSinTheta.mul(sPhi).toVar('rSinThetaSinPhi')

      // Update z components
      zz.assign(rp.mul(cTheta).add(cz))
      zx.assign(rSinTheta.mul(cPhi).add(cx))
      zy.assign(rSinThetaSinPhi.mul(cPsi).add(cy))
      zw.assign(rSinThetaSinPhi.mul(sPsi).add(cw))

      escIt.assign(i)
    })

    // Compute trap value
    const minAxis = sqrt(minAxisSq)
    const trap = exp(minPlane.negate().mul(5)).mul(0.3)
      .add(exp(minAxis.negate().mul(3)).mul(0.2))
      .add(exp(minSphere.negate().mul(8)).mul(0.2))
      .add(float(escIt).div(float(max(maxIt, int(1)))).mul(0.3))

    // Compute signed distance
    const dist = max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )

    return vec3(dist, trap, float(1)) // Pack into vec3: x=dist, y=trap, z=valid
  })
}

/**
 * Create simplified 4D Mandelbulb SDF (no orbit traps)
 *
 * Used for normal calculation and shadow rays where traps aren't needed.
 *
 * @param uniforms - Mandelbulb uniforms
 * @returns SDF function that returns distance only
 */
export const createMandelbulb4DSDFSimple = (uniforms: MandelbulbUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    // Transform 3D position to 4D using basis vectors
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    const cx = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x))
    const cy = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y))
    const cz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z))
    const cw = o.w.add(pos.x.mul(bx.w)).add(pos.y.mul(by.w)).add(pos.z.mul(bz.w))

    const zx = float(cx).toVar()
    const zy = float(cy).toVar()
    const zz = float(cz).toVar()
    const zw = float(cw).toVar()

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
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz)).add(zw.mul(zw))))

      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x
      const rpMinus1 = powResult.y

      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      const theta = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1)))
      const rxyw = sqrt(max(float(0), zxzy_sq.add(zw.mul(zw))))
      const phi = rxyw.greaterThan(EPS).select(
        acos(clamp(zx.div(max(rxyw, float(EPS))), float(-1), float(1))),
        float(0)
      )
      const psi = atan(zw, zy)

      const thetaN = theta.add(phaseT).mul(pwr)
      const phiN = phi.add(phaseP).mul(pwr)

      const cTheta = cos(thetaN)
      const sTheta = sin(thetaN)
      const cPhi = cos(phiN)
      const sPhi = sin(phiN)
      const cPsi = cos(psi.mul(pwr))
      const sPsi = sin(psi.mul(pwr))

      const rSinThetaSinPhi = rp.mul(sTheta).mul(sPhi)

      zz.assign(rp.mul(cTheta).add(cz))
      zx.assign(rp.mul(sTheta).mul(cPhi).add(cx))
      zy.assign(rSinThetaSinPhi.mul(cPsi).add(cy))
      zw.assign(rSinThetaSinPhi.mul(sPsi).add(cw))
    })

    return max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )
  })
}
