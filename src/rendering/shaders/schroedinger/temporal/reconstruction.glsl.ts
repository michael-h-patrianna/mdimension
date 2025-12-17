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
 * Bilinear sample from quarter-res buffer with proper offset handling
 */
vec4 sampleCloudBilinear(vec2 fullResUV) {
    // Convert full-res UV to quarter-res pixel coordinates
    vec2 quarterCoord = fullResUV * uCloudResolution;

    // Sample with bilinear filtering
    return texture(uCloudRender, quarterCoord / uCloudResolution);
}

/**
 * Sample from neighbors for spatial interpolation fallback
 */
vec4 spatialInterpolation(vec2 uv) {
    vec2 texelSize = 1.0 / uAccumulationResolution;

    // Sample 4 neighbors
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
    vec2 pixelCoord = floor(vUv * uAccumulationResolution);

    // Determine which pixel in the 2x2 block this is
    vec2 blockPos = mod(pixelCoord, 2.0);

    // Check if this pixel was rendered this frame
    bool renderedThisFrame = (blockPos.x == uBayerOffset.x && blockPos.y == uBayerOffset.y);

    vec4 newColor = vec4(0.0);
    vec4 historyColor = vec4(0.0);
    float validity = 0.0;

    // Get the new rendered color (for pixels rendered this frame)
    if (renderedThisFrame) {
        // This pixel was rendered - sample from quarter-res buffer
        // The quarter-res buffer contains this pixel at the corresponding location
        vec2 quarterUV = (floor(pixelCoord / 2.0) + 0.5) / uCloudResolution;
        newColor = texture(uCloudRender, quarterUV);
    }

    // Get reprojected history
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
            // History exists but validity is low - blend with spatial interpolation
            vec4 spatial = spatialInterpolation(vUv);
            finalColor = mix(spatial, historyColor, validity);
        } else {
            // No valid history at all - use spatial interpolation from rendered neighbors
            // This primarily happens in first few frames
            finalColor = spatialInterpolation(vUv);
        }
    }

    // Clamp to valid range
    finalColor = max(finalColor, vec4(0.0));

    fragColor = finalColor;
}
`;
