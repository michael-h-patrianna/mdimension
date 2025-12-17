/**
 * Main fragment shader for Schrödinger volumetric rendering
 *
 * Performs volumetric raymarching through the quantum density field,
 * using Beer-Lambert absorption and front-to-back compositing.
 */
export const mainBlock = `
// ============================================
// Main Fragment Shader - Volumetric Mode
// ============================================

void main() {
    vec3 ro, rd;
    vec3 worldRayDir;

    // Setup ray origin and direction
    if (uOrthographic) {
        worldRayDir = normalize(uOrthoRayDir);
        rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);
        vec2 screenUV = gl_FragCoord.xy / uResolution;
        vec2 ndc = screenUV * 2.0 - 1.0;
        vec4 nearPointClip = vec4(ndc, -1.0, 1.0);
        vec4 nearPointWorld = uInverseViewProjectionMatrix * nearPointClip;
        nearPointWorld /= nearPointWorld.w;
        vec3 rayOriginWorld = nearPointWorld.xyz;
        ro = (uInverseModelMatrix * vec4(rayOriginWorld, 1.0)).xyz;
        ro = ro - rd * (BOUND_R + 1.0);
    } else {
        ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
        worldRayDir = normalize(vPosition - uCameraPosition);
        rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);
    }

    // Intersect with bounding sphere
    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);

    // No intersection with bounding volume
    if (tSphere.y < 0.0) {
        discard;
    }

    float tNear = max(0.0, tSphere.x);
    float tFar = tSphere.y;

    // Volumetric raymarching
    vec4 volumeResult;
    if (uFastMode) {
        volumeResult = volumeRaymarch(ro, rd, tNear, tFar);
    } else {
        volumeResult = volumeRaymarchHQ(ro, rd, tNear, tFar);
    }

    // Discard fully transparent pixels
    if (volumeResult.a < 0.01) {
        discard;
    }

    // Apply opacity mode adjustments
    float alpha = volumeResult.a;

    if (uOpacityMode == OPACITY_SOLID) {
        alpha = 1.0;
    } else if (uOpacityMode == OPACITY_SIMPLE_ALPHA) {
        alpha = min(volumeResult.a * uSimpleAlpha * 2.0, 1.0);
    } else if (uOpacityMode == OPACITY_VOLUMETRIC) {
        alpha = volumeResult.a * uVolumetricDensity;
    }

    // Estimate depth (midpoint of traversal)
    float tMid = (tNear + tFar) * 0.5;
    vec3 midPoint = ro + rd * tMid;
    vec4 worldHitPos = uModelMatrix * vec4(midPoint, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    // Output
    vec3 viewNormal = normalize((uViewMatrix * vec4(rd, 0.0)).xyz);
    gColor = vec4(volumeResult.rgb, alpha);
    gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
}
`;

/**
 * Alternative main block for isosurface mode (optional)
 * Uses raymarching to find the density threshold surface
 */
export const mainBlockIsosurface = `
void main() {
    vec3 ro, rd;
    vec3 worldRayDir;

    if (uOrthographic) {
        worldRayDir = normalize(uOrthoRayDir);
        rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);
        vec2 screenUV = gl_FragCoord.xy / uResolution;
        vec2 ndc = screenUV * 2.0 - 1.0;
        vec4 nearPointClip = vec4(ndc, -1.0, 1.0);
        vec4 nearPointWorld = uInverseViewProjectionMatrix * nearPointClip;
        nearPointWorld /= nearPointWorld.w;
        vec3 rayOriginWorld = nearPointWorld.xyz;
        ro = (uInverseModelMatrix * vec4(rayOriginWorld, 1.0)).xyz;
        ro = ro - rd * (BOUND_R + 1.0);
    } else {
        ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
        worldRayDir = normalize(vPosition - uCameraPosition);
        rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);
    }

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) discard;

    float tNear = max(0.0, tSphere.x);
    float tFar = tSphere.y;

    // Isosurface raymarching
    float animTime = uTime * uTimeScale;
    float threshold = uIsoThreshold;

    int maxSteps = uFastMode ? 64 : 128;
    float stepLen = (tFar - tNear) / float(maxSteps);
    float t = tNear;
    float hitT = -1.0;

    for (int i = 0; i < 128; i++) {
        if (i >= maxSteps) break;
        if (t > tFar) break;

        vec3 pos = ro + rd * t;
        float rho = sampleDensity(pos, animTime);
        float s = sFromRho(rho);

        if (s > threshold) {
            // Binary search refinement
            float tLo = t - stepLen;
            float tHi = t;
            for (int j = 0; j < 5; j++) {
                float tMid = (tLo + tHi) * 0.5;
                vec3 midPos = ro + rd * tMid;
                float midS = sFromRho(sampleDensity(midPos, animTime));
                if (midS > threshold) {
                    tHi = tMid;
                } else {
                    tLo = tMid;
                }
            }
            hitT = (tLo + tHi) * 0.5;
            break;
        }

        t += stepLen;
    }

    if (hitT < 0.0) discard;

    // Compute surface point and normal
    vec3 p = ro + rd * hitT;
    vec3 n = normalize(computeDensityGradient(p, animTime, 0.01));

    // Sample for color
    vec3 densityInfo = sampleDensityWithPhase(p, animTime);
    float rho = densityInfo.x;
    float phase = densityInfo.z;

    // Surface coloring - use user's color with subtle phase modulation
    vec3 baseHSL = rgb2hsl(uColor);
    float normS = clamp((sFromRho(rho) + 8.0) / 8.0, 0.0, 1.0);
    vec3 surfaceColor;

    // Phase influence on hue
    float phaseNorm = (phase + PI) / TAU;
    float hueShift = (phaseNorm - 0.5) * 0.4; // ±20% hue shift

    if (uColorMode == COLOR_MODE_PHASE) {
        float hue = fract(baseHSL.x + hueShift);
        surfaceColor = hsl2rgb(vec3(hue, 0.75, 0.35));
    } else if (uColorMode == COLOR_MODE_MIXED) {
        float hue = fract(baseHSL.x + hueShift);
        float lightness = 0.15 + 0.35 * normS;
        float saturation = 0.7 + 0.25 * normS;
        surfaceColor = hsl2rgb(vec3(hue, saturation, lightness));
    } else {
        surfaceColor = getColorByAlgorithm(normS, n, baseHSL, p);
    }

    // Lighting
    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;
    vec3 viewDir = -rd;

    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        vec3 l = getLightDirection(i, p);
        float attenuation = uLightIntensities[i];

        int lightType = uLightTypes[i];
        if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
            float distance = length(uLightPositions[i] - p);
            attenuation *= getDistanceAttenuation(i, distance);
        }

        if (lightType == LIGHT_TYPE_SPOT) {
            vec3 lightToFrag = normalize(p - uLightPositions[i]);
            attenuation *= getSpotAttenuation(i, lightToFrag);
        }

        if (attenuation < 0.001) continue;

        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation;

        vec3 halfDir = normalize(l + viewDir);
        float NdotH = max(dot(n, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation;
        col += uSpecularColor * uLightColors[i] * spec;
    }

    // Fresnel rim
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
        float NdotV = max(dot(n, viewDir), 0.0);
        float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
        col += uRimColor * rim;
    }

    // Depth
    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    float alpha = calculateOpacityAlpha(hitT, tSphere.x, tFar + 1.0);
    vec3 viewNormal = normalize((uViewMatrix * vec4(n, 0.0)).xyz);
    gColor = vec4(col, alpha);
    gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
}
`;
