/**
 * Materials Module
 *
 * Exports all material systems for the enhanced visual rendering pipeline.
 * Materials are organized by type with shaders in separate files.
 *
 * Folder Structure:
 * - skybox/ - Skybox shader materials (vertex/fragment in .vert/.frag files)
 * - unified/ - N-dimensional material system (shader generators in .glsl.ts files)
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// ============================================================================
// Unified Material System (GPU N-D transforms)
// ============================================================================

export {
  createUnifiedMaterial,
  updateUnifiedMaterial,
  updateUnifiedMaterialFresnel,
  updateUnifiedMaterialLighting,
  updateUnifiedMaterialPalette,
  updateUnifiedMaterialVisuals,
} from './unified/UnifiedMaterial'
export type { UnifiedColorMode, UnifiedMaterialOptions, UnifiedRenderMode } from './unified/types'

// ============================================================================
// Skybox Shader Material
// ============================================================================

export {
  skyboxVertexShader,
  skyboxFragmentShader,
  skyboxGlslVersion,
  createSkyboxShaderDefaults,
  SKYBOX_MODE_CLASSIC,
  SKYBOX_MODE_AURORA,
  SKYBOX_MODE_NEBULA,
  SKYBOX_MODE_VOID,
  SKYBOX_MODE_CRYSTALLINE,
  SKYBOX_MODE_HORIZON,
  SKYBOX_MODE_OCEAN,
  SKYBOX_MODE_TWILIGHT,
  SKYBOX_MODE_STARFIELD,
} from './skybox/SkyboxShader'
export type { SkyboxShaderUniforms } from './skybox/SkyboxShader'



