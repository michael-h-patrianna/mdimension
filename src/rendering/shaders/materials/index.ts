/**
 * Shader Materials Module
 *
 * Exports all shader materials for the enhanced visual rendering pipeline.
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// Unified Material System (GPU N-D transforms)
export {
  createUnifiedMaterial,
  updateUnifiedMaterial,
  updateUnifiedMaterialFresnel,
  updateUnifiedMaterialLighting,
  updateUnifiedMaterialPalette,
  updateUnifiedMaterialVisuals,
} from './UnifiedMaterial'
export type { UnifiedColorMode, UnifiedMaterialOptions, UnifiedRenderMode } from './UnifiedMaterial'
