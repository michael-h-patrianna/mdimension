import { precisionBlock } from '../shared/core/precision.glsl';
import { constantsBlock } from '../shared/core/constants.glsl';
import { uniformsBlock } from '../shared/core/uniforms.glsl';
import { hslBlock } from '../shared/color/hsl.glsl';
import { cosinePaletteBlock } from '../shared/color/cosine-palette.glsl';
import { oklabBlock } from '../shared/color/oklab.glsl';
import { selectorBlock } from '../shared/color/selector.glsl';
import { fresnelBlock } from '../shared/lighting/fresnel.glsl';
import { multiLightBlock } from '../shared/lighting/multi-light.glsl';

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
      vViewDir = normalize(cameraPosition - worldPos.xyz);

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
    `
    void main() {
      // Compute face normal from screen-space derivatives of world position
      vec3 dPdx = dFdx(vWorldPosition);
      vec3 dPdy = dFdy(vWorldPosition);
      vec3 normal = normalize(cross(dPdx, dPdy));
      vec3 viewDir = normalize(vViewDir);

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
                vec3 lightToFrag = normalize(vWorldPosition - uLightPositions[i]);
                attenuation *= getSpotAttenuation(i, lightToFrag);
            }

            if (attenuation < 0.001) continue;

            // Polytope faces don't support shadows yet (raymarched shadows require SDF)
            // Shadows are disabled for polytopes in this refactor unless implemented (user says no features needed)
            float shadow = 1.0; 

            float NdotL = max(dot(normal, l), 0.0);
            col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

            vec3 halfDir = normalize(l + viewDir);
            float NdotH = max(dot(normal, halfDir), 0.0);
            float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation * shadow;
            col += uSpecularColor * uLightColors[i] * spec;

            totalNdotL = max(totalNdotL, NdotL * attenuation);
        }

        // Fresnel rim lighting
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * totalNdotL);
          col += uRimColor * rim;
        }

      } else if (uLightEnabled) {
        // Legacy single-light fallback
        col = baseColor * uAmbientColor * uAmbientIntensity;
        vec3 lightDir = normalize(uLightDirection);

        float NdotL = max(dot(normal, lightDir), 0.0);
        col += baseColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * NdotL);
          col += uRimColor * rim;
        }
      } else {
        // No lighting - just ambient
        col = baseColor * uAmbientColor * uAmbientIntensity;
      }

      // Output to MRT
      vec3 viewNormal = normalize((uViewMatrix * vec4(normal, 0.0)).xyz);
      gColor = vec4(col, uOpacity);
      gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
    }
    `
  ].join('\n');
}

/**
 *
 */
export function composeEdgeFragmentShader(): string {
  return `
    precision highp float;

    // Single output for thin line edges
    layout(location = 0) out vec4 fragColor;

    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      // Simple color output for thin line edges (1D primitives)
      fragColor = vec4(uColor, uOpacity);
    }
  `;
}
