uniform vec3 uCameraPosition;
uniform float uPower;
uniform float uIterations;
uniform float uEscapeRadius;
uniform vec3 uColor;
uniform int uPaletteMode;
uniform mat4 uModelMatrix;
uniform mat4 uInverseModelMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

// Lighting uniforms (from visual settings)
uniform bool uLightEnabled;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uAmbientIntensity;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
// Enhanced lighting uniforms
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;
uniform bool uToneMappingEnabled;
uniform int uToneMappingAlgorithm;
uniform float uExposure;

// Fresnel rim lighting uniforms
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Performance mode: reduces quality during animation
uniform bool uFastMode;

varying vec3 vPosition;
varying vec2 vUv;

// Performance tuning - balance quality vs speed
#define MAX_MARCH_STEPS 128      // Reduced from 200
#define SURF_DIST 0.002          // Increased from 0.001 - less precision needed
#define MAX_ITERATIONS 64        // Reduced from 100 - still good quality
#define BOUNDING_RADIUS 2.0      // Skip rays that miss the bounding sphere

// Palette mode constants (must match PALETTE_MODE_MAP in MandelbulbMesh.tsx)
#define PALETTE_MONOCHROMATIC 0
#define PALETTE_ANALOGOUS 1
#define PALETTE_COMPLEMENTARY 2
#define PALETTE_TRIADIC 3
#define PALETTE_SPLIT_COMPLEMENTARY 4

// ============================================
// HSL <-> RGB Conversion Functions
// ============================================

vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) * 0.5;

    if (maxC == minC) {
        return vec3(0.0, 0.0, l); // achromatic
    }

    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    float h;
    if (maxC == c.r) {
        h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxC == c.g) {
        h = (c.b - c.r) / d + 2.0;
    } else {
        h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;

    return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    if (s == 0.0) {
        return vec3(l); // achromatic
    }

    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;

    return vec3(
        hue2rgb(p, q, h + 1.0/3.0),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1.0/3.0)
    );
}

// ============================================
// Palette Generation Based on Color Theory
// ============================================

/**
 * Calculate lightness range based on base lightness.
 * Provides wide dynamic range with bias toward darkness.
 */
vec2 getLightnessRange(float baseL) {
    // Wide range: from near-black to bright highlights
    // Dark base colors: [0, 0.7] - mostly dark with bright highlights
    // Light base colors: [0.2, 1.0] - some shadow, mostly bright
    // Mid base colors: [0.05, 0.85] - full range

    float minL = baseL * 0.15;  // Dark colors get very dark minimum
    float maxL = baseL + (1.0 - baseL) * 0.7;  // Expand toward bright

    // Ensure minimum is always quite dark for contrast
    minL = min(minL, 0.08);

    return vec2(minL, maxL);
}

/**
 * Generate a color from the palette based on trap value (0-1).
 * Uses color theory principles from Adobe Color.
 *
 * For achromatic base colors (black, white, gray), adds subtle saturation
 * to make palette modes meaningful.
 *
 * @param baseHSL - The base color in HSL (from user's surface color)
 * @param t - Trap/variation value [0,1] controlling position in palette
 * @param mode - Palette mode (see PALETTE_* defines)
 */
vec3 getPaletteColor(vec3 baseHSL, float t, int mode) {
    float h = baseHSL.x;
    float s = baseHSL.y;
    float l = baseHSL.z;

    // Calculate lightness range based on base color
    vec2 lRange = getLightnessRange(l);
    float minL = lRange.x;
    float maxL = lRange.y;

    // For achromatic colors, use red as default hue and add subtle saturation
    // This makes palette modes meaningful for black/white/gray
    bool isAchromatic = s < 0.1;
    if (isAchromatic && mode != PALETTE_MONOCHROMATIC) {
        h = 0.0;  // Red hue as starting point
        s = 0.4;  // Add moderate saturation for color visibility
    }

    if (mode == PALETTE_MONOCHROMATIC) {
        // Same hue, vary lightness only - true grayscale for achromatic
        float newL = mix(minL, maxL, t);
        return hsl2rgb(vec3(h, baseHSL.y, newL));  // Use original saturation
    }
    else if (mode == PALETTE_ANALOGOUS) {
        // Hue varies ±30° from base
        float hueShift = (t - 0.5) * 0.167;
        float newH = fract(h + hueShift);
        float newL = mix(minL, maxL, t);
        return hsl2rgb(vec3(newH, s, newL));
    }
    else if (mode == PALETTE_COMPLEMENTARY) {
        // Two distinct colors: base hue and complement (180° apart)
        float complement = fract(h + 0.5);
        float newH;
        // Sharp transition between the two colors
        if (t < 0.5) {
            newH = h;
        } else {
            newH = complement;
        }
        // Vary lightness smoothly
        float newL = mix(minL, maxL, t);
        return hsl2rgb(vec3(newH, s, newL));
    }
    else if (mode == PALETTE_TRIADIC) {
        // Three distinct colors 120° apart
        float hue1 = h;
        float hue2 = fract(h + 0.333);
        float hue3 = fract(h + 0.667);
        // Sharp transitions between the three hues
        float newH;
        if (t < 0.333) {
            newH = hue1;
        } else if (t < 0.667) {
            newH = hue2;
        } else {
            newH = hue3;
        }
        float newL = mix(minL, maxL, t);
        return hsl2rgb(vec3(newH, s, newL));
    }
    else if (mode == PALETTE_SPLIT_COMPLEMENTARY) {
        // Three colors: base + two flanking complement (±30° from 180°)
        float split1 = fract(h + 0.5 - 0.083); // 150° from base
        float split2 = fract(h + 0.5 + 0.083); // 210° from base
        // Sharp transitions
        float newH;
        if (t < 0.333) {
            newH = h;
        } else if (t < 0.667) {
            newH = split1;
        } else {
            newH = split2;
        }
        float newL = mix(minL, maxL, t);
        return hsl2rgb(vec3(newH, s, newL));
    }

    // Fallback: monochromatic
    return hsl2rgb(vec3(h, baseHSL.y, mix(minL, maxL, t)));
}

