/**
 * TSL Mandelbulb Uniforms Types
 *
 * Shared uniform interfaces for all dimension-specific Mandelbulb SDFs.
 *
 * @module rendering/tsl/raymarching/mandelbulb/types
 */

import type { UniformNode } from 'three/tsl'
import type * as THREE from 'three'

// Type alias for vec4 uniforms
export type Vec4Uniform = UniformNode<THREE.Vector4>

// Constants - MUST match WebGL constants.glsl.ts for parity
// WebGL uses MAX_ITER_HQ = 256 as compile-time limit, runtime controlled by uSdfMaxIterations
export const EPS = 1e-6 // WebGL: #define EPS 1e-6
export const MAX_ITER_HQ = 256 // WebGL: #define MAX_ITER_HQ 256 - compile-time loop limit

/**
 * Base Mandelbulb uniforms (common to all dimensions).
 */
export interface MandelbulbBaseUniforms {
  // Fractal parameters
  uPower: UniformNode<number>
  uIterations: UniformNode<number>
  uEscapeRadius: UniformNode<number>

  // Power animation (Technique B - power oscillation)
  // WebGL: uniform bool uPowerAnimationEnabled; uniform float uAnimatedPower;
  uPowerAnimationEnabled: UniformNode<boolean>
  uAnimatedPower: UniformNode<number>

  // Phase shift animation
  uPhaseEnabled: UniformNode<boolean>
  uPhaseTheta: UniformNode<number>
  uPhasePhi: UniformNode<number>

  // Alternate power blending
  uAlternatePowerEnabled: UniformNode<boolean>
  uAlternatePowerValue: UniformNode<number>
  uAlternatePowerBlend: UniformNode<number>
}

/**
 * Mandelbulb uniforms for dimensions 3D-4D.
 * Uses single vec4 for each basis vector (4 components).
 */
export interface Mandelbulb3D4DUniforms extends MandelbulbBaseUniforms {
  // N-dimensional basis vectors (packed as vec4)
  // uBasisX0 = vec4(basisX[0], basisX[1], basisX[2], basisX[3])
  uBasisX0: Vec4Uniform
  uBasisY0: Vec4Uniform
  uBasisZ0: Vec4Uniform
  uOrigin0: Vec4Uniform
}

/**
 * Mandelbulb uniforms for dimensions 5D-8D.
 * Uses two vec4s per basis vector (8 components).
 */
export interface Mandelbulb5D8DUniforms extends Mandelbulb3D4DUniforms {
  // Second set of vec4s for components 4-7
  uBasisX1: Vec4Uniform
  uBasisY1: Vec4Uniform
  uBasisZ1: Vec4Uniform
  uOrigin1: Vec4Uniform
}

/**
 * Mandelbulb uniforms for dimensions 9D-11D.
 * Uses three vec4s per basis vector (11 components max).
 */
export interface Mandelbulb9D11DUniforms extends Mandelbulb5D8DUniforms {
  // Third set of vec4s for components 8-10 (w unused for 11D)
  uBasisX2: Vec4Uniform
  uBasisY2: Vec4Uniform
  uBasisZ2: Vec4Uniform
  uOrigin2: Vec4Uniform
}

/**
 * Full Mandelbulb uniforms interface (all dimensions).
 * Alias for the most complete uniform set.
 */
export type MandelbulbUniforms = Mandelbulb9D11DUniforms

// Note: WebGL uses MAX_ITER_HQ (256) as compile-time loop limit for all dimensions.
// Actual iteration count is controlled at runtime by uSdfMaxIterations uniform.

