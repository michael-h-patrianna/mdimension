/**
 * TSL 3D Mandelbulb SDF
 *
 * 3D Mandelbulb signed distance function with orbit traps.
 * Uses z-axis primary convention (standard Mandelbulb).
 *
 * Optimizations:
 * - OPT-C5: Defer orbit trap sqrt (minAxisSq instead of minAxis)
 * - OPT-M1: Cache zxzy_sq for r and minAxisSq calculations
 * - Pre-computed phase offsets outside loop
 * - Unrolled 3-component basis vector transformations
 *
 * @module rendering/tsl/raymarching/mandelbulb/sdf3d
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

import { getEffectivePower, optimizedPow, type PowerUniforms } from './power'
import type { Mandelbulb3D4DUniforms } from './types'
import { EPS, MAX_ITER_HQ } from './types'

// Type aliases
type Vec3Node = ReturnType<typeof vec3>

/**
 * Mandelbulb 3D uniforms interface.
 * Uses vec4 packed basis vectors (only xyz used for 3D).
 * Re-exports from types.ts for backwards compatibility.
 */
export type Mandelbulb3DUniforms = Mandelbulb3D4DUniforms

/**
 * Create 3D Mandelbulb SDF with orbit traps.
 *
 * Uses z-axis primary convention (standard Mandelbulb).
 * Only 2 hyperspherical angles (theta, phi) for 3D.
 *
 * @param uniforms - Mandelbulb 3D uniforms
 * @returns SDF function that returns vec3(dist, trap, 1)
 */
export const createMandelbulb3DSDF = (uniforms: Mandelbulb3DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    // Transform 3D position using 3-component basis vectors (UNROLLED)
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    // Only use xyz components for 3D
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    // OPT: Unrolled 3-component basis transformation
    const cx = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x)).toVar('cx')
    const cy = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y)).toVar('cy')
    const cz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z)).toVar('cz')

    // Iteration variables (3 components for 3D)
    const zx = float(cx).toVar('zx')
    const zy = float(cy).toVar('zy')
    const zz = float(cz).toVar('zz')

    const dr = float(1).toVar('dr')
    const r = float(0).toVar('r')

    // Orbit traps - OPT-C5: Track squared values, sqrt after loop
    const minPlane = float(1000).toVar('minPlane')
    const minAxisSq = float(1000000).toVar('minAxisSq') // Squared for deferred sqrt
    const minSphere = float(1000).toVar('minSphere')
    const escIt = int(0).toVar('escIt')

    // Pre-compute phase offsets outside loop (OPT: saves comparisons per iteration)
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

    // Main iteration loop
    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      // OPT-M1: Cache zxzy_sq for both r and minAxisSq calculations
      const zxzy_sq = zx.mul(zx).add(zy.mul(zy)).toVar('zxzy_sq')
      r.assign(sqrt(zxzy_sq.add(zz.mul(zz))))

      // Escape check
      If(r.greaterThan(bail), () => {
        escIt.assign(i)
        Break()
      })

      // Orbit traps (z-axis primary convention)
      minPlane.assign(min(minPlane, abs(zy)))
      minAxisSq.assign(min(minAxisSq, zxzy_sq)) // OPT-C5: Track squared
      minSphere.assign(min(minSphere, abs(r.sub(0.8))))

      // Optimized power calculation
      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x.toVar('rp')
      const rpMinus1 = powResult.y.toVar('rpMinus1')

      // Update derivative
      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      // To spherical: z-axis primary (standard Mandelbulb)
      // theta = acos(z/r), phi = atan(y, x)
      const theta = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1))).toVar('theta')
      const phi = atan(zy, zx).toVar('phi')

      // Power map: angles * n (with pre-computed phase shift)
      const thetaN = theta.add(phaseT).mul(pwr).toVar('thetaN')
      const phiN = phi.add(phaseP).mul(pwr).toVar('phiN')

      // From spherical: z-axis primary reconstruction
      const cTheta = cos(thetaN).toVar('cTheta')
      const sTheta = sin(thetaN).toVar('sTheta')
      const cPhi = cos(phiN).toVar('cPhi')
      const sPhi = sin(phiN).toVar('sPhi')

      // z = r^n * cos(theta*n) + c_z
      // x = r^n * sin(theta*n) * cos(phi*n) + c_x
      // y = r^n * sin(theta*n) * sin(phi*n) + c_y
      zz.assign(rp.mul(cTheta).add(cz))
      zx.assign(rp.mul(sTheta).mul(cPhi).add(cx))
      zy.assign(rp.mul(sTheta).mul(sPhi).add(cy))

      escIt.assign(i)
    })

    // OPT-C5: Single sqrt after loop for orbit trap
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

    return vec3(dist, trap, float(1)) // Pack: x=dist, y=trap, z=valid
  })
}