// ============================================
// Tone Mapping Functions
// ============================================

vec3 reinhardToneMap(vec3 c) {
    return c / (c + vec3(1.0));
}

vec3 acesToneMap(vec3 c) {
    // ACES filmic tone mapping approximation
    const float a = 2.51;
    const float b = 0.03;
    const float c2 = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((c * (a * c + b)) / (c * (c2 * c + d) + e), 0.0, 1.0);
}

vec3 uncharted2ToneMap(vec3 c) {
    // Uncharted 2 filmic tone mapping
    const float A = 0.15;
    const float B = 0.50;
    const float C = 0.10;
    const float D = 0.20;
    const float E = 0.02;
    const float F = 0.30;
    const float W = 11.2;

    vec3 curr = ((c * (A * c + C * B) + D * E) / (c * (A * c + B) + D * F)) - E / F;
    vec3 white = ((vec3(W) * (A * W + C * B) + D * E) / (vec3(W) * (A * W + B) + D * F)) - E / F;
    return curr / white;
}

vec3 applyToneMapping(vec3 c, int algo, float exposure) {
    vec3 exposed = c * exposure;
    if (algo == 0) return reinhardToneMap(exposed);
    if (algo == 1) return acesToneMap(exposed);
    if (algo == 2) return uncharted2ToneMap(exposed);
    return clamp(exposed, 0.0, 1.0); // fallback: simple clamp
}

// Fresnel (Schlick approximation)
float fresnelSchlick(float cosTheta, float F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// ============================================
// Mandelbulb SDF with Orbit Trap
// ============================================

// Simple SDF for normal calculation and AO (no trap needed)
float GetDist(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float power = uPower < 1.0 ? 8.0 : uPower;
    float escapeRadius = uEscapeRadius < 1.0 ? 2.0 : uEscapeRadius;
    int iter = int(min(uIterations, float(MAX_ITERATIONS)));

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iter) break;

        r = length(z);
        if (r > escapeRadius) break;

        float theta = acos(z.z/r);
        float phi = atan(z.y, z.x);

        dr = pow(r, power-1.0) * power * dr + 1.0;

        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
        z += pos;
    }
    return 0.5 * log(r) * r / dr;
}

// SDF with orbit trap for coloring
float GetDistWithTrap(vec3 pos, out float trap) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float power = uPower < 1.0 ? 8.0 : uPower;
    float escapeRadius = uEscapeRadius < 1.0 ? 2.0 : uEscapeRadius;
    int iter = int(min(uIterations, float(MAX_ITERATIONS)));

    // Orbit trap: track minimum distance to geometric primitives
    float minDistPlane = 1000.0;
    float minDistAxis = 1000.0;
    float minDistSphere = 1000.0;
    int escapeIter = 0;

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        if (i >= iter) break;

        r = length(z);
        if (r > escapeRadius) {
            escapeIter = i;
            break;
        }

        // Multiple orbit traps for richer variation
        minDistPlane = min(minDistPlane, abs(z.y));                    // y=0 plane
        minDistAxis = min(minDistAxis, length(z.xz));                  // y-axis distance
        minDistSphere = min(minDistSphere, abs(length(z) - 0.8));      // sphere shell r=0.8

        float theta = acos(z.z/r);
        float phi = atan(z.y, z.x);

        dr = pow(r, power-1.0) * power * dr + 1.0;

        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
        z += pos;
        escapeIter = i;
    }

    // Combine multiple traps with different weights for complex patterns
    float planeTrap = exp(-minDistPlane * 5.0);      // Sharp falloff
    float axisTrap = exp(-minDistAxis * 3.0);        // Medium falloff
    float sphereTrap = exp(-minDistSphere * 8.0);    // Sharp falloff
    float iterTrap = float(escapeIter) / float(iter); // Iteration-based

    // Create varied trap value by combining different sources
    trap = planeTrap * 0.3 + axisTrap * 0.2 + sphereTrap * 0.2 + iterTrap * 0.3;

    return 0.5 * log(r) * r / dr;
}

