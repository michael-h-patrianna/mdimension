/**
 * Temporal Cloud Accumulation Uniforms (TSL)
 *
 * Type definitions for temporal accumulation uniforms.
 * Matches WebGL: shaders/schroedinger/temporal/uniforms.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/temporal/uniforms
 */

import type { UniformNode } from 'three/tsl'
import type * as THREE from 'three'

/**
 * Uniforms for the reprojection pass.
 *
 * Takes the previous frame's accumulated cloud color and reprojects it
 * to the current camera view.
 */
export interface ReprojectionUniforms {
  /** Previous frame's accumulated cloud color */
  uPrevAccumulation: UniformNode<THREE.Texture>
  /** Previous frame's accumulated world positions (xyz = world pos, w = alpha weight) */
  uPrevPositionBuffer: UniformNode<THREE.Texture>
  /** Previous frame's view-projection matrix */
  uPrevViewProjectionMatrix: UniformNode<THREE.Matrix4>
  /** Current view-projection matrix */
  uViewProjectionMatrix: UniformNode<THREE.Matrix4>
  /** Current camera position */
  uCameraPosition: UniformNode<THREE.Vector3>
  /** Full accumulation buffer resolution */
  uAccumulationResolution: UniformNode<THREE.Vector2>
  /** Disocclusion threshold for depth-based rejection */
  uDisocclusionThreshold: UniformNode<number>
}

/**
 * Uniforms for the reconstruction pass.
 *
 * Combines freshly rendered quarter-res pixels with reprojected history
 * to produce the full-resolution accumulated cloud image.
 */
export interface ReconstructionUniforms {
  /** New quarter-res cloud render (color) */
  uCloudRender: UniformNode<THREE.Texture>
  /** New quarter-res cloud positions (from MRT attachment 1) */
  uCloudPosition: UniformNode<THREE.Texture>
  /** Reprojected history color (from reprojection pass) */
  uReprojectedHistory: UniformNode<THREE.Texture>
  /** Reprojected history positions (from position accumulation buffer) */
  uReprojectedPositionHistory: UniformNode<THREE.Texture>
  /** Validity mask (from reprojection pass) */
  uValidityMask: UniformNode<THREE.Texture>
  /** Current Bayer offset (determines which pixel was rendered this frame) */
  uBayerOffset: UniformNode<THREE.Vector2>
  /** Frame index for debugging */
  uFrameIndex: UniformNode<number>
  /** Quarter-res cloud buffer resolution */
  uCloudResolution: UniformNode<THREE.Vector2>
  /** Full accumulation buffer resolution */
  uAccumulationResolution: UniformNode<THREE.Vector2>
  /** Blend weight for history (0.0 = favor new, 1.0 = favor history) */
  uHistoryWeight: UniformNode<number>
  /** Whether this is one of the first frames (no valid history yet) */
  uHasValidHistory: UniformNode<boolean>
}

/**
 * Uniforms for the main Schrödinger shader when temporal accumulation is active.
 *
 * These are added to the main shader to support quarter-res rendering.
 */
export interface TemporalAccumulationMainUniforms {
  /** Current Bayer offset for this frame */
  uBayerOffset: UniformNode<THREE.Vector2>
  /** Full resolution (for computing actual pixel position) */
  uFullResolution: UniformNode<THREE.Vector2>
  /** Inverse view projection matrix (for ray direction computation) */
  uInverseViewProjectionMatrix: UniformNode<THREE.Matrix4>
}

