/**
 * TSL Composition Types
 *
 * Type definitions for the TSL shader composition system.
 * Mirrors the WebGL compose-helpers pattern but for TSL nodes.
 *
 * @module rendering/tsl/compose/types
 */

import type { Node, UniformNode } from 'three/tsl'
import type * as THREE from 'three'

/**
 * Configuration for raymarched fractal shaders.
 * Used to conditionally include/exclude features.
 */
export interface FractalShaderConfig {
  /** Current dimension (3-11) */
  dimension: number
  /** Enable soft shadow calculation */
  shadows?: boolean
  /** Enable temporal reprojection */
  temporal?: boolean
  /** Enable ambient occlusion */
  ambientOcclusion?: boolean
  /** Enable subsurface scattering */
  sss?: boolean
  /** Enable fresnel rim lighting */
  fresnel?: boolean
  /** Feature overrides - disable specific features by name */
  overrides?: string[]
}

/**
 * Configuration for mesh-based shaders (Polytope, TubeWireframe).
 */
export interface MeshShaderConfig {
  /** Enable shadow maps */
  shadows?: boolean
  /** Enable subsurface scattering */
  sss?: boolean
  /** Enable fresnel rim lighting */
  fresnel?: boolean
  /** Feature overrides */
  overrides?: string[]
}

/**
 * Result of feature flag processing.
 * Indicates which features are enabled after processing config and overrides.
 */
export interface FeatureFlags {
  /** List of enabled feature names (for logging/debugging) */
  features: string[]
  /** Whether shadows are enabled */
  useShadows: boolean
  /** Whether temporal reprojection is enabled */
  useTemporal: boolean
  /** Whether ambient occlusion is enabled */
  useAO: boolean
  /** Whether subsurface scattering is enabled */
  useSss: boolean
  /** Whether fresnel rim lighting is enabled */
  useFresnel: boolean
}

/**
 * Result of mesh feature flag processing.
 */
export interface MeshFeatureFlags {
  /** List of enabled feature names */
  features: string[]
  /** Whether shadow maps are enabled */
  useShadows: boolean
  /** Whether SSS is enabled */
  useSss: boolean
  /** Whether fresnel is enabled */
  useFresnel: boolean
}

/**
 * Common uniforms for lighting calculations.
 */
export interface LightingUniforms {
  /** Camera position in world space */
  uCameraPosition: UniformNode<THREE.Vector3>
  /** Roughness for PBR */
  uRoughness: UniformNode<number>
  /** Metallic for PBR */
  uMetallic: UniformNode<number>
  /** Ambient light enabled (1.0 = on, 0.0 = off) */
  uAmbientEnabled: UniformNode<number>
  /** Ambient light color */
  uAmbientColor: UniformNode<THREE.Color>
  /** Ambient light intensity */
  uAmbientIntensity: UniformNode<number>
  /** Fresnel enabled */
  uFresnelEnabled: UniformNode<boolean>
  /** Fresnel intensity */
  uFresnelIntensity: UniformNode<number>
  /** Rim color for fresnel */
  uRimColor: UniformNode<THREE.Color>
}

/**
 * Uniforms for shadow calculations.
 */
export interface ShadowUniforms {
  /** Shadow quality (0-3) */
  uShadowQuality: UniformNode<number>
  /** Shadow softness */
  uShadowSoftness: UniformNode<number>
  /** Shadows enabled */
  uShadowEnabled: UniformNode<boolean>
}

/**
 * Uniforms for SSS calculations.
 */
export interface SSSUniforms {
  /** SSS enabled */
  uSssEnabled: UniformNode<boolean>
  /** SSS intensity */
  uSssIntensity: UniformNode<number>
  /** SSS color */
  uSssColor: UniformNode<THREE.Color>
  /** SSS thickness */
  uSssThickness: UniformNode<number>
}

/**
 * A TSL node block with optional condition.
 * Used for conditional feature composition.
 */
export interface TSLNodeBlock<T extends Node = Node> {
  /** Name of the feature block */
  name: string
  /** The TSL node to include */
  node: T
  /** Whether to include this block (default: true) */
  condition?: boolean
}

/**
 * Result of composing TSL nodes.
 */
export interface ComposedNodes {
  /** List of included feature names */
  features: string[]
  /** Map of feature name to TSL node */
  nodes: Map<string, Node>
}

