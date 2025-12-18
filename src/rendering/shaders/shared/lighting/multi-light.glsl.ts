export const multiLightBlock = `
// ============================================
// Multi-Light System Helper Functions
// ============================================

/**
 * Calculate light direction for a given light index.
 * Returns normalized direction FROM fragment TO light source.
 */
vec3 getLightDirection(int lightIndex, vec3 fragPos) {
    int lightType = uLightTypes[lightIndex];

    if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
        vec3 diff = uLightPositions[lightIndex] - fragPos;
        float len = length(diff);
        // Guard against zero-length vector (light at fragment position)
        return len > 0.0001 ? diff / len : vec3(0.0, 1.0, 0.0);
    }
    else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
        // Directional lights: use the stored direction (pointing toward surface)
        vec3 dir = uLightDirections[lightIndex];
        float len = length(dir);
        // Guard against zero-length direction
        return len > 0.0001 ? dir / len : vec3(0.0, 1.0, 0.0);
    }

    return vec3(0.0, 1.0, 0.0);
}

/**
 * Calculate spot light cone attenuation with penumbra falloff.
 * Uses precomputed cosines (uSpotCosInner/uSpotCosOuter) to avoid per-fragment trig.
 */
float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
    vec3 dir = uLightDirections[lightIndex];
    float dirLen = length(dir);
    // Guard against zero-length direction
    vec3 normDir = dirLen > 0.0001 ? dir / dirLen : vec3(0.0, -1.0, 0.0);
    float cosAngle = dot(lightToFrag, normDir);
    return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
}

/**
 * Calculate distance attenuation for point and spot lights.
 * range = 0: infinite range (no falloff)
 * range > 0: light reaches zero intensity at this distance
 * decay = 0: no decay, 1: linear, 2: physically correct inverse square
 */
float getDistanceAttenuation(int lightIndex, float distance) {
    float range = uLightRanges[lightIndex];
    float decay = uLightDecays[lightIndex];

    // No distance falloff when range is 0 (infinite range)
    if (range <= 0.0) {
        return 1.0;
    }

    // Clamp distance to prevent division by zero
    float d = max(distance, 0.0001);

    // Three.js attenuation formula
    float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);
    return pow(rangeAttenuation, decay);
}

// Compute rotation matrix from basis vectors for light transformation
// The basis vectors define the orientation of the 3D slice in D-space
// We use the first 3 components to build a 3x3 rotation matrix
mat3 getBasisRotation() {
    // Extract 3x3 from basis vectors (they form columns of the rotation matrix)
    vec3 bx = vec3(uBasisX[0], uBasisX[1], uBasisX[2]);
    vec3 by = vec3(uBasisY[0], uBasisY[1], uBasisY[2]);
    vec3 bz = vec3(uBasisZ[0], uBasisZ[1], uBasisZ[2]);

    // Build rotation matrix (basis vectors as columns)
    // This transforms from world space to object space
    return mat3(bx, by, bz);
}
`;
