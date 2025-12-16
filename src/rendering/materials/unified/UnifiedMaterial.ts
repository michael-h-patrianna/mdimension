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
} from 'three'
import type { MatrixND } from '@/lib/math/types'
import {
  matrixToGPUUniforms,
  createNDTransformUniforms,
  MAX_GPU_DIMENSION,
  EXTRA_DIMS_SIZE,
} from '@/rendering/shaders/transforms/ndTransform'
import type { UnifiedMaterialOptions, UnifiedRenderMode, UnifiedColorMode } from './types'
import { generateUnifiedVertexShader } from './unified.vert.glsl'
import { generateUnifiedFragmentShader } from './unified.frag.glsl'

// Re-export types for convenience
export type { UnifiedMaterialOptions, UnifiedRenderMode, UnifiedColorMode }

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
  }

  const baseUniforms = createNDTransformUniforms(opts.maxDimension)
  const color = opts.color instanceof Color ? opts.color : new Color(opts.color)

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
  }

  return new ShaderMaterial({
    uniforms,
    vertexShader: generateUnifiedVertexShader(opts),
    fragmentShader: generateUnifiedFragmentShader(opts),
    transparent: opts.opacity < 1.0,
    side: DoubleSide,
    blending: opts.opacity < 1.0 ? AdditiveBlending : NormalBlending,
    depthWrite: opts.opacity >= 1.0,
  })
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
  const gpuData = matrixToGPUUniforms(rotationMatrix, dimension)

  material.uniforms.uRotationMatrix4D!.value = gpuData.rotationMatrix4D
  material.uniforms.uDimension!.value = dimension
  material.uniforms.uProjectionDistance!.value = projectionDistance
  material.uniforms.uProjectionType!.value = projectionType === 'perspective' ? 1 : 0

  // Update scales
  const scale4D = [
    scales[0] ?? 1,
    scales[1] ?? 1,
    scales[2] ?? 1,
    scales[3] ?? 1,
  ]
  material.uniforms.uScale4D!.value = scale4D

  const extraScales = material.uniforms.uExtraScales!.value as Float32Array
  for (let i = 0; i < EXTRA_DIMS_SIZE; i++) {
    extraScales[i] = scales[i + 4] ?? 1
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
  const colorValue = color instanceof Color ? color : new Color(color)

  material.uniforms.uColor!.value = colorValue
  material.uniforms.uOpacity!.value = opacity
  material.uniforms.uColorMode!.value =
    colorMode === 'solid' ? 0 : colorMode === 'palette' ? 1 : 2

  material.transparent = opacity < 1.0
  material.blending = opacity < 1.0 ? AdditiveBlending : NormalBlending
  material.depthWrite = opacity >= 1.0
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
    startColor instanceof Color ? startColor : new Color(startColor)
  material.uniforms.uPaletteEnd!.value =
    endColor instanceof Color ? endColor : new Color(endColor)
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
  material.uniforms.uAmbientIntensity!.value = ambientIntensity
  material.uniforms.uDirectionalIntensity!.value = directionalIntensity
  material.uniforms.uDirectionalDirection!.value = directionalDirection
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
  material.uniforms.uFresnelEnabled!.value = enabled
  material.uniforms.uFresnelPower!.value = power
  material.uniforms.uFresnelIntensity!.value = intensity
}

