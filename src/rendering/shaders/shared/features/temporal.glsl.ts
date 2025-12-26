export const temporalBlock = `
// ============================================
// Temporal Reprojection
// ============================================

/**
 * Reproject current pixel to previous frame and sample ray distance.
 * Returns the reprojected ray distance, or -1.0 if invalid.
 */
float getTemporalDepth(vec3 ro, vec3 rd, vec3 worldRayDir) {
    if (!uTemporalEnabled) return -1.0;

    // Estimate a world-space point along the ray at an average expected distance
    // Use the bounding sphere radius as a reasonable estimate
    float estimatedWorldDist = BOUND_R * 1.5;
    vec3 estimatedWorldHit = uCameraPosition + worldRayDir * estimatedWorldDist;

    // Transform estimated hit point to previous frame's clip space
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(estimatedWorldHit, 1.0);

    // Perspective divide to get NDC - guard against w=0 while preserving sign
    float safeW = abs(prevClipPos.w) < 0.0001
      ? (prevClipPos.w >= 0.0 ? 0.0001 : -0.0001)
      : prevClipPos.w;
    vec2 prevNDC = prevClipPos.xy / safeW;

    // Convert from NDC [-1, 1] to UV [0, 1]
    vec2 prevUV = prevNDC * 0.5 + 0.5;

    // Check if point is visible in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        return -1.0;  // Off-screen in previous frame
    }

    // Sample previous ray distance (stored as unnormalized world-space distance)
    float rayDistance = texture(uPrevDepthTexture, prevUV).r;

    // Validate ray distance (0 or very small means no hit, cleared, or sky)
    // Very large values indicate potential issues
    if (rayDistance <= 0.01 || rayDistance > 1000.0) {
        return -1.0;
    }

    // Disocclusion detection: check for depth discontinuities
    // Large differences with neighbors indicate unreliable temporal data
    vec2 texelSize = 1.0 / uDepthBufferResolution;
    float depthLeft = texture(uPrevDepthTexture, prevUV - vec2(texelSize.x, 0.0)).r;
    float depthRight = texture(uPrevDepthTexture, prevUV + vec2(texelSize.x, 0.0)).r;
    float depthUp = texture(uPrevDepthTexture, prevUV + vec2(0.0, texelSize.y)).r;
    float depthDown = texture(uPrevDepthTexture, prevUV - vec2(0.0, texelSize.y)).r;

    float maxNeighborDiff = max(
        max(abs(rayDistance - depthLeft), abs(rayDistance - depthRight)),
        max(abs(rayDistance - depthUp), abs(rayDistance - depthDown))
    );

    // Threshold for disocclusion detection (absolute distance threshold)
    // 0.2 world units is roughly 10% of bounding sphere radius (BOUND_R = 2.0)
    // This catches edges where depth jumps significantly between neighbors
    if (maxNeighborDiff > 0.2) {
        return -1.0;  // Depth discontinuity - temporal data unreliable
    }

    // Ray distance is already in world-space units
    // Safety margin is applied in core.glsl.ts via uTemporalSafetyMargin uniform
    // This allows per-object-type tuning (e.g., 0.5 for Mandelbulb, 0.33 for Julia)
    return max(0.0, rayDistance);
}
`;
