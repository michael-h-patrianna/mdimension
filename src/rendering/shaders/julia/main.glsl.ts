export const mainBlock = `
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

    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    float sphereEntry = max(0.0, tSphere.x);

    float trap;
    bool usedTemporal;
    float d = RayMarch(ro, rd, worldRayDir, trap, usedTemporal);

    if (d > maxDist && usedTemporal) {
        usedTemporal = false;
        d = RayMarchNoTemporal(ro, rd, trap);
    }

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;
    vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);

    float ao = 1.0;
    #ifdef USE_AO
    ao = uFastMode ? 1.0 : calcAO(p, n);
    #endif

    vec3 baseHSL = rgb2hsl(uColor);
    float t = 1.0 - trap;
    vec3 surfaceColor = getColorByAlgorithm(t, n, baseHSL, p);
    surfaceColor *= (0.3 + 0.7 * ao);

    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;
    vec3 viewDir = -rd;
    float totalNdotL = 0.0;

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

        float shadow = 1.0;
        #ifdef USE_SHADOWS
        if (uShadowEnabled) {
            bool shouldRenderShadow = !uFastMode || uShadowAnimationMode > 0;
            if (shouldRenderShadow) {
                vec3 shadowOrigin = p + n * 0.02;
                vec3 shadowDir = l;
                float shadowMaxDist = lightType == LIGHT_TYPE_DIRECTIONAL ? 10.0 : length(uLightPositions[i] - p);
                int effectiveQuality = uShadowQuality;
                if (uFastMode && uShadowAnimationMode == 1) effectiveQuality = 0;
                shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
            }
        }
        #endif

        float NdotL = max(dot(n, l), 0.0);
        totalNdotL = max(totalNdotL, NdotL * attenuation * shadow);
        
        // Standard Diffuse
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

        // GGX Specular
        vec3 halfDir = normalize(l + viewDir);
        // F0 for dielectrics
        vec3 F0 = vec3(0.04); 
        // If we had metalness: F0 = mix(F0, surfaceColor, uMetallic);
        
        vec3 specular = computePBRSpecular(n, viewDir, l, uRoughness, F0);
        col += specular * uLightColors[i] * NdotL * uSpecularIntensity * attenuation * shadow;
        
        // Subsurface Scattering (SSS)
        if (uSssEnabled) {
            vec3 sss = computeSSS(l, viewDir, n, 0.5, uSssThickness * 4.0, 0.0); // 0.0 thickness for now
            // Modulate by SSS intensity and color
            col += sss * uSssColor * uLightColors[i] * uSssIntensity * attenuation;
        }
    }

    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
        float NdotV = max(dot(n, viewDir), 0.0);
        float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
        rim *= (0.3 + 0.7 * totalNdotL);
        col += uRimColor * rim;
    }
    
    // Atmospheric Depth Integration (Fog)
    if (uFogEnabled) {
        float viewDist = d; // Distance to surface
        
        // Internal Fog (Object Fog)
        if (uInternalFogDensity > 0.0) {
             float internalFog = 1.0 - exp(-uInternalFogDensity * viewDist * 0.1);
             col = mix(col, uAmbientColor, internalFog); // mix to ambient
        }
        
        // Scene Fog (Atmosphere)
        if (uFogContribution > 0.0) {
             float fogFactor = 1.0 - exp(-0.02 * viewDist * uFogContribution);
             col = mix(col, uAmbientColor * 0.5, fogFactor);
        }
    }

    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    float alpha = calculateOpacityAlpha(d, sphereEntry, maxDist);
    vec3 viewNormal = normalize((uViewMatrix * vec4(n, 0.0)).xyz);
    gColor = vec4(col, alpha);
    gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
}
`;