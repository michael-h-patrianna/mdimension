import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';
import { sssBlock } from '../shared/lighting/sss.glsl';

import { transformNDBlock } from './transform-nd.glsl';
import { modulationBlock } from './modulation.glsl';

/**
 *
 */
export function composeFaceVertexShader(): string {
  return [
    `precision highp float;
    precision highp int;`,
    transformNDBlock,
    modulationBlock,
    `
    // Outputs to fragment shader
    out vec3 vWorldPosition;
    out vec3 vViewDir;
    // Face depth for color algorithms - flat interpolation means first vertex wins
    flat out float vFaceDepth;

    void main() {
      vec3 projected = transformND();

      // Sum of extra dimensions for dimension-aware bias
      float extraSum = aExtraDim0 + aExtraDim1 + aExtraDim2 + aExtraDim3 + aExtraDim4 + aExtraDim5 + aExtraDim6;

      vec3 modulated = modulateVertex(projected, extraSum);

      vec4 worldPos = modelMatrix * vec4(modulated, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;

      // Pass world position for normal calculation in fragment shader
      vWorldPosition = worldPos.xyz;
      // Guard against camera at world position (zero-length view direction)
      vec3 viewDiff = cameraPosition - worldPos.xyz;
      float viewLen = length(viewDiff);
      vViewDir = viewLen > 0.0001 ? viewDiff / viewLen : vec3(0.0, 0.0, 1.0);

      // Compute face depth from higher dimension coordinates
      // With flat interpolation, first vertex of each triangle sets the value
      // Map to roughly 0-1 range (coordinates typically in -1 to 1)
      vFaceDepth = clamp(extraSum * 0.15 + 0.5, 0.0, 1.0);
    }
    `
  ].join('\n');
}

/**
 *
 */
export function composeEdgeVertexShader(): string {
  return [
    transformNDBlock,
    modulationBlock,
    `
    void main() {
      vec3 projected = transformND();

      // Sum of extra dimensions for dimension-aware bias
      float extraSum = aExtraDim0 + aExtraDim1 + aExtraDim2 + aExtraDim3 + aExtraDim4 + aExtraDim5 + aExtraDim6;

      vec3 modulated = modulateVertex(projected, extraSum);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(modulated, 1.0);
    }
    `
  ].join('\n');
}

/**
 *
 */
