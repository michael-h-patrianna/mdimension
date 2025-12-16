export const classicBlock = `
vec3 getClassic(vec3 dir, float time) {
    vec3 color;
    // Calculate mip level for blur effect (0 = sharp, higher = blurrier)
    float lod = uBlur * 6.0;

    // Parallax depth effect - 3-layer system for perceived depth
    if (uParallaxEnabled > 0.5) {
        // Strength controls visual intensity, NOT layer positions
        float intensity = uParallaxStrength;

        // === PRE-SAMPLE to determine per-pixel movement amount ===
        vec3 baseColor = textureLod(uTex, dir, lod).rgb;
        float baseMax = max(baseColor.r, max(baseColor.g, baseColor.b));
        float baseMin = min(baseColor.r, min(baseColor.g, baseColor.b));
        float baseSat = (baseMax > 0.01) ? (baseMax - baseMin) / baseMax : 0.0;
        float baseLum = dot(baseColor, vec3(0.299, 0.587, 0.114));

        // Color purity - how dominant is the strongest channel
        float bluePurity = max(0.0, baseColor.b - max(baseColor.r, baseColor.g) * 0.6);
        float redPurity = max(0.0, baseColor.r - max(baseColor.g, baseColor.b) * 0.6);
        float greenPurity = max(0.0, baseColor.g - max(baseColor.r, baseColor.b) * 0.6);
        float colorPurity = (bluePurity + redPurity + greenPurity) * 2.0 + baseSat;
        colorPurity = clamp(colorPurity, 0.0, 1.0);

        // Movement multiplier: pure colors move more, grays barely move
        float moveAmount = colorPurity * smoothstep(0.1, 0.4, baseLum) * (1.0 - smoothstep(0.9, 1.0, baseLum));

        // === LAYER 1: Deep Background (furthest) ===
        // Very slow uniform sway - background is mostly dark anyway
        vec3 deepDir = dir;
        float deepSway = sin(time * 0.015) * 0.002;
        deepDir.x += deepSway;
        deepDir = normalize(deepDir);
        vec3 deepColor = textureLod(uTex, deepDir, lod + 1.0).rgb;

        // === LAYER 2: Mid layer (base) ===
        // Movement scaled by color purity - pure colors orbit their center
        vec3 midDir = dir;
        float midPhase = time * 0.03 + baseLum * TAU; // Phase offset by luminance for variety
        float midSwayX = sin(midPhase) * 0.003 * moveAmount;
        float midSwayY = cos(midPhase * 0.7) * 0.002 * moveAmount;
        midDir.x += midSwayX;
        midDir.y += midSwayY;
        midDir = normalize(midDir);
        vec3 midColor = textureLod(uTex, midDir, lod).rgb;
        float midLum = dot(midColor, vec3(0.299, 0.587, 0.114));

        // === LAYER 3: Foreground (closest) - colorful elements move most ===
        vec3 nearDir = dir;
        // Faster, larger orbit for foreground - scaled heavily by purity
        float nearPhase = time * 0.05 + colorPurity * PI; // Different phase based on color
        float nearSwayX = sin(nearPhase) * 0.006 * moveAmount;
        float nearSwayY = cos(nearPhase * 1.3 + 0.5) * 0.004 * moveAmount;
        // Add slight unique offset based on which color dominates
        nearSwayX += (redPurity - bluePurity) * sin(time * 0.04) * 0.003;
        nearSwayY += (greenPurity - redPurity) * cos(time * 0.035) * 0.002;
        nearDir.x += nearSwayX;
        nearDir.y += nearSwayY;
        nearDir = normalize(nearDir);
        vec3 nearColor = textureLod(uTex, nearDir, lod).rgb;

        // Recalculate saturation for near layer
        float nearMax = max(nearColor.r, max(nearColor.g, nearColor.b));
        float nearMin = min(nearColor.r, min(nearColor.g, nearColor.b));
        float nearSat = (nearMax > 0.01) ? (nearMax - nearMin) / nearMax : 0.0;
        float nearLum = dot(nearColor, vec3(0.299, 0.587, 0.114));

        // Colorfulness score for compositing
        float colorfulness = nearSat * smoothstep(0.15, 0.5, nearLum) * (1.0 - smoothstep(0.85, 1.0, nearLum));
        float nearBlueDom = max(0.0, nearColor.b - max(nearColor.r, nearColor.g) * 0.7);
        float nearRedDom = max(0.0, nearColor.r - max(nearColor.g, nearColor.b) * 0.7);
        float nearGreenDom = max(0.0, nearColor.g - max(nearColor.r, nearColor.b) * 0.7);
        float colorDominance = nearBlueDom + nearRedDom + nearGreenDom;

        // Combined mask: colorful elements come forward
        float nearMask = (colorfulness + colorDominance * 0.5) * mix(1.0, 2.0, intensity);
        nearMask = clamp(nearMask, 0.0, 1.0);

        // === COMPOSITING - preserve overall brightness ===
        color = midColor;

        // Darken only the darkest areas slightly
        float darkMask = 1.0 - smoothstep(0.0, 0.3, midLum);
        float depthDarken = mix(1.0, 0.85, intensity * darkMask);
        color *= depthDarken;

        // Blend in the deep layer for dark regions
        float deepBlend = darkMask * mix(0.1, 0.25, intensity);
        color = mix(color, deepColor * 0.9, deepBlend);

        // Pop colorful elements forward with saturation boost
        vec3 saturatedNear = nearColor * (1.0 + nearSat * 0.15);
        color = mix(color, saturatedNear, nearMask * mix(0.15, 0.4, intensity));

        // Glow on most colorful foreground elements
        float glowMask = smoothstep(0.3, 0.7, colorfulness + colorDominance);
        float glowIntensity = mix(0.03, 0.12, intensity);
        color += nearColor * glowMask * glowIntensity;
    } else {
        // Chromatic Aberration (Classic only, procedural handles it differently)
        if (uAberration > 0.0) {
            float spread = uAberration * 0.02;
            vec3 dirR = dir; dirR.x += spread;
            vec3 dirB = dir; dirB.x -= spread;
            float r = textureLod(uTex, dirR, lod).r;
            float g = textureLod(uTex, dir, lod).g;
            float b = textureLod(uTex, dirB, lod).b;
            color = vec3(r, g, b);
        } else {
            color = textureLod(uTex, dir, lod).rgb;
        }
    }

    // Classic tinting
    color *= uIntensity;

    if (uHue != 0.0 || uSaturation != 1.0) {
        vec3 hsv = rgb2hsv(color);
        hsv.x += uHue;
        hsv.y *= uSaturation;
        color = hsv2rgb(hsv);
    }
    return color;
}
`;
