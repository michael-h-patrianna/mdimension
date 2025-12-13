/**
 * Unified Material System
 *
 * Factory for creating high-performance ShaderMaterials that use GPU-based
 * N-dimensional transformations.
 *
 * Features:
 * - Supports 3D to 11D rendering
 * - GPU-based rotation and projection
 * - Multiple render modes (solid, wireframe, points)
 * - Color modes (solid, palette, depth-based)
 * - Fresnel effects and lighting
 */

import {
  ShaderMaterial,
  Color,
  DoubleSide,
  AdditiveBlending,
  NormalBlending,
} from 'three';
import type { MatrixND } from '@/lib/math/types';
import {
  matrixToGPUUniforms,
  createNDTransformUniforms,
  MAX_GPU_DIMENSION,
  EXTRA_DIMS_SIZE,
} from '../transforms/ndTransform';

/**
 * Render mode for the material
 */
export type UnifiedRenderMode = 'solid' | 'wireframe' | 'points';

/**
 * Color mode for the material
 */
export type UnifiedColorMode = 'solid' | 'palette' | 'depth';

/**
 * Options for creating a unified material
 */
export interface UnifiedMaterialOptions {
  /** Render mode: solid faces, wireframe edges, or point cloud */
  renderMode?: UnifiedRenderMode;
  /** Maximum dimension to support (default: 11) */
  maxDimension?: number;
  /** Color mode for the material */
  colorMode?: UnifiedColorMode;
  /** Base color (hex string or Color) */
  color?: string | Color;
  /** Opacity (0-1) */
  opacity?: number;
  /** Enable lighting calculations */
  lighting?: boolean;
  /** Enable fresnel rim lighting */
  fresnelEnabled?: boolean;
  /** Point size for points mode */
  pointSize?: number;
  /** Line width for wireframe mode */
  lineWidth?: number;
}

/**
 * Default material options
 */
const DEFAULT_OPTIONS: Required<UnifiedMaterialOptions> = {
  renderMode: 'solid',
  maxDimension: MAX_GPU_DIMENSION,
  colorMode: 'solid',
  color: '#00FFFF',
  opacity: 1.0,
  lighting: true,
  fresnelEnabled: false,
  pointSize: 3.0,
  lineWidth: 1.0,
};

/**
 * Generates the vertex shader for unified materials.
 *
 * @param options - Material options
 * @returns GLSL vertex shader code
 */
function generateVertexShader(options: Required<UnifiedMaterialOptions>): string {
  const extraDims = options.maxDimension - 4;

  return `
// Unified Material Vertex Shader
// Supports dimensions 3 to ${options.maxDimension}

// Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[${extraDims}];

// Projection uniforms
uniform float uProjectionDistance;
uniform int uProjectionType; // 0 = orthographic, 1 = perspective

// Visual uniforms
uniform float uPointSize;
uniform float uTime;

// Extra dimension attributes (W and beyond)
attribute float aExtraDim0; // W (4th dimension)
${Array.from({ length: extraDims - 1 }, (_, i) =>
  `attribute float aExtraDim${i + 1}; // ${i + 5}th dimension`
).join('\n')}

// Face depth attribute for palette coloring
attribute float aFaceDepth;

// Varyings for fragment shader
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;
varying float vDepth;
varying float vFaceDepth;

void main() {
  // Collect extra dimensions
  float extraDims[${extraDims}];
  extraDims[0] = aExtraDim0;
  ${Array.from({ length: extraDims - 1 }, (_, i) =>
    `extraDims[${i + 1}] = aExtraDim${i + 1};`
  ).join('\n  ')}

  // Apply scale to all dimensions
  vec3 scaledPos = position * uScale4D.xyz;
  float scaledW = aExtraDim0 * uScale4D.w;
  for (int i = 0; i < ${extraDims}; i++) {
    extraDims[i] *= uExtraScales[i];
  }

  // Build 4D position vector
  vec4 pos4 = vec4(scaledPos, scaledW);

  // Apply 4D rotation matrix
  vec4 rotated4 = uRotationMatrix4D * pos4;

  // Apply perspective projection from N-D to 3D
  vec3 projectedPos;
  if (uProjectionType == 0) {
    // Orthographic
    projectedPos = rotated4.xyz;
  } else {
    // Perspective
    float effectiveDepth = rotated4.w;
    float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;

    for (int i = 0; i < ${extraDims}; i++) {
      if (i + 5 <= uDimension) {
        effectiveDepth += extraDims[i];
      }
    }
    effectiveDepth /= normFactor;

    float factor = 1.0 / (uProjectionDistance - effectiveDepth);
    projectedPos = rotated4.xyz * factor;
  }

  // Standard MVP transform
  vec4 worldPos = modelMatrix * vec4(projectedPos, 1.0);
  vWorldPosition = worldPos.xyz;

  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;

  // Calculate view direction for fresnel
  vViewDirection = normalize(cameraPosition - worldPos.xyz);

  // Transform normal (use rotated normal if available)
  #ifdef USE_NORMALS
    vNormal = normalize(normalMatrix * normal);
  #else
    vNormal = vec3(0.0, 1.0, 0.0);
  #endif

  // Pass depth for color variation
  vDepth = (rotated4.w + 1.0) * 0.5;
  vFaceDepth = aFaceDepth;

  // Point size for points mode
  ${options.renderMode === 'points' ? 'gl_PointSize = uPointSize;' : ''}
}
`;
}

/**
 * Generates the fragment shader for unified materials.
 *
 * @param options - Material options
 * @returns GLSL fragment shader code
 */
function generateFragmentShader(options: Required<UnifiedMaterialOptions>): string {
  return `
