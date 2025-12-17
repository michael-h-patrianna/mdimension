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
precision highp float;

in vec2 vUv;

// Previous frame's accumulated cloud color
uniform sampler2D uPrevAccumulation;

// Previous frame's accumulated world positions (xyz = world pos, w = alpha weight)
// This enables accurate reprojection when camera rotates, not just translates
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

// Outputs - MRT requires both to be vec4 for consistent format
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 fragValidity;

/**
 * Project world position to current frame UV using current view-projection matrix
 */
vec2 worldToCurrentUV(vec3 worldPos) {
    vec4 clipPos = uViewProjectionMatrix * vec4(worldPos, 1.0);
    // Perspective divide
    vec2 ndc = clipPos.xy / clipPos.w;
    return ndc * 0.5 + 0.5;
}

void main() {
    // Sample previous frame's world position for this pixel
    // The position buffer stores actual 3D world positions, enabling accurate
    // reprojection when camera rotates (not just translates)
    vec4 prevPositionData = texture(uPrevPositionBuffer, vUv);
    vec3 worldPos = prevPositionData.xyz;
    float positionAlpha = prevPositionData.w;

    // Sample previous frame's accumulated color
    vec4 prevColor = texture(uPrevAccumulation, vUv);

    // If previous frame had no cloud data here, mark invalid
    if (prevColor.a < 0.001 || positionAlpha < 0.001) {
        fragColor = vec4(0.0);
        fragValidity = vec4(0.0);
        return;
    }

    // Reproject: find where this world position appears in the CURRENT frame
    vec2 currentUV = worldToCurrentUV(worldPos);

    // Check if on-screen in current frame
    if (currentUV.x < 0.0 || currentUV.x > 1.0 || currentUV.y < 0.0 || currentUV.y > 1.0) {
        fragColor = vec4(0.0);
        fragValidity = vec4(0.0);
        return;
    }

    // The key insight: we're sampling from prevUV (vUv) but writing to where it
    // should appear in the current frame. However, since this is a fullscreen pass,
    // we can't change where we write. Instead, we need to REVERSE the logic:
    //
    // For each pixel in the OUTPUT (current frame), find where it came from in
    // the previous frame's buffer. This requires inverting the reprojection.
    //
    // NEW APPROACH: For current pixel at vUv, compute where it was in world space,
    // then find where that world position was in the previous frame's UV space.

    // Compute world position for current pixel using inverse view-projection
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 nearClip = vec4(ndc, -1.0, 1.0);
    vec4 farClip = vec4(ndc, 1.0, 1.0);

    vec4 nearWorld = uInverseViewProjectionMatrix * nearClip;
    vec4 farWorld = uInverseViewProjectionMatrix * farClip;
    nearWorld /= nearWorld.w;
    farWorld /= farWorld.w;

    vec3 rayDir = normalize(farWorld.xyz - nearWorld.xyz);

    // Sample the previous position buffer to get the depth/distance
    // Since we're looking for where the current pixel came from, we sample
    // at vUv and use the stored world position to find the previous UV
    vec4 sampledPosition = texture(uPrevPositionBuffer, vUv);

    if (sampledPosition.w < 0.001) {
        // No valid position data - fall back to center of scene
        fragColor = vec4(0.0);
        fragValidity = vec4(0.0);
        return;
    }

    // Use the actual world position from the position buffer
    vec3 actualWorldPos = sampledPosition.xyz;

    // Project this world position using the PREVIOUS view-projection matrix
    // to find where it was in the previous frame
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(actualWorldPos, 1.0);
    vec2 prevUV = (prevClipPos.xy / prevClipPos.w) * 0.5 + 0.5;

    // Check if the reprojected position is on-screen in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        fragColor = vec4(0.0);
        fragValidity = vec4(0.0);
        return;
    }

    // Sample previous frame's color at the reprojected location
    vec4 reprojectedColor = texture(uPrevAccumulation, prevUV);

    if (reprojectedColor.a < 0.001) {
        fragColor = vec4(0.0);
        fragValidity = vec4(0.0);
        return;
    }

    // Disocclusion detection: check neighbor depth variance using position buffer
    vec2 texelSize = 1.0 / uAccumulationResolution;

    vec4 posL = texture(uPrevPositionBuffer, prevUV - vec2(texelSize.x, 0.0));
    vec4 posR = texture(uPrevPositionBuffer, prevUV + vec2(texelSize.x, 0.0));
    vec4 posU = texture(uPrevPositionBuffer, prevUV + vec2(0.0, texelSize.y));
    vec4 posD = texture(uPrevPositionBuffer, prevUV - vec2(0.0, texelSize.y));

    // Check for large position discontinuities (indicates edge/disocclusion)
    vec3 centerPos = actualWorldPos;
    float maxPosDiff = max(
        max(length(centerPos - posL.xyz), length(centerPos - posR.xyz)),
        max(length(centerPos - posU.xyz), length(centerPos - posD.xyz))
    );

    // Also check alpha discontinuities
    vec4 colorL = texture(uPrevAccumulation, prevUV - vec2(texelSize.x, 0.0));
    vec4 colorR = texture(uPrevAccumulation, prevUV + vec2(texelSize.x, 0.0));
    vec4 colorU = texture(uPrevAccumulation, prevUV + vec2(0.0, texelSize.y));
    vec4 colorD = texture(uPrevAccumulation, prevUV - vec2(0.0, texelSize.y));

    float maxAlphaDiff = max(
        max(abs(reprojectedColor.a - colorL.a), abs(reprojectedColor.a - colorR.a)),
        max(abs(reprojectedColor.a - colorU.a), abs(reprojectedColor.a - colorD.a))
    );

    // Reject if large discontinuity detected
    // Position discontinuity threshold is in world units (0.5 = half a unit)
    float validity = 1.0;
    if (maxPosDiff > 0.5 || maxAlphaDiff > uDisocclusionThreshold) {
        validity = 0.0;
    }

    // Edge rejection - reduce validity near screen edges
    float edgeDist = min(min(prevUV.x, 1.0 - prevUV.x), min(prevUV.y, 1.0 - prevUV.y));
    if (edgeDist < 0.02) {
        validity *= edgeDist / 0.02;
    }

    fragColor = reprojectedColor;
    // Store validity in r channel (g, b unused). Alpha=1.0 for MRT compatibility.
    fragValidity = vec4(validity, 0.0, 0.0, 1.0);
}
`;
