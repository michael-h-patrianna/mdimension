/**
 * Materials Module
 *
 * Exports all material systems for the enhanced visual rendering pipeline.
 * Materials are organized by type with shaders in separate files.
 *
 * Folder Structure:
 * - skybox/ - Skybox shader materials (vertex/fragment in .vert/.frag files)
 *
 * @see docs/prd/enhanced-visuals-rendering-pipeline.md
 */

// ============================================================================
// Skybox Shader Material
// ============================================================================

export {
  SKYBOX_MODE_AURORA,
  SKYBOX_MODE_CLASSIC,
  SKYBOX_MODE_CRYSTALLINE,
  SKYBOX_MODE_HORIZON,
  SKYBOX_MODE_NEBULA,
  SKYBOX_MODE_OCEAN,
  SKYBOX_MODE_STARFIELD,
  SKYBOX_MODE_TWILIGHT,
  SKYBOX_MODE_VOID,
  createSkyboxShaderDefaults,
  skyboxGlslVersion,
} from './skybox/SkyboxShader'