export function composeFaceFragmentShader(): string {
  return [
    precisionBlock,
    `
    // Color uniforms
    uniform float uOpacity;

    // Legacy single-light uniforms
    uniform bool uLightEnabled;
    uniform vec3 uLightColor;
    uniform vec3 uLightDirection;
    uniform float uLightStrength;

    // Rim SSS uniforms
    uniform bool uSssEnabled;
    uniform float uSssIntensity;
    uniform vec3 uSssColor;
    uniform float uSssThickness;

    // Inputs from vertex shader
    in vec3 vWorldPosition;
    in vec3 vViewDir;
    // Face depth with flat interpolation - first vertex of each triangle wins
    flat in float vFaceDepth;
    `,
    constantsBlock,
    uniformsBlock,
    hslBlock,
    cosinePaletteBlock,
    oklabBlock,
    selectorBlock,
    fresnelBlock,
    multiLightBlock,
    sssBlock,
    `
    void main() {
      // Compute face normal from screen-space derivatives of world position
      vec3 dPdx = dFdx(vWorldPosition);
      vec3 dPdy = dFdy(vWorldPosition);
      vec3 crossProd = cross(dPdx, dPdy);
      float crossLen = length(crossProd);
      // Guard against degenerate normals (edge-on faces where cross product is near-zero)
      // Without this, normalize() produces NaN which makes the face render as transparent
      vec3 normal = crossLen > 0.0001 ? crossProd / crossLen : vec3(0.0, 0.0, 1.0);
      // Guard against zero-length view direction (already normalized in vertex shader, but double-check)
      float vViewLen = length(vViewDir);
      vec3 viewDir = vViewLen > 0.0001 ? vViewDir / vViewLen : vec3(0.0, 0.0, 1.0);

      // For two-sided surfaces, we keep the geometric normal as computed
      // Two-sided lighting is achieved by using abs() in diffuse calculations below

      // Get base color from algorithm using face depth as t value
      // vFaceDepth is computed from higher dimension coords with flat interpolation
      vec3 baseHSL = rgb2hsl(uColor);
      // Pass vWorldPosition as 4th argument for spatial color modes (multi-source, radial)
      vec3 baseColor = getColorByAlgorithm(vFaceDepth, normal, baseHSL, vWorldPosition);

      // Multi-light calculation
      vec3 col;
      if (uNumLights > 0) {
        // Use multi-light system logic (manual integration since calculateMultiLighting is complex logic, 
        // but wait, calculateMultiLighting logic IS shared logic mostly? 
        // No, shared module 'multi-light.glsl.ts' only provides helpers like getLightDirection.
        // It does NOT provide a 'calculateMultiLighting' function that loops.
        // Wait, did I check 'multi-light.glsl.ts'?
        // I created it in step 10. Let's check it.
        
        // Loop over lights manually like in Mandelbulb main
        
        col = baseColor * uAmbientColor * uAmbientIntensity;
        float totalNdotL = 0.0; // For fresnel

        for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= uNumLights) break;
            if (!uLightsEnabled[i]) continue;

            vec3 l = getLightDirection(i, vWorldPosition);
            float attenuation = uLightIntensities[i];

            int lightType = uLightTypes[i];
            if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
                float distance = length(uLightPositions[i] - vWorldPosition);
                attenuation *= getDistanceAttenuation(i, distance);
            }

            if (lightType == LIGHT_TYPE_SPOT) {
                vec3 ltfDiff = vWorldPosition - uLightPositions[i];
                float ltfLen = length(ltfDiff);
                // Guard against light at fragment position
                vec3 lightToFrag = ltfLen > 0.0001 ? ltfDiff / ltfLen : vec3(0.0, -1.0, 0.0);
                attenuation *= getSpotAttenuation(i, lightToFrag);
            }

            if (attenuation < 0.001) continue;

            // Polytope faces don't support shadows yet (raymarched shadows require SDF)
            // Shadows are disabled for polytopes in this refactor unless implemented (user says no features needed)
            float shadow = 1.0; 

            // Two-sided lighting: use abs() so both sides of faces receive diffuse light
            float NdotL = abs(dot(normal, l));
            col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

            // Guard against l and viewDir being opposite (zero-length half vector)
            vec3 halfSum = l + viewDir;
            float halfLen = length(halfSum);
            vec3 halfDir = halfLen > 0.0001 ? halfSum / halfLen : normal;
            // Two-sided specular: use abs() so specular appears on both sides of faces
            float NdotH = abs(dot(normal, halfDir));
            // Guard pow() against edge cases
            float safeSpecPower = max(uSpecularPower, 1.0);
            float spec = pow(max(NdotH, 0.0001), safeSpecPower) * uSpecularIntensity * attenuation * shadow;
            col += uSpecularColor * uLightColors[i] * spec;

            // Rim SSS (backlight transmission)
            if (uSssEnabled && uSssIntensity > 0.0) {
                vec3 sss = computeSSS(l, viewDir, normal, 0.5, uSssThickness * 4.0, 0.0);
                col += sss * uSssColor * uLightColors[i] * uSssIntensity * attenuation;
            }

            totalNdotL = max(totalNdotL, NdotL * attenuation);
        }

        // Fresnel rim lighting (two-sided: use abs() for symmetric rim effect)
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = abs(dot(normal, viewDir));
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * totalNdotL);
          col += uRimColor * rim;
        }

      } else if (uLightEnabled) {
        // Legacy single-light fallback
        col = baseColor * uAmbientColor * uAmbientIntensity;
        // Guard against zero-length light direction
        float ldLen = length(uLightDirection);
        vec3 lightDir = ldLen > 0.0001 ? uLightDirection / ldLen : vec3(0.0, 1.0, 0.0);

        // Two-sided lighting: use abs() so both sides of faces receive diffuse light
        float NdotL = abs(dot(normal, lightDir));
        col += baseColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        // Guard against lightDir and viewDir being opposite (zero-length half vector)
        vec3 halfSumLegacy = lightDir + viewDir;
        float halfLenLegacy = length(halfSumLegacy);
        vec3 halfDir = halfLenLegacy > 0.0001 ? halfSumLegacy / halfLenLegacy : normal;
        // Two-sided specular: use abs() so specular appears on both sides of faces
        float NdotH = abs(dot(normal, halfDir));
        // Guard pow() against edge cases
        float safeSpecPowerLegacy = max(uSpecularPower, 1.0);
        float spec = pow(max(NdotH, 0.0001), safeSpecPowerLegacy) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        // Rim SSS (backlight transmission) - legacy single light
        if (uSssEnabled && uSssIntensity > 0.0) {
          vec3 sss = computeSSS(lightDir, viewDir, normal, 0.5, uSssThickness * 4.0, 0.0);
          col += sss * uSssColor * uLightColor * uSssIntensity * uLightStrength;
        }

        // Fresnel rim lighting (two-sided: use abs() for symmetric rim effect)
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = abs(dot(normal, viewDir));
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * NdotL);
          col += uRimColor * rim;
        }
      } else {
        // No lighting - just ambient
        col = baseColor * uAmbientColor * uAmbientIntensity;
      }

      // Output to MRT
      // Guard against zero-length view normal (unlikely but possible with degenerate matrices)
      vec3 viewNormalRaw = (uViewMatrix * vec4(normal, 0.0)).xyz;
      float vnLen = length(viewNormalRaw);
      vec3 viewNormal = vnLen > 0.0001 ? viewNormalRaw / vnLen : vec3(0.0, 0.0, 1.0);
      gColor = vec4(col, uOpacity);
      gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
    }
    `
  ].join('\n');
}

/**
 * Edge fragment shader with MRT outputs.
 * Must output to both gColor (location 0) and gNormal (location 1)
 * to be compatible with MRT render targets.
 */
export function composeEdgeFragmentShader(): string {
  return `
    precision highp float;

    // MRT outputs - must match face shader outputs
    layout(location = 0) out vec4 gColor;
    layout(location = 1) out vec4 gNormal;

    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      // Color output for thin line edges
      gColor = vec4(uColor, uOpacity);
      // Neutral view-space normal (facing camera) encoded to 0-1, no metallic
      // This ensures edges work with post-processing that reads the normal buffer
      gNormal = vec4(0.5, 0.5, 1.0, 0.0);
    }
  `;
}
