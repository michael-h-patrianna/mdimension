/**
 * Shader Materials Module
 *
 * Exports all shader materials for the enhanced visual rendering pipeline.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

export {
  createBasicSurfaceMaterial,
  createFresnelSurfaceMaterial,
  createSurfaceMaterial,
  updateFresnelMaterial,
  createGlowMaterial,
} from './SurfaceMaterial';
export type { SurfaceMaterialConfig } from './SurfaceMaterial';
