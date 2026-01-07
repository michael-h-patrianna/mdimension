/**
 * TSL Feature Modules for Mesh Rendering
 *
 * Advanced visual effects for polytopes and tube wireframes.
 * Provides visual parity with WebGL implementation.
 *
 * @module rendering/tsl/features
 */

// Mesh Fresnel (rim lighting)
// NOTE: Iridescent/PBR/Stylized variants removed during WebGL parity work
export {
  computeTotalNdotL,
  createFresnelFactorNode,
  createFresnelNode,
  createMeshFresnelNode,
  createSimpleMeshFresnelNode,
} from './mesh-fresnel'

export type { MeshFresnelUniforms } from './mesh-fresnel'

// Mesh SSS (Subsurface Scattering)
// NOTE: createFastSSSNode and createSSSNodeSimple removed during WebGL parity work (not in WebGL)
export {
  createMeshSSSNode,
  createMeshSSSUniforms,
  createSSSNode,
  sssHash,
  updateMeshSSSUniforms,
} from './mesh-sss'

export type { MeshSSSUniforms } from './mesh-sss'
