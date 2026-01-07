/**
 * TSL Composition Helpers
 *
 * Helper functions for composing TSL shader nodes with conditional features.
 * This mirrors the WebGL compose-helpers pattern but for TSL.
 *
 * Key difference from WebGL:
 * - WebGL concatenates GLSL strings with conditional blocks
 * - TSL conditionally creates/chains TSL nodes
 *
 * @module rendering/tsl/compose/compose-helpers
 */

import type {
  FractalShaderConfig,
  FeatureFlags,
  MeshShaderConfig,
  MeshFeatureFlags,
  TSLNodeBlock,
  ComposedNodes,
} from './types'
import type { Node } from 'three/tsl'

/**
 * Process fractal shader config to generate feature flags.
 * Common logic shared by all raymarched fractal shaders.
 *
 * Note: Raymarching fractals (mandelbulb, julia, schroedinger, blackhole) are always
 * rendered as fully opaque (solid mode).
 *
 * @param config - Shader configuration with feature toggles
 * @returns Feature flags object with boolean flags and feature list
 *
 * @example
 * const flags = processFeatureFlags({
 *   dimension: 4,
 *   shadows: true,
 *   ambientOcclusion: true,
 *   sss: false,
 * });
 * // flags.useShadows = true
 * // flags.useAO = true
 * // flags.useSss = false
 */
export function processFeatureFlags(config: FractalShaderConfig): FeatureFlags {
  const {
    shadows: enableShadows = false,
    temporal: enableTemporal = false,
    ambientOcclusion: enableAO = false,
    sss: enableSss = false,
    fresnel: enableFresnel = true,
    overrides = [],
  } = config

  const features: string[] = ['Multi-Light']

  const useShadows = !!enableShadows && !overrides.includes('Shadows')
  const useTemporal = !!enableTemporal && !overrides.includes('Temporal Reprojection')
  const useAO = !!enableAO && !overrides.includes('Ambient Occlusion')
  const useSss = !!enableSss && !overrides.includes('SSS')
  const useFresnel = !!enableFresnel && !overrides.includes('Fresnel')

  if (useShadows) features.push('Shadows')
  if (useTemporal) features.push('Temporal Reprojection')
  if (useAO) features.push('Ambient Occlusion')
  if (useSss) features.push('SSS')
  if (useFresnel) features.push('Fresnel')

  return {
    features,
    useShadows,
    useTemporal,
    useAO,
    useSss,
    useFresnel,
  }
}

/**
 * Process mesh shader config to generate feature flags.
 * Common logic shared by Polytope and TubeWireframe shaders.
 *
 * @param config - Mesh shader configuration with feature toggles
 * @returns Feature flags object with boolean flags and feature list
 */
export function processMeshFeatureFlags(config: MeshShaderConfig): MeshFeatureFlags {
  const {
    shadows: enableShadows = true,
    sss: enableSss = true,
    fresnel: enableFresnel = true,
    overrides = [],
  } = config

  const features: string[] = ['Multi-Light']

  const useShadows = enableShadows && !overrides.includes('Shadow Maps')
  const useSss = enableSss && !overrides.includes('SSS')
  const useFresnel = enableFresnel && !overrides.includes('Fresnel')

  if (useShadows) features.push('Shadow Maps')
  if (useSss) features.push('SSS')
  if (useFresnel) features.push('Fresnel')

  return {
    features,
    useShadows,
    useSss,
    useFresnel,
  }
}

/**
 * Compose TSL nodes from blocks array.
 * Only includes blocks where condition is true or undefined.
 *
 * This is the TSL equivalent of assembleShaderBlocks but returns
 * a map of nodes instead of a concatenated GLSL string.
 *
 * @param blocks - Array of TSL node blocks with optional conditions
 * @returns Object with feature list and node map
 *
 * @example
 * const blocks = [
 *   { name: 'Base Color', node: baseColorNode },
 *   { name: 'Shadows', node: shadowNode, condition: config.shadows },
 *   { name: 'AO', node: aoNode, condition: false }, // Disabled
 * ];
 * const { features, nodes } = composeTSLNodes(blocks);
 * // features = ['Base Color', 'Shadows']
 * // nodes.get('Base Color') = baseColorNode
 * // nodes.get('Shadows') = shadowNode
 */
export function composeTSLNodes<T extends Node>(blocks: TSLNodeBlock<T>[]): ComposedNodes {
  const features: string[] = []
  const nodes = new Map<string, Node>()

  for (const block of blocks) {
    // Skip blocks with condition explicitly set to false
    if (block.condition === false) continue

    features.push(block.name)
    nodes.set(block.name, block.node)
  }

  return { features, nodes }
}

/**
 * Select the appropriate SDF function based on dimension.
 * Used to dispatch to dimension-specific optimized SDF implementations.
 *
 * @param dimension - Current dimension (3-11)
 * @param sdfMap - Map of dimension to SDF function
 * @param fallback - Fallback SDF function for unsupported dimensions
 * @returns Selected SDF function
 *
 * @example
 * const sdf = selectDimensionSDF(5, {
 *   3: sdf3D,
 *   4: sdf4D,
 *   5: sdf5D,
 *   // ...
 * }, sdfGeneric);
 */
export function selectDimensionSDF<T>(
  dimension: number,
  sdfMap: Record<number, T>,
  fallback: T
): T {
  return sdfMap[dimension] ?? fallback
}

/**
 * Create a dimension-specific configuration object.
 * Includes optimization hints based on dimension.
 *
 * @param dimension - Current dimension
 * @returns Configuration with dimension-specific settings
 */
export function getDimensionConfig(dimension: number): {
  dimension: number
  maxIterationsHQ: number
  maxIterationsLQ: number
  basisVectorCount: number
  angleCount: number
} {
  // Clamp to valid range
  const dim = Math.max(3, Math.min(11, dimension))

  // Higher dimensions need more conservative iteration limits
  let maxIterationsHQ: number
  let maxIterationsLQ: number

  if (dim >= 9) {
    maxIterationsHQ = 35
    maxIterationsLQ = 20
  } else if (dim >= 7) {
    maxIterationsHQ = 40
    maxIterationsLQ = 24
  } else if (dim >= 5) {
    maxIterationsHQ = 48
    maxIterationsLQ = 28
  } else {
    maxIterationsHQ = 64
    maxIterationsLQ = 32
  }

  return {
    dimension: dim,
    maxIterationsHQ,
    maxIterationsLQ,
    basisVectorCount: dim,
    angleCount: dim - 1, // Hyperspherical coordinates have n-1 angles for nD
  }
}

