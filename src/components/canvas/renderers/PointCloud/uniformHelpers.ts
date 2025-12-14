/**
 * Uniform Update Helpers for PointCloud Rendering
 *
 * Helper functions to update shader uniforms in the useFrame callback.
 * Extracted from PointCloudScene to improve maintainability and reduce
 * the size of the animation loop.
 *
 * @module
 */

import { Color, Matrix4, ShaderMaterial, Vector3 } from 'three'

import type { ColorCache, LightColorCache } from '@/lib/colors/linearCache'
import { updateLinearColorUniform } from '@/lib/colors/linearCache'
import type { LightUniforms } from '@/lib/lights/uniforms'
import { updateLightUniforms } from '@/lib/lights/uniforms'
import type { MatrixND } from '@/lib/math/types'
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette'
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform'
import type { VisualStoreState } from '@/stores/visualStore'

import { MAX_EXTRA_DIMS } from './constants'

/**
 * GPU uniform data computed from rotation matrix.
 */
export interface GPUUniformData {
  rotationMatrix4D: Matrix4
  extraRotationCols: Float32Array
  depthRowSums: Float32Array
}

/**
 * N-D transformation uniform parameters.
 */
export interface NDTransformParams {
  dimension: number
  scales: number[]
  gpuData: GPUUniformData
  projectionDistance: number
  projectionType: 'perspective' | 'orthographic'
}

/**
 * Compute GPU uniform data from rotation matrix.
 *
 * @param rotationMatrix - N-D rotation matrix
 * @param dimension - Current dimension
 * @returns GPU uniform data
 */
export function computeGPUData(rotationMatrix: MatrixND, dimension: number): GPUUniformData {
  return matrixToGPUUniforms(rotationMatrix, dimension)
}

/**
 * Update N-D transformation uniforms on a material.
 *
 * @param material - ShaderMaterial to update
 * @param params - N-D transformation parameters
 */
export function updateNDTransformUniforms(
  material: ShaderMaterial,
  params: NDTransformParams
): void {
  const u = material.uniforms

  // Rotation matrix
  ;(u.uRotationMatrix4D!.value as Matrix4).copy(params.gpuData.rotationMatrix4D)

  // Dimension
  u.uDimension!.value = params.dimension

  // Scale uniforms (first 4 dimensions)
  u.uScale4D!.value = [
    params.scales[0] ?? 1,
    params.scales[1] ?? 1,
    params.scales[2] ?? 1,
    params.scales[3] ?? 1,
  ]

  // Extra scales (dimensions 5+)
  const extraScales = u.uExtraScales!.value as Float32Array
  for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
    extraScales[i] = params.scales[i + 4] ?? 1
  }

  // Extra rotation columns
  const extraCols = u.uExtraRotationCols!.value as Float32Array
  extraCols.set(params.gpuData.extraRotationCols)

  // Depth row sums
  const depthSums = u.uDepthRowSums!.value as Float32Array
  depthSums.set(params.gpuData.depthRowSums)

  // Projection uniforms
  u.uProjectionDistance!.value = params.projectionDistance
  u.uProjectionType!.value = params.projectionType === 'perspective' ? 1 : 0
}

/**
 * Update color palette uniforms on a point material.
 *
 * @param material - ShaderMaterial to update
 * @param visualState - Current visual store state
 */
export function updateColorPaletteUniforms(
  material: ShaderMaterial,
  visualState: VisualStoreState
): void {
  const u = material.uniforms
  const {
    colorAlgorithm,
    cosineCoefficients,
    distribution,
    lchLightness,
    lchChroma,
    multiSourceWeights,
  } = visualState

  // Color algorithm
  u.uColorAlgorithm!.value = COLOR_ALGORITHM_TO_INT[colorAlgorithm]

  // Cosine palette coefficients
  ;(u.uCosineA!.value as Vector3).set(
    cosineCoefficients.a[0],
    cosineCoefficients.a[1],
    cosineCoefficients.a[2]
  )
  ;(u.uCosineB!.value as Vector3).set(
    cosineCoefficients.b[0],
    cosineCoefficients.b[1],
    cosineCoefficients.b[2]
  )
  ;(u.uCosineC!.value as Vector3).set(
    cosineCoefficients.c[0],
    cosineCoefficients.c[1],
    cosineCoefficients.c[2]
  )
  ;(u.uCosineD!.value as Vector3).set(
    cosineCoefficients.d[0],
    cosineCoefficients.d[1],
    cosineCoefficients.d[2]
  )

  // Distribution parameters
  u.uDistPower!.value = distribution.power
  u.uDistCycles!.value = distribution.cycles
  u.uDistOffset!.value = distribution.offset

  // LCH color space
  u.uLchLightness!.value = lchLightness
  u.uLchChroma!.value = lchChroma

  // Multi-source weights
  ;(u.uMultiSourceWeights!.value as Vector3).set(
    multiSourceWeights.depth,
    multiSourceWeights.orbitTrap,
    multiSourceWeights.normal
  )
}

