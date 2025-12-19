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
import { ggxBlock } from '../shared/lighting/ggx.glsl';
import { shadowMapsUniformsBlock, shadowMapsFunctionsBlock } from '../shared/features/shadowMaps.glsl';
import { fogUniformsBlock, fogFunctionsBlock } from '../shared/features/fog.glsl';

import { transformNDBlock } from './transform-nd.glsl';
import { modulationBlock } from './modulation.glsl';

/**
 * Configuration for Polytope shader compilation.
 * Each feature flag controls whether that feature's code is compiled into the shader.
 * Disabled features are completely absent from the compiled shader, not just branched.
 */
export interface PolytopeShaderConfig {
  /** Enable fog integration (default: true) */
  fog?: boolean;
  /** Enable subsurface scattering (default: true) */
  sss?: boolean;
  /** Enable fresnel rim lighting (default: true) */
  fresnel?: boolean;
  /** Module names to exclude even if feature is enabled */
  overrides?: string[];
}

/**
 * Compose face vertex shader for Polytope rendering.
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
 * Compose edge vertex shader for Polytope wireframe rendering.
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
 * Compose face fragment shader with conditional features.
 *
 * Features are conditionally compiled - disabled features are completely
 * absent from the compiled shader, not just branched at runtime.
 *
 * @param config - Configuration for conditional compilation
 * @returns Object with glsl string, module names, and feature names
 */
export function composeFaceFragmentShader(config: PolytopeShaderConfig = {}): {
  glsl: string;
  modules: string[];
  features: string[];
} {
  const {
    fog: enableFog = true,
    sss: enableSss = true,
    fresnel: enableFresnel = true,
    overrides = [],
  } = config;

  // Build defines and features arrays
  const defines: string[] = [];
  const features: string[] = ['Multi-Light', 'Shadow Maps'];

  const useFog = enableFog && !overrides.includes('Fog');
  const useSss = enableSss && !overrides.includes('SSS');
  const useFresnel = enableFresnel && !overrides.includes('Fresnel');

  if (useFog) {
    defines.push('#define USE_FOG');
    features.push('Fog');
  }
  if (useSss) {
    defines.push('#define USE_SSS');
    features.push('SSS');
  }
  if (useFresnel) {
    defines.push('#define USE_FRESNEL');
    features.push('Fresnel');
  }

  // Build blocks array with conditional inclusion
  const blocks = [
    { name: 'Precision', content: precisionBlock },
    { name: 'Defines', content: defines.join('\n') },
    {
      name: 'Polytope Uniforms',
      content: `
    // Color uniforms
    uniform float uOpacity;

    // Legacy single-light uniforms
    uniform bool uLightEnabled;
    uniform vec3 uLightColor;
    uniform vec3 uLightDirection;
    uniform float uLightStrength;

    // SSS uniforms (always declared, code conditionally compiled)
    uniform bool uSssEnabled;
    uniform float uSssIntensity;
    uniform vec3 uSssColor;
    uniform float uSssThickness;
    uniform float uSssJitter;

    // GGX PBR roughness
    uniform float uRoughness;

    // Inputs from vertex shader
    in vec3 vWorldPosition;
    in vec3 vViewDir;
    // Face depth with flat interpolation - first vertex of each triangle wins
    flat in float vFaceDepth;
    `,
    },
    { name: 'Constants', content: constantsBlock },
    { name: 'Shared Uniforms', content: uniformsBlock },
    { name: 'Color (HSL)', content: hslBlock },
    { name: 'Color (Cosine)', content: cosinePaletteBlock },
    { name: 'Color (Oklab)', content: oklabBlock },
    { name: 'Color Selector', content: selectorBlock },
    { name: 'Lighting (Fresnel)', content: fresnelBlock, condition: useFresnel },
    { name: 'Multi-Light System', content: multiLightBlock },
    { name: 'Lighting (SSS)', content: sssBlock, condition: useSss },
    { name: 'Lighting (GGX)', content: ggxBlock },
    { name: 'Shadow Maps Uniforms', content: shadowMapsUniformsBlock },
    { name: 'Shadow Maps Functions', content: shadowMapsFunctionsBlock },
    { name: 'Fog Uniforms', content: fogUniformsBlock, condition: useFog },
    { name: 'Fog Functions', content: fogFunctionsBlock, condition: useFog },
    { name: 'Main', content: polytopeMainBlock },
  ];

  // Assemble shader from blocks
  const modules: string[] = [];
  const glslParts: string[] = [];

  blocks.forEach((b) => {
    if (b.condition === false) return; // Disabled in config

    modules.push(b.name);

    if (overrides.includes(b.name)) {
      // Overridden: Don't add content
    } else {
      glslParts.push(b.content);
    }
  });

  return { glsl: glslParts.join('\n'), modules, features };
}

/**
 * Main block for Polytope fragment shader.
 * Uses #ifdef for conditional feature compilation.
 */
