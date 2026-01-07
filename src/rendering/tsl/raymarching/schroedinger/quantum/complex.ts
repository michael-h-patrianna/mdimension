/**
 * TSL Complex Number Operations
 *
 * Complex number utilities for Schrödinger wavefunction computation.
 * Used for representing ψ(x,t) as complex (re, im) pairs stored in vec2.
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/complex
 */

import { Fn, vec2, dot, exp, cos, sin, atan } from 'three/tsl'
import type { Node } from 'three/tsl'

// Type alias for complex numbers (stored as vec2: x=real, y=imaginary)
type Vec2Node = Node

/**
 * Complex multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 */
export const cmul = Fn(([a, b]: [Vec2Node, Vec2Node]) => {
  return vec2(
    a.x.mul(b.x).sub(a.y.mul(b.y)), // Real: ac - bd
    a.x.mul(b.y).add(a.y.mul(b.x)) // Imaginary: ad + bc
  )
})

/**
 * Complex conjugate: (a + bi)* = a - bi
 */
export const cconj = Fn(([z]: [Vec2Node]) => {
  return vec2(z.x, z.y.negate())
})

/**
 * Complex modulus squared: |z|² = a² + b²
 */
export const cmod2 = Fn(([z]: [Vec2Node]) => {
  return dot(z, z)
})

/**
 * Complex modulus: |z| = sqrt(a² + b²)
 */
export const cmod = Fn(([z]: [Vec2Node]) => {
  return dot(z, z).sqrt()
})

/**
 * Complex exponential of imaginary: e^(iθ) = cos(θ) + i·sin(θ)
 */
export const cexpI = Fn(([theta]: [Node]) => {
  return vec2(cos(theta), sin(theta))
})

/**
 * Complex exponential: e^(a + bi) = e^a (cos(b) + i·sin(b))
 */
export const cexp = Fn(([z]: [Vec2Node]) => {
  const ea = exp(z.x)
  return vec2(ea.mul(cos(z.y)), ea.mul(sin(z.y)))
})

/**
 * Scale complex by real: c·z
 */
export const cscale = Fn(([c, z]: [Node, Vec2Node]) => {
  return z.mul(c)
})

/**
 * Complex addition (same as vec2 add, but named for clarity)
 */
export const cadd = Fn(([a, b]: [Vec2Node, Vec2Node]) => {
  return a.add(b)
})

/**
 * Complex subtraction
 */
export const csub = Fn(([a, b]: [Vec2Node, Vec2Node]) => {
  return a.sub(b)
})

/**
 * Complex division: (a + bi) / (c + di)
 * = ((ac + bd) + (bc - ad)i) / (c² + d²)
 *
 * CRITICAL: Guard against division by zero when b = (0, 0)
 * In TSL/GPU, all code paths execute regardless of conditionals.
 */
export const cdiv = Fn(([a, b]: [Vec2Node, Vec2Node]) => {
  const denom = dot(b, b) // c² + d²
  // Guard: prevent division by zero when b is the zero vector
  const safeDenom = denom.max(1e-10)
  const real = a.x.mul(b.x).add(a.y.mul(b.y)).div(safeDenom)
  const imag = a.y.mul(b.x).sub(a.x.mul(b.y)).div(safeDenom)
  return vec2(real, imag)
})

/**
 * Complex power using De Moivre's formula: z^n
 * z = r·e^(iθ) => z^n = r^n · e^(inθ)
 */
export const cpow = Fn(([z, n]: [Vec2Node, Node]) => {
  const r = cmod(z)
  const theta = atan(z.y, z.x) // atan(imag, real)
  const rn = r.pow(n)
  const nTheta = theta.mul(n)
  return vec2(rn.mul(cos(nTheta)), rn.mul(sin(nTheta)))
})

/**
 * Complex square root (principal branch)
 */
export const csqrt = Fn(([z]: [Vec2Node]) => {
  const r = cmod(z)
  const halfTheta = atan(z.y, z.x).mul(0.5)
  const sqrtR = r.sqrt()
  return vec2(sqrtR.mul(cos(halfTheta)), sqrtR.mul(sin(halfTheta)))
})

/**
 * Alias for cexpI for WebGL parity
 * Complex exponential of imaginary: e^(iθ) = cos(θ) + i·sin(θ)
 */
export const cexp_i = cexpI