/**
 * Update lighting uniforms on a point material.
 *
 * @param material - ShaderMaterial to update
 * @param visualState - Current visual store state
 * @param colorCache - Color cache for linear color conversion
 * @param lightColorCache - Light color cache for multi-light system
 */
export function updateLightingUniforms(
  material: ShaderMaterial,
  visualState: VisualStoreState,
  colorCache: ColorCache,
  lightColorCache: LightColorCache
): void {
  const u = material.uniforms
  const {
    lights,
    lightEnabled,
    lightColor,
    lightHorizontalAngle,
    lightVerticalAngle,
    lightStrength,
    ambientIntensity,
    ambientColor,
    diffuseIntensity,
    specularIntensity,
    shininess,
    specularColor,
    fresnelEnabled,
    fresnelIntensity,
  } = visualState

  // Multi-light system
  updateLightUniforms(u as unknown as LightUniforms, lights, lightColorCache)

  // Legacy single-light uniforms
  u.uLightEnabled!.value = lightEnabled
  updateLinearColorUniform(colorCache.lightColor, u.uLightColor!.value as Color, lightColor)

  // Calculate light direction from angles
  const hRad = (lightHorizontalAngle * Math.PI) / 180
  const vRad = (lightVerticalAngle * Math.PI) / 180
  ;(u.uLightDirection!.value as Vector3).set(
    Math.cos(vRad) * Math.sin(hRad),
    Math.sin(vRad),
    Math.cos(vRad) * Math.cos(hRad)
  )

  u.uLightStrength!.value = lightStrength
  u.uAmbientIntensity!.value = ambientIntensity
  updateLinearColorUniform(colorCache.ambientColor, u.uAmbientColor!.value as Color, ambientColor)
  u.uDiffuseIntensity!.value = diffuseIntensity
  u.uSpecularIntensity!.value = specularIntensity
  u.uSpecularPower!.value = shininess
  updateLinearColorUniform(colorCache.specularColor, u.uSpecularColor!.value as Color, specularColor)

  // Fresnel uniforms
  u.uFresnelEnabled!.value = fresnelEnabled
  u.uFresnelIntensity!.value = fresnelIntensity
}

/**
 * Update point material base color and opacity uniforms.
 *
 * @param material - ShaderMaterial to update
 * @param colorCache - Color cache for linear color conversion
 * @param faceColor - Face/base color string
 * @param faceOpacity - Face/base opacity
 * @param edgeMetallic - Metallic value
 * @param pointSize - Point size (will be multiplied by 10)
 */
export function updatePointMaterialUniforms(
  material: ShaderMaterial,
  colorCache: ColorCache,
  faceColor: string,
  faceOpacity: number,
  edgeMetallic: number,
  pointSize: number
): void {
  const u = material.uniforms

  // Base color
  updateLinearColorUniform(colorCache.faceColor, u.uColor!.value as Color, faceColor)
  u.uOpacity!.value = faceOpacity

  // Material properties
  u.uMetallic!.value = edgeMetallic
  u.uPointSize!.value = pointSize * 10
}

/**
 * Update edge material color uniform.
 *
 * @param material - ShaderMaterial to update
 * @param colorCache - Color cache for linear color conversion
 * @param edgeColor - Edge color string
 */
export function updateEdgeMaterialUniforms(
  material: ShaderMaterial,
  colorCache: ColorCache,
  edgeColor: string
): void {
  const u = material.uniforms
  updateLinearColorUniform(colorCache.edgeColor, u.uEdgeColor!.value as Color, edgeColor)
}
