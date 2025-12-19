/**
 * Shared Fog/Atmosphere GLSL Module
 *
 * Provides atmospheric fog integration for all object types.
 * Supports scene fog (from Three.js scene.fog) and internal object fog.
 *
 * Usage:
 * 1. Include fogUniformsBlock in your shader's uniform declarations
 * 2. Include fogFunctionsBlock before main()
 * 3. Call applyFog(color, viewDistance) after lighting calculations
 *
 * Distance calculation varies by shader type:
 * - Mesh-based (Polytope): length(vWorldPosition - cameraPosition)
 * - Raymarched (Mandelbulb/Julia): d (ray march distance)
 * - Volumetric (Schroedinger): distance(weightedCenter, ro)
 */

/**
 * Fog uniform declarations block.
 * Include this in your shader's uniform section.
 */
export const fogUniformsBlock = `
// Fog/Atmosphere uniforms
uniform bool uFogEnabled;           // Master toggle for fog integration
uniform float uFogContribution;     // Scene fog strength multiplier (0.0-2.0)
uniform float uInternalFogDensity;  // Internal object fog density (0.0-1.0)
uniform vec3 uSceneFogColor;        // Scene fog color (from Three.js scene.fog)
uniform float uSceneFogDensity;     // Scene fog density (from Three.js FogExp2)
`;

/**
 * Fog calculation functions block.
 * Include this before main() in your fragment shader.
 */
export const fogFunctionsBlock = `
/**
 * Apply atmospheric fog to a color based on view distance.
 * Uses exponential fog formula matching Three.js FogExp2.
 *
 * @param col - Input color
 * @param viewDist - Distance from camera to fragment/surface
 * @return Color with fog applied
 */
vec3 applyFog(vec3 col, float viewDist) {
    // Scene Fog (Exponential) - integrates with Three.js scene.fog
    if (uFogEnabled && uSceneFogDensity > 0.0) {
        float fogFactor = exp(-uSceneFogDensity * viewDist * uFogContribution);
        fogFactor = clamp(fogFactor, 0.0, 1.0);
        col = mix(uSceneFogColor, col, fogFactor);
    }

    // Internal Object Fog (distance-based fade for depth effect)
    if (uInternalFogDensity > 0.0) {
        float internalFactor = exp(-uInternalFogDensity * viewDist * 0.5);
        col *= internalFactor;
    }

    return col;
}
`;
