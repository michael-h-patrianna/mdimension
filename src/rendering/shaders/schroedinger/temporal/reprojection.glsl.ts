/**
 * Reprojection shader for temporal cloud accumulation
 *
 * Takes the previous frame's accumulated cloud color and reprojects it
 * to the current camera view. Outputs reprojected color and validity mask.
 */

export const reprojectionVertexShader = `
out vec2 vUv;

void main() {
    vUv = uv;
    // Direct NDC output for fullscreen quad
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const reprojectionFragmentShader = `
in vec2 vUv;

// Previous frame's accumulated cloud color
uniform sampler2D uPrevAccumulation;

// Previous frame's weighted world positions
uniform sampler2D uPrevPositionBuffer;

// Matrices for reprojection
uniform mat4 uPrevViewProjectionMatrix;
uniform mat4 uViewProjectionMatrix;
uniform mat4 uInverseViewProjectionMatrix;

// Current camera position for fallback
uniform vec3 uCameraPosition;

// Resolution
uniform vec2 uAccumulationResolution;

// Disocclusion threshold
uniform float uDisocclusionThreshold;

// Outputs
layout(location = 0) out vec4 fragColor;
layout(location = 1) out float fragValidity;

/**
 * Convert UV and depth to world position
 */
vec3 uvDepthToWorld(vec2 uv, float depth) {
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 worldPos = uInverseViewProjectionMatrix * clipPos;
    return worldPos.xyz / worldPos.w;
}

/**
 * Reproject world position to previous frame UV
 */
vec2 worldToPrevUV(vec3 worldPos) {
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(worldPos, 1.0);
    vec2 prevNDC = prevClipPos.xy / prevClipPos.w;
    return prevNDC * 0.5 + 0.5;
}

void main() {
    // Estimate world position for this pixel
    // Use a point along the view ray at a reasonable distance
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 nearClip = vec4(ndc, -1.0, 1.0);
    vec4 farClip = vec4(ndc, 1.0, 1.0);

    vec4 nearWorld = uInverseViewProjectionMatrix * nearClip;
    vec4 farWorld = uInverseViewProjectionMatrix * farClip;
    nearWorld /= nearWorld.w;
    farWorld /= farWorld.w;

    vec3 rayDir = normalize(farWorld.xyz - nearWorld.xyz);

    // Estimate cloud position at a typical distance (e.g., 3 units from camera)
    float estimatedDist = 3.0;
    vec3 estimatedWorldPos = uCameraPosition + rayDir * estimatedDist;

    // Reproject to previous frame
    vec2 prevUV = worldToPrevUV(estimatedWorldPos);

    // Check if on-screen in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        fragColor = vec4(0.0);
        fragValidity = 0.0;
        return;
    }

    // Sample previous frame's accumulated color
    vec4 prevColor = texture(uPrevAccumulation, prevUV);

    // If previous frame had no cloud data here, mark invalid
    if (prevColor.a < 0.001) {
        fragColor = vec4(0.0);
        fragValidity = 0.0;
        return;
    }

    // Disocclusion detection: check neighbor depth variance
    vec2 texelSize = 1.0 / uAccumulationResolution;

    vec4 colorL = texture(uPrevAccumulation, prevUV - vec2(texelSize.x, 0.0));
    vec4 colorR = texture(uPrevAccumulation, prevUV + vec2(texelSize.x, 0.0));
    vec4 colorU = texture(uPrevAccumulation, prevUV + vec2(0.0, texelSize.y));
    vec4 colorD = texture(uPrevAccumulation, prevUV - vec2(0.0, texelSize.y));

    // Check for large alpha discontinuities (indicates edge/disocclusion)
    float maxAlphaDiff = max(
        max(abs(prevColor.a - colorL.a), abs(prevColor.a - colorR.a)),
        max(abs(prevColor.a - colorU.a), abs(prevColor.a - colorD.a))
    );

    // Also check color discontinuities
    float maxColorDiff = max(
        max(length(prevColor.rgb - colorL.rgb), length(prevColor.rgb - colorR.rgb)),
        max(length(prevColor.rgb - colorU.rgb), length(prevColor.rgb - colorD.rgb))
    );

    // Reject if large discontinuity detected
    float validity = 1.0;
    if (maxAlphaDiff > uDisocclusionThreshold || maxColorDiff > uDisocclusionThreshold * 2.0) {
        validity = 0.0;
    }

    // Edge rejection - reduce validity near screen edges
    float edgeDist = min(min(prevUV.x, 1.0 - prevUV.x), min(prevUV.y, 1.0 - prevUV.y));
    if (edgeDist < 0.02) {
        validity *= edgeDist / 0.02;
    }

    fragColor = prevColor;
    fragValidity = validity;
}
`;
