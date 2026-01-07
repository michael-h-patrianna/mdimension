/**
 * TSL Lighting System for Mesh Rendering
 *
 * Complete lighting infrastructure for polytopes and tube wireframes.
 * Provides visual parity with WebGL implementation.
 *
 * @module rendering/tsl/lighting
 */

// Multi-light system for meshes
export {
  computeAmbient,
  computeDirectionalLight,
  computeFresnelRim,
  computePBRSpecular,
  computePointLight,
  computeSpotLight,
  createMultiLightNode,
  distributionGGX,
  fresnelSchlick,
  geometrySchlickGGX,
  geometrySmith,
  getDistanceAttenuation,
  getDistanceAttenuationFull,
  getSpotAttenuation,
} from './mesh-lighting'

// Light uniform creation and management
export {
  createCombinedLightingTSLUniforms,
  createFresnelTSLUniforms,
  createLightTSLUniforms,
  createPBRTSLUniforms,
  LIGHT_TYPE_DIRECTIONAL,
  LIGHT_TYPE_POINT,
  LIGHT_TYPE_SPOT,
  MAX_LIGHTS,
  updateLightTSLUniforms,
} from './light-uniforms'

// Type exports from light-uniforms
export type {
  CombinedLightingTSLUniforms,
  FresnelTSLUniforms,
  LightTSLUniforms,
  PBRTSLUniforms,
} from './light-uniforms'

// Attenuation functions
export {
  getCombinedSpotAttenuation,
  getDistanceAttenuationWithDecay,
  getInverseSquareAttenuation,
  getSpotConeAttenuation,
} from './attenuation'

// IBL (Image-Based Lighting)
export {
  bilinearCubeUV,
  computeIBL,
  createIBLTSLUniforms,
  fresnelSchlickRoughness,
  getFace,
  getUV,
  roughnessToMip,
  textureCubeUV,
} from './ibl'

export type { IBLTSLUniforms } from './ibl'
