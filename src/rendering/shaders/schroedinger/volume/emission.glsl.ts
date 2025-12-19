/**
 * Emission color computation for volumetric rendering
 *
 * Computes the emission color at each point based on:
 * - User's color palette (uColor as base)
 * - Density (brightness/saturation)
 * - Wavefunction phase (subtle hue modulation)
 *
 * Uses unified uColorAlgorithm system:
 * - Algorithms 0-7: Delegated to shared getColorByAlgorithm()
 * - Algorithm 8 (Phase): Quantum phase coloring using actual wavefunction phase
 * - Algorithm 9 (Mixed): Quantum phase + density blending
 * - Algorithm 10 (Blackbody): Density mapped to temperature gradient
 *
 * The quantum-specific algorithms (8-10) use the actual wavefunction phase,
 * which is physically meaningful for visualizing quantum phenomena.
 */
export const emissionBlock = `
// ============================================
// Volume Emission Color
// ============================================

// Unified color algorithm constants (must match COLOR_ALGORITHM_TO_INT in types.ts)
#define COLOR_ALG_PHASE 8
#define COLOR_ALG_MIXED 9
#define COLOR_ALG_BLACKBODY 10

// Phase influence on hue (0.0 = no phase color, 1.0 = full rainbow)
#define PHASE_HUE_INFLUENCE 0.4

// Analytic approximation of blackbody color (rgb)
// Guards against Temp <= 0 which causes undefined behavior in pow()
vec3 blackbody(float Temp) {
    // Safety: pow(x, -1.5) is undefined for x <= 0
    if (Temp <= 0.0) return vec3(0.0);
    vec3 col = vec3(255.);
    float invTemp = pow(Temp, -1.5);
    col.x = 56100000. * invTemp + 148.;
    col.y = 100040000. * invTemp + 66.;
    col.z = 194180000. * invTemp + 30.;
    col = col / 255.;
    return clamp(col, 0., 1.);
}

// Henyey-Greenstein Phase Function
float henyeyGreenstein(float dotLH, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * dotLH;
    return (1.0 - g2) / (4.0 * PI * pow(max(denom, 0.001), 1.5));
}

// GGX Distribution
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    
    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return num / max(denom, 0.0001);
}

// Geometry Smith
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;
    
    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return num / max(denom, 0.0001);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

// Fresnel Schlick
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Compute PBR Specular contribution (used by isosurface mode)
vec3 computePBRSpecular(vec3 N, vec3 V, vec3 L, float roughness, vec3 F0) {
    // Guard against V and L being opposite (zero-length half vector)
    vec3 halfSum = V + L;
    float halfLen = length(halfSum);
    vec3 H = halfLen > 0.0001 ? halfSum / halfLen : N;

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G   = geometrySmith(N, V, L, roughness);
    vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    return specular;
}

// Compute base surface color (no lighting applied)
vec3 computeBaseColor(float rho, float phase, vec3 pos) {
    // Normalize log-density to [0, 1] range for color mapping
    float s = sFromRho(rho);
    float normalized = clamp((s + 8.0) / 8.0, 0.0, 1.0);

    // Get base color from user's palette
    vec3 baseHSL = rgb2hsl(uColor);
    
#ifdef USE_ENERGY_COLOR
    // Energy Level Coloring
    if (uEnergyColorEnabled) {
        // Map density/phase to energy-like spectrum
        // Ideally we need actual energy eigenvalue E_n.
        // We only have superposition density.
        // Approximation: Phase velocity relates to energy.
        // Or simply map radial distance? Higher n states extend further.
        // Let's use a spectral mapping based on spatial phase gradient or just distance proxy.
        // Better: Use phase itself to show "quantum rainbow".

        // Simple mapping:
        // Low energy = Red/Orange (Center)
        // High energy = Blue/Violet (Edge)
        float r = length(pos);
        float energyProxy = clamp(r * 0.5, 0.0, 1.0);

        // Spectral gradient (heatmap)
        // 0.0 = Red, 0.3 = Green, 0.6 = Blue, 1.0 = Violet
        float hue = 0.7 * (1.0 - energyProxy); // Red(0) at center? No, Blue at center usually high energy?
        // Actually, for HO: E ~ n. High n extends further.
        // So high r is high energy.
        // Visible spectrum: Red (low freq/energy) -> Violet (high freq/energy).
        // So Center (Low Energy) -> Red. Edge (High Energy) -> Violet.

        hue = 0.8 * energyProxy; // 0=Red, 0.8=Violet
        baseHSL = vec3(hue, 1.0, 0.5);
    }
#endif

    // Quantum-specific color algorithms use actual wavefunction phase
    // All other algorithms delegate to the shared getColorByAlgorithm()
    vec3 col = vec3(0.0);

    if (uColorAlgorithm == COLOR_ALG_PHASE) {
        // Algorithm 8: Quantum Phase coloring
        // Uses actual wavefunction phase φ from Ψ = |Ψ|e^(iφ)
        // This reveals interference patterns and time evolution
        float phaseNorm = (phase + PI) / TAU;
        float hueShift = (phaseNorm - 0.5) * PHASE_HUE_INFLUENCE;
        float hue = fract(baseHSL.x + hueShift);
        col = hsl2rgb(vec3(hue, 0.75, 0.35));
    }
    else if (uColorAlgorithm == COLOR_ALG_MIXED) {
        // Algorithm 9: Mixed (Quantum Phase + Density)
        // Combines phase-based hue with density-based lightness/saturation
        // Shows both probability density and phase structure
        float phaseNorm = (phase + PI) / TAU;
        float hueShift = (phaseNorm - 0.5) * PHASE_HUE_INFLUENCE;
        float hue = fract(baseHSL.x + hueShift);
        float lightness = 0.15 + 0.35 * normalized;
        float saturation = 0.7 + 0.25 * normalized;
        col = hsl2rgb(vec3(hue, saturation, lightness));
    }
    else if (uColorAlgorithm == COLOR_ALG_BLACKBODY) {
        // Algorithm 10: Blackbody (Heat)
        // Maps probability density to temperature gradient
        // Higher density = hotter = whiter
        float temp = normalized * 12000.0;
        if (temp < 500.0) return vec3(0.0); // Cold is black
        col = blackbody(temp);
    }
    else {
        // Algorithms 0-7: Delegate to shared color system
        col = getColorByAlgorithm(normalized, vec3(0.0, 1.0, 0.0), baseHSL, pos);
    }
    
#ifdef USE_NODAL
    // Nodal Surface Highlight
    if (uNodalEnabled) {
        // Node is where density is zero.
        // Highlight regions with very low density but surrounded by higher density?
        // Or specific iso-surface of low density?
        // rho near 0.
        // Use normalized density.
        // Highlight region where normalized < 0.05?
        // But vacuum is zero. We only want nodes *inside* the structure.
        // Nodes are zero-crossings of Psi.
        // We only have |Psi|^2.
        // Nodes appear as black stripes.
        // We want to color them.

        // Simple way: if density is very low, mix in nodal color.
        // But we need to distinguish "outside" from "node".
        // Distance field? Gradient magnitude?
        // Nodes have high gradient of phase?
        // Yes, phase jumps by PI across a node.
        // Phase gradient is singular at node.

        // Let's use low density threshold + simple logic for now.
        if (normalized < 0.05 && normalized > 0.001) {
             col = mix(col, uNodalColor, uNodalStrength * (1.0 - normalized/0.05));
        }
    }
#endif
    
    return col;
}

// Compute emission with ambient lighting only (for fast mode)
// Same pattern as Mandelbulb: col = surfaceColor * uAmbientColor * uAmbientIntensity
vec3 computeEmission(float rho, float phase, vec3 pos) {
    vec3 baseColor = computeBaseColor(rho, phase, pos);
    return baseColor * uAmbientColor * uAmbientIntensity;
}

// Compute emission with full scene lighting (for HQ mode)
// Same pattern as Mandelbulb main.glsl.ts lines 53-103
vec3 computeEmissionLit(float rho, float phase, vec3 p, vec3 gradient, vec3 viewDir) {
    vec3 surfaceColor = computeBaseColor(rho, phase, p);

    // OPTIMIZATION: Early return if no lights or ambient-only mode
    // Skips expensive lighting loop when not needed (~30% faster for ambient-only scenes)
    if (uNumLights == 0 || uDiffuseIntensity < 0.001) {
        return surfaceColor * uAmbientColor * uAmbientIntensity;
    }

    // Start with ambient (same as Mandelbulb line 53)
    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;

    // Normalize gradient as pseudo-normal
    float gradLen = length(gradient);
    if (gradLen < 0.0001) return col;

    vec3 n = gradient / gradLen;

    // Loop through lights - exact same pattern as Mandelbulb lines 57-103
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

        // Powder effect (multiple scattering approximation)
        // Brightens thin/edge regions: (1 - exp(-rho * scale))
        // We use the raw density 'rho' but scaled by gain to match visual density
        float powder = 1.0;
        if (uPowderScale > 0.0) {
             powder = 1.0 - exp(-rho * uDensityGain * uPowderScale * 4.0);
             // Remap to make it additive boost for thin areas
             powder = 0.5 + 1.5 * powder;
        }
        
        // Anisotropic Scattering (Henyey-Greenstein)
        float phaseFactor = 1.0;
        if (abs(uScatteringAnisotropy) > 0.01) {
            float dotLH = dot(l, viewDir); // L . V = cos(theta)
            // Note: Standard HG expects cos(theta) where theta is angle between incident light direction and scattering direction.
            // Here 'l' is vector TO light. 'viewDir' is vector TO camera.
            // Scattering angle is angle between incoming light (-l) and outgoing light (viewDir).
            // So dot(-l, viewDir).
            // However, most implementations use dot(l, viewDir) directly for forward scattering when g > 0.
            // Let's stick to the convention where g > 0 means forward scattering (bright when light is behind object).
            // If light is behind object, l and viewDir are opposing? No, l is to light, viewDir is to camera.
            // If light is behind object, l points away from camera, viewDir points to camera. Angle is 180?
            // Wait.
            // Camera <--- Object <--- Light
            // viewDir (Object->Camera) = (-1, 0, 0)
            // l (Object->Light) = (1, 0, 0)
            // dot(l, viewDir) = -1. This is forward scattering (light passes through).
            // If dot product is -1, theta is 180.
            // HG function peaks at 0 degrees (cos=1).
            // So we want cos=1 when forward scattering.
            // That means we should use dot(-l, viewDir) ? 
            // -l is Light->Object. viewDir is Object->Camera.
            // If they are aligned (Light->Object->Camera), then -l == viewDir.
            // So dot(-l, viewDir) = 1.
            // So yes, dot(-l, viewDir) corresponds to theta=0 (forward scattering).
            
            float cosTheta = dot(-l, viewDir);
            phaseFactor = henyeyGreenstein(cosTheta, uScatteringAnisotropy);
            
            // Normalize so isotropic (g=0) roughly preserves brightness
            // HG integral is 1, but peak value varies.
            // For rendering, we often want to modulate the diffuse term.
            // Multiply by 4*PI to cancel out the 1/(4*PI) term for easier tweaking?
            phaseFactor *= 12.56; 
        }

        // Diffuse
        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * powder * phaseFactor;

        // Specular (GGX) - uses Cook-Torrance BRDF
        // F0 for dielectrics is usually around 0.04.
        // For metals (if we added metalness), F0 would be albedo: mix(F0, surfaceColor, uMetallic)
        vec3 F0 = vec3(0.04);
        vec3 specular = computePBRSpecular(n, viewDir, l, uRoughness, F0);
        
        // Volumetric Self-Shadowing (Raymarching towards light)
        float shadowFactor = 1.0;
        if (uShadowsEnabled && uShadowStrength > 0.0) {
            // March towards light 'l' (normalized vector to light)
            float shadowDens = 0.0;
            float shadowStep = 0.1; // Configurable?
            float tShadow = 0.05;   // Start offset to avoid self-occlusion artifacts
            
            // "Cone" stepping: increase step size with distance for soft shadows
            // Also include one far sample?
            
            for (int s = 0; s < 8; s++) { // Max 8 steps, controlled by uniform
                if (s >= uShadowSteps) break;
                
                vec3 shadowPos = p + l * tShadow;
                
                // Sample density (use cheap version without phase if possible? 
                // sampleDensity() vs sampleDensityWithPhase()
                // sampleDensity() is cheaper (rhoFromPsi).
                float rhoS = sampleDensity(shadowPos, uTime * uTimeScale);
                
                shadowDens += rhoS * shadowStep;
                
                // Increase step size for cone effect / softness / distance coverage
                shadowStep *= 1.5;
                tShadow += shadowStep;
            }
            
            // Beer-Lambert for shadow
            shadowFactor = exp(-shadowDens * uDensityGain * uShadowStrength);
        }
        
        // Apply shadow to diffuse and specular
        // Ambient is usually not shadowed (or occluded via AO)
        
        // Add specular contribution
        // Scale by specular intensity
        col += specular * uLightColors[i] * NdotL * uSpecularIntensity * attenuation * shadowFactor;
        
        // Subsurface Scattering (SSS)
#ifdef USE_SSS
        if (uSssEnabled && uSssIntensity > 0.0) {
            // ... SSS code ...
            // SSS should technically be inverse of shadow?
            // If shadow is blocked, SSS might be active if coming from behind?
            // Actually, SSS *is* light passing through.
            // If we calculate shadow, we are calculating how much light reaches point P from Light L.
            // That applies to forward scattering too.
            // So modulate SSS by shadowFactor?
            // If thick object blocks light, P is dark. No SSS from that light.
            // But SSS logic above uses 'exp(-rho * thickness)'. That IS the shadow calculation for single slice.
            // Real volumetric shadow is better.
            // Let's multiply SSS by shadowFactor?
            // Wait, SSS approx uses viewing angle. It approximates light path P -> Eye?
            // No, SSS is Light -> P -> Eye.
            // Shadow is Light -> P.
            // So yes, shadowFactor applies to SSS too.

            // Apply jitter to distortion for softer SSS
            float sssNoise = fract(sin(dot(gl_FragCoord.xy * 0.1, vec2(127.1, 311.7))) * 43758.5453) * 2.0 - 1.0;
            float jitteredDistortion = 0.5 * (1.0 + sssNoise * uSssJitter);
            vec3 halfVec = normalize(l + n * jitteredDistortion);
            float trans = pow(clamp(dot(viewDir, -halfVec), 0.0, 1.0), uSssThickness * 4.0);

            // Use shadowFactor instead of simple rho-based approx if available?
            // Simple approx: exp(-rho).
            // Raymarched: shadowFactor.
            // If shadowing is enabled, use it!

            float transmission = trans;
            if (uShadowsEnabled) {
                 transmission *= shadowFactor;
            } else {
                 transmission *= exp(-rho * uSssThickness);
            }

            col += uSssColor * uLightColors[i] * transmission * uSssIntensity * attenuation;
        } else {
             // Standard Diffuse with Shadow
             // Apply shadow to diffuse
             col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * powder * phaseFactor * shadowFactor;
        }
#else
        // Standard Diffuse with Shadow (SSS disabled at compile time)
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * powder * phaseFactor * shadowFactor;
#endif
    }
    
    // Volumetric Ambient Occlusion
    // Darken ambient term based on surrounding density
    // Expensive!
    float aoFactor = 1.0;
    if (uAoEnabled && uAoStrength > 0.0) {
        float ao = 0.0;
        float radius = uAoRadius;
        int steps = uAoSteps;
        
        // Hemisphere sampling around Normal 'n'
        // Or just spherical sampling around 'p' if we consider isotropic occlusion?
        // Since we have 'n', let's use hemisphere.
        
        // Simple 4-way sample + center
        // Or random directions.
        
        // Deterministic directions for stability
        vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0) + vec3(0.001)));
        vec3 t2 = cross(n, t1);
        
        for (int k = 0; k < 8; k++) {
            if (k >= steps) break;
            
            // Generate direction in hemisphere
            // Using fixed pattern
            float angle = float(k) * 2.39996; // Golden angle approx
            float r = float(k+1) / float(steps); // Distance from center
            // Map to hemisphere?
            
            // Simpler: Just sample along normal and some side directions
            vec3 dir = n;
            if (k == 1) dir = normalize(n + t1);
            if (k == 2) dir = normalize(n - t1);
            if (k == 3) dir = normalize(n + t2);
            if (k == 4) dir = normalize(n - t2);
            if (k == 5) dir = normalize(n + t1 + t2);
            if (k == 6) dir = normalize(n - t1 - t2);
            if (k == 7) dir = normalize(n + t1 - t2);
            
            vec3 samplePos = p + dir * radius;
            float sampleRho = sampleDensity(samplePos, uTime * uTimeScale);
            
            // Accumulate occlusion
            ao += sampleRho;
        }
        
        // Normalize and apply strength
        // Tune this constant factor
        ao = ao / float(steps);
        aoFactor = exp(-ao * uDensityGain * uAoStrength * 2.0);
        
        // Mix AO color
        // If occlusion is high (aoFactor low), mix towards uAoColor
        // But multiplying is better for shadows.
        // Let's modify col using mix(col, uAoColor, 1.0 - aoFactor) ?
        // Standard AO: col *= aoFactor.
        // Tinted AO: col *= mix(uAoColor, vec3(1.0), aoFactor); (if AoColor is shadow color)
        // Or col = mix(col * aoFactor, uAoColor, 1.0 - aoFactor)? No that replaces.
        
        // Correct tinted AO:
        // Ambient light becomes: Ambient * (AO_White + (1-AO)*Tint) ?
        // Simple multiplicative tint:
        vec3 aoModulator = mix(uAoColor, vec3(1.0), aoFactor);
        col *= aoModulator;
    }

    // Volumetric Fresnel / Rim Lighting
#ifdef USE_FRESNEL
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
        float NdotV = max(dot(n, viewDir), 0.0);
        // Standard Fresnel approximation: (1 - N.V)^power
        float rim = pow(1.0 - NdotV, uRimExponent) * uFresnelIntensity;

        // Volumetric integration: Rim should be stronger in thin regions (transmittance)
        // We approximate "thinness" by (1.0 - normalizedRho) or just simple weighting
        // The PRD suggests: Rim brightness is scaled by local transmittance
        // Since we are in a density accumulation loop, we don't know total transmittance yet.
        // But we can weigh it by local density contribution.
        // Actually, rim is usually an additive term.

        // Modulate rim by AO? Yes, rim shouldn't appear in deep crevices.
        if (uAoEnabled) rim *= aoFactor;

        col += uRimColor * rim;
    }
#endif

    // HDR Emission Glow
    if (uEmissionIntensity > 0.0) {
        // Normalize density to approx [0,1] range for thresholding
        // sFromRho returns approx log-density around -8 to 0.
        // We can use the raw density 'rho' which works better for peaks.
        
        // Use sFromRho to get a normalized "density signal" between 0 and 1
        float s = sFromRho(rho); 
        float normalizedRho = clamp((s + 8.0) / 8.0, 0.0, 1.0);
        
        if (normalizedRho > uEmissionThreshold) {
            float emissionFactor = (normalizedRho - uEmissionThreshold) / (1.0 - uEmissionThreshold);
            emissionFactor = pow(emissionFactor, 2.0); // Make falloff non-linear (sharper)
            
            vec3 emissionColor = surfaceColor;
            
            // Color Shift (Cool/Warm)
            if (abs(uEmissionColorShift) > 0.01) {
                vec3 hsl = rgb2hsl(emissionColor);
                if (uEmissionColorShift > 0.0) {
                     // Warm shift: pull hue towards orange (0.08)
                     hsl.x = mix(hsl.x, 0.08, uEmissionColorShift * 0.5);
                     hsl.y = mix(hsl.y, 1.0, uEmissionColorShift * 0.3); // Boost saturation
                } else {
                     // Cool shift: pull hue towards blue (0.6)
                     hsl.x = mix(hsl.x, 0.6, -uEmissionColorShift * 0.5);
                     hsl.z = mix(hsl.z, 0.9, -uEmissionColorShift * 0.3); // Boost lightness
                }
                emissionColor = hsl2rgb(hsl);
            }
            
            // Pulsing
            float pulse = 1.0;
            if (uEmissionPulsing) {
                 float phaseNorm = (phase + PI) / TAU;
                 // Pulse based on phase and time
                 pulse = 1.0 + 0.5 * sin(phaseNorm * 6.28 + uTime * uTimeScale * 2.0);
            }
            
            col += emissionColor * uEmissionIntensity * emissionFactor * pulse;
        }
    }

    return col;
}
`;
