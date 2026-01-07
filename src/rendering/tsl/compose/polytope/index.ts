/**
 * TSL Polytope Compose System
 *
 * Feature-based composition for polytope materials.
 *
 * @module rendering/tsl/compose/polytope
 */

// Shader composition with conditional feature inclusion
export {
  composePolytopeTSLShading,
  getPolytopeTSLShaderName,
} from './polytope-compose'

export type {
  PolytopeTSLConfig,
  PolytopeShadingUniforms,
} from './polytope-compose'