// ============================================
// Bounding Sphere Intersection
// ============================================

// Returns distance to sphere intersection, or -1 if no hit
// Also returns exit distance in tExit
vec2 intersectSphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);  // entry, exit
}

// ============================================
// Raymarching
// ============================================

float RayMarch(vec3 ro, vec3 rd, out float trap) {
    trap = 0.0;

    // Calculate max distance based on camera position
    // Need to reach from camera through the entire bounding sphere
    float camDist = length(ro);
    float maxDist = camDist + BOUNDING_RADIUS * 2.0 + 1.0;

    // Early out: check if ray intersects bounding sphere
    vec2 tSphere = intersectSphere(ro, rd, BOUNDING_RADIUS);
    if (tSphere.y < 0.0) {
        // Sphere is entirely behind ray origin
        return maxDist + 1.0;
    }

    // Start marching from sphere entry (or ray origin if inside sphere)
    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);  // Don't march past sphere exit

    for (int i = 0; i < MAX_MARCH_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float currentTrap;
        float dS = GetDistWithTrap(p, currentTrap);

        if (dS < SURF_DIST) {
            trap = currentTrap;
            return dO;
        }

        dO += dS;

        // Stop if we exit the bounding sphere
        if (dO > maxT) break;
    }

    return maxDist + 1.0;
}

// ============================================
// Normal Calculation
// ============================================

vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(0.001, 0);

    vec3 n = d - vec3(
        GetDist(p-e.xyy),
        GetDist(p-e.yxy),
        GetDist(p-e.yyx));

    return normalize(n);
}

// ============================================
// Ambient Occlusion (optimized - 3 samples instead of 5)
// ============================================

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;

    // Reduced to 3 samples for performance
    float h1 = 0.02;
    float h2 = 0.08;
    float h3 = 0.16;

    occ += (h1 - GetDist(p + h1 * n)) * 1.0;
    occ += (h2 - GetDist(p + h2 * n)) * 0.7;
    occ += (h3 - GetDist(p + h3 * n)) * 0.5;

    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

// ============================================
// Main
// ============================================

void main() {
    // Transform ray origin and direction to object space
    vec3 ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
    vec3 worldRayDir = normalize(vPosition - uCameraPosition);
    vec3 rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);

    // Calculate max distance (must match RayMarch calculation)
    float camDist = length(ro);
    float maxDist = camDist + BOUNDING_RADIUS * 2.0 + 1.0;

    float trap;
    float d = RayMarch(ro, rd, trap);

    if (d > maxDist) {
        discard;
    }

    vec3 p = ro + rd * d;
    vec3 n = GetNormal(p);

    // Calculate ambient occlusion
    float ao = calcAO(p, n);

    // Convert base color to HSL
    vec3 baseHSL = rgb2hsl(uColor);

    // Invert trap: high trap in crevices, but we want peaks bright, valleys dark
    float t = 1.0 - trap;

    // Get palette color based on trap value and palette mode
    vec3 surfaceColor = getPaletteColor(baseHSL, t, uPaletteMode);

    // Apply ambient occlusion to darken crevices more aggressively
    surfaceColor *= (0.3 + 0.7 * ao);

    // Lighting calculation using scene lighting settings
    // Start with ambient
    vec3 col = surfaceColor * uAmbientIntensity;

    if (uLightEnabled) {
        // Light direction stays fixed in world space
        vec3 l = normalize(uLightDirection);

        // Transform normal and view direction from object space to world space
        // (raymarching happens in object space, lighting uses world space)
        vec3 worldNormal = normalize((uModelMatrix * vec4(n, 0.0)).xyz);
        vec3 worldViewDir = normalize((uModelMatrix * vec4(-rd, 0.0)).xyz);

        // Energy conservation: diffuse weight = 1.0 - ambient
        float diffuseWeight = 1.0 - uAmbientIntensity;

        // Diffuse (Lambert) with energy conservation and intensity control
        float NdotL = max(dot(worldNormal, l), 0.0);
        float diffuse = NdotL * uDiffuseIntensity * diffuseWeight;
        col += surfaceColor * uLightColor * diffuse;

        // Specular (Blinn-Phong) - simple without Fresnel for clearer highlights
        // Matches Three.js MeshPhongMaterial: pow(NdotH, shininess) * specularColor
        vec3 halfDir = normalize(l + worldViewDir);
        float NdotH = max(dot(worldNormal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity;
        col += uSpecularColor * uLightColor * spec;

        // Fresnel rim lighting (controlled by Edges render mode)
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
            float NdotV = max(dot(worldNormal, worldViewDir), 0.0);
            float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
            // Rim is stronger on lit side
            rim *= (0.3 + 0.7 * NdotL);
            col += uRimColor * rim;
        }
    }

    // Apply tone mapping as final step
    if (uToneMappingEnabled) {
        col = applyToneMapping(col, uToneMappingAlgorithm, uExposure);
    }

    // Compute correct depth for the raymarched surface
    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    float depth = (clipPos.z / clipPos.w) * 0.5 + 0.5;
    gl_FragDepth = clamp(depth, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
}
