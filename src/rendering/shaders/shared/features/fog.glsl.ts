/**
 * Shared Fog/Atmosphere GLSL Module
 *
 * DEPRECATED: Per-object fog has been removed in favor of post-process volumetric fog.
 * This module now provides no-op stubs for backward compatibility with shader compose functions.
 * The physical fog effect is handled by VolumetricFogPass (post-processing).
 */

/**
 * Fog uniform declarations block.
 * Empty - uniforms no longer needed since physical fog is applied in post-processing.
 */
export const fogUniformsBlock = `
// Fog uniforms removed - physical fog is handled by post-process VolumetricFogPass
`;

/**
 * Fog calculation functions block.
 * Provides a no-op applyFog for backward compatibility with existing shader code.
 */
export const fogFunctionsBlock = `
/**
 * No-op fog function - fog is now applied in post-processing.
 * Kept for backward compatibility with shader code that calls applyFog().
 */
vec3 applyFog(vec3 col, float viewDist) {
    return col; // No-op - physical fog handled by VolumetricFogPass
}
`;
