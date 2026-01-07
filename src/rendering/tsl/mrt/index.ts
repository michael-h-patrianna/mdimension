/**
 * MRT (Multiple Render Target) Helpers for TSL Materials
 *
 * This module provides shared utilities for configuring MRT output
 * in WebGPU/TSL materials. Extracted from working BlackHole/Schrodinger
 * implementations to ensure consistency across all object types.
 *
 * ## Usage Pattern
 *
 * ### For Raymarched Objects (Mandelbulb, Julia, BlackHole, Schrodinger)
 * ```typescript
 * import { createMRTStorage, createMRTNode, updateMRTRaymarched, setMRTMiss } from '@/rendering/tsl/mrt'
 *
 * // Outside Fn() - CRITICAL for WebGPU
 * const mrtStorage = createMRTStorage()
 *
 * const shader = Fn(() => {
 *   // ... raymarch to get hit position and normal ...
 *
 *   If(hasHit.greaterThan(0.5), () => {
 *     updateMRTRaymarched(mrtStorage, uniforms, { hitPosLocal: p, normalLocal: n, hasHit: float(1) })
 *   }).Else(() => {
 *     setMRTMiss(mrtStorage)
 *   })
 * })
 *
 * material.mrtNode = createMRTNode(mrtStorage)
 * material.depthNode = mrtStorage.mrtClipDepth
 * ```
 *
 * ### For Mesh Objects (Polytope)
 * ```typescript
 * import { createMeshMRTNode } from '@/rendering/tsl/mrt'
 *
 * material.mrtNode = createMeshMRTNode()
 * ```
 *
 * ## MRT Output Layout
 * - `output`: Color from colorNode (built-in output node)
 * - `normal`: View-space normal encoded [0,1], hit flag in alpha
 * - `position`: World position for temporal reprojection, hit flag in alpha
 *
 * @module rendering/tsl/mrt
 */

// Type definitions
export type {
  MRTDepthUniforms,
  MRTStorageNodes,
  RaymarchedMRTParams,
  VarNodeType,
} from './types'

// Storage factory and MRT node creation
export { createMRTStorage, createMRTNode } from './storage'

// Raymarched object helpers
export { updateMRTRaymarched, setMRTMiss } from './raymarched'

// Mesh object helpers
export { createMeshMRTNode } from './mesh'

// Shared depth calculation
export { computeClipDepth } from './depth'
