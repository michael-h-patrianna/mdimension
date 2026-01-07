/**
 * TSL Black Hole Module Index
 *
 * Exports black hole rendering utilities:
 * - Gravitational lensing with Kerr frame dragging
 * - Event horizon
 * - Photon shell
 * - Accretion disk (volumetric and SDF modes)
 * - Doppler effect
 * - Color algorithms
 * - Effects (motion blur, deferred lensing)
 * - Shader composition
 *
 * @module rendering/tsl/raymarching/blackhole
 */

// Gravity functions
export * from './gravity'

// Effects
export * from './effects'

// Shader composition
export {
  composeBlackHoleTSL,
  type BlackHoleShaderConfig,
  type ComposedBlackHoleUniforms,
  type ComposedBlackHoleMaterial,
} from './composeBlackHoleTSL'