/**
 * Create simplified 3D Mandelbulb SDF (no orbit traps).
 *
 * Used for normal calculation and shadow rays where traps aren't needed.
 * Faster than full version due to no orbit tracking.
 *
 * @param uniforms - Mandelbulb 3D uniforms
 * @returns SDF function that returns distance only
 */
export const createMandelbulb3DSDFSimple = (uniforms: Mandelbulb3DUniforms) => {
  return Fn(([pos]: [Vec3Node]) => {
    // Transform using 3-component basis vectors (UNROLLED)
    const bx = uniforms.uBasisX0
    const by = uniforms.uBasisY0
    const bz = uniforms.uBasisZ0
    const o = uniforms.uOrigin0

    const cx = o.x.add(pos.x.mul(bx.x)).add(pos.y.mul(by.x)).add(pos.z.mul(bz.x))
    const cy = o.y.add(pos.x.mul(bx.y)).add(pos.y.mul(by.y)).add(pos.z.mul(bz.y))
    const cz = o.z.add(pos.x.mul(bx.z)).add(pos.y.mul(by.z)).add(pos.z.mul(bz.z))

    const zx = float(cx).toVar()
    const zy = float(cy).toVar()
    const zz = float(cz).toVar()

    const dr = float(1).toVar()
    const r = float(0).toVar()

    // Pre-compute phase offsets
    const phaseT = uniforms.uPhaseEnabled.select(uniforms.uPhaseTheta, float(0))
    const phaseP = uniforms.uPhaseEnabled.select(uniforms.uPhasePhi, float(0))

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
    const pwr = float(getEffectivePower(powerUniforms))

    const bail = float(uniforms.uEscapeRadius)
    const maxIt = int(uniforms.uIterations)

    Loop(MAX_ITER_HQ, ({ i }) => {
      If(i.greaterThanEqual(maxIt), () => Break())

      r.assign(sqrt(zx.mul(zx).add(zy.mul(zy)).add(zz.mul(zz))))

      If(r.greaterThan(bail), () => Break())

      const powResult = optimizedPow(r, pwr)
      const rp = powResult.x
      const rpMinus1 = powResult.y

      dr.assign(rpMinus1.mul(pwr).mul(dr).add(1))

      // z-axis primary (standard Mandelbulb)
      const theta = acos(clamp(zz.div(max(r, float(EPS))), float(-1), float(1)))
      const phi = atan(zy, zx)

      const thetaN = theta.add(phaseT).mul(pwr)
      const phiN = phi.add(phaseP).mul(pwr)

      const cTheta = cos(thetaN)
      const sTheta = sin(thetaN)
      const cPhi = cos(phiN)
      const sPhi = sin(phiN)

      zz.assign(rp.mul(cTheta).add(cz))
      zx.assign(rp.mul(sTheta).mul(cPhi).add(cx))
      zy.assign(rp.mul(sTheta).mul(sPhi).add(cy))
    })

    return max(
      float(0.5).mul(log(max(r, float(EPS)))).mul(r).div(max(dr, float(EPS))),
      float(EPS)
    )
  })
}

