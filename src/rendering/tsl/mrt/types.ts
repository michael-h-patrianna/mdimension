/**
 * MRT Helper Types for TSL Materials
 *
 * Provides type definitions for MRT uniform requirements and storage nodes.
 * Used by both raymarched and mesh materials for consistent MRT output.
 *
 * ## MRT Output Layout
 * - `output`: Color from colorNode (built-in output node)
 * - `normal`: View-space normal encoded [0,1], hit flag in alpha
 * - `position`: World position for temporal reprojection, hit flag in alpha
 *
 * @module rendering/tsl/mrt/types
 */

import type { ShaderNodeObject, UniformNode, Node } from 'three/tsl'
import type * as THREE from 'three'

/**
 * VarNode type - a TSL variable node with assign() method.
 * Created by calling .toVar() on any TSL node.
 */
export interface VarNodeType extends ShaderNodeObject<Node> {
  assign(value: ShaderNodeObject<Node> | number): void
}

/**
 * Uniforms required for clip-space depth calculation.
 * These are needed to transform local hit positions to clip space.
 */
export interface MRTDepthUniforms {
  /** Model matrix (local to world) */
  uModelMatrix: UniformNode<THREE.Matrix4>
  /** View matrix (world to view/camera) */
  uViewMatrix: UniformNode<THREE.Matrix4>
  /** Projection matrix (view to clip) */
  uProjectionMatrix: UniformNode<THREE.Matrix4>
}

/**
 * MRT storage nodes created outside Fn() for WebGPU compatibility.
 *
 * CRITICAL (MKB-001): These MUST be created outside Fn() to avoid
 * WebGPU "Invalid PipelineLayout" errors.
 */
export interface MRTStorageNodes {
  /** View-space normal (will be encoded to [0,1] in mrt output) */
  mrtNormalView: VarNodeType
  /** Hit flag: 1.0 = valid surface, 0.0 = background/miss */
  mrtHasHit: VarNodeType
  /** Clip-space depth [0,1] for gl_FragDepth equivalent */
  mrtClipDepth: VarNodeType
  /** World-space position for temporal reprojection */
  mrtWorldPos: VarNodeType
}

/**
 * Parameters for updating MRT storage in raymarched shaders.
 */
export interface RaymarchedMRTParams {
  /** Hit position in local/model space */
  hitPosLocal: ShaderNodeObject<Node>
  /** Surface normal in local/model space */
  normalLocal: ShaderNodeObject<Node>
  /** Whether ray hit surface (use float(1) for hit, float(0) for miss) */
  hasHit: ShaderNodeObject<Node>
}
