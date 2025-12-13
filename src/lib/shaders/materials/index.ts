/**
 * Shader Materials Module
 *
 * Exports all shader materials for the enhanced visual rendering pipeline.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// Legacy surface materials (still used by existing components)
export {
  createBasicSurfaceMaterial,
  createFresnelSurfaceMaterial,
  createSurfaceMaterial,
  updateFresnelMaterial,
  createGlowMaterial,
  createPaletteSurfaceMaterial,
  updatePaletteMaterial,
  // MeshPhongMaterial-based functions (uses Three.js native Phong + onBeforeCompile)
  createPhongPaletteMaterial,
  updatePhongPaletteMaterial,
} from './SurfaceMaterial';
export type {
  SurfaceMaterialConfig,
  PaletteSurfaceMaterialConfig,
  PhongPaletteMaterialUpdates,
} from './SurfaceMaterial';

// Unified Material System (GPU N-D transforms)
export {
  createUnifiedMaterial,
  updateUnifiedMaterial,
  updateUnifiedMaterialVisuals,
  updateUnifiedMaterialPalette,
  updateUnifiedMaterialLighting,
  updateUnifiedMaterialFresnel,
} from './UnifiedMaterial';
export type {
  UnifiedRenderMode,
  UnifiedColorMode,
  UnifiedMaterialOptions,
} from './UnifiedMaterial';
