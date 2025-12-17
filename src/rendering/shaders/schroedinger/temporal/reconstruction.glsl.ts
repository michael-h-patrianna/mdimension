/**
 * Reconstruction shader for temporal cloud accumulation
 *
 * Combines freshly rendered quarter-res pixels with reprojected history
 * to produce the full-resolution accumulated cloud image.
 */

export const reconstructionVertexShader = `
out vec2 vUv;

void main() {
    vUv = uv;
    // Direct NDC output for fullscreen quad
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const reconstructionFragmentShader = `
precision highp float;

in vec2 vUv;

// New quarter-res cloud render
uniform sampler2D uCloudRender;

// Reprojected history (from reprojection pass)
uniform sampler2D uReprojectedHistory;

// Validity mask (from reprojection pass)
uniform sampler2D uValidityMask;

// Current Bayer offset (determines which pixel was rendered this frame)
uniform vec2 uBayerOffset;

// Frame index for debugging
uniform int uFrameIndex;

// Resolution
uniform vec2 uCloudResolution;
uniform vec2 uAccumulationResolution;

// Blend weight for history (0.0 = favor new, 1.0 = favor history)
uniform float uHistoryWeight;

// Whether this is one of the first frames (no valid history yet)
uniform bool uHasValidHistory;

layout(location = 0) out vec4 fragColor;

/**
 * Sample from quarter-res cloud buffer for a given full-res pixel coordinate.
 * Maps full-res pixel to the corresponding quarter-res location.
 */
vec4 sampleCloudAtPixel(ivec2 fullResPixel) {
    // Each 2x2 block in full-res maps to one pixel in quarter-res
    // The quarter-res pixel contains the rendered value for one of the 4 pixels
    vec2 quarterUV = (vec2(fullResPixel / 2) + 0.5) / uCloudResolution;
    return texture(uCloudRender, quarterUV);
}

/**
 * Sample from neighbors in the quarter-res buffer for spatial interpolation.
 * Used when there's no valid history - reconstructs from nearby rendered pixels.
 *
 * This function samples from uCloudRender (quarter-res) NOT uReprojectedHistory,
 * ensuring we use actual rendered data instead of uninitialized buffers.
 */
vec4 spatialInterpolationFromCloud(ivec2 fullResPixel) {
    // Find the 2x2 block this pixel belongs to
    ivec2 blockBase = (fullResPixel / 2) * 2;

    // The Bayer offset tells us which pixel in the block was rendered
    ivec2 bayerInt = ivec2(uBayerOffset);
    ivec2 renderedPixel = blockBase + bayerInt;

    // Sample the rendered pixel from quarter-res buffer
    vec4 renderedColor = sampleCloudAtPixel(renderedPixel);

    // For pixels not rendered this frame, we can:
    // 1. Use the rendered pixel from the same block (nearest neighbor)
    // 2. Or blend with adjacent blocks for smoother results

    // For simplicity and reliability, use nearest neighbor from same block
    // This ensures we always have valid data even on first frame
    return renderedColor;
}

/**
 * Sample from neighbors for spatial interpolation using history buffer.
 * Only used when we have valid history data.
 */
vec4 spatialInterpolationFromHistory(vec2 uv) {
    vec2 texelSize = 1.0 / uAccumulationResolution;

    // Sample 4 neighbors from history
    vec4 c0 = texture(uReprojectedHistory, uv + vec2(-texelSize.x, 0.0));
    vec4 c1 = texture(uReprojectedHistory, uv + vec2(texelSize.x, 0.0));
    vec4 c2 = texture(uReprojectedHistory, uv + vec2(0.0, -texelSize.y));
    vec4 c3 = texture(uReprojectedHistory, uv + vec2(0.0, texelSize.y));

    // Average valid neighbors
    vec4 sum = vec4(0.0);
    float count = 0.0;

    if (c0.a > 0.001) { sum += c0; count += 1.0; }
    if (c1.a > 0.001) { sum += c1; count += 1.0; }
    if (c2.a > 0.001) { sum += c2; count += 1.0; }
    if (c3.a > 0.001) { sum += c3; count += 1.0; }

    return count > 0.0 ? sum / count : vec4(0.0);
}

void main() {
    // Use integer math to avoid floating-point precision issues with mod()
    // This is critical for correct Bayer pattern detection
    ivec2 pixelCoordInt = ivec2(floor(vUv * uAccumulationResolution));

    // Determine which pixel in the 2x2 block this is (0 or 1 for each axis)
    ivec2 blockPosInt = pixelCoordInt % 2;

    // Convert Bayer offset to integer for reliable comparison
    ivec2 bayerOffsetInt = ivec2(uBayerOffset);

    // Check if this pixel was rendered this frame
    bool renderedThisFrame = (blockPosInt.x == bayerOffsetInt.x && blockPosInt.y == bayerOffsetInt.y);

    vec4 newColor = vec4(0.0);
    vec4 historyColor = vec4(0.0);
    float validity = 0.0;

    // Get the new rendered color (for pixels rendered this frame)
    if (renderedThisFrame) {
        // This pixel was rendered - sample from quarter-res buffer
        newColor = sampleCloudAtPixel(pixelCoordInt);
    }

    // Get reprojected history (only if we have valid history)
    if (uHasValidHistory) {
        historyColor = texture(uReprojectedHistory, vUv);
        validity = texture(uValidityMask, vUv).r;
    }

    // Combine new and history based on what's available
    vec4 finalColor;

    // For freshly rendered pixels, reduce history influence by this factor.
    // This prioritizes new high-quality data over reprojected history.
    // 0.5 means we trust new data roughly 2x more than reprojected data.
    const float FRESH_PIXEL_HISTORY_REDUCTION = 0.5;

    if (renderedThisFrame) {
        // This pixel was freshly rendered
        if (uHasValidHistory && validity > 0.5 && historyColor.a > 0.001) {
            // Blend with history for temporal stability
            // Give more weight to new data since it's fresh
            float blendWeight = uHistoryWeight * validity * FRESH_PIXEL_HISTORY_REDUCTION;
            finalColor = mix(newColor, historyColor, blendWeight);
        } else {
            // No valid history - use new data directly
            finalColor = newColor;
        }
    } else {
        // This pixel was NOT rendered this frame
        if (uHasValidHistory && validity > 0.5 && historyColor.a > 0.001) {
            // Use reprojected history
            finalColor = historyColor;
        } else if (uHasValidHistory && historyColor.a > 0.001) {
            // History exists but validity is low - blend with spatial interpolation from history
            vec4 spatial = spatialInterpolationFromHistory(vUv);
            finalColor = mix(spatial, historyColor, validity);
        } else {
            // No valid history at all - use spatial interpolation from quarter-res cloud buffer
            // This is critical for first few frames before history is built up
            // We sample from the actual rendered data, not the uninitialized history buffer
            finalColor = spatialInterpolationFromCloud(pixelCoordInt);
        }
    }

    // Clamp to valid range
    finalColor = max(finalColor, vec4(0.0));

    fragColor = finalColor;
}
`;