// Unified Material Fragment Shader

// Visual uniforms
uniform vec3 uColor;
uniform float uOpacity;
uniform int uColorMode; // 0 = solid, 1 = palette, 2 = depth
uniform vec3 uPaletteStart;
uniform vec3 uPaletteEnd;
uniform float uFresnelPower;
uniform float uFresnelIntensity;
uniform bool uFresnelEnabled;

// Lighting uniforms
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uDirectionalColor;
uniform float uDirectionalIntensity;
uniform vec3 uDirectionalDirection;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;
varying float vDepth;
varying float vFaceDepth;

void main() {
  // Determine base color based on color mode
  vec3 baseColor;
  if (uColorMode == 0) {
    // Solid color
    baseColor = uColor;
  } else if (uColorMode == 1) {
    // Palette gradient based on face depth
    baseColor = mix(uPaletteStart, uPaletteEnd, vFaceDepth);
  } else {
    // Depth-based color variation
    baseColor = uColor * (0.6 + 0.4 * vDepth);
  }

  ${options.lighting ? `
  // Lighting calculations
  vec3 ambient = uAmbientColor * uAmbientIntensity;

  // Directional light
  float NdotL = max(dot(vNormal, -uDirectionalDirection), 0.0);
  vec3 diffuse = uDirectionalColor * uDirectionalIntensity * NdotL;

  vec3 litColor = baseColor * (ambient + diffuse);
  ` : `
  vec3 litColor = baseColor;
  `}

  ${options.fresnelEnabled ? `
  // Fresnel rim lighting
  if (uFresnelEnabled) {
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), uFresnelPower);
    litColor += vec3(fresnel * uFresnelIntensity);
  }
  ` : ''}

  gl_FragColor = vec4(litColor, uOpacity);
}
`;
}

/**
 * Creates a unified ShaderMaterial for N-dimensional rendering.
 *
 * @param options - Material options
 * @returns Configured ShaderMaterial
 */
export function createUnifiedMaterial(
  options: UnifiedMaterialOptions = {}
): ShaderMaterial {
  const opts: Required<UnifiedMaterialOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const baseUniforms = createNDTransformUniforms(opts.maxDimension);
  const color = opts.color instanceof Color ? opts.color : new Color(opts.color);

  // Create uniforms object with proper typing
  const uniforms: Record<string, { value: unknown }> = {
    ...baseUniforms,
    // Alias for shader compatibility
    uRotationMatrix4D: { value: baseUniforms.rotationMatrix4D?.value },
    uColor: { value: color },
    uOpacity: { value: opts.opacity },
    uColorMode: { value: opts.colorMode === 'solid' ? 0 : opts.colorMode === 'palette' ? 1 : 2 },
    uPaletteStart: { value: new Color('#0066FF') },
    uPaletteEnd: { value: new Color('#FF0066') },
    uFresnelPower: { value: 3.0 },
    uFresnelIntensity: { value: 0.5 },
    uFresnelEnabled: { value: opts.fresnelEnabled },
    uAmbientColor: { value: new Color('#FFFFFF') },
    uAmbientIntensity: { value: 0.4 },
    uDirectionalColor: { value: new Color('#FFFFFF') },
    uDirectionalIntensity: { value: 0.8 },
    uDirectionalDirection: { value: [0.5, -1.0, 0.5] },
    uPointSize: { value: opts.pointSize },
    uTime: { value: 0 },
  };

  return new ShaderMaterial({
    uniforms,
    vertexShader: generateVertexShader(opts),
    fragmentShader: generateFragmentShader(opts),
    transparent: opts.opacity < 1.0,
    side: DoubleSide,
    blending: opts.opacity < 1.0 ? AdditiveBlending : NormalBlending,
    depthWrite: opts.opacity >= 1.0,
  });
}

/**
 * Updates a unified material's transformation uniforms.
 *
 * Call this in useFrame to update the material with current rotation/scale.
 *
 * @param material - ShaderMaterial to update
 * @param rotationMatrix - Composed N-D rotation matrix
 * @param dimension - Current dimension
 * @param scales - Per-axis scales
 * @param projectionDistance - Projection distance
 * @param projectionType - 'perspective' | 'orthographic'
 */
export function updateUnifiedMaterial(
  material: ShaderMaterial,
  rotationMatrix: MatrixND,
  dimension: number,
  scales: number[],
  projectionDistance: number,
  projectionType: 'perspective' | 'orthographic'
): void {
  const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

  material.uniforms.uRotationMatrix4D!.value = gpuData.rotationMatrix4D;
  material.uniforms.uDimension!.value = dimension;
  material.uniforms.uProjectionDistance!.value = projectionDistance;
  material.uniforms.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0;

  // Update scales
  const scale4D = [
    scales[0] ?? 1,
    scales[1] ?? 1,
    scales[2] ?? 1,
    scales[3] ?? 1,
  ];
  material.uniforms.uScale4D!.value = scale4D;

  const extraScales = material.uniforms.uExtraScales!.value as Float32Array;
  for (let i = 0; i < EXTRA_DIMS_SIZE; i++) {
    extraScales[i] = scales[i + 4] ?? 1;
  }
}

/**
 * Updates visual properties of a unified material.
 *
 * @param material - ShaderMaterial to update
 * @param color - New base color
 * @param opacity - New opacity
 * @param colorMode - New color mode
 */
export function updateUnifiedMaterialVisuals(
  material: ShaderMaterial,
  color: string | Color,
  opacity: number,
  colorMode: UnifiedColorMode
): void {
  const colorValue = color instanceof Color ? color : new Color(color);

  material.uniforms.uColor!.value = colorValue;
  material.uniforms.uOpacity!.value = opacity;
  material.uniforms.uColorMode!.value =
    colorMode === 'solid' ? 0 : colorMode === 'palette' ? 1 : 2;

  material.transparent = opacity < 1.0;
  material.blending = opacity < 1.0 ? AdditiveBlending : NormalBlending;
  material.depthWrite = opacity >= 1.0;
}

/**
 * Updates palette colors for palette color mode.
 *
 * @param material - ShaderMaterial to update
 * @param startColor - Start color of palette gradient
 * @param endColor - End color of palette gradient
 */
export function updateUnifiedMaterialPalette(
  material: ShaderMaterial,
  startColor: string | Color,
  endColor: string | Color
): void {
  material.uniforms.uPaletteStart!.value =
    startColor instanceof Color ? startColor : new Color(startColor);
  material.uniforms.uPaletteEnd!.value =
    endColor instanceof Color ? endColor : new Color(endColor);
}

/**
 * Updates lighting properties of a unified material.
 *
 * @param material - ShaderMaterial to update
 * @param ambientIntensity - Ambient light intensity
 * @param directionalIntensity - Directional light intensity
 * @param directionalDirection - Direction of directional light
 */
export function updateUnifiedMaterialLighting(
  material: ShaderMaterial,
  ambientIntensity: number,
  directionalIntensity: number,
  directionalDirection: [number, number, number]
): void {
  material.uniforms.uAmbientIntensity!.value = ambientIntensity;
  material.uniforms.uDirectionalIntensity!.value = directionalIntensity;
  material.uniforms.uDirectionalDirection!.value = directionalDirection;
}

/**
 * Updates fresnel effect properties.
 *
 * @param material - ShaderMaterial to update
 * @param enabled - Enable/disable fresnel
 * @param power - Fresnel falloff power
 * @param intensity - Fresnel intensity
 */
export function updateUnifiedMaterialFresnel(
  material: ShaderMaterial,
  enabled: boolean,
  power: number,
  intensity: number
): void {
  material.uniforms.uFresnelEnabled!.value = enabled;
  material.uniforms.uFresnelPower!.value = power;
  material.uniforms.uFresnelIntensity!.value = intensity;
}
