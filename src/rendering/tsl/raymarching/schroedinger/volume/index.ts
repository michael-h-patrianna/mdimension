/**
 * TSL Volume Rendering Module Index
 *
 * Exports Beer-Lambert absorption, emission color computation,
 * and volume integration utilities for quantum wavefunction visualization.
 *
 * @module rendering/tsl/raymarching/schroedinger/volume
 */

// Beer-Lambert absorption
export {
  computeAlpha,
  computeAlphaBoost,
  computeTransmittance,
  accumulateTransmittance,
  frontToBackComposite,
} from './absorption'

// Emission color
export {
  normalizedDensity,
  blackbody,
  henyeyGreenstein,
  rgb2hsl,
  hsl2rgb,
  phaseToHue,
  createComputeBaseColor,
  createComputeEmission,
  createComputeEmissionLit,
  type EmissionUniforms,
} from './emission'

// Volume integration
export {
  createTetrahedralGradient,
  createVolumeRaymarch,
  sphereIntersect,
  type VolumeIntegrationUniforms,
  type VolumeResult,
} from './integration'