const polytopeMainBlock = `
void main() {
  // Compute face normal from screen-space derivatives of world position
  vec3 dPdx = dFdx(vWorldPosition);
  vec3 dPdy = dFdy(vWorldPosition);
  vec3 crossProd = cross(dPdx, dPdy);
  float crossLen = length(crossProd);
  // Guard against degenerate normals (edge-on faces where cross product is near-zero)
  vec3 normal = crossLen > 0.0001 ? crossProd / crossLen : vec3(0.0, 0.0, 1.0);
  // Guard against zero-length view direction
  float vViewLen = length(vViewDir);
  vec3 viewDir = vViewLen > 0.0001 ? vViewDir / vViewLen : vec3(0.0, 0.0, 1.0);

  // Two-sided lighting: flip normal to face viewer for correct specular
  vec3 faceNormal = dot(normal, viewDir) < 0.0 ? -normal : normal;

  // Clamp roughness to prevent division by zero in GGX (mirror-like minimum)
  float roughness = max(uRoughness, 0.04);

  // Get base color from algorithm using face depth as t value
  vec3 baseHSL = rgb2hsl(uColor);
  vec3 baseColor = getColorByAlgorithm(vFaceDepth, normal, baseHSL, vWorldPosition);

  // Multi-light calculation
  vec3 col;
  if (uNumLights > 0) {
    col = baseColor * uAmbientColor * uAmbientIntensity;
    float totalNdotL = 0.0;

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
        vec3 lightToFrag = ltfLen > 0.0001 ? ltfDiff / ltfLen : vec3(0.0, -1.0, 0.0);
        attenuation *= getSpotAttenuation(i, lightToFrag);
      }

      if (attenuation < 0.001) continue;

      // Shadow map sampling for mesh-based objects
      float shadow = uShadowEnabled ? getShadow(i, vWorldPosition) : 1.0;

      // Two-sided lighting: use abs() so both sides of faces receive diffuse light
      float NdotL = abs(dot(normal, l));
      col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

      // GGX Specular (PBR) - use faceNormal for two-sided lighting
      vec3 F0 = vec3(0.04);
      vec3 specular = computePBRSpecular(faceNormal, viewDir, l, roughness, F0);
      col += specular * uLightColors[i] * NdotL * uSpecularIntensity * attenuation * shadow;

      // Rim SSS (backlight transmission)
#ifdef USE_SSS
      if (uSssEnabled && uSssIntensity > 0.0) {
        vec3 sss = computeSSS(l, viewDir, normal, 0.5, uSssThickness * 4.0, 0.0, uSssJitter, gl_FragCoord.xy);
        col += sss * uSssColor * uLightColors[i] * uSssIntensity * attenuation;
      }
#endif

      totalNdotL = max(totalNdotL, NdotL * attenuation);
    }

    // Fresnel rim lighting
#ifdef USE_FRESNEL
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
      float NdotV = abs(dot(normal, viewDir));
      float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
      rim *= (0.3 + 0.7 * totalNdotL);
      col += uRimColor * rim;
    }
#endif

  } else if (uLightEnabled) {
    // Legacy single-light fallback
    col = baseColor * uAmbientColor * uAmbientIntensity;
    float ldLen = length(uLightDirection);
    vec3 lightDir = ldLen > 0.0001 ? uLightDirection / ldLen : vec3(0.0, 1.0, 0.0);

    float NdotL = abs(dot(normal, lightDir));
    col += baseColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

    // GGX Specular (PBR) - use faceNormal for two-sided lighting
    vec3 F0 = vec3(0.04);
    vec3 specular = computePBRSpecular(faceNormal, viewDir, lightDir, roughness, F0);
    col += specular * uLightColor * NdotL * uSpecularIntensity * uLightStrength;

    // Rim SSS - legacy single light
#ifdef USE_SSS
    if (uSssEnabled && uSssIntensity > 0.0) {
      vec3 sss = computeSSS(lightDir, viewDir, normal, 0.5, uSssThickness * 4.0, 0.0, uSssJitter, gl_FragCoord.xy);
      col += sss * uSssColor * uLightColor * uSssIntensity * uLightStrength;
    }
#endif

    // Fresnel rim lighting - legacy single light
#ifdef USE_FRESNEL
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
      float NdotV = abs(dot(normal, viewDir));
      float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
      rim *= (0.3 + 0.7 * NdotL);
      col += uRimColor * rim;
    }
#endif
  } else {
    // No lighting - just ambient
    col = baseColor * uAmbientColor * uAmbientIntensity;
  }

  // Atmospheric Depth Integration (Fog)
#ifdef USE_FOG
  float viewDist = length(vWorldPosition - cameraPosition);
  col = applyFog(col, viewDist);
#endif

  // Output to MRT
  vec3 viewNormalRaw = (uViewMatrix * vec4(normal, 0.0)).xyz;
  float vnLen = length(viewNormalRaw);
  vec3 viewNormal = vnLen > 0.0001 ? viewNormalRaw / vnLen : vec3(0.0, 0.0, 1.0);
  gColor = vec4(col, uOpacity);
  gNormal = vec4(viewNormal * 0.5 + 0.5, uMetallic);
}
`;

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
